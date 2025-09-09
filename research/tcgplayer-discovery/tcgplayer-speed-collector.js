#!/usr/bin/env node

/**
 * 🚀 ULTRA-SPEED POKEMON COLLECTOR 🚀
 * 
 * MAXIMUM PERFORMANCE VERSION:
 * - No duplicate checking (collect everything)
 * - Direct SQLite inserts (no Prisma overhead)
 * - Minimal timeouts
 * - Raw SQL for maximum speed
 * - Batch processing
 * 
 * Target: Collect remaining ~24,607 cards to reach 30,120+ total
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const Database = require('better-sqlite3');
const path = require('path');

class UltraSpeedCollector {
    constructor() {
        // Direct SQLite connection for maximum speed
        this.db = new Database('./tcgplayer.db');
        this.sessionId = `speed_${Date.now()}`;
        this.stats = {
            startTime: Date.now(),
            cardsCollected: 0,
            sourcesProcessed: 0,
            pagesProcessed: 0,
            errorsEncountered: 0
        };
        
        this.initializeDatabase();
    }

    initializeDatabase() {
        // Prepare statements for maximum speed
        this.insertCard = this.db.prepare(`
            INSERT OR IGNORE INTO tcgplayer_cards 
            (id, externalId, source, name, setName, rarity, marketPrice, currentPrice, productUrl, imageUrl, extractedAt)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        
        console.log('🚀 ULTRA-SPEED COLLECTOR INITIALIZED');
        console.log('📊 Direct SQLite operations for maximum performance');
        console.log('🎯 Target: Collect ALL remaining Pokemon cards');
    }

    async collectEverything() {
        console.log('\n🚀🚀🚀 STARTING ULTRA-SPEED COLLECTION 🚀🚀🚀');
        
        const browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
        });

        try {
            // Start with the main Pokemon search page
            await this.collectFromMainSearch(browser);
            
            // Collect from individual sets
            await this.collectFromSets(browser);
            
        } catch (error) {
            console.error('❌ Collection error:', error);
        } finally {
            await browser.close();
            this.db.close();
            this.printFinalStats();
        }
    }

    async collectFromMainSearch(browser) {
        console.log('\n🌊 COLLECTING FROM MAIN POKEMON SEARCH...');
        
        const page = await browser.newPage();
        const baseUrl = 'https://www.tcgplayer.com/search/pokemon/product?productLineName=pokemon&page=';
        
        let currentPage = 1;
        let emptyPages = 0;
        const maxEmptyPages = 5; // Allow more empty pages before stopping
        
        while (emptyPages < maxEmptyPages && currentPage <= 1000) { // Max 1000 pages safety
            try {
                console.log(`📄 Processing page ${currentPage}...`);
                
                await page.goto(`${baseUrl}${currentPage}`, { 
                    waitUntil: 'domcontentloaded', 
                    timeout: 10000 
                });
                
                // Minimal wait for content to load
                await new Promise(resolve => setTimeout(resolve, 500));
                
                const cards = await page.evaluate(() => {
                    const cardElements = document.querySelectorAll('[data-testid="product-tile"]');
                    const results = [];
                    
                    for (const element of cardElements) {
                        try {
                            const nameElement = element.querySelector('[data-testid="product-title"]');
                            const priceElement = element.querySelector('[data-testid="product-price"]');
                            const imageElement = element.querySelector('img');
                            const linkElement = element.querySelector('a');
                            
                            if (nameElement && linkElement) {
                                const fullText = nameElement.textContent.trim();
                                const priceText = priceElement ? priceElement.textContent.trim() : '';
                                
                                // Extract card name and set
                                const parts = fullText.split(' - ');
                                const name = parts[0] || fullText;
                                const setName = parts[1] || 'Unknown Set';
                                
                                // Extract price
                                let price = null;
                                if (priceText) {
                                    const priceMatch = priceText.match(/\$([\\d,]+\\.\\d{2})/);
                                    if (priceMatch) {
                                        price = parseFloat(priceMatch[1].replace(',', ''));
                                    }
                                }
                                
                                // Extract product ID from URL
                                const url = linkElement.href;
                                const idMatch = url.match(/\/product\/(\d+)/);
                                const externalId = idMatch ? idMatch[1] : null;
                                
                                if (externalId) {
                                    results.push({
                                        externalId,
                                        name: name.substring(0, 255), // Limit length
                                        setName: setName.substring(0, 255),
                                        marketPrice: price,
                                        currentPrice: price,
                                        productUrl: url,
                                        imageUrl: imageElement ? imageElement.src : null,
                                        rarity: 'Unknown' // We'll extract this later if needed
                                    });
                                }
                            }
                        } catch (err) {
                            console.log('Error processing card element:', err);
                        }
                    }
                    
                    return results;
                });
                
                if (cards.length === 0) {
                    emptyPages++;
                    console.log(`📭 Page ${currentPage}: No cards found (${emptyPages}/${maxEmptyPages} empty pages)`);
                } else {
                    emptyPages = 0; // Reset empty page counter
                    console.log(`🎴 Page ${currentPage}: Found ${cards.length} cards`);
                    
                    // Batch insert for speed
                    this.insertCardsBatch(cards);
                    this.stats.cardsCollected += cards.length;
                }
                
                this.stats.pagesProcessed++;
                currentPage++;
                
                // Progress update
                if (currentPage % 10 === 0) {
                    console.log(`📊 Progress: ${currentPage} pages, ${this.stats.cardsCollected} cards collected`);
                }
                
                // Minimal delay to avoid being blocked
                await new Promise(resolve => setTimeout(resolve, 200));
                
            } catch (error) {
                console.error(`❌ Error on page ${currentPage}:`, error.message);
                this.stats.errorsEncountered++;
                emptyPages++;
                
                if (this.stats.errorsEncountered > 10) {
                    console.log('🛑 Too many errors, stopping collection');
                    break;
                }
            }
        }
        
        await page.close();
        console.log(`✅ Main search complete: ${this.stats.cardsCollected} cards collected`);
    }

    async collectFromSets(browser) {
        console.log('\n🎯 COLLECTING FROM INDIVIDUAL SETS...');
        
        const sets = [
            'sv07-stellar-crown',
            'sv-shrouded-fable', 
            'sv06-twilight-masquerade',
            'sv05-temporal-forces',
            'sv-paldean-fates',
            'sv04-paradox-rift',
            'sv-scarlet-and-violet-151',
            'sv03-obsidian-flames',
            'sv02-paldea-evolved',
            'sv01-scarlet-and-violet-base-set'
        ];
        
        for (const setCode of sets) {
            try {
                console.log(`🎴 Collecting from set: ${setCode}`);
                await this.collectFromSet(browser, setCode);
                this.stats.sourcesProcessed++;
            } catch (error) {
                console.error(`❌ Error collecting set ${setCode}:`, error.message);
                this.stats.errorsEncountered++;
            }
        }
    }

    async collectFromSet(browser, setCode) {
        const page = await browser.newPage();
        const baseUrl = `https://www.tcgplayer.com/search/pokemon/${setCode}?page=`;
        
        let currentPage = 1;
        let emptyPages = 0;
        
        while (emptyPages < 3 && currentPage <= 100) {
            try {
                await page.goto(`${baseUrl}${currentPage}`, { 
                    waitUntil: 'domcontentloaded', 
                    timeout: 10000 
                });
                
                await new Promise(resolve => setTimeout(resolve, 500));
                
                const cards = await page.evaluate(() => {
                    const cardElements = document.querySelectorAll('[data-testid="product-tile"]');
                    const results = [];
                    
                    for (const element of cardElements) {
                        try {
                            const nameElement = element.querySelector('[data-testid="product-title"]');
                            const priceElement = element.querySelector('[data-testid="product-price"]');
                            const linkElement = element.querySelector('a');
                            
                            if (nameElement && linkElement) {
                                const fullText = nameElement.textContent.trim();
                                const priceText = priceElement ? priceElement.textContent.trim() : '';
                                
                                const parts = fullText.split(' - ');
                                const name = parts[0] || fullText;
                                const setName = parts[1] || 'Unknown Set';
                                
                                let price = null;
                                if (priceText) {
                                    const priceMatch = priceText.match(/\$([\\d,]+\\.\\d{2})/);
                                    if (priceMatch) {
                                        price = parseFloat(priceMatch[1].replace(',', ''));
                                    }
                                }
                                
                                const url = linkElement.href;
                                const idMatch = url.match(/\/product\/(\d+)/);
                                const externalId = idMatch ? idMatch[1] : null;
                                
                                if (externalId) {
                                    results.push({
                                        externalId,
                                        name: name.substring(0, 255),
                                        setName: setName.substring(0, 255),
                                        marketPrice: price,
                                        currentPrice: price,
                                        productUrl: url,
                                        imageUrl: null,
                                        rarity: 'Unknown'
                                    });
                                }
                            }
                        } catch (err) {
                            console.log('Error processing card:', err);
                        }
                    }
                    
                    return results;
                });
                
                if (cards.length === 0) {
                    emptyPages++;
                } else {
                    emptyPages = 0;
                    this.insertCardsBatch(cards);
                    this.stats.cardsCollected += cards.length;
                }
                
                currentPage++;
                await new Promise(resolve => setTimeout(resolve, 200));
                
            } catch (error) {
                console.error(`Error on ${setCode} page ${currentPage}:`, error.message);
                emptyPages++;
            }
        }
        
        await page.close();
    }

    insertCardsBatch(cards) {
        const transaction = this.db.transaction(() => {
            for (const card of cards) {
                try {
                    this.insertCard.run(
                        `cuid_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                        card.externalId,
                        'tcgplayer',
                        card.name,
                        card.setName,
                        card.rarity,
                        card.marketPrice,
                        card.currentPrice,
                        card.productUrl,
                        card.imageUrl,
                        new Date().toISOString()
                    );
                } catch (err) {
                    // Ignore duplicates (OR IGNORE clause handles this)
                }
            }
        });
        
        transaction();
    }

    printFinalStats() {
        const duration = (Date.now() - this.stats.startTime) / 1000;
        const cardsPerMinute = Math.round((this.stats.cardsCollected / duration) * 60);
        
        console.log('\n🎯 ULTRA-SPEED COLLECTION COMPLETE');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`⏱️  Duration: ${Math.round(duration)}s`);
        console.log(`🎴 Cards collected: ${this.stats.cardsCollected}`);
        console.log(`📄 Pages processed: ${this.stats.pagesProcessed}`);
        console.log(`🏆 Sources processed: ${this.stats.sourcesProcessed}`);
        console.log(`🚀 Speed: ${cardsPerMinute} cards/minute`);
        console.log(`❌ Errors: ${this.stats.errorsEncountered}`);
        
        // Check final count
        const totalCards = this.db.prepare('SELECT COUNT(*) as count FROM tcgplayer_cards').get().count;
        console.log(`📊 Total cards in database: ${totalCards}`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    }
}

// Run the collector
if (require.main === module) {
    const collector = new UltraSpeedCollector();
    collector.collectEverything().catch(console.error);
}

module.exports = UltraSpeedCollector;
