import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();

async function main() {
  const cardId = 'test-card-1';
  const listingId = 'test-listing-1';

  // 1) BUY listing — cheap vs comps
  await db.marketListing.upsert({
    where: { id: listingId },
    update: { isActive: true, seenAt: new Date(), priceCents: 1000, url: 'https://example.com/test-listing-1', sourceId: 'seed-oppty-1', currency: 'USD', condition: 'NM' } as any,
    create: {
      id: listingId,
      cardId,
      source: 'EBAY',
      sourceId: 'seed-oppty-1',
      priceCents: 1000,
      currency: 'USD',
      condition: 'NM',
      url: 'https://example.com/test-listing-1',
      seenAt: new Date(),
      isActive: true,
    } as any,
  });

  // 2) 10 comps ~ $48–$53 → median ~ $51 (>=10 comps → confidence >= 0.6)
  const now = Date.now();
  const prices = [4800, 4900, 4950, 5000, 5050, 5100, 5150, 5200, 5250, 5300];
  await db.compSale.createMany({
    data: prices.map((p, i) => ({
      id: `test-comp-${i + 1}`,
      cardId,
      priceCents: p,
      soldAt: new Date(now - (i + 1) * 24 * 3600 * 1000),
      source: 'EBAY',
      currency: 'USD',
    })) as any,
    skipDuplicates: true,
  });

  console.log('✔ Seeded one listing + 10 comps');
}

main()
  .then(() => db.$disconnect())
  .catch((e) => {
    console.error(e);
    return db.$disconnect().finally(() => process.exit(1));
  });
