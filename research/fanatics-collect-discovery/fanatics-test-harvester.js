/**
 * FANATICS COLLECT TEST HARVESTER WITH GRAPHQL OPTIMIZATION
 * ========================================================
 * 
 * Test version that:
 * 1. Uses separate database
 * 2. Tests 3-5 pages only 
 * 3. Implements GraphQL optimization
 * 4. Measures performance vs HTML scraping
 * 5. Validates data quality before full harvest
 * 
 * Based on research findings:
 * - GraphQL endpoints: webListingsQuery, webGlobalAuctionsQuery
 * - Optimal selector: [class*="card"] 
 * - 48 cards per page expected
 * - 50 total pages available
 */

const { chromium } = require('playwright');
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

class FanaticsTestHarvester {
    constructor() {
        // Test configuration - only 5 pages
        this.config = {
            testPages: [1, 2, 3, 25, 50], // Sample across range
            maxTestPages: 5,
            useGraphQL: true,
            htmlFallback: true,
            saveToDatabase: true,
            cardSelector: '[class*="card"]', // Research-proven
            delayBetweenPages: 2000, // Faster for testing
            pageTimeout: 25000
        };

        this.activeBaseUrl = 'https://www.fanaticscollect.com/weekly-auction?category=Trading+Card+Games+%3E+Pok%C3%A9mon+(English),Trading+Card+Games+%3E+Pok%C3%A9mon+(Japanese),Trading+Card+Games+%3E+Pok%C3%A9mon+(Other+Languages)&type=WEEKLY&itemsPerPage=48';
        
        this.results = {
            htmlCards: [],
            graphqlCards: [],
            performance: {
                html: [],
                graphql: []
            },
            errors: [],
            sessionId: `test_${Date.now()}`
        };

        // Separate database setup
        this.setupDatabase();
    }

    async setupDatabase() {
        console.log('🗄️ Setting up separate Fanatics database...');
        
        // Note: In real implementation, we'd set up Prisma with fanatics-schema.prisma
        // For now, we'll use JSON storage to demonstrate
        this.dbPath = './fanatics-test-results.json';
        
        if (!fs.existsSync(this.dbPath)) {
            fs.writeFileSync(this.dbPath, JSON.stringify({
                cards: [],
                sessions: [],
                graphqlResponses: [],
                qualityMetrics: []
            }, null, 2));
        }
        
        console.log('✅ Separate database ready');
    }

    async runTest() {
        console.log('🧪 FANATICS COLLECT TEST HARVESTER');
        console.log('==================================');
        console.log(`🎯 Test Strategy: ${this.config.testPages.length} pages`);
        console.log(`📊 GraphQL Optimization: ${this.config.useGraphQL ? 'ENABLED' : 'DISABLED'}`);
        console.log(`🗄️ Separate Database: ${this.config.saveToDatabase ? 'YES' : 'NO'}`);
        console.log(`🔬 Pages to test: ${this.config.testPages.join(', ')}`);

        const browser = await chromium.launch({ 
            headless: false,
            args: ['--no-sandbox', '--disable-web-security']
        });

        const context = await browser.newContext({
            userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36',
            viewport: { width: 1920, height: 1080 }
        });

        try {
            // Test 1: GraphQL Optimization
            if (this.config.useGraphQL) {
                await this.testGraphQLHarvesting(context);
            }
            
            // Test 2: HTML Scraping (fallback/comparison)
            if (this.config.htmlFallback) {
                await this.testHtmlHarvesting(context);
            }
            
            // Test 3: Performance Comparison
            await this.comparePerformance();
            
            // Test 4: Data Quality Assessment
            await this.assessDataQuality();
            
            // Test 5: Save to separate database
            if (this.config.saveToDatabase) {
                await this.saveToDatabase();
            }
            
            // Test 6: Generate recommendations
            await this.generateTestRecommendations();

        } catch (error) {
            console.error('❌ Test failed:', error);
            this.results.errors.push(error.message);
        } finally {
            await browser.close();
            await this.saveTestResults();
        }
    }

