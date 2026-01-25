/**
 * BASE WORKER CLASS - Production Grade
 *
 * Common infrastructure for all data collection workers:
 * - Cron scheduling with distributed locking
 * - Retry logic with exponential backoff
 * - Rate limiting per API
 * - Deduplication
 * - Health monitoring & metrics
 * - Graceful shutdown
 */

import { CronJob } from 'cron';
import { Redis } from 'ioredis';
import pino from 'pino';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../../../api/prisma/generated/client/client.js';

export interface WorkerMetrics {
  lastRunAt: string | null;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  totalRuns: number;
  totalFailures: number;
  avgDurationMs: number;
  itemsProcessed: number;
}

export interface WorkerConfig {
  name: string;
  cronPattern: string;
  maxRetries?: number;
  retryDelayMs?: number;
  timeoutMs?: number;
}

export abstract class BaseWorker {
  protected name: string;
  protected cronPattern: string;
  protected job: CronJob;
  protected redis: Redis;
  protected logger: pino.Logger;
  protected isRunning = false;
  protected metrics: WorkerMetrics;

  protected maxRetries: number;
  protected retryDelayMs: number;
  protected timeoutMs: number;

  constructor(config: WorkerConfig) {
    this.name = config.name;
    this.cronPattern = config.cronPattern;
    this.maxRetries = config.maxRetries ?? 3;
    this.retryDelayMs = config.retryDelayMs ?? 1000;
    this.timeoutMs = config.timeoutMs ?? 60000;

    this.redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
    this.logger = pino({
      name: this.name,
      level: process.env.LOG_LEVEL || 'info',
    });
    this.metrics = this.initMetrics();
    this.job = new CronJob(this.cronPattern, () => this.safeRun());
  }

  private initMetrics(): WorkerMetrics {
    return {
      lastRunAt: null,
      lastSuccessAt: null,
      lastFailureAt: null,
      totalRuns: 0,
      totalFailures: 0,
      avgDurationMs: 0,
      itemsProcessed: 0,
    };
  }

  // ═══════════════════════════════════════════════════════
  // SAFE EXECUTION WRAPPER
  // ═══════════════════════════════════════════════════════

  private async safeRun(): Promise<void> {
    // Prevent overlapping runs
    if (this.isRunning) {
      this.logger.warn('Skipping run - previous execution still in progress');
      return;
    }

    // Distributed lock (prevent multiple instances)
    const lockKey = `worker:lock:${this.name}`;
    const lockValue = `${process.pid}-${Date.now()}`;
    const locked = await this.redis.set(lockKey, lockValue, 'EX', 300, 'NX');

    if (!locked) {
      this.logger.warn('Skipping run - another instance holds the lock');
      return;
    }

    this.isRunning = true;
    const startTime = Date.now();
    this.metrics.lastRunAt = new Date().toISOString();
    this.metrics.totalRuns++;

    try {
      await Promise.race([this.run(), this.timeout(this.timeoutMs)]);

      this.metrics.lastSuccessAt = new Date().toISOString();
      this.logger.info(
        { durationMs: Date.now() - startTime },
        'Worker completed successfully'
      );
    } catch (error) {
      this.metrics.lastFailureAt = new Date().toISOString();
      this.metrics.totalFailures++;

      this.logger.error(
        {
          error: (error as Error).message,
          stack: (error as Error).stack,
        },
        'Worker failed'
      );

      await this.onError(error as Error);
    } finally {
      this.isRunning = false;

      // Only release lock if we still own it
      const currentLock = await this.redis.get(lockKey);
      if (currentLock === lockValue) {
        await this.redis.del(lockKey);
      }

      this.updateAvgDuration(Date.now() - startTime);
      await this.recordHeartbeat();
    }
  }

  // ═══════════════════════════════════════════════════════
  // ABSTRACT METHODS - IMPLEMENT IN EACH WORKER
  // ═══════════════════════════════════════════════════════

  protected abstract run(): Promise<void>;

  protected async onError(_error: Error): Promise<void> {
    // Override in subclass for custom error handling
  }

  // ═══════════════════════════════════════════════════════
  // RETRY LOGIC
  // ═══════════════════════════════════════════════════════

