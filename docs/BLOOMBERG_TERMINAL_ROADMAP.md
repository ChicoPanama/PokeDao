# PokeDAO: Bloomberg Terminal for Trading Cards

## Vision
A fully functional Bloomberg Terminal for Pokemon TCG with automated social presence and real-time Telegram alerts.

---

## 1. WHAT EXISTS TODAY

### Data Sources
| Source | Status | Implementation |
|--------|--------|----------------|
| **JustTCG** | ✅ Production | Full API client with rate limiting, retry logic |
| **Phygitals** | ✅ Production | Solana NFT marketplace, graded cards |
| **eBay** | ⚠️ Research | Scripts exist, no production client |
| **Collector Crypt** | ⚠️ Research | Data in archive, no active client |
| **CardMarket** | ⚠️ Research | Wrapper exists, not integrated |
| **TCGPlayer** | ❌ Missing | Cached pricing only |
| **PSA APR** | ❌ Missing | No integration |
| **Magic Eden** | ❌ Missing | No integration |
| **Courtyard** | ❌ Missing | No integration |
| **rip.fun** | ❌ Missing | No integration |
| **Card Collector** | ❌ Missing | No integration |
| **PriceCharting** | ❌ Missing | No integration |

### Telegram Bot
| Feature | Status | Notes |
|---------|--------|-------|
| `/start` | ✅ Working | User registration |
| `/alerts` | ✅ Working | Toggle + filters (discount %, price range, grades) |
| `/watch` | ✅ Working | Watchlist management |
| `/arbitrage` | ✅ Working | Top 10 opportunities display |
| `/wallet` | ✅ Working | Wallet connection |
| `/referral` | ✅ Working | Basic referral tracking |
| Alert Delivery | ⚠️ Partial | AlertSender class exists, needs pipeline connection |
| Inline Keyboards | ✅ Working | Full callback handlers |
| User Preferences | ✅ Working | DB persistence + caching |
| Token Gating | ❌ Missing | Not implemented |

### X/Twitter Agent
| Feature | Status | Notes |
|---------|--------|-------|
| Post Client | ✅ Working | `twitter-api-v2` integration |
| Thread Composition | ✅ Working | `formatOpportunityThread()` |
| Dry Run Mode | ✅ Working | Default safe mode |
| Auto-Posting | ❌ Missing | No worker/scheduler |
| Market Commentary | ❌ Missing | Not implemented |
| Engagement | ❌ Missing | Not implemented |

### Signal/Arbitrage Pipeline
| Component | Status | Notes |
|-----------|--------|-------|
| 6-Step Pipeline | ✅ Working | LangGraph state machine |
| Arbitrage Detection | ✅ Working | Fee-adjusted spread calculation |
| Signal API | ✅ Working | `/signals/latest`, `/arbitrage` |
| AI Thesis | ⚠️ Partial | Ensemble class exists, minimal integration |

### Dashboard/UI
| Component | Status | Notes |
|-----------|--------|-------|
| Web Frontend | ❌ Missing | Zero UI - Telegram only |
| Charts | ❌ Missing | No visualization |
| Portfolio | ❌ Missing | Not implemented |

---

## 2. BLOOMBERG PARITY GAP ANALYSIS

| Bloomberg Feature | PokeDAO Status | Gap |
|-------------------|----------------|-----|
| **Real-time price feeds** | ⚠️ 2 sources | Need 8+ sources |
| **Historical charts** | ❌ Missing | Need chart component |
| **Trend analysis** | ⚠️ Partial | Have sparklines, need full charts |
| **Cross-market arbitrage** | ✅ Working | Core strength |
| **Portfolio tracking** | ❌ Missing | Need portfolio model + UI |
| **Watchlists with alerts** | ✅ Working | Via Telegram |
| **News/sentiment** | ⚠️ Partial | Reddit sentiment exists, not integrated |
| **Instant search** | ⚠️ Partial | API exists, no UI |
| **Professional dashboard** | ❌ Missing | No frontend |

---

## 3. PHASE 1: MVP TERMINAL + ALERTS

**Goal:** Working end-to-end system with real data, alerts, and social posting.

### 3.1 Data Pipeline (M)
| Task | Complexity | Description |
|------|------------|-------------|
| Enable eBay adapter | M | Production client from research scripts |
| Add TCGPlayer client | M | API integration for pricing |
| Data refresh worker | S | BullMQ job for periodic fetches |
| Price aggregation | S | Combine sources into unified view |

### 3.2 Arbitrage Engine (S)
| Task | Complexity | Description |
|------|------------|-------------|
| Cross-source detection | S | Already exists, verify working |
| Alert threshold config | S | Env vars for min spread |
| Top opportunities API | S | Already exists at `/arbitrage` |

