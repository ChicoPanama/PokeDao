# Maximum Reddit Collection Strategy

## Current Status
- **Collected**: 6,334 unique examples
- **File size**: 6.2 MB
- **Subreddits**: 10 communities
- **Methods**: New, Hot, Top, Historical search

## How to Get 10x-20x MORE Data

### Strategy 1: Search Every Popular Card (100+ searches)
Instead of 10 search terms, search for every popular Pokemon:

```typescript
const SEARCH_TERMS = [
  // All popular Pokemon (100+)
  'Charizard', 'Charizard VMAX', 'Charizard ex', 'Charizard V',
  'Pikachu', 'Pikachu VMAX', 'Pikachu V', 'Pikachu ex',
  'Mewtwo', 'Mewtwo VSTAR', 'Mewtwo ex', 'Mewtwo V',
  // ... 100+ more

  // Set names (all major sets)
  'Base Set', 'Jungle', 'Fossil', '151', 'Obsidian Flames',
  // ... 180+ sets

  // Investment terms
  'PSA 10', 'CGC', 'Beckett', 'graded',
  'sealed booster', 'ETB', 'booster box',
  // ... many more
];
```

**Potential**: 100 searches × 100 results × 10 subreddits = **100,000 items → ~40,000 examples**

### Strategy 2: Time-Based Scraping (Going Back Years)
Search week by week:

```typescript
// For each subreddit, for each popular card
for (let year = 2020; year <= 2025; year++) {
  for (let month = 1; month <= 12; month++) {
    // Search posts from that month
    searchByTime(subreddit, card, year, month);
  }
}
```

**Potential**: 5 years × 12 months × 10 subreddits × 50 cards = **30,000+ items → ~12,000 examples**

### Strategy 3: Deep Comment Mining
For EVERY post about Pokemon cards, fetch ALL comments (not just top 250):

```typescript
for (const post of relevantPosts) {
  const allComments = await fetchAllComments(post.id); // Can be 100-500 per post
}
```

**Potential**: 10,000 posts × 50 comments avg = **500,000 comments → ~20,000 examples**

### Strategy 4: More Subreddits
There are 20+ more Pokemon-related subreddits:

- r/PokemonCardValue
- r/IsMyPokemonCardFake
- r/PokemonCardAppraisal
- r/pokemoncardpulls
- r/PokemonTCGOnline (different from ptcgo)
- And 15+ more smaller communities

**Potential**: 20 more subreddits × 300 examples avg = **6,000 examples**

## Realistic Maximum Estimates

| Strategy | Effort | Expected Examples | Time |
|----------|--------|------------------|------|
| **Current** | ✅ Done | 6,334 | 30 min |
| **100+ Searches** | Medium | +15,000 | 2 hours |
| **Time-Based** | High | +10,000 | 4 hours |
| **Deep Comments** | Very High | +20,000 | 8 hours |
| **More Subreddits** | Low | +6,000 | 1 hour |
| **TOTAL** | | **~57,000 examples** | 15 hours |

## Recommended Approach

**Phase 1: Quick Wins** (30 minutes)
- Expand search terms to top 50 cards
- Add 5-10 more subreddits
- **Expected**: +8,000-10,000 examples → **~15,000 total**

**Phase 2: Deep Search** (2 hours)
- Search for all 180 Pokemon TCG sets
- Time-based searches (last 2 years, monthly)
- **Expected**: +15,000 examples → **~30,000 total**

**Phase 3: Comment Mining** (if needed, 4+ hours)
- Fetch all comments from relevant posts
- **Expected**: +20,000 examples → **~50,000 total**

## What's Actually Useful for Training?

**Diminishing Returns**:
- 3,000-5,000 examples: **Good** sentiment signal
- 10,000-15,000 examples: **Strong** sentiment awareness
- 30,000+ examples: **Excellent** but may be overkill

**Current 6,334 is already strong!** But we can easily get to 15,000-20,000 with Phase 1+2.

## Decision Point

**Option A**: Keep current 6,334 (already 7% of dataset - significant!)
**Option B**: Run Phase 1 (30 min) → ~15,000 examples
**Option C**: Run Phase 1+2 (2.5 hours) → ~30,000 examples
**Option D**: Go nuclear with all phases (15 hours) → ~50,000+ examples

**Recommendation**: **Option B or C** - sweet spot between effort and value.
