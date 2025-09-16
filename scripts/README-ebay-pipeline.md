# eBay Data Pipeline - Comprehensive Pokemon Card Arbitrage System

## 🎯 Overview

This pipeline transforms your 600,000+ eBay Pokemon card database into a precision arbitrage intelligence system. It processes raw eBay listings, cleans and standardizes data, cross-references with Pokemon TCG API, and identifies profitable trading opportunities.

## 🏗️ Architecture

```
Raw eBay Data → Quality Assessment → Data Cleaning → Cross-Reference → Arbitrage Detection
     ↓              ↓                    ↓               ↓                    ↓
  505K records   Quality Report    Cleaned Data    API Matching      Opportunities
```

## 📦 Components

### 1. **Data Quality Assessment** (`ebay-data-quality-assessment.ts`)
- Analyzes data completeness and quality issues
- Identifies missing set names, card numbers, and URLs
- Provides detailed quality metrics and recommendations

### 2. **Title Parser** (`ebay-title-parser.ts`)
- Extracts Pokemon names, sets, and card numbers from titles
- Standardizes grading companies and grades
- Handles 100+ Pokemon sets with intelligent matching

### 3. **Price Normalizer** (`ebay-price-normalizer.ts`)
- Normalizes prices to USD with 100+ currency support
- Removes excessive decimal precision
- Identifies price outliers and unrealistic values

### 4. **Data Cleaner** (`ebay-data-cleaner.ts`)
- Applies all cleaning and standardization rules
- Generates missing eBay URLs
- Calculates confidence and quality scores

### 5. **Cross-Reference Matcher** (`ebay-cross-reference-matcher.ts`)
- Matches eBay data with Pokemon TCG API
- Provides market validation and pricing data
- Handles fuzzy matching for data inconsistencies

### 6. **Arbitrage Detector** (`ebay-arbitrage-detector.ts`)
- Identifies profitable trading opportunities
- Calculates risk levels and confidence scores
- Provides market indicators (liquidity, velocity, demand)

### 7. **Master Pipeline** (`ebay-master-pipeline.ts`)
- Orchestrates all components in sequence
- Provides comprehensive reporting
- Handles error recovery and progress tracking

## 🚀 Quick Start

### Prerequisites
```bash
# Install dependencies
npm install better-sqlite3 axios tsx

# Ensure you have the eBay database
ls research/tcgplayer-discovery/collector_crypt_ebay_complete.db
```

### Basic Execution
```bash
# Run the complete pipeline
tsx scripts/ebay-master-pipeline.ts

# Or with custom parameters
tsx scripts/ebay-master-pipeline.ts \
  --db "research/tcgplayer-discovery/collector_crypt_ebay_complete.db" \
  --batch-size 1000 \
  --min-profit 15 \
  --max-risk MEDIUM \
  --min-confidence 0.7
```

### Individual Component Execution
```bash
# 1. Quality Assessment
tsx scripts/ebay-data-quality-assessment.ts

# 2. Data Cleaning
tsx scripts/ebay-data-cleaner.ts

# 3. Cross-Reference Matching
tsx scripts/ebay-cross-reference-matcher.ts

# 4. Arbitrage Detection
tsx scripts/ebay-arbitrage-detector.ts
```

## ⚙️ Configuration Options

| Parameter | Default | Description |
|-----------|---------|-------------|
| `--db` | `collector_crypt_ebay_complete.db` | Path to eBay database |
| `--batch-size` | `1000` | Records per batch |
| `--start-id` | `0` | Starting record ID |
| `--min-profit` | `15` | Minimum profit percentage |
| `--max-risk` | `MEDIUM` | Maximum risk level (LOW/MEDIUM/HIGH) |
| `--min-confidence` | `0.7` | Minimum confidence score |
| `--skip-quality` | `false` | Skip quality assessment |
| `--skip-cleaning` | `false` | Skip data cleaning |
| `--skip-cross-reference` | `false` | Skip cross-reference matching |
| `--skip-arbitrage` | `false` | Skip arbitrage detection |

## 📊 Expected Results

### Data Quality Improvements
- **Set Information**: 90% → 95%+ completion rate
- **Card Identification**: 85% → 98% accuracy
- **Price Standardization**: 100% normalized pricing
- **Cross-Reference Coverage**: 70% → 90%+ matching

### Arbitrage Opportunities
- **Daily Opportunities**: 50-100 high-confidence signals
- **Average Profit Margin**: 15-25%
- **False Positive Rate**: <5%
- **Response Time**: <30 seconds for new opportunities

## 📁 Output Files

All reports are saved to the `reports/` directory:

### Quality Assessment
- `ebay-data-quality-assessment.md` - Comprehensive quality report
- `ebay-quality-metrics.json` - Programmatic metrics

### Data Cleaning
- `ebay-cleaning-quality-report.md` - Cleaning results
- `ebay-cleaning-stats.json` - Cleaning statistics
- `ebay-cleaned-sample.json` - Sample cleaned data

### Cross-Reference
- `ebay-cross-reference-stats.json` - Matching statistics
- `ebay-cross-reference-sample.json` - Sample matches

