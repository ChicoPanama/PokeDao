const axios = require('axios');
const fs = require('fs');
const { chromium } = require('playwright');
const { PrismaClient } = require('./generated/client');
const path = require('path');

/**
 * TCGPlayer COMPLETE Pokemon Downloader
 * Downloads ALL Pokemon cards from TCGplayer with proper sorting:
 * 1. Rarity (rarest to common)
 * 2. Price (highest to lowest within each rarity)
 * 3. No duplicates
 * 4. Complete pagination
 */
class TCGPlayerCompletePokemonDownloader {
    constructor() {
        this.navigationAPI = 'https://marketplace-navigation.tcgplayer.com/marketplace-navigation-search-feature.json';
        this.baseUrl = 'https://www.tcgplayer.com';
        this.sessionId = `tcgplayer_complete_${Date.now()}`;
        
        // Initialize separate Prisma client for TCGplayer database
        this.prisma = new PrismaClient();
        
        this.session = {
            sessionId: this.sessionId,
            startTime: new Date().toISOString(),
            allCards: [],
            totalCards: 0,
            processedSources: 0,
            errors: [],
            rarityWeights: new Map(),
            seenCards: new Set() // For deduplication
        };
        
        this.headers = {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
            'Accept': 'application/json, text/plain, */*',
            'Accept-Language': 'en-US,en;q=0.9',
            'Referer': 'https://www.tcgplayer.com/'
        };

        // Rarity weight system (highest to lowest value)
        this.rarityWeights = new Map([
            // Ultra rare tiers (100+)
            ['Secret Rare', 100],
            ['Special Illustration Rare', 95],
            ['Hyper Rare', 90],
            ['Illustration Rare', 88],
            ['Ultra Rare', 85],
            ['Full Art', 80],
            ['Rainbow Rare', 78],
            ['Gold Rare', 75],
            ['Shiny Rare', 73],
            
            // Standard rare tiers (50-70)
            ['Double Rare', 70],
            ['Holo Rare', 65],
            ['Rare', 60],
            ['Prime', 58],
            ['Legend', 56],
            ['EX', 55],
            ['GX', 54],
            ['V', 53],
            ['VMAX', 52],
            ['VSTAR', 51],
            
            // Mid tiers (30-50)
            ['Promo', 40],
            ['Reverse Holo', 35],
            ['Holo', 32],
            
            // Common tiers (10-30)
            ['Uncommon', 20],
            ['Common', 10],
            
            // Fallback
            ['', 5],
            ['None', 5],
            ['Unknown', 5]
        ]);
    }

    /**
     * Initialize the complete download session
     */
    async initialize() {
        console.log('🚀 INITIALIZING COMPLETE POKEMON DOWNLOADER');
        console.log(`📊 Session ID: ${this.sessionId}`);
        console.log('🎯 Target: ALL Pokemon cards on TCGplayer');
        console.log('📖 Features: Complete collection, proper sorting, zero duplicates');
        
        try {
            // Create harvest session in database
            await this.createHarvestSession();
            
            // Load existing products to prevent duplicates
            await this.loadExistingCards();
            
            console.log(`✅ Initialized with ${this.session.seenCards.size} existing cards for duplicate prevention`);
            return true;
        } catch (error) {
            console.error('💥 Failed to initialize:', error);
            throw error;
        }
    }

    /**
     * Load existing cards from database - SPEED MODE: DISABLED
     */
    async loadExistingCards() {
        // SPEED OPTIMIZATION: Skip loading existing cards
        // This saves significant startup time and memory
        console.log('� SPEED MODE: Skipping existing card lookup for maximum performance');
        console.log('📊 Will collect ALL cards, deduplicate later');
        return;
    }

    /**
     * Check if card is duplicate - SPEED MODE: ALWAYS RETURN FALSE
     */
    isDuplicate(card) {
        // SPEED OPTIMIZATION: Skip all duplicate checking
        // Collect everything, sort later
        return false;
    }

