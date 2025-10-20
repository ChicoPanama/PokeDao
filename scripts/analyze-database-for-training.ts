#!/usr/bin/env tsx
/**
 * Deep Database Analysis for Mew-1A Training
 *
 * Analyzes all 350k records to identify:
 * 1. Parsing issues with sets and card numbers
 * 2. Data quality problems
 * 3. Opportunities to maximize training examples
 * 4. Base set vs individual card separation
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface AnalysisReport {
  totalRecords: number;
  usableRecords: number;
  parsingIssues: {
    missingSetName: number;
    missingCardNumber: number;
    missingCardName: number;
    missingPrice: number;
    invalidPrice: number;
  };
  setAnalysis: {
    totalUniqueSets: number;
    setsWithMultipleCards: number;
    avgCardsPerSet: number;
    topSets: Array<{setName: string; cardCount: number; listingCount: number}>;
  };
  cardAnalysis: {
    totalUniqueCards: number;
    cardsWithMultipleListings: number;
    avgListingsPerCard: number;
    topCards: Array<{cardName: string; setName: string; listingCount: number}>;
  };
  sourceDistribution: Record<string, number>;
  priceRangeDistribution: Record<string, number>;
  gradeDistribution: Record<string, number>;
  recommendations: string[];
}

async function analyzeDatabase(): Promise<AnalysisReport> {
  console.log('\n' + '='.repeat(80));
  console.log('🔍 DEEP DATABASE ANALYSIS FOR MEW-1A TRAINING');
  console.log('='.repeat(80));

  // Total records
  console.log('\n📊 Fetching all records...');
  const totalRecords = await prisma.marketListing.count();
  console.log(`✓ Total records in database: ${totalRecords.toLocaleString()}`);

  // Parsing issues
  console.log('\n🔍 Analyzing parsing issues...');
  const [
    missingSetName,
    missingCardNumber,
    missingCardName,
    missingPrice,
    invalidPrice
  ] = await Promise.all([
    prisma.marketListing.count({ where: { setName: null } }),
    prisma.marketListing.count({ where: { cardNumber: null } }),
    prisma.marketListing.count({ where: { cardName: null } }),
    prisma.marketListing.count({ where: { priceCents: null } }),
    prisma.marketListing.count({ where: { priceCents: { lte: 0 } } }),
  ]);

  const usableRecords = totalRecords - missingCardName - missingPrice - invalidPrice;

  console.log(`   • Missing setName: ${missingSetName.toLocaleString()}`);
  console.log(`   • Missing cardNumber: ${missingCardNumber.toLocaleString()}`);
  console.log(`   • Missing cardName: ${missingCardName.toLocaleString()}`);
  console.log(`   • Missing price: ${missingPrice.toLocaleString()}`);
  console.log(`   • Invalid price (≤0): ${invalidPrice.toLocaleString()}`);
  console.log(`   ✓ Usable records: ${usableRecords.toLocaleString()}`);

  // Source distribution
  console.log('\n📦 Analyzing source distribution...');
  const sourceGroups = await prisma.marketListing.groupBy({
    by: ['source'],
    _count: true,
  });

  const sourceDistribution: Record<string, number> = {};
  for (const group of sourceGroups) {
    sourceDistribution[group.source || 'unknown'] = group._count;
    console.log(`   • ${group.source || 'unknown'}: ${group._count.toLocaleString()}`);
  }

  // Set analysis
  console.log('\n🎴 Analyzing sets...');
  const uniqueSets = await prisma.marketListing.groupBy({
    by: ['setName'],
    _count: true,
    where: {
      setName: { not: null },
      cardName: { not: null },
      priceCents: { gt: 0 },
    },
  });

  const setStats = uniqueSets
    .map(s => ({
      setName: s.setName!,
      listingCount: s._count,
    }))
    .sort((a, b) => b.listingCount - a.listingCount);

  // Get card counts per set
  const setWithCardCounts = await Promise.all(
    setStats.slice(0, 20).map(async (s) => {
      const uniqueCards = await prisma.marketListing.findMany({
        where: {
          setName: s.setName,
          cardName: { not: null },
        },
        distinct: ['cardName', 'cardNumber'],
        select: { cardName: true, cardNumber: true },
      });
      return {
        setName: s.setName,
        cardCount: uniqueCards.length,
        listingCount: s.listingCount,
      };
    })
  );

  const totalUniqueSets = uniqueSets.length;
  const avgCardsPerSet = setWithCardCounts.reduce((sum, s) => sum + s.cardCount, 0) / setWithCardCounts.length;

  console.log(`   ✓ Total unique sets: ${totalUniqueSets.toLocaleString()}`);
  console.log(`   ✓ Avg cards per set (top 20): ${avgCardsPerSet.toFixed(1)}`);
  console.log(`\n   Top 10 sets by listing count:`);
  setWithCardCounts.slice(0, 10).forEach((s, i) => {
    console.log(`      ${i + 1}. ${s.setName}: ${s.cardCount} cards, ${s.listingCount.toLocaleString()} listings`);
  });

  // Card analysis
  console.log('\n🃏 Analyzing individual cards...');
  const cardGroups = await prisma.marketListing.groupBy({
    by: ['setName', 'cardNumber'],
    _count: true,
    where: {
      setName: { not: null },
      cardNumber: { not: null },
      cardName: { not: null },
      priceCents: { gt: 0 },
    },
  });

  const totalUniqueCards = cardGroups.length;
  const cardsWithMultipleListings = cardGroups.filter(g => g._count >= 2).length;
  const avgListingsPerCard = cardGroups.reduce((sum, g) => sum + g._count, 0) / cardGroups.length;

  console.log(`   ✓ Total unique cards: ${totalUniqueCards.toLocaleString()}`);
  console.log(`   ✓ Cards with 2+ listings: ${cardsWithMultipleListings.toLocaleString()}`);
  console.log(`   ✓ Avg listings per card: ${avgListingsPerCard.toFixed(2)}`);

  // Top cards
  const topCardGroups = cardGroups
    .sort((a, b) => b._count - a._count)
    .slice(0, 10);

  const topCards = await Promise.all(
    topCardGroups.map(async (g) => {
      const listing = await prisma.marketListing.findFirst({
        where: {
          setName: g.setName,
          cardNumber: g.cardNumber,
        },
        select: { cardName: true },
      });
      return {
        cardName: listing?.cardName || 'Unknown',
        setName: g.setName!,
        listingCount: g._count,
      };
    })
  );

  console.log(`\n   Top 10 cards by listing count:`);
  topCards.forEach((c, i) => {
    console.log(`      ${i + 1}. ${c.cardName} (${c.setName}): ${c.listingCount.toLocaleString()} listings`);
  });

  // Price range distribution
  console.log('\n💰 Analyzing price ranges...');
  const [budget, low, mid, high, premium] = await Promise.all([
    prisma.marketListing.count({ where: { priceCents: { gt: 0, lt: 100 } } }),
    prisma.marketListing.count({ where: { priceCents: { gte: 100, lt: 1000 } } }),
    prisma.marketListing.count({ where: { priceCents: { gte: 1000, lt: 5000 } } }),
    prisma.marketListing.count({ where: { priceCents: { gte: 5000, lt: 25000 } } }),
    prisma.marketListing.count({ where: { priceCents: { gte: 25000 } } }),
  ]);

  const priceRangeDistribution = {
    'budget (<$1)': budget,
    'low ($1-10)': low,
    'mid ($10-50)': mid,
    'high ($50-250)': high,
    'premium ($250+)': premium,
  };

  for (const [range, count] of Object.entries(priceRangeDistribution)) {
    const pct = (count / usableRecords) * 100;
    console.log(`   • ${range}: ${count.toLocaleString()} (${pct.toFixed(1)}%)`);
  }

  // Grade/condition distribution
  console.log('\n⭐ Analyzing grades/conditions...');
  const [withGrade, withCondition, neither] = await Promise.all([
    prisma.marketListing.count({ where: { grade: { not: null } } }),
    prisma.marketListing.count({ where: { condition: { not: null } } }),
    prisma.marketListing.count({ where: { AND: [{ grade: null }, { condition: null }] } }),
  ]);

  const gradeDistribution = {
    'with_grade': withGrade,
    'with_condition': withCondition,
    'neither': neither,
  };

  console.log(`   • With grade: ${withGrade.toLocaleString()}`);
  console.log(`   • With condition: ${withCondition.toLocaleString()}`);
  console.log(`   • Neither: ${neither.toLocaleString()}`);

  // Generate recommendations
  const recommendations: string[] = [];

  if (missingCardName > totalRecords * 0.1) {
    recommendations.push(`⚠️ ${((missingCardName / totalRecords) * 100).toFixed(1)}% of records missing cardName - investigate parsing`);
  }

  if (missingSetName > totalRecords * 0.2) {
    recommendations.push(`⚠️ ${((missingSetName / totalRecords) * 100).toFixed(1)}% of records missing setName - many won't be usable`);
  }

  if (cardsWithMultipleListings < totalUniqueCards * 0.3) {
    recommendations.push(`💡 Only ${((cardsWithMultipleListings / totalUniqueCards) * 100).toFixed(1)}% of cards have multiple listings - limits arbitrage/trend training`);
  }

  recommendations.push(`✅ ${usableRecords.toLocaleString()} usable records available for training extraction`);
  recommendations.push(`✅ ${totalUniqueSets.toLocaleString()} unique sets provide excellent coverage`);
  recommendations.push(`✅ ${withGrade.toLocaleString()} graded cards excellent for condition analysis training`);

  console.log('\n💡 Recommendations:');
  recommendations.forEach(r => console.log(`   ${r}`));

  return {
    totalRecords,
    usableRecords,
    parsingIssues: {
      missingSetName,
      missingCardNumber,
      missingCardName,
      missingPrice,
      invalidPrice,
    },
    setAnalysis: {
      totalUniqueSets,
      setsWithMultipleCards: setWithCardCounts.filter(s => s.cardCount > 1).length,
      avgCardsPerSet,
      topSets: setWithCardCounts.slice(0, 20),
    },
    cardAnalysis: {
      totalUniqueCards,
      cardsWithMultipleListings,
      avgListingsPerCard,
      topCards: topCards.slice(0, 20),
    },
    sourceDistribution,
    priceRangeDistribution,
    gradeDistribution,
    recommendations,
  };
}

async function main() {
  try {
    const report = await analyzeDatabase();

    // Save report
    const fs = await import('fs');
    const reportPath = `database-analysis-${Date.now()}.json`;
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    console.log('\n' + '='.repeat(80));
    console.log(`✅ Analysis complete! Report saved to: ${reportPath}`);
    console.log('='.repeat(80));
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
