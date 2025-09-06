import { chromium } from 'playwright'

async function inspectCards() {
  const browser = await chromium.launch({ headless: false })
  const page = await browser.newPage()
  
  try {
    console.log('Inspecting cards marketplace...')
    await page.goto('https://collectorcrypt.com/marketplace/cards', {
      waitUntil: 'networkidle'
    })
    
    await page.waitForTimeout(5000)
    await page.screenshot({ path: 'cards-page.png' })
    console.log('Screenshot saved as cards-page.png')
    
    // Extract actual card elements and their structure
    const cardData = await page.evaluate(() => {
      // @ts-ignore: document is available in browser context
      const possibleSelectors = [
        'div[class*="card"]',
        'div[class*="item"]', 
        'div[class*="listing"]',
        'a[href*="assets/solana"]'
      ]
      
      let foundElements: any[] = []
      
      for (const selector of possibleSelectors) {
        // @ts-ignore: document is available in browser context
        const elements = document.querySelectorAll(selector)
        if (elements.length > 0) {
          foundElements.push({
            selector,
            count: elements.length,
            sample: elements[0]?.outerHTML?.substring(0, 200)
          })
        }
      }
      
      return foundElements
    })
    
    console.log('Found card elements:', cardData)
    
  } catch (error) {
    console.error('Error:', error)
  } finally {
    await browser.close()
  }
}

inspectCards()
