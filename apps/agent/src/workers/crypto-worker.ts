/**
 * CRYPTO MARKETPLACE WORKER
 *
 * Collects listings from crypto/NFT marketplaces.
 * - Magic Eden (Solana NFTs)
 * - Courtyard (tokenized physical cards)
 *
 * Saves to PriceSnapshot with full provenance.
 * Runs every 5 minutes.
 */

import crypto from 'crypto';
import { BaseWorker } from './base-worker.js';

const PARSER_VERSION = '1.0.0';

interface CryptoListing {
  externalId: string;
  source: string;
  sourceVersion: string;
  cardName: string;
  price: number;
  currency: string;
  url: string;
  grade?: string;
  gradeCompany?: string;
  raw: object;
}

export class CryptoWorker extends BaseWorker {
  constructor() {
    super({
      name: 'crypto',
      cronPattern: '*/5 * * * *', // Every 5 minutes
      maxRetries: 3,
      retryDelayMs: 1000,
      timeoutMs: 60000,
    });
  }

  async run() {
    const results = await Promise.allSettled([
      this.fetchMagicEden(),
      this.fetchCourtyard()
    ]);

    // Log results
    results.forEach((result, i) => {
      const source = ['MagicEden', 'Courtyard'][i];
      if (result.status === 'rejected') {
        console.error(`[crypto] ${source} failed:`, result.reason);
      }
    });
  }

  private async fetchMagicEden() {
    console.log('[crypto] Fetching Magic Eden...');

    const prisma = await this.getPrisma();

    try {
      // Pokemon-related collections on Magic Eden
      const collections = [
        { symbol: 'pokemon_1', name: 'Pokemon TCG Collection 1' },
        { symbol: 'pokemon_base_set', name: 'Pokemon Base Set' }
      ];

      let totalSnapshots = 0;
      let duplicatesSkipped = 0;

      for (const collection of collections) {
        try {
          const response = await fetch(
            `https://api-mainnet.magiceden.dev/v2/collections/${collection.symbol}/listings?offset=0&limit=100`,
            {
              headers: {
                Accept: 'application/json'
              }
            }
          );

          if (!response.ok) {
            if (response.status === 404) {
              continue;
            }
            throw new Error(`Magic Eden API error: ${response.status}`);
          }

          const data = (await response.json()) as any[];

          for (const listing of data || []) {
            const parsed: CryptoListing = {
              externalId: listing.tokenMint || listing.tokenAddress,
              source: 'MAGIC_EDEN',
              sourceVersion: 'v2-listings',
              cardName: listing.extra?.name || listing.name || collection.name,
              price: listing.price || 0,
              currency: 'SOL',
              url: `https://magiceden.io/item-details/${listing.tokenMint}`,
              raw: listing
            };

            const result = await this.createPriceSnapshot(prisma, parsed);
            if (result === 'created') totalSnapshots++;
            else if (result === 'duplicate') duplicatesSkipped++;
          }

          await this.delay(100);
        } catch (error) {
          const msg = error instanceof Error ? error.message : 'Unknown error';
          console.error(`[crypto] Magic Eden error for ${collection.symbol}:`, msg);
        }
      }

      console.log(
        `[crypto] Magic Eden: ${totalSnapshots} snapshots, ${duplicatesSkipped} duplicates`
      );
    } finally {
      await prisma.$disconnect();
    }
  }

