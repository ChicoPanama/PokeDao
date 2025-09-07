/**
 * Anti-Bot Detection and Evasion Utilities
 * 
 * Advanced patterns for natural request timing, user agent rotation,
 * and graceful handling of anti-bot measures. Integrates with PokeDAO
 * RateBudget table for intelligent rate limiting.
 * 
 * @author PokeDAO Builder - Phase 3 Fork Integration
 * @inspired_by Advanced scraping and bot detection evasion patterns
 */

export interface RateLimitStrategy {
  currentDelay: number;
  nextDelay: number;
  requestsInWindow: number;
  windowReset: Date;
  backoffLevel: number;
  shouldPause: boolean;
  pauseDuration?: number;
}

export interface BotDetectionSignals {
  captchaDetected: boolean;
  rateLimitHit: boolean;
  ipBlocked: boolean;
  behaviorFlagged: boolean;
  sessionInvalidated: boolean;
  httpStatus: number;
  responseTime: number;
  headers: Record<string, string>;
}

export interface SessionContext {
  userAgent: string;
  sessionId: string;
  requestCount: number;
  sessionStartTime: Date;
  lastRequestTime: Date;
  failureCount: number;
  source: string;
}

/**
 * Advanced anti-bot detection and evasion system
 */
export class AntiBot {
  private static readonly USER_AGENTS = [
    // Chrome variants
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    
    // Firefox variants
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:121.0) Gecko/20100101 Firefox/121.0',
    'Mozilla/5.0 (X11; Linux x86_64; rv:121.0) Gecko/20100101 Firefox/121.0',
    
