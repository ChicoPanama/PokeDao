// Ask for JSON-only, then validate with your ReasonedSignal schema

const userPayload = process.argv[2]
  ? JSON.parse(process.argv[2])
  : {
      figures: { edgeBp: 800, confidence: 0.62 },
      features: { volatilityBp: 950, volume: 6 },
      listing: { freshDays: 3, priceCentsUsd: 125000 },
    };

const SYSTEM = `You are "Pokedex", a veteran Pokémon TCG trader.
Output JSON ONLY with keys: edgeBp(int), confidence(0..1), thesis(string<=240), drivers(array<string>),
flags:{staleComps,highVolatility,lowLiquidity}.
Two sentences max, trader tone, no fluff. Do not invent numbers.`;

const FEWSHOTS = [
  `{"edgeBp":740,"confidence":0.63,"thesis":"Ask sits below converging US/EU anchors; seller A+ with low ship, demand warm.","drivers":["Anchors align","Seller risk low","Seasonality tailwind"],"flags":{"staleComps":false,"highVolatility":false,"lowLiquidity":false}}`,
  `{"edgeBp":820,"confidence":0.58,"thesis":"Price beats 30d median; auction interest strong; watch pop supports entry.","drivers":["Below 30d median","Auction momentum","NHI high"],"flags":{"staleComps":false,"highVolatility":true,"lowLiquidity":false}}`,
].join('\n');

(async () => {
  const [{ runModel }, { ReasonedSignal }] = await Promise.all([
    import(new URL('../ml/src/clients/runModel.ts', import.meta.url).toString()),
    import(new URL('../ml/schemas/reasonedSignal.ts', import.meta.url).toString()),
  ]);
  const prompt = `${SYSTEM}\n\nINPUT:\n${JSON.stringify(userPayload)}\n\nEXAMPLES:\n${FEWSHOTS}\n\nReturn JSON only.`;

  const raw = await runModel({
    provider: 'ollama',
    prompt,
    model: process.env.OLLAMA_MODEL || process.env.QWEN_MODEL || 'qwen2.5:7b-instruct',
  });

  // strip accidental code fences/newlines
  const text = raw.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  let parsed;
  try {
    parsed = ReasonedSignal.parse(JSON.parse(text));
  } catch (e: any) {
    console.error('[json-validate] schema error:', e?.message || e);
    process.exit(1);
  }
  console.log('[json-validate] OK\n', JSON.stringify(parsed, null, 2));
})();
