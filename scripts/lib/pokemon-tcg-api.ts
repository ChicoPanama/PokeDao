/**
 * Pokemon TCG API Integration
 *
 * Official API: https://api.pokemontcg.io/v2/
 * Documentation: https://docs.pokemontcg.io/
 *
 * Features:
 * - Search cards by name, set, and card number
 * - Get official card images
 * - Cross-reference marketplace listings with official data
 */

import fetch from 'node-fetch';

interface PokemonTCGCard {
  id: string;
  name: string;
  supertype: string;
  subtypes: string[];
  hp?: string;
  types?: string[];
  number: string;
  artist?: string;
  rarity?: string;
  set: {
    id: string;
    name: string;
    series: string;
    printedTotal: number;
    total: number;
    releaseDate: string;
    images: {
      symbol: string;
      logo: string;
    };
  };
  images: {
    small: string;
    large: string;
  };
  tcgplayer?: {
    url: string;
    updatedAt: string;
    prices: Record<string, {
      low: number;
      mid: number;
      high: number;
      market: number;
    }>;
  };
}

interface PokemonTCGResponse {
  data: PokemonTCGCard[];
  page: number;
  pageSize: number;
  count: number;
  totalCount: number;
}

export interface CardMatchResult {
  matched: boolean;
  confidence: number; // 0-1 score
  tcgCard?: PokemonTCGCard;
  matchReason?: string;
}

export class PokemonTCGAPI {
  private baseUrl = 'https://api.pokemontcg.io/v2';
  private apiKey?: string;
  private requestDelay = 50; // ms between requests (rate limiting)

  constructor(apiKey?: string) {
    this.apiKey = apiKey;
  }

  /**
   * Search for cards with query string
   */
  async searchCards(query: string, pageSize = 10): Promise<PokemonTCGCard[]> {
    const url = `${this.baseUrl}/cards?q=${encodeURIComponent(query)}&pageSize=${pageSize}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.apiKey) {
      headers['X-Api-Key'] = this.apiKey;
    }

    await this.sleep(this.requestDelay);

    const response = await fetch(url, { headers });

    if (!response.ok) {
      throw new Error(`Pokemon TCG API error: ${response.statusText}`);
    }

    const data = await response.json() as PokemonTCGResponse;
    return data.data;
  }

  /**
   * Match a marketplace listing to official Pokemon TCG data
   */
  async matchCard(params: {
    cardName?: string;
    setName?: string;
    cardNumber?: string;
    title?: string;
  }): Promise<CardMatchResult> {
    const { cardName, setName, cardNumber, title } = params;

    // Build search query using Lucene syntax
    const queryParts: string[] = [];

    if (cardName && cardName !== 'Unknown' && cardName.trim()) {
      queryParts.push(`name:"${this.sanitizeQuery(cardName)}"`);
    }

    if (setName && setName !== 'Unknown' && setName.trim()) {
      queryParts.push(`set.name:"${this.sanitizeQuery(setName)}"`);
    }

    if (cardNumber && cardNumber.trim()) {
      queryParts.push(`number:${this.sanitizeQuery(cardNumber)}`);
    }

    // If no structured data, try fuzzy search on title
    if (queryParts.length === 0 && title && title.trim()) {
      // Extract potential Pokemon name from title (first capitalized words)
      const nameMatch = title.match(/([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/);
      if (nameMatch) {
        queryParts.push(`name:"${this.sanitizeQuery(nameMatch[1])}"`);
      }
    }

    if (queryParts.length === 0) {
      return {
        matched: false,
        confidence: 0,
        matchReason: 'Insufficient data to search',
      };
    }

    const query = queryParts.join(' ');

    try {
      const results = await this.searchCards(query, 5);

      if (results.length === 0) {
        return {
          matched: false,
          confidence: 0,
          matchReason: 'No matches found',
        };
      }

      // Score matches based on field similarity
      const scoredResults = results.map(card => {
        let score = 0;
        let maxScore = 0;

        // Name match (most important)
        if (cardName && cardName !== 'Unknown') {
          maxScore += 40;
          const nameSim = this.similarity(cardName.toLowerCase(), card.name.toLowerCase());
          score += nameSim * 40;
        }

        // Set match
        if (setName && setName !== 'Unknown') {
          maxScore += 30;
          const setSim = this.similarity(setName.toLowerCase(), card.set.name.toLowerCase());
          score += setSim * 30;
        }

        // Card number match (exact)
        if (cardNumber) {
          maxScore += 30;
          if (cardNumber === card.number) {
            score += 30;
          }
        }

        const confidence = maxScore > 0 ? score / maxScore : 0;
        return { card, confidence };
      });

      // Sort by confidence
      scoredResults.sort((a, b) => b.confidence - a.confidence);
      const best = scoredResults[0];

      // Accept matches with >70% confidence
      if (best.confidence > 0.7) {
        return {
          matched: true,
          confidence: best.confidence,
          tcgCard: best.card,
          matchReason: `Matched with ${(best.confidence * 100).toFixed(0)}% confidence`,
        };
      }

      return {
        matched: false,
        confidence: best.confidence,
        matchReason: `Best match only ${(best.confidence * 100).toFixed(0)}% confident`,
      };

    } catch (error: any) {
      return {
        matched: false,
        confidence: 0,
        matchReason: `API error: ${error.message}`,
      };
    }
  }

  /**
   * Get card by exact ID
   */
  async getCard(id: string): Promise<PokemonTCGCard | null> {
    const url = `${this.baseUrl}/cards/${id}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.apiKey) {
      headers['X-Api-Key'] = this.apiKey;
    }

    await this.sleep(this.requestDelay);

    try {
      const response = await fetch(url, { headers });

      if (!response.ok) {
        return null;
      }

      const data = await response.json() as { data: PokemonTCGCard };
      return data.data;
    } catch {
      return null;
    }
  }

  /**
   * Calculate string similarity (Jaro-Winkler-ish)
   */
  private similarity(s1: string, s2: string): number {
    if (s1 === s2) return 1.0;
    if (s1.length === 0 || s2.length === 0) return 0.0;

    // Simple approach: count matching characters
    const longer = s1.length > s2.length ? s1 : s2;
    const shorter = s1.length > s2.length ? s2 : s1;

    if (longer.includes(shorter)) {
      return shorter.length / longer.length;
    }

    // Character-by-character comparison
    let matches = 0;
    for (let i = 0; i < shorter.length; i++) {
      if (longer[i] === shorter[i]) {
        matches++;
      }
    }

    return matches / longer.length;
  }

  /**
   * Sanitize query string for Lucene syntax
   */
  private sanitizeQuery(str: string): string {
    // Escape special Lucene characters
    return str.replace(/[+\-&|!(){}[\]^"~*?:\\/]/g, ' ').trim();
  }

  /**
   * Sleep helper for rate limiting
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
