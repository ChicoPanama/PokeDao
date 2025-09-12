#!/usr/bin/env node
/**
 * EXAMPLE: RESEARCH SCRIPT USING CANONICAL SCHEMA
 * ===============================================
 * This demonstrates how research scripts should be updated
 * to use the canonical schema and adapter
 */

import { normalizeCardData, getCanonicalPrisma } from './canonical-adapter.js';

/**
 * Example: Process research data and store in canonical database
 */
async function processResearchData() {
  console.log('🔬 Processing Research Data with Canonical Schema');
  console.log('================================================');

  // Sample research data (could come from any source)
  const researchCards = [
    {
      cardName: 'Pikachu',
      setName: 'Base Set',
      cardNumber: '25',
      grading: 'PSA 9',
      cardCondition: 'Near Mint',
      source: 'research_extraction',
      extraction_timestamp: new Date().toISOString()
    },
    {
      name: 'Charizard',
      set: 'Base Set',
      num: '4',
      grade: 'CGC 8.5',
      condition: 'Excellent',
      source: 'research_analysis',
      analysis_confidence: 0.95
    }
  ];

  console.log(`📂 Processing ${researchCards.length} research cards...`);

  // Get canonical database connection
  const prisma = await getCanonicalPrisma();

  try {
    for (const [index, rawCard] of researchCards.entries()) {
      // Normalize to canonical schema format
      const normalizedCard = normalizeCardData(rawCard);
      
      console.log(`\nCard ${index + 1}:`);
      console.log(`  Raw: ${JSON.stringify(rawCard, null, 2)}`);
      console.log(`  Normalized: ${JSON.stringify(normalizedCard, null, 2)}`);

      // Store in canonical database (example - would need actual implementation)
      console.log(`  ✅ Ready for canonical storage`);
      
      // Example of how you might store it:
      /*
      const stored = await prisma.card.upsert({
        where: {
          set_number_variant_grade: {
            set: normalizedCard.set,
            number: normalizedCard.number,
            variant: normalizedCard.variant || '',
            grade: normalizedCard.grade || ''
          }
        },
        update: {
          updatedAt: new Date()
        },
        create: {
          ...normalizedCard,
          id: undefined // Let Prisma generate the ID
        }
      });
      */
    }

    console.log('\n✅ Research data processing complete!');
    console.log('📊 All data normalized to canonical schema format');
    console.log('🔗 Ready for storage in unified database');

  } catch (error) {
    console.error('❌ Error processing research data:', error);
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * Example: Query canonical database from research context
 */
async function queryCanonicalData() {
  console.log('\n🔍 Querying Canonical Database from Research');
  console.log('===========================================');

  const prisma = await getCanonicalPrisma();

  try {
    // Example queries that research scripts might need
    
    // Count total cards
    const totalCards = await prisma.card.count();
    console.log(`📊 Total cards in canonical database: ${totalCards}`);

    // Get cards by set (example)
    const baseSetCards = await prisma.card.findMany({
      where: {
        set: {
          contains: 'Base',
          mode: 'insensitive'
        }
      },
      take: 5
    });
    
    console.log(`🃏 Base Set cards found: ${baseSetCards.length}`);
    baseSetCards.forEach((card, index) => {
      console.log(`  ${index + 1}. ${card.name} (${card.set}) #${card.number}`);
    });

    // Get high-grade cards (example)
    const highGradeCards = await prisma.card.findMany({
      where: {
        grade: {
          contains: '10'
        }
      },
      take: 3
    });

    console.log(`⭐ High-grade cards found: ${highGradeCards.length}`);
    highGradeCards.forEach((card, index) => {
      console.log(`  ${index + 1}. ${card.name} - Grade: ${card.grade}`);
    });

  } catch (error) {
    console.error('❌ Error querying canonical data:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the examples
async function main() {
  await processResearchData();
  await queryCanonicalData();
  
  console.log('\n🎯 RESEARCH INTEGRATION SUMMARY');
  console.log('==============================');
  console.log('✅ Research data normalized to canonical format');
  console.log('✅ Canonical database connection established');
  console.log('✅ Data flow: Research → Canonical Schema → Database');
  console.log('✅ Integration pattern established for all research scripts');
}

main().catch(console.error);
