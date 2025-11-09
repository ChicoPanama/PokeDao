#!/usr/bin/env tsx
/**
 * Synthetic Traffic Generator for Card Comprehensive Analysis API
 *
 * Simulates realistic user traffic patterns to test:
 * - Cache hit rates (target: >50%)
 * - Error rates (target: <1%)
 * - Redis memory usage
 * - AI call volume control
 * - Rate limiting behavior
 *
 * Usage:
 *   pnpm tsx scripts/generate-synthetic-traffic.ts --scenario normal --duration 1h
 *   pnpm tsx scripts/generate-synthetic-traffic.ts --scenario peak --duration 30m
 *   pnpm tsx scripts/generate-synthetic-traffic.ts --scenario spike --duration 15m
 *   pnpm tsx scripts/generate-synthetic-traffic.ts --scenario cache-buster --duration 10m
 *
 * Environment:
 *   API_BASE_URL - API base URL (default: http://localhost:3000)
 *   API_KEYS - Comma-separated API keys for authenticated users
 */

import fs from 'fs/promises';
import path from 'path';

// =============================================================================
// Configuration
// =============================================================================

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';

interface TestCard {
  name: string;
  set: string;
  cardNumber: string;
  rarity: string;
  avgPriceRaw: number;
  tier: 'mega-popular' | 'popular' | 'moderate' | 'long-tail';
}

interface GradeVariant {
  gradeCompany: string | null;
  grade: number | null;
  multiplier: number;
  probability: number;
}

interface LanguageVariant {
  language: 'EN' | 'JA';
  multiplier: number;
  probability: number;
}

interface UserProfile {
  tier: 'anonymous' | 'api_key' | 'power_user';
  apiKey?: string;
  minDelayBetweenRequestsMs: number;
  repeatProbability: number;
}

interface ScenarioConfig {
  name: string;
  durationMs: number;
  concurrentUsers: number;
  userDistribution: { anonymous: number; api_key: number; power_user: number };
  cardDistribution: { mega_popular: number; popular: number; moderate: number; long_tail: number };
  newTuplesBudgetPerMin: number;
  repeatProbability: number;
}

interface ResolvedCard extends TestCard {
  canonicalCardId: string;
}

interface RequestMetrics {
  timestamp: number;
  userTier: string;
  cardName: string;
  gradeCompany: string | null;
  grade: number | null;
  language: string;
  status: number;
  latencyMs: number;
  cached: boolean;
  error?: string;
}

// =============================================================================
// HTTP Error Wrapper (FIX #2: Status propagation)
// =============================================================================

class HttpError extends Error {
  constructor(
    public status: number,
    public statusText: string,
    public responseText: string
  ) {
    super(`HTTP ${status}: ${statusText}`);
    this.name = 'HttpError';
  }
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs = 30000
): Promise<{ ok: boolean; status: number; data: any; headers: Headers }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timeout);

    const text = await response.text();
    const data = text ? JSON.parse(text) : null;

    if (!response.ok) {
      throw new HttpError(response.status, response.statusText, text);
    }

    return { ok: true, status: response.status, data, headers: response.headers };
  } catch (err) {
    clearTimeout(timeout);
    if (err instanceof HttpError) throw err;
    if ((err as any).name === 'AbortError') {
      throw new Error(`Request timeout after ${timeoutMs}ms`);
    }
    throw err;
  }
}

// =============================================================================
// API Key Pool (FIX #1: Rotate from env, don't generate)
// =============================================================================

class ApiKeyPool {
  private keys: string[] = [];

  constructor() {
    this.keys = (process.env.API_KEYS || '')
      .split(',')
      .map(k => k.trim())
      .filter(Boolean);
  }

  getKeyCount(): number {
    return this.keys.length;
  }

  getRandomKey(): string | undefined {
    if (this.keys.length === 0) return undefined;
    return this.keys[Math.floor(Math.random() * this.keys.length)];
  }
}

// =============================================================================
// Card Database Loader
// =============================================================================

async function loadCardDatabase(): Promise<TestCard[]> {
  const filePath = path.join(process.cwd(), 'scripts', 'traffic-generator-cards.json');
  const content = await fs.readFile(filePath, 'utf-8');
  return JSON.parse(content);
}

