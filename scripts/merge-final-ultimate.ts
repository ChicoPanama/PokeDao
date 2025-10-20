import * as fs from 'fs';

console.log('\n═══════════════════════════════════════════════════════════');
console.log('   FINAL ULTIMATE MERGE - ALL REDDIT COLLECTIONS');
console.log('═══════════════════════════════════════════════════════════\n');

const files = [
  '/Users/arcadio/dev/pokedao/data/training/reddit-sentiment-ULTIMATE.jsonl',  // 6,334 (previous collections)
  '/Users/arcadio/dev/pokedao/data/training/reddit-sentiment-phase1.jsonl',    // 19,035 (new!)
];

const seen = new Set<string>();
const unique: string[] = [];
let totalInput = 0;

for (const file of files) {
  if (!fs.existsSync(file)) {
    console.log(`⚠️  File not found: ${file}`);
    continue;
  }

  const lines = fs.readFileSync(file, 'utf8').split('\n').filter(Boolean);
  console.log(`📂 ${file.split('/').pop()}: ${lines.length} examples`);

  totalInput += lines.length;

  for (const line of lines) {
    try {
      const ex = JSON.parse(line);
      const id = ex.metadata.reddit_id;
      if (!seen.has(id)) {
        seen.add(id);
        unique.push(line);
      }
    } catch (error) {
      // Skip malformed lines
    }
  }
}

fs.writeFileSync('/Users/arcadio/dev/pokedao/data/training/reddit-sentiment-FINAL-ULTIMATE.jsonl', unique.join('\n'));

console.log('\n' + '─'.repeat(60));
console.log(`📊 Total input: ${totalInput} examples`);
console.log(`✅ Unique output: ${unique.length} examples`);
console.log(`🗑️  Duplicates removed: ${totalInput - unique.length}`);
console.log(`📁 Saved to: reddit-sentiment-FINAL-ULTIMATE.jsonl`);

console.log('\n📈 Reddit Collection Journey:');
console.log('   1. Initial (limit=1000): 1,627 examples');
console.log('   2. Maximum (all sorts): 2,025 examples');
console.log('   3. Historical search: 1,294 examples');
console.log('   4. Expanded subreddits: 3,943 examples');
console.log('   5. Phase 1 (78 searches): 19,035 examples');
console.log('   ─────────────────────────────────────────');
console.log('   FINAL ULTIMATE: ' + unique.length + ' unique examples');

const fileSizeMB = (fs.statSync('/Users/arcadio/dev/pokedao/data/training/reddit-sentiment-FINAL-ULTIMATE.jsonl').size / 1024 / 1024).toFixed(2);
console.log(`   File size: ${fileSizeMB} MB`);
console.log('═══════════════════════════════════════════════════════════\n');
