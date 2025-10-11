#!/bin/bash

###############################################################################
# AUTOMATIC SOLD DATA COLLECTION SETUP
###############################################################################
# This script sets up automatic daily collection of sold Pokemon card data
# with price trends once the eBay rate limit resets.
#
# Usage:
#   bash scripts/setup-automatic-collection.sh
###############################################################################

set -e

PROJECT_DIR="/Users/arcadio/dev/pokedao"
SCHEDULER_SCRIPT="$PROJECT_DIR/scripts/schedule-sold-data-collection.sh"

echo "🔧 SETTING UP AUTOMATIC SOLD DATA COLLECTION"
echo "============================================================"
echo ""

# Make scheduler executable
chmod +x "$SCHEDULER_SCRIPT"
echo "✅ Made scheduler script executable"

# Create logs directory
mkdir -p "$PROJECT_DIR/logs"
echo "✅ Created logs directory"

# Create cron job entry
CRON_JOB="0 3 * * * cd $PROJECT_DIR && $SCHEDULER_SCRIPT >> $PROJECT_DIR/logs/cron-sold-collector.log 2>&1"

echo ""
echo "📅 CRON JOB CONFIGURATION"
echo "============================================================"
echo "The following cron job will run daily at 3:00 AM:"
echo ""
echo "$CRON_JOB"
echo ""
echo "To install this cron job, run:"
echo ""
echo "  (crontab -l 2>/dev/null; echo \"$CRON_JOB\") | crontab -"
echo ""
echo "============================================================"
echo ""

# Option to install cron job
read -p "Would you like to install this cron job now? (y/n) " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    # Check if cron job already exists
    if crontab -l 2>/dev/null | grep -q "schedule-sold-data-collection.sh"; then
        echo "⚠️  Cron job already exists. Skipping installation."
    else
        (crontab -l 2>/dev/null; echo "$CRON_JOB") | crontab -
        echo "✅ Cron job installed successfully!"
    fi
else
    echo "⏭️  Skipped cron job installation. You can install it manually later."
fi

echo ""
echo "============================================================"
echo "📝 MANUAL RUN OPTIONS"
echo "============================================================"
echo ""
echo "You can also run the collector manually:"
echo ""
echo "1. Run immediately (will check rate limit first):"
echo "   bash scripts/schedule-sold-data-collection.sh"
echo ""
echo "2. Run at a specific time tomorrow (e.g., 3 AM):"
echo "   echo 'cd $PROJECT_DIR && $SCHEDULER_SCRIPT' | at 03:00 tomorrow"
echo ""
echo "3. Schedule for exactly 24 hours from now:"
echo "   echo 'cd $PROJECT_DIR && $SCHEDULER_SCRIPT' | at now + 24 hours"
echo ""
echo "============================================================"
echo ""
echo "✅ Setup complete!"
echo ""
echo "📊 When the collector runs, it will:"
echo "  1. Check if eBay rate limit has reset"
echo "  2. Collect top 3,000 sold Pokemon cards"
echo "  3. Calculate 1-month, 6-month, and 12-month price trends"
echo "  4. Generate comprehensive reports with trend data"
echo "  5. Save to: data/top-3000-sold-cards-with-trends.json"
echo ""
echo "📁 Logs will be saved to: logs/"
echo "============================================================"