    // Safari variants
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Safari/605.1.15'
  ];

  private static readonly NATURAL_DELAYS = {
    min: 800,     // Minimum human-like delay
    max: 3000,    // Maximum reasonable delay
    reading: 2000, // Time to "read" a page
    typing: 150,   // Time per character "typed"
    clicking: 300  // Time to "click" and process
  };

  private static sessions = new Map<string, SessionContext>();

  /**
   * Generate randomized user agent string
   */
  static randomizeUserAgent(): string {
    const randomIndex = Math.floor(Math.random() * this.USER_AGENTS.length);
    return this.USER_AGENTS[randomIndex];
  }

  /**
   * Calculate natural jitter delay with human-like patterns
   */
  static calculateJitter(baseDelay: number, requestType: 'search' | 'detail' | 'list' = 'search'): number {
    // Base jitter: ±25% of original delay
    const jitterRange = baseDelay * 0.25;
    const jitter = (Math.random() - 0.5) * 2 * jitterRange;
    
    // Request type modifiers
    const typeModifiers = {
      search: 1.2,  // Searches take longer to process
      detail: 0.8,  // Detail pages load faster
      list: 1.0     // List pages are baseline
    };

    // Human behavior patterns
    const timeOfDay = new Date().getHours();
    const humanFactor = this.calculateHumanFactor(timeOfDay);
    
    // Fatigue simulation (longer sessions = slower responses)
    const sessionAge = this.getSessionAge();
    const fatigueFactor = 1 + (sessionAge / 3600000) * 0.1; // 10% slower per hour

    const finalDelay = Math.max(
      this.NATURAL_DELAYS.min,
      Math.min(
        this.NATURAL_DELAYS.max,
        (baseDelay + jitter) * typeModifiers[requestType] * humanFactor * fatigueFactor
      )
    );

    return Math.round(finalDelay);
  }

  /**
   * Detect various bot detection mechanisms
   */
  static detectCaptcha(response: string, headers: Record<string, string> = {}): BotDetectionSignals {
    const signals: BotDetectionSignals = {
      captchaDetected: false,
      rateLimitHit: false,
      ipBlocked: false,
      behaviorFlagged: false,
      sessionInvalidated: false,
      httpStatus: 200,
      responseTime: 0,
      headers
    };

    // CAPTCHA detection patterns
    const captchaPatterns = [
      /captcha/i,
      /recaptcha/i,
      /hcaptcha/i,
      /cloudflare/i,
      /access denied/i,
      /blocked/i,
      /robot/i,
      /bot.*detected/i,
      /verify.*human/i,
      /prove.*human/i
    ];

    signals.captchaDetected = captchaPatterns.some(pattern => pattern.test(response));

    // Rate limiting detection
    const rateLimitPatterns = [
      /rate limit/i,
      /too many requests/i,
      /slow down/i,
      /retry.*later/i,
      /quota exceeded/i
    ];

    signals.rateLimitHit = rateLimitPatterns.some(pattern => pattern.test(response)) ||
      headers['retry-after'] !== undefined ||
      headers['x-ratelimit-remaining'] === '0';

    // IP blocking detection
    const blockPatterns = [
      /ip.*blocked/i,
      /access.*forbidden/i,
      /country.*blocked/i,
      /region.*restricted/i
    ];

    signals.ipBlocked = blockPatterns.some(pattern => pattern.test(response));

    // Behavior flagging detection
    const behaviorPatterns = [
      /suspicious.*activity/i,
      /unusual.*behavior/i,
      /automated.*traffic/i,
      /security.*check/i
    ];

    signals.behaviorFlagged = behaviorPatterns.some(pattern => pattern.test(response));

    // Session invalidation
    const sessionPatterns = [
      /session.*expired/i,
      /session.*invalid/i,
      /please.*login/i,
      /authentication.*required/i
    ];

    signals.sessionInvalidated = sessionPatterns.some(pattern => pattern.test(response));

    return signals;
  }

  /**
   * Handle rate limit response with intelligent backoff
   */
  static handleRateLimit(
    response: Response,
    currentStrategy: RateLimitStrategy
  ): RateLimitStrategy {
    const retryAfterHeader = response.headers.get('retry-after');
    const rateLimitReset = response.headers.get('x-ratelimit-reset');
    const rateLimitRemaining = response.headers.get('x-ratelimit-remaining');

    let nextDelay = currentStrategy.nextDelay;
    let backoffLevel = currentStrategy.backoffLevel;
    let shouldPause = false;
    let pauseDuration: number | undefined;

    // Parse retry-after header
    if (retryAfterHeader) {
      const retryAfter = parseInt(retryAfterHeader, 10);
      if (!isNaN(retryAfter)) {
        nextDelay = retryAfter * 1000; // Convert to milliseconds
        shouldPause = retryAfter > 30; // Pause for delays over 30 seconds
        pauseDuration = shouldPause ? nextDelay : undefined;
      }
    }

    // Handle rate limit reset
    let windowReset = new Date(Date.now() + 3600000); // Default 1 hour
    if (rateLimitReset) {
      const resetTime = parseInt(rateLimitReset, 10);
      windowReset = new Date(resetTime * 1000);
    }

    // Exponential backoff for repeated rate limits
    if (response.status === 429) {
      backoffLevel = Math.min(backoffLevel + 1, 6); // Max 6 levels
      nextDelay = Math.max(nextDelay, 1000 * Math.pow(2, backoffLevel));
    }

    return {
      currentDelay: nextDelay,
      nextDelay: nextDelay * 1.5, // Increase for next request
      requestsInWindow: 0, // Reset counter
      windowReset,
      backoffLevel,
      shouldPause,
      pauseDuration
    };
  }

  /**
   * Generate natural request headers
   */
  static generateNaturalHeaders(
    userAgent: string,
    referer?: string,
    source?: string
  ): Record<string, string> {
    const headers: Record<string, string> = {
      'User-Agent': userAgent,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'DNT': '1',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Cache-Control': 'max-age=0'
    };

    if (referer) {
      headers['Referer'] = referer;
      headers['Sec-Fetch-Site'] = 'same-origin';
    }

    // Source-specific headers
    if (source === 'goldin') {
      headers['X-Requested-With'] = 'XMLHttpRequest';
    }

    return headers;
  }

  /**
   * Simulate human-like browsing patterns
   */
  static async simulateHumanBehavior(
    action: 'page_load' | 'search' | 'scroll' | 'click',
    context?: { pageSize?: number; searchTerms?: string }
  ): Promise<number> {
    let delay = 0;

    switch (action) {
      case 'page_load':
        // Simulate page reading time based on content
        const contentSize = context?.pageSize || 1000;
        delay = this.NATURAL_DELAYS.reading + (contentSize / 100) * 50;
        break;

      case 'search':
        // Simulate typing search terms
        const searchLength = context?.searchTerms?.length || 10;
        delay = this.NATURAL_DELAYS.typing * searchLength + this.NATURAL_DELAYS.clicking;
        break;

      case 'scroll':
        // Random scroll delay
        delay = Math.random() * 500 + 200;
        break;

      case 'click':
        // Click processing time
        delay = this.NATURAL_DELAYS.clicking + Math.random() * 200;
        break;
    }

    // Add random jitter
    const jitter = Math.random() * 300 - 150; // ±150ms
    const finalDelay = Math.max(100, delay + jitter);

    await new Promise(resolve => setTimeout(resolve, finalDelay));
    return finalDelay;
  }

  /**
   * Manage session lifecycle and rotation
   */
  static createSession(source: string): SessionContext {
    const sessionId = this.generateSessionId();
    const session: SessionContext = {
      userAgent: this.randomizeUserAgent(),
      sessionId,
      requestCount: 0,
      sessionStartTime: new Date(),
      lastRequestTime: new Date(),
      failureCount: 0,
      source
    };

    this.sessions.set(sessionId, session);
    return session;
  }

  /**
   * Update session after request
   */
  static updateSession(
    sessionId: string,
    success: boolean,
    responseTime?: number
  ): SessionContext | null {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    session.requestCount++;
    session.lastRequestTime = new Date();
    
    if (!success) {
      session.failureCount++;
    } else {
      session.failureCount = Math.max(0, session.failureCount - 1); // Reduce failure count on success
    }

    return session;
  }

  /**
   * Determine if session should be rotated
   */
  static shouldRotateSession(session: SessionContext): boolean {
    const age = Date.now() - session.sessionStartTime.getTime();
    const maxAge = 30 * 60 * 1000; // 30 minutes
    const maxRequests = 100;
    const maxFailures = 5;

    return (
      age > maxAge ||
      session.requestCount > maxRequests ||
      session.failureCount > maxFailures
    );
  }

  /**
   * Calculate human behavior factor based on time of day
   */
  private static calculateHumanFactor(hour: number): number {
    // Humans are slower during typical "tired" hours
    if (hour >= 1 && hour <= 6) return 1.3; // Late night/early morning
    if (hour >= 14 && hour <= 16) return 1.1; // Post-lunch slowdown
    if (hour >= 22 && hour <= 24) return 1.2; // Evening fatigue
    return 1.0; // Normal hours
  }

  /**
   * Get current session age in milliseconds
   */
  private static getSessionAge(): number {
    // Simple implementation - would use actual session tracking in production
    return Math.random() * 3600000; // 0-1 hour random for demo
  }

  /**
   * Generate unique session identifier
   */
  private static generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Clean up expired sessions
   */
  static cleanupSessions(): void {
    const now = Date.now();
    const maxAge = 60 * 60 * 1000; // 1 hour

    for (const [sessionId, session] of this.sessions.entries()) {
      if (now - session.sessionStartTime.getTime() > maxAge) {
        this.sessions.delete(sessionId);
      }
    }
  }
}

