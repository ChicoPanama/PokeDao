#!/usr/bin/env tsx

interface PriceNormalizationResult {
  originalPrice: number;
  normalizedPrice: number;
  currency: string;
  isValid: boolean;
  issues: string[];
  confidence: number;
}

interface PriceRange {
  min: number;
  max: number;
  category: string;
}

class EBayPriceNormalizer {
  private currencyRates: { [key: string]: number };
  private priceRanges: PriceRange[];
  private outlierThresholds: {
    min: number;
    max: number;
    extremeMin: number;
    extremeMax: number;
  };

  constructor() {
    this.initializeCurrencyRates();
    this.initializePriceRanges();
    this.initializeOutlierThresholds();
  }

  private initializeCurrencyRates() {
    // Exchange rates (as of 2025 - should be updated regularly)
    this.currencyRates = {
      'USD': 1.0,
      'CAD': 0.74,  // Canadian Dollar
      'EUR': 1.08,  // Euro
      'GBP': 1.27,  // British Pound
      'AUD': 0.65,  // Australian Dollar
      'JPY': 0.0067, // Japanese Yen
      'MXN': 0.059, // Mexican Peso
      'BRL': 0.20,  // Brazilian Real
      'CHF': 1.11,  // Swiss Franc
      'SEK': 0.092, // Swedish Krona
      'NOK': 0.092, // Norwegian Krone
      'DKK': 0.15,  // Danish Krone
      'PLN': 0.25,  // Polish Zloty
      'CZK': 0.043, // Czech Koruna
      'HUF': 0.0027, // Hungarian Forint
      'RUB': 0.011, // Russian Ruble
      'CNY': 0.14,  // Chinese Yuan
      'KRW': 0.00075, // South Korean Won
      'INR': 0.012, // Indian Rupee
      'SGD': 0.74,  // Singapore Dollar
      'HKD': 0.13,  // Hong Kong Dollar
      'TWD': 0.031, // Taiwan Dollar
      'THB': 0.027, // Thai Baht
      'MYR': 0.21,  // Malaysian Ringgit
      'IDR': 0.000064, // Indonesian Rupiah
      'PHP': 0.018, // Philippine Peso
      'VND': 0.000040, // Vietnamese Dong
      'ZAR': 0.053, // South African Rand
      'AED': 0.27,  // UAE Dirham
      'SAR': 0.27,  // Saudi Riyal
      'ILS': 0.27,  // Israeli Shekel
      'TRY': 0.033, // Turkish Lira
      'EGP': 0.020, // Egyptian Pound
      'NGN': 0.00063, // Nigerian Naira
      'KES': 0.0066, // Kenyan Shilling
      'GHS': 0.063, // Ghanaian Cedi
      'MAD': 0.098, // Moroccan Dirham
      'TND': 0.32,  // Tunisian Dinar
      'DZD': 0.0074, // Algerian Dinar
      'XOF': 0.0016, // West African CFA Franc
      'XAF': 0.0016, // Central African CFA Franc
      'BGN': 0.55,  // Bulgarian Lev
      'RON': 0.22,  // Romanian Leu
      'HRK': 0.14,  // Croatian Kuna
      'RSD': 0.0092, // Serbian Dinar
      'UAH': 0.025, // Ukrainian Hryvnia
      'BYN': 0.31,  // Belarusian Ruble
      'KZT': 0.0022, // Kazakhstani Tenge
      'UZS': 0.000080, // Uzbekistani Som
      'KGS': 0.011, // Kyrgyzstani Som
      'TJS': 0.092, // Tajikistani Somoni
      'AFN': 0.014, // Afghan Afghani
      'PKR': 0.0036, // Pakistani Rupee
      'BDT': 0.0091, // Bangladeshi Taka
      'LKR': 0.0031, // Sri Lankan Rupee
      'NPR': 0.0075, // Nepalese Rupee
      'BTN': 0.012, // Bhutanese Ngultrum
      'MMK': 0.00048, // Myanmar Kyat
      'LAK': 0.000048, // Lao Kip
      'KHR': 0.00024, // Cambodian Riel
      'MOP': 0.12,  // Macanese Pataca
      'BND': 0.74,  // Brunei Dollar
      'FJD': 0.45,  // Fijian Dollar
      'PGK': 0.26,  // Papua New Guinea Kina
      'SBD': 0.12,  // Solomon Islands Dollar
      'VUV': 0.0085, // Vanuatu Vatu
      'WST': 0.37,  // Samoan Tala
      'TOP': 0.41,  // Tongan Pa'anga
      'NZD': 0.61,  // New Zealand Dollar
      'CLP': 0.0010, // Chilean Peso
      'COP': 0.00026, // Colombian Peso
      'PEN': 0.27,  // Peruvian Sol
      'BOB': 0.15,  // Bolivian Boliviano
      'ARS': 0.0012, // Argentine Peso
      'UYU': 0.025, // Uruguayan Peso
      'PYG': 0.00014, // Paraguayan Guarani
      'VES': 0.028, // Venezuelan Bolívar
      'GYD': 0.0048, // Guyanese Dollar
      'SRD': 0.028, // Surinamese Dollar
      'BBD': 0.50,  // Barbadian Dollar
      'BZD': 0.50,  // Belize Dollar
      'GTQ': 0.13,  // Guatemalan Quetzal
      'HNL': 0.041, // Honduran Lempira
      'NIO': 0.027, // Nicaraguan Córdoba
      'CRC': 0.0019, // Costa Rican Colón
      'PAB': 1.00,  // Panamanian Balboa
      'DOP': 0.017, // Dominican Peso
      'HTG': 0.0074, // Haitian Gourde
      'JMD': 0.0064, // Jamaican Dollar
      'TTD': 0.15,  // Trinidad and Tobago Dollar
      'XCD': 0.37,  // East Caribbean Dollar
      'AWG': 0.56,  // Aruban Florin
      'ANG': 0.56,  // Netherlands Antillean Guilder
      'KYD': 1.22,  // Cayman Islands Dollar
      'BMD': 1.00,  // Bermudian Dollar
      'BSD': 1.00   // Bahamian Dollar
    };
  }

