export async function ollamaChatJSON({
  baseUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
  model = process.env.QWEN_MODEL || 'qwen2.5:7b-instruct',
  system,
  user,
}: { baseUrl?: string; model?: string; system: string; user: string }) {
  const res = await fetch(`${baseUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      options: { temperature: 0.2 },
      stream: false,
    }),
  });
  if (!res.ok) throw new Error(`ollama ${res.status} ${res.statusText}`);
  const json = await res.json();
  const content = json?.message?.content || '';
  const cleaned = String(content).trim().replace(/^```json\s*/i, '').replace(/```$/,'');
  return JSON.parse(cleaned);
}

