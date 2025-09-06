import { chromium } from "playwright"

async function extractActualPrices() {
  const browser = await chromium.launch({ headless: false })
  const page = await browser.newPage()
  
  try {
    await page.goto("https://collectorcrypt.com/marketplace/cards", {
      waitUntil: "networkidle"
    })
    
    await page.waitForSelector(".link-card", { timeout: 10000 })
    await page.waitForTimeout(5000)
    
    // Extract cards with their price structure
    const cardsWithPrices = await page.evaluate(() => {
      // @ts-ignore: document is available in browser context
      const cardLinks = document.querySelectorAll("a.link-card")
      const results: any[] = []
      
      Array.from(cardLinks).slice(0, 10).forEach((card: any, index: number) => {
        // @ts-ignore: card is HTMLElement
        const cardDiv = card.querySelector(".card")
        
        // Look for numeric text that could be prices
        // @ts-ignore: cardDiv is HTMLElement
        const allElements = cardDiv?.querySelectorAll("*") || []
        const priceElements: any[] = []
        
        allElements.forEach((el: any) => {
          const text = el.textContent?.trim() || ""
          // Look for standalone numbers that could be prices
          if (text.match(/^\d{1,4}$/) && parseInt(text) > 0) {
            priceElements.push({
              text: text,
              className: el.className,
              tagName: el.tagName,
              position: el.getBoundingClientRect(),
              parent: el.parentElement?.className
            })
          }
        })
        
        results.push({
          cardIndex: index,
          href: card.href,
          cardName: card.textContent?.trim().substring(0, 50),
          priceElements: priceElements
        })
      })
      
      return results
    })
    
    console.log("Cards with potential prices:", JSON.stringify(cardsWithPrices, null, 2))
    
  } catch (error) {
    console.error("Error:", error)
  } finally {
    await browser.close()
  }
}

extractActualPrices()
