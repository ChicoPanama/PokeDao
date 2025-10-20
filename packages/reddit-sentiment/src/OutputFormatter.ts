/**
 * OutputFormatter: Formats Reddit sentiment data for Mew-1A training
 */

import { Mew1ATrainingExample, ProcessedRedditData, SentimentAnalysisResult } from './types';
import * as fs from 'fs';
import * as path from 'path';

export class OutputFormatter {
  private readonly instructionTemplates = {
    basic: 'What is the sentiment of the following Reddit post about a Pokémon card?',
    detailed: 'Analyze the community sentiment for the following discussion about a Pokémon TCG card.',
    cardSpecific: (cardName: string) =>
      `Determine the community sentiment for this Reddit discussion about ${cardName}.`,
    investment: 'Based on this Reddit post, what is the investment sentiment for the mentioned Pokémon card?',
  };

  /**
   * Format a single Reddit item for Mew-1A training
   */
  formatForTraining(data: ProcessedRedditData): Mew1ATrainingExample {
    const cardNames = data.cardMatch.join(', ');

    // Choose instruction based on whether we have specific cards
    const instruction =
      data.cardMatch.length === 1
        ? this.instructionTemplates.cardSpecific(data.cardMatch[0])
        : this.instructionTemplates.detailed;

    // Format the input with context
    const input = this.formatInput(data.text, data.subreddit, data.score);

    // Generate output (sentiment label)
    const output = this.formatOutput(data.sentiment, data.cardMatch);

    return {
      instruction,
      input,
      output,
      category: 'reddit_sentiment',
      metadata: {
        subreddit: data.subreddit,
        author: data.author,
        score: data.score,
        date: data.date,
        card_match: cardNames,
        sentiment_score: data.sentimentScore,
        permalink: data.permalink,
        reddit_id: data.id,
      },
    };
  }

  /**
   * Format input text with context
   */
  private formatInput(text: string, subreddit: string, score: number): string {
    // Truncate very long text to fit within token limits
    const maxLength = 800; // Conservative limit for 512 token context
    let truncatedText = text.length > maxLength ? text.substring(0, maxLength) + '...' : text;

    return `Post from r/${subreddit} (${score} upvotes):\n"${truncatedText}"`;
  }

  /**
   * Format output (sentiment response)
   */
  private formatOutput(sentiment: string, cardNames: string[]): string {
    if (cardNames.length === 1) {
      return `The sentiment is ${sentiment} for ${cardNames[0]}.`;
    } else {
      return `The sentiment is ${sentiment} for the mentioned cards: ${cardNames.join(', ')}.`;
    }
  }

  /**
   * Format with investment-focused instruction
   */
  formatForInvestmentTraining(data: ProcessedRedditData): Mew1ATrainingExample {
    const example = this.formatForTraining(data);

    // Override instruction for investment focus
    example.instruction = this.instructionTemplates.investment;

    // Enhance output with investment interpretation
    const investmentSignal = this.getInvestmentSignal(data.sentiment, data.sentimentScore);
    example.output = `${example.output}\n\nInvestment Signal: ${investmentSignal}`;

    return example;
  }

  /**
   * Get investment signal from sentiment
   */
  private getInvestmentSignal(sentiment: string, score: number): string {
    if (sentiment === 'Positive' && score > 2) {
      return 'Strong community interest suggests potential BUY opportunity.';
    } else if (sentiment === 'Positive') {
      return 'Positive sentiment indicates HOLD or cautious BUY.';
    } else if (sentiment === 'Negative' && score < -2) {
      return 'Strong negative sentiment suggests caution or PASS.';
    } else if (sentiment === 'Negative') {
      return 'Negative sentiment indicates potential price decline.';
    } else {
      return 'Neutral sentiment - monitor for clearer signals.';
    }
  }

  /**
   * Write examples to JSONL file
   */
  async writeToJSONL(
    examples: Mew1ATrainingExample[],
    outputPath: string
  ): Promise<void> {
    // Ensure directory exists
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Write JSONL (one JSON object per line)
    const lines = examples.map(ex => JSON.stringify(ex)).join('\n');

    fs.writeFileSync(outputPath, lines, 'utf8');

    console.log(`✅ Wrote ${examples.length} examples to ${outputPath}`);
  }

