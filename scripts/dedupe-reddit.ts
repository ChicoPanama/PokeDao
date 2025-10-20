import * as fs from 'fs';

const lines1 = fs.readFileSync('/Users/arcadio/dev/pokedao/data/training/reddit-sentiment.jsonl', 'utf8').split('\n').filter(Boolean);
const lines2 = fs.readFileSync('/Users/arcadio/dev/pokedao/data/training/reddit-sentiment-max.jsonl', 'utf8').split('\n').filter(Boolean);

const seen = new Set<string>();
const unique: string[] = [];

for (const line of [...lines1, ...lines2]) {
  const ex = JSON.parse(line);
  const id = ex.metadata.reddit_id;
  if (!seen.has(id)) {
    seen.add(id);
    unique.push(line);
  }
}

fs.writeFileSync('/Users/arcadio/dev/pokedao/data/training/reddit-sentiment-final.jsonl', unique.join('\n'));

console.log(`\nDeduplication Results:`);
console.log(`======================`);
console.log(`File 1: ${lines1.length} examples`);
console.log(`File 2: ${lines2.length} examples`);
console.log(`Total input: ${lines1.length + lines2.length} examples`);
console.log(`\nUnique output: ${unique.length} examples`);
console.log(`Duplicates removed: ${lines1.length + lines2.length - unique.length}`);
console.log(`\n✅ Saved to: /Users/arcadio/dev/pokedao/data/training/reddit-sentiment-final.jsonl`);
