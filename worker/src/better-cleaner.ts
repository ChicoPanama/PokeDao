import axios from "axios";

interface Card {
  listing: {
    price: number;
    currency: string;
  };
  category: string;
  itemName: string;
}

class BetterDataCleaner {
  private async fetchCards(page: number): Promise<Card[]> {
    try {
      const response = await axios.get("https://api.collectorcrypt.com/marketplace", {
        params: {
          page,
          step: 96,
          cardType: "Card",
          orderBy: "listedPriceAsc",
        },
        headers: {
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        },
      });
      return response.data.filterNFtCard || [];
    } catch (error) {
      console.error(`Error fetching cards for page ${page}:`, error);
      return [];
    }
  }

  private filterRealisticCards(cards: Card[]): Card[] {
    return cards.filter((card) => {
      const price = card.listing?.price || 0;
      const currency = card.listing?.currency || "USDC";
      const priceUSD = currency === "SOL" ? price * 140 : price;

      return (
        price > 0 &&
        priceUSD >= 15 &&
        priceUSD <= 10000 &&
        card.category === "Pokemon" &&
        card.itemName &&
        !card.itemName.includes("ENERGY REMOVAL")
      );
    });
  }

  private analyzePrices(cards: Card[]): number[] {
    return cards
      .map((card) => {
        const price = card.listing?.price || 0;
        const currency = card.listing?.currency || "USDC";
        return currency === "SOL" ? price * 140 : price;
      })
      .sort((a, b) => a - b);
  }

  private categorizeTiers(prices: number[]): Record<string, number> {
    return {
      "Budget ($15-$50)": prices.filter((p) => p >= 15 && p < 50).length,
      "Entry ($50-$150)": prices.filter((p) => p >= 50 && p < 150).length,
      "Mid ($150-$400)": prices.filter((p) => p >= 150 && p < 400).length,
      "High ($400-$1000)": prices.filter((p) => p >= 400 && p < 1000).length,
      "Premium ($1000+)": prices.filter((p) => p >= 1000).length,
    };
  }

  private logPriceDistribution(prices: number[]): void {
    console.log("\nPrice Distribution:");
    console.log(`Min: $${prices[0]?.toFixed(2)}`);
    console.log(`25th percentile: $${prices[Math.floor(prices.length * 0.25)]?.toFixed(2)}`);
    console.log(`Median: $${prices[Math.floor(prices.length * 0.5)]?.toFixed(2)}`);
    console.log(`75th percentile: $${prices[Math.floor(prices.length * 0.75)]?.toFixed(2)}`);
    console.log(`Max: $${prices[prices.length - 1]?.toFixed(2)}`);
  }

  private logSampleCards(cards: Card[], tier: string, min: number, max: number): void {
    const sample = cards
      .filter((card) => {
        const price = card.listing?.price || 0;
        const currency = card.listing?.currency || "USDC";
        const priceUSD = currency === "SOL" ? price * 140 : price;
        return priceUSD >= min && priceUSD < max;
      })
      .slice(0, 3);

    sample.forEach((card) => {
      const price = card.listing?.price || 0;
      const currency = card.listing?.currency || "USDC";
      const priceUSD = currency === "SOL" ? price * 140 : price;
      console.log(`${tier}: $${priceUSD.toFixed(0)} - ${card.itemName.substring(0, 60)}`);
    });
  }

  public async getMoreRealisticSample(): Promise<Card[]> {
    try {
      console.log("Getting broader sample of realistic cards...");

      let allCards: Card[] = [];
      for (let page = 1; page <= 10; page++) {
        const pageCards = await this.fetchCards(page);
        allCards = allCards.concat(pageCards);
        console.log(`Page ${page}: ${pageCards.length} cards`);
      }

      console.log(`Total sample: ${allCards.length} cards`);

      const realisticCards = this.filterRealisticCards(allCards);
      console.log(`Realistic cards: ${realisticCards.length}`);

      const prices = this.analyzePrices(realisticCards);
      this.logPriceDistribution(prices);

      const tiers = this.categorizeTiers(prices);
      console.log("\nBetter Investment Tiers:");
      Object.entries(tiers).forEach(([tier, count]) => {
        console.log(`  ${tier}: ${count}`);
      });

      console.log("\nSample cards from each tier:");
      this.logSampleCards(realisticCards, "Budget", 15, 50);

      return realisticCards;
    } catch (error) {
      console.error("Error:", error);
      return [];
    }
  }
}

const cleaner = new BetterDataCleaner();
cleaner.getMoreRealisticSample();
