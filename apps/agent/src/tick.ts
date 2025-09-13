// Minimal harmless pipeline: format a sample opportunity and hit the X dry-run layer.
// Swap to real steps in future iterations.
import { postThread } from '../../../packages/social/x/client';
import { formatOpportunityThread } from '../../../packages/social/x/post';

export async function runAgentTick() {
  const sample = {
    cardTitle: 'Pikachu (Jungle) #60, Raw vs PSA 9 comps',
    spreadPct: 16.2,
    buyUrl: 'https://example.com/listing/pikachu-raw',
    sellCompUrl: 'https://example.com/comps/pikachu-psa9',
    rationale: 'Weekend lags on raw; comps holding flat week-over-week.',
    risks: ['Condition variance', 'Listing cancellation', 'Fee drift'],
    timeWindow: 'Next 24–72h',
  } as const;

  const lines = formatOpportunityThread(sample);
  await postThread(lines); // with POSTING_DRY_RUN=true this only logs
}

// Allow direct execution for one-off testing
if (import.meta.url === `file://${process.argv[1]}`) {
  runAgentTick().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

