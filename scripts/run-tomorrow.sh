#!/bin/bash

###############################################################################
# RUN SOLD DATA COLLECTOR TOMORROW
###############################################################################
# Simple script to schedule the sold data collector to run tomorrow at 3 AM
# when the eBay rate limit will have reset.
###############################################################################

PROJECT_DIR="/Users/arcadio/dev/pokedao"

echo "⏰ SCHEDULING SOLD DATA COLLECTION FOR TOMORROW"
echo "============================================================"
echo ""

# Calculate tomorrow at 3 AM
TOMORROW_3AM=$(date -v+1d -v3H -v0M -v0S '+%Y-%m-%d %H:%M:%S')

echo "📅 Collection will run at: $TOMORROW_3AM"
echo ""
echo "The script will:"
echo "  1. Test if eBay rate limit has reset"
echo "  2. Collect top 3,000 sold Pokemon cards with price data"
echo "  3. Calculate 1-month, 6-month, and 12-month trends"
echo "  4. Generate comprehensive reports"
echo ""
echo "============================================================"
echo ""

# Create a simple script to run tomorrow
cat > /tmp/run-sold-collector.sh << 'EOF'
#!/bin/bash
cd /Users/arcadio/dev/pokedao
echo "🚀 Starting sold data collection at $(date)"
bash scripts/schedule-sold-data-collection.sh
EOF

chmod +x /tmp/run-sold-collector.sh

# Try to use 'at' command (if available)
if command -v at &> /dev/null; then
    echo "Using 'at' command to schedule for tomorrow 3 AM..."
    echo "bash /tmp/run-sold-collector.sh" | at 03:00 tomorrow 2>&1
    echo ""
    echo "✅ Scheduled successfully!"
    echo ""
    echo "To view scheduled jobs: atq"
    echo "To remove the job: atrm <job_id>"
else
    echo "⚠️  'at' command not available on this system."
    echo ""
    echo "Alternative options:"
    echo ""
    echo "1. Run manually tomorrow:"
    echo "   bash scripts/schedule-sold-data-collection.sh"
    echo ""
    echo "2. Set up cron (runs daily at 3 AM):"
    echo "   bash scripts/setup-automatic-collection.sh"
    echo ""
    echo "3. Use launchd (macOS):"
    echo "   See: scripts/README-scheduler.md"
fi

echo ""
echo "============================================================"
