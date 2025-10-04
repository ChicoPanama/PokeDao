/**
 * Real-Time Arbitrage Alert Scanner
 *
 * Continuously scans for arbitrage opportunities and sends instant alerts.
 *
 * Features:
 * - Scans database every 5 minutes for new opportunities
 * - Sends alerts to Telegram/Discord
 * - Tracks sent alerts to avoid duplicates
 * - Configurable profit thresholds
 * - Confidence scoring
 *
 * Run: pnpm tsx scripts/arbitrage-alert-scanner.ts
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { AlertSender, type ArbitrageAlert } from './lib/alert-sender.js';
import { writeFileSync, existsSync, readFileSync } from 'fs';

// ============================================================================
// CONFIG
// ============================================================================

const SCAN_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const MIN_PROFIT_USD = 10; // Minimum $10 profit
const MIN_PROFIT_PERCENT = 20; // Minimum 20% profit margin
const MIN_CONFIDENCE = 0.6; // Minimum 60% confidence
const ALERT_HISTORY_FILE = 'data/alert-history.json';

// ============================================================================
// ALERT HISTORY TRACKING
// ============================================================================

interface AlertHistory {
  sentAlerts: Set<string>; // Set of alert IDs (hash of card+sources+price)
  lastScanTime: string;
  totalAlertsSent: number;
}

function loadAlertHistory(): AlertHistory {
  if (existsSync(ALERT_HISTORY_FILE)) {
    const data = JSON.parse(readFileSync(ALERT_HISTORY_FILE, 'utf8'));
    return {
      sentAlerts: new Set(data.sentAlerts || []),
      lastScanTime: data.lastScanTime || new Date().toISOString(),
      totalAlertsSent: data.totalAlertsSent || 0,
    };
  }

  return {
    sentAlerts: new Set(),
    lastScanTime: new Date().toISOString(),
    totalAlertsSent: 0,
  };
}

function saveAlertHistory(history: AlertHistory): void {
  const data = {
    sentAlerts: Array.from(history.sentAlerts),
    lastScanTime: history.lastScanTime,
    totalAlertsSent: history.totalAlertsSent,
  };
  writeFileSync(ALERT_HISTORY_FILE, JSON.stringify(data, null, 2));
}

function getAlertId(alert: ArbitrageAlert): string {
  // Create unique ID from card + sources + approximate price
  const priceRange = Math.floor(alert.buyPrice / 1000) * 1000; // Round to nearest $10
  return `${alert.cardName}|${alert.setName}|${alert.buySource}|${alert.sellSource}|${priceRange}`;
}

// ============================================================================
// ARBITRAGE SCANNER
// ============================================================================

class ArbitrageScanner {
  constructor(
    private prisma: PrismaClient,
    private alertSender: AlertSender,
    private history: AlertHistory
  ) {}

  /**
   * Scan for arbitrage opportunities
   */
  async scan(): Promise<ArbitrageAlert[]> {
    console.log(`\n🔍 Scanning for arbitrage opportunities...`);
    console.log(`   Min Profit: $${MIN_PROFIT_USD} (${MIN_PROFIT_PERCENT}%)`);
    console.log(`   Min Confidence: ${(MIN_CONFIDENCE * 100).toFixed(0)}%`);

    const opportunities: ArbitrageAlert[] = [];

    // Find cards that appear on multiple marketplaces
    const cardGroups = await this.prisma.unifiedMarketListing.groupBy({
      by: ['cardName', 'setName', 'gradeCompany', 'grade'],
      where: {
        cardName: { not: 'Unknown' },
        setName: { not: 'Unknown' },
        priceCents: { gt: 0 },
      },
      _count: { source: true },
      having: {
        source: { _count: { gte: 2 } }, // Must be on at least 2 marketplaces
      },
    });

    console.log(`   Found ${cardGroups.length} cards on multiple marketplaces`);

    // Analyze each card group
    for (const group of cardGroups) {
      const listings = await this.prisma.unifiedMarketListing.findMany({
        where: {
          cardName: group.cardName,
          setName: group.setName,
          gradeCompany: group.gradeCompany || undefined,
          grade: group.grade || undefined,
          priceCents: { gt: 0 },
        },
        orderBy: { priceCents: 'asc' },
      });

      if (listings.length < 2) continue;

      // Find cheapest and most expensive
      const cheapest = listings[0];
      const mostExpensive = listings[listings.length - 1];

      // Skip if same source
      if (cheapest.source === mostExpensive.source) continue;

      // Calculate profit
      const profit = mostExpensive.priceCents - cheapest.priceCents;
      const profitPercent = (profit / cheapest.priceCents) * 100;

      // Check thresholds
      if (profit < MIN_PROFIT_USD * 100) continue;
      if (profitPercent < MIN_PROFIT_PERCENT) continue;

      // Calculate confidence
      const sampleSizeScore = Math.min(listings.length / 10, 1);
      const recencyScore = listings.filter(l => {
        const age = Date.now() - l.updatedAt.getTime();
        return age < 7 * 24 * 60 * 60 * 1000; // Within 7 days
      }).length / listings.length;
      const confidence = (sampleSizeScore * 0.5) + (recencyScore * 0.5);

      if (confidence < MIN_CONFIDENCE) continue;

      opportunities.push({
        cardName: group.cardName || 'Unknown',
        setName: group.setName || 'Unknown',
        grade: group.grade || undefined,
        gradeCompany: group.gradeCompany || undefined,
        buySource: cheapest.source,
        buyPrice: cheapest.priceCents,
        buyUrl: cheapest.url || '',
        sellSource: mostExpensive.source,
        sellPrice: mostExpensive.priceCents,
        sellUrl: mostExpensive.url || '',
        profit,
        profitPercent: Math.round(profitPercent * 10) / 10,
        confidence: Math.round(confidence * 100) / 100,
      });
    }

    // Sort by profit (highest first)
    opportunities.sort((a, b) => b.profit - a.profit);

    console.log(`   ✅ Found ${opportunities.length} arbitrage opportunities`);

    return opportunities;
  }

  /**
   * Send alerts for new opportunities
   */
  async sendAlerts(opportunities: ArbitrageAlert[]): Promise<number> {
    let sentCount = 0;

    for (const opportunity of opportunities) {
      const alertId = getAlertId(opportunity);

      // Skip if already sent
      if (this.history.sentAlerts.has(alertId)) {
        continue;
      }

      console.log(`\n📤 Sending alert:`);
      console.log(`   ${opportunity.cardName} - ${opportunity.setName}`);
      console.log(`   Buy: $${(opportunity.buyPrice / 100).toFixed(2)} on ${opportunity.buySource}`);
      console.log(`   Sell: $${(opportunity.sellPrice / 100).toFixed(2)} on ${opportunity.sellSource}`);
      console.log(`   Profit: $${(opportunity.profit / 100).toFixed(2)} (${opportunity.profitPercent}%)`);

      try {
        const results = await this.alertSender.sendAlert(opportunity);

        if (results.telegram) {
          console.log(`   ✅ Sent to Telegram`);
        }
        if (results.discord) {
          console.log(`   ✅ Sent to Discord`);
        }
        if (results.errors.length > 0) {
          console.log(`   ⚠️  Errors: ${results.errors.join(', ')}`);
        }

        // Mark as sent
        this.history.sentAlerts.add(alertId);
        this.history.totalAlertsSent++;
        sentCount++;

        // Save history after each alert
        saveAlertHistory(this.history);

        // Rate limit: 1 alert per second
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (error: any) {
        console.error(`   ❌ Error: ${error.message}`);
      }
    }

    return sentCount;
  }

  /**
   * Clean up old alerts from history (keep last 1000)
   */
  cleanHistory(): void {
    if (this.history.sentAlerts.size > 1000) {
      const sorted = Array.from(this.history.sentAlerts);
      const keep = sorted.slice(-1000);
      this.history.sentAlerts = new Set(keep);
      saveAlertHistory(this.history);
      console.log(`   🧹 Cleaned alert history (kept last 1000)`);
    }
  }
}

