# Worker Environment Variables Template

All environment variables needed for the PokeDAO agent workers.

---

## Required (Core Infrastructure)

```bash
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/pokedao

# Redis (required for all workers)
REDIS_URL=redis://localhost:6379

# API Server URL (for commentary worker)
API_URL=http://localhost:3000
```

---

## Data Collection Workers

### eBay Worker

```bash
# eBay Developer Program credentials
# Register at: https://developer.ebay.com/
EBAY_APP_ID=                    # Required - Your eBay App ID
EBAY_CERT_ID=                   # Required - Your eBay Cert ID
EBAY_WORKER_ENABLED=true        # Enable/disable worker
```

### Crypto Worker

```bash
# Magic Eden (optional - for higher rate limits)
# Docs: https://docs.magiceden.io/reference/solana-api-keys
MAGIC_EDEN_API_KEY=             # Optional - Get 120+ QPM

# Courtyard (if API becomes available)
COURTYARD_API_KEY=              # Future use

CRYPTO_WORKER_ENABLED=true      # Enable/disable worker
```

### Reddit Worker

```bash
# Reddit OAuth (optional - for 100 QPM vs 10 QPM)
# Register at: https://www.reddit.com/prefs/apps
REDDIT_CLIENT_ID=               # Optional - Reddit app client ID
REDDIT_CLIENT_SECRET=           # Optional - Reddit app secret

REDDIT_WORKER_ENABLED=true      # Enable/disable worker
```

### PSA Worker

```bash
# PSA Account credentials (for Public API)
# Required for API access - create account at psacard.com
PSA_USERNAME=                   # PSA account email
PSA_PASSWORD=                   # PSA account password

PSA_WORKER_ENABLED=true         # Enable/disable worker
```

### Web2 Worker

```bash
# PriceCharting API (PAID subscription required)
# Docs: https://www.pricecharting.com/api-documentation
PRICECHARTING_API_KEY=          # Requires Legendary subscription

# TCGPlayer (legacy - no new access granted)
TCGPLAYER_ACCESS_TOKEN=         # Existing users only

# FireCrawl (managed scraping - optional)
# Docs: https://firecrawl.dev/
FIRECRAWL_API_KEY=              # For managed web scraping

# Collector Crypt (if API available)
COLLECTOR_CRYPT_API_KEY=        # TBD

# Per-source toggles
WEB2_WORKER_ENABLED=true
WEB2_CRON="*/30 * * * *"
WEB2_PRICECHARTING_ENABLED=true
WEB2_TCGPLAYER_ENABLED=true
WEB2_CARDLADDER_ENABLED=false
WEB2_COLLECTOR_CRYPT_ENABLED=true
```

---

## Output Workers

### X/Twitter Poster

```bash
# X Developer credentials
# Register at: https://developer.twitter.com/
X_APP_KEY=                      # Required - X App Key (API Key)
X_APP_SECRET=                   # Required - X App Secret
X_ACCESS_TOKEN=                 # Required - User Access Token
X_ACCESS_SECRET=                # Required - User Access Secret

# Posting control
POSTING_ENABLED=false           # Master toggle for live posting
POSTING_DRY_RUN=true            # Log only, don't actually post

X_POSTER_ENABLED=true           # Enable/disable worker
```

### Commentary Poster

```bash
# Uses same X credentials as x-poster
COMMENTARY_ENABLED=true         # Enable/disable worker
```

### Alert Bridge (Telegram)

```bash
# Telegram Bot (consumed by separate bot service)
TELEGRAM_BOT_TOKEN=             # From @BotFather
TELEGRAM_ALERTS_ENABLED=false   # Enable Telegram alerts
```

---

## Worker Infrastructure

```bash
# Health endpoint
WORKER_HEALTH_PORT=3001         # Port for /health, /ready, /metrics

# Master toggle
DATA_WORKERS_ENABLED=true       # Enable all data workers
```

---

## Optional Alternatives

Consider these APIs as alternatives to restricted/paid services:

```bash
# JustTCG (TCGPlayer alternative)
# Docs: https://justtcg.com/
JUSTTCG_API_KEY=

# PokemonPriceTracker (comprehensive price data)
# Docs: https://www.pokemonpricetracker.com/api
POKEMON_PRICE_TRACKER_API_KEY=

# GemRate (aggregated PSA/BGS/SGC/CGC data)
# Docs: https://www.gemrate.com/
GEMRATE_API_KEY=
```

---

## Quick Start Configuration

Minimal configuration to get workers running:

```bash
# Required
DATABASE_URL=postgresql://localhost:5432/pokedao
REDIS_URL=redis://localhost:6379

# Reddit worker works immediately (no auth needed)
REDDIT_WORKER_ENABLED=true

# All others disabled until credentials obtained
EBAY_WORKER_ENABLED=false
CRYPTO_WORKER_ENABLED=false
PSA_WORKER_ENABLED=false
WEB2_WORKER_ENABLED=false
X_POSTER_ENABLED=false
COMMENTARY_ENABLED=false
```
