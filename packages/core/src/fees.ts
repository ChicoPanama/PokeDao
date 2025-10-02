/**
 * Fee calculations and adjustments
 */

import { DEFAULT_VENUE_FEES, VenueFees } from './types.js';
import { toUsdCents, centsToUsd } from './currency.js';

/**
 * Calculate net price after buyer fees
 *
 * NetBuy = ListPrice × (1 + buyerFeePct/100) + shipping
 *
 * @param listPriceCents - Listed price in USD cents
 * @param venue - Venue name
 * @param customFees - Override default fees
 * @returns Net price buyer pays in USD cents
 */
export function netBuyPrice(
  listPriceCents: number,
  venue: string = 'unknown',
  customFees?: VenueFees
): number {
  const fees = customFees || DEFAULT_VENUE_FEES[venue.toLowerCase()] || DEFAULT_VENUE_FEES.unknown;

  const buyerFeeCents = Math.round(listPriceCents * (fees.buyerFeePct / 100));
  const shippingCents = toUsdCents(fees.shippingUsd, 'USD');

  return listPriceCents + buyerFeeCents + shippingCents;
}

/**
 * Calculate net proceeds after seller fees
 *
 * NetSell = SalePrice × (1 - sellerFeePct/100) - shipping
 *
 * @param salePriceCents - Sale price in USD cents
 * @param venue - Venue name
 * @param customFees - Override default fees
 * @returns Net proceeds seller receives in USD cents
 */
export function netSellPrice(
  salePriceCents: number,
  venue: string = 'unknown',
  customFees?: VenueFees
): number {
  const fees = customFees || DEFAULT_VENUE_FEES[venue.toLowerCase()] || DEFAULT_VENUE_FEES.unknown;

  const sellerFeeCents = Math.round(salePriceCents * (fees.sellerFeePct / 100));
  const shippingCents = toUsdCents(fees.shippingUsd, 'USD');

  return salePriceCents - sellerFeeCents - shippingCents;
}

/**
 * Calculate round-trip friction (buy then sell same item)
 *
 * Friction = (BuyFees + SellFees + 2×Shipping) / SalePrice
 *
 * @param priceCents - Price in USD cents
 * @param venue - Venue name
 * @returns Friction as a percentage
 */
export function roundTripFriction(
  priceCents: number,
  venue: string = 'unknown'
): number {
  const netBuy = netBuyPrice(priceCents, venue);
  const netSell = netSellPrice(priceCents, venue);

  const totalFriction = netBuy - netSell;

  return (totalFriction / priceCents) * 100;
}

/**
 * Adjust comp price to account for fees
 *
 * For a sold comp, we want to know what the buyer ACTUALLY paid (not just hammer price)
 *
 * @param compPriceCents - Comp sale price (hammer)
 * @param venue - Venue where it sold
 * @returns Fee-adjusted price (what buyer paid)
 */
export function adjustCompForFees(
  compPriceCents: number,
  venue: string = 'unknown'
): number {
  return netBuyPrice(compPriceCents, venue);
}

/**
 * Calculate vault/withdrawal fees for tokenized platforms
 *
 * @param priceCents - Item value
 * @param venue - Venue (phygitals, collectorcrypt)
 * @returns Total vault + withdrawal fees in cents
 */
export function vaultWithdrawalFees(
  priceCents: number,
  venue: string
): number {
  const fees = DEFAULT_VENUE_FEES[venue.toLowerCase()];

  if (!fees || (!fees.vaultFeePct && !fees.withdrawalUsd)) {
    return 0;
  }

  const vaultFee = fees.vaultFeePct ? Math.round(priceCents * (fees.vaultFeePct / 100)) : 0;
  const withdrawalFee = fees.withdrawalUsd ? toUsdCents(fees.withdrawalUsd, 'USD') : 0;

  return vaultFee + withdrawalFee;
}

/**
 * Calculate total expected cost to acquire and hold
 *
 * TotalCost = NetBuyPrice + VaultFees
 *
 * @param listPriceCents - Listed price
 * @param venue - Venue
 * @returns Total cost in USD cents
 */
export function totalAcquisitionCost(
  listPriceCents: number,
  venue: string = 'unknown'
): number {
  const netBuy = netBuyPrice(listPriceCents, venue);
  const vaultFees = vaultWithdrawalFees(listPriceCents, venue);

  return netBuy + vaultFees;
}

/**
 * Calculate expected net proceeds after exit
 *
 * NetExit = NetSellPrice - WithdrawalFees
 *
 * @param salePriceCents - Expected sale price
 * @param venue - Venue
 * @returns Net proceeds in USD cents
 */
export function expectedNetProceeds(
  salePriceCents: number,
  venue: string = 'unknown'
): number {
  const netSell = netSellPrice(salePriceCents, venue);
  const withdrawalFees = vaultWithdrawalFees(salePriceCents, venue);

  return netSell - withdrawalFees;
}
