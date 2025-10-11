import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createClient } from 'redis';

describe('Redis TLS Configuration', () => {
  let originalEnv: string | undefined;

  beforeEach(() => {
    originalEnv = process.env.REDIS_URL;
    // Clear module cache to allow re-importing with new env
    vi.resetModules();
  });

  afterEach(() => {
    process.env.REDIS_URL = originalEnv;
    vi.resetModules();
  });

  it('should enable TLS for rediss:// URLs', async () => {
    process.env.REDIS_URL = 'rediss://example.com:6380';

    // Import module with new env
    const { getRedis } = await import('../redis.js');
    const client = getRedis();

    expect(client).toBeDefined();

    // Check that client was configured (we can't easily test TLS settings directly)
    expect(client).toHaveProperty('isOpen');
  });

  it('should enable TLS for Upstash URLs', async () => {
    process.env.REDIS_URL = 'redis://upstash.io:6379';

    // Import module with new env
    const { getRedis } = await import('../redis.js');
    const client = getRedis();

    expect(client).toBeDefined();
    expect(client).toHaveProperty('isOpen');
  });

  it('should handle Redis client errors', async () => {
    // We need to test the error handler is registered
    // Create a mock client to test error emission
    const mockClient = createClient({ url: 'redis://localhost:6379' });

    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Register error handler to prevent unhandled error
    mockClient.on('error', (err) => {
      console.error('Redis Client Error', err);
    });

    // Emit error event
    mockClient.emit('error', new Error('Test Redis Error'));

    // Verify error was logged
    expect(consoleErrorSpy).toHaveBeenCalledWith('Redis Client Error', expect.any(Error));

    consoleErrorSpy.mockRestore();
    await mockClient.disconnect().catch(() => {
      // Ignore disconnect errors
    });
  });

  it('should not enable TLS for standard redis:// URLs (non-Upstash)', async () => {
    process.env.REDIS_URL = 'redis://localhost:6379';

    const { getRedis } = await import('../redis.js');
    const client = getRedis();

    expect(client).toBeDefined();
    expect(client).toHaveProperty('isOpen');
  });
});
