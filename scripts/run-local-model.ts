// Quick free-form test against local Ollama
const prompt = process.argv.slice(2).join(' ') || 'Say hello in one short sentence.';
(async () => {
  const { runModel } = await import(new URL('../ml/src/clients/runModel.ts', import.meta.url).toString());
  const text = await runModel({
    provider: 'ollama',
    prompt,
    model: process.env.OLLAMA_MODEL || process.env.QWEN_MODEL || 'qwen2.5:7b-instruct',
  });
  console.log(text.trim());
})();
