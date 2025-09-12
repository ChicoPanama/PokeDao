import { upsertCardByKey, upsertListing, sharedPrisma, cardKey } from '@pokedao/shared';

const BASE = process.env.POKEMON_TCG_API_BASE || 'https://api.pokemontcg.io/v2';
const KEY = process.env.POKEMON_TCG_API_KEY || '';

const HEADERS: Record<string, string> = { 'Content-Type': 'application/json' };
if (KEY) HEADERS['X-Api-Key'] = KEY;

async function safeGet(url: string, retries = 3) {
  let lastErr: any;
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, { headers: HEADERS });
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      return await res.json();
    } catch (e) {
      lastErr = e;
      await new Promise((r) => setTimeout(r, 300 + Math.random() * 500));
    }
  }
  throw lastErr;
}

export async function ingestPokemonTCG({ pageSize = 250, pages = 2 }: { pageSize?: number; pages?: number } = {}) {
  let totalCards = 0;
  let totalListings = 0;
  for (let page = 1; page <= pages; page++) {
    const url = `${BASE}/cards?page=${page}&pageSize=${pageSize}`;
    const json = await safeGet(url);
    const cards: any[] = json?.data || [];
    for (const c of cards) {
      const setCode = c.set?.id || c.set?.ptcgoCode || c.set?.series || 'UNKNOWN_SET';
      const number = c.number || '';
      const ck = cardKey(setCode, number, '', 'EN');
      await upsertCardByKey(sharedPrisma, ck, c.name || `${ck.setCode} ${ck.number}`);
      totalCards++;

      const seenAt = new Date();
      const maybeAsks = [
        c?.tcgplayer?.prices?.normal?.market
          ? { src: 'TCGplayer', id: `t_${c.id}_normal`, cents: Math.round(c.tcgplayer.prices.normal.market * 100), url: c.tcgplayer?.url }
          : null,
        c?.cardmarket?.prices?.trendPrice
          ? { src: 'Cardmarket', id: `m_${c.id}_trend`, cents: Math.round(c.cardmarket.prices.trendPrice * 100), url: c.cardmarket?.url }
          : null,
      ].filter(Boolean) as { src: string; id: string; cents: number; url?: string }[];

      for (const a of maybeAsks) {
        await upsertListing(sharedPrisma, {
          cardKey: ck,
          source: a.src,
          sourceId: a.id,
          priceCents: a.cents,
          currency: 'USD',
          condition: 'Market',
          grade: null,
          url: a.url || '',
          seenAt,
        });
        totalListings++;
      }
    }
  }
  return { totalCards, totalListings };
}
