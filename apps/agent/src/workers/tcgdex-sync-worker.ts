/**
 * TCGdex Sync Worker
 *
 * Syncs TCGdex card metadata into the database:
 * 1. Seeds SourceCatalogItem from local JSON (data/tcgdex/cards-metadata.json)
 * 2. Matches unlinked Cards to TCGdex catalog by name+set+number
 * 3. Enriches matched Cards with rarity, category, illustrator, types, stage, imageUrl
 *
 * Schedule: Daily at 2 AM (card catalog changes slowly)
 */

import { BaseWorker } from './base-worker.js';
import { createTCGdexClient } from '@pokedao/adapters';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

interface TCGdexLocalCard {
  id: string;
  localId: string;
  name: string;
  set: { id: string; name: string };
  rarity?: string;
  category?: string;
  illustrator?: string;
  hp?: number;
  types?: string[];
  stage?: string;
  variants?: Record<string, boolean>;
}

class TCGdexSyncWorker extends BaseWorker {
  constructor() {
    super({
      name: 'tcgdex-sync',
      cronPattern: '0 2 * * *', // Daily at 2 AM
      maxRetries: 3,
      retryDelayMs: 2000,
      timeoutMs: 600_000, // 10 minutes for bulk operations
    });
  }

  protected async run(): Promise<void> {
    const prisma = await this.getPrisma();

    try {
      // Step 1: Seed SourceCatalogItem from local JSON
      const seeded = await this.seedFromLocalJson(prisma);
      this.logger.info({ seeded }, 'Seed phase complete');

      // Step 2: Incremental sync from TCGdex API for new sets
      const synced = await this.incrementalApiSync(prisma);
      this.logger.info({ synced }, 'Incremental API sync complete');

      // Step 3: Match Cards to TCGdex catalog
      const matched = await this.matchCards(prisma);
      this.logger.info({ matched }, 'Match phase complete');

      this.incrementItemsProcessed(seeded + synced + matched);
    } finally {
      await prisma.$disconnect();
    }
  }

  /**
   * Step 1: Load local TCGdex JSON and upsert into SourceCatalogItem.
   */
  private async seedFromLocalJson(prisma: any): Promise<number> {
    // Find the data directory (relative to repo root)
    const dataPath = path.resolve(__dirname, '../../../../../data/tcgdex/cards-metadata.json');

    let fileExists = false;
    try {
      await fs.access(dataPath);
      fileExists = true;
    } catch {
      this.logger.warn({ dataPath }, 'Local TCGdex data file not found, skipping seed');
      return 0;
    }

    if (!fileExists) return 0;

    const raw = await fs.readFile(dataPath, 'utf-8');
    const cards: TCGdexLocalCard[] = JSON.parse(raw);

    this.logger.info({ totalCards: cards.length }, 'Loading TCGdex cards from local JSON');

    // Check how many already exist
    const existingCount = await prisma.sourceCatalogItem.count({
      where: { source: 'TCGDEX' },
    });

    // Skip if already seeded and count is close
    if (existingCount >= cards.length * 0.95) {
      this.logger.info(
        { existingCount, totalCards: cards.length },
        'TCGdex catalog already seeded, skipping bulk upsert'
      );
      return 0;
    }

    // Batch upsert in chunks of 500
    const BATCH_SIZE = 500;
    let upserted = 0;

    for (let i = 0; i < cards.length; i += BATCH_SIZE) {
      const batch = cards.slice(i, i + BATCH_SIZE);

      const operations = batch.map((card) => {
        const cardKey = `${card.name}-${card.set.name}`
          .toLowerCase()
          .replace(/\s+/g, '-')
          .replace(/[^a-z0-9-]/g, '');

        return prisma.sourceCatalogItem.upsert({
          where: {
            source_sourceItemId: {
              source: 'TCGDEX',
              sourceItemId: card.id,
            },
          },
          update: {
            title: card.name,
            setName: card.set.name,
            number: card.localId,
            cardKey,
            url: `https://www.tcgdex.net/database/${card.set.id}/${card.localId}`,
            lastSeenAt: new Date(),
          },
          create: {
            source: 'TCGDEX',
            sourceItemId: card.id,
            title: card.name,
            setName: card.set.name,
            number: card.localId,
            cardKey,
            url: `https://www.tcgdex.net/database/${card.set.id}/${card.localId}`,
          },
        });
      });

      await prisma.$transaction(operations);
      upserted += batch.length;

      if (upserted % 5000 === 0) {
        this.logger.info({ upserted, total: cards.length }, 'Seed progress');
      }
    }

    this.logger.info({ upserted }, 'TCGdex catalog seed complete');
    return upserted;
  }

