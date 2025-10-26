#!/bin/bash
#
# MEW-1A V4.3-SHAPED WARM-START KEEPER
# =====================================
#
# Keeps the Modal Labs v4.3-shaped instance warm by pinging /health every 4 minutes.
# Prevents cold-start timeouts during production canary rollout.
#
# Usage:
#   bash scripts/keep-v4.3-shaped-warm.sh &
#   # Runs in background, logs to reports/warm-start-keeper.log
#
# Stop:
#   pkill -f keep-v4.3-shaped-warm
#

ENDPOINT="https://chicopanama--mew1a-vllm-v4-3-shaped-fastapi-app.modal.run"
PING_INTERVAL=240  # 4 minutes (Modal scaledown_window is 5 minutes)
LOG_FILE="reports/warm-start-keeper.log"

echo "🔥 Starting v4.3-shaped warm-start keeper..."
echo "   Endpoint: $ENDPOINT"
echo "   Ping interval: ${PING_INTERVAL}s (4 minutes)"
echo "   Log file: $LOG_FILE"
echo ""

mkdir -p reports

# Initial health check to wake up the instance
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Initial health check (cold start expected ~90s)..." | tee -a "$LOG_FILE"
START_TIME=$(date +%s)
RESPONSE=$(curl -s -w "\n%{http_code}" --max-time 120 "$ENDPOINT/health" 2>&1)
HTTP_CODE=$(echo "$RESPONSE" | tail -1)
END_TIME=$(date +%s)
LATENCY=$((END_TIME - START_TIME))

if [ "$HTTP_CODE" = "200" ]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ✅ Initial health check PASS (${LATENCY}s)" | tee -a "$LOG_FILE"
else
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ❌ Initial health check FAIL (HTTP $HTTP_CODE, ${LATENCY}s)" | tee -a "$LOG_FILE"
    echo "Response: $RESPONSE" | tee -a "$LOG_FILE"
fi

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Starting warm-start ping loop..." | tee -a "$LOG_FILE"

# Main ping loop
PING_COUNT=0
FAIL_COUNT=0

while true; do
    sleep $PING_INTERVAL

    PING_COUNT=$((PING_COUNT + 1))
    START_TIME=$(date +%s)

    # Ping health endpoint
    RESPONSE=$(curl -s -w "\n%{http_code}" --max-time 30 "$ENDPOINT/health" 2>&1)
    HTTP_CODE=$(echo "$RESPONSE" | tail -1)

    END_TIME=$(date +%s)
    LATENCY=$((END_TIME - START_TIME))

    if [ "$HTTP_CODE" = "200" ]; then
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] Ping #$PING_COUNT: ✅ WARM (${LATENCY}s)" | tee -a "$LOG_FILE"
    else
        FAIL_COUNT=$((FAIL_COUNT + 1))
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] Ping #$PING_COUNT: ❌ FAIL (HTTP $HTTP_CODE, ${LATENCY}s)" | tee -a "$LOG_FILE"

        # Alert if too many consecutive failures
        if [ $FAIL_COUNT -ge 3 ]; then
            echo "[$(date '+%Y-%m-%d %H:%M:%S')] ⚠️  ALERT: 3+ consecutive health check failures!" | tee -a "$LOG_FILE"
        fi
    fi

    # Reset fail count on success
    if [ "$HTTP_CODE" = "200" ]; then
        FAIL_COUNT=0
    fi
done
