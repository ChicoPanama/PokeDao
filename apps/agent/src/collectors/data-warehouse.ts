/**
 * DATA WAREHOUSE SERVICE
 *
 * Scheduled jobs for aggregating and maintaining the data warehouse.
 *
 * Jobs:
 * - snapshotSignals: Hourly signal snapshots for all tracked cards
 * - aggregateDailyStats: Daily stats aggregation at midnight
 * - updateOutcomes: Weekly outcome updates on Sunday
 */

import { CronJob } from 'cron';
import { Redis } from 'ioredis';
import { signalCalculator } from '../processor/signal-calculator.js';

// Dynamic import for Prisma to work with ESM and Prisma 7.x
let prisma: any;
async function getPrisma(): Promise<any> {
  if (!prisma) {
    const prismaModule = (await import('@prisma/client')) as any;
    const PrismaClient =
      prismaModule.PrismaClient ??
      prismaModule.default?.PrismaClient ??
      prismaModule.default;
    prisma = new PrismaClient();
  }
  return prisma;
}

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

// Job instances
let signalSnapshotJob: CronJob | null = null;
let dailyStatsJob: CronJob | null = null;
let outcomeUpdateJob: CronJob | null = null;

/**
 * Snapshot signals for all tracked cards.
 * Runs every hour at minute 0.
 */
export async function snapshotSignals(): Promise<void> {
  const startTime = Date.now();
  console.log('[warehouse] Starting hourly signal snapshot...');

  const db = await getPrisma();

  try {
    // Get all tracked cards
    const trackedCards = await db.card.findMany({
      where: { tracked: true },
      select: { id: true, cardKey: true, name: true }
    });

    console.log(`[warehouse] Snapshotting signals for ${trackedCards.length} tracked cards`);

    let successCount = 0;
    let errorCount = 0;

    for (const card of trackedCards) {
      try {
        // Calculate signals
        const signals = card.cardKey
          ? await signalCalculator.calculateByCardKey(card.cardKey)
          : await signalCalculator.calculate(card.id);

        // Skip if no fair value (no price data)
        if (signals.fairValue === 0) {
          continue;
        }

        // Create signal snapshot
        await db.signalSnapshot.create({
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

            // Arbitrage opportunities
            arbitrageOpportunities: signals.arbitrage as any
          }
        });

        successCount++;
      } catch (error) {
        errorCount++;
        const msg = error instanceof Error ? error.message : 'Unknown error';
        console.error(`[warehouse] Error snapshotting card ${card.id}:`, msg);
      }
    }

    const duration = Date.now() - startTime;
    console.log(
      `[warehouse] Signal snapshot complete: ${successCount} success, ${errorCount} errors in ${duration}ms`
    );

    // Update stats in Redis
    await redis.hset('warehouse:stats', {
      lastSignalSnapshot: new Date().toISOString(),
      lastSignalSnapshotDuration: duration.toString(),
      lastSignalSnapshotCount: successCount.toString()
    });
  } catch (error) {
    console.error('[warehouse] Fatal error in signal snapshot:', error);
  }
}

/**
 * Aggregate daily statistics for cards, market, and sources.
 * Runs daily at midnight.
 */