async function loadScenarioConfig(scenarioName: string): Promise<ScenarioConfig> {
  const filePath = path.join(process.cwd(), 'scripts', 'traffic-generator-config.json');
  const content = await fs.readFile(filePath, 'utf-8');
  const configs = JSON.parse(content);
  const config = configs[scenarioName];
  if (!config) {
    throw new Error(`Scenario "${scenarioName}" not found in config`);
  }
  return config;
}

// =============================================================================
// Grade and Language Variants
// =============================================================================

const GRADE_VARIANTS: GradeVariant[] = [
  { gradeCompany: null, grade: null, multiplier: 1.0, probability: 0.50 }, // RAW
  { gradeCompany: 'PSA', grade: 10, multiplier: 3.0, probability: 0.25 },
  { gradeCompany: 'PSA', grade: 9, multiplier: 1.8, probability: 0.15 },
  { gradeCompany: 'PSA', grade: 8, multiplier: 1.3, probability: 0.05 },
  { gradeCompany: 'BGS', grade: 9.5, multiplier: 2.5, probability: 0.05 },
];

const LANGUAGE_VARIANTS: LanguageVariant[] = [
  { language: 'EN', multiplier: 1.0, probability: 0.85 },
  { language: 'JA', multiplier: 0.7, probability: 0.15 },
];

function selectGrade(): GradeVariant {
  const rand = Math.random();
  let cumulative = 0;
  for (const variant of GRADE_VARIANTS) {
    cumulative += variant.probability;
    if (rand < cumulative) return variant;
  }
  return GRADE_VARIANTS[0];
}

function selectLanguage(): LanguageVariant {
  const rand = Math.random();
  let cumulative = 0;
  for (const variant of LANGUAGE_VARIANTS) {
    cumulative += variant.probability;
    if (rand < cumulative) return variant;
  }
  return LANGUAGE_VARIANTS[0];
}

// =============================================================================
// Warmup Phase (FIX #4: Track unresolved cards)
// =============================================================================

async function warmupPhase(cards: TestCard[]): Promise<{
  resolved: Map<string, ResolvedCard>;
  unresolved: TestCard[];
  successRate: number;
}> {
  console.log('\n=== Warmup Phase: Resolving Canonical IDs ===');
  console.log(`Total cards to resolve: ${cards.length}`);

  const resolved = new Map<string, ResolvedCard>();
  const unresolved: TestCard[] = [];

  // Read API keys from env (if provided) to bypass anon warmup limits
  const warmupKeys = (process.env.API_KEYS || '')
    .split(',')
    .map(k => k.trim())
    .filter(Boolean);

  for (const card of cards) {
    try {
      const url = `${API_BASE_URL}/api/cards/search-variants?q=${encodeURIComponent(card.name)}&set=${encodeURIComponent(card.set)}&language=EN`;
      const headers: Record<string, string> = {};
      if (warmupKeys.length) {
        const key = warmupKeys[Math.floor(Math.random() * warmupKeys.length)];
        headers['x-api-key'] = key;
      }
      const { data } = await fetchWithTimeout(url, { headers }, 10000);

      if (data.ok && data.matches && data.matches.length > 0) {
        // Find exact match by card number
        const match = data.matches.find((m: any) => m.cardNumber === card.cardNumber);
        if (match && match.canonicalCardId) {
          const key = `${card.name}|${card.set}|${card.cardNumber}`;
          resolved.set(key, { ...card, canonicalCardId: match.canonicalCardId });
          console.log(`✓ ${card.name} (${card.cardNumber}) → ${match.canonicalCardId}`);
        } else {
          unresolved.push(card);
          console.log(`⚠ ${card.name} (${card.cardNumber}) - No exact match`);
        }
      } else {
        unresolved.push(card);
        console.log(`✗ ${card.name} (${card.cardNumber}) - No results`);
      }
    } catch (err) {
      unresolved.push(card);
      console.log(`✗ ${card.name} (${card.cardNumber}) - Error: ${(err as Error).message}`);
    }

    // Rate limit warmup to avoid overwhelming server
    await sleep(100);
  }

  const successRate = resolved.size / cards.length;
  console.log(`\nWarmup complete: ${resolved.size}/${cards.length} resolved (${(successRate * 100).toFixed(1)}%)`);

  if (successRate < 0.90) {
    console.error(`❌ WARMUP FAILED: Success rate ${(successRate * 100).toFixed(1)}% < 90%`);
    console.error('Unresolved cards will be excluded from traffic generation.');
  }

  return { resolved, unresolved, successRate };
}

