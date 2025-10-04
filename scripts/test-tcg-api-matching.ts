import { PokemonTCGAPI } from './lib/pokemon-tcg-api.js';

const api = new PokemonTCGAPI();

async function testMatching() {
  console.log('🧪 Testing Pokemon TCG API Matching\n');

  const testCases = [
    {
      title: '2025 #151 Palafin EX PSA 9 Pre EN-Prismatic Evolutions Pokemon',
      cardName: 'Palafin EX',
      setName: 'Prismatic Evolutions',
      cardNumber: '151',
    },
    {
      title: '2016 #122 Kadabra PSA 10 EN-Evolutions Pokemon',
      cardName: 'Kadabra',
      setName: 'Evolutions',
      cardNumber: '122',
    },
    {
      title: '1999 #5 BASE SET HOLO CLEFAIRY CGC 9 POKEMON',
      cardName: 'Clefairy',
      setName: 'Base Set',
      cardNumber: '5',
    },
    {
      title: '2008 #57 Chimchar PSA 9 Diamond & Pearl Majestic Dawn Pokemon',
      cardName: 'Chimchar',
      setName: 'Majestic Dawn',
      cardNumber: '57',
    },
    {
      title: 'Unknown card with bad data',
      cardName: 'Unknown',
      setName: 'Unknown',
      cardNumber: '',
    },
  ];

  for (const testCase of testCases) {
    console.log(`📋 Testing: ${testCase.title}`);
    console.log(`   Input: name="${testCase.cardName}", set="${testCase.setName}", #${testCase.cardNumber}`);

    try {
      const result = await api.matchCard({
        cardName: testCase.cardName,
        setName: testCase.setName,
        cardNumber: testCase.cardNumber,
        title: testCase.title,
      });

      if (result.matched && result.tcgCard) {
        console.log(`   ✅ MATCHED (${(result.confidence * 100).toFixed(0)}% confidence)`);
        console.log(`      TCG: "${result.tcgCard.name}" from ${result.tcgCard.set.name} #${result.tcgCard.number}`);
        console.log(`      Image: ${result.tcgCard.images.small}`);
        if (result.tcgCard.tcgplayer?.prices) {
          const priceVariant = Object.keys(result.tcgCard.tcgplayer.prices)[0];
          const price = result.tcgCard.tcgplayer.prices[priceVariant];
          console.log(`      Market Price: $${price.market?.toFixed(2) || 'N/A'}`);
        }
      } else {
        console.log(`   ❌ NO MATCH: ${result.matchReason}`);
      }
    } catch (error: any) {
      console.log(`   ⚠️  ERROR: ${error.message}`);
    }

    console.log();
  }
}

testMatching().catch(console.error);
