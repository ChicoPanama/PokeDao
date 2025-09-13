export type FeeProfile = {
  buyFeeRate: number; // percent as decimal, e.g., 0.00 if none
  sellFeeRate: number; // percent as decimal
  avgInboundShipCents: number; // shipping you pay when buying
  avgOutboundShipCents: number; // shipping you pay when selling
};

// Defaults — tune via ENV or by editing values.
export const FEE_PROFILES: Record<string, FeeProfile> = {
  TCGPLAYER: { buyFeeRate: 0.0, sellFeeRate: 0.13, avgInboundShipCents: 499, avgOutboundShipCents: 549 },
  EBAY: { buyFeeRate: 0.0, sellFeeRate: 0.13, avgInboundShipCents: 499, avgOutboundShipCents: 549 },
  FANATICS: { buyFeeRate: 0.0, sellFeeRate: 0.13, avgInboundShipCents: 599, avgOutboundShipCents: 599 },
};

function numEnv(key: string): number | undefined {
  const v = process.env[key];
  if (v === undefined || v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

export function fromEnvIfPresent(profile: FeeProfile, ns: string): FeeProfile {
  return {
    buyFeeRate: numEnv(`${ns}_BUY_FEE_RATE`) ?? profile.buyFeeRate,
    sellFeeRate: numEnv(`${ns}_SELL_FEE_RATE`) ?? profile.sellFeeRate,
    avgInboundShipCents: numEnv(`${ns}_INBOUND_SHIP_CENTS`) ?? profile.avgInboundShipCents,
    avgOutboundShipCents: numEnv(`${ns}_OUTBOUND_SHIP_CENTS`) ?? profile.avgOutboundShipCents,
  } as FeeProfile;
}

export function getProfile(source: string): FeeProfile {
  const key = (source || 'EBAY').toUpperCase();
  const base = FEE_PROFILES[key] || FEE_PROFILES['EBAY'];
  return fromEnvIfPresent(base, `FEE_${key}`);
}

