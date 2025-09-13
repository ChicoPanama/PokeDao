-- DropIndex
DROP INDEX "public"."CompSale_cardId_saleDate_idx";

-- DropIndex
DROP INDEX "public"."CompSale_condition_idx";

-- DropIndex
DROP INDEX "public"."CompSale_normalizedPrice_idx";

-- DropIndex
DROP INDEX "public"."CompSale_verified_idx";

-- AlterTable
ALTER TABLE "public"."Card" ADD COLUMN     "cardKey" TEXT,
ADD COLUMN     "cardNumber" TEXT,
ADD COLUMN     "cardType" TEXT,
ADD COLUMN     "category" TEXT NOT NULL DEFAULT 'Pokemon',
ADD COLUMN     "cleanedName" TEXT,
ADD COLUMN     "rarityWeight" INTEGER,
ALTER COLUMN "language" SET NOT NULL;

-- AlterTable
ALTER TABLE "public"."CompSale" DROP COLUMN "buyer",
DROP COLUMN "condition",
DROP COLUMN "grade",
DROP COLUMN "marketplace",
DROP COLUMN "normalizedPrice",
DROP COLUMN "outlier",
DROP COLUMN "saleDate",
DROP COLUMN "salePrice",
DROP COLUMN "seller",
DROP COLUMN "verified",
DROP COLUMN "weight",
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "externalId" TEXT,
ADD COLUMN     "priceCents" INTEGER NOT NULL,
ADD COLUMN     "raw" JSONB,
ADD COLUMN     "soldAt" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "currency" DROP DEFAULT;

-- AlterTable
ALTER TABLE "public"."Listing" ADD COLUMN     "bidCount" INTEGER,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "directLowPrice" DOUBLE PRECISION,
ADD COLUMN     "endTime" TIMESTAMP(3),
ADD COLUMN     "externalId" TEXT,
ADD COLUMN     "highPrice" DOUBLE PRECISION,
ADD COLUMN     "imageUrl" TEXT,
ADD COLUMN     "listingType" TEXT,
ADD COLUMN     "lowPrice" DOUBLE PRECISION,
ADD COLUMN     "marketPrice" DOUBLE PRECISION,
ADD COLUMN     "midPrice" DOUBLE PRECISION,
ADD COLUMN     "shippingPrice" DOUBLE PRECISION,
ADD COLUMN     "stock" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "totalPrice" DOUBLE PRECISION,
ADD COLUMN     "watchers" INTEGER;

