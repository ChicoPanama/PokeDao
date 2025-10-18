# Sold Data Collection - Setup Complete ✅

## 🎯 Summary

Automated system is now ready to collect **top 3,000 most expensive sold Pokemon cards** with **1-month, 6-month, and 12-month price trends** once the eBay rate limit resets.

---

## 📊 Current Data Status

### ✅ Successfully Collected
- **1,999 cards from JustTCG** - Active market pricing
- **1,603 cards from eBay Browse API** - Active listings
- **1,833 unique cards** - Already in database with pricing

### ⏳ Pending (Rate Limited)
- **3,000 sold cards from eBay Finding API**
  - Status: Rate limited (Error 10001)
  - Reset: ~24 hours (Tomorrow ~3 AM)
  - Will auto-collect when available

---

## 🚀 How to Schedule for Tomorrow

Choose **ONE** of these options:

### Option 1: Quick Setup (Recommended)
```bash
bash scripts/run-tomorrow.sh
```
This schedules a one-time run for tomorrow at 3 AM.

### Option 2: Daily Automatic Collection
```bash
bash scripts/setup-automatic-collection.sh
```
This sets up daily collection at 3 AM (runs every day).

### Option 3: Manual Tomorrow
Just wait until tomorrow and run:
```bash
bash scripts/schedule-sold-data-collection.sh
```

---

## 📁 What You'll Get

Once collection completes (tomorrow), you'll have:

### 1. JSON Report with Trends
**File**: `data/top-3000-sold-cards-with-trends.json`

Example entry:
```json
{
  "rank": 1,
  "cardName": "Charizard Base Set Shadowless",
  "setName": "Base Set (Shadowless)",
  "maxPriceUSD": "$15,000.00",
  "avgPriceUSD": "$12,500.00",
  "minPriceUSD": "$8,000.00",
  "trend1Month": 8.5,     // ↑ Up 8.5% in last month
  "trend6Month": -3.2,    // ↓ Down 3.2% over 6 months
  "trend12Month": 15.7,   // ↑ Up 15.7% over 12 months
  "soldCount": 45
}
```

### 2. CSV Report (Spreadsheet)
**File**: `data/top-3000-cards-market-report.csv`

Import into Excel/Google Sheets for analysis.

### 3. Detailed Logs
**File**: `logs/sold-data-collection-YYYY-MM-DD.log`

Complete execution log with timestamps.

---

## 📈 Price Trend Calculations

Trends are calculated from sold transaction data:

- **1-Month Trend**: Price change from 30 days ago
- **6-Month Trend**: Price change from 6 months ago
- **12-Month Trend**: Price change from 12 months ago

Formula:
```
Trend % = ((Current Avg - Previous Avg) / Previous Avg) × 100
```

Positive = Price increasing 📈
Negative = Price decreasing 📉

---

## 🔍 How the Scheduler Works

1. **Checks Rate Limit** - Tests eBay API before attempting
2. **Waits if Needed** - Skips if rate limit still active
3. **Collects Data** - Fetches 3,000 sold cards when available
4. **Calculates Trends** - Computes price changes over time
5. **Generates Reports** - Creates JSON + CSV outputs
6. **Logs Results** - Records success/failure

---

## 📝 Quick Reference

### Check Scheduled Jobs
```bash
atq                    # List 'at' jobs (one-time)
crontab -l            # List cron jobs (recurring)
```

### View Logs
```bash
tail -f logs/scheduled-run.log
tail -f logs/sold-data-collection-$(date +%Y-%m-%d).log
```

### Check Database Status
```bash
psql postgresql://pokedao:pokedao@localhost:5432/pokedao -c "
  SELECT COUNT(*) FROM \"CompSale\";
"
```

### Run Manually Anytime
```bash
bash scripts/schedule-sold-data-collection.sh
```

---

## 🚨 Troubleshooting

### Still Getting Rate Limit Error?
**Wait 24 hours** from the first rate limit error. The scheduler tracks this automatically.

### Permission Denied?
```bash
chmod +x scripts/*.sh
```

### Lock File Error?
```bash
rm -f .sold-collector.lock
```

---

## 📚 Documentation

Full documentation available at:
- **[scripts/README-sold-data-scheduler.md](scripts/README-sold-data-scheduler.md)** - Complete guide
- **[scripts/schedule-sold-data-collection.sh](scripts/schedule-sold-data-collection.sh)** - Main scheduler
- **[scripts/harvest-top-sold-cards-with-trends.ts](scripts/harvest-top-sold-cards-with-trends.ts)** - Data collector

---

## ✅ Next Steps

1. **Schedule for Tomorrow**:
   ```bash
   bash scripts/run-tomorrow.sh
   ```

2. **Check Status Tomorrow**:
   ```bash
   tail -f logs/scheduled-run.log
   ```

3. **View Results**:
   ```bash
   cat data/top-3000-sold-cards-with-trends.json | jq '.[0:10]'  # Top 10 cards
   ```

---

**Status**: ✅ Ready to schedule
**Next Run**: Tomorrow 3:00 AM
**Expected Output**: 3,000 sold cards with price trends
**Report Format**: JSON + CSV

---

*Last Updated: October 11, 2025*
