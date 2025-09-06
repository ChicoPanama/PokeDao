import { chromium } from "playwright"

async function investigatePrices() {
  const browser = await chromium.launch({ headless: false })
  const page = await browser.newPage()
  
  try {
    // Visit a specific card to see price structure
    const cardUrl = "https://collectorcrypt.com/assets/solana/CRjk3SFdgkXx4Vq7PzgtcTRBcvXt45x7eDDpgchC8Ndn"
    
    console.log("Investigating individual card page...")
    await page.goto(cardUrl, { waitUntil: "networkidle" })
    await page.waitForTimeout(3000)
    
    // Take screenshot
    await page.screenshot({ path: "card-detail.png" })
    
    // Look for price-related elements
    const priceInfo = await page.evaluate(() => {
      const possiblePriceSelectors = [
        "[class*=\"price\"]",
        "[class*=\"cost\"]", 
        "[class*=\"sol\"]",
        "[class*=\"amount\"]",
        "[class*=\"value\"]",
        "span:contains(\"SOL\")",
        "div:contains(\"$\")",
        "button[class*=\"buy\"]",
        "button[class*=\"purchase\"]"
      ]
      
      let foundElements = []
      
      for (const selector of possiblePriceSelectors) {
        try {
          const elements = document.querySelectorAll(selector)
          if (elements.length > 0) {
            foundElements.push({
              selector,
              count: elements.length,
              samples: Array.from(elements).slice(0, 3).map(el => ({
                text: el.textContent?.trim(),
                html: el.outerHTML.substring(0, 150)
              }))
            })
          }
        } catch (e) {}
      }
      
      // Also check all text for SOL or $ patterns
      const bodyText = document.body.innerText
      const solMatches = bodyText.match(/\d+\.?\d*\s*SOL/gi) || []
      const dollarMatches = bodyText.match(/\$\d+\.?\d*/gi) || []
      
      return {
        elements: foundElements,
        solPrices: solMatches.slice(0, 5),
        dollarPrices: dollarMatches.slice(0, 5),
        title: document.title
      }
    })
    
    console.log("Price investigation results:", JSON.stringify(priceInfo, null, 2))
    
  } catch (error) {
    console.error("Error:", error)
  } finally {
    await browser.close()
  }
}

investigatePrices()
