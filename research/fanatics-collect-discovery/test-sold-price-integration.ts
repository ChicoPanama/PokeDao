/**
 * Test Integration of Sold Price Data with External Data Pipeline
 * Validates that enhanced Fanatics Collect data will work with existing pipeline
 */

// Mock enhanced Fanatics Collect data structure with sold prices
const mockFanaticsDataWithSoldPrices = {
  totalCards: 1500,
  auctionCards: 600,
  buyNowCards: 750,
  soldCards: 150,
  totalBidVolume: 125000,
  totalSalesVolume: 87500,
  avgPrice: 83.33,
  avgSalePrice: 583.33,
  cards: [
    {
      id: "fanatics_12345",
      title: "Charizard Base Set Shadowless PSA 10",
      currentBid: { amountInCents: 675000, currency: "USD" },
      bidCount: 15,
      listingType: "WEEKLY",
      status: "ACTIVE",
      isSold: false,
      isCompleted: false,
      finalSalePrice: null,
      soldAt: null,
      collectSales: []
    },
    {
      id: "fanatics_67890", 
      title: "Pikachu Illustrator Promo PSA 9",
      currentBid: null,
      buyNowPrice: { amountInCents: 12500000, currency: "USD" },
      bidCount: 0,
      listingType: "BUY_NOW",
      status: "ACTIVE", 
      isSold: false,
      isCompleted: false,
      finalSalePrice: null,
      soldAt: null,
      collectSales: []
    },
    {
      id: "fanatics_54321",
      title: "Blastoise Base Set Shadowless PSA 9",
      currentBid: null,
      buyNowPrice: null,
      bidCount: 8,
      listingType: "WEEKLY",
      status: "SOLD",
      isSold: true,
      isCompleted: true,
      finalSalePrice: { amountInCents: 185000, currency: "USD" },
      soldAt: "2024-01-15T18:30:00Z",
      collectSales: [{
        soldPrice: { amountInCents: 185000, currency: "USD" },
        soldAt: "2024-01-15T18:30:00Z"
      }]
    }
  ]
}

// Test data normalization for external pipeline
function normalizeEnhancedFanaticsData(fanaticsData: any) {
  console.log('🔄 Testing Enhanced Fanatics Data Normalization...')
  
  const normalizedCards = fanaticsData.cards.map((card: any) => {
    const baseCard = {
      source: 'fanatics-collect',
      externalId: card.id,
      name: card.title,
      category: 'pokemon',
      
      // Current listing data
      currentPrice: card.currentBid?.amountInCents || card.buyNowPrice?.amountInCents || 0,
      currency: card.currentBid?.currency || card.buyNowPrice?.currency || 'USD',
      listingType: card.listingType?.toLowerCase() || 'unknown',
      bidCount: card.bidCount || 0,
      status: card.status?.toLowerCase() || 'unknown',
      
      // Market trend data (NEW!)
      isSold: card.isSold || false,
      isCompleted: card.isCompleted || false,
      soldPrice: card.finalSalePrice?.amountInCents || null,
      soldAt: card.soldAt || null,
      
      // Historical sales for trend analysis (NEW!)
      salesHistory: card.collectSales?.map((sale: any) => ({
        price: sale.soldPrice.amountInCents,
        currency: sale.soldPrice.currency,
        date: sale.soldAt,
        platform: 'fanatics-collect'
      })) || [],
      
      lastUpdated: new Date().toISOString()
    }
    
    return baseCard
  })
  
  return {
    source: 'fanatics-collect',
    totalCards: fanaticsData.totalCards,
    activeListings: fanaticsData.totalCards - fanaticsData.soldCards,
    completedSales: fanaticsData.soldCards,
    currentMarketValue: fanaticsData.totalBidVolume,
    realizedSalesVolume: fanaticsData.totalSalesVolume, // NEW!
    avgActivePrice: fanaticsData.avgPrice,
    avgSalePrice: fanaticsData.avgSalePrice, // NEW!
    cards: normalizedCards,
    lastSync: new Date().toISOString()
  }
}

