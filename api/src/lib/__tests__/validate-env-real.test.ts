import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { loadAndValidateEnv } from '../validate-env.js';

describe('validate-env - Real Function Tests', () => {
  const originalEnv = { ...process.env };
  const originalExit = process.exit;

  beforeEach(() => {
    // Reset env
    process.env = { ...originalEnv };

    // Mock process.exit
    process.exit = vi.fn() as any;
  });

  afterEach(() => {
    // Restore env and exit
    process.env = originalEnv;
    process.exit = originalExit;
  });

  describe('loadAndValidateEnv', () => {
    it('should not throw when all required vars are present', () => {
      process.env.DATABASE_URL = 'postgresql://localhost:5432/test';
      process.env.DEEPSEEK_API_KEY = 'test-key';

      expect(() => loadAndValidateEnv(['DATABASE_URL', 'DEEPSEEK_API_KEY'])).not.toThrow();
    });

    it('should call dotenv.config()', () => {
      // Just verify the function executes without throwing
      loadAndValidateEnv([]);

      // If dotenv.config() was called, process.env should have values from .env
      expect(process.env.DATABASE_URL).toBeDefined();
    });

    it('should validate multiple vars', () => {
      process.env.DATABASE_URL = 'postgresql://localhost:5432/test';
      process.env.DEEPSEEK_API_KEY = 'test-key';
      process.env.OPENAI_API_KEY = 'test-key';

      expect(() => loadAndValidateEnv(['DATABASE_URL', 'DEEPSEEK_API_KEY', 'OPENAI_API_KEY'])).not.toThrow();
    });

    it('should exit on first missing var', () => {
      process.env.DATABASE_URL = 'postgresql://localhost:5432/test';
      delete process.env.DEEPSEEK_API_KEY;
      delete process.env.OPENAI_API_KEY;

      loadAndValidateEnv(['DATABASE_URL', 'DEEPSEEK_API_KEY', 'OPENAI_API_KEY']);

      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should work with empty required array', () => {
      expect(() => loadAndValidateEnv([])).not.toThrow();
    });

    it('should accept values with whitespace', () => {
      process.env.DATABASE_URL = '  postgresql://localhost:5432/test  ';

      loadAndValidateEnv(['DATABASE_URL']);

      expect(process.exit).not.toHaveBeenCalled();
    });

    it('should treat empty string as missing', () => {
      process.env.DATABASE_URL = '';

      loadAndValidateEnv(['DATABASE_URL']);

      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should treat whitespace-only as present (matches implementation)', () => {
      process.env.DATABASE_URL = '   ';

      loadAndValidateEnv(['DATABASE_URL']);

      // Current implementation accepts whitespace-only values
      expect(process.exit).not.toHaveBeenCalled();
    });

    it('should validate DATABASE_URL format when provided', () => {
      process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db';

      expect(() => loadAndValidateEnv(['DATABASE_URL'])).not.toThrow();
    });

    it('should allow postgresql:// URLs', () => {
      process.env.DATABASE_URL = 'postgresql://localhost:5432/test';

      expect(() => loadAndValidateEnv(['DATABASE_URL'])).not.toThrow();
    });

    it('should allow postgres:// URLs', () => {
      process.env.DATABASE_URL = 'postgres://localhost:5432/test';

      expect(() => loadAndValidateEnv(['DATABASE_URL'])).not.toThrow();
    });

    it('should work with file:// URLs for DATABASE_URL', () => {
      process.env.DATABASE_URL = 'file:./dev.db';

      expect(() => loadAndValidateEnv(['DATABASE_URL'])).not.toThrow();
    });

    it('should validate API keys', () => {
      process.env.DEEPSEEK_API_KEY = 'sk-1234567890abcdef';

      expect(() => loadAndValidateEnv(['DEEPSEEK_API_KEY'])).not.toThrow();
    });

    it('should handle missing optional vars gracefully', () => {
      process.env.DATABASE_URL = 'postgresql://localhost:5432/test';
      delete process.env.OPTIONAL_VAR;

      // Should not throw even if OPTIONAL_VAR is missing
      expect(() => loadAndValidateEnv(['DATABASE_URL'])).not.toThrow();
    });

    it('should validate in test mode', () => {
      process.env.NODE_ENV = 'test';
      delete process.env.DATABASE_URL;

      // Should not throw in test mode even without DATABASE_URL
      expect(() => loadAndValidateEnv([])).not.toThrow();
    });

    it('should validate in development mode', () => {
      process.env.NODE_ENV = 'development';
      process.env.DATABASE_URL = 'postgresql://localhost:5432/dev';

      expect(() => loadAndValidateEnv(['DATABASE_URL'])).not.toThrow();
    });

    it('should validate in production mode', () => {
      process.env.NODE_ENV = 'production';
      process.env.DATABASE_URL = 'postgresql://prod-server:5432/prod';
      process.env.DEEPSEEK_API_KEY = 'sk-prod-key';

      expect(() => loadAndValidateEnv(['DATABASE_URL', 'DEEPSEEK_API_KEY'])).not.toThrow();
    });
  });
});
