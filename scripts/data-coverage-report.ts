import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const cards = await prisma.card.count();
  const marketListings = await prisma.marketListing.count();
  const extendedListings = await prisma.listing.count();
  const comps = await prisma.compSale.count();
  const last90 = await prisma.compSale.count({
    where: { soldAt: { gte: new Date(Date.now() - 90 * 24 * 3600 * 1000) } },
  });

  // Cards with >=5 comps in last 90d
  const richCards = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(*)::bigint FROM (
      SELECT "cardId", COUNT(*) AS c
      FROM "CompSale"
      WHERE "soldAt" >= NOW() - INTERVAL '90 days'
      GROUP BY "cardId"
      HAVING COUNT(*) >= 5
    ) t
  `;

  // Anchor coverage by sourceType
  let anchorsBySource: Record<string, number> = {};
  try {
    const agg = await prisma.priceCache.groupBy({ by: ['sourceType'], _count: { _all: true } });
    anchorsBySource = Object.fromEntries(agg.map((r: any) => [r.sourceType, r._count._all]));
  } catch {}

  console.log(JSON.stringify({
    cards,
    marketListings,
    extendedListings,
    comps,
    compsLast90d: last90,
    cardsWith5Comps90d: Number(richCards[0]?.count ?? 0),
    anchorsBySource,
  }, null, 2));
  await prisma.$disconnect();
}

main();
