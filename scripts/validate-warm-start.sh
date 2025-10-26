#!/bin/bash
echo "⏳ Waiting 5 minutes for warm-up..."
sleep 300

echo "✅ Warm-up complete. Running 5 consecutive health checks..."
for i in {1..5}; do
  echo ""
  echo "Test $i/5:"
  curl -s -w "  Latency: %{time_total}s\n" https://chicopanama--mew1a-vllm-v4-3-shaped-fastapi-app.modal.run/health -o /dev/null
  sleep 2
done

echo ""
echo "✅ Validation complete!"
