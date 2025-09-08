const { chromium } = require('playwright');

async function debugTCGPlayer() {
    console.log('🔍 Debugging TCGPlayer Pokemon page...');
    
    const browser = await chromium.launch({ headless: false });
    const page = await browser.newPage();
    
    await page.setViewportSize({ width: 1920, height: 1080 });
    
    const url = 'https://www.tcgplayer.com/search/pokemon/product?productLineName=pokemon&page=1';
    console.log(`📍 Navigating to: ${url}`);
    
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(5000);
    
    const pageInfo = await page.evaluate(() => {
        return {
            title: document.title,
            url: window.location.href,
            htmlLength: document.documentElement.outerHTML.length,
            hasContent: document.body.innerText.length > 100,
            allSelectors: {
                'div': document.querySelectorAll('div').length,
                'a': document.querySelectorAll('a').length,
                'img': document.querySelectorAll('img').length,
                '[class*="product"]': document.querySelectorAll('[class*="product"]').length,
                '[class*="card"]': document.querySelectorAll('[class*="card"]').length,
                '[class*="search"]': document.querySelectorAll('[class*="search"]').length,
                '[class*="result"]': document.querySelectorAll('[class*="result"]').length,
                '[class*="listing"]': document.querySelectorAll('[class*="listing"]').length,
                '[data-testid]': document.querySelectorAll('[data-testid]').length
            },
            firstDivs: Array.from(document.querySelectorAll('div')).slice(0, 10).map(div => ({
                className: div.className,
                id: div.id,
                textContent: div.textContent.substring(0, 100)
            })),
            hasReCaptcha: document.querySelector('[data-sitekey]') !== null,
            hasCloudflare: document.body.innerHTML.includes('cloudflare') || document.body.innerHTML.includes('cf-'),
            bodyText: document.body.innerText.substring(0, 1000)
        };
    });
    
    console.log('📊 Page Analysis:', JSON.stringify(pageInfo, null, 2));
    
    // Take a screenshot for debugging
    await page.screenshot({ path: 'tcgplayer-debug.png', fullPage: true });
    console.log('📸 Screenshot saved as tcgplayer-debug.png');
    
    // Keep browser open for manual inspection
    console.log('🔍 Browser left open for manual inspection. Press Ctrl+C to close.');
    
    // Wait indefinitely
    await new Promise(() => {});
}

debugTCGPlayer().catch(console.error);
