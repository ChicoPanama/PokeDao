#!/bin/bash

# PokeDAO API Architecture Installation Validator
# Ensures complete compatibility before making any changes

set -e  # Exit on any error

echo "🔍 POKEDAO API ARCHITECTURE VALIDATION"
echo "======================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    local status=$1
    local message=$2
    case $status in
        "success") echo -e "${GREEN}✅ $message${NC}" ;;
        "error") echo -e "${RED}❌ $message${NC}" ;;
        "warning") echo -e "${YELLOW}⚠️ $message${NC}" ;;
        "info") echo -e "${BLUE}ℹ️ $message${NC}" ;;
    esac
}

# Function to check command availability
check_command() {
    local cmd=$1
    local name=$2
    if command -v $cmd &> /dev/null; then
        local version=$($cmd --version 2>/dev/null | head -n1)
        print_status "success" "$name available: $version"
        return 0
    else
        print_status "error" "$name not found"
        return 1
    fi
}

# Function to check file exists
check_file() {
    local file=$1
    local description=$2
    if [ -f "$file" ]; then
        print_status "success" "$description found: $file"
        return 0
    else
        print_status "error" "$description missing: $file"
        return 1
    fi
}

# Function to check directory exists
check_directory() {
    local dir=$1
    local description=$2
    if [ -d "$dir" ]; then
        print_status "success" "$description found: $dir"
        return 0
    else
        print_status "error" "$description missing: $dir"
        return 1
    fi
}

# Initialize validation results
VALIDATION_ERRORS=0
VALIDATION_WARNINGS=0

echo ""
echo "📋 Phase 1: Environment Prerequisites"
echo "------------------------------------"

# Check Node.js
if check_command "node" "Node.js"; then
    NODE_VERSION=$(node --version | sed 's/v//')
    NODE_MAJOR=$(echo $NODE_VERSION | cut -d. -f1)
    if [ $NODE_MAJOR -ge 18 ]; then
        print_status "success" "Node.js version $NODE_VERSION is compatible"
    else
        print_status "warning" "Node.js version $NODE_VERSION may cause issues (recommend 18+)"
        ((VALIDATION_WARNINGS++))
    fi
else
    print_status "error" "Node.js is required for API clients"
    ((VALIDATION_ERRORS++))
fi

# Check npm
if check_command "npm" "npm"; then
    :
else
    print_status "error" "npm is required for package management"
    ((VALIDATION_ERRORS++))
fi

# Check Python
if check_command "python3" "Python 3"; then
    PYTHON_VERSION=$(python3 --version | cut -d' ' -f2)
    PYTHON_MAJOR=$(echo $PYTHON_VERSION | cut -d. -f1)
    PYTHON_MINOR=$(echo $PYTHON_VERSION | cut -d. -f2)
    if [ $PYTHON_MAJOR -eq 3 ] && [ $PYTHON_MINOR -ge 8 ]; then
        print_status "success" "Python version $PYTHON_VERSION is compatible"
    else
        print_status "warning" "Python version $PYTHON_VERSION may cause issues (recommend 3.8+)"
        ((VALIDATION_WARNINGS++))
    fi
else
    print_status "error" "Python 3 is required for normalization engine"
    ((VALIDATION_ERRORS++))
fi

# Check pip
if check_command "pip3" "pip3"; then
    :
else
    print_status "error" "pip3 is required for Python packages"
    ((VALIDATION_ERRORS++))
fi

echo ""
echo "🏗️ Phase 2: Project Structure Validation"
echo "----------------------------------------"

# Check critical directories
check_directory "./ml" "ML directory"
check_directory "./utils" "Utils directory" 
check_directory "./phase4" "Phase4 directory"
check_directory "./scripts" "Scripts directory"

# Check critical files
check_file "./package.json" "Root package.json"
check_file "./ml/normalize.py" "Normalization engine"
check_file "./utils/scraping/pagination.ts" "Pagination utilities"

# Check if it's a workspace
if [ -f "./pnpm-workspace.yaml" ] || [ -f "./lerna.json" ] || grep -q '"workspaces"' ./package.json 2>/dev/null; then
    print_status "success" "Monorepo workspace structure detected"
