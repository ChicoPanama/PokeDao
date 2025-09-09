#!/usr/bin/env node

/**
 * 🔍 COMPREHENSIVE DATA AUDIT - ALL DATABASES
 * 
 * Audits every database, table, and pricing source to identify:
 * - Data quality issues across ALL cards (not just high-value)
 * - Schema inconsistencies 
 * - Price distribution anomalies
 * - Duplicate detection
 * - Cross-database coverage analysis
 * - Source reliability assessment
 */

const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

console.log('🔍 COMPREHENSIVE DATA AUDIT - ALL DATABASES');
console.log('============================================\n');

// Database discovery
const dbCandidates = [
    'collector_crypt_v2.db',
    'pokemon_tcg_complete.db', 
    'tcgplayer.db',
    'collector_crypt_ebay_complete.db',
    'collector_crypt_pricing_complete.db',
    'collector_crypt_pricing_fixed.db'
];

const foundDbs = dbCandidates.filter(db => fs.existsSync(db));
console.log(`📁 Found databases: ${foundDbs.length}/${dbCandidates.length}`);
foundDbs.forEach(db => console.log(`   ✅ ${db}`));

const auditResults = {
    databases: {},
    crossChecks: {},
    issues: [],
    recommendations: []
};

// Database audit function
function auditDatabase(dbPath) {
    console.log(`\n🔎 AUDITING: ${dbPath}`);
    console.log('='.repeat(50));
    
    try {
        const db = new Database(dbPath);
        const result = {
            path: dbPath,
            tables: {},
            totalRecords: 0,
            issues: []
        };
        
        // Get all tables
        const tables = db.prepare(`
            SELECT name FROM sqlite_master 
            WHERE type='table' AND name NOT LIKE 'sqlite_%'
        `).all();
        
        console.log(`📊 Tables found: ${tables.length}`);
        tables.forEach(t => console.log(`   - ${t.name}`));
        
        // Audit each table
        for (const table of tables) {
            const tableName = table.name;
            console.log(`\n📋 Table: ${tableName}`);
            
            try {
                // Basic stats
                const count = db.prepare(`SELECT COUNT(*) as count FROM "${tableName}"`).get().count;
                console.log(`   Records: ${count.toLocaleString()}`);
                result.totalRecords += count;
                
                // Schema info
                const schema = db.prepare(`PRAGMA table_info("${tableName}")`).all();
                const columns = schema.map(s => s.name);
                console.log(`   Columns: ${columns.join(', ')}`);
                
                // Price column analysis
                const priceColumns = columns.filter(col => 
                    /price|market|asking|sold|current|value/i.test(col)
                );
                
                console.log(`   Price columns: ${priceColumns.join(', ') || 'None'}`);
                
                const tableResult = {
                    name: tableName,
                    count: count,
                    columns: columns,
                    priceColumns: priceColumns,
                    priceStats: {},
                    issues: []
                };
                
                // Analyze each price column
                for (const priceCol of priceColumns) {
                    try {
                        const stats = db.prepare(`
                            SELECT 
                                COUNT(*) as total,
                                COUNT(CASE WHEN "${priceCol}" IS NULL THEN 1 END) as nulls,
                                COUNT(CASE WHEN "${priceCol}" = 0 THEN 1 END) as zeros,
                                COUNT(CASE WHEN "${priceCol}" > 0 THEN 1 END) as positive,
                                MIN("${priceCol}") as min_price,
                                MAX("${priceCol}") as max_price,
                                AVG("${priceCol}") as avg_price,
                                COUNT(CASE WHEN "${priceCol}" < 0.10 AND "${priceCol}" > 0 THEN 1 END) as suspicious_low
                            FROM "${tableName}"
                        `).get();
                        
                        console.log(`     ${priceCol}:`);
                        console.log(`       Total: ${stats.total.toLocaleString()}`);
                        console.log(`       Nulls: ${stats.nulls.toLocaleString()} (${(stats.nulls/stats.total*100).toFixed(1)}%)`);
                        console.log(`       Zeros: ${stats.zeros.toLocaleString()} (${(stats.zeros/stats.total*100).toFixed(1)}%)`);
                        console.log(`       Positive: ${stats.positive.toLocaleString()} (${(stats.positive/stats.total*100).toFixed(1)}%)`);
                        console.log(`       Range: $${stats.min_price} - $${stats.max_price}`);
                        console.log(`       Average: $${stats.avg_price?.toFixed(2) || 'N/A'}`);
                        console.log(`       Suspicious (<$0.10): ${stats.suspicious_low.toLocaleString()}`);
                        
                        // Flag issues
                        if (stats.suspicious_low > stats.positive * 0.1) {
                            const issue = `${tableName}.${priceCol}: ${stats.suspicious_low} suspicious low prices (>${stats.positive * 0.1} threshold)`;
                            tableResult.issues.push(issue);
                            result.issues.push(issue);
                            console.log(`       ⚠️  HIGH SUSPICIOUS PRICE COUNT`);
                        }
                        
                        if (stats.nulls / stats.total > 0.5) {
                            const issue = `${tableName}.${priceCol}: ${(stats.nulls/stats.total*100).toFixed(1)}% null values`;
                            tableResult.issues.push(issue);
                            result.issues.push(issue);
                            console.log(`       ⚠️  HIGH NULL PERCENTAGE`);
                        }
                        
                        tableResult.priceStats[priceCol] = stats;
                        
                    } catch (error) {
                        console.log(`       ❌ Error analyzing ${priceCol}: ${error.message}`);
                    }
                }
                
                // Duplicate detection (if name column exists)
                if (columns.includes('name') || columns.includes('title')) {
                    const nameCol = columns.includes('name') ? 'name' : 'title';
                    try {
                        const duplicates = db.prepare(`
                            SELECT "${nameCol}", COUNT(*) as count 
                            FROM "${tableName}" 
                            GROUP BY "${nameCol}" 
                            HAVING count > 1 
                            ORDER BY count DESC 
                            LIMIT 10
                        `).all();
                        
                        if (duplicates.length > 0) {
                            console.log(`   🔄 Top duplicates by ${nameCol}:`);
                            duplicates.forEach(dup => {
                                console.log(`     "${dup[nameCol]}" (${dup.count} times)`);
                            });
                            
                            const totalDuplicates = duplicates.reduce((sum, dup) => sum + dup.count - 1, 0);
                            if (totalDuplicates > count * 0.05) {
                                const issue = `${tableName}: ${totalDuplicates} duplicate records (>${count * 0.05} threshold)`;
                                tableResult.issues.push(issue);
                                result.issues.push(issue);
                                console.log(`     ⚠️  HIGH DUPLICATE COUNT: ${totalDuplicates}`);
                            }
                        } else {
                            console.log(`   ✅ No duplicates found in ${nameCol}`);
                        }
                    } catch (error) {
                        console.log(`   ❌ Error checking duplicates: ${error.message}`);
                    }
                }
                
                result.tables[tableName] = tableResult;
                
            } catch (error) {
                console.log(`   ❌ Error auditing table ${tableName}: ${error.message}`);
                result.issues.push(`${tableName}: Audit failed - ${error.message}`);
            }
        }
        
        db.close();
        auditResults.databases[dbPath] = result;
        
        console.log(`\n📈 ${dbPath} Summary:`);
        console.log(`   Total Records: ${result.totalRecords.toLocaleString()}`);
        console.log(`   Issues Found: ${result.issues.length}`);
        
        return result;
        
    } catch (error) {
        console.error(`❌ Failed to audit ${dbPath}: ${error.message}`);
        auditResults.databases[dbPath] = {
            path: dbPath,
            error: error.message,
            issues: [`Database connection failed: ${error.message}`]
        };
        return null;
    }
}

