#!/bin/bash

# Market Pipeline Shell Wrapper
# Provides convenient access to the unified market pipeline CLI

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default configuration
DEFAULT_SOURCES="ebay,tcgplayer"
DEFAULT_MODE="default"
DEFAULT_OUTPUT_DIR="./reports"
DEFAULT_LIMIT=""
DEFAULT_VERBOSE=false

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

show_help() {
    cat << EOF
Market Pipeline Shell Wrapper

USAGE:
    $0 [OPTIONS]

OPTIONS:
    -s, --sources SOURCES     Comma-separated sources (default: ebay,tcgplayer)
    -c, --collections COLS    Comma-separated collection slugs
    -m, --mode MODE           Pipeline mode: conservative, default, aggressive
    -d, --since DATE          Only process listings since this date (ISO format)
    -l, --limit NUMBER        Maximum listings per source
    -o, --output DIR          Output directory (default: ./reports)
    -n, --dry-run             Run without persisting results
    -v, --verbose             Enable verbose logging
    -h, --help                Show this help message

EXAMPLES:
    # Run conservative eBay-only pipeline
    $0 --sources=ebay --mode=conservative

    # Process specific collections
    $0 --collections=slabs,prospects --limit=1000

    # Dry run since January 1st
    $0 --since=2025-01-01 --dry-run

    # Verbose run with all sources
    $0 --sources=ebay,tcgplayer,fanatics --verbose

ENVIRONMENT VARIABLES:
    POKEMON_TCG_API_KEY       Pokemon TCG API key for cross-referencing
    DATABASE_URL              Database connection string
    LOG_LEVEL                 Logging level (trace, debug, info, warn, error)

EOF
}

check_dependencies() {
    log_info "Checking dependencies..."
    
    # Check if Node.js is installed
    if ! command -v node &> /dev/null; then
        log_error "Node.js is not installed. Please install Node.js first."
        exit 1
    fi
    
    # Check if tsx is available
    if ! command -v tsx &> /dev/null && ! npx tsx --version &> /dev/null; then
        log_error "tsx is not available. Please install it with: npm install -g tsx"
        exit 1
    fi
    
    # Check if we're in the right directory
    if [ ! -f "package.json" ] || [ ! -d "apps/agent" ]; then
        log_error "Please run this script from the project root directory"
        exit 1
    fi
    
    log_success "All dependencies are available"
}

validate_arguments() {
    # Validate mode
    if [ "$MODE" != "conservative" ] && [ "$MODE" != "default" ] && [ "$MODE" != "aggressive" ]; then
        log_error "Invalid mode: $MODE. Must be conservative, default, or aggressive"
        exit 1
    fi
    
    # Validate since date if provided
    if [ -n "$SINCE" ]; then
        if ! date -d "$SINCE" &> /dev/null; then
            log_error "Invalid since date: $SINCE. Use ISO format: 2025-01-01T00:00:00Z"
            exit 1
        fi
    fi
    
    # Validate limit if provided
    if [ -n "$LIMIT" ] && ! [[ "$LIMIT" =~ ^[0-9]+$ ]]; then
        log_error "Invalid limit: $LIMIT. Must be a positive integer"
        exit 1
    fi
    
    # Create output directory if it doesn't exist
    if [ ! -d "$OUTPUT_DIR" ]; then
        log_info "Creating output directory: $OUTPUT_DIR"
        mkdir -p "$OUTPUT_DIR"
    fi
}

show_configuration() {
    echo ""
    log_info "Pipeline Configuration:"
    echo "  Sources: $SOURCES"
    echo "  Collections: ${COLLECTIONS:-none}"
    echo "  Mode: $MODE"
    echo "  Since: ${SINCE:-none}"
    echo "  Limit: ${LIMIT:-none}"
    echo "  Output Directory: $OUTPUT_DIR"
    echo "  Dry Run: $DRY_RUN"
    echo "  Verbose: $VERBOSE"
    echo ""
}

