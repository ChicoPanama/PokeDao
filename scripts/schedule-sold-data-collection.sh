#!/bin/bash

###############################################################################
# AUTOMATED SOLD DATA COLLECTION SCHEDULER
###############################################################################
# This script schedules the sold data collector to run automatically when
# the eBay rate limit resets (typically 24 hours after initial rate limit hit)
#
# Usage:
#   ./scripts/schedule-sold-data-collection.sh
#
# Or add to crontab to run daily at 3 AM:
#   crontab -e
#   0 3 * * * cd /Users/arcadio/dev/pokedao && ./scripts/schedule-sold-data-collection.sh >> logs/sold-data-collector.log 2>&1
###############################################################################

set -e

# Configuration
PROJECT_DIR="/Users/arcadio/dev/pokedao"
SCRIPT_PATH="$PROJECT_DIR/scripts/harvest-top-sold-cards-with-trends.ts"
LOG_DIR="$PROJECT_DIR/logs"
LOG_FILE="$LOG_DIR/sold-data-collection-$(date +%Y-%m-%d).log"
LOCK_FILE="$PROJECT_DIR/.sold-collector.lock"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Ensure log directory exists
mkdir -p "$LOG_DIR"

# Check if already running
if [ -f "$LOCK_FILE" ]; then
    echo -e "${YELLOW}⚠️  Collector is already running (lock file exists)${NC}"
    echo "If this is an error, remove: $LOCK_FILE"
    exit 1
fi

# Create lock file
touch "$LOCK_FILE"
trap "rm -f $LOCK_FILE" EXIT

# Function to log with timestamp
log() {
    echo -e "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

log "${BLUE}🚀 SOLD DATA COLLECTION SCHEDULER STARTED${NC}"
log "============================================================"

# Change to project directory
cd "$PROJECT_DIR"

# Check if rate limit might have reset (simple check - if it's been >20 hours since last attempt)
LAST_ATTEMPT_FILE="$PROJECT_DIR/.last-ebay-attempt"
CURRENT_TIME=$(date +%s)
TWENTY_HOURS=$((20 * 60 * 60))

if [ -f "$LAST_ATTEMPT_FILE" ]; then
    LAST_ATTEMPT=$(cat "$LAST_ATTEMPT_FILE")
    TIME_DIFF=$((CURRENT_TIME - LAST_ATTEMPT))

    if [ $TIME_DIFF -lt $TWENTY_HOURS ]; then
        HOURS_LEFT=$(( (TWENTY_HOURS - TIME_DIFF) / 3600 ))
        log "${YELLOW}⏳ Rate limit likely still active. Wait $HOURS_LEFT more hours.${NC}"
        log "Last attempt was $(( TIME_DIFF / 3600 )) hours ago"
        exit 0
    fi
fi

# Test eBay API availability with a simple request
log "${BLUE}🔍 Testing eBay API availability...${NC}"

TEST_RESULT=$(curl -s -w "%{http_code}" -o /dev/null \
    "https://svcs.ebay.com/services/search/FindingService/v1?OPERATION-NAME=findCompletedItems&SERVICE-VERSION=1.0.0&SECURITY-APPNAME=${EBAY_APP_ID:-test}&RESPONSE-DATA-FORMAT=XML&keywords=pokemon&paginationInput.entriesPerPage=1" \
    2>/dev/null || echo "000")

if [ "$TEST_RESULT" = "500" ]; then
    log "${RED}❌ eBay API still rate limited (HTTP 500)${NC}"
    echo "$CURRENT_TIME" > "$LAST_ATTEMPT_FILE"
    exit 1
elif [ "$TEST_RESULT" = "000" ]; then
    log "${RED}❌ Cannot connect to eBay API${NC}"
    exit 1
fi

log "${GREEN}✅ eBay API appears to be available (HTTP $TEST_RESULT)${NC}"

# Load environment variables
if [ -f "$PROJECT_DIR/.env" ]; then
    export $(grep -v '^#' "$PROJECT_DIR/.env" | xargs)
    log "${GREEN}✅ Environment variables loaded${NC}"
else
    log "${RED}❌ .env file not found${NC}"
    exit 1
fi

# Run the sold data collector
log "${BLUE}📊 Starting sold data collection...${NC}"
log "Script: $SCRIPT_PATH"
log "============================================================"

if pnpm tsx "$SCRIPT_PATH" 2>&1 | tee -a "$LOG_FILE"; then
    log "${GREEN}✅ Sold data collection completed successfully${NC}"

    # Update last successful run timestamp
    echo "$CURRENT_TIME" > "$PROJECT_DIR/.last-successful-collection"

    # Generate updated report
    log "${BLUE}📈 Generating updated report with trends...${NC}"
    if pnpm tsx "$PROJECT_DIR/scripts/generate-top-cards-report.ts" 2>&1 | tee -a "$LOG_FILE"; then
        log "${GREEN}✅ Report generation completed${NC}"
    else
        log "${YELLOW}⚠️  Report generation failed but data was collected${NC}"
    fi

    # Show summary
    log ""
    log "${GREEN}============================================================${NC}"
    log "${GREEN}📊 COLLECTION SUMMARY${NC}"
    log "${GREEN}============================================================${NC}"

    # Count records in database
    SOLD_COUNT=$(psql postgresql://pokedao:pokedao@localhost:5432/pokedao -tAc "SELECT COUNT(*) FROM \"CompSale\"" 2>/dev/null || echo "0")
    LISTING_COUNT=$(psql postgresql://pokedao:pokedao@localhost:5432/pokedao -tAc "SELECT COUNT(*) FROM \"UnifiedMarketListing\"" 2>/dev/null || echo "0")

    log "Total sold transactions: ${SOLD_COUNT}"
    log "Total active listings: ${LISTING_COUNT}"
    log "Reports available at:"
    log "  - data/top-3000-sold-cards-with-trends.json"
    log "  - data/top-3000-cards-market-report.json"
    log "  - data/top-3000-cards-market-report.csv"
    log "${GREEN}============================================================${NC}"

else
    EXIT_CODE=$?
    log "${RED}❌ Sold data collection failed with exit code: $EXIT_CODE${NC}"

    # Check if it's a rate limit error
    if grep -q "rate limit\|Rate.*Limit\|10001" "$LOG_FILE" 2>/dev/null; then
        log "${YELLOW}⚠️  Still rate limited. Will retry next scheduled run.${NC}"
        echo "$CURRENT_TIME" > "$LAST_ATTEMPT_FILE"
    fi

    exit 1
fi

log "${BLUE}🎉 Scheduler completed at $(date '+%Y-%m-%d %H:%M:%S')${NC}"
log "============================================================"