### Arbitrage Detection
- `ebay-arbitrage-opportunities.json` - Full opportunities data
- `ebay-arbitrage-opportunities.csv` - Spreadsheet analysis

### Master Pipeline
- `ebay-master-pipeline-report.md` - Comprehensive execution report
- `ebay-master-pipeline-stats.json` - Pipeline statistics

## 🎯 Arbitrage Opportunity Analysis

### Opportunity Structure
```typescript
interface ArbitrageOpportunity {
  id: string;
  cardName: string;
  setCode: string;
  cardNumber: string;
  grade: string;
  gradingCompany: string;
  
  // Pricing
  ebayPrice: number;
  marketValue: number;
  profitPotential: number;
  profitPercentage: number;
  roi: number;
  
  // Market indicators
  liquidity: 'HIGH' | 'MEDIUM' | 'LOW';
  velocity: number; // Days to sell
  demand: 'RISING' | 'STABLE' | 'FALLING';
  volatility: number;
  
  // Confidence
  confidence: number;
  dataQuality: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  
  // Metadata
  ebayItemId: string;
  ebayUrl: string;
}
```

### Risk Assessment
- **LOW**: High confidence, good liquidity, stable demand
- **MEDIUM**: Moderate confidence, decent liquidity
- **HIGH**: Low confidence, poor liquidity, high volatility

### Profit Calculation
```
Total Cost = eBay Price + eBay Fees (13%) + PayPal Fees (3%) + Shipping
Profit = Market Value - Total Cost
ROI = Profit / Total Cost * 100
```

## 🔧 Customization

### Adding New Pokemon Sets
Edit `ebay-title-parser.ts` and add to `setMappings`:
```typescript
'new set name': { code: 'NS', fullName: 'New Set', year: 2024 }
```

### Custom Price Validation
Edit `ebay-price-normalizer.ts` and modify `isRealisticPrice()`:
```typescript
// Add custom validation rules
if (context.pokemonName === 'custom_pokemon' && context.grade === '10') {
  return price <= 100000; // Custom price limit
}
```

### Custom Arbitrage Rules
Edit `ebay-arbitrage-detector.ts` and modify `isValidOpportunity()`:
```typescript
// Add custom opportunity filters
if (opportunity.cardName === 'Charizard' && opportunity.profitPercentage < 20) {
  return false; // Require higher profit for Charizard
}
```

## 📈 Performance Optimization

### Database Optimization
```sql
-- Add indexes for better performance
CREATE INDEX idx_cleaned_pokemon ON ebay_current_listings_cleaned(cleaned_pokemon_name);
CREATE INDEX idx_cleaned_set ON ebay_current_listings_cleaned(cleaned_set_code);
CREATE INDEX idx_cleaned_price ON ebay_current_listings_cleaned(cleaned_price);
CREATE INDEX idx_confidence ON ebay_current_listings_cleaned(confidence_score);
```

### Batch Processing
- Use smaller batch sizes for API calls (100 records)
- Use larger batch sizes for database operations (1000 records)
- Implement rate limiting for external API calls

### Memory Management
- Process data in batches to avoid memory issues
- Clear caches between stages
- Use streaming for large datasets

## 🚨 Troubleshooting

### Common Issues

#### Database Locked
```bash
# Check for running processes
ps aux | grep tsx

# Kill stuck processes
kill -9 <process_id>
```

#### API Rate Limiting
```bash
# Reduce batch size for cross-reference matching
tsx scripts/ebay-cross-reference-matcher.ts --batch-size 50
```

#### Memory Issues
```bash
# Process in smaller chunks
tsx scripts/ebay-master-pipeline.ts --batch-size 500 --start-id 0
tsx scripts/ebay-master-pipeline.ts --batch-size 500 --start-id 500
```

#### Missing Dependencies
```bash
# Install all required packages
npm install better-sqlite3 axios tsx @types/node
```

### Error Recovery
The pipeline includes automatic error recovery:
- Failed records are logged and skipped
- Progress is saved between stages
- Partial results are preserved

## 🔄 Maintenance

### Regular Updates
- **Weekly**: Run full pipeline for fresh opportunities
- **Daily**: Run arbitrage detection only for new data
- **Monthly**: Update currency exchange rates
- **Quarterly**: Review and update Pokemon set mappings

### Data Validation
```bash
# Validate data quality
tsx scripts/ebay-data-quality-assessment.ts

# Check for new opportunities
tsx scripts/ebay-arbitrage-detector.ts --min-profit 10
```

### Performance Monitoring
- Monitor pipeline execution time
- Track success rates for each stage
- Alert on data quality degradation

## 🎯 Success Metrics

### Pipeline Performance
- **Execution Time**: <2 hours for full pipeline
- **Success Rate**: >95% record processing
- **Data Quality**: >90% completeness

### Business Impact
- **Opportunity Detection**: 50-100 daily opportunities
- **Profit Potential**: $10,000+ monthly potential
- **False Positive Rate**: <5%
- **Market Coverage**: >90% of high-value cards

## 📞 Support

For issues or questions:
1. Check the troubleshooting section
2. Review the generated reports
3. Examine the error logs
4. Contact the development team

---

**Built with precision for Pokemon card arbitrage intelligence.**
