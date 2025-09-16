#!/usr/bin/env tsx

import { Database } from 'better-sqlite3';
import fs from 'fs';

interface ArbitrageOpportunity {
  id: string;
  cardName: string;
  setCode: string;
  cardNumber: string;
  grade: string;
  gradingCompany: string;
  
  // Pricing data
  ebayPrice: number;
  tcgPlayerPrice?: number;
  pokemonTCGPrice?: number;
  marketValue: number;
  
  // Arbitrage calculation
  profitPotential: number;
  profitPercentage: number;
  totalCost: number;
  roi: number;
  
  // Market indicators
  liquidity: 'HIGH' | 'MEDIUM' | 'LOW';
  velocity: number; // Days to sell
  demand: 'RISING' | 'STABLE' | 'FALLING';
  volatility: number;
  
  // Confidence and quality
  confidence: number;
  dataQuality: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  
  // Metadata
  ebayItemId: string;
  ebayUrl: string;
  lastUpdated: string;
  analysisTimestamp: string;
}

interface ArbitrageStats {
  totalOpportunities: number;
  highConfidenceOpportunities: number;
  totalProfitPotential: number;
  averageProfitPercentage: number;
  priceRanges: { [range: string]: number };
  gradeDistribution: { [grade: string]: number };
  riskDistribution: { [risk: string]: number };
  topOpportunities: ArbitrageOpportunity[];
}

