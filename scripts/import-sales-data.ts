/**
 * IMPORT SALES DATA TO DATABASE
 * Imports comp sales from JSON files directly into sale_records table
 */

import { PrismaClient, MarketSource } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import { createHash } from 'crypto';

const prisma = new PrismaClient();

interface CompSaleJSON {
  setCode?: string | null;
  number?: string | null;
  variantKey?: string;
  priceCents: number;
  currency: string;
  soldAt: string;
  source: string;
  externalId: string;
  title: string;
  condition?: string | null;
  grade?: string | null;
}

async function importSalesData() {
  console.log('📦 IMPORTING SALES DATA TO DATABASE');
  console.log('='.repeat(80));
  console.log('');

  const compFiles = [
    { path: 'data/research/comps_ebay_db.json', source: 'EBAY' },
    { path: 'data/research/comps_collectorcrypt.json', source: 'COLLECTOR_CRYPT' },
    { path: 'data/research/comps_fanatics_sold.json', source: 'FANATICS' },
  ];

  let totalImported = 0;

  for (const file of compFiles) {
    const filePath = path.join(process.cwd(), file.path);

    if (!fs.existsSync(filePath)) {
      console.warn(`⚠️  File not found: ${filePath}`);
      continue;
    }

    console.log(`Processing: ${file.path}`);

    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const comps: CompSaleJSON[] = JSON.parse(fileContent);

    console.log(`  Found ${comps.length} sales records`);

    // Process in batches
    const batchSize = 500;
    for (let i = 0; i < comps.length; i += batchSize) {
      const batch = comps.slice(i, i + batchSize);

      const records = batch
        .filter((comp) => comp.priceCents > 0) // Skip invalid prices
        .map((comp) => {
          // Extract card name from title
          const cardName = extractCardName(comp.title);

          // Extract set name from title
          const setName = extractSetName(comp.title);

          // Extract grading info
          const { gradeCompany, grade } = extractGrading(comp.title, comp.grade);

          // Generate unique ID
          const id = createHash('sha256')
            .update(`${file.source}::${comp.externalId}`)
            .digest('hex')
            .substring(0, 32);

          return {
            id,
            source: file.source as MarketSource,
            sourceId: comp.externalId,
            sourceUrl: null,
            cardName,
            setName,
            cardNumber: comp.number || null,
            variant: comp.variantKey || null,
            gradeCompany,
            grade: grade ? parseFloat(grade) : null,
            condition: comp.condition || null,
            soldPriceCents: comp.priceCents,
            totalBuyerCostCents: comp.priceCents,
            soldAt: new Date(comp.soldAt),
            currency: comp.currency || 'USD',
            dataQuality: 0.7, // Medium quality for imported data
          };
        });

      // Upsert to database
      await prisma.$transaction(
        records.map((record) =>
          prisma.saleRecord.upsert({
            where: { id: record.id },
            create: record,
            update: {
              soldPriceCents: record.soldPriceCents,
              soldAt: record.soldAt,
              dataQuality: record.dataQuality,
            },
          })
        )
      );

      totalImported += records.length;
      process.stdout.write(`\r  Imported: ${totalImported} records`);
    }

    console.log('');
  }

  console.log('');
  console.log('='.repeat(80));
  console.log(`✅ IMPORT COMPLETE: ${totalImported} sale records imported`);
  console.log('='.repeat(80));

  // Verify
  const count = await prisma.saleRecord.count();
  console.log('');
  console.log(`Database verification: ${count} total sale_records`);
  console.log('');

  await prisma.$disconnect();
}

/**
 * Extract card name from title (simplified heuristic)
 */
function extractCardName(title?: string): string {
  if (!title) return 'Unknown';

  // Remove year prefixes like "2020", "1999"
  let clean = title.replace(/^\d{4}\s+/, '');

  // Remove set names at the end
  clean = clean.replace(/(Base Set|Jungle|Fossil|Team Rocket|Hidden Fates|Evolutions)\s+(NM|LP|MP|Played|Pokemon Card)$/i, '');

  // Remove condition at the end
  clean = clean.replace(/\s+(NM|LP|MP|Played|Pokemon Card)$/i, '');

  // Extract first word (usually the Pokemon name)
  const words = clean.trim().split(' ');
  if (words.length > 0 && words[0]) {
    return words[0];
  }

  return title || 'Unknown';
}

/**
 * Extract set name from title
 */
function extractSetName(title?: string): string | null {
  if (!title) return null;

  const sets = [
    'Base Set',
    'Jungle',
    'Fossil',
    'Team Rocket',
    'Hidden Fates',
    'Evolutions',
    'Obsidian Flames',
    'Paldean Fates',
    'Stellar Crown',
  ];

  for (const set of sets) {
    if (title.toLowerCase().includes(set.toLowerCase())) {
      return set;
    }
  }

  return null;
}

/**
 * Extract grading information
 */
function extractGrading(title?: string, gradeField?: string | null): { gradeCompany: string | null; grade: string | null } {
  if (!title) {
    return gradeField ? { gradeCompany: null, grade: gradeField } : { gradeCompany: null, grade: null };
  }

  // Check for PSA
  const psaMatch = title.match(/PSA\s*(\d+(?:\.\d+)?)/i);
  if (psaMatch) {
    return { gradeCompany: 'PSA', grade: psaMatch[1] };
  }

  // Check for BGS
  const bgsMatch = title.match(/BGS\s*(\d+(?:\.\d+)?)/i);
  if (bgsMatch) {
    return { gradeCompany: 'BGS', grade: bgsMatch[1] };
  }

  // Check for CGC
  const cgcMatch = title.match(/CGC\s*(\d+(?:\.\d+)?)/i);
  if (cgcMatch) {
    return { gradeCompany: 'CGC', grade: cgcMatch[1] };
  }

  // Use grade field if provided
  if (gradeField) {
    return { gradeCompany: null, grade: gradeField };
  }

  return { gradeCompany: null, grade: null };
}

importSalesData();
