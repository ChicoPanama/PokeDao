/**
 * FANATICS COLLECT SITE STRUCTURE RESEARCH
 * =========================================
 * 
 * Deep analysis of Fanatics Collect site to understand:
 * 1. Full pagination structure (50 pages visible)
 * 2. Authentication/login requirements
 * 3. Different filtering options beyond "Top 200"
 * 4. API endpoints and request patterns
 * 5. Rate limiting and anti-bot measures
 */

const { chromium } = require('playwright');
const fs = require('fs');

class FanaticsResearcher {
    constructor() {
        this.baseUrl = 'https://www.fanaticscollect.com';
        this.findings = {
            pagination: {},
            authentication: {},
            filters: {},
            apiEndpoints: [],
            structure: {},
            recommendations: []
        };
    }

    async research() {
        console.log('🔬 STARTING FANATICS COLLECT SITE RESEARCH');
        console.log('==========================================');

        const browser = await chromium.launch({ 
            headless: false, // Keep visible for debugging
            args: ['--no-sandbox', '--disable-web-security']
        });
        
        const context = await browser.newContext({
            userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36',
            viewport: { width: 1920, height: 1080 }
        });

        const page = await context.newPage();

        // Capture all network requests
        const networkRequests = [];
        page.on('request', request => {
            if (request.url().includes('fanaticscollect.com')) {
                networkRequests.push({
                    url: request.url(),
                    method: request.method(),
                    headers: request.headers(),
                    postData: request.postData()
                });
            }
        });

        try {
            // 1. Research Home Page Structure
            await this.researchHomePage(page);
            
            // 2. Research Pokemon Category Structure
            await this.researchPokemonCategory(page);
            
            // 3. Research Pagination Structure
            await this.researchPagination(page);
            
            // 4. Research Authentication Requirements
            await this.researchAuthentication(page);
            
            // 5. Research Filter Options
            await this.researchFilters(page);
            
            // 6. Research API Patterns
            await this.researchApiPatterns(page, networkRequests);
            
            // 7. Generate Recommendations
            await this.generateRecommendations();

        } catch (error) {
            console.error('❌ Research failed:', error.message);
        } finally {
            await browser.close();
            await this.saveFindings();
        }
    }

    async researchHomePage(page) {
        console.log('\n📊 1. RESEARCHING HOME PAGE STRUCTURE');
        console.log('====================================');

        try {
            await page.goto(this.baseUrl, { waitUntil: 'networkidle' });
            
            // Analyze navigation structure
            const navigation = await page.evaluate(() => {
                const nav = document.querySelector('nav, .navigation, [class*="nav"]');
                return nav ? nav.outerHTML : 'No navigation found';
            });

            this.findings.structure.navigation = navigation;
            console.log('✅ Navigation structure captured');

            // Look for category links
            const categories = await page.evaluate(() => {
                const links = Array.from(document.querySelectorAll('a[href*="Trading+Card"]'));
                return links.map(link => ({
                    text: link.textContent.trim(),
                    href: link.href
                }));
            });

            this.findings.structure.categories = categories;
            console.log(`✅ Found ${categories.length} trading card categories`);

        } catch (error) {
            console.error('❌ Home page research failed:', error.message);
        }
    }

