/**
 * Import Phygitals Helius NFT Data to Production Database
 *
 * Source: data/phygitals/helius-complete-harvest.json
 * Contains: 20,487 Pokemon card NFTs from Solana blockchain
 *
 * Run: pnpm tsx scripts/import-phygitals-helius.ts
 */

import { PrismaClient, GradeCompany } from '@prisma/client';
import { readFileSync } from 'fs';

const prisma = new PrismaClient();

const HELIUS_FILE = 'data/phygitals/helius-complete-harvest.json';
const BATCH_SIZE = 100;

interface PhygitalsNFT {
  mint: string;
  name: string;
  uri: string;
  owner: string;
  creators: Array<{
    address: string;
    share: number;
    verified: boolean;
  }>;
  attributes: Array<{
    value: string | number;
    trait_type: string;
  }>;
  metadata?: any;
}

interface HarvestData {
  metadata: {
    harvestedAt: string;
    duration: string;
    source: string;
    totalNFTs: number;
  };
  nfts: PhygitalsNFT[];
}

async function importPhygitals() {
  console.log('🚀 PHYGITALS HELIUS NFT IMPORTER');
  console.log('============================================================\n');

  // Read harvest file
  console.log(`📂 Loading: ${HELIUS_FILE}`);
  const data: HarvestData = JSON.parse(readFileSync(HELIUS_FILE, 'utf-8'));

  console.log(`✅ Loaded ${data.nfts.length.toLocaleString()} NFTs\n`);
  console.log('📊 Harvest Metadata:');
  console.log(`   Source: ${data.metadata.source}`);
  console.log(`   Harvested: ${new Date(data.metadata.harvestedAt).toLocaleString()}`);
  console.log(`   Duration: ${data.metadata.duration}`);
  console.log();

  const stats = {
    total: 0,
    imported: 0,
    skipped: 0,
    errors: 0,
    byGrader: {} as Record<string, number>,
    byCategory: {} as Record<string, number>,
  };

  let batch: any[] = [];

  for (let i = 0; i < data.nfts.length; i++) {
    const nft = data.nfts[i];
    stats.total++;

    try {
      // Extract attributes
      const cardName = getAttr(nft.attributes, 'Name') || nft.name;
      const setName = getAttr(nft.attributes, 'Set') || 'Unknown';
      const cardNumber = getAttr(nft.attributes, 'Number');
      const grade = parseGrade(getAttr(nft.attributes, 'Grade'));
      const gradeCompany = parseGradeCompany(getAttr(nft.attributes, 'Grader'));
      const category = getAttr(nft.attributes, 'Category') || 'Pokemon';
      const title = getAttr(nft.attributes, 'Title') || nft.name;
      const certNumber = getAttr(nft.attributes, 'Cert Number');
      const language = getAttr(nft.attributes, 'Language') || 'English';

      // Track stats
      const graderKey = gradeCompany || 'RAW';
      stats.byGrader[graderKey] = (stats.byGrader[graderKey] || 0) + 1;
      stats.byCategory[category] = (stats.byCategory[category] || 0) + 1;

      // Create listing record
      batch.push({
        id: `phygitals-${nft.mint}`,
        source: 'PHYGITALS',
        sourceId: nft.mint,
        title: title.substring(0, 500),
        rawTitle: nft.name.substring(0, 500),
        cardName: cardName ? cardName.substring(0, 255) : null,
        setName: setName ? setName.substring(0, 255) : null,
        cardNumber: cardNumber ? cardNumber.substring(0, 10) : null,
        gradeCompany: gradeCompany,
        grade: grade,
        priceCents: 0, // No pricing in Helius data
        currency: 'USD',
        url: `https://www.phygitals.com/nft/${nft.mint}`,
        dataQuality: 0.85, // High quality - on-chain data
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Save batch
      if (batch.length >= BATCH_SIZE) {
        await saveBatch(batch);
        stats.imported += batch.length;
        batch = [];

        // Progress update
        const percent = ((i + 1) / data.nfts.length * 100).toFixed(1);
        process.stdout.write(`\r📊 Progress: ${stats.imported.toLocaleString()}/${data.nfts.length.toLocaleString()} (${percent}%)`);
      }

    } catch (error: any) {
      stats.errors++;
      if (stats.errors < 10) {
        console.error(`\n  ⚠️  Error on NFT ${nft.mint}:`, error.message);
      }
    }
  }

  // Save remaining batch
  if (batch.length > 0) {
    await saveBatch(batch);
    stats.imported += batch.length;
  }

  console.log('\n\n✅ IMPORT COMPLETE');
  console.log('============================================================');
  console.log(`Total NFTs: ${stats.total.toLocaleString()}`);
  console.log(`Imported: ${stats.imported.toLocaleString()}`);
  console.log(`Skipped: ${stats.skipped.toLocaleString()}`);
  console.log(`Errors: ${stats.errors.toLocaleString()}`);
  console.log('============================================================\n');

  console.log('🏆 By Grading Company:');
  Object.entries(stats.byGrader)
    .sort((a, b) => b[1] - a[1])
    .forEach(([grader, count]) => {
      console.log(`   ${grader}: ${count.toLocaleString()}`);
    });
  console.log();

  console.log('📊 By Category:');
  Object.entries(stats.byCategory)
    .sort((a, b) => b[1] - a[1])
    .forEach(([cat, count]) => {
      console.log(`   ${cat}: ${count.toLocaleString()}`);
    });
  console.log();
}

async function saveBatch(batch: any[]) {
  for (const item of batch) {
    try {
      await prisma.unifiedMarketListing.upsert({
        where: {
          source_sourceId: {
            source: 'PHYGITALS',
            sourceId: item.sourceId,
          },
        },
        create: item,
        update: {
          updatedAt: new Date(),
        },
      });
    } catch (error) {
      // Skip duplicates
      continue;
    }
  }
}

// Helper: Get attribute value by trait_type
function getAttr(attributes: Array<{ value: string | number; trait_type: string }>, name: string): string | null {
  const attr = attributes.find(a => a.trait_type === name);
  return attr ? String(attr.value) : null;
}

// Parse grade from "CGC 10", "PSA 9.5", etc.
function parseGrade(gradeStr: string | null): number | null {
  if (!gradeStr) return null;

  const match = String(gradeStr).match(/(\d+(?:\.\d+)?)/);
  return match ? parseFloat(match[1]) : null;
}

// Parse grading company
function parseGradeCompany(grader: string | null): GradeCompany | null {
  if (!grader) return null;

  const graderUpper = String(grader).toUpperCase();

  if (graderUpper.includes('PSA')) return 'PSA';
  if (graderUpper.includes('BGS') || graderUpper.includes('BECKETT')) return 'BGS';
  if (graderUpper.includes('CGC')) return 'CGC';
  if (graderUpper.includes('SGC')) return 'SGC';
  if (graderUpper.includes('ACE')) return 'ACE';
  if (graderUpper === 'RAW' || graderUpper === 'UNGRADED') return 'RAW';

  return 'OTHER';
}

// Run import
importPhygitals()
  .then(async () => {
    await prisma.$disconnect();
    process.exit(0);
  })
  .catch(async (error) => {
    console.error('❌ Fatal error:', error);
    await prisma.$disconnect();
    process.exit(1);
  });
