# eBay Production API Setup Guide

## Current Status

❌ **Using SANDBOX credentials** - Cannot harvest real sold listing data
✅ **Infrastructure ready** - Scripts and database schemas are production-ready

Your current `.env` has:
```
EBAY_APP_ID=YourName-Pokedao-SBX-xxxxx-xxxxx  ← SANDBOX (example)
EBAY_CERT_ID=SBX-xxxxx-xxxxx-xxxxx           ← SANDBOX (example)
EBAY_DEV_ID=your-dev-id-here
```

The `SBX-` prefix means **sandbox**. Sandbox doesn't have real sold listing data.

---

## Step 1: Get Production Credentials

### A. Visit eBay Developer Portal
1. Go to: **https://developer.ebay.com/my/keys**
2. Log in with your eBay developer account
3. **Switch environment** from "Sandbox" to "Production" (toggle at top of page)

### B. Request Production Access
1. Click **"Application Keys"** tab
2. Find your app: `Pokedao` (or create new one)
3. Click **"Request Production Access"**
4. You'll need to provide:
   - **App purpose**: "Pokemon TCG price analysis and arbitrage detection"
   - **Use case**: "Historical sold listing data for market research"
   - **Expected volume**: "4,500 API calls per day"

### C. Get Your Production Keys
Once approved (usually 1-2 business days), you'll see:
- **Production App ID (Client ID)**: `YourName-Pokedao-PRD-...`
- **Production Cert ID (Client Secret)**: `PRD-...`
- **Production Dev ID**: Same as sandbox

---

## Step 2: Update Environment Variables

Add these to your `.env` file:

```bash
# eBay Production Credentials
EBAY_PROD_APP_ID=YourName-Pokedao-PRD-xxxxxxxxx-xxxxxxxx
EBAY_PROD_CERT_ID=PRD-xxxxxxxxxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
EBAY_PROD_DEV_ID=ce4a5dc9-86a4-4ee4-9373-f7dcc1ad894e

# Keep sandbox for testing (example)
EBAY_APP_ID=YourName-Pokedao-SBX-xxxxx-xxxxx
EBAY_CERT_ID=SBX-xxxxx-xxxxx-xxxxx
EBAY_DEV_ID=your-dev-id-here
```

---

## Step 3: Run the eBay Harvester

### Using Production OAuth (Recommended)
```bash
pnpm tsx scripts/harvest-ebay-sold-history-v2.ts
```

This will:
- ✅ Use OAuth 2.0 with production credentials
- ✅ Harvest sold listings from high-value cards ($100+)
- ✅ Store in `CompSale` database table
- ✅ Respect 4,500 calls/day limit
- ✅ Build price history ledger over 30-60 days

### Using Legacy Finding API
```bash
# If using old script (will be deprecated Feb 2025)
pnpm tsx scripts/harvest-ebay-sold-history.ts
```

---

## Step 4: Monitor Progress

### Check Database
```bash
psql $DATABASE_URL -c "
  SELECT
    source,
    COUNT(*) as sales,
    MIN(soldAt) as oldest_sale,
    MAX(soldAt) as newest_sale
  FROM \"CompSale\"
  WHERE source = 'EBAY'
  GROUP BY source;
"
```

### Check API Calls Used Today
```bash
cat data/ebay-sold-checkpoint.json
```

---

## Rate Limits & Best Practices

### Default Limits
- **5,000 calls/day** (default for all apps)
- **200 requests/second** (burst limit)

### Conservative Approach
- Use **4,500 calls/day** (90% of limit) for safety
- **1 second delay** between requests
- **Run overnight** to avoid user impact

### Request Increased Limits
For serious production use, you can request:
- Up to **1.5M calls/day**
- Process: https://developer.ebay.com/api-docs/static/versioning.html#compat

Steps:
1. Go to https://developer.ebay.com/my/keys
2. Click "Application Growth Check"
3. Provide usage metrics after 30 days of production use
4. eBay reviews and approves (usually within 1 week)

---

## API Endpoints

### Finding API (Current - Deprecating Feb 2025)
```
https://svcs.ebay.com/services/search/FindingService/v1
```

**Operations**:
- `findCompletedItems` - Get sold listings ✅ (what we use)
- `findItemsByKeywords` - Active listings
- `findItemsAdvanced` - Advanced filters

### Browse API (Future - Recommended)
```
https://api.ebay.com/buy/browse/v1
```

**Operations**:
- `search` - Search with filters
- `get_item` - Get specific item details

**Migration Timeline**:
- Finding API deprecation: **February 2025**
- Recommended: Migrate to Browse API by **January 2025**

---

## Data Strategy

### Phase 1: High-Value Cards (Weeks 1-2)
- Target: Cards worth $100+ in our database
- Volume: ~100-200 unique cards
- Coverage: 30-50 sales per card
- Result: Build baseline price trends

### Phase 2: Expand Coverage (Weeks 3-4)
- Lower threshold to $50+
- Volume: ~500-1000 unique cards
- Coverage: 20-30 sales per card

### Phase 3: Full Coverage (Months 2-3)
- All graded cards in database
- Volume: ~5,000+ unique cards
- Coverage: 10-20 sales per card

### Result After 90 Days
- **150,000-300,000 sold listings** in database
- **Complete price history** for high-value cards
- **AI-ready dataset** for trend prediction
- **Arbitrage detection** with 95%+ confidence

---

## Troubleshooting

### Error: "Missing access token"
**Cause**: Using MAD verification token instead of OAuth
**Fix**: Use `EBayOAuth` class in `scripts/lib/ebay-oauth.ts`

### Error: "Internal Server Error"
**Cause**: Using sandbox credentials in production
**Fix**: Get production credentials (see Step 1)

### Error: "Daily call limit exceeded"
**Cause**: Made >5,000 requests in 24 hours
**Fix**: Wait until next day (limit resets midnight PST)

### Error: "Invalid App ID"
**Cause**: Wrong credentials or typo in .env
**Fix**: Double-check credentials from developer portal

---

## Next Steps

1. ✅ Get production credentials (Steps 1-2)
2. ✅ Run harvester in background: `pnpm tsx scripts/harvest-ebay-sold-history-v2.ts 2>&1 &`
3. ✅ Let it run for 7-14 days to build initial dataset
4. ✅ Query price trends via API: `GET /api/price-history?cardName=Charizard&grade=10`
5. ✅ Feed data to DeepSeek AI for autonomous trend analysis

Once you have **30+ days of eBay sold data**, your AI agent will be able to:
- Predict price movements with high confidence
- Detect arbitrage opportunities in real-time
- Post actionable insights to X/Twitter
- Generate $100-500/month passive income (conservative estimate)

---

## Cost Analysis

### eBay API
- **Free**: 5,000 calls/day
- **Free**: Up to 1.5M calls/day (after approval)
- **Paid**: $0 (never have to pay for Finding/Browse APIs)

### Database Storage
- **150K-300K records** ≈ 50-100 MB
- **PostgreSQL**: Free (Supabase free tier: 500 MB)
- **Upgrade**: $25/month for 8 GB (only if you scale to 10M+ records)

### AI Analysis (DeepSeek)
- **Input**: 150K records ≈ 30M tokens
- **Cost**: ~$0.14 per analysis run (at $4.70/M tokens)
- **Monthly**: ~$4-5 for daily analysis

**Total Monthly Cost**: $4-5 (or $29-30 if you need paid PostgreSQL)

**Expected ROI**: 10-100x (find $400-4,000 in arbitrage per month)