    async testGraphQLHarvesting(context) {
        console.log('\n🌐 TESTING GRAPHQL OPTIMIZATION');
        console.log('===============================');

        const page = await context.newPage();
        const graphqlResponses = [];

        // Intercept GraphQL requests
        page.on('response', async response => {
            if (response.url().includes('graphql') && response.status() === 200) {
                try {
                    const data = await response.json();
                    if (data.data && (data.data.listings || data.data.auctions || data.data.cards)) {
                        graphqlResponses.push({
                            url: response.url(),
                            operationName: this.extractOperationName(response.request().postData()),
                            data: data.data,
                            timestamp: Date.now(),
                            cardCount: this.countCardsInGraphQLResponse(data.data)
                        });
                        console.log(`📡 GraphQL Response: ${this.extractOperationName(response.request().postData())} - ${this.countCardsInGraphQLResponse(data.data)} cards`);
                    }
                } catch (e) {
                    // Ignore parse errors
                }
            }
        });

        try {
            for (const pageNum of this.config.testPages) {
                console.log(`\n🧪 GraphQL Test - Page ${pageNum}`);
                
                const startTime = Date.now();
                const url = `${this.activeBaseUrl}&page=${pageNum}`;
                
                await page.goto(url, { 
                    waitUntil: 'networkidle', 
                    timeout: this.config.pageTimeout 
                });
                
                const loadTime = Date.now() - startTime;
                
                // Wait for GraphQL responses
                await page.waitForTimeout(3000);
                
                // Extract cards from GraphQL if available
                const graphqlCards = this.extractCardsFromGraphQL(graphqlResponses);
                
                this.results.graphqlCards.push(...graphqlCards);
                this.results.performance.graphql.push({
                    page: pageNum,
                    loadTime: loadTime,
                    cardCount: graphqlCards.length,
                    method: 'graphql'
                });
                
                console.log(`   ✅ GraphQL Page ${pageNum}: ${graphqlCards.length} cards (${loadTime}ms)`);
                
                await page.waitForTimeout(this.config.delayBetweenPages);
            }

        } catch (error) {
            console.error('❌ GraphQL test failed:', error);
            this.results.errors.push(`GraphQL: ${error.message}`);
        } finally {
            await page.close();
        }

        console.log(`📊 GraphQL Test Complete: ${this.results.graphqlCards.length} total cards`);
    }

    async testHtmlHarvesting(context) {
        console.log('\n📄 TESTING HTML SCRAPING (FALLBACK)');
        console.log('===================================');

        const page = await context.newPage();

        try {
            for (const pageNum of this.config.testPages) {
                console.log(`\n🧪 HTML Test - Page ${pageNum}`);
                
                const startTime = Date.now();
                const url = `${this.activeBaseUrl}&page=${pageNum}`;
                
                await page.goto(url, { 
                    waitUntil: 'networkidle', 
                    timeout: this.config.pageTimeout 
                });
                
                const loadTime = Date.now() - startTime;
                
                // Extract cards using HTML scraping
                const htmlCards = await this.extractCardsFromHTML(page, pageNum);
                
                this.results.htmlCards.push(...htmlCards);
                this.results.performance.html.push({
                    page: pageNum,
                    loadTime: loadTime,
                    cardCount: htmlCards.length,
                    method: 'html'
                });
                
                console.log(`   ✅ HTML Page ${pageNum}: ${htmlCards.length} cards (${loadTime}ms)`);
                
                await page.waitForTimeout(this.config.delayBetweenPages);
            }

        } catch (error) {
            console.error('❌ HTML test failed:', error);
            this.results.errors.push(`HTML: ${error.message}`);
        } finally {
            await page.close();
        }

        console.log(`📊 HTML Test Complete: ${this.results.htmlCards.length} total cards`);
    }

    extractOperationName(postData) {
        if (!postData) return 'unknown';
        try {
            const parsed = JSON.parse(postData);
            return parsed.operationName || 'unnamed';
        } catch (e) {
            return 'parse-error';
        }
    }

