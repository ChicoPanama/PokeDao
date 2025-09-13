-- CreateEnum
CREATE TYPE "public"."OpportunityStatus" AS ENUM ('PENDING', 'POSTED', 'EXPIRED', 'RETRACTED');

-- AlterTable
ALTER TABLE "public"."CompSale" ADD COLUMN     "priceCentsUsd" INTEGER;

-- AlterTable
ALTER TABLE "public"."MarketListing" ADD COLUMN     "priceCentsUsd" INTEGER;

-- CreateTable
CREATE TABLE "public"."PostQueue" (
    "id" TEXT NOT NULL,
    "signalId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "scheduledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PostQueue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."TitleParseCache" (
    "id" TEXT NOT NULL,
    "schemaVersion" INTEGER NOT NULL DEFAULT 1,
    "titleRaw" TEXT NOT NULL,
    "titleNorm" TEXT NOT NULL,
    "titleHash" TEXT NOT NULL,
    "setCode" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "variantKey" TEXT NOT NULL DEFAULT 'EN',
    "language" TEXT,
    "confidence" DOUBLE PRECISION NOT NULL,
    "cardSlug" TEXT,
    "hits" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TitleParseCache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."FxRate" (
    "code" TEXT NOT NULL,
    "usdPerUnit" DOUBLE PRECISION NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FxRate_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "public"."Opportunity" (
    "id" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "sourceBuy" TEXT NOT NULL,
    "sourceSell" TEXT NOT NULL,
    "buyPriceCents" INTEGER NOT NULL,
    "buyShippingCents" INTEGER NOT NULL DEFAULT 0,
    "buyFeesCents" INTEGER NOT NULL DEFAULT 0,
    "sellCompCents" INTEGER NOT NULL,
    "sellFeesCents" INTEGER NOT NULL DEFAULT 0,
    "sellShippingCents" INTEGER NOT NULL DEFAULT 0,
    "expectedProfitCents" INTEGER NOT NULL,
    "netSpreadBps" INTEGER NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "rationale" TEXT NOT NULL DEFAULT '',
    "status" "public"."OpportunityStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Opportunity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PostQueue_scheduledAt_idx" ON "public"."PostQueue"("scheduledAt");

-- CreateIndex
CREATE INDEX "TitleParseCache_updatedAt_idx" ON "public"."TitleParseCache"("updatedAt");

-- CreateIndex
CREATE INDEX "TitleParseCache_hits_idx" ON "public"."TitleParseCache"("hits");

-- CreateIndex
CREATE UNIQUE INDEX "TitleParseCache_schemaVersion_titleHash_key" ON "public"."TitleParseCache"("schemaVersion", "titleHash");

-- CreateIndex
CREATE INDEX "Opportunity_cardId_createdAt_idx" ON "public"."Opportunity"("cardId", "createdAt");

-- CreateIndex
CREATE INDEX "Opportunity_status_createdAt_idx" ON "public"."Opportunity"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Opportunity_cardId_listingId_createdAt_key" ON "public"."Opportunity"("cardId", "listingId", "createdAt");

-- CreateIndex
CREATE INDEX "FeatureSnapshot_cardId_windowDays_updatedAt_idx" ON "public"."FeatureSnapshot"("cardId", "windowDays", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "Signal_edgeBp_createdAt_idx" ON "public"."Signal"("edgeBp" DESC, "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Signal_cardId_createdAt_idx" ON "public"."Signal"("cardId", "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "public"."PostQueue" ADD CONSTRAINT "PostQueue_signalId_fkey" FOREIGN KEY ("signalId") REFERENCES "public"."Signal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
