/**
 * TCGdex Service
 *
 * Provides card metadata (rarity, illustrator, types, images).
 *
 * Data sources (in priority order):
 * 1. SourceCatalogItem (Prisma) — populated by tcgdex-sync-worker
 * 2. Local JSON fallback — data/tcgdex/cards-metadata.json
 *
 * Search results are cached in Redis (5-min TTL).
 */
import fs from 'fs/promises';
import path from 'path';

export interface TCGdexCard {
  id: string;
  name: string;
  set: { id: string; name: string };
  localId: string; // card number within set (maps to CanonicalCard.cardNumber)
  rarity?: string;
  illustrator?: string;
  hp?: number;
  types?: string[];
  stage?: string;
  variants?: {
    firstEdition?: boolean;
    holo?: boolean;
    normal?: boolean;
    reverse?: boolean;
  };
}

export interface TCGdexSet {
  id: string;
  name: string;
  releaseDate?: string;
  cardCount?: { total: number };
}

class TCGdexService {
  // In-memory fallback (loaded from JSON if DB query fails)
  private cards: Map<string, TCGdexCard> = new Map();
  private sets: Map<string, TCGdexSet> = new Map();
  private nameIndex: Map<string, TCGdexCard[]> = new Map();
  private jsonLoaded = false;

  // Prisma + Redis (injected at startup)
  private prisma: any = null;
  private redis: any = null;
  private dbAvailable = false;

  /**
   * Initialize with Prisma and Redis for DB-backed queries.
   * Call this at API startup after Prisma is ready.
   */
  initDb(prisma: any, redis?: any) {
    this.prisma = prisma;
    this.redis = redis;
    this.dbAvailable = true;
  }

  /**
   * Load local JSON fallback data.
   */
  async load() {
    if (this.jsonLoaded) return;

    const dataDir = path.join(process.cwd(), 'data', 'tcgdex');

    try {
      const [cardsJson, setsJson] = await Promise.all([
        fs.readFile(path.join(dataDir, 'cards-metadata.json'), 'utf-8'),
        fs.readFile(path.join(dataDir, 'sets.json'), 'utf-8'),
      ]);

      const cards: TCGdexCard[] = JSON.parse(cardsJson);
      const sets: TCGdexSet[] = JSON.parse(setsJson);

      for (const c of cards) {
        this.cards.set(c.id, c);
        const norm = this.normalize(c.name);
        const list = this.nameIndex.get(norm) || [];
        list.push(c);
        this.nameIndex.set(norm, list);
      }
      for (const s of sets) this.sets.set(s.id, s);

      this.jsonLoaded = true;
    } catch (err) {
      console.error('Failed to load TCGdex JSON data:', err);
    }
  }

  private normalize(s: string): string {
    return (s || '')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Search cards by name, optionally filtered by set.
   * Tries DB first, falls back to in-memory JSON.
   */
  async searchByName(query: string, setFilter?: string): Promise<TCGdexCard[]> {
    // Try DB-backed search
    if (this.dbAvailable) {
      try {
        return await this.searchByNameDb(query, setFilter);
      } catch {
        // Fall through to in-memory
      }
    }

    // In-memory fallback
    await this.load();
    return this.searchByNameMemory(query, setFilter);
  }

  private async searchByNameDb(query: string, setFilter?: string): Promise<TCGdexCard[]> {
    // Check Redis cache
    const cacheKey = `tcgdex:search:${this.normalize(query)}:${setFilter || ''}`;
    if (this.redis) {
      try {
        const cached = await this.redis.get(cacheKey);
        if (cached) return JSON.parse(cached);
      } catch { /* ignore */ }
    }

    const where: any = {
      source: 'TCGDEX',
      title: { contains: query, mode: 'insensitive' },
    };
    if (setFilter) {
      where.setName = { contains: setFilter, mode: 'insensitive' };
    }

    const items = await this.prisma.sourceCatalogItem.findMany({
      where,
      take: 100,
    });

    const results: TCGdexCard[] = items.map((item: any) => ({
      id: item.sourceItemId,
      name: item.title,
      set: { id: this.extractSetId(item.sourceItemId), name: item.setName || '' },
      localId: item.number || '',
      // Enrich from linked Card if available
      rarity: undefined,
      illustrator: undefined,
    }));

    // Cache for 5 minutes
    if (this.redis && results.length > 0) {
      try {
        await this.redis.setex(cacheKey, 300, JSON.stringify(results));
      } catch { /* ignore */ }
    }

    return results;
  }

  private searchByNameMemory(query: string, setFilter?: string): TCGdexCard[] {
    const normQ = this.normalize(query);
    const out: TCGdexCard[] = [];

    if (this.nameIndex.has(normQ)) out.push(...(this.nameIndex.get(normQ) || []));

    for (const [key, cards] of this.nameIndex.entries()) {
      if (key.includes(normQ) && key !== normQ) {
        out.push(...cards);
      }
    }

    if (setFilter) {
      const normSet = this.normalize(setFilter);
      return out.filter(c => this.normalize(c.set.name).includes(normSet));
    }
    return out;
  }

  /**
   * Extract set ID from a TCGdex card ID (e.g., "base1-4" -> "base1").
   */
  private extractSetId(tcgdexId: string): string {
    const lastDash = tcgdexId.lastIndexOf('-');
    return lastDash > 0 ? tcgdexId.substring(0, lastDash) : tcgdexId;
  }

  getCard(id: string): TCGdexCard | undefined {
    return this.cards.get(id);
  }

  getSet(id: string): TCGdexSet | undefined {
    return this.sets.get(id);
  }

  getImageCandidates(card: TCGdexCard, language: 'EN' | 'JA' = 'EN'): string[] {
    const lang = language === 'JA' ? 'ja' : 'en';
    const setId = card.set.id;
    const localId = card.localId;
    return [
      `https://assets.tcgdex.net/${lang}/${setId}/${localId}.png`,
      `https://assets.tcgdex.net/${lang}/${setId}/${localId}_hires.png`,
      `https://images.pokemontcg.io/${setId}/${localId}.png`,
      `https://images.pokemontcg.io/${setId}/${localId}_hires.png`,
    ];
  }
}

export const tcgdex = new TCGdexService();

// Fire and forget load; route will await if needed
tcgdex.load().catch(err => console.error('Failed to load TCGdex data:', err));
