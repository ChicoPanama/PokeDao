/**
 * SentimentProcessor: Filters card mentions and analyzes sentiment
 */

// @ts-ignore - sentiment module doesn't have types
import Sentiment from 'sentiment';
import { RedditItem, RedditPost, RedditComment, SentimentAnalysisResult, CardNamePattern } from './types';

export class SentimentProcessor {
  private sentiment: Sentiment;
  private cardPatterns: CardNamePattern[] = [];
  private cardNameSet: Set<string> = new Set();

  // TCG-specific sentiment terms
  private readonly tcgLexicon: Record<string, number> = {
    // Positive/bullish terms
    undervalued: 3,
    steal: 3,
    moon: 3,
    mooning: 3,
    'to the moon': 3,
    'going up': 2,
    rising: 2,
    'hot card': 2,
    sleeper: 2,
    'buy now': 2,
    bullish: 2,
    grail: 2,
    chase: 2,
    investment: 1,
    hold: 1,
    keeper: 1,

    // Negative/bearish terms
    overvalued: -3,
    overhyped: -3,
    bubble: -3,
    dump: -3,
    dumping: -3,
    crash: -3,
    crashing: -3,
    'price drop': -2,
    dropping: -2,
    falling: -2,
    bearish: -2,
    overpriced: -2,
    'not worth': -2,
    'pass on': -2,
    skip: -1,
    wait: -1,
  };

  constructor(cardNames?: string[]) {
    this.sentiment = new Sentiment();

    // Note: We'll inject TCG lexicon via extras parameter instead of registerLanguage
    // this.sentiment.registerLanguage('tcg', this.tcgLexicon);

    if (cardNames) {
      this.loadCardNames(cardNames);
    }
  }

  /**
   * Load card names and create regex patterns
   */
  loadCardNames(cardNames: string[]): void {
    this.cardNameSet = new Set(cardNames.map(name => name.toLowerCase()));

    // Create patterns for common Pokemon TCG card variants
    const variants = ['ex', 'EX', 'VMAX', 'V', 'GX', 'VStar', 'VSTAR', 'Full Art', 'Alt Art', 'Alternate Art', 'Secret Rare'];

    this.cardPatterns = cardNames.map(name => {
      // Escape special regex characters
      const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

      // Create pattern that matches card name with optional variants
      const variantPattern = variants.join('|');
      const pattern = new RegExp(
        `\\b${escapedName}(?:\\s+(?:${variantPattern}))?\\b`,
        'i'
      );

      return {
        name,
        pattern,
      };
    });

    console.log(`Loaded ${cardNames.length} card names for matching`);
  }

  /**
   * Load card names from database query result
   */
  async loadCardNamesFromDatabase(
    queryFn: () => Promise<Array<{ cardName: string }>>
  ): Promise<void> {
    const results = await queryFn();
    const cardNames = results
      .map(r => r.cardName)
      .filter((name): name is string => Boolean(name));

    this.loadCardNames(cardNames);
  }

