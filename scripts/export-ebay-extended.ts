import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

// Exports extended eBay current listings (BIN/Best Offer) >= $500, last 30 days, to JSON.
// Reads from the backup SQLite DB found earlier.

const DEFAULT_DB = 'research-backup-20250911-172521/databases/tcgplayer-discovery/collector_crypt_ebay_complete.db';

function exportJson(db: string, outFile: string, days: number) {
  const sql = `\n.mode json\n.once ${outFile}\nSELECT\n  set_name AS set_name,\n  card_number AS card_number,\n  ebay_item_id AS ebay_item_id,\n  ebay_url AS ebay_url,\n  COALESCE(NULLIF(buy_it_now_price, 0), current_price) AS price,\n  COALESCE(last_updated, created_at) AS seenAt,\n  condition_description AS condition_description,\n  grading_company AS grading_company,\n  grade_number AS grade_number,\n  seller_name AS seller_name,\n  seller_feedback AS seller_feedback,\n  watchers_count AS watchers_count,\n  bid_count AS bid_count,\n  shipping_cost AS shipping_cost,\n  listing_type AS listing_type,\n  auction_end_time AS auction_end_time\nFROM ebay_current_listings\nWHERE COALESCE(NULLIF(buy_it_now_price, 0), current_price) >= 500\n  AND listing_type IN ('BUY_IT_NOW','BEST_OFFER')\n  AND date(COALESCE(last_updated, created_at)) >= date('now', '-' || ${days} || ' day');\n`;
  execFileSync('sqlite3', ['-readonly', db], { input: sql, encoding: 'utf8', stdio: ['pipe', 'ignore', 'inherit'] });
}

async function main() {
  const db = process.argv[2] || DEFAULT_DB;
  const days = Number(process.argv[3] || '30');
  const outDir = path.resolve('data/research');
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, 'ebay_current_extended.json');
  exportJson(db, outFile, days);
  console.log(`[export-ebay-extended] wrote ${outFile}`);
}

main().catch((e) => { console.error(e); process.exit(1); });

