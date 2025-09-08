/**
 * COMPREHENSIVE FANATICS COLLECT SITE STRUCTURE RESEARCH - V2
 * ===========================================================
 * 
 * Deep analysis using the CORRECT URLs without Top 200 filter:
 * - Active: https://www.fanaticscollect.com/weekly-auction?category=Trading+Card+Games+%3E+Pok%C3%A9mon+(English),Trading+Card+Games+%3E+Pok%C3%A9mon+(Japanese),Trading+Card+Games+%3E+Pok%C3%A9mon+(Other+Languages)&type=WEEKLY&itemsPerPage=48&page=1
 * - Sold: https://sales-history.fanaticscollect.com/
 * 
 * Research Focus:
 * 1. Exact pagination structure (48 cards per page)
 * 2. Total available Pokemon cards without filters
 * 3. API endpoints and GraphQL patterns
 * 4. Rate limiting and anti-bot measures
 * 5. Data extraction patterns
 * 6. Authentication requirements
 * 7. Site performance characteristics
 */

const { chromium } = require('playwright');
const fs = require('fs');

class ComprehensiveFanaticsResearcher {
    constructor() {
        this.activeBaseUrl = 'https://www.fanaticscollect.com/weekly-auction?category=Trading+Card+Games+%3E+Pok%C3%A9mon+(English),Trading+Card+Games+%3E+Pok%C3%A9mon+(Japanese),Trading+Card+Games+%3E+Pok%C3%A9mon+(Other+Languages)&type=WEEKLY&itemsPerPage=48';
        this.soldBaseUrl = 'https://sales-history.fanaticscollect.com/';
        
        this.findings = {
            siteStructure: {},
            pagination: {},
            authentication: {},
            apiEndpoints: [],
            performance: {},
            dataExtraction: {},
            recommendations: [],
            networkRequests: []
        };
    }

    async conductResearch() {
        console.log('🔬 COMPREHENSIVE FANATICS COLLECT RESEARCH - V2');
        console.log('===============================================');
        console.log('🎯 Using CORRECT URLs without Top 200 filter');
        console.log('📊 Expected: 48 cards per page, multiple pages');
        console.log('🔗 Active URL:', this.activeBaseUrl.substring(0, 80) + '...');
        console.log('🔗 Sold URL:', this.soldBaseUrl);

        const browser = await chromium.launch({ 
            headless: false,
            args: [
                '--no-sandbox',
                '--disable-web-security',
                '--disable-features=VizDisplayCompositor',
                '--disable-blink-features=AutomationControlled'
            ]
        });

        const context = await browser.newContext({
            userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36',
            viewport: { width: 1920, height: 1080 },
            extraHTTPHeaders: {
                'Accept-Language': 'en-US,en;q=0.9',
                'Accept-Encoding': 'gzip, deflate, br',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1'
            }
        });

        // Network monitoring
        this.setupNetworkMonitoring(context);

        try {
            // 1. Research Active Auction Structure
            await this.researchActiveAuctions(context);
            
            // 2. Research Sold Data Structure  
            await this.researchSoldData(context);
            
            // 3. Deep Pagination Analysis
            await this.deepPaginationAnalysis(context);
            
            // 4. API Pattern Discovery
            await this.discoverApiPatterns(context);
            
            // 5. Performance Characteristics
            await this.analyzePerformance(context);
            
            // 6. Data Extraction Patterns
            await this.analyzeDataExtraction(context);
            
            // 7. Generate Action Plan
            await this.generateActionPlan();

        } catch (error) {
            console.error('❌ Research failed:', error);
        } finally {
            await browser.close();
            await this.saveComprehensiveFindings();
        }
    }

