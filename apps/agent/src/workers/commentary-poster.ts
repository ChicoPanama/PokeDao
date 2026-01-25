/**
 * Market Commentary Poster Worker
 *
 * Generates and posts daily market commentary to X/Twitter
 * Runs on a schedule (daily) or manually triggered
 */

import { Worker, Job, Queue } from 'bullmq';
import { Redis } from 'ioredis';

const COMMENTARY_QUEUE = 'agent:commentary';
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379/0';
const X_AUTO_POST = process.env.POSTING_ENABLED === 'true';
const API_URL = process.env.API_URL || 'http://localhost:3000';

interface CommentaryJob {
  type: 'daily' | 'weekly' | 'alert';
  trigger: 'scheduled' | 'manual';
}

interface CommentaryResult {
  generated: boolean;
  posted: boolean;
  commentaryId?: string;
  xPostId?: string;
  error?: string;
}

interface Commentary {
  id: string;
  type: string;
  title: string;
  content: string;
  highlights: string[];
  sentiment: string;
}

/**
 * Generate market commentary via API
 */
async function generateCommentary(type: string): Promise<Commentary | null> {
  const response = await fetch(`${API_URL}/api/market/commentary/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type }),
  });

  if (!response.ok) {
    throw new Error(`Failed to generate commentary: ${response.statusText}`);
  }

  const data = await response.json() as { ok: boolean; commentary?: Commentary };
  return data.commentary || null;
}

/**
 * Format commentary for X/Twitter
 */
function formatForX(commentary: any): string[] {
  const lines: string[] = [];

  // Main tweet
  const sentimentEmoji = commentary.sentiment === 'bullish' ? '📈' :
    commentary.sentiment === 'bearish' ? '📉' : '➡️';

  lines.push(`${sentimentEmoji} ${commentary.title}\n\n`);

  // Add highlights as a thread
  if (commentary.highlights && commentary.highlights.length > 0) {
    commentary.highlights.forEach((h: string, i: number) => {
      if (lines[lines.length - 1].length + h.length + 4 < 280) {
        lines[lines.length - 1] += `• ${h}\n`;
      } else {
        lines.push(`• ${h}\n`);
      }
    });
  }

  // Footer
  const lastTweet = lines[lines.length - 1];
  const footer = '\n🎴 #PokemonTCG #TradingCards #PokeDAO';
  if (lastTweet.length + footer.length < 280) {
    lines[lines.length - 1] += footer;
  } else {
    lines.push(footer);
  }

  return lines;
}

/**
 * Post to X/Twitter
 */
async function postToX(lines: string[]): Promise<string | null> {
  if (!X_AUTO_POST) {
    console.log('[commentary-poster] DRY RUN - Would post:');
    lines.forEach((line, i) => console.log(`  Tweet ${i + 1}: ${line.slice(0, 100)}...`));
    return null;
  }

  // TODO: Implement X posting when social package is available
  // For now, just log the content
  console.log('[commentary-poster] LIVE MODE - Posting to X:');
  lines.forEach((line, i) => console.log(`  Tweet ${i + 1}: ${line.slice(0, 100)}...`));

  // Return a mock ID for now - replace with actual X client call
  return `mock-${Date.now()}`;
}

/**
 * Process a commentary job
 */
async function processCommentaryJob(job: Job<CommentaryJob>): Promise<CommentaryResult> {
  const { type, trigger } = job.data;
  console.log(`[commentary-poster] Processing ${type} commentary (${trigger})`);

  try {
    // Generate commentary
    const commentary = await generateCommentary(type);
    if (!commentary) {
      return { generated: false, posted: false, error: 'No commentary generated' };
    }

    console.log(`[commentary-poster] Generated: ${commentary.title}`);

    // Format and post
    const lines = formatForX(commentary);
    const xPostId = await postToX(lines);

    // Update commentary with X post ID if posted
    if (xPostId) {
      // Could call API to update the commentary record with xPostId
      console.log(`[commentary-poster] Posted to X: ${xPostId}`);
    }

    return {
      generated: true,
      posted: !!xPostId,
      commentaryId: commentary.id,
      xPostId: xPostId || undefined,
    };
  } catch (error: any) {
    console.error('[commentary-poster] Error:', error);
    return {
      generated: false,
      posted: false,
      error: error.message,
    };
  }
}

/**
 * Start the commentary poster worker
 */
export function startCommentaryPoster(): Worker {
  const connection = new Redis(REDIS_URL, {
    maxRetriesPerRequest: null,
  });

  const worker = new Worker<CommentaryJob, CommentaryResult>(
    COMMENTARY_QUEUE,
    async (job) => processCommentaryJob(job),
    {
      connection,
      concurrency: 1,
    }
  );

  worker.on('completed', (job, result) => {
    console.log(
      `[commentary-poster] Job ${job.id} completed:`,
      result.posted ? `Posted as ${result.xPostId}` : 'Generated (not posted)'
    );
  });

  worker.on('failed', (job, err) => {
    console.error(`[commentary-poster] Job ${job?.id} failed:`, err.message);
  });

  console.log('[commentary-poster] Worker started');
  return worker;
}

/**
 * Queue a commentary job
 */
export async function queueCommentary(type: 'daily' | 'weekly' = 'daily'): Promise<void> {
  const connection = new Redis(REDIS_URL, {
    maxRetriesPerRequest: null,
  });
  const queue = new Queue<CommentaryJob>(COMMENTARY_QUEUE, { connection });

  await queue.add('commentary', {
    type,
    trigger: 'manual',
  }, {
    removeOnComplete: 50,
    removeOnFail: 20,
  });

  console.log(`[commentary-poster] Queued ${type} commentary job`);
  await connection.quit();
}

/**
 * Schedule daily commentary (call from cron or scheduler)
 */
export async function scheduleDailyCommentary(): Promise<void> {
  const connection = new Redis(REDIS_URL, {
    maxRetriesPerRequest: null,
  });
  const queue = new Queue<CommentaryJob>(COMMENTARY_QUEUE, { connection });

  // Check if we already posted today
  const today = new Date().toISOString().split('T')[0];
  const lastJobKey = `commentary:last:daily`;
  const lastJob = await connection.get(lastJobKey);

  if (lastJob === today) {
    console.log('[commentary-poster] Already posted today, skipping');
    await connection.quit();
    return;
  }

  // Queue the job
  await queue.add('daily-commentary', {
    type: 'daily',
    trigger: 'scheduled',
  }, {
    removeOnComplete: 50,
    removeOnFail: 20,
  });

  // Mark as queued for today
  await connection.set(lastJobKey, today, 'EX', 86400);
  console.log('[commentary-poster] Scheduled daily commentary');
  await connection.quit();
}