// =============================================================================
// User Profile Creation (FIX #3: Align throttle with tier limits)
// =============================================================================

function createUserProfile(tier: 'anonymous' | 'api_key' | 'power_user', apiKeyPool: ApiKeyPool, config: ScenarioConfig): UserProfile {
  if (tier === 'anonymous') {
    return {
      tier,
      minDelayBetweenRequestsMs: 360000, // 6 minutes (10/hr)
      repeatProbability: config.repeatProbability,
    };
  } else if (tier === 'api_key') {
    return {
      tier,
      apiKey: apiKeyPool.getRandomKey(),
      minDelayBetweenRequestsMs: 36000, // 36 seconds (100/hr)
      repeatProbability: config.repeatProbability,
    };
  } else {
    // power_user
    return {
      tier,
      apiKey: apiKeyPool.getRandomKey(),
      minDelayBetweenRequestsMs: 36000, // 36 seconds (100/hr, same as api_key)
      repeatProbability: 0.90, // Power users repeat more often
    };
  }
}

// =============================================================================
// Card Selection with Tier-based Distribution
// =============================================================================

function selectCardByTier(
  cards: ResolvedCard[],
  distribution: ScenarioConfig['cardDistribution']
): ResolvedCard {
  const rand = Math.random();
  let cumulative = 0;
  const tiers: Array<keyof typeof distribution> = ['mega_popular', 'popular', 'moderate', 'long_tail'];

  for (const tier of tiers) {
    cumulative += distribution[tier];
    if (rand < cumulative) {
      const filtered = cards.filter(c => c.tier.replace('-', '_') === tier);
      if (filtered.length === 0) break;
      return filtered[Math.floor(Math.random() * filtered.length)];
    }
  }

  // Fallback
  return cards[Math.floor(Math.random() * cards.length)];
}

// =============================================================================
// Rate Limit Handler with Exponential Backoff (FIX #2: Use err.status)
// =============================================================================

async function handleRateLimitBackoff(err: HttpError, userTier: string): Promise<void> {
  if (err.status !== 429) return;

  let baseDelayMs: number;
  let maxDelayMs: number;

  if (userTier === 'anonymous') {
    baseDelayMs = 360000; // 6 minutes
    maxDelayMs = 600000; // 10 minutes
  } else {
    baseDelayMs = 60000; // 1 minute
    maxDelayMs = 300000; // 5 minutes
  }

  const jitter = Math.random() * 0.2 - 0.1; // ±10%
  const delayMs = Math.min(baseDelayMs * (1 + jitter), maxDelayMs);

  console.log(`⏱️  Rate limit hit (${userTier}), backing off for ${(delayMs / 1000).toFixed(1)}s`);
  await sleep(delayMs);
}

// =============================================================================
// Single Request Execution
// =============================================================================

