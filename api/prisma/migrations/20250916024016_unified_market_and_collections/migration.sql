/*
  Warnings:

  - You are about to drop the column `cardNumber` on the `Card` table. All the data in the column will be lost.
  - You are about to drop the column `category` on the `Card` table. All the data in the column will be lost.
  - You are about to drop the column `cleanedName` on the `Card` table. All the data in the column will be lost.
  - You are about to drop the column `rarityWeight` on the `Card` table. All the data in the column will be lost.
  - You are about to drop the column `set` on the `Card` table. All the data in the column will be lost.
  - You are about to drop the column `variantKey` on the `Card` table. All the data in the column will be lost.
  - You are about to alter the column `name` on the `Card` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(255)`.
  - You are about to alter the column `number` on the `Card` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(10)`.
  - You are about to alter the column `variant` on the `Card` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(100)`.
  - You are about to alter the column `grade` on the `Card` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(20)`.
  - You are about to alter the column `condition` on the `Card` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(50)`.
  - You are about to alter the column `language` on the `Card` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(10)`.
  - You are about to alter the column `normalizedName` on the `Card` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(255)`.
  - You are about to alter the column `setCode` on the `Card` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(50)`.
  - You are about to alter the column `rarity` on the `Card` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(50)`.
  - You are about to alter the column `cardKey` on the `Card` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(100)`.
  - You are about to alter the column `cardType` on the `Card` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(50)`.
  - You are about to drop the column `createdAt` on the `CompSale` table. All the data in the column will be lost.
  - You are about to drop the column `externalId` on the `CompSale` table. All the data in the column will be lost.
  - You are about to drop the column `priceCentsUsd` on the `CompSale` table. All the data in the column will be lost.
  - You are about to drop the column `raw` on the `CompSale` table. All the data in the column will be lost.
  - You are about to alter the column `currency` on the `CompSale` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(3)`.
  - You are about to alter the column `source` on the `CompSale` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(50)`.
  - You are about to drop the column `accuracy` on the `DataQuality` table. All the data in the column will be lost.
  - You are about to drop the column `cardId` on the `DataQuality` table. All the data in the column will be lost.
  - You are about to drop the column `completeness` on the `DataQuality` table. All the data in the column will be lost.
  - You are about to drop the column `consistency` on the `DataQuality` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `DataQuality` table. All the data in the column will be lost.
  - You are about to drop the column `freshness` on the `DataQuality` table. All the data in the column will be lost.
  - You are about to drop the column `listingId` on the `DataQuality` table. All the data in the column will be lost.
  - You are about to drop the column `resolved` on the `DataQuality` table. All the data in the column will be lost.
  - You are about to drop the column `resolvedAt` on the `DataQuality` table. All the data in the column will be lost.
  - You are about to drop the column `resolvedBy` on the `DataQuality` table. All the data in the column will be lost.
  - You are about to drop the column `severity` on the `DataQuality` table. All the data in the column will be lost.
  - The `issues` column on the `DataQuality` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to alter the column `riskLevel` on the `Evaluation` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(20)`.
  - You are about to drop the column `bidCount` on the `Listing` table. All the data in the column will be lost.
  - You are about to drop the column `description` on the `Listing` table. All the data in the column will be lost.
  - You are about to drop the column `directLowPrice` on the `Listing` table. All the data in the column will be lost.
  - You are about to drop the column `endTime` on the `Listing` table. All the data in the column will be lost.
  - You are about to drop the column `highPrice` on the `Listing` table. All the data in the column will be lost.
  - You are about to drop the column `imageUrl` on the `Listing` table. All the data in the column will be lost.
  - You are about to drop the column `listingType` on the `Listing` table. All the data in the column will be lost.
  - You are about to drop the column `lowPrice` on the `Listing` table. All the data in the column will be lost.
  - You are about to drop the column `marketPrice` on the `Listing` table. All the data in the column will be lost.
  - You are about to drop the column `marketplace` on the `Listing` table. All the data in the column will be lost.
  - You are about to drop the column `midPrice` on the `Listing` table. All the data in the column will be lost.
  - You are about to drop the column `normalizedPrice` on the `Listing` table. All the data in the column will be lost.
  - You are about to drop the column `stock` on the `Listing` table. All the data in the column will be lost.
  - You are about to drop the column `watchers` on the `Listing` table. All the data in the column will be lost.
  - You are about to alter the column `source` on the `Listing` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(50)`.
  - You are about to alter the column `currency` on the `Listing` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(3)`.
  - You are about to alter the column `url` on the `Listing` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(500)`.
  - You are about to alter the column `seller` on the `Listing` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(255)`.
  - You are about to alter the column `condition` on the `Listing` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(50)`.
  - You are about to alter the column `grade` on the `Listing` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(20)`.
  - You are about to alter the column `externalId` on the `Listing` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(100)`.
  - You are about to drop the column `priceCentsUsd` on the `MarketListing` table. All the data in the column will be lost.
  - You are about to alter the column `source` on the `MarketListing` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(50)`.
  - You are about to alter the column `sourceId` on the `MarketListing` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(100)`.
  - You are about to alter the column `currency` on the `MarketListing` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(3)`.
  - You are about to alter the column `condition` on the `MarketListing` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(50)`.
  - You are about to alter the column `grade` on the `MarketListing` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(20)`.
  - You are about to alter the column `url` on the `MarketListing` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(500)`.
  - You are about to alter the column `sourceBuy` on the `Opportunity` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(50)`.
  - You are about to alter the column `sourceSell` on the `Opportunity` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(50)`.
  - You are about to drop the column `createdAt` on the `PostQueue` table. All the data in the column will be lost.
  - You are about to drop the column `signalId` on the `PostQueue` table. All the data in the column will be lost.
  - You are about to alter the column `status` on the `PostQueue` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(20)`.
  - You are about to drop the column `kind` on the `Signal` table. All the data in the column will be lost.
  - You are about to alter the column `username` on the `User` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(255)`.
  - You are about to alter the column `firstName` on the `User` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(255)`.
  - You are about to alter the column `lastName` on the `User` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(255)`.
  - You are about to alter the column `referralCode` on the `User` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(50)`.
  - You are about to alter the column `referredBy` on the `User` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(50)`.
  - You are about to drop the `AuditLog` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Comp` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `DataSource` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `FeatureSnapshot` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `FxRate` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `MarketData` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ModelInsight` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `PriceCache` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `PriceSnapshot` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ProcessingJob` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Purchase` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `RawImport` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ReferralEvent` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `SourceCatalogItem` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `TitleParseCache` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[cardKey]` on the table `Card` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[setCode,number,variant,grade,language]` on the table `Card` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[source,externalId]` on the table `Listing` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[cardId,userId]` on the table `WatchlistItem` will be added. If there are existing duplicate values, this will fail.
  - Made the column `normalizedName` on table `Card` required. This step will fail if there are existing NULL values in that column.
  - Made the column `setCode` on table `Card` required. This step will fail if there are existing NULL values in that column.
  - Made the column `cardKey` on table `Card` required. This step will fail if there are existing NULL values in that column.
  - Made the column `cardType` on table `Card` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `entityId` to the `DataQuality` table without a default value. This is not possible if the table is not empty.
  - Added the required column `entityType` to the `DataQuality` table without a default value. This is not possible if the table is not empty.
  - Added the required column `qualityScore` to the `DataQuality` table without a default value. This is not possible if the table is not empty.
  - Made the column `externalId` on table `Listing` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `updatedAt` to the `Signal` table without a default value. This is not possible if the table is not empty.
  - Made the column `listingId` on table `Signal` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateEnum
CREATE TYPE "public"."MarketSource" AS ENUM ('EBAY', 'TCGPLAYER', 'FANATICS', 'COLLECTOR_CRYPT', 'MANUAL', 'CSV');

-- CreateEnum
CREATE TYPE "public"."GradeCompany" AS ENUM ('RAW', 'PSA', 'BGS', 'CGC', 'SGC', 'OTHER');

-- CreateEnum
CREATE TYPE "public"."RiskLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "public"."LiquidityLevel" AS ENUM ('HIGH', 'MEDIUM', 'LOW');

-- CreateEnum
CREATE TYPE "public"."DemandTrend" AS ENUM ('RISING', 'STABLE', 'FALLING');

-- AlterEnum
ALTER TYPE "public"."OpportunityStatus" ADD VALUE 'INVALID';

-- DropForeignKey
ALTER TABLE "public"."AuditLog" DROP CONSTRAINT "AuditLog_sourceId_fkey";

-- DropForeignKey
ALTER TABLE "public"."CompSale" DROP CONSTRAINT "CompSale_cardId_fkey";

-- DropForeignKey
ALTER TABLE "public"."DataQuality" DROP CONSTRAINT "DataQuality_cardId_fkey";

-- DropForeignKey
ALTER TABLE "public"."DataQuality" DROP CONSTRAINT "DataQuality_listingId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Evaluation" DROP CONSTRAINT "Evaluation_cardId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Evaluation" DROP CONSTRAINT "Evaluation_listingId_fkey";

-- DropForeignKey
ALTER TABLE "public"."FeatureSnapshot" DROP CONSTRAINT "FeatureSnapshot_cardId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Listing" DROP CONSTRAINT "Listing_cardId_fkey";

-- DropForeignKey
ALTER TABLE "public"."MarketData" DROP CONSTRAINT "MarketData_cardId_fkey";

-- DropForeignKey
ALTER TABLE "public"."MarketListing" DROP CONSTRAINT "MarketListing_cardId_fkey";

-- DropForeignKey
ALTER TABLE "public"."ModelInsight" DROP CONSTRAINT "ModelInsight_cardId_fkey";

-- DropForeignKey
ALTER TABLE "public"."PostQueue" DROP CONSTRAINT "PostQueue_signalId_fkey";

-- DropForeignKey
ALTER TABLE "public"."PriceCache" DROP CONSTRAINT "PriceCache_cardId_fkey";

-- DropForeignKey
ALTER TABLE "public"."PriceSnapshot" DROP CONSTRAINT "PriceSnapshot_cardId_fkey";

-- DropForeignKey
ALTER TABLE "public"."ProcessingJob" DROP CONSTRAINT "ProcessingJob_sourceId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Purchase" DROP CONSTRAINT "Purchase_listingId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Purchase" DROP CONSTRAINT "Purchase_userId_fkey";

-- DropForeignKey
ALTER TABLE "public"."ReferralEvent" DROP CONSTRAINT "ReferralEvent_userId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Signal" DROP CONSTRAINT "Signal_cardId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Signal" DROP CONSTRAINT "Signal_listingId_fkey";

-- DropForeignKey
ALTER TABLE "public"."SourceCatalogItem" DROP CONSTRAINT "SourceCatalogItem_cardId_fkey";

-- DropForeignKey
ALTER TABLE "public"."User" DROP CONSTRAINT "User_referredBy_fkey";

-- DropForeignKey
ALTER TABLE "public"."WatchlistItem" DROP CONSTRAINT "WatchlistItem_cardId_fkey";

-- DropForeignKey
ALTER TABLE "public"."WatchlistItem" DROP CONSTRAINT "WatchlistItem_userId_fkey";

-- DropIndex
DROP INDEX "public"."Card_cleanedName_idx";

-- DropIndex
DROP INDEX "public"."Card_normalizedName_setCode_idx";

-- DropIndex
DROP INDEX "public"."Card_rarity_rarityWeight_idx";

-- DropIndex
DROP INDEX "public"."Card_set_number_variant_grade_key";

-- DropIndex
DROP INDEX "public"."Card_variantKey_idx";

-- DropIndex
DROP INDEX "public"."CompSale_cardId_soldAt_idx";

-- DropIndex
DROP INDEX "public"."CompSale_source_externalId_key";

-- DropIndex
DROP INDEX "public"."DataQuality_cardId_idx";

-- DropIndex
DROP INDEX "public"."DataQuality_completeness_idx";

-- DropIndex
DROP INDEX "public"."DataQuality_createdAt_idx";

-- DropIndex
DROP INDEX "public"."DataQuality_severity_resolved_idx";

-- DropIndex
DROP INDEX "public"."Listing_condition_idx";

-- DropIndex
DROP INDEX "public"."Listing_externalId_source_idx";

-- DropIndex
DROP INDEX "public"."Listing_listingType_endTime_idx";

-- DropIndex
DROP INDEX "public"."Listing_normalizedPrice_idx";

-- DropIndex
DROP INDEX "public"."Listing_source_idx";

-- DropIndex
DROP INDEX "public"."PostQueue_scheduledAt_idx";

-- DropIndex
DROP INDEX "public"."Signal_cardId_createdAt_idx";

-- DropIndex
DROP INDEX "public"."Signal_createdAt_idx";

-- DropIndex
DROP INDEX "public"."Signal_edgeBp_createdAt_idx";

-- DropIndex
DROP INDEX "public"."WatchlistItem_cardId_idx";

-- DropIndex
DROP INDEX "public"."WatchlistItem_userId_cardId_key";

-- AlterTable
ALTER TABLE "public"."Card" DROP COLUMN "cardNumber",
DROP COLUMN "category",
DROP COLUMN "cleanedName",
DROP COLUMN "rarityWeight",
DROP COLUMN "set",
DROP COLUMN "variantKey",
ADD COLUMN     "isValidated" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lastValidated" TIMESTAMP(3),
ADD COLUMN     "validationScore" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
ALTER COLUMN "name" SET DATA TYPE VARCHAR(255),
ALTER COLUMN "number" SET DATA TYPE VARCHAR(10),
ALTER COLUMN "variant" SET DATA TYPE VARCHAR(100),
ALTER COLUMN "grade" SET DATA TYPE VARCHAR(20),
ALTER COLUMN "condition" SET DATA TYPE VARCHAR(50),
ALTER COLUMN "language" SET DEFAULT 'EN',
ALTER COLUMN "language" SET DATA TYPE VARCHAR(10),
ALTER COLUMN "normalizedName" SET NOT NULL,
ALTER COLUMN "normalizedName" SET DATA TYPE VARCHAR(255),
ALTER COLUMN "setCode" SET NOT NULL,
ALTER COLUMN "setCode" SET DATA TYPE VARCHAR(50),
ALTER COLUMN "rarity" SET DATA TYPE VARCHAR(50),
ALTER COLUMN "cardKey" SET NOT NULL,
ALTER COLUMN "cardKey" SET DATA TYPE VARCHAR(100),
ALTER COLUMN "cardType" SET NOT NULL,
ALTER COLUMN "cardType" SET DEFAULT 'Pokemon',
ALTER COLUMN "cardType" SET DATA TYPE VARCHAR(50);

-- AlterTable
ALTER TABLE "public"."CompSale" DROP COLUMN "createdAt",
DROP COLUMN "externalId",
DROP COLUMN "priceCentsUsd",
DROP COLUMN "raw",
ADD COLUMN     "condition" VARCHAR(50),
ADD COLUMN     "grade" VARCHAR(20),
ADD COLUMN     "isVerified" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "currency" SET DEFAULT 'USD',
ALTER COLUMN "currency" SET DATA TYPE VARCHAR(3),
ALTER COLUMN "source" SET DATA TYPE VARCHAR(50);

-- AlterTable
ALTER TABLE "public"."DataQuality" DROP COLUMN "accuracy",
DROP COLUMN "cardId",
DROP COLUMN "completeness",
DROP COLUMN "consistency",
DROP COLUMN "createdAt",
DROP COLUMN "freshness",
DROP COLUMN "listingId",
DROP COLUMN "resolved",
DROP COLUMN "resolvedAt",
DROP COLUMN "resolvedBy",
DROP COLUMN "severity",
ADD COLUMN     "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "entityId" VARCHAR(100) NOT NULL,
ADD COLUMN     "entityType" VARCHAR(50) NOT NULL,
ADD COLUMN     "isValid" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "qualityScore" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "recommendations" TEXT[] DEFAULT ARRAY[]::TEXT[],
DROP COLUMN "issues",
ADD COLUMN     "issues" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "public"."Evaluation" ALTER COLUMN "riskLevel" SET DATA TYPE VARCHAR(20);

-- AlterTable
ALTER TABLE "public"."Listing" DROP COLUMN "bidCount",
DROP COLUMN "description",
DROP COLUMN "directLowPrice",
DROP COLUMN "endTime",
DROP COLUMN "highPrice",
DROP COLUMN "imageUrl",
DROP COLUMN "listingType",
DROP COLUMN "lowPrice",
DROP COLUMN "marketPrice",
DROP COLUMN "marketplace",
DROP COLUMN "midPrice",
DROP COLUMN "normalizedPrice",
DROP COLUMN "stock",
DROP COLUMN "watchers",
ADD COLUMN     "isVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lastSeen" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN "source" SET DATA TYPE VARCHAR(50),
ALTER COLUMN "currency" SET DATA TYPE VARCHAR(3),
ALTER COLUMN "url" SET DATA TYPE VARCHAR(500),
ALTER COLUMN "seller" SET DATA TYPE VARCHAR(255),
ALTER COLUMN "condition" SET DATA TYPE VARCHAR(50),
ALTER COLUMN "grade" SET DATA TYPE VARCHAR(20),
ALTER COLUMN "externalId" SET NOT NULL,
ALTER COLUMN "externalId" SET DATA TYPE VARCHAR(100),
ALTER COLUMN "shippingPrice" SET DEFAULT 0.0;

-- AlterTable
ALTER TABLE "public"."MarketListing" DROP COLUMN "priceCentsUsd",
ADD COLUMN     "seller" VARCHAR(255),
ADD COLUMN     "shippingCents" INTEGER DEFAULT 0,
ALTER COLUMN "source" SET DATA TYPE VARCHAR(50),
ALTER COLUMN "sourceId" SET DATA TYPE VARCHAR(100),
ALTER COLUMN "currency" SET DEFAULT 'USD',
ALTER COLUMN "currency" SET DATA TYPE VARCHAR(3),
ALTER COLUMN "condition" DROP NOT NULL,
ALTER COLUMN "condition" SET DATA TYPE VARCHAR(50),
ALTER COLUMN "grade" SET DATA TYPE VARCHAR(20),
ALTER COLUMN "url" SET DATA TYPE VARCHAR(500);

-- AlterTable
ALTER TABLE "public"."Opportunity" ADD COLUMN     "isValidated" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "validationErrors" TEXT[] DEFAULT ARRAY[]::TEXT[],
ALTER COLUMN "sourceBuy" SET DATA TYPE VARCHAR(50),
ALTER COLUMN "sourceSell" SET DATA TYPE VARCHAR(50);

-- AlterTable
ALTER TABLE "public"."PostQueue" DROP COLUMN "createdAt",
DROP COLUMN "signalId",
ADD COLUMN     "postedAt" TIMESTAMP(3),
ALTER COLUMN "status" SET DATA TYPE VARCHAR(20);

-- AlterTable
ALTER TABLE "public"."Signal" DROP COLUMN "kind",
ADD COLUMN     "isValidated" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "status" VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "listingId" SET NOT NULL,
ALTER COLUMN "thesis" DROP DEFAULT;

-- AlterTable
ALTER TABLE "public"."User" ALTER COLUMN "username" SET DATA TYPE VARCHAR(255),
ALTER COLUMN "firstName" SET DATA TYPE VARCHAR(255),
ALTER COLUMN "lastName" SET DATA TYPE VARCHAR(255),
ALTER COLUMN "referralCode" SET DATA TYPE VARCHAR(50),
ALTER COLUMN "referredBy" SET DATA TYPE VARCHAR(50);

-- DropTable
DROP TABLE "public"."AuditLog";

-- DropTable
DROP TABLE "public"."Comp";

-- DropTable
DROP TABLE "public"."DataSource";

-- DropTable
DROP TABLE "public"."FeatureSnapshot";

-- DropTable
DROP TABLE "public"."FxRate";

-- DropTable
DROP TABLE "public"."MarketData";

-- DropTable
DROP TABLE "public"."ModelInsight";

-- DropTable
DROP TABLE "public"."PriceCache";

-- DropTable
DROP TABLE "public"."PriceSnapshot";

-- DropTable
DROP TABLE "public"."ProcessingJob";

-- DropTable
DROP TABLE "public"."Purchase";

-- DropTable
DROP TABLE "public"."RawImport";

-- DropTable
DROP TABLE "public"."ReferralEvent";

-- DropTable
DROP TABLE "public"."SourceCatalogItem";

-- DropTable
DROP TABLE "public"."TitleParseCache";

-- CreateTable
CREATE TABLE "public"."CardSet" (
    "id" TEXT NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "year" INTEGER,
    "totalCards" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "CardSet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."UnifiedMarketListing" (
    "id" VARCHAR(191) NOT NULL,
    "source" "public"."MarketSource" NOT NULL,
    "sourceId" VARCHAR(100) NOT NULL,
    "title" VARCHAR(500) NOT NULL,
    "rawTitle" VARCHAR(500) NOT NULL,
    "cardName" VARCHAR(255),
    "setName" VARCHAR(255),
    "cardNumber" VARCHAR(10),
    "variant" VARCHAR(100),
    "gradeCompany" "public"."GradeCompany",
    "grade" DOUBLE PRECISION,
    "condition" VARCHAR(50),
    "priceCents" INTEGER NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'USD',
    "shippingCents" INTEGER DEFAULT 0,
    "location" VARCHAR(255),
    "listedAt" TIMESTAMP(3),
    "url" VARCHAR(500),
    "dataQuality" DOUBLE PRECISION DEFAULT 0.0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UnifiedMarketListing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PortfolioCollection" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "slug" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PortfolioCollection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."UnifiedPortfolioItem" (
    "id" TEXT NOT NULL,
    "collectionId" TEXT NOT NULL,
    "listingId" VARCHAR(191) NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "UnifiedPortfolioItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."UnifiedArbitrageOpportunity" (
    "id" TEXT NOT NULL,
    "listingId" VARCHAR(191) NOT NULL,
    "source" "public"."MarketSource" NOT NULL,
    "expectedResaleCents" INTEGER NOT NULL,
    "expectedFeesCents" INTEGER NOT NULL,
    "expectedShippingCents" INTEGER NOT NULL,
    "netProfitCents" INTEGER NOT NULL,
    "marginPct" DOUBLE PRECISION NOT NULL,
    "liquidity" "public"."LiquidityLevel" NOT NULL,
    "velocity" DOUBLE PRECISION NOT NULL,
    "demand" "public"."DemandTrend" NOT NULL,
    "volatility" DOUBLE PRECISION NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "risk" "public"."RiskLevel" NOT NULL,
    "collectionTags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UnifiedArbitrageOpportunity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CrossReferenceData" (
    "id" TEXT NOT NULL,
    "listingId" VARCHAR(191) NOT NULL,
    "pokemonTcgId" VARCHAR(100),
    "tcgPlayerData" JSONB,
    "matchConfidence" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "matchType" VARCHAR(20) NOT NULL,
    "discrepancies" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CrossReferenceData_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PipelineExecution" (
    "id" TEXT NOT NULL,
    "sources" TEXT[],
    "mode" VARCHAR(20) NOT NULL,
    "totalListings" INTEGER NOT NULL DEFAULT 0,
    "totalOpportunities" INTEGER NOT NULL DEFAULT 0,
    "totalProfitPotential" INTEGER NOT NULL DEFAULT 0,
    "duration" INTEGER NOT NULL DEFAULT 0,
    "status" VARCHAR(20) NOT NULL DEFAULT 'RUNNING',
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "PipelineExecution_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CardSet_code_key" ON "public"."CardSet"("code");

-- CreateIndex
CREATE INDEX "CardSet_code_idx" ON "public"."CardSet"("code");

-- CreateIndex
CREATE INDEX "CardSet_year_idx" ON "public"."CardSet"("year");

-- CreateIndex
CREATE INDEX "UnifiedMarketListing_cardName_idx" ON "public"."UnifiedMarketListing"("cardName");

-- CreateIndex
CREATE INDEX "UnifiedMarketListing_setName_cardNumber_idx" ON "public"."UnifiedMarketListing"("setName", "cardNumber");

-- CreateIndex
CREATE INDEX "UnifiedMarketListing_gradeCompany_grade_idx" ON "public"."UnifiedMarketListing"("gradeCompany", "grade");

-- CreateIndex
CREATE INDEX "UnifiedMarketListing_priceCents_idx" ON "public"."UnifiedMarketListing"("priceCents");

-- CreateIndex
CREATE INDEX "UnifiedMarketListing_dataQuality_idx" ON "public"."UnifiedMarketListing"("dataQuality");

-- CreateIndex
CREATE INDEX "UnifiedMarketListing_source_idx" ON "public"."UnifiedMarketListing"("source");

-- CreateIndex
CREATE INDEX "UnifiedMarketListing_createdAt_idx" ON "public"."UnifiedMarketListing"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "UnifiedMarketListing_source_sourceId_key" ON "public"."UnifiedMarketListing"("source", "sourceId");

-- CreateIndex
CREATE UNIQUE INDEX "PortfolioCollection_slug_key" ON "public"."PortfolioCollection"("slug");

-- CreateIndex
CREATE INDEX "PortfolioCollection_slug_idx" ON "public"."PortfolioCollection"("slug");

-- CreateIndex
CREATE INDEX "UnifiedPortfolioItem_collectionId_idx" ON "public"."UnifiedPortfolioItem"("collectionId");

-- CreateIndex
CREATE INDEX "UnifiedPortfolioItem_listingId_idx" ON "public"."UnifiedPortfolioItem"("listingId");

-- CreateIndex
CREATE INDEX "UnifiedPortfolioItem_addedAt_idx" ON "public"."UnifiedPortfolioItem"("addedAt");

-- CreateIndex
CREATE UNIQUE INDEX "UnifiedPortfolioItem_collectionId_listingId_key" ON "public"."UnifiedPortfolioItem"("collectionId", "listingId");

-- CreateIndex
CREATE INDEX "UnifiedArbitrageOpportunity_listingId_idx" ON "public"."UnifiedArbitrageOpportunity"("listingId");

-- CreateIndex
CREATE INDEX "UnifiedArbitrageOpportunity_createdAt_idx" ON "public"."UnifiedArbitrageOpportunity"("createdAt");

-- CreateIndex
CREATE INDEX "UnifiedArbitrageOpportunity_marginPct_confidence_idx" ON "public"."UnifiedArbitrageOpportunity"("marginPct", "confidence");

-- CreateIndex
CREATE INDEX "UnifiedArbitrageOpportunity_risk_idx" ON "public"."UnifiedArbitrageOpportunity"("risk");

-- CreateIndex
CREATE INDEX "UnifiedArbitrageOpportunity_liquidity_idx" ON "public"."UnifiedArbitrageOpportunity"("liquidity");

-- CreateIndex
CREATE INDEX "UnifiedArbitrageOpportunity_netProfitCents_idx" ON "public"."UnifiedArbitrageOpportunity"("netProfitCents");

-- CreateIndex
CREATE INDEX "CrossReferenceData_pokemonTcgId_idx" ON "public"."CrossReferenceData"("pokemonTcgId");

-- CreateIndex
CREATE INDEX "CrossReferenceData_matchConfidence_idx" ON "public"."CrossReferenceData"("matchConfidence");

-- CreateIndex
CREATE INDEX "CrossReferenceData_matchType_idx" ON "public"."CrossReferenceData"("matchType");

-- CreateIndex
CREATE UNIQUE INDEX "CrossReferenceData_listingId_key" ON "public"."CrossReferenceData"("listingId");

-- CreateIndex
CREATE INDEX "PipelineExecution_status_createdAt_idx" ON "public"."PipelineExecution"("status", "createdAt");

-- CreateIndex
CREATE INDEX "PipelineExecution_sources_idx" ON "public"."PipelineExecution"("sources");

-- CreateIndex
CREATE INDEX "PipelineExecution_mode_idx" ON "public"."PipelineExecution"("mode");

-- CreateIndex
CREATE UNIQUE INDEX "Card_cardKey_key" ON "public"."Card"("cardKey");

-- CreateIndex
CREATE INDEX "Card_normalizedName_idx" ON "public"."Card"("normalizedName");

-- CreateIndex
CREATE INDEX "Card_setCode_number_idx" ON "public"."Card"("setCode", "number");

-- CreateIndex
CREATE INDEX "Card_isValidated_validationScore_idx" ON "public"."Card"("isValidated", "validationScore");

-- CreateIndex
CREATE UNIQUE INDEX "Card_setCode_number_variant_grade_language_key" ON "public"."Card"("setCode", "number", "variant", "grade", "language");

-- CreateIndex
CREATE INDEX "CompSale_cardId_idx" ON "public"."CompSale"("cardId");

-- CreateIndex
CREATE INDEX "CompSale_source_idx" ON "public"."CompSale"("source");

-- CreateIndex
CREATE INDEX "CompSale_soldAt_idx" ON "public"."CompSale"("soldAt");

-- CreateIndex
CREATE INDEX "CompSale_priceCents_idx" ON "public"."CompSale"("priceCents");

-- CreateIndex
CREATE INDEX "DataQuality_entityType_entityId_idx" ON "public"."DataQuality"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "DataQuality_qualityScore_idx" ON "public"."DataQuality"("qualityScore");

-- CreateIndex
CREATE INDEX "DataQuality_isValid_idx" ON "public"."DataQuality"("isValid");

-- CreateIndex
CREATE INDEX "DataQuality_checkedAt_idx" ON "public"."DataQuality"("checkedAt");

-- CreateIndex
CREATE INDEX "Evaluation_cardId_idx" ON "public"."Evaluation"("cardId");

-- CreateIndex
CREATE INDEX "Evaluation_confidence_idx" ON "public"."Evaluation"("confidence");

-- CreateIndex
CREATE INDEX "Evaluation_createdAt_idx" ON "public"."Evaluation"("createdAt");

-- CreateIndex
CREATE INDEX "Listing_cardId_idx" ON "public"."Listing"("cardId");

-- CreateIndex
CREATE INDEX "Listing_source_isActive_idx" ON "public"."Listing"("source", "isActive");

-- CreateIndex
CREATE INDEX "Listing_price_idx" ON "public"."Listing"("price");

-- CreateIndex
CREATE INDEX "Listing_scrapedAt_idx" ON "public"."Listing"("scrapedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Listing_source_externalId_key" ON "public"."Listing"("source", "externalId");

-- CreateIndex
CREATE INDEX "MarketListing_source_isActive_idx" ON "public"."MarketListing"("source", "isActive");

-- CreateIndex
CREATE INDEX "MarketListing_priceCents_idx" ON "public"."MarketListing"("priceCents");

-- CreateIndex
CREATE INDEX "Opportunity_netSpreadBps_idx" ON "public"."Opportunity"("netSpreadBps");

-- CreateIndex
CREATE INDEX "Opportunity_confidence_idx" ON "public"."Opportunity"("confidence");

-- CreateIndex
CREATE INDEX "PostQueue_status_scheduledAt_idx" ON "public"."PostQueue"("status", "scheduledAt");

-- CreateIndex
CREATE INDEX "Signal_edgeBp_idx" ON "public"."Signal"("edgeBp");

-- CreateIndex
CREATE INDEX "Signal_confidence_idx" ON "public"."Signal"("confidence");

-- CreateIndex
CREATE INDEX "Signal_status_idx" ON "public"."Signal"("status");

-- CreateIndex
CREATE INDEX "User_telegramId_idx" ON "public"."User"("telegramId");

-- CreateIndex
CREATE INDEX "User_referralCode_idx" ON "public"."User"("referralCode");

-- CreateIndex
CREATE UNIQUE INDEX "WatchlistItem_cardId_userId_key" ON "public"."WatchlistItem"("cardId", "userId");

-- AddForeignKey
ALTER TABLE "public"."Card" ADD CONSTRAINT "Card_setCode_fkey" FOREIGN KEY ("setCode") REFERENCES "public"."CardSet"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Listing" ADD CONSTRAINT "Listing_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "public"."Card"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MarketListing" ADD CONSTRAINT "MarketListing_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "public"."Card"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CompSale" ADD CONSTRAINT "CompSale_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "public"."Card"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Opportunity" ADD CONSTRAINT "Opportunity_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "public"."Card"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Opportunity" ADD CONSTRAINT "Opportunity_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "public"."MarketListing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Signal" ADD CONSTRAINT "Signal_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "public"."Card"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Signal" ADD CONSTRAINT "Signal_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "public"."MarketListing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DataQuality" ADD CONSTRAINT "DataQuality_card_fkey" FOREIGN KEY ("entityId") REFERENCES "public"."Card"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DataQuality" ADD CONSTRAINT "DataQuality_listing_fkey" FOREIGN KEY ("entityId") REFERENCES "public"."Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Evaluation" ADD CONSTRAINT "Evaluation_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "public"."Card"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Evaluation" ADD CONSTRAINT "Evaluation_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "public"."Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."WatchlistItem" ADD CONSTRAINT "WatchlistItem_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "public"."Card"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."UnifiedPortfolioItem" ADD CONSTRAINT "UnifiedPortfolioItem_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "public"."PortfolioCollection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."UnifiedPortfolioItem" ADD CONSTRAINT "UnifiedPortfolioItem_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "public"."UnifiedMarketListing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."UnifiedArbitrageOpportunity" ADD CONSTRAINT "UnifiedArbitrageOpportunity_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "public"."UnifiedMarketListing"("id") ON DELETE CASCADE ON UPDATE CASCADE;
