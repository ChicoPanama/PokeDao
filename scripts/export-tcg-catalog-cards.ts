import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

type Row = { set_id: string; number: string; name: string };

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

async function main() {
  const db = process.argv[2] || 'research-backup-20250911-172521/databases/tcgplayer-discovery/complete_pokemon_tcg_sdk_style.db';
  const outDir = path.resolve('data/research');
  fs.mkdirSync(outDir, { recursive: true });
  const lines = runSqliteCsv(db, 'SELECT set_id, number, name FROM pokemon_cards;');
  const [h, ...rows] = lines;
  const headers = parseCsv(h);
  const cards: Row[] = [];
  for (const ln of rows) {
    const cols = parseCsv(ln);
    const obj: any = {};
    headers.forEach((k, i) => (obj[k] = cols[i] ?? ''));
    const r = obj as Row;
    if (!r.set_id || !r.number) continue;
    cards.push(r);
  }
  const outPath = path.join(outDir, 'tcg_catalog_cards.json');
  fs.writeFileSync(outPath, JSON.stringify(cards, null, 2));
  console.log(`[export-tcg-catalog-cards] wrote ${cards.length} rows -> ${outPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

