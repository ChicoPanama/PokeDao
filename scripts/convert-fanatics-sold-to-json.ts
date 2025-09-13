import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { parseTitleWithQwen, parseTitleFallback } from './normalizers/titleParser';

type Row = {
  ID: string;
  Name: string;
  Sold_Price: string; // like "$750"
  Sold_Date?: string; // like "sep 09, 2025 i" or "sold on sep 09, 2025 i"
  Grading_Service?: string;
  Grade?: string;
};

type CompOut = {
  setCode: string;
  number: string;
  language?: string;
  edition?: string | null;
  holo?: boolean;
  reverse?: boolean;
  priceCents: number;
  currency: string;
  soldAt: string;
  externalId?: string;
  raw?: { title?: string };
};

type ListingOut = {
  title: string;
  priceCents: number;
  currency: string;
  seenAt: string;
  condition?: string;
  grade?: string | null;
  url?: string;
};

function parsePriceCents(input: string | undefined): number | null {
  if (!input) return null;
  const s = input.replace(/[^0-9.,]/g, '').replace(/,/g, '');
  if (!s) return null;
  const n = Number(s);
  if (!isFinite(n)) return null;
  return Math.round(n * 100);
}

function extractDateISO(input?: string): string {
  if (!input) return new Date().toISOString();
  // Try to find pattern like 'sep 09, 2025'
  const m = input.match(/[A-Za-z]{3,9}\s+\d{1,2},\s*\d{4}/);
  const part = m ? m[0] : input;
  const d = new Date(part);
  return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

async function parseTitle(title: string) {
  const withAi = await parseTitleWithQwen(title).catch(() => null);
  return withAi || parseTitleFallback(title);
}

async function convertCsv(file: string) {
  const rl = readline.createInterface({ input: fs.createReadStream(file), crlfDelay: Infinity });
  let header: string[] | null = null;
  const rows: Row[] = [];
  for await (const line of rl) {
    if (!header) {
      header = line.split(',').map((h) => h.replace(/^\uFEFF/, '').trim());
      continue;
    }
    // naive CSV split; sufficient for our simple files
    const parts: string[] = [];
    let cur = '';
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        inQ = !inQ;
      } else if (ch === ',' && !inQ) {
        parts.push(cur);
        cur = '';
      } else {
        cur += ch;
      }
    }
    parts.push(cur);
    if (!header) continue;
    const obj: any = {};
    for (let i = 0; i < header.length; i++) obj[header[i]] = (parts[i] ?? '').replace(/^"|"$/g, '');
    rows.push(obj as Row);
  }

  const comps: CompOut[] = [];
  const listings: ListingOut[] = [];

  for (const r of rows) {
    const priceCents = parsePriceCents(r.Sold_Price);
    if (!priceCents || priceCents < 50000) continue; // $500+
    const soldAt = extractDateISO(r.Sold_Date);
    const title = r.Name || '';
    const parsed = await parseTitle(title);
    if (!parsed || !parsed.setCode || !parsed.number) continue;
    const foil = parsed.foil || null;
    comps.push({
      setCode: parsed.setCode,
      number: parsed.number,
      language: parsed.language || 'EN',
      edition: parsed.edition || null,
      holo: foil === 'Holo',
      reverse: foil === 'Reverse',
      priceCents,
      currency: 'USD',
      soldAt,
      externalId: r.ID,
      raw: { title },
    });
    // Auxiliary listing (to drive scoring); uses same price and date as seenAt
    listings.push({
      title,
      priceCents,
      currency: 'USD',
      seenAt: soldAt,
      condition: 'Unknown',
      grade: r.Grade ? String(r.Grade) : null,
      url: '',
    });
  }

  return { comps, listings };
}

async function main() {
  const args = process.argv.slice(2);
  if (!args.length) {
    console.error('Usage: tsx scripts/convert-fanatics-sold-to-json.ts <csv...>');
    process.exit(1);
  }
  const outputs = await Promise.all(args.map((f) => convertCsv(f)));
  const allComps = outputs.flatMap((o) => o.comps);
  const allListings = outputs.flatMap((o) => o.listings);

  const outDir = path.resolve('data/research');
  fs.mkdirSync(outDir, { recursive: true });
  const compsPath = path.join(outDir, 'comps_fanatics_sold.json');
  const listingsPath = path.join(outDir, 'listings_fanatics_from_sold.json');
  fs.writeFileSync(compsPath, JSON.stringify(allComps, null, 2));
  fs.writeFileSync(listingsPath, JSON.stringify(allListings, null, 2));
  console.log(`[convert] wrote comps=${allComps.length} -> ${compsPath}`);
  console.log(`[convert] wrote listings=${allListings.length} -> ${listingsPath}`);
}

main().catch((e) => { console.error(e); process.exit(1); });

