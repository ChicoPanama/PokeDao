#!/usr/bin/env node
/**
 * 🎯 CARD LADDER POKEMON DATA EXTRACTOR
 * ====================================
 * 
 * Comprehensive Pokemon data extraction from cardladder.com
 * Using all techniques learned from Fanatics Collect
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const https = require('https');
const fs = require('fs');

puppeteer.use(StealthPlugin());

class CardLadderExtractor {
    constructor() {
        this.extractedCards = [];
        this.baseUrl = 'https://www.cardladder.com';
        
        // Pokemon-specific URLs on Card Ladder
        this.pokemonUrls = [
            'https://www.cardladder.com/search?q=pokemon',
            'https://www.cardladder.com/category/pokemon',
            'https://www.cardladder.com/sets?game=pokemon',
            'https://www.cardladder.com/pokemon',
            'https://www.cardladder.com/browse/pokemon',
            'https://www.cardladder.com/game/pokemon-tcg',
            'https://www.cardladder.com/cards/pokemon'
        ];
        
        console.log('🎯 CARD LADDER POKEMON DATA EXTRACTOR');
        console.log('=====================================');
        console.log('🚀 Preparing to extract ALL Pokemon data from Card Ladder');
    }

    async conductReconnaissance() {
        console.log('\n🔍 PHASE 1: CARD LADDER RECONNAISSANCE');
        console.log('=====================================');
        
        const recon = {
            accessible_urls: [],
            pokemon_density: {},
            page_structures: {},
            selectors: {}
        };
        
        for (const url of this.pokemonUrls) {
            console.log(`📡 Analyzing: ${url}`);
            
            try {
                const pageData = await this.fetchPage(url);
                
                if (pageData) {
                    const pokemonMentions = (pageData.match(/pokemon/gi) || []).length;
                    const hasPrices = pageData.includes('$') && pageData.match(/\$[\d,]+/g);
                    const hasCards = pageData.includes('card') || pageData.includes('PSA') || pageData.includes('BGS');
                    
                    recon.accessible_urls.push(url);
                    recon.pokemon_density[url] = pokemonMentions;
                    recon.page_structures[url] = {
                        size: pageData.length,
                        pokemon_mentions: pokemonMentions,
                        has_prices: !!hasPrices,
                        has_cards: hasCards,
                        price_count: hasPrices ? hasPrices.length : 0
                    };
                    
                    console.log(`   ✅ ${pokemonMentions} Pokemon mentions, ${hasPrices ? hasPrices.length : 0} prices`);
                } else {
                    console.log(`   ❌ Inaccessible`);
                }
                
            } catch (error) {
                console.log(`   ❌ Error: ${error.message}`);
            }
            
            await this.delay(2000);
        }
        
        // Find best URLs for extraction
        const bestUrls = recon.accessible_urls
            .sort((a, b) => (recon.pokemon_density[b] || 0) - (recon.pokemon_density[a] || 0))
            .slice(0, 5);
            
        console.log('\n🎯 BEST POKEMON URLs DISCOVERED:');
        bestUrls.forEach((url, index) => {
            console.log(`   ${index + 1}. ${url} (${recon.pokemon_density[url]} Pokemon mentions)`);
        });
        
        return { recon, bestUrls };
    }

    async extractAllPokemonData() {
        console.log('\n🚀 STARTING CARD LADDER POKEMON EXTRACTION');
        console.log('==========================================');
        
        // First, conduct reconnaissance
        const { recon, bestUrls } = await this.conductReconnaissance();
        
        if (bestUrls.length === 0) {
            console.log('❌ No accessible Pokemon URLs found');
            return;
        }
        
        const browser = await puppeteer.launch({
            headless: false, // Keep visible to monitor progress
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-blink-features=AutomationControlled',
                '--disable-web-security',
                '--window-size=1400,1000'
            ],
            defaultViewport: { width: 1400, height: 1000 }
        });

        try {
            const page = await browser.newPage();
            await this.setupStealth(page);
            
            let totalExtracted = 0;
            
            // Extract from each promising URL
            for (const url of bestUrls) {
                console.log(`\n🎯 Extracting from: ${url}`);
                
                try {
                    const cards = await this.extractFromUrl(page, url);
                    totalExtracted += cards.length;
                    
                    if (cards.length > 0) {
                        console.log(`✅ Extracted ${cards.length} Pokemon cards`);
                        this.saveProgressBatch(cards, url);
                    }
                    
                } catch (error) {
                    console.log(`❌ Error extracting from ${url}: ${error.message}`);
                }
                
                await this.randomDelay(3000, 6000);
            }
            
            // Try specific Pokemon searches
            await this.performPokemonSearches(page);
            
            // Try Pokemon set searches
            await this.performSetSearches(page);
            
            console.log(`\n🎉 EXTRACTION COMPLETE: ${this.extractedCards.length} total Pokemon cards`);
            this.generateFinalReport();
            
        } finally {
            await browser.close();
        }
    }

    async performPokemonSearches(page) {
        console.log('\n🔍 PERFORMING TARGETED POKEMON SEARCHES');
        console.log('======================================');
        
        const searchTerms = [
            'Charizard PSA 10',
            'Pikachu BGS', 
            'Base Set Shadowless',
            'Pokemon First Edition',
            'Pokemon Japanese',
            'Pokemon Promo',
            'Blastoise Holo',
            'Venusaur PSA',
            'Mewtwo CGC',
            'Mew Ancient',
            'Lugia Neo Genesis',
            'Rayquaza Gold Star',
            'Pokemon EX',
            'Pokemon GX',
            'Pokemon VMAX'
        ];
        
        for (const term of searchTerms) {
            console.log(`🔍 Searching for: "${term}"`);
            
            try {
                // Navigate to search page
                const searchUrl = `${this.baseUrl}/search?q=${encodeURIComponent(term)}`;
                await page.goto(searchUrl, {
                    waitUntil: 'networkidle2',
                    timeout: 30000
                });
                
                await this.waitForContent(page);
                
                // Extract cards from search results
                const searchCards = await this.extractCardsFromPage(page, `search-${term}`);
                
                if (searchCards.length > 0) {
                    console.log(`   ✅ Found ${searchCards.length} cards for "${term}"`);
                    this.extractedCards.push(...searchCards);
                    
                    // Handle pagination for this search
                    const paginationCards = await this.handlePagination(page, searchUrl);
                    if (paginationCards.length > 0) {
                        console.log(`   📄 Found ${paginationCards.length} more cards via pagination`);
                        this.extractedCards.push(...paginationCards);
                    }
                } else {
                    console.log(`   ❌ No cards found for "${term}"`);
                }
                
            } catch (error) {
                console.log(`   ❌ Search error for "${term}": ${error.message}`);
            }
            
            await this.randomDelay(2000, 4000);
        }
    }

    async performSetSearches(page) {
        console.log('\n🎴 PERFORMING POKEMON SET SEARCHES');
        console.log('==================================');
        
        const pokemonSets = [
            'Base Set',
            'Jungle',
            'Fossil',
            'Team Rocket',
            'Gym Heroes',
            'Gym Challenge',
            'Neo Genesis',
            'Neo Discovery',
            'Neo Revelation',
            'Neo Destiny',
            'Expedition',
            'Aquapolis',
            'Skyridge',
            'Ruby Sapphire',
            'EX Dragon',
            'Diamond Pearl',
            'Platinum',
            'HeartGold SoulSilver',
            'Black White',
            'XY',
            'Sun Moon',
            'Sword Shield',
            'Brilliant Stars',
            'Evolving Skies'
        ];
        
        for (const set of pokemonSets) {
            console.log(`🎴 Searching Pokemon set: "${set}"`);
            
            try {
                const setSearchUrl = `${this.baseUrl}/search?q=pokemon+${encodeURIComponent(set)}`;
                await page.goto(setSearchUrl, {
                    waitUntil: 'networkidle2',
                    timeout: 30000
                });
                
                await this.waitForContent(page);
                
                const setCards = await this.extractCardsFromPage(page, `set-${set}`);
                
                if (setCards.length > 0) {
                    console.log(`   ✅ Found ${setCards.length} cards from "${set}" set`);
                    this.extractedCards.push(...setCards);
                } else {
                    console.log(`   ❌ No cards found for "${set}" set`);
                }
                
            } catch (error) {
                console.log(`   ❌ Set search error for "${set}": ${error.message}`);
            }
            
            await this.randomDelay(1500, 3000);
        }
    }

    async extractFromUrl(page, url) {
        const cards = [];
        
        try {
            console.log(`   📡 Navigating to: ${url}`);
            
            await page.goto(url, { 
                waitUntil: 'networkidle2',
                timeout: 30000 
            });
            
            // Wait for dynamic content
            await this.waitForContent(page);
            
            // Scroll to load more content
            await this.scrollToLoadContent(page);
            
            // Extract cards using multiple strategies
            const extractedCards = await this.extractCardsFromPage(page, url);
            cards.push(...extractedCards);
            
            // Handle pagination
            const paginationCards = await this.handlePagination(page, url);
            cards.push(...paginationCards);
            
        } catch (error) {
            console.log(`   ❌ Extraction error: ${error.message}`);
        }
        
        return cards;
    }

    async extractCardsFromPage(page, sourceIdentifier) {
        console.log('   🎴 Extracting Pokemon cards from page...');
        
        const cards = await page.evaluate((source) => {
            const extractedCards = [];
            
            // Card Ladder specific selectors (comprehensive list)
            const cardSelectors = [
                // Card Ladder specific patterns
                '[data-testid*="card"]',
                '[data-testid*="item"]',
                '[data-testid*="product"]',
                '[data-cy*="card"]',
                '.card-item',
                '.product-card',
                '.listing-item',
                '.search-result',
                '.card-container',
                '.item-container',
                '.product-item',
                '.card-listing',
                '.market-item',
                '.auction-item',
                
                // Generic containers with cards
                'div[class*="card"]',
                'div[class*="item"]',
                'div[class*="product"]',
                'div[class*="listing"]',
                'div[class*="result"]',
                'article',
                
                // Grid/list patterns
                'div[class*="grid"] > div',
                'div[class*="results"] > div',
                'div[class*="list"] > div',
                'ul[class*="list"] > li',
                'div[role="listitem"]',
                
                // Table patterns
                'tr[class*="row"]',
                'tbody > tr',
                
                // Card specific patterns
                'div:has(img[alt*="pokemon"])',
                'div:has(img[src*="pokemon"])',
                'div:has([class*="price"])'
            ];
            
            // Name selectors
            const nameSelectors = [
                'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
                '[class*="title"]',
                '[class*="name"]',
                '[class*="card-name"]',
                '[class*="product-name"]',
                '[data-testid*="title"]',
                '[data-testid*="name"]',
                '.product-title',
                '.card-title',
                '.item-title',
                '.listing-title',
                'a[title]',
                '[aria-label]'
            ];
            
            // Price selectors
            const priceSelectors = [
                '[class*="price"]',
                '[data-testid*="price"]',
                '[class*="cost"]',
                '[class*="value"]',
                '[class*="amount"]',
                '[class*="market"]',
                '.current-price',
                '.sale-price',
                '.market-price',
                '.listing-price',
                '.bid-price',
                '.buy-price',
                '[data-price]'
            ];
            
            // Image selectors
            const imageSelectors = [
                'img[src*="card"]',
                'img[src*="pokemon"]',
                'img[alt*="pokemon"]',
                'img[class*="card"]',
                'img[data-testid*="image"]',
                '.card-image img',
                '.product-image img',
                '.item-image img',
                'picture img',
                '[style*="background-image"]'
            ];
            
            // Additional data selectors
            const linkSelectors = [
                'a[href*="card"]',
                'a[href*="pokemon"]',
                'a[href*="listing"]',
                'a[href*="product"]'
            ];
            
            // Strategy 1: Try specific card container selectors
            for (const containerSelector of cardSelectors) {
                try {
                    const containers = document.querySelectorAll(containerSelector);
                    
                    containers.forEach((container, index) => {
                        const text = container.textContent?.toLowerCase() || '';
                        
                        // Only process if it contains Pokemon content and has meaningful length
                        if ((text.includes('pokemon') || text.includes('pikachu') || text.includes('charizard') || 
                             text.includes('blastoise') || text.includes('venusaur') || text.includes('mewtwo') ||
                             text.includes('tcg') || text.includes('trading card')) && 
                            text.length > 20 && text.length < 2000) {
                            
                            // Extract card name
                            let cardName = '';
                            for (const nameSelector of nameSelectors) {
                                const nameEl = container.querySelector(nameSelector);
                                if (nameEl?.textContent?.trim() && nameEl.textContent.trim().length > 3) {
                                    cardName = nameEl.textContent.trim();
                                    break;
                                }
                            }
                            
                            // Fallback name extraction from container text
                            if (!cardName || cardName.length < 5) {
                                const textLines = text.split('\n').map(line => line.trim()).filter(line => line.length > 5);
                                cardName = textLines[0] || text.substring(0, 100).trim();
                            }
                            
                            // Extract price
                            let price = '';
                            let currentValue = '';
                            
                            for (const priceSelector of priceSelectors) {
                                const priceEl = container.querySelector(priceSelector);
                                if (priceEl?.textContent?.includes('$')) {
                                    price = priceEl.textContent.trim();
                                    break;
                                }
                            }
                            
                            // Fallback price extraction from text
                            if (!price) {
                                const priceMatches = text.match(/\$[\d,]+\.?\d*/g);
                                if (priceMatches && priceMatches.length > 0) {
                                    price = priceMatches[0];
                                    currentValue = priceMatches[priceMatches.length - 1]; // Latest price
                                }
                            }
                            
                            // Extract image
                            let imageUrl = '';
                            for (const imageSelector of imageSelectors) {
                                const imgEl = container.querySelector(imageSelector);
                                if (imgEl?.src && !imgEl.src.includes('placeholder')) {
                                    imageUrl = imgEl.src.startsWith('http') ? imgEl.src : `https://www.cardladder.com${imgEl.src}`;
                                    break;
                                }
                            }
                            
                            // Extract card URL
                            let cardUrl = '';
                            for (const linkSelector of linkSelectors) {
                                const linkEl = container.querySelector(linkSelector);
                                if (linkEl?.href) {
                                    cardUrl = linkEl.href.startsWith('http') ? linkEl.href : `https://www.cardladder.com${linkEl.href}`;
                                    break;
                                }
                            }
                            
                            // Extract grading information
                            const gradingMatch = text.match(/(PSA|BGS|CGC|PCG|SGC)\s*(\d+(?:\.\d+)?)/i);
                            const populationMatch = text.match(/pop(?:ulation)?\s*(\d+)/i);
                            
                            // Extract set information
                            const setMatch = text.match(/(base set|jungle|fossil|team rocket|gym heroes|gym challenge|neo genesis|neo discovery|neo revelation|neo destiny|expedition|aquapolis|skyridge|ruby|sapphire|emerald|diamond|pearl|platinum|heartgold|soulsilver|black|white|xy|sun|moon|sword|shield|brilliant|evolving|astral|lost|crown|battle|fusion|chilling|darkness|vivid|rebel|cosmic|hidden|unbroken|unified|team up|detective|forbidden|celestial|burning|guardians|roaring|ultra|crimson|paradox)/i);
                            
                            // Extract rarity information  
                            const rarityMatch = text.match(/(holo|holographic|reverse holo|shadowless|first edition|1st edition|unlimited|promo|promotional|secret rare|ultra rare|rainbow rare|full art|alternate art|special art|gold|silver)/i);
                            
                            // Extract condition
                            const conditionMatch = text.match(/(mint|near mint|nm|lightly played|lp|moderately played|mp|heavily played|hp|damaged|dmg|poor)/i);
                            
                            // Extract year
                            const yearMatch = text.match(/(19|20)\d{2}/);
                            
                            // Create card data object
                            const cardData = {
                                id: `cardladder-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                                name: cardName,
                                price: price,
                                current_value: currentValue || price,
                                market_value: price,
                                image_url: imageUrl,
                                card_url: cardUrl,
                                
                                // Grading information  
                                grading_service: gradingMatch?.[1]?.toUpperCase(),
                                grade: gradingMatch?.[2] ? parseFloat(gradingMatch[2]) : null,
                                population: populationMatch?.[1] ? parseInt(populationMatch[1]) : null,
                                
                                // Card details
                                set: setMatch?.[1],
                                rarity: rarityMatch?.[1],
                                condition: conditionMatch?.[1],
                                year: yearMatch?.[0] ? parseInt(yearMatch[0]) : null,
                                
                                // Metadata
                                source_url: window.location.href,
                                source_identifier: source,
                                extracted_at: new Date().toISOString(),
                                extraction_method: 'cardladder_comprehensive_v1',
                                platform: 'cardladder',
                                data_type: 'current_market',
                                raw_text: text.substring(0, 500).trim()
                            };
                            
                            // Only add if we have meaningful data (name + price OR image OR URL)
                            if (cardData.name && cardData.name.length > 5 && 
                                (cardData.price || cardData.image_url || cardData.card_url)) {
                                
                                // Check for duplicates in current extraction
                                const isDuplicate = extractedCards.some(existing => 
                                    existing.name === cardData.name && 
                                    existing.price === cardData.price &&
                                    existing.image_url === cardData.image_url
                                );
                                
                                if (!isDuplicate) {
                                    extractedCards.push(cardData);
                                }
                            }
                        }
                    });
                    
                    if (extractedCards.length > 0) {
                        console.log(`Strategy 1: Found ${extractedCards.length} cards with selector: ${containerSelector}`);
                    }
                    
                } catch (error) {
                    console.log(`Selector error with ${containerSelector}: ${error.message}`);
                }
            }
            
            // Strategy 2: Fallback pattern matching for Pokemon content
            if (extractedCards.length < 50) { // Only use fallback if we didn't find many cards
                console.log('Using fallback pattern matching strategy');
                
                const bodyText = document.body.textContent;
                const pokemonPatterns = [
                    /pokemon[^$]*?\$[\d,]+\.?\d*/gi,
                    /\$[\d,]+\.?\d*[^$]*?pokemon[^$]*?(?=\$|pokemon|\n|$)/gi,
                    /(charizard|pikachu|blastoise|venusaur|mewtwo|mew)[^$]*?\$[\d,]+\.?\d*/gi,
                    /(PSA|BGS|CGC)\s*\d+[^$]*?pokemon[^$]*?\$[\d,]+\.?\d*/gi
                ];
                
                pokemonPatterns.forEach((pattern, patternIndex) => {
                    const matches = bodyText.match(pattern) || [];
                    matches.forEach((match, index) => {
                        const priceMatch = match.match(/\$[\d,]+\.?\d*/);
                        if (priceMatch && match.length < 1000) {
                            const fallbackCard = {
                                id: `cardladder-fallback-${patternIndex}-${Date.now()}-${index}`,
                                name: match.substring(0, 150).trim(),
                                price: priceMatch[0],
                                current_value: priceMatch[0],
                                source_url: window.location.href,
                                source_identifier: source,
                                extracted_at: new Date().toISOString(),
                                extraction_method: 'fallback_pattern_v1',
                                platform: 'cardladder',
                                data_type: 'pattern_matched',
                                raw_text: match.substring(0, 300)
                            };
                            
                            // Extract grading from fallback
                            const gradingMatch = match.match(/(PSA|BGS|CGC|SGC)\s*(\d+(?:\.\d+)?)/i);
                            if (gradingMatch) {
                                fallbackCard.grading_service = gradingMatch[1].toUpperCase();
                                fallbackCard.grade = parseFloat(gradingMatch[2]);
                            }
                            
                            extractedCards.push(fallbackCard);
                        }
                    });
                });
                
                console.log(`Strategy 2: Fallback found ${extractedCards.length} total cards`);
            }
            
            // Strategy 3: Look for specific Card Ladder API data in page
            try {
                const scripts = document.querySelectorAll('script');
                scripts.forEach(script => {
                    const scriptText = script.textContent || '';
                    if (scriptText.includes('pokemon') && scriptText.includes('price')) {
                        // Try to extract JSON data from scripts
                        const jsonMatches = scriptText.match(/\{[^}]*pokemon[^}]*\}/gi);
                        if (jsonMatches) {
                            jsonMatches.forEach((jsonStr, index) => {
                                try {
                                    const data = JSON.parse(jsonStr);
                                    if (data.name && data.price) {
                                        extractedCards.push({
                                            id: `cardladder-json-${Date.now()}-${index}`,
                                            name: data.name,
                                            price: data.price,
                                            source_url: window.location.href,
                                            extraction_method: 'json_extraction_v1',
                                            platform: 'cardladder',
                                            raw_data: data
                                        });
                                    }
                                } catch (e) {
                                    // Continue if JSON parsing fails
                                }
                            });
                        }
                    }
                });
            } catch (error) {
                console.log('Strategy 3 error:', error.message);
            }
            
            console.log(`Total extracted ${extractedCards.length} Pokemon cards from current page`);
            return extractedCards;
            
        }, sourceIdentifier);
        
        console.log(`   ✅ Extracted ${cards.length} Pokemon cards from page`);
        return cards;
    }

    async handlePagination(page, baseUrl) {
        console.log('   📄 Checking for pagination...');
        
        const paginationCards = [];
        let currentPage = 1;
        const maxPages = 10; // Reasonable limit to avoid infinite loops
        
        while (currentPage < maxPages) {
            try {
                // Look for pagination buttons with multiple strategies
                const nextPageFound = await page.evaluate(() => {
                    const nextSelectors = [
                        // Specific next button text
                        'button:contains("Next")',
                        'a:contains("Next")',
                        'button:contains(">")',
                        'a:contains(">")',
                        
                        // Class-based selectors
                        '[class*="next"]',
                        '[class*="pagination"] button:last-child',
                        '[class*="pagination"] a:last-child',
                        'button[aria-label*="next"]',
                        'a[aria-label*="next"]',
                        '[data-testid*="next"]',
                        
                        // Generic navigation
                        'nav button:last-child',
                        '.pagination-next',
                        '.next-page'
                    ];
                    
                    // Try each selector
                    for (const selector of nextSelectors) {
                        try {
                            let elements;
                            
                            // Handle :contains pseudo-selector manually
                            if (selector.includes(':contains(')) {
                                const baseSelector = selector.split(':contains(')[0];
                                const searchText = selector.match(/\("(.+)"\)/)?.[1]?.toLowerCase();
                                elements = Array.from(document.querySelectorAll(baseSelector)).filter(el => 
                                    el.textContent?.toLowerCase().includes(searchText)
                                );
                            } else {
                                elements = document.querySelectorAll(selector);
                            }
                            
                            for (const element of elements) {
                                const text = element.textContent?.toLowerCase().trim();
                                const isNextButton = text && (
                                    text.includes('next') || 
                                    text === '>' || 
                                    text.includes('→') ||
                                    element.getAttribute('aria-label')?.toLowerCase().includes('next')
                                );
                                
                                if (isNextButton && element.offsetParent !== null && !element.disabled) {
                                    console.log(`Found next button: ${element.textContent || element.outerHTML.substring(0, 100)}`);
                                    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                    
                                    // Wait a moment for scroll
                                    setTimeout(() => {
                                        element.click();
                                    }, 1000);
                                    
                                    return true;
                                }
                            }
                        } catch (error) {
                            console.log(`Pagination selector error: ${error.message}`);
                            continue;
                        }
                    }
                    
                    // Fallback: look for page numbers
                    const pageNumbers = document.querySelectorAll('button, a');
                    for (const element of pageNumbers) {
                        const text = element.textContent?.trim();
                        if (text && /^\d+$/.test(text)) {
                            const pageNum = parseInt(text);
                            if (pageNum > 1 && element.offsetParent !== null && !element.disabled) {
                                element.click();
                                return true;
                            }
                        }
                    }
                    
                    return false;
                });
                
                if (!nextPageFound) {
                    console.log('   ❌ No more pages found');
                    break;
                }
                
                console.log(`   📄 Loading page ${currentPage + 1}...`);
                
                // Wait for new content to load
                await this.waitForContent(page);
                await this.delay(3000);
                
                // Extract cards from new page
                const newCards = await this.extractCardsFromPage(page, `${baseUrl}-page-${currentPage + 1}`);
                
                if (newCards.length === 0) {
                    console.log('   ❌ No new cards found on new page');
                    break;
                }
                
                // Filter out duplicates
                const uniqueNewCards = newCards.filter(newCard => 
                    !paginationCards.some(existing => 
                        existing.name === newCard.name && existing.price === newCard.price
                    )
                );
                
                if (uniqueNewCards.length === 0) {
                    console.log('   ❌ All cards on new page were duplicates');
                    break;
                }
                
                paginationCards.push(...uniqueNewCards);
                console.log(`   ✅ Found ${uniqueNewCards.length} new unique cards`);
                
                currentPage++;
                await this.randomDelay(2000, 4000);
                
            } catch (error) {
                console.log(`   ❌ Pagination error: ${error.message}`);
                break;
            }
        }
        
        console.log(`   ✅ Pagination complete: ${paginationCards.length} additional cards found`);
        return paginationCards;
    }

    async setupStealth(page) {
        await page.evaluateOnNewDocument(() => {
            Object.defineProperty(navigator, 'webdriver', {
                get: () => undefined,
            });
            
            // Remove automation indicators
            delete window.cdc_adoQpoasnfa76pfcZLmcfl_Array;
            delete window.cdc_adoQpoasnfa76pfcZLmcfl_Promise;
            delete window.cdc_adoQpoasnfa76pfcZLmcfl_Symbol;
            delete window.cdc_adoQpoasnfa76pfcZLmcfl_JSON;
            delete window.cdc_adoQpoasnfa76pfcZLmcfl_Object;
        });
        
        await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        await page.setViewport({ width: 1400, height: 1000 });
        
        // Set additional headers
        await page.setExtraHTTPHeaders({
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
        });
    }

    async waitForContent(page) {
        try {
            // Wait for network to be idle
            await page.waitForLoadState('networkidle', { timeout: 15000 });
        } catch (error) {
            // Continue if timeout
        }
        
        // Additional wait for dynamic content
        await this.delay(3000);
        
        // Wait for common loading indicators to disappear
        try {
            await page.waitForFunction(() => {
                const loadingIndicators = document.querySelectorAll('[class*="loading"], [class*="spinner"], [data-testid*="loading"]');
                return loadingIndicators.length === 0;
            }, { timeout: 10000 });
        } catch (error) {
            // Continue if no loading indicators found
        }
    }

    async scrollToLoadContent(page) {
        console.log('   📜 Scrolling to load more content...');
        
        try {
            await page.evaluate(async () => {
                await new Promise((resolve) => {
                    let totalHeight = 0;
                    const distance = 200;
                    const timer = setInterval(() => {
                        const scrollHeight = document.body.scrollHeight;
                        window.scrollBy(0, distance);
                        totalHeight += distance;

                        if (totalHeight >= scrollHeight || totalHeight > 10000) { // Max 10k pixels
                            clearInterval(timer);
                            resolve();
                        }
                    }, 100);
                });
            });
            
            // Wait for any lazy-loaded content
            await this.delay(3000);
            
            // Scroll back to top for consistent extraction
            await page.evaluate(() => window.scrollTo(0, 0));
            await this.delay(1000);
            
        } catch (error) {
            console.log(`   ⚠️ Scrolling error: ${error.message}`);
        }
    }

    async fetchPage(url) {
        return new Promise((resolve) => {
            const urlObj = new URL(url);
            
            const options = {
                hostname: urlObj.hostname,
                port: 443,
                path: urlObj.pathname + urlObj.search,
                method: 'GET',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.5',
                    'Accept-Encoding': 'gzip, deflate, br',
                    'Connection': 'keep-alive',
                    'Upgrade-Insecure-Requests': '1'
                },
                timeout: 15000
            };

            const req = https.request(options, (res) => {
                let data = '';
                
                res.on('data', (chunk) => {
                    data += chunk;
                });
                
                res.on('end', () => {
                    resolve(data);
                });
            });

            req.on('error', () => resolve(null));
            req.on('timeout', () => {
                req.destroy();
                resolve(null);
            });

            req.end();
        });
    }

    saveProgressBatch(cards, sourceUrl) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const urlSlug = sourceUrl.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50);
        const filename = `cardladder-batch-${urlSlug}-${timestamp}.json`;
        
        const batchData = {
            source_url: sourceUrl,
            extraction_timestamp: timestamp,
            cards_count: cards.length,
            cards: cards
        };
        
        fs.writeFileSync(filename, JSON.stringify(batchData, null, 2));
        console.log(`   💾 Progress saved to: ${filename}`);
        
        // Also save cumulative progress
        const progressFile = 'cardladder-progress-all.json';
        const progressData = {
            total_cards: this.extractedCards.length,
            last_updated: timestamp,
            sources_processed: [...new Set(this.extractedCards.map(c => c.source_url))].length
        };
        
        fs.writeFileSync(progressFile, JSON.stringify(progressData, null, 2));
    }

    generateFinalReport() {
        console.log('\n📊 GENERATING FINAL CARD LADDER REPORT');
        console.log('=====================================');
        
        const report = {
            timestamp: new Date().toISOString(),
            platform: 'cardladder',
            extraction_method: 'comprehensive_pokemon_extraction',
            total_pokemon_cards: this.extractedCards.length,
            
            // Quality metrics
            cards_with_prices: this.extractedCards.filter(c => c.price).length,
            cards_with_images: this.extractedCards.filter(c => c.image_url).length,
            cards_with_grades: this.extractedCards.filter(c => c.grade).length,
            cards_with_urls: this.extractedCards.filter(c => c.card_url).length,
            cards_with_sets: this.extractedCards.filter(c => c.set).length,
            
            // Price analysis
            price_analysis: this.analyzePrices(),
            
            // Grading analysis
            grading_analysis: this.analyzeGrading(),
            
            // Set analysis
            set_analysis: this.analyzeSets(),
            
            // Year analysis
            year_analysis: this.analyzeYears(),
            
            // Condition analysis
            condition_analysis: this.analyzeConditions(),
            
            // Sample data
            sample_high_value: this.extractedCards
                .filter(c => c.price && this.parsePrice(c.price) > 100)
                .sort((a, b) => this.parsePrice(b.price) - this.parsePrice(a.price))
                .slice(0, 30),
                
            sample_graded_cards: this.extractedCards
                .filter(c => c.grade && c.grading_service)
                .sort((a, b) => b.grade - a.grade)
                .slice(0, 30),
                
            sample_recent: this.extractedCards.slice(-30)
        };
        
        // Save files
        fs.writeFileSync('cardladder-pokemon-report.json', JSON.stringify(report, null, 2));
        fs.writeFileSync('cardladder-pokemon-all-cards.json', JSON.stringify(this.extractedCards, null, 2));
        this.saveAsCSV();
        
        console.log(`\n🎉 CARD LADDER EXTRACTION COMPLETE!`);
        console.log(`================================`);
        console.log(`🎴 Total Pokemon Cards: ${report.total_pokemon_cards.toLocaleString()}`);
        console.log(`💰 Cards with Prices: ${report.cards_with_prices.toLocaleString()} (${(report.cards_with_prices/report.total_pokemon_cards*100).toFixed(1)}%)`);
        console.log(`🖼️ Cards with Images: ${report.cards_with_images.toLocaleString()} (${(report.cards_with_images/report.total_pokemon_cards*100).toFixed(1)}%)`);
        console.log(`🏆 Cards with Grades: ${report.cards_with_grades.toLocaleString()} (${(report.cards_with_grades/report.total_pokemon_cards*100).toFixed(1)}%)`);
        console.log(`🔗 Cards with URLs: ${report.cards_with_urls.toLocaleString()} (${(report.cards_with_urls/report.total_pokemon_cards*100).toFixed(1)}%)`);
        console.log(`🎯 Cards with Sets: ${report.cards_with_sets.toLocaleString()} (${(report.cards_with_sets/report.total_pokemon_cards*100).toFixed(1)}%)`);
        
        if (report.price_analysis.count > 0) {
            console.log(`💵 Price Range: $${report.price_analysis.min} - $${report.price_analysis.max.toLocaleString()}`);
            console.log(`📊 Average Price: $${report.price_analysis.average}`);
        }
        
        console.log(`\n📄 Files Generated:`);
        console.log(`   📊 Report: cardladder-pokemon-report.json`);
        console.log(`   📋 All Data: cardladder-pokemon-all-cards.json`);
        console.log(`   📈 CSV: cardladder-pokemon-cards.csv`);
    }

    analyzePrices() {
        const prices = this.extractedCards
            .map(card => this.parsePrice(card.price))
            .filter(price => price > 0)
            .sort((a, b) => a - b);
            
        if (prices.length === 0) return { count: 0 };
        
        return {
            count: prices.length,
            min: prices[0],
            max: prices[prices.length - 1],
            average: (prices.reduce((a, b) => a + b, 0) / prices.length).toFixed(2),
            median: prices[Math.floor(prices.length / 2)],
            percentile_95: prices[Math.floor(prices.length * 0.95)],
            over_100: prices.filter(p => p > 100).length,
            over_1000: prices.filter(p => p > 1000).length
        };
    }

    analyzeGrading() {
        const grading = {};
        this.extractedCards.forEach(card => {
            if (card.grading_service) {
                const service = card.grading_service.toUpperCase();
                if (!grading[service]) grading[service] = [];
                if (card.grade) grading[service].push(card.grade);
            }
        });
        
        Object.keys(grading).forEach(service => {
            const grades = grading[service];
            grading[service] = {
                count: grades.length,
                average: grades.length > 0 ? (grades.reduce((a, b) => a + b, 0) / grades.length).toFixed(2) : 0,
                grade_10_count: grades.filter(g => g === 10).length,
                grade_9_plus: grades.filter(g => g >= 9).length
            };
        });
        
        return grading;
    }

    analyzeSets() {
        const sets = {};
        this.extractedCards.forEach(card => {
            if (card.set) {
                const set = card.set.toLowerCase();
                sets[set] = (sets[set] || 0) + 1;
            }
        });
        
        return Object.entries(sets)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 20)
            .reduce((obj, [set, count]) => {
                obj[set] = count;
                return obj;
            }, {});
    }

    analyzeYears() {
        const years = {};
        this.extractedCards.forEach(card => {
            if (card.year) {
                years[card.year] = (years[card.year] || 0) + 1;
            }
        });
        
        return Object.entries(years)
            .sort(([a], [b]) => b - a) // Sort by year descending
            .reduce((obj, [year, count]) => {
                obj[year] = count;
                return obj;
            }, {});
    }

    analyzeConditions() {
        const conditions = {};
        this.extractedCards.forEach(card => {
            if (card.condition) {
                const condition = card.condition.toLowerCase();
                conditions[condition] = (conditions[condition] || 0) + 1;
            }
        });
        
        return Object.entries(conditions)
            .sort(([,a], [,b]) => b - a)
            .reduce((obj, [condition, count]) => {
                obj[condition] = count;
                return obj;
            }, {});
    }

    parsePrice(priceStr) {
        if (!priceStr) return 0;
        return parseFloat(priceStr.replace(/[$,]/g, '')) || 0;
    }

    saveAsCSV() {
        const headers = [
            'ID', 'Name', 'Price', 'Current_Value', 'Market_Value', 'Image_URL', 'Card_URL',
            'Grading_Service', 'Grade', 'Population', 'Set', 'Rarity', 'Condition', 'Year',
            'Source_URL', 'Extracted_At', 'Platform', 'Extraction_Method'
        ];
        
        let csvContent = headers.join(',') + '\n';
        
        this.extractedCards.forEach(card => {
            const row = [
                card.id || '',
                `"${(card.name || '').replace(/"/g, '""')}"`,
                card.price || '',
                card.current_value || '',
                card.market_value || '',
                card.image_url || '',
                card.card_url || '',
                card.grading_service || '',
                card.grade || '',
                card.population || '',
                card.set || '',
                card.rarity || '',
                card.condition || '',
                card.year || '',
                card.source_url || '',
                card.extracted_at || '',
                card.platform || '',
                card.extraction_method || ''
            ];
            csvContent += row.join(',') + '\n';
        });
        
        fs.writeFileSync('cardladder-pokemon-cards.csv', csvContent);
        console.log('   📊 CSV saved: cardladder-pokemon-cards.csv');
    }

    async delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async randomDelay(min, max) {
        const delay = Math.random() * (max - min) + min;
        await new Promise(resolve => setTimeout(resolve, delay));
    }
}

async function main() {
    console.log('🚀 LAUNCHING CARD LADDER POKEMON EXTRACTOR');
    console.log('==========================================');
    
    const extractor = new CardLadderExtractor();
    await extractor.extractAllPokemonData();
    
    console.log('\n🎉 CARD LADDER EXTRACTION MISSION COMPLETE!');
    console.log('===========================================');
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = CardLadderExtractor;
