/**
 * PSA POPULATION WORKER
 *
 * Collects PSA population data for tracked cards.
 * Important for scarcity analysis.
 *
 * Stores data in Redis for quick access.
 * Runs daily at 6 AM UTC.
 *
 * Note: Full database storage requires adding PsaPopulation model to schema.
 */

import { BaseWorker } from './base-worker.js';

interface PopulationData {
  psa10: number;
  psa9: number;
  psa8: number;
  total: number;
}

export class PsaWorker extends BaseWorker {
  constructor() {
    super({
      name: 'psa',
      cronPattern: '0 6 * * *', // Daily at 6 AM UTC
      maxRetries: 2,
      retryDelayMs: 5000,
      timeoutMs: 300000, // 5 minutes (PSA scraping can be slow)
    });
  }

  async run() {
    const prisma = await this.getPrisma();

    try {
      // Get cards to check - use CanonicalCard
      const cards = await prisma.canonicalCard.findMany({
        select: { id: true, canonicalName: true, canonicalSet: true },
        take: 100,
      });

      this.logger.info({ cardCount: cards.length }, 'Processing cards for PSA population');

      let updated = 0;
      let failed = 0;

      for (const card of cards) {
        try {
          const pop = await this.fetchPopulation(card.canonicalName, card.canonicalSet);

          if (pop) {
            // Store in Redis for quick access
            const key = `psa:pop:${card.id}`;
            await this.redis.hset(key, {
              psa10: pop.psa10.toString(),
              psa9: pop.psa9.toString(),
              psa8: pop.psa8.toString(),
              total: pop.total.toString(),
              updatedAt: new Date().toISOString()
            });
            await this.redis.expire(key, 86400 * 7); // 7 day TTL

            updated++;
          }

          // Rate limit: 500ms between requests
          await this.delay(500);
        } catch (error) {
          const msg = error instanceof Error ? error.message : 'Unknown error';
          this.logger.error({ card: card.canonicalName, error: msg }, 'Error fetching PSA data');
          failed++;
        }
      }

      this.logger.info({
        updated,
        failed,
        total: cards.length,
      }, 'PSA population update complete');

      this.incrementItemsProcessed(updated);
    } finally {
      await prisma.$disconnect();
    }
  }

  private async fetchPopulation(
    cardName: string,
    setName: string
  ): Promise<PopulationData | null> {
    // PSA doesn't have a public API, so we use their web interface
    // This is a simplified approach - in production you might need more sophisticated parsing

    const searchQuery = encodeURIComponent(`${cardName} ${setName} Pokemon`);

    try {
      const searchUrl = `https://www.psacard.com/pop/tcg-cards/pokemon?search=${searchQuery}`;

      const response = await fetch(searchUrl, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        }
      });

      if (!response.ok) {
        throw new Error(`PSA search failed: ${response.status}`);
      }

      const html = await response.text();
      return this.parsePopulationFromHtml(html);
    } catch {
      // PSA scraping is unreliable, return null on failure
      return null;
    }
  }

  private parsePopulationFromHtml(html: string): PopulationData | null {
    // Simple regex-based extraction
    // This is fragile and should be improved with proper HTML parsing

    try {
      // Look for population table data
      // PSA format: "PSA 10: X" etc.

      const psa10Match = html.match(/GEM[\s-]*MT\s*10[^0-9]*(\d+)/i);
      const psa9Match = html.match(/MINT\s*9[^0-9]*(\d+)/i);
      const psa8Match = html.match(/NM[\s-]*MT\s*8[^0-9]*(\d+)/i);
      const totalMatch = html.match(/Total[^0-9]*(\d+)/i);

      const psa10 = psa10Match ? parseInt(psa10Match[1], 10) : 0;
      const psa9 = psa9Match ? parseInt(psa9Match[1], 10) : 0;
      const psa8 = psa8Match ? parseInt(psa8Match[1], 10) : 0;
      const total = totalMatch ? parseInt(totalMatch[1], 10) : psa10 + psa9 + psa8;

      // Only return if we found at least some data
      if (psa10 > 0 || psa9 > 0 || total > 0) {
        return { psa10, psa9, psa8, total };
      }

      return null;
    } catch {
      return null;
    }
  }

  /**
   * Get cached population for a card.
   */
  async getPopulation(cardId: string): Promise<PopulationData | null> {
    const data = await this.redis.hgetall(`psa:pop:${cardId}`);

    if (!data || Object.keys(data).length === 0) {
      return null;
    }

    return {
      psa10: parseInt(data.psa10 || '0', 10),
      psa9: parseInt(data.psa9 || '0', 10),
      psa8: parseInt(data.psa8 || '0', 10),
      total: parseInt(data.total || '0', 10)
    };
  }
}

export const psaWorker = new PsaWorker();
