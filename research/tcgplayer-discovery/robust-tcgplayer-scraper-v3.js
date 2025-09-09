#!/usr/bin/env node

/**
 * 🚀 ROBUST TCGPLAYER SCRAPER V3
 * 
 * Advanced scraper designed to overcome the corruption issues:
 * - Proper JavaScript rendering with Puppeteer
 * - Smart anti-bot detection avoidance
 * - Comprehensive price validation
 * - Fallback mechanisms and retry logic
 * - Real-time data quality monitoring
 */

const puppeteer = require('puppeteer');
const Database = require('better-sqlite3');
const fs = require('fs');

console.log('🚀 ROBUST TCGPLAYER SCRAPER V3');
console.log('===============================\n');

class RobustTCGPlayerScraper {
    constructor() {
        this.browser = null;
        this.page = null;
        this.db = null;
        this.stats = {
            total_processed: 0,
            valid_prices: 0,
            invalid_prices: 0,
            captcha_encountered: 0,
            rate_limited: 0,
            errors: 0
        };
    }
    
    async initialize() {
        console.log('🔧 Initializing robust scraper...');
        
        // Launch browser with stealth settings
        this.browser = await puppeteer.launch({
            headless: 'new',
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--single-process',
                '--disable-gpu',
                '--user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            ],
            slowMo: 50 // Slow down to appear more human
        });
        
        this.page = await this.browser.newPage();
        
        // Set realistic viewport
        await this.page.setViewport({ width: 1366, height: 768 });
        
        // Block unnecessary resources to speed up
        await this.page.setRequestInterception(true);
        this.page.on('request', (req) => {
            const resourceType = req.resourceType();
            if (['image', 'stylesheet', 'font', 'media'].includes(resourceType)) {
                req.abort();
            } else {
                req.continue();
            }
        });
        
        // Initialize database
        this.db = new Database('tcgplayer_fixed.db');
        this.db.exec(`
            DROP TABLE IF EXISTS tcgplayer_cards_fixed;
            CREATE TABLE tcgplayer_cards_fixed (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                set_name TEXT,
                rarity TEXT,
                market_price REAL,
                low_price REAL,
                mid_price REAL,
                high_price REAL,
                direct_low REAL,
                subtype_name TEXT,
                condition_name TEXT,
                url TEXT,
                scraped_at TEXT DEFAULT CURRENT_TIMESTAMP,
                validation_status TEXT,
                data_quality_score INTEGER
            );
            
            CREATE INDEX idx_name ON tcgplayer_cards_fixed(name);
            CREATE INDEX idx_price ON tcgplayer_cards_fixed(market_price);
            CREATE INDEX idx_quality ON tcgplayer_cards_fixed(data_quality_score);
        `);
        
        console.log('✅ Scraper initialized successfully');
    }
    
    async humanDelay(min = 2000, max = 5000) {
        const delay = Math.floor(Math.random() * (max - min + 1)) + min;
        await new Promise(resolve => setTimeout(resolve, delay));
    }
    
    async detectCaptchaOrBlock() {
        const content = await this.page.content();
        const indicators = [
            'captcha',
            'blocked',
            'access denied',
            'rate limit',
            'too many requests',
            'cloudflare',
            'please verify',
            'human verification'
        ];
        
        return indicators.some(indicator => 
            content.toLowerCase().includes(indicator)
        );
    }
    
    validatePrice(price, cardName) {
        if (!price || isNaN(price) || price <= 0) {
            return { valid: false, reason: 'Invalid price format' };
        }
        
        if (price < 0.25) {
            return { valid: false, reason: 'Price too low (< $0.25)' };
        }
        
        if (price > 50000) {
            return { valid: false, reason: 'Price too high (> $50,000)' };
        }
        
        // Check for obvious corruption patterns
        if (price === 0.01 || price === 0.02 || price === 0.03) {
            return { valid: false, reason: 'Obvious corruption pattern' };
        }
        
        // High-value cards shouldn't be under $1
        const highValueKeywords = ['charizard', 'pikachu', 'mew', 'lugia', 'rayquaza'];
        if (highValueKeywords.some(keyword => cardName.toLowerCase().includes(keyword)) && price < 1.00) {
            return { valid: false, reason: 'High-value card priced too low' };
        }
        
        return { valid: true, reason: 'Valid price' };
    }
    
