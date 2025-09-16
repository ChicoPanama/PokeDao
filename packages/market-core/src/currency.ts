// Currency and exchange rate utilities
// Provides deterministic currency conversion and rounding

import { CurrencyCode, PriceNormalization } from './types';

// Exchange rates (updated regularly - should be configurable via API)
const EXCHANGE_RATES: Record<CurrencyCode, number> = {
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

// Default currency for normalization
export const DEFAULT_CURRENCY: CurrencyCode = 'USD';

/**
 * Get exchange rate for a currency to USD
 */
export function getExchangeRate(currency: CurrencyCode): number {
  const rate = EXCHANGE_RATES[currency];
  if (rate === undefined) {
    throw new Error(`Unsupported currency: ${currency}`);
  }
  return rate;
}

/**
 * Convert price from one currency to another
 */
export function convertCurrency(
  amount: number,
  fromCurrency: CurrencyCode,
  toCurrency: CurrencyCode = DEFAULT_CURRENCY
): number {
  if (fromCurrency === toCurrency) {
    return amount;
  }

  const fromRate = getExchangeRate(fromCurrency);
  const toRate = getExchangeRate(toCurrency);
  
  // Convert to USD first, then to target currency
  const usdAmount = amount * fromRate;
  return usdAmount / toRate;
}

/**
 * Convert price to USD cents with deterministic rounding
 */
export function toUSDCents(amount: number, currency: CurrencyCode): number {
  const usdAmount = convertCurrency(amount, currency, DEFAULT_CURRENCY);
  return Math.round(usdAmount * 100);
}

/**
 * Convert USD cents to USD dollars
 */
export function fromUSDCents(cents: number): number {
  return cents / 100;
}

/**
 * Format price for display
 */
export function formatPrice(
  cents: number,
  currency: CurrencyCode = DEFAULT_CURRENCY,
  showCents: boolean = true
): string {
  const amount = fromUSDCents(cents);
  
  if (currency === DEFAULT_CURRENCY) {
    return showCents ? `$${amount.toFixed(2)}` : `$${Math.round(amount)}`;
  }
  
  // For other currencies, convert from USD
  const convertedAmount = convertCurrency(amount, DEFAULT_CURRENCY, currency);
  const symbol = getCurrencySymbol(currency);
  
  if (showCents) {
    return `${symbol}${convertedAmount.toFixed(2)}`;
  } else {
    return `${symbol}${Math.round(convertedAmount)}`;
  }
}

/**
 * Get currency symbol for display
 */
export function getCurrencySymbol(currency: CurrencyCode): string {
  const symbols: Record<string, string> = {
    'USD': '$',
    'EUR': '€',
    'GBP': '£',
    'JPY': '¥',
    'CAD': 'C$',
    'AUD': 'A$',
    'CHF': 'CHF',
    'CNY': '¥',
    'KRW': '₩',
    'INR': '₹',
    'BRL': 'R$',
    'RUB': '₽',
    'MXN': '$',
    'ZAR': 'R',
    'SEK': 'kr',
    'NOK': 'kr',
    'DKK': 'kr',
    'PLN': 'zł',
    'CZK': 'Kč',
    'HUF': 'Ft',
    'TRY': '₺',
    'ILS': '₪',
    'AED': 'د.إ',
    'SAR': 'ر.س',
    'EGP': '£',
    'NGN': '₦',
    'GHS': '₵',
    'KES': 'KSh',
    'MAD': 'د.م.',
    'TND': 'د.ت',
    'DZD': 'د.ج',
    'XOF': 'CFA',
    'XAF': 'FCFA',
    'BGN': 'лв',
    'RON': 'lei',
    'HRK': 'kn',
    'RSD': 'дин',
    'UAH': '₴',
    'BYN': 'Br',
    'KZT': '₸',
    'UZS': 'лв',
    'KGS': 'сом',
    'TJS': 'SM',
    'AFN': '؋',
    'PKR': '₨',
    'BDT': '৳',
    'LKR': '₨',
    'NPR': '₨',
    'BTN': 'Nu.',
    'MMK': 'K',
    'LAK': '₭',
    'KHR': '៛',
    'MOP': 'MOP$',
    'BND': 'B$',
    'FJD': 'FJ$',
    'PGK': 'K',
    'SBD': 'SI$',
    'VUV': 'Vt',
    'WST': 'WS$',
    'TOP': 'T$',
    'NZD': 'NZ$',
    'CLP': 'CLP$',
    'COP': 'COL$',
    'PEN': 'S/',
    'BOB': 'Bs',
    'ARS': 'AR$',
    'UYU': 'UY$',
    'PYG': '₲',
    'VES': 'Bs.S',
    'GYD': 'G$',
    'SRD': 'SRD',
    'BBD': 'Bds$',
    'BZD': 'BZ$',
    'GTQ': 'Q',
    'HNL': 'L',
    'NIO': 'C$',
    'CRC': '₡',
    'PAB': 'B/.',
    'DOP': 'RD$',
    'HTG': 'G',
    'JMD': 'J$',
    'TTD': 'TT$',
    'XCD': 'EC$',
    'AWG': 'ƒ',
    'ANG': 'ƒ',
    'KYD': 'CI$',
    'BMD': 'BD$',
    'BSD': 'B$'
  };
  
  return symbols[currency] || currency;
}

/**
 * Normalize price with currency conversion and validation
 */
export function normalizePrice(
  price: number,
  currency: CurrencyCode,
  options: {
    minPrice?: number;
    maxPrice?: number;
    allowNegative?: boolean;
  } = {}
): PriceNormalization {
  const issues: string[] = [];
  let confidence = 1.0;

  // Validate price
  if (!Number.isFinite(price)) {
    return {
      originalPrice: price,
      normalizedPrice: 0,
      currency,
      isValid: false,
      issues: ['Invalid price value'],
      confidence: 0
    };
  }

  if (!options.allowNegative && price < 0) {
    issues.push('Negative price');
    confidence -= 0.5;
  }

  // Check price bounds
  if (options.minPrice !== undefined && price < options.minPrice) {
    issues.push(`Price below minimum: ${options.minPrice}`);
    confidence -= 0.3;
  }

  if (options.maxPrice !== undefined && price > options.maxPrice) {
    issues.push(`Price above maximum: ${options.maxPrice}`);
    confidence -= 0.2;
  }

  // Convert to USD cents
  let normalizedPrice: number;
  let exchangeRate: number | undefined;

  try {
    if (currency !== DEFAULT_CURRENCY) {
      exchangeRate = getExchangeRate(currency);
      normalizedPrice = toUSDCents(price, currency);
    } else {
      normalizedPrice = Math.round(price * 100);
    }
  } catch (error) {
    issues.push(`Currency conversion failed: ${error}`);
    normalizedPrice = 0;
    confidence = 0;
  }

  // Check for precision issues
  const priceStr = price.toString();
  if (priceStr.includes('.') && priceStr.split('.')[1].length > 2) {
    issues.push('Excessive decimal precision');
    confidence -= 0.1;
  }

  // Validate normalized price
  if (normalizedPrice < 0 && !options.allowNegative) {
    issues.push('Normalized price is negative');
    confidence = 0;
  }

  return {
    originalPrice: price,
    normalizedPrice,
    currency: DEFAULT_CURRENCY,
    exchangeRate,
    isValid: issues.length === 0,
    issues,
    confidence: Math.max(0, confidence)
  };
}

/**
 * Update exchange rates (should be called periodically)
 */
export function updateExchangeRates(rates: Partial<Record<CurrencyCode, number>>): void {
  Object.assign(EXCHANGE_RATES, rates);
}

/**
 * Get all supported currencies
 */
export function getSupportedCurrencies(): CurrencyCode[] {
  return Object.keys(EXCHANGE_RATES) as CurrencyCode[];
}

/**
 * Validate currency code
 */
export function isValidCurrency(currency: string): currency is CurrencyCode {
  return currency in EXCHANGE_RATES;
}

/**
 * Batch convert multiple prices
 */
export function batchConvertPrices(
  prices: Array<{ amount: number; currency: CurrencyCode }>,
  targetCurrency: CurrencyCode = DEFAULT_CURRENCY
): number[] {
  return prices.map(({ amount, currency }) => 
    convertCurrency(amount, currency, targetCurrency)
  );
}

/**
 * Calculate price difference in percentage
 */
export function calculatePriceDifference(
  originalPrice: number,
  newPrice: number,
  currency: CurrencyCode = DEFAULT_CURRENCY
): number {
  if (originalPrice === 0) {
    return newPrice > 0 ? 100 : 0;
  }
  
  const originalUSD = convertCurrency(originalPrice, currency, DEFAULT_CURRENCY);
  const newUSD = convertCurrency(newPrice, currency, DEFAULT_CURRENCY);
  
  return ((newUSD - originalUSD) / originalUSD) * 100;
}

/**
 * Format price difference for display
 */
export function formatPriceDifference(
  originalPrice: number,
  newPrice: number,
  currency: CurrencyCode = DEFAULT_CURRENCY
): string {
  const difference = calculatePriceDifference(originalPrice, newPrice, currency);
  const sign = difference >= 0 ? '+' : '';
  return `${sign}${difference.toFixed(1)}%`;
}
