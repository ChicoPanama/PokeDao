/**
 * WORKER HEALTH ENDPOINT
 *
 * HTTP server for health checks and metrics.
 * Used by Kubernetes probes and monitoring.
 */

import { createServer, IncomingMessage, ServerResponse } from 'http';
import pino from 'pino';
import { registry, RegistryStatus } from './registry.js';

const logger = pino({ name: 'worker-health' });

interface HealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  workers: RegistryStatus;
}

function getHealthStatus(): HealthResponse {
  const status = registry.getStatus();

  // Determine overall health
  let healthStatus: 'healthy' | 'degraded' | 'unhealthy';

  if (status.totalWorkers === 0) {
    healthStatus = 'unhealthy';
  } else if (status.healthyWorkers === status.totalWorkers) {
    healthStatus = 'healthy';
  } else if (status.healthyWorkers > 0) {
    healthStatus = 'degraded';
  } else {
    healthStatus = 'unhealthy';
  }

  return {
    status: healthStatus,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    workers: status,
  };
}

function handleRequest(req: IncomingMessage, res: ServerResponse): void {
  const url = req.url || '/';

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  if (url === '/health' || url === '/') {
    const health = getHealthStatus();
    const statusCode = health.status === 'unhealthy' ? 503 : 200;

    res.writeHead(statusCode);
    res.end(JSON.stringify(health, null, 2));
    return;
  }

  if (url === '/ready') {
    // Kubernetes readiness - are we ready to receive traffic?
    const health = getHealthStatus();
    const ready = health.status !== 'unhealthy';

    res.writeHead(ready ? 200 : 503);
    res.end(JSON.stringify({ ready, timestamp: new Date().toISOString() }));
    return;
  }

  if (url === '/live') {
    // Kubernetes liveness - is the process alive?
    res.writeHead(200);
    res.end(JSON.stringify({ alive: true, timestamp: new Date().toISOString() }));
    return;
  }

  if (url === '/metrics') {
    // Prometheus-style metrics
    const health = getHealthStatus();
    const metrics: string[] = [
      '# HELP workers_total Total number of registered workers',
      '# TYPE workers_total gauge',
      `workers_total ${health.workers.totalWorkers}`,
      '',
      '# HELP workers_running Currently running workers',
      '# TYPE workers_running gauge',
      `workers_running ${health.workers.runningWorkers}`,
      '',
      '# HELP workers_healthy Healthy workers',
      '# TYPE workers_healthy gauge',
      `workers_healthy ${health.workers.healthyWorkers}`,
      '',
      '# HELP worker_uptime_seconds Process uptime in seconds',
      '# TYPE worker_uptime_seconds counter',
      `worker_uptime_seconds ${Math.floor(health.uptime)}`,
    ];

    // Per-worker metrics
    for (const worker of health.workers.workers) {
      const safeName = worker.name.replace(/-/g, '_');
      metrics.push('');
      metrics.push(`# HELP worker_${safeName}_runs_total Total runs for ${worker.name}`);
      metrics.push(`# TYPE worker_${safeName}_runs_total counter`);
      metrics.push(`worker_${safeName}_runs_total ${worker.metrics.totalRuns}`);
      metrics.push(`# HELP worker_${safeName}_failures_total Total failures for ${worker.name}`);
      metrics.push(`# TYPE worker_${safeName}_failures_total counter`);
      metrics.push(`worker_${safeName}_failures_total ${worker.metrics.totalFailures}`);
      metrics.push(`# HELP worker_${safeName}_avg_duration_ms Average duration for ${worker.name}`);
      metrics.push(`# TYPE worker_${safeName}_avg_duration_ms gauge`);
      metrics.push(`worker_${safeName}_avg_duration_ms ${worker.metrics.avgDurationMs}`);
      metrics.push(`# HELP worker_${safeName}_items_processed Items processed by ${worker.name}`);
      metrics.push(`# TYPE worker_${safeName}_items_processed counter`);
      metrics.push(`worker_${safeName}_items_processed ${worker.metrics.itemsProcessed}`);
    }

    res.setHeader('Content-Type', 'text/plain');
    res.writeHead(200);
    res.end(metrics.join('\n'));
    return;
  }

  if (url.startsWith('/worker/') && req.method === 'POST') {
    // Manual worker trigger: POST /worker/{name}/run
    const parts = url.split('/');
    if (parts.length >= 4 && parts[3] === 'run') {
      const workerName = parts[2];

      registry
        .runOnce(workerName)
        .then(() => {
          res.writeHead(200);
          res.end(JSON.stringify({ success: true, worker: workerName }));
        })
        .catch((error) => {
          res.writeHead(404);
          res.end(JSON.stringify({ error: (error as Error).message }));
        });
      return;
    }
  }

  // 404 for unknown routes
  res.writeHead(404);
  res.end(JSON.stringify({ error: 'Not found' }));
}

export function startHealthServer(port: number = 3001): void {
  const server = createServer(handleRequest);

  server.listen(port, () => {
    logger.info({ port }, 'Health server started');
    logger.info(`  GET /health  - Full health status`);
    logger.info(`  GET /ready   - Kubernetes readiness probe`);
    logger.info(`  GET /live    - Kubernetes liveness probe`);
    logger.info(`  GET /metrics - Prometheus metrics`);
    logger.info(`  POST /worker/{name}/run - Manual trigger`);
  });

  // Graceful shutdown
  process.on('SIGTERM', () => {
    logger.info('SIGTERM received, closing health server...');
    server.close(() => {
      logger.info('Health server closed');
    });
  });
}
