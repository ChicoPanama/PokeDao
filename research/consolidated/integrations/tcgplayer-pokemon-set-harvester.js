const axios = require('axios');
const fs = require('fs');
const { chromium } = require('playwright');

/**
 * TCGPlayer Pokemon Set Harvester
 * Uses the navigation API to discover all Pokemon sets,
 * then harvests complete product data from each set
 */
class TCGPlayerPokemonSetHarvester {
    constructor() {
        this.navigationAPI = 'https://marketplace-navigation.tcgplayer.com/marketplace-navigation-search-feature.json';
        this.baseUrl = 'https://www.tcgplayer.com';
        
        this.session = {
            startTime: new Date().toISOString(),
            pokemonSets: [],
            allProducts: [],
            totalProducts: 0,
            processedSets: 0,
            errors: []
        };
        
        this.headers = {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
            'Accept': 'application/json, text/plain, */*',
            'Accept-Language': 'en-US,en;q=0.9',
            'Referer': 'https://www.tcgplayer.com/'
        };
    }

    /**
     * Discover all Pokemon sets from navigation API
     */
    async discoverPokemonSets() {
        console.log('🔍 Discovering Pokemon sets from navigation API...');
        
        try {
            const response = await axios.get(this.navigationAPI, { headers: this.headers });
            
            const pokemonCategory = response.data.categories.find(cat => 
                cat.title && (
                    cat.title.toLowerCase().includes('pokemon') || 
                    cat.title.toLowerCase().includes('pokémon') ||
                    cat.title === 'Pokémon'
                )
            );
            
            if (!pokemonCategory) {
                throw new Error('Pokemon category not found in navigation API');
            }
            
            console.log(`🎯 Found Pokemon category: ${pokemonCategory.title}`);
            
            // Extract all Pokemon set URLs
            const sets = [];
            
            for (const menu of pokemonCategory.menus) {
                if (menu.links) {
                    for (const link of menu.links) {
                        if (link.url && link.url.includes('/search/pokemon/')) {
                            sets.push({
                                title: link.title,
                                url: link.url,
                                fullUrl: link.url.startsWith('http') ? link.url : `${this.baseUrl}${link.url}`,
                                menuCategory: menu.title
                            });
                        }
                    }
                }
            }
            
            // Also add the main Pokemon URLs
            const mainUrls = [
                {
                    title: 'All Pokemon Products',
                    url: pokemonCategory.shopAllUrl,
                    fullUrl: `${this.baseUrl}${pokemonCategory.shopAllUrl}`,
                    menuCategory: 'Main'
                },
                {
                    title: 'Pokemon Advanced Search',
                    url: pokemonCategory.advancedSearchUrl,
                    fullUrl: pokemonCategory.advancedSearchUrl,
                    menuCategory: 'Search'
                }
            ];
            
            sets.push(...mainUrls);
            
            this.session.pokemonSets = sets;
            console.log(`📦 Discovered ${sets.length} Pokemon sets/categories:`);
            
            sets.forEach((set, index) => {
                console.log(`   ${index + 1}. ${set.title} (${set.menuCategory})`);
            });
            
            return sets;
            
        } catch (error) {
            console.error('💥 Error discovering Pokemon sets:', error.message);
            throw error;
        }
    }

