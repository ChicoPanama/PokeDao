/**
 * AI Thesis Generator for Signal Pipeline
 *
 * Lightweight wrapper that calls the AI ensemble to generate
 * investment thesis for arbitrage candidates.
 *
 * Features:
 * - Graceful fallback to static rationale on failure
 * - Configurable via environment variables
 * - Caching to avoid duplicate API calls
 */

import OpenAI from 'openai';

// ============================================================================
// CONFIGURATION
// ============================================================================

const AI_THESIS_ENABLED = process.env.AI_THESIS_ENABLED === 'true';
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || '';
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
const VLLM_ENDPOINT = process.env.VLLM_ENDPOINT || 'https://chicopanama--mew1a-vllm-analyze.modal.run';

// In-memory cache with TTL (1 hour)
const thesisCache = new Map<string, { thesis: AIThesis; expiresAt: number }>();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

// ============================================================================
// TYPES
// ============================================================================

export interface AIThesis {
  thesis: string;
  riskFactors: string[];
  catalysts: string[];
  confidence: number;
  recommendation: 'STRONG_BUY' | 'BUY' | 'HOLD' | 'PASS';
  source: 'ai' | 'static';
}

export interface ThesisInput {
  cardName: string;
  setName?: string;
  gradeCompany?: string;
  grade?: string;
  priceCents: number;
  fairValueCents: number | null;
  compCount: number;
  spreadBps: number;
}

// ============================================================================
// THESIS GENERATOR
// ============================================================================

/**
 * Generate AI-powered investment thesis for a card
 * Falls back to static rationale if AI is disabled or fails
 */
export async function generateThesis(input: ThesisInput): Promise<AIThesis> {
  // Must have fair value to generate thesis
  if (!input.fairValueCents) {
    return generateStaticThesis(input);
  }

  // Check if AI thesis is enabled
  if (!AI_THESIS_ENABLED || !DEEPSEEK_API_KEY) {
    return generateStaticThesis(input);
  }

  // Check cache
  const cacheKey = `${input.cardName}:${input.fairValueCents}`;
  const cached = thesisCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.thesis;
  }

  try {
    // Call DeepSeek for thesis generation (primary)
    const thesis = await generateDeepSeekThesis(input);

    // Cache result
    thesisCache.set(cacheKey, {
      thesis,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });

    // Clean old cache entries
    cleanCache();

    return thesis;
  } catch (error) {
    console.warn('[AI-THESIS] DeepSeek failed, falling back to static:', error instanceof Error ? error.message : 'Unknown error');
    return generateStaticThesis(input);
  }
}

/**
 * Batch generate thesis for multiple candidates
 * Uses concurrency limiting to avoid rate limits
 */
export async function generateThesisBatch(
  inputs: ThesisInput[],
  concurrency = 3
): Promise<AIThesis[]> {
  if (!AI_THESIS_ENABLED || !DEEPSEEK_API_KEY) {
    return inputs.map(generateStaticThesis);
  }

  const results: AIThesis[] = [];

  // Process in batches to avoid rate limits
  for (let i = 0; i < inputs.length; i += concurrency) {
    const batch = inputs.slice(i, i + concurrency);
    const batchResults = await Promise.all(
      batch.map(input => generateThesis(input).catch(() => generateStaticThesis(input)))
    );
    results.push(...batchResults);
  }

  return results;
}

// ============================================================================
// DEEPSEEK THESIS GENERATION
// ============================================================================

async function generateDeepSeekThesis(input: ThesisInput): Promise<AIThesis> {
  const client = new OpenAI({
    baseURL: 'https://api.deepseek.com',
    apiKey: DEEPSEEK_API_KEY,
  });

  const fairValueCents = input.fairValueCents ?? input.priceCents;
  const discount = ((fairValueCents - input.priceCents) / fairValueCents) * 100;
  const priceUsd = input.priceCents / 100;
  const fairValueUsd = fairValueCents / 100;

  const prompt = `Analyze this Pokemon TCG arbitrage opportunity:

CARD: ${input.cardName}${input.setName ? ` - ${input.setName}` : ''}${input.gradeCompany ? ` ${input.gradeCompany}` : ''}${input.grade ? ` ${input.grade}` : ''}
BUY PRICE: $${priceUsd.toFixed(2)}
FAIR VALUE: $${fairValueUsd.toFixed(2)} (based on ${input.compCount} recent sales)
DISCOUNT: ${discount.toFixed(1)}%
NET SPREAD: ${(input.spreadBps / 100).toFixed(1)}% after fees

Provide systematic analysis in this EXACT format:

THESIS: [2-3 sentence investment rationale explaining the edge and why this is profitable]
RISKS: [risk1], [risk2], [risk3]
CATALYSTS: [catalyst1], [catalyst2]
RECOMMENDATION: [STRONG_BUY/BUY/HOLD/PASS]
CONFIDENCE: [60-95]`;

  const completion = await client.chat.completions.create({
    model: 'deepseek-chat',
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 350,
    temperature: 0.3,
  });

  const response = completion.choices[0]?.message?.content || '';

  return parseDeepSeekResponse(response, input);
}