    calculateDataQualityScore(cardData) {
        let score = 0;
        
        // Basic data completeness (40 points)
        if (cardData.name && cardData.name.length > 3) score += 10;
        if (cardData.set_name && cardData.set_name.length > 2) score += 10;
        if (cardData.market_price && cardData.market_price > 0) score += 20;
        
        // Price data quality (30 points)
        if (cardData.low_price && cardData.low_price > 0) score += 10;
        if (cardData.mid_price && cardData.mid_price > 0) score += 10;
        if (cardData.high_price && cardData.high_price > 0) score += 10;
        
        // Price consistency (30 points)
        if (cardData.low_price && cardData.high_price && cardData.market_price) {
            if (cardData.low_price <= cardData.market_price && 
                cardData.market_price <= cardData.high_price) {
                score += 30;
            } else if (cardData.low_price <= cardData.high_price) {
                score += 15; // Some consistency
            }
        }
        
        return score;
    }
    
    async scrapePage(url, pageNum) {
        console.log(`📄 Scraping page ${pageNum}: ${url}`);
        
        try {
            await this.page.goto(url, { 
                waitUntil: 'networkidle0', 
                timeout: 30000 
            });
            
            // Check for captcha or blocking
            if (await this.detectCaptchaOrBlock()) {
                console.log('🚫 Captcha or blocking detected, waiting longer...');
                this.stats.captcha_encountered++;
                await this.humanDelay(10000, 20000);
                return [];
            }
            
            // Wait for content to load
            await this.page.waitForTimeout(3000);
            
            // Try multiple selectors for product cards
            const productSelectors = [
                '[data-testid*="product-card"]',
                '.product-card',
                '.search-result',
                '[class*="ProductCard"]',
                '[class*="product-item"]'
            ];
            
            let products = [];
            for (const selector of productSelectors) {
                try {
                    await this.page.waitForSelector(selector, { timeout: 5000 });
                    products = await this.page.$$(selector);
                    if (products.length > 0) {
                        console.log(`✅ Found ${products.length} products using selector: ${selector}`);
                        break;
                    }
                } catch (e) {
                    continue;
                }
            }
            
            if (products.length === 0) {
                console.log('⚠️  No products found on page');
                return [];
            }
            
            const pageData = [];
            
            for (let i = 0; i < products.length; i++) {
                try {
                    const cardData = await this.page.evaluate((element) => {
                        // Try multiple patterns for extracting data
                        const getText = (selectors) => {
                            for (const selector of selectors) {
                                const el = element.querySelector(selector);
                                if (el) return el.textContent.trim();
                            }
                            return null;
                        };
                        
                        const getPrice = (text) => {
                            if (!text) return null;
                            const match = text.match(/\$?(\d+\.?\d*)/);
                            return match ? parseFloat(match[1]) : null;
                        };
                        
                        // Extract card name
                        const name = getText([
                            '[data-testid*="product-name"]',
                            '.product-name',
                            '.card-name',
                            'h3', 'h4',
                            '[class*="title"]',
                            '[class*="name"]'
                        ]);
                        
                        // Extract set name
                        const set_name = getText([
                            '[data-testid*="set-name"]',
                            '.set-name',
                            '.product-set',
                            '[class*="set"]'
                        ]);
                        
                        // Extract prices - try multiple selectors
                        const priceSelectors = [
                            '[data-testid*="market-price"]',
                            '[data-testid*="price"]',
                            '.market-price',
                            '.price',
                            '[class*="price"]',
                            '[class*="Market"]'
                        ];
                        
                        let market_price = null;
                        for (const selector of priceSelectors) {
                            const priceEl = element.querySelector(selector);
                            if (priceEl) {
                                const priceText = priceEl.textContent;
                                market_price = getPrice(priceText);
                                if (market_price && market_price > 0) break;
                            }
                        }
                        
                        // Get URL
                        const linkEl = element.querySelector('a[href]');
                        const url = linkEl ? linkEl.href : null;
                        
                        return {
                            name,
                            set_name,
                            market_price,
                            url,
                            raw_html: element.innerHTML.substring(0, 500) // Debug info
                        };
                    }, products[i]);
                    
                    if (cardData.name && cardData.market_price) {
                        const validation = this.validatePrice(cardData.market_price, cardData.name);
                        
                        const processedCard = {
                            name: cardData.name,
                            set_name: cardData.set_name || 'Unknown',
                            market_price: cardData.market_price,
                            url: cardData.url,
                            validation_status: validation.valid ? 'VALID' : validation.reason,
                            data_quality_score: this.calculateDataQualityScore(cardData)
                        };
                        
                        if (validation.valid) {
                            this.stats.valid_prices++;
                        } else {
                            this.stats.invalid_prices++;
                        }
                        
                        pageData.push(processedCard);
                        this.stats.total_processed++;
                    }
                } catch (error) {
                    this.stats.errors++;
                    console.log(`⚠️  Error processing product ${i}: ${error.message}`);
                }
                
                // Progress update
                if (this.stats.total_processed % 25 === 0) {
                    console.log(`📊 Progress: ${this.stats.total_processed} cards | Valid: ${this.stats.valid_prices} | Invalid: ${this.stats.invalid_prices}`);
                }
            }
            
            return pageData;
            
        } catch (error) {
            console.log(`❌ Error scraping page ${pageNum}: ${error.message}`);
            this.stats.errors++;
            return [];
        }
    }
    
