import axios from 'axios'

async function debugCollectorCrypt() {
  console.log('🔧 Debugging Collector Crypt API data...')
  
  try {
    const response = await axios.get('https://api.collectorcrypt.com/marketplace', {
      params: {
        page: 1,
        step: 5, // Just get 5 for debugging
        cardType: 'Card',
        orderBy: 'listedDateDesc'
      },
      headers: {
        'User-Agent': 'PokeDAO/1.0.0'
      }
    })

    const cards = response.data.filterNFtCard || []
    console.log(`Found ${cards.length} cards`)
    
    if (cards.length > 0) {
      console.log('\nFirst card structure:')
      console.log(JSON.stringify(cards[0], null, 2))
    }
    
  } catch (error) {
    console.error('Error:', error)
  }
}

debugCollectorCrypt().catch(console.error)
