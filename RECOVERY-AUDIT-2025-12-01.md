# POKEDAO PROJECT RECOVERY AUDIT

**Date:** 2025-12-01
**Auditor:** Claude (Opus 4)
**Branch:** `claude/pokedao-recovery-audit-01MMbaymsYkDpoLcYdCmdAUq`

---

## EXECUTIVE SUMMARY

PokeDAO is a **well-architected, ~75% complete** systematic Pokemon TCG investment platform. The core data infrastructure (Bronze/Silver/Gold medallion lake) and AI model (Mew-1A v4.2) are **production-deployed**. The main gaps are:

1. **End-to-end signal flow is ~90% wired** - agent tick runs but posting is gated
2. **v4.3 canary deployment blocked** by Modal Labs billing limits
3. **Frontend apps exist but not integrated** with live API endpoints
4. **On-chain vault (PokeStrategy) is design-only** - no implementation

**Recommendation:** Focus on completing the signal -> posting pipeline (2-3 days) before v4.3 training.

---

## QUICK STATUS

| Component | Status | Notes |
|-----------|--------|-------|
| Data Lakehouse | ✅ Working | 239k records, Bronze/Silver/Gold |
| Mew-1A v4.2 | ✅ Deployed | Modal Labs + vLLM + Vector RAG |
| API Server | ✅ Working | 20+ endpoints, Fastify |
| Agent Pipeline | ⚠️ 90% | Posting gated, needs X credentials |
| Chat UI | ✅ Working | Vanilla JS, SSE streaming |
| v4.3 Canary | ⏸️ Blocked | Modal billing limit |
| PokeStrategy | ❌ Design Only | No implementation |

---

## KEY COMMANDS

```bash
# Verification
pnpm typecheck              # Type-check all packages
pnpm green:verify           # Full verification suite

# Services
docker-compose up -d        # Start Postgres + Redis
pnpm api:dev               # Start API server

# Data
pnpm data:pipeline         # Full bronze->gold pipeline

# Agent
pnpm agent:tick            # Single opportunity detection run
pnpm smoke:tick            # Smoke test

# ML
curl -X POST "https://chicopanama--mew1a-vllm-v4-3-vector-rag-fastapi-app.modal.run/generate" \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Analyze: Charizard Base Set PSA 10"}'
```

---

## FIRST 60-90 MINUTES (RE-ENTRY CHECKLIST)

```
[ ] 1. git status (verify clean)
[ ] 2. pnpm install
[ ] 3. pnpm typecheck (fix any errors)
[ ] 4. pnpm green:verify
[ ] 5. docker-compose up -d
[ ] 6. pnpm api:dev
[ ] 7. curl http://localhost:3000/health
```

---

## BLOCKERS

| ID | Blocker | Impact | Action |
|----|---------|--------|--------|
| B1 | Modal billing limit | v4.3 canary blocked | Contact Modal |
| B2 | X/Twitter credentials | Cannot test posting | Configure in .env |
| B3 | Typecheck must pass | CI gate | Fix type errors |

---

## PRIORITY TASK LIST

### Week 1: Foundation
- E1: Fix typecheck
- E2: Fix green:verify
- A1: Run data pipeline
- A2: Add missing env vars

### Week 2: Signal Flow
- C1: Test agent tick
- C2: Configure X credentials
- C3: Enable posting (dry-run)

### Week 3: ML & Polish
- B1: Resolve Modal billing
- B3: Execute v4.3 training
- B4: Create TFV patch

---

## FILE REFERENCE

| Area | Key Files |
|------|-----------|
| Data Pipeline | `/scripts/data/ingest-bronze.ts`, `build-silver.ts`, `build-gold.ts`, `sync-postgres.ts` |
| API | `/api/src/index.ts`, `/api/src/routes/*.ts` |
| Agent | `/apps/agent/src/tick.ts`, `/apps/agent/src/steps/*.ts` |
| ML Inference | `/apps/mew1a/vllm_deploy_vector_rag.py`, `/ml/src/clients/vllm.ts` |
| Chat UI | `/apps/mew1a-chat/chat.html`, `canary.html` |
| Config | `.env.example`, `/prisma/schema.prisma` |

---

## WHAT'S WORKING (END-TO-END)

1. **Data Lakehouse** - Bronze/Silver/Gold with 239k records
2. **Mew-1A v4.2** - Production on Modal Labs with Vector RAG
3. **API Server** - 20+ endpoints (search, signals, arbitrage, AI analysis)
4. **Chat UI** - Streaming inference with NanoChat patterns
5. **Agent Pipeline** - 6-step opportunity detection (posting gated)
6. **Evaluation Framework** - NanoChat-style with quality gates

## WHAT'S PARTIALLY WIRED

1. **v4.3 Canary** - Code ready, Modal billing blocks activation
2. **X/Twitter Posting** - Code exists, needs credentials
3. **Telegram Bot** - Basic commands only, no alerts
4. **Collections Engine** - Full logic, no API exposure

## WHAT'S NOT IMPLEMENTED

1. **PokeStrategy** - On-chain vault (design only)
2. **PokeDex Dashboard** - Signal visualization UI
3. **Real-Time Fabric** - Still batch-based (15-min ticks)
4. **Auth/API Keys** - No authentication

---

*Full audit details in conversation with Claude (Opus 4), 2025-12-01*
