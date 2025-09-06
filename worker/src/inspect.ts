import { chromium } from 'playwright'

async function inspectSite() {
  const browser = await chromium.launch({ headless: false })
  const page = await browser.newPage()
  
  try {
    console.log('🔍 Inspecting Collector Crypt...')
    await page.goto('https://collectorcrypt.com/marketplace', {
      waitUntil: 'networkidle'
    })
    
    await page.waitForTimeout(3000)
    await page.screenshot({ path: 'marketplace.png' })
    console.log('📸 Screenshot saved')
    
    const title = await page.title()
    console.log('Page title:', title)
    
  } catch (error) {
    console.error('Error:', error)
  } finally {
    await browser.close()
  }
}

inspectSite()
