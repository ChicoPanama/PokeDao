import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

type SoldRow = {
  itemId: string;
  title: string;
  price: string; // number as string
  soldDate: string;
  gradingCompany?: string;
  gradeNumber?: string;
  url?: string;
  set_name?: string;
  card_number?: string;
};

type ListingRow = {
  itemId: string;
  title: string;
  price: string; // number as string
  seenAt: string;
  condition?: string;
  gradingCompany?: string;
  gradeNumber?: string;
  url?: string;
  set_name?: string;
  card_number?: string;
};

function csvParse(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
      else inQ = !inQ;
    } else if (ch === ',' && !inQ) {
      out.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

function parseNumberCents(s: string | undefined): number | null {
  if (!s) return null;
  const n = Number(String(s).replace(/[^0-9.\-]/g, ''));
  if (!isFinite(n)) return null;
  return Math.round(n * 100);
}

function gradeJoin(company?: string, num?: string) {
  const c = (company || '').trim();
  const n = (num || '').trim();
  return (c || n) ? `${c}${c && n ? ' ' : ''}${n}` : null;
}

function normSetCode(name?: string) {
  // Use set_name directly as setCode surrogate; consistent across comps/listings
  const n = (name || '').trim();
  return n || 'UnknownSet';
}

function normNumber(num?: string) {
  const s = (num || '').trim();
  if (!s) return '';
  // Remove non-alphanumeric except / and letters
  return s.replace(/[^0-9A-Za-z/\-]/g, '');
}

function runSqliteCsv(db: string, sql: string): string[] {
  const out = execFileSync('sqlite3', ['-readonly', '-header', '-csv', db, sql], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] });
  return out.split(/\r?\n/).filter(Boolean);
}

async function main() {
  const db = process.argv[2] || 'research-backup-20250911-172521/databases/tcgplayer-discovery/collector_crypt_ebay_complete.db';
  if (!fs.existsSync(db)) {
    console.error(`DB not found: ${db}`);
    process.exit(1);
  }

  const soldSql = `
    SELECT 
      ebay_item_id AS itemId,
      title,
      sold_price AS price,
      sold_date AS soldDate,
      grading_company AS gradingCompany,
      grade_number AS gradeNumber,
      ebay_url AS url,
      set_name,
      card_number
    FROM ebay_sold_listings
    WHERE sold_price >= 500
  `;

  const listingSql = `
    SELECT 
      ebay_item_id AS itemId,
      title,
      COALESCE(NULLIF(buy_it_now_price, 0), current_price) AS price,
      COALESCE(last_updated, created_at) AS seenAt,
      condition_description AS condition,
      grading_company AS gradingCompany,
      grade_number AS gradeNumber,
      ebay_url AS url,
      set_name,
      card_number
    FROM ebay_current_listings
    WHERE COALESCE(NULLIF(buy_it_now_price, 0), current_price) >= 500
  `;

  const soldLines = runSqliteCsv(db, soldSql);
  const listLines = runSqliteCsv(db, listingSql);

  const parseCsv = (lines: string[]) => {
    const [h, ...rows] = lines;
    const headers = csvParse(h);
    return rows.map((ln) => {
      const cols = csvParse(ln);
      const obj: any = {};
      headers.forEach((k, i) => (obj[k] = cols[i] ?? ''));
      return obj;
    });
  };

  const soldRows = parseCsv(soldLines) as SoldRow[];
  const listRows = parseCsv(listLines) as ListingRow[];

  const comps = soldRows.map((r) => ({
    setCode: normSetCode(r.set_name),
    number: normNumber(r.card_number),
    variantKey: 'EN',
    priceCents: parseNumberCents(r.price)!,
    currency: 'USD',
    soldAt: new Date(r.soldDate || Date.now()).toISOString(),
    source: 'Research',
    externalId: r.itemId,
    raw: { title: r.title }
  })).filter((x) => x.priceCents >= 50000);

  const listings = listRows.map((r) => ({
    setCode: normSetCode(r.set_name),
    number: normNumber(r.card_number),
    variantKey: 'EN',
    priceCents: parseNumberCents(r.price)!,
    currency: 'USD',
    seenAt: new Date(r.seenAt || Date.now()).toISOString(),
    source: 'Research',
    url: r.url || '',
    condition: r.condition || 'Unknown',
    grade: gradeJoin(r.gradingCompany, r.gradeNumber),
    raw: { title: r.title }
  })).filter((x) => x.priceCents >= 50000);

  const outDir = path.resolve('data/research');
  fs.mkdirSync(outDir, { recursive: true });
  const compsPath = path.join(outDir, 'comps_ebay_db.json');
  const listingsPath = path.join(outDir, 'listings_ebay_db.json');
  fs.writeFileSync(compsPath, JSON.stringify(comps, null, 2));
  fs.writeFileSync(listingsPath, JSON.stringify(listings, null, 2));
  console.log(`[convert-ebay] wrote comps=${comps.length} -> ${compsPath}`);
  console.log(`[convert-ebay] wrote listings=${listings.length} -> ${listingsPath}`);
}

main().catch((e) => { console.error(e); process.exit(1); });

