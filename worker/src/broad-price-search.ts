import { chromium } from "playwright"

async function broadPriceSearch() {
  const browser = await chromium.launch({ headless: false })
  const page = await browser.newPage()
  
  try {
    await page.goto("https://collectorcrypt.com/marketplace/cards", {
      waitUntil: "networkidle"
    })
    
    await page.waitForSelector(".link-card", { timeout: 10000 })
    await page.waitForTimeout(5000) // Wait longer for prices to load
    
    // Search for any text containing SOL or USDC anywhere on page
    const allPriceText = await page.evaluate(() => {
  // @ts-ignore: document is available in browser context
  const bodyText = document.body.innerText
      const solMatches = bodyText.match(/\d+\.?\d*\s*SOL/gi) || []
      const usdcMatches = bodyText.match(/\d+\.?\d*\s*USDC/gi) || []
      
      // Also look for elements with these patterns
  // @ts-ignore: document is available in browser context
  const allElements = document.querySelectorAll("*")
      const priceElements: any[] = []
      
      allElements.forEach((el: any) => {
        const text = el.textContent?.trim() || ""
        if (text.match(/^\d+\.?\d*\s*(SOL|USDC)$/i)) {
          priceElements.push({
            text: text,
            className: el.className,
            tagName: el.tagName,
            parentClass: el.parentElement?.className
          })
        }
      })
      
      return {
        solPrices: solMatches.slice(0, 10),
        usdcPrices: usdcMatches.slice(0, 10),
        priceElements: priceElements.slice(0, 10)
      }
    })
    
    console.log("Broad price search results:", JSON.stringify(allPriceText, null, 2))
    
    // Take a screenshot to manually inspect
    await page.screenshot({ path: "marketplace-prices.png" })
    console.log("Screenshot saved as marketplace-prices.png")
    
  } catch (error) {
    console.error("Error:", error)
  } finally {
    await browser.close()
  }
}

broadPriceSearch()
