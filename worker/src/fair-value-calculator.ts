
// Stub for SourceData type (original import missing)
type SourceData = {
  price: number | null;
  source: string;
};

interface FairValueResult {
  collectorCryptPrice: number
  fairValueEstimate: number
  confidence: number
  sourcesUsed: string[]
  recommendation: "UNDERVALUED" | "FAIRLY_PRICED" | "OVERVALUED"
}

class FairValueCalculator {
  calculateFairValue(collectorCryptPrice: number, sourceData: SourceData[]): FairValueResult {
    if (sourceData.length === 0) {
      return {
        collectorCryptPrice,
        fairValueEstimate: collectorCryptPrice,
        confidence: 0,
        sourcesUsed: [],
        recommendation: "FAIRLY_PRICED"
      }
    }

    const validSources = sourceData.filter(s => s.price !== null)
    const prices = validSources.map(s => s.price!)
    const averagePrice = prices.reduce((a, b) => a + b, 0) / prices.length
    
    const priceDifference = (averagePrice - collectorCryptPrice) / collectorCryptPrice
    let recommendation: "UNDERVALUED" | "FAIRLY_PRICED" | "OVERVALUED"
    
    if (priceDifference > 0.15) recommendation = "UNDERVALUED"
    else if (priceDifference < -0.15) recommendation = "OVERVALUED"
    else recommendation = "FAIRLY_PRICED"

    return {
      collectorCryptPrice,
      fairValueEstimate: averagePrice,
      confidence: Math.min(validSources.length * 30, 100),
      sourcesUsed: validSources.map(s => s.source),
      recommendation
    }
  }
}

export { FairValueCalculator, type FairValueResult }
