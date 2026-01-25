/**
 * THESIS GENERATOR
 *
 * Generates investment theses for opportunities.
 *
 * STRATEGY:
 * - 70% of cases: Use templates (free, instant)
 * - 30% of cases: Use Groq LLM for complex/conflicting signals
 *
 * Cost: ~$0.00014 per Groq call (llama-3.1-8b-instant)
 */

import { Signals } from './signal-calculator.js';

export interface Opportunity {
  id: string;
  cardId: string;
  cardName: string;
  setName: string;
  grade: string | null;
  listingPrice: number;
  listingUrl: string;
  source: string;
}

export interface ThesisResult {
  thesis: string;
  recommendation: 'STRONG_BUY' | 'BUY' | 'WATCH' | 'PASS';
  usedLLM: boolean;
}

export class ThesisGenerator {
  private groqApiKey: string;

  constructor() {
    this.groqApiKey = process.env.GROQ_API_KEY || '';
  }

  /**
   * Generate investment thesis for an opportunity.
   */
  async generate(opportunity: Opportunity, signals: Signals): Promise<ThesisResult> {
    // Calculate discount
    const discount =
      signals.fairValue > 0
        ? ((signals.fairValue - opportunity.listingPrice) / signals.fairValue) * 100
        : 0;

    // Determine if we need LLM (complex/conflicting signals)
    if (this.isClearSignal(signals, opportunity, discount)) {
      return {
        thesis: this.templateThesis(opportunity, signals, discount),
        recommendation: this.getRecommendation(discount, signals),
        usedLLM: false
      };
    }

    // Use Groq for complex cases
    if (this.groqApiKey) {
      try {
        return await this.llmThesis(opportunity, signals, discount);
      } catch (error) {
        console.error('[thesis] Groq error, falling back to template:', error);
      }
    }

    // Fallback to template
    return {
      thesis: this.templateThesis(opportunity, signals, discount),
      recommendation: this.getRecommendation(discount, signals),
      usedLLM: false
    };
  }

  /**
   * Check if signals are clear enough for template.
   */
  private isClearSignal(signals: Signals, opp: Opportunity, discount: number): boolean {
    // Clear buy: >15% discount, bullish/stable trend, good liquidity
    if (
      discount > 15 &&
      signals.trend.direction !== 'DOWN' &&
      signals.liquidity.score >= 5
    ) {
      return true;
    }

    // Clear pass: premium price, bearish trend
    if (discount < 0 && signals.trend.direction === 'DOWN') {
      return true;
    }

    // Clear watch: small discount, mixed signals
    if (discount > 5 && discount < 15) {
      return true;
    }

    // Complex: conflicting signals need LLM
    return false;
  }

  /**
   * Get recommendation based on discount and signals.
   */
  private getRecommendation(
    discount: number,
    signals: Signals
  ): ThesisResult['recommendation'] {
    if (discount > 20 && signals.trend.direction !== 'DOWN' && signals.confidence > 0.6) {
      return 'STRONG_BUY';
    }
    if (discount > 10 && signals.trend.direction !== 'DOWN') {
      return 'BUY';
    }
    if (discount > 0 || (signals.sentiment.label === 'BULLISH' && discount > -5)) {
      return 'WATCH';
    }
    return 'PASS';
  }