export async function aggregateDailyStats(): Promise<void> {
  const startTime = Date.now();
  console.log('[warehouse] Starting daily stats aggregation...');

  const db = await getPrisma();

  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    // ============================================================
    // Aggregate DailyCardStats from PriceSnapshots
    // ============================================================
    const cardsWithSnapshots = await db.priceSnapshot.groupBy({
      by: ['cardId'],
      where: {
        timestamp: {
          gte: yesterday,
          lt: today
        }
      },
      _count: true
    });

    console.log(`[warehouse] Aggregating stats for ${cardsWithSnapshots.length} cards`);

    let cardStatsCreated = 0;
    const topMovers: Array<{ cardId: string; cardKey: string | null; changePct: number }> = [];

    for (const group of cardsWithSnapshots) {
      try {
        // Get all snapshots for this card yesterday
        const snapshots = await db.priceSnapshot.findMany({
          where: {
            cardId: group.cardId,
            timestamp: {
              gte: yesterday,
              lt: today
            }
          },
          orderBy: { timestamp: 'asc' }
        });

        if (snapshots.length === 0) continue;

        // Calculate statistics
        const prices = snapshots.map((s: any) => s.priceCents);
        const avgPrice = prices.reduce((a: number, b: number) => a + b, 0) / prices.length;
        const minPrice = Math.min(...prices);
        const maxPrice = Math.max(...prices);
        const medianPrice = prices.sort((a: number, b: number) => a - b)[Math.floor(prices.length / 2)];

        // Get open/close prices
        const openPrice = snapshots[0].priceCents;
        const closePrice = snapshots[snapshots.length - 1].priceCents;
        const changePct = openPrice > 0 ? ((closePrice - openPrice) / openPrice) * 100 : 0;

        // Get card info for cardKey
        const card = await db.card.findUnique({
          where: { id: group.cardId },
          select: { cardKey: true }
        });

        // Count unique sources
        const sources = [...new Set(snapshots.map((s: any) => s.source))];

        // Create daily card stats
        await db.dailyCardStats.upsert({
          where: {
            cardId_date: {
              cardId: group.cardId,
              date: yesterday
            }
          },
          create: {
            cardId: group.cardId,
            cardKey: card?.cardKey,
            date: yesterday,
            openPriceCents: openPrice,
            closePriceCents: closePrice,
            highPriceCents: maxPrice,
            lowPriceCents: minPrice,
            avgPriceCents: Math.round(avgPrice),
            medianPriceCents: medianPrice,
            volume: snapshots.length,
            listingCount: snapshots.filter((s: any) => s.listingType === 'active').length,
            saleCount: snapshots.filter((s: any) => s.listingType === 'sold').length,
            sourceCount: sources.length,
            sources: sources
          },
          update: {
            openPriceCents: openPrice,
            closePriceCents: closePrice,
            highPriceCents: maxPrice,
            lowPriceCents: minPrice,
            avgPriceCents: Math.round(avgPrice),
            medianPriceCents: medianPrice,
            volume: snapshots.length,
            listingCount: snapshots.filter((s: any) => s.listingType === 'active').length,
            saleCount: snapshots.filter((s: any) => s.listingType === 'sold').length,
            sourceCount: sources.length,
            sources: sources
          }
        });

        cardStatsCreated++;
        topMovers.push({ cardId: group.cardId, cardKey: card?.cardKey, changePct });
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Unknown error';
        console.error(`[warehouse] Error aggregating card ${group.cardId}:`, msg);
      }
    }

    // ============================================================
    // Create DailyMarketStats
    // ============================================================
    const allDailyStats = await db.dailyCardStats.findMany({
      where: { date: yesterday }
    });

    if (allDailyStats.length > 0) {
      // Sort for top movers
      topMovers.sort((a, b) => b.changePct - a.changePct);
      const topGainers = topMovers.slice(0, 10);
      const topLosers = topMovers.sort((a, b) => a.changePct - b.changePct).slice(0, 10);

      const totalVolume = allDailyStats.reduce((sum: number, s: any) => sum + s.volume, 0);
      const totalSales = allDailyStats.reduce((sum: number, s: any) => sum + s.saleCount, 0);
      const totalListings = allDailyStats.reduce((sum: number, s: any) => sum + s.listingCount, 0);

      // Calculate market-wide average change
      const avgChange =
        allDailyStats.length > 0
          ? allDailyStats.reduce((sum: number, s: any) => {
              const change =
                s.openPriceCents > 0
                  ? ((s.closePriceCents - s.openPriceCents) / s.openPriceCents) * 100
                  : 0;
              return sum + change;
            }, 0) / allDailyStats.length
          : 0;

      await db.dailyMarketStats.upsert({
        where: { date: yesterday },
        create: {
          date: yesterday,
          totalVolume,
          totalSaleCount: totalSales,
          totalListingCount: totalListings,
          avgPriceChangePct: avgChange,
          topGainers: topGainers.slice(0, 10) as any,
          topLosers: topLosers.slice(0, 10) as any,
          activeCardCount: allDailyStats.length,
          newListingsCount: totalListings,
          sentimentAvg: 0 // TODO: Calculate from social posts
        },
        update: {
          totalVolume,
          totalSaleCount: totalSales,
          totalListingCount: totalListings,
          avgPriceChangePct: avgChange,
          topGainers: topGainers.slice(0, 10) as any,
          topLosers: topLosers.slice(0, 10) as any,
          activeCardCount: allDailyStats.length,
          newListingsCount: totalListings
        }
      });
    }

    // ============================================================
    // Create DailySourceStats
    // ============================================================
    const sourceGroups = await db.priceSnapshot.groupBy({
      by: ['source'],
      where: {
        timestamp: {
          gte: yesterday,
          lt: today
        }
      },
      _count: true,
      _avg: { priceCents: true }
    });

    for (const sourceGroup of sourceGroups) {
      const sourceSnapshots = await db.priceSnapshot.findMany({
        where: {
          source: sourceGroup.source,
          timestamp: {
            gte: yesterday,
            lt: today
          }
        },
        select: { cardId: true, listingType: true }
      });

      const uniqueCards = [...new Set(sourceSnapshots.map((s: any) => s.cardId))];
      const saleCount = sourceSnapshots.filter((s: any) => s.listingType === 'sold').length;
      const listingCount = sourceSnapshots.filter((s: any) => s.listingType === 'active').length;

      await db.dailySourceStats.upsert({
        where: {
          source_date: {
            source: sourceGroup.source,
            date: yesterday
          }
        },
        create: {
          source: sourceGroup.source,
          date: yesterday,
          snapshotCount: sourceGroup._count,
          uniqueCardCount: uniqueCards.length,
          saleCount,
          listingCount,
          avgPriceCents: Math.round(sourceGroup._avg?.priceCents || 0),
          errorCount: 0,
          latencyMs: 0
        },
        update: {
          snapshotCount: sourceGroup._count,
          uniqueCardCount: uniqueCards.length,
          saleCount,
          listingCount,
          avgPriceCents: Math.round(sourceGroup._avg?.priceCents || 0)
        }
      });
    }

    const duration = Date.now() - startTime;
    console.log(
      `[warehouse] Daily stats aggregation complete: ${cardStatsCreated} cards, ${sourceGroups.length} sources in ${duration}ms`
    );

    // Update stats in Redis
    await redis.hset('warehouse:stats', {
      lastDailyStats: new Date().toISOString(),
      lastDailyStatsDuration: duration.toString(),
      lastDailyStatsCardCount: cardStatsCreated.toString()
    });
  } catch (error) {
    console.error('[warehouse] Fatal error in daily stats aggregation:', error);
  }
}

