/**
 * ENHANCED FANATICS COLLECT POKEMON HARVESTER
 * ===========================================
 * 
 * Based on site research findings:
 * - Remove "Top 200" filter limitation
 * - Implement full 50-page pagination
 * - Handle authentication properly
 * - Add robust error handling and rate limiting
 * - Capture both active auctions and sold data
 */

const { chromium } = require('playwright');
const fs = require('fs');

class EnhancedPokemonHarvester {
    constructor() {
        this.results = {
            activeCards: [],
            soldCards: [],
            metadata: {
                totalPages: 0,
                processedPages: 0,
                errors: [],
                startTime: new Date(),
                endTime: null
            }
        };
        
        // Enhanced configuration
        this.config = {
            maxConcurrentPages: 2, // Reduced for stability
            delayBetweenPages: 3000, // Increased delay
            pageTimeout: 45000, // Increased timeout
            maxRetries: 3,
            itemsPerPage: 48
        };
    }

    async harvest() {
        console.log('🚀 ENHANCED POKEMON HARVESTER STARTING');
        console.log('=====================================');
        console.log(`⚙️  Max Pages: ALL (discover dynamically)`);
        console.log(`⚙️  Items/Page: ${this.config.itemsPerPage}`);
        console.log(`⚙️  Concurrent: ${this.config.maxConcurrentPages}`);
        console.log(`⚙️  Delay: ${this.config.delayBetweenPages}ms`);

        const browser = await chromium.launch({ 
            headless: false, // Keep visible for debugging
            args: [
                '--no-sandbox',
                '--disable-web-security',
                '--disable-features=VizDisplayCompositor'
            ]
        });

        const context = await browser.newContext({
            userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36',
            viewport: { width: 1920, height: 1080 }
        });

        try {
            // 1. Harvest Active Pokemon Auctions (NO TOP 200 FILTER)
            await this.harvestActiveAuctions(context);
            
            // 2. Harvest Sold Pokemon Data
            await this.harvestSoldData(context);
            
            // 3. Generate comprehensive report
            await this.generateReport();

        } catch (error) {
            console.error('❌ Harvest failed:', error);
            this.results.metadata.errors.push(error.message);
        } finally {
            await browser.close();
            this.results.metadata.endTime = new Date();
            await this.saveResults();
        }
    }

    async harvestActiveAuctions(context) {
        console.log('\n🟢 HARVESTING ACTIVE POKEMON AUCTIONS');
        console.log('====================================');
        console.log('🎯 REMOVED TOP 200 FILTER - Getting ALL Pokemon cards');

        // ENHANCED URL - Removed Top 200 filter
        const baseUrl = 'https://www.fanaticscollect.com/weekly-auction' +
            '?type=WEEKLY' +
            '&category=Trading+Card+Games+%3E+Pok%C3%A9mon+(English),Trading+Card+Games+%3E+Pok%C3%A9mon+(Japanese),Trading+Card+Games+%3E+Pok%C3%A9mon+(Other+Languages)' +
            '&itemsPerPage=' + this.config.itemsPerPage +
            '&sortBy=prod_item_state_v1_price_desc';
            // NOTE: NO featured=filter-Pokemon:+Top+200 parameter!

        const page = await context.newPage();
        
        // Set up network interception for API data
        const graphqlResponses = [];
        page.on('response', async response => {
            if (response.url().includes('graphql') || response.url().includes('/api/')) {
                try {
                    const data = await response.json();
                    graphqlResponses.push({
                        url: response.url(),
                        data: data,
                        timestamp: new Date()
                    });
                } catch (e) {
                    // Ignore non-JSON responses
                }
            }
        });

        try {
            // First, discover total pages
            console.log('🔍 Discovering total pages...');
            await page.goto(`${baseUrl}&page=1`, { 
                waitUntil: 'networkidle', 
                timeout: this.config.pageTimeout 
            });

            const totalPages = await this.discoverTotalPages(page);
            this.results.metadata.totalPages = totalPages;
            console.log(`📄 Discovered ${totalPages} total pages`);

            // Harvest all pages with enhanced error handling
            for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
                await this.harvestActivePage(page, baseUrl, pageNum, graphqlResponses);
                
                // Progress update
                this.results.metadata.processedPages = pageNum;
                const progress = ((pageNum / totalPages) * 100).toFixed(1);
                console.log(`📊 Progress: ${progress}% (${pageNum}/${totalPages} pages)`);
                
                // Rate limiting
                if (pageNum < totalPages) {
                    await this.sleep(this.config.delayBetweenPages);
                }
            }

        } catch (error) {
            console.error('❌ Active auction harvest failed:', error);
            this.results.metadata.errors.push(`Active harvest: ${error.message}`);
        } finally {
            await page.close();
        }