    setupNetworkMonitoring(context) {
        console.log('\n🌐 SETTING UP NETWORK MONITORING');
        console.log('================================');

        context.on('request', request => {
            if (request.url().includes('fanaticscollect.com')) {
                this.findings.networkRequests.push({
                    type: 'request',
                    url: request.url(),
                    method: request.method(),
                    headers: request.headers(),
                    timestamp: new Date(),
                    postData: request.postData()
                });
            }
        });

        context.on('response', async response => {
            if (response.url().includes('fanaticscollect.com')) {
                try {
                    const responseData = {
                        type: 'response',
                        url: response.url(),
                        status: response.status(),
                        headers: response.headers(),
                        timestamp: new Date()
                    };

                    // Capture GraphQL/API responses
                    if (response.url().includes('graphql') || response.url().includes('/api/')) {
                        try {
                            const data = await response.json();
                            responseData.data = data;
                            responseData.isApi = true;
                        } catch (e) {
                            responseData.contentType = response.headers()['content-type'];
                        }
                    }

                    this.findings.networkRequests.push(responseData);
                } catch (e) {
                    // Ignore errors in response capture
                }
            }
        });

        console.log('✅ Network monitoring active');
    }

    async researchActiveAuctions(context) {
        console.log('\n🟢 RESEARCHING ACTIVE AUCTION STRUCTURE');
        console.log('======================================');

        const page = await context.newPage();
        
        try {
            // Test first few pages to understand structure
            for (let pageNum = 1; pageNum <= 5; pageNum++) {
                const url = `${this.activeBaseUrl}&page=${pageNum}`;
                console.log(`\n📄 Analyzing Active Page ${pageNum}:`);
                console.log(`   URL: ${url.substring(0, 100)}...`);

                const startTime = Date.now();
                
                try {
                    await page.goto(url, { 
                        waitUntil: 'networkidle', 
                        timeout: 30000 
                    });

                    const loadTime = Date.now() - startTime;
                    
                    // Comprehensive page analysis
                    const pageAnalysis = await page.evaluate(() => {
                        // Card counting with multiple selectors
                        const cardSelectors = [
                            '[class*="auction-item"]',
                            '[class*="card-item"]', 
                            '[class*="lot-item"]',
                            '[data-testid*="item"]',
                            '.card',
                            '.item',
                            '[class*="product"]',
                            '[class*="listing"]'
                        ];

                        let totalCards = 0;
                        let bestSelector = '';
                        let cardData = [];

                        for (const selector of cardSelectors) {
                            const elements = document.querySelectorAll(selector);
                            if (elements.length > totalCards) {
                                totalCards = elements.length;
                                bestSelector = selector;
                                
                                // Extract sample data
                                cardData = Array.from(elements).slice(0, 5).map(el => ({
                                    title: el.textContent?.substring(0, 100) || '',
                                    hasImage: !!el.querySelector('img'),
                                    hasPrice: /\$[\d,]+/.test(el.textContent || ''),
                                    className: el.className
                                }));
                            }
                        }

                        // Pagination analysis
                        const paginationSelectors = [
                            '[class*="paginat"]',
                            '.pagination',
                            '[data-testid*="paginat"]',
                            'nav[aria-label*="paginat"]'
                        ];

                        let paginationInfo = { found: false };
                        for (const selector of paginationSelectors) {
                            const pagEl = document.querySelector(selector);
                            if (pagEl) {
                                const pageLinks = Array.from(pagEl.querySelectorAll('a, span, button'))
                                    .map(el => el.textContent?.trim())
                                    .filter(text => text && text.length < 10);
                                
                                const pageNumbers = pageLinks.filter(text => /^\d+$/.test(text)).map(Number);
                                
                                paginationInfo = {
                                    found: true,
                                    selector: selector,
                                    totalPages: pageNumbers.length > 0 ? Math.max(...pageNumbers) : null,
                                    pageLinks: pageLinks,
                                    html: pagEl.outerHTML.substring(0, 500)
                                };
                                break;
                            }
                        }

                        // Check for login requirements
                        const loginElements = Array.from(document.querySelectorAll('*'))
                            .filter(el => el.textContent && el.textContent.toLowerCase().includes('log in'));

                        // Price visibility
                        const priceElements = Array.from(document.querySelectorAll('*'))
                            .filter(el => el.textContent && /\$[\d,]+/.test(el.textContent));

                        // Pokemon-specific content
                        const pokemonIndicators = Array.from(document.querySelectorAll('*'))
                            .filter(el => el.textContent && (
                                el.textContent.toLowerCase().includes('pokemon') ||
                                el.textContent.toLowerCase().includes('charizard') ||
                                el.textContent.toLowerCase().includes('pikachu') ||
                                el.textContent.toLowerCase().includes('psa')
                            ));

                        return {
                            totalCards,
                            bestSelector,
                            cardData,
                            pagination: paginationInfo,
                            loginElements: loginElements.length,
                            priceElements: priceElements.length,
                            pokemonIndicators: pokemonIndicators.length,
                            isPokemonPage: pokemonIndicators.length > 5,
                            pageTitle: document.title,
                            url: window.location.href
                        };
                    });

                    this.findings.siteStructure[`active_page_${pageNum}`] = {
                        ...pageAnalysis,
                        loadTime,
                        timestamp: new Date()
                    };

                    console.log(`   ✅ Cards found: ${pageAnalysis.totalCards}`);
                    console.log(`   ✅ Best selector: ${pageAnalysis.bestSelector}`);
                    console.log(`   ✅ Pokemon content: ${pageAnalysis.isPokemonPage ? 'Yes' : 'No'}`);
                    console.log(`   ✅ Pagination: ${pageAnalysis.pagination.found ? 'Found' : 'Not found'}`);
                    console.log(`   ✅ Load time: ${loadTime}ms`);

                    if (pageAnalysis.pagination.found && pageAnalysis.pagination.totalPages) {
                        console.log(`   📊 Total pages detected: ${pageAnalysis.pagination.totalPages}`);
                    }

                } catch (error) {
                    console.error(`   ❌ Page ${pageNum} failed: ${error.message}`);
                    this.findings.siteStructure[`active_page_${pageNum}_error`] = error.message;
                }

                // Wait between pages
                await page.waitForTimeout(2000);
            }

        } finally {
            await page.close();
        }
    }