### 3.3 Telegram Alerts (M)
| Task | Complexity | Description |
|------|------------|-------------|
| Connect pipeline to AlertSender | M | Wire signal output to alerts |
| Inline keyboard actions | S | Open, Buy Now, Mark Bought, Ignore |
| User preference filtering | S | Apply discount/price/grade filters |
| Rate limit alerts | S | Max N alerts per hour per user |

### 3.4 X Agent Auto-Posting (M)
| Task | Complexity | Description |
|------|------------|-------------|
| PostQueue worker | M | Process pending posts |
| Opportunity formatter | S | Already exists |
| Scheduler | S | Cron for periodic posting |
| Image generation | M | Card image + price overlay |

### 3.5 Basic Dashboard (L)
| Task | Complexity | Description |
|------|------------|-------------|
| Next.js app scaffold | M | Basic setup |
| Opportunities table | M | Real-time arbitrage list |
| Card detail view | M | Price, charts placeholder |
| Authentication | M | Telegram OAuth or wallet |

**Phase 1 Total:** ~3-4 weeks

---

## 4. PHASE 2: CORE FEATURES

**Goal:** Full terminal experience with history, portfolio, and advanced bot.

### 4.1 Historical Data (L)
| Task | Complexity | Description |
|------|------------|-------------|
| Price history table | M | Store all price points |
| Chart component | M | Recharts/Victory integration |
| 7/30/90 day views | S | Aggregation queries |
| Trend indicators | M | Moving averages, momentum |

### 4.2 Portfolio Tracking (L)
| Task | Complexity | Description |
|------|------------|-------------|
| Portfolio model | M | Holdings, cost basis, P&L |
| Add/remove holdings | S | CRUD operations |
| P&L calculation | M | Current vs cost basis |
| Performance charts | M | Portfolio value over time |

### 4.3 Advanced Telegram Bot (M)
| Task | Complexity | Description |
|------|------------|-------------|
| `/portfolio` command | M | View holdings in chat |
| `/settings` deep dive | S | All preferences |
| Token-gated access | M | Wallet verification |
| Referral rewards | M | Track and reward referrals |
| Alert snoozing | S | Mute specific cards |

### 4.4 X Agent Enhancement (M)
| Task | Complexity | Description |
|------|------------|-------------|
| Market commentary | M | AI-generated insights |
| Scheduled content | S | Daily roundup posts |
| Trending cards | S | Volume-based highlights |

**Phase 2 Total:** ~4-6 weeks

---

## 5. PHASE 3: FULL TERMINAL

**Goal:** Professional-grade platform with all data sources and AI insights.

### 5.1 Complete Data Coverage (L)
| Task | Complexity | Description |
|------|------------|-------------|
| PSA APR integration | M | Population reports |
| Magic Eden adapter | M | Solana NFT listings |
| Courtyard adapter | M | Tokenized cards |
| rip.fun adapter | M | New marketplace |
| Card Collector adapter | M | Additional source |
| PriceCharting adapter | M | Historical reference |

### 5.2 AI-Powered Insights (L)
| Task | Complexity | Description |
|------|------------|-------------|
| Full ensemble integration | L | Mew-1A + DeepSeek + Ollama |
| Investment thesis generation | M | Per-signal AI analysis |
| Risk scoring | M | Multi-factor assessment |
| Market sentiment | M | Reddit + social signals |

### 5.3 Professional UI (L)
| Task | Complexity | Description |
|------|------------|-------------|
| Advanced dashboard | L | Multi-panel Bloomberg-style |
| Real-time WebSocket | M | Live price updates |
| Keyboard shortcuts | S | Power user features |
| Export/reports | M | PDF/CSV generation |
| Mobile responsive | M | Full mobile support |

### 5.4 Platform Features (L)
| Task | Complexity | Description |
|------|------------|-------------|
| Discord bot | M | Mirror Telegram features |
| Email alerts | S | Digest option |
| Webhook API | S | Custom integrations |
| Admin dashboard | M | User/system management |

**Phase 3 Total:** ~8-12 weeks

---

## 6. IMPLEMENTATION PRIORITY

### ✅ Phase 1 Complete (2026-01-24)
1. ✅ Wire signal pipeline to Telegram AlertSender
2. ✅ Enable X auto-posting worker
3. ✅ Create basic Next.js dashboard
4. ✅ Queue-based alert delivery (BullMQ)
5. ✅ Bot alert consumer worker

### ✅ Phase 2 Complete (2026-01-24)
1. ✅ Historical price charts (Recharts)
2. ✅ Portfolio tracking with P&L
3. ✅ Market summary and commentary
4. ✅ Bot /portfolio and /settings commands
5. ✅ Commentary poster worker