    async researchPokemonCategory(page) {
        console.log('\n🎴 2. RESEARCHING POKEMON CATEGORY');
        console.log('=================================');

        // Test different Pokemon URLs
        const pokemonUrls = [
            // Original URL with Top 200 filter
            'https://www.fanaticscollect.com/weekly-auction?type=WEEKLY&page=1&category=Trading+Card+Games+%3E+Pok%C3%A9mon+(English),Trading+Card+Games+%3E+Pok%C3%A9mon+(Japanese),Trading+Card+Games+%3E+Pok%C3%A9mon+(Other+Languages)&itemsPerPage=48&sortBy=prod_item_state_v1_price_desc&featured=filter-Pokemon:+Top+200',
            
            // Without Top 200 filter
            'https://www.fanaticscollect.com/weekly-auction?type=WEEKLY&page=1&category=Trading+Card+Games+%3E+Pok%C3%A9mon+(English),Trading+Card+Games+%3E+Pok%C3%A9mon+(Japanese),Trading+Card+Games+%3E+Pok%C3%A9mon+(Other+Languages)&itemsPerPage=48&sortBy=prod_item_state_v1_price_desc',
            
            // Different items per page
            'https://www.fanaticscollect.com/weekly-auction?type=WEEKLY&page=1&category=Trading+Card+Games+%3E+Pok%C3%A9mon+(English),Trading+Card+Games+%3E+Pok%C3%A9mon+(Japanese),Trading+Card+Games+%3E+Pok%C3%A9mon+(Other+Languages)&itemsPerPage=100&sortBy=prod_item_state_v1_price_desc',
            
            // Different sorting
            'https://www.fanaticscollect.com/weekly-auction?type=WEEKLY&page=1&category=Trading+Card+Games+%3E+Pok%C3%A9mon+(English),Trading+Card+Games+%3E+Pok%C3%A9mon+(Japanese),Trading+Card+Games+%3E+Pok%C3%A9mon+(Other+Languages)&itemsPerPage=48&sortBy=prod_item_state_v1_created_date_desc'
        ];

        for (let i = 0; i < pokemonUrls.length; i++) {
            const url = pokemonUrls[i];
            console.log(`\n🔍 Testing URL variant ${i + 1}:`);
            console.log(url.substring(0, 100) + '...');

            try {
                await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
                
                // Count items on page
                const itemCount = await page.evaluate(() => {
                    const items = document.querySelectorAll('[class*="item"], [class*="card"], [class*="lot"], [class*="auction"]');
                    return items.length;
                });

                // Check pagination
                const paginationInfo = await page.evaluate(() => {
                    const pagination = document.querySelector('[class*="paginat"]');
                    if (pagination) {
                        const pageNumbers = Array.from(pagination.querySelectorAll('a, span')).map(el => el.textContent.trim());
                        return {
                            found: true,
                            pageNumbers: pageNumbers,
                            html: pagination.outerHTML
                        };
                    }
                    return { found: false };
                });

                // Check for login requirements
                const loginRequired = await page.evaluate(() => {
                    const loginButtons = document.querySelectorAll('[class*="login"], [class*="log-in"]');
                    return {
                        loginButtonCount: loginButtons.length,
                        hasLoginRequirement: loginButtons.length > 0
                    };
                });

                this.findings.pagination[`variant_${i + 1}`] = {
                    url: url,
                    itemCount: itemCount,
                    pagination: paginationInfo,
                    loginRequired: loginRequired
                };

                console.log(`   Items found: ${itemCount}`);
                console.log(`   Pagination: ${paginationInfo.found ? 'Found' : 'Not found'}`);
                console.log(`   Login required: ${loginRequired.hasLoginRequirement}`);

            } catch (error) {
                console.error(`   ❌ Failed: ${error.message}`);
                this.findings.pagination[`variant_${i + 1}_error`] = error.message;
            }

            // Wait between requests
            await page.waitForTimeout(2000);
        }
    }

