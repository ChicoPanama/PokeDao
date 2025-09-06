export interface CardData {
  name: string;
  set: string;
  number?: string;
  grade?: string;
  grader?: string;
  language: string;
  isHolo: boolean;
  isFirstEdition: boolean;
  isShadowless: boolean;
}

export interface PriceSource {
  source: string;
  price: number;
  confidence: number;
  timestamp: Date;
  grade?: string;
}

export interface LowestPrice {
  price: number;
  source: string;
  link: string;
}

export interface MarketTrend {
  direction: 'up' | 'down' | 'stable';
  strength: number;
  timeframe: string;
}

export interface InvestmentRecommendation {
  action: 'BUY' | 'HOLD' | 'SELL' | 'PASS';
  confidence: number;
  reasoning: string;
  targetPrice?: number;
}