        console.log(`✅ Active auction harvest complete: ${this.results.activeCards.length} cards`);
    }

    async discoverTotalPages(page) {
        try {
            // Wait for page to load completely
            await page.waitForTimeout(3000);

            const paginationInfo = await page.evaluate(() => {
                // Multiple selectors for pagination
                const selectors = [
                    '[class*="paginat"] a, [class*="paginat"] span',
                    '.pagination a, .pagination span',
                    '[data-testid*="paginat"] a, [data-testid*="paginat"] span',
                    'nav a, nav span',
                    'a[href*="page="], span[href*="page="]'
                ];

                for (const selector of selectors) {
                    const elements = document.querySelectorAll(selector);
                    if (elements.length > 0) {
                        const pageNumbers = Array.from(elements)
                            .map(el => el.textContent.trim())
                            .filter(text => /^\d+$/.test(text))
                            .map(num => parseInt(num));
                        
                        if (pageNumbers.length > 0) {
                            return Math.max(...pageNumbers);
                        }
                    }
                }

                // Fallback: look for any number that could be a page count
                const bodyText = document.body.innerText;
                const pageMatches = bodyText.match(/page\s+\d+\s+of\s+(\d+)/i) || 
                                  bodyText.match(/(\d+)\s+pages/i) ||
                                  bodyText.match(/1\s+2\s+3.*?(\d+)/);
                
                if (pageMatches) {
                    return parseInt(pageMatches[1]);
                }

                return 50; // Fallback based on screenshot
            });

            return paginationInfo || 50;

        } catch (error) {
            console.warn('⚠️ Could not discover total pages, using default 50');
            return 50;
        }
    }

    async harvestActivePage(page, baseUrl, pageNum, graphqlResponses) {
        const url = `${baseUrl}&page=${pageNum}`;
        let retryCount = 0;

        while (retryCount < this.config.maxRetries) {
            try {
                console.log(`📄 Active Page ${pageNum}: Loading...`);
                
                await page.goto(url, { 
                    waitUntil: 'networkidle', 
                    timeout: this.config.pageTimeout 
                });

                // Extract cards from this page
                const pageCards = await this.extractCardsFromPage(page);
                
                if (pageCards.length > 0) {
                    this.results.activeCards.push(...pageCards);
                    console.log(`   ✅ Captured ${pageCards.length} cards from page ${pageNum}`);
                    return; // Success
                } else {
                    console.log(`   ⚠️ No cards found on page ${pageNum}`);
                    return; // No cards, but not an error
                }

            } catch (error) {
                retryCount++;
                console.error(`   ❌ Page ${pageNum} attempt ${retryCount} failed: ${error.message}`);
                
                if (retryCount < this.config.maxRetries) {
                    const delay = 2000 * retryCount; // Exponential backoff
                    console.log(`   🔄 Retrying in ${delay}ms...`);
                    await this.sleep(delay);
                } else {
                    this.results.metadata.errors.push(`Page ${pageNum}: ${error.message}`);
                }
            }
        }
    }

    async extractCardsFromPage(page) {
        return await page.evaluate(() => {
            // Enhanced card extraction
            const cardSelectors = [
                '[class*="auction-item"]',
                '[class*="card-item"]',
                '[class*="lot-item"]',
                '[data-testid*="item"]',
                '.card',
                '.item',
                '[class*="product"]'
            ];

            let cards = [];
            
            for (const selector of cardSelectors) {
                const elements = document.querySelectorAll(selector);
                if (elements.length > 0) {
                    cards = Array.from(elements).map(element => {
                        // Extract comprehensive card data
                        const titleEl = element.querySelector('[class*="title"], h1, h2, h3, h4') ||
                                       element.querySelector('a[href*="lot"]') ||
                                       element;
                        
                        const priceEl = element.querySelector('[class*="price"], [class*="bid"], [class*="amount"]') ||
                                       element.querySelector('*');
                        
                        const imageEl = element.querySelector('img');
                        
                        const linkEl = element.querySelector('a[href*="lot"], a[href*="auction"]') ||
                                      element.querySelector('a');

                        // Extract text content safely
                        const title = titleEl ? titleEl.textContent.trim() : '';
                        const priceText = priceEl ? priceEl.textContent.trim() : '';
                        const imageUrl = imageEl ? imageEl.src : '';
                        const lotUrl = linkEl ? linkEl.href : '';

                        // Parse price from text
                        const priceMatch = priceText.match(/\$[\d,]+/);
                        const price = priceMatch ? parseInt(priceMatch[0].replace(/[$,]/g, '')) : 0;

                        // Only include if it looks like a Pokemon card
                        const isPokemon = title.toLowerCase().includes('pokemon') ||
                                        title.toLowerCase().includes('charizard') ||
                                        title.toLowerCase().includes('pikachu') ||
                                        title.toLowerCase().includes('psa') ||
                                        title.toLowerCase().includes('gem mint');

                        if (isPokemon && title.length > 5) {
                            return {
                                title: title,
                                price: price,
                                priceText: priceText,
                                imageUrl: imageUrl,
                                lotUrl: lotUrl,
                                source: 'fanatics-active',
                                scrapedAt: new Date().toISOString(),
                                pageNumber: new URLSearchParams(window.location.search).get('page') || '1'
                            };
                        }
                        return null;
                    }).filter(Boolean);
                    
                    if (cards.length > 0) break; // Found cards with this selector
                }
            }

            return cards;
        });
    }

    async harvestSoldData(context) {
        console.log('\n🔴 HARVESTING SOLD POKEMON DATA');
        console.log('==============================');

        const soldUrl = 'https://sales-history.fanaticscollect.com/?category=Pok%C3%A9mon&sort=purchasePrice%2Cdesc';
        const page = await context.newPage();

        try {
            // Harvest sold data with pagination
            let soldPageNum = 1;
            let hasMoreSoldPages = true;

            while (hasMoreSoldPages && soldPageNum <= 50) { // Limit to 50 pages for now
                const url = `${soldUrl}&page=${soldPageNum}`;
                
                try {
                    console.log(`📄 Sold Page ${soldPageNum}: Loading...`);
                    await page.goto(url, { 
                        waitUntil: 'networkidle', 
                        timeout: this.config.pageTimeout 
                    });

                    const soldCards = await this.extractSoldCardsFromPage(page);
                    
                    if (soldCards.length > 0) {
                        this.results.soldCards.push(...soldCards);
                        console.log(`   ✅ Captured ${soldCards.length} sold cards from page ${soldPageNum}`);
                        soldPageNum++;
                    } else {
                        console.log(`   ⚠️ No sold cards on page ${soldPageNum}, stopping`);
                        hasMoreSoldPages = false;
                    }

                } catch (error) {
                    console.error(`   ❌ Sold page ${soldPageNum} failed: ${error.message}`);
                    hasMoreSoldPages = false;
                }

                await this.sleep(this.config.delayBetweenPages);
            }

        } catch (error) {
            console.error('❌ Sold data harvest failed:', error);
            this.results.metadata.errors.push(`Sold harvest: ${error.message}`);
        } finally {
            await page.close();
        }

        console.log(`✅ Sold data harvest complete: ${this.results.soldCards.length} cards`);
    }

    async extractSoldCardsFromPage(page) {
        return await page.evaluate(() => {
            // Extract sold card data (similar logic to active cards)
            const rows = document.querySelectorAll('tr, [class*="row"], [class*="item"]');
            
            return Array.from(rows).map(row => {
                const title = row.querySelector('[class*="title"], td, [class*="name"]')?.textContent?.trim() || '';
                const price = row.querySelector('[class*="price"], [class*="amount"]')?.textContent?.trim() || '';
                const date = row.querySelector('[class*="date"]')?.textContent?.trim() || '';

                const priceMatch = price.match(/\$[\d,]+/);
                const parsedPrice = priceMatch ? parseInt(priceMatch[0].replace(/[$,]/g, '')) : 0;

                if (title.length > 5 && parsedPrice > 0) {
                    return {
                        title: title,
                        price: parsedPrice,
                        priceText: price,
                        soldDate: date,
                        source: 'fanatics-sold',
                        scrapedAt: new Date().toISOString()
                    };
                }
                return null;
            }).filter(Boolean);
        });
    }

    async generateReport() {
        const totalCards = this.results.activeCards.length + this.results.soldCards.length;
        const totalActiveValue = this.results.activeCards.reduce((sum, card) => sum + card.price, 0);
        const totalSoldValue = this.results.soldCards.reduce((sum, card) => sum + card.price, 0);

        console.log('\n📊 ENHANCED HARVEST RESULTS');
        console.log('===========================');
        console.log(`🎴 Total Pokemon Cards: ${totalCards.toLocaleString()}`);
        console.log(`🟢 Active Listings: ${this.results.activeCards.length.toLocaleString()} ($${totalActiveValue.toLocaleString()})`);
        console.log(`🔴 Sold Cards: ${this.results.soldCards.length.toLocaleString()} ($${totalSoldValue.toLocaleString()})`);
        console.log(`📄 Pages Processed: ${this.results.metadata.processedPages}/${this.results.metadata.totalPages}`);
        console.log(`❌ Errors: ${this.results.metadata.errors.length}`);

        // Top 10 most expensive active cards
        const topActive = this.results.activeCards
            .sort((a, b) => b.price - a.price)
            .slice(0, 10);

        console.log('\n💎 Top 10 Most Expensive Active Pokemon:');
        topActive.forEach((card, i) => {
            console.log(`   ${i + 1}. $${card.price.toLocaleString()} - ${card.title.substring(0, 80)}...`);
        });

        // Top 10 highest sold cards
        const topSold = this.results.soldCards
            .sort((a, b) => b.price - a.price)
            .slice(0, 10);

        console.log('\n🔥 Top 10 Highest Sold Pokemon:');
        topSold.forEach((card, i) => {
            console.log(`   ${i + 1}. $${card.price.toLocaleString()} - ${card.title.substring(0, 80)}...`);
        });
    }

    async saveResults() {
        const timestamp = Date.now();
        const filename = `enhanced-pokemon-harvest-${timestamp}.json`;

        const report = {
            ...this.results,
            metadata: {
                ...this.results.metadata,
                harvestDuration: this.results.metadata.endTime - this.results.metadata.startTime,
                configUsed: this.config
            }
        };

        fs.writeFileSync(filename, JSON.stringify(report, null, 2));
        console.log(`\n💾 Enhanced harvest saved to: ${filename}`);
        console.log(`📊 File size: ${(fs.statSync(filename).size / 1024 / 1024).toFixed(2)} MB`);
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Run the enhanced harvester
const harvester = new EnhancedPokemonHarvester();
harvester.harvest().catch(console.error);
