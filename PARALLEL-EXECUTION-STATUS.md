# Parallel Execution Status - Mew-1A v4.3.1

**Started:** October 24, 2025
**Strategy:** Run LoRA training on RunPod (Workstream A) while implementing Phase 1 improvements locally (Workstream B)

---

## ✅ Workstream A: RunPod Training (YOU START THIS NOW)

### Status: READY TO START

**What I've Prepared:**
1. ✅ Training dataset: 200 examples (150 TFV + 50 BUY/PASS)
   - Location: `data/tfv/v4.3.1_training_set.jsonl`
2. ✅ Training script: Automated RunPod workflow
   - Location: `scripts/runpod-train-v4.3.1.sh`
3. ✅ Instructions: Step-by-step guide
   - Location: `RUNPOD-V4.3.1-TRAINING.md`

**What YOU Do Next:**
1. Open `RUNPOD-V4.3.1-TRAINING.md`
2. Follow Steps 1-4 to start training on RunPod
3. Training runs for ~10-15 minutes (hands-off)
4. Model auto-uploads to `ChicoPanama/mew1a-v4.3.1`

**Expected Timeline:**
- Setup: 5-10 minutes (your time)
- Training: 10-15 minutes (RunPod GPU time)
- Upload: 1-2 minutes (auto)
- **Total: ~20-30 minutes**

---

## 🔄 Workstream B: Phase 1 Improvements (I'LL DO THIS NOW)

### Status: IN PROGRESS

**While Your RunPod Training Runs, I Will:**

1. **Implement /analyze Fallback** (30 min)
   - Fix 500 errors by routing to `/generate`
   - Keep response shape identical

2. **Add Session-Aware Footer** (1 hour)
   - "Once-per-session" TFV clarification
   - Reduces UX friction (no repetitive footers)

3. **Set Up Basic Monitoring** (1 hour)
   - Prometheus metrics: `tfv_repaired_rate`, `latency`, `errors`
   - Alert thresholds configured

4. **Prepare Canary Config** (30 min)
   - Document 90/10 v4.3.1/v4.2 split setup
   - Deployment commands ready

**Expected Timeline:**
- **Total: ~3 hours** (overlaps with your RunPod training)

---

## 🎯 Critical Path After Both Complete

### Once Training Finishes + Phase 1 Complete:

**Step 1: Deploy v4.3.1 with Improvements** (10 min)
```bash
cd /Users/arcadio/dev/pokedao/apps/mew1a
modal deploy vllm_deploy_vector_rag.py
```

**Step 2: Validate v4.3.1** (30 min)
```bash
# Run TFV smoke tests
bash scripts/tfv-smoke-tests.sh

# Expected: 5/5 pass WITHOUT repairs
# tfv_repaired_rate → ~0%
```

**Step 3: Launch Canary** (24 hour monitoring)
- 90% traffic to v4.3.1
- 10% traffic to v4.2 (fallback)
- Monitor BUY/PASS alignment ≥95%

---

## 📊 Progress Tracking

### Workstream A Checklist:
- [x] Create 200-example training dataset
- [x] Generate training script for RunPod
- [x] Write RunPod quickstart guide
- [ ] **YOU: Spin up RunPod pod** ← START HERE
- [ ] **YOU: Upload files to RunPod**
- [ ] **YOU: Start training (15 min)**
- [ ] **AUTO: Model uploads to Hugging Face**

### Workstream B Checklist:
- [ ] Implement /analyze fallback
- [ ] Add session-aware footer
- [ ] Set up Prometheus monitoring
- [ ] Prepare canary deployment config

### Final Integration Checklist:
- [ ] Deploy v4.3.1 to Modal (with Phase 1 improvements)
- [ ] Run TFV smoke tests (expect 5/5 pass)
- [ ] Verify `tfv_repaired_rate ~0%`
- [ ] Launch 90/10 canary
- [ ] Monitor for 24 hours
- [ ] Promote to 100% if green

---

## 🚀 Next Action

**FOR YOU:**
1. Open `RUNPOD-V4.3.1-TRAINING.md`
2. Go to Step 1: "Spin Up RunPod Pod"
3. Follow the guide (takes ~5-10 min to start training)
4. Let training run (~15 min hands-off)
5. Come back when you see "✅ TRAINING COMPLETE!" message

**FOR ME:**
- I'll now start implementing Phase 1 improvements (Workstream B)
- Check back in ~3 hours for completion status

---

## ⏱️ Timeline Summary

| Time | Your Activity (Workstream A) | My Activity (Workstream B) |
|------|------------------------------|---------------------------|
| **T+0** | Follow RUNPOD guide, spin up pod | Start /analyze fallback |
| **T+10** | Upload files, start training | Finish /analyze fallback |
| **T+25** | **Training running (hands-off)** | Implement session-aware footer |
| **T+85** | **Training complete!** | Finish monitoring setup |
| **T+150** | Training auto-uploads to HF | Finish canary config |
| **T+180** | **Both workstreams DONE** | **Both workstreams DONE** |
| **T+190** | **Deploy v4.3.1 with all improvements** | |
| **T+220** | **Validate → Launch canary** | |

**Total Time to Canary Launch:** ~3.5-4 hours (vs 24-48 hours sequential!)

---

**STATUS: Waiting for you to start RunPod training while I proceed with Phase 1 improvements.**
