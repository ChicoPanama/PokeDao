/**
 * Currency normalization and FX rates
 */

export const FX_RATES: Record<string, number> = {
  USD: 1.0,
  EUR: 1.08,
  GBP: 1.27,
  CAD: 0.73,
  AUD: 0.65,
  JPY: 0.0067,
  CHF: 1.13,
  CNY: 0.14,
  KRW: 0.00075,
};

/**
 * Normalize any currency to USD cents
 *
 * @param price - Price in original currency
 * @param currency - ISO currency code
 * @returns Price in USD cents
 */
export function toUsdCents(price: number | string, currency: string = 'USD'): number {
  const priceNum = typeof price === 'number' ? price : parseFloat(price) || 0;
  const rate = FX_RATES[currency.toUpperCase()] || 1.0;

  return Math.round(priceNum * rate * 100);
}

/**
 * Convert USD cents back to dollars
 */
export function centsToUsd(cents: number): number {
  return cents / 100;
}

/**
 * Format USD cents as currency string
 */
export function formatUsd(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

/**
 * Format USD cents with thousands separators
 */
export function formatUsdPretty(cents: number): string {
  return `$${(cents / 100).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Get FX rate for a currency
 */
export function getFxRate(currency: string): number {
  return FX_RATES[currency.toUpperCase()] || 1.0;
}
