#!/usr/bin/env node
/**
 * Quick Fanatics Harvester Status Checker
 */

const Database = require('better-sqlite3');
const fs = require('fs');

function checkStatus() {
    try {
        console.log('🎯 FANATICS ULTIMATE HARVESTER - QUICK STATUS');
        console.log('==============================================');
        
        if (!fs.existsSync('fanatics-ultimate-pokemon.db')) {
            console.log('⏳ Database not yet created - harvester still initializing...');
            return;
        }

        const db = new Database('fanatics-ultimate-pokemon.db');
        
        // Quick stats
        const totalCards = db.prepare('SELECT COUNT(*) as count FROM pokemon_cards').get();
        const apiEndpoints = db.prepare('SELECT COUNT(*) as count FROM api_endpoints').get();
        
        if (totalCards.count > 0) {
            const byAngle = db.prepare(`
                SELECT extraction_angle, COUNT(*) as count 
                FROM pokemon_cards 
                GROUP BY extraction_angle
            `).all();
            
            const priceStats = db.prepare(`
                SELECT AVG(current_price) as avg, MAX(current_price) as max 
                FROM pokemon_cards WHERE current_price > 0
            `).get();

            console.log(`✅ Pokemon Cards Extracted: ${totalCards.count.toLocaleString()}`);
            console.log(`🌐 API Endpoints Discovered: ${apiEndpoints.count}`);
            
            if (priceStats.avg) {
                console.log(`💰 Average Price: $${priceStats.avg.toFixed(2)}`);
                console.log(`💎 Highest Price: $${priceStats.max.toFixed(2)}`);
            }
            
            console.log('\n🔥 Extraction Breakdown:');
            byAngle.forEach(angle => {
                console.log(`   ${angle.extraction_angle}: ${angle.count} cards`);
            });
            
        } else {
            console.log('⏳ Harvesting in progress - no cards extracted yet');
            console.log(`🌐 API Endpoints Being Monitored: ${apiEndpoints.count}`);
        }
        
        db.close();
        
    } catch (error) {
        console.log(`⚠️ Status check error: ${error.message}`);
    }
}

checkStatus();