  /**
   * Append examples to existing JSONL file
   */
  async appendToJSONL(
    examples: Mew1ATrainingExample[],
    outputPath: string
  ): Promise<void> {
    const lines = examples.map(ex => JSON.stringify(ex)).join('\n');

    // If file exists, append with newline separator
    if (fs.existsSync(outputPath)) {
      fs.appendFileSync(outputPath, '\n' + lines, 'utf8');
    } else {
      // If file doesn't exist, create it
      await this.writeToJSONL(examples, outputPath);
      return;
    }

    console.log(`✅ Appended ${examples.length} examples to ${outputPath}`);
  }

  /**
   * Batch format multiple processed items
   */
  batchFormat(
    processedData: ProcessedRedditData[],
    includeInvestment = false
  ): Mew1ATrainingExample[] {
    return processedData.map(data =>
      includeInvestment
        ? this.formatForInvestmentTraining(data)
        : this.formatForTraining(data)
    );
  }

  /**
   * Create training examples with variations
   */
  createVariations(data: ProcessedRedditData): Mew1ATrainingExample[] {
    const examples: Mew1ATrainingExample[] = [];

    // Basic sentiment example
    examples.push(this.formatForTraining(data));

    // If high score (popular post), create investment-focused example
    if (data.score >= 20) {
      examples.push(this.formatForInvestmentTraining(data));
    }

    return examples;
  }

  /**
   * Generate summary statistics for a JSONL file
   */
  async generateStatistics(jsonlPath: string): Promise<{
    totalExamples: number;
    byCategory: Record<string, number>;
    bySentiment: Record<string, number>;
    bySubreddit: Record<string, number>;
    averageScore: number;
    dateRange: { earliest: string; latest: string };
  }> {
    const lines = fs.readFileSync(jsonlPath, 'utf8').split('\n').filter(Boolean);

    const stats = {
      totalExamples: lines.length,
      byCategory: {} as Record<string, number>,
      bySentiment: {} as Record<string, number>,
      bySubreddit: {} as Record<string, number>,
      totalScore: 0,
      dates: [] as string[],
    };

    for (const line of lines) {
      try {
        const example: Mew1ATrainingExample = JSON.parse(line);

        // Count by category
        stats.byCategory[example.category] = (stats.byCategory[example.category] || 0) + 1;

        // Count by sentiment (extract from output)
        const sentimentMatch = example.output.match(/sentiment is (\w+)/i);
        if (sentimentMatch) {
          const sentiment = sentimentMatch[1];
          stats.bySentiment[sentiment] = (stats.bySentiment[sentiment] || 0) + 1;
        }

        // Count by subreddit
        const subreddit = example.metadata.subreddit;
        stats.bySubreddit[subreddit] = (stats.bySubreddit[subreddit] || 0) + 1;

        // Track scores
        stats.totalScore += example.metadata.score;

        // Track dates
        stats.dates.push(example.metadata.date);
      } catch (error) {
        console.warn('Failed to parse line:', line.substring(0, 100));
      }
    }

    // Sort dates to find range
    stats.dates.sort();

    return {
      totalExamples: stats.totalExamples,
      byCategory: stats.byCategory,
      bySentiment: stats.bySentiment,
      bySubreddit: stats.bySubreddit,
      averageScore: stats.totalExamples > 0 ? stats.totalScore / stats.totalExamples : 0,
      dateRange: {
        earliest: stats.dates[0] || 'N/A',
        latest: stats.dates[stats.dates.length - 1] || 'N/A',
      },
    };
  }

  /**
   * Deduplicate JSONL file by Reddit ID
   */
  async deduplicateJSONL(inputPath: string, outputPath: string): Promise<number> {
    const lines = fs.readFileSync(inputPath, 'utf8').split('\n').filter(Boolean);

    const seen = new Set<string>();
    const unique: string[] = [];

    for (const line of lines) {
      try {
        const example: Mew1ATrainingExample = JSON.parse(line);
        const redditId = example.metadata.reddit_id;

        if (redditId && !seen.has(redditId)) {
          seen.add(redditId);
          unique.push(line);
        }
      } catch (error) {
        console.warn('Failed to parse line during deduplication');
      }
    }

    fs.writeFileSync(outputPath, unique.join('\n'), 'utf8');

    const removedCount = lines.length - unique.length;
    console.log(`✅ Removed ${removedCount} duplicates. Kept ${unique.length} unique examples.`);

    return removedCount;
  }
}
