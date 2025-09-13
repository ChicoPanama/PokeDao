export type ParsedTitle = {
  setCode: string;
  number: string;
  language: 'EN'|'JP'|'DE'|'FR'|'ES'|'IT'|'PT'|'ZH';
  edition?: '1st'|'Unlimited';
  foil?: 'Holo'|'Reverse'|'NonHolo';
  grade?: string;
  confidence: number; // 0..1
};

const SYS = `You extract Pokémon TCG listing fields. Output strict JSON:
{"setCode":string,"number":string,"language":"EN"|"JP"|"DE"|"FR"|"ES"|"IT"|"PT"|"ZH","edition":"1st"|"Unlimited"|null,"foil":"Holo"|"Reverse"|"NonHolo"|null,"grade":string|null,"confidence":0..1}
Rules: prefer EN unless clearly stated; do not invent set codes; if unsure, set confidence<=0.5. JSON only.`;

export async function parseTitleWithQwen(title: string): Promise<ParsedTitle|null> {
  const baseUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
  const model = process.env.QWEN_MODEL || 'qwen2.5:7b-instruct';
  try {
    const res = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: SYS },
          { role: 'user', content: title },
        ],
        options: { temperature: 0.2 },
        stream: false,
      }),
    });
    if (!res.ok) throw new Error(String(res.status));
    const json = await res.json();
    const content = String(json?.message?.content || '').trim().replace(/^```json\s*/i, '').replace(/```$/,'');
    const out = JSON.parse(content);
    if (!out?.setCode || !out?.number) return null;
    return {
      setCode: String(out.setCode),
      number: String(out.number),
      language: (out.language || 'EN').toUpperCase(),
      edition: out.edition || undefined,
      foil: out.foil || undefined,
      grade: out.grade || undefined,
      confidence: Math.max(0, Math.min(1, Number(out.confidence ?? 0))),
    } as ParsedTitle;
  } catch {
    return null;
  }
}

export function parseTitleFallback(title: string): ParsedTitle|null {
  const t = title.toUpperCase();
  const language = /JAP|JP/.test(t) ? 'JP' : 'EN';
  const edition = /(1ST|FIRST)/.test(t) ? '1st' : 'Unlimited';
  const foil = /REVERSE/.test(t) ? 'Reverse' : /HOLO/.test(t) ? 'Holo' : 'NonHolo';
  const numberMatch = t.match(/#?\s?(\d{1,3})\b/);
  const number = numberMatch ? numberMatch[1] : '';
  const setMatch = t.match(/\b(SV[0-9A-Z]+|SWSH\d+|BASE|JUNGLE|FOSSIL|NEO|EVOLVING|OBSIDIAN|PALDEA)\b/);
  const setCode = setMatch ? setMatch[1] : 'SV';
  if (!number) return null;
  return { setCode, number, language: language as any, edition: edition as any, foil: foil as any, confidence: 0.4 };
}

