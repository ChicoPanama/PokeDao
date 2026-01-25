# NPM Packages Needed for Workers

Analysis of packages required by each worker.

---

## Currently Installed

These packages are already in the project:

| Package | Version | Used By | Location |
|---------|---------|---------|----------|
| `bullmq` | ^4.15.4 | alert-bridge, x-poster, commentary-poster | apps/agent |
| `ioredis` | ^5.7.0 | all workers | apps/agent |
| `twitter-api-v2` | ^1.27.0 | x-poster | root |
| `pino` | ^9.6.0 | all workers | apps/agent |
| `cron` | ^3.5.0 | base-worker | apps/agent |
| `zod` | * | web2-worker | root |

---

## Recommended Additions

### For PSA Worker (HTML Parsing)

```bash
# Cheerio for reliable HTML parsing
pnpm add cheerio

# Types
pnpm add -D @types/cheerio
```

**Why:** Current PSA worker uses fragile regex parsing. Cheerio provides proper DOM traversal for extracting population data from PSA's HTML pages.

### For Web2 Worker (Managed Scraping)

```bash
# FireCrawl SDK for managed web scraping
pnpm add @firecrawl/firecrawl-sdk
```

**Why:** FireCrawl handles proxies, rate limiting, and JavaScript rendering - much more reliable than manual scraping.

### For Enhanced Scraping (Optional)

```bash
# If you need browser automation
pnpm add puppeteer
# or
pnpm add playwright

# Lightweight HTTP client with retries
pnpm add got
```

**Why:** Some sites (CardLadder, Collector Crypt) may require JavaScript rendering.

---

## Installation Commands

### Minimal (Recommended)

```bash
cd apps/agent
pnpm add cheerio
pnpm add -D @types/cheerio
```

### Full Scraping Support

```bash
cd apps/agent
pnpm add cheerio @firecrawl/firecrawl-sdk
pnpm add -D @types/cheerio
```

### With Browser Automation

```bash
cd apps/agent
pnpm add cheerio @firecrawl/firecrawl-sdk puppeteer
pnpm add -D @types/cheerio
```

---

## Package Details

### cheerio

- **Purpose:** Fast, flexible HTML parsing using jQuery-like syntax
- **Size:** ~150KB
- **Use case:** PSA population parsing, PriceCharting scraping
- **Docs:** https://cheerio.js.org/

```typescript
import * as cheerio from 'cheerio';

const $ = cheerio.load(html);
const psa10 = $('td:contains("GEM-MT 10")').next().text();
```

### @firecrawl/firecrawl-sdk

- **Purpose:** Managed web scraping with LLM-powered extraction
- **Size:** ~50KB
- **Use case:** web2-worker scraping with automatic data extraction
- **Docs:** https://docs.firecrawl.dev/

```typescript
import FirecrawlApp from '@firecrawl/firecrawl-sdk';

const app = new FirecrawlApp({ apiKey: process.env.FIRECRAWL_API_KEY });
const result = await app.scrapeUrl(url, {
  formats: ['markdown', 'extract'],
  extract: { schema: priceSchema }
});
```

### puppeteer (Optional)

- **Purpose:** Headless Chrome for JavaScript-rendered pages
- **Size:** ~180MB (includes Chromium)
- **Use case:** Sites that require JS rendering
- **Docs:** https://pptr.dev/

```typescript
import puppeteer from 'puppeteer';

const browser = await puppeteer.launch({ headless: true });
const page = await browser.newPage();
await page.goto(url);
const data = await page.evaluate(() => /* extract data */);
```

---

## Not Needed

These packages are NOT needed (already handled or not applicable):

| Package | Reason |
|---------|--------|
| `axios` | Native `fetch` is sufficient |
| `node-fetch` | Built into Node.js 18+ |
| `redis` | Using `ioredis` instead |
| `grammy` / `telegraf` | Bot is separate service |

---

## TypeScript Considerations

After installing packages, ensure types are available:

```bash
# Check for missing types
pnpm add -D @types/cheerio

# If using puppeteer
pnpm add -D @types/puppeteer
```

---

## Verification

After installation, verify with:

```bash
cd apps/agent
pnpm typecheck
```

Expected: No new TypeScript errors from added packages.
