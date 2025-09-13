import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();

async function main() {
  const LISTING_ID = process.env.LISTING_ID || '';
  const COMP_MULT = Number(process.env.COMP_MULT || 5.1); // comps ≈ listing * 5.1
  const NOW = Date.now();

  // 1) Find the target listing
  let listing: any;
  if (LISTING_ID) {
    listing = await db.marketListing.findUnique({
      where: { id: LISTING_ID },
      select: {
        id: true, cardId: true, source: true, priceCents: true, url: true,
        isActive: true, seenAt: true
      }
    });
    if (!listing) throw new Error(`Listing not found: ${LISTING_ID}`);
  } else {
    // Pick newest active+recent listing (seenAt/updatedAt/createdAt within 60 min)
    const since = new Date(NOW - 60 * 60 * 1000);
    listing = await db.marketListing.findFirst({
      where: {
        isActive: { equals: true } as any,
        OR: [
          { seenAt: { gte: since } as any },
        ],
      },
      orderBy: [{ seenAt: 'desc' as any }],
      select: {
        id: true, cardId: true, source: true, priceCents: true, url: true,
        isActive: true, seenAt: true
      }
    });
    if (!listing) {
      throw new Error('No recent active listing found (try setting LISTING_ID or creating/refreshing a listing).');
    }
  }

  // Make sure it’s “recent” for your fetch step
  await db.marketListing.update({
    where: { id: listing.id },
    data: { isActive: true, seenAt: new Date() } as any,
  });

  // 2) Create 10 comps around target median = listing.priceCents * COMP_MULT
  const base = Math.max(500, Math.floor(listing.priceCents * COMP_MULT));
  const prices = [ -300, -200, -150, -100, -50, 0, 50, 100, 150, 200 ].map(delta => base + delta);

  // soldAt over last 10 days to ensure within 30d window
  const compRows = prices.map((p, i) => ({
    id: `${listing.id}-comp-${i}-${NOW}`,
    cardId: listing.cardId,
    priceCents: p,
    soldAt: new Date(NOW - (i + 1) * 24 * 3600 * 1000),
    source: listing.source || 'seed',
    currency: 'USD',
  }));

  await db.compSale.createMany({ data: compRows as any, skipDuplicates: true });

  console.log('✔ Seeded from listing:');
  console.log('  listingId:', listing.id);
  console.log('  cardId   :', listing.cardId);
  console.log('  price    :', `$${(listing.priceCents/100).toFixed(2)}`);
  console.log('  comps    :', prices.map(p => `$${(p/100).toFixed(2)}`).join(', '));
}

main()
  .then(() => db.$disconnect())
  .catch((e) => {
    console.error(e);
    return db.$disconnect().finally(() => process.exit(1));
  });
