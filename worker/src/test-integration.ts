import { MultiSourceCardAggregator } from './apis/multiSourceAggregator.js'
import { writeFileSync } from 'fs'

async function testIntegration() {
  console.log('🚀 PokeDAO Multi-Source Integration Test')
  console.log('=====================================')
  
  // Initialize aggregator (TCGPlayer API key is optional)
  const aggregator = new MultiSourceCardAggregator()
  
  try {
    // Test comprehensive data aggregation
    console.log('\n📊 Fetching Pokemon card data from all sources...')
    const results = await aggregator.aggregateAllSources('charizard')
    
    console.log('\n✅ Integration Results:')
    console.log(`Total listings found: ${results.summary.totalListings}`)
    console.log('\n📈 Source breakdown:')
    Object.entries(results.summary.sourceBreakdown).forEach(([source, count]) => {
      console.log(`  ${source}: ${count} listings`)
    })
    
    console.log('\n💰 Price ranges by source:')
    Object.entries(results.summary.priceRanges).forEach(([source, range]) => {
      console.log(`  ${source}: $${range.min.toFixed(2)} - $${range.max.toFixed(2)} (avg: $${range.avg.toFixed(2)})`)
    })
    
    // Show top listings
    console.log('\n🏆 Top 5 Most Expensive Listings:')
    const topExpensive = aggregator.getTopListings(results.listings, 'price_desc', 5)
    topExpensive.forEach((listing, index) => {
      console.log(`  ${index + 1}. ${listing.title}`)
      console.log(`     Price: $${listing.price} ${listing.currency} (${listing.source})`)
      console.log(`     URL: ${listing.url}`)
      console.log()
    })
    
    console.log('\n💸 Top 5 Cheapest Listings:')
    const topCheap = aggregator.getTopListings(results.listings, 'price_asc', 5)
    topCheap.forEach((listing, index) => {
      console.log(`  ${index + 1}. ${listing.title}`)
      console.log(`     Price: $${listing.price} ${listing.currency} (${listing.source})`)
      console.log(`     URL: ${listing.url}`)
      console.log()
    })
    
    // Filter examples
    console.log('\n🔍 Filtered Results ($100-$1000):')
    const filtered = aggregator.filterListings(results.listings, {
      minPrice: 100,
      maxPrice: 1000
    })
    console.log(`Found ${filtered.length} listings in $100-$1000 range`)
    
    // Test live auction data specifically
    console.log('\n🎯 Live Auction Focus (Fanatics Collect):')
    const fanaticsOnly = aggregator.filterListings(results.listings, {
      sources: ['fanatics_collect']
    })
    console.log(`Active auction listings: ${fanaticsOnly.length}`)
    
    if (fanaticsOnly.length > 0) {
      console.log('Sample auction:')
      const sample = fanaticsOnly[0]
      console.log(`  ${sample.title}`)
      console.log(`  Current bid: $${sample.price}`)
      console.log(`  Bid count: ${sample.metadata.bidCount}`)
      console.log(`  Auction ends: ${sample.metadata.auctionEndsAt}`)
    }
    
    // Save results for analysis
    writeFileSync('pokedao-integration-results.json', JSON.stringify(results, null, 2))
    console.log('\n💾 Full results saved to pokedao-integration-results.json')
    
    console.log('\n🎉 Integration test completed successfully!')
    console.log(`\n📊 Summary:
    - Fanatics Collect: ${results.summary.sourceBreakdown.fanatics_collect || 0} live auction listings
    - TCGPlayer: ${results.summary.sourceBreakdown.tcgplayer || 0} marketplace products  
    - Collector Crypt: ${results.summary.sourceBreakdown.collector_crypt || 0} NFT cards
    - Total: ${results.summary.totalListings} listings across all sources`)
    
  } catch (error) {
    console.error('❌ Integration test failed:', error)
  }
}

// Run the test
testIntegration().catch(console.error)
