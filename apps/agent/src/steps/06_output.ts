// For Step 3 we just prepare strings and call the X dry-run layer.
import { postThread } from '../../../../packages/social/x/client.js';
import { formatOpportunityThread } from '../../../../packages/social/x/post.js';
import { postQueue } from '../queues.js';
import type { OpportunityCandidate } from './04_signal.js';

export async function stageAndMaybePost(cands: OpportunityCandidate[]) {
  if (cands.length === 0) return;
  const top = [...cands].sort((a, b) => b.netSpreadBps - a.netSpreadBps || b.confidence - a.confidence)[0];

  const lines = formatOpportunityThread({
    cardTitle: top.cardId, // replace with a human-readable title if available
    spreadPct: top.netSpreadBps / 100,
    buyUrl: top.url || 'https://example.com',
    sellCompUrl: undefined,
    rationale: top.rationale,
    risks: ['Condition variance', 'Fee drift', 'Listing cancellation'],
    timeWindow: 'Next 24–72h',
  });

  await postThread(lines); // dry-run by default

  // Flash alerts for very strong opportunities
  const flashEnabled = process.env.FLASH_ENABLED !== 'false';
  const minBps = Number(process.env.FLASH_MIN_SPREAD_BPS || 2000);
  const minConf = Number(process.env.FLASH_MIN_CONFIDENCE || 0.7);
  if (flashEnabled && top.netSpreadBps >= minBps && top.confidence >= minConf) {
    try {
      await postQueue.add(
        'flash',
        { kind: 'flash', lines },
        { removeOnComplete: 100, removeOnFail: 100 }
      );
      console.log('[post] flash enqueued');
    } catch (e) {
      console.warn('[post] flash enqueue failed', e);
    }
  }
}
