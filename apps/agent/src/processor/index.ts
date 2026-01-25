/**
 * SIGNAL PROCESSOR
 *
 * Processes new listings and generates opportunities.
 *
 * PIPELINE:
 * 1. Fetch unprocessed listings
 * 2. Calculate signals for each card
 * 3. Create SignalSnapshot
 * 4. Detect opportunities (>10% discount)
 * 5. Generate investment thesis + ThesisRecord
 * 6. Queue for alerts and X posting
 *
 * Runs every minute via cron.
 */

import { CronJob } from 'cron';
import { Queue } from 'bullmq';
import { Redis } from 'ioredis';

import { signalCalculator, Signals } from './signal-calculator.js';
import { thesisGenerator, Opportunity } from './thesis-generator.js';

// Dynamic import for Prisma to work with ESM and Prisma 7.x
let prisma: any;
async function getPrisma(): Promise<any> {
  if (!prisma) {
    const prismaModule = (await import('@prisma/client')) as any;
    const PrismaClient =
      prismaModule.PrismaClient ?? prismaModule.default?.PrismaClient ?? prismaModule.default;
    prisma = new PrismaClient();
  }
  return prisma;
}
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

// BullMQ queues
const alertQueue = new Queue('telegram:alerts', { connection: redis });
const xPostQueue = new Queue('agent:post', { connection: redis });

// Processing stats
let processedCount = 0;
let opportunitiesFound = 0;
let lastRunTime: Date | null = null;

/**
 * Process new listings and generate opportunities.
 */
export async function processNewListings() {
  const startTime = Date.now();
  console.log('[processor] Checking for new opportunities...');

  const db = await getPrisma();

  try {
    // Get recent listings that haven't been processed
    const listings = await db.listing.findMany({
      where: {
        isActive: true,
        scrapedAt: {
          // Only process listings from last hour
          gte: new Date(Date.now() - 60 * 60 * 1000)
        }
      },
      include: {
        card: true
      },
      orderBy: { scrapedAt: 'desc' },
      take: 100
    });

    // Filter to only unprocessed (check Redis)
    const unprocessed = [];
    for (const listing of listings) {
      const processed = await redis.get(`processed:${listing.id}`);
      if (!processed) {
        unprocessed.push(listing);
      }
    }

    console.log(
      `[processor] Found ${unprocessed.length} unprocessed listings (of ${listings.length} recent)`
    );

    let foundThisRun = 0;

    for (const listing of unprocessed) {
      try {
        // Calculate signals for this card
        const signals = await signalCalculator.calculate(listing.cardId);

        // Skip if no fair value data
        if (signals.fairValue === 0) {
          await markProcessed(listing.id, 'no_fair_value');
          continue;
        }

        // Create SignalSnapshot for tracking
        const signalSnapshot = await createSignalSnapshot(db, listing.card, signals);

        // Calculate discount
        const discount = ((signals.fairValue - listing.price) / signals.fairValue) * 100;

        // Check if it's an opportunity (>10% discount)
        if (discount > 10) {
          const opportunity: Opportunity = {
            id: listing.id,
            cardId: listing.cardId,
            cardName: listing.card?.name || 'Unknown Card',
            setName: listing.card?.set || '',
            grade: listing.card?.grade || listing.condition,
            listingPrice: listing.price,
            listingUrl: listing.url,
            source: listing.source
          };

          // Generate thesis with timing
          const thesisStartTime = Date.now();
          const { thesis, recommendation, usedLLM } = await thesisGenerator.generate(
            opportunity,
            signals
          );
          const thesisTimeMs = Date.now() - thesisStartTime;

          // Store opportunity and thesis record in database
          const { opportunityId, thesisId } = await storeOpportunityWithThesis(
            db,
            opportunity,
            signals,
            thesis,
            recommendation,
            discount,
            usedLLM,
            thesisTimeMs,
            signalSnapshot?.id
          );

          // Queue for Telegram alerts
          await alertQueue.add(
            'send-alert',
            {
              opportunityId,
              cardName: opportunity.cardName,
              setName: opportunity.setName,
              grade: opportunity.grade,
              price: opportunity.listingPrice,
              fairValue: signals.fairValue,
              discount: discount.toFixed(1),
              thesis,
              recommendation,
              url: opportunity.listingUrl,
              source: opportunity.source,
              signals: {
                trend: signals.trend,
                liquidity: signals.liquidity.score,
                sentiment: signals.sentiment.label
              }
            },
            { removeOnComplete: 1000, removeOnFail: 500 }
          );

          // Queue for X posting (only strong buys)
          if (recommendation === 'STRONG_BUY' || discount > 20) {
            await xPostQueue.add(
              'post-opportunity',
              {
                opportunityId,
                cardName: opportunity.cardName,
                setName: opportunity.setName,
                grade: opportunity.grade,
                price: opportunity.listingPrice,
                fairValue: signals.fairValue,
                discount: discount.toFixed(1),
                thesis,
                url: opportunity.listingUrl
              },
              { removeOnComplete: 100, removeOnFail: 50 }
            );
          }

          console.log(
            `[processor] 🎯 Found: ${opportunity.cardName} (${discount.toFixed(1)}% discount) [${
              usedLLM ? 'LLM' : 'Template'
            }]`
          );
          foundThisRun++;
          opportunitiesFound++;
        }

        // Mark as processed
        await markProcessed(listing.id, discount > 10 ? 'opportunity' : 'no_opportunity');
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Unknown error';
        console.error(`[processor] Error processing listing ${listing.id}:`, msg);
        await markProcessed(listing.id, 'error');
      }
    }

    processedCount += unprocessed.length;
    lastRunTime = new Date();

    const duration = Date.now() - startTime;
    console.log(
      `[processor] Processed ${unprocessed.length} listings in ${duration}ms. Found ${foundThisRun} opportunities.`
    );

    // Update stats in Redis
    await redis.hset('processor:stats', {
      lastRun: lastRunTime.toISOString(),
      lastDuration: duration.toString(),
      processedTotal: processedCount.toString(),
      opportunitiesTotal: opportunitiesFound.toString(),
      lastBatch: unprocessed.length.toString(),
      lastOpportunities: foundThisRun.toString()
    });
  } catch (error) {
    console.error('[processor] Fatal error:', error);
  }
}

