# Platform Reference Guide

**Generated:** 2026-01-25
**Purpose:** Complete reference for all data source platforms used by PokeDAO workers

---

## Summary Table

| Platform | Has API | Auth | Free Tier | Rate Limit | Pokemon | Priority | Status |
|----------|---------|------|-----------|------------|---------|----------|--------|
| **Magic Eden** | Yes | Bearer | Yes | 2 QPS | Yes | P0 | Integrated |
| **Courtyard** | Yes | Bearer | Yes | ~3 QPS | Yes | P0 | Integrated |
| **rip.fun** | On-chain | RPC | Yes | RPC-dependent | Yes | P2 | Closed Beta |
| **TCGPlayer** | Yes | OAuth | Yes | 5 req/sec | Yes | P0 | Integrated |
| **JustTCG** | Yes | API Key | Yes | 2 req/sec | Yes | P0 | Integrated |
| **PokemonPriceTracker** | Yes | Bearer | Yes (100/day) | 20K/day paid | Yes | P1 | Not integrated |
| **PokeWallet** | Yes | API Key | Yes (1K/hr) | 10K/hr paid | Yes | P1 | Not integrated |
| **eBay** | Yes | OAuth | Yes | 5K/day | Yes | P2 | Finding API deprecated |
| **PriceCharting** | Yes | Token | No | Low | Partial | P3 | Avoid - expensive |
| **CardLadder** | No | N/A | N/A | N/A | Yes | P3 | No API |
| **Cardmarket/MKM** | Yes | OAuth | Yes | 1/day | **No** | Skip | Pokemon not supported |
| **Pokemon TCG API** | Yes | Optional | Yes | Varies | Metadata | P1 | Not integrated |
| **Reddit** | Yes | Optional | Yes | 100 QPM | Sentiment | P0 | Integrated |

---

## NFT/Crypto Platforms

### Magic Eden

**Website:** https://magiceden.io
**API Docs:** https://docs.magiceden.io/
**Status:** Integrated

#### Authentication
- Method: Bearer token (`Authorization: Bearer {apiKey}`)
- API Keys: https://docs.magiceden.io/reference/solana-api-keys
- Test Key: `demo-api-key` for development

#### Rate Limits
- Default: 120 QPM (2 QPS)
- Ordinals: 30 QPM
- Higher limits available on request

#### Key Endpoints
```
GET /v2/collections                        # List collections
GET /v2/collections/{symbol}               # Collection details
GET /v2/collections/{symbol}/listings      # Active listings
GET /v2/collections/{symbol}/activities    # Sales history
GET /v2/collections/{symbol}/stats         # Floor price, volume
GET /v2/tokens/{mintAddress}               # NFT details
```

#### Pokemon Collections
- Collector Crypt partnership for RWA tokenized cards
- Collection symbols observed: `pokemon_1`, `pokemon_base_set`
- Features graded cards (PSA, CGC, BGS, SGC)

#### Environment Variables
```bash
MAGICEDEN_API_KEY=           # Optional for higher limits
MAGICEDEN_RATE_LIMIT=2       # Requests per second
```

#### Implementation
- Client: `/packages/adapters/src/magiceden/client.ts`
- Worker: `apps/agent/src/workers/crypto-worker.ts`
- Runs every 5 minutes, converts SOL to USD via CoinGecko

---

### Courtyard

**Website:** https://courtyard.io
**API Docs:** https://docs.courtyard.io/
**Blockchain:** Polygon (Contract: `0x251be3a17af4892035c37ebf5890f4a4d889dcad`)
**Status:** Integrated

#### Authentication
- Method: Bearer token (`Authorization: Bearer {apiKey}`)
- Optional for basic endpoints, required for premium features

#### Rate Limits
- Default: ~3 requests per second
- Implements exponential backoff with `Retry-After` header

#### Key Endpoints
```
GET /v1/listings                    # Get Pokemon listings
GET /v1/listings/{listingId}        # Single listing
GET /v1/listings/search             # Search by query
GET /v1/collections                 # Get collections
GET /v1/sales/recent                # Recent sales
```

#### Features
- RWA (Real World Asset) tokenized cards
- Physical cards stored in Brink's insured vault
- 90% instant buyback guarantee
- 1% royalty on resales

#### Environment Variables
```bash
COURTYARD_API_KEY=           # Optional
COURTYARD_RATE_LIMIT=3       # Requests per second
```

#### Implementation
- Client: `/packages/adapters/src/courtyard/client.ts`
- Worker: `apps/agent/src/workers/crypto-worker.ts`
- Filters by `category: "pokemon"`

---

### rip.fun

**Website:** https://rip.fun
**Blockchain:** Base (Ethereum L2, Chain ID: 8453)
**Status:** Closed Beta - Not Integrated

#### Overview
- Live pack breaks with on-chain verification
- Physical packs opened on video, cards tokenized as ERC-721
- Cards can be redeemed physically or kept digital
- Currently requires invite code

