#!/usr/bin/env node
/**
 * 🎯 FANATICS SOLD POKEMON MEGA-EXTRACTOR
 * ======================================
 * 
 * Extracts ALL historical sold Pokemon data with aggressive "See More" detection
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');

puppeteer.use(StealthPlugin());

class FanaticsMegaExtractor {
    constructor() {
        this.extractedItems = [];
        this.soldUrl = 'https://sales-history.fanaticscollect.com/?category=Pok%C3%A9mon';
    }

    async extractMegaData() {
        console.log('🎯 FANATICS POKEMON MEGA-EXTRACTOR');
        console.log('==================================');
        console.log('🚀 AGGRESSIVE "SEE MORE" DETECTION ENABLED');
        
        const browser = await puppeteer.launch({
            headless: false,
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
            defaultViewport: { width: 1400, height: 1000 }
        });

        const page = await browser.newPage();
        
        try {
            console.log('📡 Loading sold items page...');
            await page.goto(this.soldUrl, { waitUntil: 'networkidle2', timeout: 30000 });
            await new Promise(resolve => setTimeout(resolve, 5000));
            
            let round = 0;
            const maxRounds = 100; // Generous limit
            
            while (round < maxRounds) {
                round++;
                console.log(`\n🔄 ROUND ${round}: Extracting data...`);
                
                // Extract current items
                await this.scrollAndExtract(page);
                
                // Aggressive "See More" detection
                console.log(`🎯 Attempting "See More" detection (Round ${round})...`);
                const moreButtonFound = await this.aggressiveSeeMoreClick(page);
                
                if (!moreButtonFound) {
                    console.log('❌ No more data to load - extraction complete');
                    break;
                }
                
                console.log('✅ Successfully loaded more data - continuing...');
                
                // Save progress frequently
                if (round % 5 === 0) {
                    this.saveProgress(round);
                }
            }
            
        } finally {
            await browser.close();
        }
        
        this.generateFinalReport();
        return this.extractedItems;
    }

    async scrollAndExtract(page) {
        // Comprehensive scrolling to load all content
        await page.evaluate(async () => {
            // Multiple scroll strategies
            
            // 1. Scroll to bottom
            window.scrollTo(0, document.body.scrollHeight);
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // 2. Gradual scroll with pauses
            await new Promise((resolve) => {
                let scrollTop = 0;
                const scrollHeight = document.body.scrollHeight;
                const scrollStep = 300;
                const scrollDelay = 200;
                
                const scrollInterval = setInterval(() => {
                    window.scrollTo(0, scrollTop);
                    scrollTop += scrollStep;
                    
                    if (scrollTop >= scrollHeight) {
                        clearInterval(scrollInterval);
                        resolve();
                    }
                }, scrollDelay);
            });
            
            // 3. Scroll back to top
            window.scrollTo(0, 0);
            await new Promise(resolve => setTimeout(resolve, 500));
        });
        
        // Extract after comprehensive scrolling
        const currentItems = await this.extractItems(page);
        const newItems = this.filterNewItems(currentItems);
        
        if (newItems.length > 0) {
            this.extractedItems.push(...newItems);
            console.log(`   ✅ Added ${newItems.length} new items (Total: ${this.extractedItems.length})`);
        } else {
            console.log(`   ⚠️ No new items found (Total remains: ${this.extractedItems.length})`);
        }
    }

    async aggressiveSeeMoreClick(page) {
        // Strategy 1: Scroll to bottom and look for button
        await page.evaluate(() => {
            window.scrollTo(0, document.body.scrollHeight);
        });
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Strategy 2: Screenshot for debugging
        await page.screenshot({ 
            path: `debug-see-more-round-${Math.floor(Date.now() / 1000)}.png`,
            fullPage: false 
        });
        
        // Strategy 3: Multiple detection methods
        const clickResult = await page.evaluate(() => {
            const strategies = [
                // Strategy A: Exact text match
                () => {
                    const buttons = Array.from(document.querySelectorAll('*'));
                    for (const btn of buttons) {
                        const text = btn.textContent?.trim();
                        if (text === 'SEE MORE' || text === 'See More' || text === 'LOAD MORE' || text === 'Show More') {
                            const rect = btn.getBoundingClientRect();
                            if (rect.height > 0 && btn.offsetParent !== null) {
                                console.log(`Strategy A: Found "${text}" button`);
                                btn.click();
                                return true;
                            }
                        }
                    }
                    return false;
                },
                
                // Strategy B: Button/link elements with "more" text
                () => {
                    const selectors = ['button', 'a', '[role="button"]', 'div[onclick]', 'span[onclick]'];
                    for (const selector of selectors) {
                        const elements = document.querySelectorAll(selector);
                        for (const el of elements) {
                            const text = el.textContent?.toLowerCase() || '';
                            if (text.includes('more') || text.includes('load')) {
                                const rect = el.getBoundingClientRect();
                                if (rect.height > 0 && el.offsetParent !== null) {
                                    console.log(`Strategy B: Clicking "${el.textContent}" (${selector})`);
                                    el.click();
                                    return true;
                                }
                            }
                        }
                    }
                    return false;
                },
                
                // Strategy C: Elements with "more" in class name
                () => {
                    const elements = document.querySelectorAll('[class*="more"], [class*="load"], [class*="show"]');
                    for (const el of elements) {
                        const rect = el.getBoundingClientRect();
                        if (rect.height > 0 && el.offsetParent !== null) {
                            console.log(`Strategy C: Clicking element with class "${el.className}"`);
                            el.click();
                            return true;
                        }
                    }
                    return false;
                },
                
                // Strategy D: Look for pagination or load buttons
                () => {
                    const pagingElements = document.querySelectorAll('[class*="pag"], [class*="next"], [id*="more"], [id*="load"]');
                    for (const el of pagingElements) {
                        if (el.offsetParent !== null && !el.disabled) {
                            console.log(`Strategy D: Clicking pagination element "${el.textContent}" (${el.tagName})`);
                            el.click();
                            return true;
                        }
                    }
                    return false;
                }
            ];
            
            // Try each strategy
            for (let i = 0; i < strategies.length; i++) {
                try {
                    if (strategies[i]()) {
                        return { success: true, strategy: i + 1 };
                    }
                } catch (error) {
                    console.log(`Strategy ${i + 1} error: ${error.message}`);
                }
            }
            
            return { success: false, strategy: 0 };
        });
        
        if (clickResult.success) {
            console.log(`   ✅ Success with Strategy ${clickResult.strategy} - waiting for new content...`);
            
            // Wait and scroll to load new content
            await new Promise(resolve => setTimeout(resolve, 3000));
            
            await page.evaluate(async () => {
                // Scroll to bottom to trigger loading
                window.scrollTo(0, document.body.scrollHeight);
                await new Promise(resolve => setTimeout(resolve, 2000));
                
                // Scroll through new content
                await new Promise((resolve) => {
                    let currentScroll = window.pageYOffset;
                    const scrollStep = 200;
                    const scrollDelay = 100;
                    
                    const scrollInterval = setInterval(() => {
                        window.scrollBy(0, scrollStep);
                        const newScroll = window.pageYOffset;
                        
                        if (newScroll === currentScroll) {
                            // No more scrolling possible
                            clearInterval(scrollInterval);
                            resolve();
                        }
                        currentScroll = newScroll;
                    }, scrollDelay);
                });
            });
            
            await new Promise(resolve => setTimeout(resolve, 2000));
            return true;
            
        } else {
            console.log('   ❌ All strategies failed to find "See More" button');
            return false;
        }
    }

    async extractItems(page) {
        return await page.evaluate(() => {
            const items = [];
            const processedTexts = new Set();
            
            // Get all text elements
            const allElements = document.querySelectorAll('*');
            
            allElements.forEach((element, index) => {
                const text = element.textContent?.toLowerCase() || '';
                
                // Look for Pokemon sold items
                if (text.includes('pokemon') && 
                    text.includes('$') && 
                    text.includes('sold on') &&
                    text.length > 40 && 
                    text.length < 2000) {
                    
                    const signature = text.substring(0, 150);
                    if (!processedTexts.has(signature)) {
                        processedTexts.add(signature);
                        
                        // Extract data
                        const priceMatch = text.match(/\$[\d,]+\.?\d*/);
                        const dateMatch = text.match(/sold on ([^\\n]*?)(?:in|$)/i);
                        const gradingMatch = text.match(/(psa|bgs|cgc|pcg)\\s*(\\d+(?:\\.\\d+)?)/i);
                        
                        // Clean card name
                        let cardName = text
                            .replace(/\$[\d,]+\.?\d*/, '')
                            .replace(/sold on [^\\n]*$/i, '')
                            .replace(/in buy now$/i, '')
                            .replace(/cgc \\d+.*$/i, '')
                            .replace(/psa \\d+.*$/i, '')
                            .replace(/bgs \\d+.*$/i, '')
                            .trim();
                        
                        // Take first reasonable part
                        const cleanParts = cardName.split('\\n').filter(part => 
                            part.length > 10 && 
                            part.toLowerCase().includes('pokemon') &&
                            !part.includes('$')
                        );
                        
                        const finalName = cleanParts[0] || cardName.substring(0, 250);
                        
                        const item = {
                            id: `fanatics-mega-${Date.now()}-${index}`,
                            name: finalName.trim(),
                            sold_price: priceMatch?.[0],
                            sold_date: dateMatch?.[1]?.trim(),
                            grading_service: gradingMatch?.[1]?.toUpperCase(),
                            grade: gradingMatch?.[2] ? parseFloat(gradingMatch[2]) : null,
                            raw_text: text.substring(0, 400),
                            extraction_method: 'fanatics_mega_v1'
                        };
                        
                        if (item.name && item.sold_price && item.name.length > 10) {
                            items.push(item);
                        }
                    }
                }
            });
            
            return items;
        });
    }

    filterNewItems(currentItems) {
        return currentItems.filter(item => {
            const exists = this.extractedItems.some(existing => 
                existing.name.substring(0, 100) === item.name.substring(0, 100) && 
                existing.sold_price === item.sold_price
            );
            return !exists;
        });
    }

    saveProgress(round) {
        const progressData = {
            round: round,
            total_items: this.extractedItems.length,
            timestamp: new Date().toISOString(),
            latest_items: this.extractedItems.slice(-3)
        };
        
        fs.writeFileSync(`mega-progress-${round}.json`, JSON.stringify(progressData, null, 2));
        fs.writeFileSync('fanatics-mega-all-items.json', JSON.stringify(this.extractedItems, null, 2));
        
        console.log(`💾 Progress saved: ${this.extractedItems.length} items after ${round} rounds`);
    }

    generateFinalReport() {
        const prices = this.extractedItems
            .map(item => parseFloat(item.sold_price?.replace(/[$,]/g, '') || '0'))
            .filter(p => p > 0)
            .sort((a, b) => a - b);
        
        const report = {
            extraction_complete: true,
            timestamp: new Date().toISOString(),
            total_sold_items: this.extractedItems.length,
            
            price_stats: {
                min: prices[0] || 0,
                max: prices[prices.length - 1] || 0,
                average: prices.length > 0 ? (prices.reduce((a, b) => a + b, 0) / prices.length).toFixed(2) : 0,
                median: prices[Math.floor(prices.length / 2)] || 0
            },
            
            graded_items: this.extractedItems.filter(i => i.grade).length,
            
            high_value_sales: this.extractedItems
                .filter(i => i.sold_price)
                .sort((a, b) => parseFloat(b.sold_price.replace(/[$,]/g, '')) - parseFloat(a.sold_price.replace(/[$,]/g, '')))
                .slice(0, 50) // Top 50 highest sales
        };
        
        // Save files
        fs.writeFileSync('fanatics-mega-final-report.json', JSON.stringify(report, null, 2));
        fs.writeFileSync('fanatics-mega-all-data.json', JSON.stringify(this.extractedItems, null, 2));
        
        // CSV
        const headers = ['ID', 'Name', 'Sold_Price', 'Sold_Date', 'Grading_Service', 'Grade'];
        let csv = headers.join(',') + '\\n';
        
        this.extractedItems.forEach(item => {
            const row = [
                item.id,
                `"${(item.name || '').replace(/"/g, '""')}"`,
                item.sold_price || '',
                item.sold_date || '',
                item.grading_service || '',
                item.grade || ''
            ];
            csv += row.join(',') + '\\n';
        });
        
        fs.writeFileSync('fanatics-mega-sold-pokemon.csv', csv);
        
        console.log(`\\n🎉 MEGA EXTRACTION COMPLETE!`);
        console.log(`📊 Total Items: ${report.total_sold_items}`);
        console.log(`💰 Price Range: $${report.price_stats.min} - $${report.price_stats.max}`);
        console.log(`🏆 Graded Items: ${report.graded_items}`);
        console.log(`📁 Files: fanatics-mega-*.json, fanatics-mega-sold-pokemon.csv`);
        
        if (report.total_sold_items > 0) {
            console.log(`\\n🔥 TOP 5 HIGHEST SALES:`);
            report.high_value_sales.slice(0, 5).forEach((item, i) => {
                console.log(`${i + 1}. ${item.name.substring(0, 60)}... - ${item.sold_price}`);
            });
        }
    }
}

async function main() {
    const extractor = new FanaticsMegaExtractor();
    await extractor.extractMegaData();
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = FanaticsMegaExtractor;
