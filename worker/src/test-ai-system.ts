import dotenv from 'dotenv';
import { AIMarketAnalyzer } from './core/aiMarketAnalyzer.js';

dotenv.config();

async function testAISystem() {
  console.log('AI-Enhanced Pokemon Card Market Analysis');
  console.log('========================================');

  const analyzer = new AIMarketAnalyzer({
    pokemonTCGKey: process.env.POKEMON_TCG_API_KEY,
    deepseekKey: process.env.DEEPSEEK_API_KEY!
  });

  const testCards = [
    { name: "1996 #113 Chansey CGC 10 Gem Mint Pokemon Japanese Base Set Holo", price: 40600 },
    { name: "1998 Pikachu Promo PSA 10", price: 15000 },
    { name: "Charizard Base Set Unlimited PSA 9", price: 8500 },
    { name: "Dark Charizard Team Rocket CGC 9.5", price: 5200 },
    { name: "Blastoise Base Set Shadowless BGS 9", price: 3800 }
  ];

  for (let i = 0; i < testCards.length; i++) {
    const card = testCards[i];

    console.log(`\n[${i+1}/${testCards.length}] ${card.name}`);
    console.log(`Listed: $${card.price.toLocaleString()}`);

    try {
      const analysis = await analyzer.analyzeCard(card.name, card.price);

      const priceDiff = ((card.price - analysis.pricing.marketValue) / analysis.pricing.marketValue * 100);
      const diffDirection = priceDiff > 0 ? 'OVERVALUED' : 'UNDERVALUED';
      
      console.log(`Market Value: $${analysis.pricing.marketValue.toLocaleString()} (${Math.round(analysis.pricing.confidence * 100)}% confidence)`);
      console.log(`Assessment: ${diffDirection} (${Math.abs(priceDiff).toFixed(1)}%)`);
      console.log('');

      console.log(`AI Analysis: "${analysis.aiAnalysis}"`);
      console.log('');

      console.log(`Trend Prediction: ${analysis.trendPrediction}`);
      console.log('');

      console.log(`Investment Thesis: "${analysis.investmentThesis}"`);
      console.log('');

      console.log(`Recommendation: ${analysis.recommendation} (AI Confidence: ${analysis.aiConfidence}%)`);
      
      const sourceList = analysis.pricing.sources.map(s => 
        `${s.source} ($${s.price.toLocaleString()})`
      ).join(', ');
      console.log(`Sources: ${sourceList}`);

      // Show lowest price with purchase link
      console.log(`\n💰 LOWEST PRICE FOUND: $${analysis.pricing.lowestPrice.price.toLocaleString()} on ${analysis.pricing.lowestPrice.source}`);
      console.log(`🔗 Buy Now: ${analysis.pricing.lowestPrice.link}`);

    } catch (error) {
      if (typeof error === 'object' && error !== null && 'message' in error) {
        // @ts-ignore
        console.error(`Error: ${error.message}`);
      } else {
        console.error('Error:', error);
      }
    }
  }

  console.log('\n========================================');
  console.log('AI Analysis Complete!');
}

testAISystem().catch(console.error);
