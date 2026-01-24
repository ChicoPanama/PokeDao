/**
 * Features Node
 *
 * Step 3: Attaches comparable sales (comps) to normalized listings.
 */

import type { AgentStateType, ListingWithComps, PipelineError } from '../state.js';

export async function featuresNode(
  state: AgentStateType
): Promise<Partial<AgentStateType>> {
  const startTime = Date.now();

  if (state.normalized.length === 0) {
    return {
      withComps: [],
      metrics: {
        features_count: 0,
        features_duration_ms: 0,
      },
    };
  }

  try {
    // Import the existing features step
    const { attachComps } = await import('../../steps/03_features.js');

    const rawWithComps = await attachComps(state.normalized as any);

    // Map to our typed format
    const withComps: ListingWithComps[] = rawWithComps.map((w: any) => ({
      ...w,
      comps: (w.comps || []).map((c: any) => ({
        id: c.id,
        priceCents: c.priceCents,
        soldAt: new Date(c.soldAt),
        source: c.source,
        grade: c.grade,
      })),
      medianCompCents: w.medianCompCents,
      compCount: w.comps?.length ?? 0,
    }));

    const durationMs = Date.now() - startTime;
    const withCompsCount = withComps.filter((w) => w.compCount > 0).length;

    return {
      withComps,
      metrics: {
        features_count: withComps.length,
        features_with_comps: withCompsCount,
        features_duration_ms: durationMs,
      },
    };
  } catch (error: any) {
    const pipelineError: PipelineError = {
      step: 'features',
      message: error?.message || String(error),
      timestamp: new Date(),
      recoverable: true,
    };

    return {
      withComps: [],
      errors: [pipelineError],
      metrics: {
        features_count: 0,
        features_duration_ms: Date.now() - startTime,
        features_error: 1,
      },
    };
  }
}
