import { scoreListingsPaper } from '../worker/src/scorer.ts';
(async () => {
  const res = await scoreListingsPaper({ limit: 500 });
  console.log('[scorer]', res);
})();

