# PokeDAO Architecture Audit & Optimization Plan

## ✅ Completed

### Database Schema
- [x] UnifiedMarketListing table with proper constraints
- [x] MarketSource enum updated (JUSTTCG, TCGPLAYER_ACTIVE added)
- [x] GradeCompany enum (PSA, BGS, CGC, SGC, ACE, RAW, OTHER)
- [x] Proper unique constraints on source + sourceId

### Marketplace Integrations
- [x] Collector Crypt (API + Helius)
- [x] Phygitals (Helius NFT)
- [x] Courtyard (Polygon NFT)
- [x] eBay (sold history - awaiting prod credentials)
- [x] TCGPlayer Active (script ready)
- [ ] JustTCG (in progress)

### API Routes
- [x] /api/search - Cross-marketplace search
- [x] /api/search/autocomplete - Smart suggestions
- [x] /api/search/filters - Filter options
- [x] /api/arbitrage - Opportunities detection
- [x] /api/arbitrage/analyze - Price analysis
- [x] /api/arbitrage/trending - Volatility tracking

### Data Quality
- [x] Pokemon TCG API integration
- [x] Automatic enrichment system
- [x] Confidence scoring
- [x] Validation scripts

### Alerts
- [x] Real-time arbitrage scanner
- [x] Multi-platform alerts (Telegram, Discord)
- [x] Duplicate prevention
- [x] Configurable thresholds

---

## 🔧 Critical Optimizations Needed

### 1. Database Indexes (CRITICAL - 10-100x speedup)

**Current State:** Basic indexes on primary keys only
**Issue:** Search and arbitrage queries are slow without composite indexes

**Solution:** Apply performance indexes
```sql
-- File: api/prisma/migrations/add_search_arbitrage_indexes.sql (CREATED)
-- Status: Needs to be applied to production database

Key indexes:
- Composite search index (cardName + setName + gradeCompany + grade + priceCents)
- Arbitrage detection index (cardName + setName + grade + source + price)
- Full-text search on titles
- Price range optimization
- Recent listings index
```

**Action Required:**
1. Get production DATABASE_URL
2. Apply SQL migration: `psql $DATABASE_URL -f api/prisma/migrations/add_search_arbitrage_indexes.sql`
3. Verify with EXPLAIN ANALYZE on slow queries

**Expected Impact:**
- Search queries: 5000ms → 50ms (100x faster)
- Arbitrage detection: 10000ms → 100ms (100x faster)
- Autocomplete: 2000ms → 20ms (100x faster)

---

### 2. Redis Caching (Already configured, needs optimization)

**Current State:** Basic caching in api/src/index.ts (lines 247-265)
**Issues:**
- Cache hit rate unknown
- No cache warming
- Fixed TTL (120s for most, 300s for /top100)
- No invalidation strategy

**Optimizations Needed:**

```typescript
// Cache Strategy by Route:
GET /api/search?q=charizard           → 5min TTL (search results change slowly)
GET /api/search/autocomplete          → 1hr TTL (suggestions stable)
GET /api/search/filters               → 10min TTL (filter options stable)
GET /api/arbitrage                    → 1min TTL (opportunities change fast)
GET /api/arbitrage/trending           → 5min TTL (trends update slowly)

// Cache Keys Need Improvement:
Current: `${routerPath}:v1:${JSON.stringify(query)}`
Better:  `v2:search:${hash(normalizedQuery)}`  // Dedupe similar queries

// Add Cache Metrics:
- Hit rate tracking
- Cache size monitoring
- Popular query analysis
```

**Action Items:**
1. Add cache metrics endpoint `/metrics/cache`
2. Implement smart TTL per route type
3. Add cache warming for popular searches
4. Implement selective invalidation on data updates

---

### 3. Cron Jobs (Automated Operations)

**Current State:** Manual script execution
**Needed:** Automated daily/hourly jobs

**Recommended Jobs:**

```javascript
// File: scripts/cron-jobs.ts (TO CREATE)

// Daily jobs (3am):
- Pokemon TCG API enrichment (update missing data)
- Data quality validation
- Stale listing cleanup (older than 30 days)
- Database VACUUM ANALYZE

// Hourly jobs:
- Collector Crypt sync
- Phygitals sync
- TCGPlayer active listings sync
- JustTCG sync

// Every 5 minutes:
- Arbitrage scanner
- Price alert checks

// Weekly (Sunday 2am):
- Full database reindex
- Historical price aggregation
- Generate market reports
```

**Implementation Options:**

**Option A: Node-cron (Recommended)**
```bash
npm install node-cron
```
```typescript
import cron from 'node-cron';

// Run enrichment daily at 3am
cron.schedule('0 3 * * *', () => {
  exec('pnpm tsx scripts/enrich-with-tcg-api.ts');
});

// Run arbitrage scanner every 5 minutes
cron.schedule('*/5 * * * *', () => {
  exec('pnpm tsx scripts/arbitrage-alert-scanner.ts');
});
```

