/**
 * X (Twitter) Post Worker
 *
 * Processes the post queue and publishes opportunities to X/Twitter.
 * Supports both dry-run mode (default) and live posting.
 */

import { Worker, Job, Queue } from 'bullmq';
import { Redis } from 'ioredis';
import { postThread, postText, postWithImage } from '../../../../packages/social/x/client.js';
import { formatOpportunityThread } from '../../../../packages/social/x/post.js';

const POST_QUEUE = 'agent:post';

interface PostJob {
  kind: 'opportunity' | 'flash' | 'daily' | 'text';
  lines?: string[];
  text?: string;
  cardTitle?: string;
  spreadPct?: number;
  buyUrl?: string;
  sellCompUrl?: string;
  rationale?: string;
  risks?: string[];
}

// Track recent posts to avoid duplicates
const recentPosts = new Map<string, number>();
const DEDUP_WINDOW_MS = 4 * 60 * 60 * 1000; // 4 hours

/**
 * Generate a dedup key for a post
 */
function getPostKey(job: PostJob): string {
  if (job.cardTitle) {
    return `card:${job.cardTitle}`;
  }
  if (job.text) {
    return `text:${job.text.slice(0, 50)}`;
  }
  if (job.lines?.length) {
    return `thread:${job.lines[0].slice(0, 50)}`;
  }
  return `job:${Date.now()}`;
}

/**
 * Check if we've posted this recently
 */
function isDuplicate(key: string): boolean {
  const lastPosted = recentPosts.get(key);
  if (lastPosted && Date.now() - lastPosted < DEDUP_WINDOW_MS) {
    return true;
  }
  return false;
}

/**
 * Mark a post as sent
 */
function markPosted(key: string): void {
  recentPosts.set(key, Date.now());

  // Clean up old entries
  const cutoff = Date.now() - DEDUP_WINDOW_MS;
  for (const [k, v] of recentPosts.entries()) {
    if (v < cutoff) {
      recentPosts.delete(k);
    }
  }
}

/**
 * Process a single post job
 */
async function processPostJob(job: Job<PostJob>): Promise<{ success: boolean; tweetId?: string }> {
  const data = job.data;

  // Dedup check
  const key = getPostKey(data);
  if (isDuplicate(key)) {
    console.log(`[x-poster] Skipping duplicate: ${key}`);
    return { success: true, tweetId: 'skipped-duplicate' };
  }

  console.log(`[x-poster] Processing ${data.kind} post`);

  try {
    let result: any;

    switch (data.kind) {
      case 'opportunity':
      case 'flash': {
        // Format as opportunity thread
        const lines = data.lines || formatOpportunityThread({
          cardTitle: data.cardTitle || 'Unknown Card',
          spreadPct: data.spreadPct || 0,
          buyUrl: data.buyUrl,
          sellCompUrl: data.sellCompUrl,
          rationale: data.rationale,
          risks: data.risks || ['Price volatility', 'Condition variance'],
          timeWindow: 'Next 24-72h',
        });

        result = await postThread(lines);
        break;
      }

      case 'daily': {
        // Daily summary post
        const text = data.text || '📊 Daily PokeDAO Market Summary\n\nCheck our Telegram for detailed analysis!\n\n#PokemonTCG #TCGInvesting';
        result = await postText(text);
        break;
      }

      case 'text': {
        // Simple text post
        if (!data.text) {
          throw new Error('Text post requires text field');
        }
        result = await postText(data.text);
        break;
      }

      default:
        throw new Error(`Unknown post kind: ${data.kind}`);
    }

    markPosted(key);

    const tweetId = result?.data?.id || 'dry-run';
    console.log(`[x-poster] Posted successfully: ${tweetId}`);
    return { success: true, tweetId };

  } catch (error: any) {
    console.error(`[x-poster] Failed to post:`, error.message);
    throw error; // Let BullMQ handle retries
  }
}

/**
 * Start the X poster worker
 */
export function startXPoster(): Worker {
  const connection = new Redis(process.env.REDIS_URL || 'redis://localhost:6379/0');

  const worker = new Worker<PostJob>(
    POST_QUEUE,
    async (job) => processPostJob(job),
    {
      connection,
      concurrency: 1, // One at a time to respect rate limits
      limiter: {
        max: 10, // Max 10 posts per hour
        duration: 60 * 60 * 1000,
      },
    }
  );

  worker.on('completed', (job, result) => {
    console.log(`[x-poster] Job ${job.id} completed: ${result?.tweetId}`);
  });

  worker.on('failed', (job, err) => {
    console.error(`[x-poster] Job ${job?.id} failed:`, err.message);
  });

  console.log('[x-poster] Worker started');
  console.log(`[x-poster] Mode: ${process.env.POSTING_ENABLED === 'true' && process.env.POSTING_DRY_RUN === 'false' ? 'LIVE' : 'DRY RUN'}`);

  return worker;
}

/**
 * Queue a post for publishing
 */
export async function queuePost(data: PostJob): Promise<void> {
  const connection = new Redis(process.env.REDIS_URL || 'redis://localhost:6379/0');
  const queue = new Queue<PostJob>(POST_QUEUE, { connection });

  await queue.add(
    data.kind,
    data,
    {
      removeOnComplete: 100,
      removeOnFail: 50,
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 60000, // 1 minute initial delay
      },
    }
  );

  console.log(`[x-poster] Queued ${data.kind} post`);
}

/**
 * Queue an opportunity post
 */
export async function queueOpportunityPost(
  cardTitle: string,
  spreadPct: number,
  buyUrl?: string,
  rationale?: string,
  risks?: string[]
): Promise<void> {
  await queuePost({
    kind: 'opportunity',
    cardTitle,
    spreadPct,
    buyUrl,
    rationale,
    risks,
  });
}

// Export for standalone running
if (process.argv[1]?.endsWith('x-poster.ts') || process.argv[1]?.endsWith('x-poster.js')) {
  startXPoster();
}
