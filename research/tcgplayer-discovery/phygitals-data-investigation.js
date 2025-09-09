/**
 * PHYGITALS DATA INVESTIGATION
 * Let's figure out where the 50,000 number came from
 * Focus: Understanding "listings" vs "cards" distinction
 */

const Database = require('better-sqlite3');

class PhygitalsInvestigation {
  constructor() {
    this.db = new Database('phygitals_pokemon_complete.db');
  }

  investigateData() {
    console.log('🔍 PHYGITALS DATA INVESTIGATION');
    console.log('====================================');
    
    // 1. Check total records across all tables
    console.log('\n📊 RAW DATA COUNTS:');
    
    const tables = ['phygitals_cards', 'phygitals_sales', 'phygitals_users', 'phygitals_sets'];
    let totalRecords = 0;
    
    tables.forEach(table => {
      try {
        const count = this.db.prepare(`SELECT COUNT(*) as count FROM ${table}`).get().count;
        console.log(`   ${table}: ${count.toLocaleString()}`);
        totalRecords += count;
      } catch (error) {
        console.log(`   ${table}: Error - ${error.message}`);
      }
    });
    
    console.log(`   📊 Total Records: ${totalRecords.toLocaleString()}`);

    // 2. Check if sales table contains individual listings
    console.log('\n💰 SALES/LISTINGS ANALYSIS:');
    
    try {
      const salesCount = this.db.prepare('SELECT COUNT(*) as count FROM phygitals_sales').get().count;
      const uniqueCardsSold = this.db.prepare('SELECT COUNT(DISTINCT card_id) as count FROM phygitals_sales WHERE card_id IS NOT NULL').get().count;
      
      console.log(`   Total Sales Records: ${salesCount.toLocaleString()}`);
      console.log(`   Unique Cards Sold: ${uniqueCardsSold.toLocaleString()}`);
      console.log(`   Average Sales per Card: ${(salesCount / uniqueCardsSold).toFixed(2)}`);
      
      // Sample sales data structure
      const sampleSales = this.db.prepare('SELECT * FROM phygitals_sales LIMIT 3').all();
      console.log('\n   📋 Sample Sales Records:');
      sampleSales.forEach((sale, index) => {
        console.log(`   ${index + 1}. ${JSON.stringify(sale, null, '      ')}`);
      });
      
    } catch (error) {
      console.log(`   Sales analysis failed: ${error.message}`);
    }

    // 3. Check cards table for multiple listings per card
    console.log('\n🎴 CARDS/LISTINGS ANALYSIS:');
    
    try {
      const cardsCount = this.db.prepare('SELECT COUNT(*) as count FROM phygitals_cards').get().count;
      const cardsWithPrices = this.db.prepare('SELECT COUNT(*) as count FROM phygitals_cards WHERE price > 0').get().count;
      
      console.log(`   Total Cards: ${cardsCount.toLocaleString()}`);
      console.log(`   Cards with Prices: ${cardsWithPrices.toLocaleString()}`);
      
      // Check for duplicate card names (different listings)
      const duplicateNames = this.db.prepare(`
        SELECT name, COUNT(*) as count 
        FROM phygitals_cards 
        WHERE name IS NOT NULL 
        GROUP BY name 
        HAVING COUNT(*) > 1 
        ORDER BY count DESC 
        LIMIT 10
      `).all();
      
      console.log('\n   🔄 Cards with Multiple Listings:');
      duplicateNames.forEach(dup => {
        console.log(`   "${dup.name}": ${dup.count} listings`);
      });
      
      const totalDuplicateListings = duplicateNames.reduce((sum, dup) => sum + dup.count, 0);
      console.log(`   Total Duplicate Listings: ${totalDuplicateListings.toLocaleString()}`);
      
    } catch (error) {
      console.log(`   Cards analysis failed: ${error.message}`);
    }

    // 4. Check database schema to understand data structure
    console.log('\n🏗️  DATABASE SCHEMA ANALYSIS:');
    
    tables.forEach(table => {
      try {
        console.log(`\n   ${table.toUpperCase()} SCHEMA:`);
        const schema = this.db.prepare(`PRAGMA table_info(${table})`).all();
        schema.forEach(col => {
          console.log(`     ${col.name}: ${col.type}`);
        });
      } catch (error) {
        console.log(`   Schema check failed for ${table}: ${error.message}`);
      }
    });

    // 5. Look for any indication of larger dataset
    console.log('\n🎯 PROJECTION ANALYSIS:');
    
    try {
      // Calculate theoretical maximum if all categories were harvested
      const uniqueSets = this.db.prepare('SELECT COUNT(DISTINCT set_name) as count FROM phygitals_cards WHERE set_name IS NOT NULL').get().count;
      const avgCardsPerSet = this.db.prepare('SELECT COUNT(*) / COUNT(DISTINCT set_name) as avg FROM phygitals_cards WHERE set_name IS NOT NULL').get().avg;
      
      console.log(`   Unique Sets Found: ${uniqueSets}`);
      console.log(`   Average Cards per Set: ${avgCardsPerSet ? avgCardsPerSet.toFixed(2) : 'N/A'}`);
      
      // If there are 675 sets total in sets table
      const totalSetsAvailable = this.db.prepare('SELECT COUNT(*) as count FROM phygitals_sets').get().count;
      const projectedTotalCards = totalSetsAvailable * (avgCardsPerSet || 10);
      
      console.log(`   Total Sets Available: ${totalSetsAvailable}`);
      console.log(`   Projected Total Cards: ${projectedTotalCards.toLocaleString()}`);
      
    } catch (error) {
      console.log(`   Projection analysis failed: ${error.message}`);
    }

    // 6. Check for any metadata that might indicate larger scope
    console.log('\n📝 METADATA ANALYSIS:');
    
    try {
      // Look for any JSON metadata that might contain larger numbers
      const cardsWithMetadata = this.db.prepare(`
        SELECT metadata_json 
        FROM phygitals_cards 
        WHERE metadata_json IS NOT NULL 
        AND metadata_json != '' 
        LIMIT 3
      `).all();
      
      console.log(`   Cards with Metadata: ${cardsWithMetadata.length}`);
      cardsWithMetadata.forEach((card, index) => {
        console.log(`   Metadata Sample ${index + 1}:`, card.metadata_json.substring(0, 200) + '...');
      });
      
    } catch (error) {
      console.log(`   Metadata analysis failed: ${error.message}`);
    }

    this.db.close();
  }
}

// Run the investigation
const investigation = new PhygitalsInvestigation();
investigation.investigateData();
