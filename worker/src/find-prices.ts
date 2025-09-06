import { chromium } from "playwright"

async function findPriceLocation() {
  const browser = await chromium.launch({ headless: false })
  const page = await browser.newPage()
  
  try {
    await page.goto("https://collectorcrypt.com/marketplace/cards", {
      waitUntil: "networkidle"
    })
    
    await page.waitForSelector(".link-card", { timeout: 10000 })
    await page.waitForTimeout(3000)
    
    // Look at first few cards to find price pattern
    const priceStructure = await page.evaluate(() => {
      const firstCards = Array.from(document.querySelectorAll("a.link-card")).slice(0, 3)
      
      return firstCards.map((card, index) => {
        const cardDiv = card.querySelector(".card")
        
        // Look for text containing SOL or USDC
        const allElements = cardDiv?.querySelectorAll("*") || []
        const priceElements = []
        
        allElements.forEach(el => {
          const text = el.textContent?.trim() || ""
          if (text.match(/\d+\.?\d*\s*(SOL|USDC)/i)) {
            priceElements.push({
              text: text,
              className: el.className,
              tagName: el.tagName,
              html: el.outerHTML.substring(0, 100)
            })
          }
        })
        
        return {
          cardIndex: index,
          href: card.href,
          priceElements: priceElements
        }
      })
    })
    
    console.log("Price structure analysis:", JSON.stringify(priceStructure, null, 2))
    
  } catch (error) {
    console.error("Error:", error)
  } finally {
    await browser.close()
  }
}

findPriceLocation()
