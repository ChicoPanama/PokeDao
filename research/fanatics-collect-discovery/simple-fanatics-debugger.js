/**
 * SIMPLE FANATICS DEBUGGING TEST
 * ==============================
 * 
 * Simplified test to debug selector and extraction issues
 * Focus on getting basic data extraction working first
 */

const { chromium } = require('playwright');
const fs = require('fs');

class SimpleFanaticsDebugger {
    constructor() {
        this.url = 'https://www.fanaticscollect.com/weekly-auction?category=Trading+Card+Games+%3E+Pok%C3%A9mon+(English),Trading+Card+Games+%3E+Pok%C3%A9mon+(Japanese),Trading+Card+Games+%3E+Pok%C3%A9mon+(Other+Languages)&type=WEEKLY&itemsPerPage=48&page=1';
    }

    async debug() {
        console.log('🔧 SIMPLE FANATICS DEBUGGING');
        console.log('============================');
        console.log('🎯 Testing basic data extraction');

        const browser = await chromium.launch({ 
            headless: false,
            args: ['--no-sandbox']
        });

        const context = await browser.newContext({
            userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            viewport: { width: 1920, height: 1080 }
        });

        const page = await context.newPage();

        try {
            console.log('\n📄 Loading page...');
            console.log(`URL: ${this.url.substring(0, 80)}...`);

            await page.goto(this.url, { 
                waitUntil: 'domcontentloaded', // Changed from networkidle
                timeout: 45000 
            });

            console.log('✅ Page loaded, waiting for content...');
            await page.waitForTimeout(5000); // Wait for dynamic content

            // Test multiple selectors
            const selectorTests = [
                '[class*="card"]',
                '[class*="item"]', 
                '[class*="auction"]',
                '[class*="lot"]',
                '[data-testid*="item"]',
                '.group', // From research findings
                'div[class*="group"]'
            ];

            console.log('\n🔍 Testing selectors:');
            for (const selector of selectorTests) {
                const count = await page.evaluate((sel) => {
                    return document.querySelectorAll(sel).length;
                }, selector);
                console.log(`   ${selector}: ${count} elements`);
            }

            // Get page info
            const pageInfo = await page.evaluate(() => ({
                title: document.title,
                bodyLength: document.body.innerText.length,
                hasPokemon: document.body.innerText.toLowerCase().includes('pokemon'),
                hasPrice: document.body.innerText.includes('$'),
                url: window.location.href
            }));

            console.log('\n📊 Page Analysis:');
            console.log(`   Title: ${pageInfo.title}`);
            console.log(`   Body length: ${pageInfo.bodyLength} chars`);
            console.log(`   Has Pokemon: ${pageInfo.hasPokemon}`);
            console.log(`   Has prices: ${pageInfo.hasPrice}`);

            // Try to extract with the best selector
            const bestSelector = '.group'; // From research
            console.log(`\n🎯 Extracting with selector: ${bestSelector}`);

            const cards = await page.evaluate((selector) => {
                const elements = document.querySelectorAll(selector);
                console.log(`Found ${elements.length} elements`);

                return Array.from(elements).slice(0, 10).map((el, index) => {
                    const text = el.textContent || '';
                    const hasPrice = text.includes('$');
                    const hasPokemon = text.toLowerCase().includes('pokemon');
                    
                    return {
                        index: index,
                        text: text.substring(0, 200) + '...',
                        hasPrice: hasPrice,
                        hasPokemon: hasPokemon,
                        className: el.className,
                        tagName: el.tagName
                    };
                });
            }, bestSelector);

            console.log(`\n📦 Extracted ${cards.length} elements:`);
            cards.forEach(card => {
                console.log(`   ${card.index}: ${card.hasPokemon ? '🎴' : '❌'} ${card.hasPrice ? '💰' : '❌'} ${card.text.substring(0, 60)}...`);
            });

            // Save debug results
            const selectorCounts = [];
            for (const sel of selectorTests) {
                const count = await page.evaluate((s) => document.querySelectorAll(s).length, sel);
                selectorCounts.push({ selector: sel, count: count });
            }

            const debugResults = {
                timestamp: new Date(),
                url: this.url,
                pageInfo: pageInfo,
                selectorTests: selectorCounts,
                extractedCards: cards
            };

            fs.writeFileSync('fanatics-debug-results.json', JSON.stringify(debugResults, null, 2));
            console.log('\n💾 Debug results saved to: fanatics-debug-results.json');

        } catch (error) {
            console.error('❌ Debug failed:', error);
        } finally {
            await browser.close();
        }
    }
}

const fanaticsDebugger = new SimpleFanaticsDebugger();
fanaticsDebugger.debug().catch(console.error);
