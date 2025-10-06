/**
 * AI ENSEMBLE ANALYSIS ENGINE
 *
 * Triple-layer architecture for institutional-grade TCG analysis:
 * - Layer 1: Mew-1A (TCG-specialized model trained on market data)
 * - Layer 2: Ollama (Fast local inference for quick signals)
 * - Layer 3: DeepSeek R1 (Deep quantitative analysis with reasoning)
 * - Layer 4: Ensemble voting & conviction scoring
 *
 * Mew-1A deployed at: https://chicopanama--mew1a-tcg-pricing-analyze-card.modal.run
 * Model: ChicoPanama/mew1a-llama-3.2-3b-tcg-pricing (Llama-3.2-3B + LoRA adapters)
 */

import OpenAI from 'openai';

// ============================================================================
// TYPES
// ============================================================================

export interface MarketSignal {
  cardName: string;
  setName?: string;
  grade?: string;
  gradeCompany?: string;
  listedPrice: number;
  marketData: {
    fairValue: number;
    salesCount: number;
    avgVolume30d: number;
    priceChange7d: number;
    priceChange30d: number;
    lowestAvailable: number;
  };
}

export interface AIAnalysisResult {
  // Pricing Assessment
  recommendation: 'STRONG_BUY' | 'BUY' | 'HOLD' | 'SELL' | 'PASS';
  convictionScore: number; // 0-100: Agreement across all models
  alphaSignalStrength: number; // 0-100: How much edge vs market

  // Analysis Components
  mew1aAnalysis: {
    model: 'mew1a-llama-3.2';
    recommendation: 'BUY' | 'PASS' | 'NEUTRAL';
    reasoning: string;
    confidence: number;
    responseTime: number;
  };

  quickAnalysis: {
    model: 'ollama-qwen';
    sentiment: 'bullish' | 'neutral' | 'bearish';
    keyPoints: string[];
    confidence: number;
    responseTime: number;
  };

  deepAnalysis: {
    model: 'deepseek-r1';
    investmentThesis: string;
    riskFactors: string[];
    catalysts: string[];
    priceTarget: number;
    timeHorizon: string;
    confidence: number;
    responseTime: number;
  };

  ensemble: {
    agreementLevel: number; // 0-1: Model consensus
    conflictingSignals: string[];
    finalVerdict: string;
  };

  // Unique Metrics
  liquidityAdjustedFV: number; // Fair value * sellProbability
  sellProbability: number; // 0-1: Chance of selling within 30d
  daysToSell: number; // Expected days to clear
  whaleActivity: boolean; // Institutional buying detected
}

// ============================================================================
// MEW-1A CLIENT (Modal Labs)
// ============================================================================

class Mew1AClient {
  private endpoint: string;

  constructor(endpoint = 'https://chicopanama--mew1a-tcg-pricing-analyze-card.modal.run') {
    this.endpoint = endpoint;
  }

  async analyze(prompt: string, maxTokens = 150): Promise<{ response: string; time: number }> {
    const start = Date.now();

    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt,
        max_tokens: maxTokens,
      }),
    });

    const data: any = await response.json();
    return {
      response: data.response,
      time: Date.now() - start,
    };
  }
}

// ============================================================================
// OLLAMA CLIENT
// ============================================================================

class OllamaClient {
  private baseURL: string;

  constructor(baseURL = 'http://localhost:11434') {
    this.baseURL = baseURL;
  }

