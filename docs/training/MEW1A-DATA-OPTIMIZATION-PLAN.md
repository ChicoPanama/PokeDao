# Mew-1A Data Optimization Plan
## Maximizing 355,000+ Consolidated Records for AI Training

**Status**: 🔄 Migration In Progress (143k/198k eBay records done)
**Goal**: Extract maximum value from consolidated data for Mew-1A fine-tuning
**Impact**: 10x+ training data → Significantly better model performance

---

## 🎯 Strategic Recommendations

### Current Mew-1A Status
- **Training Data**: 10,000 curated examples from 400k+ listings
- **Model**: Llama-3.2-3B + 48.7MB LoRA adapters
- **Performance**: 0.170 final loss, deployed to Modal Labs
- **Limitation**: Trained on limited, manually curated dataset

### After Consolidation
- **Available Data**: ~355,000 records (35x more than current training set)
- **Data Sources**: 5 diverse marketplaces (eBay, Collector Crypt, TCGPlayer, JustTCG, Official)
- **Data Types**: Active listings + sold transactions + price history
- **Opportunity**: Retrain Mew-1A on massively expanded, high-quality dataset

---

## 📊 Phase 1: Data Audit & Quality Assessment (1-2 hours)

### 1.1 Assess Data Completeness

**Query**: Check what percentage of records have complete pricing data
```sql
SELECT
  source,
  COUNT(*) as total_records,
  COUNT(DISTINCT "cardName") as unique_cards,
  COUNT("priceCents") as with_price,
  ROUND(100.0 * COUNT("priceCents") / COUNT(*), 2) as price_coverage_pct,
  COUNT("cardNumber") as with_card_number,
  COUNT("setName") as with_set,
  AVG("dataQuality") as avg_quality
FROM "UnifiedMarketListing"
GROUP BY source
ORDER BY total_records DESC;
```

**Action**: Identify which sources have the best data quality for training

### 1.2 Identify High-Value Training Examples

**Criteria for Quality Training Data**:
1. ✅ Complete card identification (name + set + number)
2. ✅ Valid pricing data (not null, within reasonable range)
3. ✅ Condition/grade information (for context)
4. ✅ Source diversity (multiple marketplaces for same card)
5. ✅ Recent data (higher relevance)

**Query**: Extract premium training candidates
```sql
SELECT
  "cardName",
  "setName",
  "cardNumber",
  COUNT(*) as listing_count,
  AVG("priceCents"/100.0) as avg_price,
  MIN("priceCents"/100.0) as min_price,
  MAX("priceCents"/100.0) as max_price,
  STDDEV("priceCents"/100.0) as price_volatility,
  COUNT(DISTINCT source) as source_diversity,
  AVG("dataQuality") as avg_quality_score
FROM "UnifiedMarketListing"
WHERE
  "cardName" IS NOT NULL
  AND "setName" IS NOT NULL
  AND "priceCents" IS NOT NULL
  AND "priceCents" > 0
  AND "priceCents" < 10000000  -- Less than $100k (removes outliers)
GROUP BY "cardName", "setName", "cardNumber"
HAVING COUNT(*) >= 3  -- At least 3 listings for reliable pricing
ORDER BY source_diversity DESC, avg_quality_score DESC
LIMIT 100000;
```

### 1.3 Analyze Sold Data for Trend Training

**Query**: Sold listings with time-series data
```sql
SELECT
  source,
  COUNT(*) as sold_count,
  MIN("soldAt") as earliest_sale,
  MAX("soldAt") as latest_sale,
  AVG("priceCents"/100.0) as avg_sold_price,
  COUNT(DISTINCT DATE_TRUNC('month', "soldAt")) as months_covered
FROM "CompSale"
WHERE "priceCents" IS NOT NULL
GROUP BY source;
```

**Value**: Train Mew-1A to understand price trends and market velocity

---

## 🔬 Phase 2: Generate Mew-1A Training Dataset (2-3 hours)

### 2.1 Create Structured Training Examples

**Format**: Convert database records into instruction-tuning format

```typescript
// Example training record format
{
  "instruction": "Analyze: Charizard VSTAR - Brilliant Stars #18. Listed at $45.00, 8 active listings, sold 15x in 30 days at avg $52.00",
  "input": "",
  "output": "ANALYSIS: Strong BUY opportunity\n\nPRICING:\n• Listed: $45.00\n• Fair Value: $52.00 (based on 15 recent sales)\n• Discount: 13.5% below market\n\nLIQUIDITY:\n• Sales Velocity: 15 sales/30 days (0.5/day)\n• Market Depth: 8 active listings\n• Days to Clear: ~16 days\n• Liquidity Grade: B+\n\nRECOMMENDATION: BUY\nReasoning: Significant discount with proven demand. High probability of selling within 2-3 weeks at market value for 15%+ profit."
}
```

