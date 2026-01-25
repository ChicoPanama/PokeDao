/**
 * EBAY DATA COLLECTION WORKER
 *
 * Collects sold listings from eBay for price history.
 * - Runs every 15 minutes
 * - Fetches recent sold listings for tracked cards
 * - Extracts grade from title when possible
 * - Saves to PriceSnapshot with full provenance
 */

import crypto from 'crypto';
import { BaseWorker } from './base-worker.js';

const PARSER_VERSION = '1.0.0';
const SOURCE_VERSION = 'browse-api-v1';

interface EbaySale {
  price: number;
  date: Date;
  grade: string | null;
  condition: string | null;
  url: string;
  title: string;
  sourceItemId: string;
  raw: object;
}

export class EbayWorker extends BaseWorker {
  private ebayAppId: string;

  constructor() {
    super({
      name: 'ebay',
      cronPattern: '*/15 * * * *', // Every 15 minutes
      maxRetries: 3,
      retryDelayMs: 2000,
      timeoutMs: 120000, // 2 minutes
    });
    this.ebayAppId = process.env.EBAY_APP_ID || '';
  }

  async run() {
    if (!this.ebayAppId) {
      this.logger.warn('No EBAY_APP_ID configured, skipping');
      return;
    }

    const prisma = await this.getPrisma();

    try {
      // Get cards to track - use CanonicalCard for now
      const cards = await prisma.canonicalCard.findMany({
        select: { id: true, canonicalName: true, canonicalSet: true },
        take: 50,
      });

      this.logger.info({ cardCount: cards.length }, 'Processing cards');

      let totalSnapshots = 0;
      let duplicatesSkipped = 0;

      for (const card of cards) {
        try {
          const sales = await this.fetchSoldListings(card.canonicalName, card.canonicalSet);

          for (const sale of sales) {
            // Calculate rawHash for deduplication
            const rawHash = crypto
              .createHash('sha256')
              .update(JSON.stringify(sale.raw))
              .digest('hex');

            // Check if we already have this snapshot
            const existing = await prisma.priceSnapshot.findFirst({
              where: { rawHash }
            });

            if (existing) {
              duplicatesSkipped++;
              continue;
            }

            // Create PriceSnapshot
            await prisma.priceSnapshot.create({
              data: {
                cardKey: `${card.canonicalName}-${card.canonicalSet}`.toLowerCase().replace(/\s+/g, '-'),
                timestamp: sale.date,
                source: 'EBAY',
                externalId: sale.sourceItemId,
                listingType: 'sold',
                priceCents: Math.round(sale.price * 100),
                currency: 'USD',
                condition: sale.condition,
                grade: sale.grade,
                grader: sale.grade ? this.extractGradeCompany(sale.grade) : null,
                raw: {
                  ...sale.raw,
                  url: sale.url,
                  title: sale.title,
                } as any,
                rawHash,
                parserVersion: PARSER_VERSION,
                sourceVersion: SOURCE_VERSION,
              }
            });

            totalSnapshots++;
          }

          // Rate limit: 200ms between cards
          await this.delay(200);
        } catch (error) {
          const msg = error instanceof Error ? error.message : 'Unknown error';
          this.logger.error({ card: card.canonicalName, error: msg }, 'Error processing card');
        }
      }

      this.logger.info({
        snapshots: totalSnapshots,
        duplicates: duplicatesSkipped,
        cards: cards.length,
      }, 'eBay collection complete');

      this.incrementItemsProcessed(totalSnapshots);

      // Update run stats in Redis
      await this.redis.hset('worker:ebay:stats', {
        cardsProcessed: cards.length.toString(),
        snapshotsCreated: totalSnapshots.toString(),
        duplicatesSkipped: duplicatesSkipped.toString(),
        lastRun: new Date().toISOString()
      });
    } finally {
      await prisma.$disconnect();
    }
  }

  private async fetchSoldListings(name: string, set: string): Promise<EbaySale[]> {
    const query = encodeURIComponent(`${name} ${set} pokemon card`);

    try {
      // Use eBay Browse API for sold items
      const response = await fetch(
        `https://api.ebay.com/buy/browse/v1/item_summary/search?q=${query}&filter=buyingOptions:{FIXED_PRICE|AUCTION},conditionIds:{1000|1500|2000|2500|3000}&limit=25`,
        {
          headers: {
            Authorization: `Bearer ${await this.getEbayToken()}`,
            'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US',
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        if (response.status === 401) {
          this.logger.warn('eBay token expired, will refresh next run');
        }
        throw new Error(`eBay API error: ${response.status}`);
      }

      const data = (await response.json()) as { itemSummaries?: any[] };

      return (data.itemSummaries || []).map((item: any) => ({
        price: parseFloat(item.price?.value || '0'),
        date: new Date(item.itemEndDate || item.itemCreationDate || Date.now()),
        grade: this.extractGrade(item.title || ''),
        condition: this.mapCondition(item.conditionId),
        url: item.itemWebUrl || '',
        title: item.title || '',
        sourceItemId: item.itemId || item.legacyItemId || '',
        raw: item // Store full API response
      }));
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error({ name, error: msg }, 'eBay API error');
      return [];
    }
  }

  private async getEbayToken(): Promise<string> {
    // Check Redis cache first
    const cached = await this.redis.get('ebay:access_token');
    if (cached) return cached;

    // Get new token using client credentials
    const credentials = Buffer.from(
      `${this.ebayAppId}:${process.env.EBAY_CERT_ID || ''}`
    ).toString('base64');

    try {
      const response = await fetch('https://api.ebay.com/identity/v1/oauth2/token', {
        method: 'POST',
        headers: {
          Authorization: `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: 'grant_type=client_credentials&scope=https://api.ebay.com/oauth/api_scope'
      });

      if (!response.ok) {
        throw new Error(`Token refresh failed: ${response.status}`);
      }

      const data = (await response.json()) as { access_token: string };
      const token = data.access_token;

      // Cache for 1 hour (tokens are valid for 2 hours)
      await this.redis.setex('ebay:access_token', 3600, token);

      return token;
    } catch (error) {
      this.logger.error({ error }, 'eBay token refresh error');
      return '';
    }
  }

  private extractGrade(title: string): string | null {
    // Match common grading patterns
    const patterns = [
      /PSA\s*(\d+)/i,
      /CGC\s*([\d.]+)/i,
      /BGS\s*([\d.]+)/i,
      /SGC\s*(\d+)/i,
      /ACE\s*(\d+)/i
    ];

    for (const pattern of patterns) {
      const match = title.match(pattern);
      if (match) {
        return match[0].toUpperCase().replace(/\s+/g, ' ');
      }
    }

    return null;
  }

  private extractGradeCompany(grade: string): string | null {
    const upper = grade.toUpperCase();
    if (upper.includes('PSA')) return 'PSA';
    if (upper.includes('CGC')) return 'CGC';
    if (upper.includes('BGS')) return 'BGS';
    if (upper.includes('SGC')) return 'SGC';
    if (upper.includes('ACE')) return 'ACE';
    return null;
  }

  private mapCondition(conditionId: string | undefined): string | null {
    const conditionMap: Record<string, string> = {
      '1000': 'New',
      '1500': 'New Other',
      '2000': 'Certified Refurbished',
      '2500': 'Seller Refurbished',
      '3000': 'Used'
    };
    return conditionId ? conditionMap[conditionId] || null : null;
  }
}

// Export singleton for easy import
export const ebayWorker = new EbayWorker();
