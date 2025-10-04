/**
 * Marketplace Inventory Dashboard
 *
 * This script generates an aggregated view of all marketplace inventory:
 * 1. Total listings by source
 * 2. Breakdown by grading company and grade ranges
 * 3. Price distribution
 * 4. Top cards by various metrics
 * 5. Data quality summary
 *
 * Run: pnpm tsx scripts/dashboard-inventory.ts
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

async function main() {
  console.log('📊 MARKETPLACE INVENTORY DASHBOARD');
  console.log('='.repeat(60));
  console.log(`Generated: ${new Date().toISOString()}\n`);

  const prisma = new PrismaClient();

  try {
    // Total counts by source
    const bySource = await prisma.unifiedMarketListing.groupBy({
      by: ['source'],
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
    });

    console.log('📦 INVENTORY BY SOURCE');
    console.log('='.repeat(60));

    let totalListings = 0;
    for (const source of bySource) {
      const count = source._count.id;
      totalListings += count;
      console.log(`${source.source}: ${count.toLocaleString()}`);
    }

    console.log('-'.repeat(60));
    console.log(`TOTAL: ${totalListings.toLocaleString()}`);
    console.log();

    // Grading company breakdown
    const byGradeCompany = await prisma.unifiedMarketListing.groupBy({
      by: ['gradeCompany'],
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
    });

    console.log('🏆 BY GRADING COMPANY');
    console.log('='.repeat(60));

    for (const grader of byGradeCompany) {
      const count = grader._count.id;
      const pct = ((count / totalListings) * 100).toFixed(1);
      const company = grader.gradeCompany || 'RAW/Unknown';
      console.log(`${company}: ${count.toLocaleString()} (${pct}%)`);
    }
    console.log();

    // Grade distribution (for PSA only)
    console.log('⭐ PSA GRADE DISTRIBUTION');
    console.log('='.repeat(60));

    const psaGrades = await prisma.unifiedMarketListing.findMany({
      where: {
        gradeCompany: 'PSA',
        grade: { not: null },
      },
      select: { grade: true },
    });

    const gradeCounts: Record<string, number> = {};
    for (const listing of psaGrades) {
      const grade = listing.grade?.toString() || 'Unknown';
      gradeCounts[grade] = (gradeCounts[grade] || 0) + 1;
    }

    Object.entries(gradeCounts)
      .sort((a, b) => parseFloat(b[0]) - parseFloat(a[0]))
      .forEach(([grade, count]) => {
        const pct = ((count / psaGrades.length) * 100).toFixed(1);
        console.log(`PSA ${grade}: ${count.toLocaleString()} (${pct}%)`);
      });
    console.log();

    // Price distribution
    console.log('💰 PRICE DISTRIBUTION');
    console.log('='.repeat(60));

    const priceRanges = [
      { min: 0, max: 1000, label: '$0-$10' },
      { min: 1000, max: 5000, label: '$10-$50' },
      { min: 5000, max: 10000, label: '$50-$100' },
      { min: 10000, max: 50000, label: '$100-$500' },
      { min: 50000, max: 100000, label: '$500-$1000' },
      { min: 100000, max: 2147483647, label: '$1000+' }, // INT4 max
    ];

    for (const range of priceRanges) {
      const count = await prisma.unifiedMarketListing.count({
        where: {
          priceCents: {
            gte: range.min,
            lt: range.max,
          },
        },
      });

      const pct = ((count / totalListings) * 100).toFixed(1);
      console.log(`${range.label}: ${count.toLocaleString()} (${pct}%)`);
    }
    console.log();

    // Most expensive listings
    console.log('💎 TOP 10 MOST EXPENSIVE');
    console.log('='.repeat(60));

    const topExpensive = await prisma.unifiedMarketListing.findMany({
      orderBy: { priceCents: 'desc' },
      take: 10,
      select: {
        cardName: true,
        setName: true,
        cardNumber: true,
        gradeCompany: true,
        grade: true,
        priceCents: true,
        source: true,
      },
    });

    topExpensive.forEach((listing, i) => {
      const price = `$${(listing.priceCents / 100).toFixed(2)}`;
      const gradeStr = listing.gradeCompany
        ? `${listing.gradeCompany} ${listing.grade || ''}`
        : 'RAW';
      console.log(`${i + 1}. ${listing.cardName} (${listing.setName} #${listing.cardNumber}) - ${gradeStr} - ${price} [${listing.source}]`);
    });
    console.log();

    // Most common cards
    console.log('🔥 TOP 10 MOST COMMON CARDS');
    console.log('='.repeat(60));

    const byCardName = await prisma.unifiedMarketListing.groupBy({
      by: ['cardName'],
      _count: { id: true },
      where: {
        cardName: { not: null },
      },
      orderBy: { _count: { id: 'desc' } },
      take: 10,
    });

    byCardName.forEach((card, i) => {
      console.log(`${i + 1}. ${card.cardName}: ${card._count.id.toLocaleString()} listings`);
    });
    console.log();

    // Most common sets
    console.log('📚 TOP 10 MOST COMMON SETS');
    console.log('='.repeat(60));

    const bySetName = await prisma.unifiedMarketListing.groupBy({
      by: ['setName'],
      _count: { id: true },
      where: {
        setName: { not: null },
      },
      orderBy: { _count: { id: 'desc' } },
      take: 10,
    });

    bySetName.forEach((set, i) => {
      console.log(`${i + 1}. ${set.setName}: ${set._count.id.toLocaleString()} listings`);
    });
    console.log();

    // Data quality summary
    console.log('📈 DATA QUALITY SUMMARY');
    console.log('='.repeat(60));

    const avgQuality = await prisma.unifiedMarketListing.aggregate({
      _avg: { dataQuality: true },
      where: { dataQuality: { not: null } },
    });

    const withCardName = await prisma.unifiedMarketListing.count({
      where: {
        cardName: { not: null },
        cardName: { not: '' },
        cardName: { not: 'Unknown' },
      },
    });

    const withSetName = await prisma.unifiedMarketListing.count({
      where: {
        setName: { not: null },
        setName: { not: '' },
        setName: { not: 'Unknown' },
      },
    });

    const withGrade = await prisma.unifiedMarketListing.count({
      where: {
        gradeCompany: { not: null },
        grade: { not: null },
      },
    });

    const withPrice = await prisma.unifiedMarketListing.count({
      where: {
        priceCents: { gt: 0 },
      },
    });

    console.log(`Average data quality: ${((avgQuality._avg.dataQuality || 0) * 100).toFixed(1)}%`);
    console.log(`With card name: ${withCardName.toLocaleString()} (${((withCardName / totalListings) * 100).toFixed(1)}%)`);
    console.log(`With set name: ${withSetName.toLocaleString()} (${((withSetName / totalListings) * 100).toFixed(1)}%)`);
    console.log(`With grading: ${withGrade.toLocaleString()} (${((withGrade / totalListings) * 100).toFixed(1)}%)`);
    console.log(`With prices: ${withPrice.toLocaleString()} (${((withPrice / totalListings) * 100).toFixed(1)}%)`);
    console.log();

    console.log('='.repeat(60));
    console.log('✅ Dashboard generated successfully');
    console.log('='.repeat(60));

  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
