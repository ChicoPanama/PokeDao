/**
 * Alert Bridge - Queues signals for Telegram delivery
 *
 * This module creates alert jobs that the bot worker picks up.
 * No direct Telegram dependency - just BullMQ queuing.
 */

import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import type { OpportunityCandidate } from '../steps/04_signal.js';

const ALERT_QUEUE = 'telegram:alerts';

interface AlertJob {
  type: 'opportunity' | 'arbitrage' | 'price_drop';
  signal: {
    id: string;
    cardId: string;
    cardName?: string;
    setName?: string;
    source: string;
    sourceSell: string;
    priceCents: number;
    sellCompCents: number;
    expectedProfitCents: number;
    netSpreadBps: number;
    confidence: number;
    rationale?: string;
    url?: string;
  };
  createdAt: string;
}

let alertQueue: Queue<AlertJob> | null = null;

function getAlertQueue(): Queue<AlertJob> {
  if (!alertQueue) {
    const connection = new Redis(process.env.REDIS_URL || 'redis://localhost:6379/0', {
      maxRetriesPerRequest: null,
    });
    alertQueue = new Queue<AlertJob>(ALERT_QUEUE, { connection });
  }
  return alertQueue;
}

/**
 * Queue a signal for Telegram alert delivery
 */
export async function queueAlert(
  signal: OpportunityCandidate,
  cardName?: string,
  setName?: string
): Promise<void> {
  const queue = getAlertQueue();

  const job: AlertJob = {
    type: 'opportunity',
    signal: {
      id: signal.id,
      cardId: signal.cardId,
      cardName,
      setName,
      source: signal.source,
      sourceSell: signal.sourceSell,
      priceCents: signal.priceCents,
      sellCompCents: signal.sellCompCents,
      expectedProfitCents: signal.expectedProfitCents,
      netSpreadBps: signal.netSpreadBps,
      confidence: signal.confidence,
      rationale: signal.rationale,
      url: signal.url,
    },
    createdAt: new Date().toISOString(),
  };

  await queue.add('opportunity', job, {
    removeOnComplete: 100,
    removeOnFail: 50,
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
  });

  console.log(`[alert-bridge] Queued alert for ${cardName || signal.cardId}`);
}

/**
 * Queue a batch of signals
 */
export async function queueAlertBatch(
  signals: OpportunityCandidate[],
  cardNames?: Map<string, string>
): Promise<number> {
  let queued = 0;

  for (const signal of signals) {
    try {
      const cardName = cardNames?.get(signal.cardId);
      await queueAlert(signal, cardName);
      queued++;
    } catch (e) {
      console.warn(`[alert-bridge] Failed to queue alert for ${signal.cardId}:`, e);
    }
  }

  return queued;
}

/**
 * Get queue statistics
 */
export async function getAlertQueueStats(): Promise<{
  waiting: number;
  active: number;
  completed: number;
  failed: number;
}> {
  const queue = getAlertQueue();
  const [waiting, active, completed, failed] = await Promise.all([
    queue.getWaitingCount(),
    queue.getActiveCount(),
    queue.getCompletedCount(),
    queue.getFailedCount(),
  ]);
  return { waiting, active, completed, failed };
}
