// Minimal harmless pipeline: format a sample opportunity and hit the X dry-run layer.
// Swap to real steps in future iterations.
import { findFreshListings } from './steps/01_fetch';
import { normalizeListings } from './steps/02_normalize';
import { attachComps } from './steps/03_features';
import { detectCandidates } from './steps/04_signal';
import { validateAndPersist } from './steps/05_validate';
import { stageAndMaybePost } from './steps/06_output';

export async function runAgentTick() {
  const listings = await findFreshListings();
  const norm = await normalizeListings(listings);
  const withComps = await attachComps(norm);
  const cands = detectCandidates(withComps);
  const kept = await validateAndPersist(cands);
  await stageAndMaybePost(kept);
}
