#!/usr/bin/env node
/**
 * 🎯 FANATICS POKEMON AUCTION EXTRACTOR v3
 * =======================================
 * 
 * Tuned specifically for Fanatics Collect auction format
 * Based on user-provided screenshots showing exact card structure
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');

puppeteer.use(StealthPlugin());

class FanaticsAuctionExtractor {
    constructor() {
        this.extractedCards = [];
        this.baseUrl = 'https://www.fanaticscollect.com/weekly-auction?category=Trading+Card+Games+%3E+Pok%C3%A9mon+(English),Trading+Card+Games+%3E+Pok%C3%A9mon+(Japanese),Trading+Card+Games+%3E+Pok%C3%A9mon+(Other+Languages)&type=WEEKLY&sortBy=prod_item_state_v1_price_desc';
        this.maxPages = 100; // User showed pagination goes to 100+
    }

    async extractAllPages() {
        console.log('🎯 FANATICS POKEMON AUCTION EXTRACTOR v3');
        console.log('========================================');
        console.log('📊 Extracting from ALL auction pages (1-100)');
        
        const browser = await puppeteer.launch({
            headless: false, // Keep visible for debugging
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-blink-features=AutomationControlled',
                '--disable-web-security'
            ],
            defaultViewport: null
        });

        const page = await browser.newPage();
        await this.setupStealth(page);
        
        let totalCards = 0;
        
        try {
            for (let pageNum = 1; pageNum <= this.maxPages; pageNum++) {
                const url = `${this.baseUrl}&page=${pageNum}`;
                
                console.log(`\n📄 Processing Page ${pageNum}/${this.maxPages}`);
                console.log(`🔗 URL: ${url}`);
                
                try {
                    // Navigate to the page
                    await page.goto(url, { 
                        waitUntil: 'networkidle2',
                        timeout: 30000 
                    });
                    
                    // Wait for auction cards to load
                    await new Promise(resolve => setTimeout(resolve, 4000));
                    
                    // Extract cards from this page
                    const cards = await this.extractCardsFromPage(page, pageNum);
                    
                    if (cards.length === 0) {
                        console.log(`❌ No cards found on page ${pageNum} - may have reached the end`);
                        if (pageNum > 5) { // If we hit several empty pages, stop
                            console.log('🛑 Multiple empty pages detected - stopping extraction');
                            break;
                        }
                    } else {
                        console.log(`✅ Extracted ${cards.length} cards from page ${pageNum}`);
                        this.extractedCards.push(...cards);
                        totalCards += cards.length;
                        
                        // Save progress every 10 pages
                        if (pageNum % 10 === 0) {
                            this.saveProgress(pageNum);
                        }
                    }
                    
                    // Random delay to avoid detection
                    await this.randomDelay(3000, 6000);
                    
                } catch (error) {
                    console.log(`❌ Error on page ${pageNum}: ${error.message}`);
                    
                    // Take screenshot for debugging
                    await page.screenshot({ 
                        path: `error-page-${pageNum}-${Date.now()}.png`,
                        fullPage: false 
                    });
                }
            }
            
        } finally {
            await browser.close();
        }
        
        console.log(`\n🎉 EXTRACTION COMPLETE!`);
        console.log(`📊 Total Pokemon Cards: ${totalCards}`);
        
        this.generateFinalReport();
        return this.extractedCards;
    }

    async setupStealth(page) {
        await page.evaluateOnNewDocument(() => {
            Object.defineProperty(navigator, 'webdriver', {
                get: () => undefined,
            });
        });
        
        await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    }

    async extractCardsFromPage(page, pageNumber) {
        console.log(`   🎴 Extracting auction lots from page ${pageNumber}...`);
        
        const cards = await page.evaluate((pageNum) => {
            const extractedCards = [];
            
            // Strategy 1: Look for auction lot containers (from screenshots)
            const lotSelectors = [
                'div[class*="lot"]',
                'div[class*="auction"]', 
                'div[class*="card"]',
                'article',
                '[data-testid*="lot"]',
                // Grid containers that hold multiple cards
                'div[class*="grid"] > div',
                'div[class*="container"] > div'
            ];
            
            for (const selector of lotSelectors) {
                try {
                    const containers = document.querySelectorAll(selector);
                    console.log(`Trying selector: ${selector}, found: ${containers.length}`);
                    
                    containers.forEach((container, index) => {
                        const text = container.textContent?.toLowerCase() || '';
                        
                        // Only process if it has Pokemon content and pricing
                        if ((text.includes('pokemon') || text.includes('pikachu') || text.includes('charizard')) && 
                            (text.includes('$') || text.includes('bid'))) {
                            
                            // Extract auction lot data
                            const lotId = text.match(/lot[:\s]*(\w+)/i)?.[1] || 
                                         container.querySelector('[class*="lot"]')?.textContent?.match(/\w+/)?.[0];
                            
                            // Get card name (usually the longest text element)
                            const nameElements = container.querySelectorAll('h1, h2, h3, h4, [class*="title"], [class*="name"]');
                            let cardName = '';
                            nameElements.forEach(el => {
                                const elText = el.textContent?.trim();
                                if (elText && elText.length > cardName.length && elText.toLowerCase().includes('pokemon')) {
                                    cardName = elText;
                                }
                            });
                            
                            if (!cardName) {
                                // Fallback: extract from main text
                                const lines = text.split('\n').filter(line => 
                                    line.length > 10 && 
                                    line.toLowerCase().includes('pokemon') && 
                                    !line.includes('$') && 
                                    !line.includes('bid')
                                );
                                cardName = lines[0] || text.substring(0, 100);
                            }
                            
                            // Extract price info
                            const priceMatch = text.match(/\$[\d,]+\.?\d*/);
                            const bidMatch = text.match(/(\d+)\s*bid/i);
                            const timeMatch = text.match(/(\d+d\s*\d+h|\d+h\s*\d+m)/i);
                            
                            // Get image URL
                            const img = container.querySelector('img');
                            const imageUrl = img?.src || img?.dataset?.src;
                            
                            // Extract grading info (PSA, BGS, etc.)
                            const gradingMatch = text.match(/(PSA|BGS|CGC)\s*(\d+)/i);
                            
                            const cardData = {
                                id: `fanatics-lot-${lotId || Date.now()}-${index}`,
                                lot_id: lotId,
                                name: cardName?.trim(),
                                current_price: priceMatch?.[0],
                                bid_count: bidMatch?.[1] ? parseInt(bidMatch[1]) : null,
                                time_remaining: timeMatch?.[0],
                                grading_service: gradingMatch?.[1],
                                grade: gradingMatch?.[2] ? parseInt(gradingMatch[2]) : null,
                                image_url: imageUrl,
                                
                                // Raw data for analysis
                                raw_text: text.substring(0, 500),
                                
                                // Metadata
                                source_page: pageNum,
                                source_url: window.location.href,
                                extracted_at: new Date().toISOString(),
                                extraction_method: 'fanatics_auction_v3'
                            };
                            
                            // Only add if we have meaningful data
                            if (cardData.name && cardData.name.length > 5) {
                                extractedCards.push(cardData);
                            }
                        }
                    });
                    
                } catch (error) {
                    console.log(`Selector error: ${error.message}`);
                }
            }
            
            // Strategy 2: Look specifically for auction lot numbers (WA191 LOT: pattern from screenshots)
            const lotPattern = /WA\d+\s*LOT:\s*\w+/gi;
            const bodyText = document.body.textContent;
            const lotMatches = bodyText.match(lotPattern);
            
            if (lotMatches && lotMatches.length > extractedCards.length) {
                console.log(`Found ${lotMatches.length} lot patterns, extracted ${extractedCards.length} cards`);
                
                // Try to find missing lots
                lotMatches.forEach((lotMatch, index) => {
                    const lotId = lotMatch.match(/LOT:\s*(\w+)/i)?.[1];
                    
                    // Check if we already have this lot
                    const exists = extractedCards.find(card => card.lot_id === lotId);
                    if (!exists) {
                        // Try to find the container for this lot
                        const xpath = `//text()[contains(., '${lotMatch}')]/ancestor::*[self::div or self::article][1]`;
                        const result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
                        
                        if (result.singleNodeValue) {
                            const container = result.singleNodeValue;
                            const text = container.textContent?.toLowerCase() || '';
                            
                            if (text.includes('pokemon')) {
                                const cardData = {
                                    id: `fanatics-xpath-${lotId}-${index}`,
                                    lot_id: lotId,
                                    name: text.substring(0, 200).trim(),
                                    raw_text: text.substring(0, 500),
                                    source_page: pageNum,
                                    extraction_method: 'xpath_lot_search',
                                    extracted_at: new Date().toISOString()
                                };
                                
                                extractedCards.push(cardData);
                            }
                        }
                    }
                });
            }
            
            console.log(`Page ${pageNum}: Found ${extractedCards.length} Pokemon auction lots`);
            return extractedCards;
            
        }, pageNumber);
        
        return cards;
    }

    saveProgress(pageNumber) {
        const progressFile = `fanatics-progress-page-${pageNumber}.json`;
        const progressData = {
            last_page_processed: pageNumber,
            total_cards_so_far: this.extractedCards.length,
            timestamp: new Date().toISOString(),
            sample_cards: this.extractedCards.slice(-5) // Last 5 cards
        };
        
        fs.writeFileSync(progressFile, JSON.stringify(progressData, null, 2));
        fs.writeFileSync('fanatics-all-cards-progress.json', JSON.stringify(this.extractedCards, null, 2));
        
        console.log(`💾 Progress saved: ${this.extractedCards.length} cards so far`);
    }

    generateFinalReport() {
        const report = {
            extraction_complete: true,
            timestamp: new Date().toISOString(),
            total_pokemon_cards: this.extractedCards.length,
            pages_processed: Math.max(...this.extractedCards.map(c => c.source_page || 0)),
            
            // Analysis
            cards_with_prices: this.extractedCards.filter(c => c.current_price).length,
            cards_with_grades: this.extractedCards.filter(c => c.grade).length,
            cards_with_images: this.extractedCards.filter(c => c.image_url).length,
            
            // Grading breakdown
            grading_services: this.analyzeGradingServices(),
            
            // Sample cards
            sample_high_value: this.extractedCards
                .filter(c => c.current_price)
                .sort((a, b) => this.parsePrice(b.current_price) - this.parsePrice(a.current_price))
                .slice(0, 10),
                
            sample_recent: this.extractedCards.slice(-10)
        };
        
        // Save comprehensive files
        fs.writeFileSync('fanatics-pokemon-final-report.json', JSON.stringify(report, null, 2));
        fs.writeFileSync('fanatics-pokemon-all-cards.json', JSON.stringify(this.extractedCards, null, 2));
        
        // Save CSV for easy analysis
        this.saveAsCSV();
        
        console.log(`\n📊 FINAL STATISTICS:`);
        console.log(`🎴 Total Pokemon Cards: ${report.total_pokemon_cards}`);
        console.log(`💰 Cards with Prices: ${report.cards_with_prices}`);
        console.log(`🏆 Cards with Grades: ${report.cards_with_grades}`);
        console.log(`🖼️  Cards with Images: ${report.cards_with_images}`);
        console.log(`📄 Report: fanatics-pokemon-final-report.json`);
        console.log(`📄 All Data: fanatics-pokemon-all-cards.json`);
        console.log(`📊 CSV Export: fanatics-pokemon-cards.csv`);
    }

    analyzeGradingServices() {
        const services = {};
        this.extractedCards.forEach(card => {
            if (card.grading_service) {
                if (!services[card.grading_service]) {
                    services[card.grading_service] = [];
                }
                if (card.grade) {
                    services[card.grading_service].push(card.grade);
                }
            }
        });
        
        // Calculate averages
        Object.keys(services).forEach(service => {
            const grades = services[service];
            services[service] = {
                count: grades.length,
                average_grade: grades.length > 0 ? (grades.reduce((a, b) => a + b, 0) / grades.length).toFixed(2) : 0,
                grade_distribution: grades.reduce((acc, grade) => {
                    acc[grade] = (acc[grade] || 0) + 1;
                    return acc;
                }, {})
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
            'ID', 'Lot_ID', 'Name', 'Current_Price', 'Bid_Count', 'Time_Remaining',
            'Grading_Service', 'Grade', 'Image_URL', 'Source_Page', 'Extracted_At'
        ];
        
        let csvContent = headers.join(',') + '\n';
        
        this.extractedCards.forEach(card => {
            const row = [
                card.id || '',
                card.lot_id || '',
                `"${(card.name || '').replace(/"/g, '""')}"`,
                card.current_price || '',
                card.bid_count || '',
                card.time_remaining || '',
                card.grading_service || '',
                card.grade || '',
                card.image_url || '',
                card.source_page || '',
                card.extracted_at || ''
            ];
            csvContent += row.join(',') + '\n';
        });
        
        fs.writeFileSync('fanatics-pokemon-cards.csv', csvContent);
    }

    async randomDelay(min, max) {
        const delay = Math.random() * (max - min) + min;
        await new Promise(resolve => setTimeout(resolve, delay));
    }
}

async function main() {
    const extractor = new FanaticsAuctionExtractor();
    await extractor.extractAllPages();
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = FanaticsAuctionExtractor;
