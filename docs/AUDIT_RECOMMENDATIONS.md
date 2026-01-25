# PokeDAO Audit: Prioritized Recommendations

**Date:** 2026-01-24
**Auditor:** Claude Code

---

## Priority Classification

| Priority | Definition | SLA |
|----------|------------|-----|
| **P0** | Critical bugs/security - blocks production | Fix immediately |
| **P1** | High impact - significant risk | Fix this sprint |
| **P2** | Medium impact - quality improvement | Fix next sprint |
| **P3** | Low impact - nice to have | Backlog |

---

## P0 - Critical (Fix Immediately)

### P0-1: Memory Leak in Alert System
**File:** `ml/src/alertSystem.ts`
**Issue:** `sentAlerts` Set and `lastAlertTime` Map grow unboundedly
**Risk:** OOM crash in production
**Fix:** Add bounded cache with TTL cleanup
**Effort:** 1 hour

### P0-2: Division by Zero Guard
**File:** `ml/src/alertSystem.ts:120`
**Issue:** `edgeBp >= 10000` causes division by zero
**Risk:** Runtime crash
**Fix:** Add guard before calculation
**Effort:** 15 minutes

### P0-3: Median Calculation Bug
**File:** `apps/agent/src/steps/03_features.ts:29`
**Issue:** Even-length arrays return wrong median
**Risk:** Incorrect fair value calculations
**Fix:** Average two middle values
**Effort:** 30 minutes

### P0-4: Insecure Referral Code Generation
**File:** `bot/src/middleware/auth.ts:72`
**Issue:** `Math.random()` is predictable
**Risk:** Referral fraud
**Fix:** Use `crypto.randomBytes()`
**Effort:** 15 minutes

---

## P1 - High Priority (Fix This Sprint)

### P1-1: Watchlist Authentication
**File:** `api/src/index.ts`
**Issue:** Hardcoded `userId = 'stub-user'`
**Risk:** No user isolation
**Fix:** Implement proper auth middleware
**Effort:** 2 hours

### P1-2: TLS Certificate Validation
**File:** `api/src/lib/redis.ts`
**Issue:** `rejectUnauthorized: false`
**Risk:** MITM attacks
**Fix:** Enable by default, env var for dev
**Effort:** 30 minutes

### P1-3: Wallet Persistence
**File:** `bot/src/commands/wallet.ts`
**Issue:** Wallet address not saved
**Risk:** Feature doesn't work
**Fix:** Add `walletAddress` to User model
**Effort:** 2 hours

### P1-4: Missing test:smoke Command
**File:** `package.json`
**Issue:** README documents non-existent command
**Risk:** Documentation incorrect
**Fix:** Add `"test:smoke": "pnpm smoke"`
**Effort:** 5 minutes

### P1-5: Add Transaction Wrapping
**File:** `apps/agent/src/steps/05_validate.ts`
**Issue:** Multiple DB ops without transaction
**Risk:** Partial writes on failure
**Fix:** Wrap in `prisma.$transaction()`
**Effort:** 1 hour

### P1-6: User Upsert Race Condition
**File:** `bot/src/middleware/auth.ts`
**Issue:** Concurrent upserts can fail
**Risk:** Intermittent auth failures
**Fix:** Add retry logic
**Effort:** 1 hour

---

## P2 - Medium Priority (Fix Next Sprint)

### P2-1: Standardize Input Validation
**Files:** Multiple API routes
**Issue:** Mix of Zod, manual, type assertions
**Risk:** Inconsistent validation
**Fix:** Convert all to Zod schemas
**Effort:** 4 hours

### P2-2: Rate Limiting to Redis
**Files:** `bot/src/middleware/auth.ts`, `ml/src/alertSystem.ts`
**Issue:** In-memory rate limiting
**Risk:** Memory growth, no multi-instance support
**Fix:** Migrate to Redis
**Effort:** 3 hours

### P2-3: Add Missing Package Workspaces
**File:** `package.json`
**Issue:** streams, social, reddit-sentiment not in workspaces
**Risk:** Build/link issues
**Fix:** Add to workspaces array
**Effort:** 30 minutes

### P2-4: Consolidate Prisma Schemas
**Files:** `prisma/schema.prisma`, `api/prisma/schema.prisma`
**Issue:** Two incompatible schemas
**Risk:** Confusion, generator conflicts
**Fix:** Pick one as primary
**Effort:** 4 hours

### P2-5: Complete tRPC Integration
**Files:** `api/src/trpc/`
**Issue:** Router exists but not connected
**Risk:** Feature incomplete
**Fix:** Register in Fastify server
**Effort:** 2 hours

### P2-6: TimescaleDB Integration
**File:** `api/prisma/migrations/`
**Issue:** Migration exists but not integrated
**Risk:** Manual setup required
**Fix:** Document or automate
**Effort:** 4 hours

### P2-7: Add Missing Database Indexes
**File:** `prisma/schema.prisma`
**Issue:** Missing indexes on common queries
**Risk:** Slow queries
**Fix:** Add 4-5 indexes
**Effort:** 1 hour

---

## P3 - Low Priority (Backlog)

### P3-1: Clean Up Dead Code
- Remove commented `/fv` endpoint
- Remove orphaned `Comp` model
- Clean unused imports

### P3-2: Standardize Error Logging
- Use `warn` for handled errors
- Use `error` only for unhandled

### P3-3: Add ScrapeCursor TTL Index

### P3-4: Document Undocumented Endpoints

### P3-5: Add reddit-sentiment Tests

### P3-6: Extract Magic Numbers to Constants

### P3-7: Add Integration Tests

---

## Implementation Order

### Phase 1: Safety (Day 1)
1. P0-2: Division by zero guard
2. P0-3: Median calculation fix
3. P0-4: Crypto referral codes
4. P0-1: Bounded memory cache

### Phase 2: Security (Day 2)
1. P1-2: TLS validation
2. P1-1: Watchlist auth (or disable)
3. P1-6: User upsert retry

### Phase 3: Completeness (Day 3-4)
1. P1-4: Add test:smoke command
2. P1-3: Wallet persistence
3. P1-5: Transaction wrapping

### Phase 4: Quality (Week 2)
1. P2-1: Standardize validation
2. P2-3: Fix workspaces
3. P2-7: Add indexes

---

## Verification Steps

After fixes, run:

```bash
# Type checking
pnpm typecheck

# All tests
pnpm test

# Worker tests specifically (contain median tests)
pnpm --filter worker test -- --run

# API health
pnpm api:dev &
curl http://localhost:3000/health

# Agent smoke test
pnpm smoke:tick
```

---

## Success Criteria

- [ ] All P0 issues fixed and verified
- [ ] `pnpm typecheck` passes
- [ ] `pnpm test` passes
- [ ] API health returns 200
- [ ] Agent tick completes without errors
- [ ] No memory growth over 1 hour runtime