  /**
   * Step 2: Fetch new/updated sets from the TCGdex API that aren't in the local JSON.
   */
  private async incrementalApiSync(prisma: any): Promise<number> {
    const client = createTCGdexClient({ requestsPerSecond: 3 });

    let allSets;
    try {
      allSets = await client.getAllSets();
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn({ error: msg }, 'TCGdex API unreachable, skipping incremental sync');
      return 0;
    }

    if (!allSets || allSets.length === 0) return 0;

    // Find sets not yet in our catalog
    const knownSetIds = await prisma.sourceCatalogItem.findMany({
      where: { source: 'TCGDEX' },
      select: { sourceItemId: true },
      distinct: ['sourceItemId'],
    });

    // Extract unique set prefixes from sourceItemIds (e.g., "base1-4" → "base1")
    const knownSets = new Set<string>();
    for (const item of knownSetIds) {
      const lastDash = item.sourceItemId.lastIndexOf('-');
      if (lastDash > 0) {
        knownSets.add(item.sourceItemId.substring(0, lastDash));
      }
    }

    const newSets = allSets.filter((s) => !knownSets.has(s.id));

    if (newSets.length === 0) {
      this.logger.info({ totalSets: allSets.length }, 'All sets already synced');
      return 0;
    }

    this.logger.info(
      { newSets: newSets.length, totalSets: allSets.length },
      'Found new sets to sync from API'
    );

    let synced = 0;

    for (const set of newSets) {
      try {
        const fullSet = await client.getSet(set.id);
        if (!fullSet?.cards) continue;

        const operations = fullSet.cards.map((card) => {
          const cardKey = `${card.name}-${fullSet.name}`
            .toLowerCase()
            .replace(/\s+/g, '-')
            .replace(/[^a-z0-9-]/g, '');

          return prisma.sourceCatalogItem.upsert({
            where: {
              source_sourceItemId: {
                source: 'TCGDEX',
                sourceItemId: card.id,
              },
            },
            update: {
              title: card.name,
              setName: fullSet.name,
              number: card.localId,
              cardKey,
              lastSeenAt: new Date(),
            },
            create: {
              source: 'TCGDEX',
              sourceItemId: card.id,
              title: card.name,
              setName: fullSet.name,
              number: card.localId,
              cardKey,
              url: `https://www.tcgdex.net/database/${set.id}/${card.localId}`,
            },
          });
        });

        await prisma.$transaction(operations);
        synced += fullSet.cards.length;

        this.logger.info(
          { set: fullSet.name, cards: fullSet.cards.length },
          'Synced new set from API'
        );
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Unknown error';
        this.logger.warn({ set: set.id, error: msg }, 'Failed to sync set from API');
      }
    }

    return synced;
  }

