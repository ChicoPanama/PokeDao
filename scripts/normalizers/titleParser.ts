import { ollamaChatJSON } from '../../ml/src/clients/ollama';
import { runModel } from '../../ml/src/clients/runModel.ts';
import { PrismaClient } from '@prisma/client';
import { getCachedParse, putCachedParse } from '../../packages/shared/titleCache.ts';

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
  try {
    const out = await ollamaChatJSON({ system: SYS, user: title });
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

function stripFences(s: string) {
  return String(s || '').trim().replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
}

const prisma = new PrismaClient();
const MIN_CONF = Number(process.env.TITLE_CACHE_MIN_CONF ?? 0.65);

export async function parseTitleWithModel(title: string): Promise<ParsedTitle | null> {
  // Cache hit fast-path
  try {
    const cached = await getCachedParse(prisma, title);
    if (cached && cached.confidence >= MIN_CONF) {
      return {
        setCode: cached.setCode,
        number: cached.number,
        language: (cached.language || 'EN').toUpperCase() as any,
        confidence: cached.confidence,
      } as ParsedTitle;
    }
  } catch {}

  const system = `You extract Pokémon TCG listing fields. Output strict JSON:
{"setCode":string,"number":string,"language":"EN"|"JP"|"DE"|"FR"|"ES"|"IT"|"PT"|"ZH","edition":"1st"|"Unlimited"|null,"foil":"Holo"|"Reverse"|"NonHolo"|null,"grade":string|null,"confidence":0..1}
Rules: prefer EN unless clearly stated; do not invent set codes; if unsure, set confidence<=0.5. JSON only.`;
  const fewshots = [
    '{"setCode":"sv1","number":"15","language":"EN","edition":null,"foil":"Holo","grade":null,"confidence":0.95}',
    '{"setCode":"fossil","number":"020","language":"EN","edition":null,"foil":"Holo","grade":null,"confidence":0.9}'
  ].join('\n');
  const prompt = `${system}\n\nTitle: ${title}\nExamples:\n${fewshots}\n\nJSON:`;
  try {
    const raw = await runModel({
      provider: 'ollama',
      prompt,
      model: process.env.OLLAMA_MODEL || process.env.QWEN_MODEL || 'qwen2.5:7b-instruct',
      options: { format: 'json', temperature: 0.1, top_p: 0.9, num_predict: 128 },
    });
    const cleaned = stripFences(raw);
    const out = JSON.parse(cleaned || '{}');
    if (!out?.setCode || !out?.number) return null;
    const parsed = {
      setCode: String(out.setCode),
      number: String(out.number),
      language: (out.language || 'EN').toUpperCase(),
      edition: out.edition || undefined,
      foil: out.foil || undefined,
      grade: out.grade || undefined,
      confidence: Math.max(0, Math.min(1, Number(out.confidence ?? 0))),
    } as ParsedTitle;
    // write-through cache
    try {
      await putCachedParse(prisma, title, {
        setCode: parsed.setCode,
        number: parsed.number,
        variantKey: 'EN',
        language: parsed.language,
        confidence: parsed.confidence,
      });
    } catch {}
    return parsed;
  } catch {
    return null;
  }
}

export async function parseTitleWithCacheAndFallback(title: string): Promise<ParsedTitle | null> {
  const p = await parseTitleWithModel(title);
  if (p && p.confidence >= MIN_CONF) return p;
  const fb = parseTitleFallback(title);
  if (fb) {
    try {
      await putCachedParse(prisma, title, {
        setCode: fb.setCode,
        number: fb.number,
        variantKey: 'EN',
        language: fb.language,
        confidence: Math.min(fb.confidence ?? 0.55, 0.64),
      });
    } catch {}
    return { ...fb, confidence: Math.min(fb.confidence ?? 0.55, 0.64) } as any;
  }
  return p;
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
