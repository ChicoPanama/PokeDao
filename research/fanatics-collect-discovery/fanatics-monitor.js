#!/usr/bin/env node
/**
 * 🎯 FANATICS ULTIMATE HARVESTER MONITOR
 * =====================================
 * Real-time monitoring of the comprehensive extraction process
 */

const Database = require('better-sqlite3');
const fs = require('fs');

class HarvesterMonitor {
    constructor() {
        this.dbPath = 'fanatics-ultimate-pokemon.db';
        this.monitorInterval = 30000; // 30 seconds
        this.lastCount = 0;
    }

    async startMonitoring() {
        console.log('🔍 FANATICS HARVESTER MONITOR STARTED');
        console.log('=====================================');
        console.log(`📊 Monitoring database: ${this.dbPath}`);
        console.log(`⏱️ Update interval: ${this.monitorInterval/1000}s`);
        console.log('');

        setInterval(() => {
            this.checkProgress();
        }, this.monitorInterval);

        // Initial check
        this.checkProgress();
    }

    checkProgress() {
        try {
            if (!fs.existsSync(this.dbPath)) {
                console.log('⏳ Waiting for database creation...');
                return;
            }

            const db = new Database(this.dbPath);

            // Get current stats
            const totalCards = db.prepare('SELECT COUNT(*) as count FROM pokemon_cards').get();
            const newCards = totalCards.count - this.lastCount;

            // Get extraction breakdown
            const byAngle = db.prepare(`
                SELECT extraction_angle, COUNT(*) as count 
                FROM pokemon_cards 
                GROUP BY extraction_angle 
                ORDER BY count DESC
            `).all();

            // Get recent cards (last 5 minutes)
            const recentCards = db.prepare(`
                SELECT COUNT(*) as count 
                FROM pokemon_cards 
                WHERE harvest_timestamp > datetime('now', '-5 minutes')
            `).get();

            // Get price stats
            const priceStats = db.prepare(`
                SELECT 
                    AVG(current_price) as avg_price,
                    MAX(current_price) as max_price,
                    MIN(current_price) as min_price
                FROM pokemon_cards 
                WHERE current_price > 0
            `).get();

            // Get API endpoints discovered
            const apiCount = db.prepare('SELECT COUNT(*) as count FROM api_endpoints').get();

            // Display current status
            const timestamp = new Date().toLocaleTimeString();
            console.log(`[${timestamp}] 📊 HARVESTER STATUS UPDATE`);
            console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
            console.log(`🎯 Total Pokemon Cards: ${totalCards.count.toLocaleString()}`);
            
            if (newCards > 0) {
                console.log(`📈 New cards (+${newCards} since last check)`);
            }
            
            if (recentCards.count > 0) {
                console.log(`⚡ Recently harvested: ${recentCards.count} cards (last 5 min)`);
            }

            console.log(`🌐 API Endpoints Found: ${apiCount.count}`);

            if (priceStats.avg_price) {
                console.log(`💰 Price Range: $${priceStats.min_price?.toFixed(2)} - $${priceStats.max_price?.toFixed(2)}`);
                console.log(`💵 Average Price: $${priceStats.avg_price?.toFixed(2)}`);
            }

            // Show extraction angle breakdown
            console.log('🔥 Extraction Angles:');
            byAngle.forEach(angle => {
                const percentage = ((angle.count / totalCards.count) * 100).toFixed(1);
                console.log(`   ${angle.extraction_angle}: ${angle.count} cards (${percentage}%)`);
            });

            console.log('');
            this.lastCount = totalCards.count;

            db.close();

        } catch (error) {
            console.log(`⚠️ Monitoring error: ${error.message}`);
        }
    }

    async generateLiveReport() {
        try {
            const db = new Database(this.dbPath);
            
            const report = {
                timestamp: new Date().toISOString(),
                live_stats: {
                    total_cards: db.prepare('SELECT COUNT(*) as count FROM pokemon_cards').get(),
                    extraction_breakdown: db.prepare('SELECT extraction_angle, COUNT(*) as count FROM pokemon_cards GROUP BY extraction_angle').all(),
                    api_endpoints: db.prepare('SELECT COUNT(*) as count FROM api_endpoints').get(),
                    price_analysis: db.prepare(`
                        SELECT 
                            AVG(current_price) as avg,
                            MAX(current_price) as max,
                            MIN(current_price) as min,
                            COUNT(*) as total_with_price
                        FROM pokemon_cards WHERE current_price > 0
                    `).get()
                }
            };

            const reportFile = `fanatics-live-report-${Date.now()}.json`;
            fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
            
            console.log(`📊 Live report generated: ${reportFile}`);
            db.close();
            
        } catch (error) {
            console.log(`⚠️ Report generation error: ${error.message}`);
        }
    }
}

const monitor = new HarvesterMonitor();
monitor.startMonitoring();

// Generate reports every 10 minutes
setInterval(() => {
    monitor.generateLiveReport();
}, 600000);