    async researchSoldData(context) {
        console.log('\n🔴 RESEARCHING SOLD DATA STRUCTURE');
        console.log('=================================');

        const page = await context.newPage();

        try {
            console.log(`📄 Analyzing Sold Data Page:`);
            console.log(`   URL: ${this.soldBaseUrl}`);

            const startTime = Date.now();
            
            await page.goto(this.soldBaseUrl, { 
                waitUntil: 'networkidle', 
                timeout: 30000 
            });

            const loadTime = Date.now() - startTime;

            // Analyze sold data structure
            const soldAnalysis = await page.evaluate(() => {
                // Look for table structures, rows, cards, etc.
                const dataSelectors = [
                    'table tr',
                    '[class*="row"]',
                    '[class*="item"]',
                    '[class*="sale"]',
                    '[class*="history"]',
                    '[data-testid*="sale"]',
                    '[data-testid*="row"]'
                ];

                let totalItems = 0;
                let bestSelector = '';
                let sampleData = [];

                for (const selector of dataSelectors) {
                    const elements = document.querySelectorAll(selector);
                    if (elements.length > totalItems) {
                        totalItems = elements.length;
                        bestSelector = selector;
                        
                        sampleData = Array.from(elements).slice(0, 5).map(el => ({
                            text: el.textContent?.substring(0, 100) || '',
                            hasPrice: /\$[\d,]+/.test(el.textContent || ''),
                            hasDate: /\d{4}|\d{1,2}\/\d{1,2}/.test(el.textContent || ''),
                            className: el.className
                        }));
                    }
                }

                // Look for search/filter options
                const filterElements = Array.from(document.querySelectorAll('select, input[type="search"], [class*="filter"]'))
                    .map(el => ({
                        type: el.tagName,
                        name: el.name || el.className,
                        placeholder: el.placeholder || '',
                        options: el.tagName === 'SELECT' ? 
                            Array.from(el.options).map(opt => opt.text) : []
                    }));

                // Look for pagination on sold page
                const pagination = document.querySelector('[class*="paginat"], .pagination');
                const paginationInfo = pagination ? {
                    found: true,
                    html: pagination.outerHTML.substring(0, 300)
                } : { found: false };

                return {
                    totalItems,
                    bestSelector,
                    sampleData,
                    filterElements,
                    pagination: paginationInfo,
                    pageTitle: document.title,
                    url: window.location.href
                };
            });

            this.findings.siteStructure.sold_data = {
                ...soldAnalysis,
                loadTime,
                timestamp: new Date()
            };

            console.log(`   ✅ Items found: ${soldAnalysis.totalItems}`);
            console.log(`   ✅ Best selector: ${soldAnalysis.bestSelector}`);
            console.log(`   ✅ Filters available: ${soldAnalysis.filterElements.length}`);
            console.log(`   ✅ Pagination: ${soldAnalysis.pagination.found ? 'Found' : 'Not found'}`);
            console.log(`   ✅ Load time: ${loadTime}ms`);

        } catch (error) {
            console.error(`   ❌ Sold data analysis failed: ${error.message}`);
            this.findings.siteStructure.sold_data_error = error.message;
        } finally {
            await page.close();
        }
    }

