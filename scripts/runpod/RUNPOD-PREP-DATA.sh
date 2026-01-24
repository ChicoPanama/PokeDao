#!/bin/bash
set -e

echo "================================================================================"
echo "RUNPOD DATA PREPARATION - Create salvaged-cards.jsonl"
echo "================================================================================"
echo ""
echo "This script will prepare the data needed for RunPod processing."
echo ""

# Check if we have the base v4.2 file
if [ ! -f "data/training/mew1a-v4.2-ULTIMATE-COMPLETE-VERIFIED.jsonl" ]; then
    echo "❌ Missing: data/training/mew1a-v4.2-ULTIMATE-COMPLETE-VERIFIED.jsonl"
    echo "   This is the base file we need to process."
    exit 1
fi

echo "✅ Found base file: mew1a-v4.2-ULTIMATE-COMPLETE-VERIFIED.jsonl"
echo ""

# Count lines in base file
BASE_LINES=$(wc -l < data/training/mew1a-v4.2-ULTIMATE-COMPLETE-VERIFIED.jsonl)
echo "   Base file has $BASE_LINES examples"
echo ""

# Check if cleanup scripts exist
echo "📋 Checking cleanup scripts..."
SCRIPTS=(
    "scripts/remove-bid-hallucinations.py"
    "scripts/fix-invalid-card-names.py"
    "scripts/fix-price-precision.py"
    "scripts/salvage-cards-rule-based.py"
)

MISSING=0
for script in "${SCRIPTS[@]}"; do
    if [ ! -f "$script" ]; then
        echo "   ❌ Missing: $script"
        MISSING=1
    else
        echo "   ✅ Found: $script"
    fi
done

if [ $MISSING -eq 1 ]; then
    echo ""
    echo "❌ Some cleanup scripts are missing."
    echo "   These should have been created in the previous session."
    echo "   You'll need to create them before proceeding."
    exit 1
fi

echo ""
echo "================================================================================"
echo "STEP 1: Remove Bid Hallucinations"
echo "================================================================================"
echo ""

if [ -f "data/training/v4.3-step1-no-bid-hallucinations.jsonl" ]; then
    echo "⏭️  Already exists: v4.3-step1-no-bid-hallucinations.jsonl"
    echo "   Skipping..."
else
    echo "Running: remove-bid-hallucinations.py"
    python3 scripts/remove-bid-hallucinations.py \
        --input data/training/mew1a-v4.2-ULTIMATE-COMPLETE-VERIFIED.jsonl \
        --output data/training/v4.3-step1-no-bid-hallucinations.jsonl \
        --report data/training/reports/step1-bid-removal.json

    STEP1_LINES=$(wc -l < data/training/v4.3-step1-no-bid-hallucinations.jsonl)
    echo "✅ Step 1 complete: $STEP1_LINES examples"
fi

echo ""
echo "================================================================================"
echo "STEP 2: Remove Invalid Card Names"
echo "================================================================================"
echo ""

if [ -f "data/training/v4.3-step2-valid-cards.jsonl" ]; then
    echo "⏭️  Already exists: v4.3-step2-valid-cards.jsonl"
    echo "   Skipping..."
else
    echo "Running: fix-invalid-card-names.py"
    python3 scripts/fix-invalid-card-names.py \
        --input data/training/v4.3-step1-no-bid-hallucinations.jsonl \
        --output data/training/v4.3-step2-valid-cards.jsonl \
        --removed data/training/removed-invalid-cards.jsonl \
        --report data/training/reports/step2-card-names.json

    STEP2_LINES=$(wc -l < data/training/v4.3-step2-valid-cards.jsonl)
    REMOVED_LINES=$(wc -l < data/training/removed-invalid-cards.jsonl)
    echo "✅ Step 2 complete: $STEP2_LINES valid, $REMOVED_LINES removed"
fi

echo ""
echo "================================================================================"
echo "STEP 3: Fix Price Precision"
echo "================================================================================"
echo ""

if [ -f "data/training/v4.3-step3-fixed-prices.jsonl" ]; then
    echo "⏭️  Already exists: v4.3-step3-fixed-prices.jsonl"
    echo "   Skipping..."
else
    echo "Running: fix-price-precision.py"
    python3 scripts/fix-price-precision.py \
        --input data/training/v4.3-step2-valid-cards.jsonl \
        --output data/training/v4.3-step3-fixed-prices.jsonl \
        --report data/training/reports/step3-prices.json

    STEP3_LINES=$(wc -l < data/training/v4.3-step3-fixed-prices.jsonl)
    echo "✅ Step 3 complete: $STEP3_LINES examples"
fi

echo ""
echo "================================================================================"
echo "STEP 4: Salvage Invalid Card Names"
echo "================================================================================"
echo ""

if [ -f "data/training/salvaged-cards.jsonl" ]; then
    echo "⏭️  Already exists: salvaged-cards.jsonl"
    SALVAGED_LINES=$(wc -l < data/training/salvaged-cards.jsonl)
    echo "   $SALVAGED_LINES salvaged examples"
else
    echo "Running: salvage-cards-rule-based.py"
    python3 scripts/salvage-cards-rule-based.py \
        --input data/training/removed-invalid-cards.jsonl \
        --output data/training/salvaged-cards.jsonl \
        --discarded data/training/discarded-for-patterns.jsonl \
        --min-confidence 0.60

    SALVAGED_LINES=$(wc -l < data/training/salvaged-cards.jsonl)
    DISCARDED_LINES=$(wc -l < data/training/discarded-for-patterns.jsonl)
    echo "✅ Step 4 complete: $SALVAGED_LINES salvaged, $DISCARDED_LINES discarded"
fi

echo ""
echo "================================================================================"
echo "PREPARATION COMPLETE!"
echo "================================================================================"
echo ""
echo "📊 Summary:"
echo "   Base file: $BASE_LINES examples"
echo "   After cleanup: $(wc -l < data/training/v4.3-step3-fixed-prices.jsonl) valid examples"
echo "   Salvaged: $(wc -l < data/training/salvaged-cards.jsonl) examples"
echo "   For patterns: $(wc -l < data/training/discarded-for-patterns.jsonl) examples"
echo ""
echo "📁 Key files created:"
echo "   ✅ data/training/v4.3-step3-fixed-prices.jsonl (valid clean data)"
echo "   ✅ data/training/salvaged-cards.jsonl (for RunPod processing)"
echo "   ✅ data/training/discarded-for-patterns.jsonl (for price patterns)"
echo ""
echo "🚀 READY FOR RUNPOD!"
echo ""
echo "Next step: Upload salvaged-cards.jsonl to RunPod and run processing."
echo "See: RUNPOD-EXECUTE-NOW.md for instructions"
echo ""