-- CreateTable
CREATE TABLE "public"."MarketListing" (
    "id" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "priceCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "condition" TEXT NOT NULL,
    "grade" TEXT,
    "url" TEXT NOT NULL,
    "seenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "MarketListing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."FeatureSnapshot" (
    "id" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "windowDays" INTEGER NOT NULL,
    "medianCents" INTEGER NOT NULL,
    "p95Cents" INTEGER NOT NULL,
    "p05Cents" INTEGER NOT NULL,
    "volume" INTEGER NOT NULL,
    "volatilityBp" INTEGER NOT NULL,
    "nhiScore" INTEGER,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeatureSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Signal" (
    "id" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "listingId" TEXT,
    "kind" TEXT NOT NULL,
    "edgeBp" INTEGER NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "thesis" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Signal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."RawImport" (
    "id" TEXT NOT NULL,
    "table" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "sourceId" TEXT,
    "payload" JSONB NOT NULL,
    "dedupKey" TEXT,
    "ingestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RawImport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SourceCatalogItem" (
    "id" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "cardKey" TEXT NOT NULL,
    "sourceName" TEXT NOT NULL,
    "sourceSet" TEXT NOT NULL,
    "sourceNumber" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SourceCatalogItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PriceCache" (
    "id" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "priceType" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "sampleSize" INTEGER NOT NULL DEFAULT 0,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PriceCache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ModelInsight" (
    "id" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "modelType" TEXT NOT NULL,
    "insight" JSONB NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "validUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModelInsight_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MarketListing_cardId_idx" ON "public"."MarketListing"("cardId");

-- CreateIndex
CREATE INDEX "MarketListing_seenAt_idx" ON "public"."MarketListing"("seenAt");

-- CreateIndex
CREATE UNIQUE INDEX "MarketListing_source_sourceId_key" ON "public"."MarketListing"("source", "sourceId");

-- CreateIndex
CREATE INDEX "FeatureSnapshot_updatedAt_idx" ON "public"."FeatureSnapshot"("updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "FeatureSnapshot_cardId_windowDays_key" ON "public"."FeatureSnapshot"("cardId", "windowDays");

-- CreateIndex
CREATE INDEX "Signal_createdAt_idx" ON "public"."Signal"("createdAt");

-- CreateIndex
CREATE INDEX "Signal_cardId_idx" ON "public"."Signal"("cardId");

-- CreateIndex
CREATE INDEX "RawImport_table_source_idx" ON "public"."RawImport"("table", "source");

-- CreateIndex
CREATE INDEX "RawImport_ingestedAt_idx" ON "public"."RawImport"("ingestedAt");

-- CreateIndex
CREATE INDEX "SourceCatalogItem_cardKey_idx" ON "public"."SourceCatalogItem"("cardKey");

-- CreateIndex
CREATE INDEX "SourceCatalogItem_sourceType_isVerified_idx" ON "public"."SourceCatalogItem"("sourceType", "isVerified");

-- CreateIndex
CREATE UNIQUE INDEX "SourceCatalogItem_sourceType_externalId_key" ON "public"."SourceCatalogItem"("sourceType", "externalId");

-- CreateIndex
CREATE INDEX "PriceCache_cardId_sourceType_priceType_idx" ON "public"."PriceCache"("cardId", "sourceType", "priceType");

-- CreateIndex
CREATE INDEX "PriceCache_timestamp_idx" ON "public"."PriceCache"("timestamp");

-- CreateIndex
CREATE INDEX "ModelInsight_cardId_modelType_idx" ON "public"."ModelInsight"("cardId", "modelType");

-- CreateIndex
CREATE INDEX "ModelInsight_modelType_confidence_idx" ON "public"."ModelInsight"("modelType", "confidence");

-- CreateIndex
CREATE INDEX "Card_cardKey_idx" ON "public"."Card"("cardKey");

-- CreateIndex
CREATE INDEX "Card_cleanedName_idx" ON "public"."Card"("cleanedName");

-- CreateIndex
CREATE INDEX "Card_rarity_rarityWeight_idx" ON "public"."Card"("rarity", "rarityWeight");

-- CreateIndex
CREATE INDEX "CompSale_cardId_soldAt_idx" ON "public"."CompSale"("cardId", "soldAt");

-- CreateIndex
CREATE UNIQUE INDEX "CompSale_source_externalId_key" ON "public"."CompSale"("source", "externalId");

-- CreateIndex
CREATE INDEX "Listing_externalId_source_idx" ON "public"."Listing"("externalId", "source");

-- CreateIndex
CREATE INDEX "Listing_listingType_endTime_idx" ON "public"."Listing"("listingType", "endTime");

-- AddForeignKey
ALTER TABLE "public"."MarketListing" ADD CONSTRAINT "MarketListing_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "public"."Card"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."FeatureSnapshot" ADD CONSTRAINT "FeatureSnapshot_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "public"."Card"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Signal" ADD CONSTRAINT "Signal_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "public"."Card"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Signal" ADD CONSTRAINT "Signal_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "public"."MarketListing"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Purchase" ADD CONSTRAINT "Purchase_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "public"."Listing"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SourceCatalogItem" ADD CONSTRAINT "SourceCatalogItem_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "public"."Card"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PriceCache" ADD CONSTRAINT "PriceCache_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "public"."Card"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ModelInsight" ADD CONSTRAINT "ModelInsight_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "public"."Card"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

