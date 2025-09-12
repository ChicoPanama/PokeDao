/**
 * CardMarket Alternative Access - Public Marketplace Explorer
 * Safe exploration of publicly available CardMarket data
 */

const https = require('https');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

class CardMarketPublicExplorer {
    constructor() {
        this.baseUrl = 'https://www.cardmarket.com';
        this.results = {
            timestamp: new Date().toISOString(),
            publicAccess: {},
            pokemonPages: {},
            marketplaceStructure: {},
            safeExtractionPossible: false
        };
    }

    async checkPublicAccess() {
        console.log('🌐 Checking CardMarket public marketplace access...');
        
        const browser = await puppeteer.launch({ 
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        
        try {
            const page = await browser.newPage();
            
            // Set realistic headers
            await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
            
            // Check main marketplace
            console.log('🔍 Testing: CardMarket homepage');
            const mainResponse = await page.goto('https://www.cardmarket.com/en/Trading-Cards', {
                waitUntil: 'networkidle0',
                timeout: 30000
            });
            
            this.results.publicAccess.homepage = {
                accessible: mainResponse.status() === 200,
                statusCode: mainResponse.status(),
                requiresLogin: await page.$('.login-form, .signin, .auth-required') !== null,
                hasGamesList: await page.$('a[href*="Pokemon"], a[href*="pokemon"]') !== null
            };
            
            // Look for Pokemon section
            console.log('🎮 Searching for Pokemon section...');
            const pokemonLinks = await page.evaluate(() => {
                const links = Array.from(document.querySelectorAll('a[href*="Pokemon"], a[href*="pokemon"]'));
                return links.map(link => ({
                    text: link.textContent.trim(),
                    href: link.href
                })).slice(0, 5);
            });
            
            this.results.pokemonPages.linksFound = pokemonLinks;
            
            if (pokemonLinks.length > 0) {
                console.log(`✅ Found ${pokemonLinks.length} Pokemon-related links`);
                
                // Try to access Pokemon marketplace
                const pokemonLink = pokemonLinks[0];
                console.log(`🔍 Testing Pokemon page: ${pokemonLink.href}`);
                
                const pokemonResponse = await page.goto(pokemonLink.href, {
                    waitUntil: 'networkidle0',
                    timeout: 30000
                });
                
                this.results.pokemonPages.mainPage = {
                    accessible: pokemonResponse.status() === 200,
                    statusCode: pokemonResponse.status(),
                    hasProducts: await page.$('.product, .article, .card-item') !== null,
                    hasSearch: await page.$('input[type="search"], .search-input') !== null,
                    requiresAuth: await page.$('.login-required, .auth-wall') !== null
                };
                
                // Check if we can see product listings
                if (this.results.pokemonPages.mainPage.hasProducts) {
                    console.log('🎯 Pokemon products visible - analyzing structure...');
                    
                    const productInfo = await page.evaluate(() => {
                        const products = Array.from(document.querySelectorAll('.product, .article, .card-item'));
                        return products.slice(0, 3).map(product => ({
                            text: product.textContent.trim().substring(0, 100),
                            classes: product.className,
                            hasPrice: !!product.querySelector('.price, [class*="price"]'),
                            hasName: !!product.querySelector('.name, .title, [class*="name"]')
                        }));
                    });
                    
                    this.results.marketplaceStructure.sampleProducts = productInfo;
                    this.results.safeExtractionPossible = productInfo.length > 0;
                }
            }
            
        } catch (error) {
            console.error(`❌ Public access check failed: ${error.message}`);
            this.results.publicAccess.error = error.message;
        } finally {
            await browser.close();
        }
    }

    async testSearchFunctionality() {
        if (!this.results.safeExtractionPossible) {
            console.log('⚠️ Skipping search test - no public access detected');
            return;
        }

        console.log('🔍 Testing CardMarket search functionality...');
        
        const browser = await puppeteer.launch({ 
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        
        try {
            const page = await browser.newPage();
            await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
            
            // Go to Pokemon page
            const pokemonLink = this.results.pokemonPages.linksFound[0];
            await page.goto(pokemonLink.href, { waitUntil: 'networkidle0' });
            
            // Look for search input
            const searchInput = await page.$('input[type="search"], .search-input, input[name*="search"]');
            
            if (searchInput) {
                console.log('✅ Search functionality found - testing with "Charizard"');
                
                await searchInput.type('Charizard');
                await Promise.race([
                    page.keyboard.press('Enter'),
                    page.click('button[type="submit"], .search-button')
                ]);
                
                await page.waitForTimeout(3000);
                
                const searchResults = await page.evaluate(() => {
                    const results = Array.from(document.querySelectorAll('.product, .article, .card-item, .search-result'));
                    return {
                        count: results.length,
                        hasResults: results.length > 0,
                        sampleTitles: results.slice(0, 3).map(r => r.textContent.trim().substring(0, 50))
                    };
                });
                
                this.results.pokemonPages.searchTest = searchResults;
                console.log(`📊 Search results: ${searchResults.count} items found`);
            } else {
                console.log('⚠️ No search input found');
                this.results.pokemonPages.searchTest = { error: 'No search input found' };
            }
            
        } catch (error) {
            console.error(`❌ Search test failed: ${error.message}`);
            this.results.pokemonPages.searchTest = { error: error.message };
        } finally {
            await browser.close();
        }
    }

    generateAlternativeReport() {
        console.log('\n📋 GENERATING ALTERNATIVE ACCESS REPORT');
        
        const canAccessPublic = this.results.publicAccess.homepage?.accessible;
        const pokemonAvailable = this.results.pokemonPages.linksFound?.length > 0;
        const productsVisible = this.results.marketplaceStructure.sampleProducts?.length > 0;
        
        let accessLevel = 'NONE';
        if (canAccessPublic && pokemonAvailable && productsVisible) {
            accessLevel = 'FULL_PUBLIC';
        } else if (canAccessPublic && pokemonAvailable) {
            accessLevel = 'LIMITED_PUBLIC';
        } else if (canAccessPublic) {
            accessLevel = 'HOMEPAGE_ONLY';
        }
        
        this.results.alternativeAssessment = {
            publicAccessLevel: accessLevel,
            canExtractWithoutAuth: accessLevel === 'FULL_PUBLIC',
            recommendBrowserScraping: accessLevel !== 'NONE',
            nextSteps: this.getNextSteps(accessLevel)
        };
    }

    getNextSteps(accessLevel) {
        switch (accessLevel) {
            case 'FULL_PUBLIC':
                return [
                    'Implement browser-based Pokemon card extraction',
                    'Use Puppeteer with stealth plugin for respectful scraping',
                    'Focus on popular cards (Charizard, Base Set, etc.)',
                    'Implement proper delays and rate limiting'
                ];
            case 'LIMITED_PUBLIC':
                return [
                    'Limited public access available',
                    'Consider hybrid approach: browse publicly, API for details',
                    'Focus on card discovery rather than pricing data'
                ];
            case 'HOMEPAGE_ONLY':
                return [
                    'Very limited public access',
                    'Recommend pursuing official API route',
                    'Consider alternative Pokemon data sources'
                ];
            default:
                return [
                    'No public access available',
                    'Must use official API with authentication',
                    'Skip CardMarket until proper credentials obtained'
                ];
        }
    }

    async runAlternativeAnalysis() {
        console.log('🔍 Starting CardMarket Alternative Access Analysis...\n');
        
        try {
            await this.checkPublicAccess();
            await this.testSearchFunctionality();
            this.generateAlternativeReport();
            
            // Save results
            const filename = `cardmarket-alternative-analysis-${Date.now()}.json`;
            const fs = require('fs');
            fs.writeFileSync(filename, JSON.stringify(this.results, null, 2));
            
            console.log('\n' + '='.repeat(60));
            console.log('🌐 CARDMARKET ALTERNATIVE ACCESS ANALYSIS');
            console.log('='.repeat(60));
            console.log(`📊 Public Access Level: ${this.results.alternativeAssessment.publicAccessLevel}`);
            console.log(`🎯 Can Extract Without Auth: ${this.results.alternativeAssessment.canExtractWithoutAuth ? 'YES' : 'NO'}`);
            console.log(`🤖 Recommend Browser Scraping: ${this.results.alternativeAssessment.recommendBrowserScraping ? 'YES' : 'NO'}`);
            
            console.log('\n📋 RECOMMENDED NEXT STEPS:');
            this.results.alternativeAssessment.nextSteps.forEach((step, i) => {
                console.log(`${i + 1}. ${step}`);
            });
            
            console.log(`\n📄 Full report: ${filename}`);
            console.log('='.repeat(60));
            
            return this.results;
            
        } catch (error) {
            console.error(`❌ Alternative analysis failed: ${error.message}`);
            throw error;
        }
    }
}

// Execute analysis
async function runAlternativeAnalysis() {
    const explorer = new CardMarketPublicExplorer();
    await explorer.runAlternativeAnalysis();
}

if (require.main === module) {
    runAlternativeAnalysis().catch(console.error);
}

module.exports = { CardMarketPublicExplorer };