function parseDeepSeekResponse(response: string, input: ThesisInput): AIThesis {
  // Extract thesis
  const thesisMatch = response.match(/THESIS:\s*(.+?)(?=\nRISKS:|$)/is);
  const thesis = thesisMatch ? thesisMatch[1].trim() : generateStaticThesis(input).thesis;

  // Extract risks
  const risksMatch = response.match(/RISKS:\s*\[?(.+?)\]?(?=\nCATALYSTS:|$)/is);
  const riskFactors = risksMatch
    ? risksMatch[1].split(/[,\[\]]/).map(r => r.trim()).filter(r => r.length > 0).slice(0, 3)
    : ['Market volatility', 'Grade authenticity', 'Liquidity risk'];

  // Extract catalysts
  const catalystsMatch = response.match(/CATALYSTS:\s*\[?(.+?)\]?(?=\nRECOMMENDATION:|$)/is);
  const catalysts = catalystsMatch
    ? catalystsMatch[1].split(/[,\[\]]/).map(c => c.trim()).filter(c => c.length > 0).slice(0, 3)
    : ['Arbitrage price convergence', 'Market efficiency'];

  // Extract recommendation
  const recMatch = response.match(/RECOMMENDATION:\s*\[?(STRONG_BUY|BUY|HOLD|PASS)\]?/i);
  const recommendation = (recMatch ? recMatch[1].toUpperCase() : 'BUY') as AIThesis['recommendation'];

  // Extract confidence
  const confMatch = response.match(/CONFIDENCE:\s*\[?(\d+)/i);
  const confidence = confMatch ? Math.min(95, Math.max(60, parseInt(confMatch[1]))) : 75;

  return {
    thesis,
    riskFactors,
    catalysts,
    confidence,
    recommendation,
    source: 'ai',
  };
}

// ============================================================================
// STATIC THESIS (FALLBACK)
// ============================================================================

function generateStaticThesis(input: ThesisInput): AIThesis {
  const fairValueCents = input.fairValueCents ?? input.priceCents;
  const discount = fairValueCents > 0 ? ((fairValueCents - input.priceCents) / fairValueCents) * 100 : 0;
  const priceUsd = input.priceCents / 100;
  const fairValueUsd = fairValueCents / 100;
  const spreadPct = input.spreadBps / 100;

  // Generate quantitative thesis
  const thesis = `Arbitrage opportunity: ${input.cardName} listed at $${priceUsd.toFixed(2)} vs median fair value of $${fairValueUsd.toFixed(2)} based on ${input.compCount} comparable sales. Net spread of ${spreadPct.toFixed(1)}% after platform fees and shipping provides favorable risk-adjusted returns.`;

  // Static risk factors
  const riskFactors = [
    'Market price volatility',
    'Condition/grade discrepancy risk',
    'Liquidity constraints on exit',
  ];

  // Static catalysts
  const catalysts = [
    'Price convergence as market corrects mispricing',
    'Increased buyer demand at discount pricing',
  ];

  // Calculate recommendation based on spread
  let recommendation: AIThesis['recommendation'] = 'HOLD';
  if (input.spreadBps >= 2500 && input.compCount >= 5) recommendation = 'STRONG_BUY';
  else if (input.spreadBps >= 1500 && input.compCount >= 3) recommendation = 'BUY';
  else if (input.spreadBps >= 1000) recommendation = 'HOLD';
  else recommendation = 'PASS';

  // Confidence based on comp count
  const confidence = Math.min(90, 50 + input.compCount * 5);

  return {
    thesis,
    riskFactors,
    catalysts,
    confidence,
    recommendation,
    source: 'static',
  };
}

// ============================================================================
// CACHE MANAGEMENT
// ============================================================================

function cleanCache(): void {
  const now = Date.now();
  const maxEntries = 1000;

  // Remove expired entries
  for (const [key, value] of thesisCache.entries()) {
    if (value.expiresAt < now) {
      thesisCache.delete(key);
    }
  }

  // If still too large, remove oldest entries
  if (thesisCache.size > maxEntries) {
    const entries = Array.from(thesisCache.entries())
      .sort((a, b) => a[1].expiresAt - b[1].expiresAt);

    const toRemove = entries.slice(0, entries.length - maxEntries);
    for (const [key] of toRemove) {
      thesisCache.delete(key);
    }
  }
}

/**
 * Check if AI thesis generation is available
 */
export function isAIThesisEnabled(): boolean {
  return AI_THESIS_ENABLED && !!DEEPSEEK_API_KEY;
}
