# Unified Market Pipeline - Pokemon Card Arbitrage Intelligence System

## 🎯 Overview

The Unified Market Pipeline is a comprehensive, source-agnostic system that transforms raw marketplace data from multiple sources (eBay, TCGPlayer, Fanatics, Collector Crypt) into actionable arbitrage opportunities. Built with enterprise-grade architecture, it provides consistent data processing, quality assessment, and opportunity detection across all marketplaces.

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Data Sources  │    │   Adapters      │    │   Core Engine   │
├─────────────────┤    ├─────────────────┤    ├─────────────────┤
│ • eBay          │───▶│ • eBay Adapter  │───▶│ • Normalization │
│ • TCGPlayer     │    │ • TCG Adapter   │    │ • Cross-Ref     │
│ • Fanatics      │    │ • Fanatics Adap │    │ • Arbitrage     │
│ • CollectorCrypt│    │ • CC Adapter    │    │ • Collections   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │                        │
                                ▼                        ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Storage       │    │   Reporting     │    │   API Layer     │
├─────────────────┤    ├─────────────────┤    ├─────────────────┤
│ • PostgreSQL    │    │ • JSON Reports  │    │ • CLI Interface │
│ • Redis Cache   │    │ • CSV Exports   │    │ • REST APIs     │
│ • File System   │    │ • Markdown      │    │ • Webhooks      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 📦 Package Structure

```
/packages/market-core/
├── src/
│   ├── types.ts           # Shared types and interfaces
│   ├── schemas.ts         # Zod validation schemas
│   ├── currency.ts        # Currency conversion utilities
│   ├── fees.ts           # Marketplace fee calculations
│   ├── parsing.ts        # Title parsing utilities
│   ├── price.ts          # Price normalization
│   ├── risk.ts           # Risk assessment algorithms
│   ├── collections.ts    # Collection management
│   ├── batching.ts       # Batch processing utilities
│   ├── logger.ts         # Structured logging
│   ├── errors.ts         # Error handling
│   └── reports.ts        # Report generation
└── index.ts              # Main exports

/packages/market-adapters/
├── src/
│   ├── adapters/
│   │   ├── ebay/         # eBay marketplace adapter
│   │   ├── tcgplayer/    # TCGPlayer adapter
│   │   ├── fanatics/     # Fanatics adapter
│   │   └── collectorcrypt/ # Collector Crypt adapter
│   ├── crossref/
│   │   └── pokemon-tcg.ts # Pokemon TCG API integration
│   ├── normalize.ts      # Data normalization
│   ├── arbitrage.ts      # Arbitrage detection
│   ├── pipeline.ts       # Pipeline orchestration
│   └── index.ts          # Main exports
└── index.ts

/apps/agent/
├── src/cli/
│   └── run-market-pipeline.ts # CLI interface
└── scripts/
    └── run-market-pipeline.sh # Shell wrapper
```

## 🚀 Quick Start

### Prerequisites

```bash
# Install dependencies
npm install
pnpm install

# Set up environment variables
cp .env.example .env
# Edit .env with your configuration
```

### Basic Usage

```bash
# Run the complete pipeline with default settings
pnpm run market:pipeline

# Run with specific sources
pnpm run market:ebay
pnpm run market:tcg
pnpm run market:all

# Run with different modes
pnpm run market:pipeline:conservative
pnpm run market:pipeline:aggressive

# Run for specific collections
pnpm run market:collections:slabs
pnpm run market:collections:prospects

# Dry run (no persistence)
pnpm run market:dry-run

# Verbose logging
pnpm run market:verbose
```

### Advanced Usage

```bash
# Custom configuration
pnpm run market:pipeline -- \
  --sources=ebay,tcgplayer \
  --collections=slabs,prospects \
  --mode=conservative \
  --limit=1000 \
  --since=2025-01-01 \
  --output-dir=./custom-reports \
  --verbose

# Process specific date range
pnpm run market:pipeline -- \
  --since=2025-01-01 \
  --limit=500

# Collection-specific analysis
pnpm run market:pipeline -- \
  --collections=watchlist,flip-queue \
  --mode=aggressive
```

## 📊 Data Flow

