nano src/types/interfaces.tsexport interface APIConfig {
  name: string;
  baseURL: string;
  apiKey?: string;
  rateLimit: number; // requests per minute
  timeout: number;
  retryAttempts: number;
}

export interface PriceSource {
  source: string;
  price: number;
  confidence: number;
  timestamp: Date;
  grade?: string;
  condition?: string;
}

export interface CardData {
  name: string;
  set: string;
  number?: string;
  grade?: string;
  condition: string;
  language: 'English' | 'Japanese';
  isFirstEdition?: boolean;
  isHolo?: boolean;
}

export interface CardAnalysis {
  card: CardData;
  pricing: {
    listedPrice: number;
    marketValue: number;
    confidence: number;
    sources: PriceSource[];
    gradedPremium?: number;
  };
  assessment: 'UNDERVALUED' | 'FAIRLY_VALUED' | 'OVERVALUED';
  recommendation: 'STRONG_BUY' | 'BUY' | 'HOLD' | 'PASS' | 'AVOID';
  reasoning: string;
  trend: 'RISING' | 'STABLE' | 'DECLINING';
  investmentThesis: string;
  lastTwoSales: { price: number; date: string; platform: string }[];
}

export interface SearchStrategy {
  primary: string;
  fallbacks: string[];
  fuzzy?: string[];
}