// Cross-database coverage analysis
function analyzeCoverage() {
    console.log('\n🔗 CROSS-DATABASE COVERAGE ANALYSIS');
    console.log('===================================');
    
    try {
        // Check Collector Crypt vs eBay coverage
        if (fs.existsSync('collector_crypt_v2.db') && fs.existsSync('collector_crypt_ebay_complete.db')) {
            const ccDb = new Database('collector_crypt_v2.db');
            const ebayDb = new Database('collector_crypt_ebay_complete.db');
            
            console.log('\n📊 Collector Crypt vs eBay Coverage:');
            
            const ccTotal = ccDb.prepare('SELECT COUNT(*) as count FROM collector_crypt_cards').get().count;
            const ebayTotal = ebayDb.prepare('SELECT COUNT(*) as count FROM ebay_price_analytics').get().count;
            
            console.log(`   Collector Crypt cards: ${ccTotal.toLocaleString()}`);
            console.log(`   eBay analytics records: ${ebayTotal.toLocaleString()}`);
            
            // Check direct ID matches
            const directMatches = ebayDb.prepare(`
                SELECT COUNT(DISTINCT collector_crypt_id) as count 
                FROM ebay_price_analytics 
                WHERE collector_crypt_id IS NOT NULL
            `).get().count;
            
            console.log(`   Direct ID matches: ${directMatches.toLocaleString()}`);
            console.log(`   Coverage rate: ${(directMatches/ccTotal*100).toFixed(1)}%`);
            
            if (directMatches / ccTotal < 0.8) {
                auditResults.issues.push(`Low eBay coverage: Only ${(directMatches/ccTotal*100).toFixed(1)}% of CC cards have eBay data`);
            }
            
            ccDb.close();
            ebayDb.close();
        }
        
        // Check Pokemon TCG vs TCGPlayer coverage
        if (fs.existsSync('pokemon_tcg_complete.db') && fs.existsSync('tcgplayer.db')) {
            const pokemonDb = new Database('pokemon_tcg_complete.db');
            const tcgDb = new Database('tcgplayer.db');
            
            console.log('\n📊 Pokemon TCG vs TCGPlayer Coverage:');
            
            const pokemonTotal = pokemonDb.prepare('SELECT COUNT(*) as count FROM pokemon_cards').get().count;
            const tcgTotal = tcgDb.prepare('SELECT COUNT(*) as count FROM tcgplayer_cards').get().count;
            
            console.log(`   Pokemon TCG cards: ${pokemonTotal.toLocaleString()}`);
            console.log(`   TCGPlayer scraped: ${tcgTotal.toLocaleString()}`);
            
            // Check pricing coverage
            const pokemonWithPricing = pokemonDb.prepare(`
                SELECT COUNT(*) as count FROM pokemon_cards 
                WHERE tcgplayer != '{}' AND tcgplayer != 'null'
            `).get().count;
            
            const tcgWithPricing = tcgDb.prepare(`
                SELECT COUNT(*) as count FROM tcgplayer_cards 
                WHERE marketPrice > 0
            `).get().count;
            
            console.log(`   Pokemon TCG with pricing: ${pokemonWithPricing.toLocaleString()}`);
            console.log(`   TCGPlayer with pricing: ${tcgWithPricing.toLocaleString()}`);
            
            pokemonDb.close();
            tcgDb.close();
        }
        
    } catch (error) {
        console.error(`❌ Coverage analysis failed: ${error.message}`);
        auditResults.issues.push(`Coverage analysis failed: ${error.message}`);
    }
}

