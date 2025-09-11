/*
  Warnings:

  - A unique constraint covering the columns `[userId,cardId]` on the table `WatchlistItem` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateTable
CREATE TABLE "public"."DataSource" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastScrapedAt" TIMESTAMP(3),
    "totalRecords" INTEGER NOT NULL DEFAULT 0,
    "successRate" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "avgResponseTime" INTEGER,
    "lastErrorAt" TIMESTAMP(3),
    "lastErrorMsg" TEXT,
    "consecutiveErrors" INTEGER NOT NULL DEFAULT 0,
    "rateLimit" INTEGER NOT NULL DEFAULT 1000,
    "timeout" INTEGER NOT NULL DEFAULT 30,

    CONSTRAINT "DataSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ProcessingJob" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "jobType" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "batchSize" INTEGER,
    "recordsProcessed" INTEGER NOT NULL DEFAULT 0,
    "recordsTotal" INTEGER,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "lastErrorAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "inputData" JSONB,
    "outputData" JSONB,

    CONSTRAINT "ProcessingJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."DataQuality" (
    "id" TEXT NOT NULL,
    "cardId" TEXT,
    "listingId" TEXT,
    "completeness" DOUBLE PRECISION NOT NULL,
    "accuracy" DOUBLE PRECISION NOT NULL,
    "consistency" DOUBLE PRECISION NOT NULL,
    "freshness" DOUBLE PRECISION NOT NULL,
    "issues" JSONB,
    "severity" TEXT NOT NULL,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "resolvedAt" TIMESTAMP(3),
    "resolvedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DataQuality_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AuditLog" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "oldValues" JSONB,
    "newValues" JSONB,
    "changes" JSONB,
    "userId" TEXT,
    "jobId" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DataSource_name_key" ON "public"."DataSource"("name");

-- CreateIndex
CREATE INDEX "DataSource_isActive_idx" ON "public"."DataSource"("isActive");

-- CreateIndex
CREATE INDEX "DataSource_lastScrapedAt_idx" ON "public"."DataSource"("lastScrapedAt");

-- CreateIndex
CREATE INDEX "DataSource_successRate_idx" ON "public"."DataSource"("successRate");

-- CreateIndex
CREATE INDEX "ProcessingJob_status_priority_idx" ON "public"."ProcessingJob"("status", "priority");

-- CreateIndex
CREATE INDEX "ProcessingJob_jobType_status_idx" ON "public"."ProcessingJob"("jobType", "status");

-- CreateIndex
CREATE INDEX "ProcessingJob_startedAt_idx" ON "public"."ProcessingJob"("startedAt");

-- CreateIndex
CREATE INDEX "ProcessingJob_sourceId_status_idx" ON "public"."ProcessingJob"("sourceId", "status");

-- CreateIndex
CREATE INDEX "DataQuality_severity_resolved_idx" ON "public"."DataQuality"("severity", "resolved");

-- CreateIndex
CREATE INDEX "DataQuality_completeness_idx" ON "public"."DataQuality"("completeness");

-- CreateIndex
CREATE INDEX "DataQuality_cardId_idx" ON "public"."DataQuality"("cardId");

-- CreateIndex
CREATE INDEX "DataQuality_createdAt_idx" ON "public"."DataQuality"("createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "public"."AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_action_timestamp_idx" ON "public"."AuditLog"("action", "timestamp");

-- CreateIndex
CREATE INDEX "AuditLog_sourceId_timestamp_idx" ON "public"."AuditLog"("sourceId", "timestamp");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "public"."AuditLog"("userId");

-- CreateIndex
CREATE INDEX "WatchlistItem_userId_idx" ON "public"."WatchlistItem"("userId");

-- CreateIndex
CREATE INDEX "WatchlistItem_cardId_idx" ON "public"."WatchlistItem"("cardId");

-- CreateIndex
CREATE UNIQUE INDEX "WatchlistItem_userId_cardId_key" ON "public"."WatchlistItem"("userId", "cardId");

-- AddForeignKey
ALTER TABLE "public"."ProcessingJob" ADD CONSTRAINT "ProcessingJob_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "public"."DataSource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DataQuality" ADD CONSTRAINT "DataQuality_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "public"."Card"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DataQuality" ADD CONSTRAINT "DataQuality_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "public"."Listing"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AuditLog" ADD CONSTRAINT "AuditLog_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "public"."DataSource"("id") ON DELETE SET NULL ON UPDATE CASCADE;
