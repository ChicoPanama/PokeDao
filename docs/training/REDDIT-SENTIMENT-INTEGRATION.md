# Reddit Sentiment Integration Guide

**How to integrate Reddit community sentiment into Mew-1A training**

## Quick Start (5 Minutes)

### 1. Setup Reddit API Credentials

```bash
# Add to .env file
echo "REDDIT_CLIENT_ID=your_client_id" >> .env
echo "REDDIT_CLIENT_SECRET=your_secret" >> .env
echo "REDDIT_USERNAME=your_username" >> .env
echo "REDDIT_PASSWORD=your_password" >> .env
```

Get credentials: https://www.reddit.com/prefs/apps

### 2. Install Dependencies

```bash
cd packages/reddit-sentiment
pnpm install
pnpm build
```

### 3. Collect Sentiment Data

```bash
# Collect 100 posts + 100 comments from r/PokeInvesting and r/PokemonTCG
pnpm tsx scripts/collect-reddit-sentiment.ts

# Output: data/training/reddit-sentiment.jsonl (~200-500 examples)
```

### 4. Verify Output

```bash
# Check file was created
ls -lh data/training/reddit-sentiment.jsonl

# View first example
head -n 1 data/training/reddit-sentiment.jsonl | jq .

# Count examples
wc -l data/training/reddit-sentiment.jsonl
```

### 5. Integrate with Mew-1A Training

**Option A: Merge datasets before upload**

```bash
# Combine v4 data with Reddit sentiment
cat data/training/mew1a-v4-comprehensive-internal.jsonl \
    data/training/reddit-sentiment.jsonl \
    > data/training/mew1a-v4.1-with-reddit.jsonl

# Upload to HuggingFace
python3 scripts/mew1a-upload-to-huggingface-v4.1.py
```

**Option B: Load both files in training script**

```python
# scripts/mew1a-train-v4.1.py
from datasets import load_dataset, concatenate_datasets

# Load both datasets
base_data = load_dataset('json',
    data_files='data/training/mew1a-v4-comprehensive-internal.jsonl')
reddit_data = load_dataset('json',
    data_files='data/training/reddit-sentiment.jsonl')

# Merge
full_dataset = concatenate_datasets([
    base_data['train'],
    reddit_data['train']
])

print(f"Total: {len(full_dataset)} examples")
# Total: 89756 examples (89256 + 500 Reddit)

# Continue training as usual
```

---

## Architecture Integration

### How Reddit Sentiment Fits into PokeDAO

```
┌─────────────────────────────────────────────────────────┐
│                    MEW-1A v4.1 / v5                     │
│              (Comprehensive TCG Assistant)              │
└───────────────────────┬─────────────────────────────────┘
                        │
          ┌─────────────┼─────────────┐
          │             │             │
    ┌─────▼─────┐ ┌────▼────┐ ┌─────▼──────┐
    │  Market   │ │  Card   │ │   Deck     │
    │ Analysis  │ │Knowledge│ │  Building  │
    │ (40k ex)  │ │ (28k ex)│ │  (20k ex)  │
    └───────────┘ └─────────┘ └────────────┘
                        │
                   ┌────▼────┐
                   │ REDDIT  │  ← NEW Layer 4
                   │SENTIMENT│
                   │ (500 ex)│
                   └─────────┘
                        │
          ┌─────────────┴─────────────┐
          │                           │
    r/PokeInvesting            r/PokemonTCG
    (Investing focus)          (General TCG)
```

### Data Flow

```
1. Reddit API
   ↓
2. Fetch posts/comments mentioning cards
   ↓
3. Filter by card names (21,627+ cards)
   ↓
4. Analyze sentiment (Positive/Negative/Neutral)
   ↓
5. Format as Mew-1A JSONL
   ↓
6. Merge with training data
   ↓
7. Fine-tune Mew-1A v4.1/v5
   ↓
8. Model understands community sentiment!
```

---

## Collection Strategies

### Strategy 1: One-Time Bulk Collection

**Use case**: Initial dataset creation