    async researchPagination(page) {
        console.log('\n📄 3. RESEARCHING PAGINATION STRUCTURE');
        console.log('=====================================');

        // Use the base Pokemon URL without filters
        const baseUrl = 'https://www.fanaticscollect.com/weekly-auction?type=WEEKLY&category=Trading+Card+Games+%3E+Pok%C3%A9mon+(English),Trading+Card+Games+%3E+Pok%C3%A9mon+(Japanese),Trading+Card+Games+%3E+Pok%C3%A9mon+(Other+Languages)&itemsPerPage=48&sortBy=prod_item_state_v1_price_desc';

        try {
            // Test first page
            await page.goto(`${baseUrl}&page=1`, { waitUntil: 'networkidle', timeout: 30000 });
            
            const firstPageAnalysis = await page.evaluate(() => {
                // Look for pagination elements
                const paginationSelectors = [
                    '[class*="paginat"]',
                    '[class*="page"]',
                    '.pagination',
                    '[data-testid*="paginat"]',
                    'nav[aria-label*="paginat"]'
                ];

                let paginationElement = null;
                for (const selector of paginationSelectors) {
                    paginationElement = document.querySelector(selector);
                    if (paginationElement) break;
                }

                if (paginationElement) {
                    const links = Array.from(paginationElement.querySelectorAll('a, button, span'));
                    return {
                        found: true,
                        totalPages: links.map(el => el.textContent.trim()).filter(text => /^\d+$/.test(text)),
                        paginationHTML: paginationElement.outerHTML,
                        selector: paginationElement.className || paginationElement.tagName
                    };
                }

                return { found: false };
            });

            this.findings.pagination.structure = firstPageAnalysis;
            console.log(`✅ Pagination analysis: ${firstPageAnalysis.found ? 'Found' : 'Not found'}`);

            if (firstPageAnalysis.found) {
                console.log(`   Total pages detected: ${Math.max(...firstPageAnalysis.totalPages.map(p => parseInt(p)))}`);
            }

            // Test a few different pages to understand URL patterns
            const testPages = [1, 2, 5, 10];
            for (const pageNum of testPages) {
                try {
                    await page.goto(`${baseUrl}&page=${pageNum}`, { waitUntil: 'networkidle', timeout: 15000 });
                    
                    const pageAnalysis = await page.evaluate(() => ({
                        url: window.location.href,
                        itemCount: document.querySelectorAll('[class*="item"], [class*="card"]').length,
                        hasData: document.body.innerText.includes('Pokemon') || document.body.innerText.includes('Charizard')
                    }));

                    this.findings.pagination[`page_${pageNum}`] = pageAnalysis;
                    console.log(`   Page ${pageNum}: ${pageAnalysis.itemCount} items, has data: ${pageAnalysis.hasData}`);

                } catch (error) {
                    console.error(`   ❌ Page ${pageNum} failed: ${error.message}`);
                }

                await page.waitForTimeout(1000);
            }

        } catch (error) {
            console.error('❌ Pagination research failed:', error.message);
        }
    }

    async researchAuthentication(page) {
        console.log('\n🔐 4. RESEARCHING AUTHENTICATION');
        console.log('===============================');

        try {
            // Check if we can access data without login
            const baseUrl = 'https://www.fanaticscollect.com/weekly-auction?type=WEEKLY&category=Trading+Card+Games+%3E+Pok%C3%A9mon+(English)&page=1';
            await page.goto(baseUrl, { waitUntil: 'networkidle' });

            const authAnalysis = await page.evaluate(() => {
                // Look for login elements
                const loginButtons = Array.from(document.querySelectorAll('*')).filter(el => 
                    el.textContent && el.textContent.toLowerCase().includes('log in')
                );

                // Look for price information
                const priceElements = Array.from(document.querySelectorAll('*')).filter(el =>
                    el.textContent && (el.textContent.includes('$') || el.textContent.includes('bid'))
                );

                // Look for restricted content indicators
                const restrictedIndicators = Array.from(document.querySelectorAll('*')).filter(el =>
                    el.textContent && (
                        el.textContent.toLowerCase().includes('login to see') ||
                        el.textContent.toLowerCase().includes('member only') ||
                        el.textContent.toLowerCase().includes('sign in')
                    )
                );

                return {
                    loginButtonCount: loginButtons.length,
                    priceElementCount: priceElements.length,
                    restrictedIndicators: restrictedIndicators.length,
                    samplePrices: priceElements.slice(0, 5).map(el => el.textContent.trim()),
                    needsLogin: loginButtons.length > priceElements.length
                };
            });

            this.findings.authentication = authAnalysis;
            console.log(`✅ Authentication analysis complete`);
            console.log(`   Login buttons: ${authAnalysis.loginButtonCount}`);
            console.log(`   Price elements: ${authAnalysis.priceElementCount}`);
            console.log(`   Needs login: ${authAnalysis.needsLogin}`);

        } catch (error) {
            console.error('❌ Authentication research failed:', error.message);
        }
    }