    countCardsInGraphQLResponse(data) {
        // Look for arrays that might contain card data
        let count = 0;
        
        const checkForCards = (obj) => {
            if (Array.isArray(obj)) {
                count += obj.length;
            } else if (obj && typeof obj === 'object') {
                Object.values(obj).forEach(checkForCards);
            }
        };
        
        checkForCards(data);
        return count;
    }

    extractCardsFromGraphQL(responses) {
        const cards = [];
        
        responses.forEach(response => {
            if (response.data) {
                // Extract card data from GraphQL response
                const extractedCards = this.parseGraphQLCardData(response.data);
                extractedCards.forEach(card => {
                    cards.push({
                        ...card,
                        source: 'graphql',
                        operationName: response.operationName,
                        extractedAt: new Date().toISOString()
                    });
                });
            }
        });
        
        return cards;
    }

    parseGraphQLCardData(data) {
        // Parse GraphQL response to extract card information
        const cards = [];
        
        // This would need to be customized based on actual GraphQL schema
        // For now, we'll look for common patterns
        const findCards = (obj, path = '') => {
            if (Array.isArray(obj)) {
                obj.forEach((item, index) => {
                    if (item && typeof item === 'object') {
                        const card = this.extractCardFromObject(item);
                        if (card) {
                            cards.push({
                                ...card,
                                graphqlPath: `${path}[${index}]`
                            });
                        }
                    }
                });
            } else if (obj && typeof obj === 'object') {
                Object.entries(obj).forEach(([key, value]) => {
                    findCards(value, path ? `${path}.${key}` : key);
                });
            }
        };
        
        findCards(data);
        return cards;
    }

    extractCardFromObject(obj) {
        // Extract card-like data from an object
        const title = obj.title || obj.name || obj.description || '';
        const price = obj.price || obj.currentBid || obj.amount || 0;
        const id = obj.id || obj.lotId || obj.auctionId || '';
        
        if (title.length > 5 && title.toLowerCase().includes('pokemon')) {
            return {
                title: title,
                price: typeof price === 'number' ? price : 0,
                lotId: id.toString(),
                source: 'fanatics-graphql',
                rawGraphQLData: obj
            };
        }
        
        return null;
    }

    async extractCardsFromHTML(page, pageNum) {
        return await page.evaluate((selector) => {
            const cardElements = document.querySelectorAll(selector);
            
            return Array.from(cardElements).map(element => {
                try {
                    const titleEl = element.querySelector('a, [class*="title"], h1, h2, h3, h4') || element;
                    const priceEl = element.querySelector('[class*="price"], [class*="bid"], [class*="amount"]') || element;
                    const imageEl = element.querySelector('img');
                    const linkEl = element.querySelector('a');

                    const title = titleEl ? titleEl.textContent.trim() : '';
                    const priceText = priceEl ? priceEl.textContent.trim() : '';
                    const imageUrl = imageEl ? imageEl.src : '';
                    const lotUrl = linkEl ? linkEl.href : '';

                    const priceMatch = priceText.match(/\$[\d,]+/);
                    const price = priceMatch ? parseInt(priceMatch[0].replace(/[$,]/g, '')) : 0;

                    const pokemonKeywords = ['pokemon', 'charizard', 'pikachu', 'psa', 'gem mint'];
                    const titleLower = title.toLowerCase();
                    const isPokemon = pokemonKeywords.some(keyword => titleLower.includes(keyword));

                    if (isPokemon && title.length > 10) {
                        return {
                            title: title,
                            price: price,
                            priceText: priceText,
                            imageUrl: imageUrl,
                            lotUrl: lotUrl,
                            source: 'fanatics-html',
                            scrapedAt: new Date().toISOString()
                        };
                    }
                    return null;
                } catch (error) {
                    return null;
                }
            }).filter(Boolean);
        }, this.config.cardSelector);
    }