/**
 * Mark a listing as processed in Redis.
 */
async function markProcessed(listingId: string, result: string) {
  // Set with 24h TTL (reprocess after a day)
  await redis.setex(`processed:${listingId}`, 24 * 60 * 60, result);
}

/**
 * Create a SignalSnapshot for a card.
 */
async function createSignalSnapshot(
  db: any,
  card: any,
  signals: Signals
): Promise<{ id: string } | null> {
  if (!card) return null;

  try {
    const snapshot = await db.signalSnapshot.create({
      data: {
        cardId: card.id,
        cardKey: card.cardKey,
        timestamp: new Date(),

        // Fair value
        fairValueCents: Math.round(signals.fairValue * 100),
        confidenceScore: signals.confidence,

        // Trend
        trendDirection: signals.trend.direction,
        trendPct: signals.trend.percent,
        trendPeriodDays: signals.trend.period,

        // Liquidity
        liquidityScore: signals.liquidity.score,
        activeListings: signals.liquidity.activeListings,
        avgDaysOnMarket: signals.liquidity.avgDaysOnMarket,
        velocity30d: signals.liquidity.velocity30d,

        // Sentiment
        sentimentScore: signals.sentiment.score,
        sentimentLabel: signals.sentiment.label,
        sentimentPostCount: signals.sentiment.postCount,

        // Scarcity
        psa10Pop: signals.scarcity.psa10Pop,
        totalPop: signals.scarcity.totalPop,
        scarcityScore: signals.scarcity.scarcityScore,

        // Arbitrage
        arbitrageOpportunities: signals.arbitrage as any
      }
    });

    return { id: snapshot.id };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.warn(`[processor] Error creating signal snapshot:`, msg);
    return null;
  }
}

/**
 * Store opportunity and thesis record in database.
 */
