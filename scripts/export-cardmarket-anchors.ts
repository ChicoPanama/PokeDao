import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

type RawRow = { set_id: string; number: string; cardmarket_prices: string };

type Anchor = {
  setCode: string;
  number: string;
  market?: number;
  low?: number;
  mid?: number;
  high?: number;
};

function runSqliteCsv(db: string, sql: string): string[] {
  const out = execFileSync('sqlite3', ['-readonly', '-header', '-csv', db, sql], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  return out.split(/\r?\n/).filter(Boolean);
}

function parseCsv(line: string): string[] {
  const res: string[] = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQ && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else inQ = !inQ;
    } else if (ch === ',' && !inQ) {
      res.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  res.push(cur);
  return res;
}

function toNum(x: any): number | undefined {
  const n = Number(x);
  return Number.isFinite(n) ? n : undefined;
}

async function main() {
  const db = process.argv[2] || 'research-backup-20250911-172521/databases/tcgplayer-discovery/complete_pokemon_tcg_sdk_style.db';
  const outDir = path.resolve('data/research');
  fs.mkdirSync(outDir, { recursive: true });
  const lines = runSqliteCsv(db, 'SELECT set_id, number, cardmarket_prices FROM pokemon_cards;');
  const [h, ...rows] = lines;
  const headers = parseCsv(h);
  const anchors: Anchor[] = [];
  for (const ln of rows) {
    const cols = parseCsv(ln);
    const obj: any = {};
    headers.forEach((k, i) => (obj[k] = cols[i] ?? ''));
    const r = obj as RawRow;
    if (!r.set_id || !r.number || !r.cardmarket_prices) continue;
    try {
      const priceObj = JSON.parse(r.cardmarket_prices);
      // Try common cardmarket keys
      // Accept shapes like { market, low, mid, high } or { trendPrice, averageSellPrice, lowPrice, highPrice, avg1,avg7,avg30 }
      const market = toNum(
        priceObj.market ?? priceObj.trendPrice ?? priceObj.averageSellPrice ?? priceObj.avg ?? priceObj.avg30 ?? priceObj.avg7 ?? priceObj.avg1,
      );
      const low = toNum(priceObj.low ?? priceObj.lowPrice);
      const high = toNum(priceObj.high ?? priceObj.highPrice);
      let mid = toNum(priceObj.mid);
      if (mid === undefined) {
        const xs = [priceObj.avg1, priceObj.avg7, priceObj.avg30].map(toNum).filter((n): n is number => n !== undefined);
        if (xs.length) mid = Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 100) / 100;
      }
      const a: Anchor = { setCode: String(r.set_id), number: String(r.number), market, low, mid, high };
      if (a.market || a.low || a.mid || a.high) anchors.push(a);
    } catch {
      // skip bad json
    }
  }
  const outPath = path.join(outDir, 'cardmarket_anchors.json');
  fs.writeFileSync(outPath, JSON.stringify(anchors, null, 2));
  console.log(`[export-cardmarket-anchors] wrote ${anchors.length} anchors -> ${outPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