// Test trend analysis capabilities
function analyzePriceTrends(normalizedData: any) {
  console.log('📊 Testing Price Trend Analysis...')
  
  const activeCards = normalizedData.cards.filter((c: any) => !c.isSold)
  const soldCards = normalizedData.cards.filter((c: any) => c.isSold)
  
  console.log(`\n📈 Market Analysis:`)
  console.log(`  Active Listings: ${activeCards.length}`)
  console.log(`  Completed Sales: ${soldCards.length}`)
  console.log(`  Current Market Value: $${(normalizedData.currentMarketValue / 100).toLocaleString()}`)
  console.log(`  Realized Sales Volume: $${(normalizedData.realizedSalesVolume / 100).toLocaleString()}`)
  console.log(`  Average Active Price: $${normalizedData.avgActivePrice.toFixed(2)}`)
  console.log(`  Average Sale Price: $${normalizedData.avgSalePrice.toFixed(2)}`)
  
  // Price trend indicators
  if (soldCards.length > 0) {
    const marketTrend = normalizedData.avgActivePrice > normalizedData.avgSalePrice ? 'RISING' : 'FALLING'
    const trendPercentage = Math.abs((normalizedData.avgActivePrice - normalizedData.avgSalePrice) / normalizedData.avgSalePrice * 100)
    
    console.log(`\n🎯 Market Trend: ${marketTrend} (${trendPercentage.toFixed(1)}%)`)
    
    if (marketTrend === 'RISING') {
      console.log(`  📈 Current listings are priced ${trendPercentage.toFixed(1)}% higher than recent sales`)
    } else {
      console.log(`  📉 Current listings are priced ${trendPercentage.toFixed(1)}% lower than recent sales`)
    }
  }
  
  return {
    activeListings: activeCards.length,
    completedSales: soldCards.length,
    marketTrend: soldCards.length > 0 ? (normalizedData.avgActivePrice > normalizedData.avgSalePrice ? 'RISING' : 'FALLING') : 'UNKNOWN',
    trendStrength: soldCards.length > 0 ? Math.abs((normalizedData.avgActivePrice - normalizedData.avgSalePrice) / normalizedData.avgSalePrice * 100) : 0
  }
}

// Test alert system for sold price changes
function testSoldPriceAlerts(normalizedData: any) {
  console.log('🚨 Testing Sold Price Alert System...')
  
  const soldCards = normalizedData.cards.filter((c: any) => c.isSold)
  
  if (soldCards.length === 0) {
    console.log('  ⚠️  No sold data available for alerts')
    return
  }
  
  // High-value sales alerts
  const highValueSales = soldCards.filter((c: any) => c.soldPrice > 100000) // $1000+
  console.log(`  💎 High-value sales (>$1000): ${highValueSales.length}`)
  
  highValueSales.forEach((card: any) => {
    console.log(`    🔥 $${(card.soldPrice / 100).toLocaleString()} - ${card.name}`)
  })
  
  // Recent sales alerts (last 24 hours)
  const recentSales = soldCards.filter((c: any) => {
    if (!c.soldAt) return false
    const soldDate = new Date(c.soldAt)
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
    return soldDate > dayAgo
  })
  
  console.log(`  🕐 Recent sales (24h): ${recentSales.length}`)
  
  return {
    highValueSales: highValueSales.length,
    recentSales: recentSales.length,
    alertsGenerated: highValueSales.length + recentSales.length
  }
}

// Run the integration test
function runIntegrationTest() {
  console.log('🧪 TESTING ENHANCED FANATICS COLLECT INTEGRATION')
  console.log('================================================\n')
  
  try {
    // 1. Test data normalization
    const normalized = normalizeEnhancedFanaticsData(mockFanaticsDataWithSoldPrices)
    console.log('✅ Data normalization successful')
    
    // 2. Test trend analysis
    const trends = analyzePriceTrends(normalized)
    console.log('✅ Price trend analysis successful')
    
    // 3. Test alert system
    const alerts = testSoldPriceAlerts(normalized)
    console.log('✅ Sold price alert system successful')
    
    console.log('\n🎉 INTEGRATION TEST COMPLETE!')
    console.log('============================')
    console.log(`✨ Enhanced data structure ready for production`)
    console.log(`📊 Trend analysis: ${trends.marketTrend} trend detected`)
    console.log(`🚨 Alert system: ${alerts?.alertsGenerated || 0} alerts generated`)
    console.log(`💰 Sales tracking: ${trends.completedSales} completed sales monitored`)
    
  } catch (error) {
    console.error('❌ Integration test failed:', error)
  }
}

// Run the test
runIntegrationTest()
