#!/usr/bin/env node

/**
 * 🚀 MEGA POKEMON HARVESTER V2 🚀
 * 
 * ADVANCED COLLECTION STRATEGIES:
 * - Multiple URL patterns and search approaches
 * - Dynamic content detection
 * - Robust error handling and retries
 * - Page scroll and lazy loading support
 * - Alternative selectors for different page layouts
 * 
 * Target: All 30,000+ Pokemon cards from TCGplayer
 */

const puppeteer = require('puppeteer');
const Database = require('better-sqlite3');
const fs = require('fs');

class MegaHarvesterV2 {
    constructor() {
        this.db = new Database('./tcgplayer.db');
        this.sessionId = `mega_v2_${Date.now()}`;
        this.stats = {
            startTime: Date.now(),
            cardsCollected: 0,
            pagesProcessed: 0,
            urlsTriedCount: 0,
            errorsEncountered: 0,
            successfulUrls: [],
            failedUrls: []
        };
        
        // Multiple URL patterns to try
        this.urlPatterns = [
            // Direct product search
            'https://www.tcgplayer.com/search/pokemon/product?productLineName=pokemon&page={}',
            // Category browsing
            'https://www.tcgplayer.com/categories/trading-and-collectible-card-games/pokemon?page={}',
            // Alternative search formats
            'https://www.tcgplayer.com/search/pokemon?page={}',
            'https://www.tcgplayer.com/search/all?q=pokemon&page={}',
            // Set-based searches
            'https://www.tcgplayer.com/search/pokemon/product?view=grid&page={}',
            // Browse by newest
            'https://www.tcgplayer.com/search/pokemon?sort=newest&page={}',
            // Browse by price
            'https://www.tcgplayer.com/search/pokemon?sort=price-desc&page={}'
        ];
        
        // Multiple selector patterns for different page layouts
        this.selectorPatterns = [
            {
                name: 'Current TCGPlayer Search Results',
                container: '.search-result',
                title: '.product-card__title',
                price: '.product-card__market-price--value',
                link: '.product-card__content a',
                image: '.product-card__image img'
            },
            {
                name: 'TCGPlayer Product Cards',
                container: '.product-card',
                title: '.product-card__title, .truncate',
                price: '.inventory__price-with-shipping, .product-card__market-price--value',
                link: 'a',
                image: 'img'
            },
            {
                name: 'Standard Product Tiles',
                container: '[data-testid="product-tile"]',
                title: '[data-testid="product-title"]',
                price: '[data-testid="product-price"]',
                link: 'a',
                image: 'img'
            },
            {
                name: 'Card Grid Layout',
                container: '.product-card, .card-item, .product-tile',
                title: '.product-name, .card-name, .title',
                price: '.price, .product-price, .current-price',
                link: 'a',
                image: 'img'
            },
            {
                name: 'List View Layout',
                container: '.product-row, .list-item',
                title: '.product-title, .item-name',
                price: '.price-display, .current-price',
                link: 'a',
                image: 'img'
            },
            {
                name: 'Alternative Layout',
                container: '.tcg-product, .product-item',
                title: 'h3, h4, .name',
                price: '.price-range, .market-price',
                link: 'a',
                image: 'img'
            }
        ];
        
        this.initializeDatabase();
    }

