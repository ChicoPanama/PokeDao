const axios = require('axios');
const fs = require('fs');
const { chromium } = require('playwright');
const { PrismaClient } = require('./generated/client');
const crypto = require('crypto');

/**
 * TCGPlayer Targeted Collector
 * Focuses on Pokemon cards that match our Collector Crypt collection
 * Implements proper skuKey deduplication and rarity-first, price-first sorting
 */
class TCGPlayerTargetedCollector {
    constructor() {
        this.navigationAPI = 'https://marketplace-navigation.tcgplayer.com/marketplace-navigation-search-feature.json';
        this.baseUrl = 'https://www.tcgplayer.com';
        this.sessionId = `tcgplayer_targeted_${Date.now()}`;
        
        // Initialize separate Prisma client for TCGplayer database
        this.prisma = new PrismaClient();
        
        // Target cards based on Collector Crypt analysis
        this.targetCards = [
            'Pikachu', 'Charizard', 'Mewtwo', 'Blastoise', 'Venusaur',
            'Eevee', 'Charmander', 'Umbreon', 'Mew', 'Bulbasaur',
            'Magikarp', 'Squirtle', 'Articuno', 'Leafeon', 'Ditto',
            'Lugia', 'Espeon', 'Sylveon', 'Vaporeon', 'Flareon'
        ];
        
        // Rarity hierarchy (rarest to most common)
        this.rarityWeights = {
            'Secret Rare': 100,
            'Special Illustration Rare': 95,
            'Illustration Rare': 90,
            'Hyper Rare': 85,
            'Ultra Rare': 80,
            'Double Rare': 70,
            'Holo Rare': 60,
            'Rare': 50,
            'Promo': 40,
            'Uncommon': 20,
            'Common': 10
        };
        
        this.session = {
            sessionId: this.sessionId,
            startTime: new Date().toISOString(),
            targetedCards: [],
            totalProducts: 0,
            processedCards: 0,
            skippedDuplicates: 0,
            errors: []
        };
        
        this.headers = {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
            'Accept': 'application/json, text/plain, */*',
            'Accept-Language': 'en-US,en;q=0.9',
            'Referer': 'https://www.tcgplayer.com/'
        };

        // Duplicate prevention with skuKey system
        this.seenSkuKeys = new Set();
        this.productCache = new Map();
    }

    /**
     * Generate deterministic skuKey for global deduplication
     */
    makeSkuKey(product) {
        const normalized = {
            setCode: this.normalizeSetCode(product.setName || ''),
            cardNumber: this.normalizeCardNumber(product.cardNumber || ''),
            cardName: this.normalizeCardName(product.name || ''),
            language: 'EN', // Default for TCGplayer
            printing: this.normalizePrinting(product.rarity || ''),
            graded: false, // Raw cards from TCGplayer
            gradingCompany: 'NONE',
            gradeNumeric: 'NA'
        };

        const keyString = [
            normalized.setCode,
            normalized.cardNumber,
            normalized.cardName,
            normalized.language,
            normalized.printing,
            normalized.graded ? 'GRADED' : 'RAW',
            normalized.gradingCompany,
            normalized.gradeNumeric
        ].join('|');

        return crypto.createHash('sha256').update(keyString).digest('hex').slice(0, 32);
    }

    /**
     * Normalize set code for consistent matching
     */
    normalizeSetCode(setName) {
        const setMap = {
            'Base Set': 'BASESET',
            'Jungle': 'JUNGLE',
            'Fossil': 'FOSSIL',
            'Team Rocket': 'TEAMROCKET',
            'Neo Genesis': 'NEOGENESIS',
            'Neo Discovery': 'NEODISCOVERY',
            'Neo Destiny': 'NEODESTINY',
            'Gym Heroes': 'GYMHEROES',
            'Gym Challenge': 'GYMCHALLENGE'
        };

        const cleaned = setName.trim().toUpperCase();
        return setMap[setName] || cleaned.replace(/[^A-Z0-9]/g, '');
    }

    /**
     * Normalize card number for consistent matching
     */
    normalizeCardNumber(cardNumber) {
        return cardNumber.toString().trim().replace(/^0+/, '') || '1';
    }

