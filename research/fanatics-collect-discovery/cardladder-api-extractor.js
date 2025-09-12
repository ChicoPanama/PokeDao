#!/usr/bin/env node
/**
 * 🚀 CARD LADDER AGGRESSIVE API EXTRACTOR
 * =======================================
 * 
 * Direct API extraction from Card Ladder - bypassing browser entirely
 * Uses HTTP requests to target API endpoints and data sources
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const { URL } = require('url');

class CardLadderAPIExtractor {
    constructor() {
        this.extractedCards = [];
        this.baseUrl = 'https://www.cardladder.com';
        this.apiEndpoints = [];
        
        // Common API patterns to try
        this.apiPatterns = [
            '/api/cards',
            '/api/pokemon',
            '/api/search',
            '/api/products',
            '/api/listings',
            '/api/market',
            '/api/data',
            '/api/v1/cards',
            '/api/v2/cards',
            '/graphql',
            '/rest/cards',
            '/_next/data',
            '/data.json',
            '/cards.json',
            '/pokemon.json'
        ];

        // Search parameters to try
        this.searchParams = [
            'q=pokemon',
            'query=pokemon',
            'search=pokemon',
            'category=pokemon',
            'game=pokemon',
            'type=pokemon',
            'cards=pokemon'
        ];

        console.log('🚀 CARD LADDER AGGRESSIVE API EXTRACTOR');
        console.log('=======================================');
        console.log('💥 Direct API targeting - No browser needed!');
    }

    async extractAllData() {
        console.log('\n🔍 PHASE 1: API ENDPOINT DISCOVERY');
        console.log('==================================');
        
        // First discover available API endpoints
        await this.discoverAPIEndpoints();
        
        console.log('\n💥 PHASE 2: AGGRESSIVE DATA EXTRACTION');
        console.log('=====================================');
        
        // Extract from discovered endpoints
        await this.extractFromAPIs();
        
        // Try common web scraping endpoints
        await this.extractFromWebEndpoints();
        
        // Try sitemap and robots.txt
        await this.extractFromSitemap();
        
        console.log('\n📊 GENERATING FINAL REPORT');
        console.log('==========================');
        
        this.generateFinalReport();
        return this.extractedCards;
    }

    async discoverAPIEndpoints() {
        console.log('🕵️ Discovering Card Ladder API endpoints...');
        
        const discoveredEndpoints = [];
        
        // Try each API pattern
        for (const pattern of this.apiPatterns) {
            const endpoint = this.baseUrl + pattern;
            console.log(`📡 Testing: ${endpoint}`);
            
            try {
                const response = await this.makeRequest(endpoint);
                
                if (response && response.statusCode < 400) {
                    console.log(`   ✅ FOUND: ${endpoint} (${response.statusCode})`);
                    discoveredEndpoints.push({
                        url: endpoint,
                        status: response.statusCode,
                        contentType: response.headers['content-type'],
                        contentLength: response.headers['content-length'],
                        data: response.data
                    });
                    
                    // Save raw API response
                    const filename = `api-response-${pattern.replace(/[^a-zA-Z0-9]/g, '_')}.json`;
                    fs.writeFileSync(filename, JSON.stringify({
                        endpoint,
                        headers: response.headers,
                        data: response.data
                    }, null, 2));
                    
                } else {
                    console.log(`   ❌ ${endpoint} (${response?.statusCode || 'Failed'})`);
                }
                
            } catch (error) {
                console.log(`   ❌ ${endpoint} (Error: ${error.message})`);
            }
            
            await this.delay(500); // Rate limiting
        }
        
        // Try with search parameters
        for (const param of this.searchParams) {
            for (const pattern of this.apiPatterns.slice(0, 5)) { // Test top 5 patterns
                const endpoint = `${this.baseUrl}${pattern}?${param}`;
                console.log(`🔍 Testing with search: ${endpoint}`);
                
                try {
                    const response = await this.makeRequest(endpoint);
                    
                    if (response && response.statusCode < 400) {
                        console.log(`   ✅ FOUND SEARCH API: ${endpoint}`);
                        discoveredEndpoints.push({
                            url: endpoint,
                            status: response.statusCode,
                            contentType: response.headers['content-type'],
                            data: response.data
                        });
                    }
                    
                } catch (error) {
                    console.log(`   ❌ ${endpoint} (${error.message})`);
                }
                
                await this.delay(300);
            }
        }
        
        this.apiEndpoints = discoveredEndpoints;
        console.log(`\n🎯 DISCOVERED ${discoveredEndpoints.length} WORKING ENDPOINTS`);
        
        return discoveredEndpoints;
    }

    async extractFromAPIs() {
        console.log('💥 Extracting Pokemon data from APIs...');
        
        for (const endpoint of this.apiEndpoints) {
            console.log(`\n🎯 Processing API: ${endpoint.url}`);
            
            try {
                const pokemonCards = this.extractPokemonFromAPIData(endpoint.data, endpoint.url);
                
                if (pokemonCards.length > 0) {
                    console.log(`   ✅ Extracted ${pokemonCards.length} Pokemon cards`);
                    this.extractedCards.push(...pokemonCards);
                    
                    // Save batch
                    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                    const filename = `cardladder-api-batch-${timestamp}.json`;
                    fs.writeFileSync(filename, JSON.stringify({
                        source: endpoint.url,
                        cards: pokemonCards,
                        extracted_at: timestamp
                    }, null, 2));
                    
                } else {
                    console.log(`   ❌ No Pokemon cards found in API response`);
                }
                
            } catch (error) {
                console.log(`   ❌ Error processing ${endpoint.url}: ${error.message}`);
            }
        }
    }

    extractPokemonFromAPIData(data, sourceUrl) {
        const cards = [];
        
        try {
            let jsonData;
            
            // Parse data if it's a string
            if (typeof data === 'string') {
                jsonData = JSON.parse(data);
            } else {
                jsonData = data;
            }
            
            // Strategy 1: Look for direct card arrays
            const cardArrays = this.findArraysInObject(jsonData);
            
            for (const array of cardArrays) {
                for (const item of array) {
                    if (this.isPokemonCard(item)) {
                        const card = this.normalizeCardData(item, sourceUrl);
                        if (card) cards.push(card);
                    }
                }
            }
            
            // Strategy 2: Look for nested Pokemon data
            const pokemonData = this.findPokemonInObject(jsonData);
            
            for (const item of pokemonData) {
                const card = this.normalizeCardData(item, sourceUrl);
                if (card) cards.push(card);
            }
            
            // Strategy 3: Search by key patterns
            const searchResults = this.searchObjectByPatterns(jsonData, [
                'pokemon', 'card', 'listing', 'product', 'item', 'result'
            ]);
            
            for (const item of searchResults) {
                if (this.isPokemonCard(item)) {
                    const card = this.normalizeCardData(item, sourceUrl);
                    if (card) cards.push(card);
                }
            }
            
        } catch (error) {
            console.log(`   ⚠️ JSON parsing error: ${error.message}`);
            
            // Fallback: treat as text and extract patterns
            const textData = typeof data === 'string' ? data : JSON.stringify(data);
            const textCards = this.extractPokemonFromText(textData, sourceUrl);
            cards.push(...textCards);
        }
        
        // Remove duplicates
        const uniqueCards = this.removeDuplicates(cards);
        
        return uniqueCards;
    }

    findArraysInObject(obj, arrays = []) {
        if (Array.isArray(obj)) {
            arrays.push(obj);
        } else if (typeof obj === 'object' && obj !== null) {
            for (const key in obj) {
                this.findArraysInObject(obj[key], arrays);
            }
        }
        return arrays;
    }

    findPokemonInObject(obj, results = []) {
        if (typeof obj === 'object' && obj !== null) {
            // Check if current object has Pokemon indicators
            const objStr = JSON.stringify(obj).toLowerCase();
            if (objStr.includes('pokemon') || objStr.includes('pikachu') || objStr.includes('charizard')) {
                results.push(obj);
            }
            
            // Recurse into object properties
            for (const key in obj) {
                if (key.toLowerCase().includes('pokemon') || 
                    key.toLowerCase().includes('card') ||
                    key.toLowerCase().includes('tcg')) {
                    
                    if (Array.isArray(obj[key])) {
                        results.push(...obj[key]);
                    } else {
                        results.push(obj[key]);
                    }
                }
                
                this.findPokemonInObject(obj[key], results);
            }
        }
        return results;
    }

    searchObjectByPatterns(obj, patterns, results = []) {
        if (typeof obj === 'object' && obj !== null) {
            for (const key in obj) {
                const keyLower = key.toLowerCase();
                
                if (patterns.some(pattern => keyLower.includes(pattern))) {
                    if (Array.isArray(obj[key])) {
                        results.push(...obj[key]);
                    } else {
                        results.push(obj[key]);
                    }
                }
                
                this.searchObjectByPatterns(obj[key], patterns, results);
            }
        }
        return results;
    }

    isPokemonCard(item) {
        if (!item || typeof item !== 'object') return false;
        
        const itemStr = JSON.stringify(item).toLowerCase();
        
        // Check for Pokemon indicators
        const pokemonIndicators = [
            'pokemon', 'pikachu', 'charizard', 'blastoise', 'venusaur', 
            'mewtwo', 'mew', 'tcg', 'trading card game'
        ];
        
        const hasPokemon = pokemonIndicators.some(indicator => itemStr.includes(indicator));
        
        // Check for card indicators
        const cardIndicators = ['card', 'psa', 'bgs', 'cgc', 'holo', 'rare'];
        const hasCard = cardIndicators.some(indicator => itemStr.includes(indicator));
        
        // Check for price indicators
        const hasPrice = itemStr.includes('$') || itemStr.includes('price') || itemStr.includes('value');
        
        return hasPokemon && (hasCard || hasPrice);
    }

    normalizeCardData(item, sourceUrl) {
        if (!item || typeof item !== 'object') return null;
        
        try {
            const card = {
                id: `cardladder-api-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                source_url: sourceUrl,
                extraction_method: 'api_extraction',
                platform: 'cardladder',
                extracted_at: new Date().toISOString(),
                raw_data: item
            };
            
            // Extract name (try multiple field names)
            const nameFields = ['name', 'title', 'card_name', 'product_name', 'cardName', 'productTitle'];
            for (const field of nameFields) {
                if (item[field] && typeof item[field] === 'string' && item[field].trim().length > 0) {
                    card.name = item[field].trim();
                    break;
                }
            }
            
            // Extract price (try multiple field names)
            const priceFields = ['price', 'current_price', 'market_price', 'value', 'cost', 'amount', 'currentPrice', 'marketValue'];
            for (const field of priceFields) {
                if (item[field]) {
                    if (typeof item[field] === 'number') {
                        card.price = `$${item[field]}`;
                        card.current_value = item[field];
                    } else if (typeof item[field] === 'string' && (item[field].includes('$') || /^\d+\.?\d*$/.test(item[field]))) {
                        card.price = item[field];
                        card.current_value = parseFloat(item[field].replace(/[$,]/g, ''));
                    }
                    break;
                }
            }
            
            // Extract image URL
            const imageFields = ['image', 'image_url', 'imageUrl', 'photo', 'picture', 'thumbnail', 'img'];
            for (const field of imageFields) {
                if (item[field] && typeof item[field] === 'string' && item[field].includes('http')) {
                    card.image_url = item[field];
                    break;
                }
            }
            
            // Extract card URL
            const urlFields = ['url', 'link', 'href', 'card_url', 'product_url', 'cardUrl'];
            for (const field of urlFields) {
                if (item[field] && typeof item[field] === 'string') {
                    card.card_url = item[field].startsWith('http') ? item[field] : `https://www.cardladder.com${item[field]}`;
                    break;
                }
            }
            
            // Extract grading info
            const gradingFields = ['grade', 'grading_service', 'gradingService', 'certification'];
            for (const field of gradingFields) {
                if (item[field]) {
                    card.grade = item[field];
                    break;
                }
            }
            
            // Extract set info
            const setFields = ['set', 'set_name', 'setName', 'series', 'collection'];
            for (const field of setFields) {
                if (item[field] && typeof item[field] === 'string') {
                    card.set = item[field];
                    break;
                }
            }
            
            // Extract rarity
            const rarityFields = ['rarity', 'type', 'card_type', 'cardType'];
            for (const field of rarityFields) {
                if (item[field] && typeof item[field] === 'string') {
                    card.rarity = item[field];
                    break;
                }
            }
            
            // Extract condition
            const conditionFields = ['condition', 'state', 'quality'];
            for (const field of conditionFields) {
                if (item[field] && typeof item[field] === 'string') {
                    card.condition = item[field];
                    break;
                }
            }
            
            // Only return if we have meaningful data
            if (card.name || card.price || card.image_url) {
                return card;
            }
            
        } catch (error) {
            console.log(`   ⚠️ Error normalizing card data: ${error.message}`);
        }
        
        return null;
    }

    extractPokemonFromText(text, sourceUrl) {
        const cards = [];
        
        try {
            // Look for JSON objects in text
            const jsonMatches = text.match(/\{[^{}]*"[^"]*pokemon[^"]*"[^{}]*\}/gi) || [];
            
            jsonMatches.forEach((jsonStr, index) => {
                try {
                    const obj = JSON.parse(jsonStr);
                    if (this.isPokemonCard(obj)) {
                        const card = this.normalizeCardData(obj, sourceUrl);
                        if (card) {
                            card.id = `cardladder-text-${Date.now()}-${index}`;
                            cards.push(card);
                        }
                    }
                } catch (e) {
                    // Continue if JSON parsing fails
                }
            });
            
            // Look for price patterns with Pokemon
            const pricePatterns = [
                /pokemon[^$]*\$[\d,]+\.?\d*/gi,
                /\$[\d,]+\.?\d*[^$]*pokemon/gi,
                /(pikachu|charizard|blastoise)[^$]*\$[\d,]+\.?\d*/gi
            ];
            
            pricePatterns.forEach((pattern, patternIndex) => {
                const matches = text.match(pattern) || [];
                matches.forEach((match, index) => {
                    const priceMatch = match.match(/\$[\d,]+\.?\d*/);
                    if (priceMatch) {
                        cards.push({
                            id: `cardladder-pattern-${patternIndex}-${Date.now()}-${index}`,
                            name: match.substring(0, 100).trim(),
                            price: priceMatch[0],
                            current_value: parseFloat(priceMatch[0].replace(/[$,]/g, '')),
                            source_url: sourceUrl,
                            extraction_method: 'text_pattern',
                            platform: 'cardladder',
                            extracted_at: new Date().toISOString()
                        });
                    }
                });
            });
            
        } catch (error) {
            console.log(`   ⚠️ Text extraction error: ${error.message}`);
        }
        
        return cards;
    }

    async extractFromWebEndpoints() {
        console.log('\n🌐 Extracting from web endpoints...');
        
        const webEndpoints = [
            '/search?q=pokemon',
            '/pokemon',
            '/cards/pokemon',
            '/category/pokemon-tcg',
            '/browse/pokemon',
            '/',
            '/cards'
        ];
        
        for (const endpoint of webEndpoints) {
            console.log(`🌐 Processing: ${this.baseUrl}${endpoint}`);
            
            try {
                const response = await this.makeRequest(this.baseUrl + endpoint);
                
                if (response && response.data) {
                    // Extract data from HTML/JSON
                    const webCards = this.extractPokemonFromHTML(response.data, this.baseUrl + endpoint);
                    
                    if (webCards.length > 0) {
                        console.log(`   ✅ Found ${webCards.length} Pokemon cards`);
                        this.extractedCards.push(...webCards);
                    }
                }
                
            } catch (error) {
                console.log(`   ❌ Error: ${error.message}`);
            }
            
            await this.delay(1000);
        }
    }

    extractPokemonFromHTML(html, sourceUrl) {
        const cards = [];
        
        try {
            // Look for JSON-LD data
            const jsonLdMatches = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([^<]+)<\/script>/gi) || [];
            
            jsonLdMatches.forEach(match => {
                try {
                    const jsonStr = match.replace(/<script[^>]*>|<\/script>/gi, '');
                    const jsonData = JSON.parse(jsonStr);
                    
                    const jsonCards = this.extractPokemonFromAPIData(jsonData, sourceUrl);
                    cards.push(...jsonCards);
                    
                } catch (e) {
                    // Continue if parsing fails
                }
            });
            
            // Look for inline JavaScript data
            const scriptMatches = html.match(/<script[^>]*>([^<]*(?:pokemon|card|tcg)[^<]*)<\/script>/gi) || [];
            
            scriptMatches.forEach((script, index) => {
                try {
                    const scriptContent = script.replace(/<script[^>]*>|<\/script>/gi, '');
                    
                    // Look for variable assignments with Pokemon data
                    const varMatches = scriptContent.match(/(?:var|let|const)\s+\w+\s*=\s*(\{[^}]*pokemon[^}]*\}|\[[^\]]*pokemon[^\]]*\])/gi) || [];
                    
                    varMatches.forEach(varMatch => {
                        try {
                            const dataMatch = varMatch.match(/=\s*(.+)$/);
                            if (dataMatch) {
                                const data = JSON.parse(dataMatch[1].replace(/;$/, ''));
                                const scriptCards = this.extractPokemonFromAPIData(data, sourceUrl);
                                cards.push(...scriptCards);
                            }
                        } catch (e) {
                            // Continue if parsing fails
                        }
                    });
                    
                } catch (e) {
                    // Continue if script parsing fails
                }
            });
            
            // Look for data attributes with Pokemon info
            const dataMatches = html.match(/data-[^=]*=["'][^"']*pokemon[^"']*["']/gi) || [];
            
            dataMatches.forEach(dataAttr => {
                try {
                    const valueMatch = dataAttr.match(/=["']([^"']+)["']/);
                    if (valueMatch) {
                        const value = valueMatch[1];
                        if (value.startsWith('{') || value.startsWith('[')) {
                            const data = JSON.parse(value);
                            const attrCards = this.extractPokemonFromAPIData(data, sourceUrl);
                            cards.push(...attrCards);
                        }
                    }
                } catch (e) {
                    // Continue if parsing fails
                }
            });
            
            // Extract price and name patterns from HTML text
            const textContent = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');
            const htmlCards = this.extractPokemonFromText(textContent, sourceUrl);
            cards.push(...htmlCards);
            
        } catch (error) {
            console.log(`   ⚠️ HTML extraction error: ${error.message}`);
        }
        
        return this.removeDuplicates(cards);
    }

    async extractFromSitemap() {
        console.log('\n🗺️ Checking sitemap and robots.txt...');
        
        const sitemapUrls = [
            '/sitemap.xml',
            '/sitemap_index.xml',
            '/robots.txt'
        ];
        
        for (const sitemapUrl of sitemapUrls) {
            try {
                console.log(`📋 Checking: ${this.baseUrl}${sitemapUrl}`);
                
                const response = await this.makeRequest(this.baseUrl + sitemapUrl);
                
                if (response && response.data) {
                    // Extract Pokemon-related URLs from sitemap
                    const pokemonUrls = this.extractPokemonUrls(response.data);
                    
                    console.log(`   ✅ Found ${pokemonUrls.length} Pokemon URLs`);
                    
                    // Process a subset of Pokemon URLs
                    for (const url of pokemonUrls.slice(0, 10)) {
                        console.log(`   🎯 Processing Pokemon URL: ${url}`);
                        
                        try {
                            const pageResponse = await this.makeRequest(url);
                            if (pageResponse && pageResponse.data) {
                                const pageCards = this.extractPokemonFromHTML(pageResponse.data, url);
                                this.extractedCards.push(...pageCards);
                            }
                        } catch (error) {
                            console.log(`     ❌ Error processing ${url}: ${error.message}`);
                        }
                        
                        await this.delay(500);
                    }
                }
                
            } catch (error) {
                console.log(`   ❌ Error processing ${sitemapUrl}: ${error.message}`);
            }
        }
    }

    extractPokemonUrls(sitemapContent) {
        const urls = [];
        
        try {
            // Extract URLs from sitemap XML
            const urlMatches = sitemapContent.match(/<loc>([^<]+)<\/loc>/gi) || [];
            
            urlMatches.forEach(match => {
                const url = match.replace(/<\/?loc>/gi, '');
                if (url.toLowerCase().includes('pokemon') || 
                    url.toLowerCase().includes('card') ||
                    url.toLowerCase().includes('tcg')) {
                    urls.push(url);
                }
            });
            
            // Also check robots.txt for Pokemon paths
            if (sitemapContent.includes('User-agent')) {
                const pathMatches = sitemapContent.match(/\/[^\s]*(?:pokemon|card|tcg)[^\s]*/gi) || [];
                pathMatches.forEach(path => {
                    urls.push(this.baseUrl + path);
                });
            }
            
        } catch (error) {
            console.log(`   ⚠️ Sitemap parsing error: ${error.message}`);
        }
        
        return [...new Set(urls)]; // Remove duplicates
    }

    removeDuplicates(cards) {
        const seen = new Set();
        return cards.filter(card => {
            const key = `${card.name}_${card.price}_${card.image_url}`.toLowerCase();
            if (seen.has(key)) {
                return false;
            }
            seen.add(key);
            return true;
        });
    }

    makeRequest(url) {
        return new Promise((resolve, reject) => {
            const urlObj = new URL(url);
            const options = {
                hostname: urlObj.hostname,
                port: urlObj.protocol === 'https:' ? 443 : 80,
                path: urlObj.pathname + urlObj.search,
                method: 'GET',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'application/json, text/html, application/xhtml+xml, application/xml;q=0.9, image/webp, */*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.5',
                    'Accept-Encoding': 'gzip, deflate, br',
                    'Connection': 'keep-alive',
                    'Upgrade-Insecure-Requests': '1',
                    'Cache-Control': 'no-cache',
                    'Pragma': 'no-cache'
                },
                timeout: 15000
            };

            const client = urlObj.protocol === 'https:' ? https : http;
            
            const req = client.request(options, (res) => {
                let data = '';
                
                res.on('data', (chunk) => {
                    data += chunk;
                });
                
                res.on('end', () => {
                    resolve({
                        statusCode: res.statusCode,
                        headers: res.headers,
                        data: data
                    });
                });
            });

            req.on('error', (error) => {
                reject(error);
            });

            req.on('timeout', () => {
                req.destroy();
                reject(new Error('Request timeout'));
            });

            req.end();
        });
    }

    generateFinalReport() {
        const report = {
            timestamp: new Date().toISOString(),
            platform: 'cardladder',
            extraction_method: 'aggressive_api_extraction',
            total_pokemon_cards: this.extractedCards.length,
            
            // Extraction sources
            api_endpoints_discovered: this.apiEndpoints.length,
            extraction_sources: [...new Set(this.extractedCards.map(c => c.source_url))],
            
            // Data quality
            cards_with_prices: this.extractedCards.filter(c => c.price).length,
            cards_with_images: this.extractedCards.filter(c => c.image_url).length,
            cards_with_urls: this.extractedCards.filter(c => c.card_url).length,
            cards_with_grades: this.extractedCards.filter(c => c.grade).length,
            
            // Analysis
            price_analysis: this.analyzePrices(),
            extraction_methods: this.analyzeExtractionMethods(),
            
            // Samples
            sample_high_value: this.extractedCards
                .filter(c => c.current_value && c.current_value > 50)
                .sort((a, b) => (b.current_value || 0) - (a.current_value || 0))
                .slice(0, 20),
                
            sample_recent: this.extractedCards.slice(-20),
            
            // API Discovery Results
            discovered_endpoints: this.apiEndpoints.map(ep => ({
                url: ep.url,
                status: ep.status,
                content_type: ep.contentType
            }))
        };
        
        // Save files
        fs.writeFileSync('cardladder-api-extraction-report.json', JSON.stringify(report, null, 2));
        fs.writeFileSync('cardladder-api-all-cards.json', JSON.stringify(this.extractedCards, null, 2));
        this.saveAsCSV();
        
        console.log(`\n🎉 CARD LADDER API EXTRACTION COMPLETE!`);
        console.log(`====================================`);
        console.log(`🚀 Extraction Method: Aggressive API Targeting`);
        console.log(`🎴 Total Pokemon Cards: ${report.total_pokemon_cards.toLocaleString()}`);
        console.log(`📡 API Endpoints Discovered: ${report.api_endpoints_discovered}`);
        console.log(`💰 Cards with Prices: ${report.cards_with_prices.toLocaleString()}`);
        console.log(`🖼️ Cards with Images: ${report.cards_with_images.toLocaleString()}`);
        console.log(`🔗 Cards with URLs: ${report.cards_with_urls.toLocaleString()}`);
        
        if (report.price_analysis.count > 0) {
            console.log(`💵 Price Range: $${report.price_analysis.min} - $${report.price_analysis.max.toLocaleString()}`);
        }
        
        console.log(`\n📄 Files Generated:`);
        console.log(`   📊 API Report: cardladder-api-extraction-report.json`);
        console.log(`   📋 All Cards: cardladder-api-all-cards.json`);
        console.log(`   📈 CSV Export: cardladder-api-cards.csv`);
        
        // Show discovered endpoints
        if (this.apiEndpoints.length > 0) {
            console.log(`\n🔍 DISCOVERED API ENDPOINTS:`);
            this.apiEndpoints.forEach((ep, index) => {
                console.log(`   ${index + 1}. ${ep.url} (${ep.status})`);
            });
        }
    }

    analyzePrices() {
        const prices = this.extractedCards
            .map(card => card.current_value || this.parsePrice(card.price))
            .filter(price => price > 0)
            .sort((a, b) => a - b);
            
        if (prices.length === 0) return { count: 0 };
        
        return {
            count: prices.length,
            min: prices[0],
            max: prices[prices.length - 1],
            average: (prices.reduce((a, b) => a + b, 0) / prices.length).toFixed(2),
            median: prices[Math.floor(prices.length / 2)]
        };
    }

    analyzeExtractionMethods() {
        const methods = {};
        this.extractedCards.forEach(card => {
            const method = card.extraction_method || 'unknown';
            methods[method] = (methods[method] || 0) + 1;
        });
        return methods;
    }

    parsePrice(priceStr) {
        if (!priceStr) return 0;
        return parseFloat(priceStr.replace(/[$,]/g, '')) || 0;
    }

    saveAsCSV() {
        const headers = [
            'ID', 'Name', 'Price', 'Current_Value', 'Image_URL', 'Card_URL',
            'Grade', 'Set', 'Rarity', 'Condition', 'Source_URL', 'Extraction_Method', 
            'Platform', 'Extracted_At'
        ];
        
        let csvContent = headers.join(',') + '\n';
        
        this.extractedCards.forEach(card => {
            const row = [
                card.id || '',
                `"${(card.name || '').replace(/"/g, '""')}"`,
                card.price || '',
                card.current_value || '',
                card.image_url || '',
                card.card_url || '',
                card.grade || '',
                card.set || '',
                card.rarity || '',
                card.condition || '',
                card.source_url || '',
                card.extraction_method || '',
                card.platform || '',
                card.extracted_at || ''
            ];
            csvContent += row.join(',') + '\n';
        });
        
        fs.writeFileSync('cardladder-api-cards.csv', csvContent);
    }

    async delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

async function main() {
    console.log('💥 LAUNCHING CARD LADDER AGGRESSIVE API EXTRACTOR');
    console.log('================================================');
    console.log('🎯 Target: Card Ladder Pokemon Data');
    console.log('🚀 Method: Direct API & Data Source Targeting');
    console.log('⚡ Mode: Aggressive Extraction');
    
    const extractor = new CardLadderAPIExtractor();
    await extractor.extractAllData();
    
    console.log('\n🎉 AGGRESSIVE API EXTRACTION COMPLETE!');
    console.log('=====================================');
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = CardLadderAPIExtractor;