#### Integration Approach
No public API - requires blockchain RPC integration:
1. Use Base RPC provider (Alchemy, QuickNode, Ankr)
2. Monitor contract events for sales/transfers
3. Query NFT metadata from contract

#### RPC Providers for Base
- QuickNode: https://www.quicknode.com/builders-guide/best/top-10-base-rpc-providers
- Alchemy: https://www.alchemy.com/chain-connect
- Public RPC: https://chainlist.org/chain/8453

#### Environment Variables (Future)
```bash
BASE_RPC_URL=https://base-mainnet.g.alchemy.com/v2/{key}
RIPFUN_CONTRACT_ADDRESS=     # TBD when discovered
```

---

## Physical Card Pricing Platforms

### TCGPlayer

**Website:** https://www.tcgplayer.com
**API Docs:** https://docs.tcgplayer.com/
**Status:** Integrated

#### Authentication
- Method: OAuth 2.0 (public/private key pair)
- Token expires ~1 hour, auto-refresh supported

#### Rate Limits
- Recommended: 5 requests/second
- Max 250 products per pricing request
- Honors `Retry-After` header on 429

#### Key Endpoints
```
GET /catalog/categories              # Get categories (Pokemon = 3)
GET /catalog/products                # Search products
GET /pricing/product/{ids}           # Get pricing (up to 250)
GET /catalog/groups                  # Get sets
```

#### Pokemon Data
- Category ID: 3
- Pricing types: low, mid, high, market price
- Covers all Pokemon TCG sets

#### Environment Variables
```bash
TCGPLAYER_PUBLIC_KEY=
TCGPLAYER_PRIVATE_KEY=
TCGPLAYER_ACCESS_TOKEN=      # Auto-generated, cached
```

#### Implementation
- Client: `/packages/adapters/src/tcgplayer/client.ts`
- Production-ready with retry logic

---

### JustTCG

**Website:** https://justtcg.com
**API Docs:** https://justtcg.com/api-docs
**Status:** Integrated (Primary)

#### Authentication
- Method: API key in header (`x-api-key`)

#### Rate Limits
- Default: 2 requests/second
- Configurable via environment variable
- Honors `Retry-After` on 429

#### Key Endpoints
```
GET /api/sets?game=pokemon           # Get all Pokemon sets
GET /api/sets/{setId}/cards          # Cards in set
GET /api/cards/search?name={query}   # Search cards
GET /api/cards/{id}/prices           # Price history
GET /api/cards/{id}/trending         # Day/week/month changes
```

#### Features
- Full Pokemon TCG support
- Price history with trends
- Multiple variants per card

#### Environment Variables
```bash
JUSTTCG_API_KEY=tcg_your_key_here
JUSTTCG_RATE_LIMIT=2         # Requests per second
```

#### Implementation
- Client: `/packages/adapters/src/justtcg/client.ts`
- Worker uses for primary pricing data

---

### PokemonPriceTracker (Recommended Addition)

**Website:** https://www.pokemonpricetracker.com
**API Docs:** https://www.pokemonpricetracker.com/api
**Status:** Not Integrated - Recommended

#### Authentication
- Method: Bearer token (`Authorization: Bearer {apiKey}`)

#### Rate Limits
| Plan | Calls/Day | Cost |
|------|-----------|------|
| Free | 100 | $0 |
| Standard | 20,000 | $9.99/mo |
| Business | 200,000 | $49.99-$99/mo |

#### Features
- 23,000+ Pokemon cards
- Multi-source aggregation (TCGPlayer, eBay, CardMarket)
- PSA graded card data
- Historical price data
- Bulk card fetching

#### Why Recommended
- Best multi-source pricing API
- Includes eBay sold data (which eBay API no longer provides)
- Affordable pricing ($9.99/mo)
- No need to scrape eBay directly

#### Environment Variables (Future)
```bash
POKEMON_PRICE_TRACKER_API_KEY=
POKEMON_PRICE_TRACKER_RATE_LIMIT=2
```

---

### PokeWallet (Alternative)

**Website:** https://www.pokewallet.io
**API Docs:** https://www.pokewallet.io/api-docs
**Status:** Not Integrated

#### Authentication
- Method: API key

#### Rate Limits
| Plan | Requests/Hour | Requests/Day | Cost |
|------|---------------|--------------|------|
| Free | 50 | 100 | $0 |
| Early Access | 1,000 | 10,000 | $0 (current) |
| Pro | 10,000 | 100,000 | Contact |

#### Features
- 50,000+ Pokemon cards
- GraphQL + REST APIs
- Real-time pricing
- Best free tier available

---

### eBay

**Website:** https://www.ebay.com
**API Docs:** https://developer.ebay.com
**Status:** Limited - Finding API Deprecated