    async deepPaginationAnalysis(context) {
        console.log('\n📄 DEEP PAGINATION ANALYSIS');
        console.log('===========================');

        const page = await context.newPage();

        try {
            // Test pagination patterns
            const testPages = [1, 2, 5, 10, 25, 50];
            
            for (const pageNum of testPages) {
                const url = `${this.activeBaseUrl}&page=${pageNum}`;
                
                try {
                    console.log(`🔍 Testing page ${pageNum}...`);
                    
                    await page.goto(url, { 
                        waitUntil: 'networkidle', 
                        timeout: 20000 
                    });

                    const pageData = await page.evaluate(() => ({
                        hasContent: document.body.innerText.length > 1000,
                        cardCount: document.querySelectorAll('[class*="item"], [class*="card"]').length,
                        currentPage: new URLSearchParams(window.location.search).get('page'),
                        title: document.title,
                        isPokemon: document.body.innerText.toLowerCase().includes('pokemon')
                    }));

                    this.findings.pagination[`page_${pageNum}`] = pageData;
                    console.log(`   Page ${pageNum}: ${pageData.cardCount} cards, ${pageData.hasContent ? 'has content' : 'empty'}`);

                } catch (error) {
                    console.log(`   Page ${pageNum}: Failed - ${error.message}`);
                    this.findings.pagination[`page_${pageNum}_error`] = error.message;
                }

                await page.waitForTimeout(1000);
            }

            // Determine actual total pages
            await page.goto(`${this.activeBaseUrl}&page=1`, { waitUntil: 'networkidle' });
            
            const paginationDetails = await page.evaluate(() => {
                const paginationElement = document.querySelector('[class*="paginat"], .pagination');
                if (paginationElement) {
                    const allText = paginationElement.innerText;
                    const numbers = allText.match(/\d+/g) || [];
                    return {
                        found: true,
                        allNumbers: numbers.map(Number),
                        maxNumber: Math.max(...numbers.map(Number)),
                        fullText: allText
                    };
                }
                return { found: false };
            });

            this.findings.pagination.structure = paginationDetails;
            console.log(`📊 Pagination structure: ${paginationDetails.found ? 'Found' : 'Not found'}`);
            if (paginationDetails.found) {
                console.log(`   Max page number: ${paginationDetails.maxNumber}`);
            }

        } finally {
            await page.close();
        }
    }

