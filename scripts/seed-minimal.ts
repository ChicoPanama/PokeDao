import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();

async function main() {
  const cardId = 'test-card-1';


  // Ensure the card exists
  await db.card.upsert({
    where: { id: cardId },
    update: {},
    create: {
      id: cardId,
      name: 'Test Card',
      set: 'Test Set',
      number: '001',
      language: 'English',
      category: 'Pokemon',
    },
  });

  // 1) Fake BUY listing (cheaper than comps)
  await db.marketListing.upsert({
    where: { id: 'test-listing-1' },
    update: {},
    create: {
      id: 'test-listing-1',
      cardId,
      source: 'EBAY',
      sourceId: 'ebay-123',
      priceCents: 1000,            // $10
      currency: 'USD',
      condition: 'NM',
      url: 'https://example.com/test-listing-1',
      isActive: true,
      seenAt: new Date(),
    },
  });

  // 2) Two recent COMPS at ~$16–$18 (median ~$17)
  const now = new Date();
  await db.compSale.createMany({
    data: [
  { id: 'test-comp-1', cardId, priceCents: 1800, soldAt: new Date(now.getTime() - 3 * 86400_000), source: 'EBAY', currency: 'USD' } as any,
  { id: 'test-comp-2', cardId, priceCents: 1600, soldAt: new Date(now.getTime() - 10 * 86400_000), source: 'EBAY', currency: 'USD' } as any,
    ] as any,
    skipDuplicates: true,
  });

  console.log('✔ Seeded minimal listing + comps');
}

main()
  .then(() => db.$disconnect())
  .catch((e) => {
    console.error(e);
    return db.$disconnect().finally(() => process.exit(1));
  });
