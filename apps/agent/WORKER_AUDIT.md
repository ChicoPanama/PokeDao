# PokeDAO Worker Audit Report

**Generated:** 2026-01-25
**Auditor:** Claude Opus 4.5

---

## Summary Table

| Worker | Status | APIs Needed | Packages Needed | Key Env Vars | Blockers |
|--------|--------|-------------|-----------------|--------------|----------|
| **ebay-worker** | Complete | eBay Browse API | None | `EBAY_APP_ID`, `EBAY_CERT_ID` | API key required |
| **crypto-worker** | Partial | Magic Eden, Courtyard | None | None (public APIs) | Collection symbols need updating |
| **reddit-worker** | Complete | Reddit JSON API | None | None (uses public .json) | None - uses no-auth endpoint |
| **psa-worker** | Stub | PSA Web Scraping | cheerio recommended | None | Scraping is fragile |
| **web2-worker** | Stub | PriceCharting, TCGPlayer | cheerio, firecrawl | `FIRECRAWL_API_KEY` | APIs are paid/restricted |
| **alert-bridge** | Complete | BullMQ/Redis | bullmq, ioredis | `REDIS_URL` | None |
| **x-poster** | Complete | X/Twitter API v2 | twitter-api-v2 | `X_APP_KEY`, etc. | Free tier very limited |
| **commentary-poster** | Complete | Internal API + X | twitter-api-v2 | `API_URL`, `POSTING_ENABLED` | Depends on x-poster |

### Legend
- **Complete**: Fully implemented, ready to run with credentials
- **Partial**: Core logic exists but needs API/collection updates
- **Stub**: Basic structure with TODO placeholders

---

## Detailed Analysis

### 1. eBay Worker (`ebay-worker.ts`)

**Status:** Complete
**Current Implementation:** Fully implemented with OAuth token management, grade extraction, and PriceSnapshot creation.

#### External Services Required

