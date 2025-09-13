import 'dotenv/config';
import { runAgentTick } from '../apps/agent/src/tick.ts';

async function main() {
  await runAgentTick();
  console.log('[smoke] tick OK');
}

main().catch((e) => {
  console.error('[smoke] tick failed:', e);
  process.exit(1);
});