/**
 * Update user outcomes with current values.
 * Runs weekly on Sunday at midnight.
 */
export async function updateOutcomes(): Promise<void> {
  const startTime = Date.now();
  console.log('[warehouse] Starting weekly outcome update...');

  const db = await getPrisma();

  try {
    // Get all outcomes that are still holding
    const holdingOutcomes = await db.userOutcome.findMany({
      where: { status: 'HOLDING' },
      include: { card: true }
    });

    console.log(`[warehouse] Updating ${holdingOutcomes.length} holding outcomes`);

    let updatedCount = 0;
    let errorCount = 0;

    for (const outcome of holdingOutcomes) {
      try {
        // Get current signals for the card
        const signals = outcome.card?.cardKey
          ? await signalCalculator.calculateByCardKey(outcome.card.cardKey)
          : await signalCalculator.calculate(outcome.cardId);

        if (signals.fairValue === 0) {
          continue;
        }

        const currentValueCents = Math.round(signals.fairValue * 100);
        const unrealizedReturn = currentValueCents - outcome.purchasePriceCents;
        const unrealizedReturnPct =
          outcome.purchasePriceCents > 0
            ? (unrealizedReturn / outcome.purchasePriceCents) * 100
            : 0;

        // Update outcome
        await db.userOutcome.update({
          where: { id: outcome.id },
          data: {
            currentValueCents,
            unrealizedReturnCents: unrealizedReturn,
            unrealizedReturnPct,
            updatedAt: new Date()
          }
        });

        updatedCount++;
      } catch (error) {
        errorCount++;
        const msg = error instanceof Error ? error.message : 'Unknown error';
        console.error(`[warehouse] Error updating outcome ${outcome.id}:`, msg);
      }
    }

    const duration = Date.now() - startTime;
    console.log(
      `[warehouse] Outcome update complete: ${updatedCount} updated, ${errorCount} errors in ${duration}ms`
    );

    // Update stats in Redis
    await redis.hset('warehouse:stats', {
      lastOutcomeUpdate: new Date().toISOString(),
      lastOutcomeUpdateDuration: duration.toString(),
      lastOutcomeUpdateCount: updatedCount.toString()
    });
  } catch (error) {
    console.error('[warehouse] Fatal error in outcome update:', error);
  }
}

