const axios = require('axios');
const fs = require('fs');

/**
 * TCGPlayer API Client
 * Direct API integration for Pokemon card data extraction
 * Bypasses HTML scraping for maximum efficiency and reliability
 */
class TCGPlayerAPIClient {
    constructor() {
        this.baseUrl = 'https://api.tcgplayer.com';
        this.webUrl = 'https://www.tcgplayer.com';
        this.apiKey = null; // Will try to discover or use public endpoints
        this.session = {
            startTime: new Date().toISOString(),
            totalRequests: 0,
            successfulRequests: 0,
            errors: [],
            discoveredEndpoints: [],
            pokemonData: []
        };
        
        // Default headers that mimic browser requests
        this.headers = {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
            'Accept': 'application/json, text/plain, */*',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate, br',
            'Referer': 'https://www.tcgplayer.com/',
            'Origin': 'https://www.tcgplayer.com'
        };
    }

    /**
     * Initialize API client and discover available endpoints
     */
    async initialize() {
        console.log('🚀 Initializing TCGPlayer API Client...');
        
        // Try to discover API structure first
        await this.discoverAPIStructure();
        
        // Check for Pokemon-specific endpoints
        await this.discoverPokemonEndpoints();
        
        console.log(`✅ API Client initialized with ${this.session.discoveredEndpoints.length} discovered endpoints`);
        return this.session.discoveredEndpoints;
    }

    /**
     * Discover API structure and available endpoints
     */
    async discoverAPIStructure() {
        console.log('🔍 Discovering TCGPlayer API structure...');
        
        const knownEndpoints = [
            // Categories and Products
            '/catalog/categories',
            '/catalog/products', 
            '/catalog/categories/{categoryId}/products',
            '/catalog/categories/{categoryId}/groups',
            
            // Pricing
            '/pricing/product/{productId}',
            '/pricing/group/{groupId}',
            '/pricing/sku/{skuId}',
            '/pricing/marketprice/{productId}',
            
            // Search and Listings
            '/search/products',
            '/search/autocomplete',
            '/inventory/products',
            '/inventory/availability',
            
            // Pokemon specific (discovered from site analysis)
            '/catalog/categories/3/products', // Pokemon category
            '/catalog/categories/3/groups',
            '/search/products?categoryId=3',
            
            // Versioned endpoints
            '/v1/catalog/categories',
            '/v1/catalog/products',
            '/v1/pricing/product',
            '/v2/catalog/categories',
            '/v2/catalog/products'
        ];

        for (const endpoint of knownEndpoints) {
            await this.testEndpoint(endpoint);
            await this.sleep(200); // Rate limiting
        }
    }

    /**
     * Discover Pokemon-specific API endpoints
     */
    async discoverPokemonEndpoints() {
        console.log('🎯 Discovering Pokemon-specific endpoints...');
        
        // Based on our site discovery, Pokemon is category ID 3
        const pokemonEndpoints = [
            '/catalog/categories/3/products?limit=100&offset=0',
            '/catalog/categories/3/groups?limit=100',
            '/search/products?categoryId=3&limit=100',
            '/pricing/group?groupId=1', // Test with sample group
            '/inventory/products?categoryId=3'
        ];

        for (const endpoint of pokemonEndpoints) {
            const result = await this.testEndpoint(endpoint);
            if (result && result.success && result.data) {
                console.log(`🎉 Found working Pokemon endpoint: ${endpoint}`);
                console.log(`📊 Sample data keys: ${Object.keys(result.data).join(', ')}`);
            }
        }
    }

    /**
     * Test an API endpoint to see if it works
     */
    async testEndpoint(endpoint) {
        this.session.totalRequests++;
        
        try {
            const url = `${this.baseUrl}${endpoint}`;
            console.log(`🔍 Testing: ${url}`);
            
            const response = await axios.get(url, {
                headers: this.headers,
                timeout: 10000,
                validateStatus: () => true // Don't throw on non-2xx status
            });

            const result = {
                endpoint,
                url,
                status: response.status,
                success: response.status >= 200 && response.status < 300,
                contentType: response.headers['content-type'],
                dataType: this.determineDataType(response.data),
                hasData: this.hasUsefulData(response.data),
                data: response.status < 300 ? response.data : null,
                error: response.status >= 400 ? response.statusText : null
            };

            if (result.success) {
                this.session.successfulRequests++;
                this.session.discoveredEndpoints.push(result);
                console.log(`✅ ${endpoint} - ${response.status} (${result.dataType})`);
            } else {
                console.log(`❌ ${endpoint} - ${response.status} ${response.statusText}`);
            }

            return result;

        } catch (error) {
            this.session.errors.push({
                endpoint,
                error: error.message,
                timestamp: new Date().toISOString()
            });
            console.log(`💥 ${endpoint} - ERROR: ${error.message}`);
            return { endpoint, success: false, error: error.message };
        }
    }

