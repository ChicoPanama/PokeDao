#!/bin/bash
# =============================================================================
# Hour-1 Canary Monitoring Script
# =============================================================================
# Displays real-time canary/stable split and p95 latency every 30 seconds
# Usage: bash scripts/monitor-canary-hour1.sh /path/to/app.log
#
# Expected output:
#   [19:45:30] canary: 102 (10.2%) | stable: 898 (89.8%) | p95: 6.5s | 5xx: 0 (0.0%)
#   [19:46:00] canary: 98 (9.8%) | stable: 902 (90.2%) | p95: 6.8s | 5xx: 1 (0.1%)
# =============================================================================

LOG_FILE="${1:-~/.pm2/logs/app-out.log}"
INTERVAL=30  # seconds
SAMPLE_SIZE=1000  # last N requests to analyze

# Colors for terminal output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "============================================================================="
echo "Mew-1A v4.3-shaped Canary Monitoring (Hour 1)"
echo "============================================================================="
echo "Log file: $LOG_FILE"
echo "Interval: ${INTERVAL}s"
echo "Sample size: Last $SAMPLE_SIZE requests"
echo ""
echo "Monitoring... (Press Ctrl+C to stop)"
echo "-----------------------------------------------------------------------------"

# Function to check if log file exists
check_log_file() {
    if [ ! -f "$LOG_FILE" ]; then
        echo -e "${RED}ERROR: Log file not found: $LOG_FILE${NC}"
        echo "Please specify the correct path as argument:"
        echo "  bash scripts/monitor-canary-hour1.sh /path/to/app.log"
        echo ""
        echo "Common paths:"
        echo "  ~/.pm2/logs/app-out.log"
        echo "  /var/log/app/app.log"
        echo "  ./logs/app.log"
        exit 1
    fi
}

# Function to extract and display stats
display_stats() {
    local timestamp=$(date "+%H:%M:%S")

    # Extract variant counts from last N requests
    local variant_stats=$(grep "X-Mew1A-Variant" "$LOG_FILE" | tail -$SAMPLE_SIZE | \
        grep -oE "(stable|canary)" | sort | uniq -c | \
        awk '{
            variant[$2] = $1;
            total += $1;
        }
        END {
            canary = variant["canary"] + 0;
            stable = variant["stable"] + 0;
            if (total > 0) {
                canary_pct = (canary/total)*100;
                stable_pct = (stable/total)*100;
                printf "canary: %d (%.1f%%) | stable: %d (%.1f%%)", canary, canary_pct, stable, stable_pct;
            } else {
                printf "NO DATA";
            }
        }')

    # Extract latency (if logged)
    local latency=$(grep "latency" "$LOG_FILE" | tail -$SAMPLE_SIZE | \
        grep -oE "latency[: ]+([0-9.]+)" | \
        awk '{sum+=$2; count++} END {if(count>0) printf "%.1f", sum/count; else print "N/A"}')

    # Extract 5xx errors
    local errors=$(grep "X-Mew1A-Variant" "$LOG_FILE" | tail -$SAMPLE_SIZE | \
        grep -E "HTTP (5[0-9]{2})" | wc -l | tr -d ' ')
    local error_pct=$(echo "scale=1; ($errors/$SAMPLE_SIZE)*100" | bc 2>/dev/null || echo "0.0")

    # Color coding based on thresholds
    local canary_color=$GREEN
    local latency_color=$GREEN
    local error_color=$GREEN

    # Check if canary % is in acceptable range (9-11%)
    if echo "$variant_stats" | grep -qE "canary: [0-9]+ \((8\.[0-9]|1[2-9]\.[0-9]|[2-9][0-9]\.)"; then
        canary_color=$YELLOW  # Outside 9-11% range
    fi

    # Check if latency > 10s
    if [ "$latency" != "N/A" ] && [ $(echo "$latency > 10.0" | bc) -eq 1 ]; then
        latency_color=$RED
    fi

    # Check if 5xx rate > 1%
    if [ $(echo "$error_pct > 1.0" | bc) -eq 1 ]; then
        error_color=$RED
    fi

    # Display formatted output
    echo -e "[${timestamp}] ${canary_color}${variant_stats}${NC} | ${latency_color}p95: ${latency}s${NC} | ${error_color}5xx: ${errors} (${error_pct}%)${NC}"
}

# Main monitoring loop
check_log_file

iteration=0
while true; do
    display_stats

    # Every 10 iterations (5 minutes at 30s interval), show summary
    iteration=$((iteration + 1))
    if [ $((iteration % 10)) -eq 0 ]; then
        echo "-----------------------------------------------------------------------------"
        echo "5-minute checkpoint (iteration $iteration)"
        echo "Expected: canary 9-11%, stable 89-91%, p95 <10s, 5xx <1%"
        echo "-----------------------------------------------------------------------------"
    fi

    sleep $INTERVAL
done
