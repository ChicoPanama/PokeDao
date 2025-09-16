#!/bin/bash

# Automated Pipeline Cron Setup
# Sets up scheduled execution of the market pipeline

echo "🕐 Setting up automated pipeline execution..."
echo "=============================================="

# Get the current directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Create the cron job script
CRON_SCRIPT="$SCRIPT_DIR/run-pipeline-cron.sh"

cat > "$CRON_SCRIPT" << EOF
#!/bin/bash

# Market Pipeline Cron Job
# Runs the automated pipeline and logs results

cd "$PROJECT_DIR"
TIMESTAMP=\$(date '+%Y-%m-%d %H:%M:%S')

echo "[\$TIMESTAMP] Starting automated pipeline..." >> logs/pipeline-cron.log

# Run the pipeline
npx ts-node scripts/automated-pipeline.ts >> logs/pipeline-cron.log 2>&1

EXIT_CODE=\$?
TIMESTAMP=\$(date '+%Y-%m-%d %H:%M:%S')

if [ \$EXIT_CODE -eq 0 ]; then
    echo "[\$TIMESTAMP] Pipeline completed successfully" >> logs/pipeline-cron.log
else
    echo "[\$TIMESTAMP] Pipeline failed with exit code \$EXIT_CODE" >> logs/pipeline-cron.log
fi

echo "[\$TIMESTAMP] ----------------------------------------" >> logs/pipeline-cron.log
EOF

# Make the script executable
chmod +x "$CRON_SCRIPT"

# Create logs directory
mkdir -p "$PROJECT_DIR/logs"

echo "✅ Created cron script: $CRON_SCRIPT"

# Display cron job examples
echo ""
echo "📋 Cron Job Examples:"
echo "===================="
echo ""
echo "1. Run every 6 hours:"
echo "   0 */6 * * * $CRON_SCRIPT"
echo ""
echo "2. Run daily at 2 AM:"
echo "   0 2 * * * $CRON_SCRIPT"
echo ""
echo "3. Run every 30 minutes during business hours (9 AM - 5 PM, Mon-Fri):"
echo "   */30 9-17 * * 1-5 $CRON_SCRIPT"
echo ""
echo "4. Run twice daily (6 AM and 6 PM):"
echo "   0 6,18 * * * $CRON_SCRIPT"
echo ""

# Test the script
echo "🧪 Testing the cron script..."
if bash "$CRON_SCRIPT"; then
    echo "✅ Cron script test successful!"
    echo ""
    echo "📝 To add to crontab, run:"
    echo "   crontab -e"
    echo ""
    echo "Then add one of the cron job examples above."
    echo ""
    echo "📊 Monitor logs with:"
    echo "   tail -f logs/pipeline-cron.log"
else
    echo "❌ Cron script test failed!"
    exit 1
fi

echo "🎯 Automated pipeline setup complete!"
