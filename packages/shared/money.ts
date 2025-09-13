import type { PrismaClient } from '@prisma/client';

export async function toUSD(prisma: PrismaClient, amountCents: number, currency: string) {
  const cur = (currency || 'USD').toUpperCase();
  if (!Number.isFinite(amountCents) || amountCents <= 0) return amountCents;
  if (cur === 'USD') return amountCents;
  try {
    const rows = await prisma.$queryRaw<{ usdPerUnit: number }[]>`
      SELECT "usdPerUnit" FROM "FxRate" WHERE code = ${cur} LIMIT 1
    `;
    const rate = rows?.[0]?.usdPerUnit;
    if (!rate || !Number.isFinite(Number(rate))) return amountCents;
    const usd = (amountCents / 100) * Number(rate);
    return Math.round(usd * 100);
  } catch {
    return amountCents;
  }
}

