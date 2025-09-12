import { ingestPokemonTCG } from '../worker/src/ingestors/pokemon-tcg.ts';
(async () => {
  const res = await ingestPokemonTCG({ pageSize: 200, pages: 2 });
  console.log('[ingestPokemonTCG]', res);
})();

