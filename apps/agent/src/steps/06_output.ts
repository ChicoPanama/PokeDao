// For Step 3 we just prepare strings and call the X dry-run layer.
import { postThread } from '../../../../packages/social/x/client';
import { formatOpportunityThread } from '../../../../packages/social/x/post';
import type { OpportunityCandidate } from './04_signal';

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
}