// ============================================================================
// MAIN LOOP
// ============================================================================

async function main() {
  console.log('🚀 ARBITRAGE ALERT SCANNER');
  console.log('='.repeat(60));
  console.log(`📊 Scan Interval: ${SCAN_INTERVAL_MS / 1000 / 60} minutes`);
  console.log(`💰 Min Profit: $${MIN_PROFIT_USD} (${MIN_PROFIT_PERCENT}%)`);
  console.log(`🎯 Min Confidence: ${(MIN_CONFIDENCE * 100).toFixed(0)}%`);
  console.log('='.repeat(60));

  const prisma = new PrismaClient();
  const alertSender = new AlertSender();
  const history = loadAlertHistory();

  const scanner = new ArbitrageScanner(prisma, alertSender, history);

  console.log(`\n📍 Alert History: ${history.totalAlertsSent} total alerts sent`);

  // Initial scan
  try {
    const opportunities = await scanner.scan();
    const sentCount = await scanner.sendAlerts(opportunities);

    console.log(`\n📊 Initial Scan Complete:`);
    console.log(`   Opportunities: ${opportunities.length}`);
    console.log(`   Alerts Sent: ${sentCount}`);

    scanner.cleanHistory();

  } catch (error: any) {
    console.error(`\n❌ Scan error: ${error.message}`);
  }

  // Continuous scanning
  console.log(`\n⏰ Next scan in ${SCAN_INTERVAL_MS / 1000 / 60} minutes...`);

  setInterval(async () => {
    try {
      history.lastScanTime = new Date().toISOString();
      saveAlertHistory(history);

      const opportunities = await scanner.scan();
      const sentCount = await scanner.sendAlerts(opportunities);

      console.log(`\n📊 Scan Complete (${new Date().toLocaleTimeString()}):`);
      console.log(`   Opportunities: ${opportunities.length}`);
      console.log(`   Alerts Sent: ${sentCount}`);
      console.log(`   Total Alerts: ${history.totalAlertsSent}`);

      scanner.cleanHistory();

      console.log(`\n⏰ Next scan in ${SCAN_INTERVAL_MS / 1000 / 60} minutes...`);

    } catch (error: any) {
      console.error(`\n❌ Scan error: ${error.message}`);
    }
  }, SCAN_INTERVAL_MS);

  // Keep process alive
  process.on('SIGINT', async () => {
    console.log('\n\n🛑 Shutting down...');
    await prisma.$disconnect();
    process.exit(0);
  });
}

main().catch(console.error);
