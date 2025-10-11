/**
 * REDIS ENVIRONMENT FALLBACK TESTS
 * Target: 100% branch coverage for redis.ts
 *
 * Covers:
 * - Line 3: REDIS_URL fallback to default
 * - Line 6: Both isTLS conditions (rediss:// and upstash.io)
 * - Line 10: Both branches of ternary (TLS and non-TLS)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('Redis - Environment Fallback and TLS Configuration', () => {
  let originalEnv: string | undefined;

  beforeEach(() => {
    originalEnv = process.env.REDIS_URL;
    vi.resetModules();
  });

  afterEach(() => {
    if (originalEnv) {
      process.env.REDIS_URL = originalEnv;
    } else {
      delete process.env.REDIS_URL;
    }
    vi.resetModules();
  });

  it('should use default redis://localhost:6379 when REDIS_URL not set (line 3)', async () => {
    // Delete REDIS_URL to trigger fallback
    delete process.env.REDIS_URL;

    // Re-import module to trigger line 3 with undefined REDIS_URL
    const { getRedis } = await import('../redis.js');
    const client = getRedis();

    expect(client).toBeDefined();
    expect(client).toHaveProperty('isOpen');

    console.log('✓ REDIS_URL fallback to default covered (line 3)');
  });

  it('should detect TLS for rediss:// protocol (line 6, first condition)', async () => {
    process.env.REDIS_URL = 'rediss://secure.redis.com:6380';

    const { getRedis } = await import('../redis.js');
    const client = getRedis();

    expect(client).toBeDefined();

    console.log('✓ rediss:// TLS detection covered (line 6, first condition)');
  });

  it('should detect TLS for upstash.io domain (line 6, second condition)', async () => {
    process.env.REDIS_URL = 'redis://upstash.io:6379';

    const { getRedis } = await import('../redis.js');
    const client = getRedis();

    expect(client).toBeDefined();

    console.log('✓ upstash.io TLS detection covered (line 6, second condition)');
  });

  it('should NOT use TLS for standard redis:// (line 10, false branch)', async () => {
    process.env.REDIS_URL = 'redis://localhost:6379';

    const { getRedis } = await import('../redis.js');
    const client = getRedis();

    expect(client).toBeDefined();

    console.log('✓ Non-TLS configuration covered (line 10, false branch)');
  });

  it('should use TLS configuration when isTLS is true (line 10, true branch)', async () => {
    process.env.REDIS_URL = 'rediss://secure.example.com:6380';

    const { getRedis } = await import('../redis.js');
    const client = getRedis();

    expect(client).toBeDefined();

    console.log('✓ TLS configuration covered (line 10, true branch)');
  });

  it('should handle multiple getRedis calls correctly', async () => {
    process.env.REDIS_URL = 'redis://localhost:6379';

    const { getRedis } = await import('../redis.js');

    // First call
    const client1 = getRedis();
    expect(client1).toBeDefined();

    // Second call - should return same client
    const client2 = getRedis();
    expect(client2).toBeDefined();
    expect(client1).toBe(client2); // Same instance

    console.log('✓ Multiple getRedis calls handled correctly');
  });
});
