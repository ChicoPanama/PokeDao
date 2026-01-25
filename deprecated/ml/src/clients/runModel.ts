type RunModelOpts = {
  provider: 'ollama';
  prompt: string;
  model?: string;
  system?: string;
  temperature?: number;
  baseUrl?: string; // for ollama
  options?: Record<string, any>;
};

export async function runModel(opts: RunModelOpts): Promise<string> {
  const { provider, prompt } = opts;
  if (!prompt || !prompt.trim()) throw new Error('runModel: prompt required');

  if (provider === 'ollama') {
    const baseUrl = opts.baseUrl || process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
    const model = opts.model || process.env.OLLAMA_MODEL || process.env.QWEN_MODEL || 'llama3.1:8b';
    const options = { temperature: opts.temperature ?? 0.2, ...(opts.options || {}) } as any;
    const topLevel: any = {};
    if (options.format) {
      topLevel.format = options.format; // some ollama builds expect top-level format for JSON mode
      delete options.format;
    }
    const res = await fetch(`${baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        prompt,
        system: opts.system || undefined,
        options,
        stream: false,
        ...topLevel,
      }),
    });
    if (!res.ok) throw new Error(`ollama ${res.status} ${res.statusText}`);
    const json = await res.json();
    return String(json?.response ?? '').trim();
  }

  throw new Error(`runModel: unsupported provider ${provider}`);
}
