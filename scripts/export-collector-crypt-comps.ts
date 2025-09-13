import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

// Export Collector Crypt comps as canonical-thin JSON (>= $500)
// Source DB: research-backup-20250911-172521/databases/tcgplayer-discovery/collector_crypt_pricing_complete.db

const DEFAULT_DB = 'research-backup-20250911-172521/databases/tcgplayer-discovery/collector_crypt_pricing_complete.db';

function exportJson(db: string, outFile: string) {
  const sql = `\n.mode json\n.once ${outFile}\nSELECT\n  id as externalId,\n  cc_title as title,\n  ebay_sold_price as price,\n  last_updated as soldAt,\n  cc_grading_company as gradingCompany,\n  cc_grade as grade\nFROM collector_crypt_pricing\nWHERE ebay_sold_price >= 500\nORDER BY last_updated DESC;\n`;
  execFileSync('sqlite3', ['-readonly', db], { input: sql, encoding: 'utf8', stdio: ['pipe', 'ignore', 'inherit'] });
}

async function main() {
  const db = process.argv[2] || DEFAULT_DB;
  const outDir = path.resolve('data/research');
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, 'comps_collectorcrypt.json');
  exportJson(db, outFile);
  console.log(`[export-collector-crypt-comps] wrote ${outFile}`);
}

main().catch((e) => { console.error(e); process.exit(1); });