    async comparePerformance() {
        console.log('\n⚡ PERFORMANCE COMPARISON');
        console.log('========================');

        const htmlAvg = this.results.performance.html.reduce((sum, p) => sum + p.loadTime, 0) / this.results.performance.html.length;
        const graphqlAvg = this.results.performance.graphql.reduce((sum, p) => sum + p.loadTime, 0) / this.results.performance.graphql.length;
        
        const htmlCards = this.results.performance.html.reduce((sum, p) => sum + p.cardCount, 0);
        const graphqlCards = this.results.performance.graphql.reduce((sum, p) => sum + p.cardCount, 0);

        console.log(`📊 HTML Scraping:`);
        console.log(`   Average load time: ${htmlAvg.toFixed(0)}ms`);
        console.log(`   Total cards: ${htmlCards}`);
        console.log(`   Cards per second: ${(htmlCards / (htmlAvg * this.config.testPages.length / 1000)).toFixed(1)}`);

        console.log(`📊 GraphQL Optimization:`);
        console.log(`   Average load time: ${graphqlAvg.toFixed(0)}ms`);
        console.log(`   Total cards: ${graphqlCards}`);
        console.log(`   Cards per second: ${(graphqlCards / (graphqlAvg * this.config.testPages.length / 1000)).toFixed(1)}`);

        const speedImprovement = ((htmlAvg - graphqlAvg) / htmlAvg * 100).toFixed(1);
        console.log(`🚀 GraphQL Speed Improvement: ${speedImprovement}%`);
    }

    async assessDataQuality() {
        console.log('\n🔍 DATA QUALITY ASSESSMENT');
        console.log('==========================');

        const allCards = [...this.results.htmlCards, ...this.results.graphqlCards];
        
        const qualityMetrics = {
            totalCards: allCards.length,
            cardsWithPrice: allCards.filter(c => c.price > 0).length,
            cardsWithImage: allCards.filter(c => c.imageUrl && c.imageUrl.length > 10).length,
            cardsWithLotUrl: allCards.filter(c => c.lotUrl && c.lotUrl.length > 10).length,
            avgPrice: allCards.reduce((sum, c) => sum + (c.price || 0), 0) / allCards.length,
            priceRange: {
                min: Math.min(...allCards.map(c => c.price || 0)),
                max: Math.max(...allCards.map(c => c.price || 0))
            }
        };

        console.log(`📊 Quality Metrics:`);
        console.log(`   Total cards: ${qualityMetrics.totalCards}`);
        console.log(`   Cards with price: ${qualityMetrics.cardsWithPrice} (${(qualityMetrics.cardsWithPrice/qualityMetrics.totalCards*100).toFixed(1)}%)`);
        console.log(`   Cards with image: ${qualityMetrics.cardsWithImage} (${(qualityMetrics.cardsWithImage/qualityMetrics.totalCards*100).toFixed(1)}%)`);
        console.log(`   Cards with lot URL: ${qualityMetrics.cardsWithLotUrl} (${(qualityMetrics.cardsWithLotUrl/qualityMetrics.totalCards*100).toFixed(1)}%)`);
        console.log(`   Average price: $${qualityMetrics.avgPrice.toFixed(2)}`);
        console.log(`   Price range: $${qualityMetrics.priceRange.min} - $${qualityMetrics.priceRange.max.toLocaleString()}`);

        this.results.qualityMetrics = qualityMetrics;
    }

    async saveToDatabase() {
        console.log('\n💾 SAVING TO SEPARATE DATABASE');
        console.log('==============================');

        try {
            const dbData = JSON.parse(fs.readFileSync(this.dbPath, 'utf8'));
            
            // Add test session
            dbData.sessions.push({
                sessionId: this.results.sessionId,
                harvestType: 'test',
                configUsed: this.config,
                startTime: new Date().toISOString(),
                totalCards: this.results.htmlCards.length + this.results.graphqlCards.length,
                qualityMetrics: this.results.qualityMetrics,
                performance: this.results.performance
            });

            // Add cards
            dbData.cards.push(...this.results.htmlCards, ...this.results.graphqlCards);

            fs.writeFileSync(this.dbPath, JSON.stringify(dbData, null, 2));
            
            console.log(`✅ Saved to database: ${this.results.htmlCards.length + this.results.graphqlCards.length} cards`);
            console.log(`📄 Database file: ${this.dbPath}`);

        } catch (error) {
            console.error('❌ Database save failed:', error);
            this.results.errors.push(`Database: ${error.message}`);
        }
    }

