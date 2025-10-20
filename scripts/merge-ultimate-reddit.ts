import * as fs from 'fs';

console.log('\n═══════════════════════════════════════════════════════════');
console.log('   ULTIMATE REDDIT MERGE - ALL COLLECTIONS');
console.log('═══════════════════════════════════════════════════════════\n');

const files = [
  '/Users/arcadio/dev/pokedao/data/training/reddit-sentiment-ALL.jsonl',          // 3,224
  '/Users/arcadio/dev/pokedao/data/training/reddit-sentiment-expanded.jsonl',     // 3,943
];

const seen = new Set<string>();
const unique: string[] = [];
let totalInput = 0;

for (const file of files) {
  const lines = fs.readFileSync(file, 'utf8').split('\n').filter(Boolean);
  console.log(`📂 ${file.split('/').pop()}: ${lines.length} examples`);

  totalInput += lines.length;

  for (const line of lines) {
    const ex = JSON.parse(line);
    const id = ex.metadata.reddit_id;
    if (!seen.has(id)) {
      seen.add(id);
      unique.push(line);
    }
  }
}

fs.writeFileSync('/Users/arcadio/dev/pokedao/data/training/reddit-sentiment-ULTIMATE.jsonl', unique.join('\n'));

console.log('\n' + '─'.repeat(60));
console.log(`📊 Total input: ${totalInput} examples`);
console.log(`✅ Unique output: ${unique.length} examples`);
console.log(`🗑️  Duplicates removed: ${totalInput - unique.length}`);
console.log(`📁 Saved to: reddit-sentiment-ULTIMATE.jsonl`);
console.log('\n📈 Collection Summary:');
console.log('   - Initial collection: 1,627 examples');
console.log('   - Maximum collection: 2,025 examples');
console.log('   - Historical search: 1,294 examples');
console.log('   - Expanded subreddits: 3,943 examples');
console.log('   - ULTIMATE TOTAL: ' + unique.length + ' unique examples');
console.log('═══════════════════════════════════════════════════════════\n');
