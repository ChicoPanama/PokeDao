import { PrismaClient } from '@prisma/client';
import OpenAI from 'openai';
import { ReasonedSignal } from '../schemas/reasonedSignal.js';

const prisma = new PrismaClient();

export async function auditAndThesisForNewSignals({ take = 50 } = {}) {
  // Check for AI provider configuration
  const deepseekApiKey = process.env.DEEPSEEK_API_KEY;
  const ollamaBaseUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
  const useOllama = process.env.USE_OLLAMA === '1' || !deepseekApiKey;

  let client: OpenAI;
  let model: string;

  if (useOllama) {
    console.log('[thesis] Using Ollama for local AI inference');
    client = new OpenAI({
      apiKey: 'ollama', // Ollama doesn't require an API key
      baseURL: `${ollamaBaseUrl}/v1`,
    });
    model = process.env.OLLAMA_MODEL || 'qwen2.5:7b-instruct';
  } else {
    console.log('[thesis] Using DeepSeek API');
    const baseURL = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com';
    client = new OpenAI({ apiKey: deepseekApiKey, baseURL });
    model = process.env.DEEPSEEK_MODEL_FAST || 'deepseek-chat';
  }

  if (!client) {
    console.warn('[thesis] No AI provider configured — skipping');
    return { updated: 0, blocked: 0 };
  }

  // Thresholds can be relaxed for local testing by setting THESIS_RELAXED=1
  const RELAXED = process.env.THESIS_RELAXED === '1';
  const MIN_COMPS_90 = Number(process.env.THESIS_MIN_COMPS_90 || (RELAXED ? 1 : 5));
  const MAX_VOL_BP = Number(process.env.THESIS_MAX_VOL_BP || (RELAXED ? 5000 : 1200));
  const MAX_FRESH_DAYS = Number(process.env.THESIS_MAX_FRESH_DAYS || (RELAXED ? 60 : 14));
  const KEEP_FLAGGED = process.env.THESIS_KEEP_FLAGGED === '1' || RELAXED;

  const signals = await prisma.signal.findMany({
    where: { thesis: '' },
    orderBy: { createdAt: 'desc' },
    take,
    include: { card: true, marketListing: true },
  });

  let updated = 0, blocked = 0;
  for (const s of signals) {
    const f30 = await prisma.featureSnapshot.findUnique({ where: { cardId_windowDays: { cardId: s.cardId, windowDays: 30 } } });
    const f90 = await prisma.featureSnapshot.findUnique({ where: { cardId_windowDays: { cardId: s.cardId, windowDays: 90 } } });

    const features = f30 ?? f90 ?? null;
    const comps90 = f90?.volume ?? 0;
    const volBp = features?.volatilityBp ?? 0;
    const listingFreshDays = s.marketListing ? Math.max(0, Math.floor((Date.now() - s.marketListing.seenAt.getTime()) / 86400000)) : 999;

    const sys = `You are "Pokedex", a veteran Pokémon TCG trader.
Output JSON ONLY, matching EXACTLY:
{"edgeBp":int,"confidence":0..1,"thesis":string,"drivers":[string],"flags":{"staleComps":bool,"highVolatility":bool,"lowLiquidity":bool}}

Rules:
- High-value only: the caller pre-filters to USD ≥ $500. Assume all items meet this gate. Do NOT add any "too cheap" messages.
- Use ONLY the inputs provided. Never invent prices, dates, or ratios. If a directional comparison is useful, use words like "above / below / converging / diverging" unless an explicit diff is provided in inputs.
- Keep the thesis ≤ 240 chars, 1–2 sentences, crisp trader tone (no fluff).
- Treat these inputs as priorities when present:
  • Anchors (TCGplayer/Cardmarket/PokePrice/eBay medians, all in USD)
  • Seller quality & shipping impact (risk buckets)
  • Auction/bid pattern & watch count (momentum/interest)
  • Seasonality / set-release context (tailwind/headwind)
  • NHI (narrative/heat index)
  • Grading/condition (slab/raw mismatch, fee drag)
- If comps90 < 5 → flags.lowLiquidity=true.
- If volatilityBp > 1200 → flags.highVolatility=true.
- If listingFreshDays > 14 OR anchors are all stale → flags.staleComps=true.
- Do not quote exact numbers unless they are provided directly in "diffs" or "figures" below. Prefer qualitative rationale ("Cardmarket anchor above TCGplayer", "seller risk low", "seasonality tailwind").
- Drivers: short bullet phrases citing the strongest 2–4 reasons (e.g., "Anchors align across TCG/CM", "Seller A+ + low ship", "Auction momentum", "Set-release tailwind", "NHI high").`;

    const L: any = s.marketListing || null;
    // Try to enrich with anchors from PriceCache and any extended Listing row (seller/auction)
    const priceCache = await prisma.priceCache.findMany({
      where: { cardId: s.cardId },
      orderBy: { timestamp: 'desc' },
      take: 20,
    }).catch(() => [] as any[]);

    const findAnchor = (src: string, type: string) => priceCache.find((p: any) => (p.sourceType || '').toLowerCase() === src && (p.priceType || '').toLowerCase() === type);
    const aTcg = findAnchor('tcgplayer', 'market');
    const aCm = findAnchor('cardmarket', 'avg') || findAnchor('cardmarket', 'average') || findAnchor('cardmarket', 'market');
    const aPp = findAnchor('pokeprice', 'last_sale') || findAnchor('pokeprice', 'last');

    const tcgplayerMarketUsd = aTcg ? Number(aTcg.price) : undefined;
    const cardmarketAvgUsd = aCm ? Number(aCm.price) : undefined;
    const pokepriceLastUsd = aPp ? Number(aPp.price) : undefined;

    const stalenessDays: Record<string, number> = {};
    if (aTcg?.timestamp) stalenessDays.tcgplayer = Math.max(0, Math.floor((Date.now() - new Date(aTcg.timestamp).getTime()) / 86400000));
    if (aCm?.timestamp) stalenessDays.cardmarket = Math.max(0, Math.floor((Date.now() - new Date(aCm.timestamp).getTime()) / 86400000));
    if (aPp?.timestamp) stalenessDays.pokeprice = Math.max(0, Math.floor((Date.now() - new Date(aPp.timestamp).getTime()) / 86400000));
    if (features) stalenessDays.ebay = 0;

    // Attempt to find an extended Listing to extract auction/seller/shipping details
    let extListing: any = null;
    if (L?.url) {
      extListing = await prisma.listing.findFirst({ where: { cardId: s.cardId, url: L.url }, orderBy: { scrapedAt: 'desc' } }).catch(() => null);
    }
    if (!extListing) {
      extListing = await prisma.listing.findFirst({ where: { cardId: s.cardId, isActive: true }, orderBy: { scrapedAt: 'desc' } }).catch(() => null);
    }
    const askUsd = L ? (L.priceCentsUsd ?? L.priceCents ?? 0) : 0;
    const freshDays = L ? Math.max(0, Math.floor((Date.now() - new Date(L.seenAt).getTime()) / 86400000)) : null;
    const fWin = features?.windowDays ?? 30;
    const payload: any = {
      card: {
        name: s.card?.name ?? '',
        setCode: s.card?.setCode ?? s.card?.set ?? '',
        number: s.card?.number ?? '',
        variantKey: s.card?.variantKey ?? '',
        grade: L?.grade ?? null,
        condition: L?.condition ?? null,
      },
      listing: L && {
        priceCentsUsd: askUsd,
        freshDays: freshDays ?? null,
        source: L.source ?? 'Research',
        url: L.url ?? '',
      },
      features: features && {
        windowDays: fWin,
        medianCentsUsd: features.medianCents,
        p05CentsUsd: features.p05Cents,
        p95CentsUsd: features.p95Cents,
        volume: features.volume,
        volatilityBp: features.volatilityBp,
        nhiScore: features.nhiScore ?? null,
      },
      anchors: {
        ...(features ? { ebay30dMedianUsd: Math.round((features.medianCents ?? 0)) / 100 } : {}),
        ...(tcgplayerMarketUsd !== undefined ? { tcgplayerMarketUsd: Math.round(tcgplayerMarketUsd * 100) / 100 } : {}),
        ...(cardmarketAvgUsd !== undefined ? { cardmarketAvgUsd: Math.round(cardmarketAvgUsd * 100) / 100 } : {}),
        ...(pokepriceLastUsd !== undefined ? { pokepriceLastUsd: Math.round(pokepriceLastUsd * 100) / 100 } : {}),
        stalenessDays,
      },
      seller: extListing && extListing.seller ? {
        score: undefined,
        bucket: undefined,
        sales: undefined,
        shippingCentsUsd: typeof extListing.shippingPrice === 'number' ? Math.round(extListing.shippingPrice * 100) : undefined,
        region: undefined,
      } : undefined,
      auctionSignals: extListing && extListing.listingType ? {
        isAuction: String(extListing.listingType || '').toUpperCase().includes('AUCTION'),
        bidCount: extListing.bidCount ?? undefined,
        watchCount: extListing.watchers ?? undefined,
        hrsToClose: extListing.endTime ? Math.max(0, Math.round((new Date(extListing.endTime).getTime() - Date.now()) / 3600000)) : undefined,
      } : undefined,
      diffs: (features && askUsd) ? {
        // negative means ask below median
        listing_vs_median_bp: Math.round(((askUsd - features.medianCents) / Math.max(1, features.medianCents)) * 10000),
      } : undefined,
      figures: {
        edgeBp: s.edgeBp,
        confidence: s.confidence,
      }
    };

    try {
      const completion = await client.chat.completions.create({
        model,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: sys },
          { role: 'user', content: JSON.stringify(payload, null, 2) + "\n\nExample 1 → Output:\n{\"edgeBp\":740,\"confidence\":0.63,\"thesis\":\"Ask sits below converging US/EU anchors; seller A+ with low ship, demand warm.\",\"drivers\":[\"Anchors align (TCG≈CM)\",\"Seller risk low\",\"Seasonality tailwind\"],\"flags\":{\"staleComps\":false,\"highVolatility\":false,\"lowLiquidity\":false}}\n\nExample 2 → Output:\n{\"edgeBp\":820,\"confidence\":0.58,\"thesis\":\"Price beats 30d median; auction interest strong; watch pop supports entry.\",\"drivers\":[\"Below 30d median\",\"Auction momentum\",\"NHI high\"],\"flags\":{\"staleComps\":false,\"highVolatility\":true,\"lowLiquidity\":false}}" },
        ],
        temperature: 0.2,
      });
      const content = completion.choices?.[0]?.message?.content ?? '{}';
      const parsed = JSON.parse(content);
      const rs = ReasonedSignal.parse(parsed);

      const isFlagged = rs.flags.staleComps || rs.flags.highVolatility || rs.flags.lowLiquidity;

      const reasons: string[] = [];
      if (rs.flags.staleComps) reasons.push(`comps<${MIN_COMPS_90}`);
      if (rs.flags.highVolatility) reasons.push(`vol>${MAX_VOL_BP}bp`);
      if (rs.flags.lowLiquidity) reasons.push('low-liquidity');

      const thesisText = (rs.thesis || '').slice(0, 220);
      const withFlags = reasons.length ? `${thesisText} [flags: ${reasons.join(', ')}]` : thesisText;
      const boundedThesis = withFlags.slice(0, 240);

      if (isFlagged && !KEEP_FLAGGED) {
        await prisma.signal.delete({ where: { id: s.id } });
        blocked++;
        continue;
      }

      await prisma.signal.update({ where: { id: s.id }, data: { thesis: boundedThesis } });
      updated++;
    } catch (err: any) {
      console.error('[thesis] error', err?.message || err);
      // soft skip on API/parse error
    }
  }
  return { updated, blocked };
}
