/**
 * Signal Node
 *
 * Step 4: Detects trading signal candidates from listings with comps.
 */

import type { AgentStateType, SignalCandidate, PipelineError } from '../state.js';

export async function signalNode(
  state: AgentStateType
): Promise<Partial<AgentStateType>> {
  const startTime = Date.now();

  if (state.withComps.length === 0) {
    return {
      candidates: [],
      metrics: {
        signal_count: 0,
        signal_duration_ms: 0,
      },
    };
  }

  try {
    // Import the existing signal step
    const { detectCandidates } = await import('../../steps/04_signal.js');

    const rawCandidates = detectCandidates(state.withComps as any);

    // Map to our typed format
    const candidates: SignalCandidate[] = rawCandidates.map((c: any) => ({
      listing: c.listing || c,
      edgeBp: c.edgeBp ?? c.spreadBp ?? 0,
      confidence: c.confidence ?? 0.5,
      thesis: c.thesis || c.rationale || '',
      risks: c.risks || [],
    }));

    const durationMs = Date.now() - startTime;

    return {
      candidates,
      metrics: {
        signal_count: candidates.length,
        signal_duration_ms: durationMs,
        signal_avg_edge: candidates.length > 0
          ? candidates.reduce((sum, c) => sum + c.edgeBp, 0) / candidates.length
          : 0,
      },
    };
  } catch (error: any) {
    const pipelineError: PipelineError = {
      step: 'signal',
      message: error?.message || String(error),
      timestamp: new Date(),
      recoverable: true,
    };

    return {
      candidates: [],
      errors: [pipelineError],
      metrics: {
        signal_count: 0,
        signal_duration_ms: Date.now() - startTime,
        signal_error: 1,
      },
    };
  }
}