  /**
   * Generate thesis using templates.
   */
  private templateThesis(opp: Opportunity, signals: Signals, discount: number): string {
    const discountFormatted = discount.toFixed(1);
    const isUndervalued = discount > 0;

    // STRONG BUY template
    if (discount > 20 && signals.trend.direction !== 'DOWN' && signals.confidence > 0.6) {
      return `🎯 **STRONG BUY: ${opp.cardName}**

**Price:** $${opp.listingPrice.toFixed(2)}
**Fair Value:** $${signals.fairValue.toFixed(2)} (${discountFormatted}% below)
**Source:** ${opp.source}

**Signals:**
• Trend: ${signals.trend.direction} ${signals.trend.percent}% (30d)
• Liquidity: ${signals.liquidity.score.toFixed(1)}/10 (${signals.liquidity.activeListings} active listings)
• Sentiment: ${signals.sentiment.label} (${signals.sentiment.postCount} posts this week)
${signals.scarcity.psa10Pop > 0 ? `• Scarcity: PSA 10 pop ${signals.scarcity.psa10Pop}` : ''}

**Thesis:** This ${opp.cardName} is trading ${discountFormatted}% below fair value with ${
        signals.trend.direction === 'UP' ? 'bullish' : 'stable'
      } momentum.${signals.scarcity.psa10Pop < 100 ? ' Low population adds scarcity premium.' : ''} Excellent entry point.

**Risk:** ${
        signals.liquidity.score < 5
          ? 'Lower liquidity may make exit harder.'
          : 'Good liquidity for exit.'
      }

[View Listing](${opp.listingUrl})`;
    }

    // BUY template
    if (isUndervalued && discount > 10) {
      return `📊 **BUY: ${opp.cardName}**

**Price:** $${opp.listingPrice.toFixed(2)}
**Fair Value:** $${signals.fairValue.toFixed(2)} (${discountFormatted}% below)
**Source:** ${opp.source}

**Signals:**
• Trend: ${signals.trend.direction} ${signals.trend.percent}%
• Liquidity: ${signals.liquidity.score.toFixed(1)}/10
• Sentiment: ${signals.sentiment.label}

**Thesis:** Solid discount with acceptable risk profile. ${
        signals.trend.direction === 'UP'
          ? 'Positive momentum supports entry.'
          : 'Watch for trend confirmation.'
      }

[View Listing](${opp.listingUrl})`;
    }

    // WATCH template
    if (isUndervalued || discount > -5) {
      return `👀 **WATCH: ${opp.cardName}**

**Price:** $${opp.listingPrice.toFixed(2)}
**Fair Value:** $${signals.fairValue.toFixed(2)} (${
        discount > 0 ? `${discountFormatted}% below` : `${Math.abs(discount).toFixed(1)}% above`
      })

**Signals:** ${signals.trend.direction} trend, ${signals.sentiment.label} sentiment

**Thesis:** ${
        discount > 0
          ? 'Modest discount. Wait for better entry or trend confirmation.'
          : 'Near fair value. Monitor for price drops.'
      }

[View Listing](${opp.listingUrl})`;
    }

    // PASS template
    return `⚠️ **PASS: ${opp.cardName}**

**Price:** $${opp.listingPrice.toFixed(2)}
**Fair Value:** $${signals.fairValue.toFixed(2)} (${Math.abs(discount).toFixed(1)}% premium)

**Why Pass:** Currently trading above fair value.${
      signals.trend.direction === 'DOWN' ? ' Bearish trend suggests waiting.' : ''
    } Wait for better entry.`;
  }

  /**
   * Generate thesis using Groq LLM for complex signals.
   */
  private async llmThesis(
    opp: Opportunity,
    signals: Signals,
    discount: number
  ): Promise<ThesisResult> {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.groqApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [
          {
            role: 'system',
            content: `You are a Pokemon card investment analyst. Generate concise, actionable investment theses. Be specific, cite data, and always give a clear recommendation.

Output format:
🎯/📊/👀/⚠️ **[STRONG BUY/BUY/WATCH/PASS]: Card Name**
[2-3 sentence thesis]
**Key Factors:** [3 bullets max]
**Risk:** [1 sentence]`
          },
          {
            role: 'user',
            content: `Analyze this opportunity:

Card: ${opp.cardName}
Set: ${opp.setName}
Grade: ${opp.grade || 'Raw'}
Listing Price: $${opp.listingPrice}
Source: ${opp.source}

Market Data:
- Fair Value: $${signals.fairValue.toFixed(2)} (${signals.confidence * 100}% confidence)
- Discount: ${discount.toFixed(1)}%
- Trend: ${signals.trend.direction} ${signals.trend.percent}% over ${signals.trend.period} days
- Liquidity: ${signals.liquidity.score.toFixed(1)}/10 (${signals.liquidity.activeListings} active listings, ${signals.liquidity.velocity30d} sales/30d)
- Sentiment: ${signals.sentiment.label} (score: ${signals.sentiment.score.toFixed(2)}, ${signals.sentiment.postCount} posts)
${signals.scarcity.psa10Pop > 0 ? `- PSA 10 Population: ${signals.scarcity.psa10Pop}` : ''}
${
  signals.arbitrage.length > 0
    ? `- Arbitrage: ${signals.arbitrage.map((a) => `${a.buySource}→${a.sellSource}: ${a.profitMargin}%`).join(', ')}`
    : ''
}

Conflicting signals detected. Provide nuanced analysis and recommendation.`
          }
        ],
        max_tokens: 400,
        temperature: 0.7
      })
    });

    if (!response.ok) {
      throw new Error(`Groq API error: ${response.status}`);
    }

    const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    const thesis = data.choices?.[0]?.message?.content || '';

    // Extract recommendation from response
    let recommendation: ThesisResult['recommendation'] = 'WATCH';
    if (thesis.includes('STRONG BUY')) recommendation = 'STRONG_BUY';
    else if (thesis.includes('BUY')) recommendation = 'BUY';
    else if (thesis.includes('PASS')) recommendation = 'PASS';

    return {
      thesis,
      recommendation,
      usedLLM: true
    };
  }
}

export const thesisGenerator = new ThesisGenerator();