### 2.2 Training Data Categories

**Category 1: Arbitrage Detection** (50,000 examples)
- Compare listing price vs market average
- Identify underpriced/overpriced cards
- Calculate discount percentages

**Category 2: Liquidity Analysis** (50,000 examples)
- Sales velocity from sold data
- Market depth from active listings
- Time-to-sell predictions

**Category 3: Price Trend Analysis** (50,000 examples)
- Historical price movements
- Seasonal patterns
- Set release impact

**Category 4: Multi-Source Consensus** (50,000 examples)
- Compare prices across eBay, Collector Crypt, TCGPlayer
- Identify market inefficiencies
- Cross-marketplace arbitrage

**Category 5: Condition/Grade Adjustments** (50,000 examples)
- PSA 10 vs PSA 9 premium
- Graded vs ungraded differential
- Condition impact on pricing

**Total: 250,000 training examples** (25x current dataset)

### 2.3 Data Extraction Script

**File**: `scripts/mew1a-extract-training-data-v2.ts`

**Features**:
- ✅ Query consolidated PostgreSQL data
- ✅ Generate instruction-tuning examples
- ✅ Apply quality filters (dataQuality >= 0.7)
- ✅ Balance categories evenly
- ✅ Include source diversity
- ✅ Export to JSONL format for HuggingFace

---

## 🚀 Phase 3: Retrain Mew-1A on Consolidated Data (8-12 hours)

### 3.1 Training Configuration

**Recommended Changes**:
```yaml
# Current (Mew-1A v1)
base_model: "meta-llama/Llama-3.2-3B-Instruct"
training_examples: 10,000
epochs: 3
final_loss: 0.170
training_time: 76 minutes

# Proposed (Mew-1A v2)
base_model: "meta-llama/Llama-3.2-3B-Instruct"  # Keep same base
training_examples: 250,000  # 25x increase
epochs: 2-3  # Adjust based on convergence
batch_size: 8  # Increase if GPU allows
learning_rate: 2e-4  # Start same, may tune
lora_r: 16  # Keep same
lora_alpha: 32  # Keep same
target_modules: ["q_proj", "k_proj", "v_proj", "o_proj"]
expected_time: 8-12 hours on RTX 4090
target_loss: < 0.150
```

### 3.2 Training Data Split

```
Training Set: 225,000 examples (90%)
Validation Set: 12,500 examples (5%)
Test Set: 12,500 examples (5%)
```

**Stratification**:
- Balanced across 5 categories
- Diverse price ranges ($1 - $10,000+)
- Multiple sets and card types
- Various conditions/grades

### 3.3 Expected Improvements

| Metric | Mew-1A v1 | Mew-1A v2 (Expected) | Improvement |
|--------|-----------|----------------------|-------------|
| **Training Examples** | 10,000 | 250,000 | 25x |
| **Data Sources** | 1-2 | 5 | 2.5x |
| **Final Loss** | 0.170 | < 0.150 | 12%+ better |
| **Market Coverage** | Limited | Comprehensive | Full spectrum |
| **Sold Data Integration** | None | 50,000 examples | NEW capability |
| **Cross-Marketplace** | Limited | Full | Multi-source arbitrage |

---

## 📈 Phase 4: Post-Migration Optimization (Ongoing)

### 4.1 Create Mew-1A Inference Cache

**Purpose**: Pre-compute analyses for top 10,000 cards

```typescript
// Cache structure
{
  cardId: "charizard-base-set-4-holo",
  lastAnalyzed: "2025-10-11T00:00:00Z",
  mew1aAnalysis: {
    fairValue: 12500,  // cents
    confidence: 0.92,
    liquidityGrade: "A",
    recommendation: "HOLD",
    reasoning: "..."
  },
  dataPoints: {
    activeListings: 45,
    soldLast30Days: 23,
    avgSoldPrice: 13200,
    sources: ["EBAY", "COLLECTOR_CRYPT", "TCGPLAYER"]
  }
}
```

**Benefit**: Instant analysis without API calls

### 4.2 Continuous Learning Pipeline

**Setup**:
1. Daily data collection (already scheduled)
2. Weekly incremental training on new data
3. Monthly full retraining with expanded dataset
4. A/B testing between model versions

