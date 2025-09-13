import type { PrismaClient } from '@prisma/client';
import { parseTitleWithQwen, parseTitleFallback } from '../normalizers/titleParser.js';
import { upsertCardByKey } from '../db.js';
import { cardKey } from '../keys.js';
import { toUSD } from '../money.js';

export async function insertEbaySoldBatch(
  prisma: PrismaClient,
  raws: Array<{ itemId: string; title: string; priceCents: number; currency: string; soldAt: Date; url: string }>,
) {
  let ok = 0, dup = 0, err = 0;
  for (const r of raws) {
    try {
      const parsed = (await parseTitleWithQwen(r.title).catch(() => null)) || parseTitleFallback(r.title);
      if (!parsed || !parsed.setCode || !parsed.number) { err++; continue; }
      const ck = cardKey(parsed.setCode, parsed.number, '', parsed.language || 'EN');
      const card = await upsertCardByKey(prisma, ck, `${parsed.setCode} ${parsed.number}`);

      const priceCentsUsd = await toUSD(prisma, r.priceCents, r.currency);

      await prisma.compSale.create({
        data: {
          cardId: card.id,
          source: 'EbaySold',
          externalId: r.itemId,
          priceCents: r.priceCents,
          priceCentsUsd,
          currency: r.currency as any,
          soldAt: r.soldAt,
          raw: { url: r.url, title: r.title },
        },
      });
      ok++;
    } catch (e: any) {
      const msg = String(e?.message || '');
      if (msg.includes('Unique constraint') || String((e as any)?.code || '') === 'P2002') dup++; else err++;
    }
  }
  return { ok, dup, err };
}