run_pipeline() {
    log_info "Starting market pipeline..."
    
    # Build command arguments
    local args=(
        "apps/agent/src/cli/run-market-pipeline.ts"
        "--sources" "$SOURCES"
        "--mode" "$MODE"
        "--output-dir" "$OUTPUT_DIR"
    )
    
    # Add optional arguments
    [ -n "$COLLECTIONS" ] && args+=("--collections" "$COLLECTIONS")
    [ -n "$SINCE" ] && args+=("--since" "$SINCE")
    [ -n "$LIMIT" ] && args+=("--limit" "$LIMIT")
    [ "$DRY_RUN" = true ] && args+=("--dry-run")
    [ "$VERBOSE" = true ] && args+=("--verbose")
    
    # Run the pipeline
    if command -v tsx &> /dev/null; then
        tsx "${args[@]}"
    else
        npx tsx "${args[@]}"
    fi
    
    if [ $? -eq 0 ]; then
        log_success "Pipeline completed successfully!"
    else
        log_error "Pipeline failed!"
        exit 1
    fi
}

show_results() {
    echo ""
    log_info "Pipeline Results:"
    
    # Check if reports were generated
    if [ "$DRY_RUN" = false ] && [ -d "$OUTPUT_DIR" ]; then
        local latest_report=$(find "$OUTPUT_DIR" -name "*.md" -type f -printf '%T@ %p\n' 2>/dev/null | sort -n | tail -1 | cut -d' ' -f2-)
        
        if [ -n "$latest_report" ]; then
            log_success "Latest report: $latest_report"
        fi
        
        # Count generated files
        local file_count=$(find "$OUTPUT_DIR" -type f | wc -l)
        log_info "Generated $file_count files in $OUTPUT_DIR"
    fi
    
    echo ""
    log_info "Next Steps:"
    echo "1. Review the generated reports for insights"
    echo "2. Import CSV files into Excel/Google Sheets for analysis"
    echo "3. Check collection-specific reports for targeted analysis"
    echo "4. Set up automated runs for continuous monitoring"
    echo ""
}

# Parse command line arguments
SOURCES="$DEFAULT_SOURCES"
COLLECTIONS=""
MODE="$DEFAULT_MODE"
SINCE=""
LIMIT=""
OUTPUT_DIR="$DEFAULT_OUTPUT_DIR"
DRY_RUN=false
VERBOSE="$DEFAULT_VERBOSE"

while [[ $# -gt 0 ]]; do
    case $1 in
        -s|--sources)
            SOURCES="$2"
            shift 2
            ;;
        -c|--collections)
            COLLECTIONS="$2"
            shift 2
            ;;
        -m|--mode)
            MODE="$2"
            shift 2
            ;;
        -d|--since)
            SINCE="$2"
            shift 2
            ;;
        -l|--limit)
            LIMIT="$2"
            shift 2
            ;;
        -o|--output)
            OUTPUT_DIR="$2"
            shift 2
            ;;
        -n|--dry-run)
            DRY_RUN=true
            shift
            ;;
        -v|--verbose)
            VERBOSE=true
            shift
            ;;
        -h|--help)
            show_help
            exit 0
            ;;
        *)
            log_error "Unknown option: $1"
            echo ""
            show_help
            exit 1
            ;;
    esac
done

# Main execution
main() {
    echo "🚀 Market Pipeline - Unified Pokemon Card Arbitrage Intelligence"
    echo "=================================================================="
    echo ""
    
    check_dependencies
    validate_arguments
    show_configuration
    
    # Ask for confirmation unless dry run or verbose
    if [ "$DRY_RUN" = false ] && [ "$VERBOSE" = false ]; then
        read -p "Do you want to proceed with the pipeline execution? (y/N): " -n 1 -r
        echo ""
        
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            log_warning "Pipeline execution cancelled by user"
            exit 0
        fi
    fi
    
    run_pipeline
    show_results
    
    log_success "Market Pipeline execution complete!"
}

# Run main function
main "$@"
