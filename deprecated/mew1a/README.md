# Project Mew-1A 🧬

**The world's first AI model specifically trained on Pokemon TCG market data.**

## Overview

Project Mew-1A is a fine-tuned Llama-3.2-3B language model specialized in Pokemon TCG pricing analysis, arbitrage detection, and market sentiment evaluation.

### Why "Mew-1A"?

Named after Mewtwo (the first genetically engineered Pokemon), Mew-1A represents the first AI model "engineered" from scratch for TCG market intelligence.

## Architecture

- **Base Model:** `meta-llama/Llama-3.2-3B-Instruct`
- **Training Data:** 258+ examples from 400,000+ real market listings
- **Sources:** eBay, Courtyard, Collector Crypt, Phygitals, TCGPlayer
- **Unique Cards:** 13,738 variants with comprehensive market data
- **Deployment:** HuggingFace Inference API

## Capabilities

1. **Instant Pricing Analysis**
   - Fair value calculation with liquidity adjustment
   - Discount/premium detection
   - Market sentiment (bullish/neutral/bearish)

2. **Arbitrage Detection**
   - Cross-marketplace price comparison
   - Execution probability scoring
   - Risk-adjusted opportunity ranking

3. **Liquidity Metrics**
   - Sales velocity analysis
   - Days-to-sell estimation
   - Sell probability (30/60/90 day horizons)

4. **Market Intelligence**
   - Whale activity detection
   - Trend analysis (7d/30d/90d)
   - Volume surge identification

## Training Data

Located in: `/data/mew1a-training-data.jsonl`

**Format:**
```json
{
  "instruction": "You are a TCG market analyst. Analyze this Pokemon card listing and provide a recommendation.",
  "input": "Card: Charizard - Base Set PSA 10\nListed Price: $5000...",
  "output": "RECOMMENDATION: STRONG_BUY\nCONVICTION: 85%..."
}
```

**Statistics:**
- Total Examples: 258
- STRONG_BUY: 152 (58.9%)
- HOLD: 69 (26.7%)
- BUY: 25 (9.7%)
- PASS: 12 (4.7%)

## Directory Structure

```
apps/mew1a/
├── src/
│   ├── training/          # Training pipeline
│   │   ├── extract-data.ts    # Extract from 400k+ listings
│   │   └── upload-dataset.ts  # Upload to HuggingFace
│   ├── inference/         # Model inference
│   │   ├── client.ts          # HuggingFace API client
│   │   └── test-model.ts      # Testing & validation
│   └── index.ts           # Main entry point
├── README.md              # This file
├── package.json
└── tsconfig.json
```

## Usage

### 1. Extract Training Data
```bash
pnpm --filter @pokedao/mew1a train:extract
```

### 2. Upload to HuggingFace
```bash
# Set your HuggingFace token
export HUGGINGFACE_TOKEN=hf_...

pnpm --filter @pokedao/mew1a train:upload
```

### 3. Fine-Tune (via HuggingFace AutoTrain)
- Go to: https://huggingface.co/autotrain
- Select dataset: `pokedao/mew1a-training-data`
- Base model: `meta-llama/Llama-3.2-3B-Instruct`
- Task: Text Generation (Instruction Tuning)
- Cost: ~$20-30 for 3 epochs

### 4. Test Inference
```bash
pnpm --filter @pokedao/mew1a inference:test
```

## Integration with AI Ensemble

Mew-1A powers the fast layer of the AI Ensemble:

**Current (Temporary):**
- Layer 1: Ollama Qwen (local, 3B params)
- Layer 2: DeepSeek R1 (cloud, reasoning)

**Future (Post-Training):**
- Layer 1: **Mew-1A** (cloud, TCG-specialized)
- Layer 2: DeepSeek R1 (cloud, reasoning)

## Performance Targets

| Metric | Target | Notes |
|--------|--------|-------|
| **Inference Speed** | <500ms | 100x faster than local 8B models |
| **Accuracy** | 85%+ | Match or exceed DeepSeek on TCG tasks |
| **Cost** | $0.001/call | HuggingFace Inference API pricing |
| **Availability** | 99.9%+ | Cloud-hosted, no local GPU needed |

## Deployment Roadmap

- [x] Extract 258 training examples from real data
- [x] Create JSONL training dataset
- [ ] Upload to HuggingFace Dataset Hub
- [ ] Fine-tune Llama-3.2-3B via AutoTrain
- [ ] Deploy to HuggingFace Inference API
- [ ] Integrate with API `/api/ai-analysis` endpoint
- [ ] Replace Qwen in AI Ensemble
- [ ] Benchmark against baseline models

## Technical Specs

**Training Configuration:**
- Base: Llama-3.2-3B-Instruct (3.2B params)
- LoRA Rank: 8
- Learning Rate: 2e-4
- Batch Size: 4
- Gradient Accumulation: 4
- Epochs: 3
- Max Length: 512 tokens
- Quantization: 4-bit (QLoRA)

**Inference Configuration:**
- Temperature: 0.3 (deterministic)
- Max Tokens: 400
- Top P: 0.9
- Frequency Penalty: 0.1

## Cost Analysis

**One-Time Training:**
- HuggingFace AutoTrain: $20-30
- GPU Time: ~2-4 hours

**Ongoing Inference:**
- Free Tier: 1000 calls/month
- Paid: $0.001 per call
- Monthly Cost: ~$10-20 (10k-20k analyses)

**ROI:**
- Single arbitrage opportunity: $50-500
- Monthly opportunities: 10-50
- Expected ROI: 10-100x

## License

Proprietary - PokeDAO 2025

---

**Built with ❤️ for the TCG community**
