/**
 * vLLM Client for Mew-1A High-Performance Inference
 *
 * Connects to vLLM-powered Mew-1A deployment (Modal Labs or self-hosted)
 *
 * Performance Benefits vs Standard Transformers:
 * - 2-3x faster inference (1-2s vs 3-7s)
 * - Continuous batching support
 * - Better GPU utilization
 * - Lower cost per inference
 *
 * Usage:
 *   const analysis = await vllmAnalyzeCard({
 *     cardName: "Charizard ex",
 *     setName: "Obsidian Flames",
 *     listedPrice: 45.0,
 *     fairValue: 52.0
 *   });
 */

// =============================================================================
// TYPES
// =============================================================================

export interface VLLMAnalysisRequest {
  cardName: string;
  setName?: string;
  listedPrice?: number;
  fairValue?: number;
  maxTokens?: number;
  userId?: string;                                       // Optional: for sticky canary routing
}

export interface VLLMAnalysisResponse {
  card: string;
  set?: string;
  analysis: string;                                      // Backward compatible: explanation or analysis
  headline?: string;                                      // New in v4.3-shaped: policy-aligned headline
  recommendation: 'BUY' | 'PASS' | 'HOLD' | 'NEUTRAL';   // Added 'HOLD' for v4.3-shaped
  tokens: number;
  inferenceTime: number;
  tokensPerSecond: number;
  totalTime: number;
}

export interface VLLMGenerateRequest {
  prompt: string;
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  userId?: string;                                       // Optional: for sticky canary routing
}

export interface VLLMGenerateResponse {
  response: string;
  tokens: number;
  inferenceTime: number;
  tokensPerSecond: number;
}

// =============================================================================
// CONFIGURATION
// =============================================================================

// Canary deployment routing configuration
const MEW1A_STABLE_ENDPOINT = process.env.MEW1A_STABLE_ENDPOINT ||
  process.env.VLLM_ENDPOINT ||  // Backward compatibility
  'https://chicopanama--mew1a-vllm-fastapi-app.modal.run/analyze';

const MEW1A_CANARY_ENDPOINT = process.env.MEW1A_CANARY_ENDPOINT ||
  'https://chicopanama--mew1a-vllm-v4-3-shaped-fastapi-app.modal.run/analyze';

const MEW1A_CANARY_WEIGHT = parseFloat(process.env.MEW1A_CANARY_WEIGHT || '0.0');

const VLLM_TIMEOUT = parseInt(process.env.VLLM_TIMEOUT || '30000'); // 30 seconds

/**
 * Simple string hash function for consistent routing
 */
function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

/**
 * Get Mew-1A endpoint based on canary weight and optional user identifier
 *
 * @param userId - Optional user ID for sticky routing (same user always gets same variant)
 * @returns Selected endpoint URL
 */
function getMew1aEndpoint(userId?: string): { endpoint: string; variant: 'stable' | 'canary' } {
  // Weight = 0: always stable (default)
  if (MEW1A_CANARY_WEIGHT <= 0) {
    return { endpoint: MEW1A_STABLE_ENDPOINT, variant: 'stable' };
  }

  // Weight = 1: always canary (full cutover)
  if (MEW1A_CANARY_WEIGHT >= 1) {
    return { endpoint: MEW1A_CANARY_ENDPOINT, variant: 'canary' };
  }

  // Sticky routing: hash userId if available, else random per request
  const hash = userId ? simpleHash(userId) % 100 : Math.floor(Math.random() * 100);
  const useCanary = hash < (MEW1A_CANARY_WEIGHT * 100);

  return {
    endpoint: useCanary ? MEW1A_CANARY_ENDPOINT : MEW1A_STABLE_ENDPOINT,
    variant: useCanary ? 'canary' : 'stable'
  };
}

// =============================================================================
// CORE CLIENT
// =============================================================================

/**
 * Analyze a Pokemon card using vLLM-powered Mew-1A
 *
 * @param request - Card analysis request
 * @returns Analysis with recommendation and timing metrics
 *
 * @example
 * const result = await vllmAnalyzeCard({
 *   cardName: "Charizard ex",
 *   setName: "Obsidian Flames",
 *   listedPrice: 45.0,
 *   fairValue: 52.0
 * });
 *
 * console.log(result.recommendation); // "BUY"
 * console.log(result.inferenceTime);  // 1.2s (vs 4.5s with transformers)
 */