  private initializePriceRanges() {
    this.priceRanges = [
      { min: 0, max: 1, category: 'Free/Token' },
      { min: 1, max: 5, category: 'Budget' },
      { min: 5, max: 25, category: 'Common' },
      { min: 25, max: 100, category: 'Uncommon' },
      { min: 100, max: 500, category: 'Rare' },
      { min: 500, max: 1000, category: 'Very Rare' },
      { min: 1000, max: 5000, category: 'Ultra Rare' },
      { min: 5000, max: 25000, category: 'Legendary' },
      { min: 25000, max: 100000, category: 'Mythic' },
      { min: 100000, max: 1000000, category: 'Ultra Mythic' },
      { min: 1000000, max: Infinity, category: 'Extreme' }
    ];
  }

  private initializeOutlierThresholds() {
    this.outlierThresholds = {
      min: 0.01,        // Minimum realistic price
      max: 100000,      // Maximum realistic price for most cards
      extremeMin: 0.001, // Extreme minimum (likely error)
      extremeMax: 1000000 // Extreme maximum (likely error)
    };
  }

  normalizePrice(price: number, currency: string = 'USD'): PriceNormalizationResult {
    const result: PriceNormalizationResult = {
      originalPrice: price,
      normalizedPrice: price,
      currency: currency.toUpperCase(),
      isValid: true,
      issues: [],
      confidence: 1.0
    };

    // Check for invalid price
    if (!price || isNaN(price) || !isFinite(price)) {
      result.isValid = false;
      result.issues.push('Invalid price value');
      result.confidence = 0;
      return result;
    }

    // Check for negative prices
    if (price < 0) {
      result.isValid = false;
      result.issues.push('Negative price');
      result.confidence = 0;
      return result;
    }

    // Check for extreme outliers
    if (price < this.outlierThresholds.extremeMin) {
      result.isValid = false;
      result.issues.push('Extremely low price (likely error)');
      result.confidence = 0;
      return result;
    }

    if (price > this.outlierThresholds.extremeMax) {
      result.isValid = false;
      result.issues.push('Extremely high price (likely error)');
      result.confidence = 0;
      return result;
    }

    // Check for outliers
    if (price < this.outlierThresholds.min) {
      result.issues.push('Unusually low price');
      result.confidence -= 0.2;
    }

    if (price > this.outlierThresholds.max) {
      result.issues.push('Unusually high price');
      result.confidence -= 0.1;
    }

    // Check for precision issues (excessive decimal places)
    const priceStr = price.toString();
    if (priceStr.includes('.') && priceStr.split('.')[1].length > 2) {
      result.issues.push('Excessive decimal precision');
      result.confidence -= 0.1;
    }

    // Normalize precision to 2 decimal places
    result.normalizedPrice = Math.round(price * 100) / 100;

    // Convert currency if needed
    if (currency.toUpperCase() !== 'USD') {
      const rate = this.currencyRates[currency.toUpperCase()];
      if (rate) {
        result.normalizedPrice = Math.round(result.normalizedPrice * rate * 100) / 100;
        result.currency = 'USD';
      } else {
        result.issues.push(`Unknown currency: ${currency}`);
        result.confidence -= 0.2;
      }
    }

    // Ensure confidence doesn't go below 0
    result.confidence = Math.max(result.confidence, 0);

    return result;
  }

  getPriceCategory(price: number): string {
    for (const range of this.priceRanges) {
      if (price >= range.min && price < range.max) {
        return range.category;
      }
    }
    return 'Unknown';
  }

  isRealisticPrice(price: number, context?: {
    pokemonName?: string;
    setCode?: string;
    grade?: string;
    condition?: string;
  }): boolean {
    // Basic price validation
    if (price < this.outlierThresholds.min || price > this.outlierThresholds.max) {
      return false;
    }

    // Context-specific validation
    if (context) {
      // High-grade Charizard cards can be very expensive
      if (context.pokemonName?.toLowerCase() === 'charizard' && 
          context.grade && 
          parseFloat(context.grade) >= 9) {
        return price <= 500000; // Allow very high prices for high-grade Charizards
      }

      // PSA 10 cards of popular Pokemon can be expensive
      if (context.grade === '10' && 
          ['charizard', 'pikachu', 'mew', 'mewtwo', 'lugia'].includes(context.pokemonName?.toLowerCase() || '')) {
        return price <= 100000;
      }

      // Damaged cards should be relatively cheap
      if (context.condition?.toLowerCase().includes('damaged') && price > 1000) {
        return false;
      }

      // Poor condition cards should be very cheap
      if (context.condition?.toLowerCase().includes('poor') && price > 100) {
        return false;
      }
    }

    return true;
  }

