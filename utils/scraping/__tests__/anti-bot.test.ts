/**
 * Anti-Bot Detection and Evasion Utilities - Test Suite
 * 
 * @author PokeDAO Builder - Phase 3 Fork Integration
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AntiBot, RateBudgetManager, SessionContext } from '../anti-bot';

describe('AntiBot', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset any static state
    AntiBot.cleanupSessions();
  });

  describe('randomizeUserAgent', () => {
    it('should return a valid user agent string', () => {
      const userAgent = AntiBot.randomizeUserAgent();
      expect(userAgent).toBeTruthy();
      expect(userAgent).toContain('Mozilla');
    });

    it('should return different user agents on multiple calls', () => {
      const agents = new Set();
      for (let i = 0; i < 20; i++) {
        agents.add(AntiBot.randomizeUserAgent());
      }
      // Should have some variety (not guaranteed to be all different due to randomness)
      expect(agents.size).toBeGreaterThan(1);
    });
  });

  describe('calculateJitter', () => {
    it('should add natural jitter to delays', () => {
      const baseDelay = 1000;
      const jitteredDelay = AntiBot.calculateJitter(baseDelay, 'search');
      
      expect(jitteredDelay).toBeGreaterThan(0);
      // Should be reasonably close to base delay but not exact
      expect(Math.abs(jitteredDelay - baseDelay)).toBeLessThan(baseDelay);
    });

    it('should respect minimum and maximum delays', () => {
      const verySmallDelay = AntiBot.calculateJitter(100, 'search');
      const veryLargeDelay = AntiBot.calculateJitter(10000, 'search');
      
      expect(verySmallDelay).toBeGreaterThanOrEqual(800); // Minimum
      expect(veryLargeDelay).toBeLessThanOrEqual(3000); // Maximum
    });

    it('should apply different modifiers for request types', () => {
      const baseDelay = 1000;
      const searchDelay = AntiBot.calculateJitter(baseDelay, 'search');
      const detailDelay = AntiBot.calculateJitter(baseDelay, 'detail');
      const listDelay = AntiBot.calculateJitter(baseDelay, 'list');
      
      // Due to randomness, we can't guarantee exact relationships,
      // but we can test the general pattern over multiple runs
      const searchDelays = Array.from({ length: 10 }, () => 
        AntiBot.calculateJitter(baseDelay, 'search')
      );
      const detailDelays = Array.from({ length: 10 }, () => 
        AntiBot.calculateJitter(baseDelay, 'detail')
      );
      
      const avgSearchDelay = searchDelays.reduce((a, b) => a + b) / searchDelays.length;
      const avgDetailDelay = detailDelays.reduce((a, b) => a + b) / detailDelays.length;
      
      // Search should generally be slower than detail
      expect(avgSearchDelay).toBeGreaterThan(avgDetailDelay * 0.9);
    });
  });

  describe('detectCaptcha', () => {
    it('should detect CAPTCHA in response content', () => {
      const responses = [
        'Please complete the CAPTCHA to continue',
        'reCAPTCHA verification required',
        'Prove you are human',
        'Robot detection activated'
      ];

      responses.forEach(response => {
        const signals = AntiBot.detectCaptcha(response);
        expect(signals.captchaDetected).toBe(true);
      });
    });

    it('should detect rate limiting', () => {
      const rateLimitResponse = 'Rate limit exceeded. Try again later.';
      const headers = { 'retry-after': '60' };
      
      const signals = AntiBot.detectCaptcha(rateLimitResponse, headers);
      expect(signals.rateLimitHit).toBe(true);
    });

    it('should detect IP blocking', () => {
      const blockResponse = 'Your IP address has been blocked';
      const signals = AntiBot.detectCaptcha(blockResponse);
      expect(signals.ipBlocked).toBe(true);
    });

    it('should handle normal responses without flags', () => {
      const normalResponse = '<html><body>Welcome to our site</body></html>';
      const signals = AntiBot.detectCaptcha(normalResponse);
      
      expect(signals.captchaDetected).toBe(false);
      expect(signals.rateLimitHit).toBe(false);
      expect(signals.ipBlocked).toBe(false);
      expect(signals.behaviorFlagged).toBe(false);
      expect(signals.sessionInvalidated).toBe(false);
    });
  });

  describe('handleRateLimit', () => {
    it('should parse retry-after header', () => {
      const mockResponse = {
        status: 429,
        headers: {
          get: (key: string) => key === 'retry-after' ? '30' : null
        }
      } as unknown as Response;

      const currentStrategy = {
        currentDelay: 1000,
        nextDelay: 1000,
        requestsInWindow: 10,
        windowReset: new Date(),
        backoffLevel: 0,
        shouldPause: false
      };

      const newStrategy = AntiBot.handleRateLimit(mockResponse, currentStrategy);
      
      expect(newStrategy.currentDelay).toBe(30000); // 30 seconds
      expect(newStrategy.backoffLevel).toBe(1); // Increased
    });

    it('should implement exponential backoff', () => {
      const mockResponse = {
        status: 429,
        headers: {
          get: () => null
        }
      } as unknown as Response;

      let strategy = {
        currentDelay: 1000,
        nextDelay: 1000,
        requestsInWindow: 10,
        windowReset: new Date(),
        backoffLevel: 0,
        shouldPause: false
      };

      // Multiple rate limit hits should increase backoff
      for (let i = 0; i < 3; i++) {
        strategy = AntiBot.handleRateLimit(mockResponse, strategy);
      }
      
      expect(strategy.backoffLevel).toBe(3);
      expect(strategy.currentDelay).toBeGreaterThan(1000);
    });
  });

  describe('generateNaturalHeaders', () => {
    it('should generate realistic browser headers', () => {
      const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
      const headers = AntiBot.generateNaturalHeaders(userAgent);
      
      expect(headers['User-Agent']).toBe(userAgent);
      expect(headers['Accept']).toContain('text/html');
      expect(headers['Accept-Language']).toContain('en-US');
      expect(headers['DNT']).toBe('1');
    });

    it('should include referer when provided', () => {
      const userAgent = 'test-agent';
      const referer = 'https://example.com';
      const headers = AntiBot.generateNaturalHeaders(userAgent, referer);
      
      expect(headers['Referer']).toBe(referer);
      expect(headers['Sec-Fetch-Site']).toBe('same-origin');
    });

    it('should add source-specific headers', () => {
      const userAgent = 'test-agent';
      const headers = AntiBot.generateNaturalHeaders(userAgent, undefined, 'goldin');
      
      expect(headers['X-Requested-With']).toBe('XMLHttpRequest');
    });
  });

  describe('simulateHumanBehavior', () => {
    it('should simulate page load delays', async () => {
      const start = Date.now();
      await AntiBot.simulateHumanBehavior('page_load', { pageSize: 2000 });
      const elapsed = Date.now() - start;
      
      // Should take some reasonable time (adjusted for test speed)
      expect(elapsed).toBeGreaterThan(100);
      expect(elapsed).toBeLessThan(10000);
    });

    it('should simulate search typing delays', async () => {
      const start = Date.now();
      await AntiBot.simulateHumanBehavior('search', { searchTerms: 'pokemon card' });
      const elapsed = Date.now() - start;
      
      expect(elapsed).toBeGreaterThan(100);
    });

    it('should handle different action types', async () => {
      const actions = ['page_load', 'search', 'scroll', 'click'] as const;
      
      for (const action of actions) {
        const start = Date.now();
        await AntiBot.simulateHumanBehavior(action);
        const elapsed = Date.now() - start;
        expect(elapsed).toBeGreaterThan(50); // Some minimum delay
      }
    });
  });

  describe('session management', () => {
    it('should create new sessions', () => {
      const session = AntiBot.createSession('ebay');
      
      expect(session.source).toBe('ebay');
      expect(session.sessionId).toBeTruthy();
      expect(session.userAgent).toBeTruthy();
      expect(session.requestCount).toBe(0);
      expect(session.failureCount).toBe(0);
    });

    it('should update session state', () => {
      const session = AntiBot.createSession('test');
      const updated = AntiBot.updateSession(session.sessionId, true);
      
      expect(updated).toBeTruthy();
      expect(updated!.requestCount).toBe(1);
      expect(updated!.failureCount).toBe(0);
    });

    it('should handle session failures', () => {
      const session = AntiBot.createSession('test');
      
      // Multiple failures
      AntiBot.updateSession(session.sessionId, false);
      AntiBot.updateSession(session.sessionId, false);
      const updated = AntiBot.updateSession(session.sessionId, false);
      
      expect(updated!.failureCount).toBe(3);
    });

    it('should determine when to rotate sessions', () => {
      const session = AntiBot.createSession('test');
      
      // Fresh session should not need rotation
      expect(AntiBot.shouldRotateSession(session)).toBe(false);
      
      // High failure count should trigger rotation
      session.failureCount = 10;
      expect(AntiBot.shouldRotateSession(session)).toBe(true);
      
      // High request count should trigger rotation
      session.failureCount = 0;
      session.requestCount = 200;
      expect(AntiBot.shouldRotateSession(session)).toBe(true);
    });
  });
});

describe('RateBudgetManager', () => {
  describe('checkRateBudget', () => {
    it('should allow requests within budget', () => {
      const windowStart = new Date(Date.now() - 30 * 60 * 1000); // 30 min ago
      const windowEnd = new Date(Date.now() + 30 * 60 * 1000);   // 30 min from now
      
      const result = RateBudgetManager.checkRateBudget(
        'ebay',
        'search',
        5,  // current count
        windowStart,
        windowEnd,
        100 // max requests
      );
      
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(95);
      expect(result.suggestedDelay).toBeGreaterThan(0);
    });

    it('should deny requests when budget exceeded', () => {
      const windowStart = new Date(Date.now() - 30 * 60 * 1000);
      const windowEnd = new Date(Date.now() + 30 * 60 * 1000);
      
      const result = RateBudgetManager.checkRateBudget(
        'ebay',
        'search',
        100, // current count equals max
        windowStart,
        windowEnd,
        100  // max requests
      );
      
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
      expect(result.suggestedDelay).toBeGreaterThan(0);
    });

    it('should handle expired windows', () => {
      const windowStart = new Date(Date.now() - 2 * 60 * 60 * 1000); // 2 hours ago
      const windowEnd = new Date(Date.now() - 1 * 60 * 60 * 1000);   // 1 hour ago
      
      const result = RateBudgetManager.checkRateBudget(
        'ebay',
        'search',
        100, // Even if this was maxed out
        windowStart,
        windowEnd,
        100
      );
      
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(99); // New window, minus this request
    });
  });

  describe('updateRateBudget', () => {
    it('should increment request count', () => {
      const currentBudget = {
        currentCount: 5,
        windowStart: new Date(),
        windowEnd: new Date(Date.now() + 3600000)
      };
      
      const updated = RateBudgetManager.updateRateBudget(currentBudget, true);
      
      expect(updated.currentCount).toBe(6);
      expect(updated.lastRequestAt).toBeInstanceOf(Date);
    });

    it('should preserve window times', () => {
      const windowStart = new Date(Date.now() - 1000);
      const windowEnd = new Date(Date.now() + 1000);
      
      const currentBudget = {
        currentCount: 5,
        windowStart,
        windowEnd
      };
      
      const updated = RateBudgetManager.updateRateBudget(currentBudget, false);
      
      expect(updated.windowStart).toBe(windowStart);
      expect(updated.windowEnd).toBe(windowEnd);
    });
  });
});

// Performance and integration tests
describe('AntiBot Integration', () => {
  it('should handle high-frequency operations efficiently', () => {
    const start = Date.now();
    
    // Simulate 100 rapid operations
    for (let i = 0; i < 100; i++) {
      AntiBot.randomizeUserAgent();
      AntiBot.calculateJitter(1000, 'search');
      AntiBot.detectCaptcha('normal response');
    }
    
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(1000); // Should complete quickly
  });

  it('should maintain session state consistency', () => {
    const sessions: SessionContext[] = [];
    
    // Create multiple sessions
    for (let i = 0; i < 10; i++) {
      sessions.push(AntiBot.createSession(`source-${i}`));
    }
    
    // Update all sessions
    sessions.forEach((session, index) => {
      for (let j = 0; j < index + 1; j++) {
        AntiBot.updateSession(session.sessionId, j % 2 === 0);
      }
    });
    
    // Verify final states
    sessions.forEach((session, index) => {
      const updated = AntiBot.updateSession(session.sessionId, true);
      expect(updated).toBeTruthy();
      expect(updated!.requestCount).toBe(index + 2); // Original updates + this one
    });
  });

  it('should handle edge cases gracefully', () => {
    // Null/undefined inputs
    expect(AntiBot.updateSession('nonexistent', true)).toBeNull();
    
    // Empty responses
    const signals = AntiBot.detectCaptcha('');
    expect(signals).toBeTruthy();
    
    // Edge case delays
    const zeroDelay = AntiBot.calculateJitter(0, 'search');
    expect(zeroDelay).toBeGreaterThan(0);
  });
});
