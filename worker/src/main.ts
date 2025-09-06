import dotenv from 'dotenv';
import fs from 'fs';
import { MarketAnalyzer } from './core/marketAnalyzer.js';

dotenv.config();

async function main() {
  console.log('Pokemon Card Market Analysis System v2.0');
  console.log('==========================================');
  
  // Initialize analyzer with API keys
  const analyzer = new MarketAnalyzer({
    pokemonTCGKey: process.env.POKEMON_TCG_API_KEY,
    priceTrackerKey: process.env.PRICE_TRACKER_API_KEY
  });
  
  // Load test cards
  const testCards = [
    { name: "1996 #113 Chansey CGC 10 Gem Mint Pokemon Japanese Base Set Holo", price: 40600 },
    { name: "2003 #149 Lugia-Holo PSA 10 Aquapolis Pokemon", price: 40000 },
    { name: "2023 #062 PIKACHU PSA 9 POKEMON PAL EN-PALDEA EVOLVED", price: 30000 },
    { name: "2001 #116 JAPANESE BASE EXPANSION PACK HOLO ALAKAZAM BGS 9 POKEMON", price: 28000 },
    { name: "2001 #123 JAPANESE EXPEDITION 1ST EDITION HOLO PIDGEOT PSA 10 POKEMON", price: 22120 }
  ];
  
  const results = [];
  
  for (let i = 0; i < testCards.length; i++) {
    const card = testCards[i];
    
    console.log(`\n[${i+1}/${testCards.length}] Analyzing: ${card.name}`);
    console.log('='.repeat(80));
    
    try {
      const analysis = await analyzer.analyzeCard(card.name, card.price);
      
      // Display results
      console.log(`\nCard: ${analysis.card.name}`);
      console.log(`Set: ${analysis.card.set} | Grade: ${analysis.card.grade || 'Ungraded'}`);
      console.log(`Language: ${analysis.card.language} | Condition: ${analysis.card.condition}`);
      
      console.log(`\nPricing Analysis:`);
      console.log(`Listed Price: $${analysis.pricing.listedPrice.toLocaleString()}`);
      console.log(`Market Value: $${analysis.pricing.marketValue.toLocaleString()}`);
      console.log(`Confidence: ${(analysis.pricing.confidence * 100).toFixed(1)}%`);
      console.log(`Assessment: ${analysis.assessment}`);
      
      console.log(`\nPrice Sources (${analysis.pricing.sources.length}):`);
      analysis.pricing.sources.forEach((source: any, idx: number) => {
        console.log(`  ${idx+1}. ${source.source}: $${source.price.toLocaleString()} (${(source.confidence * 100).toFixed(0)}% confidence)`);
      });
      
      console.log(`\nLast Two Sales:`);
      analysis.lastTwoSales.forEach((sale: any, idx: number) => {
        console.log(`  ${idx+1}. $${sale.price.toLocaleString()} on ${sale.date} (${sale.platform})`);
      });
      
      console.log(`\nAnalysis:`);
      console.log(`Reasoning: ${analysis.reasoning}`);
      console.log(`Trend: ${analysis.trend}`);
      console.log(`Recommendation: ${analysis.recommendation}`);
      console.log(`Investment Thesis: ${analysis.investmentThesis}`);
      
      results.push({
        card: card.name,
        analysis,
        timestamp: new Date().toISOString()
      });
      
      // Rate limiting between requests
      await new Promise(resolve => setTimeout(resolve, 3000));
      
    } catch (error) {
      if (typeof error === 'object' && error !== null && 'message' in error) {
        // @ts-ignore
        console.error(`Error analyzing ${card.name}:`, error.message);
      } else {
        console.error(`Error analyzing ${card.name}:`, error);
      }
    }
  }
  
  // Save results
  fs.writeFileSync('market-analysis-results.json', JSON.stringify(results, null, 2));
  
  console.log('\n==========================================');
  console.log('Analysis Complete!');
  console.log(`Results saved to: market-analysis-results.json`);
  
  // Summary statistics
  const recommendations = results.reduce((acc: any, result) => {
    const rec = result.analysis.recommendation;
    acc[rec] = (acc[rec] || 0) + 1;
    return acc;
  }, {});
  
  console.log('\nRecommendation Summary:');
  Object.entries(recommendations).forEach(([rec, count]) => {
    console.log(`  ${rec}: ${count}`);
  });
  
  const avgConfidence = results.reduce((sum, r) => sum + r.analysis.pricing.confidence, 0) / results.length;
  console.log(`\nAverage Confidence: ${(avgConfidence * 100).toFixed(1)}%`);
}

if (require.main === module) {
  main().catch(console.error);
}

export { MarketAnalyzer };
