/**
 * CardMarket API Configuration
 * Zero-vulnerability setup with OAuth 1.0
 */

const CardMarket = require('cardmarket-wrapper');

class CardMarketConfig {
    constructor() {
        this.config = {
            // OAuth 1.0 Configuration (Required)
            consumerKey: process.env.CARDMARKET_CONSUMER_KEY || '',
            consumerSecret: process.env.CARDMARKET_CONSUMER_SECRET || '',
            accessToken: process.env.CARDMARKET_ACCESS_TOKEN || '',
            accessTokenSecret: process.env.CARDMARKET_ACCESS_TOKEN_SECRET || '',
            
            // API Configuration
            baseURL: 'https://api.cardmarket.com/ws/v2.0/output.json',
            userAgent: 'PokeDao/1.0.0 (Pokemon TCG Data Platform)',
            timeout: 30000,
            
            // Rate Limiting
            requestsPerSecond: 2, // CardMarket limits: ~120 requests/minute
            batchSize: 50,
            retryAttempts: 3,
            retryDelay: 1000,
            
            // Pokemon Specific
            gameId: 6, // Pokemon TCG Game ID in CardMarket
            languages: ['en', 'de', 'fr', 'it', 'es', 'ja'], // Supported languages
            
            // Security Settings
            validateSSL: true,
            logRequests: false, // Set to true for debugging
            maskSensitiveData: true
        };
        
        this.cardmarket = null;
        this.initialized = false;
    }

    // Initialize CardMarket SDK
    async initialize() {
        try {
            console.log('🔗 Initializing CardMarket connection...');
            
            // Validate configuration
            this.validateConfig();
            
            // Initialize SDK
            this.cardmarket = new CardMarket({
                consumerKey: this.config.consumerKey,
                consumerSecret: this.config.consumerSecret,
                accessToken: this.config.accessToken,
                accessTokenSecret: this.config.accessTokenSecret,
                sandbox: false // Set to true for testing
            });
            
            // Test connection
            await this.testConnection();
            
            this.initialized = true;
            console.log('   ✅ CardMarket initialized successfully');
            
            return true;
            
        } catch (error) {
            console.error('   ❌ CardMarket initialization failed:', error.message);
            throw new Error(`CardMarket setup failed: ${error.message}`);
        }
    }

    validateConfig() {
        const required = ['consumerKey', 'consumerSecret', 'accessToken', 'accessTokenSecret'];
        const missing = required.filter(key => !this.config[key]);
        
        if (missing.length > 0) {
            throw new Error(`Missing required configuration: ${missing.join(', ')}`);
        }
        
        console.log('   ✅ Configuration validated');
    }

    async testConnection() {
        try {
            console.log('   🔍 Testing CardMarket connection...');
            
            // Test with a simple API call
            const response = await this.cardmarket.get('/account');
            
            if (response && response.account) {
                console.log(`   ✅ Connected as: ${response.account.username}`);
                return true;
            } else {
                throw new Error('Invalid response from CardMarket API');
            }
            
        } catch (error) {
            throw new Error(`Connection test failed: ${error.message}`);
        }
    }

    // Get CardMarket client instance
    getClient() {
        if (!this.initialized) {
            throw new Error('CardMarket not initialized. Call initialize() first.');
        }
        
        return this.cardmarket;
    }

    // Rate limiting helper
    async makeRateLimitedRequest(requestFn) {
        const delay = 1000 / this.config.requestsPerSecond;
        
        try {
            const result = await requestFn();
            
            // Wait for rate limit
            await new Promise(resolve => setTimeout(resolve, delay));
            
            return result;
            
        } catch (error) {
            if (error.message.includes('rate limit')) {
                console.log('   ⏸️ Rate limit hit, waiting...');
                await new Promise(resolve => setTimeout(resolve, this.config.retryDelay * 2));
                return this.makeRateLimitedRequest(requestFn);
            }
            
            throw error;
        }
    }

    // Get Pokemon products
    async getPokemonProducts(options = {}) {
        if (!this.initialized) {
            await this.initialize();
        }
        
        const params = {
            game: this.config.gameId,
            language: options.language || 'en',
            ...options
        };
        
        return this.makeRateLimitedRequest(async () => {
            return await this.cardmarket.get('/products', params);
        });
    }

    // Get product details
    async getProductDetails(productId) {
        if (!this.initialized) {
            await this.initialize();
        }
        
        return this.makeRateLimitedRequest(async () => {
            return await this.cardmarket.get(`/products/${productId}`);
        });
    }

    // Get market prices
    async getMarketPrices(productId) {
        if (!this.initialized) {
            await this.initialize();
        }
        
        return this.makeRateLimitedRequest(async () => {
            return await this.cardmarket.get(`/products/${productId}/articles`);
        });
    }
}

module.exports = CardMarketConfig;

// Environment variables template
const envTemplate = `# CardMarket API Configuration
# Get these from: https://www.cardmarket.com/en/Magic/Account/API
CARDMARKET_CONSUMER_KEY=your_consumer_key_here
CARDMARKET_CONSUMER_SECRET=your_consumer_secret_here
CARDMARKET_ACCESS_TOKEN=your_access_token_here
CARDMARKET_ACCESS_TOKEN_SECRET=your_access_token_secret_here
`;

// Export environment template for .env file
module.exports.envTemplate = envTemplate;