import { featurizeTouchedCards } from '../worker/src/featurizer.ts';
(async () => {
  const res = await featurizeTouchedCards({ sinceHours: 720 });
  console.log('[featurizer]', res);
})();

