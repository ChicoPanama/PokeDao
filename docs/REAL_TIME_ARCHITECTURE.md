# Real-Time Signal Architecture

PokeDAO's evolution from batch pipelines to **real-time signal fabric**, enabling sub-minute detection of market shifts across forums, marketplaces, and social chatter.

## Purpose

While the Lakehouse ensures perfect historical reproducibility, the signal layer captures **live anomalies** as they happen — from new Reddit posts to sudden pricing spikes — without retraining the model.

## Components

| Layer | Technology | Function |
|-------|-------------|-----------|
| **Stream Ingestion** | Redis Streams / Kafka | Pulls live data from Reddit, marketplaces, and Discord |
| **Normalization Workers** | Node/TypeScript Workers | Clean, deduplicate, and map text or listings to canonical card IDs |
| **Feature Builder** | Postgres / ClickHouse | Rolling features (mentions, velocity, price deltas, sentiment) |
| **Vector Index** | PGVector / Qdrant | Real-time embeddings for semantic search and RAG queries |
| **Signal Detectors** | TypeScript (Z-score / EWMA / CUSUM) | Detect bursts, anomalies, or liquidity shocks |
| **Alert Router** | Telegram / Discord Bot | Sends actionable alerts (<60s latency) |
| **Feedback Loop** | User ratings + model logs | Reinforces quality via weekly mini-retraining (no full retrain) |

## Workflow

1. **Stream**: Data ingested from Reddit (r/PokeInvesting, r/PokemonTCG) and marketplaces
2. **Normalize**: Entity linking maps raw text → card metadata (`SET|NUMBER|VARIANT|LANG|GRADE`)
3. **Compute**: Rolling features every minute — mentions, prices, liquidity velocity, sentiment
4. **Detect**: Statistical triggers (Z-score > 4, burst detection) flag emerging signals
5. **Enrich**: LLMs summarize context via RAG using latest indexed content
6. **Alert**: Top signals broadcasted to Telegram/X within 60 seconds
7. **Learn**: Feedback (👍/👎) stored for retraining lightweight classifiers

## Architecture Diagram

```mermaid
flowchart LR
  subgraph Sources[Live Sources]
    R[Reddit<br/>r/PokeInvesting<br/>r/PokemonTCG]
    M[Marketplaces<br/>eBay • JustTCG • CC • Courtyard]
    D[Discord/X<br/>(optional)]
  end

  subgraph Stream[Stream Ingestion]
    K[Redis Streams]
  end

  subgraph Normalize[Normalization & Entity Linking]
    N1[Clean/Dedupe<br/>rate-limit, retries]
    N2[Card Resolver<br/>SET|NUM|VARIANT|LANG|GRADE]
  end

  subgraph Storage[Operational Stores]
    F[Feature Store<br/>Postgres]
    V[Vector Index<br/>PGVector]
  end

  subgraph Detect[Signal Detection]
    Z[EWMA / Z-score / CUSUM<br/>burst & anomaly rules]
    XGB[Optional: tiny classifier<br/>(weekly retrain)]
  end

  subgraph LLM[Enrichment & RAG]
    RAG[RAG: fetch top posts/listings]
    MEW[Mew-1A + DeepSeek R1]
  end

  subgraph Alert[Routing & UX]
    T[Telegram Bot]
    XPost[X/Twitter Post]
    Pokedex[/apps/pokedex<br/>Signal Feed API]
  end

  subgraph Lakehouse[Lakehouse]
    B[Bronze]
    S[Silver]
    G[Gold]
  end

  subgraph Strategy[PokeStrategy Vault]
    Exec[On-chain Execution]
  end

  R --> K
  M --> K
  D --> K

  K --> N1 --> N2
  N2 --> F
  N2 --> V
  N2 --> B

  F --> Z
  Z --> XGB
  XGB --> RAG
  V --> RAG
  F --> RAG

  RAG --> MEW --> Pokedex
  Z --> T
  Z --> XPost
  Pokedex --> T
  Pokedex --> XPost

  B --> S --> G --> F

  Pokedex --> Exec

  T -. user feedback .-> XGB
  Pokedex -. analyst labels .-> XGB
```

## Value Proposition

- Bridges the gap between **batch analytics** and **real-time alpha discovery**
- Provides traders with immediate, explainable signals
- Keeps Mew-1A static while continuously feeding it new contextual data
- Enables **streaming arbitrage detection** and future on-chain triggers for PokeStrategy

## Example Signal Output

```json
{
  "card": "Charizard VMAX (Shining Fates, PSA 10)",
  "signal_type": "Mentions Burst + Positive Sentiment",
  "z_score": 5.3,
  "price_delta_1h": "+8.7%",
  "mentions_5m": 23,
  "source": "r/PokeInvesting",
  "confidence": 0.91,
  "timestamp": "2025-10-06T03:45:12Z",
  "context": [
    "New listing at 15% discount on eBay",
    "3 Reddit posts mentioning 'undervalued'",
    "PSA pop report shows only 127 exist"
  ]
}
```

## Data Sources Priority

### Tier 1 (Immediate)
- **r/PokeInvesting** - Direct investment signals, price predictions
- **r/PokemonTCG** - Player meta, hype detection

### Tier 2 (Near-term)
- **PokéBeach Forums** - Trade/valuation sentiment
- **eBay real-time listings** - Price movements

### Tier 3 (Future)
- Discord servers (PokeInvest, TCG collectors)
- X/Twitter mentions
- YouTube video sentiment

## SLOs (Service Level Objectives)

- **End-to-end latency**: <60 seconds (event → alert)
- **False positive rate**: <15% (user-validated)
- **Coverage**: Top 200 cards by volume
- **Uptime**: 99.5% (excluding scheduled maintenance)

## Integration with Existing Systems

### With Lakehouse
- Real-time events → Bronze layer for audit trail
- Silver layer provides canonical card dictionary for entity linking
- Gold layer features used for historical baselines in anomaly detection

### With Mew-1A
- No model retraining required
- Used for RAG enrichment when signals fire
- Provides instant analysis: "What tier? What's fair value?"

### With PokeStrategy
- High-confidence signals (score >0.85) can trigger vault actions
- Position sizing based on liquidity metrics
- Risk management using signal confidence scores

## Implementation Packages

| Package | Purpose | Status |
|---------|---------|--------|
| `@pokedao/streams` | Reddit/marketplace stream clients | 🚧 Building |
| `@pokedao/detectors` | Burst/anomaly detection algorithms | 🚧 Building |
| `@pokedao/features` | Rolling feature computation | 🚧 Building |
| `@pokedao/embeddings` | Vector embeddings (bge-large-en-v1.5) | 🔜 Planned |

---

**This layer will operate continuously, enriching the Lakehouse with "Gold+" event data and feeding PokeDex in near real-time.**
