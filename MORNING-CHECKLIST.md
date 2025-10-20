# Morning Checklist - v4.3 Final Steps

**When you wake up, follow these steps in order:**

---

## ☑️ Step 1: Check RunPod Status (1 min)

```bash
ssh root@47.47.180.44 -p 10474 -i ~/.ssh/id_ed25519
ls -lh /workspace/pokedao/data/training/runpod-outputs/
```

**Looking for**:
- ✅ `cleaned-salvaged.jsonl` (~70-80k lines)
- ✅ `refusal-24k.jsonl` (24k lines)
- ✅ `buy-pass-15k.jsonl` (15k lines)

**If all 3 exist**: Proceed to Step 2
**If still processing**: Check back later

---

## ☑️ Step 2: Download RunPod Outputs (5 min)

On your **local Mac**:

```bash
cd /Users/arcadio/dev/pokedao

scp -P 10474 -i ~/.ssh/id_ed25519 -r \
  root@47.47.180.44:/workspace/pokedao/data/training/runpod-outputs \
  data/training/
```

**Verify download**:
```bash
wc -l data/training/runpod-outputs/*.jsonl
```

---

## ☑️ Step 3: Terminate RunPod Pod (IMPORTANT!)

**Don't skip this or you'll keep paying!**

1. Go to https://www.runpod.io/console/pods
2. Find your pod
3. Click **"Terminate"**
4. Confirm

**Estimated cost**: ~$4-6 total

---

## ☑️ Step 4: Merge All Data Sources (5 min)

```bash
python3 scripts/merge-v4.3-final.py
```

**Expected output**:
- File: `data/training/mew1a-v4.3-FINAL.jsonl`
- Count: ~238k examples (~220k effective)
- Report: `data/training/reports/v4.3-merge-report.json`

---

## ☑️ Step 5: Quality Audit (10 min)

```bash
python3 scripts/audit-v4.3-quality.py \
  --input data/training/mew1a-v4.3-FINAL.jsonl \
  --report data/training/reports/v4.3-quality-audit.json
```

**Expected scores**:
- Quality Score: >85/100 ✅
- Hallucination Rate: <5% ✅
- Valid Card Names: >95% ✅

**If all benchmarks PASS**: Proceed to Step 6
**If any FAIL**: Review report and decide next steps

---

## ☑️ Step 6: Upload to HuggingFace (10 min)

```bash
# Create upload script if needed
python3 scripts/upload-to-huggingface.py \
  --input data/training/mew1a-v4.3-FINAL.jsonl \
  --repo ChicoPanama/mew1a-v4.3-training-data \
  --token $HUGGINGFACE_TOKEN
```

---

## ☑️ Step 7: Train v4.3 Model (Optional - Later)

Deploy new RunPod pod for training (A100 40GB recommended):

```bash
python3 scripts/mew1a-train-v4.3.py \
  --dataset ChicoPanama/mew1a-v4.3-training-data \
  --output-dir models/mew1a-v4.3 \
  --epochs 3 \
  --learning-rate 2e-5
```

**Expected**:
- Time: 3-4 hours on A100
- Cost: ~$5-6
- Final loss: <0.110 (vs v4.2: 0.130)

---

## Quick Commands Reference

### Check what you have locally:
```bash
ls -lh data/training/*.jsonl | grep v4.3
ls -lh data/training/runpod-outputs/
ls -lh data/training/price-patterns-50k.jsonl
```

### Current status:
- ✅ Valid clean data: 103,034 examples
- ✅ Price patterns: 21,586 examples
- ⏳ RunPod outputs: Downloading
- ⏳ Final merge: Pending
- ⏳ Quality audit: Pending

---

## Files You Should Have

**After all steps complete**:

```
data/training/
├── v4.3-step3-fixed-prices.jsonl          (103k - valid clean)
├── price-patterns-50k.jsonl               (21k - price patterns)
├── runpod-outputs/
│   ├── cleaned-salvaged.jsonl             (~75k - pseudo-labeled)
│   ├── refusal-24k.jsonl                  (24k - refusal)
│   └── buy-pass-15k.jsonl                 (15k - BUY/PASS)
├── mew1a-v4.3-FINAL.jsonl                 (~238k - FINAL DATASET)
└── reports/
    ├── v4.3-merge-report.json
    └── v4.3-quality-audit.json
```

---

## If Something Goes Wrong

### RunPod outputs missing/incomplete:
- Check RunPod pod status (might still be running)
- Look for error logs in `/workspace/pokedao/data/training/runpod-logs/`
- May need to re-run specific steps

### Merge fails:
- Check all input files exist
- Verify file formats (should be JSONL)
- Check for disk space

### Quality audit fails benchmarks:
- Review audit report for specific issues
- May need to filter/regenerate some data
- Or accept slightly lower quality and proceed

---

## Total Time Estimate

- Download: 5 min
- Terminate pod: 1 min
- Merge: 5 min
- Audit: 10 min
- Upload to HF: 10 min
- **Total: ~30 minutes**

---

## Success Criteria

You're done when:
- ✅ All RunPod outputs downloaded
- ✅ RunPod pod terminated
- ✅ mew1a-v4.3-FINAL.jsonl created (~238k lines)
- ✅ Quality audit passes (score >85)
- ✅ Dataset uploaded to HuggingFace

**Then you're ready to train v4.3!** 🎉

---

**See V4.3-READY-TO-MERGE.md for detailed info**