    /**
     * Extract all Pokemon products using the best available endpoint
     */
    async extractAllPokemonProducts() {
        console.log('🌾 Starting Pokemon product extraction via API...');
        
        const workingEndpoints = this.session.discoveredEndpoints.filter(e => 
            e.success && e.hasData && e.endpoint.includes('product')
        );

        if (workingEndpoints.length === 0) {
            console.error('❌ No working product endpoints found!');
            return [];
        }

        console.log(`🎯 Using ${workingEndpoints.length} working endpoints for extraction`);

        let allProducts = [];
        
        for (const endpointInfo of workingEndpoints) {
            console.log(`\n📡 Extracting from: ${endpointInfo.endpoint}`);
            
            try {
                const products = await this.extractFromEndpoint(endpointInfo);
                
                if (products && products.length > 0) {
                    console.log(`📦 Found ${products.length} products from ${endpointInfo.endpoint}`);
                    allProducts.push(...products);
                } else {
                    console.log(`⚠️  No products found from ${endpointInfo.endpoint}`);
                }
                
            } catch (error) {
                console.error(`💥 Error extracting from ${endpointInfo.endpoint}:`, error.message);
            }

            // Rate limiting between endpoints
            await this.sleep(1000);
        }

        // Remove duplicates based on product ID
        const uniqueProducts = this.deduplicateProducts(allProducts);
        
        console.log(`\n🎉 Total unique Pokemon products extracted: ${uniqueProducts.length}`);
        this.session.pokemonData = uniqueProducts;
        
        return uniqueProducts;
    }

    /**
     * Extract products from a specific endpoint with pagination
     */
    async extractFromEndpoint(endpointInfo) {
        const products = [];
        let offset = 0;
        let limit = 100;
        let hasMore = true;
        
        while (hasMore && offset < 10000) { // Safety limit
            try {
                const paginatedUrl = this.buildPaginatedUrl(endpointInfo.endpoint, offset, limit);
                
                console.log(`📄 Fetching page: offset=${offset}, limit=${limit}`);
                
                const response = await axios.get(`${this.baseUrl}${paginatedUrl}`, {
                    headers: this.headers,
                    timeout: 15000
                });

                if (response.status !== 200) {
                    console.log(`⚠️  Non-200 response: ${response.status}`);
                    break;
                }

                const pageProducts = this.extractProductsFromResponse(response.data);
                
                if (pageProducts.length === 0) {
                    console.log('📭 No more products found, ending pagination');
                    hasMore = false;
                } else {
                    products.push(...pageProducts);
                    console.log(`📦 Page extracted ${pageProducts.length} products (total: ${products.length})`);
                    
                    // Check if we got fewer than requested (likely last page)
                    if (pageProducts.length < limit) {
                        hasMore = false;
                    } else {
                        offset += limit;
                    }
                }

            } catch (error) {
                console.error(`💥 Pagination error at offset ${offset}:`, error.message);
                break;
            }

            // Rate limiting between pages
            await this.sleep(500);
        }

        return products;
    }

    /**
     * Build paginated URL for an endpoint
     */
    buildPaginatedUrl(endpoint, offset, limit) {
        const separator = endpoint.includes('?') ? '&' : '?';
        return `${endpoint}${separator}limit=${limit}&offset=${offset}`;
    }

    /**
     * Extract product data from API response
     */
    extractProductsFromResponse(data) {
        if (!data) return [];

        // Handle different response structures
        let products = [];

        if (Array.isArray(data)) {
            products = data;
        } else if (data.results && Array.isArray(data.results)) {
            products = data.results;
        } else if (data.data && Array.isArray(data.data)) {
            products = data.data;
        } else if (data.products && Array.isArray(data.products)) {
            products = data.products;
        } else if (data.items && Array.isArray(data.items)) {
            products = data.items;
        }

        // Transform products to standard format
        return products.map((product, index) => this.transformProduct(product, index));
    }

    /**
     * Transform product data to standardized format
     */
    transformProduct(product, index) {
        const transformed = {
            id: `tcgplayer_api_${product.productId || product.id || index}`,
            source: 'tcgplayer_api',
            externalId: product.productId || product.id,
            name: product.name || product.productName || product.title,
            cleanedName: product.cleanName || product.name,
            setName: product.groupName || product.setName || product.group,
            rarity: product.rarity,
            cardType: product.subTypeName || product.cardType,
            number: product.number || product.cardNumber,
            imageUrl: product.imageUrl || product.image,
            category: product.categoryName || 'Pokemon',
            categoryId: product.categoryId || 3,
            groupId: product.groupId,
            price: {
                market: product.marketPrice,
                low: product.lowPrice,
                mid: product.midPrice,
                high: product.highPrice,
                direct: product.directPrice,
                listing: product.listingPrice
            },
            availability: {
                totalListings: product.totalListings,
                inStock: product.inStock,
                sellable: product.sellable
            },
            metadata: {
                url: product.url || `https://www.tcgplayer.com/product/${product.productId}`,
                extendedData: product.extendedData,
                modifiedOn: product.modifiedOn,
                extractedAt: new Date().toISOString()
            },
            rawData: product // Keep original for debugging
        };

        return transformed;
    }