class EBayArbitrageDetector {
  private db: Database;
  private stats: ArbitrageStats;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.stats = {
      totalOpportunities: 0,
      highConfidenceOpportunities: 0,
      totalProfitPotential: 0,
      averageProfitPercentage: 0,
      priceRanges: {},
      gradeDistribution: {},
      riskDistribution: {},
      topOpportunities: []
    };
  }

  async detectArbitrageOpportunities(
    minProfitPercentage: number = 15,
    maxRiskLevel: string = 'MEDIUM',
    minConfidence: number = 0.7
  ): Promise<ArbitrageOpportunity[]> {
    console.log('💰 Starting arbitrage opportunity detection...\n');

    // Get cleaned eBay data with cross-references
    const opportunities = this.analyzeArbitrageOpportunities(
      minProfitPercentage,
      maxRiskLevel,
      minConfidence
    );

    this.calculateStats(opportunities);
    this.logReport(opportunities);

    return opportunities;
  }

  private analyzeArbitrageOpportunities(
    minProfitPercentage: number,
    maxRiskLevel: string,
    minConfidence: number
  ): ArbitrageOpportunity[] {
    const query = `
      SELECT 
        c.id,
        c.ebay_item_id,
        c.title,
        c.cleaned_pokemon_name,
        c.cleaned_set_code,
        c.cleaned_card_number,
        c.cleaned_grading_company,
        c.cleaned_grade_number,
        c.cleaned_price as ebay_price,
        c.generated_ebay_url,
        c.confidence_score,
        c.data_quality_score,
        x.pokemon_tcg_data,
        x.match_confidence as cross_reference_confidence
      FROM ebay_current_listings_cleaned c
      LEFT JOIN ebay_pokemon_tcg_cross_reference x ON c.ebay_item_id = x.ebay_id
      WHERE c.cleaned_price > 0 
        AND c.cleaned_price < 100000
        AND c.confidence_score >= ?
        AND c.cleaned_pokemon_name IS NOT NULL
        AND c.cleaned_set_code IS NOT NULL
      ORDER BY c.confidence_score DESC, c.cleaned_price DESC
    `;

    const records = this.db.prepare(query).all(minConfidence);
    console.log(`📊 Analyzing ${records.length.toLocaleString()} high-confidence records...\n`);

    const opportunities: ArbitrageOpportunity[] = [];

    for (const record of records) {
      try {
        const opportunity = this.createArbitrageOpportunity(record);
        
        if (this.isValidOpportunity(opportunity, minProfitPercentage, maxRiskLevel)) {
          opportunities.push(opportunity);
        }
      } catch (error) {
        console.error(`❌ Failed to analyze record ${record.id}:`, error);
      }
    }

    // Sort by profit potential
    return opportunities.sort((a, b) => b.profitPotential - a.profitPotential);
  }

  private createArbitrageOpportunity(record: any): ArbitrageOpportunity {
    const ebayPrice = record.ebay_price;
    let marketValue = ebayPrice; // Default to eBay price if no other data
    
    // Try to get market value from Pokemon TCG data
    if (record.pokemon_tcg_data) {
      const tcgData = JSON.parse(record.pokemon_tcg_data);
      if (tcgData.tcgplayer?.prices) {
        marketValue = this.extractMarketValue(tcgData.tcgplayer.prices);
      }
    }

    // Calculate arbitrage metrics
    const profitPotential = Math.max(0, marketValue - ebayPrice);
    const profitPercentage = ebayPrice > 0 ? (profitPotential / ebayPrice) * 100 : 0;
    const totalCost = ebayPrice + this.estimateShippingAndFees(ebayPrice);
    const roi = totalCost > 0 ? (profitPotential / totalCost) * 100 : 0;

    // Calculate market indicators
    const liquidity = this.calculateLiquidity(record);
    const velocity = this.calculateVelocity(record);
    const demand = this.calculateDemand(record);
    const volatility = this.calculateVolatility(record);

    // Calculate confidence and risk
    const confidence = this.calculateOverallConfidence(record, profitPercentage);
    const dataQuality = record.data_quality_score || 0.5;
    const riskLevel = this.calculateRiskLevel(profitPercentage, confidence, liquidity, volatility);

    return {
      id: `arb_${record.ebay_item_id}`,
      cardName: record.cleaned_pokemon_name,
      setCode: record.cleaned_set_code,
      cardNumber: record.cleaned_card_number,
      grade: record.cleaned_grade_number,
      gradingCompany: record.cleaned_grading_company,
      
      ebayPrice,
      marketValue,
      profitPotential,
      profitPercentage,
      totalCost,
      roi,
      
      liquidity,
      velocity,
      demand,
      volatility,
      
      confidence,
      dataQuality,
      riskLevel,
      
      ebayItemId: record.ebay_item_id,
      ebayUrl: record.generated_ebay_url,
      lastUpdated: new Date().toISOString(),
      analysisTimestamp: new Date().toISOString()
    };
  }

  private extractMarketValue(tcgPlayerPrices: any): number {
    // Prioritize market price, then mid price, then average of low/high
    if (tcgPlayerPrices.holofoil?.market) return tcgPlayerPrices.holofoil.market;
    if (tcgPlayerPrices.normal?.market) return tcgPlayerPrices.normal.market;
    if (tcgPlayerPrices.reverseHolofoil?.market) return tcgPlayerPrices.reverseHolofoil.market;
    
    if (tcgPlayerPrices.holofoil?.mid) return tcgPlayerPrices.holofoil.mid;
    if (tcgPlayerPrices.normal?.mid) return tcgPlayerPrices.normal.mid;
    if (tcgPlayerPrices.reverseHolofoil?.mid) return tcgPlayerPrices.reverseHolofoil.mid;
    
    // Calculate average of low and high
    const prices = [];
    if (tcgPlayerPrices.holofoil?.low && tcgPlayerPrices.holofoil?.high) {
      prices.push((tcgPlayerPrices.holofoil.low + tcgPlayerPrices.holofoil.high) / 2);
    }
    if (tcgPlayerPrices.normal?.low && tcgPlayerPrices.normal?.high) {
      prices.push((tcgPlayerPrices.normal.low + tcgPlayerPrices.normal.high) / 2);
    }
    if (tcgPlayerPrices.reverseHolofoil?.low && tcgPlayerPrices.reverseHolofoil?.high) {
      prices.push((tcgPlayerPrices.reverseHolofoil.low + tcgPlayerPrices.reverseHolofoil.high) / 2);
    }
    
    return prices.length > 0 ? Math.max(...prices) : 0;
  }

  private estimateShippingAndFees(price: number): number {
    // eBay fees: ~13% for most categories
    const ebayFees = price * 0.13;
    
    // PayPal fees: ~3%
    const paypalFees = price * 0.03;
    
    // Shipping estimate based on price range
    let shipping = 5; // Base shipping
    if (price > 100) shipping = 8; // Insurance for higher value
    if (price > 500) shipping = 15; // Signature confirmation
    if (price > 1000) shipping = 25; // Full insurance and tracking
    
    return ebayFees + paypalFees + shipping;
  }

  private calculateLiquidity(record: any): 'HIGH' | 'MEDIUM' | 'LOW' {
    // Based on card popularity and grading
    const popularPokemon = ['charizard', 'pikachu', 'mew', 'mewtwo', 'lugia', 'blastoise', 'venusaur'];
    const isPopular = popularPokemon.includes(record.cleaned_pokemon_name?.toLowerCase());
    
    const highGrades = ['10', '9.5', '9'];
    const isHighGrade = highGrades.includes(record.cleaned_grade_number);
    
    if (isPopular && isHighGrade) return 'HIGH';
    if (isPopular || isHighGrade) return 'MEDIUM';
    return 'LOW';
  }

  private calculateVelocity(record: any): number {
    // Estimate days to sell based on card characteristics
    const baseVelocity = 30; // Base 30 days
    
    // Popular cards sell faster
    const popularPokemon = ['charizard', 'pikachu', 'mew', 'mewtwo'];
    if (popularPokemon.includes(record.cleaned_pokemon_name?.toLowerCase())) {
      return baseVelocity * 0.5; // 15 days
    }
    
    // High-grade cards sell faster
    const grade = parseFloat(record.cleaned_grade_number || '0');
    if (grade >= 9) {
      return baseVelocity * 0.7; // 21 days
    }
    
    return baseVelocity;
  }

  private calculateDemand(record: any): 'RISING' | 'STABLE' | 'FALLING' {
    // This would ideally use historical data, but for now use heuristics
    const vintageSets = ['BS1', 'JU', 'FO', 'TR', 'GH', 'GC'];
    const isVintage = vintageSets.includes(record.cleaned_set_code);
    
    const highGrade = parseFloat(record.cleaned_grade_number || '0') >= 9;
    
    if (isVintage && highGrade) return 'RISING';
    if (isVintage || highGrade) return 'STABLE';
    return 'FALLING';
  }

  private calculateVolatility(record: any): number {
    // Higher volatility for rare, high-value cards
    const price = record.ebay_price;
    const grade = parseFloat(record.cleaned_grade_number || '0');
    
    let volatility = 0.1; // Base 10% volatility
    
    if (price > 1000) volatility += 0.1;
    if (price > 5000) volatility += 0.1;
    if (grade >= 9) volatility += 0.1;
    if (grade >= 9.5) volatility += 0.1;
    
    return Math.min(volatility, 0.5); // Cap at 50%
  }

  private calculateOverallConfidence(record: any, profitPercentage: number): number {
    let confidence = 0;
    
    // Base confidence from data quality
    confidence += (record.confidence_score || 0) * 0.3;
    confidence += (record.cross_reference_confidence || 0) * 0.2;
    confidence += (record.data_quality_score || 0) * 0.2;
    
    // Profit percentage confidence (higher profit = higher confidence if data is good)
    if (profitPercentage > 20) confidence += 0.1;
    if (profitPercentage > 50) confidence += 0.1;
    if (profitPercentage > 100) confidence += 0.1;
    
    // Penalize unrealistic profits
    if (profitPercentage > 500) confidence -= 0.2;
    
    return Math.min(Math.max(confidence, 0), 1);
  }

  private calculateRiskLevel(
    profitPercentage: number, 
    confidence: number, 
    liquidity: string, 
    volatility: number
  ): 'LOW' | 'MEDIUM' | 'HIGH' {
    let riskScore = 0;
    
    // High profit = higher risk
    if (profitPercentage > 50) riskScore += 1;
    if (profitPercentage > 100) riskScore += 1;
    
    // Low confidence = higher risk
    if (confidence < 0.7) riskScore += 1;
    if (confidence < 0.5) riskScore += 1;
    
    // Low liquidity = higher risk
    if (liquidity === 'LOW') riskScore += 1;
    
    // High volatility = higher risk
    if (volatility > 0.3) riskScore += 1;
    
    if (riskScore <= 1) return 'LOW';
    if (riskScore <= 3) return 'MEDIUM';
    return 'HIGH';
  }

  private isValidOpportunity(
    opportunity: ArbitrageOpportunity,
    minProfitPercentage: number,
    maxRiskLevel: string
  ): boolean {
    // Must meet minimum profit percentage
    if (opportunity.profitPercentage < minProfitPercentage) return false;
    
    // Must meet risk level requirements
    const riskOrder = { 'LOW': 1, 'MEDIUM': 2, 'HIGH': 3 };
    if (riskOrder[opportunity.riskLevel] > riskOrder[maxRiskLevel as keyof typeof riskOrder]) {
      return false;
    }
    
    // Must have reasonable confidence
    if (opportunity.confidence < 0.5) return false;
    
    // Must have minimum profit potential
    if (opportunity.profitPotential < 25) return false;
    
    return true;
  }

  private calculateStats(opportunities: ArbitrageOpportunity[]) {
    this.stats.totalOpportunities = opportunities.length;
    this.stats.highConfidenceOpportunities = opportunities.filter(o => o.confidence >= 0.8).length;
    this.stats.totalProfitPotential = opportunities.reduce((sum, o) => sum + o.profitPotential, 0);
    this.stats.averageProfitPercentage = opportunities.length > 0 
      ? opportunities.reduce((sum, o) => sum + o.profitPercentage, 0) / opportunities.length 
      : 0;
    
    // Price ranges
    this.stats.priceRanges = {
      'Under $100': opportunities.filter(o => o.ebayPrice < 100).length,
      '$100-$500': opportunities.filter(o => o.ebayPrice >= 100 && o.ebayPrice < 500).length,
      '$500-$1000': opportunities.filter(o => o.ebayPrice >= 500 && o.ebayPrice < 1000).length,
      '$1000-$5000': opportunities.filter(o => o.ebayPrice >= 1000 && o.ebayPrice < 5000).length,
      '$5000+': opportunities.filter(o => o.ebayPrice >= 5000).length
    };
    
    // Grade distribution
    this.stats.gradeDistribution = opportunities.reduce((acc, o) => {
      const grade = o.grade || 'Unknown';
      acc[grade] = (acc[grade] || 0) + 1;
      return acc;
    }, {} as { [key: string]: number });
    
    // Risk distribution
    this.stats.riskDistribution = opportunities.reduce((acc, o) => {
      acc[o.riskLevel] = (acc[o.riskLevel] || 0) + 1;
      return acc;
    }, {} as { [key: string]: number });
    
    // Top opportunities
    this.stats.topOpportunities = opportunities.slice(0, 10);
  }

  private logReport(opportunities: ArbitrageOpportunity[]) {
    console.log('🎯 ARBITRAGE OPPORTUNITY ANALYSIS COMPLETE!\n');
    console.log('📊 SUMMARY STATISTICS:');
    console.log(`   Total Opportunities: ${this.stats.totalOpportunities.toLocaleString()}`);
    console.log(`   High Confidence (>80%): ${this.stats.highConfidenceOpportunities.toLocaleString()}`);
    console.log(`   Total Profit Potential: $${this.stats.totalProfitPotential.toLocaleString()}`);
    console.log(`   Average Profit %: ${this.stats.averageProfitPercentage.toFixed(1)}%\n`);

    console.log('💰 PRICE RANGES:');
    Object.entries(this.stats.priceRanges).forEach(([range, count]) => {
      console.log(`   ${range}: ${count} opportunities`);
    });
    console.log('');

    console.log('🎯 GRADE DISTRIBUTION:');
    Object.entries(this.stats.gradeDistribution)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .forEach(([grade, count]) => {
        console.log(`   ${grade}: ${count} opportunities`);
      });
    console.log('');

    console.log('⚠️  RISK DISTRIBUTION:');
    Object.entries(this.stats.riskDistribution).forEach(([risk, count]) => {
      console.log(`   ${risk}: ${count} opportunities`);
    });
    console.log('');

    console.log('🏆 TOP 10 OPPORTUNITIES:');
    this.stats.topOpportunities.forEach((opp, i) => {
      console.log(`${i + 1}. ${opp.cardName} ${opp.setCode} #${opp.cardNumber} (${opp.gradingCompany} ${opp.grade})`);
      console.log(`   eBay: $${opp.ebayPrice.toLocaleString()} | Market: $${opp.marketValue.toLocaleString()} | Profit: $${opp.profitPotential.toLocaleString()} (${opp.profitPercentage.toFixed(1)}%)`);
      console.log(`   Risk: ${opp.riskLevel} | Confidence: ${(opp.confidence * 100).toFixed(1)}% | Liquidity: ${opp.liquidity}\n`);
    });
  }

  // Export opportunities for further analysis
  exportOpportunities(opportunities: ArbitrageOpportunity[]): void {
    const exportData = {
      timestamp: new Date().toISOString(),
      stats: this.stats,
      opportunities: opportunities
    };

    fs.mkdirSync('reports', { recursive: true });
    fs.writeFileSync('reports/ebay-arbitrage-opportunities.json', JSON.stringify(exportData, null, 2));
    
    // Export CSV for spreadsheet analysis
    const csvHeaders = [
      'ID', 'Card Name', 'Set Code', 'Card Number', 'Grade', 'Grading Company',
      'eBay Price', 'Market Value', 'Profit Potential', 'Profit Percentage', 'ROI',
      'Liquidity', 'Velocity', 'Demand', 'Volatility', 'Confidence', 'Data Quality', 'Risk Level',
      'eBay Item ID', 'eBay URL'
    ].join(',');
    
    const csvRows = opportunities.map(opp => [
      opp.id, opp.cardName, opp.setCode, opp.cardNumber, opp.grade, opp.gradingCompany,
      opp.ebayPrice, opp.marketValue, opp.profitPotential, opp.profitPercentage, opp.roi,
      opp.liquidity, opp.velocity, opp.demand, opp.volatility, opp.confidence, opp.dataQuality, opp.riskLevel,
      opp.ebayItemId, opp.ebayUrl
    ].join(','));
    
    const csvContent = [csvHeaders, ...csvRows].join('\n');
    fs.writeFileSync('reports/ebay-arbitrage-opportunities.csv', csvContent);
    
    console.log('📁 Opportunities exported to reports/ebay-arbitrage-opportunities.json and .csv');
  }

  close() {
    this.db.close();
  }
}

