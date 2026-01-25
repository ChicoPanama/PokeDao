/**
 * WEB2 WORKER - Web Scraping for Price Data
 *
 * Collects price data from traditional web sources:
 * - PriceCharting (historical prices)
 * - TCGPlayer (market prices)
 * - CardLadder (price trends)
 * - Collector Crypt (premium marketplace)
 *
 * Uses rate-limited scraping with configurable targets.
 * Consider using FireCrawl API for managed scraping in production.
 */

import { BaseWorker } from './base-worker.js';
import { z } from 'zod';

// Schema for scraped price data
const ScrapedPriceSchema = z.object({
  cardName: z.string(),
  setName: z.string().optional(),
  grade: z.string().optional(),
  price: z.number().positive(),
  currency: z.string().default('USD'),
  source: z.enum(['PRICECHARTING', 'TCGPLAYER', 'CARDLADDER', 'COLLECTOR_CRYPT']),
  url: z.string().url(),
  scrapedAt: z.date(),
});

export type ScrapedPrice = z.infer<typeof ScrapedPriceSchema>;

interface Web2Target {
  name: 'PRICECHARTING' | 'TCGPLAYER' | 'CARDLADDER' | 'COLLECTOR_CRYPT';
  baseUrl: string;
  rateLimit: number; // requests per minute
  enabled: boolean;
}

export class Web2Worker extends BaseWorker {
  private targets: Web2Target[] = [
    {
      name: 'PRICECHARTING',
      baseUrl: 'https://www.pricecharting.com',
      rateLimit: 30,
      enabled: process.env.WEB2_PRICECHARTING_ENABLED !== 'false',
    },
    {
      name: 'TCGPLAYER',
      baseUrl: 'https://www.tcgplayer.com',
      rateLimit: 20,
      enabled: process.env.WEB2_TCGPLAYER_ENABLED !== 'false',
    },
    {
      name: 'CARDLADDER',
      baseUrl: 'https://www.cardladder.com',
      rateLimit: 30,
      enabled: process.env.WEB2_CARDLADDER_ENABLED === 'true', // Disabled by default
    },
    {
      name: 'COLLECTOR_CRYPT',
      baseUrl: 'https://collectorcrypt.com',
      rateLimit: 30,
      enabled: process.env.WEB2_COLLECTOR_CRYPT_ENABLED !== 'false',
    },
  ];

  constructor() {
    super({
      name: 'web2-worker',
      cronPattern: process.env.WEB2_CRON || '*/30 * * * *', // Every 30 min
      maxRetries: 3,
      timeoutMs: 300000, // 5 minutes (scraping is slow)
    });
  }

  protected async run(): Promise<void> {
    this.logger.info('Web2 worker starting scrape cycle');

    const enabledTargets = this.targets.filter((t) => t.enabled);
    this.logger.info(
      { targets: enabledTargets.map((t) => t.name) },
      'Active scrape targets'
    );

    for (const target of enabledTargets) {
      try {
        await this.scrapeTarget(target);
      } catch (error) {
        this.logger.error(
          {
            target: target.name,
            error: (error as Error).message,
          },
          'Failed to scrape target'
        );
        // Continue with other targets
      }
    }
  }