// Price consistency analysis across sources
function analyzePriceConsistency() {
    console.log('\n💰 PRICE CONSISTENCY ANALYSIS');
    console.log('==============================');
    
    try {
        // Check if we have the fixed pricing database
        if (fs.existsSync('collector_crypt_pricing_fixed.db')) {
            const pricingDb = new Database('collector_crypt_pricing_fixed.db');
            
            console.log('\n📊 Multi-source Price Comparison:');
            
            // Analyze price source distribution
            const sourceStats = pricingDb.prepare(`
                SELECT market_source, COUNT(*) as count, AVG(true_market_value) as avg_value
                FROM collector_crypt_pricing 
                WHERE true_market_value > 0
                GROUP BY market_source 
                ORDER BY count DESC
            `).all();
            
            console.log('   Source distribution:');
            sourceStats.forEach(stat => {
                console.log(`     ${stat.market_source}: ${stat.count.toLocaleString()} cards (avg: $${stat.avg_value.toFixed(2)})`);
            });
            
            // Check for extreme ratios (potential pricing errors)
            const extremeRatios = pricingDb.prepare(`
                SELECT cc_title, cc_asking_price, true_market_value, asking_vs_market_ratio, market_source
                FROM collector_crypt_pricing 
                WHERE asking_vs_market_ratio > 100 OR asking_vs_market_ratio < 0.001
                ORDER BY asking_vs_market_ratio DESC
                LIMIT 10
            `).all();
            
            if (extremeRatios.length > 0) {
                console.log('\n   🚨 Extreme price ratios found:');
                extremeRatios.forEach(card => {
                    console.log(`     ${card.cc_title.substring(0, 50)}...`);
                    console.log(`       Ask: $${card.cc_asking_price} | Market: $${card.true_market_value} | Ratio: ${card.asking_vs_market_ratio.toFixed(2)}x`);
                    console.log(`       Source: ${card.market_source}`);
                });
                
                auditResults.issues.push(`Found ${extremeRatios.length} cards with extreme price ratios`);
            }
            
            pricingDb.close();
        }
        
    } catch (error) {
        console.error(`❌ Price consistency analysis failed: ${error.message}`);
        auditResults.issues.push(`Price consistency analysis failed: ${error.message}`);
    }
}

