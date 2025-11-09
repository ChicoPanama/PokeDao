/**
 * Server-side TCGdex loader (uses local JSON dataset)
 *
 * Sources:
 * - data/tcgdex/cards-metadata.json
 * - data/tcgdex/sets.json
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
  private cards: Map<string, TCGdexCard> = new Map();
  private sets: Map<string, TCGdexSet> = new Map();
  private nameIndex: Map<string, TCGdexCard[]> = new Map();
  private loaded = false;

  async load() {
    if (this.loaded) return;

    const dataDir = path.join(process.cwd(), 'data', 'tcgdex');

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

    this.loaded = true;
  }

  private normalize(s: string): string {
    return (s || '')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  searchByName(query: string, setFilter?: string): TCGdexCard[] {
    const normQ = this.normalize(query);
    const out: TCGdexCard[] = [];

    // exact key bucket if present
    if (this.nameIndex.has(normQ)) out.push(...(this.nameIndex.get(normQ) || []));

    // include partial matches (simple contains)
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