### 4.3 Quality Metrics Dashboard

**Track**:
- Model prediction accuracy vs actual sales
- Arbitrage detection success rate
- Liquidity prediction correlation
- User feedback on recommendations

---

## 🛠️ Implementation Scripts

### Script 1: Data Audit (`scripts/audit-mew1a-training-data.ts`)
```typescript
// Analyze consolidated data quality
// Identify best training candidates
// Generate quality report
```

### Script 2: Training Data Extraction (`scripts/mew1a-extract-training-data-v2.ts`)
```typescript
// Query PostgreSQL for quality records
// Generate 250k instruction-tuning examples
// Export to JSONL for HuggingFace
// Balance categories and price ranges
```

### Script 3: Retrain Mew-1A (`scripts/mew1a-retrain-v2.sh`)
```bash
# Upload new dataset to HuggingFace
# Launch RunPod training job
# Monitor training progress
# Deploy to Modal Labs when complete
```

### Script 4: Inference Cache Builder (`scripts/mew1a-build-cache.ts`)
```typescript
// Pre-compute analyses for top cards
// Store in Redis/PostgreSQL
// Update daily with new data
```

---

## ✅ Success Metrics

### Immediate (Post-Migration)
- [ ] 355,000+ records successfully migrated
- [ ] Data quality audit complete
- [ ] 250,000 training examples extracted
- [ ] Training examples validated and balanced

### Short-Term (1-2 weeks)
- [ ] Mew-1A v2 trained on new dataset
- [ ] Final loss < 0.150 achieved
- [ ] Model deployed to Modal Labs
- [ ] A/B test v1 vs v2 performance

### Long-Term (1 month+)
- [ ] Mew-1A v2 shows 20%+ better prediction accuracy
- [ ] Successfully detects arbitrage opportunities across all sources
- [ ] Liquidity predictions within 15% of actual
- [ ] User satisfaction > 85%

---

## 💰 Business Impact

### Current State
- Mew-1A trained on limited data
- Single-source pricing analysis
- No historical trend capability
- Limited arbitrage detection

### After Optimization
- Mew-1A trained on comprehensive multi-source data
- Cross-marketplace arbitrage detection
- Historical trend analysis and predictions
- Liquidity-adjusted pricing recommendations
- **Competitive advantage**: Only TCG AI trained on 355k+ real market records

### ROI Calculation
```
Training Cost: $20-30 (RunPod RTX 4090, 8-12 hours)
Data Cost: $0 (already collected)
Development Time: 20-30 hours (spread over 1-2 weeks)

Value Created:
- Better arbitrage detection: $5k-10k/month in identified opportunities
- Improved pricing accuracy: 20%+ reduction in pricing errors
- Faster analysis: Pre-computed cache = instant recommendations
- Market edge: Only comprehensive multi-source TCG AI

Break-even: < 1 week
```

---

## 🚨 Critical Next Steps (Priority Order)

### 1. **Monitor Migration Completion** (NOW)
Wait for current migration to finish (~30 minutes remaining)

### 2. **Run Data Quality Audit** (30 minutes)
```bash
pnpm tsx scripts/audit-mew1a-training-data.ts
```

### 3. **Extract Training Dataset** (2-3 hours)
```bash
pnpm tsx scripts/mew1a-extract-training-data-v2.ts
```

### 4. **Upload to HuggingFace** (30 minutes)
```bash
python scripts/mew1a-upload-dataset-v2.py
```

### 5. **Launch Retraining** (8-12 hours)
```bash
bash scripts/mew1a-retrain-v2.sh
```

### 6. **Deploy & Validate** (1-2 hours)
```bash
python scripts/mew1a-deploy-v2.py
pnpm tsx scripts/mew1a-validate-v2.ts
```

---

## 📚 Additional Considerations

### Data Privacy & Ethics
- ✅ All data is publicly available market data
- ✅ No personal information collected
- ✅ Compliant with marketplace ToS
- ✅ Transparent methodology

### Model Version Control
- Keep Mew-1A v1 in production during v2 training
- A/B test both versions
- Gradual rollout of v2
- Rollback plan if v2 underperforms

### Continuous Improvement
- Weekly data freshness updates
- Monthly model retraining
- Quarterly architecture review
- User feedback integration

---

**Last Updated**: October 11, 2025
**Status**: 🔄 Migration 72% Complete (143k/198k)
**Next Action**: Wait for migration completion, then run audit

---

*This plan transforms Mew-1A from a prototype trained on limited data into a production-grade TCG pricing AI with comprehensive multi-source market intelligence.*