async function main() {
  const dbPath = process.argv[2] || 'research/tcgplayer-discovery/collector_crypt_ebay_complete.db';
  const minProfitPercentage = parseFloat(process.argv[3]) || 15;
  const maxRiskLevel = process.argv[4] || 'MEDIUM';
  const minConfidence = parseFloat(process.argv[5]) || 0.7;
  
  if (!fs.existsSync(dbPath)) {
    console.error(`❌ Database not found: ${dbPath}`);
    process.exit(1);
  }

  const detector = new EBayArbitrageDetector(dbPath);
  
  try {
    const opportunities = await detector.detectArbitrageOpportunities(
      minProfitPercentage,
      maxRiskLevel,
      minConfidence
    );
    
    detector.exportOpportunities(opportunities);
    
    console.log(`\n✅ Found ${opportunities.length} arbitrage opportunities!`);
    console.log(`💰 Total profit potential: $${opportunities.reduce((sum, o) => sum + o.profitPotential, 0).toLocaleString()}`);
    
  } catch (error) {
    console.error('❌ Arbitrage detection failed:', error);
    process.exit(1);
  } finally {
    detector.close();
  }
}

if (require.main === module) {
  main().catch(console.error);
}

export { EBayArbitrageDetector, ArbitrageOpportunity, ArbitrageStats };