  private async fetchCourtyard() {
    console.log('[crypto] Fetching Courtyard...');

    const prisma = await this.getPrisma();

    try {
      const response = await fetch(
        'https://api.courtyard.io/api/v1/market/listings?category=pokemon&limit=100',
        {
          headers: {
            Accept: 'application/json'
          }
        }
      );

      if (!response.ok) {
        throw new Error(`Courtyard API error: ${response.status}`);
      }

      const data = (await response.json()) as { listings?: any[]; data?: any[] };
      const listings = data.listings || data.data || [];

      let totalSnapshots = 0;
      let duplicatesSkipped = 0;

      for (const listing of listings) {
        const grade = listing.grade || this.extractGrade(listing.name || '');
        const parsed: CryptoListing = {
          externalId: listing.id || listing.tokenId,
          source: 'COURTYARD',
          sourceVersion: 'v1-listings',
          cardName: listing.name || listing.title,
          price: listing.price || listing.priceUsd || 0,
          currency: 'USD',
          url: listing.url || `https://courtyard.io/asset/${listing.id}`,
          grade,
          gradeCompany: grade ? this.extractGradeCompany(grade) : undefined,
          raw: listing
        };

        const result = await this.createPriceSnapshot(prisma, parsed);
        if (result === 'created') totalSnapshots++;
        else if (result === 'duplicate') duplicatesSkipped++;
      }

      console.log(
        `[crypto] Courtyard: ${totalSnapshots} snapshots, ${duplicatesSkipped} duplicates`
      );
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      console.error('[crypto] Courtyard error:', msg);
    } finally {
      await prisma.$disconnect();
    }
  }

  private async createPriceSnapshot(
    prisma: any,
    listing: CryptoListing
  ): Promise<'created' | 'duplicate' | 'error'> {
    try {
      // Calculate rawHash for deduplication
      const rawHash = crypto
        .createHash('sha256')
        .update(JSON.stringify(listing.raw))
        .digest('hex');

      // Check if we already have this snapshot
      const existing = await prisma.priceSnapshot.findFirst({
        where: { rawHash }
      });

      if (existing) {
        return 'duplicate';
      }

      // Try to find matching card
      const card = await prisma.card.findFirst({
        where: {
          OR: [
            { name: { contains: listing.cardName.split(' ')[0], mode: 'insensitive' } },
            { cardKey: { contains: listing.cardName.toLowerCase().replace(/\s+/g, '-') } }
          ]
        },
        select: { id: true, cardKey: true }
      });

      // Create PriceSnapshot
      await prisma.priceSnapshot.create({
        data: {
          cardId: card?.id,
          cardKey: card?.cardKey || listing.cardName.toLowerCase().replace(/\s+/g, '-'),
          timestamp: new Date(),
          source: listing.source,
          sourceItemId: listing.externalId,
          sourceUrl: listing.url,
          listingType: 'active',
          priceCents: Math.round(listing.price * 100),
          currency: listing.currency,
          grade: listing.grade,
          gradeCompany: listing.gradeCompany,
          title: listing.cardName,
          raw: listing.raw as any,
          rawHash,
          parserVersion: PARSER_VERSION,
          sourceVersion: listing.sourceVersion
        }
      });

      // Also update Listing table for active listings
      if (card?.id) {
        await prisma.listing.upsert({
          where: {
            source_sourceItemId: {
              source: listing.source,
              sourceItemId: listing.externalId
            }
          },
          create: {
            source: listing.source,
            sourceItemId: listing.externalId,
            cardId: card.id,
            price: listing.price,
            currency: listing.currency,
            url: listing.url,
            condition: listing.grade,
            raw: listing.raw,
            isActive: true
          },
          update: {
            price: listing.price,
            isActive: true,
            scrapedAt: new Date()
          }
        });
      }

      return 'created';
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[crypto] Error creating snapshot:`, msg);
      return 'error';
    }
  }

  private extractGrade(title: string): string | undefined {
    const patterns = [/PSA\s*(\d+)/i, /CGC\s*([\d.]+)/i, /BGS\s*([\d.]+)/i, /SGC\s*(\d+)/i];

    for (const pattern of patterns) {
      const match = title.match(pattern);
      if (match) return match[0].toUpperCase();
    }

    return undefined;
  }

  private extractGradeCompany(grade: string): string | undefined {
    const upper = grade.toUpperCase();
    if (upper.includes('PSA')) return 'PSA';
    if (upper.includes('CGC')) return 'CGC';
    if (upper.includes('BGS')) return 'BGS';
    if (upper.includes('SGC')) return 'SGC';
    return undefined;
  }
}

export const cryptoWorker = new CryptoWorker();
