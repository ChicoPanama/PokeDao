import fs from 'fs';
import axios from 'axios';

interface MarketData {
  cardName: string;
  currentMarketPrice: number;
  priceHistory: {
    recent: number[];
    yearOverYear: { [year: string]: number };
    trend: 'rising' | 'falling' | 'stable';
  };
  purchaseOptions: {
    lowestPrice: number;
    seller: string;
    link: string;
    condition: string;
  }[];
  recentSales: {
    price: number;
    date: string;
    platform: string;
  }[];
  cardHistory: string;
  lastScanned: string;
}

class EnhancedMarketCollector {
  private scannedCards: Set<string> = new Set();
  private cacheFile = 'scanned-cards-cache.json';

  constructor() {
    this.loadCache();
  }

  async getMarketData(cardName: string): Promise<MarketData | null> {
    const cachedData = this.loadFromCache(cardName);
    if (cachedData) return cachedData;

    const marketData: MarketData = {
      cardName,
      currentMarketPrice: 0,
      priceHistory: await this.getPriceHistory(cardName),
      purchaseOptions: await this.getPurchaseOptions(cardName),
      recentSales: await this.getRecentSales(cardName),
      cardHistory: await this.getCardHistory(cardName),
      lastScanned: new Date().toISOString(),
    };

    this.scannedCards.add(cardName);
    this.saveToCache(cardName, marketData);

    return marketData;
  }

  private async getPriceHistory(cardName: string) {
    const basePrice = 500 + Math.random() * 2000;
    const years = ['2020', '2021', '2022', '2023', '2024'];
    const yearOverYear: { [year: string]: number } = {};

    years.forEach((year, i) => {
      yearOverYear[year] = basePrice * (1 + i * 0.15 + (Math.random() * 0.3 - 0.15));
    });

    return {
      recent: [basePrice * 0.9, basePrice * 1.1, basePrice],
      yearOverYear,
      trend: 'rising' as const,
    };
  }

  private async getPurchaseOptions(cardName: string) {
    return [
      {
        lowestPrice: 100,
        seller: 'Seller A',
        link: 'https://example.com',
        condition: 'Mint',
      },
    ];
  }

  private async getRecentSales(cardName: string) {
    return [
      {
        price: 900,
        date: new Date().toISOString(),
        platform: 'eBay',
      },
    ];
  }

  private async getCardHistory(cardName: string): Promise<string> {
    return `History of ${cardName}`;
  }

  private loadCache() {
    try {
      if (fs.existsSync(this.cacheFile)) {
        const cache = JSON.parse(fs.readFileSync(this.cacheFile, 'utf8'));
        this.scannedCards = new Set(cache.scannedCards || []);
      }
    } catch (error) {
      console.log('Cache file not found, starting fresh');
    }
  }

  private saveToCache(cardName: string, data: MarketData) {
    try {
      let cache: any = {};
      if (fs.existsSync(this.cacheFile)) {
        cache = JSON.parse(fs.readFileSync(this.cacheFile, 'utf8'));
      }

      cache.scannedCards = Array.from(this.scannedCards);
      cache.marketData = cache.marketData || {};
      cache.marketData[cardName] = data;

      fs.writeFileSync(this.cacheFile, JSON.stringify(cache, null, 2));
    } catch (error) {
      console.error('Failed to save cache:', error);
    }
  }

  private loadFromCache(cardName: string): MarketData | null {
    try {
      if (fs.existsSync(this.cacheFile)) {
        const cache = JSON.parse(fs.readFileSync(this.cacheFile, 'utf8'));
        return cache.marketData?.[cardName] || null;
      }
    } catch (error) {
      return null;
    }
    return null;
  }
}

export { EnhancedMarketCollector, type MarketData };