```bash
# Collect large batch (1000 posts + 1000 comments)
pnpm tsx scripts/collect-reddit-sentiment.ts --limit=1000

# Expected: 1500-2500 examples (filtering removes non-card posts)
```

**Pros**: Large dataset quickly
**Cons**: Historical data may be outdated

### Strategy 2: Daily Incremental Updates

**Use case**: Keep sentiment data fresh

```bash
# Day 1: Full collection
pnpm tsx scripts/collect-reddit-sentiment.ts --limit=100

# Day 2+: Only collect new data
pnpm tsx scripts/collect-reddit-sentiment.ts \
  --mode=incremental \
  --since=$(cat data/training/.reddit-checkpoint.json | jq -r .lastTimestamp)
```

**Pros**: Always current, efficient
**Cons**: Requires automation (cron job or worker)

### Strategy 3: Historical Bulk Import

**Use case**: Training on past 1-2 years of community sentiment

```typescript
// scripts/historical-reddit-bulk.ts
const fetcher = new RedditFetcher(credentials);

// Fetch 2024 data
const posts = await fetcher.fetchHistoricalBatch(
  'PokeInvesting',
  new Date('2024-01-01'),
  new Date('2025-01-01'),
  'submission'
);

// Process and save (can yield 10k-50k examples)
```

**Pros**: Massive dataset, captures historical trends
**Cons**: Pushshift API may be slow/unavailable

---

## Training Configurations

### Mew-1A v4.1: Add Reddit Sentiment to v4

**Goal**: Enhance existing v4 model with community sentiment awareness

```python
# scripts/mew1a-train-v4.1.py

# Load v4 base + Reddit sentiment
DATASET_FILES = [
    'data/training/mew1a-v4-comprehensive-internal.jsonl',  # 89,256
    'data/training/reddit-sentiment.jsonl',                  # ~500
]

# Total: ~89,756 examples
# New category: reddit_sentiment (~0.6% of data)

# Train with same config as v4
NUM_EPOCHS = 3
BATCH_SIZE = 4
LEARNING_RATE = 2e-4

# Expected outcome: v4 quality + sentiment awareness
```

**Upload to HuggingFace**:
```bash
# Create new dataset version
python3 scripts/mew1a-upload-to-huggingface-v4.1.py

# Dataset: ChicoPanama/mew1a-v4.1-pokemon-tcg-comprehensive-with-reddit
```

### Mew-1A v5: Large-Scale Reddit Integration

**Goal**: Train on massive Reddit dataset (10k+ examples)

```python
# scripts/mew1a-train-v5.py

# Strategy: Collect 1 year of historical data
# Expected: 10k-20k Reddit examples

DATASET_FILES = [
    'data/training/mew1a-v4-comprehensive-internal.jsonl',  # 89,256
    'data/training/reddit-sentiment-2024-full.jsonl',       # ~15,000
]

# Total: ~104,256 examples
# Reddit sentiment: ~14.4% of data (significant signal)

# May need to adjust training
NUM_EPOCHS = 3
BATCH_SIZE = 4
LEARNING_RATE = 2e-4

# Expected outcome: Strong sentiment understanding
```

---

## Expected Model Improvements

### Before (Mew-1A v4)

**Query**: "What's the market outlook for Charizard ex from Obsidian Flames?"

**Response**:
```
Based on market data, Charizard ex from Obsidian Flames is priced at $45-52.
Fair value analysis suggests it's slightly undervalued at $45.
```

### After (Mew-1A v4.1 with Reddit Sentiment)

**Query**: "What's the market outlook for Charizard ex from Obsidian Flames?"

**Response**:
```
Based on market data, Charizard ex from Obsidian Flames is priced at $45-52.
Fair value analysis suggests it's slightly undervalued at $45.

Community Sentiment: Reddit discussions show POSITIVE sentiment (r/PokeInvesting).
Recent posts indicate bullish investor interest and expectation of price increase.

Recommendation: BUY - Good arbitrage opportunity with community support.
```

### New Capabilities

1. **Sentiment Queries**:
   ```
   Q: "What does the Pokemon TCG community think about Umbreon VMAX?"
   A: "Community sentiment is highly POSITIVE. Reddit discussions show..."
   ```