async function executeRequest(
  card: ResolvedCard,
  grade: GradeVariant,
  language: LanguageVariant,
  user: UserProfile
): Promise<RequestMetrics> {
  const startTime = Date.now();
  let status = 0;
  let cached = false;
  let error: string | undefined;

  try {
    const url = new URL(`${API_BASE_URL}/api/cards/comprehensive-analysis`);
    url.searchParams.append('canonicalCardId', card.canonicalCardId);
    if (grade.gradeCompany) url.searchParams.append('gradeCompany', grade.gradeCompany);
    if (grade.grade) url.searchParams.append('grade', grade.grade.toString());
    url.searchParams.append('language', language.language);

    const headers: Record<string, string> = {};
    if (user.apiKey) headers['x-api-key'] = user.apiKey;

    const { status: respStatus, headers: respHeaders } = await fetchWithTimeout(url.toString(), { headers }, 30000);
    status = respStatus;

    // Check if response was cached
    const cacheHeader = respHeaders.get('x-cache-status') || respHeaders.get('x-redis-cache');
    cached = cacheHeader === 'HIT';

  } catch (err) {
    if (err instanceof HttpError) {
      status = err.status;
      error = err.message;

      // Handle rate limits
      if (err.status === 429) {
        await handleRateLimitBackoff(err, user.tier);
      }
    } else {
      status = 500;
      error = (err as Error).message;
    }
  }

  const latencyMs = Date.now() - startTime;

  return {
    timestamp: Date.now(),
    userTier: user.tier,
    cardName: `${card.name} (${card.cardNumber})`,
    gradeCompany: grade.gradeCompany,
    grade: grade.grade,
    language: language.language,
    status,
    latencyMs,
    cached,
    error,
  };
}

// =============================================================================
// User Session Simulation
// =============================================================================

async function simulateUserSession(
  userId: number,
  user: UserProfile,
  cards: ResolvedCard[],
  config: ScenarioConfig,
  endTime: number,
  metrics: RequestMetrics[]
): Promise<void> {
  let lastCard: ResolvedCard | null = null;
  let lastGrade: GradeVariant | null = null;
  let lastLanguage: LanguageVariant | null = null;

  while (Date.now() < endTime) {
    // Decide if repeat or new card
    const repeat = lastCard && Math.random() < user.repeatProbability;

    let card: ResolvedCard;
    let grade: GradeVariant;
    let language: LanguageVariant;

    if (repeat && lastCard && lastGrade && lastLanguage) {
      card = lastCard;
      grade = lastGrade;
      language = lastLanguage;
    } else {
      card = selectCardByTier(cards, config.cardDistribution);
      grade = selectGrade();
      language = selectLanguage();
      lastCard = card;
      lastGrade = grade;
      lastLanguage = language;
    }

    // Execute request
    const metric = await executeRequest(card, grade, language, user);
    metrics.push(metric);

    // Real-time feedback
    const statusEmoji = metric.status >= 200 && metric.status < 300 ? '✓' : metric.status === 429 ? '⏱️' : '✗';
    const cacheEmoji = metric.cached ? '💾' : '🔍';
    console.log(
      `[User ${userId.toString().padStart(3)}] ${statusEmoji} ${cacheEmoji} ${metric.cardName} ${metric.gradeCompany || 'RAW'}${metric.grade ? metric.grade : ''} ${metric.language} - ${metric.status} (${metric.latencyMs}ms)`
    );

    // Throttle to respect tier limits
    await sleep(user.minDelayBetweenRequestsMs);
  }
}

// =============================================================================
// Server Metrics Scraper (FIX #5: Infer misses from totals - hits)
// =============================================================================

async function fetchServerMetrics(): Promise<{
  cacheHits: number;
  cacheMisses: number;
  cacheHitRate: number;
  totalRequests: number;
}> {
  try {
    const response = await fetch(`${API_BASE_URL}/metrics`);
    const text = await response.text();

    let totalRequests = 0;
    let cacheHits = 0;

    for (const line of text.split('\n')) {
      // Parse api_requests_total{route,status}
      const reqMatch = line.match(/api_requests_total\{.*status="2\d\d".*\}\s+(\d+)/);
      if (reqMatch) {
        totalRequests += parseInt(reqMatch[1], 10);
      }

      // Parse api_cache_hits_total{endpoint}
      const hitMatch = line.match(/api_cache_hits_total\{.*\}\s+(\d+)/);
      if (hitMatch) {
        cacheHits += parseInt(hitMatch[1], 10);
      }
    }

    const cacheMisses = totalRequests - cacheHits;
    const cacheHitRate = totalRequests > 0 ? cacheHits / totalRequests : 0;

    return { cacheHits, cacheMisses, cacheHitRate, totalRequests };
  } catch (err) {
    console.warn(`⚠️  Failed to fetch server metrics: ${(err as Error).message}`);
    return { cacheHits: 0, cacheMisses: 0, cacheHitRate: 0, totalRequests: 0 };
  }
}

