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
      // @ts-ignore: document is available in browser context
      const firstCards = Array.from(document.querySelectorAll("a.link-card")).slice(0, 3)
      
      return firstCards.map((card: any, index: number) => {
        // @ts-ignore: card is HTMLElement
        const cardDiv = card.querySelector(".card")
        
        // Look for text containing SOL or USDC
        // @ts-ignore: cardDiv is HTMLElement
        const allElements = cardDiv?.querySelectorAll("*") || []
        const priceElements: any[] = []
        
        allElements.forEach((el: any) => {
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
