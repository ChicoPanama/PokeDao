-- MarketListing natural key & data-quality constraints

-- Ensure MarketListing has the unique key on (source, sourceId)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM   pg_indexes
    WHERE  schemaname = 'public'
    AND    indexname = 'MarketListing_source_sourceId_key'
  ) THEN
    CREATE UNIQUE INDEX "MarketListing_source_sourceId_key"
      ON "public"."MarketListing" ("source", "sourceId");
  END IF;
END$$;

-- CompSale: partial unique on externalId to enforce dedupe when present
CREATE UNIQUE INDEX IF NOT EXISTS comp_extid_unique
  ON "public"."CompSale" ("source", "externalId")
  WHERE "externalId" IS NOT NULL;

-- CompSale: recent window index
CREATE INDEX IF NOT EXISTS comps_recent_idx
  ON "public"."CompSale" ("cardId", "soldAt")
  WHERE "soldAt" >= NOW() - INTERVAL '365 days';

-- CHECK constraints (added NOT VALID first to avoid blocking if legacy rows exist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'MarketListing_priceCents_positive'
  ) THEN
    ALTER TABLE "public"."MarketListing"
      ADD CONSTRAINT "MarketListing_priceCents_positive" CHECK ("priceCents" > 0) NOT VALID;
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CompSale_priceCents_positive'
  ) THEN
    ALTER TABLE "public"."CompSale"
      ADD CONSTRAINT "CompSale_priceCents_positive" CHECK ("priceCents" > 0) NOT VALID;
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'MarketListing_currency_allowed'
  ) THEN
    ALTER TABLE "public"."MarketListing"
      ADD CONSTRAINT "MarketListing_currency_allowed" CHECK ("currency" IN ('USD','EUR','GBP','JPY')) NOT VALID;
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CompSale_currency_allowed'
  ) THEN
    ALTER TABLE "public"."CompSale"
      ADD CONSTRAINT "CompSale_currency_allowed" CHECK ("currency" IN ('USD','EUR','GBP','JPY')) NOT VALID;
  END IF;
END$$;

-- Optional: validate constraints after review
-- ALTER TABLE "public"."MarketListing" VALIDATE CONSTRAINT "MarketListing_priceCents_positive";
-- ALTER TABLE "public"."CompSale" VALIDATE CONSTRAINT "CompSale_priceCents_positive";
-- ALTER TABLE "public"."MarketListing" VALIDATE CONSTRAINT "MarketListing_currency_allowed";
-- ALTER TABLE "public"."CompSale" VALIDATE CONSTRAINT "CompSale_currency_allowed";

