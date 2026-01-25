/**
 * Step 6: Output - Stage posts and send alerts
 *
 * This step:
 * 1. Posts top opportunities to X/Twitter (dry-run by default)
 * 2. Queues flash alerts for Telegram delivery
 * 3. Queues X posts for async processing
 */
import { postThread } from '../../../../packages/social/x/client.js';
import { formatOpportunityThread } from '../../../../packages/social/x/post.js';
import { postQueue } from '../queues.js';
import { queueAlert } from '../workers/alert-bridge.js';
import { queuePost } from '../workers/x-poster.js';
import type { OpportunityCandidate } from './04_signal.js';

// Configuration from environment
const FLASH_ENABLED = process.env.FLASH_ENABLED !== 'false';
const TELEGRAM_ALERTS_ENABLED = process.env.TELEGRAM_ALERTS_ENABLED === 'true';
const X_AUTO_POST = process.env.X_AUTO_POST === 'true';
const FLASH_MIN_SPREAD_BPS = Number(process.env.FLASH_MIN_SPREAD_BPS || 2000);
const FLASH_MIN_CONFIDENCE = Number(process.env.FLASH_MIN_CONFIDENCE || 0.7);

export interface OutputResult {
  xPosted: boolean;
  telegramQueued: number;
  flashQueued: boolean;
}

export async function stageAndMaybePost(cands: OpportunityCandidate[]): Promise<OutputResult> {
  const result: OutputResult = {
    xPosted: false,
    telegramQueued: 0,
    flashQueued: false,
  };

  if (cands.length === 0) {
    console.log('[output] No candidates to process');
    return result;
  }

  // Sort by spread and confidence to get the best opportunities
  const sorted = [...cands].sort((a, b) =>
    b.netSpreadBps - a.netSpreadBps || b.confidence - a.confidence
  );

  const top = sorted[0];
  const cardName = top.cardId; // TODO: Resolve to human-readable name from DB

  console.log(`[output] Processing ${sorted.length} candidates, top: ${cardName} (${top.netSpreadBps / 100}% spread)`);

  // 1. Post to X/Twitter (immediate dry-run or queued for live)
  const lines = formatOpportunityThread({
    cardTitle: cardName,
    spreadPct: top.netSpreadBps / 100,
    buyUrl: top.url || 'https://pokedao.app',
    sellCompUrl: undefined,
    rationale: top.rationale,
    risks: ['Condition variance', 'Fee drift', 'Listing cancellation'],
    timeWindow: 'Next 24–72h',
  });

  if (X_AUTO_POST) {
    // Queue for async posting via worker
    try {
      await queuePost({
        kind: 'opportunity',
        lines,
        cardTitle: cardName,
        spreadPct: top.netSpreadBps / 100,
        buyUrl: top.url,
        rationale: top.rationale,
        risks: ['Condition variance', 'Fee drift', 'Listing cancellation'],
      });
      console.log('[output] X post queued for worker');
    } catch (e) {
      console.warn('[output] Failed to queue X post:', e);
    }
  } else {
    // Immediate post (dry-run by default)
    await postThread(lines);
    result.xPosted = true;
    console.log('[output] X thread posted (dry-run mode)');
  }

  // 2. Queue Telegram alerts for eligible users
  if (TELEGRAM_ALERTS_ENABLED) {
    for (const cand of sorted.slice(0, 5)) { // Top 5 opportunities
      try {
        await queueAlert(cand, cand.cardId);
        result.telegramQueued++;
      } catch (e) {
        console.warn('[output] Failed to queue Telegram alert:', e);
      }
    }
    console.log(`[output] ${result.telegramQueued} Telegram alerts queued`);
  }

  // 3. Flash alerts for exceptional opportunities
  if (FLASH_ENABLED && top.netSpreadBps >= FLASH_MIN_SPREAD_BPS && top.confidence >= FLASH_MIN_CONFIDENCE) {
    try {
      await postQueue.add(
        'flash',
        { kind: 'flash', lines, cardTitle: cardName, spreadPct: top.netSpreadBps / 100 },
        { removeOnComplete: 100, removeOnFail: 100 }
      );
      result.flashQueued = true;
      console.log('[output] Flash alert enqueued');
    } catch (e) {
      console.warn('[output] Flash enqueue failed:', e);
    }
  }

  return result;
}