export async function vllmAnalyzeCard(
  request: VLLMAnalysisRequest
): Promise<VLLMAnalysisResponse> {
  const startTime = Date.now();

  // Select endpoint based on canary weight and userId (if provided)
  const { endpoint, variant } = getMew1aEndpoint(request.userId);

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Mew1A-Variant': variant,                      // For observability in logs/metrics
      },
      body: JSON.stringify({
        card_name: request.cardName,
        set_name: request.setName || '',
        listed_price: request.listedPrice || 0.0,
        fair_value: request.fairValue || 0.0,
        max_tokens: request.maxTokens || 200,
      }),
      signal: AbortSignal.timeout(VLLM_TIMEOUT),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`vLLM API error (${response.status}): ${errorText}`);
    }

    const data = await response.json();

    return {
      card: data.card,
      set: data.set,
      analysis: data.explanation || data.analysis,  // v4.3-shaped uses 'explanation', fallback to 'analysis'
      headline: data.headline,                       // New field from v4.3-shaped response shaping
      recommendation: data.recommendation,
      tokens: data.tokens,
      inferenceTime: data.inference_time,
      tokensPerSecond: data.tokens_per_second,
      totalTime: data.total_time,
    };
  } catch (error) {
    const elapsed = Date.now() - startTime;

    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`vLLM timeout after ${elapsed}ms (limit: ${VLLM_TIMEOUT}ms)`);
    }

    throw new Error(`vLLM inference failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Raw vLLM generation (for custom prompts)
 *
 * @param request - Generation request with custom prompt
 * @returns Generated text with metrics
 *
 * @example
 * const result = await vllmGenerate({
 *   prompt: "Below is an instruction...\n### Instruction:\nAnalyze Pikachu\n### Response:\n",
 *   maxTokens: 150,
 *   temperature: 0.3
 * });
 */
export async function vllmGenerate(
  request: VLLMGenerateRequest
): Promise<VLLMGenerateResponse> {
  const startTime = Date.now();

  // Select endpoint based on canary weight and userId (if provided)
  const { endpoint: analyzeEndpoint, variant } = getMew1aEndpoint(request.userId);

  try {
    // Note: For raw generation, we need to call the model's generate method
    // This assumes you've deployed a separate /generate endpoint
    const generateEndpoint = analyzeEndpoint.replace('/analyze', '/generate');

    const response = await fetch(generateEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Mew1A-Variant': variant,                      // For observability in logs/metrics
      },
      body: JSON.stringify({
        prompt: request.prompt,
        max_tokens: request.maxTokens || 200,
        temperature: request.temperature || 0.3,
        top_p: request.topP || 0.9,
      }),
      signal: AbortSignal.timeout(VLLM_TIMEOUT),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`vLLM generate error (${response.status}): ${errorText}`);
    }

    const data = await response.json();

    return {
      response: data.response,
      tokens: data.tokens,
      inferenceTime: data.inference_time,
      tokensPerSecond: data.tokens_per_second,
    };
  } catch (error) {
    const elapsed = Date.now() - startTime;

    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`vLLM timeout after ${elapsed}ms (limit: ${VLLM_TIMEOUT}ms)`);
    }

    throw new Error(`vLLM generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Build Mew-1A instruction prompt manually
 *
 * Useful for testing or custom prompts
 *
 * @param instruction - The instruction text
 * @param input - Optional input context (rarely used for Mew-1A)
 * @returns Formatted prompt ready for vllmGenerate()
 */
export function buildMew1APrompt(instruction: string, input?: string): string {
  if (input) {
    return `Below is an instruction that describes a task, paired with an input that provides further context. Write a response that appropriately completes the request.

### Instruction:
${instruction}

### Input:
${input}

### Response:
`;
  } else {
    return `Below is an instruction that describes a task. Write a response that appropriately completes the request.

### Instruction:
${instruction}

### Response:
`;
  }
}

/**
 * Health check for vLLM endpoint
 *
 * @returns true if endpoint is healthy, false otherwise
 */
export async function vllmHealthCheck(): Promise<boolean> {
  try {
    // Simple test with minimal card analysis
    const result = await vllmAnalyzeCard({
      cardName: "Pikachu",
      maxTokens: 50,
    });

    // Check if we got a valid response
    return result.analysis.length > 0 && result.tokens > 0;
  } catch (error) {
    console.error('vLLM health check failed:', error);
    return false;
  }
}

/**
 * Get performance metrics for vLLM vs transformers comparison
 *
 * @param cardName - Test card
 * @param iterations - Number of test runs
 * @returns Average metrics across iterations
 */
export async function vllmBenchmark(
  cardName: string = "Charizard ex",
  iterations: number = 5
): Promise<{
  avgInferenceTime: number;
  avgTokensPerSecond: number;
  minInferenceTime: number;
  maxInferenceTime: number;
}> {
  const results: number[] = [];
  const tpsResults: number[] = [];

  for (let i = 0; i < iterations; i++) {
    const result = await vllmAnalyzeCard({
      cardName,
      setName: "Test Set",
      listedPrice: 50.0,
      fairValue: 60.0,
      maxTokens: 150,
    });

    results.push(result.inferenceTime);
    tpsResults.push(result.tokensPerSecond);
  }

  return {
    avgInferenceTime: results.reduce((a, b) => a + b, 0) / results.length,
    avgTokensPerSecond: tpsResults.reduce((a, b) => a + b, 0) / tpsResults.length,
    minInferenceTime: Math.min(...results),
    maxInferenceTime: Math.max(...results),
  };
}

// =============================================================================
// EXPORT DEFAULT CLIENT
// =============================================================================

export default {
  analyzeCard: vllmAnalyzeCard,
  generate: vllmGenerate,
  buildPrompt: buildMew1APrompt,
  healthCheck: vllmHealthCheck,
  benchmark: vllmBenchmark,
};
