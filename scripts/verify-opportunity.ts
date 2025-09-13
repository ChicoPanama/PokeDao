import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { runAgentTick } from '../apps/agent/src/tick.js';

const db = new PrismaClient();

async function sh(cmd: string, env: Record<string,string> = {}) {
  const { exec } = await import('node:child_process');
  return new Promise<void>((res, rej) => {
    exec(cmd, { env: { ...process.env, ...env } }, (err, stdout, stderr) => {
      if (stdout) process.stdout.write(stdout);
      if (stderr) process.stderr.write(stderr);
      err ? rej(err) : res();
    });
  });
}

async function main() {
  // 1) DB ready? (migrate)
  await sh('pnpm --filter @pokedao/api exec prisma migrate deploy');

  // 2) baseline count
  const before = await db.opportunity.count({ where: { status: 'PENDING' } });

  // 3) seed from newest recent listing (or LISTING_ID)
  if ((process.env.SEED_FIRST ?? 'true') !== 'false') {
    await sh('pnpm seed:from-listing', {
      LISTING_ID: process.env.LISTING_ID ?? '',
      COMP_MULT: process.env.COMP_MULT ?? '5.1',
    });
  }

  // 4) run real pipeline with debug & zero thresholds
  process.env.AGENT_DEBUG = process.env.AGENT_DEBUG ?? 'true';
  process.env.OPP_MIN_NET_SPREAD_BPS = process.env.OPP_MIN_NET_SPREAD_BPS ?? '0';
  process.env.OPP_MIN_30D_SALES = process.env.OPP_MIN_30D_SALES ?? '0';
  process.env.AGENT_SMOKE_ONLY = 'false';
  await runAgentTick();

  // 5) assert: at least one new PENDING Opportunity
  const after = await db.opportunity.count({ where: { status: 'PENDING' } });
  const created = after - before;
  const newest = await db.opportunity.findFirst({
    where: { status: 'PENDING' },
    orderBy: { createdAt: 'desc' },
  });

  console.log('\n=== Smoke Verification ===');
  console.log('Before:', before, 'After:', after, 'Created:', created);
  if (newest) {
    console.log('Newest:', {
      id: newest.id, cardId: newest.cardId, listingId: newest.listingId,
      netSpreadBps: newest.netSpreadBps, confidence: newest.confidence,
      createdAt: newest.createdAt,
    });
  }

  if (created <= 0) {
    console.error('❌ No new PENDING Opportunity created.');
    process.exit(1);
  } else {
    console.log('✅ Passed: PENDING Opportunity created.');
  }
}

main().finally(() => db.$disconnect());
