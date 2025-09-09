const puppeteer = require('puppeteer');
const Database = require('better-sqlite3');

// Database connection
const db = new Database('tcgplayer.db');

console.log('🔍 ANALYZING EXISTING DATA TO RESUME HARVEST');

// Get all existing pages
const existingPages = db.prepare('SELECT DISTINCT page FROM tcgplayer_cards ORDER BY page').all().map(row => row.page);
console.log(`📊 Found cards on ${existingPages.length} different pages`);
console.log(`📈 Page range: ${Math.min(...existingPages)} to ${Math.max(...existingPages)}`);

// Find gaps in our collection
const missingPages = [];
const maxPage = Math.max(...existingPages);
for (let i = 1; i <= maxPage; i++) {
    if (!existingPages.includes(i)) {
        missingPages.push(i);
    }
}

console.log(`❌ Missing ${missingPages.length} pages in existing range: ${missingPages.slice(0, 10).join(', ')}${missingPages.length > 10 ? '...' : ''}`);

// Check recent activity to find where to resume
const recentPages = db.prepare(`
    SELECT page, COUNT(*) as count, MAX(extractedAt) as latest 
    FROM tcgplayer_cards 
    WHERE extractedAt > (SELECT MAX(extractedAt) - 600000 FROM tcgplayer_cards)
    GROUP BY page 
    ORDER BY latest DESC
`).all();

console.log('🕒 Recent harvest activity:');
recentPages.forEach(page => {
    console.log(`   Page ${page.page}: ${page.count} cards (${new Date(page.latest).toLocaleTimeString()})`);
});

// Determine resume strategy
let resumePage;
if (missingPages.length > 0) {
    resumePage = Math.min(...missingPages);
    console.log(`🎯 STRATEGY: Fill gaps first, starting at page ${resumePage}`);
} else {
    resumePage = maxPage + 1;
    console.log(`🎯 STRATEGY: Continue forward from page ${resumePage}`);
}

console.log(`🚀 RESUMING HARVEST FROM PAGE ${resumePage}`);

// Resume harvesting function
async function resumeHarvest() {
    const browser = await puppeteer.launch({ 
        headless: false,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 720 });
    
    let currentPage = resumePage;
    let consecutiveEmpty = 0;
    const maxConsecutiveEmpty = 3;
    
    // Insert statement
    const insertCard = db.prepare(`
        INSERT OR REPLACE INTO tcgplayer_cards (
            id, externalId, source, name, cleanedName, setName, setUrl, rarity, cardType, 
            cardNumber, category, menuCategory, productUrl, imageUrl, tcgplayerUrl,
            currentPrice, marketPrice, lowPrice, midPrice, highPrice, priceRange,
            listingCount, priceText, inStock, sellable, totalListings, page,
            extractedAt, lastUpdated, harvestSessionId, rawProductData, rarityWeight
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    while (consecutiveEmpty < maxConsecutiveEmpty && currentPage < 500) {
        const url = `https://www.tcgplayer.com/search/pokemon/product?productLineName=pokemon&page=${currentPage}`;
        console.log(`📄 Processing page ${currentPage}...`);
        
        try {
            await page.goto(url, { waitUntil: 'networkidle0', timeout: 15000 });
            await page.waitForTimeout(2000);
            
            // Extract cards using current selectors
            const cards = await page.evaluate(() => {
                const cardElements = document.querySelectorAll('.search-result');
                const extractedCards = [];
                
                cardElements.forEach((element, index) => {
                    try {
                        const titleElement = element.querySelector('.product-card__title a');
                        const priceElement = element.querySelector('.product-card__market-price--value');
                        const imageElement = element.querySelector('.product-card__image img');
                        
                        if (titleElement && titleElement.textContent.trim()) {
                            const cardData = {
                                name: titleElement.textContent.trim(),
                                productUrl: titleElement.href,
                                currentPrice: priceElement ? parseFloat(priceElement.textContent.replace(/[^0-9.]/g, '')) || 0 : 0,
                                imageUrl: imageElement ? imageElement.src : null,
                                index: index
                            };
                            
                            extractedCards.push(cardData);
                        }
                    } catch (error) {
                        console.log(`Error processing card ${index}:`, error.message);
                    }
                });
                
                return extractedCards;
            });
            
            if (cards.length === 0) {
                consecutiveEmpty++;
                console.log(`   ❌ No cards found (${consecutiveEmpty}/${maxConsecutiveEmpty})`);
            } else {
                consecutiveEmpty = 0;
                console.log(`   ✅ Found ${cards.length} cards`);
                
                // Process and save cards
                const sessionId = `resume-${Date.now()}`;
                const timestamp = Date.now();
                
                cards.forEach((card, index) => {
                    try {
                        const cardId = `resume-${currentPage}-${index}-${timestamp}`;
                        const externalId = `tcgplayer-${cardId}`;
                        
                        // Parse set name from card name
                        let setName = 'Unknown Set';
                        if (card.name.includes('(')) {
                            const match = card.name.match(/\(([^)]+)\)$/);
                            if (match) setName = match[1];
                        }
                        
                        insertCard.run([
                            cardId, externalId, 'tcgplayer', card.name, card.name.toLowerCase(),
                            setName, null, null, null, null, 'Pokemon', null,
                            card.productUrl, card.imageUrl, card.productUrl,
                            card.currentPrice, card.currentPrice, null, null, null, null,
                            null, card.currentPrice.toString(), true, true, null, currentPage,
                            timestamp, timestamp, sessionId, JSON.stringify(card), null
                        ]);
                    } catch (error) {
                        console.log(`Error saving card ${index}:`, error.message);
                    }
                });
            }
            
            await page.waitForTimeout(1500); // Rate limiting
            
        } catch (error) {
            console.log(`   ⚠️ Error on page ${currentPage}: ${error.message}`);
            consecutiveEmpty++;
        }
        
        currentPage++;
        
        // Progress update every 10 pages
        if (currentPage % 10 === 0) {
            const totalCards = db.prepare('SELECT COUNT(*) as count FROM tcgplayer_cards').get().count;
            console.log(`📊 Progress: Page ${currentPage} | Total cards: ${totalCards}`);
        }
    }
    
    await browser.close();
    
    const finalCount = db.prepare('SELECT COUNT(*) as count FROM tcgplayer_cards').get().count;
    console.log(`🏁 HARVEST COMPLETE! Total cards: ${finalCount}`);
}

// Start the resume harvest
resumeHarvest().catch(console.error);
