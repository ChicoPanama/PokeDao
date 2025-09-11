-- CreateTable
CREATE TABLE "public"."Card" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "set" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "variant" TEXT,
    "grade" TEXT,
    "condition" TEXT,
    "language" TEXT DEFAULT 'English',
    "normalizedName" TEXT,
    "setCode" TEXT,
    "rarity" TEXT,
    "variantKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Card_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Listing" (
    "id" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "url" TEXT NOT NULL,
    "seller" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "scrapedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "normalizedPrice" DOUBLE PRECISION,
    "condition" TEXT,
    "grade" TEXT,
    "marketplace" TEXT,

    CONSTRAINT "Listing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."User" (
    "id" TEXT NOT NULL,
    "telegramId" TEXT NOT NULL,
    "username" TEXT,
    "firstName" TEXT,
    "lastName" TEXT,
    "referralCode" TEXT NOT NULL,
    "referredBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Evaluation" (
    "id" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "fairValue" DOUBLE PRECISION NOT NULL,
    "discount" DOUBLE PRECISION NOT NULL,
    "investmentThesis" TEXT NOT NULL,
    "riskLevel" TEXT NOT NULL,
    "projectedReturn" DOUBLE PRECISION,
    "confidence" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Evaluation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Purchase" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "fee" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL,
    "txHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Purchase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Comp" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Comp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ReferralEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReferralEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CompSale" (
    "id" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "salePrice" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "normalizedPrice" DOUBLE PRECISION NOT NULL,
    "condition" TEXT NOT NULL,
    "grade" TEXT,
    "saleDate" TIMESTAMP(3) NOT NULL,
    "source" TEXT NOT NULL,
    "marketplace" TEXT NOT NULL,
    "seller" TEXT,
    "buyer" TEXT,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "outlier" BOOLEAN NOT NULL DEFAULT false,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 1.0,

    CONSTRAINT "CompSale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."MarketData" (
    "id" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "marketValue" DOUBLE PRECISION,
    "lowPrice" DOUBLE PRECISION,
    "highPrice" DOUBLE PRECISION,
    "avgPrice" DOUBLE PRECISION,
    "medianPrice" DOUBLE PRECISION,
    "volatility" DOUBLE PRECISION,
    "trend" TEXT,
    "trendStrength" DOUBLE PRECISION,
    "liquidity" TEXT,
    "totalListings" INTEGER NOT NULL DEFAULT 0,
    "activeSales" INTEGER NOT NULL DEFAULT 0,
    "avgTimeToSell" INTEGER,
    "lastUpdated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dataQuality" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sourceCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "MarketData_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PriceSnapshot" (
    "id" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "marketValue" DOUBLE PRECISION,
    "lowPrice" DOUBLE PRECISION,
    "highPrice" DOUBLE PRECISION,
    "avgPrice" DOUBLE PRECISION,
    "medianPrice" DOUBLE PRECISION,
    "listingCount" INTEGER NOT NULL DEFAULT 0,
    "saleCount" INTEGER NOT NULL DEFAULT 0,
    "volatility" DOUBLE PRECISION,
    "trend" TEXT,

    CONSTRAINT "PriceSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."WatchlistItem" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WatchlistItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Card_normalizedName_setCode_idx" ON "public"."Card"("normalizedName", "setCode");

-- CreateIndex
CREATE INDEX "Card_variantKey_idx" ON "public"."Card"("variantKey");

-- CreateIndex
CREATE UNIQUE INDEX "Card_set_number_variant_grade_key" ON "public"."Card"("set", "number", "variant", "grade");

-- CreateIndex
CREATE INDEX "Listing_source_idx" ON "public"."Listing"("source");

-- CreateIndex
CREATE INDEX "Listing_normalizedPrice_idx" ON "public"."Listing"("normalizedPrice");

-- CreateIndex
CREATE INDEX "Listing_condition_idx" ON "public"."Listing"("condition");

-- CreateIndex
CREATE UNIQUE INDEX "User_telegramId_key" ON "public"."User"("telegramId");

-- CreateIndex
CREATE UNIQUE INDEX "User_referralCode_key" ON "public"."User"("referralCode");

-- CreateIndex
CREATE INDEX "CompSale_cardId_saleDate_idx" ON "public"."CompSale"("cardId", "saleDate");

-- CreateIndex
CREATE INDEX "CompSale_normalizedPrice_idx" ON "public"."CompSale"("normalizedPrice");

-- CreateIndex
CREATE INDEX "CompSale_condition_idx" ON "public"."CompSale"("condition");

-- CreateIndex
CREATE INDEX "CompSale_verified_idx" ON "public"."CompSale"("verified");

-- CreateIndex
CREATE UNIQUE INDEX "MarketData_cardId_key" ON "public"."MarketData"("cardId");

-- CreateIndex
CREATE INDEX "MarketData_marketValue_idx" ON "public"."MarketData"("marketValue");

-- CreateIndex
CREATE INDEX "MarketData_trend_idx" ON "public"."MarketData"("trend");

-- CreateIndex
CREATE INDEX "MarketData_lastUpdated_idx" ON "public"."MarketData"("lastUpdated");

-- CreateIndex
CREATE INDEX "PriceSnapshot_cardId_timestamp_idx" ON "public"."PriceSnapshot"("cardId", "timestamp");

-- CreateIndex
CREATE INDEX "PriceSnapshot_marketValue_idx" ON "public"."PriceSnapshot"("marketValue");

-- AddForeignKey
ALTER TABLE "public"."Listing" ADD CONSTRAINT "Listing_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "public"."Card"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."User" ADD CONSTRAINT "User_referredBy_fkey" FOREIGN KEY ("referredBy") REFERENCES "public"."User"("referralCode") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Evaluation" ADD CONSTRAINT "Evaluation_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "public"."Card"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Evaluation" ADD CONSTRAINT "Evaluation_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "public"."Listing"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Purchase" ADD CONSTRAINT "Purchase_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ReferralEvent" ADD CONSTRAINT "ReferralEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CompSale" ADD CONSTRAINT "CompSale_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "public"."Card"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MarketData" ADD CONSTRAINT "MarketData_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "public"."Card"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PriceSnapshot" ADD CONSTRAINT "PriceSnapshot_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "public"."Card"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."WatchlistItem" ADD CONSTRAINT "WatchlistItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."WatchlistItem" ADD CONSTRAINT "WatchlistItem_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "public"."Card"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