#### Important Notice
**Finding API deprecated February 5, 2025** - Do not build new integrations

#### Current Limitations
- Browse API: Only active listings (NOT sold items)
- Finding API: Deprecated, rate-limited to 5K/day
- Marketplace Insights: Requires eBay partnership

#### Recommendation
Use PokemonPriceTracker or PokeScope instead of direct eBay integration.

---

### PriceCharting

**Website:** https://www.pricecharting.com
**API Docs:** https://www.pricecharting.com/api-documentation
**Status:** Avoid - Expensive

#### Issues
- No free tier - requires Pro subscription
- Limited to 1 request/5 minutes on offers endpoint
- Partial Pokemon support only
- No price history

---

### CardLadder

**Website:** https://www.cardladder.com
**Status:** No API Available

- Comprehensive price data back to 2000
- No developer API
- Would require scraping (not recommended)

---

### Cardmarket/MKM

**Website:** https://www.cardmarket.com
**API Docs:** https://api.cardmarket.com
**Status:** Pokemon NOT Supported

- Only supports Magic: The Gathering (`idGame=1`) and Yu-Gi-Oh (`idGame=3`)
- Europe-focused marketplace
- Do not use for Pokemon data

---

## Social/Sentiment Platforms

### Reddit

**Website:** https://www.reddit.com
**API Docs:** https://www.reddit.com/dev/api
**Status:** Integrated

#### Authentication
- Public JSON endpoint (no auth): ~10 req/min
- OAuth (with credentials): 100 req/min

#### Subreddits Monitored
- r/pokemontcg
- r/pkmntcgtrades
- r/PokeInvesting

#### Environment Variables
```bash
REDDIT_CLIENT_ID=            # Optional - for higher limits
REDDIT_CLIENT_SECRET=        # Optional
```

#### Implementation
- Worker: `apps/agent/src/workers/reddit-worker.ts`
- Saves to `reddit_signals` table
- Extracts sentiment and card mentions

---

## Grading Services

### PSA

**Website:** https://www.psacard.com
**Population Reports:** https://www.psacard.com/pop
**Cert Verification:** https://www.psacard.com/cert
**Status:** Stub - Needs Implementation

#### No Public API
- Must scrape population reports
- Use cheerio for HTML parsing
- Be polite with rate limiting

#### Implementation Needed
- Install: `pnpm add cheerio`
- Parse population tables from HTML
- Extract PSA 10/9/8 populations

---

## Implementation Priority

### P0 - Currently Working
1. **Magic Eden** - NFT listings
2. **Courtyard** - RWA tokenized cards
3. **TCGPlayer** - Primary pricing
4. **JustTCG** - Alternative pricing
5. **Reddit** - Sentiment analysis

### P1 - Recommended Additions
1. **PokemonPriceTracker** - Multi-source pricing ($9.99/mo)
2. **PokeWallet** - Free alternative (1K/hr)
3. **Pokemon TCG API** - Card metadata

### P2 - Future/Research
1. **rip.fun** - When exits beta
2. **PSA scraping** - Population data
3. **eBay alternatives** - PokeScope, pokemonsold.com

### Skip
- PriceCharting (expensive)
- CardLadder (no API)
- Cardmarket (no Pokemon)
- Direct eBay (deprecated)

---

## Quick Setup

### Minimum Viable Configuration
```bash
# Required
DATABASE_URL=postgresql://...
REDIS_URL=redis://localhost:6379

# Working without keys
REDDIT_WORKER_ENABLED=true    # Uses public .json endpoint

# Needs API keys
JUSTTCG_API_KEY=tcg_...       # Primary pricing
MAGICEDEN_API_KEY=...         # Optional, for higher limits
```

### Full Configuration
```bash
# All pricing sources
JUSTTCG_API_KEY=tcg_...
TCGPLAYER_PUBLIC_KEY=...
TCGPLAYER_PRIVATE_KEY=...
POKEMON_PRICE_TRACKER_API_KEY=...  # Future

# NFT platforms
MAGICEDEN_API_KEY=...
COURTYARD_API_KEY=...

# Social
REDDIT_CLIENT_ID=...
REDDIT_CLIENT_SECRET=...
```

---

## Sources

- [Magic Eden Developer Documentation](https://docs.magiceden.io/)
- [Courtyard Documentation](https://docs.courtyard.io/)
- [TCGPlayer API Docs](https://docs.tcgplayer.com/)
- [JustTCG API](https://justtcg.com/api-docs)
- [PokemonPriceTracker API](https://www.pokemonpricetracker.com/api)
- [PokeWallet API Docs](https://www.pokewallet.io/api-docs)
- [Pokemon TCG API](https://docs.pokemontcg.io/)
- [eBay Developer Portal](https://developer.ebay.com/)
- [Reddit API Wiki](https://support.reddithelp.com/hc/en-us/articles/16160319875092-Reddit-Data-API-Wiki)
