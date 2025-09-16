#!/usr/bin/env ts-node
/**
 * Automated Pipeline Runner
 * Runs the unified market pipeline on a schedule with comprehensive reporting
 */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var PrismaClient = require('@prisma/client').PrismaClient;
var fs = require('fs').promises;
var path = require('path');
var prisma = new PrismaClient();
function runAutomatedPipeline() {
    return __awaiter(this, void 0, void 0, function () {
        var stats, qualityStats, arbitrageStats, collectionStats, cleanupStats, error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    stats = {
                        startTime: new Date(),
                        sourcesProcessed: [],
                        totalListings: 0,
                        newListings: 0,
                        totalOpportunities: 0,
                        newOpportunities: 0,
                        totalProfitPotential: 0,
                        collectionsUpdated: [],
                        errors: [],
                        status: 'RUNNING'
                    };
                    console.log('🤖 Automated Market Pipeline');
                    console.log('============================');
                    console.log("Started at: ".concat(stats.startTime.toISOString(), "\n"));
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 8, 10, 12]);
                    // Step 1: Data Quality Check
                    console.log('1. Running data quality assessment...');
                    return [4 /*yield*/, assessDataQuality()];
                case 2:
                    qualityStats = _a.sent();
                    console.log("   \u2705 Data quality check completed");
                    console.log("   \u2022 Total listings: ".concat(qualityStats.totalListings));
                    console.log("   \u2022 Average quality score: ".concat(qualityStats.avgQuality.toFixed(2)));
                    console.log("   \u2022 Low quality listings: ".concat(qualityStats.lowQualityCount, "\n"));
                    // Step 2: Update Arbitrage Opportunities
                    console.log('2. Updating arbitrage opportunities...');
                    return [4 /*yield*/, updateArbitrageOpportunities()];
                case 3:
                    arbitrageStats = _a.sent();
                    stats.totalOpportunities = arbitrageStats.total;
                    stats.newOpportunities = arbitrageStats.new;
                    stats.totalProfitPotential = arbitrageStats.totalProfit;
                    console.log("   \u2705 Found ".concat(arbitrageStats.new, " new opportunities"));
                    console.log("   \u2022 Total profit potential: $".concat((arbitrageStats.totalProfit / 100).toFixed(2)));
                    console.log("   \u2022 High confidence opportunities: ".concat(arbitrageStats.highConfidence, "\n"));
                    // Step 3: Update Portfolio Collections
                    console.log('3. Updating portfolio collections...');
                    return [4 /*yield*/, updatePortfolioCollections()];
                case 4:
                    collectionStats = _a.sent();
                    stats.collectionsUpdated = collectionStats.updated;
                    console.log("   \u2705 Updated ".concat(collectionStats.updated.length, " collections\n"));
                    // Step 4: Generate Reports
                    console.log('4. Generating reports...');
                    return [4 /*yield*/, generateReports(stats)];
                case 5:
                    _a.sent();
                    console.log("   \u2705 Reports generated in ./reports/ directory\n");
                    // Step 5: Cleanup Old Data
                    console.log('5. Cleaning up old data...');
                    return [4 /*yield*/, cleanupOldData()];
                case 6:
                    cleanupStats = _a.sent();
                    console.log("   \u2705 Cleaned up ".concat(cleanupStats.deletedListings, " old listings"));
                    console.log("   \u2705 Cleaned up ".concat(cleanupStats.deletedOpportunities, " old opportunities\n"));
                    stats.status = 'COMPLETED';
                    stats.endTime = new Date();
                    console.log('✅ Automated pipeline completed successfully!');
                    console.log("Duration: ".concat(Math.round((stats.endTime.getTime() - stats.startTime.getTime()) / 1000), "s\n"));
                    // Log execution to database
                    return [4 /*yield*/, prisma.pipelineExecution.create({
                            data: {
                                sources: ['ebay'],
                                mode: 'default',
                                totalListings: stats.totalListings,
                                totalOpportunities: stats.totalOpportunities,
                                totalProfitPotential: stats.totalProfitPotential,
                                duration: stats.endTime.getTime() - stats.startTime.getTime(),
                                status: 'COMPLETED'
                            }
                        })];
                case 7:
                    // Log execution to database
                    _a.sent();
                    return [3 /*break*/, 12];
                case 8:
                    error_1 = _a.sent();
                    stats.status = 'FAILED';
                    stats.errors.push(error_1.message);
                    console.error('❌ Pipeline failed:', error_1);
                    return [4 /*yield*/, prisma.pipelineExecution.create({
                            data: {
                                sources: ['ebay'],
                                mode: 'default',
                                totalListings: stats.totalListings,
                                totalOpportunities: stats.totalOpportunities,
                                totalProfitPotential: stats.totalProfitPotential,
                                duration: Date.now() - stats.startTime.getTime(),
                                status: 'FAILED',
                                errorMessage: error_1.message
                            }
                        })];
                case 9:
                    _a.sent();
                    process.exit(1);
                    return [3 /*break*/, 12];
                case 10: return [4 /*yield*/, prisma.$disconnect()];
                case 11:
                    _a.sent();
                    return [7 /*endfinally*/];
                case 12: return [2 /*return*/];
            }
        });
    });
}
function assessDataQuality() {
    return __awaiter(this, void 0, void 0, function () {
        var listings, totalListings, avgQuality, lowQualityCount;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, prisma.unifiedMarketListing.findMany({
                        select: { dataQuality: true }
                    })];
                case 1:
                    listings = _a.sent();
                    totalListings = listings.length;
                    avgQuality = listings.reduce(function (sum, l) { return sum + (l.dataQuality || 0); }, 0) / totalListings;
                    lowQualityCount = listings.filter(function (l) { return (l.dataQuality || 0) < 0.5; }).length;
                    return [2 /*return*/, { totalListings: totalListings, avgQuality: avgQuality, lowQualityCount: lowQualityCount }];
            }
        });
    });
}
function updateArbitrageOpportunities() {
    return __awaiter(this, void 0, void 0, function () {
        var listingsWithoutOpps, newOpportunities, totalProfit, highConfidence, _i, listingsWithoutOpps_1, listing, expectedResale, fees, shipping, netProfit, margin, confidence, total;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, prisma.unifiedMarketListing.findMany({
                        where: {
                            arbitrageOpportunities: { none: {} },
                            priceCents: { gte: 1000 } // At least $10
                        },
                        take: 50
                    })];
                case 1:
                    listingsWithoutOpps = _a.sent();
                    newOpportunities = 0;
                    totalProfit = 0;
                    highConfidence = 0;
                    _i = 0, listingsWithoutOpps_1 = listingsWithoutOpps;
                    _a.label = 2;
                case 2:
                    if (!(_i < listingsWithoutOpps_1.length)) return [3 /*break*/, 5];
                    listing = listingsWithoutOpps_1[_i];
                    expectedResale = Math.round(listing.priceCents * (1.1 + Math.random() * 0.2));
                    fees = Math.round(expectedResale * 0.03);
                    shipping = 500;
                    netProfit = expectedResale - listing.priceCents - fees - shipping;
                    margin = (netProfit / listing.priceCents) * 100;
                    confidence = Math.random() * 0.4 + 0.6;
                    if (!(netProfit > 0 && margin > 5)) return [3 /*break*/, 4];
                    return [4 /*yield*/, prisma.unifiedArbitrageOpportunity.create({
                            data: {
                                listingId: listing.id,
                                source: listing.source,
                                expectedResaleCents: expectedResale,
                                expectedFeesCents: fees,
                                expectedShippingCents: shipping,
                                netProfitCents: netProfit,
                                marginPct: margin,
                                liquidity: margin > 15 ? 'HIGH' : margin > 8 ? 'MEDIUM' : 'LOW',
                                velocity: Math.random() * 0.5 + 0.5,
                                demand: 'STABLE',
                                volatility: Math.random() * 0.3 + 0.1,
                                confidence: confidence,
                                risk: margin > 15 ? 'LOW' : margin > 8 ? 'MEDIUM' : 'HIGH',
                                collectionTags: []
                            }
                        })];
                case 3:
                    _a.sent();
                    newOpportunities++;
                    totalProfit += netProfit;
                    if (confidence > 0.8)
                        highConfidence++;
                    _a.label = 4;
                case 4:
                    _i++;
                    return [3 /*break*/, 2];
                case 5: return [4 /*yield*/, prisma.unifiedArbitrageOpportunity.count()];
                case 6:
                    total = _a.sent();
                    return [2 /*return*/, { total: total, new: newOpportunities, totalProfit: totalProfit, highConfidence: highConfidence }];
            }
        });
    });
}
function updatePortfolioCollections() {
    return __awaiter(this, void 0, void 0, function () {
        var collections, updated, _i, collections_1, collection, updatedThisRun, highMarginOpps, _a, highMarginOpps_1, opp;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, prisma.portfolioCollection.findMany()];
                case 1:
                    collections = _b.sent();
                    updated = [];
                    _i = 0, collections_1 = collections;
                    _b.label = 2;
                case 2:
                    if (!(_i < collections_1.length)) return [3 /*break*/, 9];
                    collection = collections_1[_i];
                    updatedThisRun = false;
                    if (!(collection.slug === 'flip-queue')) return [3 /*break*/, 7];
                    return [4 /*yield*/, prisma.unifiedArbitrageOpportunity.findMany({
                            where: {
                                marginPct: { gte: 12 },
                                confidence: { gte: 0.75 },
                                risk: 'LOW'
                            },
                            take: 10,
                            include: { listing: true }
                        })];
                case 3:
                    highMarginOpps = _b.sent();
                    _a = 0, highMarginOpps_1 = highMarginOpps;
                    _b.label = 4;
                case 4:
                    if (!(_a < highMarginOpps_1.length)) return [3 /*break*/, 7];
                    opp = highMarginOpps_1[_a];
                    return [4 /*yield*/, prisma.unifiedPortfolioItem.upsert({
                            where: {
                                collectionId_listingId: {
                                    collectionId: collection.id,
                                    listingId: opp.listingId
                                }
                            },
                            update: {},
                            create: {
                                collectionId: collection.id,
                                listingId: opp.listingId,
                                tags: ['auto-added', 'high-margin']
                            }
                        })];
                case 5:
                    _b.sent();
                    updatedThisRun = true;
                    _b.label = 6;
                case 6:
                    _a++;
                    return [3 /*break*/, 4];
                case 7:
                    if (updatedThisRun) {
                        updated.push(collection.name);
                    }
                    _b.label = 8;
                case 8:
                    _i++;
                    return [3 /*break*/, 2];
                case 9: return [2 /*return*/, { updated: updated }];
            }
        });
    });
}
function generateReports(stats) {
    return __awaiter(this, void 0, void 0, function () {
        var reportsDir, timestamp, summaryReport, opportunities;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    reportsDir = path.join(__dirname, '../reports');
                    return [4 /*yield*/, fs.mkdir(reportsDir, { recursive: true })];
                case 1:
                    _a.sent();
                    timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                    summaryReport = {
                        timestamp: stats.startTime.toISOString(),
                        duration: stats.endTime ? stats.endTime.getTime() - stats.startTime.getTime() : null,
                        status: stats.status,
                        statistics: {
                            totalListings: stats.totalListings,
                            newOpportunities: stats.newOpportunities,
                            totalProfitPotential: stats.totalProfitPotential,
                            collectionsUpdated: stats.collectionsUpdated.length
                        },
                        errors: stats.errors
                    };
                    return [4 /*yield*/, fs.writeFile(path.join(reportsDir, "pipeline-summary-".concat(timestamp, ".json")), JSON.stringify(summaryReport, null, 2))];
                case 2:
                    _a.sent();
                    return [4 /*yield*/, prisma.unifiedArbitrageOpportunity.findMany({
                            where: { confidence: { gte: 0.8 } },
                            include: { listing: true },
                            orderBy: { netProfitCents: 'desc' },
                            take: 50
                        })];
                case 3:
                    opportunities = _a.sent();
                    return [4 /*yield*/, fs.writeFile(path.join(reportsDir, "top-opportunities-".concat(timestamp, ".json")), JSON.stringify(opportunities, null, 2))];
                case 4:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
function cleanupOldData() {
    return __awaiter(this, void 0, void 0, function () {
        var cutoffDate, deletedOpportunities, deletedListings;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    cutoffDate = new Date();
                    cutoffDate.setDate(cutoffDate.getDate() - 30); // 30 days ago
                    return [4 /*yield*/, prisma.unifiedArbitrageOpportunity.deleteMany({
                            where: {
                                confidence: { lt: 0.5 },
                                createdAt: { lt: cutoffDate }
                            }
                        })];
                case 1:
                    deletedOpportunities = _a.sent();
                    return [4 /*yield*/, prisma.unifiedMarketListing.deleteMany({
                            where: {
                                dataQuality: { lt: 0.3 },
                                createdAt: { lt: cutoffDate }
                            }
                        })];
                case 2:
                    deletedListings = _a.sent();
                    return [2 /*return*/, {
                            deletedListings: deletedListings.count,
                            deletedOpportunities: deletedOpportunities.count
                        }];
            }
        });
    });
}
// Run the automated pipeline
runAutomatedPipeline().catch(console.error);
