// Still does the X dry-run post for visibility.
import { postThread } from '../../../../packages/social/x/client.js';
import { formatOpportunityThread } from '../../../../packages/social/x/post.js';
import type { OpportunityCandidate } from './04_signal.js';

export async function stageAndMaybePost(cands: OpportunityCandidate[]) {
  if (process.env.AGENT_DEBUG === 'true') {
    console.log(`[dbg][06_output] candsIn=${cands.length}`);
  }
  if (cands.length === 0) return;

  const top = cands.sort((a,b) => b.netSpreadBps - a.netSpreadBps || b.confidence - a.confidence)[0];

  const lines = formatOpportunityThread({
    cardTitle: top.cardId, // replace with human-readable if available
    spreadPct: top.netSpreadBps / 100,
    buyUrl: top.url || 'https://example.com',
    sellCompUrl: undefined,
    rationale: top.rationale,
    risks: ['Condition variance', 'Fee drift', 'Listing cancellation'],
    timeWindow: 'Next 24–72h',
  });

  if (process.env.AGENT_DEBUG === 'true') {
    console.log(`[dbg][06_output] posting candidate id=${top.id} cardId=${top.cardId} spreadBp=${top.netSpreadBps}`);
  }
  await postThread(lines); // dry-run by default
}