  protected async withRetry<T>(
    operation: () => Promise<T>,
    context: string
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;

        if (this.isNonRetryable(error as Error)) {
          this.logger.error(
            { context, error: (error as Error).message },
            'Non-retryable error'
          );
          throw error;
        }

        if (attempt < this.maxRetries) {
          const delay = this.retryDelayMs * Math.pow(2, attempt - 1);
          this.logger.warn(
            {
              attempt,
              maxRetries: this.maxRetries,
              context,
              nextRetryMs: delay,
              error: (error as Error).message,
            },
            'Retrying operation'
          );

          await this.sleep(delay);
        }
      }
    }

    throw lastError;
  }

  private isNonRetryable(error: Error): boolean {
    const message = error.message.toLowerCase();
    return (
      message.includes('validation') ||
      message.includes('400') ||
      message.includes('401') ||
      message.includes('403') ||
      message.includes('404') ||
      message.includes('invalid')
    );
  }

  // ═══════════════════════════════════════════════════════
  // RATE LIMITING
  // ═══════════════════════════════════════════════════════

  protected async rateLimitedFetch(
    url: string,
    options: RequestInit = {},
    rateKey: string,
    requestsPerMinute: number
  ): Promise<Response> {
    const rateLimitKey = `ratelimit:${this.name}:${rateKey}`;

    const current = await this.redis.incr(rateLimitKey);
    if (current === 1) {
      await this.redis.expire(rateLimitKey, 60);
    }

    if (current > requestsPerMinute) {
      const ttl = await this.redis.ttl(rateLimitKey);
      this.logger.warn(
        { rateKey, ttl, current, limit: requestsPerMinute },
        'Rate limit reached, waiting'
      );
      await this.sleep(ttl * 1000);
      return this.rateLimitedFetch(url, options, rateKey, requestsPerMinute);
    }

    const response = await fetch(url, {
      ...options,
      headers: {
        'User-Agent': 'PokeDao/1.0',
        ...options.headers,
      },
    });

    // Handle rate limit responses
    if (response.status === 429) {
      const retryAfter = parseInt(response.headers.get('Retry-After') || '60');
      this.logger.warn({ rateKey, retryAfter }, 'Got 429, backing off');
      await this.sleep(retryAfter * 1000);
      return this.rateLimitedFetch(url, options, rateKey, requestsPerMinute);
    }

    return response;
  }

  // ═══════════════════════════════════════════════════════
  // DEDUPLICATION
  // ═══════════════════════════════════════════════════════

  protected async isDuplicate(uniqueKey: string): Promise<boolean> {
    const key = `dedup:${this.name}:${uniqueKey}`;
    const exists = await this.redis.exists(key);
    return exists === 1;
  }

  protected async markProcessed(
    uniqueKey: string,
    ttlSeconds: number = 86400
  ): Promise<void> {
    const key = `dedup:${this.name}:${uniqueKey}`;
    await this.redis.set(key, '1', 'EX', ttlSeconds);
  }

  // ═══════════════════════════════════════════════════════
  // HEALTH & METRICS
  // ═══════════════════════════════════════════════════════

  private async recordHeartbeat(): Promise<void> {
    const healthKey = `worker:health:${this.name}`;
    await this.redis.hset(healthKey, {
      lastHeartbeat: Date.now().toString(),
      status: this.isRunning ? 'running' : 'idle',
      pid: process.pid.toString(),
      lastRunAt: this.metrics.lastRunAt || '',
      lastSuccessAt: this.metrics.lastSuccessAt || '',
      lastFailureAt: this.metrics.lastFailureAt || '',
      totalRuns: this.metrics.totalRuns.toString(),
      totalFailures: this.metrics.totalFailures.toString(),
      avgDurationMs: this.metrics.avgDurationMs.toString(),
      itemsProcessed: this.metrics.itemsProcessed.toString(),
    });
    await this.redis.expire(healthKey, 600); // 10 min TTL
  }

  private updateAvgDuration(durationMs: number): void {
    const runs = this.metrics.totalRuns;
    this.metrics.avgDurationMs = Math.round(
      (this.metrics.avgDurationMs * (runs - 1) + durationMs) / runs
    );
  }

  protected incrementItemsProcessed(count: number = 1): void {
    this.metrics.itemsProcessed += count;
  }

  public getMetrics(): WorkerMetrics {
    return { ...this.metrics };
  }

  public getStatus(): {
    name: string;
    isRunning: boolean;
    metrics: WorkerMetrics;
  } {
    return {
      name: this.name,
      isRunning: this.isRunning,
      metrics: this.getMetrics(),
    };
  }

  // ═══════════════════════════════════════════════════════
  // UTILITIES
  // ═══════════════════════════════════════════════════════

  private timeout(ms: number): Promise<never> {
    return new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`Worker timeout after ${ms}ms`)), ms)
    );
  }

  protected sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // Alias for sleep (backwards compatibility)
  protected delay(ms: number): Promise<void> {
    return this.sleep(ms);
  }

  // Prisma client getter (lazy initialization)
  protected async getPrisma(): Promise<PrismaClient> {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const adapter = new PrismaPg(pool);
    return new PrismaClient({ adapter });
  }

  // ═══════════════════════════════════════════════════════
  // LIFECYCLE
  // ═══════════════════════════════════════════════════════

  public start(): void {
    this.job.start();
    this.logger.info({ cronPattern: this.cronPattern }, 'Worker started');
  }

  public stop(): void {
    this.job.stop();
    this.logger.info('Worker stopped');
  }

  public async runOnce(): Promise<void> {
    await this.safeRun();
  }

  public async shutdown(): Promise<void> {
    this.stop();
    await this.redis.quit();
    this.logger.info('Worker shutdown complete');
  }
}
