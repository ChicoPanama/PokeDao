import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const statements = [
  // Validate CHECK constraints added as NOT VALID
  `ALTER TABLE "public"."MarketListing" VALIDATE CONSTRAINT "MarketListing_priceCents_positive"`,
  `ALTER TABLE "public"."CompSale" VALIDATE CONSTRAINT "CompSale_priceCents_positive"`,
  `ALTER TABLE "public"."MarketListing" VALIDATE CONSTRAINT "MarketListing_currency_allowed"`,
  `ALTER TABLE "public"."CompSale" VALIDATE CONSTRAINT "CompSale_currency_allowed"`,
];

async function main() {
  const dryRun = process.argv.includes('--dry');
  console.log(`[validate-constraints] dry=${dryRun}`);
  for (const sql of statements) {
    if (dryRun) {
      console.log('DRY:', sql);
      continue;
    }
    try {
      await prisma.$executeRawUnsafe(sql);
      console.log('OK  :', sql);
    } catch (e: any) {
      console.error('FAIL:', sql, '\n  ->', e?.message || e);
    }
  }
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