### 1. Data Ingestion
- **Source Adapters**: Each marketplace has a dedicated adapter
- **Raw Data**: Fetched from APIs, databases, or files
- **Canonical Mapping**: Converted to unified format

### 2. Data Normalization
- **Price Standardization**: Convert to USD cents
- **Text Cleaning**: Normalize titles, names, descriptions
- **Quality Assessment**: Calculate data quality scores

### 3. Cross-Reference Matching
- **Pokemon TCG API**: Match with official card database
- **Market Validation**: Verify pricing against market data
- **Confidence Scoring**: Assess match quality

### 4. Arbitrage Detection
- **Profit Calculation**: Factor in fees, shipping, taxes
- **Risk Assessment**: Evaluate market risk factors
- **Opportunity Ranking**: Sort by profit potential

### 5. Collection Processing
- **Portfolio Grouping**: Organize by user collections
- **Collection Reports**: Generate targeted insights
- **Recommendation Engine**: Suggest optimal actions

## 🎯 Key Features

### Multi-Source Support
- **eBay**: 600K+ listings with comprehensive data
- **TCGPlayer**: Official pricing and market data
- **Fanatics**: Sports card marketplace integration
- **Collector Crypt**: NFT marketplace support

### Intelligent Data Processing
- **Title Parsing**: Extract Pokemon names, sets, grades
- **Price Normalization**: Handle 100+ currencies
- **Quality Scoring**: Assess data completeness and accuracy
- **Cross-Reference**: Validate against official databases

### Advanced Analytics
- **Arbitrage Detection**: Identify profitable opportunities
- **Risk Assessment**: Evaluate market and data risks
- **Liquidity Analysis**: Predict sales velocity
- **Trend Detection**: Monitor demand patterns

### Collection Management
- **Portfolio Grouping**: Organize cards by collections
- **Custom Rules**: Define collection criteria
- **Performance Tracking**: Monitor collection performance
- **Targeted Reports**: Collection-specific insights

## 📈 Expected Results

### Data Quality Improvements
- **Completeness**: 90% → 95%+ completion rate
- **Accuracy**: 85% → 98%+ accuracy
- **Consistency**: Unified format across all sources
- **Freshness**: Real-time data updates

### Arbitrage Opportunities
- **Daily Opportunities**: 50-100 high-confidence signals
- **Average Profit Margin**: 15-25%
- **False Positive Rate**: <5%
- **Response Time**: <30 seconds for new opportunities

### Business Impact
- **Profit Potential**: $10,000+ monthly opportunities
- **Risk Reduction**: Automated risk assessment
- **Efficiency Gains**: 90% reduction in manual analysis
- **Scalability**: Handle millions of listings

## 🔧 Configuration

### Environment Variables

```bash
# Database
DATABASE_URL="postgresql://user:pass@localhost:5432/pokedao"

# APIs
POKEMON_TCG_API_KEY="your_api_key_here"

# Logging
LOG_LEVEL="info"  # trace, debug, info, warn, error

# Pipeline
DEFAULT_CURRENCY="USD"
FX_PROVIDER="ecb"  # ecb, fixer, etc.
```

### Pipeline Modes

#### Conservative Mode
- **Min Profit Margin**: 25%
- **Max Risk Level**: LOW
- **Min Confidence**: 80%
- **Min Profit Amount**: $0.50

#### Default Mode
- **Min Profit Margin**: 15%
- **Max Risk Level**: MEDIUM
- **Min Confidence**: 60%
- **Min Profit Amount**: $0.25

#### Aggressive Mode
- **Min Profit Margin**: 10%
- **Max Risk Level**: HIGH
- **Min Confidence**: 40%
- **Min Profit Amount**: $0.10

## 📁 Output Structure

```
reports/
├── 2025-01-15/              # Date-based organization
│   ├── summary.md           # Executive summary
│   ├── opportunities.csv    # Complete opportunities data
│   ├── quality.json         # Data quality metrics
│   ├── complete-data.json   # Full dataset export
│   ├── README.md            # Report documentation
│   └── collections/         # Collection-specific reports
│       ├── slabs/
│       │   ├── summary.md
│       │   ├── opportunities.csv
│       │   └── data.json
│       ├── prospects/
│       └── watchlist/
└── latest/                  # Symlink to latest report
```

## 🧪 Testing

