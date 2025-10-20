# Reddit Sentiment Extraction Module

**Extract Pokemon TCG community sentiment from Reddit for Mew-1A training**

## Overview

This module collects Pokemon TCG discussions from Reddit (r/PokeInvesting, r/PokemonTCG) and generates JSONL training data for Mew-1A with sentiment analysis. It integrates as **Layer 4** of the PokeDAO AI ensemble, capturing community "hive mind" opinions about specific cards.

## Features

- ✅ **Reddit API Integration**: Fetch posts/comments from target subreddits
- ✅ **Pushshift Support**: Historical data collection for bulk imports
- ✅ **Card Mention Filtering**: Automatically detects 21,627+ Pokemon cards
- ✅ **TCG-Aware Sentiment**: Custom lexicon for investing terms (undervalued, overpriced, etc.)
- ✅ **Mew-1A Format**: JSONL output compatible with existing training pipeline
- ✅ **Incremental Updates**: Collect only new data since last run
- ✅ **Investment Signals**: BUY/HOLD/SELL classification from community sentiment

## Architecture

```
┌─────────────────┐
│  Reddit API     │
│  Pushshift API  │
└────────┬────────┘
         │
         v
┌─────────────────┐
│ RedditFetcher   │  ← Fetch posts/comments
└────────┬────────┘
         │
         v
┌─────────────────┐
│ SentimentProc.  │  ← Filter cards + analyze sentiment
└────────┬────────┘
         │
         v
┌─────────────────┐
│ OutputFormatter │  ← Format as Mew-1A JSONL
└────────┬────────┘
         │
         v
    reddit-sentiment.jsonl  →  Mew-1A Training
```

## Installation

```bash
cd packages/reddit-sentiment
pnpm install
pnpm build
```

## Configuration

Create a `.env` file with Reddit API credentials:

```bash
# Reddit App Credentials (https://www.reddit.com/prefs/apps)
REDDIT_CLIENT_ID=your_client_id_here
REDDIT_CLIENT_SECRET=your_client_secret_here
REDDIT_USERNAME=your_reddit_username
REDDIT_PASSWORD=your_reddit_password
```

### Getting Reddit API Credentials

1. Go to https://www.reddit.com/prefs/apps
2. Click "Create App" or "Create Another App"
3. Select "script" type
4. Fill in:
   - **name**: PokeDAO Sentiment Collector
   - **redirect uri**: http://localhost:8080
5. Copy the **client ID** (under app name) and **client secret**

## Usage

### Quick Start

```bash
# Full collection (100 posts + 100 comments per subreddit)
pnpm tsx scripts/collect-reddit-sentiment.ts

# Output: data/training/reddit-sentiment.jsonl
```

### Advanced Usage

```bash
# Collect more data
pnpm tsx scripts/collect-reddit-sentiment.ts --limit=500

# Incremental update (only new data since last run)
pnpm tsx scripts/collect-reddit-sentiment.ts --mode=incremental --since=1734480000

# Custom output path
pnpm tsx scripts/collect-reddit-sentiment.ts --output=data/reddit-dec-2025.jsonl

# Include investment-focused examples
pnpm tsx scripts/collect-reddit-sentiment.ts --investment
```

### Programmatic Usage

```typescript
import { collectRedditSentiment } from '@pokedao/reddit-sentiment';

const examples = await collectRedditSentiment({
  reddit: {
    clientId: process.env.REDDIT_CLIENT_ID,
    clientSecret: process.env.REDDIT_CLIENT_SECRET,
    username: process.env.REDDIT_USERNAME,
    password: process.env.REDDIT_PASSWORD,
    userAgent: 'PokeDAO v1.0',
  },
  subreddits: ['PokeInvesting', 'PokemonTCG'],
  cardNames: ['Charizard VMAX', 'Umbreon VMAX', 'Pikachu'],
  outputPath: 'data/sentiment.jsonl',
  limit: 100,
});

console.log(`Collected ${examples.length} examples`);
```

## Output Format

Each line in the JSONL file follows Mew-1A's training schema:

```json
{
  "instruction": "Determine the community sentiment for this Reddit discussion about Charizard VMAX.",
  "input": "Post from r/PokeInvesting (42 upvotes):\n\"Charizard VMAX is going to the moon! Everyone wants one now.\"",
  "output": "The sentiment is Positive for Charizard VMAX.",
  "category": "reddit_sentiment",
  "metadata": {
    "subreddit": "PokeInvesting",
    "author": "RedditUser123",
    "score": 42,
    "date": "2025-10-17T15:45:00Z",
    "card_match": "Charizard VMAX",
    "sentiment_score": 0.7,
    "permalink": "https://reddit.com/r/PokeInvesting/comments/abc123",
    "reddit_id": "abc123"
  }
}
```