**Option B: GitHub Actions (Cloud-based)**
```yaml
# .github/workflows/daily-enrichment.yml
name: Daily Data Enrichment
on:
  schedule:
    - cron: '0 3 * * *'  # 3am daily
jobs:
  enrich:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - run: pnpm tsx scripts/enrich-with-tcg-api.ts
```

**Option C: PM2 Cron (Production)**
```json
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'daily-enrichment',
    script: 'scripts/enrich-with-tcg-api.ts',
    cron_restart: '0 3 * * *'
  }]
}
```

---

### 4. API Authentication (JWT)

**Current State:** No authentication
**Risk:** API abuse, rate limit exhaustion, data scraping

**Implementation Plan:**

```typescript
// File: api/src/lib/auth.ts (TO CREATE)

import jwt from 'jsonwebtoken';
import { FastifyRequest } from 'fastify';

export function generateToken(userId: string, tier: 'free' | 'pro' | 'enterprise') {
  return jwt.sign(
    { userId, tier, iat: Date.now() },
    process.env.JWT_SECRET!,
    { expiresIn: '30d' }
  );
}

export async function authenticateRequest(req: FastifyRequest) {
  const token = req.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    throw new Error('No token provided');
  }

  const payload = jwt.verify(token, process.env.JWT_SECRET!) as any;
  return payload;
}

// Rate limits by tier:
free:       100 req/hour
pro:        1000 req/hour
enterprise: unlimited
```

**Protected Routes:**
- `/api/arbitrage` - Pro tier
- `/api/arbitrage/analyze` - Pro tier
- `/api/search` - Free tier (with limits)
- `/api/search/autocomplete` - Free tier

---

### 5. API Documentation (Swagger/OpenAPI)

**Current State:** Basic Swagger UI at /docs
**Issues:** No examples, no request/response schemas

**Improvements Needed:**

```typescript
// Add to each route:
app.get('/api/search', {
  schema: {
    description: 'Search across all marketplaces',
    tags: ['Search'],
    querystring: {
      type: 'object',
      properties: {
        q: { type: 'string', description: 'Search query', example: 'Charizard' },
        gradeCompany: { type: 'string', enum: ['PSA', 'BGS', 'CGC'], example: 'PSA' },
        minGrade: { type: 'number', minimum: 1, maximum: 10, example: 9 },
        sortBy: { type: 'string', enum: ['price_asc', 'price_desc'], example: 'price_asc' }
      }
    },
    response: {
      200: {
        description: 'Successful response',
        type: 'object',
        properties: {
          ok: { type: 'boolean' },
          results: { type: 'array', items: { type: 'object' } },
          pagination: { type: 'object' }
        }
      }
    }
  }
}, handler);
```

---

## 📊 Infrastructure Checklist

### Immediate (Do Now)
- [ ] Apply database indexes migration
- [ ] Set up cron jobs (node-cron)
- [ ] Implement JWT authentication
- [ ] Add cache metrics

### Short-term (This Week)
- [ ] Optimize Redis caching strategy
- [ ] Complete JustTCG integration
- [ ] Add Swagger documentation
- [ ] Set up monitoring (Prometheus/Grafana)

### Long-term (This Month)
- [ ] Implement API rate limiting per tier
- [ ] Add database connection pooling
- [ ] Set up CDN for static assets
- [ ] Implement horizontal scaling (multiple API instances)

---

## 🚀 Performance Targets

### Current Performance (Estimated)
- Search query: ~5000ms (no indexes)
- Arbitrage detection: ~10000ms (table scans)
- Autocomplete: ~2000ms (no full-text index)
- Cache hit rate: Unknown

### Target Performance (After Optimizations)
- Search query: <50ms (99% reduction)
- Arbitrage detection: <100ms (99% reduction)
- Autocomplete: <20ms (99% reduction)
- Cache hit rate: >80%

### Capacity Targets
- Handle 10,000 req/sec (currently ~10 req/sec)
- Support 1M+ listings (currently 52K)
- <50ms p99 latency (currently >5000ms)

---

## 📝 Next Steps

1. **Get Production Database Access**
   - Apply performance indexes
   - Verify with EXPLAIN ANALYZE

2. **Deploy Cron Jobs**
   - Set up node-cron or PM2
   - Monitor execution logs

3. **Implement Authentication**
   - Generate JWT tokens
   - Protect premium routes
   - Add rate limiting

4. **Optimize Caching**
   - Add metrics
   - Implement smart TTL
   - Cache warming

5. **Complete Marketplace Integrations**
   - Finish JustTCG
   - Test all harvesters

6. **Monitor & Iterate**
   - Set up Grafana dashboards
   - Track query performance
   - Optimize bottlenecks
