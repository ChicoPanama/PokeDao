/**
 * MEW-1A KEEP-WARM WORKER
 *
 * Pings MEW-1A every 5 minutes to prevent cold starts.
 * Cold starts take 60-90 seconds on Modal Labs.
 */

const MEW_HEALTH_URL = process.env.MEW_HEALTH_URL ||
  'https://chicopanama--mew1a-vllm-v4-3-vector-rag-fastapi-app.modal.run/health';

const PING_INTERVAL_MS = Number(process.env.MEW_PING_INTERVAL_MS || 5 * 60 * 1000); // 5 min

let isRunning = false;
let pingCount = 0;
let lastPingTime: Date | null = null;
let lastPingStatus: 'success' | 'error' | null = null;

async function pingMew(): Promise<boolean> {
  const start = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000); // 30s timeout

    const response = await fetch(MEW_HEALTH_URL, {
      method: 'GET',
      signal: controller.signal,
    });

    clearTimeout(timeout);
    const latency = Date.now() - start;

    if (response.ok) {
      console.log(`[mew-keepwarm] Health check OK (${latency}ms)`);
      lastPingStatus = 'success';
      return true;
    } else {
      console.warn(`[mew-keepwarm] Health check failed: ${response.status}`);
      lastPingStatus = 'error';
      return false;
    }
  } catch (error) {
    const latency = Date.now() - start;
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[mew-keepwarm] Health check error (${latency}ms): ${msg}`);
    lastPingStatus = 'error';
    return false;
  } finally {
    lastPingTime = new Date();
    pingCount++;
  }
}

async function runKeepWarmLoop() {
  console.log('[mew-keepwarm] Starting keep-warm worker...');
  console.log(`[mew-keepwarm] Ping interval: ${PING_INTERVAL_MS / 1000}s`);
  console.log(`[mew-keepwarm] Health URL: ${MEW_HEALTH_URL}`);

  isRunning = true;

  // Initial ping
  await pingMew();

  while (isRunning) {
    await new Promise(resolve => setTimeout(resolve, PING_INTERVAL_MS));
    if (isRunning) {
      await pingMew();
    }
  }

  console.log('[mew-keepwarm] Worker stopped');
}

export function startMewKeepWarm() {
  if (isRunning) {
    console.log('[mew-keepwarm] Already running');
    return;
  }
  runKeepWarmLoop().catch(err => {
    console.error('[mew-keepwarm] Fatal error:', err);
    isRunning = false;
  });
}

export function stopMewKeepWarm() {
  console.log('[mew-keepwarm] Stopping...');
  isRunning = false;
}

export function getMewKeepWarmStatus() {
  return {
    isRunning,
    pingCount,
    lastPingTime,
    lastPingStatus,
  };
}

// Auto-start if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  startMewKeepWarm();
}