  private async scrapeTarget(target: Web2Target): Promise<void> {
    this.logger.info({ target: target.name }, 'Scraping target');

    switch (target.name) {
      case 'PRICECHARTING':
        await this.scrapePriceCharting(target);
        break;
      case 'TCGPLAYER':
        await this.scrapeTCGPlayer(target);
        break;
      case 'CARDLADDER':
        await this.scrapeCardLadder(target);
        break;
      case 'COLLECTOR_CRYPT':
        await this.scrapeCollectorCrypt(target);
        break;
      default:
        this.logger.warn({ target: target.name }, 'No scraper implemented');
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // PRICECHARTING SCRAPER
  // ═══════════════════════════════════════════════════════════════════

  private async scrapePriceCharting(target: Web2Target): Promise<void> {
    // PriceCharting has a public API-like structure
    // Pokemon cards URL pattern: /game/pokemon-{set}?q={card}
    //
    // TODO: Implement with one of:
    // 1. FireCrawl API (recommended for production)
    // 2. Cheerio for HTML parsing
    // 3. Puppeteer for JS-rendered content

    const firecrawlKey = process.env.FIRECRAWL_API_KEY;
    if (firecrawlKey) {
      await this.scrapeWithFirecrawl(target, firecrawlKey);
      return;
    }

    // Fallback: Basic fetch + parse
    this.logger.info(
      { target: target.name },
      'PriceCharting scraper - using basic fetch'
    );

    // Get cards to scrape from database (recently active or watchlisted)
    const prisma = await this.getPrisma();
    const cardsToScrape = await prisma.card.findMany({
      where: {
        OR: [
          { watchlistItems: { some: {} } }, // Has watchlist items
          { updatedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } }, // Updated in last 7 days
        ],
      },
      select: { id: true, name: true, set: true },
      take: 50, // Limit per run
    });

    this.logger.info(
      { count: cardsToScrape.length },
      'Cards queued for PriceCharting scrape'
    );

    for (const card of cardsToScrape) {
      // Check dedup
      const dedupKey = `pricecharting:${card.id}`;
      if (await this.isDuplicate(dedupKey)) {
        continue;
      }

      try {
        // Rate-limited fetch
        const searchUrl = `${target.baseUrl}/search-products?q=${encodeURIComponent(card.name)}&type=prices`;
        const response = await this.rateLimitedFetch(
          searchUrl,
          {},
          'pricecharting',
          target.rateLimit
        );

        if (response.ok) {
          // Parse response (simplified - would need proper HTML parsing)
          const html = await response.text();
          // TODO: Parse HTML to extract prices
          this.logger.debug({ card: card.name }, 'Fetched PriceCharting data');
          this.incrementItemsProcessed();
        }

        await this.markProcessed(dedupKey, 3600); // 1 hour dedup
        await this.sleep(2000); // Polite delay between requests
      } catch (error) {
        this.logger.warn(
          { card: card.name, error: (error as Error).message },
          'Failed to scrape card from PriceCharting'
        );
      }
    }

    await prisma.$disconnect();
  }

  // ═══════════════════════════════════════════════════════════════════
  // TCGPLAYER SCRAPER
  // ═══════════════════════════════════════════════════════════════════

  private async scrapeTCGPlayer(target: Web2Target): Promise<void> {
    // TCGPlayer has aggressive bot detection
    // Recommend using their official API instead when possible
    //
    // URL pattern: /product/{id}/{slug}
    // Price data in JSON-LD or data attributes

    this.logger.info(
      { target: target.name },
      'TCGPlayer scraper - checking API availability'
    );

    // Check if we have TCGPlayer API credentials
    if (process.env.TCGPLAYER_ACCESS_TOKEN) {
      this.logger.info('Using TCGPlayer API instead of scraping');
      // TODO: Use packages/adapters/tcgplayer client
      return;
    }

    // Without API, we need to be very careful about scraping
    this.logger.warn(
      'TCGPlayer API credentials not configured - scraping may be blocked'
    );

    // Placeholder for scraping logic
    // In practice, TCGPlayer blocks most scraping attempts
  }

  // ═══════════════════════════════════════════════════════════════════
  // CARDLADDER SCRAPER
  // ═══════════════════════════════════════════════════════════════════

  private async scrapeCardLadder(target: Web2Target): Promise<void> {
    // CardLadder provides price trend data
    // Useful for historical analysis
    //
    // URL pattern: /card/{id}
    // Has chart data that may require JS rendering

    this.logger.info(
      { target: target.name },
      'CardLadder scraper - TODO: implement'
    );

    // Placeholder - CardLadder often requires browser automation
  }

  // ═══════════════════════════════════════════════════════════════════
  // COLLECTOR CRYPT SCRAPER
  // ═══════════════════════════════════════════════════════════════════

  private async scrapeCollectorCrypt(target: Web2Target): Promise<void> {
    // Collector Crypt is a premium marketplace
    // May have API access with partnership
    //
    // URL pattern: /listing/{id}

    this.logger.info(
      { target: target.name },
      'Collector Crypt scraper - checking API'
    );

    if (process.env.COLLECTOR_CRYPT_API_KEY) {
      this.logger.info('Using Collector Crypt API');
      // TODO: Use packages/adapters/collector-crypt client
      return;
    }

    // Basic scraping fallback
    const prisma = await this.getPrisma();

    // Get high-value cards to check on Collector Crypt
    const premiumCards = await prisma.card.findMany({
      where: {
        // Focus on PSA 10 and high-value graded cards
        grade: { in: ['PSA 10', 'BGS 10', 'CGC 10', 'PSA 9', 'BGS 9.5'] },
      },
      select: { id: true, name: true, set: true },
      take: 20,
    });

    this.logger.info(
      { count: premiumCards.length },
      'Premium cards queued for Collector Crypt check'
    );

    // Placeholder for actual scraping
    for (const card of premiumCards) {
      const dedupKey = `collectorcrypt:${card.id}`;
      if (await this.isDuplicate(dedupKey)) {
        continue;
      }

      // Would implement actual scraping here
      await this.markProcessed(dedupKey, 7200); // 2 hour dedup
    }

    await prisma.$disconnect();
  }

  // ═══════════════════════════════════════════════════════════════════
  // FIRECRAWL INTEGRATION
  // ═══════════════════════════════════════════════════════════════════

  private async scrapeWithFirecrawl(
    target: Web2Target,
    apiKey: string
  ): Promise<void> {
    // FireCrawl provides managed web scraping
    // https://firecrawl.dev/
    //
    // Benefits:
    // - Handles proxies and rate limiting
    // - JavaScript rendering
    // - Structured data extraction

    this.logger.info(
      { target: target.name },
      'Using FireCrawl for managed scraping'
    );

    const prisma = await this.getPrisma();

    const cardsToScrape = await prisma.card.findMany({
      where: {
        watchlistItems: { some: {} },
      },
      select: { id: true, name: true, set: true },
      take: 25, // FireCrawl has API limits
    });

    for (const card of cardsToScrape) {
      const dedupKey = `firecrawl:${target.name}:${card.id}`;
      if (await this.isDuplicate(dedupKey)) {
        continue;
      }

      try {
        const searchQuery = `${card.name} ${card.set || ''}`.trim();
        const targetUrl = `${target.baseUrl}/search?q=${encodeURIComponent(searchQuery)}`;

        const response = await this.rateLimitedFetch(
          'https://api.firecrawl.dev/v1/scrape',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              url: targetUrl,
              formats: ['markdown', 'extract'],
              extract: {
                schema: {
                  type: 'object',
                  properties: {
                    prices: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          condition: { type: 'string' },
                          price: { type: 'number' },
                          seller: { type: 'string' },
                        },
                      },
                    },
                  },
                },
              },
            }),
          },
          'firecrawl',
          60 // FireCrawl rate limit
        );

        if (response.ok) {
          const data = await response.json();
          this.logger.info(
            { card: card.name, target: target.name },
            'FireCrawl scrape successful'
          );

          // TODO: Process and store the scraped data
          this.incrementItemsProcessed();
        }

        await this.markProcessed(dedupKey, 3600);
        await this.sleep(1000); // Respect FireCrawl limits
      } catch (error) {
        this.logger.warn(
          {
            card: card.name,
            target: target.name,
            error: (error as Error).message,
          },
          'FireCrawl scrape failed'
        );
      }
    }

    await prisma.$disconnect();
  }
}

// Export singleton instance
export const web2Worker = new Web2Worker();
