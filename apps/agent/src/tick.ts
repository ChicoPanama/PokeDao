import 'dotenv/config';

export async function runAgentTick() {
  const SMOKE = process.env.AGENT_SMOKE_ONLY === 'true';

  if (SMOKE) {
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
    return;
  }

  const { findFreshListings } = await import('./steps/01_fetch.js');
  const { normalizeListings } = await import('./steps/02_normalize.js');
  const { attachComps } = await import('./steps/03_features.js');
  const { detectCandidates } = await import('./steps/04_signal.js');
  const { validateAndPersist } = await import('./steps/05_validate.js');
  const { stageAndMaybePost } = await import('./steps/06_output.js');

  const listings = await findFreshListings();
  const norm = await normalizeListings(listings);
  const withComps = await attachComps(norm);
  const cands = detectCandidates(withComps);
  const kept = await validateAndPersist(cands);
  await stageAndMaybePost(kept);
}