    async discoverApiPatterns(context) {
        console.log('\n🌐 API PATTERN DISCOVERY');
        console.log('=======================');

        // Analyze captured network requests
        const graphqlRequests = this.findings.networkRequests.filter(req => 
            req.url.includes('graphql') && req.method === 'POST'
        );

        const apiRequests = this.findings.networkRequests.filter(req => 
            req.url.includes('/api/') || req.isApi
        );

        console.log(`📊 GraphQL requests: ${graphqlRequests.length}`);
        console.log(`📊 API requests: ${apiRequests.length}`);

        // Extract unique GraphQL queries
        const uniqueQueries = new Set();
        graphqlRequests.forEach(req => {
            if (req.postData) {
                try {
                    const parsed = JSON.parse(req.postData);
                    if (parsed.operationName) {
                        uniqueQueries.add(parsed.operationName);
                    }
                } catch (e) {
                    // Ignore parse errors
                }
            }
        });

        this.findings.apiEndpoints = {
            graphqlRequests: graphqlRequests.slice(0, 10), // Sample
            apiRequests: apiRequests.slice(0, 10), // Sample
            uniqueQueries: Array.from(uniqueQueries),
            totalRequests: this.findings.networkRequests.length
        };

        console.log(`🔍 Unique GraphQL queries: ${Array.from(uniqueQueries).join(', ')}`);
    }

    async analyzePerformance(context) {
        console.log('\n⚡ PERFORMANCE ANALYSIS');
        console.log('======================');

        const page = await context.newPage();

        try {
            // Test load times for different scenarios
            const scenarios = [
                { name: 'First Page', url: `${this.activeBaseUrl}&page=1` },
                { name: 'Mid Page', url: `${this.activeBaseUrl}&page=10` },
                { name: 'Sold Data', url: this.soldBaseUrl }
            ];

            for (const scenario of scenarios) {
                console.log(`⏱️ Testing ${scenario.name}...`);
                
                const startTime = Date.now();
                
                try {
                    await page.goto(scenario.url, { 
                        waitUntil: 'networkidle', 
                        timeout: 30000 
                    });
                    
                    const loadTime = Date.now() - startTime;
                    
                    const metrics = await page.evaluate(() => ({
                        domElements: document.querySelectorAll('*').length,
                        images: document.querySelectorAll('img').length,
                        scripts: document.querySelectorAll('script').length,
                        bodySize: document.body.innerHTML.length
                    }));

                    this.findings.performance[scenario.name] = {
                        loadTime,
                        ...metrics
                    };

                    console.log(`   ${scenario.name}: ${loadTime}ms`);

                } catch (error) {
                    console.log(`   ${scenario.name}: Failed - ${error.message}`);
                }

                await page.waitForTimeout(2000);
            }

        } finally {
            await page.close();
        }
    }

    async analyzeDataExtraction(context) {
        console.log('\n🔍 DATA EXTRACTION ANALYSIS');
        console.log('===========================');

        const page = await context.newPage();

        try {
            await page.goto(`${this.activeBaseUrl}&page=1`, { waitUntil: 'networkidle' });

            // Test different extraction methods
            const extractionAnalysis = await page.evaluate(() => {
                const methods = {
                    cardSelector1: '[class*="auction-item"]',
                    cardSelector2: '[class*="card"]',
                    cardSelector3: '[class*="item"]',
                    cardSelector4: '[data-testid*="item"]'
                };

                const results = {};

                for (const [method, selector] of Object.entries(methods)) {
                    const elements = document.querySelectorAll(selector);
                    
                    if (elements.length > 0) {
                        const sampleCard = elements[0];
                        
                        results[method] = {
                            cardCount: elements.length,
                            sampleData: {
                                title: sampleCard.textContent?.substring(0, 100) || '',
                                hasPrice: /\$[\d,]+/.test(sampleCard.textContent || ''),
                                hasImage: !!sampleCard.querySelector('img'),
                                className: sampleCard.className,
                                innerHTML: sampleCard.innerHTML.substring(0, 200)
                            }
                        };
                    } else {
                        results[method] = { cardCount: 0 };
                    }
                }

                return results;
            });

            this.findings.dataExtraction = extractionAnalysis;

            console.log('📊 Extraction method comparison:');
            Object.entries(extractionAnalysis).forEach(([method, data]) => {
                console.log(`   ${method}: ${data.cardCount} cards`);
            });

        } finally {
            await page.close();
        }
    }

