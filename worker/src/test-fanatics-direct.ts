import { FanaticsCollectAPI } from './apis/fanaticsCollect.js'

async function testFanaticsAPI() {
  console.log('🎯 Testing Fanatics Collect API directly...')
  
  const api = new FanaticsCollectAPI()
  
  try {
    console.log('📊 Fetching auctions...')
    const auctions = await api.fetchAuctions()
    console.log(`Found ${auctions.length} auctions:`)
    auctions.forEach(auction => {
      console.log(`  - ${auction.name} (${auction.status})`)
    })
    
    console.log('\n🃏 Fetching Pokemon listings...')
    const listings = await api.fetchPokemonListings(undefined, 'pokemon', 10)
    console.log(`Found ${listings.length} Pokemon listings`)
    
    if (listings.length > 0) {
      console.log('Sample listing:')
      const sample = listings[0]
      console.log(`  Title: ${sample.title}`)
      console.log(`  Current bid: $${sample.currentBid.amountInCents / 100}`)
      console.log(`  Bid count: ${sample.bidCount}`)
    }
    
  } catch (error) {
    console.error('Error testing Fanatics API:', error)
  }
}

testFanaticsAPI().catch(console.error)
