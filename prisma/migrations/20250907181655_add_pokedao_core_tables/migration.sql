-- AlterTable
ALTER TABLE "Card" ADD COLUMN     "cardKey" TEXT;

-- AlterTable
ALTER TABLE "Listing" ADD COLUMN     "condition" TEXT,
ADD COLUMN     "raw" JSONB,
ADD COLUMN     "sourceItemId" TEXT;

-- CreateTable
CREATE TABLE "SourceCatalogItem" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "sourceItemId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "setName" TEXT,
    "number" TEXT,
    "grade" TEXT,
    "url" TEXT NOT NULL,
    "cardKey" TEXT,
    "cardId" TEXT,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SourceCatalogItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceCache" (
    "id" TEXT NOT NULL,
    "cardKey" TEXT NOT NULL,
    "cardId" TEXT,
    "windowDays" INTEGER NOT NULL,
    "median" DECIMAL(10,2) NOT NULL,
    "iqr" DECIMAL(10,2) NOT NULL,
    "sampleSize" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PriceCache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModelInsight" (
    "id" TEXT NOT NULL,
    "cardKey" TEXT,
    "cardId" TEXT,
    "catalogItemId" TEXT,
    "verdict" TEXT NOT NULL,
    "fairValue" DECIMAL(10,2),
    "confidence" DOUBLE PRECISION NOT NULL,
    "risks" TEXT[],
    "rationale" TEXT,
    "inputHash" TEXT NOT NULL,
    "model" TEXT NOT NULL DEFAULT 'deepseek',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModelInsight_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScrapeCursor" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "cursor" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScrapeCursor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RateBudget" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "maxPerWindow" INTEGER NOT NULL,
    "windowSec" INTEGER NOT NULL,
    "lastResetAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usedCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "RateBudget_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SourceCatalogItem_cardKey_idx" ON "SourceCatalogItem"("cardKey");

-- CreateIndex
CREATE INDEX "SourceCatalogItem_source_lastSeenAt_idx" ON "SourceCatalogItem"("source", "lastSeenAt");

-- CreateIndex
CREATE INDEX "SourceCatalogItem_cardId_idx" ON "SourceCatalogItem"("cardId");

-- CreateIndex
CREATE UNIQUE INDEX "SourceCatalogItem_source_sourceItemId_key" ON "SourceCatalogItem"("source", "sourceItemId");

-- CreateIndex
CREATE INDEX "PriceCache_cardKey_idx" ON "PriceCache"("cardKey");

-- CreateIndex
CREATE INDEX "PriceCache_cardId_idx" ON "PriceCache"("cardId");

-- CreateIndex
CREATE UNIQUE INDEX "PriceCache_cardKey_windowDays_key" ON "PriceCache"("cardKey", "windowDays");

-- CreateIndex
CREATE INDEX "ModelInsight_cardKey_createdAt_idx" ON "ModelInsight"("cardKey", "createdAt");

-- CreateIndex
CREATE INDEX "ModelInsight_verdict_expiresAt_idx" ON "ModelInsight"("verdict", "expiresAt");

-- CreateIndex
CREATE INDEX "ModelInsight_cardId_idx" ON "ModelInsight"("cardId");

-- CreateIndex
CREATE INDEX "ModelInsight_catalogItemId_idx" ON "ModelInsight"("catalogItemId");

-- CreateIndex
CREATE UNIQUE INDEX "ModelInsight_inputHash_key" ON "ModelInsight"("inputHash");

-- CreateIndex
CREATE UNIQUE INDEX "ScrapeCursor_source_key" ON "ScrapeCursor"("source");

-- CreateIndex
CREATE UNIQUE INDEX "RateBudget_source_key" ON "RateBudget"("source");

-- CreateIndex
CREATE INDEX "RateBudget_source_lastResetAt_idx" ON "RateBudget"("source", "lastResetAt");

-- CreateIndex
CREATE INDEX "Card_cardKey_idx" ON "Card"("cardKey");

-- CreateIndex
CREATE INDEX "Listing_source_scrapedAt_idx" ON "Listing"("source", "scrapedAt");

-- CreateIndex
CREATE INDEX "Listing_sourceItemId_idx" ON "Listing"("sourceItemId");

-- AddForeignKey
ALTER TABLE "SourceCatalogItem" ADD CONSTRAINT "SourceCatalogItem_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceCache" ADD CONSTRAINT "PriceCache_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModelInsight" ADD CONSTRAINT "ModelInsight_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModelInsight" ADD CONSTRAINT "ModelInsight_catalogItemId_fkey" FOREIGN KEY ("catalogItemId") REFERENCES "SourceCatalogItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