    async generateActionPlan() {
        console.log('\n💡 GENERATING COMPREHENSIVE ACTION PLAN');
        console.log('======================================');

        const recommendations = [];

        // Analyze findings to generate recommendations
        const firstPageData = this.findings.siteStructure.active_page_1;
        
        if (firstPageData) {
            if (firstPageData.totalCards >= 40) {
                recommendations.push({
                    priority: 'HIGH',
                    issue: 'Successful Card Detection',
                    solution: `Use selector "${firstPageData.bestSelector}" to extract ${firstPageData.totalCards} cards per page`,
                    implementation: 'Ready for full harvesting'
                });
            }

            if (firstPageData.pagination?.found && firstPageData.pagination?.totalPages) {
                recommendations.push({
                    priority: 'CRITICAL',
                    issue: 'Full Pagination Available',
                    solution: `Implement harvesting across ${firstPageData.pagination.totalPages} pages`,
                    estimation: `Potential ${firstPageData.totalCards * firstPageData.pagination.totalPages} total cards`
                });
            }

            if (firstPageData.loadTime > 10000) {
                recommendations.push({
                    priority: 'MEDIUM',
                    issue: 'Slow Page Load',
                    solution: 'Implement longer timeouts and retry logic',
                    currentLoadTime: `${firstPageData.loadTime}ms`
                });
            }
        }

        // GraphQL optimization
        if (this.findings.apiEndpoints.uniqueQueries.length > 0) {
            recommendations.push({
                priority: 'HIGH',
                issue: 'GraphQL API Available',
                solution: 'Use direct GraphQL queries for faster data access',
                queries: this.findings.apiEndpoints.uniqueQueries
            });
        }

        // Performance recommendations
        const avgLoadTime = Object.values(this.findings.performance)
            .reduce((sum, perf) => sum + (perf.loadTime || 0), 0) / Object.keys(this.findings.performance).length;

        if (avgLoadTime > 0) {
            recommendations.push({
                priority: 'MEDIUM',
                issue: 'Performance Optimization',
                solution: `Average load time: ${avgLoadTime.toFixed(0)}ms - implement appropriate delays`,
                recommendedDelay: Math.max(avgLoadTime * 1.5, 2000)
            });
        }

        this.findings.recommendations = recommendations;

        console.log('📋 Generated recommendations:');
        recommendations.forEach((rec, i) => {
            console.log(`   ${i + 1}. [${rec.priority}] ${rec.issue}`);
            console.log(`      Solution: ${rec.solution}`);
            if (rec.implementation) console.log(`      Implementation: ${rec.implementation}`);
            if (rec.estimation) console.log(`      Estimation: ${rec.estimation}`);
        });
    }

    async saveComprehensiveFindings() {
        const timestamp = Date.now();
        const filename = `comprehensive-fanatics-research-${timestamp}.json`;
        
        const report = {
            metadata: {
                timestamp: new Date(),
                activeBaseUrl: this.activeBaseUrl,
                soldBaseUrl: this.soldBaseUrl,
                researchDuration: 'comprehensive',
                version: 'v2-no-filter'
            },
            ...this.findings
        };

        fs.writeFileSync(filename, JSON.stringify(report, null, 2));
        console.log(`\n💾 Comprehensive research saved to: ${filename}`);
        console.log(`📊 File size: ${(fs.statSync(filename).size / 1024 / 1024).toFixed(2)} MB`);
        
        // Generate summary
        console.log('\n📊 RESEARCH SUMMARY');
        console.log('==================');
        console.log(`🎴 Active pages analyzed: ${Object.keys(this.findings.siteStructure).filter(k => k.includes('active_page')).length}`);
        console.log(`📄 Pagination tests: ${Object.keys(this.findings.pagination).length}`);
        console.log(`🌐 Network requests captured: ${this.findings.networkRequests.length}`);
        console.log(`⚡ Performance tests: ${Object.keys(this.findings.performance).length}`);
        console.log(`💡 Recommendations: ${this.findings.recommendations.length}`);
    }
}

// Run comprehensive research
const researcher = new ComprehensiveFanaticsResearcher();
researcher.conductResearch().catch(console.error);