    /**
     * Normalize card name for consistent matching
     */
    normalizeCardName(name) {
        return name.trim()
            .replace(/[^\w\s]/g, '')
            .replace(/\s+/g, ' ')
            .toUpperCase();
    }

    /**
     * Normalize printing type from rarity
     */
    normalizePrinting(rarity) {
        const rarityUpper = rarity.toUpperCase();
        if (rarityUpper.includes('HOLO')) return 'HOLO';
        if (rarityUpper.includes('REVERSE')) return 'REVERSE_HOLO';
        if (rarityUpper.includes('FIRST') || rarityUpper.includes('1ST')) return 'FIRST_EDITION';
        if (rarityUpper.includes('SHADOWLESS')) return 'SHADOWLESS';
        if (rarityUpper.includes('PROMO')) return 'PROMO';
        return 'UNLIMITED';
    }

    /**
     * Get rarity weight for sorting
     */
    getRarityWeight(rarity) {
        if (!rarity) return 0;
        
        const rarityUpper = rarity.toUpperCase();
        
        // Check for exact matches first
        for (const [key, weight] of Object.entries(this.rarityWeights)) {
            if (rarityUpper.includes(key.toUpperCase())) {
                return weight;
            }
        }
        
        // Fallback scoring
        if (rarityUpper.includes('SECRET')) return 100;
        if (rarityUpper.includes('SPECIAL')) return 95;
        if (rarityUpper.includes('ILLUSTRATION')) return 90;
        if (rarityUpper.includes('HYPER')) return 85;
        if (rarityUpper.includes('ULTRA')) return 80;
        if (rarityUpper.includes('DOUBLE')) return 70;
        if (rarityUpper.includes('HOLO') && rarityUpper.includes('RARE')) return 60;
        if (rarityUpper.includes('RARE')) return 50;
        if (rarityUpper.includes('PROMO')) return 40;
        if (rarityUpper.includes('UNCOMMON')) return 20;
        if (rarityUpper.includes('COMMON')) return 10;
        
        return 0;
    }

    /**
     * Initialize collector and load existing data
     */
    async initialize() {
        console.log('🎯 Initializing TCGPlayer Targeted Collector...');
        console.log(`📊 Session ID: ${this.sessionId}`);
        console.log(`🎴 Target Cards: ${this.targetCards.length}`);
        console.log('🔍 Focus: Cards matching Collector Crypt collection');
        
        try {
            // Create harvest session in database
            await this.createHarvestSession();
            
            // Load existing products to prevent duplicates
            await this.loadExistingProducts();
            
            console.log(`✅ Initialized with ${this.seenSkuKeys.size} existing skuKeys for duplicate prevention`);
            return true;
        } catch (error) {
            console.error('💥 Failed to initialize:', error);
            throw error;
        }
    }

    /**
     * Create harvest session record
     */
    async createHarvestSession() {
        try {
            const session = await this.prisma.tCGPlayerHarvestSession.create({
                data: {
                    sessionId: this.sessionId,
                    status: 'running',
                    harvestType: 'targeted_collector_crypt_match',
                    maxPagesPerSet: 50 // Focused search
                }
            });
            
            console.log(`📝 Created targeted harvest session: ${session.id}`);
            return session;
        } catch (error) {
            console.error('Error creating harvest session:', error);
            return null;
        }
    }

    /**
     * Load existing products to prevent duplicates
     */
    async loadExistingProducts() {
        try {
            const existingCards = await this.prisma.tCGPlayerCard.findMany({
                select: {
                    externalId: true,
                    name: true,
                    setName: true,
                    productUrl: true
                }
            });

            for (const card of existingCards) {
                // Generate skuKey for existing cards
                const skuKey = this.makeSkuKey(card);
                this.seenSkuKeys.add(skuKey);
                
                // Also add direct identifiers
                if (card.externalId) this.seenSkuKeys.add(card.externalId);
                if (card.productUrl) this.seenSkuKeys.add(card.productUrl);
            }

            console.log(`🔍 Loaded ${this.seenSkuKeys.size} existing product identifiers`);
        } catch (error) {
            console.error('Error loading existing products:', error);
        }
    }

