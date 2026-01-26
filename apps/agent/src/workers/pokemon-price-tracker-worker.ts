/**
 * POKEMON PRICE TRACKER WORKER
 *
 * Fetches Pokemon card prices from PokemonPriceTracker.com API.
 * Aggregates data from TCGPlayer, eBay, and CardMarket.
 * Creates PriceSnapshot records for raw prices and graded prices.
 *
 * API Docs: https://www.pokemonpricetracker.com/docs
 *
 * Features:
 * - Multi-source pricing (TCGPlayer, eBay, CardMarket)
 * - PSA graded prices (7, 8, 9, 10)
 * - 100 calls/day on free tier, 20K on standard ($9.99/mo)
 *
 * Run schedule: Every 2 hours by default (adjustable via POKEMON_PRICE_TRACKER_CRON)
 */

import * as crypto from 'crypto';
import { BaseWorker } from './base-worker.js';
import {
  PokemonPriceTrackerClient,
  NormalizedPrice,
} from '../services/pokemon-price-tracker.js';

const PARSER_VERSION = '1.0.0';
const SYNC_COOLDOWN_HOURS = 6; // Don't re-sync cards within this window

export class PokemonPriceTrackerWorker extends BaseWorker {
  private client: PokemonPriceTrackerClient | null = null;

  constructor() {
    super({
      name: 'pokemon-price-tracker',
      cronPattern: process.env.POKEMON_PRICE_TRACKER_CRON || '0 */2 * * *', // Every 2 hours
      maxRetries: 3,
      retryDelayMs: 2000,
      timeoutMs: 300000, // 5 minutes
    });
  }

  private getClient(): PokemonPriceTrackerClient {
    if (!this.client) {
      const apiKey = process.env.POKEMON_PRICE_TRACKER_API_KEY;
      if (!apiKey) {
        throw new Error(
          'POKEMON_PRICE_TRACKER_API_KEY environment variable is required'
        );
      }
      this.client = new PokemonPriceTrackerClient(apiKey);
    }
    return this.client;
  }

  protected async run(): Promise<void> {
    const apiKey = process.env.POKEMON_PRICE_TRACKER_API_KEY;
    if (!apiKey) {
      this.logger.warn(
        'POKEMON_PRICE_TRACKER_API_KEY not set - skipping PokemonPriceTracker sync'
      );
      return;
    }

    this.logger.info('Starting PokemonPriceTracker price sync');

    const prisma = await this.getPrisma();

    try {
      // Get cards that need price updates
      // Prioritize: watchlisted cards, cards with recent activity
      const cardsToSync = await prisma.card.findMany({
        where: {
          OR: [
            { watchlistItems: { some: {} } }, // Has watchlist items
            {
              updatedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
            }, // Updated in last 7 days
          ],
        },
        select: {
          id: true,
          name: true,
          set: true,
          number: true,
          cardKey: true,
        },
        take: 50, // Limit per run - free tier is 100/day, be conservative
      });

      this.logger.info(
        { cardCount: cardsToSync.length },
        'Found cards to sync'
      );

      let successCount = 0;
      let errorCount = 0;
      let skippedCount = 0;

      for (const card of cardsToSync) {
        // Check cooldown via Redis
        const syncKey = `ppt:sync:${card.id}`;
        const lastSync = await this.redis.get(syncKey);

        if (lastSync) {
          const hoursSinceSync =
            (Date.now() - parseInt(lastSync)) / (1000 * 60 * 60);
          if (hoursSinceSync < SYNC_COOLDOWN_HOURS) {
            skippedCount++;
            continue;
          }
        }

        try {
          const prices = await this.fetchCardPrices(card);

          if (prices) {
            await this.storePrices(prisma, card, prices);
            successCount++;
            this.incrementItemsProcessed();

            // Mark as synced (24h TTL)
            await this.redis.set(syncKey, Date.now().toString(), 'EX', 86400);
          } else {
            this.logger.debug(
              { cardId: card.id, cardName: card.name },
              'No prices found'
            );
            errorCount++;
          }

          // Small delay between requests (API is fast, but be polite)
          await this.sleep(200);
        } catch (error) {
          errorCount++;
          this.logger.error(
            {
              cardId: card.id,
              error: (error as Error).message,
            },
            'Failed to fetch prices for card'
          );
        }
      }

      const client = this.getClient();
      this.logger.info(
        {
          successCount,
          errorCount,
          skippedCount,
          totalRequests: client.getRequestCount(),
          dailyRequests: client.getDailyRequestCount(),
        },
        'PokemonPriceTracker sync complete'
      );
    } finally {
      await prisma.$disconnect();
    }
  }

