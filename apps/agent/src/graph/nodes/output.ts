/**
 * Output Node
 *
 * Step 6: Stages outputs for posting and sends alerts.
 */

import type { AgentStateType, PipelineError } from '../state.js';

export async function outputNode(
  state: AgentStateType
): Promise<Partial<AgentStateType>> {
  const startTime = Date.now();

  if (state.validated.length === 0) {
    return {
      alertsSent: 0,
      postsQueued: 0,
      metrics: {
        output_duration_ms: 0,
      },
    };
  }

  try {
    // Import the existing output step
    const { stageAndMaybePost } = await import('../../steps/06_output.js');

    await stageAndMaybePost(state.validated as any);

    // Send Telegram alerts if enabled
    let alertsSent = 0;
    const TELEGRAM_ENABLED = process.env.TELEGRAM_ALERTS_ENABLED === 'true';

    if (TELEGRAM_ENABLED) {
      try {
        // Dynamic import to avoid TypeScript resolution issues
        const alertPath = '../../../../../ml/src/alertSystem.js';
        const alertModule: any = await import(alertPath);
        await alertModule.processAlerts();
        await alertModule.checkWatchlistPriceDrops();
        alertsSent = state.validated.length;
      } catch (alertError: any) {
        console.error('[output] Alert error:', alertError?.message);
      }
    }

    const durationMs = Date.now() - startTime;

    return {
      alertsSent,
      postsQueued: state.validated.length,
      metrics: {
        output_alerts_sent: alertsSent,
        output_posts_queued: state.validated.length,
        output_duration_ms: durationMs,
      },
    };
  } catch (error: any) {
    const pipelineError: PipelineError = {
      step: 'output',
      message: error?.message || String(error),
      timestamp: new Date(),
      recoverable: true,
    };

    return {
      alertsSent: 0,
      postsQueued: 0,
      errors: [pipelineError],
      metrics: {
        output_duration_ms: Date.now() - startTime,
        output_error: 1,
      },
    };
  }
}