    async saveBatch(cards) {
        if (cards.length === 0) return;
        
        const stmt = this.db.prepare(`
            INSERT INTO tcgplayer_cards_fixed 
            (name, set_name, market_price, url, validation_status, data_quality_score)
            VALUES (?, ?, ?, ?, ?, ?)
        `);
        
        const transaction = this.db.transaction((cards) => {
            for (const card of cards) {
                stmt.run(
                    card.name,
                    card.set_name,
                    card.market_price,
                    card.url,
                    card.validation_status,
                    card.data_quality_score
                );
            }
        });
        
        transaction(cards);
        console.log(`💾 Saved ${cards.length} cards to database`);
    }
    
    async scrapeAllPages() {
        console.log('🚀 Starting comprehensive TCGPlayer scraping...');
        
        const baseUrl = 'https://www.tcgplayer.com/search/pokemon/product?productLineName=pokemon&page=';
        const maxPages = 200; // Start with reasonable limit
        
        for (let page = 1; page <= maxPages; page++) {
            console.log(`\n📄 === PAGE ${page}/${maxPages} ===`);
            
            const url = baseUrl + page;
            const pageCards = await this.scrapePage(url, page);
            
            if (pageCards.length > 0) {
                await this.saveBatch(pageCards);
            } else {
                console.log('📄 Empty page detected, may have reached end');
                if (page > 10) break; // Only break if we've scraped some pages
            }
            
            // Human-like delay between pages
            await this.humanDelay(3000, 7000);
            
            // Status update every 10 pages
            if (page % 10 === 0) {
                this.printStats();
            }
            
            // Quality check - if too many invalid prices, stop and investigate
            if (this.stats.total_processed > 100 && 
                (this.stats.invalid_prices / this.stats.total_processed) > 0.8) {
                console.log('🚨 High invalid price rate detected, stopping to investigate...');
                break;
            }
        }
    }
    
    printStats() {
        console.log('\n📊 SCRAPING STATISTICS:');
        console.log('======================');
        console.log(`   Total Processed: ${this.stats.total_processed.toLocaleString()}`);
        console.log(`   Valid Prices: ${this.stats.valid_prices.toLocaleString()} (${(this.stats.valid_prices/this.stats.total_processed*100).toFixed(1)}%)`);
        console.log(`   Invalid Prices: ${this.stats.invalid_prices.toLocaleString()} (${(this.stats.invalid_prices/this.stats.total_processed*100).toFixed(1)}%)`);
        console.log(`   Captcha Encounters: ${this.stats.captcha_encountered}`);
        console.log(`   Rate Limited: ${this.stats.rate_limited}`);
        console.log(`   Errors: ${this.stats.errors}`);
    }
    
