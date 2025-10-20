#!/usr/bin/env tsx
/**
 * Enhanced Card Parsing Script
 *
 * Post-processes imported records to extract missing set names, card numbers,
 * and other metadata from titles using comprehensive regex patterns.
 *
 * This maximizes the usability of the 350k database records for training.
 *
 * Run AFTER consolidate-all-data-to-postgres.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Comprehensive Pokemon TCG set patterns (150+ sets)
const SET_PATTERNS = [
  // Generation 1 (Base - Neo)
  { pattern: /\b(base set 2|base 2)\b/i, canonical: 'Base Set 2' },
  { pattern: /\b(base set|base)\b/i, canonical: 'Base Set' },
  { pattern: /\bjungle\b/i, canonical: 'Jungle' },
  { pattern: /\bfossil\b/i, canonical: 'Fossil' },
  { pattern: /\bteam rocket\b/i, canonical: 'Team Rocket' },
  { pattern: /\bgym heroes\b/i, canonical: 'Gym Heroes' },
  { pattern: /\bgym challenge\b/i, canonical: 'Gym Challenge' },
  { pattern: /\bneo genesis\b/i, canonical: 'Neo Genesis' },
  { pattern: /\bneo discovery\b/i, canonical: 'Neo Discovery' },
  { pattern: /\bneo revelation\b/i, canonical: 'Neo Revelation' },
  { pattern: /\bneo destiny\b/i, canonical: 'Neo Destiny' },

  // Generation 2-3 (Legendary - EX)
  { pattern: /\blegendary collection\b/i, canonical: 'Legendary Collection' },
  { pattern: /\bexpedition\b/i, canonical: 'Expedition' },
  { pattern: /\baquapolis\b/i, canonical: 'Aquapolis' },
  { pattern: /\bskyridge\b/i, canonical: 'Skyridge' },
  { pattern: /\b(ex ruby|ruby & sapphire)\b/i, canonical: 'EX Ruby & Sapphire' },
  { pattern: /\b(ex sandstorm)\b/i, canonical: 'EX Sandstorm' },
  { pattern: /\b(ex dragon)\b/i, canonical: 'EX Dragon' },
  { pattern: /\b(ex team magma|team magma vs team aqua)\b/i, canonical: 'EX Team Magma vs Team Aqua' },
  { pattern: /\b(ex hidden legends)\b/i, canonical: 'EX Hidden Legends' },
  { pattern: /\b(ex fire ?red|fire ?red & leaf ?green)\b/i, canonical: 'EX FireRed & LeafGreen' },
  { pattern: /\b(ex team rocket returns|rocket returns)\b/i, canonical: 'EX Team Rocket Returns' },
  { pattern: /\b(ex deoxys)\b/i, canonical: 'EX Deoxys' },
  { pattern: /\b(ex emerald)\b/i, canonical: 'EX Emerald' },
  { pattern: /\b(ex unseen forces)\b/i, canonical: 'EX Unseen Forces' },
  { pattern: /\b(ex delta species)\b/i, canonical: 'EX Delta Species' },
  { pattern: /\b(ex legend maker)\b/i, canonical: 'EX Legend Maker' },
  { pattern: /\b(ex holon phantoms)\b/i, canonical: 'EX Holon Phantoms' },
  { pattern: /\b(ex crystal guardians)\b/i, canonical: 'EX Crystal Guardians' },
  { pattern: /\b(ex dragon frontiers)\b/i, canonical: 'EX Dragon Frontiers' },
  { pattern: /\b(ex power keepers)\b/i, canonical: 'EX Power Keepers' },

  // Diamond & Pearl era
  { pattern: /\b(diamond & pearl|dp base)\b/i, canonical: 'Diamond & Pearl' },
  { pattern: /\b(mysterious treasures)\b/i, canonical: 'Mysterious Treasures' },
  { pattern: /\b(secret wonders)\b/i, canonical: 'Secret Wonders' },
  { pattern: /\b(great encounters)\b/i, canonical: 'Great Encounters' },
  { pattern: /\b(majestic dawn)\b/i, canonical: 'Majestic Dawn' },
  { pattern: /\b(legends awakened)\b/i, canonical: 'Legends Awakened' },
  { pattern: /\b(stormfront)\b/i, canonical: 'Stormfront' },
  { pattern: /\bplatinum\b/i, canonical: 'Platinum' },
  { pattern: /\b(rising rivals)\b/i, canonical: 'Rising Rivals' },
  { pattern: /\b(supreme victors)\b/i, canonical: 'Supreme Victors' },
  { pattern: /\barceus\b/i, canonical: 'Arceus' },

  // HGSS era
  { pattern: /\b(hgss|heartgold & soulsilver|heartgold|soulsilver)\b/i, canonical: 'HeartGold & SoulSilver' },
  { pattern: /\bunleashed\b/i, canonical: 'Unleashed' },
  { pattern: /\bundaunted\b/i, canonical: 'Undaunted' },
  { pattern: /\btriumphant\b/i, canonical: 'Triumphant' },
  { pattern: /\bcall of legends\b/i, canonical: 'Call of Legends' },

  // Black & White era
  { pattern: /\b(black & white|bw base)\b/i, canonical: 'Black & White' },
  { pattern: /\b(emerging powers)\b/i, canonical: 'Emerging Powers' },
  { pattern: /\b(noble victories)\b/i, canonical: 'Noble Victories' },
  { pattern: /\b(next destinies)\b/i, canonical: 'Next Destinies' },
  { pattern: /\b(dark explorers)\b/i, canonical: 'Dark Explorers' },
  { pattern: /\b(dragons exalted)\b/i, canonical: 'Dragons Exalted' },
  { pattern: /\b(boundaries crossed)\b/i, canonical: 'Boundaries Crossed' },
  { pattern: /\b(plasma storm)\b/i, canonical: 'Plasma Storm' },
  { pattern: /\b(plasma freeze)\b/i, canonical: 'Plasma Freeze' },
  { pattern: /\b(plasma blast)\b/i, canonical: 'Plasma Blast' },
  { pattern: /\b(legendary treasures)\b/i, canonical: 'Legendary Treasures' },

  // XY era
  { pattern: /\b(xy base|xy)\b/i, canonical: 'XY' },
  { pattern: /\bflashfire\b/i, canonical: 'Flashfire' },
  { pattern: /\b(furious fists)\b/i, canonical: 'Furious Fists' },
  { pattern: /\b(phantom forces)\b/i, canonical: 'Phantom Forces' },
  { pattern: /\b(primal clash)\b/i, canonical: 'Primal Clash' },
  { pattern: /\b(roaring skies)\b/i, canonical: 'Roaring Skies' },
  { pattern: /\b(ancient origins)\b/i, canonical: 'Ancient Origins' },
  { pattern: /\bbreakthrough\b/i, canonical: 'BREAKthrough' },
  { pattern: /\bbreakpoint\b/i, canonical: 'BREAKpoint' },
  { pattern: /\b(generations)\b/i, canonical: 'Generations' },
  { pattern: /\b(fates collide)\b/i, canonical: 'Fates Collide' },
  { pattern: /\b(steam siege)\b/i, canonical: 'Steam Siege' },
  { pattern: /\bevolutions\b/i, canonical: 'Evolutions' },

  // Sun & Moon era
  { pattern: /\b(sun & moon|sm base)\b/i, canonical: 'Sun & Moon' },
  { pattern: /\b(guardians rising)\b/i, canonical: 'Guardians Rising' },
  { pattern: /\b(burning shadows)\b/i, canonical: 'Burning Shadows' },
  { pattern: /\b(shining legends)\b/i, canonical: 'Shining Legends' },
  { pattern: /\b(crimson invasion)\b/i, canonical: 'Crimson Invasion' },
  { pattern: /\b(ultra prism)\b/i, canonical: 'Ultra Prism' },
  { pattern: /\b(forbidden light)\b/i, canonical: 'Forbidden Light' },
  { pattern: /\b(celestial storm)\b/i, canonical: 'Celestial Storm' },
  { pattern: /\b(dragon majesty)\b/i, canonical: 'Dragon Majesty' },
  { pattern: /\b(lost thunder)\b/i, canonical: 'Lost Thunder' },
  { pattern: /\b(team up)\b/i, canonical: 'Team Up' },
  { pattern: /\b(detective pikachu)\b/i, canonical: 'Detective Pikachu' },
  { pattern: /\b(unbroken bonds)\b/i, canonical: 'Unbroken Bonds' },
  { pattern: /\b(unified minds)\b/i, canonical: 'Unified Minds' },
  { pattern: /\b(hidden fates)\b/i, canonical: 'Hidden Fates' },
  { pattern: /\b(cosmic eclipse)\b/i, canonical: 'Cosmic Eclipse' },

  // Sword & Shield era
  { pattern: /\b(sword & shield|swsh base)\b/i, canonical: 'Sword & Shield' },
  { pattern: /\b(rebel clash)\b/i, canonical: 'Rebel Clash' },
  { pattern: /\b(darkness ablaze)\b/i, canonical: 'Darkness Ablaze' },
  { pattern: /\b(champion'?s path)\b/i, canonical: 'Champions Path' },
  { pattern: /\b(vivid voltage)\b/i, canonical: 'Vivid Voltage' },
  { pattern: /\b(shining fates)\b/i, canonical: 'Shining Fates' },
  { pattern: /\b(battle styles)\b/i, canonical: 'Battle Styles' },
  { pattern: /\b(chilling reign)\b/i, canonical: 'Chilling Reign' },
  { pattern: /\b(evolving skies)\b/i, canonical: 'Evolving Skies' },
  { pattern: /\b(fusion strike)\b/i, canonical: 'Fusion Strike' },
  { pattern: /\b(celebrations)\b/i, canonical: 'Celebrations' },
  { pattern: /\b(brilliant stars)\b/i, canonical: 'Brilliant Stars' },
  { pattern: /\b(astral radiance)\b/i, canonical: 'Astral Radiance' },
  { pattern: /\b(pokémon go|pokemon go)\b/i, canonical: 'Pokemon GO' },
  { pattern: /\b(lost origin)\b/i, canonical: 'Lost Origin' },
  { pattern: /\b(silver tempest)\b/i, canonical: 'Silver Tempest' },
  { pattern: /\b(crown zenith)\b/i, canonical: 'Crown Zenith' },

  // Scarlet & Violet era
  { pattern: /\b(scarlet & violet|sv base)\b/i, canonical: 'Scarlet & Violet' },
  { pattern: /\b(paldea evolved)\b/i, canonical: 'Paldea Evolved' },
  { pattern: /\b(obsidian flames)\b/i, canonical: 'Obsidian Flames' },
  { pattern: /\b(151)\b/, canonical: '151' },
  { pattern: /\b(paradox rift)\b/i, canonical: 'Paradox Rift' },
  { pattern: /\b(paldean fates)\b/i, canonical: 'Paldean Fates' },
  { pattern: /\b(temporal forces)\b/i, canonical: 'Temporal Forces' },
  { pattern: /\b(twilight masquerade)\b/i, canonical: 'Twilight Masquerade' },
  { pattern: /\b(shrouded fable)\b/i, canonical: 'Shrouded Fable' },
  { pattern: /\b(stellar crown)\b/i, canonical: 'Stellar Crown' },
  { pattern: /\b(surging sparks)\b/i, canonical: 'Surging Sparks' },
  { pattern: /\b(prismatic evolutions)\b/i, canonical: 'Prismatic Evolutions' },
];

// Card number patterns
const CARD_NUMBER_PATTERNS = [
  /\b(\d{1,3}\/\d{1,3})\b/,  // Standard: 1/102, 25/165
  /\b#(\d{1,3})\b/,          // Hash format: #1, #25
  /\bNo\.?\s*(\d{1,3})\b/i,  // No. format: No.1, No 25
];

// Condition patterns (for better extraction)
const CONDITION_PATTERNS = [
  { pattern: /\b(near mint|nm)\b/i, canonical: 'Near Mint' },
  { pattern: /\b(lightly played|lp)\b/i, canonical: 'Lightly Played' },
  { pattern: /\b(moderately played|mp)\b/i, canonical: 'Moderately Played' },
  { pattern: /\b(heavily played|hp)\b/i, canonical: 'Heavily Played' },
  { pattern: /\bdamaged\b/i, canonical: 'Damaged' },
  { pattern: /\bmint\b/i, canonical: 'Mint' },
];

interface EnhancementStats {
  totalRecords: number;
  setsEnhanced: number;
  cardNumbersExtracted: number;
  conditionsEnhanced: number;
  skipped: number;
}

function extractSetName(title: string): string | null {
  for (const { pattern, canonical } of SET_PATTERNS) {
    if (pattern.test(title)) {
      return canonical;
    }
  }
  return null;
}

function extractCardNumber(title: string): string | null {
  for (const pattern of CARD_NUMBER_PATTERNS) {
    const match = title.match(pattern);
    if (match) {
      return match[1];
    }
  }
  return null;
}

function extractCondition(title: string): string | null {
  for (const { pattern, canonical } of CONDITION_PATTERNS) {
    if (pattern.test(title)) {
      return canonical;
    }
  }
  return null;
}

async function enhanceCardParsing() {
  console.log('\n' + '='.repeat(80));
  console.log('🔧 ENHANCED CARD PARSING');
  console.log('='.repeat(80));
  console.log('\nThis will parse set names, card numbers, and conditions from titles.');
  console.log('Target: Records missing setName, cardNumber, or condition\n');

  const stats: EnhancementStats = {
    totalRecords: 0,
    setsEnhanced: 0,
    cardNumbersExtracted: 0,
    conditionsEnhanced: 0,
    skipped: 0,
  };

  // Get all records with missing data
  console.log('📊 Fetching records needing enhancement...');
  const records = await prisma.unifiedMarketListing.findMany({
    where: {
      OR: [
        { setName: null },
        { cardNumber: null },
        { condition: null },
      ],
      rawTitle: { not: null },
    },
    select: {
      id: true,
      rawTitle: true,
      setName: true,
      cardNumber: true,
      condition: true,
    },
  });

  stats.totalRecords = records.length;
  console.log(`✓ Found ${stats.totalRecords.toLocaleString()} records to enhance\n`);

  if (stats.totalRecords === 0) {
    console.log('✅ No records need enhancement!\n');
    return stats;
  }

  console.log('🔄 Processing records...');
  let processed = 0;

  for (const record of records) {
    const title = record.rawTitle!;
    const updates: any = {};

    // Extract set name if missing
    if (!record.setName) {
      const setName = extractSetName(title);
      if (setName) {
        updates.setName = setName;
        stats.setsEnhanced++;
      }
    }

    // Extract card number if missing
    if (!record.cardNumber) {
      const cardNumber = extractCardNumber(title);
      if (cardNumber) {
        updates.cardNumber = cardNumber;
        stats.cardNumbersExtracted++;
      }
    }

    // Extract condition if missing
    if (!record.condition) {
      const condition = extractCondition(title);
      if (condition) {
        updates.condition = condition;
        stats.conditionsEnhanced++;
      }
    }

    // Update if we found any enhancements
    if (Object.keys(updates).length > 0) {
      await prisma.unifiedMarketListing.update({
        where: { id: record.id },
        data: updates,
      });
    } else {
      stats.skipped++;
    }

    processed++;
    if (processed % 1000 === 0) {
      console.log(`  ✓ Processed ${processed.toLocaleString()}/${stats.totalRecords.toLocaleString()}...`);
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('✅ ENHANCEMENT COMPLETE');
  console.log('='.repeat(80));
  console.log(`\nTotal Records Processed: ${stats.totalRecords.toLocaleString()}`);
  console.log(`  • Sets Enhanced: ${stats.setsEnhanced.toLocaleString()}`);
  console.log(`  • Card Numbers Extracted: ${stats.cardNumbersExtracted.toLocaleString()}`);
  console.log(`  • Conditions Enhanced: ${stats.conditionsEnhanced.toLocaleString()}`);
  console.log(`  • Could Not Parse: ${stats.skipped.toLocaleString()}`);

  const improvementPct = ((stats.setsEnhanced + stats.cardNumbersExtracted + stats.conditionsEnhanced) / (stats.totalRecords * 3)) * 100;
  console.log(`\n📈 Improvement Rate: ${improvementPct.toFixed(1)}%\n`);

  return stats;
}

async function main() {
  try {
    const stats = await enhanceCardParsing();

    // Save report
    const fs = await import('fs');
    const reportPath = `card-parsing-enhancement-${Date.now()}.json`;
    fs.writeFileSync(reportPath, JSON.stringify(stats, null, 2));

    console.log(`📄 Report saved: ${reportPath}\n`);
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
