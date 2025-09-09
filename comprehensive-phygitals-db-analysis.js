/**
 * COMPREHENSIVE PHYGITALS DATABASE ANALYSIS
 * Check all Phygitals databases for total record counts
 */

const Database = require('better-sqlite3');
const fs = require('fs');

class PhygitalsDbAnalysis {
  constructor() {
    this.results = {
      totalRecords: 0,
      databases: [],
      potentialSources: []
    };
  }

  async analyzeAllPhygitalsDbases() {
    console.log('🔍 COMPREHENSIVE PHYGITALS DATABASE ANALYSIS');
    console.log('===========================================');

    const dbFiles = [
      './research/tcgplayer-discovery/phygitals_complete_all.db',
      './research/tcgplayer-discovery/phygitals_pokemon_complete.db',
      './research/tcgplayer-discovery/phygitals_pokemon_complete_v2.db', 
      './research/tcgplayer-discovery/phygitals_mega_harvest.db',
      './research/fanatics-collect-discovery/phygitals_pokemon_complete.db'
    ];

    for (const dbFile of dbFiles) {
      if (fs.existsSync(dbFile)) {
        await this.analyzeDatabase(dbFile);
      } else {
        console.log(`❌ Database not found: ${dbFile}`);
      }
    }

    this.generateSummary();
  }

  async analyzeDatabase(dbPath) {
    console.log(`\n📊 ANALYZING: ${dbPath}`);
    console.log('─'.repeat(50));

    try {
      const db = new Database(dbPath);
      
      // Get database size
      const stats = fs.statSync(dbPath);
      const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
      console.log(`   💾 File size: ${sizeMB}MB`);

      // Get all tables
      const tables = db.prepare(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name NOT LIKE 'sqlite_%'
      `).all();

      console.log(`   📋 Tables found: ${tables.map(t => t.name).join(', ')}`);

      let dbTotalRecords = 0;
      const tableDetails = {};

      // Analyze each table
      for (const table of tables) {
        try {
          const countResult = db.prepare(`SELECT COUNT(*) as count FROM ${table.name}`).get();
          const recordCount = countResult.count;
          dbTotalRecords += recordCount;
          
          console.log(`   📊 ${table.name}: ${recordCount.toLocaleString()} records`);
          
          // Sample a few records to understand the data
          const sample = db.prepare(`SELECT * FROM ${table.name} LIMIT 3`).all();
          
          tableDetails[table.name] = {
            records: recordCount,
            sampleRecord: sample[0] || null
          };

          // Check if this could be the source of 50,000
          if (recordCount >= 40000) {
            console.log(`   🎯 LARGE TABLE FOUND! ${table.name} has ${recordCount.toLocaleString()} records`);
            this.results.potentialSources.push({
              database: dbPath,
              table: table.name,
              records: recordCount,
              size: sizeMB
            });
          }

        } catch (error) {
          console.log(`   ❌ Error analyzing table ${table.name}: ${error.message}`);
        }
      }

      // Store database analysis
      this.results.databases.push({
        path: dbPath,
        sizeMB: parseFloat(sizeMB),
        totalRecords: dbTotalRecords,
        tables: tableDetails
      });

      this.results.totalRecords += dbTotalRecords;

      console.log(`   ✅ Database total: ${dbTotalRecords.toLocaleString()} records`);

      db.close();

    } catch (error) {
      console.log(`   ❌ Error opening database: ${error.message}`);
    }
  }

  generateSummary() {
    console.log('\n📋 PHYGITALS DATABASE ANALYSIS SUMMARY');
    console.log('====================================');

    console.log(`🎯 Total records across ALL Phygitals databases: ${this.results.totalRecords.toLocaleString()}`);
    
    if (this.results.totalRecords >= 50000) {
      console.log('🎉 FOUND THE SOURCE! This could be where 50,000 came from!');
    }

    if (this.results.potentialSources.length > 0) {
      console.log('\n🔍 POTENTIAL 50K SOURCES:');
      this.results.potentialSources.forEach(source => {
        console.log(`   📊 ${source.database} -> ${source.table}: ${source.records.toLocaleString()} records (${source.size}MB)`);
      });
    }

    // Show database breakdown
    console.log('\n📊 DATABASE BREAKDOWN:');
    this.results.databases.forEach(db => {
      console.log(`   📂 ${db.path}`);
      console.log(`      💾 Size: ${db.sizeMB}MB`);
      console.log(`      📊 Records: ${db.totalRecords.toLocaleString()}`);
      console.log(`      📋 Tables: ${Object.keys(db.tables).length}`);
    });

    // Save detailed results
    fs.writeFileSync('comprehensive-phygitals-db-analysis.json', JSON.stringify({
      timestamp: new Date().toISOString(),
      summary: {
        totalRecords: this.results.totalRecords,
        potentialSources: this.results.potentialSources,
        databases: this.results.databases
      }
    }, null, 2));

    console.log('\n📄 Detailed results saved to: comprehensive-phygitals-db-analysis.json');
  }
}

// Run the analysis
async function main() {
  const analysis = new PhygitalsDbAnalysis();
  await analysis.analyzeAllPhygitalsDbases();
}

main().catch(console.error);
