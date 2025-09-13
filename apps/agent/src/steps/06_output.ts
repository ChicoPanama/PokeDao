// Still does the X dry-run post for visibility.
import { postThread } from '../../../../packages/social/x/client.js';
import { formatOpportunityThread } from '../../../../packages/social/x/post.js';
import { cardTitleForTweet } from '../pipelines/title.js';
import { postQueue } from '../queues.js';
import type { OpportunityCandidate } from './04_signal.js';

export async function stageAndMaybePost(cands: OpportunityCandidate[]) {
  if (process.env.AGENT_DEBUG === 'true') {
    console.log(`[dbg][06_output] candsIn=${cands.length}`);
  }
  if (cands.length === 0) return;

  const top = cands.sort((a,b) => b.netSpreadBps - a.netSpreadBps || b.confidence - a.confidence)[0];

  const cardTitle = await cardTitleForTweet(top.cardId);

  const lines = formatOpportunityThread({
    cardTitle,
    spreadPct: top.netSpreadBps / 100,
    buyUrl: top.url || 'https://example.com',
    sellCompUrl: undefined,
    rationale: top.rationale,
    risks: ['Condition variance', 'Fee drift', 'Listing cancellation'],
    timeWindow: 'Next 24–72h',
  });

  const LIVE = process.env.POSTING_ENABLED === 'true' && process.env.POSTING_DRY_RUN === 'false';

  // Always emit dry-run output for observability
  if (!LIVE) {
    if (process.env.AGENT_DEBUG === 'true') {
      console.log(`[dbg][06_output] dry-run post id=${top.id} cardId=${top.cardId} spreadBp=${top.netSpreadBps}`);
    }
    await postThread(lines);
  }

  // In live mode, enqueue a flash job with stable jobId to dedupe
  const flashEnabled = process.env.FLASH_ENABLED !== 'false';
  const minBps = Number(process.env.FLASH_MIN_SPREAD_BPS || 2000);
  const minConf = Number(process.env.FLASH_MIN_CONFIDENCE || 0.7);
  if (LIVE && flashEnabled && top.netSpreadBps >= minBps && top.confidence >= minConf) {
    const jobId = `flash:${top.id}`;
    await postQueue.add(
      'flash',
      { kind: 'flash', listingId: top.id, lines },
      { jobId, removeOnComplete: 200, removeOnFail: 1000 },
    );
    if (process.env.AGENT_DEBUG === 'true') {
      console.log('[dbg][06_output] flash enqueued', jobId);
    }
  }
}