    initializeDatabase() {
        this.insertCard = this.db.prepare(`
            INSERT OR IGNORE INTO tcgplayer_cards 
            (id, externalId, source, name, setName, rarity, marketPrice, currentPrice, productUrl, imageUrl, extractedAt)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        
        console.log('🚀 MEGA HARVESTER V2 INITIALIZED');
        console.log('📊 Multiple URL patterns and selectors configured');
        console.log('🎯 Target: All 30,000+ Pokemon cards');
    }

    async harvest() {
        console.log('\n🚀🚀🚀 STARTING MEGA HARVEST V2 🚀🚀🚀');
        console.log(`📊 Testing ${this.urlPatterns.length} different URL patterns`);
        console.log(`🎯 Using ${this.selectorPatterns.length} different selector strategies`);
        
        const browser = await puppeteer.launch({
            headless: true,
            args: [
                '--no-sandbox', 
                '--disable-setuid-sandbox', 
                '--disable-dev-shm-usage',
                '--disable-web-security',
                '--disable-features=site-per-process'
            ]
        });

        try {
            // Try each URL pattern
            for (let i = 0; i < this.urlPatterns.length; i++) {
                const pattern = this.urlPatterns[i];
                console.log(`\n🌐 TESTING URL PATTERN ${i + 1}/${this.urlPatterns.length}`);
                console.log(`📍 Pattern: ${pattern.replace('{}', 'PAGE')}`);
                
                const success = await this.harvestFromPattern(browser, pattern, i + 1);
                if (success && this.stats.cardsCollected > 100) {
                    console.log(`✅ Found productive pattern! Continuing with extended harvest...`);
                    await this.extendedHarvestFromPattern(browser, pattern);
                }
            }
            
        } catch (error) {
            console.error('❌ Harvest error:', error);
        } finally {
            await browser.close();
            this.db.close();
            this.printFinalStats();
        }
    }

    async harvestFromPattern(browser, urlPattern, patternNum) {
        const page = await browser.newPage();
        let cardsFoundWithPattern = 0;
        
        // Set user agent to avoid detection
        await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        
        try {
            // Test first few pages with this pattern
            for (let pageNum = 1; pageNum <= 5; pageNum++) {
                const url = urlPattern.replace('{}', pageNum);
                this.stats.urlsTriedCount++;
                
                console.log(`📄 Testing page ${pageNum} of pattern ${patternNum}...`);
                
                try {
                    await page.goto(url, { 
                        waitUntil: 'networkidle0', 
                        timeout: 15000 
                    });
                    
                    // Wait for content to load
                    await new Promise(resolve => setTimeout(resolve, 2000));
                    
                    // Try scrolling to load more content
                    await this.scrollPage(page);
                    
                    // Try each selector pattern
                    let foundCards = false;
                    for (const selectorPattern of this.selectorPatterns) {
                        const cards = await this.extractCardsWithSelector(page, selectorPattern, url);
                        if (cards.length > 0) {
                            console.log(`🎴 Found ${cards.length} cards using ${selectorPattern.name}`);
                            this.insertCardsBatch(cards);
                            cardsFoundWithPattern += cards.length;
                            this.stats.cardsCollected += cards.length;
                            foundCards = true;
                            break; // Use first successful selector
                        }
                    }
                    
                    if (!foundCards) {
                        console.log(`📭 No cards found on page ${pageNum} with any selector`);
                        // Log page content for debugging
                        await this.debugPageContent(page, `pattern_${patternNum}_page_${pageNum}`);
                    }
                    
                    this.stats.pagesProcessed++;
                    
                } catch (error) {
                    console.error(`❌ Error on page ${pageNum}:`, error.message);
                    this.stats.errorsEncountered++;
                    this.stats.failedUrls.push(url);
                }
                
                // Brief pause between pages
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
            
            if (cardsFoundWithPattern > 0) {
                console.log(`✅ Pattern ${patternNum} successful: ${cardsFoundWithPattern} cards found`);
                this.stats.successfulUrls.push(urlPattern);
                return true;
            } else {
                console.log(`❌ Pattern ${patternNum} failed: No cards found`);
                return false;
            }
            
        } catch (error) {
            console.error(`❌ Pattern ${patternNum} error:`, error.message);
            return false;
        } finally {
            await page.close();
        }
    }

    async extendedHarvestFromPattern(browser, urlPattern) {
        console.log('\n🔥 EXTENDED HARVEST - Going deep with successful pattern!');
        
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        
        let currentPage = 1;
        let emptyPages = 0;
        const maxEmptyPages = 10;
        
        try {
            while (emptyPages < maxEmptyPages && currentPage <= 500) {
                const url = urlPattern.replace('{}', currentPage);
                
                console.log(`📄 Extended harvest page ${currentPage}...`);
                
                try {
                    await page.goto(url, { 
                        waitUntil: 'networkidle0', 
                        timeout: 15000 
                    });
                    
                    await new Promise(resolve => setTimeout(resolve, 1500));
                    await this.scrollPage(page);
                    
                    let foundCards = false;
                    let totalCardsOnPage = 0;
                    for (const selectorPattern of this.selectorPatterns) {
                        const cards = await this.extractCardsWithSelector(page, selectorPattern, url);
                        if (cards.length > 0) {
                            this.insertCardsBatch(cards);
                            this.stats.cardsCollected += cards.length;
                            totalCardsOnPage += cards.length;
                            foundCards = true;
                            emptyPages = 0; // Reset counter
                            break;
                        }
                    }
                    
                    if (!foundCards) {
                        emptyPages++;
                        console.log(`📭 Empty page ${currentPage} (${emptyPages}/${maxEmptyPages})`);
                    } else {
                        console.log(`🎴 Page ${currentPage}: ${totalCardsOnPage} cards collected`);
                    }
                    
                } catch (error) {
                    console.error(`❌ Extended harvest error on page ${currentPage}:`, error.message);
                    emptyPages++;
                }
                
                currentPage++;
                this.stats.pagesProcessed++;
                
                // Progress update every 10 pages
                if (currentPage % 10 === 0) {
                    console.log(`📊 Progress: ${currentPage} pages, ${this.stats.cardsCollected} total cards`);
                }
                
                await new Promise(resolve => setTimeout(resolve, 800));
            }
            
        } finally {
            await page.close();
        }
    }

    async scrollPage(page) {
        try {
            // Scroll to bottom to trigger lazy loading
            await page.evaluate(async () => {
                await new Promise((resolve) => {
                    let totalHeight = 0;
                    const distance = 100;
                    const timer = setInterval(() => {
                        const scrollHeight = document.body.scrollHeight;
                        window.scrollBy(0, distance);
                        totalHeight += distance;

                        if(totalHeight >= scrollHeight){
                            clearInterval(timer);
                            resolve();
                        }
                    }, 100);
                });
            });
            
            // Wait for any lazy-loaded content
            await new Promise(resolve => setTimeout(resolve, 1000));
            
        } catch (error) {
            console.log('Scroll error (non-critical):', error.message);
        }
    }

    async extractCardsWithSelector(page, selectorPattern, url) {
        try {
            const cards = await page.evaluate((selector, pageUrl) => {
                const containers = document.querySelectorAll(selector.container);
                const results = [];
                
                for (const container of containers) {
                    try {
                        const titleElement = container.querySelector(selector.title);
                        const priceElement = container.querySelector(selector.price);
                        const linkElement = container.querySelector(selector.link);
                        const imageElement = container.querySelector(selector.image);
                        
                        if (titleElement && linkElement) {
                            const fullText = titleElement.textContent.trim();
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
                            const href = linkElement.href || linkElement.getAttribute('href');
                            const fullUrl = href.startsWith('http') ? href : `https://www.tcgplayer.com${href}`;
                            const idMatch = fullUrl.match(/\/product\/(\d+)/);
                            const externalId = idMatch ? idMatch[1] : null;
                            
                            if (name && externalId) {
                                results.push({
                                    externalId: externalId,
                                    name: name.substring(0, 255),
                                    setName: setName.substring(0, 255),
                                    marketPrice: price,
                                    currentPrice: price,
                                    productUrl: fullUrl,
                                    imageUrl: imageElement ? (imageElement.src || imageElement.getAttribute('src')) : null,
                                    rarity: 'Unknown'
                                });
                            }
                        }
                    } catch (err) {
                        console.log('Error processing container:', err);
                    }
                }
                
                return results;
            }, selectorPattern, url);
            
            return cards || [];
            
        } catch (error) {
            console.log(`Selector ${selectorPattern.name} failed:`, error.message);
            return [];
        }
    }

    async debugPageContent(page, filename) {
        try {
            const content = await page.content();
            const debugFile = `debug_${filename}.html`;
            fs.writeFileSync(debugFile, content);
            console.log(`🔍 Debug: Saved page content to ${debugFile}`);
            
            // Also log some basic page info
            const title = await page.title();
            const url = page.url();
            console.log(`🔍 Page info: "${title}" at ${url}`);
            
        } catch (error) {
            console.log('Debug save error:', error.message);
        }
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
                    // Ignore duplicates
                }
            }
        });
        
        transaction();
    }

    printFinalStats() {
        const duration = (Date.now() - this.stats.startTime) / 1000;
        const cardsPerMinute = Math.round((this.stats.cardsCollected / duration) * 60);
        
        console.log('\n🎯 MEGA HARVEST V2 COMPLETE');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`⏱️  Duration: ${Math.round(duration)}s`);
        console.log(`🎴 New cards collected: ${this.stats.cardsCollected}`);
        console.log(`📄 Pages processed: ${this.stats.pagesProcessed}`);
        console.log(`🌐 URLs tried: ${this.stats.urlsTriedCount}`);
        console.log(`✅ Successful patterns: ${this.stats.successfulUrls.length}`);
        console.log(`🚀 Speed: ${cardsPerMinute} cards/minute`);
        console.log(`❌ Errors: ${this.stats.errorsEncountered}`);
        
        // Check final count
        const totalCards = this.db.prepare('SELECT COUNT(*) as count FROM tcgplayer_cards').get().count;
        console.log(`📊 Total cards in database: ${totalCards}`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
        
        if (this.stats.successfulUrls.length > 0) {
            console.log('✅ Successful URL patterns:');
            this.stats.successfulUrls.forEach((url, i) => {
                console.log(`   ${i + 1}. ${url}`);
            });
        }
    }
}

// Run the harvester
if (require.main === module) {
    const harvester = new MegaHarvesterV2();
    harvester.harvest().catch(console.error);
}

module.exports = MegaHarvesterV2;
