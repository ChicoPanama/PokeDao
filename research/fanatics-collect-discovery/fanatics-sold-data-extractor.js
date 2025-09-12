#!/usr/bin/env node
/**
 * 🎯 FANATICS SOLD POKEMON EXTRACTOR
 * ==================================
 * 
 * Extracts historical sold Pokemon data from Fanatics Collect
 * Handles "See More" button pagination automatically
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');

puppeteer.use(StealthPlugin());

class FanaticsSoldDataExtractor {
    constructor() {
        this.extractedSoldItems = [];
        this.soldUrl = 'https://sales-history.fanaticscollect.com/?category=Pok%C3%A9mon';
    }

    async extractAllSoldData() {
        console.log('🎯 FANATICS SOLD POKEMON DATA EXTRACTOR');
        console.log('======================================');
        console.log('📊 Extracting ALL historical sold Pokemon data');
        console.log(`🔗 URL: ${this.soldUrl}`);
        
        const browser = await puppeteer.launch({
            headless: false, // Keep visible to monitor progress
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-blink-features=AutomationControlled',
                '--disable-web-security',
                '--window-size=1400,1000'
            ],
            defaultViewport: { width: 1400, height: 1000 }
        });

        const page = await browser.newPage();
        await this.setupStealth(page);
        
        try {
            // Navigate to sold items page
            console.log('📡 Loading sold items page...');
            await page.goto(this.soldUrl, { 
                waitUntil: 'networkidle2',
                timeout: 30000 
            });
            
            // Wait for initial content
            await new Promise(resolve => setTimeout(resolve, 5000));
            
            // Extract initial batch of sold items
            console.log('🎴 Extracting initial sold items...');
            let currentBatch = await this.extractSoldItemsFromPage(page);
            this.extractedSoldItems.push(...currentBatch);
            console.log(`✅ Initial batch: ${currentBatch.length} items`);
            
            // Keep clicking "See More" until no more data
            let clickCount = 0;
            let maxClicks = 100; // Safety limit
            
            while (clickCount < maxClicks) {
                console.log(`\n🔄 Attempting "See More" click #${clickCount + 1}...`);
                
                const moreButtonClicked = await this.clickSeeMore(page);
                
                if (!moreButtonClicked) {
                    console.log('❌ No more "See More" button found - extraction complete');
                    break;
                }
                
                // Wait for new content to load
                console.log('⏳ Waiting for new content to load...');
                await new Promise(resolve => setTimeout(resolve, 4000));
                
                // Extract new items
                const newItems = await this.extractNewSoldItems(page, this.extractedSoldItems.length);
                
                if (newItems.length === 0) {
                    console.log('❌ No new items loaded - may have reached end');
                    break;
                }
                
                this.extractedSoldItems.push(...newItems);
                console.log(`✅ Added ${newItems.length} new items (Total: ${this.extractedSoldItems.length})`);
                
                // Save progress every 10 clicks
                if ((clickCount + 1) % 10 === 0) {
                    this.saveProgress(clickCount + 1);
                }
                
                clickCount++;
                
                // Random delay to avoid detection
                await this.randomDelay(2000, 4000);
            }
            
        } finally {
            await browser.close();
        }
        
        console.log(`\n🎉 SOLD DATA EXTRACTION COMPLETE!`);
        console.log(`📊 Total Sold Pokemon Items: ${this.extractedSoldItems.length}`);
        
        this.generateFinalReport();
        return this.extractedSoldItems;
    }

    async setupStealth(page) {
        await page.evaluateOnNewDocument(() => {
            Object.defineProperty(navigator, 'webdriver', {
                get: () => undefined,
            });
        });
        
        await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    }

    async extractSoldItemsFromPage(page) {
        console.log('   🎴 Extracting sold items from current page...');
        
        const soldItems = await page.evaluate(() => {
            const extractedItems = [];
            
            // Look for sold item containers (based on actual Fanatics sold page structure)
            const itemSelectors = [
                // Main product containers
                'div[data-testid*="product"]',
                'div[data-testid*="item"]',
                'div[data-testid*="card"]',
                // Generic containers
                'div[class*="card"]',
                'div[class*="item"]', 
                'div[class*="product"]',
                'div[class*="sold"]',
                'article',
                // Grid and list containers
                'div[class*="grid"] > div',
                'div[class*="list"] > div',
                'div[class*="container"] > div',
                // Catch-all for any divs with images and text
                'div:has(img)'
            ];
            
            // Strategy 1: Try specific selectors
            for (const selector of itemSelectors) {
                try {
                    const containers = document.querySelectorAll(selector);
                    
                    containers.forEach((container, index) => {
                        const text = container.textContent?.toLowerCase() || '';
                        
                        // Only process if it contains Pokemon, price, and is not generic text
                        if ((text.includes('pokemon') || text.includes('pikachu') || text.includes('charizard')) && 
                            text.includes('$') && 
                            text.length > 50 && 
                            text.length < 1000 &&
                            !text.includes('sold items include sales') && // Skip header text
                            !text === 'sold items') { // Skip generic labels
                            
                            // Extract card name (look for title elements first)
                            let cardName = '';
                            const nameSelectors = ['h1', 'h2', 'h3', 'h4', '[class*="title"]', '[class*="name"]'];
                            
                            for (const nameSelector of nameSelectors) {
                                const nameEl = container.querySelector(nameSelector);
                                if (nameEl?.textContent?.trim()) {
                                    cardName = nameEl.textContent.trim();
                                    break;
                                }
                            }
                            
                            if (!cardName) {
                                // Fallback: extract from main text
                                const lines = text.split('\n').filter(line => 
                                    line.length > 10 && 
                                    line.toLowerCase().includes('pokemon') && 
                                    !line.includes('$') &&
                                    !line.includes('sold on')
                                );
                                cardName = lines[0] || text.substring(0, 150);
                            }
                            
                            // Extract sold price
                            const priceMatch = text.match(/\$[\d,]+\.?\d*/);
                            
                            // Extract sold date
                            const soldDateMatch = text.match(/sold on ([^\\n]+)/i);
                            
                            // Extract grading info
                            const gradingMatch = text.match(/(PSA|BGS|CGC|PCG)\\s*(\\d+(?:\\.\\d+)?)/i);
                            
                            // Get image
                            const img = container.querySelector('img');
                            const imageUrl = img?.src || img?.dataset?.src;
                            
                            // Extract condition/grade details from text
                            const conditionMatch = text.match(/(gem mint|mint|nm|near mint|lp|light play|mp|moderate play|hp|heavy play|damaged|poor)\\+?/i);
                            const populationMatch = text.match(/population (\\d+) of (\\d+)|pop (\\d+)/i);
                            
                            const soldItem = {
                                id: `fanatics-sold-${Date.now()}-${index}`,
                                name: cardName?.trim(),
                                sold_price: priceMatch?.[0],
                                sold_date: soldDateMatch?.[1]?.trim(),
                                grading_service: gradingMatch?.[1],
                                grade: gradingMatch?.[2] ? parseFloat(gradingMatch[2]) : null,
                                condition: conditionMatch?.[1],
                                population_info: populationMatch?.[0],
                                image_url: imageUrl,
                                
                                // Raw data for analysis
                                raw_text: text.substring(0, 600),
                                
                                // Metadata
                                source_url: window.location.href,
                                extracted_at: new Date().toISOString(),
                                extraction_method: 'fanatics_sold_v1',
                                data_type: 'historical_sold'
                            };
                            
                            // Only add if we have meaningful data
                            if (soldItem.name && soldItem.name.length > 5 && soldItem.sold_price) {
                                extractedItems.push(soldItem);
                            }
                        }
                    });
                    
                } catch (error) {
                    console.log(`Selector error: ${error.message}`);
                }
            }
            
            // Strategy 2: Fallback - scan ALL elements for Pokemon content
            if (extractedItems.length === 0) {
                console.log('Using fallback strategy - scanning all elements');
                
                const allElements = document.querySelectorAll('*');
                const processedTexts = new Set();
                
                allElements.forEach((element, index) => {
                    const text = element.textContent?.toLowerCase() || '';
                    
                    // Look for Pokemon content with prices
                    if ((text.includes('pokemon') || text.includes('pikachu') || text.includes('charizard')) && 
                        text.includes('$') && 
                        text.length > 30 && 
                        text.length < 2000) {
                        
                        const textSignature = text.substring(0, 100);
                        if (!processedTexts.has(textSignature)) {
                            processedTexts.add(textSignature);
                            
                            // Extract basic info
                            const priceMatch = text.match(/\$[\d,]+\.?\d*/);
                            const dateMatch = text.match(/sep \d{2}, \d{4}|sold on [^\\n]*/i);
                            
                            if (priceMatch) {
                                const soldItem = {
                                    id: `fanatics-fallback-${Date.now()}-${index}`,
                                    name: text.substring(0, 200).trim(),
                                    sold_price: priceMatch[0],
                                    sold_date: dateMatch?.[0],
                                    raw_text: text.substring(0, 500),
                                    source_url: window.location.href,
                                    extracted_at: new Date().toISOString(),
                                    extraction_method: 'fallback_scan',
                                    data_type: 'historical_sold'
                                };
                                
                                extractedItems.push(soldItem);
                            }
                        }
                    }
                });
                
                console.log(`Fallback strategy found ${extractedItems.length} items`);
            }
            
            // Strategy 3: Look for specific Fanatics patterns
            if (extractedItems.length === 0) {
                console.log('Using pattern matching strategy');
                
                const bodyText = document.body.textContent;
                
                // Look for price patterns with Pokemon
                const pricePattern = /\$[\d,]+\.?\d*[^$]*?pokemon[^$]*?(?=\$|$)/gi;
                const matches = bodyText.match(pricePattern);
                
                if (matches) {
                    matches.forEach((match, index) => {
                        const soldItem = {
                            id: `fanatics-pattern-${Date.now()}-${index}`,
                            name: match.substring(0, 150).trim(),
                            sold_price: match.match(/\$[\d,]+\.?\d*/)?.[0],
                            raw_text: match,
                            source_url: window.location.href,
                            extracted_at: new Date().toISOString(),
                            extraction_method: 'pattern_matching',
                            data_type: 'historical_sold'
                        };
                        
                        if (soldItem.sold_price) {
                            extractedItems.push(soldItem);
                        }
                    });
                }
                
                console.log(`Pattern matching found ${matches ? matches.length : 0} additional items`);
            }
            
            console.log(`Total extracted ${extractedItems.length} sold items from current view`);
            return extractedItems;
        });
        
        return soldItems;
    }

    async extractNewSoldItems(page, existingCount) {
        console.log('   🔄 Extracting only NEW sold items after "See More" click...');
        
        const allCurrentItems = await this.extractSoldItemsFromPage(page);
        
        // Filter out items we already have (rough deduplication by name and price)
        const newItems = allCurrentItems.filter(item => {
            const isDuplicate = this.extractedSoldItems.some(existing => 
                existing.name === item.name && 
                existing.sold_price === item.sold_price
            );
            return !isDuplicate;
        });
        
        console.log(`   📊 Found ${allCurrentItems.length} total items, ${newItems.length} are new`);
        
        return newItems;
    }

    async clickSeeMore(page) {
        try {
            // Look for "See More" button with various selectors
            const seeMoreFound = await page.evaluate(() => {
                const selectors = [
                    'button:contains("See More")',
                    'button:contains("SEE MORE")',
                    '[class*="more"]',
                    '[class*="load"]',
                    'button[class*="more"]',
                    'button[class*="load"]',
                    // From screenshot, it's likely just "SEE MORE" text
                    'button',
                    'a'
                ];
                
                // First try direct text search - look for exact "SEE MORE" from screenshot
                const allClickable = Array.from(document.querySelectorAll('button, a, div[role="button"], div[onclick], span[onclick], [class*="button"]'));
                
                for (const element of allClickable) {
                    const text = element.textContent?.trim().toLowerCase();
                    if (text === 'see more' || text === 'load more' || text === 'show more' || text === 'more') {
                        console.log(`Found "See More" button with text: "${button.textContent}"`);
                        
                        // Check if button is visible and clickable
                        if (element.offsetParent !== null && !element.disabled && !element.hidden) {
                            console.log(`Clicking button with text: "${element.textContent}"`);
                            
                            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            
                            // Click immediately - no setTimeout needed
                            element.click();
                            
                            return true;
                        }
                    }
                }
                
                // Fallback: try any button that might load more content
                for (const selector of selectors) {
                    try {
                        const elements = document.querySelectorAll(selector);
                        for (const element of elements) {
                            const text = element.textContent?.toLowerCase();
                            if (text && (text.includes('more') || text.includes('load') || text.includes('next'))) {
                                if (element.offsetParent !== null && !element.disabled) {
                                    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                    setTimeout(() => element.click(), 500);
                                    return true;
                                }
                            }
                        }
                    } catch (error) {
                        // Continue trying other selectors
                    }
                }
                
                return false;
            });
            
            if (seeMoreFound) {
                console.log('   ✅ Successfully clicked "See More" button');
                return true;
            } else {
                console.log('   ❌ Could not find "See More" button');
                
                // Take screenshot for debugging
                await page.screenshot({ 
                    path: `debug-see-more-${Date.now()}.png`,
                    fullPage: false 
                });
                
                return false;
            }
            
        } catch (error) {
            console.log(`   ❌ Error clicking "See More": ${error.message}`);
            return false;
        }
    }

    saveProgress(clickNumber) {
        const progressFile = `fanatics-sold-progress-${clickNumber}.json`;
        const progressData = {
            clicks_completed: clickNumber,
            total_sold_items: this.extractedSoldItems.length,
            timestamp: new Date().toISOString(),
            sample_items: this.extractedSoldItems.slice(-5)
        };
        
        fs.writeFileSync(progressFile, JSON.stringify(progressData, null, 2));
        fs.writeFileSync('fanatics-sold-items-progress.json', JSON.stringify(this.extractedSoldItems, null, 2));
        
        console.log(`💾 Progress saved: ${this.extractedSoldItems.length} sold items so far`);
    }

    generateFinalReport() {
        const report = {
            extraction_complete: true,
            timestamp: new Date().toISOString(),
            total_sold_items: this.extractedSoldItems.length,
            data_type: 'historical_sold_pokemon',
            
            // Analysis
            items_with_grades: this.extractedSoldItems.filter(i => i.grade).length,
            items_with_images: this.extractedSoldItems.filter(i => i.image_url).length,
            items_with_dates: this.extractedSoldItems.filter(i => i.sold_date).length,
            
            // Price analysis
            price_range: this.analyzePriceRange(),
            
            // Grading analysis
            grading_services: this.analyzeGradingServices(),
            
            // Recent sales (last 20)
            sample_recent_sales: this.extractedSoldItems.slice(-20),
            
            // High value sales
            sample_high_value: this.extractedSoldItems
                .filter(i => i.sold_price)
                .sort((a, b) => this.parsePrice(b.sold_price) - this.parsePrice(a.sold_price))
                .slice(0, 20)
        };
        
        // Save all files
        fs.writeFileSync('fanatics-sold-pokemon-report.json', JSON.stringify(report, null, 2));
        fs.writeFileSync('fanatics-sold-pokemon-all-items.json', JSON.stringify(this.extractedSoldItems, null, 2));
        
        // Save CSV
        this.saveAsCSV();
        
        console.log(`\n📊 SOLD DATA FINAL STATISTICS:`);
        console.log(`🎴 Total Sold Items: ${report.total_sold_items}`);
        console.log(`🏆 Items with Grades: ${report.items_with_grades}`);
        console.log(`📅 Items with Dates: ${report.items_with_dates}`);
        console.log(`🖼️ Items with Images: ${report.items_with_images}`);
        console.log(`💰 Price Range: $${report.price_range.min} - $${report.price_range.max}`);
        console.log(`📄 Report: fanatics-sold-pokemon-report.json`);
        console.log(`📄 All Data: fanatics-sold-pokemon-all-items.json`);
        console.log(`📊 CSV: fanatics-sold-pokemon.csv`);
    }

    analyzePriceRange() {
        const prices = this.extractedSoldItems
            .map(item => this.parsePrice(item.sold_price))
            .filter(price => price > 0)
            .sort((a, b) => a - b);
            
        if (prices.length === 0) return { min: 0, max: 0, average: 0 };
        
        return {
            min: prices[0],
            max: prices[prices.length - 1],
            average: (prices.reduce((a, b) => a + b, 0) / prices.length).toFixed(2),
            median: prices[Math.floor(prices.length / 2)]
        };
    }

    analyzeGradingServices() {
        const services = {};
        this.extractedSoldItems.forEach(item => {
            if (item.grading_service) {
                const service = item.grading_service.toUpperCase();
                if (!services[service]) {
                    services[service] = [];
                }
                if (item.grade) {
                    services[service].push(item.grade);
                }
            }
        });
        
        Object.keys(services).forEach(service => {
            const grades = services[service];
            services[service] = {
                count: grades.length,
                average_grade: grades.length > 0 ? (grades.reduce((a, b) => a + b, 0) / grades.length).toFixed(2) : 0
            };
        });
        
        return services;
    }

    parsePrice(priceStr) {
        if (!priceStr) return 0;
        return parseFloat(priceStr.replace(/[$,]/g, '')) || 0;
    }

    saveAsCSV() {
        const headers = [
            'ID', 'Name', 'Sold_Price', 'Sold_Date', 'Grading_Service', 'Grade', 
            'Condition', 'Population_Info', 'Image_URL', 'Extracted_At'
        ];
        
        let csvContent = headers.join(',') + '\n';
        
        this.extractedSoldItems.forEach(item => {
            const row = [
                item.id || '',
                `"${(item.name || '').replace(/"/g, '""')}"`,
                item.sold_price || '',
                item.sold_date || '',
                item.grading_service || '',
                item.grade || '',
                item.condition || '',
                `"${(item.population_info || '').replace(/"/g, '""')}"`,
                item.image_url || '',
                item.extracted_at || ''
            ];
            csvContent += row.join(',') + '\n';
        });
        
        fs.writeFileSync('fanatics-sold-pokemon.csv', csvContent);
    }

    async randomDelay(min, max) {
        const delay = Math.random() * (max - min) + min;
        await new Promise(resolve => setTimeout(resolve, delay));
    }
}

async function main() {
    const extractor = new FanaticsSoldDataExtractor();
    await extractor.extractAllSoldData();
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = FanaticsSoldDataExtractor;
