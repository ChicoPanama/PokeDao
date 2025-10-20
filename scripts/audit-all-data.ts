#!/usr/bin/env tsx
/**
 * COMPREHENSIVE DATA AUDIT FOR MEW-1A v4.2
 *
 * This script audits ALL data sources across the project to ensure nothing is missed:
 * 1. PostgreSQL database tables
 * 2. JSON/JSONL data files
 * 3. SQLite databases (research backup)
 * 4. Analysis outputs
 * 5. Training datasets
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

const prisma = new PrismaClient();

interface DataSource {
  name: string;
  type: string;
  location: string;
  recordCount: number;
  size: string;
  status: 'converted' | 'unconverted' | 'partial' | 'unknown';
  notes: string;
}

const dataSources: DataSource[] = [];

async function auditPostgreSQL() {
  console.log('\n🔍 AUDITING POSTGRESQL DATABASE...\n');

  const tables = [
    { name: 'UnifiedMarketListing', description: 'Market listings from all platforms' },
    { name: 'reddit_signals', description: 'Reddit sentiment signals' },
    { name: 'Card', description: 'Card master data' },
    { name: 'CompSale', description: 'Comparable sales' },
    { name: 'Listing', description: 'Active listings' },
    { name: 'sale_records', description: 'Historical sales' },
    { name: 'market_listings', description: 'Market data' },
    { name: 'canonical_cards', description: 'Canonical card reference' },
    { name: 'official_pokemon_cards', description: 'Official Pokemon card data' },
  ];

  for (const table of tables) {
    try {
      const result: any = await prisma.$queryRawUnsafe(`SELECT COUNT(*) as count FROM "${table.name}"`);
      const count = parseInt(result[0].count);

      dataSources.push({
        name: table.name,
        type: 'PostgreSQL Table',
        location: 'postgres://localhost:5432/pokedao',
        recordCount: count,
        size: '-',
        status: count > 0 ? 'converted' : 'unknown',
        notes: table.description,
      });

      console.log(`✓ ${table.name}: ${count.toLocaleString()} records`);
    } catch (error) {
      console.error(`✗ ${table.name}: Error - ${error}`);
    }
  }
}

function auditJSONFiles() {
  console.log('\n🔍 AUDITING JSON/JSONL DATA FILES...\n');

  const dataDir = '/Users/arcadio/dev/pokedao/data';
  const directories = [
    'training',
    'analysis',
    'research',
    'phygitals',
    'collector-crypt',
    'courtyard',
    'tcgdex',
  ];

  for (const dir of directories) {
    const fullPath = path.join(dataDir, dir);
    if (!fs.existsSync(fullPath)) continue;

    const files = fs.readdirSync(fullPath).filter(f => f.endsWith('.json') || f.endsWith('.jsonl'));

    for (const file of files) {
      const filePath = path.join(fullPath, file);
      const stats = fs.statSync(filePath);
      const sizeInMB = (stats.size / (1024 * 1024)).toFixed(2);

      let count = 0;
      let status: 'converted' | 'unconverted' | 'partial' | 'unknown' = 'unknown';

      try {
        if (file.endsWith('.jsonl')) {
          const content = fs.readFileSync(filePath, 'utf-8');
          count = content.trim().split('\n').filter(line => line.trim()).length;

          // Check if it's a training file
          if (dir === 'training' && file.includes('mew1a')) {
            status = 'converted';
          }
        } else {
          const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
          count = Array.isArray(content) ? content.length : 1;
        }

        dataSources.push({
          name: file,
          type: file.endsWith('.jsonl') ? 'JSONL' : 'JSON',
          location: `data/${dir}/${file}`,
          recordCount: count,
          size: `${sizeInMB} MB`,
          status,
          notes: `${dir} data`,
        });

        console.log(`✓ ${dir}/${file}: ${count.toLocaleString()} records (${sizeInMB} MB)`);
      } catch (error) {
        console.error(`✗ ${dir}/${file}: Parse error`);
      }
    }
  }

  // Check root data directory
  const rootFiles = fs.readdirSync(dataDir).filter(f => f.endsWith('.json') || f.endsWith('.jsonl'));
  for (const file of rootFiles) {
    const filePath = path.join(dataDir, file);
    const stats = fs.statSync(filePath);
    const sizeInMB = (stats.size / (1024 * 1024)).toFixed(2);

    let count = 0;
    try {
      if (file.endsWith('.jsonl')) {
        const content = fs.readFileSync(filePath, 'utf-8');
        count = content.trim().split('\n').filter(line => line.trim()).length;
      } else {
        const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        count = Array.isArray(content) ? content.length : 1;
      }

      dataSources.push({
        name: file,
        type: file.endsWith('.jsonl') ? 'JSONL' : 'JSON',
        location: `data/${file}`,
        recordCount: count,
        size: `${sizeInMB} MB`,
        status: 'unknown',
        notes: 'Root data file',
      });

      console.log(`✓ ${file}: ${count.toLocaleString()} records (${sizeInMB} MB)`);
    } catch (error) {
      console.error(`✗ ${file}: Parse error`);
    }
  }
}

function auditSQLiteDatabases() {
  console.log('\n🔍 AUDITING SQLITE DATABASES (RESEARCH BACKUP)...\n');

  const backupDir = '/Users/arcadio/dev/pokedao/research-backup-20250911-172521/databases';
  const subdirs = ['tcgplayer-discovery', 'fanatics-collect-discovery'];

  for (const subdir of subdirs) {
    const fullPath = path.join(backupDir, subdir);
    if (!fs.existsSync(fullPath)) continue;

    const dbFiles = fs.readdirSync(fullPath).filter(f => f.endsWith('.db'));

    for (const dbFile of dbFiles) {
      const dbPath = path.join(fullPath, dbFile);
      const stats = fs.statSync(dbPath);
      const sizeInMB = (stats.size / (1024 * 1024)).toFixed(2);

      // Skip empty databases
      if (stats.size < 1024) {
        console.log(`⊘ ${subdir}/${dbFile}: Empty (${sizeInMB} MB)`);
        continue;
      }

      try {
        // Get table names
        const tablesOutput = execSync(
          `sqlite3 "${dbPath}" "SELECT name FROM sqlite_master WHERE type='table';"`,
          { encoding: 'utf-8' }
        );
        const tables = tablesOutput.trim().split('\n').filter(t => t && !t.startsWith('sqlite_'));

        let totalRecords = 0;
        for (const table of tables) {
          try {
            const countOutput = execSync(
              `sqlite3 "${dbPath}" "SELECT COUNT(*) FROM ${table};"`,
              { encoding: 'utf-8' }
            );
            totalRecords += parseInt(countOutput.trim());
          } catch (error) {
            // Skip if error
          }
        }

        dataSources.push({
          name: dbFile,
          type: 'SQLite DB',
          location: `research-backup/${subdir}/${dbFile}`,
          recordCount: totalRecords,
          size: `${sizeInMB} MB`,
          status: totalRecords > 0 ? 'unconverted' : 'unknown',
          notes: `${tables.length} tables: ${tables.join(', ')}`,
        });

        console.log(`✓ ${subdir}/${dbFile}: ${totalRecords.toLocaleString()} records across ${tables.length} tables (${sizeInMB} MB)`);
      } catch (error) {
        console.error(`✗ ${subdir}/${dbFile}: Error reading database`);
      }
    }
  }
}

function generateReport() {
  console.log('\n\n📊 COMPREHENSIVE DATA AUDIT REPORT\n');
  console.log('='.repeat(120));

  // Group by status
  const converted = dataSources.filter(ds => ds.status === 'converted');
  const unconverted = dataSources.filter(ds => ds.status === 'unconverted');
  const unknown = dataSources.filter(ds => ds.status === 'unknown');

  console.log('\n✅ CONVERTED TO TRAINING DATA:');
  console.log('-'.repeat(120));
  converted.forEach(ds => {
    console.log(`${ds.name.padEnd(50)} | ${ds.recordCount.toLocaleString().padStart(10)} records | ${ds.size.padStart(10)} | ${ds.notes}`);
  });

  console.log('\n⚠️  UNCONVERTED DATA (NEEDS EXTRACTION):');
  console.log('-'.repeat(120));
  unconverted.forEach(ds => {
    console.log(`${ds.name.padEnd(50)} | ${ds.recordCount.toLocaleString().padStart(10)} records | ${ds.size.padStart(10)} | ${ds.notes}`);
  });

  console.log('\n❓ UNKNOWN STATUS (NEEDS REVIEW):');
  console.log('-'.repeat(120));
  unknown.forEach(ds => {
    console.log(`${ds.name.padEnd(50)} | ${ds.recordCount.toLocaleString().padStart(10)} records | ${ds.size.padStart(10)} | ${ds.notes}`);
  });

  // Summary statistics
  const totalConverted = converted.reduce((sum, ds) => sum + ds.recordCount, 0);
  const totalUnconverted = unconverted.reduce((sum, ds) => sum + ds.recordCount, 0);
  const totalUnknown = unknown.reduce((sum, ds) => sum + ds.recordCount, 0);

  console.log('\n\n📈 SUMMARY:');
  console.log('='.repeat(120));
  console.log(`Total Converted:     ${totalConverted.toLocaleString()} records across ${converted.length} sources`);
  console.log(`Total Unconverted:   ${totalUnconverted.toLocaleString()} records across ${unconverted.length} sources`);
  console.log(`Total Unknown:       ${totalUnknown.toLocaleString()} records across ${unknown.length} sources`);
  console.log(`\nGRAND TOTAL:         ${(totalConverted + totalUnconverted + totalUnknown).toLocaleString()} records`);

  // Save report to JSON
  const reportPath = '/Users/arcadio/dev/pokedao/data-audit-report.json';
  fs.writeFileSync(reportPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    summary: {
      totalConverted,
      totalUnconverted,
      totalUnknown,
      convertedSources: converted.length,
      unconvertedSources: unconverted.length,
      unknownSources: unknown.length,
    },
    sources: dataSources,
  }, null, 2));

  console.log(`\n✓ Full report saved to: ${reportPath}`);
}

async function main() {
  console.log('🚀 STARTING COMPREHENSIVE DATA AUDIT FOR MEW-1A v4.2\n');
  console.log('This will scan ALL data sources in the project...\n');

  await auditPostgreSQL();
  auditJSONFiles();
  auditSQLiteDatabases();
  generateReport();

  await prisma.$disconnect();

  console.log('\n✅ AUDIT COMPLETE!\n');
}

main().catch(console.error);