// =============================================================================
// Metrics Analysis and Reporting
// =============================================================================

function analyzeMetrics(metrics: RequestMetrics[]): {
  totalRequests: number;
  successRate: number;
  errorRate: number;
  cacheHitRate: number;
  avgLatencyMs: number;
  p95LatencyMs: number;
  rateLimitHits: number;
  byUserTier: Record<string, any>;
  byGrade: Record<string, any>;
  byLanguage: Record<string, any>;
} {
  const total = metrics.length;
  const successful = metrics.filter(m => m.status >= 200 && m.status < 300).length;
  const errors = metrics.filter(m => m.status >= 500).length;
  const cached = metrics.filter(m => m.cached).length;
  const rateLimits = metrics.filter(m => m.status === 429).length;

  const latencies = metrics.map(m => m.latencyMs).sort((a, b) => a - b);
  const avgLatency = latencies.reduce((sum, l) => sum + l, 0) / latencies.length;
  const p95Latency = latencies[Math.floor(latencies.length * 0.95)] || 0;

  // By user tier
  const byUserTier: Record<string, any> = {};
  for (const tier of ['anonymous', 'api_key', 'power_user']) {
    const tierMetrics = metrics.filter(m => m.userTier === tier);
    byUserTier[tier] = {
      requests: tierMetrics.length,
      successRate: tierMetrics.filter(m => m.status >= 200 && m.status < 300).length / tierMetrics.length,
      cacheHitRate: tierMetrics.filter(m => m.cached).length / tierMetrics.length,
      rateLimits: tierMetrics.filter(m => m.status === 429).length,
    };
  }

  // By grade
  const byGrade: Record<string, any> = {};
  for (const variant of GRADE_VARIANTS) {
    const key = variant.gradeCompany ? `${variant.gradeCompany} ${variant.grade}` : 'RAW';
    const gradeMetrics = metrics.filter(m => m.gradeCompany === variant.gradeCompany && m.grade === variant.grade);
    byGrade[key] = {
      requests: gradeMetrics.length,
      cacheHitRate: gradeMetrics.filter(m => m.cached).length / gradeMetrics.length,
    };
  }

  // By language
  const byLanguage: Record<string, any> = {};
  for (const variant of LANGUAGE_VARIANTS) {
    const langMetrics = metrics.filter(m => m.language === variant.language);
    byLanguage[variant.language] = {
      requests: langMetrics.length,
      cacheHitRate: langMetrics.filter(m => m.cached).length / langMetrics.length,
    };
  }

  return {
    totalRequests: total,
    successRate: successful / total,
    errorRate: errors / total,
    cacheHitRate: cached / total,
    avgLatencyMs: avgLatency,
    p95LatencyMs: p95Latency,
    rateLimitHits: rateLimits,
    byUserTier,
    byGrade,
    byLanguage,
  };
}

