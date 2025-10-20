/**
 * Types for Reddit sentiment extraction
 */

export interface RedditPost {
  id: string;
  subreddit: string;
  author: string;
  title: string;
  selftext: string;
  score: number;
  created_utc: number;
  permalink: string;
}

export interface RedditComment {
  id: string;
  subreddit: string;
  author: string;
  body: string;
  score: number;
  created_utc: number;
  permalink: string;
  link_id: string;
}

export type RedditItem = RedditPost | RedditComment;

export interface ProcessedRedditData {
  id: string;
  subreddit: string;
  author: string;
  text: string;
  score: number;
  date: string;
  permalink: string;
  cardMatch: string[];
  sentiment: 'Positive' | 'Negative' | 'Neutral';
  sentimentScore: number;
}

export interface Mew1ATrainingExample {
  instruction: string;
  input: string;
  output: string;
  category: string;
  metadata: {
    subreddit: string;
    author: string;
    score: number;
    date: string;
    card_match: string;
    sentiment_score: number;
    permalink?: string;
    reddit_id?: string;
  };
}

export interface SentimentAnalysisResult {
  label: 'Positive' | 'Negative' | 'Neutral';
  score: number;
  comparative: number;
}

export interface FetchOptions {
  subreddit: string;
  since?: Date;
  limit?: number;
  sort?: 'new' | 'hot' | 'top';
  timeframe?: 'hour' | 'day' | 'week' | 'month' | 'year' | 'all';
}

export interface CardNamePattern {
  name: string;
  pattern: RegExp;
  aliases?: string[];
}
