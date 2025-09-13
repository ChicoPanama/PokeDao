import 'dotenv/config';
import { postDailyBest } from '../apps/agent/src/pipelines/daily.ts';

async function main() {
  await postDailyBest();
  console.log('[smoke] daily OK');
}

main().catch((e) => {
  console.error('[smoke] daily failed:', e);
  process.exit(1);
});
