#!/bin/bash

# Test Fanatics Collect GraphQL API endpoints
echo "🔍 Testing Fanatics Collect API endpoints..."

# Common GraphQL endpoints to test
endpoints=(
    "https://api.fanaticscollect.com/graphql"
    "https://www.fanaticscollect.com/api/graphql"
    "https://www.fanaticscollect.com/graphql"
    "https://fanaticscollect.com/api/graphql"
    "https://api-prod.fanaticscollect.com/graphql"
    "https://graphql.fanaticscollect.com"
    "https://collect-api.fanatics.com/graphql"
)

# Basic GraphQL query for Pokemon cards
query='{
  "query": "query CollectListings($filters: CollectListingFilterInput) { collectListings(filters: $filters) { id title status listingType } }",
  "variables": {
    "filters": {
      "categories": ["Trading Card Games > Pokémon (English)"]
    }
  }
}'

for endpoint in "${endpoints[@]}"; do
    echo ""
    echo "🌐 Testing: $endpoint"
    
    response=$(curl -s -w "%{http_code}" -X POST \
        -H "Content-Type: application/json" \
        -H "Accept: application/json" \
        -H "User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" \
        -H "Referer: https://www.fanaticscollect.com/" \
        -H "Origin: https://www.fanaticscollect.com" \
        -d "$query" \
        "$endpoint" \
        -o "/tmp/fanatics_response_$(basename $endpoint).json")
    
    http_code="${response: -3}"
    
    if [ "$http_code" -eq 200 ]; then
        echo "✅ Success! HTTP $http_code"
        echo "📄 Response saved to /tmp/fanatics_response_$(basename $endpoint).json"
        echo "📊 Preview:"
        head -5 "/tmp/fanatics_response_$(basename $endpoint).json"
    elif [ "$http_code" -eq 400 ] || [ "$http_code" -eq 422 ]; then
        echo "⚠️  Bad Request HTTP $http_code (endpoint exists but query may be wrong)"
        head -3 "/tmp/fanatics_response_$(basename $endpoint).json"
    elif [ "$http_code" -eq 404 ]; then
        echo "❌ Not Found HTTP $http_code"
    elif [ "$http_code" -eq 403 ]; then
        echo "🔒 Forbidden HTTP $http_code (endpoint exists but blocked)"
    else
        echo "❓ HTTP $http_code"
        head -2 "/tmp/fanatics_response_$(basename $endpoint).json" 2>/dev/null
    fi
done

echo ""
echo "🎯 API endpoint discovery complete!"
echo "Check /tmp/fanatics_response_*.json files for successful responses"