    /**
     * Check if product is duplicate using skuKey system
     */
    isDuplicate(product) {
        const skuKey = this.makeSkuKey(product);
        
        // Check skuKey first (most reliable)
        if (this.seenSkuKeys.has(skuKey)) {
            return true;
        }
        
        // Check direct identifiers as backup
        const identifiers = [
            product.externalId,
            product.productUrl,
            `${product.name}_${product.setName}`
        ].filter(Boolean);
        
        return identifiers.some(id => this.seenSkuKeys.has(id));
    }

    /**
     * Mark product as seen using skuKey system
     */
    markAsSeen(product) {
        const skuKey = this.makeSkuKey(product);
        this.seenSkuKeys.add(skuKey);
        
        // Also add direct identifiers for backup
        if (product.externalId) this.seenSkuKeys.add(product.externalId);
        if (product.productUrl) this.seenSkuKeys.add(product.productUrl);
        this.seenSkuKeys.add(`${product.name}_${product.setName}`);
    }

    /**
     * Search for a specific target card with rarity-first, price-first sorting
     */
    async searchTargetCard(cardName) {
        console.log(`\n🎯 Searching for: ${cardName}`);
        
        const browser = await chromium.launch({ 
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        const page = await browser.newPage();
        
        try {
            await page.setExtraHTTPHeaders(this.headers);
            
            // Search URL for the card
            const searchUrl = `${this.baseUrl}/search/pokemon/product?q=${encodeURIComponent(cardName)}&productLineName=pokemon`;
            console.log(`📍 Search URL: ${searchUrl}`);
            
            await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
            await page.waitForTimeout(3000);
            
            const cardProducts = [];
            let currentPage = 1;
            let maxPages = 10; // Limit for focused search
            
            while (currentPage <= maxPages) {
                console.log(`📄 Processing page ${currentPage} for ${cardName}...`);
                
                // Extract products from current page
                const pageProducts = await page.evaluate(({ cardName, sessionId }) => {
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
                            break;
                        }
                    }
                    
                    foundElements.forEach((element, index) => {
                        try {
                            const fullText = element.textContent || '';
                            
                            // Extract card name
                            const nameSelectors = [
                                '.product-name', '.card-name', '.title', '.name',
                                'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
                                'a[href*="/product/"]'
                            ];
                            
                            let name = '';
                            for (const selector of nameSelectors) {
                                const nameEl = element.querySelector(selector);
                                if (nameEl && nameEl.textContent.trim()) {
                                    name = nameEl.textContent.trim();
                                    break;
                                }
                            }
                            
                            // Must contain the target card name
                            if (!name || !name.toLowerCase().includes(cardName.toLowerCase())) {
                                return;
                            }
                            
                            // Extract other data
                            const linkEl = element.querySelector('a[href*="/product/"]');
                            const productUrl = linkEl ? linkEl.href : '';
                            
                            const productIdMatch = productUrl.match(/\/product\/(\d+)/);
                            const externalId = productIdMatch ? productIdMatch[1] : null;
                            
                            const imageEl = element.querySelector('img');
                            const imageUrl = imageEl ? (imageEl.src || imageEl.dataset.src) : '';
                            
                            // Extract set and rarity
                            const setNameEl = element.querySelector('.set-name, .edition, .product-line, .set');
                            const rarityEl = element.querySelector('.rarity, .card-rarity, [data-rarity]');
                            
                            const setName = setNameEl ? setNameEl.textContent.trim() : '';
                            const rarity = rarityEl ? (rarityEl.textContent.trim() || rarityEl.dataset.rarity) : '';
                            
                            // Extract card number if available
                            const numberEl = element.querySelector('.card-number, .number, .product-number');
                            const cardNumber = numberEl ? numberEl.textContent.trim() : '';
                            
                            if (name && name.length > 2) {
                                products.push({
                                    name: name,
                                    cleanedName: name.replace(/^[^a-zA-Z]*/, '').split(/\s*(?:Uncommon|Common|Rare|Ultra Rare|Secret Rare)/)[0].trim(),
                                    externalId: externalId,
                                    setName: setName || 'Unknown Set',
                                    rarity: rarity || 'Unknown',
                                    cardNumber: cardNumber,
                                    category: 'Pokemon',
                                    productUrl: productUrl,
                                    imageUrl: imageUrl,
                                    tcgplayerUrl: productUrl,
                                    fullProductText: fullText,
                                    searchTerm: cardName,
                                    extractedAt: new Date().toISOString(),
                                    harvestSessionId: sessionId,
                                    elementIndex: index
                                });
                            }
                        } catch (error) {
                            console.error(`Error extracting product ${index}:`, error);
                        }
                    });
                    
                    return products;
                }, { cardName, sessionId: this.sessionId });
                
                if (pageProducts.length > 0) {
                    let newProducts = 0;
                    let duplicates = 0;
                    
                    // Process each product with deduplication
                    for (const product of pageProducts) {
                        // Extract pricing
                        const pricingData = this.extractPricing(product.fullProductText);
                        Object.assign(product, pricingData);
                        
                        // Add rarity weight for sorting
                        product.rarityWeight = this.getRarityWeight(product.rarity);
                        
                        // Check for duplicates using skuKey
                        if (this.isDuplicate(product)) {
                            duplicates++;
                            this.session.skippedDuplicates++;
                        } else {
                            // Save new product to database
                            await this.saveProductToDatabase(product);
                            this.markAsSeen(product);
                            cardProducts.push(product);
                            newProducts++;
                        }
                    }
                    
                    console.log(`📦 Page ${currentPage}: Found ${pageProducts.length} products (${newProducts} new, ${duplicates} duplicates)`);
                } else {
                    console.log(`📭 Page ${currentPage}: No products found for ${cardName}`);
                    break; // No more products
                }
                
                // Try to navigate to next page
                const hasNextPage = await page.evaluate(() => {
                    const nextButton = document.querySelector('a[aria-label="Next"], .pagination-next, .next-page');
                    if (nextButton && !nextButton.disabled && !nextButton.classList.contains('disabled')) {
                        nextButton.click();
                        return true;
                    }
                    return false;
                });
                
                if (hasNextPage) {
                    await page.waitForTimeout(2000);
                    currentPage++;
                } else {
                    break;
                }
            }
            
            console.log(`✅ ${cardName}: Found ${cardProducts.length} unique products`);
            return cardProducts;
            
        } catch (error) {
            console.error(`💥 Error searching for ${cardName}:`, error.message);
            await this.logError(cardName, error.message);
            return [];
        } finally {
            await browser.close();
        }
    }