async function generateReport(
  config: ScenarioConfig,
  metrics: RequestMetrics[],
  serverMetrics: { cacheHits: number; cacheMisses: number; cacheHitRate: number; totalRequests: number },
  durationMs: number
): Promise<void> {
  const analysis = analyzeMetrics(metrics);

  const report = `
# Synthetic Traffic Test Report

**Scenario:** ${config.name}
**Duration:** ${(durationMs / 1000 / 60).toFixed(1)} minutes
**Concurrent Users:** ${config.concurrentUsers}

---

## Summary

| Metric | Value | Target | Status |
|--------|-------|--------|--------|
| Total Requests | ${analysis.totalRequests} | N/A | ℹ️ |
| Success Rate | ${(analysis.successRate * 100).toFixed(1)}% | >99% | ${analysis.successRate > 0.99 ? '✅' : '❌'} |
| Error Rate (5xx) | ${(analysis.errorRate * 100).toFixed(1)}% | <1% | ${analysis.errorRate < 0.01 ? '✅' : '❌'} |
| Cache Hit Rate (Client) | ${(analysis.cacheHitRate * 100).toFixed(1)}% | >50% | ${analysis.cacheHitRate > 0.50 ? '✅' : '⚠️'} |
| Cache Hit Rate (Server) | ${(serverMetrics.cacheHitRate * 100).toFixed(1)}% | >50% | ${serverMetrics.cacheHitRate > 0.50 ? '✅' : '⚠️'} |
| Avg Latency | ${analysis.avgLatencyMs.toFixed(0)}ms | <5000ms | ${analysis.avgLatencyMs < 5000 ? '✅' : '⚠️'} |
| P95 Latency | ${analysis.p95LatencyMs.toFixed(0)}ms | <10000ms | ${analysis.p95LatencyMs < 10000 ? '✅' : '❌'} |
| Rate Limit Hits (429) | ${analysis.rateLimitHits} | <${(analysis.totalRequests * 0.05).toFixed(0)} (5%) | ${analysis.rateLimitHits < analysis.totalRequests * 0.05 ? '✅' : '❌'} |

---

## Breakdown by User Tier

| Tier | Requests | Success Rate | Cache Hit Rate | 429 Hits |
|------|----------|--------------|----------------|----------|
| Anonymous | ${analysis.byUserTier.anonymous.requests} | ${(analysis.byUserTier.anonymous.successRate * 100).toFixed(1)}% | ${(analysis.byUserTier.anonymous.cacheHitRate * 100).toFixed(1)}% | ${analysis.byUserTier.anonymous.rateLimits} |
| API Key | ${analysis.byUserTier.api_key.requests} | ${(analysis.byUserTier.api_key.successRate * 100).toFixed(1)}% | ${(analysis.byUserTier.api_key.cacheHitRate * 100).toFixed(1)}% | ${analysis.byUserTier.api_key.rateLimits} |
| Power User | ${analysis.byUserTier.power_user.requests} | ${(analysis.byUserTier.power_user.successRate * 100).toFixed(1)}% | ${(analysis.byUserTier.power_user.cacheHitRate * 100).toFixed(1)}% | ${analysis.byUserTier.power_user.rateLimits} |

---

## Breakdown by Grade

| Grade | Requests | Cache Hit Rate |
|-------|----------|----------------|
${Object.entries(analysis.byGrade).map(([grade, stats]) => `| ${grade} | ${(stats as any).requests} | ${((stats as any).cacheHitRate * 100).toFixed(1)}% |`).join('\n')}

---

## Breakdown by Language

| Language | Requests | Cache Hit Rate |
|----------|----------|----------------|
${Object.entries(analysis.byLanguage).map(([lang, stats]) => `| ${lang} | ${(stats as any).requests} | ${((stats as any).cacheHitRate * 100).toFixed(1)}% |`).join('\n')}

---

## Server Metrics (from /metrics endpoint)

| Metric | Value |
|--------|-------|
| Total Requests | ${serverMetrics.totalRequests} |
| Cache Hits | ${serverMetrics.cacheHits} |
| Cache Misses | ${serverMetrics.cacheMisses} |
| Cache Hit Rate | ${(serverMetrics.cacheHitRate * 100).toFixed(1)}% |

---

## Recommendations

${analysis.cacheHitRate < 0.50 ? '⚠️ **Cache hit rate is below target.** Consider increasing Redis TTL or adjusting repeat probability.' : ''}
${analysis.errorRate > 0.01 ? '❌ **Error rate exceeds 1%.** Investigate server logs for 5xx errors.' : ''}
${analysis.p95LatencyMs > 10000 ? '❌ **P95 latency exceeds 10s.** Check Mew-1A endpoint performance and vLLM configuration.' : ''}
${analysis.rateLimitHits > analysis.totalRequests * 0.05 ? '⚠️ **Rate limit hits exceed 5%.** User pacing may be too aggressive.' : ''}

---

**Report Generated:** ${new Date().toISOString()}
`;

  const reportPath = path.join(process.cwd(), 'scripts', `traffic-report-${config.name}-${Date.now()}.md`);
  await fs.writeFile(reportPath, report.trim(), 'utf-8');
  console.log(`\n📊 Report saved: ${reportPath}`);
  console.log(report);
}

