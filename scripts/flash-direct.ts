import 'dotenv/config';
import { formatOpportunityThread } from '../packages/social/x/post.js';
import { postThread } from '../packages/social/x/client.js';

async function main() {
  const lines = formatOpportunityThread({
    cardTitle: 'Smoke Test Card',
    spreadPct: 21.0,
    buyUrl: 'https://example.com',
    rationale: 'smoke test',
    risks: ['none'],
    timeWindow: '24–72h',
  });
  await postThread(lines);
  console.log('[smoke] flash OK');
}

main().catch((e) => {
  console.error('[smoke] flash failed:', e);
  process.exit(1);
});