    /**
     * Extract pricing information from product text
     */
    extractPricing(productText) {
        const pricing = {
            currentPrice: null,
            marketPrice: null,
            lowPrice: null,
            highPrice: null,
            listingCount: null,
            priceText: productText.substring(0, 300)
        };

        try {
            // Market Price pattern
            const marketPriceMatch = productText.match(/Market Price:\s*\$?([\d,]+\.?\d*)/i);
            if (marketPriceMatch) {
                pricing.marketPrice = parseFloat(marketPriceMatch[1].replace(',', ''));
            }

            // "from $X.XX" pattern
            const fromPriceMatch = productText.match(/from\s+\$?([\d,]+\.?\d*)/i);
            if (fromPriceMatch) {
                pricing.currentPrice = parseFloat(fromPriceMatch[1].replace(',', ''));
            }

            // Listing count
            const listingMatch = productText.match(/(\d+)\s+listings?/i);
            if (listingMatch) {
                pricing.listingCount = parseInt(listingMatch[1]);
            }

            // Fallback: any dollar amount
            if (!pricing.currentPrice && !pricing.marketPrice) {
                const dollarMatches = productText.match(/\$?([\d,]+\.?\d*)/g);
                if (dollarMatches && dollarMatches.length > 0) {
                    for (const match of dollarMatches) {
                        const price = parseFloat(match.replace(/[$,]/g, ''));
                        if (price > 0.01 && price < 10000) {
                            pricing.currentPrice = price;
                            break;
                        }
                    }
                }
            }

        } catch (error) {
            console.error('Error extracting pricing:', error);
        }

        return pricing;
    }