2. **Trend Detection**:
   ```
   Q: "Is Pikachu VMAX overhyped?"
   A: "Based on Reddit sentiment analysis, yes - multiple posts mention..."
   ```

3. **Investment Risk Assessment**:
   ```
   Q: "Should I invest in Lost Origin booster boxes?"
   A: "Market price: $120. Community sentiment: NEUTRAL. Consider holding..."
   ```

---

## Monitoring & Quality Assurance

### Daily Collection Monitoring

```bash
# Create monitoring script
cat > scripts/monitor-reddit-collection.sh << 'EOF'
#!/bin/bash

# Run daily collection
pnpm tsx scripts/collect-reddit-sentiment.ts --mode=incremental

# Check output
LINES=$(wc -l < data/training/reddit-sentiment.jsonl)
echo "Total examples: $LINES"

# Alert if collection failed (no new data)
CHECKPOINT=$(cat data/training/.reddit-checkpoint.json | jq -r .examplesCollected)
if [ "$CHECKPOINT" -eq 0 ]; then
  echo "WARNING: No new data collected!"
fi
EOF

chmod +x scripts/monitor-reddit-collection.sh
```

### Quality Checks

```bash
# Check sentiment distribution
cat data/training/reddit-sentiment.jsonl | \
  jq -r '.output' | \
  grep -oP '(Positive|Negative|Neutral)' | \
  sort | uniq -c

# Expected: ~40% Positive, 30% Negative, 30% Neutral

# Check most mentioned cards
cat data/training/reddit-sentiment.jsonl | \
  jq -r '.metadata.card_match' | \
  sort | uniq -c | sort -rn | head -n 10

# Expected: Charizard, Umbreon, Pikachu in top 10
```

### Validation Before Training

```bash
# Run pre-training validation
python3 << 'EOF'
import json

with open('data/training/reddit-sentiment.jsonl') as f:
    examples = [json.loads(line) for line in f if line.strip()]

print(f"Total examples: {len(examples)}")

# Check for required fields
for i, ex in enumerate(examples[:10]):
    assert 'instruction' in ex, f"Missing instruction at line {i}"
    assert 'output' in ex, f"Missing output at line {i}"
    assert 'category' in ex, f"Missing category at line {i}"
    assert ex['category'] == 'reddit_sentiment', f"Wrong category at {i}"

print("✅ Validation passed!")
EOF
```

---

## Worker Integration (Automated Collection)

### Cron Job (Daily Collection)

```typescript
// apps/worker/src/jobs/reddit-sentiment.ts
import { incrementalUpdate } from '@pokedao/reddit-sentiment';
import { CronJob } from 'cron';

export const redditSentimentJob = new CronJob('0 2 * * *', async () => {
  console.log('🔄 Starting daily Reddit sentiment collection...');

  const checkpoint = loadCheckpoint();

  const config = {
    reddit: {
      clientId: process.env.REDDIT_CLIENT_ID!,
      clientSecret: process.env.REDDIT_CLIENT_SECRET!,
      username: process.env.REDDIT_USERNAME!,
      password: process.env.REDDIT_PASSWORD!,
      userAgent: 'PokeDAO Worker v1.0',
    },
    subreddits: ['PokeInvesting', 'PokemonTCG'],
    cardNames: await loadCardNames(),
    outputPath: 'data/training/reddit-sentiment.jsonl',
    limit: 100,
  };

  try {
    const examples = await incrementalUpdate(config, checkpoint.lastTimestamp);

    console.log(`✅ Collected ${examples.length} new examples`);

    saveCheckpoint({
      lastRun: new Date().toISOString(),
      lastTimestamp: Math.floor(Date.now() / 1000),
      examplesCollected: examples.length,
    });
  } catch (error) {
    console.error('❌ Reddit collection failed:', error);
    // Alert or retry logic
  }
});

redditSentimentJob.start();
```

### Weekly Retraining Trigger

