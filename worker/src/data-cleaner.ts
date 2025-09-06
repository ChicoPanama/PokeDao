import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

interface CleanCard {
  id: string;
  name: string;
  year: number;
  grade: string;
  gradingCompany: string;
  price: number;
  currency: string;
  priceUSD: number;
  category: string;
  nftAddress: string;
  url: string;
}

class DataCleaner {
  cleanDataset(rawCards: any[]): CleanCard[] {
    console.log("Cleaning dataset...");
    console.log(`Starting with ${rawCards.length} total cards`);

    // Step 1: Filter cards with valid prices
    const cardsWithPrices = rawCards.filter((card) => {
      const listing = card.listing || {};
      const price = listing.price || 0;
      return price > 0;
    });

    console.log(`Cards with prices: ${cardsWithPrices.length}`);

    // Step 2: Remove obvious meme/joke pricing
    const realisticCards = cardsWithPrices.filter((card) => {
      const listing = card.listing || {};
      const price = listing.price || 0;
      const currency = listing.currency || "USDC";
      const priceUSD = currency === "SOL" ? price * 140 : price;

      // Filter criteria for realistic investment cards
      return priceUSD >= 10; // Minimum $10
    });

    console.log(`Realistic cards: ${realisticCards.length}`);

    // Step 3: Process into clean format
    const cleanCards: CleanCard[] = realisticCards.map((card) => {
      const listing = card.listing || {};
      const price = listing.price || 0;
      const currency = listing.currency || "USDC";
      const priceUSD = currency === "SOL" ? price * 140 : price;

      return {
        id: card.id || "",
        name: card.name || "",
        year: card.year || 0,
        grade: card.grade || "",
        gradingCompany: card.gradingCompany || "",
        price,
        currency,
        priceUSD,
        category: card.category || "",
        nftAddress: card.nftAddress || "",
        url: `https://collectorcrypt.com/assets/solana/${card.nftAddress}`,
      };
    });

    return cleanCards.sort((a, b) => b.priceUSD - a.priceUSD);
  }

  analyzeCleanData(cards: CleanCard[]) {
    console.log("\n=== CLEAN DATASET ANALYSIS ===");

    // Price analysis
    const prices = cards.map((c) => c.priceUSD);
    const avgPrice = prices.reduce((sum, p) => sum + p, 0) / prices.length;
    const medianPrice = prices.sort((a, b) => a - b)[Math.floor(prices.length / 2)];
    const maxPrice = Math.max(...prices);
    const minPrice = Math.min(...prices);

    console.log(`Total Clean Cards: ${cards.length}`);
    console.log(`Average Price: $${avgPrice.toFixed(2)}`);
    console.log(`Median Price: $${medianPrice.toFixed(2)}`);
    console.log(`Price Range: $${minPrice} - $${maxPrice}`);
  }
}

// Load the data (assuming we have it from previous scraping)
async function loadAndCleanData() {
  try {
    // If you saved the raw data, load it here
    // For now, lets run a quick API call to get current data
    const response = await axios.get("https://api.collectorcrypt.com/marketplace", {
      params: { page: 1, step: 96, cardType: "Card", orderBy: "listedPriceDesc" },
      headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" }
    });

    const rawCards = response.data.filterNFtCard || [];

    const cleaner = new DataCleaner();
    const cleanCards = cleaner.cleanDataset(rawCards);
    cleaner.analyzeCleanData(cleanCards);

    return cleanCards;
  } catch (error) {
    console.error("Error loading data:", error);
    return [];
  }
}

console.log("PokeDAO Data Cleaner starting...");
loadAndCleanData();
