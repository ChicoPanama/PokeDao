#!/usr/bin/env tsx
/**
 * Minimal seed script to populate canonical_cards table for traffic generator testing
 * Reads from traffic-generator-cards.json and creates canonical card records
 */

import { PrismaClient } from '@prisma/client';
import fs from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();

interface TestCard {
  name: string;
  set: string;
  cardNumber: string;
  rarity: string;
  avgPriceRaw: number;
  tier: string;
}

async function main() {
  console.log('🌱 Seeding canonical_cards for traffic generator...\n');

  // Load test cards
  const cardsPath = path.join(process.cwd(), 'scripts', 'traffic-generator-cards.json');
  const cardsData = await fs.readFile(cardsPath, 'utf-8');
  const testCards: TestCard[] = JSON.parse(cardsData);

  console.log(`📦 Found ${testCards.length} test cards to seed\n`);

  let created = 0;
  let skipped = 0;

  for (const card of testCards) {
    try {
      // Check if card already exists
      const existing = await prisma.canonicalCard.findFirst({
        where: {
          canonicalName: card.name,
          canonicalSet: card.set,
          cardNumber: card.cardNumber,
        },
      });

      if (existing) {
        skipped++;
        continue;
      }

      // Create canonical card
      await prisma.canonicalCard.create({
        data: {
          id: randomUUID(),
          canonicalName: card.name,
          canonicalSet: card.set,
          cardNumber: card.cardNumber,
          rarity: card.rarity || null,
        },
      });

      created++;

      if (created % 10 === 0) {
        console.log(`  ✓ Created ${created}/${testCards.length}...`);
      }
    } catch (err) {
      console.error(`  ✗ Failed to create ${card.name} (${card.cardNumber}):`, (err as Error).message);
    }
  }

  console.log(`\n✅ Seed complete!`);
  console.log(`  Created: ${created}`);
  console.log(`  Skipped: ${skipped}`);
  console.log(`  Total: ${created + skipped}/${testCards.length}\n`);

  // Verify final count
  const finalCount = await prisma.canonicalCard.count();
  console.log(`📊 Total canonical_cards in database: ${finalCount}\n`);
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