    /**
     * Save product to database with skuKey
     */
    async saveProductToDatabase(product) {
        try {
            const skuKey = this.makeSkuKey(product);
            
            // Save main product record
            const savedProduct = await this.prisma.tCGPlayerCard.upsert({
                where: { externalId: product.externalId || skuKey },
                update: {
                    name: product.name,
                    cleanedName: product.cleanedName,
                    currentPrice: product.currentPrice,
                    marketPrice: product.marketPrice,
                    lowPrice: product.lowPrice,
                    highPrice: product.highPrice,
                    listingCount: product.listingCount,
                    priceText: product.priceText,
                    rarityWeight: product.rarityWeight,
                    skuKey: skuKey,
                    lastUpdated: new Date(),
                    harvestSessionId: product.harvestSessionId,
                    rawProductData: JSON.stringify(product)
                },
                create: {
                    externalId: product.externalId || skuKey,
                    name: product.name,
                    cleanedName: product.cleanedName,
                    setName: product.setName,
                    rarity: product.rarity,
                    cardNumber: product.cardNumber,
                    category: product.category,
                    productUrl: product.productUrl,
                    imageUrl: product.imageUrl,
                    tcgplayerUrl: product.tcgplayerUrl,
                    currentPrice: product.currentPrice,
                    marketPrice: product.marketPrice,
                    lowPrice: product.lowPrice,
                    highPrice: product.highPrice,
                    listingCount: product.listingCount,
                    priceText: product.priceText,
                    rarityWeight: product.rarityWeight,
                    skuKey: skuKey,
                    searchTerm: product.searchTerm,
                    harvestSessionId: product.harvestSessionId,
                    rawProductData: JSON.stringify(product)
                }
            });

            // Create price history record if pricing exists
            if (product.marketPrice || product.currentPrice) {
                await this.prisma.tCGPlayerPriceHistory.create({
                    data: {
                        cardId: savedProduct.id,
                        externalId: product.externalId || skuKey,
                        marketPrice: product.marketPrice,
                        lowPrice: product.lowPrice || product.currentPrice,
                        highPrice: product.highPrice,
                        listingCount: product.listingCount,
                        priceSource: 'targeted_search'
                    }
                });
            }

        } catch (error) {
            console.error(`Error saving product ${product.name}:`, error);
        }
    }

