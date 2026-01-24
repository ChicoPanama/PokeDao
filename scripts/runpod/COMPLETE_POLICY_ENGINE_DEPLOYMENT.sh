#!/bin/bash
# Complete Policy Engine Deployment Script
# This script finishes the Policy Engine integration and validates deployment

set -e

echo "=========================================="
echo "MEW-1A v4.3 POLICY ENGINE DEPLOYMENT"
echo "=========================================="

cd /Users/arcadio/dev/pokedao

# Step 1: Kill all background processes
echo "Step 1: Cleaning up background processes..."
killall -9 python3 2>/dev/null || true
killall -9 modal 2>/dev/null || true
sleep 2

# Step 2: Verify Policy Engine files exist
echo "Step 2: Verifying Policy Engine files..."
if [ ! -f "apps/mew1a/policy_engine.py" ]; then
    echo "ERROR: policy_engine.py not found!"
    exit 1
fi

# Test Policy Engine
echo "Testing Policy Engine..."
cd apps/mew1a
python3 policy_engine.py
if [ $? -ne 0 ]; then
    echo "ERROR: Policy Engine tests failed!"
    exit 1
fi
cd ../..

echo "✅ Policy Engine tests passed (8/8)"

# Step 3: Deploy to Modal
echo ""
echo "Step 3: Deploying to Modal..."
echo "NOTE: The /generate and /analyze endpoints need manual Policy Engine integration"
echo "See: apps/mew1a/POLICY_ENGINE_INTEGRATION.md for code snippets"
echo ""
echo "After adding the code snippets, run:"
echo "  cd apps/mew1a"
echo "  modal deploy vllm_deploy_vector_rag.py"
echo ""
echo "Then run this script again to validate"
echo ""

# Check if user wants to deploy now
read -p "Have you integrated Policy Engine into endpoints? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    cd apps/mew1a
    echo "Deploying..."
    modal deploy vllm_deploy_vector_rag.py
    cd ../..

    echo ""
    echo "Waiting for cold start (90s)..."
    sleep 90

    # Step 4: Validate deployment
    echo ""
    echo "Step 4: Validating deployment..."
    ENDPOINT="https://chicopanama--mew1a-vllm-v4-3-vector-rag-fastapi-app.modal.run"

    # Health check
    echo "Checking /health..."
    curl -s "$ENDPOINT/health" | jq .

    # Metrics check
    echo ""
    echo "Checking /metrics..."
    curl -s "$ENDPOINT/metrics" | grep mew1a | head -5

    # Step 5: Run Rules Baseline Evaluator
    echo ""
    echo "Step 5: Running Rules Baseline Evaluator..."
    python3 scripts/rules-baseline-evaluator.py

    echo ""
    echo "=========================================="
    echo "DEPLOYMENT COMPLETE!"
    echo "=========================================="
    echo ""
    echo "Check reports/v4.3_rules_baseline_agreement.json for results"
    echo "Target: ≥95% decisive agreement"
else
    echo ""
    echo "=========================================="
    echo "NEXT STEPS:"
    echo "=========================================="
    echo "1. Follow apps/mew1a/POLICY_ENGINE_INTEGRATION.md"
    echo "2. Add Policy Engine code to /generate and /analyze"
    echo "3. Run: cd apps/mew1a && modal deploy vllm_deploy_vector_rag.py"
    echo "4. Run this script again to validate"
fi
