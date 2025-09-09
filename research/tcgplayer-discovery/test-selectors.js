const puppeteer = require('puppeteer');

async function testSelectors() {
    console.log('🧪 Testing selectors on TCGPlayer page...');
    
    const browser = await puppeteer.launch({ 
        headless: false,
        defaultViewport: null,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    
    try {
        console.log('📍 Loading page...');
        await page.goto('https://www.tcgplayer.com/search/pokemon/product?productLineName=pokemon&page=1', { 
            waitUntil: 'networkidle2', 
            timeout: 60000 
        });
        
        console.log('⏳ Waiting for content to load...');
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        // Test different selectors
        const selectors = [
            '.search-result',
            '.product-card',
            '.search-result .product-card',
            '[data-testid^="product-card__image"]',
            '.product-card__title'
        ];
        
        for (const selector of selectors) {
            const count = await page.evaluate((sel) => {
                return document.querySelectorAll(sel).length;
            }, selector);
            
            console.log(`🔍 ${selector}: ${count} elements found`);
            
            if (count > 0 && selector === '.search-result') {
                // Test the full extraction logic
                const cards = await page.evaluate(() => {
                    const containers = document.querySelectorAll('.search-result');
                    const results = [];
                    
                    for (let i = 0; i < Math.min(3, containers.length); i++) {
                        const container = containers[i];
                        const titleElement = container.querySelector('.product-card__title');
                        const priceElement = container.querySelector('.product-card__market-price--value');
                        const linkElement = container.querySelector('.product-card__content a, a');
                        
                        console.log(`Container ${i}:`, {
                            title: titleElement?.textContent?.trim(),
                            price: priceElement?.textContent?.trim(),
                            link: linkElement?.href
                        });
                        
                        if (titleElement && linkElement) {
                            results.push({
                                title: titleElement.textContent.trim(),
                                price: priceElement?.textContent?.trim(),
                                link: linkElement.href
                            });
                        }
                    }
                    
                    return results;
                });
                
                console.log(`🎯 Extracted ${cards.length} cards:`, cards);
            }
        }
        
        console.log('✅ Test complete. Press Enter to close browser...');
        await new Promise(resolve => {
            process.stdin.once('data', resolve);
        });
        
    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await browser.close();
    }
}

testSelectors();
