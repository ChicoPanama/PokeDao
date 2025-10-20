#!/usr/bin/env tsx
/**
 * COMPREHENSIVE DATA AUDIT FOR MEW-1A v4.2
 * Audits ALL data sources to ensure nothing is missed
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
    'UnifiedMarketListing',
    'reddit_signals',
    'Card',
    'CompSale',
    'Listing',
    'sale_records',
    'market_listings',
    'canonical_cards',
    'official_pokemon_cards',
  ];

  for (const table of tables) {
    try {
      const result: any = await prisma.$queryRawUnsafe(`SELECT COUNT(*) as count FROM "${table}"`);
      const count = parseInt(result[0].count);

      dataSources.push({
        name: table,
        type: 'PostgreSQL',
        location: `postgres://${table}`,
        recordCount: count,
        size: '-',
        status: count > 0 ? 'partial' : 'unknown',
        notes: `PostgreSQL table`,
      });

      console.log(`  ${table}: ${count.toLocaleString()} records`);
    } catch (error) {
      console.error(`  ${table}: Error`);
    }
  }
}

function auditJSONFiles() {
  console.log('\n🔍 AUDITING JSON/JSONL FILES...\n');

  const directories = ['training', 'analysis', 'research', 'phygitals', 'collector-crypt', 'courtyard', 'tcgdex'];

  for (const dir of directories) {
    const fullPath = path.join(process.cwd(), 'data', dir);
    if (!fs.existsSync(fullPath)) continue;

    const files = fs.readdirSync(fullPath).filter(f => f.endsWith('.json') || f.endsWith('.jsonl'));

    for (const file of files) {
      const filePath = path.join(fullPath, file);
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

        let status: 'converted' | 'unconverted' | 'partial' | 'unknown' = 'unknown';
        if (dir === 'training' && file.includes('mew1a-v4.1-FINAL-ULTIMATE')) {
          status = 'converted';
        } else if (dir === 'training' || dir === 'analysis') {
          status = 'partial';
        } else {
          status = 'unconverted';
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

        console.log(`  ${dir}/${file}: ${count.toLocaleString()} (${sizeInMB} MB)`);
      } catch (error) {
        console.error(`  ${dir}/${file}: Parse error`);
      }
    }
  }
}

function auditSQLiteDatabases() {
  console.log('\n🔍 AUDITING SQLITE DATABASES...\n');

  const backupDir = path.join(process.cwd(), 'research-backup-20250911-172521/databases');
  const subdirs = ['tcgplayer-discovery', 'fanatics-collect-discovery'];

  for (const subdir of subdirs) {
    const fullPath = path.join(backupDir, subdir);
    if (!fs.existsSync(fullPath)) continue;

    const dbFiles = fs.readdirSync(fullPath).filter(f => f.endsWith('.db'));

    for (const dbFile of dbFiles) {
      const dbPath = path.join(fullPath, dbFile);
      const stats = fs.statSync(dbPath);
      const sizeInMB = (stats.size / (1024 * 1024)).toFixed(2);

      if (stats.size < 1024) continue;

      try {
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
          } catch {
            // Skip
          }
        }

        dataSources.push({
          name: dbFile,
          type: 'SQLite',
          location: `research-backup/${subdir}/${dbFile}`,
          recordCount: totalRecords,
          size: `${sizeInMB} MB`,
          status: 'unconverted',
          notes: `${tables.length} tables`,
        });

        console.log(`  ${dbFile}: ${totalRecords.toLocaleString()} records (${sizeInMB} MB)`);
      } catch (error) {
        console.error(`  ${dbFile}: Error reading`);
      }
    }
  }
}

function generateReport() {
  console.log('\n\n📊 DATA AUDIT REPORT\n');
  console.log('='.repeat(100));

  const converted = dataSources.filter(ds => ds.status === 'converted');
  const unconverted = dataSources.filter(ds => ds.status === 'unconverted');
  const partial = dataSources.filter(ds => ds.status === 'partial');

  console.log('\n✅ CONVERTED (IN v4.1):');
  converted.forEach(ds => console.log(`  ${ds.name}: ${ds.recordCount.toLocaleString()} records`));

  console.log('\n⚠️  UNCONVERTED (NEEDS EXTRACTION):');
  unconverted.forEach(ds => console.log(`  ${ds.name}: ${ds.recordCount.toLocaleString()} records (${ds.size})`));

  console.log('\n🔄 PARTIAL (NEEDS REVIEW):');
  partial.forEach(ds => console.log(`  ${ds.name}: ${ds.recordCount.toLocaleString()} records`));

  const totalConverted = converted.reduce((sum, ds) => sum + ds.recordCount, 0);
  const totalUnconverted = unconverted.reduce((sum, ds) => sum + ds.recordCount, 0);
  const totalPartial = partial.reduce((sum, ds) => sum + ds.recordCount, 0);

  console.log('\n📈 SUMMARY:');
  console.log(`  Converted: ${totalConverted.toLocaleString()} (${converted.length} sources)`);
  console.log(`  Unconverted: ${totalUnconverted.toLocaleString()} (${unconverted.length} sources)`);
  console.log(`  Partial: ${totalPartial.toLocaleString()} (${partial.length} sources)`);
  console.log(`  TOTAL: ${(totalConverted + totalUnconverted + totalPartial).toLocaleString()}`);

  const reportPath = path.join(process.cwd(), 'data-audit-report.json');
  fs.writeFileSync(reportPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    summary: { totalConverted, totalUnconverted, totalPartial },
    sources: dataSources,
  }, null, 2));

  console.log(`\n✓ Report saved: data-audit-report.json`);
}

async function main() {
  console.log('🚀 COMPREHENSIVE DATA AUDIT FOR MEW-1A v4.2\n');

  await auditPostgreSQL();
  auditJSONFiles();
  auditSQLiteDatabases();
  generateReport();

  await prisma.$disconnect();
  console.log('\n✅ AUDIT COMPLETE!\n');
}

main().catch(console.error);