// =============================================================================
// Main Execution
// =============================================================================

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function parseDuration(duration: string): number {
  const match = duration.match(/^(\d+)(m|h)$/);
  if (!match) throw new Error('Invalid duration format. Use: 5m, 1h, 24h');
  const value = parseInt(match[1], 10);
  const unit = match[2];
  return unit === 'h' ? value * 60 * 60 * 1000 : value * 60 * 1000;
}

async function main() {
  const args = process.argv.slice(2);
  const scenarioArg = args.find(a => a.startsWith('--scenario='))?.split('=')[1] || 'normal';
  const durationArg = args.find(a => a.startsWith('--duration='))?.split('=')[1] || '1h';

  console.log('=============================================================================');
  console.log('🚀 Synthetic Traffic Generator for Card Comprehensive Analysis API');
  console.log('=============================================================================');
  console.log(`Scenario: ${scenarioArg}`);
  console.log(`Duration: ${durationArg}`);
  console.log(`API Base URL: ${API_BASE_URL}`);

  // FIX #6: Allow anonymous-only for smoke tests
  const apiKeyPool = new ApiKeyPool();
  console.log(`API Keys available: ${apiKeyPool.getKeyCount()}`);

  if (apiKeyPool.getKeyCount() === 0 && !['normal'].includes(scenarioArg)) {
    console.error('❌ ERROR: API keys required for peak/spike/cache-buster scenarios');
    console.error('Set API_KEYS environment variable with comma-separated keys.');
    process.exit(1);
  }

  // Load configuration
  const cards = await loadCardDatabase();
  const config = await loadScenarioConfig(scenarioArg);
  const durationMs = parseDuration(durationArg);
  config.durationMs = durationMs;

  console.log(`\nLoaded ${cards.length} cards from database`);
  console.log(`Card distribution: Mega-popular=${config.cardDistribution.mega_popular * 100}%, Popular=${config.cardDistribution.popular * 100}%, Moderate=${config.cardDistribution.moderate * 100}%, Long-tail=${config.cardDistribution.long_tail * 100}%`);
  console.log(`User distribution: Anonymous=${config.userDistribution.anonymous * 100}%, API Key=${config.userDistribution.api_key * 100}%, Power User=${config.userDistribution.power_user * 100}%`);

  // Warmup phase
  const { resolved, unresolved, successRate } = await warmupPhase(cards);
  if (resolved.size === 0) {
    console.error('❌ No cards resolved. Cannot proceed.');
    process.exit(1);
  }

  const resolvedCards = Array.from(resolved.values());

  // Create user profiles
  const users: UserProfile[] = [];
  for (let i = 0; i < config.concurrentUsers; i++) {
    const rand = Math.random();
    let tier: 'anonymous' | 'api_key' | 'power_user';
    if (rand < config.userDistribution.anonymous) {
      tier = 'anonymous';
    } else if (rand < config.userDistribution.anonymous + config.userDistribution.api_key) {
      tier = 'api_key';
    } else {
      tier = 'power_user';
    }
    users.push(createUserProfile(tier, apiKeyPool, config));
  }

  console.log(`\nCreated ${users.length} user profiles`);
  console.log(`- Anonymous: ${users.filter(u => u.tier === 'anonymous').length}`);
  console.log(`- API Key: ${users.filter(u => u.tier === 'api_key').length}`);
  console.log(`- Power User: ${users.filter(u => u.tier === 'power_user').length}`);

  // Start traffic generation
  console.log('\n=== Traffic Generation Started ===\n');
  const startTime = Date.now();
  const endTime = startTime + durationMs;
  const metrics: RequestMetrics[] = [];

  const sessions = users.map((user, idx) =>
    simulateUserSession(idx + 1, user, resolvedCards, config, endTime, metrics)
  );

  await Promise.all(sessions);

  const actualDurationMs = Date.now() - startTime;
  console.log('\n=== Traffic Generation Complete ===\n');

  // Fetch server metrics
  console.log('Fetching server metrics...');
  const serverMetrics = await fetchServerMetrics();

  // Generate report
  await generateReport(config, metrics, serverMetrics, actualDurationMs);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
