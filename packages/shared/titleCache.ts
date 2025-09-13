import crypto from 'node:crypto';
import type { PrismaClient } from '@prisma/client';

export const TITLE_CACHE_VERSION = Number(process.env.TITLE_CACHE_VERSION ?? 1);

export function normalizeTitle(raw: string) {
  return String(raw || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

export function hashTitle(norm: string) {
  return crypto.createHash('sha1').update(norm).digest('hex');
}

export function makeCardSlug(setCode: string, number: string, variantKey = 'EN') {
  const num = String(number || '').padStart(3, (String(number || '').length >= 3 ? 3 : 2));
  return `${String(setCode || '').toLowerCase()}-${num}-${String(variantKey || 'EN').toLowerCase()}`;
}

export async function getCachedParse(prisma: PrismaClient, rawTitle: string) {
  const titleNorm = normalizeTitle(rawTitle);
  const titleHash = hashTitle(titleNorm);
  const row = await prisma.titleParseCache.findUnique({
    where: { schemaVersion_titleHash: { schemaVersion: TITLE_CACHE_VERSION, titleHash } },
  });
  if (!row) return null;
  prisma.titleParseCache
    .update({
      where: { schemaVersion_titleHash: { schemaVersion: TITLE_CACHE_VERSION, titleHash } },
      data: { hits: { increment: 1 } },
    })
    .catch(() => {});
  return row;
}

export async function putCachedParse(
  prisma: PrismaClient,
  rawTitle: string,
  parsed: { setCode: string; number: string; variantKey?: string; language?: string; confidence: number },
) {
  const titleNorm = normalizeTitle(rawTitle);
  const titleHash = hashTitle(titleNorm);
  const variantKey = parsed.variantKey ?? 'EN';
  const cardSlug = makeCardSlug(parsed.setCode, parsed.number, variantKey);
  return prisma.titleParseCache.upsert({
    where: { schemaVersion_titleHash: { schemaVersion: TITLE_CACHE_VERSION, titleHash } },
    create: {
      schemaVersion: TITLE_CACHE_VERSION,
      titleRaw: rawTitle,
      titleNorm,
      titleHash,
      setCode: parsed.setCode,
      number: parsed.number,
      variantKey,
      language: parsed.language,
      confidence: parsed.confidence,
      cardSlug,
      hits: 1,
    },
    update: {
      setCode: parsed.setCode,
      number: parsed.number,
      variantKey,
      language: parsed.language,
      confidence: parsed.confidence,
      cardSlug,
      hits: { increment: 1 },
    },
  });
}

