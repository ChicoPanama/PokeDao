import { chromium } from "playwright"

async function discoverEndpoints() {
  const browser = await chromium.launch({ headless: false })
  const page = await browser.newPage()
  
  // Track all network requests
  const requests: Array<{ url: string; method: string; resourceType: string }> = []
  page.on("request", request => {
    const url = request.url()
    if (url.includes("collectorcrypt.com") && 
        (url.includes("api") || url.includes("graphql") || url.includes(".json"))) {
      requests.push({
        url: url,
        method: request.method(),
        resourceType: request.resourceType()
      })
    }
  })
  
  try {
    await page.goto("https://collectorcrypt.com/marketplace/cards", {
      waitUntil: "networkidle"
    })
    
    await page.waitForTimeout(5000)
    
    // Try to trigger more API calls by scrolling
    await page.evaluate(() => {
      // @ts-ignore: window is available in browser context
      window.scrollBy(0, 1000)
    })
    await page.waitForTimeout(3000)
    
    console.log("Discovered API endpoints:")
    requests.forEach(req => {
      console.log(`${req.method} ${req.url}`)
    })
    
    if (requests.length === 0) {
      console.log("No obvious API endpoints found. Data might be:")
      console.log("1. Server-side rendered")
      console.log("2. Using obfuscated endpoints")
      console.log("3. Loading via GraphQL or other methods")
    }
    
  } catch (error) {
    console.error("Error:", error)
  } finally {
    await browser.close()
  }
}

discoverEndpoints()
