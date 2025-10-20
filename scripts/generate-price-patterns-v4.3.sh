#!/bin/bash
# =============================================================================
# Generate Price Pattern Data for v4.3 (FREE - $0 cost, ~5 minutes)
# =============================================================================
# Converts 176k discarded examples to price/condition learning examples
# Uses SoftDedup research: REWEIGHT instead of DELETE
# =============================================================================

set -e

echo "================================================================================"
echo "GENERATE PRICE PATTERN DATA FOR V4.3"
echo "================================================================================"
echo ""
echo "Input: 176,173 discarded examples (low-confidence salvage)"
echo "Output: 50,000 price pattern examples (weight=0.15)"
echo "Cost: FREE (local processing)"
echo "Time: ~5 minutes"
echo ""

# Check input file exists
if [ ! -f "data/training/discarded-for-patterns.jsonl" ]; then
    echo "❌ Missing: data/training/discarded-for-patterns.jsonl"
    echo "   This file should have been created during salvage step."
    exit 1
fi

# Check if already exists
if [ -f "data/training/price-patterns-50k.jsonl" ]; then
    echo "⚠️  Output file already exists: data/training/price-patterns-50k.jsonl"
    read -p "Overwrite? (y/n): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Aborted."
        exit 0
    fi
fi

# Create reports directory if needed
mkdir -p data/training/reports

# Run conversion
echo "🔧 Converting discarded examples to price patterns..."
echo ""

python3 scripts/convert-to-price-patterns.py \
    --input data/training/discarded-for-patterns.jsonl \
    --output data/training/price-patterns-50k.jsonl \
    --max-examples 50000 \
    --report data/training/reports/price-patterns-report.json

# Verify output
if [ -f "data/training/price-patterns-50k.jsonl" ]; then
    LINES=$(wc -l < data/training/price-patterns-50k.jsonl)
    echo ""
    echo "================================================================================"
    echo "COMPLETE!"
    echo "================================================================================"
    echo ""
    echo "✅ Generated $LINES price pattern examples"
    echo "✅ Effective contribution: ~7,500 examples (at 0.15 weight)"
    echo ""
    echo "📁 Output: data/training/price-patterns-50k.jsonl"
    echo "📊 Report: data/training/reports/price-patterns-report.json"
    echo ""
    echo "💰 Cost: $0 (free)"
    echo "⏱️  Time: ~5 minutes"
    echo ""
    echo "Ready to merge into v4.3 dataset!"
else
    echo "❌ Failed to generate price patterns"
    exit 1
fi
