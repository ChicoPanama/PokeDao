#!/usr/bin/env node
/**
 * 🎯 FANATICS SOLD POKEMON EXTRACTOR v2
 * ====================================
 * 
 * Simplified version with reliable "See More" clicking
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');

puppeteer.use(StealthPlugin());

class FanaticsSoldExtractorV2 {
    constructor() {
        this.extractedItems = [];
        this.soldUrl = 'https://sales-history.fanaticscollect.com/?category=Pok%C3%A9mon';
    }

    async extractAll() {
        console.log('🎯 FANATICS SOLD POKEMON EXTRACTOR v2');
        console.log('====================================');
        
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
            
            let clickCount = 0;
            const maxClicks = 50; // Reasonable limit
            
            while (clickCount < maxClicks) {
                console.log(`\n📊 Round ${clickCount + 1}: Extracting current page data...`);
                
                // First, scroll to make sure all visible content is loaded
                await this.scrollToLoadAll(page);
                
                // Extract current items
                const currentItems = await this.extractCurrentItems(page);
                const newItems = this.filterNewItems(currentItems);
                
                if (newItems.length > 0) {
                    this.extractedItems.push(...newItems);
                    console.log(`✅ Added ${newItems.length} new items (Total: ${this.extractedItems.length})`);
                } else {
                    console.log(`⚠️ No new items found in this round`);
                }
                
                // Try to click "See More"
                console.log(`🔄 Attempting "See More" click...`);
                
                // Scroll to bottom first to make sure button is visible
                await page.evaluate(() => {
                    window.scrollTo(0, document.body.scrollHeight);
                });
                await new Promise(resolve => setTimeout(resolve, 1000));
                
                const clicked = await page.evaluate(() => {
                    // Look for "SEE MORE" button - be very specific
                    const elements = Array.from(document.querySelectorAll('button, a, div, span'));
                    
                    for (const element of elements) {
                        const text = element.textContent?.trim();
                        if (text === 'SEE MORE' || text === 'See More' || text === 'LOAD MORE' || text === 'Load More') {
                            // Check if it's visible and clickable
                            const rect = element.getBoundingClientRect();
                            if (rect.width > 0 && rect.height > 0 && element.offsetParent !== null && 
                                rect.top >= 0 && rect.top <= window.innerHeight) {
                                console.log(`Found and clicking button: "${text}" at position (${rect.top}, ${rect.left})`);
                                
                                // Scroll element into view and click
                                element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                setTimeout(() => element.click(), 500);
                                return true;
                            }
                        }
                    }
                    
                    console.log('No SEE MORE button found in current view');
                    return false;
                });
                
                if (!clicked) {
                    console.log('❌ No "See More" button found - extraction complete');
                    break;
                }
                
                console.log('✅ Successfully clicked "See More" - scrolling to load new content...');
                
                // Scroll down to trigger loading of new cards
                await page.evaluate(async () => {
                    await new Promise((resolve) => {
                        let totalHeight = 0;
                        const distance = 200;
                        const timer = setInterval(() => {
                            const scrollHeight = document.body.scrollHeight;
                            window.scrollBy(0, distance);
                            totalHeight += distance;

                            if (totalHeight >= scrollHeight) {
                                clearInterval(timer);
                                resolve();
                            }
                        }, 100);
                    });
                });
                
                // Wait for new content to load after scrolling
                await new Promise(resolve => setTimeout(resolve, 5000));
                
                clickCount++;
                
                // Save progress every 10 clicks
                if (clickCount % 10 === 0) {
                    this.saveProgress(clickCount);
                }
            }
            
        } finally {
            await browser.close();
        }
        
        this.generateFinalReport();
        return this.extractedItems;
    }

    async extractCurrentItems(page) {
        return await page.evaluate(() => {
            const items = [];
            const processedTexts = new Set();
            
            // Look for all elements that might contain Pokemon sold data
            const allElements = document.querySelectorAll('*');
            
            allElements.forEach((element, index) => {
                const text = element.textContent?.toLowerCase() || '';
                
                // Filter for Pokemon content with prices
                if (text.includes('pokemon') && 
                    text.includes('$') && 
                    text.length > 50 && 
                    text.length < 1500 &&
                    !text.includes('sold items include') &&
                    text.includes('sold on')) {
                    
                    const signature = text.substring(0, 100);
                    if (!processedTexts.has(signature)) {
                        processedTexts.add(signature);
                        
                        // Extract data
                        const priceMatch = text.match(/\$[\d,]+\.?\d*/);
                        const dateMatch = text.match(/sold on ([^\\n]*)/i);
                        const gradingMatch = text.match(/(psa|bgs|cgc|pcg)\\s*(\\d+(?:\\.\\d+)?)/i);
                        
                        // Try to get a clean card name
                        let cardName = text;
                        
                        // Remove price and date info to get cleaner name
                        cardName = cardName.replace(/\$[\d,]+\.?\d*/, '');
                        cardName = cardName.replace(/sold on [^\\n]*/i, '');
                        cardName = cardName.replace(/in buy now/i, '');
                        cardName = cardName.trim();
                        
                        // Take first reasonable part as name
                        const nameParts = cardName.split('\\n').filter(part => 
                            part.length > 10 && 
                            part.toLowerCase().includes('pokemon') &&
                            !part.includes('$')
                        );
                        
                        const finalName = nameParts[0] || cardName.substring(0, 200);
                        
                        const item = {
                            id: `fanatics-sold-v2-${Date.now()}-${index}`,
                            name: finalName.trim(),
                            sold_price: priceMatch?.[0],
                            sold_date: dateMatch?.[1]?.trim(),
                            grading_service: gradingMatch?.[1]?.toUpperCase(),
                            grade: gradingMatch?.[2] ? parseFloat(gradingMatch[2]) : null,
                            raw_text: text.substring(0, 500),
                            extraction_method: 'fanatics_sold_v2'
                        };
                        
                        if (item.name && item.sold_price && item.name.length > 5) {
                            items.push(item);
                        }
                    }
                }
            });
            
            console.log(`Extracted ${items.length} items from current page`);
            return items;
        });
    }

    async scrollToLoadAll(page) {
        console.log('   📜 Scrolling to ensure all content is loaded...');
        
        await page.evaluate(async () => {
            // Scroll to bottom to trigger any lazy loading
            await new Promise((resolve) => {
                let totalHeight = 0;
                const distance = 150;
                const timer = setInterval(() => {
                    const scrollHeight = document.body.scrollHeight;
                    window.scrollBy(0, distance);
                    totalHeight += distance;

                    if (totalHeight >= scrollHeight) {
                        clearInterval(timer);
                        // Scroll back to top
                        window.scrollTo(0, 0);
                        resolve();
                    }
                }, 50);
            });
        });
        
        // Wait for any lazy-loaded content
        await new Promise(resolve => setTimeout(resolve, 2000));
    }

    filterNewItems(currentItems) {
        // Simple deduplication by name and price
        return currentItems.filter(item => {
            const exists = this.extractedItems.some(existing => 
                existing.name === item.name && 
                existing.sold_price === item.sold_price
            );
            return !exists;
        });
    }

    saveProgress(clicks) {
        const progressData = {
            clicks_completed: clicks,
            total_items: this.extractedItems.length,
            timestamp: new Date().toISOString(),
            latest_items: this.extractedItems.slice(-5)
        };
        
        fs.writeFileSync(`progress-${clicks}-clicks.json`, JSON.stringify(progressData, null, 2));
        fs.writeFileSync('fanatics-sold-v2-all-items.json', JSON.stringify(this.extractedItems, null, 2));
        
        console.log(`💾 Progress saved: ${this.extractedItems.length} items after ${clicks} clicks`);
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
            
            // Price analysis
            price_stats: {
                min: prices[0] || 0,
                max: prices[prices.length - 1] || 0,
                average: prices.length > 0 ? (prices.reduce((a, b) => a + b, 0) / prices.length).toFixed(2) : 0,
                median: prices[Math.floor(prices.length / 2)] || 0
            },
            
            // Grading analysis
            graded_items: this.extractedItems.filter(i => i.grade).length,
            
            // High value samples
            high_value_sales: this.extractedItems
                .filter(i => i.sold_price)
                .sort((a, b) => parseFloat(b.sold_price.replace(/[$,]/g, '')) - parseFloat(a.sold_price.replace(/[$,]/g, '')))
                .slice(0, 20),
                
            // Recent samples
            recent_sales: this.extractedItems.slice(-20)
        };
        
        // Save files
        fs.writeFileSync('fanatics-sold-v2-final-report.json', JSON.stringify(report, null, 2));
        fs.writeFileSync('fanatics-sold-v2-all-data.json', JSON.stringify(this.extractedItems, null, 2));
        
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
        
        fs.writeFileSync('fanatics-sold-v2.csv', csv);
        
        console.log(`\\n🎉 EXTRACTION COMPLETE!`);
        console.log(`📊 Total Items: ${report.total_sold_items}`);
        console.log(`💰 Price Range: $${report.price_stats.min} - $${report.price_stats.max}`);
        console.log(`🏆 Graded Items: ${report.graded_items}`);
        console.log(`📁 Files: fanatics-sold-v2-*.json, fanatics-sold-v2.csv`);
    }
}

async function main() {
    const extractor = new FanaticsSoldExtractorV2();
    await extractor.extractAll();
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = FanaticsSoldExtractorV2;
