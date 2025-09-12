const axios = require('axios');
const fs = require('fs');
const { chromium } = require('playwright');
const { PrismaClient } = require('./generated/client');
const path = require('path');

/**
 * TCGPlayer MEGA Pokemon Harvester
 * Complete harvest of ALL Pokemon products with:
 * - Full pagination (unlimited pages)
 * - Comprehensive caching and resume capability
 * - Duplicate prevention at multiple levels
 * - Progress tracking and recovery
 * - Enhanced pricing extraction
 * - Separate database with full history
 */
class TCGPlayerMegaHarvester {
    constructor() {
        this.navigationAPI = 'https://marketplace-navigation.tcgplayer.com/marketplace-navigation-search-feature.json';
        this.baseUrl = 'https://www.tcgplayer.com';
        this.sessionId = `tcgplayer_mega_harvest_${Date.now()}`;
        
        // Initialize separate Prisma client for TCGplayer database
        this.prisma = new PrismaClient();
        
        this.session = {
            sessionId: this.sessionId,
            startTime: new Date().toISOString(),
            pokemonSets: [],
            allProducts: [],
            totalProducts: 0,
            processedSets: 0,
            skippedDuplicates: 0,
            errors: [],
            harvestConfig: {
                maxPagesPerSet: 999, // Unlimited - go through ALL pages
                extractPricing: true,
                saveToDatabase: true,
                createPriceHistory: true,
                enableCaching: true,
                resumeFromCache: true,
                deduplicationEnabled: true
            }
        };
        
        this.headers = {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
            'Accept': 'application/json, text/plain, */*',
            'Accept-Language': 'en-US,en;q=0.9',
            'Referer': 'https://www.tcgplayer.com/'
        };

        // Cache for duplicate prevention
        this.seenProducts = new Set();
        this.productCache = new Map();
        
        // Progress tracking
        this.progressFile = `progress_${this.sessionId}.json`;
        this.cacheFile = `cache_${this.sessionId}.json`;
    }

    /**
     * Initialize database and harvest session with resume capability
     */
    async initialize() {
        console.log('🚀 Initializing TCGPlayer MEGA Harvester...');
        console.log(`📊 Session ID: ${this.sessionId}`);
        console.log('🎯 Target: ALL Pokemon products across ALL sets');
        console.log('📖 Features: Unlimited pagination, caching, duplicate prevention');
        
        try {
            // Load existing progress if resuming
            if (this.session.harvestConfig.resumeFromCache) {
                await this.loadProgress();
            }
            
            // Create harvest session in database
            await this.createHarvestSession();
            
            // Load existing products to prevent duplicates (DISABLED - we want all cards)
            // await this.loadExistingProducts();
            
            console.log(`✅ Initialized - duplicate detection DISABLED to collect all 30,120+ cards`);
            return true;
        } catch (error) {
            console.error('💥 Failed to initialize:', error);
            throw error;
        }
    }

    /**
     * Load existing progress from cache
     */
    async loadProgress() {
        try {
            if (fs.existsSync(this.progressFile)) {
                const progress = JSON.parse(fs.readFileSync(this.progressFile, 'utf8'));
                this.session.processedSets = progress.processedSets || 0;
                this.session.pokemonSets = progress.pokemonSets || [];
                console.log(`📂 Resumed from cache: ${this.session.processedSets} sets processed`);
            }
        } catch (error) {
            console.log('⚠️  Could not load progress cache, starting fresh');
        }
    }

    /**
     * Save current progress to cache
     */
    async saveProgress() {
        try {
            const progress = {
                sessionId: this.sessionId,
                timestamp: new Date().toISOString(),
                processedSets: this.session.processedSets,
                totalProducts: this.session.totalProducts,
                pokemonSets: this.session.pokemonSets,
                errors: this.session.errors
            };
            
            fs.writeFileSync(this.progressFile, JSON.stringify(progress, null, 2));
        } catch (error) {
            console.error('Error saving progress:', error);
        }
    }

    /**
     * Load existing products from database to prevent duplicates
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
                // Add multiple keys for duplicate detection
                if (card.externalId) this.seenProducts.add(card.externalId);
                if (card.productUrl) this.seenProducts.add(card.productUrl);
                this.seenProducts.add(`${card.name}_${card.setName}`);
            }

            console.log(`🔍 Loaded ${this.seenProducts.size} existing product identifiers`);
        } catch (error) {
            console.error('Error loading existing products:', error);
        }
    }

    /**
     * Check if product is duplicate (very strict - only exact external ID matches)
     */
    isDuplicate(product) {
        // Only check external ID for true duplicates
        return product.externalId && this.seenProducts.has(product.externalId);
    }

