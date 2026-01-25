/**
 * API client for PokeDAO backend
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '/api';

export interface ArbitrageOpportunity {
  cardId: string;
  cardName: string;
  setName: string;
  grade?: string;
  buyVenue: string;
  buyPrice: number;
  sellVenue: string;
  sellPrice: number;
  spreadPct: number;
  netProfitCents: number;
  confidence: number;
  buyUrl?: string;
  sellUrl?: string;
}

export interface Signal {
  id: string;
  cardId: string;
  cardName?: string;
  setCode?: string;
  cardNumber?: string;
  edgePct: number;
  confidence: number;
  thesis?: string;
  listingUrl?: string;
  nhiScore?: number;
}

export interface HealthStatus {
  status: string;
  redis: string;
}

export async function fetchArbitrage(params?: {
  minSpread?: number;
  limit?: number;
}): Promise<ArbitrageOpportunity[]> {
  const url = new URL(`${API_BASE}/arbitrage`, window.location.origin);
  if (params?.minSpread) url.searchParams.set('minSpreadPercent', params.minSpread.toString());
  if (params?.limit) url.searchParams.set('limit', params.limit.toString());

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error('Failed to fetch arbitrage');
  const data = await res.json();
  return data.opportunities || [];
}

export async function fetchSignals(params?: {
  limit?: number;
  minEdge?: number;
}): Promise<Signal[]> {
  const url = new URL(`${API_BASE}/signals/latest`, window.location.origin);
  if (params?.limit) url.searchParams.set('limit', params.limit.toString());
  if (params?.minEdge) url.searchParams.set('min_edge', params.minEdge.toString());

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error('Failed to fetch signals');
  const data = await res.json();
  return data.signals || [];
}

export async function fetchHealth(): Promise<HealthStatus> {
  const res = await fetch(`${API_BASE}/health`);
  if (!res.ok) throw new Error('Health check failed');
  return res.json();
}

export async function fetchMetrics(): Promise<string> {
  const res = await fetch(`${API_BASE}/metrics`);
  if (!res.ok) throw new Error('Failed to fetch metrics');
  return res.text();
}

// Price History types
export interface PricePoint {
  week: string;
  avgPrice: number;
  avgPriceUsd: string;
  saleCount: number;
  minPrice: number;
  maxPrice: number;
}

export interface PriceHistory {
  sales: Array<{
    id: string;
    cardName: string;
    setName: string;
    grade: string;
    priceCents: number;
    priceUsd: string;
    soldAt: string;
    source: string;
  }>;
  stats: {
    count: number;
    avgPriceUsd: string;
    minPriceUsd: string;
    maxPriceUsd: string;
    medianPriceUsd: string;
  };
  trend: 'up' | 'down' | 'stable';
}

export interface PriceTrend {
  card: {
    name: string;
    set: string;
    grade: string;
  };
  stats: {
    totalSales: number;
    dataPoints: number;
  };
  trend: {
    direction: 'up' | 'down' | 'stable';
    strength: string;
    prediction: {
      nextWeekAvgPriceUsd: string;
      confidence: string;
    } | null;
  };
  weeklyData: PricePoint[];
}

export async function fetchPriceHistory(params: {
  cardName?: string;
  setName?: string;
  grade?: string;
  days?: number;
}): Promise<PriceHistory> {
  const url = new URL(`${API_BASE}/api/price-history`, window.location.origin);
  if (params.cardName) url.searchParams.set('cardName', params.cardName);
  if (params.setName) url.searchParams.set('setName', params.setName);
  if (params.grade) url.searchParams.set('grade', params.grade);
  if (params.days) url.searchParams.set('days', params.days.toString());

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error('Failed to fetch price history');
  return res.json();
}

export async function fetchPriceTrend(cardName: string, params?: {
  setName?: string;
  grade?: string;
}): Promise<PriceTrend> {
  const url = new URL(`${API_BASE}/api/price-history/trend`, window.location.origin);
  url.searchParams.set('cardName', cardName);
  if (params?.setName) url.searchParams.set('setName', params.setName);
  if (params?.grade) url.searchParams.set('grade', params.grade);

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error('Failed to fetch price trend');
  return res.json();
}

export interface TopMovers {
  topGainers: Array<{
    cardId: string;
    cardName: string;
    setName: string;
    salesCount: number;
    oldAvgPriceUsd: string;
    newAvgPriceUsd: string;
    changePercent: number;
  }>;
  topLosers: Array<{
    cardId: string;
    cardName: string;
    setName: string;
    salesCount: number;
    oldAvgPriceUsd: string;
    newAvgPriceUsd: string;
    changePercent: number;
  }>;
}

export async function fetchTopMovers(): Promise<TopMovers> {
  const res = await fetch(`${API_BASE}/api/price-history/top-movers`);
  if (!res.ok) throw new Error('Failed to fetch top movers');
  return res.json();
}

// Portfolio types
export interface PortfolioHolding {
  id: string;
  cardKey: string;
  cardName: string;
  setName: string | null;
  grade: string | null;
  quantity: number;
  costBasisCents: number;
  costBasisUsd: string;
  currentValueCents: number | null;
  currentValueUsd: string | null;
  gainLossCents: number | null;
  gainLossUsd: string | null;
  gainLossPct: string | null;
  purchaseDate: string;
  purchaseVenue: string | null;
}

export interface Portfolio {
  portfolio: {
    id: string;
    name: string;
  };
  holdings: PortfolioHolding[];
  summary: {
    totalHoldings: number;
    totalCostBasisUsd: string;
    totalCurrentValueUsd: string;
    totalGainLossUsd: string;
    totalGainLossPct: string;
  };
}

export async function fetchPortfolio(userId: string): Promise<Portfolio> {
  const res = await fetch(`${API_BASE}/api/portfolio/${userId}`);
  if (!res.ok) throw new Error('Failed to fetch portfolio');
  return res.json();
}

export async function addHolding(userId: string, holding: {
  cardKey: string;
  cardName: string;
  setName?: string;
  grade?: string;
  quantity?: number;
  costBasisCents: number;
  purchaseVenue?: string;
}): Promise<{ ok: boolean; holding: PortfolioHolding }> {
  const res = await fetch(`${API_BASE}/api/portfolio/${userId}/holdings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(holding),
  });
  if (!res.ok) throw new Error('Failed to add holding');
  return res.json();
}

// Market Summary
export interface MarketSummary {
  summary: {
    newListings24h: number;
    activeOpportunities: number;
    totalCards: number;
    lastUpdated: string;
  };
  topSources: Array<{ source: string; activeListings: number }>;
  topOpportunities: Array<{
    cardId: string;
    cardName: string;
    spreadPct: number;
  }>;
  marketSentiment: 'active' | 'moderate' | 'quiet';
}

export async function fetchMarketSummary(): Promise<MarketSummary> {
  const res = await fetch(`${API_BASE}/api/market/summary`);
  if (!res.ok) throw new Error('Failed to fetch market summary');
  return res.json();
}

export interface MarketCommentary {
  id: string;
  type: string;
  title: string;
  content: string;
  highlights: string[];
  sentiment: string;
  createdAt: string;
}

export async function fetchMarketCommentary(type?: string): Promise<MarketCommentary> {
  const url = new URL(`${API_BASE}/api/market/commentary`, window.location.origin);
  if (type) url.searchParams.set('type', type);
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error('Failed to fetch market commentary');
  return res.json();
}