  private async fetchCardPrices(card: {
    id: string;
    name: string;
    set: string;
    number: string;
    cardKey: string | null;
  }): Promise<NormalizedPrice | null> {
    const client = this.getClient();

    // Use the parse-title endpoint which is the primary working API
    // Build a search title from card name and set
    const searchTitle = `${card.name} ${card.set}`;
    const response = await client.parseTitle(searchTitle);

    if (!response || response.matches.length === 0) {
      return null;
    }

    // Find the best match - prefer exact set name match
    const bestMatch = response.matches.find((m) =>
      m.setName.toLowerCase().includes(card.set.toLowerCase()) ||
      card.set.toLowerCase().includes(m.setName.toLowerCase())
    ) || response.matches[0];

    // Build normalized price from the match
    const prices: NormalizedPrice['prices'] = [];

    if (bestMatch.prices.market !== null) {
      prices.push({
        source: 'tcgplayer',
        market: bestMatch.prices.market,
        low: bestMatch.prices.low,
        high: bestMatch.prices.high,
      });
    }

    // PSA grade if parsed
    const gradedPrices: NormalizedPrice['gradedPrices'] = [];
    if (response.parsed.psaGrade) {
      // The market price likely includes the grade factor
      gradedPrices.push({
        grade: response.parsed.psaGrade.toString(),
        grader: 'PSA',
        priceCents: bestMatch.prices.market ? Math.round(bestMatch.prices.market * 100) : 0,
      });
    }

    return {
      cardId: bestMatch.tcgPlayerId,
      cardName: bestMatch.name,
      setId: bestMatch.setId.toString(),
      prices,
      gradedPrices,
      fetchedAt: new Date(),
    };
  }

  private async storePrices(
    prisma: any,
    card: { id: string; name: string; cardKey: string | null },
    prices: NormalizedPrice
  ): Promise<void> {
    const now = new Date();

    // Store raw prices from each source
    for (const sourcePrice of prices.prices) {
      if (sourcePrice.market === null) continue;

      const rawData = {
        source: sourcePrice.source,
        cardId: prices.cardId,
        cardName: prices.cardName,
        market: sourcePrice.market,
        low: sourcePrice.low,
        high: sourcePrice.high,
      };

      // Calculate hash for deduplication
      const rawHash = crypto
        .createHash('sha256')
        .update(
          JSON.stringify({
            cardId: card.id,
            source: sourcePrice.source,
            market: sourcePrice.market,
          })
        )
        .digest('hex');

      // Check for duplicate within 24 hours
      const existing = await prisma.priceSnapshot.findFirst({
        where: {
          rawHash,
          timestamp: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
          },
        },
      });

      if (existing) continue;

      // Map source to our Source enum
      const sourceMap: Record<string, string> = {
        tcgplayer: 'TCGPLAYER',
        ebay: 'EBAY',
        cardmarket: 'CARDMARKET',
      };

      await prisma.priceSnapshot.create({
        data: {
          cardId: card.id,
          cardKey:
            card.cardKey || card.name.toLowerCase().replace(/\s+/g, '-'),
          timestamp: now,
          source: sourceMap[sourcePrice.source] || 'POKEMON_PRICE_TRACKER',
          sourceVersion: 'ppt-v1',
          sourceItemId: prices.cardId,
          sourceUrl: `https://www.pokemonpricetracker.com/card/${prices.cardId}`,
          listingType: 'market_price',
          priceCents: Math.round(sourcePrice.market * 100),
          currency: 'USD',
          title: prices.cardName,
          raw: rawData as any,
          rawHash,
          parserVersion: PARSER_VERSION,
        },
      });
    }

    // Store graded prices
    for (const gradePrice of prices.gradedPrices) {
      const rawData = {
        cardId: prices.cardId,
        grade: gradePrice.grade,
        grader: gradePrice.grader,
        priceCents: gradePrice.priceCents,
      };

      const rawHash = crypto
        .createHash('sha256')
        .update(
          JSON.stringify({
            cardId: card.id,
            grade: gradePrice.grade,
            grader: gradePrice.grader,
            priceCents: gradePrice.priceCents,
          })
        )
        .digest('hex');

      // Check for duplicate
      const existing = await prisma.priceSnapshot.findFirst({
        where: {
          rawHash,
          timestamp: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
          },
        },
      });

      if (existing) continue;

      await prisma.priceSnapshot.create({
        data: {
          cardId: card.id,
          cardKey:
            card.cardKey || card.name.toLowerCase().replace(/\s+/g, '-'),
          timestamp: now,
          source: 'POKEMON_PRICE_TRACKER',
          sourceVersion: 'ppt-v1',
          sourceItemId: prices.cardId,
          sourceUrl: `https://www.pokemonpricetracker.com/card/${prices.cardId}`,
          listingType: 'graded_price',
          priceCents: gradePrice.priceCents,
          currency: 'USD',
          grade: `${gradePrice.grader} ${gradePrice.grade}`,
          grader: gradePrice.grader,
          gradeNumeric: parseFloat(gradePrice.grade),
          title: `${prices.cardName} - ${gradePrice.grader} ${gradePrice.grade}`,
          raw: rawData as any,
          rawHash,
          parserVersion: PARSER_VERSION,
        },
      });
    }

    this.logger.debug(
      {
        cardId: card.id,
        sources: prices.prices.length,
        gradedPrices: prices.gradedPrices.length,
      },
      'Stored prices'
    );
  }
}

export const pokemonPriceTrackerWorker = new PokemonPriceTrackerWorker();
