/**
 * Consolidate Existing Fanatics Collect GraphQL Data (JavaScript version)
 */
const fs = require('fs').promises;
const path = require('path');

async function consolidateExistingData() {
  console.log('🔄 Consolidating existing Fanatics Collect GraphQL data...');
  
  const currentDir = process.cwd();
  const files = await fs.readdir(currentDir);
  
  // Find all auction data files
  const auctionFiles = files.filter(file => 
    file.includes('AUCTION-DATA') && file.endsWith('.json')
  );
  
  console.log(`📂 Found ${auctionFiles.length} auction data files`);
  
  let allCards = [];
  const seenIds = new Set();
  const sources = [];
  
  for (const file of auctionFiles) {
    console.log(`📄 Processing: ${file}`);
    
    try {
      const content = await fs.readFile(path.join(currentDir, file), 'utf-8');
      const data = JSON.parse(content);
      
      if (data.data?.collectListings) {
        const cards = data.data.collectListings;
        console.log(`   Found ${cards.length} cards`);
        
        // Deduplicate by ID
        let newCards = 0;
        for (const card of cards) {
          if (!seenIds.has(card.id)) {
            seenIds.add(card.id);
            allCards.push(card);
            newCards++;
          }
        }
        
        console.log(`   Added ${newCards} new unique cards`);
        sources.push(file);
      }
      
    } catch (error) {
      console.log(`   ❌ Error processing ${file}:`, error.message);
    }
  }
  
  console.log(`\n✅ Consolidated ${allCards.length} unique Pokemon cards`);
  
  // Analyze the data
  const activeCards = allCards.filter(card => 
    card.status === 'ACTIVE' || card.status === 'LIVE'
  ).length;
  
  const soldCards = allCards.filter(card => 
    card.status === 'COMPLETED' || 
    card.status === 'SOLD' ||
    card.collectSales.length > 0
  ).length;
  
  const cardsWithSalesHistory = allCards.filter(card => 
    card.collectSales.length > 0
  ).length;
  
  // Calculate values
  const currentValues = allCards
    .filter(card => card.currentBid?.amountInCents || card.startingPrice?.amountInCents)
    .map(card => card.currentBid?.amountInCents || card.startingPrice?.amountInCents || 0);
  
  const totalCurrentValue = currentValues.reduce((sum, val) => sum + val, 0) / 100;
  const avgCurrentPrice = currentValues.length > 0 ? 
    currentValues.reduce((sum, val) => sum + val, 0) / currentValues.length / 100 : 0;
  
  // Calculate sales values
  const salesValues = [];
  allCards.forEach(card => {
    card.collectSales.forEach(sale => {
      salesValues.push(sale.soldPrice.amountInCents);
    });
  });
  
  const totalSalesValue = salesValues.reduce((sum, val) => sum + val, 0) / 100;
  const avgSalePrice = salesValues.length > 0 ? 
    salesValues.reduce((sum, val) => sum + val, 0) / salesValues.length / 100 : 0;
  
  return {
    totalCards: allCards.length,
    activeCards,
    soldCards,
    cardsWithSalesHistory,
    totalCurrentValue,
    totalSalesValue,
    avgCurrentPrice,
    avgSalePrice,
    cards: allCards,
    sources,
    consolidatedAt: new Date().toISOString()
  };
}

async function main() {
  try {
    console.log('🚀 FANATICS COLLECT DATA CONSOLIDATION');
    console.log('======================================\n');
    
    const consolidatedData = await consolidateExistingData();
    
    // Save consolidated dataset
    const outputPath = path.join(process.cwd(), `fanatics-consolidated-pokemon-data-${Date.now()}.json`);
    await fs.writeFile(outputPath, JSON.stringify(consolidatedData, null, 2));
    console.log(`💾 Consolidated data saved to: ${path.basename(outputPath)}`);
    
    // Analysis
    console.log('\n📊 COMPREHENSIVE ANALYSIS');
    console.log('========================');
    console.log(`📈 Total Pokemon Cards: ${consolidatedData.totalCards}`);
    console.log(`🟢 Active Listings: ${consolidatedData.activeCards}`);
    console.log(`🔴 Sold/Completed: ${consolidatedData.soldCards}`);
    console.log(`💰 Cards with Sales History: ${consolidatedData.cardsWithSalesHistory}`);
    console.log(`💵 Current Market Value: $${consolidatedData.totalCurrentValue.toLocaleString()}`);
    console.log(`💸 Historical Sales Value: $${consolidatedData.totalSalesValue.toLocaleString()}`);
    console.log(`📊 Average Current Price: $${consolidatedData.avgCurrentPrice.toFixed(2)}`);
    console.log(`📉 Average Historical Sale: $${consolidatedData.avgSalePrice.toFixed(2)}`);
    
    // High-value items analysis
    const highValueActive = consolidatedData.cards
      .filter(card => (card.currentBid?.amountInCents || card.startingPrice?.amountInCents || 0) > 100000) // $1000+
      .sort((a, b) => {
        const aPrice = a.currentBid?.amountInCents || a.startingPrice?.amountInCents || 0;
        const bPrice = b.currentBid?.amountInCents || b.startingPrice?.amountInCents || 0;
        return bPrice - aPrice;
      });
    
    if (highValueActive.length > 0) {
      console.log(`\n💎 High-Value Active Listings ($1000+): ${highValueActive.length}`);
      highValueActive.slice(0, 5).forEach((card, index) => {
        const price = (card.currentBid?.amountInCents || card.startingPrice?.amountInCents || 0) / 100;
        console.log(`   ${index + 1}. $${price.toLocaleString()} - ${card.title}`);
      });
    }
    
    // Historical sales analysis
    const allSales = consolidatedData.cards.flatMap(card => 
      card.collectSales.map(sale => ({
        cardTitle: card.title,
        price: sale.soldPrice.amountInCents / 100,
        soldAt: sale.soldAt
      }))
    );
    
    if (allSales.length > 0) {
      allSales.sort((a, b) => b.price - a.price);
      
      console.log(`\n🔥 Historical Sales Analysis: ${allSales.length} sales`);
      console.log(`💰 Top 5 Historical Sales:`);
      allSales.slice(0, 5).forEach((sale, index) => {
        console.log(`   ${index + 1}. $${sale.price.toLocaleString()} - ${sale.cardTitle} (${sale.soldAt})`);
      });
    }
    
    // Market trend indicators
    if (consolidatedData.avgCurrentPrice > 0 && consolidatedData.avgSalePrice > 0) {
      const trendIndicator = ((consolidatedData.avgCurrentPrice - consolidatedData.avgSalePrice) / consolidatedData.avgSalePrice) * 100;
      const trend = trendIndicator > 0 ? 'RISING' : 'FALLING';
      
      console.log(`\n📈 Market Trend: ${trend} (${Math.abs(trendIndicator).toFixed(1)}%)`);
      
      if (trend === 'RISING') {
        console.log(`   Current listings are priced ${trendIndicator.toFixed(1)}% higher than historical sales`);
      } else {
        console.log(`   Current listings are priced ${Math.abs(trendIndicator).toFixed(1)}% lower than historical sales`);
      }
    }
    
    console.log(`\n✨ Consolidation complete! Ready for integration with PokeDAO external data pipeline.`);
    
  } catch (error) {
    console.error('💥 Consolidation failed:', error);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { consolidateExistingData };
