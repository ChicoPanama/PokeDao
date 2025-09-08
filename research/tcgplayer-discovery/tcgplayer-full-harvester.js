const axios = require('axios');
const fs = require('fs');
const { chromium } = require('playwright');
const { PrismaClient } = require('./generated/client');
const path = require('path');

/**
 * TCGPlayer Pokemon Full Harvester with Pricing & Database Integration
 * Complete harvest of all Pokemon sets with pricing extraction and separate database
 */
class TCGPlayerFullHarvester {
    constructor() {
        this.navigationAPI = 'https://marketplace-navigation.tcgplayer.com/marketplace-navigation-search-feature.json';
        this.baseUrl = 'https://www.tcgplayer.com';
        this.sessionId = `tcgplayer_harvest_${Date.now()}`;
        
        // Initialize separate Prisma client for TCGplayer database
        this.prisma = new PrismaClient({
            datasources: {
                db: {
                    url: 'file:./tcgplayer.db'
                }
            }
        });
        
        this.session = {
            sessionId: this.sessionId,
            startTime: new Date().toISOString(),
            pokemonSets: [],
            allProducts: [],
            totalProducts: 0,
            processedSets: 0,
            errors: [],
            harvestConfig: {
                maxPagesPerSet: 10,
                extractPricing: true,
                saveToDatabase: true,
                createPriceHistory: true
            }
        };
        
        this.headers = {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
            'Accept': 'application/json, text/plain, */*',
            'Accept-Language': 'en-US,en;q=0.9',
            'Referer': 'https://www.tcgplayer.com/'
        };
    }

    /**
     * Initialize database and harvest session
     */
    async initialize() {
        console.log('🚀 Initializing TCGPlayer Full Harvester with Database...');
        console.log(`📊 Session ID: ${this.sessionId}`);
        
        try {
            // Create harvest session in database
            await this.createHarvestSession();
            
            console.log('✅ Database initialized and harvest session created');
            return true;
        } catch (error) {
            console.error('💥 Failed to initialize database:', error);
            throw error;
        }
    }