### Unit Tests
```bash
# Run all tests
pnpm test

# Run specific test suites
pnpm test:market-core
pnpm test:market-adapters
```

### Integration Tests
```bash
# Test pipeline integration
pnpm test:integration

# Test specific adapters
pnpm test:adapter:ebay
pnpm test:adapter:tcgplayer
```

### End-to-End Tests
```bash
# Test complete pipeline
pnpm test:e2e

# Test with sample data
pnpm test:e2e:sample
```

## 🔍 Monitoring

### Performance Metrics
- **Execution Time**: Track pipeline duration
- **Throughput**: Records processed per second
- **Memory Usage**: Monitor resource consumption
- **Error Rates**: Track failure rates

### Quality Metrics
- **Data Completeness**: Percentage of complete records
- **Accuracy Scores**: Validation against known data
- **Cross-Reference Success**: API matching rates
- **Opportunity Quality**: False positive rates

### Business Metrics
- **Opportunities Found**: Daily/weekly counts
- **Profit Potential**: Total profit opportunities
- **Risk Distribution**: Risk level breakdowns
- **Collection Performance**: Collection-specific metrics

## 🚨 Troubleshooting

### Common Issues

#### Database Connection Errors
```bash
# Check database connection
psql $DATABASE_URL -c "SELECT 1;"

# Verify Prisma schema
pnpm prisma validate
```

#### API Rate Limiting
```bash
# Check API quotas
curl -H "X-Api-Key: $POKEMON_TCG_API_KEY" \
  "https://api.pokemontcg.io/v2/cards?pageSize=1"
```

#### Memory Issues
```bash
# Reduce batch size
pnpm run market:pipeline -- --limit=500

# Enable verbose logging
pnpm run market:verbose
```

### Error Recovery
- **Automatic Retries**: Built-in retry logic for transient failures
- **Graceful Degradation**: Continue processing despite individual failures
- **Error Logging**: Comprehensive error tracking and reporting
- **Data Validation**: Prevent invalid data from corrupting results

## 🔄 Maintenance

### Regular Updates
- **Weekly**: Run full pipeline for fresh opportunities
- **Daily**: Run arbitrage detection for new data
- **Monthly**: Update currency exchange rates
- **Quarterly**: Review and update Pokemon set mappings

### Data Validation
```bash
# Validate data quality
pnpm run market:pipeline -- --dry-run

# Check for new opportunities
pnpm run market:pipeline -- --limit=100
```

### Performance Optimization
- **Database Indexing**: Optimize query performance
- **Caching**: Implement Redis caching for API calls
- **Batch Processing**: Optimize batch sizes for throughput
- **Memory Management**: Monitor and optimize memory usage

## 📚 API Reference

### CLI Commands

```bash
# Basic usage
market-pipeline [options]

# Options
--sources SOURCES     Comma-separated sources
--collections COLS    Comma-separated collection slugs
--mode MODE           Pipeline mode
--since DATE          Process since date
--limit NUMBER        Maximum listings per source
--output DIR          Output directory
--dry-run             Run without persisting
--verbose             Enable verbose logging
```

### Programmatic API

```typescript
import { runPipeline } from '@pokedao/market-adapters';

const results = await runPipeline({
  sources: ['ebay', 'tcgplayer'],
  collections: ['slabs', 'prospects'],
  mode: 'conservative',
  limit: 1000
});
```

## 🤝 Contributing

### Development Setup
```bash
# Clone repository
git clone https://github.com/pokedao/market-pipeline.git
cd market-pipeline

# Install dependencies
pnpm install

# Set up development environment
cp .env.example .env.development
```

### Adding New Adapters
1. Create adapter in `/packages/market-adapters/src/adapters/`
2. Implement required interface methods
3. Add to adapter registry
4. Write tests
5. Update documentation

### Adding New Features
1. Create feature branch
2. Implement feature with tests
3. Update documentation
4. Submit pull request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Documentation**: [docs/](docs/)
- **Issues**: [GitHub Issues](https://github.com/pokedao/market-pipeline/issues)
- **Discussions**: [GitHub Discussions](https://github.com/pokedao/market-pipeline/discussions)
- **Email**: support@pokedao.com

---

**Built with ❤️ for the Pokemon card trading community**
