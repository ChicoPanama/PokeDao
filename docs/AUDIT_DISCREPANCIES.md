# PokeDAO Audit: README vs Reality Discrepancies

**Date:** 2026-01-24
**Auditor:** Claude Code

---

## Executive Summary

| Category | Claimed | Verified | Status |
|----------|---------|----------|--------|
| Commands | 9 documented | 8 working | 1 MISSING |
| Packages | 10 in workspaces | 8 actual directories | 2 NOT IN WORKSPACES |
| API Endpoints | ~30 documented | ~35 exist | EXCEEDS CLAIMS |
| Bot Commands | 4 claimed | 4 exist (+4 bonus) | PASSES |
| 2026 Upgrades | 6 claimed | 4 fully working | 2 PARTIAL |
| Database Models | 7 documented | All exist | PASSES |

---

## 1. Command Discrepancies

### MISSING COMMAND

| Command | README | package.json | Status |
|---------|--------|--------------|--------|
| `pnpm test:smoke` | Documented | NOT DEFINED | **BROKEN** |

**Fix Required:** Either add `"test:smoke": "pnpm smoke"` to package.json or update README.

### UNDOCUMENTED COMMANDS (Working but not in README)

- `pnpm smoke` - API health check script
- `pnpm smoke:daily` - Daily post automation
- `pnpm smoke:flash` - Flash direct test
- `pnpm pipeline:live` - Live pipeline execution
- `pnpm pipeline:relaxed` - Relaxed validation pipeline
- `pnpm pipeline:strict` - Strict validation pipeline

---

## 2. Package Workspace Discrepancies

### Directories Exist but NOT in Workspaces

| Directory | In Workspaces | Status |
|-----------|---------------|--------|
| `packages/streams` | NO | Not included |
| `packages/social` | NO | Not included |
| `packages/reddit-sentiment` | NO | Not included |

### package.json Workspaces Config
```json
"workspaces": [
  "api", "bot", "worker", "ml",
  "packages/shared", "packages/core", "packages/analysis",
  "packages/storage", "packages/adapters", "apps/agent"
]
```

**Impact:** These packages won't be linked or built by `pnpm -r` commands.

---

## 3. 2026 Technology Upgrade Status

| Technology | Claimed | Files Exist | Functional | Integrated |
|------------|---------|-------------|------------|------------|
| Qdrant Vector DB | Yes | Yes (8.3KB + 13KB) | **PRODUCTION** | Yes |
| TimescaleDB | Yes | Yes (4.1KB migration) | **SCAFFOLDING** | NO |
| tRPC API Layer | Yes | Yes (6 files) | **PARTIAL** | NO |
| LangGraph Agents | Yes | Yes (9 files) | **PRODUCTION** | Yes |
| Redpanda/Kafka | Yes | Yes (9.7KB) | **PRODUCTION** | Yes |
| CrewAI Multi-Agent | Yes | Yes (7 files) | **PRODUCTION** | Yes |

### TimescaleDB Issues

- Migration file exists but NOT in active migration chain
- Prisma schema has NO hypertable annotations
- Manual database setup required before app runs
- Will fail if Prisma runs migrations without prerequisite setup

### tRPC Issues

- Router structure exists but not fully integrated
- Only signals and cards procedures implemented
- Not connected to Fastify server in main index.ts

---

## 4. API Endpoint Discrepancies

### Documented but DISABLED

| Endpoint | Status | Notes |
|----------|--------|-------|
| `/fv` (Fair Value) | DISABLED | Commented out, TODO note |

### Documented but INCOMPLETE

| Endpoint | Status | Issue |
|----------|--------|-------|
| `/watchlist` POST/GET | BROKEN | Hardcoded `userId = 'stub-user'` |
| `/external/*` | INCOMPLETE | Hardcoded file paths, missing sources |

### UNDOCUMENTED but Working

- `/api/tokenized` - NFT-backed card stats
- `/api/best-execution` - Fee-adjusted pricing
- `/api/confidence/:id` - Trust scores
- `/api/ai-analysis` - Multi-model AI ensemble
- `/api/cards/comprehensive-analysis` - Complex aggregation
- `/webhooks/ebay/mad` - eBay MAD compliance

---

## 5. Database Schema Discrepancies

### CRITICAL: Dual Schema Architecture

| Schema | Location | Models | Lines |
|--------|----------|--------|-------|
| Root | `/prisma/schema.prisma` | 12 | 214 |
| API | `/api/prisma/schema.prisma` | 26+ | 680 |

**Issue:** Two incompatible schemas designed for different architectures:
- Root: Simple e-commerce (legacy)
- API: Complex market consolidation (production)

### Generator Configuration Mismatch

```
Root:  generator client { provider = "prisma-client-js" }
API:   generator client { provider = "prisma-client", output = "./generated/client" }
```

---

## 6. Bot Feature Discrepancies

### Claimed vs Reality

| Command | Claimed | Implemented | Production-Ready |
|---------|---------|-------------|------------------|
| `/start` | Yes | Yes | Yes |
| `/watch` | Yes | Yes | Yes |
| `/alerts` | Yes | Yes | Yes |
| `/wallet` | Yes | **PARTIAL** | **NO** |

### `/wallet` Issues

- UI exists with Solana address validation
- Wallet address NOT persisted to database
- `walletAddress` field missing from User model
- TODO comments indicate incomplete implementation

---

## 7. Record Count Claims

| Metric | README Claims | Verifiable |
|--------|--------------|------------|
| Records | 239,785 | Schema supports it |
| Marketplaces | 9 | 13 in MarketSource enum |
| Pricing Coverage | 90.4% | ConsensusPricing model exists |

**Note:** Cannot verify actual record counts without database access.

---

## 8. Test Suite Discrepancies

### reddit-sentiment Package

- Has `vitest` configured in scripts
- NO test files exist
- Causes `pnpm -r run test` to fail

**Fix Required:** Add `--passWithNoTests` or create placeholder test.

---

## Recommendations

### Immediate (P0)

1. Add missing `test:smoke` command to package.json
2. Fix `/watchlist` endpoints - remove hardcoded userId
3. Add reddit-sentiment to passWithNoTests

### High Priority (P1)

1. Complete `/wallet` persistence
2. Integrate tRPC router into Fastify server
3. Add missing packages to workspaces

### Medium Priority (P2)

1. Remove commented-out `/fv` endpoint or restore
2. Consolidate dual Prisma schemas
3. Document undocumented endpoints