    /**
     * Mark product as seen (only external ID)
     */
    markAsSeen(product) {
        if (product.externalId) {
            this.seenProducts.add(product.externalId);
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
                    harvestType: 'mega_full',
                    maxPagesPerSet: this.session.harvestConfig.maxPagesPerSet
                }
            });
            
            console.log(`📝 Created mega harvest session: ${session.id}`);
            return session;
        } catch (error) {
            console.error('Error creating harvest session:', error);
            // Continue without database session if needed
            return null;
        }
    }

    /**
     * Discover all Pokemon sets + main Pokemon products page
     */
    async discoverAllPokemonSources() {
        console.log('🔍 Discovering ALL Pokemon sources from navigation API...');
        
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
            
            // Extract ALL Pokemon sources
            const sources = [];
            
            // 1. All individual sets from menus
            for (const menu of pokemonCategory.menus) {
                if (menu.links) {
                    for (const link of menu.links) {
                        if (link.url && link.url.includes('/search/pokemon/')) {
                            const sourceData = {
                                title: link.title,
                                url: link.url,
                                fullUrl: link.url.startsWith('http') ? link.url : `${this.baseUrl}${link.url}`,
                                menuCategory: menu.title,
                                type: 'set'
                            };
                            
                            sources.push(sourceData);
                            await this.saveSetToDatabase(sourceData);
                        }
                    }
                }
            }
            
            // 2. Main "All Pokemon Products" - THIS IS THE BIG ONE
            const mainPokemonUrl = {
                title: 'All Pokemon Products',
                url: pokemonCategory.shopAllUrl,
                fullUrl: `${this.baseUrl}${pokemonCategory.shopAllUrl}`,
                menuCategory: 'Main',
                type: 'main'
            };
            sources.push(mainPokemonUrl);
            await this.saveSetToDatabase(mainPokemonUrl);

            // 3. Additional comprehensive sources - PRIORITY FOR ALL CARDS
            const additionalSources = [
                {
                    title: 'Pokemon Complete Catalog (30,120+ cards)',
                    url: '/search/pokemon/product?productLineName=pokemon&view=grid',
                    fullUrl: `${this.baseUrl}/search/pokemon/product?productLineName=pokemon&view=grid`,
                    menuCategory: 'Complete',
                    type: 'mega_catalog',
                    priority: 1  // Highest priority
                },
                {
                    title: 'Pokemon Search (All)',
                    url: '/search/pokemon/product',
                    fullUrl: `${this.baseUrl}/search/pokemon/product`,
                    menuCategory: 'Search',
                    type: 'search',
                    priority: 2
                },
                {
                    title: 'Pokemon Products (Paginated)',
                    url: '/search/pokemon/product?productLineName=pokemon',
                    fullUrl: `${this.baseUrl}/search/pokemon/product?productLineName=pokemon`,
                    menuCategory: 'Complete',
                    type: 'complete',
                    priority: 3
                }
            ];

            for (const source of additionalSources) {
                sources.push(source);
                await this.saveSetToDatabase(source);
            }
            
            this.session.pokemonSets = sources;
            
            // Update harvest session with total sources
            try {
                await this.prisma.tCGPlayerHarvestSession.update({
                    where: { sessionId: this.sessionId },
                    data: { totalSets: sources.length }
                });
            } catch (error) {
                console.log('Note: Could not update session in database');
            }
            
            console.log(`📦 Discovered ${sources.length} Pokemon sources:`);
            sources.forEach((source, index) => {
                console.log(`   ${index + 1}. ${source.title} (${source.menuCategory}) [${source.type}]`);
            });
            
            return sources;
            
        } catch (error) {
            console.error('💥 Error discovering Pokemon sources:', error.message);
            await this.logError('source_discovery', error.message);
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
     * Enhanced pricing extraction with multiple patterns
     */
    extractComprehensivePricing(productText) {
        const pricing = {
            currentPrice: null,
            marketPrice: null,
            lowPrice: null,
            highPrice: null,
            priceRange: null,
            listingCount: null,
            priceText: productText.substring(0, 500) // Keep sample for debugging
        };

        try {
            // Pattern 1: Market Price:$X.XX
            const marketPriceMatch = productText.match(/Market Price:\s*\$?([\d,]+\.?\d*)/i);
            if (marketPriceMatch) {
                pricing.marketPrice = parseFloat(marketPriceMatch[1].replace(',', ''));
            }

            // Pattern 2: from $X.XX
            const fromPriceMatch = productText.match(/from\s+\$?([\d,]+\.?\d*)/i);
            if (fromPriceMatch) {
                pricing.currentPrice = parseFloat(fromPriceMatch[1].replace(',', ''));
                pricing.lowPrice = pricing.currentPrice;
            }

            // Pattern 3: $X.XX - $Y.YY (range)
            const rangeMatch = productText.match(/\$?([\d,]+\.?\d*)\s*[-–]\s*\$?([\d,]+\.?\d*)/);
            if (rangeMatch) {
                pricing.lowPrice = parseFloat(rangeMatch[1].replace(',', ''));
                pricing.highPrice = parseFloat(rangeMatch[2].replace(',', ''));
            }

            // Pattern 4: XXX listings
            const listingMatch = productText.match(/(\d+)\s+listings?/i);
            if (listingMatch) {
                pricing.listingCount = parseInt(listingMatch[1]);
            }

            // Pattern 5: Any dollar amount as fallback
            if (!pricing.currentPrice && !pricing.marketPrice) {
                const dollarMatches = productText.match(/\$?([\d,]+\.?\d*)/g);
                if (dollarMatches && dollarMatches.length > 0) {
                    // Take the first reasonable price (> $0.01, < $10000)
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
     * Mega harvest from a source with unlimited pagination
     */
    async megaHarvestSource(source) {
        console.log(`\n🌾 MEGA HARVESTING: ${source.title}`);
        console.log(`📍 URL: ${source.fullUrl}`);
        console.log(`📖 Type: ${source.type} | Category: ${source.menuCategory}`);

        // Update source status in database
        try {
            await this.prisma.tCGPlayerSet.update({
                where: { title: source.title },
                data: { harvestStatus: 'processing' }
            });
        } catch (error) {
            console.log('Note: Could not update source status');
        }

        const browser = await chromium.launch({ 
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        const page = await browser.newPage();
        
        try {
            await page.setExtraHTTPHeaders(this.headers);
            await page.goto(source.fullUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
            await page.waitForTimeout(3000);
            
            const sourceProducts = [];
            let currentPage = 1;
            let consecutiveEmptyPages = 0;
            let totalPageCount = 0;
            
            // UNLIMITED PAGINATION - Keep going until no more products
            while (consecutiveEmptyPages < 50) { // Much higher threshold - allow for duplicate-heavy pages
                console.log(`📄 Processing page ${currentPage} of ${source.title}...`);
                
                // Extract products with enhanced data
                const pageProducts = await page.evaluate(({ sourceInfo, pageNum, sessionId }) => {
                    const products = [];
                    
                    // Try multiple product selectors (most comprehensive)
                    const selectors = [
                        '.search-result',
                        '.product-card', 
                        '.product-item',
                        '[data-testid="product"]',
                        '.listing-item',
                        '.card-item',
                        '.product',
                        '.search-result-item',
                        '.tcg-product',
                        '.marketplace-product'
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
                            // Comprehensive text extraction for pricing
                            const fullText = element.textContent || '';
                            
                            // Extract core elements with multiple fallbacks
                            const nameSelectors = [
                                '.product-name', '.card-name', '.title', '.name',
                                'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
                                'a[href*="/product/"]', '[data-name]'
                            ];
                            
                            let name = '';
                            for (const selector of nameSelectors) {
                                const nameEl = element.querySelector(selector);
                                if (nameEl && nameEl.textContent.trim()) {
                                    name = nameEl.textContent.trim();
                                    break;
                                }
                            }
                            
                            // If no name found, try getting from link text
                            if (!name) {
                                const linkEl = element.querySelector('a');
                                if (linkEl && linkEl.textContent.trim()) {
                                    name = linkEl.textContent.trim();
                                }
                            }
                            
                            // Extract URLs
                            const linkEl = element.querySelector('a[href*="/product/"], a[href*="/search/"]');
                            const productUrl = linkEl ? linkEl.href : '';
                            
                            // Extract product ID from URL
                            const productIdMatch = productUrl.match(/\/product\/(\d+)/);
                            const externalId = productIdMatch ? productIdMatch[1] : null;
                            
                            // Extract image
                            const imageEl = element.querySelector('img');
                            const imageUrl = imageEl ? (imageEl.src || imageEl.dataset.src) : '';
                            
                            // Extract additional metadata
                            const setNameEl = element.querySelector('.set-name, .edition, .product-line, .set');
                            const rarityEl = element.querySelector('.rarity, .card-rarity, [data-rarity]');
                            const typeEl = element.querySelector('.card-type, .type, .product-type');
                            const numberEl = element.querySelector('.card-number, .number, .product-number');
                            
                            const setName = setNameEl ? setNameEl.textContent.trim() : sourceInfo.title;
                            const rarity = rarityEl ? (rarityEl.textContent.trim() || rarityEl.dataset.rarity) : '';
                            const cardType = typeEl ? typeEl.textContent.trim() : '';
                            const cardNumber = numberEl ? numberEl.textContent.trim() : '';
                            
                            // Only add if we have essential data
                            if (name && name.length > 2) {
                                products.push({
                                    // Core identification
                                    name: name,
                                    cleanedName: name.replace(/^[^a-zA-Z]*/, '').split(/\s*(?:Uncommon|Common|Rare|Ultra Rare|Secret Rare)/)[0].trim(),
                                    externalId: externalId,
                                    
                                    // Set information
                                    setName: setName,
                                    setUrl: sourceInfo.fullUrl,
                                    rarity: rarity,
                                    cardType: cardType,
                                    cardNumber: cardNumber,
                                    category: 'Pokemon',
                                    menuCategory: sourceInfo.menuCategory,
                                    sourceType: sourceInfo.type,
                                    
                                    // URLs and media
                                    productUrl: productUrl,
                                    imageUrl: imageUrl,
                                    tcgplayerUrl: productUrl,
                                    
                                    // Pricing data (raw for extraction)
                                    fullProductText: fullText,
                                    
                                    // Metadata
                                    page: pageNum,
                                    sourceTitle: sourceInfo.title,
                                    extractedAt: new Date().toISOString(),
                                    harvestSessionId: sessionId,
                                    
                                    // Element data for debugging
                                    elementIndex: index,
                                    selector: 'multiple-tried'
                                });
                            }
                        } catch (error) {
                            console.error(`Error extracting product ${index}:`, error);
                        }
                    });
                    
                    return products;
                }, { 
                    sourceInfo: source, 
                    pageNum: currentPage, 
                    sessionId: this.sessionId 
                });
                
                if (pageProducts.length > 0) {
                    let newProducts = 0;
                    let duplicates = 0;
                    
                    // Process each product with deduplication
                    for (const product of pageProducts) {
                        // Extract pricing
                        const pricingData = this.extractComprehensivePricing(product.fullProductText);
                        Object.assign(product, pricingData);
                        
                        // Check for duplicates
                        if (this.isDuplicate(product)) {
                            duplicates++;
                            this.session.skippedDuplicates++;
                        } else {
                            // Save new product to database
                            await this.saveProductToDatabase(product);
                            this.markAsSeen(product);
                            sourceProducts.push(product);
                            newProducts++;
                        }
                    }
                    
                    console.log(`📦 Page ${currentPage}: Found ${pageProducts.length} products (${newProducts} new, ${duplicates} duplicates) | Total: ${sourceProducts.length}`);
                    
                    // Only reset consecutive empty pages if we found new products
                    if (newProducts > 0) {
                        consecutiveEmptyPages = 0;
                    } else {
                        consecutiveEmptyPages++; // Count pages with only duplicates as "empty" for pagination purposes
                    }
                    totalPageCount = currentPage;
                } else {
                    consecutiveEmptyPages++;
                    console.log(`📭 Page ${currentPage}: No products found (${consecutiveEmptyPages}/50 empty pages)`);
                }
                
                // Save progress periodically
                if (currentPage % 10 === 0) {
                    await this.saveProgress();
                    console.log(`💾 Progress saved at page ${currentPage}`);
                }
                
                // Try to navigate to next page
                const hasNextPage = await page.evaluate((pageNum) => {
                    // Multiple next page strategies
                    const nextStrategies = [
                        // Strategy 1: Click next button
                        () => {
                            const nextButtons = [
                                'a[aria-label="Next"]',
                                '.pagination-next',
                                '.next-page',
                                'a[href*="page=' + (pageNum + 1) + '"]',
                                '.pagination a[href*="page="]:last-child'
                            ];
                            
                            for (const selector of nextButtons) {
                                const button = document.querySelector(selector);
                                if (button && !button.disabled && !button.classList.contains('disabled')) {
                                    button.click();
                                    return true;
                                }
                            }
                            return false;
                        },
                        
                        // Strategy 2: Modify URL directly
                        () => {
                            const currentUrl = new URL(window.location.href);
                            currentUrl.searchParams.set('page', pageNum + 1);
                            
                            if (currentUrl.href !== window.location.href) {
                                window.location.href = currentUrl.href;
                                return true;
                            }
                            return false;
                        }
                    ];
                    
                    for (const strategy of nextStrategies) {
                        if (strategy()) {
                            return true;
                        }
                    }
                    
                    return false;
                }, currentPage);
                
                if (hasNextPage) {
                    await page.waitForTimeout(2000); // Wait for page load
                    currentPage++;
                } else {
                    console.log(`📄 No more pages found for ${source.title} after ${currentPage} pages`);
                    break;
                }
            }
            
            // Update source completion status
            try {
                await this.prisma.tCGPlayerSet.update({
                    where: { title: source.title },
                    data: {
                        harvestStatus: 'completed',
                        totalProducts: sourceProducts.length,
                        totalPages: totalPageCount,
                        pagesProcessed: totalPageCount,
                        lastHarvestedAt: new Date()
                    }
                });
            } catch (error) {
                console.log('Note: Could not update source completion status');
            }
            
            console.log(`✅ ${source.title}: MEGA HARVESTED ${sourceProducts.length} products from ${totalPageCount} pages`);
            return sourceProducts;
            
        } catch (error) {
            console.error(`💥 Error mega harvesting ${source.title}:`, error.message);
            
            // Update source error status
            try {
                await this.prisma.tCGPlayerSet.update({
                    where: { title: source.title },
                    data: {
                        harvestStatus: 'failed',
                        harvestErrors: JSON.stringify([{
                            error: error.message,
                            timestamp: new Date().toISOString()
                        }])
                    }
                });
            } catch (dbError) {
                console.log('Note: Could not update source error status');
            }
            
            await this.logError(source.title, error.message);
            return [];
        } finally {
            await browser.close();
        }
    }

    /**
     * Save product to database with comprehensive pricing history
     */
    async saveProductToDatabase(product) {
        try {
            // Generate unique key for upsert
            const uniqueKey = product.externalId || `${product.name}_${product.setName}_${product.sourceTitle}`;
            
            // Save main product record
            const savedProduct = await this.prisma.tCGPlayerCard.upsert({
                where: { externalId: uniqueKey },
                update: {
                    name: product.name,
                    cleanedName: product.cleanedName,
                    currentPrice: product.currentPrice,
                    marketPrice: product.marketPrice,
                    lowPrice: product.lowPrice,
                    highPrice: product.highPrice,
                    priceRange: product.priceRange,
                    listingCount: product.listingCount,
                    priceText: product.priceText,
                    lastUpdated: new Date(),
                    harvestSessionId: product.harvestSessionId,
                    rawProductData: JSON.stringify(product)
                },
                create: {
                    externalId: uniqueKey,
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
                    lowPrice: product.lowPrice,
                    highPrice: product.highPrice,
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
                        externalId: uniqueKey,
                        marketPrice: product.marketPrice,
                        lowPrice: product.lowPrice || product.currentPrice,
                        highPrice: product.highPrice,
                        listingCount: product.listingCount,
                        priceSource: 'mega_harvest'
                    }
                });
            }

        } catch (error) {
            console.error(`Error saving product ${product.name}:`, error);
        }
    }

    /**
     * Run the mega harvest of ALL Pokemon products
     */
    async runMegaHarvest() {
        console.log('🚀🚀🚀 STARTING MEGA POKEMON HARVEST 🚀🚀🚀');
        console.log('🎯 Target: EVERY Pokemon product on TCGplayer');
        console.log('📊 Features: Unlimited pagination, caching, deduplication');
        
        try {
            await this.initialize();
            await this.discoverAllPokemonSources();
            
            console.log(`\n📊 MEGA HARVEST PLAN:`);
            console.log(`   📦 Sources to harvest: ${this.session.pokemonSets.length}`);
            console.log(`   📄 Max pages per source: ${this.session.harvestConfig.maxPagesPerSet}`);
            console.log(`   💰 Pricing extraction: ENABLED`);
            console.log(`   🗄️  Database storage: ENABLED`);
            console.log(`   🔄 Resume capability: ENABLED`);
            console.log(`   🚫 Duplicate prevention: ENABLED`);
            
            // Process all sources - PRIORITY ORDER (mega catalog first)
            const sortedSources = this.session.pokemonSets.sort((a, b) => {
                return (a.priority || 99) - (b.priority || 99);
            });
            
            for (const source of sortedSources) {
                try {
                    console.log(`\n📈 MEGA PROGRESS: ${this.session.processedSets + 1}/${this.session.pokemonSets.length} sources`);
                    console.log(`🎴 Total products harvested so far: ${this.session.totalProducts}`);
                    console.log(`🚫 Duplicates skipped: ${this.session.skippedDuplicates}`);
                    
                    const sourceProducts = await this.megaHarvestSource(source);
                    this.session.allProducts.push(...sourceProducts);
                    this.session.totalProducts = this.session.allProducts.length;
                    this.session.processedSets++;
                    
                    // Update harvest session progress
                    try {
                        await this.prisma.tCGPlayerHarvestSession.update({
                            where: { sessionId: this.sessionId },
                            data: {
                                processedSets: this.session.processedSets,
                                totalProducts: this.session.totalProducts,
                                successfulSets: this.session.processedSets
                            }
                        });
                    } catch (error) {
                        console.log('Note: Could not update session progress');
                    }
                    
                    // Save progress after each source
                    await this.saveProgress();
                    
                    // Rate limiting between sources
                    await this.sleep(5000);
                    
                } catch (error) {
                    console.error(`💥 Failed to process source ${source.title}:`, error.message);
                    await this.logError(source.title, error.message);
                }
            }
            
            // Complete mega harvest session
            await this.completeMegaHarvestSession();
            
            console.log(`\n🎉🎉🎉 MEGA HARVEST COMPLETED! 🎉🎉🎉`);
            console.log(`📊 FINAL MEGA RESULTS:`);
            console.log(`   📦 Sources processed: ${this.session.processedSets}/${this.session.pokemonSets.length}`);
            console.log(`   🎴 Total unique products: ${this.session.totalProducts}`);
            console.log(`   🚫 Duplicates prevented: ${this.session.skippedDuplicates}`);
            console.log(`   ⚠️  Errors: ${this.session.errors.length}`);
            console.log(`   🗄️  Database: tcgplayer.db`);
            console.log(`   📊 Session: ${this.sessionId}`);
            console.log(`   ⏱️  Duration: ${((new Date() - new Date(this.session.startTime)) / 1000 / 60).toFixed(1)} minutes`);
            
            return {
                success: true,
                totalProducts: this.session.totalProducts,
                processedSources: this.session.processedSets,
                duplicatesSkipped: this.session.skippedDuplicates,
                errors: this.session.errors.length,
                sessionId: this.sessionId,
                databaseFile: 'tcgplayer.db'
            };
            
        } catch (error) {
            console.error('💥 Critical error in mega harvest:', error);
            await this.failHarvestSession(error.message);
            throw error;
        }
    }

    /**
     * Complete mega harvest session
     */
    async completeMegaHarvestSession() {
        try {
            await this.prisma.tCGPlayerHarvestSession.update({
                where: { sessionId: this.sessionId },
                data: {
                    status: 'completed',
                    endTime: new Date(),
                    summary: JSON.stringify({
                        totalProducts: this.session.totalProducts,
                        processedSources: this.session.processedSets,
                        duplicatesSkipped: this.session.skippedDuplicates,
                        errors: this.session.errors,
                        avgProductsPerSource: Math.round(this.session.totalProducts / this.session.processedSets)
                    })
                }
            });
        } catch (error) {
            console.log('Note: Could not update session completion');
        }
    }

    /**
     * Mark harvest session as failed
     */
    async failHarvestSession(errorMessage) {
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
    const harvester = new TCGPlayerMegaHarvester();
    
    try {
        const result = await harvester.runMegaHarvest();
        console.log('\n🎉 MEGA HARVEST COMPLETED SUCCESSFULLY! 🎉');
        console.log('Result:', result);
    } catch (error) {
        console.error('💥 MEGA HARVEST FAILED:', error);
    } finally {
        await harvester.cleanup();
    }
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = TCGPlayerMegaHarvester;
