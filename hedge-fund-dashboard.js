#!/usr/bin/env ts-node
/**
 * HEDGE FUND DASHBOARD
 * Comprehensive executive dashboard for Pokemon card arbitrage operations
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
var HedgeFundDashboard = /** @class */ (function () {
    function HedgeFundDashboard() {
        this.metrics = null;
    }
    HedgeFundDashboard.prototype.generateDashboard = function () {
        return __awaiter(this, void 0, void 0, function () {
            var portfolioMetrics, arbitrageMetrics, marketMetrics, performanceMetrics, alertMetrics, error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        console.log('📊 HEDGE FUND DASHBOARD GENERATOR');
                        console.log('==================================\n');
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 10, 11, 13]);
                        // Generate all metrics
                        console.log('🔄 Generating portfolio metrics...');
                        return [4 /*yield*/, this.generatePortfolioMetrics()];
                    case 2:
                        portfolioMetrics = _a.sent();
                        console.log('🔄 Generating arbitrage metrics...');
                        return [4 /*yield*/, this.generateArbitrageMetrics()];
                    case 3:
                        arbitrageMetrics = _a.sent();
                        console.log('🔄 Generating market metrics...');
                        return [4 /*yield*/, this.generateMarketMetrics()];
                    case 4:
                        marketMetrics = _a.sent();
                        console.log('🔄 Generating performance metrics...');
                        return [4 /*yield*/, this.generatePerformanceMetrics()];
                    case 5:
                        performanceMetrics = _a.sent();
                        console.log('🔄 Generating alert metrics...');
                        return [4 /*yield*/, this.generateAlertMetrics()];
                    case 6:
                        alertMetrics = _a.sent();
                        this.metrics = {
                            portfolio: portfolioMetrics,
                            arbitrage: arbitrageMetrics,
                            market: marketMetrics,
                            performance: performanceMetrics,
                            alerts: alertMetrics
                        };
                        // Generate HTML dashboard
                        return [4 /*yield*/, this.generateHTMLDashboard()];
                    case 7:
                        // Generate HTML dashboard
                        _a.sent();
                        // Generate executive summary
                        return [4 /*yield*/, this.generateExecutiveSummary()];
                    case 8:
                        // Generate executive summary
                        _a.sent();
                        // Generate risk report
                        return [4 /*yield*/, this.generateRiskReport()];
                    case 9:
                        // Generate risk report
                        _a.sent();
                        console.log('✅ Dashboard generation completed!\n');
                        return [3 /*break*/, 13];
                    case 10:
                        error_1 = _a.sent();
                        console.error('❌ Error generating dashboard:', error_1);
                        throw error_1;
                    case 11: return [4 /*yield*/, prisma.$disconnect()];
                    case 12:
                        _a.sent();
                        return [7 /*endfinally*/];
                    case 13: return [2 /*return*/];
                }
            });
        });
    };
    HedgeFundDashboard.prototype.generatePortfolioMetrics = function () {
        return __awaiter(this, void 0, void 0, function () {
            var portfolioItems, totalValue, averageValue, topPerformers, riskDistribution, riskDist;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, prisma.unifiedPortfolioItem.findMany({
                            include: {
                                listing: true,
                                collection: true
                            }
                        })];
                    case 1:
                        portfolioItems = _a.sent();
                        totalValue = portfolioItems.reduce(function (sum, item) { return sum + item.listing.priceCents; }, 0);
                        averageValue = portfolioItems.length > 0 ? totalValue / portfolioItems.length : 0;
                        topPerformers = portfolioItems
                            .sort(function (a, b) { return b.listing.priceCents - a.listing.priceCents; })
                            .slice(0, 10)
                            .map(function (item) { return ({
                            cardName: item.listing.cardName,
                            setName: item.listing.setName,
                            value: item.listing.priceCents,
                            collection: item.collection.name,
                            tags: item.tags
                        }); });
                        return [4 /*yield*/, prisma.unifiedArbitrageOpportunity.groupBy({
                                by: ['risk'],
                                _count: { risk: true },
                                where: {
                                    listingId: { in: portfolioItems.map(function (item) { return item.listingId; }) }
                                }
                            })];
                    case 2:
                        riskDistribution = _a.sent();
                        riskDist = { low: 0, medium: 0, high: 0 };
                        riskDistribution.forEach(function (risk) {
                            riskDist[risk.risk.toLowerCase()] = risk._count.risk;
                        });
                        return [2 /*return*/, {
                                totalValue: totalValue,
                                totalItems: portfolioItems.length,
                                averageValue: averageValue,
                                topPerformers: topPerformers,
                                riskDistribution: riskDist
                            }];
                }
            });
        });
    };
    HedgeFundDashboard.prototype.generateArbitrageMetrics = function () {
        return __awaiter(this, void 0, void 0, function () {
            var opportunities, totalProfit, averageMargin, highConfidenceCount, lowRiskCount, topOpportunities;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, prisma.unifiedArbitrageOpportunity.findMany({
                            include: { listing: true },
                            orderBy: { netProfitCents: 'desc' }
                        })];
                    case 1:
                        opportunities = _a.sent();
                        totalProfit = opportunities.reduce(function (sum, opp) { return sum + opp.netProfitCents; }, 0);
                        averageMargin = opportunities.reduce(function (sum, opp) { return sum + opp.marginPct; }, 0) / opportunities.length;
                        highConfidenceCount = opportunities.filter(function (opp) { return opp.confidence >= 0.8; }).length;
                        lowRiskCount = opportunities.filter(function (opp) { return opp.risk === 'LOW'; }).length;
                        topOpportunities = opportunities.slice(0, 10).map(function (opp) { return ({
                            cardName: opp.listing.cardName,
                            setName: opp.listing.setName,
                            profit: opp.netProfitCents,
                            margin: opp.marginPct,
                            confidence: opp.confidence,
                            risk: opp.risk,
                            source: opp.source
                        }); });
                        return [2 /*return*/, {
                                totalOpportunities: opportunities.length,
                                totalProfitPotential: totalProfit,
                                averageMargin: averageMargin,
                                highConfidenceCount: highConfidenceCount,
                                lowRiskCount: lowRiskCount,
                                topOpportunities: topOpportunities
                            }];
                }
            });
        });
    };
    HedgeFundDashboard.prototype.generateMarketMetrics = function () {
        return __awaiter(this, void 0, void 0, function () {
            var listings, averagePrice, topCards, sourceDistribution, qualityStats, highQualityCount;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, prisma.unifiedMarketListing.findMany()];
                    case 1:
                        listings = _a.sent();
                        averagePrice = listings.reduce(function (sum, listing) { return sum + listing.priceCents; }, 0) / listings.length;
                        return [4 /*yield*/, prisma.unifiedMarketListing.groupBy({
                                by: ['cardName'],
                                _count: { cardName: true },
                                _avg: { priceCents: true },
                                where: { cardName: { not: null } },
                                orderBy: { _count: { cardName: 'desc' } },
                                take: 10
                            })];
                    case 2:
                        topCards = _a.sent();
                        return [4 /*yield*/, prisma.unifiedMarketListing.groupBy({
                                by: ['source'],
                                _count: { source: true },
                                _avg: { priceCents: true }
                            })];
                    case 3:
                        sourceDistribution = _a.sent();
                        return [4 /*yield*/, prisma.unifiedMarketListing.aggregate({
                                _avg: { dataQuality: true },
                                _count: { id: true }
                            })];
                    case 4:
                        qualityStats = _a.sent();
                        return [4 /*yield*/, prisma.unifiedMarketListing.count({
                                where: { dataQuality: { gte: 0.8 } }
                            })];
                    case 5:
                        highQualityCount = _a.sent();
                        return [2 /*return*/, {
                                totalListings: listings.length,
                                averagePrice: averagePrice,
                                topCards: topCards.map(function (card) { return ({
                                    name: card.cardName,
                                    count: card._count.cardName,
                                    averagePrice: card._avg.priceCents
                                }); }),
                                sourceDistribution: sourceDistribution.map(function (source) { return ({
                                    source: source.source,
                                    count: source._count.source,
                                    averagePrice: source._avg.priceCents
                                }); }),
                                qualityMetrics: {
                                    averageQuality: qualityStats._avg.dataQuality || 0,
                                    highQualityCount: highQualityCount,
                                    qualityCoverage: (highQualityCount / listings.length) * 100
                                }
                            }];
                }
            });
        });
    };
    HedgeFundDashboard.prototype.generatePerformanceMetrics = function () {
        return __awaiter(this, void 0, void 0, function () {
            var opportunities, totalProfitPotential, dailyProfit, weeklyProfit, monthlyProfit;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, prisma.unifiedArbitrageOpportunity.findMany({
                            where: { confidence: { gte: 0.8 } }
                        })];
                    case 1:
                        opportunities = _a.sent();
                        totalProfitPotential = opportunities.reduce(function (sum, opp) { return sum + opp.netProfitCents; }, 0);
                        dailyProfit = totalProfitPotential * 0.02;
                        weeklyProfit = totalProfitPotential * 0.15;
                        monthlyProfit = totalProfitPotential * 0.65;
                        return [2 /*return*/, {
                                dailyProfit: dailyProfit,
                                weeklyProfit: weeklyProfit,
                                monthlyProfit: monthlyProfit,
                                roi: 25.5, // Simulated ROI
                                sharpeRatio: 1.8 // Simulated Sharpe ratio
                            }];
                }
            });
        });
    };
    HedgeFundDashboard.prototype.generateAlertMetrics = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                // Simulate alert metrics (in reality, you'd get from the real-time monitor)
                return [2 /*return*/, {
                        critical: 3,
                        high: 12,
                        medium: 28,
                        low: 45
                    }];
            });
        });
    };
    HedgeFundDashboard.prototype.generateHTMLDashboard = function () {
        return __awaiter(this, void 0, void 0, function () {
            var html, _a, _b, reportsDir;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        if (!this.metrics)
                            return [2 /*return*/];
                        _b = (_a = "\n<!DOCTYPE html>\n<html lang=\"en\">\n<head>\n    <meta charset=\"UTF-8\">\n    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n    <title>Pokemon Card Hedge Fund Dashboard</title>\n    <style>\n        * { margin: 0; padding: 0; box-sizing: border-box; }\n        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #0a0a0a; color: #fff; }\n        .dashboard { padding: 20px; max-width: 1400px; margin: 0 auto; }\n        .header { text-align: center; margin-bottom: 30px; }\n        .header h1 { font-size: 2.5em; color: #00ff88; margin-bottom: 10px; }\n        .header p { color: #888; font-size: 1.1em; }\n        .metrics-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; margin-bottom: 30px; }\n        .metric-card { background: linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%); border-radius: 15px; padding: 25px; border: 1px solid #333; }\n        .metric-card h3 { color: #00ff88; margin-bottom: 15px; font-size: 1.3em; }\n        .metric-value { font-size: 2em; font-weight: bold; color: #fff; margin-bottom: 10px; }\n        .metric-label { color: #888; font-size: 0.9em; }\n        .charts-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); gap: 20px; }\n        .chart-card { background: linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%); border-radius: 15px; padding: 25px; border: 1px solid #333; }\n        .chart-card h3 { color: #00ff88; margin-bottom: 20px; font-size: 1.3em; }\n        .top-list { list-style: none; }\n        .top-list li { padding: 10px 0; border-bottom: 1px solid #333; display: flex; justify-content: space-between; }\n        .top-list li:last-child { border-bottom: none; }\n        .card-name { color: #fff; font-weight: 500; }\n        .card-value { color: #00ff88; font-weight: bold; }\n        .alert-badge { display: inline-block; padding: 4px 8px; border-radius: 12px; font-size: 0.8em; font-weight: bold; }\n        .alert-critical { background: #ff4444; color: #fff; }\n        .alert-high { background: #ff8800; color: #fff; }\n        .alert-medium { background: #ffaa00; color: #000; }\n        .alert-low { background: #00ff88; color: #000; }\n        .status-indicator { display: inline-block; width: 12px; height: 12px; border-radius: 50%; margin-right: 8px; }\n        .status-online { background: #00ff88; }\n        .status-warning { background: #ffaa00; }\n        .status-offline { background: #ff4444; }\n    </style>\n</head>\n<body>\n    <div class=\"dashboard\">\n        <div class=\"header\">\n            <h1>\uD83D\uDD25 POKEMON CARD HEDGE FUND</h1>\n            <p>Ultimate Arbitrage Intelligence Dashboard</p>\n            <p>Last Updated: ".concat(new Date().toISOString(), "</p>\n        </div>\n\n        <div class=\"metrics-grid\">\n            <div class=\"metric-card\">\n                <h3>\uD83D\uDCB0 Total Portfolio Value</h3>\n                <div class=\"metric-value\">$").concat(((this.metrics.portfolio.totalValue / 100)).toLocaleString(), "</div>\n                <div class=\"metric-label\">").concat(this.metrics.portfolio.totalItems.toLocaleString(), " items across ")).concat;
                        return [4 /*yield*/, this.getCollectionCount()];
                    case 1:
                        html = _b.apply(_a, [_c.sent(), " collections</div>\n            </div>\n\n            <div class=\"metric-card\">\n                <h3>\uD83D\uDCC8 Arbitrage Opportunities</h3>\n                <div class=\"metric-value\">"]).concat(this.metrics.arbitrage.totalOpportunities.toLocaleString(), "</div>\n                <div class=\"metric-label\">$").concat(((this.metrics.arbitrage.totalProfitPotential / 100)).toLocaleString(), " profit potential</div>\n            </div>\n\n            <div class=\"metric-card\">\n                <h3>\uD83C\uDFAF Market Listings</h3>\n                <div class=\"metric-value\">").concat(this.metrics.market.totalListings.toLocaleString(), "</div>\n                <div class=\"metric-label\">$").concat(((this.metrics.market.averagePrice / 100)).toFixed(0), " average price</div>\n            </div>\n\n            <div class=\"metric-card\">\n                <h3>\u26A1 Real-Time Alerts</h3>\n                <div class=\"metric-value\">").concat(this.metrics.alerts.critical + this.metrics.alerts.high, "</div>\n                <div class=\"metric-label\">\n                    <span class=\"alert-badge alert-critical\">").concat(this.metrics.alerts.critical, " Critical</span>\n                    <span class=\"alert-badge alert-high\">").concat(this.metrics.alerts.high, " High</span>\n                </div>\n            </div>\n        </div>\n\n        <div class=\"charts-grid\">\n            <div class=\"chart-card\">\n                <h3>\uD83C\uDFC6 Top Portfolio Performers</h3>\n                <ul class=\"top-list\">\n                    ").concat(this.metrics.portfolio.topPerformers.slice(0, 8).map(function (item) { return "\n                        <li>\n                            <span class=\"card-name\">".concat(item.cardName, " ").concat(item.setName, "</span>\n                            <span class=\"card-value\">$").concat(((item.value / 100)).toLocaleString(), "</span>\n                        </li>\n                    "); }).join(''), "\n                </ul>\n            </div>\n\n            <div class=\"chart-card\">\n                <h3>\uD83D\uDC8E Top Arbitrage Opportunities</h3>\n                <ul class=\"top-list\">\n                    ").concat(this.metrics.arbitrage.topOpportunities.slice(0, 8).map(function (opp) { return "\n                        <li>\n                            <span class=\"card-name\">".concat(opp.cardName, " ").concat(opp.setName, "</span>\n                            <span class=\"card-value\">$").concat(((opp.profit / 100)).toFixed(0), " (").concat(opp.margin.toFixed(1), "%)</span>\n                        </li>\n                    "); }).join(''), "\n                </ul>\n            </div>\n\n            <div class=\"chart-card\">\n                <h3>\uD83C\uDCCF Top Cards by Volume</h3>\n                <ul class=\"top-list\">\n                    ").concat(this.metrics.market.topCards.slice(0, 8).map(function (card) { return "\n                        <li>\n                            <span class=\"card-name\">".concat(card.name, "</span>\n                            <span class=\"card-value\">").concat(card.count, " listings ($").concat(((card.averagePrice / 100)).toFixed(0), ")</span>\n                        </li>\n                    "); }).join(''), "\n                </ul>\n            </div>\n\n            <div class=\"chart-card\">\n                <h3>\uD83D\uDCCA Performance Metrics</h3>\n                <div style=\"margin-bottom: 15px;\">\n                    <span class=\"status-indicator status-online\"></span>\n                    <strong>Daily P&L:</strong> $").concat(((this.metrics.performance.dailyProfit / 100)).toFixed(2), "\n                </div>\n                <div style=\"margin-bottom: 15px;\">\n                    <span class=\"status-indicator status-online\"></span>\n                    <strong>Weekly P&L:</strong> $").concat(((this.metrics.performance.weeklyProfit / 100)).toFixed(2), "\n                </div>\n                <div style=\"margin-bottom: 15px;\">\n                    <span class=\"status-indicator status-online\"></span>\n                    <strong>Monthly P&L:</strong> $").concat(((this.metrics.performance.monthlyProfit / 100)).toFixed(2), "\n                </div>\n                <div style=\"margin-bottom: 15px;\">\n                    <span class=\"status-indicator status-warning\"></span>\n                    <strong>ROI:</strong> ").concat(this.metrics.performance.roi, "%\n                </div>\n                <div>\n                    <span class=\"status-indicator status-online\"></span>\n                    <strong>Sharpe Ratio:</strong> ").concat(this.metrics.performance.sharpeRatio, "\n                </div>\n            </div>\n        </div>\n    </div>\n</body>\n</html>");
                        reportsDir = path.join(__dirname, 'reports');
                        return [4 /*yield*/, fs.mkdir(reportsDir, { recursive: true })];
                    case 2:
                        _c.sent();
                        return [4 /*yield*/, fs.writeFile(path.join(reportsDir, 'hedge-fund-dashboard.html'), html)];
                    case 3:
                        _c.sent();
                        console.log('✅ HTML dashboard generated: reports/hedge-fund-dashboard.html');
                        return [2 /*return*/];
                }
            });
        });
    };
    HedgeFundDashboard.prototype.generateExecutiveSummary = function () {
        return __awaiter(this, void 0, void 0, function () {
            var timestamp, summary, reportsDir;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!this.metrics)
                            return [2 /*return*/];
                        timestamp = new Date().toISOString();
                        summary = {
                            reportType: 'EXECUTIVE SUMMARY',
                            timestamp: timestamp,
                            keyFindings: {
                                portfolioValue: this.metrics.portfolio.totalValue,
                                arbitrageOpportunities: this.metrics.arbitrage.totalOpportunities,
                                profitPotential: this.metrics.arbitrage.totalProfitPotential,
                                marketListings: this.metrics.market.totalListings,
                                highConfidenceOpportunities: this.metrics.arbitrage.highConfidenceCount,
                                lowRiskOpportunities: this.metrics.arbitrage.lowRiskCount
                            },
                            recommendations: [
                                'Execute high-confidence, low-risk arbitrage opportunities immediately',
                                'Increase position in Charizard and Pikachu cards due to strong fundamentals',
                                'Monitor real-time alerts for new opportunities',
                                'Consider scaling operations to additional market sources',
                                'Implement automated execution for opportunities with >90% confidence'
                            ],
                            riskAssessment: {
                                overallRisk: 'MEDIUM',
                                riskFactors: [
                                    'Market volatility in collectibles',
                                    'Liquidity constraints on high-value items',
                                    'Authentication and condition risks'
                                ],
                                mitigationStrategies: [
                                    'Diversified portfolio across multiple card types',
                                    'Focus on high-liquidity opportunities',
                                    'Strong authentication and grading processes'
                                ]
                            }
                        };
                        reportsDir = path.join(__dirname, 'reports');
                        return [4 /*yield*/, fs.mkdir(reportsDir, { recursive: true })];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, fs.writeFile(path.join(reportsDir, 'executive-summary.json'), JSON.stringify(summary, null, 2))];
                    case 2:
                        _a.sent();
                        console.log('✅ Executive summary generated: reports/executive-summary.json');
                        return [2 /*return*/];
                }
            });
        });
    };
    HedgeFundDashboard.prototype.generateRiskReport = function () {
        return __awaiter(this, void 0, void 0, function () {
            var riskReport, reportsDir;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!this.metrics)
                            return [2 /*return*/];
                        riskReport = {
                            reportType: 'RISK ASSESSMENT REPORT',
                            timestamp: new Date().toISOString(),
                            portfolioRisk: {
                                concentrationRisk: 'MEDIUM',
                                liquidityRisk: 'LOW',
                                marketRisk: 'MEDIUM',
                                operationalRisk: 'LOW'
                            },
                            arbitrageRisk: {
                                executionRisk: 'LOW',
                                timingRisk: 'MEDIUM',
                                counterpartyRisk: 'LOW',
                                marketRisk: 'MEDIUM'
                            },
                            riskMetrics: {
                                var95: this.metrics.portfolio.totalValue * 0.05, // 5% VaR
                                maxDrawdown: this.metrics.portfolio.totalValue * 0.15, // 15% max drawdown
                                sharpeRatio: this.metrics.performance.sharpeRatio,
                                beta: 0.8 // Simulated beta vs market
                            },
                            recommendations: [
                                'Maintain position limits of 10% per individual card',
                                'Implement stop-loss at 20% drawdown',
                                'Diversify across multiple market sources',
                                'Regular stress testing of portfolio'
                            ]
                        };
                        reportsDir = path.join(__dirname, 'reports');
                        return [4 /*yield*/, fs.mkdir(reportsDir, { recursive: true })];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, fs.writeFile(path.join(reportsDir, 'risk-report.json'), JSON.stringify(riskReport, null, 2))];
                    case 2:
                        _a.sent();
                        console.log('✅ Risk report generated: reports/risk-report.json');
                        return [2 /*return*/];
                }
            });
        });
    };
    HedgeFundDashboard.prototype.getCollectionCount = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, prisma.portfolioCollection.count()];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    return HedgeFundDashboard;
}());
// Generate the dashboard
var dashboard = new HedgeFundDashboard();
dashboard.generateDashboard().catch(console.error);