/**
 * Start all data warehouse jobs.
 */
export function start(): void {
  console.log('[warehouse] Starting Data Warehouse Service...');

  // Hourly signal snapshots (at minute 0)
  signalSnapshotJob = new CronJob('0 * * * *', () => {
    snapshotSignals().catch(console.error);
  });
  signalSnapshotJob.start();
  console.log('[warehouse] Signal snapshot job scheduled: 0 * * * *');

  // Daily stats aggregation (at midnight)
  dailyStatsJob = new CronJob('0 0 * * *', () => {
    aggregateDailyStats().catch(console.error);
  });
  dailyStatsJob.start();
  console.log('[warehouse] Daily stats job scheduled: 0 0 * * *');

  // Weekly outcome updates (Sunday at midnight)
  outcomeUpdateJob = new CronJob('0 0 * * 0', () => {
    updateOutcomes().catch(console.error);
  });
  outcomeUpdateJob.start();
  console.log('[warehouse] Outcome update job scheduled: 0 0 * * 0');

  console.log('[warehouse] All jobs started. Press Ctrl+C to stop.\n');
}

/**
 * Stop all data warehouse jobs.
 */
export function stop(): void {
  console.log('[warehouse] Stopping Data Warehouse Service...');

  if (signalSnapshotJob) {
    signalSnapshotJob.stop();
    signalSnapshotJob = null;
  }

  if (dailyStatsJob) {
    dailyStatsJob.stop();
    dailyStatsJob = null;
  }

  if (outcomeUpdateJob) {
    outcomeUpdateJob.stop();
    outcomeUpdateJob = null;
  }

  console.log('[warehouse] All jobs stopped.');
}

/**
 * Get warehouse stats.
 */
export async function getStats() {
  const stats = await redis.hgetall('warehouse:stats');
  return {
    lastSignalSnapshot: stats.lastSignalSnapshot || null,
    lastSignalSnapshotDuration: parseInt(stats.lastSignalSnapshotDuration || '0', 10),
    lastSignalSnapshotCount: parseInt(stats.lastSignalSnapshotCount || '0', 10),
    lastDailyStats: stats.lastDailyStats || null,
    lastDailyStatsDuration: parseInt(stats.lastDailyStatsDuration || '0', 10),
    lastDailyStatsCardCount: parseInt(stats.lastDailyStatsCardCount || '0', 10),
    lastOutcomeUpdate: stats.lastOutcomeUpdate || null,
    lastOutcomeUpdateDuration: parseInt(stats.lastOutcomeUpdateDuration || '0', 10),
    lastOutcomeUpdateCount: parseInt(stats.lastOutcomeUpdateCount || '0', 10)
  };
}

// ============================================================
// MAIN: Start if run directly
// ============================================================

if (import.meta.url === `file://${process.argv[1]}`) {
  start();

  // Graceful shutdown
  const shutdown = async () => {
    console.log('\n[warehouse] Shutting down...');
    stop();
    if (prisma) await prisma.$disconnect();
    redis.quit();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  // Run initial jobs if requested
  if (process.argv.includes('--run-now')) {
    console.log('[warehouse] Running initial jobs...');
    Promise.all([snapshotSignals(), aggregateDailyStats(), updateOutcomes()])
      .then(() => console.log('[warehouse] Initial jobs complete'))
      .catch(console.error);
  }
}
