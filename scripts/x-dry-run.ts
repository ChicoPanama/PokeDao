import { formatOpportunityThread } from '../packages/social/x/post';
import { postThread } from '../packages/social/x/client';

async function main() {
  const sample = {
    cardTitle: 'Charizard (Base Set) #4 Holo, Raw vs PSA 9 comps',
    spreadPct: 18.6,
    buyUrl: 'https://example.com/listing/charizard-raw',
    sellCompUrl: 'https://example.com/comps/charizard-psa9',
    rationale:
      'Raw listings lag graded comps during weekend volume spikes; multiple raws listed below 7d median while PSA 9 comps held flat.',
    risks: ['Condition variance on raw card', 'Fee changes / shipping drift', 'Listing cancellation risk'],
    timeWindow: 'Next 24–72h',
  } as const;

  const lines = formatOpportunityThread(sample);
  const res = await postThread(lines);
  console.log('Dry-run result:', res);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

