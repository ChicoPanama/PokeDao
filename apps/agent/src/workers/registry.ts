/**
 * WORKER REGISTRY - Manages all worker instances
 *
 * Central registry for:
 * - Worker lifecycle management
 * - Status aggregation
 * - Graceful shutdown coordination
 */

import pino from 'pino';
import { BaseWorker, WorkerMetrics } from './base-worker.js';

export interface WorkerStatus {
  name: string;
  isRunning: boolean;
  enabled: boolean;
  metrics: WorkerMetrics;
}

export interface RegistryStatus {
  workers: WorkerStatus[];
  totalWorkers: number;
  runningWorkers: number;
  healthyWorkers: number;
}

class WorkerRegistry {
  private workers: Map<string, BaseWorker> = new Map();
  private enabledFlags: Map<string, boolean> = new Map();
  private logger = pino({ name: 'worker-registry' });

  /**
   * Register a worker with optional enable flag
   */
  register(worker: BaseWorker, enabled: boolean = true): void {
    const name = worker.getStatus().name;
    this.workers.set(name, worker);
    this.enabledFlags.set(name, enabled);
    this.logger.info({ worker: name, enabled }, 'Worker registered');
  }

  /**
   * Start all enabled workers
   */
  startAll(): void {
    for (const [name, worker] of this.workers) {
      if (this.enabledFlags.get(name)) {
        worker.start();
        this.logger.info({ worker: name }, 'Worker started');
      } else {
        this.logger.info({ worker: name }, 'Worker disabled, skipping');
      }
    }
  }

  /**
   * Stop all workers
   */
  stopAll(): void {
    for (const [name, worker] of this.workers) {
      worker.stop();
      this.logger.info({ worker: name }, 'Worker stopped');
    }
  }

  /**
   * Graceful shutdown of all workers
   */
  async shutdownAll(): Promise<void> {
    this.logger.info('Initiating graceful shutdown of all workers...');

    const shutdownPromises = Array.from(this.workers.entries()).map(
      async ([name, worker]) => {
        try {
          await worker.shutdown();
          this.logger.info({ worker: name }, 'Worker shutdown complete');
        } catch (error) {
          this.logger.error(
            { worker: name, error: (error as Error).message },
            'Worker shutdown failed'
          );
        }
      }
    );

    await Promise.all(shutdownPromises);
    this.logger.info('All workers shutdown complete');
  }

  /**
   * Get status of all workers
   */
  getStatus(): RegistryStatus {
    const workers: WorkerStatus[] = [];
    let runningCount = 0;
    let healthyCount = 0;

    for (const [name, worker] of this.workers) {
      const status = worker.getStatus();
      const enabled = this.enabledFlags.get(name) ?? false;

      workers.push({
        name,
        isRunning: status.isRunning,
        enabled,
        metrics: status.metrics,
      });

      if (status.isRunning) runningCount++;

      // Consider healthy if enabled and either running or recently successful
      if (enabled) {
        const lastSuccess = status.metrics.lastSuccessAt;
        const lastFailure = status.metrics.lastFailureAt;

        if (lastSuccess && (!lastFailure || lastSuccess > lastFailure)) {
          healthyCount++;
        } else if (!lastSuccess && !lastFailure && !status.isRunning) {
          // Not yet run, consider healthy
          healthyCount++;
        }
      }
    }

    return {
      workers,
      totalWorkers: this.workers.size,
      runningWorkers: runningCount,
      healthyWorkers: healthyCount,
    };
  }

  /**
   * Get a specific worker by name
   */
  getWorker(name: string): BaseWorker | undefined {
    return this.workers.get(name);
  }

  /**
   * Run a specific worker once (for testing/manual triggers)
   */
  async runOnce(name: string): Promise<void> {
    const worker = this.workers.get(name);
    if (!worker) {
      throw new Error(`Worker not found: ${name}`);
    }
    await worker.runOnce();
  }

  /**
   * Enable/disable a worker at runtime
   */
  setEnabled(name: string, enabled: boolean): void {
    if (!this.workers.has(name)) {
      throw new Error(`Worker not found: ${name}`);
    }

    this.enabledFlags.set(name, enabled);
    const worker = this.workers.get(name)!;

    if (enabled) {
      worker.start();
      this.logger.info({ worker: name }, 'Worker enabled and started');
    } else {
      worker.stop();
      this.logger.info({ worker: name }, 'Worker disabled and stopped');
    }
  }
}

// Singleton instance
export const registry = new WorkerRegistry();