  async generate(model: string, prompt: string): Promise<{ response: string; time: number }> {
    const start = Date.now();

    const response = await fetch(`${this.baseURL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        prompt,
        stream: false,
        options: {
          temperature: 0.3,
          num_predict: 300,
        },
      }),
    });

    const data: any = await response.json();
    return {
      response: data.response,
      time: Date.now() - start,
    };
  }
}

// ============================================================================
// DEEPSEEK CLIENT
// ============================================================================

class DeepSeekClient {
  private client: OpenAI;

  constructor(apiKey: string) {
    this.client = new OpenAI({
      baseURL: 'https://api.deepseek.com',
      apiKey,
    });
  }

  async analyze(prompt: string): Promise<{ response: string; time: number }> {
    const start = Date.now();

    const completion = await this.client.chat.completions.create({
      model: 'deepseek-chat',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 400,
      temperature: 0.3,
    });

    return {
      response: completion.choices[0]?.message?.content || '',
      time: Date.now() - start,
    };
  }
}

// ============================================================================
// AI ENSEMBLE ENGINE
// ============================================================================

export class AIEnsembleEngine {
  private mew1a: Mew1AClient;
  private ollama: OllamaClient;
  private deepseek: DeepSeekClient;

  constructor(config: { deepseekApiKey: string; ollamaURL?: string; mew1aEndpoint?: string }) {
    this.mew1a = new Mew1AClient(config.mew1aEndpoint);
    this.ollama = new OllamaClient(config.ollamaURL);
    this.deepseek = new DeepSeekClient(config.deepseekApiKey);
  }

  async analyzeCard(signal: MarketSignal): Promise<AIAnalysisResult> {
    // Parallel execution: Layer 1 (TCG specialist) + Layer 2 (fast) + Layer 3 (deep)
    const [mew1aResult, quickResult, deepResult] = await Promise.all([
      this.runMew1AAnalysis(signal),
      this.runQuickAnalysis(signal),
      this.runDeepAnalysis(signal),
    ]);

    // Layer 4: Ensemble voting & conviction scoring
    const ensemble = this.computeEnsemble(mew1aResult, quickResult, deepResult, signal);

    // Calculate unique metrics
    const liquidityMetrics = this.calculateLiquidityMetrics(signal);
    const whaleActivity = this.detectWhaleActivity(signal);

    return {
      recommendation: ensemble.recommendation,
      convictionScore: ensemble.convictionScore,
      alphaSignalStrength: ensemble.alphaStrength,
      mew1aAnalysis: mew1aResult,
      quickAnalysis: quickResult,
      deepAnalysis: deepResult,
      ensemble: {
        agreementLevel: ensemble.agreement,
        conflictingSignals: ensemble.conflicts,
        finalVerdict: ensemble.verdict,
      },
      ...liquidityMetrics,
      whaleActivity,
    };
  }

  // ========================================================================
  // LAYER 1: MEW-1A TCG SPECIALIST ANALYSIS
  // ========================================================================

  private async runMew1AAnalysis(signal: MarketSignal) {
    const discount = ((signal.listedPrice - signal.marketData.fairValue) / signal.marketData.fairValue) * 100;

    const prompt = `Analyze this Pokemon TCG investment opportunity:

CARD: ${signal.cardName} ${signal.setName || ''} ${signal.gradeCompany || ''} ${signal.grade || ''}
LISTED: $${signal.listedPrice.toLocaleString()}
FAIR VALUE: $${signal.marketData.fairValue.toLocaleString()} (${signal.marketData.salesCount} recent sales)
DISCOUNT: ${discount.toFixed(1)}%
SALES VELOCITY: ${signal.marketData.avgVolume30d} sales/month
TREND: ${signal.marketData.priceChange7d > 0 ? '+' : ''}${signal.marketData.priceChange7d.toFixed(1)}% (7d), ${signal.marketData.priceChange30d > 0 ? '+' : ''}${signal.marketData.priceChange30d.toFixed(1)}% (30d)

Provide your BUY/PASS recommendation with reasoning (50 words max).`;

    const result = await this.mew1a.analyze(prompt, 100);

    // Extract recommendation from response
    const recommendation = this.extractMew1ARecommendation(result.response);
    const confidence = this.extractMew1AConfidence(result.response, discount);

    return {
      model: 'mew1a-llama-3.2' as const,
      recommendation,
      reasoning: result.response,
      confidence,
      responseTime: result.time,
    };
  }

  // ========================================================================
  // LAYER 2: FAST LOCAL ANALYSIS (Ollama Qwen)
  // ========================================================================

  private async runQuickAnalysis(signal: MarketSignal) {
    const discount = ((signal.listedPrice - signal.marketData.fairValue) / signal.marketData.fairValue) * 100;

    const prompt = `You are a quantitative trading analyst. Analyze this Pokemon TCG investment opportunity:

CARD: ${signal.cardName} ${signal.setName || ''} ${signal.gradeCompany || ''} ${signal.grade || ''}
LISTED: $${signal.listedPrice.toLocaleString()}
FAIR VALUE: $${signal.marketData.fairValue.toLocaleString()} (${signal.marketData.salesCount} comps)
DISCOUNT: ${discount.toFixed(1)}%
TREND: ${signal.marketData.priceChange7d > 0 ? '+' : ''}${signal.marketData.priceChange7d.toFixed(1)}% (7d), ${signal.marketData.priceChange30d > 0 ? '+' : ''}${signal.marketData.priceChange30d.toFixed(1)}% (30d)

Provide:
1. SENTIMENT: bullish/neutral/bearish
2. KEY_POINTS: 3 bullet points (technical, fundamental, timing)
3. CONFIDENCE: 0-100

Format: SENTIMENT: [x] | KEY_POINTS: [1. x, 2. x, 3. x] | CONFIDENCE: [x]`;

    const result = await this.ollama.generate('qwen2.5:3b-instruct-q4_0', prompt);

    return {
      model: 'ollama-qwen' as const,
      sentiment: this.extractSentiment(result.response),
      keyPoints: this.extractKeyPoints(result.response),
      confidence: this.extractConfidence(result.response),
      responseTime: result.time,
    };
  }

  // ========================================================================
  // LAYER 3: DEEP QUANTITATIVE ANALYSIS (DeepSeek R1)
  // ========================================================================

  private async runDeepAnalysis(signal: MarketSignal) {
    const discount = ((signal.listedPrice - signal.marketData.fairValue) / signal.marketData.fairValue) * 100;

    const prompt = `Quantitative Pokemon TCG investment analysis:

ASSET: ${signal.cardName} ${signal.setName || ''} ${signal.gradeCompany || ''} ${signal.grade || ''}
ENTRY: $${signal.listedPrice.toLocaleString()}
FAIR_VALUE: $${signal.marketData.fairValue.toLocaleString()}
DISCOUNT: ${discount.toFixed(1)}%
MARKET_DATA: ${signal.marketData.salesCount} sales, 30d volume ${signal.marketData.avgVolume30d} units
MOMENTUM: 7d ${signal.marketData.priceChange7d.toFixed(1)}%, 30d ${signal.marketData.priceChange30d.toFixed(1)}%

Provide systematic analysis:

THESIS: [2-3 sentences: investment rationale, edge, risk/reward]
RISKS: [3 key risk factors]
CATALYSTS: [2-3 potential price catalysts]
TARGET: [price target $X]
HORIZON: [12mo/6mo/3mo]
CONFIDENCE: [75-95]%`;

    const result = await this.deepseek.analyze(prompt);

    return {
      model: 'deepseek-r1' as const,
      investmentThesis: this.extractSection(result.response, 'THESIS'),
      riskFactors: this.extractList(result.response, 'RISKS'),
      catalysts: this.extractList(result.response, 'CATALYSTS'),
      priceTarget: this.extractPriceTarget(result.response),
      timeHorizon: this.extractSection(result.response, 'HORIZON'),
      confidence: this.extractConfidence(result.response),
      responseTime: result.time,
    };
  }

  // ========================================================================
  // LAYER 4: ENSEMBLE VOTING & CONVICTION
  // ========================================================================

  private computeEnsemble(mew1a: any, quick: any, deep: any, signal: MarketSignal) {
    // Map sentiments to numeric scores
    const mew1aScore = mew1a.recommendation === 'BUY' ? 1 : mew1a.recommendation === 'PASS' ? -1 : 0;
    const sentimentScore = { bullish: 1, neutral: 0, bearish: -1 };
    const quickScore = sentimentScore[quick.sentiment];
    const deepScore = deep.investmentThesis.toLowerCase().includes('buy') ? 1 :
                     deep.investmentThesis.toLowerCase().includes('pass') ? -1 : 0;

    // Three-way agreement level (0-1)
    const scores = [mew1aScore, quickScore, deepScore];
    const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
    const variance = scores.reduce((sum, s) => sum + Math.pow(s - avgScore, 2), 0) / scores.length;
    const agreement = 1 - Math.min(1, variance); // Low variance = high agreement

    // Conviction = agreement * avg(confidence) with 2x weight on Mew-1A (TCG specialist)
    const avgConfidence = (mew1a.confidence * 2 + quick.confidence + deep.confidence) / 4;
    const convictionScore = agreement * avgConfidence;

    // Alpha strength = discount magnitude * conviction
    const discount = ((signal.listedPrice - signal.marketData.fairValue) / signal.marketData.fairValue) * 100;
    const alphaStrength = Math.min(100, Math.abs(discount) * (convictionScore / 100));

    // Final recommendation (prioritize Mew-1A when high confidence)
    let recommendation: AIAnalysisResult['recommendation'];
    if (mew1a.confidence >= 85 && mew1aScore === 1 && discount < -15) recommendation = 'STRONG_BUY';
    else if (convictionScore >= 80 && discount < -15) recommendation = 'STRONG_BUY';
    else if (convictionScore >= 70 && discount < -10) recommendation = 'BUY';
    else if (convictionScore >= 60 && discount < 10) recommendation = 'HOLD';
    else if (discount > 20) recommendation = 'PASS';
    else recommendation = 'HOLD';

    const conflicts: string[] = [];
    if (agreement < 0.6) {
      const models = [
        `Mew-1A: ${mew1a.recommendation}`,
        `Ollama: ${quick.sentiment}`,
        `DeepSeek: ${deepScore > 0 ? 'bullish' : deepScore < 0 ? 'bearish' : 'neutral'}`,
      ];
      conflicts.push(models.join(', '));
    }

    const verdict = agreement >= 0.8 ?
      `Strong consensus (${(agreement * 100).toFixed(0)}%): ${recommendation}` :
      `Mixed signals: ${conflicts[0] || 'Moderate disagreement'}`;

    return {
      recommendation,
      convictionScore,
      alphaStrength,
      agreement,
      conflicts,
      verdict,
    };
  }

  // ========================================================================
  // LIQUIDITY METRICS
  // ========================================================================

  private calculateLiquidityMetrics(signal: MarketSignal) {
    // Sell probability based on volume and price positioning
    const volumeScore = Math.min(1, signal.marketData.avgVolume30d / 10); // 10+ sales = 1.0
    const priceScore = signal.listedPrice <= signal.marketData.lowestAvailable ? 1.0 : 0.5;
    const sellProbability = (volumeScore + priceScore) / 2;

    // Days to sell (inverse of velocity)
    const daysToSell = signal.marketData.avgVolume30d > 0 ?
      Math.ceil(30 / signal.marketData.avgVolume30d) :
      999;

    // Liquidity-adjusted fair value
    const liquidityAdjustedFV = signal.marketData.fairValue * sellProbability;

    return {
      liquidityAdjustedFV,
      sellProbability,
      daysToSell,
    };
  }

  // ========================================================================
  // WHALE DETECTION
  // ========================================================================

  private detectWhaleActivity(signal: MarketSignal): boolean {
    // Detect institutional buying: Volume spike + price increase
    const volumeSpike = signal.marketData.avgVolume30d > 5; // 5+ sales in 30d
    const priceIncrease = signal.marketData.priceChange30d > 15; // 15%+ gain

    return volumeSpike && priceIncrease;
  }

  // ========================================================================
  // PARSING HELPERS
  // ========================================================================

  private extractSentiment(text: string): 'bullish' | 'neutral' | 'bearish' {
    const lower = text.toLowerCase();
    if (lower.includes('sentiment: bullish')) return 'bullish';
    if (lower.includes('sentiment: bearish')) return 'bearish';
    return 'neutral';
  }

  private extractKeyPoints(text: string): string[] {
    const match = text.match(/KEY_POINTS:\s*\[(.*?)\]/i);
    if (!match) return ['Analysis complete'];

    return match[1]
      .split(/[,\n]/)
      .map(p => p.trim().replace(/^\d+\.\s*/, ''))
      .filter(p => p.length > 0)
      .slice(0, 3);
  }

  private extractSection(text: string, section: string): string {
    const match = text.match(new RegExp(`${section}:\\s*\\[?(.*?)\\]?(?=\\n[A-Z]+:|$)`, 'is'));
    return match ? match[1].trim() : 'Analysis pending';
  }

  private extractList(text: string, section: string): string[] {
    const match = text.match(new RegExp(`${section}:\\s*\\[(.*?)\\]`, 'is'));
    if (!match) return [];

    return match[1]
      .split(/[,\n]/)
      .map(item => item.trim())
      .filter(item => item.length > 0)
      .slice(0, 3);
  }

  private extractPriceTarget(text: string): number {
    const match = text.match(/TARGET:\s*\$?(\d+(?:,\d{3})*(?:\.\d{2})?)/i);
    return match ? parseFloat(match[1].replace(/,/g, '')) : 0;
  }

  private extractConfidence(text: string): number {
    const match = text.match(/CONFIDENCE:\s*(\d+)/i);
    return match ? parseInt(match[1]) : 75;
  }

  private extractMew1ARecommendation(text: string): 'BUY' | 'PASS' | 'NEUTRAL' {
    const lower = text.toLowerCase();
    if (lower.includes('buy') || lower.includes('strong buy')) return 'BUY';
    if (lower.includes('pass') || lower.includes('avoid')) return 'PASS';
    return 'NEUTRAL';
  }

  private extractMew1AConfidence(text: string, discount: number): number {
    // Extract explicit confidence if present
    const match = text.match(/confidence[:\s]+(\d+)/i);
    if (match) return parseInt(match[1]);

    // Infer confidence from discount and response strength
    const hasBuy = text.toLowerCase().includes('buy');
    const hasPass = text.toLowerCase().includes('pass');

    if (hasBuy && discount < -15) return 90; // Strong buy signal
    if (hasBuy && discount < -10) return 80;
    if (hasPass && discount > 10) return 85;
    if (hasBuy || hasPass) return 75;
    return 60; // Neutral
  }
}
