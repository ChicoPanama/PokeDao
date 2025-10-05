# Multi-Layer Pricing Architecture

## Overview

The PokeDAO database uses a **multi-source, multi-layer pricing enrichment system** to provide the most accurate and confident pricing data for Pokemon TCG cards across all marketplaces.

## Current Database Stats

| Source | Total Cards | With Pricing | Avg Quality |
|--------|-------------|--------------|-------------|
| COURTYARD | 33,266 | 29 | 0.84 |
| EBAY | 22,376 | 22,376 | 0.76 |
| PHYGITALS | 20,487 | 0 | 0.46 |
| COLLECTOR_CRYPT | 17,763 | 17,763 | 0.90 |
| FANATICS | 2,679 | 2,679 | 0.78 |
| JUSTTCG | 2,068 | 2,068 | 0.95 |
| OPENSEA | 104 | 104 | 0.95 |
| MAGICEDEN | 15 | 15 | 0.90 |
| TCGPLAYER | 1 | 1 | 0.92 |

**Total: 98,759 cards**

## Architecture

### Layer 1: Direct Data Collection
Each marketplace has dedicated harvesters that collect raw card data:

- **eBay Browse API** - Graded cards, active listings
- **JustTCG API** - TCG marketplace pricing
- **Collector Crypt API** - NFT marketplace (Solana)
- **OpenSea API** - NFT marketplace (Polygon/Ethereum)
- **Courtyard Polygon** - Blockchain NFT metadata
- **Phygitals** - NFT metadata
- **Fanatics** - Traditional marketplace
- **Magic Eden** - NFT marketplace

### Layer 2: Multi-Source Price Enrichment
For cards WITHOUT pricing or LOW confidence pricing, the master enrichment system queries multiple sources:

```
Card without pricing
    ↓
Query Priority:
1. Direct marketplace listing (95% confidence)
   ├─ OpenSea direct listing
   ├─ eBay active listing
   └─ TCGPlayer market price
    ↓
2. Exact match comparable (90% confidence)
   ├─ Same card name
   ├─ Same set
   ├─ Same grade company
   └─ Same grade number
    ↓
3. Close match comparable (70% confidence)
   ├─ Same card name
   ├─ Same set
   └─ Any grade
    ↓
4. Set-based estimate (50% confidence)
   ├─ Same set
   ├─ Similar grade range
   └─ Average of 3+ cards
    ↓
Weighted Consensus
    ↓
Final Price + Confidence Score
```

### Layer 3: Confidence Scoring

**Base Confidence:**
- Direct listing: 95%
- Exact match: 90%
- Close match: 70%
- Set estimate: 50%

**Bonuses:**
- Multiple sources: +10% per additional source (max +30%)
- Exact match: +5%
- High-quality source (dataQuality > 0.8): +5%

**Final Confidence Formula:**
```
confidence = (avg_source_confidence + multi_source_bonus + exact_match_bonus)
capped at 1.0 (100%)
```

## Scripts

### Primary Harvesters
1. `harvest-ebay-browse-api.ts` - eBay graded cards
2. `harvest-justtcg-comprehensive.ts` - JustTCG (62 sets)
3. `harvest-collector-crypt-cards-api.ts` - Collector Crypt NFTs
4. `harvest-opensea-courtyard.ts` - OpenSea + Courtyard matching
5. `sync-courtyard-pokemon-with-opensea.ts` - Courtyard blockchain → OpenSea pricing

### Enrichment Scripts
1. `enrich-courtyard-multi-source-pricing.ts` - Courtyard-specific multi-source enrichment
2. `master-multi-layer-pricing-enrichment.ts` - **MASTER** enrichment for entire database

## Example: Multi-Source Pricing

**Card:** "2000 Black Star Promos #9 Mew - Holo (CGC 9 MINT)"

**Source 1 - OpenSea Direct:**
- Price: $145.00
- Confidence: 95%
- Match Type: EXACT

