import dotenv from 'dotenv';
import fs from 'fs';
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
    { name: "1996 #113 Chansey CGC 10 Gem Mint Pokemon Japanese Base Set Holo", price: 40600 }
  ];
  
  for (let i = 0; i < testCards.length; i++) {
    const card = testCards[i];
    
    console.log(`\n[${i+1}/${testCards.length}] ${card.name}`);
    console.log(`Listed: $${card.price.toLocaleString()}`);
    
    try {
      const analysis = await analyzer.analyzeCard(card.name, card.price);
      
      console.log(`Market Value: $${analysis.pricing.marketValue.toLocaleString()} (${Math.round(analysis.pricing.confidence * 100)}% confidence)`);
      console.log(`Assessment: ${analysis.assessment}`);
      
      console.log(`\nAI Analysis: "${analysis.aiAnalysis}"`);
      
      console.log(`\nTrend Prediction: ${analysis.trendPrediction}`);
      
      console.log(`\nInvestment Thesis: "${analysis.investmentThesis}"`);
      
      console.log(`\nRecommendation: ${analysis.recommendation} (AI Confidence: ${analysis.aiConfidence}%)`);
      
      console.log(`Sources: ${analysis.pricing.sources.map(s => `${s.source} ($${s.price.toLocaleString()})`).join(', ')}`);
      
    } catch (error) {
      console.error(`Error: ${error.message}`);
    }
  }
  
  console.log('\n========================================');
  console.log('AI Analysis Complete!');
}

testAISystem().catch(console.error);