    async researchFilters(page) {
        console.log('\n🔍 5. RESEARCHING FILTER OPTIONS');
        console.log('===============================');

        try {
            await page.goto('https://www.fanaticscollect.com/weekly-auction', { waitUntil: 'networkidle' });

            const filterAnalysis = await page.evaluate(() => {
                // Look for filter elements
                const filterSelectors = [
                    'select',
                    '[class*="filter"]',
                    '[class*="sort"]',
                    '[data-testid*="filter"]',
                    '[name*="category"]',
                    '[name*="sort"]'
                ];

                const filters = {};
                for (const selector of filterSelectors) {
                    const elements = Array.from(document.querySelectorAll(selector));
                    if (elements.length > 0) {
                        filters[selector] = elements.map(el => ({
                            tag: el.tagName,
                            name: el.name || el.className,
                            options: el.tagName === 'SELECT' ? 
                                Array.from(el.options).map(opt => ({ value: opt.value, text: opt.textContent })) :
                                el.textContent.trim()
                        }));
                    }
                }

                return filters;
            });

            this.findings.filters = filterAnalysis;
            console.log(`✅ Filter analysis complete`);
            console.log(`   Filter types found: ${Object.keys(filterAnalysis).length}`);

        } catch (error) {
            console.error('❌ Filter research failed:', error.message);
        }
    }

    async researchApiPatterns(page, networkRequests) {
        console.log('\n🌐 6. ANALYZING API PATTERNS');
        console.log('===========================');

        // Analyze captured network requests
        const apiRequests = networkRequests.filter(req => 
            req.url.includes('/api/') || 
            req.url.includes('/graphql') ||
            req.method === 'POST' ||
            req.url.includes('auction') ||
            req.url.includes('search')
        );

        this.findings.apiEndpoints = apiRequests.map(req => ({
            url: req.url,
            method: req.method,
            hasPostData: !!req.postData,
            postDataSample: req.postData ? req.postData.substring(0, 200) : null
        }));

        console.log(`✅ Found ${apiRequests.length} potential API endpoints`);
        apiRequests.forEach((req, i) => {
            console.log(`   ${i + 1}. ${req.method} ${req.url.substring(0, 80)}...`);
        });
    }

    async generateRecommendations() {
        console.log('\n💡 7. GENERATING RECOMMENDATIONS');
        console.log('===============================');

        const recommendations = [];

        // Analyze findings and generate recommendations
        if (this.findings.authentication.needsLogin) {
            recommendations.push({
                priority: 'HIGH',
                issue: 'Authentication Required',
                solution: 'Need to implement login flow or find public endpoints'
            });
        }

        if (this.findings.pagination.structure?.found) {
            const maxPage = Math.max(...this.findings.pagination.structure.totalPages.map(p => parseInt(p) || 0));
            recommendations.push({
                priority: 'HIGH',
                issue: 'Full Pagination',
                solution: `Implement full pagination across ${maxPage} pages instead of just 1-2 pages`
            });
        }

        // Check for Top 200 filter limitation
        const hasTopFilter = Object.values(this.findings.pagination).some(p => 
            p.url && p.url.includes('Top+200')
        );
        
        if (hasTopFilter) {
            recommendations.push({
                priority: 'CRITICAL',
                issue: 'Top 200 Filter Limitation',
                solution: 'Remove "featured=filter-Pokemon:+Top+200" parameter to access all Pokemon cards'
            });
        }

        // API optimization
        if (this.findings.apiEndpoints.length > 0) {
            recommendations.push({
                priority: 'MEDIUM',
                issue: 'Direct API Access',
                solution: 'Use GraphQL/API endpoints directly instead of HTML parsing for better performance'
            });
        }

        this.findings.recommendations = recommendations;

        console.log('📋 Recommendations generated:');
        recommendations.forEach((rec, i) => {
            console.log(`   ${i + 1}. [${rec.priority}] ${rec.issue}`);
            console.log(`      Solution: ${rec.solution}`);
        });
    }

    async saveFindings() {
        const timestamp = Date.now();
        const filename = `fanatics-research-findings-${timestamp}.json`;
        
        fs.writeFileSync(filename, JSON.stringify(this.findings, null, 2));
        console.log(`\n💾 Research findings saved to: ${filename}`);
        console.log(`📊 Total findings: ${Object.keys(this.findings).length} categories`);
    }
}

// Run the research
const researcher = new FanaticsResearcher();
researcher.research().catch(console.error);