## Components

### RedditFetcher

Handles API integration with Reddit and Pushshift.

```typescript
import { RedditFetcher } from '@pokedao/reddit-sentiment';

const fetcher = new RedditFetcher({
  clientId: '...',
  clientSecret: '...',
  username: '...',
  password: '...',
  userAgent: 'PokeDAO v1.0',
});

// Fetch recent posts
const posts = await fetcher.fetchPosts({
  subreddit: 'PokeInvesting',
  limit: 100,
  sort: 'new',
});

// Fetch comments
const comments = await fetcher.fetchComments({
  subreddit: 'PokemonTCG',
  limit: 100,
});

// Incremental fetch (since timestamp)
const newPosts = await fetcher.fetchPostsSince('PokeInvesting', 1734480000);

// Historical data via Pushshift
const historical = await fetcher.fetchHistoricalBatch(
  'PokeInvesting',
  new Date('2024-01-01'),
  new Date('2025-01-01'),
  'submission'
);
```

### SentimentProcessor

Filters card mentions and analyzes sentiment with TCG-specific lexicon.

```typescript
import { SentimentProcessor } from '@pokedao/reddit-sentiment';

const processor = new SentimentProcessor(['Charizard VMAX', 'Umbreon VMAX']);

// Check if text mentions a card
const hasCard = processor.containsCardMention('Charizard VMAX price rising!');
// => true

// Extract card names
const cards = processor.extractCardNames('Charizard VMAX and Pikachu are hot');
// => ['Charizard VMAX']

// Analyze sentiment
const sentiment = processor.analyzeSentiment('This card is undervalued!');
// => { label: 'Positive', score: 3, comparative: 0.3 }

// Get investment signal
const signal = processor.classifyInvestmentSignal('Time to buy this card');
// => 'BUY'

// Process batch
const results = processor.processBatch([post1, post2, comment1]);
```

**TCG-Specific Lexicon**:
- **Positive**: undervalued (+3), steal (+3), moon (+3), bullish (+2), grail (+2)
- **Negative**: overvalued (-3), overhyped (-3), bubble (-3), crash (-3), bearish (-2)

### OutputFormatter

Formats processed data as Mew-1A training examples.

```typescript
import { OutputFormatter } from '@pokedao/reddit-sentiment';

const formatter = new OutputFormatter();

// Format single item
const example = formatter.formatForTraining({
  id: 'abc123',
  subreddit: 'PokeInvesting',
  author: 'user123',
  text: 'Charizard VMAX going up!',
  score: 42,
  date: '2025-10-17T12:00:00Z',
  permalink: 'https://reddit.com/...',
  cardMatch: ['Charizard VMAX'],
  sentiment: 'Positive',
  sentimentScore: 0.7,
});

// Write to JSONL
await formatter.writeToJSONL([example], 'output.jsonl');

// Append to existing file
await formatter.appendToJSONL([example], 'output.jsonl');

// Generate statistics
const stats = await formatter.generateStatistics('output.jsonl');
console.log(stats);
// {
//   totalExamples: 1234,
//   bySentiment: { Positive: 600, Negative: 400, Neutral: 234 },
//   bySubreddit: { PokeInvesting: 800, PokemonTCG: 434 },
//   averageScore: 12.5,
//   dateRange: { earliest: '2025-01-01', latest: '2025-10-17' }
// }

// Deduplicate by Reddit ID
await formatter.deduplicateJSONL('input.jsonl', 'output-unique.jsonl');
```

## Integration with Mew-1A Training

### 1. Generate Reddit Sentiment Data

```bash
pnpm tsx scripts/collect-reddit-sentiment.ts --limit=500
```

This creates `data/training/reddit-sentiment.jsonl` with ~1000 examples (500 posts + 500 comments, filtered).

### 2. Merge with Existing Training Data

```python
# In your training script
from datasets import load_dataset, concatenate_datasets

# Load existing data
base_data = load_dataset('json', data_files='data/training/mew1a-v4-comprehensive-internal.jsonl')

# Load Reddit sentiment data
reddit_data = load_dataset('json', data_files='data/training/reddit-sentiment.jsonl')

# Merge
full_data = concatenate_datasets([base_data['train'], reddit_data['train']])

print(f"Total examples: {len(full_data)}")
# Total examples: 90256 (89256 original + 1000 Reddit)
```

### 3. Update Training Config