async function storeOpportunityWithThesis(
  db: any,
  opportunity: Opportunity,
  signals: Signals,
  thesis: string,
  recommendation: string,
  discount: number,
  usedLLM: boolean,
  thesisTimeMs: number,
  signalSnapshotId?: string
): Promise<{ opportunityId: string; thesisId: string }> {
  // Create Opportunity in database
  const dbOpportunity = await db.opportunity.create({
    data: {
      cardId: opportunity.cardId,
      cardKey: opportunity.cardName.toLowerCase().replace(/\s+/g, '-'),
      listingId: opportunity.id,
      signalSnapshotId,

      // Pricing
      listingPriceCents: Math.round(opportunity.listingPrice * 100),
      fairValueCents: Math.round(signals.fairValue * 100),
      discountPct: discount,

      // Status
      status: 'ACTIVE',
      recommendation,

      // Source
      source: opportunity.source,
      sourceUrl: opportunity.listingUrl,

      detectedAt: new Date()
    }
  });

  // Create ThesisRecord
  const thesisRecord = await db.thesisRecord.create({
    data: {
      opportunityId: dbOpportunity.id,

      // Thesis content
      thesis,
      recommendation,

      // Generation details
      usedLLM,
      modelName: usedLLM ? 'llama-3.1-8b-instant' : 'template',
      promptTokens: usedLLM ? 500 : 0, // Approximate
      completionTokens: usedLLM ? 200 : 0, // Approximate
      costCents: usedLLM ? 0.014 : 0, // ~$0.00014 per call
      generationTimeMs: thesisTimeMs,

      // Signals snapshot
      signalsSnapshot: {
        fairValue: signals.fairValue,
        confidence: signals.confidence,
        trend: signals.trend,
        liquidity: signals.liquidity,
        sentiment: signals.sentiment,
        scarcity: signals.scarcity,
        arbitrage: signals.arbitrage
      },

      createdAt: new Date()
    }
  });

  // Also store in Redis for quick access
  await redis.hset(`opportunity:${dbOpportunity.id}`, {
    cardName: opportunity.cardName,
    setName: opportunity.setName,
    grade: opportunity.grade || '',
    price: opportunity.listingPrice.toString(),
    fairValue: signals.fairValue.toString(),
    discount: discount.toString(),
    recommendation,
    thesis,
    source: opportunity.source,
    url: opportunity.listingUrl,
    createdAt: new Date().toISOString()
  });

  // Set TTL (7 days)
  await redis.expire(`opportunity:${dbOpportunity.id}`, 7 * 24 * 60 * 60);

  // Add to sorted set for retrieval
  await redis.zadd('opportunities:recent', Date.now(), dbOpportunity.id);

  // Trim to last 500 opportunities
  await redis.zremrangebyrank('opportunities:recent', 0, -501);

  return {
    opportunityId: dbOpportunity.id,
    thesisId: thesisRecord.id
  };
}

/**
 * Get recent opportunities.
 */
export async function getRecentOpportunities(limit = 20) {
  const ids = await redis.zrevrange('opportunities:recent', 0, limit - 1);
  const opportunities = [];

  for (const id of ids) {
    const data = await redis.hgetall(`opportunity:${id}`);
    if (data && Object.keys(data).length > 0) {
      opportunities.push({
        id,
        ...data,
        price: parseFloat(data.price || '0'),
        fairValue: parseFloat(data.fairValue || '0'),
        discount: parseFloat(data.discount || '0')
      });
    }
  }

  return opportunities;
}

/**
 * Get processor stats.
 */
export async function getProcessorStats() {
  const stats = await redis.hgetall('processor:stats');
  return {
    lastRun: stats.lastRun || null,
    lastDuration: parseInt(stats.lastDuration || '0', 10),
    processedTotal: parseInt(stats.processedTotal || '0', 10),
    opportunitiesTotal: parseInt(stats.opportunitiesTotal || '0', 10),
    lastBatch: parseInt(stats.lastBatch || '0', 10),
    lastOpportunities: parseInt(stats.lastOpportunities || '0', 10)
  };
}

// ============================================================
// MAIN: Cron scheduler
// ============================================================

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('[processor] Starting Signal Processor...');
  console.log('[processor] Schedule: Every minute');
  console.log('');

  // Run immediately on start
  processNewListings().catch(console.error);

  // Schedule to run every minute
  const job = new CronJob('* * * * *', () => {
    processNewListings().catch(console.error);
  });

  job.start();

  // Graceful shutdown
  const shutdown = async () => {
    console.log('\n[processor] Shutting down...');
    job.stop();
    if (prisma) await prisma.$disconnect();
    redis.quit();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  console.log('[processor] Running. Press Ctrl+C to stop.\n');
}

// Export for use in other modules
export { signalCalculator, thesisGenerator };