    async generateTestRecommendations() {
        console.log('\n💡 TEST RECOMMENDATIONS');
        console.log('=======================');

        const recommendations = [];

        // Performance recommendation
        const htmlAvg = this.results.performance.html.reduce((sum, p) => sum + p.loadTime, 0) / this.results.performance.html.length;
        const graphqlAvg = this.results.performance.graphql.reduce((sum, p) => sum + p.loadTime, 0) / this.results.performance.graphql.length;
        
        if (this.results.graphqlCards.length > this.results.htmlCards.length) {
            recommendations.push({
                priority: 'HIGH',
                issue: 'GraphQL Superior Performance',
                solution: 'Use GraphQL for full harvest - more cards extracted',
                data: `GraphQL: ${this.results.graphqlCards.length} cards vs HTML: ${this.results.htmlCards.length} cards`
            });
        } else if (this.results.htmlCards.length > 0) {
            recommendations.push({
                priority: 'HIGH', 
                issue: 'HTML Scraping More Reliable',
                solution: 'Use HTML scraping with GraphQL as supplement',
                data: `HTML: ${this.results.htmlCards.length} cards vs GraphQL: ${this.results.graphqlCards.length} cards`
            });
        }

        // Data quality recommendation
        if (this.results.qualityMetrics.cardsWithPrice / this.results.qualityMetrics.totalCards < 0.7) {
            recommendations.push({
                priority: 'MEDIUM',
                issue: 'Price Data Extraction Needs Improvement',
                solution: 'Enhance price parsing logic for better coverage',
                data: `Only ${(this.results.qualityMetrics.cardsWithPrice/this.results.qualityMetrics.totalCards*100).toFixed(1)}% have prices`
            });
        }

        // Full harvest recommendation
        if (this.results.qualityMetrics.totalCards >= 100) {
            recommendations.push({
                priority: 'HIGH',
                issue: 'Test Successful - Ready for Full Harvest',
                solution: 'Proceed with full 50-page harvest using optimal method',
                estimation: `Expected: ${(this.results.qualityMetrics.totalCards / this.config.testPages.length * 50).toFixed(0)} total cards`
            });
        }

        this.results.recommendations = recommendations;

        console.log('📋 Recommendations:');
        recommendations.forEach((rec, i) => {
            console.log(`   ${i + 1}. [${rec.priority}] ${rec.issue}`);
            console.log(`      Solution: ${rec.solution}`);
            if (rec.data) console.log(`      Data: ${rec.data}`);
            if (rec.estimation) console.log(`      Estimation: ${rec.estimation}`);
        });
    }

    async saveTestResults() {
        const timestamp = Date.now();
        const filename = `fanatics-test-results-${timestamp}.json`;
        
        const testReport = {
            metadata: {
                sessionId: this.results.sessionId,
                testType: 'graphql-optimization-test',
                timestamp: new Date(),
                configUsed: this.config,
                pagesTestedL: this.config.testPages
            },
            results: this.results,
            summary: {
                htmlCards: this.results.htmlCards.length,
                graphqlCards: this.results.graphqlCards.length,
                totalCards: this.results.htmlCards.length + this.results.graphqlCards.length,
                errors: this.results.errors.length,
                qualityScore: this.results.qualityMetrics ? 
                    (this.results.qualityMetrics.cardsWithPrice / this.results.qualityMetrics.totalCards) : 0
            }
        };

        fs.writeFileSync(filename, JSON.stringify(testReport, null, 2));
        
        console.log(`\n💾 TEST RESULTS SAVED`);
        console.log(`📄 File: ${filename}`);
        console.log(`📊 Summary: ${testReport.summary.totalCards} cards tested`);
        console.log(`🎯 Quality Score: ${(testReport.summary.qualityScore * 100).toFixed(1)}%`);
        
        return filename;
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Run the test
console.log('🧪 STARTING FANATICS COLLECT TEST WITH GRAPHQL OPTIMIZATION');
console.log('===========================================================');

const tester = new FanaticsTestHarvester();
tester.runTest().catch(console.error);
