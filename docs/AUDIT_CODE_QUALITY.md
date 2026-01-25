# PokeDAO Audit: Code Quality Issues

**Date:** 2026-01-24
**Auditor:** Claude Code

---

## Executive Summary

| Severity | Count | Categories |
|----------|-------|------------|
| CRITICAL | 2 | Memory leak, Division by zero |
| HIGH | 4 | Security, Race condition, Calculation bug |
| MEDIUM | 5 | TLS, Transaction safety, Input validation |
| LOW | 8 | Logging, Dead code, Type assertions |

---

## CRITICAL Issues

### 1. Memory Leak in Alert System

**File:** `ml/src/alertSystem.ts:37-38`

```typescript
const sentAlerts = new Set<string>();
const lastAlertTime = new Map<string, number>();
```

**Problem:** These grow unboundedly. Only cleared via manual `clearSentAlerts()` call which is never invoked in production.

**Impact:** OOM crash after extended runtime (days/weeks).

**Fix Required:**
- Convert to bounded cache with TTL
- Max 10k entries, 24h expiration
- Auto-cleanup on interval

---

### 2. Division by Zero in Fair Value Calculation

**File:** `ml/src/alertSystem.ts:120-121`

```typescript
const edgePct = sig.edgeBp / 10000;
const fairValueUsd = priceUsd / (1 - edgePct);
```

**Problem:** If `edgeBp >= 10000` (100%+ edge), denominator becomes `<= 0`, causing division by zero or negative fair value.

**Impact:** Runtime crash or corrupted data.

**Fix Required:**
```typescript
if (edgePct >= 1) {
  console.warn(`Invalid edgeBp ${sig.edgeBp}, skipping`);
  continue;
}
```

---

## HIGH Severity Issues

### 3. Insecure Referral Code Generation

**File:** `bot/src/middleware/auth.ts:72`

```typescript
code += chars.charAt(Math.floor(Math.random() * chars.length));
```

**Problem:** `Math.random()` is NOT cryptographically secure. Predictable referral codes enable gaming of referral system.

**Impact:** Security vulnerability - referral fraud.

**Fix Required:**
```typescript
import { randomBytes } from 'crypto';
const randomValues = randomBytes(6);
code += chars.charAt(randomValues[i] % chars.length);
```

---

### 4. Median Calculation Bug

**File:** `apps/agent/src/steps/03_features.ts:29`

```typescript
const mid = arr.length ? arr[Math.floor(arr.length / 2)] : null;
```

**Problem:** For even-length arrays, median should average two middle values. Current code only takes one.

**Impact:** Incorrect fair value calculations affecting trading signals.

**Fix Required:**
```typescript
function calculateMedian(arr: number[]): number | null {
  if (arr.length === 0) return null;
  const mid = Math.floor(arr.length / 2);
  if (arr.length % 2 === 0) {
    return Math.round((arr[mid - 1] + arr[mid]) / 2);
  }
  return arr[mid];
}
```

---

### 5. Race Condition in User Upsert

**File:** `bot/src/middleware/auth.ts:30-44`

**Problem:** Concurrent requests from same Telegram user can cause unique constraint violations during upsert.

**Impact:** Intermittent auth failures.

**Fix Required:** Add retry logic with exponential backoff for unique constraint violations.

---

### 6. Hardcoded Stub User in Watchlist

**File:** `api/src/index.ts` (watchlist endpoints)

```typescript
const userId = 'stub-user';
```

**Problem:** All watchlist operations use hardcoded user ID - no authentication.

**Impact:** Security vulnerability - no user isolation.

**Fix Required:** Implement proper authentication middleware.

---

## MEDIUM Severity Issues

### 7. TLS Certificate Validation Disabled

**File:** `api/src/lib/redis.ts:10-13`

```typescript
socket: isTLS ? {
  tls: true,
  rejectUnauthorized: false  // DISABLES CERT VALIDATION
} : undefined
```

**Problem:** Disabling certificate validation exposes to MITM attacks.

**Impact:** Security vulnerability in production.

**Fix Required:** Enable validation by default, only disable via explicit env var for development.

---

### 8. Missing Transaction in validateAndPersist

