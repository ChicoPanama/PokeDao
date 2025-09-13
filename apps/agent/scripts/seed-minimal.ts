import 'dotenv/config';
import { sharedPrisma as prisma } from '../../../packages/shared/db.js';

async function main() {
  // Create a simple Card
  const card = await prisma.card.create({
    data: {
      name: 'Test Card',
      set: 'TestSet',
      number: '1',
      variant: null,
      grade: null,
      condition: null,
      language: 'English',
      setCode: 'TST',
      variantKey: 'EN',
      category: 'Pokemon',
    },
  });

  // Minimal listing priced below comps
  await prisma.marketListing.upsert({
    where: { source_sourceId: { source: 'EBAY', sourceId: 'seed-listing-1' } },
    update: {
      cardId: card.id,
      priceCents: 1000,
      currency: 'USD',
      condition: 'NM',
      grade: null,
      url: 'https://example.com/test-listing-1',
      seenAt: new Date(),
      isActive: true,
    },
    create: {
      cardId: card.id,
      source: 'EBAY',
      sourceId: 'seed-listing-1',
      priceCents: 1000,
      currency: 'USD',
      condition: 'NM',
      grade: null,
      url: 'https://example.com/test-listing-1',
      seenAt: new Date(),
      isActive: true,
    },
  });

  // Two comps in the last 30d at higher prices
  const now = Date.now();
  await prisma.compSale.createMany({
    data: [
      { cardId: card.id, source: 'EbaySold', externalId: 'seed-comp-1', priceCents: 1800, currency: 'USD', soldAt: new Date(now - 3 * 86400_000) },
      { cardId: card.id, source: 'EbaySold', externalId: 'seed-comp-2', priceCents: 1600, currency: 'USD', soldAt: new Date(now - 10 * 86400_000) },
    ],
    skipDuplicates: true,
  });

  console.log('Seeded minimal listing + comps');
}

main().then(() => prisma.$disconnect()).catch((e) => {
  console.error(e);
  prisma.$disconnect();
  process.exit(1);
});