```typescript
// Trigger Mew-1A retraining when enough new data accumulated
const RETRAINING_THRESHOLD = 1000; // 1000 new examples

if (getTotalRedditExamples() > checkpoint.lastTrainingCount + RETRAINING_THRESHOLD) {
  console.log('📈 Threshold reached - triggering Mew-1A retraining...');

  // Upload new dataset to HuggingFace
  await uploadToHuggingFace();

  // Trigger RunPod training (or queue for next maintenance window)
  await triggerTraining();
}
```

---

## Cost Analysis

### API Costs

- **Reddit API**: Free (60 requests/min rate limit)
- **Pushshift**: Free (public archive)
- **HuggingFace Storage**: Free (public datasets)

### Collection Costs

- **Time**: ~5 minutes for 100 posts + 100 comments
- **Bandwidth**: ~1 MB per 100 items
- **Processing**: Negligible (runs on existing infrastructure)

### Training Costs

Adding 500-1000 Reddit examples to v4 dataset:

- **Additional training time**: +5-10 minutes (~1% increase)
- **Cost impact**: +$0.50-1.00 on RunPod
- **Model size**: No change (same LoRA adapters)

**ROI**: Minimal cost for significant capability enhancement!

---

## Troubleshooting

### Issue: No Examples Generated

```
Found 0 items mentioning Pokemon cards
```

**Solutions**:
1. Check card names loaded correctly:
   ```bash
   pnpm tsx scripts/collect-reddit-sentiment.ts --limit=10
   # Should show "Loaded X unique card names"
   ```

2. Verify subreddit has recent activity:
   - Visit r/PokeInvesting manually
   - Check if posts exist

3. Lower card name threshold (add common Pokemon):
   ```typescript
   const enhancedNames = [...cardNames, 'Charizard', 'Pikachu', 'Mewtwo'];
   ```

### Issue: Reddit API Rate Limit

```
Error: 429 Too Many Requests
```

**Solutions**:
1. Module handles this automatically (2s delays)
2. Reduce `--limit` parameter
3. Use Pushshift for historical data (no limits)

### Issue: Invalid Credentials

```
Error: 401 Unauthorized
```

**Solutions**:
1. Verify credentials in `.env`:
   ```bash
   echo $REDDIT_CLIENT_ID
   # Should show your client ID
   ```

2. Check Reddit app settings: https://www.reddit.com/prefs/apps
3. Ensure app type is "script" (not "web app")

---

## Next Steps

1. ✅ **Collect initial dataset**:
   ```bash
   pnpm tsx scripts/collect-reddit-sentiment.ts --limit=500
   ```

2. ✅ **Verify output**:
   ```bash
   head -n 1 data/training/reddit-sentiment.jsonl | jq .
   ```

3. ✅ **Merge with v4 data**:
   ```bash
   cat data/training/mew1a-v4-comprehensive-internal.jsonl \
       data/training/reddit-sentiment.jsonl \
       > data/training/mew1a-v4.1-with-reddit.jsonl
   ```

4. ✅ **Train Mew-1A v4.1**:
   ```bash
   # Upload to HuggingFace
   python3 scripts/mew1a-upload-to-huggingface-v4.1.py

   # Start RunPod training
   python3 scripts/mew1a-train-v4.1.py
   ```

5. ✅ **Test sentiment capabilities**:
   ```python
   # After training
   prompt = "What does the Pokemon TCG community think about Charizard ex?"
   response = model.generate(prompt)
   # Should include sentiment analysis!
   ```

---

## Success Metrics

After integrating Reddit sentiment, expect:

- ✅ **+500-2000 training examples** (depending on collection strategy)
- ✅ **New "reddit_sentiment" category** in model
- ✅ **Sentiment-aware responses** to market queries
- ✅ **Community trend detection** (hype cycles, price expectations)
- ✅ **Enhanced investment recommendations** (factor in collector enthusiasm)

**Minimal cost, maximum impact!** 🚀

---

## References

- [Reddit Sentiment Package README](packages/reddit-sentiment/README.md)
- [Mew-1A v4 Training Guide](MEW1A-V4-READY-TO-TRAIN.md)
- [PokeDAO Architecture](README.md)
- [Reddit API Documentation](https://www.reddit.com/dev/api)