    /**
     * Remove duplicate products based on ID
     */
    deduplicateProducts(products) {
        const seen = new Set();
        return products.filter(product => {
            const key = product.externalId || product.name;
            if (seen.has(key)) {
                return false;
            }
            seen.add(key);
            return true;
        });
    }

    /**
     * Determine data type from response
     */
    determineDataType(data) {
        if (!data) return 'null';
        if (typeof data === 'string') return 'string';
        if (Array.isArray(data)) return `array[${data.length}]`;
        if (typeof data === 'object') return `object{${Object.keys(data).length}}`;
        return typeof data;
    }

    /**
     * Check if response contains useful data
     */
    hasUsefulData(data) {
        if (!data) return false;
        if (Array.isArray(data)) return data.length > 0;
        if (typeof data === 'object') return Object.keys(data).length > 0;
        return true;
    }

    /**
     * Save results to files
     */
    async saveResults() {
        const timestamp = Date.now();
        
        // Save API discovery results
        const discoveryFilename = `tcgplayer-api-discovery-${timestamp}.json`;
        const discoveryData = {
            session: this.session,
            discoveredEndpoints: this.session.discoveredEndpoints,
            summary: {
                totalEndpoints: this.session.discoveredEndpoints.length,
                successfulEndpoints: this.session.successfulRequests,
                errorCount: this.session.errors.length,
                successRate: this.session.successfulRequests / this.session.totalRequests
            }
        };
        
        fs.writeFileSync(discoveryFilename, JSON.stringify(discoveryData, null, 2));
        console.log(`💾 API discovery saved to: ${discoveryFilename}`);

        // Save Pokemon products if any were extracted
        if (this.session.pokemonData.length > 0) {
            const productsFilename = `tcgplayer-pokemon-products-${timestamp}.json`;
            const productsData = {
                metadata: {
                    extractedAt: new Date().toISOString(),
                    totalProducts: this.session.pokemonData.length,
                    source: 'tcgplayer_api',
                    extractionMethod: 'direct_api'
                },
                products: this.session.pokemonData
            };
            
            fs.writeFileSync(productsFilename, JSON.stringify(productsData, null, 2));
            console.log(`🎴 Pokemon products saved to: ${productsFilename}`);
        }

        return { discoveryFilename, productsFilename };
    }

    /**
     * Sleep utility
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Complete API extraction workflow
     */
    async runFullExtraction() {
        try {
            console.log('🚀 Starting TCGPlayer API Full Extraction...');
            
            // Initialize and discover endpoints
            await this.initialize();
            
            // Extract all Pokemon products
            const products = await this.extractAllPokemonProducts();
            
            // Save results
            await this.saveResults();
            
            console.log('\n🎉 TCGPlayer API Extraction Complete!');
            console.log(`📊 Summary:`);
            console.log(`   📡 API Endpoints Tested: ${this.session.totalRequests}`);
            console.log(`   ✅ Working Endpoints: ${this.session.successfulRequests}`);
            console.log(`   🎴 Pokemon Products: ${this.session.pokemonData.length}`);
            console.log(`   ⚠️  Errors: ${this.session.errors.length}`);
            
            return {
                success: true,
                products: this.session.pokemonData,
                endpoints: this.session.discoveredEndpoints,
                summary: {
                    totalProducts: this.session.pokemonData.length,
                    workingEndpoints: this.session.successfulRequests,
                    errors: this.session.errors.length
                }
            };
            
        } catch (error) {
            console.error('💥 Critical error in API extraction:', error);
            await this.saveResults(); // Save partial results
            return { success: false, error: error.message };
        }
    }

    /**
     * Quick test to validate API access
     */
    async quickTest() {
        console.log('🧪 Running quick API test...');
        
        const testEndpoints = [
            '/catalog/categories',
            '/catalog/categories/3/products?limit=5',
            '/search/products?categoryId=3&limit=5'
        ];

        let workingCount = 0;
        
        for (const endpoint of testEndpoints) {
            const result = await this.testEndpoint(endpoint);
            if (result.success) {
                workingCount++;
                if (result.data) {
                    console.log(`✅ ${endpoint} returned data:`, Object.keys(result.data));
                }
            }
        }

        console.log(`📊 Quick test results: ${workingCount}/${testEndpoints.length} endpoints working`);
        return workingCount > 0;
    }
}

// Main execution
async function main() {
    const client = new TCGPlayerAPIClient();
    
    const args = process.argv.slice(2);
    
    if (args.includes('--test')) {
        await client.quickTest();
    } else if (args.includes('--discovery')) {
        await client.initialize();
        await client.saveResults();
    } else {
        await client.runFullExtraction();
    }
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = TCGPlayerAPIClient;
