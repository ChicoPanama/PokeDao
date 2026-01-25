import 'dotenv/config';
import { agentTracer, withSpan } from '../../../packages/shared/tracing.js';

export async function runAgentTick() {
  return withSpan(agentTracer, 'tick', async (tickSpan) => {
    const SMOKE = process.env.AGENT_SMOKE_ONLY === 'true';
    tickSpan.setAttribute('smoke_mode', SMOKE);

    if (SMOKE) {
      tickSpan.addEvent('smoke_test_start');
      const { postThread } = await import('../../../packages/social/x/client.js');
      const { formatOpportunityThread } = await import('../../../packages/social/x/post.js');

      const sample = {
        cardTitle: 'Pikachu (Jungle) #60 – Raw vs PSA 9 comps',
        spreadPct: 16.2,
        buyUrl: 'https://example.com/listing/pikachu-raw',
        sellCompUrl: 'https://example.com/comps/pikachu-psa9',
        rationale:
          'Weekend lags on raw while graded comps hold steady; left-tail raw listings are under the 7-day median.',
        risks: ['Condition variance', 'Listing cancellation', 'Fee drift'],
        timeWindow: 'Next 24–72h',
      } as const;

      const lines = formatOpportunityThread(sample);
      await postThread(lines);
      tickSpan.addEvent('smoke_test_complete');
      return;
    }

    const { findFreshListings } = await import('./steps/01_fetch.js');
    const { normalizeListings } = await import('./steps/02_normalize.js');
    const { attachComps } = await import('./steps/03_features.js');
    const { detectCandidatesWithAI } = await import('./steps/04_signal.js');
    const { validateAndPersist } = await import('./steps/05_validate.js');
    const { stageAndMaybePost } = await import('./steps/06_output.js');

    // Step 1: Fetch
    const listings = await withSpan(agentTracer, 'fetch', async (span) => {
      const result = await findFreshListings();
      span.setAttribute('listing_count', result.length);
      return result;
    });

    // Step 2: Normalize
    const norm = await withSpan(agentTracer, 'normalize', async (span) => {
      const result = await normalizeListings(listings);
      span.setAttribute('normalized_count', result.length);
      return result;
    });

    // Step 3: Attach comps
    const withComps = await withSpan(agentTracer, 'attach_comps', async (span) => {
      const result = await attachComps(norm);
      span.setAttribute('with_comps_count', result.length);
      return result;
    });

    // Step 4: Detect candidates (with optional AI thesis generation)
    const cands = await withSpan(agentTracer, 'detect_candidates', async (span) => {
      const result = await detectCandidatesWithAI(withComps);
      span.setAttribute('candidate_count', result.length);
      span.setAttribute('ai_thesis_enabled', process.env.AI_THESIS_ENABLED === 'true');
      return result;
    });

    // Step 5: Validate and persist
    const kept = await withSpan(agentTracer, 'validate_persist', async (span) => {
      const result = await validateAndPersist(cands);
      span.setAttribute('kept_count', result.length);
      return result;
    });

    // Step 6: Stage and maybe post
    await withSpan(agentTracer, 'stage_output', async () => {
      await stageAndMaybePost(kept);
    });

    tickSpan.setAttribute('total_signals', kept.length);

    // Send Telegram alerts for new signals
    const TELEGRAM_ENABLED = process.env.TELEGRAM_ALERTS_ENABLED === 'true';
    if (TELEGRAM_ENABLED) {
      await withSpan(agentTracer, 'telegram_alerts', async (span) => {
        try {
          const { processAlerts, checkWatchlistPriceDrops } = await import('../../../ml/src/alertSystem.js');
          await processAlerts();
          await checkWatchlistPriceDrops();
          span.addEvent('alerts_sent');
        } catch (e: any) {
          span.setStatus('error', e?.message || String(e));
          console.error('[agent] Telegram alert error:', e?.message || e);
        }
      });
    }
  });
}