  // Batch processing for large datasets
  normalizePrices(prices: Array<{ price: number; currency?: string }>): PriceNormalizationResult[] {
    return prices.map(item => this.normalizePrice(item.price, item.currency || 'USD'));
  }

  // Get currency exchange rate
  getExchangeRate(currency: string): number {
    return this.currencyRates[currency.toUpperCase()] || 1.0;
  }

  // Update currency rates (should be called periodically)
  updateCurrencyRates(newRates: { [key: string]: number }) {
    this.currencyRates = { ...this.currencyRates, ...newRates };
  }

  // Get price statistics for a dataset
  getPriceStatistics(prices: number[]): {
    count: number;
    mean: number;
    median: number;
    mode: number;
    min: number;
    max: number;
    range: number;
    standardDeviation: number;
    outliers: number[];
    categories: { [category: string]: number };
  } {
    const validPrices = prices.filter(p => this.isRealisticPrice(p));
    
    if (validPrices.length === 0) {
      return {
        count: 0,
        mean: 0,
        median: 0,
        mode: 0,
        min: 0,
        max: 0,
        range: 0,
        standardDeviation: 0,
        outliers: [],
        categories: {}
      };
    }

    const sorted = validPrices.sort((a, b) => a - b);
    const count = validPrices.length;
    const mean = validPrices.reduce((sum, p) => sum + p, 0) / count;
    const median = count % 2 === 0 
      ? (sorted[count / 2 - 1] + sorted[count / 2]) / 2
      : sorted[Math.floor(count / 2)];
    
    // Calculate mode (most frequent price category)
    const categoryCounts: { [key: string]: number } = {};
    validPrices.forEach(price => {
      const category = this.getPriceCategory(price);
      categoryCounts[category] = (categoryCounts[category] || 0) + 1;
    });
    const mode = Object.keys(categoryCounts).reduce((a, b) => 
      categoryCounts[a] > categoryCounts[b] ? a : b
    );

    const min = Math.min(...validPrices);
    const max = Math.max(...validPrices);
    const range = max - min;

    // Calculate standard deviation
    const variance = validPrices.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0) / count;
    const standardDeviation = Math.sqrt(variance);

    // Find outliers (prices more than 2 standard deviations from mean)
    const outliers = validPrices.filter(p => 
      Math.abs(p - mean) > 2 * standardDeviation
    );

    return {
      count,
      mean: Math.round(mean * 100) / 100,
      median: Math.round(median * 100) / 100,
      mode,
      min,
      max,
      range,
      standardDeviation: Math.round(standardDeviation * 100) / 100,
      outliers,
      categories: categoryCounts
    };
  }
}

// Test the price normalizer
function testPriceNormalizer() {
  const normalizer = new EBayPriceNormalizer();
  
  const testPrices = [
    { price: 45.999999999999, currency: 'USD' },
    { price: 1234.56, currency: 'CAD' },
    { price: 0.001, currency: 'USD' },
    { price: -10, currency: 'USD' },
    { price: 1500000, currency: 'USD' },
    { price: 25.50, currency: 'EUR' },
    { price: 100, currency: 'JPY' },
    { price: 50000, currency: 'USD' }
  ];

  console.log('🧪 Testing eBay Price Normalizer:\n');
  
  testPrices.forEach((test, i) => {
    const result = normalizer.normalizePrice(test.price, test.currency);
    console.log(`${i + 1}. Original: ${test.price} ${test.currency}`);
    console.log(`   Normalized: ${result.normalizedPrice} ${result.currency}`);
    console.log(`   Valid: ${result.isValid}`);
    console.log(`   Confidence: ${(result.confidence * 100).toFixed(1)}%`);
    console.log(`   Category: ${normalizer.getPriceCategory(result.normalizedPrice)}`);
    if (result.issues.length > 0) {
      console.log(`   Issues: ${result.issues.join(', ')}`);
    }
    console.log('');
  });

  // Test price statistics
  const prices = [10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000];
  const stats = normalizer.getPriceStatistics(prices);
  
  console.log('📊 Price Statistics:');
  console.log(`   Count: ${stats.count}`);
  console.log(`   Mean: $${stats.mean}`);
  console.log(`   Median: $${stats.median}`);
  console.log(`   Mode: ${stats.mode}`);
  console.log(`   Range: $${stats.range}`);
  console.log(`   Std Dev: $${stats.standardDeviation}`);
  console.log(`   Categories:`, stats.categories);
}

if (require.main === module) {
  testPriceNormalizer();
}

export { EBayPriceNormalizer, PriceNormalizationResult };