// Generate recommendations
function generateRecommendations() {
    console.log('\n📋 AUDIT RECOMMENDATIONS');
    console.log('========================');
    
    const totalIssues = auditResults.issues.length;
    console.log(`\n🔍 Total Issues Found: ${totalIssues}`);
    
    if (totalIssues === 0) {
        console.log('✅ No major issues detected! Data quality appears good.');
        return;
    }
    
    console.log('\n📌 Issues by category:');
    auditResults.issues.forEach((issue, i) => {
        console.log(`   ${i + 1}. ${issue}`);
    });
    
    console.log('\n🛠️  Recommended fixes:');
    
    // Categorize and recommend fixes
    const suspiciousPriceIssues = auditResults.issues.filter(i => i.includes('suspicious'));
    const nullIssues = auditResults.issues.filter(i => i.includes('null'));
    const duplicateIssues = auditResults.issues.filter(i => i.includes('duplicate'));
    const coverageIssues = auditResults.issues.filter(i => i.includes('coverage') || i.includes('Coverage'));
    
    if (suspiciousPriceIssues.length > 0) {
        console.log('   1. 🔧 Fix suspicious low prices:');
        console.log('      - Implement minimum price thresholds ($0.25+ for Pokemon cards)');
        console.log('      - Re-scrape TCGPlayer with better selectors');
        console.log('      - Add price validation rules');
    }
    
    if (nullIssues.length > 0) {
        console.log('   2. 🔧 Address high null percentages:');
        console.log('      - Improve data source integration');
        console.log('      - Add fallback pricing logic');
        console.log('      - Validate API responses');
    }
    
    if (duplicateIssues.length > 0) {
        console.log('   3. 🔧 Remove duplicate records:');
        console.log('      - Implement proper unique constraints');
        console.log('      - Add deduplication step in ingestion');
        console.log('      - Create composite keys (name + set + number)');
    }
    
    if (coverageIssues.length > 0) {
        console.log('   4. 🔧 Improve cross-source coverage:');
        console.log('      - Enhance name matching algorithms');
        console.log('      - Add fuzzy matching for card names');
        console.log('      - Implement card ID mapping tables');
    }
    
    console.log('\n   5. 🔧 General data quality improvements:');
    console.log('      - Add comprehensive data validation');
    console.log('      - Implement automated quality checks');
    console.log('      - Create data monitoring dashboards');
    console.log('      - Add alert system for data anomalies');
}

// Main audit execution
async function runComprehensiveAudit() {
    console.log(`🚀 Starting comprehensive audit of ${foundDbs.length} databases...\n`);
    
    // Audit each database
    for (const dbPath of foundDbs) {
        auditDatabase(dbPath);
    }
    
    // Cross-database analysis
    analyzeCoverage();
    analyzePriceConsistency();
    
    // Generate recommendations
    generateRecommendations();
    
    // Save audit results
    const auditReport = {
        timestamp: new Date().toISOString(),
        databases_audited: foundDbs.length,
        total_issues: auditResults.issues.length,
        results: auditResults
    };
    
    fs.writeFileSync('comprehensive-audit-report.json', JSON.stringify(auditReport, null, 2));
    console.log('\n💾 Detailed audit report saved to: comprehensive-audit-report.json');
    
    // Exit code based on issues
    if (auditResults.issues.length > 0) {
        console.log(`\n⚠️  Audit completed with ${auditResults.issues.length} issues requiring attention`);
        process.exit(1);
    } else {
        console.log('\n✅ Audit completed successfully - no major issues found');
        process.exit(0);
    }
}

// Run the audit
runComprehensiveAudit().catch(error => {
    console.error('❌ Audit failed:', error);
    process.exit(2);
});
