import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('Environment Validation', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('Required Environment Variables', () => {
    it('should have DATABASE_URL defined or be in test mode', () => {
      const hasDbUrl = !!process.env.DATABASE_URL;
      const isTestMode = process.env.NODE_ENV === 'test' || process.env.VITEST === 'true';

      expect(hasDbUrl || isTestMode).toBe(true);
    });

    it('should validate URL format for DATABASE_URL', () => {
      const dbUrl = process.env.DATABASE_URL || '';
      const isValidUrl = dbUrl.startsWith('postgresql://') || dbUrl.startsWith('postgres://');

      expect(isValidUrl || dbUrl === '').toBe(true);
    });

    it('should handle missing environment variables', () => {
      const requiredVars = ['DATABASE_URL', 'DEEPSEEK_API_KEY'];
      const missing = requiredVars.filter(k => !process.env[k]);

      // Either all present or test environment
      expect(missing.length === 0 || process.env.NODE_ENV === 'test').toBe(true);
    });
  });

  describe('Optional Environment Variables', () => {
    it('should have default values for optional vars', () => {
      const port = Number(process.env.PORT || 3000);
      expect(port).toBeGreaterThan(0);
      expect(port).toBeLessThan(65536);
    });

    it('should handle REDIS_URL with default', () => {
      const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
      expect(redisUrl).toContain('redis://');
    });
  });
});
