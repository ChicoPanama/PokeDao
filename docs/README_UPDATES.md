# README Updates - Real-Time Architecture & Mew-1A Progress

## Changes to Make

### 1. Update Phase 2 Roadmap (Line 566)

**REPLACE:**
```markdown
### 🚧 Phase 2: Signal Generation & Mew-1A Deployment (In Progress)
- [x] AI thesis generation (AI Ensemble: Mew-1A + DeepSeek R1)
- [ ] Deploy Project Mew-1A to HuggingFace (fine-tune Llama-3.2-3B)
- [ ] Automated daily data collection (cron job)
- [ ] End-to-end signal pipeline (features → scoring → ranking)
- [ ] X/Twitter posting integration (Top 3-5 daily signals with AI analysis)
```

**WITH:**
```markdown
### 🚧 Phase 2: Signal Generation & Mew-1A Deployment (In Progress)

**2A: Mew-1A Training & Deployment**
- [x] AI thesis generation (AI Ensemble: Qwen + DeepSeek R1)
- [x] Training dataset prepared (10,000 examples from 98,759+ cards)
- [x] HuggingFace dataset uploaded (`ChicoPanama/pokedao-mew1a-training-data-layered`)
- [x] Training script complete (`apps/mew1a/train-mew1a.py`)
- 🔥 **Fine-tuning Llama-3.2-3B on RunPod** (in progress - ETA 2-3 hours)
- [ ] Deploy to HuggingFace Inference API
- [ ] Integrate with AI Ensemble production

**2B: Real-Time Stream Architecture**
- [ ] Reddit API integration (r/PokeInvesting, r/PokemonTCG)
- [ ] Redis Streams for event processing
- [ ] Entity linking (Reddit text → card IDs via TCGdex)
- [ ] Rolling feature computation (mentions, sentiment, velocity)
- [ ] Burst/anomaly detectors (EWMA, Z-score, CUSUM)
- [ ] Telegram bot integration (<60s latency alerts)
- [ ] RAG + Mew-1A for signal enrichment

**2C: Signal Pipeline & X Integration**
- [ ] Automated daily data collection (cron job)
- [ ] End-to-end signal pipeline (features → scoring → ranking)
- [ ] X/Twitter posting integration (Top 3-5 daily signals with AI analysis)
```

### 2. Update Current Status Table (Line 600)

**CHANGE:**
```markdown
| **Project Mew-1A** | 🚧 Training | 258 examples ready, fine-tuning on HuggingFace next |
```

**TO:**
```markdown
| **Project Mew-1A** | 🔥 Training | Fine-tuning Llama-3.2-3B on RunPod (10k examples, ~2-3 hours) |
| **Real-Time Streams** | 🚧 Design | Architecture documented, packages/streams ready to build |
```

### 3. Insert Real-Time Section (After line 92, before "### 📦 Packages")

**INSERT:**
```markdown
### 🌊 Real-Time Signal Architecture

*See [docs/REAL_TIME_ARCHITECTURE.md](docs/REAL_TIME_ARCHITECTURE.md) for full details*

The next evolution beyond batch pipelines: **real-time signal detection** enabling sub-minute alerts for market shifts.

#### Core Flow
```
Reddit/Forums → Redis Streams → Normalize (entity link) → Features (rolling windows)
  → Detect (burst/anomaly) → RAG + Mew-1A → Alert (Telegram/X) → Learn (feedback)
```

#### Key Components
- **Stream Ingestion**: Redis Streams (r/PokeInvesting, r/PokemonTCG, marketplaces)
- **Entity Resolver**: Maps text → `SET|NUMBER|VARIANT|LANG|GRADE` using TCGdex
- **Feature Store**: Rolling metrics (mentions_1m/5m/60m, price deltas, sentiment)
- **Detectors**: EWMA/Z-score/CUSUM for bursts & anomalies
- **RAG Layer**: Mew-1A enriches signals with context
- **Feedback Loop**: User ratings improve detector thresholds weekly

#### SLOs
- **Latency**: <60s end-to-end
- **False positives**: <15%
- **Coverage**: Top 200 cards by volume

**Status**: 🚧 In Design - `packages/streams` ready to build

---
```

### 4. Add New Packages Section Entry

**After existing packages, ADD:**
```markdown
| **`@pokedao/streams`** | Real-time stream clients | Reddit/marketplace ingestion, normalization, entity linking |
| **`@pokedao/detectors`** | Anomaly detection | EWMA, Z-score, CUSUM burst detection algorithms |
| **`@pokedao/features`** | Feature engineering | Rolling window computations, time-series aggregations |
```

### 5. Update Documentation Section

**ADD to docs list:**
```markdown
| `docs/REAL_TIME_ARCHITECTURE.md` | Real-time signal detection system design & SLOs |
```

### 6. Update Last Updated Date (Line 636)

**CHANGE:**
```markdown
*Last Updated: 2025-10-05*
```

**TO:**
```markdown
*Last Updated: 2025-10-06*
```

## Summary of Key Updates

✅ **Mew-1A Status**: Training in progress on RunPod (10,000 examples)
✅ **Real-Time Architecture**: Documented and ready to build
✅ **Phase 2 Breakdown**: Split into 2A (Mew-1A), 2B (Streams), 2C (Signals)
✅ **New Packages**: streams, detectors, features planned
✅ **SLOs Defined**: <60s latency, <15% false positives

## Next Implementation Steps

1. Create `packages/streams` package structure
2. Build Reddit client wrapper
3. Build entity resolver (text → card IDs)
4. Build burst detectors
5. Create ingestion worker script

These changes bring the README fully up-to-date with current progress and future direction.