    /**
     * Create harvest session record
     */
    async createHarvestSession() {
        const session = await this.prisma.tCGPlayerHarvestSession.create({
            data: {
                sessionId: this.sessionId,
                status: 'running',
                harvestType: 'full',
                maxPagesPerSet: this.session.harvestConfig.maxPagesPerSet
            }
        });
        
        console.log(`📝 Created harvest session: ${session.id}`);
        return session;
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
                            const setData = {
                                title: link.title,
                                url: link.url,
                                fullUrl: link.url.startsWith('http') ? link.url : `${this.baseUrl}${link.url}`,
                                menuCategory: menu.title
                            };
                            
                            sets.push(setData);
                            
                            // Save set to database
                            await this.saveSetToDatabase(setData);
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
                }
            ];
            
            for (const mainUrl of mainUrls) {
                sets.push(mainUrl);
                await this.saveSetToDatabase(mainUrl);
            }
            
            this.session.pokemonSets = sets;
            
            // Update harvest session with total sets
            await this.prisma.tCGPlayerHarvestSession.update({
                where: { sessionId: this.sessionId },
                data: { totalSets: sets.length }
            });
            
            console.log(`📦 Discovered ${sets.length} Pokemon sets/categories:`);
            sets.forEach((set, index) => {
                console.log(`   ${index + 1}. ${set.title} (${set.menuCategory})`);
            });
            
            return sets;
            
        } catch (error) {
            console.error('💥 Error discovering Pokemon sets:', error.message);
            await this.logError('set_discovery', error.message);
            throw error;
        }
    }

    /**
     * Save set information to database
     */
    async saveSetToDatabase(setData) {
        try {
            await this.prisma.tCGPlayerSet.upsert({
                where: { title: setData.title },
                update: {
                    fullUrl: setData.fullUrl,
                    menuCategory: setData.menuCategory,
                    updatedAt: new Date()
                },
                create: {
                    title: setData.title,
                    url: setData.url,
                    fullUrl: setData.fullUrl,
                    menuCategory: setData.menuCategory
                }
            });
        } catch (error) {
            console.error(`Error saving set ${setData.title}:`, error);
        }
    }

    /**
     * Extract pricing information from product text
     */
    extractPricingData(productText) {
        const pricing = {
            currentPrice: null,
            marketPrice: null,
            priceRange: null,
            listingCount: null,
            priceText: productText
        };

        try {
            // Extract market price (e.g., "Market Price:$3.05")
            const marketPriceMatch = productText.match(/Market Price:\$?([\d,.]+)/i);
            if (marketPriceMatch) {
                pricing.marketPrice = parseFloat(marketPriceMatch[1].replace(',', ''));
            }

            // Extract price range (e.g., "from $3.00")
            const priceRangeMatch = productText.match(/from \$?([\d,.]+)/i);
            if (priceRangeMatch) {
                pricing.currentPrice = parseFloat(priceRangeMatch[1].replace(',', ''));
                pricing.priceRange = priceRangeMatch[0];
            }

            // Extract listing count (e.g., "730 listings")
            const listingMatch = productText.match(/(\d+)\s+listings?/i);
            if (listingMatch) {
                pricing.listingCount = parseInt(listingMatch[1]);
            }

            // Try to extract any dollar amount as fallback
            if (!pricing.currentPrice && !pricing.marketPrice) {
                const dollarMatch = productText.match(/\$?([\d,.]+)/);
                if (dollarMatch) {
                    pricing.currentPrice = parseFloat(dollarMatch[1].replace(',', ''));
                }
            }

        } catch (error) {
            console.error('Error extracting pricing:', error);
        }

        return pricing;
    }

    /**
     * Harvest products from a specific Pokemon set with enhanced pricing extraction
     */
    async harvestSetProducts(set, maxPages = 10) {
        console.log(`\n🌾 Harvesting products from: ${set.title}`);
        console.log(`📍 URL: ${set.fullUrl}`);

        // Update set status in database
        await this.prisma.tCGPlayerSet.update({
            where: { title: set.title },
            data: { harvestStatus: 'processing' }
        });

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
                
                // Extract products with enhanced pricing data
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
                            // Extract all text for comprehensive pricing analysis
                            const fullText = element.textContent || '';
                            
                            // Extract specific elements
                            const nameEl = element.querySelector('.product-name, .card-name, h3, h4, .title, a[href*="/product/"]');
                            const linkEl = element.querySelector('a[href*="/product/"]');
                            const imageEl = element.querySelector('img');
                            
                            const name = nameEl ? nameEl.textContent.trim() : '';
                            const productUrl = linkEl ? linkEl.href : '';
                            const imageUrl = imageEl ? imageEl.src : '';
                            
                            // Extract product ID from URL
                            const productIdMatch = productUrl.match(/\/product\/(\d+)/);
                            const externalId = productIdMatch ? productIdMatch[1] : null;
                            
                            // Extract additional details
                            const setNameEl = element.querySelector('.set-name, .edition, .product-line');
                            const rarityEl = element.querySelector('.rarity, .card-rarity');
                            const typeEl = element.querySelector('.card-type, .type');
                            const numberEl = element.querySelector('.card-number, .number');
                            
                            const setName = setNameEl ? setNameEl.textContent.trim() : setInfo.title;
                            const rarity = rarityEl ? rarityEl.textContent.trim() : '';
                            const cardType = typeEl ? typeEl.textContent.trim() : '';
                            const cardNumber = numberEl ? numberEl.textContent.trim() : '';
                            
                            if (name && name.length > 0) {
                                products.push({
                                    // Basic Information
                                    name: name,
                                    cleanedName: name.replace(/^[^a-zA-Z]*/, '').split(/\s*(?:Uncommon|Common|Rare|Ultra Rare)/)[0].trim(),
                                    setName: setName,
                                    setUrl: setInfo.fullUrl,
                                    rarity: rarity,
                                    cardType: cardType,
                                    cardNumber: cardNumber,
                                    category: 'Pokemon',
                                    menuCategory: setInfo.menuCategory,
                                    
                                    // URLs and Images
                                    productUrl: productUrl,
                                    imageUrl: imageUrl,
                                    tcgplayerUrl: productUrl,
                                    
                                    // Pricing (raw text for extraction)
                                    fullProductText: fullText,
                                    
                                    // Metadata
                                    page: pageNum,
                                    externalId: externalId,
                                    extractedAt: new Date().toISOString(),
                                    harvestSessionId: setInfo.sessionId
                                });
                            }
                        } catch (error) {
                            console.error(`Error extracting product ${index}:`, error);
                        }
                    });
                    
                    return products;
                }, { setInfo: { ...set, sessionId: this.sessionId }, pageNum: currentPage });
                
                if (pageProducts.length > 0) {
                    // Process pricing for each product
                    for (const product of pageProducts) {
                        const pricingData = this.extractPricingData(product.fullProductText);
                        Object.assign(product, pricingData);
                        
                        // Save to database
                        await this.saveProductToDatabase(product);
                    }
                    
                    setProducts.push(...pageProducts);
                    console.log(`📦 Page ${currentPage}: Found ${pageProducts.length} products with pricing (total: ${setProducts.length})`);
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
                    await page.waitForTimeout(2000);
                    currentPage++;
                } else {
                    console.log(`📄 No more pages found for ${set.title}`);
                    break;
                }
            }
            
            // Update set completion status
            await this.prisma.tCGPlayerSet.update({
                where: { title: set.title },
                data: {
                    harvestStatus: 'completed',
                    totalProducts: setProducts.length,
                    totalPages: currentPage - 1,
                    pagesProcessed: currentPage - 1,
                    lastHarvestedAt: new Date()
                }
            });
            
            console.log(`✅ ${set.title}: Harvested ${setProducts.length} products with pricing data`);
            return setProducts;
            
        } catch (error) {
            console.error(`💥 Error harvesting ${set.title}:`, error.message);
            
            // Update set error status
            await this.prisma.tCGPlayerSet.update({
                where: { title: set.title },
                data: {
                    harvestStatus: 'failed',
                    harvestErrors: JSON.stringify([{
                        error: error.message,
                        timestamp: new Date().toISOString()
                    }])
                }
            });
            
            await this.logError(set.title, error.message);
            return [];
        } finally {
            await browser.close();
        }
    }

    /**
     * Save product to database with pricing history
     */
    async saveProductToDatabase(product) {
        try {
            // Save main product record
            const savedProduct = await this.prisma.tCGPlayerCard.upsert({
                where: { externalId: product.externalId || `${product.name}_${product.setName}` },
                update: {
                    name: product.name,
                    cleanedName: product.cleanedName,
                    currentPrice: product.currentPrice,
                    marketPrice: product.marketPrice,
                    priceRange: product.priceRange,
                    listingCount: product.listingCount,
                    priceText: product.priceText,
                    lastUpdated: new Date(),
                    harvestSessionId: product.harvestSessionId,
                    rawProductData: JSON.stringify(product)
                },
                create: {
                    externalId: product.externalId || `${product.name}_${product.setName}`,
                    name: product.name,
                    cleanedName: product.cleanedName,
                    setName: product.setName,
                    setUrl: product.setUrl,
                    rarity: product.rarity,
                    cardType: product.cardType,
                    cardNumber: product.cardNumber,
                    category: product.category,
                    menuCategory: product.menuCategory,
                    productUrl: product.productUrl,
                    imageUrl: product.imageUrl,
                    tcgplayerUrl: product.tcgplayerUrl,
                    currentPrice: product.currentPrice,
                    marketPrice: product.marketPrice,
                    priceRange: product.priceRange,
                    listingCount: product.listingCount,
                    priceText: product.priceText,
                    page: product.page,
                    harvestSessionId: product.harvestSessionId,
                    rawProductData: JSON.stringify(product)
                }
            });

            // Create price history record if pricing data exists
            if (product.marketPrice || product.currentPrice) {
                await this.prisma.tCGPlayerPriceHistory.create({
                    data: {
                        cardId: savedProduct.id,
                        externalId: product.externalId || savedProduct.externalId,
                        marketPrice: product.marketPrice,
                        lowPrice: product.currentPrice,
                        listingCount: product.listingCount,
                        priceSource: 'product_page'
                    }
                });
            }

        } catch (error) {
            console.error(`Error saving product ${product.name}:`, error);
        }
    }

    /**
     * Run full harvest of all Pokemon sets
     */
    async runFullHarvest() {
        console.log('🚀 Starting FULL TCGPlayer Pokemon Harvest with Pricing & Database...');
        
        try {
            await this.initialize();
            await this.discoverPokemonSets();
            
            console.log(`📊 Will process ALL ${this.session.pokemonSets.length} sets with max ${this.session.harvestConfig.maxPagesPerSet} pages each`);
            console.log('💰 Enhanced pricing extraction enabled');
            console.log('🗄️  Separate database storage enabled');
            
            for (const set of this.session.pokemonSets) {
                try {
                    console.log(`\n📈 Progress: ${this.session.processedSets}/${this.session.pokemonSets.length} sets`);
                    
                    const setProducts = await this.harvestSetProducts(set, this.session.harvestConfig.maxPagesPerSet);
                    this.session.allProducts.push(...setProducts);
                    this.session.processedSets++;
                    
                    // Update harvest session progress
                    await this.prisma.tCGPlayerHarvestSession.update({
                        where: { sessionId: this.sessionId },
                        data: {
                            processedSets: this.session.processedSets,
                            totalProducts: this.session.allProducts.length,
                            successfulSets: this.session.processedSets
                        }
                    });
                    
                    console.log(`🎴 Total products harvested: ${this.session.allProducts.length}`);
                    
                    // Rate limiting between sets
                    await this.sleep(3000);
                    
                } catch (error) {
                    console.error(`💥 Failed to process set ${set.title}:`, error.message);
                    await this.logError(set.title, error.message);
                }
            }
            
            // Complete harvest session
            await this.completeHarvestSession();
            
            console.log(`\n🎉 FULL HARVEST COMPLETED!`);
            console.log(`📊 Final Results:`);
            console.log(`   📦 Sets processed: ${this.session.processedSets}/${this.session.pokemonSets.length}`);
            console.log(`   🎴 Total products with pricing: ${this.session.allProducts.length}`);
            console.log(`   ⚠️  Errors: ${this.session.errors.length}`);
            console.log(`   🗄️  Database: tcgplayer.db`);
            console.log(`   📊 Session: ${this.sessionId}`);
            
            return {
                success: true,
                totalProducts: this.session.allProducts.length,
                processedSets: this.session.processedSets,
                errors: this.session.errors.length,
                sessionId: this.sessionId,
                databaseFile: 'tcgplayer.db'
            };
            
        } catch (error) {
            console.error('💥 Critical error in full harvest:', error);
            await this.failHarvestSession(error.message);
            throw error;
        }
    }

    /**
     * Complete harvest session
     */
    async completeHarvestSession() {
        await this.prisma.tCGPlayerHarvestSession.update({
            where: { sessionId: this.sessionId },
            data: {
                status: 'completed',
                endTime: new Date(),
                summary: JSON.stringify({
                    totalProducts: this.session.allProducts.length,
                    processedSets: this.session.processedSets,
                    errors: this.session.errors,
                    avgProductsPerSet: Math.round(this.session.allProducts.length / this.session.processedSets)
                })
            }
        });
    }

    /**
     * Mark harvest session as failed
     */
    async failHarvestSession(errorMessage) {
        await this.prisma.tCGPlayerHarvestSession.update({
            where: { sessionId: this.sessionId },
            data: {
                status: 'failed',
                endTime: new Date(),
                errors: JSON.stringify([...this.session.errors, {
                    type: 'critical',
                    error: errorMessage,
                    timestamp: new Date().toISOString()
                }])
            }
        });
    }

    /**
     * Log error to session
     */
    async logError(context, message) {
        this.session.errors.push({
            context,
            message,
            timestamp: new Date().toISOString()
        });
    }

    /**
     * Sleep utility
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Cleanup database connection
     */
    async cleanup() {
        await this.prisma.$disconnect();
    }
}

// Main execution
async function main() {
    const harvester = new TCGPlayerFullHarvester();
    
    try {
        const result = await harvester.runFullHarvest();
        console.log('\n🎉 Harvest completed successfully!');
        console.log('Result:', result);
    } catch (error) {
        console.error('💥 Harvest failed:', error);
    } finally {
        await harvester.cleanup();
    }
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = TCGPlayerFullHarvester;
