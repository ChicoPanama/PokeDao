import { PrismaClient } from '@prisma/client';
import OpenAI from 'openai';
import { ReasonedSignal } from '../schemas/reasonedSignal.js';

const prisma = new PrismaClient();

export async function auditAndThesisForNewSignals({ take = 50 } = {}) {
  const apiKey = process.env.DEEPSEEK_API_KEY || '';
  const baseURL = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com';
  if (!apiKey) {
    console.warn('[thesis] DEEPSEEK_API_KEY missing — skipping');
    return { updated: 0, blocked: 0 };
  }
  const client = new OpenAI({ apiKey, baseURL });

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

    const sys = `You are a veteran Pokémon TCG trader. Output JSON only, matching:
{"edgeBp":int,"confidence":0..1,"thesis":string,"drivers":[string],"flags":{"staleComps":bool,"highVolatility":bool,"lowLiquidity":bool}}
Rules:
1) Two sentences max, trader tone (no fluff).
2) Use lore/history only if it impacts price (reprints, pop reports, grading fees).
3) Never invent numbers; base on inputs only.
4) If comps<${MIN_COMPS_90} (90d) or volatility>${MAX_VOL_BP}bp or listing freshness>${MAX_FRESH_DAYS}d → set the appropriate flag true.`;

    const payload = {
      card: {
        name: s.card?.name,
        setCode: s.card?.setCode ?? s.card?.set ?? '',
        number: s.card?.number ?? '',
        variantKey: s.card?.variantKey ?? '',
      },
      listing: s.marketListing ? {
        priceCents: s.marketListing.priceCents,
        currency: s.marketListing.currency,
        url: s.marketListing.url,
        seenAt: s.marketListing.seenAt,
      } : null,
      features: features ? {
        medianCents: features.medianCents,
        p05Cents: features.p05Cents,
        p95Cents: features.p95Cents,
        volume: features.volume,
        volatilityBp: features.volatilityBp,
      } : null,
      signal: {
        edgeBp: s.edgeBp,
        confidence: s.confidence,
      },
      diagnostics: {
        comps90,
        volBp,
        listingFreshDays,
      }
    };

    try {
      const completion = await client.chat.completions.create({
        model: process.env.DEEPSEEK_MODEL_FAST || 'deepseek-chat',
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: sys },
          { role: 'user', content: JSON.stringify(payload) },
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
