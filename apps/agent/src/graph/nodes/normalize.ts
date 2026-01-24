/**
 * Normalize Node
 *
 * Step 2: Normalizes raw listings into canonical format.
 */

import type { AgentStateType, NormalizedListing, PipelineError } from '../state.js';

export async function normalizeNode(
  state: AgentStateType
): Promise<Partial<AgentStateType>> {
  const startTime = Date.now();

  if (state.listings.length === 0) {
    return {
      normalized: [],
      metrics: {
        normalize_count: 0,
        normalize_duration_ms: 0,
      },
    };
  }

  try {
    // Import the existing normalize step
    const { normalizeListings } = await import('../../steps/02_normalize.js');

    const rawNormalized = await normalizeListings(state.listings as any);

    // Map to our typed format
    const normalized: NormalizedListing[] = rawNormalized.map((n: any) => ({
      listingId: n.listingId || n.id,
      canonicalCardId: n.canonicalCardId,
      cardName: n.cardName,
      setName: n.setName,
      cardNumber: n.cardNumber,
      variant: n.variant,
      grade: n.grade,
      gradeCompany: n.gradeCompany,
      priceCents: n.priceCents,
      source: n.source,
      url: n.url,
      dataQuality: n.dataQuality ?? 0.5,
    }));

    const durationMs = Date.now() - startTime;

    return {
      normalized,
      metrics: {
        normalize_count: normalized.length,
        normalize_duration_ms: durationMs,
        normalize_drop_rate: 1 - normalized.length / state.listings.length,
      },
    };
  } catch (error: any) {
    const pipelineError: PipelineError = {
      step: 'normalize',
      message: error?.message || String(error),
      timestamp: new Date(),
      recoverable: true,
    };

    return {
      normalized: [],
      errors: [pipelineError],
      metrics: {
        normalize_count: 0,
        normalize_duration_ms: Date.now() - startTime,
        normalize_error: 1,
      },
    };
  }
}