else
    print_status "info" "Single package structure detected"
fi

echo ""
echo "🧠 Phase 3: Normalization Engine Validation"
echo "------------------------------------------"

# Test normalization engine
print_status "info" "Testing normalization engine functionality..."

# Create temporary test script
cat > temp_norm_test.py << 'EOF'
import sys
import os
import json

# Add ml directory to path
sys.path.append('./ml')

try:
    from normalize import CardNormalizer
    
    # Test with sample titles
    test_titles = [
        "Charizard (4/102) [Base Set] Holo Rare",
        "Pokemon - Pikachu - 58/102 - Base Set - Common", 
        "Dark Charizard Holo #4 Team Rocket PSA 10",
        "Lugia Neo Genesis 9/111 Holo First Edition"
    ]
    
    normalizer = CardNormalizer()
    results = []
    
    for title in test_titles:
        try:
            result = normalizer.normalize_card_title(title)
            results.append({
                'title': title,
                'success': True,
                'card_key': result.card_key,
                'confidence': round(result.confidence, 2),
                'pokemon': result.name,
                'set': result.set_code,
                'number': result.number
            })
        except Exception as e:
            results.append({
                'title': title,
                'success': False,
                'error': str(e)
            })
    
    print(json.dumps({
        'status': 'success',
        'results': results,
        'summary': {
            'total': len(test_titles),
            'successful': len([r for r in results if r['success']]),
            'failed': len([r for r in results if not r['success']])
        }
    }, indent=2))
    
except ImportError as e:
    print(json.dumps({
        'status': 'import_error',
        'error': str(e),
        'message': 'Normalization engine import failed'
    }))
    
except Exception as e:
    print(json.dumps({
        'status': 'error', 
        'error': str(e),
        'message': 'Unexpected error in normalization engine'
    }))
EOF

# Run normalization test using the configured virtual environment
if /Users/arcadio/dev/pokedao/.venv/bin/python temp_norm_test.py > norm_test_output.json 2>&1; then
    # Parse results
        if [ -f "norm_test_output.json" ]; then
            NORM_STATUS=$(/Users/arcadio/dev/pokedao/.venv/bin/python -c "import json; data=json.load(open('norm_test_output.json')); print(data.get('status', 'unknown'))")
            
            case $NORM_STATUS in
                "success")
                    SUCCESSFUL=$(/Users/arcadio/dev/pokedao/.venv/bin/python -c "import json; data=json.load(open('norm_test_output.json')); print(data['summary']['successful'])")
                    TOTAL=$(/Users/arcadio/dev/pokedao/.venv/bin/python -c "import json; data=json.load(open('norm_test_output.json')); print(data['summary']['total'])")
                    SUCCESS_RATE=$(/Users/arcadio/dev/pokedao/.venv/bin/python -c "import json; data=json.load(open('norm_test_output.json')); print(round(data['summary']['successful']/data['summary']['total']*100, 1))")                print_status "success" "Normalization engine working: $SUCCESSFUL/$TOTAL titles ($SUCCESS_RATE%)"
                
                if [ $(echo "$SUCCESS_RATE >= 75" | bc -l) -eq 1 ]; then
                    print_status "success" "Normalization compatibility: EXCELLENT"
                elif [ $(echo "$SUCCESS_RATE >= 50" | bc -l) -eq 1 ]; then
                    print_status "warning" "Normalization compatibility: MODERATE"
                    ((VALIDATION_WARNINGS++))
                else
                    print_status "error" "Normalization compatibility: POOR"
                    ((VALIDATION_ERRORS++))
                fi
                ;;
            "import_error")
                ERROR_MSG=$(/Users/arcadio/dev/pokedao/.venv/bin/python -c "import json; data=json.load(open('norm_test_output.json')); print(data.get('error', 'Unknown import error'))")
                print_status "error" "Normalization engine import failed: $ERROR_MSG"
                ((VALIDATION_ERRORS++))
                ;;
            *)
                print_status "error" "Normalization engine test failed"
                ((VALIDATION_ERRORS++))
                ;;
        esac
    else
        print_status "error" "Normalization test output not found"
        ((VALIDATION_ERRORS++))
    fi
