/**
 * Integrate Fanatics Collect Data with PokeDAO External Data Pipeline
 * Merges consolidated Fanatics data with existing Collector Crypt data
 */
const fs = require('fs').promises;
const path = require('path');

async function integrateFanaticsWithPokeDAO() {
  console.log('🔗 INTEGRATING FANATICS COLLECT WITH POKEDAO');
  console.log('============================================\n');
  
  try {
    // 1. Load the consolidated Fanatics data
    console.log('📂 Loading Fanatics Collect data...');
    const fanaticsFiles = await fs.readdir('./');
    const latestFanaticsFile = fanaticsFiles
      .filter(f => f.startsWith('fanatics-consolidated-pokemon-data-'))
      .sort()
      .pop();
    
    if (!latestFanaticsFile) {
      throw new Error('No consolidated Fanatics data found');
    }
    
    const fanaticsData = JSON.parse(await fs.readFile(latestFanaticsFile, 'utf-8'));
    console.log(`✅ Loaded ${fanaticsData.totalCards} Fanatics Collect cards`);
    
    // 2. Load existing Collector Crypt data
    console.log('📂 Loading existing Collector Crypt data...');
    const collectorCryptPath = '../../worker/unified-collector-crypt-dataset.json';
    
    let collectorCryptData = [];
    try {
      const collectorCryptContent = await fs.readFile(collectorCryptPath, 'utf-8');
      collectorCryptData = JSON.parse(collectorCryptContent);
      console.log(`✅ Loaded ${collectorCryptData.length} Collector Crypt cards`);
    } catch (error) {
      console.log('⚠️  Collector Crypt data not found, proceeding with Fanatics only');
    }
    
    // 3. Normalize Fanatics data to match external data pipeline format
    console.log('🔄 Normalizing Fanatics data for integration...');
    
    const normalizedFanatics = fanaticsData.cards.map(card => {
      // Extract price information
      let currentPrice = 0;
      let currency = 'USD';
      
      if (card.currentBid?.amountInCents) {
        currentPrice = card.currentBid.amountInCents;
        currency = card.currentBid.currency || 'USD';
      } else if (card.startingPrice?.amountInCents) {
        currentPrice = card.startingPrice.amountInCents;
        currency = card.startingPrice.currency || 'USD';
      }
      
      // Determine listing status
      let status = 'active';
      if (card.status === 'COMPLETED' || card.status === 'SOLD') {
        status = 'sold';
      } else if (card.status === 'ENDED') {
        status = 'ended';
      }
      
      return {
        // Standard external data fields
        source: 'fanatics-collect',
        externalId: card.id,
        integerId: card.integerId,
        name: card.title,
        category: 'pokemon',
        
        // Price data
        currentPrice: currentPrice,
        currentPriceUSD: Math.round(currentPrice / 100 * 100) / 100, // Convert to USD dollars
        currency: currency,
        
        // Listing information
        listingType: card.listingType?.toLowerCase() || 'auction',
        status: status,
        bidCount: card.bidCount || 0,
        favoritedCount: card.favoritedCount || 0,
        
        // Metadata
        description: card.subtitle || '',
        lotString: card.lotString || '',
        slug: card.slug,
        certifiedSeller: card.certifiedSeller === 'true',
        
        // Images
        imageUrl: card.imageSets?.[0]?.medium || '',
        thumbnailUrl: card.imageSets?.[0]?.thumbnail || '',
        
        // Auction details
        auctionId: card.auction?.id || null,
        auctionEndsAt: card.auction?.endsAt || null,
        auctionStartsAt: card.auction?.startsAt || null,
        
        // Market data
        marketplaceEyeAppeal: card.marketplaceEyeAppeal || null,
        
        // Historical sales (for trend analysis when available)
        salesHistory: card.collectSales.map(sale => ({
          price: sale.soldPrice.amountInCents,
          priceUSD: Math.round(sale.soldPrice.amountInCents / 100 * 100) / 100,
          currency: sale.soldPrice.currency,
          soldAt: sale.soldAt,
          platform: 'fanatics-collect'
        })),
        
        // Tracking
        lastUpdated: new Date().toISOString(),
        capturedAt: fanaticsData.consolidatedAt
      };
    });
    
    console.log(`✅ Normalized ${normalizedFanatics.length} Fanatics cards`);
    
    // 4. Create unified external data dataset
    console.log('🔗 Creating unified external data dataset...');
    
    const unifiedExternalData = {
      metadata: {
        totalCards: normalizedFanatics.length + collectorCryptData.length,
        sources: {
          'fanatics-collect': {
            count: normalizedFanatics.length,
            totalValue: fanaticsData.totalCurrentValue,
            avgPrice: fanaticsData.avgCurrentPrice
          },
          'collector-crypt': {
            count: collectorCryptData.length,
            totalValue: 0, // Would need to calculate from CC data
            avgPrice: 0
          }
        },
        consolidatedAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString()
      },
      cards: [
        ...normalizedFanatics,
        ...collectorCryptData.map(ccCard => ({
          ...ccCard,
          source: 'collector-crypt',
          lastUpdated: new Date().toISOString()
        }))
      ]
    };
    
    // 5. Save unified dataset
    const outputPath = `../../api/unified-external-pokemon-data-${Date.now()}.json`;
    await fs.writeFile(outputPath, JSON.stringify(unifiedExternalData, null, 2));
    
    console.log('🎉 INTEGRATION COMPLETE!');
    console.log('========================');
    console.log(`📊 Total Cards: ${unifiedExternalData.metadata.totalCards}`);
    console.log(`📈 Fanatics Collect: ${normalizedFanatics.length} cards ($${fanaticsData.totalCurrentValue.toLocaleString()})`);
    console.log(`📈 Collector Crypt: ${collectorCryptData.length} cards`);
    console.log(`💾 Unified dataset saved to: ${outputPath}`);
    
    // 6. Generate integration summary for PokeDAO
    const integrationSummary = {
      integration: {
        status: 'SUCCESS',
        timestamp: new Date().toISOString(),
        sources: 2,
        totalCards: unifiedExternalData.metadata.totalCards
      },
      fanatics: {
        status: 'ACTIVE',
        cards: normalizedFanatics.length,
        marketValue: fanaticsData.totalCurrentValue,
        avgPrice: fanaticsData.avgCurrentPrice,
        highValueCards: normalizedFanatics.filter(c => c.currentPriceUSD > 1000).length
      },
      collectorCrypt: {
        status: 'ACTIVE', 
        cards: collectorCryptData.length
      },
      alerts: {
        highValueFanatics: normalizedFanatics
          .filter(c => c.currentPriceUSD > 2000)
          .map(c => ({
            name: c.name,
            price: c.currentPriceUSD,
            source: 'fanatics-collect'
          }))
      }
    };
    
    await fs.writeFile(
      '../../api/external-data-integration-summary.json', 
      JSON.stringify(integrationSummary, null, 2)
    );
    
    console.log('\n🚨 HIGH-VALUE ALERTS:');
    integrationSummary.alerts.highValueFanatics.forEach((alert, index) => {
      console.log(`   ${index + 1}. $${alert.price.toLocaleString()} - ${alert.name}`);
    });
    
    console.log(`\n✨ Ready for PokeDAO external data pipeline integration!`);
    console.log(`📂 Integration summary: ../../api/external-data-integration-summary.json`);
    
    return unifiedExternalData;
    
  } catch (error) {
    console.error('💥 Integration failed:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  integrateFanaticsWithPokeDAO().catch(console.error);
}

module.exports = { integrateFanaticsWithPokeDAO };