  /**
   * Step 3: Match existing Cards to TCGdex catalog and enrich.
   */
  private async matchCards(prisma: any): Promise<number> {
    // Find Cards that don't have a tcgdexId yet
    const unmatchedCards = await prisma.card.findMany({
      where: { tcgdexId: null },
      take: 1000, // Process in batches
    });

    if (unmatchedCards.length === 0) {
      this.logger.info('No unmatched cards found');
      return 0;
    }

    this.logger.info({ count: unmatchedCards.length }, 'Attempting to match cards to TCGdex');

    // Load local data for matching
    const dataPath = path.resolve(__dirname, '../../../../../data/tcgdex/cards-metadata.json');
    let localCards: TCGdexLocalCard[] = [];
    try {
      const raw = await fs.readFile(dataPath, 'utf-8');
      localCards = JSON.parse(raw);
    } catch {
      this.logger.warn('Cannot load local TCGdex data for matching');
      return 0;
    }

    // Build lookup indexes
    const byNameSetNumber = new Map<string, TCGdexLocalCard>();
    const byNameSet = new Map<string, TCGdexLocalCard[]>();
    const byNormalizedName = new Map<string, TCGdexLocalCard[]>();

    for (const card of localCards) {
      // Exact: name + set + number
      const exactKey = `${this.normalize(card.name)}|${this.normalize(card.set.name)}|${card.localId}`;
      byNameSetNumber.set(exactKey, card);

      // Name + set
      const nameSetKey = `${this.normalize(card.name)}|${this.normalize(card.set.name)}`;
      const existing = byNameSet.get(nameSetKey) || [];
      existing.push(card);
      byNameSet.set(nameSetKey, existing);

      // Name only
      const nameKey = this.normalize(card.name);
      const nameList = byNormalizedName.get(nameKey) || [];
      nameList.push(card);
      byNormalizedName.set(nameKey, nameList);
    }

    let matched = 0;

    for (const card of unmatchedCards) {
      const tcgdexCard = this.findMatch(card, byNameSetNumber, byNameSet, byNormalizedName);

      if (tcgdexCard) {
        const imageUrl = `https://assets.tcgdex.net/en/${tcgdexCard.set.id}/${tcgdexCard.localId}/high.png`;

        await prisma.card.update({
          where: { id: card.id },
          data: {
            tcgdexId: tcgdexCard.id,
            rarity: tcgdexCard.rarity ?? null,
            category: tcgdexCard.category ?? null,
            illustrator: tcgdexCard.illustrator ?? null,
            pokemonTypes: tcgdexCard.types ?? [],
            stage: tcgdexCard.stage ?? null,
            imageUrl,
          },
        });

        matched++;
      }
    }

    this.logger.info({ matched, total: unmatchedCards.length }, 'Card matching complete');
    return matched;
  }

  /**
   * Find a TCGdex match for a Card using cascading strategies.
   */
  private findMatch(
    card: any,
    byNameSetNumber: Map<string, TCGdexLocalCard>,
    byNameSet: Map<string, TCGdexLocalCard[]>,
    byNormalizedName: Map<string, TCGdexLocalCard[]>
  ): TCGdexLocalCard | null {
    const name = this.normalize(card.searchName || card.name || '');
    const set = this.normalize(card.searchSet || card.set || '');
    const number = card.number || '';

    if (!name) return null;

    // Strategy 1: Exact name + set + number (confidence 1.0)
    if (set && number) {
      const exactKey = `${name}|${set}|${number}`;
      const match = byNameSetNumber.get(exactKey);
      if (match) return match;
    }

    // Strategy 2: Normalized name + set (confidence 0.9)
    if (set) {
      const nameSetKey = `${name}|${set}`;
      const candidates = byNameSet.get(nameSetKey);
      if (candidates && candidates.length === 1) {
        return candidates[0];
      }
      // If multiple, try matching by number
      if (candidates && number) {
        const byNum = candidates.find((c) => c.localId === number);
        if (byNum) return byNum;
      }
    }

    // Strategy 3: Name only, single match (confidence 0.7)
    const nameMatches = byNormalizedName.get(name);
    if (nameMatches && nameMatches.length === 1) {
      return nameMatches[0];
    }

    // No confident match found
    return null;
  }

  /**
   * Normalize a string for matching.
   */
  private normalize(s: string): string {
    return (s || '')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }
}

export const tcgdexSyncWorker = new TCGdexSyncWorker();
