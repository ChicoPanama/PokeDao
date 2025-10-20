import * as fs from 'fs';

console.log('\n═══════════════════════════════════════════════════════════');
console.log('   MERGING ALL REDDIT COLLECTIONS');
console.log('═══════════════════════════════════════════════════════════\n');

const files = [
  '/Users/arcadio/dev/pokedao/data/training/reddit-sentiment.jsonl',
  '/Users/arcadio/dev/pokedao/data/training/reddit-sentiment-max.jsonl',
  '/Users/arcadio/dev/pokedao/data/training/reddit-sentiment-historical.jsonl',
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

fs.writeFileSync('/Users/arcadio/dev/pokedao/data/training/reddit-sentiment-ALL.jsonl', unique.join('\n'));

console.log('\n' + '─'.repeat(60));
console.log(`📊 Total input: ${totalInput} examples`);
console.log(`✅ Unique output: ${unique.length} examples`);
console.log(`🗑️  Duplicates removed: ${totalInput - unique.length}`);
console.log(`📁 Saved to: reddit-sentiment-ALL.jsonl`);
console.log('═══════════════════════════════════════════════════════════\n');