| Service | Auth | Docs | Rate Limit |
|---------|------|------|------------|
| eBay Browse API | OAuth 2.0 Client Credentials | [eBay Browse API](https://developer.ebay.com/api-docs/buy/browse/overview.html) | 5,000 calls/day default |
| eBay OAuth Token | Basic Auth | [OAuth Rate Limits](https://developer.ebay.com/api-docs/static/oauth-rate-limits.html) | Varies by grant type |

#### Environment Variables Needed

```bash
EBAY_APP_ID=          # eBay Developer App ID (required)
EBAY_CERT_ID=         # eBay Developer Cert ID (required)
```

#### NPM Packages Needed
- None additional (uses native fetch)

#### Database Requirements
- `PriceSnapshot` table - EXISTS
- `CanonicalCard` table - EXISTS

#### Implementation TODO
1. [x] OAuth token acquisition
2. [x] Token caching in Redis
3. [x] Sold listings fetch
4. [x] Grade extraction from titles
5. [x] PriceSnapshot creation with dedup
6. [ ] **ISSUE**: Uses Browse API which shows active listings, not sold items
7. [ ] Consider using Finding API alternative or eBay completed items filter

#### Blockers
- **API Key Required**: Must register at [eBay Developer Program](https://developer.ebay.com/)
- **Note**: eBay Finding API was decommissioned; Browse API is the replacement but has different capabilities

---

### 2. Crypto Worker (`crypto-worker.ts`)

**Status:** Partial
**Current Implementation:** Fetches from Magic Eden and Courtyard, creates PriceSnapshots.

#### External Services Required

| Service | Auth | Docs | Rate Limit |
|---------|------|------|------------|
| Magic Eden API | None (public) / API Key (premium) | [Magic Eden Solana API](https://docs.magiceden.io/reference/solana-overview) | 120 QPM (2 QPS) free |
| Courtyard.io | None documented | [Courtyard Docs](https://docs.courtyard.io/) | Unknown |

#### Environment Variables Needed

```bash
# Optional - for higher rate limits
MAGIC_EDEN_API_KEY=
```

#### NPM Packages Needed
- None additional (uses native fetch)

#### Database Requirements
- `PriceSnapshot` table - EXISTS
- `Card` table - EXISTS
- `Listing` table - EXISTS

#### Implementation TODO
1. [x] Magic Eden collection fetch
2. [x] Courtyard listings fetch
3. [x] PriceSnapshot creation
4. [ ] **Update collection symbols** - Current `pokemon_1`, `pokemon_base_set` may not exist
5. [ ] Add rip.fun (Base chain) support
6. [ ] Add Card Collector support
7. [ ] Verify Courtyard API endpoint structure

#### Blockers
- **Collection Discovery**: Need to find actual Pokemon collection symbols on Magic Eden
- **Courtyard API**: May need partnership/API access for better integration

#### Research Findings
- Magic Eden free tier: 120 QPM, sufficient for current needs
- Courtyard processed $78.4M in August 2025, uses Polygon network
- Consider adding [GemRate Universal Search](https://www.gemrate.com/universal-search) for aggregated data

---

### 3. Reddit Worker (`reddit-worker.ts`)

**Status:** Complete
**Current Implementation:** Fetches hot posts from Pokemon subreddits, analyzes sentiment, stores in SocialPost.

#### External Services Required

| Service | Auth | Docs | Rate Limit |
|---------|------|------|------------|
| Reddit JSON API | None (using .json endpoint) | [Reddit API Wiki](https://support.reddithelp.com/hc/en-us/articles/16160319875092-Reddit-Data-API-Wiki) | ~10 req/min unauthenticated |

#### Environment Variables Needed

```bash
# Optional - for higher rate limits (100 QPM vs 10 QPM)
REDDIT_CLIENT_ID=
REDDIT_CLIENT_SECRET=
```

#### NPM Packages Needed
- None additional

#### Database Requirements
- `SocialPost` table - EXISTS
- `RedditPost` table - EXISTS (legacy)

#### Implementation TODO
1. [x] Fetch hot posts from subreddits
2. [x] Keyword-based sentiment analysis
3. [x] Card mention extraction
4. [x] SocialPost storage
5. [x] Redis stats caching
6. [ ] Optional: Add OAuth for higher rate limits
7. [ ] Optional: Add comment scraping for deeper sentiment

#### Blockers
- None - current implementation works with public JSON endpoint
- For production scale, consider Reddit OAuth (100 QPM vs 10 QPM)

#### Research Findings
- Reddit requires unique User-Agent (currently set to `PokeDao/1.0`)
- Free tier with OAuth: 100 requests/minute per client ID
- Commercial use requires approval since July 2023

---

### 4. PSA Worker (`psa-worker.ts`)

**Status:** Stub
**Current Implementation:** Basic scraping attempt with regex parsing, stores in Redis only.

#### External Services Required

| Service | Auth | Docs | Rate Limit |
|---------|------|------|------------|
| PSA Website | None (scraping) | N/A | Be polite |
| PSA Public API | OAuth 2.0 (PSA account) | [PSA Public API](https://www.psacard.com/publicapi/documentation) | Unknown |

#### Environment Variables Needed

```bash
# For API access (recommended over scraping)
PSA_USERNAME=
PSA_PASSWORD=
```

#### NPM Packages Needed
- `cheerio` - For proper HTML parsing (recommended)
- Or use PSA Public API instead

#### Database Requirements
- Currently Redis-only
- `PsaPopulation` model needed in schema

#### Implementation TODO
1. [x] Basic web fetch
2. [ ] **Replace regex with cheerio** - Current parsing is fragile
3. [ ] **Use PSA Public API** - Better reliability than scraping
4. [ ] Add database persistence (PsaPopulation model)
5. [ ] Handle pagination for multiple card matches
6. [ ] Add cert verification lookups

#### Blockers
- **Fragile Scraping**: HTML parsing with regex is unreliable
- **PSA Account Required**: For API access, need PSA account credentials
- **Schema Update Needed**: PsaPopulation model not in current schema

#### Research Findings
- PSA Public API requires OAuth 2.0 with PSA account credentials
- API offers cert verification for single item searches
- Population report data updates daily
- Consider [GemRate](https://www.gemrate.com/) for aggregated PSA/BGS/SGC/CGC data

---

### 5. Web2 Worker (`web2-worker.ts`)

**Status:** Stub
**Current Implementation:** Placeholder structure with TODO methods for each scraper.

#### External Services Required

| Service | Auth | Docs | Rate Limit | Status |
|---------|------|------|------------|--------|
| PriceCharting API | Paid subscription | [API Docs](https://www.pricecharting.com/api-documentation) | Unknown | **PAID ONLY** |
| TCGPlayer API | OAuth 2.0 | [TCGPlayer Docs](https://docs.tcgplayer.com/) | 10 req/sec | **NO NEW ACCESS** |
| FireCrawl | API Key | [FireCrawl](https://firecrawl.dev/) | Varies by plan | Optional |
| Collector Crypt | Unknown | N/A | Unknown | Needs research |
| CardLadder | Unknown | N/A | Unknown | Needs research |

#### Environment Variables Needed

```bash
# PriceCharting (paid subscription required)
PRICECHARTING_API_KEY=

# TCGPlayer (legacy - no new access granted)
TCGPLAYER_ACCESS_TOKEN=

# FireCrawl (optional managed scraping)
FIRECRAWL_API_KEY=

# Collector Crypt (if API exists)
COLLECTOR_CRYPT_API_KEY=
```

#### NPM Packages Needed
- `cheerio` - For HTML parsing if scraping
- `@firecrawl/firecrawl-sdk` - If using FireCrawl

#### Database Requirements
- `PriceSnapshot` table - EXISTS
- `Card` table - EXISTS

#### Implementation TODO
1. [ ] **PriceCharting**: Requires paid subscription ($X/month)
2. [ ] **TCGPlayer**: No longer granting new API access
3. [ ] **Collector Crypt**: Research API availability
4. [ ] **CardLadder**: Research API availability
5. [ ] **FireCrawl integration**: Implement managed scraping
6. [ ] Consider alternative: [PokemonPriceTracker API](https://www.pokemonpricetracker.com/api)
7. [ ] Consider alternative: [JustTCG API](https://justtcg.com/)

#### Blockers
- **PriceCharting**: Paid subscription required
- **TCGPlayer**: No longer granting new API access to developers
- **Alternatives needed**: JustTCG, PokemonPriceTracker may be better options

#### Research Findings
- TCGPlayer stopped granting new API access - existing users only
- PriceCharting API requires paid "Legendary" subscription
- JustTCG offers TCGPlayer alternative with active development
- PokemonPriceTracker API: 23,000+ cards, PSA data, transparent pricing

---

### 6. Alert Bridge (`alert-bridge.ts`)

**Status:** Complete
**Current Implementation:** Queues signals to BullMQ for Telegram bot consumption.

#### External Services Required

| Service | Auth | Docs | Rate Limit |
|---------|------|------|------------|
| Redis/BullMQ | None (local) | [BullMQ Docs](https://docs.bullmq.io/) | N/A |

#### Environment Variables Needed

```bash
REDIS_URL=redis://localhost:6379
```

#### NPM Packages Needed
- `bullmq` - INSTALLED
- `ioredis` - INSTALLED

#### Database Requirements
- None (Redis-based queuing)

#### Implementation TODO
1. [x] Queue creation
2. [x] Alert job structure
3. [x] Batch queuing
4. [x] Queue stats

#### Blockers
- None - fully functional

---

### 7. X Poster (`x-poster.ts`)

**Status:** Complete
**Current Implementation:** Processes BullMQ post queue, supports threads and images.

#### External Services Required

| Service | Auth | Docs | Rate Limit |
|---------|------|------|------------|
| X/Twitter API v2 | OAuth 1.0a User Context | [X API Docs](https://docs.x.com/x-api/fundamentals/rate-limits) | See below |

**X API Rate Limits (Free Tier):**
- Posts: 1,500/month at app level
- Reads: Very limited (~1 req/24h on most endpoints)
- **Recommended**: Basic tier ($200/month) for production

#### Environment Variables Needed

```bash
X_APP_KEY=           # X Developer App Key
X_APP_SECRET=        # X Developer App Secret
X_ACCESS_TOKEN=      # User access token
X_ACCESS_SECRET=     # User access secret
POSTING_ENABLED=false
POSTING_DRY_RUN=true
```

#### NPM Packages Needed
- `twitter-api-v2` - INSTALLED (root package.json)

#### Database Requirements
- None (Redis-based dedup)

#### Implementation TODO
1. [x] BullMQ worker setup
2. [x] Thread posting
3. [x] Image posting
4. [x] Deduplication
5. [x] Dry-run mode

#### Blockers
- **API Cost**: Free tier only allows 1,500 posts/month
- **No Read Access**: Free tier cannot retrieve data
- **Production**: Requires Basic tier at $200/month minimum

#### Research Findings
- X API Free tier is proof-of-concept only
- November 2025: X launched pay-per-use beta pricing
- Consider rate limiting to ~50 posts/day to stay within limits

---

### 8. Commentary Poster (`commentary-poster.ts`)

**Status:** Complete
**Current Implementation:** Generates market commentary via API, posts to X.

#### External Services Required

| Service | Auth | Docs | Rate Limit |
|---------|------|------|------------|
| Internal API | None | `/api/market/commentary/generate` | N/A |
| X/Twitter API | See x-poster | See x-poster | See x-poster |

#### Environment Variables Needed

```bash
API_URL=http://localhost:3000
POSTING_ENABLED=false
REDIS_URL=redis://localhost:6379
```

#### NPM Packages Needed
- None additional (depends on x-poster packages)

#### Database Requirements
- `MarketCommentary` table - Assumed to exist in API

#### Implementation TODO
1. [x] Commentary job processing
2. [x] X formatting
3. [x] Daily scheduling with dedup
4. [ ] Implement actual X posting (currently mock)
5. [ ] Add weekly commentary support

#### Blockers
- Depends on x-poster credentials
- API endpoint must exist at `API_URL`

---

## Action Items

### Immediate (P0) - Required for Basic Functionality

1. [ ] **Get eBay API credentials** - [Register at eBay Developer Program](https://developer.ebay.com/)
2. [ ] **Set up Redis** - Required for all workers
3. [ ] **Get X API credentials** - [X Developer Portal](https://developer.twitter.com/)
4. [ ] **Fix TypeScript errors** - 19 errors in tests and workers

### Short Term (P1) - Enhanced Functionality

1. [ ] **Install cheerio** - `pnpm add cheerio` for PSA worker
2. [ ] **Add PSA Public API support** - More reliable than scraping
3. [ ] **Update Magic Eden collections** - Find real Pokemon collection symbols
4. [ ] **Research Courtyard API** - Check for official API documentation
5. [ ] **Add Reddit OAuth** - For 10x higher rate limits
6. [ ] **Evaluate JustTCG API** - Alternative to TCGPlayer

### Research Needed

1. [ ] Collector Crypt API availability
2. [ ] CardLadder API availability
3. [ ] rip.fun API (Base chain)
4. [ ] Card Collector API
5. [ ] GemRate API for aggregated grading data
6. [ ] PokemonPriceTracker API pricing

---

## Recommended Implementation Order

1. **alert-bridge** - Already complete, no dependencies
2. **reddit-worker** - Works out of box, no API key needed
3. **ebay-worker** - Complete once credentials obtained
4. **crypto-worker** - Needs collection symbol updates
5. **x-poster** - Complete once credentials obtained
6. **commentary-poster** - Depends on x-poster
7. **psa-worker** - Needs cheerio and better parsing
8. **web2-worker** - Most complex, needs paid APIs or alternatives

---

## Cost Estimates

| Service | Free Tier | Paid Tier | Notes |
|---------|-----------|-----------|-------|
| eBay API | 5,000 calls/day | Higher with approval | Free for basic use |
| Magic Eden | 120 QPM | Higher with key | Free tier sufficient |
| Reddit | 10 QPM | 100 QPM with OAuth | Free with OAuth |
| X/Twitter | 1,500 posts/month | $200/month Basic | Very limited free |
| PriceCharting | None | $X/month subscription | Paid only |
| TCGPlayer | N/A | N/A | No new access |
| PSA API | Free with account | N/A | Requires PSA account |
| FireCrawl | Limited free | Pay per use | Optional |

---

## Sources

- [eBay API Call Limits](https://developer.ebay.com/develop/get-started/api-call-limits)
- [Magic Eden Solana API Keys](https://docs.magiceden.io/reference/solana-api-keys)
- [Reddit Data API Wiki](https://support.reddithelp.com/hc/en-us/articles/16160319875092-Reddit-Data-API-Wiki)
- [X API Rate Limits](https://docs.x.com/x-api/fundamentals/rate-limits)
- [PSA Public API](https://www.psacard.com/publicapi/documentation)
- [PriceCharting API Documentation](https://www.pricecharting.com/api-documentation)
- [TCGPlayer Getting Started](https://docs.tcgplayer.com/docs/getting-started)