### ✅ Phase 3 In Progress (2026-01-24)
1. ✅ Token-gated bot access (`bot/src/middleware/tokenGate.ts`)
2. ✅ TCGPlayer integration (`packages/adapters/src/tcgplayer/`)
3. ✅ WebSocket real-time updates (`api/src/lib/websocket.ts`)
4. ✅ Courtyard adapter (`packages/adapters/src/courtyard/`)
5. ✅ Magic Eden adapter (`packages/adapters/src/magiceden/`)
6. ✅ PSA Population Reports (`packages/adapters/src/psa/`)

### Remaining (Phase 3)
1. AI ensemble integration
2. Professional Bloomberg-style UI polish
3. Discord bot
4. Mobile app

---

## 7. SUCCESS METRICS

### Phase 1
- [ ] 3+ data sources active
- [ ] Telegram alerts sending to users
- [ ] X posting 5+ opportunities/day
- [ ] Dashboard showing live arbitrage

### Phase 2
- [ ] 30-day price history available
- [ ] Portfolio P&L tracking
- [ ] 100+ active bot users
- [ ] 1000+ X followers

### Phase 3
- [ ] 10+ data sources
- [ ] AI thesis on every signal
- [ ] Professional dashboard
- [ ] Revenue from premium features

---

## 8. TECHNICAL DECISIONS

### Frontend Stack
- **Framework:** Next.js 14 (App Router)
- **Styling:** Tailwind CSS
- **Charts:** Recharts
- **State:** React Query + Zustand
- **Auth:** NextAuth with Telegram provider

### Data Architecture
- **Primary DB:** PostgreSQL (Prisma)
- **Cache:** Redis (BullMQ + session)
- **Time Series:** TimescaleDB extension (already configured)
- **Search:** PostgreSQL full-text (upgrade to Meilisearch later)

### Deployment
- **API:** Render.com (existing)
- **Frontend:** Vercel
- **Workers:** Render background workers
- **ML:** Modal Labs (existing)

---

## 9. RISKS & MITIGATIONS

| Risk | Impact | Mitigation |
|------|--------|------------|
| API rate limits | Data gaps | Multi-source fallback, caching |
| X API costs | Limited posting | Prioritize high-value signals |
| Data accuracy | Bad signals | Confidence thresholds, validation |
| User adoption | Low engagement | Focus on Telegram first |
| Competition | Market saturation | AI differentiation (Mew-1A) |

---

## 10. PHASE 1 COMPLETION STATUS (2026-01-24)

### Completed

| Component | Status | Location |
|-----------|--------|----------|
| **Alert Bridge** | ✅ Done | `apps/agent/src/workers/alert-bridge.ts` |
| **X Poster Worker** | ✅ Done | `apps/agent/src/workers/x-poster.ts` |
| **Worker Runner** | ✅ Done | `apps/agent/src/workers/index.ts` |
| **Bot Alert Consumer** | ✅ Done | `bot/src/workers/alert-consumer.ts` |
| **Dashboard** | ✅ Done | `apps/dashboard/` (Next.js 14) |
| **Pipeline Integration** | ✅ Done | `apps/agent/src/steps/06_output.ts` |

### Architecture Implemented

```
Signal Pipeline (LangGraph)
    ↓
06_output.ts (stageAndMaybePost)
    ↓
┌───────────────────────────────────────────┐
│  Alert Bridge                             │
│  - queueAlert() → telegram:alerts queue   │
│  - queuePost() → agent:post queue         │
└───────────────────────────────────────────┘
    ↓                           ↓
┌─────────────────┐   ┌─────────────────────┐
│ Bot Consumer    │   │ X Poster Worker     │
│ startAlertConsumer() │ startXPoster()     │
│ Sends to Telegram │  │ Posts to X/Twitter │
└─────────────────┘   └─────────────────────┘
```

### How to Run

```bash
# Terminal 1: Start API
pnpm api:dev

# Terminal 2: Start Telegram bot with alert consumer
cd bot && REDIS_URL=redis://localhost:6379/0 pnpm dev

# Terminal 3: Start workers (X posting)
cd apps/agent && tsx src/workers/index.ts

# Terminal 4: Start dashboard
cd apps/dashboard && pnpm dev  # http://localhost:3001

# Terminal 5: Run agent tick to generate signals
pnpm agent:tick
```

### Environment Variables

```bash
# Telegram
TELEGRAM_BOT_TOKEN=your_token
TELEGRAM_ALERTS_ENABLED=true

# X/Twitter
X_API_KEY=...
X_API_SECRET=...
X_ACCESS_TOKEN=...
X_ACCESS_SECRET=...
POSTING_ENABLED=false  # Set true for live posting

# Redis
REDIS_URL=redis://localhost:6379/0
```

### Next Phase: Core Features

1. Historical price charts (Recharts integration)
2. Portfolio tracking (holdings + P&L)
3. Token-gated bot access
4. TCGPlayer data integration
5. WebSocket for real-time updates
