import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const cards = await prisma.card.count();
  const listings = await prisma.marketListing.count();
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

  console.log(
    JSON.stringify(
      {
        cards,
        listings,
        comps,
        compsLast90d: last90,
        cardsWith5Comps90d: Number(richCards[0]?.count ?? 0),
      },
      null,
      2,
    ),
  );
  await prisma.$disconnect();
}

main();