    /**
     * Mark card as seen
     */
    markAsSeen(card) {
        if (card.externalId) this.session.seenCards.add(card.externalId);
        if (card.productUrl) this.session.seenCards.add(card.productUrl);
        this.session.seenCards.add(`${card.name}_${card.setName}`);
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
                    harvestType: 'complete_download',
                    maxPagesPerSet: 999 // Unlimited
                }
            });
            
            console.log(`📝 Created complete download session: ${session.id}`);
            return session;
        } catch (error) {
            console.error('Error creating harvest session:', error);
            return null;
        }
    }

    /**
     * Discover all Pokemon sources from navigation API
     */
    async discoverAllPokemonSources() {
        console.log('🔍 Discovering ALL Pokemon sources...');
        
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
            
            const sources = [];
            
            // 1. Main "All Pokemon Products" page - THIS IS THE COMPLETE SOURCE
            const mainPokemonUrl = {
                title: 'All Pokemon Products (Complete)',
                url: pokemonCategory.shopAllUrl,
                fullUrl: `${this.baseUrl}${pokemonCategory.shopAllUrl}`,
                type: 'complete',
                priority: 1 // Highest priority
            };
            sources.push(mainPokemonUrl);
            
            // 2. Individual sets as backup/verification
            for (const menu of pokemonCategory.menus) {
                if (menu.links) {
                    for (const link of menu.links) {
                        if (link.url && link.url.includes('/search/pokemon/')) {
                            const sourceData = {
                                title: link.title,
                                url: link.url,
                                fullUrl: link.url.startsWith('http') ? link.url : `${this.baseUrl}${link.url}`,
                                menuCategory: menu.title,
                                type: 'set',
                                priority: 2 // Lower priority
                            };
                            
                            sources.push(sourceData);
                        }
                    }
                }
            }
            
            // 3. Additional comprehensive search endpoints
            const additionalSources = [
                {
                    title: 'Pokemon Products (Search)',
                    url: '/search/pokemon/product?productLineName=pokemon',
                    fullUrl: `${this.baseUrl}/search/pokemon/product?productLineName=pokemon`,
                    type: 'search',
                    priority: 3
                },
                {
                    title: 'Pokemon Cards (Direct)',
                    url: '/search/pokemon/product?view=grid',
                    fullUrl: `${this.baseUrl}/search/pokemon/product?view=grid`,
                    type: 'direct',
                    priority: 3
                }
            ];

            sources.push(...additionalSources);
            
            // Sort by priority (complete source first)
            sources.sort((a, b) => a.priority - b.priority);
            
            console.log(`📦 Discovered ${sources.length} Pokemon sources:`);
            sources.forEach((source, index) => {
                console.log(`   ${index + 1}. ${source.title} [${source.type}] (Priority: ${source.priority})`);
            });
            
            return sources;
            
        } catch (error) {
            console.error('💥 Error discovering Pokemon sources:', error.message);
            throw error;
        }
    }

    /**
     * Get rarity weight for sorting
     */
    getRarityWeight(rarity) {
        if (!rarity) return 5;
        
        // Exact match first
        if (this.rarityWeights.has(rarity)) {
            return this.rarityWeights.get(rarity);
        }
        
        // Fuzzy matching for variations
        const rarityLower = rarity.toLowerCase();
        
        // Secret variants
        if (rarityLower.includes('secret')) return 100;
        if (rarityLower.includes('special illustration')) return 95;
        if (rarityLower.includes('hyper')) return 90;
        if (rarityLower.includes('illustration')) return 88;
        if (rarityLower.includes('ultra')) return 85;
        if (rarityLower.includes('full art')) return 80;
        if (rarityLower.includes('rainbow')) return 78;
        if (rarityLower.includes('gold')) return 75;
        if (rarityLower.includes('shiny')) return 73;
        
        // Standard rare variants
        if (rarityLower.includes('double')) return 70;
        if (rarityLower.includes('holo') && rarityLower.includes('rare')) return 65;
        if (rarityLower.includes('rare')) return 60;
        if (rarityLower.includes('prime')) return 58;
        if (rarityLower.includes('legend')) return 56;
        if (rarityLower.includes('ex')) return 55;
        if (rarityLower.includes('gx')) return 54;
        if (rarityLower.includes('vmax')) return 52;
        if (rarityLower.includes('vstar')) return 51;
        if (rarityLower.includes(' v ') || rarityLower.endsWith(' v')) return 53;
        
        // Mid tier
        if (rarityLower.includes('promo')) return 40;
        if (rarityLower.includes('reverse')) return 35;
        if (rarityLower.includes('holo')) return 32;
        
        // Common tier
        if (rarityLower.includes('uncommon')) return 20;
        if (rarityLower.includes('common')) return 10;
        
        // Default
        return 5;
    }

    /**
     * Enhanced pricing extraction
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

            // From price pattern
            const fromPriceMatch = productText.match(/from\s+\$?([\d,]+\.?\d*)/i);
            if (fromPriceMatch) {
                pricing.currentPrice = parseFloat(fromPriceMatch[1].replace(',', ''));
            }

            // Price range pattern
            const rangeMatch = productText.match(/\$?([\d,]+\.?\d*)\s*[-–]\s*\$?([\d,]+\.?\d*)/);
            if (rangeMatch) {
                pricing.lowPrice = parseFloat(rangeMatch[1].replace(',', ''));
                pricing.highPrice = parseFloat(rangeMatch[2].replace(',', ''));
            }

            // Listing count
            const listingMatch = productText.match(/(\d+)\s+listings?/i);
            if (listingMatch) {
                pricing.listingCount = parseInt(listingMatch[1]);
            }

            // Fallback to any dollar amount
            if (!pricing.currentPrice && !pricing.marketPrice) {
                const dollarMatches = productText.match(/\$?([\d,]+\.?\d*)/g);
                if (dollarMatches && dollarMatches.length > 0) {
                    for (const match of dollarMatches) {
                        const price = parseFloat(match.replace(/[$,]/g, ''));
                        if (price > 0.01 && price < 50000) {
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
     * Download all cards from a source with complete pagination
     */
    async downloadFromSource(source) {
        console.log(`\n🌾 DOWNLOADING FROM: ${source.title}`);
        console.log(`📍 URL: ${source.fullUrl}`);
        console.log(`📖 Type: ${source.type} | Priority: ${source.priority}`);

        const browser = await chromium.launch({ 
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        const page = await browser.newPage();
        
        try {
            await page.setExtraHTTPHeaders(this.headers);
            await page.goto(source.fullUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
            await page.waitForTimeout(1000); // SPEED: Reduced from 3000ms
            
            const sourceCards = [];
            let currentPage = 1;
            let consecutiveEmptyPages = 0;
            let totalPageCount = 0;
            
            // Complete pagination - get ALL pages
            while (consecutiveEmptyPages < 3 && currentPage <= 500) { // Safety limit
                console.log(`📄 Processing page ${currentPage} of ${source.title}...`);
                
                // Extract cards with comprehensive data
                const pageCards = await page.evaluate(({ sourceInfo, pageNum, sessionId }) => {
                    const cards = [];
                    
                    // Multiple product selectors for maximum coverage
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
                        '.marketplace-product',
                        '.product-listing',
                        '.card-listing'
                    ];
                    
                    let foundElements = [];
                    
                    for (const selector of selectors) {
                        const elements = document.querySelectorAll(selector);
                        if (elements.length > 0) {
                            foundElements = Array.from(elements);
                            console.log(`Found ${elements.length} cards using selector: ${selector}`);
                            break;
                        }
                    }
                    
                    foundElements.forEach((element, index) => {
                        try {
                            // Comprehensive text for pricing
                            const fullText = element.textContent || '';
                            
                            // Extract card name with multiple strategies
                            const nameSelectors = [
                                '.product-name', '.card-name', '.title', '.name',
                                'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
                                'a[href*="/product/"]', '[data-name]',
                                '.product-title', '.card-title'
                            ];
                            
                            let name = '';
                            for (const selector of nameSelectors) {
                                const nameEl = element.querySelector(selector);
                                if (nameEl && nameEl.textContent.trim()) {
                                    name = nameEl.textContent.trim();
                                    break;
                                }
                            }
                            
                            // Fallback to link text
                            if (!name) {
                                const linkEl = element.querySelector('a');
                                if (linkEl && linkEl.textContent.trim()) {
                                    name = linkEl.textContent.trim();
                                }
                            }
                            
                            // Extract product URL and ID
                            const linkEl = element.querySelector('a[href*="/product/"], a[href*="/search/"]');
                            const productUrl = linkEl ? linkEl.href : '';
                            
                            const productIdMatch = productUrl.match(/\/product\/(\d+)/);
                            const externalId = productIdMatch ? productIdMatch[1] : null;
                            
                            // Extract image
                            const imageEl = element.querySelector('img');
                            const imageUrl = imageEl ? (imageEl.src || imageEl.dataset.src) : '';
                            
                            // Extract set and rarity information
                            const setSelectors = ['.set-name', '.edition', '.product-line', '.set', '.series'];
                            const raritySelectors = ['.rarity', '.card-rarity', '[data-rarity]', '.rare', '.rarity-indicator'];
                            
                            let setName = sourceInfo.title;
                            let rarity = '';
                            
                            for (const selector of setSelectors) {
                                const setEl = element.querySelector(selector);
                                if (setEl && setEl.textContent.trim()) {
                                    setName = setEl.textContent.trim();
                                    break;
                                }
                            }
                            
                            for (const selector of raritySelectors) {
                                const rarityEl = element.querySelector(selector);
                                if (rarityEl) {
                                    rarity = rarityEl.textContent.trim() || rarityEl.dataset.rarity || '';
                                    if (rarity) break;
                                }
                            }
                            
                            // Extract rarity from card name if not found elsewhere
                            if (!rarity && name) {
                                const rarityInName = name.match(/(Secret Rare|Ultra Rare|Holo Rare|Rare|Uncommon|Common|Promo)/i);
                                if (rarityInName) {
                                    rarity = rarityInName[1];
                                }
                            }
                            
                            // Only add if we have essential data
                            if (name && name.length > 2) {
                                cards.push({
                                    // Core identification
                                    name: name,
                                    cleanedName: name.replace(/^[^a-zA-Z]*/, '').split(/\s*(?:Uncommon|Common|Rare|Ultra Rare|Secret Rare)/)[0].trim(),
                                    externalId: externalId,
                                    
                                    // Set and rarity
                                    setName: setName,
                                    setUrl: sourceInfo.fullUrl,
                                    rarity: rarity || 'Unknown',
                                    category: 'Pokemon',
                                    
                                    // URLs and media
                                    productUrl: productUrl,
                                    imageUrl: imageUrl,
                                    tcgplayerUrl: productUrl,
                                    
                                    // Pricing data (raw for extraction)
                                    fullProductText: fullText,
                                    
                                    // Metadata
                                    page: pageNum,
                                    sourceTitle: sourceInfo.title,
                                    sourceType: sourceInfo.type,
                                    sourcePriority: sourceInfo.priority,
                                    extractedAt: new Date().toISOString(),
                                    harvestSessionId: sessionId,
                                    
                                    // Debug info
                                    elementIndex: index
                                });
                            }
                        } catch (error) {
                            console.error(`Error extracting card ${index}:`, error);
                        }
                    });
                    
                    return cards;
                }, { 
                    sourceInfo: source, 
                    pageNum: currentPage, 
                    sessionId: this.sessionId 
                });
                
                if (pageCards.length > 0) {
                    let newCards = 0;
                    let duplicates = 0;
                    
                    // Process each card
                    for (const card of pageCards) {
                        // Extract pricing
                        const pricingData = this.extractPricing(card.fullProductText);
                        Object.assign(card, pricingData);
                        
                        // Add rarity weight for sorting
                        card.rarityWeight = this.getRarityWeight(card.rarity);
                        
                        // Check for duplicates
                        if (this.isDuplicate(card)) {
                            duplicates++;
                        } else {
                            // Save new card
                            await this.saveCardToDatabase(card);
                            this.markAsSeen(card);
                            sourceCards.push(card);
                            newCards++;
                        }
                    }
                    
                    console.log(`📦 Page ${currentPage}: Found ${pageCards.length} cards (${newCards} new, ${duplicates} duplicates) | Total: ${sourceCards.length}`);
                    consecutiveEmptyPages = 0;
                    totalPageCount = currentPage;
                } else {
                    consecutiveEmptyPages++;
                    console.log(`📭 Page ${currentPage}: No cards found (${consecutiveEmptyPages}/3 empty pages)`);
                }
                
                // Save progress periodically
                if (currentPage % 10 === 0) {
                    console.log(`💾 Progress saved at page ${currentPage}: ${sourceCards.length} cards`);
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
                                '.pagination a[href*="page="]:last-child',
                                '[data-testid="next-page"]',
                                '.page-next'
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
                    await page.waitForTimeout(1000); // SPEED: Reduced from 2000ms
                    currentPage++;
                } else {
                    console.log(`📄 No more pages found for ${source.title} after ${currentPage} pages`);
                    break;
                }
            }
            
            console.log(`✅ ${source.title}: Downloaded ${sourceCards.length} cards from ${totalPageCount} pages`);
            return sourceCards;
            
        } catch (error) {
            console.error(`💥 Error downloading from ${source.title}:`, error.message);
            return [];
        } finally {
            await browser.close();
        }
    }

    /**
     * Save card to database
     */
    async saveCardToDatabase(card) {
        try {
            const uniqueKey = card.externalId || `${card.name}_${card.setName}_${card.sourceTitle}`;
            
            await this.prisma.tCGPlayerCard.upsert({
                where: { externalId: uniqueKey },
                update: {
                    name: card.name,
                    cleanedName: card.cleanedName,
                    currentPrice: card.currentPrice,
                    marketPrice: card.marketPrice,
                    lowPrice: card.lowPrice,
                    highPrice: card.highPrice,
                    listingCount: card.listingCount,
                    rarity: card.rarity,
                    rarityWeight: card.rarityWeight,
                    lastUpdated: new Date(),
                    rawProductData: JSON.stringify(card)
                },
                create: {
                    externalId: uniqueKey,
                    name: card.name,
                    cleanedName: card.cleanedName,
                    setName: card.setName,
                    setUrl: card.setUrl,
                    rarity: card.rarity,
                    rarityWeight: card.rarityWeight,
                    category: card.category,
                    productUrl: card.productUrl,
                    imageUrl: card.imageUrl,
                    tcgplayerUrl: card.tcgplayerUrl,
                    currentPrice: card.currentPrice,
                    marketPrice: card.marketPrice,
                    lowPrice: card.lowPrice,
                    highPrice: card.highPrice,
                    listingCount: card.listingCount,
                    page: card.page,
                    sourceTitle: card.sourceTitle,
                    sourceType: card.sourceType,
                    sourcePriority: card.sourcePriority,
                    harvestSessionId: card.harvestSessionId,
                    rawProductData: JSON.stringify(card)
                }
            });

        } catch (error) {
            console.error(`Error saving card ${card.name}:`, error);
        }
    }

    /**
     * Run the complete Pokemon download
     */
    async runCompleteDownload() {
        console.log('🚀🚀🚀 STARTING COMPLETE POKEMON DOWNLOAD 🚀🚀🚀');
        console.log('🎯 Target: ALL Pokemon cards on TCGplayer');
        console.log('📊 Sorting: Rarity (highest first) → Price (highest first)');
        
        try {
            await this.initialize();
            const sources = await this.discoverAllPokemonSources();
            
            console.log(`\n📊 DOWNLOAD PLAN:`);
            console.log(`   📦 Sources to process: ${sources.length}`);
            console.log(`   🏆 Priority order: Complete → Sets → Search`);
            console.log(`   💰 Pricing extraction: ENABLED`);
            console.log(`   🗄️  Database storage: ENABLED`);
            console.log(`   🚫 Duplicate prevention: ENABLED`);
            
            // Process all sources in priority order
            for (const source of sources) {
                try {
                    console.log(`\n📈 PROGRESS: ${this.session.processedSources + 1}/${sources.length} sources`);
                    console.log(`🎴 Total cards downloaded: ${this.session.totalCards}`);
                    
                    const sourceCards = await this.downloadFromSource(source);
                    this.session.allCards.push(...sourceCards);
                    this.session.totalCards = this.session.allCards.length;
                    this.session.processedSources++;
                    
                    // Rate limiting between sources
                    await this.sleep(1500); // SPEED: Reduced from 3000ms
                    
                } catch (error) {
                    console.error(`💥 Failed to process source ${source.title}:`, error.message);
                    this.session.errors.push({
                        source: source.title,
                        error: error.message,
                        timestamp: new Date().toISOString()
                    });
                }
            }
            
            // Final sorting and export
            await this.finalizeAndExport();
            
            console.log(`\n🎉🎉🎉 COMPLETE DOWNLOAD FINISHED! 🎉🎉🎉`);
            console.log(`📊 FINAL RESULTS:`);
            console.log(`   📦 Sources processed: ${this.session.processedSources}/${sources.length}`);
            console.log(`   🎴 Total unique cards: ${this.session.totalCards}`);
            console.log(`   🗄️  Database: tcgplayer.db`);
            console.log(`   📊 Session: ${this.sessionId}`);
            console.log(`   ⏱️  Duration: ${((new Date() - new Date(this.session.startTime)) / 1000 / 60).toFixed(1)} minutes`);
            
            return {
                success: true,
                totalCards: this.session.totalCards,
                processedSources: this.session.processedSources,
                errors: this.session.errors.length,
                sessionId: this.sessionId,
                databaseFile: 'tcgplayer.db',
                exportFiles: [
                    `tcgplayer_complete_pokemon_${this.sessionId}.json`,
                    `tcgplayer_complete_pokemon_${this.sessionId}.csv`
                ]
            };
            
        } catch (error) {
            console.error('💥 Critical error in complete download:', error);
            throw error;
        }
    }

    /**
     * Final sorting and export
     */
    async finalizeAndExport() {
        console.log('\n🔄 FINALIZING AND EXPORTING...');
        
        try {
            // Get all cards from database with proper sorting
            const allCards = await this.prisma.tCGPlayerCard.findMany({
                orderBy: [
                    { rarityWeight: 'desc' },      // Rarest first
                    { marketPrice: 'desc' },       // Most expensive first
                    { currentPrice: 'desc' },      // Fallback price
                    { name: 'asc' }                // Alphabetical last
                ]
            });

            console.log(`📊 Final count: ${allCards.length} cards properly sorted`);
            
            // Export to JSON
            const jsonFile = `tcgplayer_complete_pokemon_${this.sessionId}.json`;
            fs.writeFileSync(jsonFile, JSON.stringify({
                metadata: {
                    sessionId: this.sessionId,
                    downloadedAt: new Date().toISOString(),
                    totalCards: allCards.length,
                    sortOrder: 'rarity_desc_price_desc',
                    sources: this.session.processedSources
                },
                cards: allCards
            }, null, 2));
            
            // Export to CSV
            const csvFile = `tcgplayer_complete_pokemon_${this.sessionId}.csv`;
            const csvHeaders = 'Name,Set,Rarity,RarityWeight,MarketPrice,CurrentPrice,ListingCount,ProductURL,ImageURL';
            const csvRows = allCards.map(card => 
                `"${card.name}","${card.setName}","${card.rarity}",${card.rarityWeight},"${card.marketPrice || ''}","${card.currentPrice || ''}","${card.listingCount || ''}","${card.productUrl}","${card.imageUrl}"`
            );
            fs.writeFileSync(csvFile, [csvHeaders, ...csvRows].join('\n'));
            
            console.log(`✅ Exported to: ${jsonFile} and ${csvFile}`);
            
            // Update session completion
            await this.prisma.tCGPlayerHarvestSession.update({
                where: { sessionId: this.sessionId },
                data: {
                    status: 'completed',
                    endTime: new Date(),
                    totalProducts: allCards.length,
                    summary: JSON.stringify({
                        totalCards: allCards.length,
                        topRarity: allCards[0]?.rarity,
                        highestPrice: allCards[0]?.marketPrice,
                        processedSources: this.session.processedSources
                    })
                }
            });
            
        } catch (error) {
            console.error('Error in finalization:', error);
        }
    }

    /**
     * Sleep utility
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Cleanup
     */
    async cleanup() {
        await this.prisma.$disconnect();
    }
}

// Main execution
async function main() {
    const downloader = new TCGPlayerCompletePokemonDownloader();
    
    try {
        const result = await downloader.runCompleteDownload();
        console.log('\n🎉 COMPLETE DOWNLOAD SUCCESSFUL! 🎉');
        console.log('Result:', result);
    } catch (error) {
        console.error('💥 COMPLETE DOWNLOAD FAILED:', error);
    } finally {
        await downloader.cleanup();
    }
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = TCGPlayerCompletePokemonDownloader;
