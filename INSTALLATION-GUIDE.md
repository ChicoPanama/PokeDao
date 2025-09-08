# PokeDAO API Architecture Installation Guide

**🔍 COMPATIBILITY-FIRST INSTALLATION PROCESS**

This guide ensures all API clients are compatible with your existing normalization engine before installation.

## 📋 Pre-Installation Checklist

### Step 1: Run Architecture Validation

```bash
# Make validation script executable
chmod +x scripts/validate-architecture.sh

# Run comprehensive validation
./scripts/validate-architecture.sh
```

**❌ STOP HERE if validation fails with errors**

### Step 2: Run API Compatibility Check

```bash
# Install TypeScript execution engine
npm install -g tsx

# Run compatibility assessment
npx tsx scripts/api-compatibility-check.ts
```

**❌ STOP HERE if compatibility check shows critical issues**

## 🚀 Installation Process (Only After Validation Passes)

### Phase 1: Install Compatible API Clients

Based on compatibility check results, install only verified clients:

#### A. TCGPlayer API (If Compatible)
```bash
# Install official TCGPlayer client
npm install axios @types/node

# Create TCGPlayer client wrapper
mkdir -p integrations/tcgplayer
```

#### B. eBay Browse API (If Compatible) 
```bash
# Install eBay API client
npm install ebay-api

# Create eBay client wrapper
mkdir -p integrations/ebay
```

#### C. Pokemon TCG API (If Compatible)
```bash
# Install Pokemon TCG SDK
npm install pokemontcgsdk

# Create Pokemon TCG client wrapper  
mkdir -p integrations/pokemon-tcg
```

### Phase 2: Create Integration Wrappers

Create standardized wrappers that work with your normalization engine:

```typescript
// integrations/base-client.ts
export interface StandardizedCard {
  title: string;
  price?: number;
  currency?: string;
  condition?: string;
  seller?: string;
  url?: string;
  source: string;
  timestamp: Date;
}

export abstract class BaseAPIClient {
  abstract searchCards(query: string): Promise<StandardizedCard[]>;
  abstract normalizeTitle(title: string): Promise<ParsedCard>;
}
```

### Phase 3: Integration Testing

Test each API client with your normalization engine:

```bash
# Test normalization compatibility
npx tsx integrations/test-normalization.ts

# Test end-to-end data flow
npx tsx integrations/test-pipeline.ts
```

### Phase 4: Update Phase 4 Configuration

Add verified APIs to your multi-source pipeline:

```typescript
// phase4/config/sources.ts
export const VERIFIED_SOURCES = {
  // Existing sources
  collector_crypt: { status: 'active', priority: 1 },
  magic_eden: { status: 'active', priority: 2 },
  
  // New verified sources (add only after testing)
  tcgplayer: { status: 'testing', priority: 3 },
  ebay: { status: 'testing', priority: 4 },
  pokemon_tcg: { status: 'testing', priority: 5 }
};
```

## ⚠️ Critical Safety Measures

### 1. Backup Before Changes
```bash
# Create backup branch
git checkout -b backup-before-api-integration
git add . && git commit -m "Backup before API client installation"

# Return to feature branch
git checkout feature/env-validation
```

### 2. Environment Variable Setup
```bash
# Copy and update environment template
cp .env.example .env.api-clients

# Add API keys (obtain separately):
# TCGPLAYER_API_KEY=your_key_here
# EBAY_APP_ID=your_app_id_here
# EBAY_CERT_ID=your_cert_id_here
```

### 3. Test in Isolation
```bash
# Test each client individually before integration
npm run test:tcgplayer
npm run test:ebay  
npm run test:pokemon-tcg

# Only proceed if all tests pass
npm run test:integration
```

## 🎯 Success Criteria

Before considering installation complete:

- ✅ All validation tests pass
- ✅ Normalization engine handles API data with >75% success rate
- ✅ API clients return expected data formats
- ✅ Rate limiting and error handling work correctly
- ✅ Integration tests pass without errors
- ✅ No conflicts with existing Phase 4 pipeline

## 🚨 Rollback Plan

If any issues arise:

```bash
# Immediate rollback
git checkout backup-before-api-integration

# Clean installation
rm -rf node_modules
npm install

# Verify original functionality
./scripts/validate-architecture.sh
```

## 📊 Next Steps After Successful Installation

1. **Gradual Integration**: Add one API source at a time to Phase 4
2. **Monitor Performance**: Watch for rate limits and API errors
3. **Data Quality Validation**: Verify normalization accuracy with real data
4. **Production Deployment**: Only after thorough testing

---

## 🔄 Validation Commands Reference

```bash
# Complete validation workflow
./scripts/validate-architecture.sh                    # Environment check
npx tsx scripts/api-compatibility-check.ts           # API compatibility  
npm run test:normalization                            # Engine testing
npm run test:integration                              # End-to-end testing
```

**🛡️ Remember: Never skip validation steps - they prevent breaking your working system!**