**Source 2 - eBay Comparable:**
- Price: $142.50
- Confidence: 90%
- Match Type: EXACT (same card, same CGC 9 grade)

**Source 3 - Collector Crypt Comparable:**
- Price: $148.00
- Confidence: 90%
- Match Type: EXACT

**Source 4 - JustTCG Comparable:**
- Price: $135.00
- Confidence: 75%
- Match Type: CLOSE (same card, no grade)

**Consensus Calculation:**
```
weighted_avg = (145*0.95 + 142.5*0.90 + 148*0.90 + 135*0.75) / (0.95+0.90+0.90+0.75)
             = $143.85

base_confidence = (0.95 + 0.90 + 0.90 + 0.75) / 4 = 0.875 (87.5%)
multi_source_bonus = 4 sources * 0.10 = +0.30 (30%)
exact_match_bonus = 3 exact matches * 0.05 = +0.05 (5%)

final_confidence = min(0.875 + 0.30 + 0.05, 1.0) = 1.0 (100%)
```

**Final Result:**
- **Price:** $143.85
- **Confidence:** 100% (4 sources, 3 exact matches)
- **Data Quality:** 1.0

## Benefits

1. **Higher Accuracy** - Multiple sources reduce outlier impact
2. **Better Coverage** - Cards without direct pricing get estimated values
3. **Confidence Scoring** - Users know reliability of each price
4. **Cross-Marketplace Validation** - Traditional + NFT marketplaces
5. **Blockchain Provenance** - Courtyard/Phygitals provide verifiable ownership

## Running Enrichment

### Enrich Entire Database
```bash
pnpm tsx scripts/master-multi-layer-pricing-enrichment.ts
```

### Enrich Courtyard Only
```bash
pnpm tsx scripts/enrich-courtyard-multi-source-pricing.ts
```

### Monitor Progress
```bash
# Check current stats
psql -U pokedao -d pokedao -c "
SELECT
  source,
  COUNT(*) as total,
  COUNT(CASE WHEN priceCents > 0 THEN 1 END) as with_pricing,
  ROUND(AVG(dataQuality)::numeric, 2) as avg_quality
FROM UnifiedMarketListing
GROUP BY source;
"

# Check enrichment checkpoint
cat data/master-pricing-enrichment-checkpoint.json | jq
```

## Future Enhancements

1. **Real-time Price Updates** - WebSocket connections to marketplaces
2. **Historical Price Tracking** - Time-series pricing data
3. **Machine Learning Price Prediction** - ML models for price forecasting
4. **Smart Contract Integration** - On-chain pricing oracles
5. **Cross-Chain Bridging** - Unified pricing across Solana/Polygon/Ethereum

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    MARKETPLACE SOURCES                       │
├───────────┬───────────┬───────────┬───────────┬─────────────┤
│   eBay    │  JustTCG  │ Collector │  OpenSea  │  Courtyard  │
│  (22k)    │   (2k)    │  Crypt    │   (104)   │  Polygon    │
│           │           │  (18k)    │           │  (33k)      │
└─────┬─────┴─────┬─────┴─────┬─────┴─────┬─────┴──────┬──────┘
      │           │           │           │            │
      └───────────┴───────────┴───────────┴────────────┘
                              │
                    ┌─────────▼─────────┐
                    │   RAW DATABASE    │
                    │   98,759 cards    │
                    └─────────┬─────────┘
                              │
                    ┌─────────▼─────────────────────┐
                    │  MULTI-LAYER ENRICHMENT       │
                    │  - Direct listings            │
                    │  - Exact comparables          │
                    │  - Close comparables          │
                    │  - Set estimates              │
                    └─────────┬─────────────────────┘
                              │
                    ┌─────────▼──────────────────────┐
                    │  ENRICHED DATABASE             │
                    │  - Multi-source pricing        │
                    │  - Confidence scores           │
                    │  - Weighted consensus          │
                    └────────────────────────────────┘
```

---

**Status:** ✅ Active Development
**Last Updated:** 2025-10-05
**Maintainer:** PokeDAO Team
