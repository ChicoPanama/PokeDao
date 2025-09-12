const { chromium } = require('playwright');
const fs = require('fs');

class TCGPlayerPokemonHarvester {
    constructor() {
        this.baseUrl = 'https://www.tcgplayer.com';
        this.pokemonSearchUrl = '/search/pokemon/product?productLineName=pokemon';
        this.results = [];
        this.totalPages = 0;
        this.harvestSession = {
            startTime: new Date().toISOString(),
            totalCards: 0,
            totalPages: 0,
            pagesProcessed: 0,
            errors: [],
            metadata: {}
        };
    }

    async initialize() {
        console.log('🚀 Initializing TCGPlayer Pokemon Harvester...');
        
        this.browser = await chromium.launch({
            headless: false,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas'
            ]
        });

        this.page = await this.browser.newPage();
        
        // Set viewport and user agent
        await this.page.setViewportSize({ width: 1920, height: 1080 });
        await this.page.setExtraHTTPHeaders({
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36'
        });
        
        // Block images and fonts to speed up loading
        await this.page.route('**/*', (route) => {
            const resourceType = route.request().resourceType();
            if (['image', 'font', 'stylesheet'].includes(resourceType)) {
                route.abort();
            } else {
                route.continue();
            }
        });

        console.log('✅ Harvester initialized successfully');
    }

    async discoverPagination() {
        console.log('🔍 Discovering TCGPlayer Pokemon pagination...');
        
        const searchUrl = `${this.baseUrl}${this.pokemonSearchUrl}&page=1`;
        console.log(`📍 Navigating to: ${searchUrl}`);
        
        await this.page.goto(searchUrl, { 
            waitUntil: 'domcontentloaded',
            timeout: 30000 
        });

        // Wait for page to load
        await this.page.waitForTimeout(3000);

        // Look for pagination information
        const paginationInfo = await this.page.evaluate(() => {
            const selectors = [
                '.pagination-info',
                '.results-summary',
                '.search-results-summary',
                '[data-testid="pagination"]',
                '.pagination',
                '.page-info',
                '.results-count'
            ];

            for (const selector of selectors) {
                const element = document.querySelector(selector);
                if (element) {
                    return {
                        selector,
                        text: element.textContent,
                        innerHTML: element.innerHTML
                    };
                }
            }

            // Look for pagination links
            const paginationLinks = Array.from(document.querySelectorAll('a[href*="page="]')).map(link => ({
                href: link.href,
                text: link.textContent
            }));

            // Count total cards on current page
            const cardSelectors = [
                '.search-result',
                '.product-item',
                '.card-item',
                '.listing-item',
                '[data-testid="product"]',
                '.product-card'
            ];

            let cardsOnPage = 0;
            for (const selector of cardSelectors) {
                const elements = document.querySelectorAll(selector);
                if (elements.length > 0) {
                    cardsOnPage = elements.length;
                    break;
                }
            }

            return {
                paginationLinks,
                cardsOnPage,
                url: window.location.href,
                title: document.title
            };
        });

        console.log('📊 Pagination Discovery Results:', JSON.stringify(paginationInfo, null, 2));

        // Extract page numbers from pagination links
        const pageNumbers = paginationInfo.paginationLinks
            .map(link => {
                const match = link.href.match(/page=(\d+)/);
                return match ? parseInt(match[1]) : null;
            })
            .filter(num => num !== null);

        this.totalPages = pageNumbers.length > 0 ? Math.max(...pageNumbers) : 1;
        
        console.log(`📄 Discovered ${this.totalPages} total pages with ${paginationInfo.cardsOnPage} cards per page`);
        
        this.harvestSession.totalPages = this.totalPages;
        this.harvestSession.metadata.paginationInfo = paginationInfo;

        return this.totalPages;
    }

    async extractCardsFromPage(pageNumber) {
        console.log(`🎯 Extracting cards from page ${pageNumber}...`);
        
        const searchUrl = `${this.baseUrl}${this.pokemonSearchUrl}&page=${pageNumber}`;
        await this.page.goto(searchUrl, { 
            waitUntil: 'domcontentloaded',
            timeout: 30000 
        });

        // Wait for content to load
        await this.page.waitForTimeout(2000);

        const cards = await this.page.evaluate((pageNum) => {
            const cardSelectors = [
                '.search-result',
                '.product-item',
                '.card-item',
                '.listing-item',
                '[data-testid="product"]',
                '.product-card',
                '.search-result-item'
            ];

            let cardElements = [];
            
            // Find the best selector
            for (const selector of cardSelectors) {
                const elements = document.querySelectorAll(selector);
                if (elements.length > 0) {
                    cardElements = Array.from(elements);
                    console.log(`Found ${elements.length} cards using selector: ${selector}`);
                    break;
                }
            }

            return cardElements.map((element, index) => {
                try {
                    // Extract card name
                    const nameSelectors = [
                        '.product-name',
                        '.card-name',
                        '.listing-title',
                        '.search-result-title',
                        'h3', 'h4', '.title',
                        'a[href*="/product/"]'
                    ];
                    
                    let name = '';
                    for (const selector of nameSelectors) {
                        const nameEl = element.querySelector(selector);
                        if (nameEl) {
                            name = nameEl.textContent.trim();
                            break;
                        }
                    }

                    // Extract price
                    const priceSelectors = [
                        '.price',
                        '.market-price',
                        '.listing-price',
                        '.current-price',
                        '[data-testid="price"]',
                        '.price-point'
                    ];
                    
                    let price = '';
                    for (const selector of priceSelectors) {
                        const priceEl = element.querySelector(selector);
                        if (priceEl) {
                            price = priceEl.textContent.trim();
                            break;
                        }
                    }

                    // Extract set/edition
                    const setSelectors = [
                        '.set-name',
                        '.edition',
                        '.product-line',
                        '.card-set'
                    ];
                    
                    let set = '';
                    for (const selector of setSelectors) {
                        const setEl = element.querySelector(selector);
                        if (setEl) {
                            set = setEl.textContent.trim();
                            break;
                        }
                    }

                    // Extract product URL
                    const linkElement = element.querySelector('a[href*="/product/"]');
                    const productUrl = linkElement ? linkElement.href : '';

                    // Extract rarity
                    const raritySelectors = [
                        '.rarity',
                        '.card-rarity',
                        '[data-rarity]'
                    ];
                    
                    let rarity = '';
                    for (const selector of raritySelectors) {
                        const rarityEl = element.querySelector(selector);
                        if (rarityEl) {
                            rarity = rarityEl.textContent.trim() || rarityEl.getAttribute('data-rarity') || '';
                            break;
                        }
                    }

                    // Check if this is actually a Pokemon card
                    const isPokemon = name.toLowerCase().includes('pokemon') || 
                                     name.toLowerCase().includes('pikachu') ||
                                     name.toLowerCase().includes('charizard') ||
                                     name.toLowerCase().includes('pokémon') ||
                                     set.toLowerCase().includes('pokemon') ||
                                     productUrl.includes('/pokemon/');

                    return {
                        id: `tcgplayer_${pageNum}_${index}`,
                        source: 'tcgplayer',
                        name,
                        price,
                        set,
                        rarity,
                        productUrl,
                        isPokemon,
                        pageNumber: pageNum,
                        extractedAt: new Date().toISOString(),
                        rawHtml: element.outerHTML.substring(0, 500) // First 500 chars for debugging
                    };
                } catch (error) {
                    console.error(`Error extracting card ${index}:`, error);
                    return {
                        id: `tcgplayer_${pageNum}_${index}_error`,
                        source: 'tcgplayer',
                        error: error.message,
                        pageNumber: pageNum,
                        extractedAt: new Date().toISOString()
                    };
                }
            });
        }, pageNumber);

        const pokemonCards = cards.filter(card => card.isPokemon && card.name);
        console.log(`📋 Page ${pageNumber}: Found ${cards.length} total items, ${pokemonCards.length} Pokemon cards`);

        this.results.push(...pokemonCards);
        this.harvestSession.totalCards = this.results.length;
        this.harvestSession.pagesProcessed = pageNumber;

        return pokemonCards;
    }

    async harvestAll(maxPages = null) {
        console.log('🌾 Starting full TCGPlayer Pokemon harvest...');
        
        try {
            await this.initialize();
            await this.discoverPagination();

            const pagesToProcess = maxPages ? Math.min(maxPages, this.totalPages) : this.totalPages;
            console.log(`📊 Will process ${pagesToProcess} pages out of ${this.totalPages} total pages`);

            for (let page = 1; page <= pagesToProcess; page++) {
                try {
                    console.log(`\n🔄 Processing page ${page}/${pagesToProcess}...`);
                    await this.extractCardsFromPage(page);
                    
                    // Add delay between pages to be respectful
                    if (page < pagesToProcess) {
                        console.log('⏱️  Waiting 2 seconds before next page...');
                        await this.page.waitForTimeout(2000);
                    }
                } catch (error) {
                    console.error(`❌ Error processing page ${page}:`, error);
                    this.harvestSession.errors.push({
                        page,
                        error: error.message,
                        timestamp: new Date().toISOString()
                    });
                }
            }

            this.harvestSession.endTime = new Date().toISOString();
            this.harvestSession.duration = new Date(this.harvestSession.endTime) - new Date(this.harvestSession.startTime);

            console.log('\n🎉 Harvest completed successfully!');
            console.log(`📊 Total Pokemon cards extracted: ${this.results.length}`);
            console.log(`📄 Pages processed: ${this.harvestSession.pagesProcessed}/${this.totalPages}`);
            console.log(`⏱️  Duration: ${Math.round(this.harvestSession.duration / 1000)} seconds`);

            await this.saveResults();

        } catch (error) {
            console.error('💥 Critical error during harvest:', error);
            this.harvestSession.errors.push({
                type: 'critical',
                error: error.message,
                timestamp: new Date().toISOString()
            });
        } finally {
            if (this.browser) {
                await this.browser.close();
            }
        }
    }

    async saveResults() {
        const timestamp = Date.now();
        const filename = `tcgplayer-pokemon-harvest-${timestamp}.json`;
        
        const output = {
            harvestSession: this.harvestSession,
            cards: this.results,
            summary: {
                totalCards: this.results.length,
                totalPages: this.totalPages,
                pagesProcessed: this.harvestSession.pagesProcessed,
                successRate: this.harvestSession.pagesProcessed / this.totalPages,
                avgCardsPerPage: this.results.length / this.harvestSession.pagesProcessed,
                errors: this.harvestSession.errors.length
            }
        };

        fs.writeFileSync(filename, JSON.stringify(output, null, 2));
        console.log(`💾 Results saved to: ${filename}`);

        // Also save a summary file
        const summaryFilename = `tcgplayer-summary-${timestamp}.json`;
        fs.writeFileSync(summaryFilename, JSON.stringify(output.summary, null, 2));
        console.log(`📊 Summary saved to: ${summaryFilename}`);

        return filename;
    }

    async testSinglePage() {
        console.log('🧪 Testing single page extraction...');
        
        try {
            await this.initialize();
            await this.discoverPagination();
            
            const testCards = await this.extractCardsFromPage(1);
            console.log('\n🎯 Test Results:');
            console.log(`📋 Found ${testCards.length} Pokemon cards on page 1`);
            
            if (testCards.length > 0) {
                console.log('\n🃏 Sample cards:');
                testCards.slice(0, 5).forEach((card, index) => {
                    console.log(`  ${index + 1}. ${card.name} - ${card.price} (${card.set})`);
                });
            }

            await this.saveResults();
            
        } catch (error) {
            console.error('❌ Test failed:', error);
        } finally {
            if (this.browser) {
                await this.browser.close();
            }
        }
    }
}

// Main execution
async function main() {
    const harvester = new TCGPlayerPokemonHarvester();
    
    const args = process.argv.slice(2);
    
    if (args.includes('--test')) {
        await harvester.testSinglePage();
    } else if (args.includes('--sample')) {
        const pages = parseInt(args[args.indexOf('--sample') + 1]) || 5;
        await harvester.harvestAll(pages);
    } else {
        await harvester.harvestAll();
    }
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = TCGPlayerPokemonHarvester;
