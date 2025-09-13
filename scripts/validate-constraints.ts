import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const createIfMissing = [
  `DO $$
   BEGIN
     IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'MarketListing_priceCents_positive') THEN
       ALTER TABLE "public"."MarketListing"
         ADD CONSTRAINT "MarketListing_priceCents_positive" CHECK ("priceCents" > 0) NOT VALID;
     END IF;
   END$$;`,
  `DO $$
   BEGIN
     IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='CompSale' AND column_name='priceCents') THEN
       IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CompSale_priceCents_positive') THEN
         ALTER TABLE "public"."CompSale"
           ADD CONSTRAINT "CompSale_priceCents_positive" CHECK ("priceCents" > 0) NOT VALID;
       END IF;
     END IF;
   END$$;`,
  `DO $$
   BEGIN
     IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'MarketListing_currency_allowed') THEN
       ALTER TABLE "public"."MarketListing"
         ADD CONSTRAINT "MarketListing_currency_allowed" CHECK ("currency" IN ('USD','EUR','GBP','JPY')) NOT VALID;
     END IF;
   END$$;`,
  `DO $$
   BEGIN
     IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CompSale_currency_allowed') THEN
       ALTER TABLE "public"."CompSale"
         ADD CONSTRAINT "CompSale_currency_allowed" CHECK ("currency" IN ('USD','EUR','GBP','JPY')) NOT VALID;
     END IF;
   END$$;`,
];

const validate = [
  `ALTER TABLE "public"."MarketListing" VALIDATE CONSTRAINT "MarketListing_priceCents_positive"`,
  `ALTER TABLE "public"."CompSale" VALIDATE CONSTRAINT "CompSale_priceCents_positive"`,
  `ALTER TABLE "public"."MarketListing" VALIDATE CONSTRAINT "MarketListing_currency_allowed"`,
  `ALTER TABLE "public"."CompSale" VALIDATE CONSTRAINT "CompSale_currency_allowed"`,
];

async function main() {
  const dryRun = process.argv.includes('--dry');
  console.log(`[validate-constraints] dry=${dryRun}`);
  const create = process.argv.includes('--create');
  if (!dryRun && create) {
    for (const sql of createIfMissing) {
      try { await prisma.$executeRawUnsafe(sql); console.log('OK  :', sql.split('\n')[0], '...'); }
      catch (e: any) { console.error('FAIL:', e?.message || e); }
    }
  }

  for (const sql of validate) {
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