/**
 * Integration with PokeDAO RateBudget table
 */
export class RateBudgetManager {
  /**
   * Check if request is within rate budget
   */
  static checkRateBudget(
    source: string,
    requestType: string,
    currentCount: number,
    windowStart: Date,
    windowEnd: Date,
    maxRequests: number
  ): {
    allowed: boolean;
    remaining: number;
    resetTime: Date;
    suggestedDelay?: number;
  } {
    const now = new Date();
    
    // Check if we're within the current window
    if (now >= windowStart && now <= windowEnd) {
      const remaining = maxRequests - currentCount;
      
      if (remaining <= 0) {
        return {
          allowed: false,
          remaining: 0,
          resetTime: windowEnd,
          suggestedDelay: windowEnd.getTime() - now.getTime()
        };
      }

      // Calculate suggested delay to spread requests evenly
      const windowRemaining = windowEnd.getTime() - now.getTime();
      const suggestedDelay = windowRemaining / remaining;

      return {
        allowed: true,
        remaining,
        resetTime: windowEnd,
        suggestedDelay: Math.max(1000, suggestedDelay) // At least 1 second
      };
    }

    // Outside current window - need new window
    return {
      allowed: true,
      remaining: maxRequests - 1,
      resetTime: new Date(now.getTime() + 3600000), // 1 hour from now
    };
  }

  /**
   * Update rate budget after request
   */
  static updateRateBudget(
    currentBudget: {
      currentCount: number;
      windowStart: Date;
      windowEnd: Date;
    },
    success: boolean
  ): {
    currentCount: number;
    windowStart: Date;
    windowEnd: Date;
    lastRequestAt: Date;
  } {
    return {
      currentCount: currentBudget.currentCount + 1,
      windowStart: currentBudget.windowStart,
      windowEnd: currentBudget.windowEnd,
      lastRequestAt: new Date()
    };
  }
}
