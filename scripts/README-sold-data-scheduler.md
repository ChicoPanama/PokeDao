# Pokemon Sold Data Collection Scheduler

Automated system to collect top 3,000 most expensive sold Pokemon cards with 1-month, 6-month, and 12-month price trends.

## 📊 What It Does

The scheduler automatically:

1. **Checks eBay Rate Limit** - Verifies the API is available before attempting collection
2. **Collects Sold Data** - Fetches up to 3,000 sold Pokemon card transactions from eBay
3. **Calculates Trends** - Computes 1-month, 6-month, and 12-month price trend percentages
4. **Generates Reports** - Creates JSON and CSV reports with comprehensive pricing data
5. **Logs Everything** - Maintains detailed logs of all collection attempts

## 🚀 Quick Start

### Option 1: Run Tomorrow at 3 AM (One-Time)

```bash
bash scripts/run-tomorrow.sh
```

This schedules a single collection run for tomorrow at 3 AM when the eBay rate limit will have reset.

### Option 2: Set Up Daily Collection (Recurring)

```bash
bash scripts/setup-automatic-collection.sh
```

This sets up a daily cron job that runs at 3 AM every day.

### Option 3: Manual Run

```bash
bash scripts/schedule-sold-data-collection.sh
```

This runs the collector immediately (will fail if rate limit is still active).

## 📁 Output Files

When collection completes successfully, you'll find:

### JSON Report (Detailed)
```
data/top-3000-sold-cards-with-trends.json
```

Contains full card data with:
- Card name and set
- Max/average/min sold prices
- 1-month trend percentage
- 6-month trend percentage
- 12-month trend percentage
- Number of sold transactions

### CSV Report (Spreadsheet-Ready)
```
data/top-3000-cards-market-report.csv
```

Same data in CSV format for Excel/Google Sheets.

### Logs
```
logs/sold-data-collection-YYYY-MM-DD.log
logs/cron-sold-collector.log
```

Detailed execution logs with timestamps.

## 🔄 Current Status

### ✅ Successfully Collected
- **1,999 cards from JustTCG** (active market pricing)
- **1,603 cards from eBay** (active listings via Browse API)
- **1,833 unique cards** in current database

### ⏳ Pending Collection
- **3,000 sold cards** from eBay Finding API
  - **Status**: Rate limited (Error 10001)
  - **Reset Time**: ~24 hours from first hit (October 11, 2025 ~3 AM)
  - **Solution**: Scheduler will auto-retry when available

## 📈 Trend Calculation

Price trends are calculated using sold transaction data:

```
1-Month Trend = ((Avg Last 30 Days - Avg 30-60 Days Ago) / Avg 30-60 Days Ago) × 100
6-Month Trend = ((Avg Last 6 Months - Avg 6-12 Months Ago) / Avg 6-12 Months Ago) × 100
12-Month Trend = ((Avg Last 12 Months - Avg 12-24 Months Ago) / Avg 12-24 Months Ago) × 100
```

### Example Trend Output

```json
{
  "rank": 1,
  "cardName": "Charizard Base Set Shadowless",
  "setName": "Base Set (Shadowless)",
  "maxPriceUSD": "$15,000.00",
  "avgPriceUSD": "$12,500.00",
  "trend1Month": 8.5,    // Up 8.5% in last month
  "trend6Month": -3.2,   // Down 3.2% over 6 months
  "trend12Month": 15.7,  // Up 15.7% over 12 months
  "soldCount": 45
}
```

## 🛠️ Scheduler Configuration

### Cron Schedule (Default: 3 AM Daily)

Edit the cron job:
```bash
crontab -e
```

Add or modify:
```cron
0 3 * * * cd /Users/arcadio/dev/pokedao && ./scripts/schedule-sold-data-collection.sh >> logs/cron-sold-collector.log 2>&1
```

### Custom Schedule Examples

Run twice daily (3 AM and 3 PM):
```cron
0 3,15 * * * cd /Users/arcadio/dev/pokedao && ./scripts/schedule-sold-data-collection.sh >> logs/cron-sold-collector.log 2>&1
```

Run every 6 hours:
```cron
0 */6 * * * cd /Users/arcadio/dev/pokedao && ./scripts/schedule-sold-data-collection.sh >> logs/cron-sold-collector.log 2>&1
```

Run weekly on Mondays at 3 AM:
```cron
0 3 * * 1 cd /Users/arcadio/dev/pokedao && ./scripts/schedule-sold-data-collection.sh >> logs/cron-sold-collector.log 2>&1
```

## 🔍 Monitoring

### View Scheduled Jobs

```bash
crontab -l  # List cron jobs
atq         # List 'at' jobs (one-time)
```

### Check Logs

```bash
tail -f logs/sold-data-collection-$(date +%Y-%m-%d).log
tail -f logs/cron-sold-collector.log
```

### Database Status

```bash
psql postgresql://pokedao:pokedao@localhost:5432/pokedao -c "
  SELECT
    COUNT(*) as total_sold,
    MIN(\"soldAt\") as earliest,
    MAX(\"soldAt\") as latest
  FROM \"CompSale\";
"
```

## 🚨 Troubleshooting

### Rate Limit Still Active

If you see: `Error 10001: Service call has exceeded the number of times the operation is allowed`

**Solution**: Wait 24 hours from the first rate limit error. The scheduler automatically tracks this.

### Missing Environment Variables

If you see: `EBAY_APP_ID not found`

**Solution**: Ensure `.env` file contains:
```bash
EBAY_APP_ID=your_app_id_here
```

### Lock File Issues

If you see: `Collector is already running (lock file exists)`

**Solution**: Remove stale lock file:
```bash
rm -f .sold-collector.lock
```

### Permission Denied

If you see: `Permission denied`

**Solution**: Make scripts executable:
```bash
chmod +x scripts/*.sh
```

## 📊 API Rate Limits

### eBay Finding API
- **Limit**: 5,000 calls per day per App ID
- **Rate Limit Error**: Code 10001
- **Reset**: 24 hours after first hit

### eBay Browse API (OAuth)
- **Limit**: Varies by account (typically 1,000-5,000 per day)
- **Token Expiry**: 2 hours
- **Rate Limit Error**: HTTP 429 or 401

### JustTCG API (Free Plan)
- **Limit**: 1,000 calls per month
- **Rate Limit**: 10 requests per minute
- **Limit Exceeded**: HTTP 429

## 📝 Manual Data Collection

If you need to collect data immediately (bypassing scheduler):

### Collect Sold Data
```bash
pnpm tsx scripts/harvest-top-sold-cards-with-trends.ts
```

### Collect Active Listings
```bash
pnpm tsx scripts/harvest-justtcg-top-cards.ts
pnpm tsx scripts/harvest-ebay-browse-oauth.ts
```

### Generate Reports
```bash
pnpm tsx scripts/generate-top-cards-report.ts
```

## 🔐 Security Notes

- `.env` file contains API credentials (excluded from git)
- Lock files prevent concurrent runs
- Logs may contain API responses (review before sharing)
- Rate limit tracking files are local only

## 📬 Support

For issues or questions:
1. Check logs in `logs/` directory
2. Review error messages in console output
3. Verify API credentials in `.env`
4. Ensure database is running and accessible

---

**Last Updated**: October 11, 2025
**Next Collection**: Tomorrow 3:00 AM (scheduled)
**Current Status**: eBay rate limited, awaiting reset
