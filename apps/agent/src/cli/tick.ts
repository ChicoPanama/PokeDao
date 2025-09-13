import 'dotenv/config';
import { runAgentTick } from '../tick.js';

runAgentTick()
  .then(() => {
    console.log('[agent] tick OK');
  })
  .catch((e) => {
    console.error('[agent] tick failed:', e);
    process.exit(1);
  });
