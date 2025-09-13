import fs from 'node:fs';
import path from 'node:path';
import { parseTitleWithModel } from './normalizers/titleParser';

const argv = process.argv.slice(2);
const usage = `
Usage:
  tsx scripts/run-title-parser.ts "raw title here"
  tsx scripts/run-title-parser.ts --file titles.txt
  cat titles.txt | tsx scripts/run-title-parser.ts --stdin
Options:
  --min-conf 0.65     Minimum confidence to accept LLM parse (default 0.65)
  --fallback          Use simple regex fallback when LLM < min-conf (adds _fallback=true)
  --pretty            Pretty-print JSON instead of NDJSON
`;

function getOpt(name: string, def?: string) {
  const i = argv.indexOf(name);
  return i === -1 ? def : argv[i + 1];
}

async function* iterInput(): AsyncGenerator<string> {
  const idxFile = argv.indexOf('--file');
  const idxStdin = argv.indexOf('--stdin');
  if (idxFile !== -1) {
    const p = argv[idxFile + 1];
    if (!p) throw new Error('Missing path after --file');
    const content = fs.readFileSync(path.resolve(p), 'utf8');
    for (const line of content.split(/\r?\n/)) if (line.trim()) yield line.trim();
    return;
  }
  if (idxStdin !== -1) {
    const chunks: Buffer[] = [];
    for await (const c of process.stdin) chunks.push(Buffer.from(c));
    const content = Buffer.concat(chunks).toString('utf8');
    for (const line of content.split(/\r?\n/)) if (line.trim()) yield line.trim();
    return;
  }
  if (argv.length && !argv[0].startsWith('--')) {
    yield argv[0];
    return;
  }
  console.error(usage);
  process.exit(1);
}

const minConf = Number(getOpt('--min-conf', '0.65'));
const useFallback = argv.includes('--fallback');
const pretty = argv.includes('--pretty');

function parseTitleFallback(title: string) {
  const t = title.toLowerCase();
  const m = t.match(/\b(sv\d+)\s*[-# ]?\s*(\d{1,3})\b/);
  if (m) return { setCode: m[1], number: m[2].padStart(3, '0'), variantKey: 'EN', language: 'EN', confidence: 0.55 };
  const fossil = t.match(/\bfossil\b.*?(\d{2,3})\b/);
  if (fossil) return { setCode: 'fossil', number: fossil[1].padStart(3, '0'), variantKey: 'EN', language: 'EN', confidence: 0.5 };
  return null;
}

(async () => {
  const results: any[] = [];
  for await (const title of iterInput()) {
    const parsed = await parseTitleWithModel(title);
    let result: any = parsed;
    if (!parsed || parsed.confidence < minConf) {
      if (useFallback) {
        const fb = parseTitleFallback(title);
        if (fb) result = { ...fb, _fallback: true };
      }
    }
    if (!result) result = { _error: 'unparsed', title };
    else result.title = title;
    if (!pretty) console.log(JSON.stringify(result));
    results.push(result);
  }
  if (pretty) console.log(JSON.stringify(results, null, 2));
})().catch((e) => { console.error(e); process.exit(1); });

