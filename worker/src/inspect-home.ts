import { chromium } from 'playwright'

async function inspectSite() {
  const browser = await chromium.launch({ headless: false })
  const page = await browser.newPage()
  
  try {
    console.log('Inspecting main Collector Crypt site...')
    await page.goto('https://collectorcrypt.com', {
      waitUntil: 'networkidle'
    })
    
    await page.waitForTimeout(3000)
    await page.screenshot({ path: 'homepage.png' })
    console.log('Screenshot saved as homepage.png')
    
    const title = await page.title()
    console.log('Page title:', title)
    
    // Look for any links to marketplace or cards
    const links = await page.evaluate(() => {
      // @ts-ignore: document is available in browser context
      const allLinks = Array.from(document.querySelectorAll('a'))
      return allLinks
        .map((link: any) => ({ text: link.textContent?.trim(), href: link.href }))
        .filter((link: any) => link.text && (
          link.text.toLowerCase().includes('market') ||
          link.text.toLowerCase().includes('card') ||
          link.text.toLowerCase().includes('shop') ||
          link.text.toLowerCase().includes('browse')
        ))
    })
    
    console.log('Found relevant links:', links)
    
  } catch (error) {
    console.error('Error:', error)
  } finally {
    await browser.close()
  }
}

inspectSite()