  /**
   * Check if text contains any card mentions
   */
  containsCardMention(text: string): boolean {
    const lowerText = text.toLowerCase();

    // Quick check with Set for common names
    for (const cardName of this.cardNameSet) {
      if (lowerText.includes(cardName)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Extract all card names mentioned in text
   */
  extractCardNames(text: string): string[] {
    const matches: string[] = [];
    const seen = new Set<string>();

    for (const { name, pattern } of this.cardPatterns) {
      if (pattern.test(text)) {
        const normalized = name.toLowerCase();
        if (!seen.has(normalized)) {
          matches.push(name);
          seen.add(normalized);
        }
      }
    }

    return matches;
  }

  /**
   * Analyze sentiment of text
   */
  analyzeSentiment(text: string): SentimentAnalysisResult {
    // Use TCG-aware sentiment analysis
    const result = this.sentiment.analyze(text, {
      extras: this.tcgLexicon
    });

    // Determine label based on comparative score
    let label: 'Positive' | 'Negative' | 'Neutral';

    if (result.comparative > 0.05) {
      label = 'Positive';
    } else if (result.comparative < -0.05) {
      label = 'Negative';
    } else {
      label = 'Neutral';
    }

    return {
      label,
      score: result.score,
      comparative: result.comparative,
    };
  }

  /**
   * Extract text from Reddit item
   */
  extractText(item: RedditItem): string {
    if ('title' in item) {
      // Post: combine title and selftext
      const post = item as RedditPost;
      return `${post.title}\n\n${post.selftext}`.trim();
    } else {
      // Comment: use body
      const comment = item as RedditComment;
      return comment.body;
    }
  }

  /**
   * Process a batch of Reddit items
   */
  processBatch(items: RedditItem[]): Array<{
    item: RedditItem;
    text: string;
    cardMatch: string[];
    sentiment: SentimentAnalysisResult;
  }> {
    const results = [];

    for (const item of items) {
      const text = this.extractText(item);

      // Filter by card mentions
      if (!this.containsCardMention(text)) {
        continue;
      }

      const cardMatch = this.extractCardNames(text);

      // Skip if no cards extracted (shouldn't happen, but safety check)
      if (cardMatch.length === 0) {
        continue;
      }

      const sentiment = this.analyzeSentiment(text);

      results.push({
        item,
        text,
        cardMatch,
        sentiment,
      });
    }

    return results;
  }

  /**
   * Enhanced sentiment analysis with context awareness
   */
  analyzeWithContext(text: string, cardName: string): SentimentAnalysisResult {
    // Extract sentences containing the card name
    const sentences = text.split(/[.!?]+/);
    const relevantSentences = sentences.filter(s =>
      s.toLowerCase().includes(cardName.toLowerCase())
    );

    // If we have context, analyze just the relevant parts
    const contextText = relevantSentences.length > 0
      ? relevantSentences.join('. ')
      : text;

    return this.analyzeSentiment(contextText);
  }

  /**
   * Classify investment sentiment (BUY/HOLD/SELL signals)
   */
  classifyInvestmentSignal(text: string): 'BUY' | 'HOLD' | 'SELL' | 'NEUTRAL' {
    const lowerText = text.toLowerCase();

    // Strong buy signals
    const buySignals = ['buy', 'buying', 'undervalued', 'steal', 'moon', 'bullish', 'invest'];
    const strongBuy = buySignals.some(signal => lowerText.includes(signal));

    // Strong sell signals
    const sellSignals = ['sell', 'selling', 'dump', 'overvalued', 'crash', 'bearish'];
    const strongSell = sellSignals.some(signal => lowerText.includes(signal));

    // Hold signals
    const holdSignals = ['hold', 'holding', 'keep', 'wait'];
    const shouldHold = holdSignals.some(signal => lowerText.includes(signal));

    if (strongBuy && !strongSell) return 'BUY';
    if (strongSell && !strongBuy) return 'SELL';
    if (shouldHold) return 'HOLD';

    // Fallback to sentiment-based classification
    const sentiment = this.analyzeSentiment(text);
    if (sentiment.comparative > 0.1) return 'BUY';
    if (sentiment.comparative < -0.1) return 'SELL';

    return 'NEUTRAL';
  }

  /**
   * Get sentiment statistics for a batch
   */
  getBatchStatistics(results: Array<{ sentiment: SentimentAnalysisResult }>): {
    positive: number;
    negative: number;
    neutral: number;
    averageScore: number;
    averageComparative: number;
  } {
    const stats = {
      positive: 0,
      negative: 0,
      neutral: 0,
      totalScore: 0,
      totalComparative: 0,
    };

    for (const { sentiment } of results) {
      switch (sentiment.label) {
        case 'Positive':
          stats.positive++;
          break;
        case 'Negative':
          stats.negative++;
          break;
        case 'Neutral':
          stats.neutral++;
          break;
      }
      stats.totalScore += sentiment.score;
      stats.totalComparative += sentiment.comparative;
    }

    return {
      positive: stats.positive,
      negative: stats.negative,
      neutral: stats.neutral,
      averageScore: results.length > 0 ? stats.totalScore / results.length : 0,
      averageComparative: results.length > 0 ? stats.totalComparative / results.length : 0,
    };
  }
}