    async generateQualityReport() {
        console.log('\n📊 FINAL QUALITY REPORT:');
        console.log('========================');
        
        // Overall stats
        const totalStats = this.db.prepare(`
            SELECT 
                COUNT(*) as total_cards,
                COUNT(CASE WHEN validation_status = 'VALID' THEN 1 END) as valid_cards,
                AVG(market_price) as avg_price,
                MIN(market_price) as min_price,
                MAX(market_price) as max_price,
                AVG(data_quality_score) as avg_quality_score
            FROM tcgplayer_cards_fixed
        `).get();
        
        console.log(`   Total Cards Scraped: ${totalStats.total_cards.toLocaleString()}`);
        console.log(`   Valid Cards: ${totalStats.valid_cards.toLocaleString()} (${(totalStats.valid_cards/totalStats.total_cards*100).toFixed(1)}%)`);
        console.log(`   Average Price: $${totalStats.avg_price?.toFixed(2) || '0'}`);
        console.log(`   Price Range: $${totalStats.min_price} - $${totalStats.max_price?.toLocaleString() || '0'}`);
        console.log(`   Average Quality Score: ${totalStats.avg_quality_score?.toFixed(0) || '0'}/100`);
        
        // Price distribution
        const priceDistribution = this.db.prepare(`
            SELECT 
                CASE 
                    WHEN market_price < 1.00 THEN 'Under $1'
                    WHEN market_price < 5.00 THEN '$1-$5'
                    WHEN market_price < 10.00 THEN '$5-$10'
                    WHEN market_price < 50.00 THEN '$10-$50'
                    WHEN market_price < 100.00 THEN '$50-$100'
                    ELSE 'Over $100'
                END as price_range,
                COUNT(*) as count
            FROM tcgplayer_cards_fixed
            WHERE validation_status = 'VALID'
            GROUP BY price_range
            ORDER BY MIN(market_price)
        `).all();
        
        console.log('\n   📈 Valid Price Distribution:');
        priceDistribution.forEach(range => {
            console.log(`      ${range.price_range}: ${range.count.toLocaleString()} cards`);
        });
        
        // Top cards
        const topCards = this.db.prepare(`
            SELECT name, set_name, market_price
            FROM tcgplayer_cards_fixed
            WHERE validation_status = 'VALID'
            ORDER BY market_price DESC
            LIMIT 10
        `).all();
        
        console.log('\n   💎 Top 10 Most Expensive Cards:');
        topCards.forEach((card, i) => {
            console.log(`      ${i+1}. ${card.name} (${card.set_name}): $${card.market_price.toLocaleString()}`);
        });
        
        return totalStats.valid_cards >= 1000 && (totalStats.valid_cards / totalStats.total_cards) >= 0.5;
    }
    
    async cleanup() {
        if (this.browser) {
            await this.browser.close();
        }
        if (this.db) {
            this.db.close();
        }
    }
}

async function main() {
    const scraper = new RobustTCGPlayerScraper();
    
    try {
        await scraper.initialize();
        await scraper.scrapeAllPages();
        
        scraper.printStats();
        const success = await scraper.generateQualityReport();
        
        if (success) {
            console.log('\n🎉 SCRAPING SUCCESSFUL!');
            console.log('✅ High-quality TCGPlayer data obtained');
            console.log('✅ Ready to replace corrupted data');
            process.exit(0);
        } else {
            console.log('\n⚠️  SCRAPING NEEDS IMPROVEMENT');
            console.log('❌ Quality thresholds not met');
            process.exit(1);
        }
        
    } catch (error) {
        console.error('❌ Fatal error:', error);
        process.exit(2);
    } finally {
        await scraper.cleanup();
    }
}

main();