```python
# scripts/mew1a-train-v5.py

DATASET_FILES = [
    'data/training/mew1a-v4-comprehensive-internal.jsonl',
    'data/training/reddit-sentiment.jsonl',  # NEW!
]

# Train as usual
dataset = load_dataset('json', data_files=DATASET_FILES)
```

### 4. Expected Improvements

After training Mew-1A v4.1/v5 with Reddit sentiment data:

- ✅ **Community Awareness**: Model understands investor sentiment
- ✅ **Contextual Analysis**: "Reddit is bullish on this card" signals
- ✅ **Enhanced Recommendations**: Factor in hype/pessimism from collectors
- ✅ **Sentiment Queries**: Answer "What does the community think about Charizard?"

## Workflow Examples

### Daily Automated Collection (Worker Integration)

```typescript
// In worker service
import { incrementalUpdate } from '@pokedao/reddit-sentiment';

// Run daily cron job
cron.schedule('0 2 * * *', async () => {
  const checkpoint = loadCheckpoint(); // Load last timestamp

  await incrementalUpdate(config, checkpoint.lastTimestamp);

  saveCheckpoint({ lastTimestamp: Date.now() / 1000 });
});
```

### Historical Bulk Collection

```bash
# Collect 1 year of historical data via Pushshift
pnpm tsx scripts/bulk-collect-historical.ts --start=2024-01-01 --end=2025-01-01
```

```typescript
// scripts/bulk-collect-historical.ts
const fetcher = new RedditFetcher(credentials);

for (const subreddit of ['PokeInvesting', 'PokemonTCG']) {
  const data = await fetcher.fetchHistoricalBatch(
    subreddit,
    new Date('2024-01-01'),
    new Date('2025-01-01'),
    'submission'
  );

  // Process and save...
}
```

### Card-Specific Sentiment Analysis

```typescript
// Get sentiment for specific card from Reddit data
const cardSentiment = await getCardSentiment('Charizard VMAX');

function getCardSentiment(cardName: string) {
  const lines = fs.readFileSync('reddit-sentiment.jsonl', 'utf8').split('\n');

  const relevant = lines
    .map(line => JSON.parse(line))
    .filter(ex => ex.metadata.card_match.includes(cardName));

  const positive = relevant.filter(ex => ex.output.includes('Positive')).length;
  const negative = relevant.filter(ex => ex.output.includes('Negative')).length;

  return { cardName, positive, negative, total: relevant.length };
}
```

## Performance

- **Rate Limits**: 60 requests/minute (Reddit API)
- **Fetch Speed**: ~100 posts/min, ~100 comments/min
- **Processing**: ~1000 items/second (sentiment analysis)
- **Memory**: ~100MB for 10k posts

## Troubleshooting

### Rate Limit Errors

```
Error: 429 Too Many Requests
```

**Solution**: Module automatically handles rate limits with 2-second delays. For faster collection, consider:
- Using Pushshift for historical data (no rate limits)
- Spacing out collections (run daily, not hourly)

### Missing Reddit Credentials

```
Error: Missing required environment variables
```

**Solution**: Add credentials to `.env`:
```bash
REDDIT_CLIENT_ID=your_id
REDDIT_CLIENT_SECRET=your_secret
REDDIT_USERNAME=your_username
REDDIT_PASSWORD=your_password
```

### No Card Matches Found

```
Found 0 items mentioning Pokemon cards
```

**Possible causes**:
1. Card names not loaded from database
2. Subreddit has no recent TCG discussions
3. Card name patterns too strict

**Solution**: Add common Pokemon names manually:
```typescript
const extraCards = ['Charizard', 'Pikachu', 'Mewtwo', 'Lugia'];
config.cardNames = [...cardNames, ...extraCards];
```

## Testing

```bash
# Run tests
pnpm test

# Test with small dataset
pnpm tsx scripts/collect-reddit-sentiment.ts --limit=10

# Verify output
cat data/training/reddit-sentiment.jsonl | wc -l
```

## Future Enhancements

- [ ] Real-time sentiment streaming (Reddit WebSocket)
- [ ] Image recognition (for card photos in posts)
- [ ] User reputation weighting (trust experienced collectors more)
- [ ] Sentiment trends over time (track card hype cycles)
- [ ] Multi-language support (expand beyond English subreddits)

## License

MIT

## Links

- [PokeDAO Repository](https://github.com/ChicoPanama/PokeDao)
- [Reddit API Docs](https://www.reddit.com/dev/api)
- [Pushshift API](https://pushshift.io)
- [Mew-1A Training Guide](../../MEW1A-V4-READY-TO-TRAIN.md)