**File:** `apps/agent/src/steps/05_validate.ts`

**Problem:** Multiple DB operations without transaction wrapper.

**Impact:** Partial writes on failure.

**Fix Required:** Wrap opportunity creation loop in `prisma.$transaction()`.

---

### 9. Inconsistent Input Validation

**Files:** Multiple API routes

**Problems:**
- Mix of Zod, manual checks, and type assertions
- Many endpoints use `req.query as Record<string, string | undefined>`
- No input sanitization on search queries
- `/alerts` accepts unbounded discount percentage

**Affected Endpoints:**
- `/feed`, `/top100`, `/api/cards`, `/cards/:id`
- `/api/search`, `/api/arbitrage`
- `/signals/latest`

---

### 10. Rate Limit Memory Leak

**Files:** `bot/src/middleware/auth.ts:80`, `bot/src/alerts/sender.ts`

**Problem:** In-memory Maps for rate limiting grow unboundedly.

**Mitigating Factor:** Cleanup intervals exist but may not keep up with high traffic.

**Recommendation:** Migrate to Redis for multi-instance support.

---

### 11. Missing Price Precision

**File:** `prisma/schema.prisma` (root)

**Problem:** Uses `Float` types for prices instead of `Int` (cents) or `Decimal`.

**Impact:** Precision loss in calculations.

---

## LOW Severity Issues

### 12. Inconsistent Error Logging

**Files:** `api/src/index.ts` (multiple routes)

```typescript
app.log.error({ err }, 'feed route error');  // Logs as error but returns gracefully
```

**Problem:** Non-fatal errors logged at error level, polluting alerting.

**Fix:** Use `app.log.warn()` for handled errors.

---

### 13. Dead Code - Fair Value Endpoint

**File:** `api/src/index.ts:171-214`

**Problem:** Large commented-out block with TODO note.

**Fix:** Remove or restore with proper implementation.

---

### 14. Unused Imports

**Files:** Multiple

**Problem:** Some imports not directly referenced.

**Fix:** Run `eslint --fix` with unused-imports rule.

---

### 15. Missing Indexes on Root Schema

**File:** `prisma/schema.prisma`

Missing indexes on:
- `User.telegramId` (unique but no separate index)
- `Listing.cardId` (foreign key without covering index)
- `Purchase.userId`
- `ReferralEvent.userId, createdAt`

---

### 16. ScrapeCursor Lacks TTL Index

**File:** `prisma/schema.prisma`

**Problem:** No index on `lastUpdatedAt` for efficient TTL cleanup.

---

### 17. Optional Chaining on Logger

**File:** `api/src/index.ts` (referral attribution)

```typescript
logger.error?.({ err }, '...')
```

**Problem:** Defensive pattern suggests logger may be undefined - fragile.

---

### 18. Orphaned Comp Model

**File:** `prisma/schema.prisma`

**Problem:** `Comp` model has no relations, appears unused.

---

### 19. Magic Numbers

**Files:** Multiple

**Problem:** Hardcoded values without constants:
- 5 min cache TTL
- 50ms rate limit delay
- 30 day comp window

---

## Security Checklist

| Check | Status | Notes |
|-------|--------|-------|
| SQL Injection | PASS | Prisma ORM prevents |
| XSS | PASS | No HTML rendering |
| CSRF | N/A | API-only, no cookies |
| Auth Bypass | FAIL | Watchlist has no auth |
| Rate Limiting | PARTIAL | In-memory, not distributed |
| Input Validation | PARTIAL | Inconsistent |
| TLS Validation | FAIL | Disabled for Redis |
| Secrets in Logs | PASS | Not observed |
| Cryptographic Randomness | FAIL | Math.random() used |

---

## Recommendations Summary

### Fix Immediately (Before Deployment)

1. Add guard for edgeBp >= 10000
2. Fix median calculation
3. Add bounded memory cache with cleanup
4. Replace Math.random() with crypto

### Fix This Sprint

1. Remove watchlist stub user
2. Enable TLS validation
3. Standardize input validation with Zod
4. Add transaction wrapping

### Fix Next Sprint

1. Consolidate error logging levels
2. Remove dead code
3. Add missing indexes
4. Migrate rate limiting to Redis
