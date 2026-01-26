/**
 * PRICECHARTING WORKER
 *
 * Fetches Pokemon card prices from PriceCharting.com API.
 * Creates PriceSnapshot records for each grade level.
 *
 * Requires paid PriceCharting subscription.
 * API Docs: https://www.pricecharting.com/api-documentation
 *
 * Note: Run sparingly - API has rate limits and costs money.
 */

import * as crypto from 'crypto';
import { BaseWorker } from './base-worker.js';
import {
  PriceChartingClient,
  NormalizedCardPrice,
} from '../services/pricecharting.js';

const PARSER_VERSION = '1.0.0';
const SYNC_COOLDOWN_HOURS = 4; // Don't re-sync cards within this window

export class PriceChartingWorker extends BaseWorker {
  private client: PriceChartingClient | null = null;

  constructor() {
    super({
      name: 'pricecharting',
      cronPattern: process.env.PRICECHARTING_CRON || '0 */6 * * *', // Every 6 hours
      maxRetries: 3,
      retryDelayMs: 2000,
      timeoutMs: 600000, // 10 minutes - lots of cards to fetch
    });
  }

  private getClient(): PriceChartingClient {
    if (!this.client) {
      const token = process.env.PRICECHARTING_API_TOKEN;
      if (!token) {
        throw new Error(
          'PRICECHARTING_API_TOKEN environment variable is required'
        );
      }
      this.client = new PriceChartingClient(token);
    }
    return this.client;
  }

  protected async run(): Promise<void> {
    const token = process.env.PRICECHARTING_API_TOKEN;
    if (!token) {
      this.logger.warn(
        'PRICECHARTING_API_TOKEN not set - skipping PriceCharting sync'
      );
      return;
    }

    this.logger.info('Starting PriceCharting price sync');

    const prisma = await this.getPrisma();

    try {
      // Get cards that need price updates
      // Prioritize: watchlisted cards, recently updated cards
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
          cardKey: true,
        },
        take: 50, // Limit per run to respect API limits
      });

      this.logger.info({ cardCount: cardsToSync.length }, 'Found cards to sync');

      let successCount = 0;
      let errorCount = 0;
      let skippedCount = 0;

      for (const card of cardsToSync) {
        // Check cooldown via Redis
        const syncKey = `pricecharting:sync:${card.id}`;
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

            // Mark as synced
            await this.redis.set(syncKey, Date.now().toString(), 'EX', 86400); // 24h TTL
          } else {
            this.logger.debug(
              { cardId: card.id, cardName: card.name },
              'No prices found'
            );
            errorCount++;
          }

          // Be nice to the API - 1 second between requests
          await this.sleep(1000);
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

      this.logger.info(
        {
          successCount,
          errorCount,
          skippedCount,
          totalRequests: this.getClient().getRequestCount(),
        },
        'PriceCharting sync complete'
      );
    } finally {
      await prisma.$disconnect();
    }
  }

  private async fetchCardPrices(card: {
    id: string;
    name: string;
    set: string;
    cardKey: string | null;
  }): Promise<NormalizedCardPrice | null> {
    const client = this.getClient();

    // Search by name + set for best results
    const searchQuery = `${card.name} ${card.set} pokemon`;

    const product = await client.searchProduct(searchQuery);

    if (product) {
      // Verify it's actually a Pokemon card
      const consoleName = product['console-name'].toLowerCase();
      if (
        !consoleName.includes('pokemon') &&
        !consoleName.includes('pocket monsters')
      ) {
        this.logger.debug(
          { productName: product['product-name'], consoleName },
          'Skipping non-Pokemon product'
        );
        return null;
      }

      return client.normalizeProduct(product);
    }

    // Try simpler search with just card name
    const simpleProduct = await client.searchProduct(`${card.name} pokemon`);
    if (simpleProduct) {
      const consoleName = simpleProduct['console-name'].toLowerCase();
      if (
        consoleName.includes('pokemon') ||
        consoleName.includes('pocket monsters')
      ) {
        return client.normalizeProduct(simpleProduct);
      }
    }

    return null;
  }

  private async storePrices(
    prisma: any,
    card: { id: string; name: string; cardKey: string | null },
    prices: NormalizedCardPrice
  ): Promise<void> {
    const now = new Date();

    // Create a PriceSnapshot for each grade level
    for (const gradePrice of prices.prices) {
      const rawData = {
        priceChartingId: prices.priceChartingId,
        productName: prices.productName,
        grade: gradePrice.grade,
        grader: gradePrice.grader,
        priceCents: gradePrice.priceCents,
        salesVolume: prices.salesVolume,
        releaseDate: prices.releaseDate,
      };

      // Calculate hash for deduplication
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

      // Check for duplicate (same card, grade, grader, price)
      const existing = await prisma.priceSnapshot.findFirst({
        where: {
          rawHash,
          timestamp: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Within 24 hours
          },
        },
      });

      if (existing) {
        continue; // Skip duplicate
      }

      await prisma.priceSnapshot.create({
        data: {
          cardId: card.id,
          cardKey:
            card.cardKey || card.name.toLowerCase().replace(/\s+/g, '-'),
          timestamp: now,
          source: 'PRICECHARTING',
          sourceVersion: 'v1-api',
          sourceItemId: prices.priceChartingId,
          sourceUrl: `https://www.pricecharting.com/game/pokemon-${prices.consoleName.toLowerCase().replace(/\s+/g, '-')}/${prices.priceChartingId}`,
          listingType: 'price_guide',
          priceCents: gradePrice.priceCents,
          currency: 'USD',
          grade:
            gradePrice.grade === 'UNGRADED'
              ? null
              : `${gradePrice.grader} ${gradePrice.grade}`,
          grader: gradePrice.grader === 'NONE' ? null : gradePrice.grader,
          gradeNumeric:
            gradePrice.grade === 'UNGRADED'
              ? null
              : parseFloat(gradePrice.grade),
          title: prices.productName,
          raw: rawData as any,
          rawHash,
          parserVersion: PARSER_VERSION,
        },
      });
    }

    this.logger.debug(
      {
        cardId: card.id,
        priceCount: prices.prices.length,
        priceChartingId: prices.priceChartingId,
      },
      'Stored prices'
    );
  }
}

export const pricechartingWorker = new PriceChartingWorker();