else
    print_status "error" "Normalization engine test execution failed"
    ((VALIDATION_ERRORS++))
fi

# Clean up test files
rm -f temp_norm_test.py norm_test_output.json

echo ""
echo "🌐 Phase 4: API Connectivity Test"
echo "--------------------------------"

# Test internet connectivity
if ping -c 1 google.com &> /dev/null; then
    print_status "success" "Internet connectivity available"
else
    print_status "error" "Internet connectivity required for API testing"
    ((VALIDATION_ERRORS++))
fi

# Test npm registry access
if npm ping &> /dev/null; then
    print_status "success" "npm registry accessible"
else
    print_status "warning" "npm registry connectivity issues"
    ((VALIDATION_WARNINGS++))
fi

# Test specific API endpoints (without keys)
echo ""
print_status "info" "Testing API endpoint accessibility..."

# Test TCGPlayer API
if curl -s --head "https://api.tcgplayer.com/catalog/categories" | head -n1 | grep -q "200\|401\|403"; then
    print_status "success" "TCGPlayer API endpoint accessible"
else
    print_status "warning" "TCGPlayer API endpoint issues"
    ((VALIDATION_WARNINGS++))
fi

# Test eBay API  
if curl -s --head "https://api.ebay.com/buy/browse/v1/item_summary/search" | head -n1 | grep -q "200\|401\|403"; then
    print_status "success" "eBay API endpoint accessible"
else
    print_status "warning" "eBay API endpoint issues" 
    ((VALIDATION_WARNINGS++))
fi

# Test Pokemon TCG API
if curl -s --head "https://api.pokemontcg.io/v2/cards" | head -n1 | grep -q "200"; then
    print_status "success" "Pokemon TCG API endpoint accessible"
else
    print_status "warning" "Pokemon TCG API endpoint issues"
    ((VALIDATION_WARNINGS++))
fi

echo ""
echo "📊 Phase 5: Validation Summary"
echo "-----------------------------"

# Calculate overall validation status
TOTAL_CHECKS=$((VALIDATION_ERRORS + VALIDATION_WARNINGS))

echo ""
if [ $VALIDATION_ERRORS -eq 0 ] && [ $VALIDATION_WARNINGS -eq 0 ]; then
    print_status "success" "VALIDATION PASSED: All systems ready for API installation"
    echo ""
    echo "🚀 READY TO PROCEED WITH:"
    echo "   ✅ TCGPlayer API client installation"
    echo "   ✅ eBay Browse API client installation" 
    echo "   ✅ Pokemon TCG API client installation"
    echo "   ✅ Integration with existing normalization engine"
    echo "   ✅ Phase 4 multi-source pipeline enhancement"
    echo ""
    echo "🎯 NEXT STEP: Run API compatibility check"
    echo "   npx tsx scripts/api-compatibility-check.ts"
    
elif [ $VALIDATION_ERRORS -eq 0 ]; then
    print_status "warning" "VALIDATION PASSED WITH WARNINGS: $VALIDATION_WARNINGS warnings found"
    echo ""
    echo "⚠️ PROCEED WITH CAUTION:"
    echo "   • Address warnings if possible"
    echo "   • Monitor for issues during installation"
    echo "   • Test thoroughly before production use"
    echo ""
    echo "🎯 NEXT STEP: Run API compatibility check"
    echo "   npx tsx scripts/api-compatibility-check.ts"
    
else
    print_status "error" "VALIDATION FAILED: $VALIDATION_ERRORS errors, $VALIDATION_WARNINGS warnings"
    echo ""
    echo "🛑 CRITICAL ISSUES MUST BE RESOLVED:"
    echo "   • Fix all error conditions above" 
    echo "   • Ensure normalization engine is working"
    echo "   • Verify all required dependencies"
    echo "   • Re-run validation after fixes"
    echo ""
    echo "❌ DO NOT PROCEED WITH API INSTALLATION"
    exit 1
fi

echo ""
echo "📋 VALIDATION COMPLETE"
echo "====================="
