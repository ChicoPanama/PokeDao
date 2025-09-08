import axios from 'axios'

async function testRawFanaticsAPI() {
  console.log('🔧 Testing raw Fanatics Collect API with captured format...')
  
  const baseURL = 'https://app.fanaticscollect.com/graphql'
  
  // Use the exact same query format that worked in browser
  const query = `
    query webListingsQuery {
      collectListings {
        __typename
        id
        title
        subtitle
        status
        bidCount
        currentBid {
          amountInCents
          currency
        }
        auction {
          id
          name
          status
          endsAt
        }
        imageSets {
          medium
          small
          thumbnail
        }
        certifiedSeller
        favoritedCount
      }
    }
  `
  
  try {
    const response = await axios.post(
      `${baseURL}?webListingsQuery`,
      {
        query,
        variables: {}
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          'Referer': 'https://www.fanaticscollect.com/',
          'Origin': 'https://www.fanaticscollect.com'
        }
      }
    )
    
    console.log('Response status:', response.status)
    console.log('Response data keys:', Object.keys(response.data || {}))
    
    if (response.data?.data?.collectListings) {
      const listings = response.data.data.collectListings
      console.log(`✅ Found ${listings.length} total listings`)
      
      // Filter for Pokemon
      const pokemonListings = listings.filter((item: any) => 
        item.title && item.title.toLowerCase().includes('pokemon')
      )
      
      console.log(`🎴 Found ${pokemonListings.length} Pokemon listings`)
      
      if (pokemonListings.length > 0) {
        console.log('\nSample Pokemon listings:')
        pokemonListings.slice(0, 3).forEach((listing: any, index: number) => {
          console.log(`  ${index + 1}. ${listing.title}`)
          console.log(`     Bid: $${listing.currentBid.amountInCents / 100} (${listing.bidCount} bids)`)
          console.log(`     Status: ${listing.status}`)
          console.log()
        })
      }
    } else {
      console.log('❌ No collectListings in response')
      console.log('Response:', JSON.stringify(response.data, null, 2))
    }
    
  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : error)
  }
}

testRawFanaticsAPI().catch(console.error)
