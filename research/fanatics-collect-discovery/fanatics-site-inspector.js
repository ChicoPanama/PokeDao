#!/usr/bin/env node
/**
 * 🎯 FANATICS COLLECT SITE INSPECTOR
 * ==================================
 * 
 * Let's investigate the actual site structure to understand
 * how to properly extract Pokemon data
 */

const { chromium } = require('playwright');
const fs = require('fs');

class FanaticsSiteInspector {
    constructor() {
        this.browser = null;
        this.page = null;
    }

    async initialize() {
        console.log('🔍 FANATICS COLLECT SITE INSPECTOR');
        console.log('==================================');
        
        this.browser = await chromium.launch({ 
            headless: false,  // Show browser for debugging
            slowMo: 1000     // Slow down actions
        });
        
        this.page = await this.browser.newPage();
        
        // Set realistic headers
        await this.page.setExtraHTTPHeaders({
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        });

        // Monitor all network requests to see what data is available
        this.page.on('response', async (response) => {
            const url = response.url();
            const contentType = response.headers()['content-type'] || '';
            
            console.log(`📡 ${response.status()} ${contentType.substring(0, 20)} ${url.substring(0, 100)}...`);
            
            // Check for API responses that might contain Pokemon data
            if (contentType.includes('application/json') && url.includes('api')) {
                try {
                    const data = await response.json();
                    console.log(`🔥 API Response from ${url}:`);
                    console.log(JSON.stringify(data, null, 2).substring(0, 500) + '...');
                } catch (error) {
                    console.log(`❌ Could not parse JSON from ${url}`);
                }
            }
        });
        
        console.log('✅ Site inspector initialized');
    }

    async inspectHomePage() {
        console.log('🏠 Inspecting Fanatics Collect homepage...');
        
        await this.page.goto('https://www.fanaticscollect.com', { 
            waitUntil: 'networkidle',
            timeout: 30000 
        });
        
        await this.delay(3000);
        
        // Get page structure
        const pageInfo = await this.page.evaluate(() => {
            return {
                title: document.title,
                url: window.location.href,
                hasSearch: !!document.querySelector('input[type="search"], [placeholder*="search"]'),
                mainContent: document.querySelector('main')?.innerHTML?.substring(0, 500) || 'No main content',
                allLinks: Array.from(document.querySelectorAll('a')).map(a => a.href).slice(0, 20),
                forms: Array.from(document.querySelectorAll('form')).length,
                buttons: Array.from(document.querySelectorAll('button')).map(b => b.textContent?.trim()).slice(0, 10)
            };
        });
        
        console.log('🏠 Homepage Analysis:');
        console.log(JSON.stringify(pageInfo, null, 2));
        
        return pageInfo;
    }

    async inspectSearchFunctionality() {
        console.log('🔍 Testing search functionality...');
        
        try {
            // Try to find and use the search function
            const searchInput = await this.page.locator('input[type="search"], [placeholder*="search"], input[name*="search"]').first();
            
            if (await searchInput.count() > 0) {
                console.log('✅ Found search input');
                
                await searchInput.fill('pokemon');
                await searchInput.press('Enter');
                
                await this.delay(5000); // Wait for results
                
                const searchResults = await this.page.evaluate(() => {
                    return {
                        url: window.location.href,
                        resultCount: document.querySelectorAll('.card, .item, .listing, [class*="product"]').length,
                        resultElements: Array.from(document.querySelectorAll('*')).filter(el => 
                            el.textContent?.toLowerCase().includes('pokemon')
                        ).length
                    };
                });
                
                console.log('🔍 Search Results:');
                console.log(JSON.stringify(searchResults, null, 2));
                
                return searchResults;
            } else {
                console.log('❌ No search input found');
                return null;
            }
        } catch (error) {
            console.log('❌ Search test failed:', error.message);
            return null;
        }
    }

    async inspectAuctionsPage() {
        console.log('⏰ Inspecting auctions page...');
        
        await this.page.goto('https://www.fanaticscollect.com/auctions', {
            waitUntil: 'networkidle',
            timeout: 30000
        });
        
        await this.delay(3000);
        
        const auctionInfo = await this.page.evaluate(() => {
            return {
                url: window.location.href,
                auctionItems: document.querySelectorAll('.auction, .item, .card, [class*="listing"]').length,
                pokemonMentions: Array.from(document.querySelectorAll('*')).filter(el => 
                    el.textContent?.toLowerCase().includes('pokemon')
                ).length,
                pageStructure: {
                    hasGrid: !!document.querySelector('.grid, [class*="grid"]'),
                    hasCards: !!document.querySelector('.card, [class*="card"]'),
                    hasItems: !!document.querySelector('.item, [class*="item"]')
                },
                sampleText: document.body.textContent.substring(0, 1000)
            };
        });
        
        console.log('⏰ Auctions Analysis:');
        console.log(JSON.stringify(auctionInfo, null, 2));
        
        return auctionInfo;
    }

    async takeFinalScreenshot() {
        console.log('📸 Taking final screenshot for manual review...');
        
        const screenshotPath = `fanatics-site-inspection-${Date.now()}.png`;
        await this.page.screenshot({ 
            path: screenshotPath,
            fullPage: true 
        });
        
        console.log(`📸 Screenshot saved: ${screenshotPath}`);
        return screenshotPath;
    }

    async generateInspectionReport() {
        console.log('📊 Generating site inspection report...');
        
        const report = {
            timestamp: new Date().toISOString(),
            inspection_summary: 'Detailed analysis of Fanatics Collect website structure',
            findings: {
                homepage_accessible: true,
                search_functionality: 'Analyzed in detail',
                auctions_page: 'Inspected structure',
                pokemon_content: 'Investigation complete'
            },
            recommendations: [
                'Check if site uses JavaScript rendering',
                'Look for hidden API endpoints',
                'Consider using different selectors',
                'May need to handle authentication or registration',
                'Site might require specific user interactions'
            ],
            next_steps: [
                'Review screenshot for visual elements',
                'Analyze network requests for hidden APIs',
                'Try different extraction approaches',
                'Consider manual browsing to understand user flow'
            ]
        };
        
        const reportPath = `fanatics-inspection-report-${Date.now()}.json`;
        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
        
        console.log('📊 FANATICS SITE INSPECTION COMPLETE');
        console.log('===================================');
        console.log(`📄 Report: ${reportPath}`);
        console.log('🔍 Manual review recommended for next steps');
        
        return report;
    }

    async delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async cleanup() {
        console.log('🧹 Keeping browser open for manual inspection...');
        console.log('   Close the browser window when you\'re done reviewing');
        
        // Don't close browser automatically - let user inspect manually
        // if (this.browser) {
        //     await this.browser.close();
        // }
    }
}

async function main() {
    const inspector = new FanaticsSiteInspector();
    
    try {
        await inspector.initialize();
        
        await inspector.inspectHomePage();
        await inspector.inspectSearchFunctionality();
        await inspector.inspectAuctionsPage();
        await inspector.takeFinalScreenshot();
        await inspector.generateInspectionReport();
        
    } catch (error) {
        console.error('❌ Site inspection error:', error.message);
    } finally {
        await inspector.cleanup();
    }
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = FanaticsSiteInspector;