    /**
     * Run targeted collection of Pokemon cards
     */
    async runTargetedCollection() {
        console.log('🎯🎯🎯 STARTING TARGETED TCGPLAYER COLLECTION 🎯🎯🎯');
        console.log('🎴 Focus: Cards matching Collector Crypt collection');
        console.log('📊 Strategy: Rarity-first, Price-first sorting with skuKey deduplication');
        
        try {
            await this.initialize();
            
            console.log(`\n📊 TARGETED COLLECTION PLAN:`);
            console.log(`   🎯 Target cards: ${this.targetCards.length}`);
            console.log(`   💰 Pricing extraction: ENABLED`);
            console.log(`   🗄️  Database storage: ENABLED`);
            console.log(`   🚫 skuKey deduplication: ENABLED`);
            console.log(`   📈 Rarity-first sorting: ENABLED`);
            
            // Process each target card
            for (const cardName of this.targetCards) {
                try {
                    console.log(`\n📈 PROGRESS: ${this.session.processedCards + 1}/${this.targetCards.length} cards`);
                    console.log(`🎴 Total products collected: ${this.session.totalProducts}`);
                    console.log(`🚫 Duplicates prevented: ${this.session.skippedDuplicates}`);
                    
                    const cardProducts = await this.searchTargetCard(cardName);
                    this.session.targetedCards.push(...cardProducts);
                    this.session.totalProducts = this.session.targetedCards.length;
                    this.session.processedCards++;
                    
                    // Update harvest session progress
                    try {
                        await this.prisma.tCGPlayerHarvestSession.update({
                            where: { sessionId: this.sessionId },
                            data: {
                                processedSets: this.session.processedCards,
                                totalProducts: this.session.totalProducts,
                                successfulSets: this.session.processedCards
                            }
                        });
                    } catch (error) {
                        console.log('Note: Could not update session progress');
                    }
                    
                    // Rate limiting between searches
                    await this.sleep(2000);
                    
                } catch (error) {
                    console.error(`💥 Failed to process card ${cardName}:`, error.message);
                    await this.logError(cardName, error.message);
                }
            }
            
            // Sort final collection by rarity weight DESC, then price DESC
            this.session.targetedCards.sort((a, b) => {
                // First by rarity weight (highest first)
                if (b.rarityWeight !== a.rarityWeight) {
                    return b.rarityWeight - a.rarityWeight;
                }
                
                // Then by market price (highest first)
                const priceA = a.marketPrice || a.currentPrice || 0;
                const priceB = b.marketPrice || b.currentPrice || 0;
                if (priceB !== priceA) {
                    return priceB - priceA;
                }
                
                // Finally by name
                return a.name.localeCompare(b.name);
            });
            
            // Complete targeted collection session
            await this.completeCollectionSession();
            
            console.log(`\n🎉🎉🎉 TARGETED COLLECTION COMPLETED! 🎉🎉🎉`);
            console.log(`📊 FINAL RESULTS:`);
            console.log(`   🎯 Cards processed: ${this.session.processedCards}/${this.targetCards.length}`);
            console.log(`   🎴 Total unique products: ${this.session.totalProducts}`);
            console.log(`   🚫 Duplicates prevented: ${this.session.skippedDuplicates}`);
            console.log(`   ⚠️  Errors: ${this.session.errors.length}`);
            console.log(`   🗄️  Database: tcgplayer.db`);
            console.log(`   📊 Session: ${this.sessionId}`);
            console.log(`   ⏱️  Duration: ${((new Date() - new Date(this.session.startTime)) / 1000 / 60).toFixed(1)} minutes`);
            
            // Save final sorted collection
            const finalOutput = {
                metadata: {
                    sessionId: this.sessionId,
                    collectionType: 'targeted_collector_crypt_match',
                    targetCards: this.targetCards,
                    totalProducts: this.session.totalProducts,
                    duplicatesPrevented: this.session.skippedDuplicates,
                    sortedBy: 'rarityWeight DESC, marketPrice DESC, name ASC',
                    createdAt: new Date().toISOString()
                },
                products: this.session.targetedCards
            };
            
            const outputFile = `tcgplayer-targeted-collection-${this.sessionId}.json`;
            fs.writeFileSync(outputFile, JSON.stringify(finalOutput, null, 2));
            console.log(`💾 Final collection saved to: ${outputFile}`);
            
            return {
                success: true,
                totalProducts: this.session.totalProducts,
                processedCards: this.session.processedCards,
                duplicatesSkipped: this.session.skippedDuplicates,
                errors: this.session.errors.length,
                sessionId: this.sessionId,
                outputFile: outputFile,
                databaseFile: 'tcgplayer.db'
            };
            
        } catch (error) {
            console.error('💥 Critical error in targeted collection:', error);
            await this.failCollectionSession(error.message);
            throw error;
        }
    }

    /**
     * Complete collection session
     */
    async completeCollectionSession() {
        try {
            await this.prisma.tCGPlayerHarvestSession.update({
                where: { sessionId: this.sessionId },
                data: {
                    status: 'completed',
                    endTime: new Date(),
                    summary: JSON.stringify({
                        totalProducts: this.session.totalProducts,
                        processedCards: this.session.processedCards,
                        duplicatesSkipped: this.session.skippedDuplicates,
                        errors: this.session.errors,
                        avgProductsPerCard: Math.round(this.session.totalProducts / this.session.processedCards)
                    })
                }
            });
        } catch (error) {
            console.log('Note: Could not update session completion');
        }
    }

    /**
     * Mark collection session as failed
     */
    async failCollectionSession(errorMessage) {
        try {
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
        } catch (error) {
            console.log('Note: Could not update session failure');
        }
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
    const collector = new TCGPlayerTargetedCollector();
    
    try {
        const result = await collector.runTargetedCollection();
        console.log('\n🎉 TARGETED COLLECTION COMPLETED SUCCESSFULLY! 🎉');
        console.log('Result:', result);
    } catch (error) {
        console.error('💥 TARGETED COLLECTION FAILED:', error);
    } finally {
        await collector.cleanup();
    }
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = TCGPlayerTargetedCollector;
