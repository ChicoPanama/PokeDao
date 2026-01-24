/**
 * Validate Node
 *
 * Step 5: Validates signal candidates and persists to database.
 */

import type { AgentStateType, ValidatedSignal, PipelineError } from '../state.js';

export async function validateNode(
  state: AgentStateType
): Promise<Partial<AgentStateType>> {
  const startTime = Date.now();

  if (state.candidates.length === 0) {
    return {
      validated: [],
      metrics: {
        validate_count: 0,
        validate_duration_ms: 0,
      },
    };
  }

  try {
    // Import the existing validate step
    const { validateAndPersist } = await import('../../steps/05_validate.js');

    const rawValidated = await validateAndPersist(state.candidates as any);

    // Map to our typed format
    const validated: ValidatedSignal[] = rawValidated.map((v: any) => ({
      id: v.id,
      cardId: v.cardId,
      listingId: v.listingId || v.marketListingId,
      edgeBp: v.edgeBp,
      confidence: v.confidence,
      thesis: v.thesis,
      status: v.status || 'ACTIVE',
      createdAt: new Date(v.createdAt),
    }));

    const durationMs = Date.now() - startTime;

    return {
      validated,
      metrics: {
        validate_count: validated.length,
        validate_duration_ms: durationMs,
        validate_pass_rate: validated.length / state.candidates.length,
      },
    };
  } catch (error: any) {
    const pipelineError: PipelineError = {
      step: 'validate',
      message: error?.message || String(error),
      timestamp: new Date(),
      recoverable: false,
    };

    return {
      validated: [],
      errors: [pipelineError],
      metrics: {
        validate_count: 0,
        validate_duration_ms: Date.now() - startTime,
        validate_error: 1,
      },
    };
  }
}
