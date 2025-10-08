# Database Schema Migration Plan

## Status: DEFERRED (Not blocking Twitter launch)

## Problem Statement

The Prisma schema contains duplicate models representing the same domain concepts:

### Duplicate Set #1: Cards
- **CanonicalCard** (NEW) - 0 active uses in codebase
- **Card** (LEGACY) - 5 active uses in codebase
- **Status:** Legacy model still in use

### Duplicate Set #2: Sales Data
- **SaleRecord** (NEW) - 0 active uses
- **CompSale** (LEGACY) - 5 active uses
- **Status:** Legacy model still in use

### Duplicate Set #3: Listings
- **MarketListing** (NEW) - 0 active uses
- **UnifiedMarketListing** (ACTIVE) - 20 uses
- **Listing** (LEGACY) - 4 uses
- **Status:** Mixed usage, UnifiedMarketListing is primary

## Root Cause

The schema was updated with new models (`CanonicalCard`, `SaleRecord`, etc.) but the application code was never migrated to use them. The codebase continues using legacy models.

## Impact Analysis

### Current Impact: LOW
- System is functional with legacy models
- No data loss or corruption
- Schema duplication causes confusion but no runtime issues

### Future Impact: MEDIUM
- Harder to onboard new developers
- Risk of using wrong model
- Duplicate indexes waste database resources
- Schema migrations more complex

## Migration Strategy

### Option A: Migrate to New Models (RECOMMENDED)
**Effort:** 6-8 hours
**Steps:**
1. Audit all `prisma.card` → change to `prisma.canonicalCard`
2. Audit all `prisma.compSale` → change to `prisma.saleRecord`
3. Migrate data from legacy → new tables
4. Create database migration to copy data
5. Drop legacy models from schema
6. Test all endpoints

**Benefits:**
- Clean schema going forward
- Aligns with naming conventions
- Future-proof

**Risks:**
- Could break existing functionality if migration incomplete
- Requires thorough testing

### Option B: Keep Legacy Models (DEFER)
**Effort:** 30 minutes
**Steps:**
1. Delete unused new models from schema
2. Add documentation clarifying legacy models are intentional
3. Continue using existing models

**Benefits:**
- Zero risk
- Faster
- System already works

**Risks:**
- Technical debt remains
- Confusing for new developers

## Recommendation

**DEFER MIGRATION** until after Twitter launch.

**Rationale:**
1. System is production-ready with current schema
2. Migration is complex and risky
3. Twitter integration is higher priority
4. Can migrate during Q1 2026 maintenance window

## Action Items

### Immediate (This Week)
- ✅ Document that legacy models are intentional
- ✅ Add schema migration plan to docs
- ✅ Proceed with Twitter integration using existing models

### Short Term (Next Month)
- Schedule schema migration for maintenance window
- Create comprehensive test suite for migration
- Plan zero-downtime migration strategy

### Long Term (Q1 2026)
- Execute migration during low-traffic period
- Monitor for any data inconsistencies
- Archive legacy models

## Twitter Integration Impact

**Impact on Twitter Launch:** NONE

The Twitter integration will use:
- `redditSignal` (already working)
- Existing card/listing models (stable)
- New image generation (no database dependency)

No schema changes required for Twitter launch.

## Conclusion

Schema consolidation is important but not urgent. Defer to post-launch maintenance window.