    /**
     * Harvest products from a specific Pokemon set/search page
     */
    async harvestSetProducts(set, maxPages = 5) {
        console.log(`\n🌾 Harvesting products from: ${set.title}`);
        console.log(`📍 URL: ${set.fullUrl}`);
        
        const browser = await chromium.launch({ headless: true });
        const page = await browser.newPage();
        
        try {
            await page.setExtraHTTPHeaders(this.headers);
            await page.goto(set.fullUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
            await page.waitForTimeout(3000);
            
            const setProducts = [];
            let currentPage = 1;
            
            while (currentPage <= maxPages) {
                console.log(`📄 Processing page ${currentPage} of ${set.title}...`);
                
                // Extract products from current page
                const pageProducts = await page.evaluate(({ setInfo, pageNum }) => {
                    const products = [];
                    
                    // Try multiple product selectors
                    const selectors = [
                        '.search-result',
                        '.product-card',
                        '.product-item',
                        '[data-testid="product"]',
                        '.listing-item',
                        '.card-item'
                    ];
                    
                    let foundElements = [];
                    
                    for (const selector of selectors) {
                        const elements = document.querySelectorAll(selector);
                        if (elements.length > 0) {
                            foundElements = Array.from(elements);
                            console.log(`Found ${elements.length} products using selector: ${selector}`);
                            break;
                        }
                    }
                    
                    foundElements.forEach((element, index) => {
                        try {
                            // Extract product information
                            const nameEl = element.querySelector('.product-name, .card-name, h3, h4, .title, a[href*="/product/"]');
                            const priceEl = element.querySelector('.price, .market-price, .listing-price, .current-price');
                            const linkEl = element.querySelector('a[href*="/product/"]');
                            const imageEl = element.querySelector('img');
                            
                            const name = nameEl ? nameEl.textContent.trim() : '';
                            const price = priceEl ? priceEl.textContent.trim() : '';
                            const productUrl = linkEl ? linkEl.href : '';
                            const imageUrl = imageEl ? imageEl.src : '';
                            
                            // Extract additional details
                            const setNameEl = element.querySelector('.set-name, .edition, .product-line');
                            const rarityEl = element.querySelector('.rarity, .card-rarity');
                            
                            const setName = setNameEl ? setNameEl.textContent.trim() : setInfo.title;
                            const rarity = rarityEl ? rarityEl.textContent.trim() : '';
                            
                            if (name && name.length > 0) {
                                products.push({
                                    id: `tcgplayer_${setInfo.title.replace(/[^a-zA-Z0-9]/g, '_')}_${pageNum}_${index}`,
                                    source: 'tcgplayer',
                                    name: name,
                                    price: price,
                                    setName: setName,
                                    setUrl: setInfo.fullUrl,
                                    rarity: rarity,
                                    productUrl: productUrl,
                                    imageUrl: imageUrl,
                                    category: 'Pokemon',
                                    menuCategory: setInfo.menuCategory,
                                    page: pageNum,
                                    extractedAt: new Date().toISOString()
                                });
                            }
                        } catch (error) {
                            console.error(`Error extracting product ${index}:`, error);
                        }
                    });
                    
                    return products;
                }, { setInfo: set, pageNum: currentPage });
                
                if (pageProducts.length > 0) {
                    setProducts.push(...pageProducts);
                    console.log(`📦 Page ${currentPage}: Found ${pageProducts.length} products (total: ${setProducts.length})`);
                } else {
                    console.log(`📭 Page ${currentPage}: No products found, ending pagination`);
                    break;
                }
                
                // Try to navigate to next page
                const hasNextPage = await page.evaluate(() => {
                    const nextButtons = [
                        'a[aria-label="Next"]',
                        '.pagination-next',
                        '.next-page',
                        'a[href*="page=' + (parseInt(new URLSearchParams(window.location.search).get('page') || '1') + 1) + '"]'
                    ];
                    
                    for (const selector of nextButtons) {
                        const button = document.querySelector(selector);
                        if (button && !button.disabled && !button.classList.contains('disabled')) {
                            button.click();
                            return true;
                        }
                    }
                    return false;
                });
                
                if (hasNextPage) {
                    await page.waitForTimeout(2000); // Wait for page load
                    currentPage++;
                } else {
                    console.log(`📄 No more pages found for ${set.title}`);
                    break;
                }
            }
            
            console.log(`✅ ${set.title}: Harvested ${setProducts.length} total products`);
            return setProducts;
            
        } catch (error) {
            console.error(`💥 Error harvesting ${set.title}:`, error.message);
            this.session.errors.push({
                set: set.title,
                error: error.message,
                timestamp: new Date().toISOString()
            });
            return [];
        } finally {
            await browser.close();
        }
    }

    /**
     * Harvest all Pokemon sets
     */
    async harvestAllSets(maxPagesPerSet = 5, maxSets = null) {
        console.log('🚀 Starting Pokemon sets harvesting...');
        
        await this.discoverPokemonSets();
        
        const setsToProcess = maxSets ? this.session.pokemonSets.slice(0, maxSets) : this.session.pokemonSets;
        console.log(`📊 Will process ${setsToProcess.length} sets with max ${maxPagesPerSet} pages each`);
        
        for (const set of setsToProcess) {
            try {
                const setProducts = await this.harvestSetProducts(set, maxPagesPerSet);
                this.session.allProducts.push(...setProducts);
                this.session.processedSets++;
                
                console.log(`📈 Progress: ${this.session.processedSets}/${setsToProcess.length} sets, ${this.session.allProducts.length} total products`);
                
                // Rate limiting between sets
                await this.sleep(2000);
                
            } catch (error) {
                console.error(`💥 Failed to process set ${set.title}:`, error.message);
            }
        }
        
        // Remove duplicates
        this.session.allProducts = this.deduplicateProducts(this.session.allProducts);
        this.session.totalProducts = this.session.allProducts.length;
        
        console.log(`\n🎉 Harvesting complete!`);
        console.log(`📊 Final results:`);
        console.log(`   📦 Sets processed: ${this.session.processedSets}/${setsToProcess.length}`);
        console.log(`   🎴 Total unique products: ${this.session.totalProducts}`);
        console.log(`   ⚠️  Errors: ${this.session.errors.length}`);
        
        return this.session.allProducts;
    }

    /**
     * Remove duplicate products
     */
    deduplicateProducts(products) {
        const seen = new Set();
        return products.filter(product => {
            const key = `${product.name}_${product.setName}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    }

    /**
     * Save results to files
     */
    async saveResults() {
        const timestamp = Date.now();
        
        const results = {
            metadata: {
                extractedAt: new Date().toISOString(),
                totalProducts: this.session.totalProducts,
                processedSets: this.session.processedSets,
                totalSets: this.session.pokemonSets.length,
                errors: this.session.errors.length,
                source: 'tcgplayer_set_harvester',
                method: 'navigation_api_plus_scraping'
            },
            session: this.session,
            products: this.session.allProducts
        };
        
        const filename = `tcgplayer-pokemon-complete-harvest-${timestamp}.json`;
        fs.writeFileSync(filename, JSON.stringify(results, null, 2));
        
        console.log(`💾 Results saved to: ${filename}`);
        
        // Also save a summary
        const summary = {
            totalProducts: this.session.totalProducts,
            setBreakdown: this.session.pokemonSets.map(set => ({
                title: set.title,
                menuCategory: set.menuCategory,
                productCount: this.session.allProducts.filter(p => p.setName === set.title).length
            })),
            errors: this.session.errors
        };
        
        const summaryFile = `tcgplayer-pokemon-summary-${timestamp}.json`;
        fs.writeFileSync(summaryFile, JSON.stringify(summary, null, 2));
        console.log(`📊 Summary saved to: ${summaryFile}`);
        
        return { filename, summaryFile };
    }

    /**
     * Sleep utility
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Quick test with limited sets
     */
    async quickTest() {
        console.log('🧪 Running quick test with 2 sets, 2 pages each...');
        await this.harvestAllSets(2, 2);
        await this.saveResults();
    }
}

// Main execution
async function main() {
    const harvester = new TCGPlayerPokemonSetHarvester();
    
    const args = process.argv.slice(2);
    
    if (args.includes('--test')) {
        await harvester.quickTest();
    } else if (args.includes('--sample')) {
        const sets = parseInt(args[args.indexOf('--sample') + 1]) || 5;
        const pages = parseInt(args[args.indexOf('--sample') + 2]) || 3;
        await harvester.harvestAllSets(pages, sets);
        await harvester.saveResults();
    } else {
        await harvester.harvestAllSets();
        await harvester.saveResults();
    }
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = TCGPlayerPokemonSetHarvester;
