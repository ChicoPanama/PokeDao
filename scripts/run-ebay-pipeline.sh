#!/bin/bash

# eBay Data Pipeline Execution Script
# Comprehensive Pokemon Card Arbitrage Intelligence System

set -e  # Exit on any error

echo "🚀 eBay Data Pipeline - Pokemon Card Arbitrage Intelligence System"
echo "=================================================================="
echo ""

# Configuration
DB_PATH="${DB_PATH:-research/tcgplayer-discovery/collector_crypt_ebay_complete.db}"
BATCH_SIZE="${BATCH_SIZE:-1000}"
MIN_PROFIT="${MIN_PROFIT:-15}"
MAX_RISK="${MAX_RISK:-MEDIUM}"
MIN_CONFIDENCE="${MIN_CONFIDENCE:-0.7}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Functions
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

check_dependencies() {
    log_info "Checking dependencies..."
    
    # Check if tsx is installed
    if ! command -v tsx &> /dev/null; then
        log_error "tsx is not installed. Please install it with: npm install -g tsx"
        exit 1
    fi
    
    # Check if Node.js is installed
    if ! command -v node &> /dev/null; then
        log_error "Node.js is not installed. Please install Node.js first."
        exit 1
    fi
    
    # Check if database exists
    if [ ! -f "$DB_PATH" ]; then
        log_error "Database not found: $DB_PATH"
        log_info "Please ensure the eBay database exists at the specified path."
        exit 1
    fi
    
    log_success "All dependencies are available"
}

create_reports_directory() {
    log_info "Creating reports directory..."
    mkdir -p reports
    log_success "Reports directory ready"
}

show_configuration() {
    echo ""
    log_info "Pipeline Configuration:"
    echo "  Database: $DB_PATH"
    echo "  Batch Size: $BATCH_SIZE"
    echo "  Min Profit %: $MIN_PROFIT%"
    echo "  Max Risk Level: $MAX_RISK"
    echo "  Min Confidence: $MIN_CONFIDENCE"
    echo ""
}

run_pipeline() {
    log_info "Starting eBay Master Pipeline..."
    echo ""
    
    # Run the master pipeline
    tsx scripts/ebay-master-pipeline.ts \
        --db "$DB_PATH" \
        --batch-size "$BATCH_SIZE" \
        --min-profit "$MIN_PROFIT" \
        --max-risk "$MAX_RISK" \
        --min-confidence "$MIN_CONFIDENCE"
    
    if [ $? -eq 0 ]; then
        log_success "Pipeline execution completed successfully!"
    else
        log_error "Pipeline execution failed!"
        exit 1
    fi
}

show_results() {
    echo ""
    log_info "Pipeline Results:"
    echo "=================="
    
    # Show available reports
    if [ -f "reports/ebay-master-pipeline-report.md" ]; then
        log_success "Master Pipeline Report: reports/ebay-master-pipeline-report.md"
    fi
    
    if [ -f "reports/ebay-arbitrage-opportunities.json" ]; then
        # Count opportunities
        OPPORTUNITIES=$(jq '.stats.totalOpportunities' reports/ebay-arbitrage-opportunities.json 2>/dev/null || echo "N/A")
        PROFIT_POTENTIAL=$(jq '.stats.totalProfitPotential' reports/ebay-arbitrage-opportunities.json 2>/dev/null || echo "N/A")
        
        log_success "Arbitrage Opportunities: $OPPORTUNITIES opportunities found"
        log_success "Total Profit Potential: \$${PROFIT_POTENTIAL}"
    fi
    
    if [ -f "reports/ebay-arbitrage-opportunities.csv" ]; then
        log_success "CSV Export: reports/ebay-arbitrage-opportunities.csv"
    fi
    
    echo ""
    log_info "All reports saved to the 'reports/' directory"
}

show_next_steps() {
    echo ""
    log_info "Next Steps:"
    echo "==========="
    echo "1. Review the master pipeline report for comprehensive analysis"
    echo "2. Open the CSV file in Excel/Google Sheets for detailed opportunity analysis"
    echo "3. Focus on HIGH confidence, LOW risk opportunities first"
    echo "4. Validate high-value opportunities manually before investing"
    echo "5. Set up monitoring for new opportunities"
    echo ""
    log_info "Recommended filters for spreadsheet analysis:"
    echo "  - Confidence > 0.8"
    echo "  - Risk Level = LOW or MEDIUM"
    echo "  - Profit Potential > \$100"
    echo "  - Liquidity = HIGH"
    echo ""
}

# Main execution
main() {
    echo "Starting eBay Data Pipeline execution..."
    echo ""
    
    check_dependencies
    create_reports_directory
    show_configuration
    
    # Ask for confirmation
    read -p "Do you want to proceed with the pipeline execution? (y/N): " -n 1 -r
    echo ""
    
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_warning "Pipeline execution cancelled by user"
        exit 0
    fi
    
    run_pipeline
    show_results
    show_next_steps
    
    log_success "eBay Data Pipeline execution complete!"
}

# Handle script arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --db)
            DB_PATH="$2"
            shift 2
            ;;
        --batch-size)
            BATCH_SIZE="$2"
            shift 2
            ;;
        --min-profit)
            MIN_PROFIT="$2"
            shift 2
            ;;
        --max-risk)
            MAX_RISK="$2"
            shift 2
            ;;
        --min-confidence)
            MIN_CONFIDENCE="$2"
            shift 2
            ;;
        --help)
            echo "eBay Data Pipeline Execution Script"
            echo ""
            echo "Usage: $0 [options]"
            echo ""
            echo "Options:"
            echo "  --db PATH              Database path (default: research/tcgplayer-discovery/collector_crypt_ebay_complete.db)"
            echo "  --batch-size SIZE      Batch size for processing (default: 1000)"
            echo "  --min-profit PERCENT   Minimum profit percentage (default: 15)"
            echo "  --max-risk LEVEL       Maximum risk level: LOW, MEDIUM, HIGH (default: MEDIUM)"
            echo "  --min-confidence NUM   Minimum confidence score 0.0-1.0 (default: 0.7)"
            echo "  --help                 Show this help message"
            echo ""
            echo "Environment Variables:"
            echo "  DB_PATH, BATCH_SIZE, MIN_PROFIT, MAX_RISK, MIN_CONFIDENCE"
            echo ""
            echo "Examples:"
            echo "  $0                                    # Run with defaults"
            echo "  $0 --min-profit 20 --max-risk LOW    # Conservative settings"
            echo "  $0 --batch-size 500                   # Smaller batch size"
            echo ""
            exit 0
            ;;
        *)
            log_error "Unknown option: $1"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

# Run main function
main "$@"
