/**
 * TCGPlayer Active Listings Harvester
 *
 * Harvests ACTIVE listings from TCGPlayer using their official API
 *
 * TCGPlayer API:
 * - REST API with OAuth 2.0
 * - Category ID for Pokemon: 3
 * - Rate limit: 300 requests/minute
 *
 * API Docs: https://docs.tcgplayer.com/docs
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import fetch from 'node-fetch';
import { writeFileSync, existsSync, readFileSync } from 'fs';

// ============================================================================
// CONFIG
// ============================================================================

const TCGPLAYER_PUBLIC_KEY = process.env.TCGPLAYER_PUBLIC_KEY;
const TCGPLAYER_PRIVATE_KEY = process.env.TCGPLAYER_PRIVATE_KEY;
const POKEMON_CATEGORY_ID = 3;
const CHECKPOINT_FILE = 'data/tcgplayer-checkpoint.json';
const RATE_LIMIT_DELAY = 250; // 250ms = 240 req/min (safe under 300 limit)

// ============================================================================
// TCGPLAYER API CLIENT
// ============================================================================

class TCGPlayerAPI {
  private accessToken?: string;
  private tokenExpiry = 0;

  constructor(
    private publicKey: string,
    private privateKey: string
  ) {}

  /**
   * Get OAuth access token
   */
  private async getAccessToken(): Promise<string> {
    // Check if token is still valid
    if (this.accessToken && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    const url = 'https://api.tcgplayer.com/token';
    const params = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: this.publicKey,
      client_secret: this.privateKey,
    });

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    if (!response.ok) {
      throw new Error(`TCGPlayer OAuth error: ${response.statusText}`);
    }

    const data = await response.json() as any;
    this.accessToken = data.access_token;
    this.tokenExpiry = Date.now() + (data.expires_in * 1000) - 60000; // 1min buffer

    return this.accessToken!;
  }

  /**
   * Get all Pokemon TCG product groups (sets)
   */
  async getProductGroups(): Promise<any[]> {
    const token = await this.getAccessToken();
    const url = `https://api.tcgplayer.com/catalog/categories/${POKEMON_CATEGORY_ID}/groups`;

    await this.sleep(RATE_LIMIT_DELAY);

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`TCGPlayer API error: ${response.statusText}`);
    }

    const data = await response.json() as any;
    return data.results || [];
  }

  /**
   * Get products (cards) in a group
   */
  async getProducts(groupId: number, offset = 0, limit = 100): Promise<any> {
    const token = await this.getAccessToken();
    const url = `https://api.tcgplayer.com/catalog/products?categoryId=${POKEMON_CATEGORY_ID}&groupId=${groupId}&offset=${offset}&limit=${limit}&getExtendedFields=true`;

    await this.sleep(RATE_LIMIT_DELAY);

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`TCGPlayer API error: ${response.statusText}`);
    }

    return await response.json() as any;
  }

  /**
   * Get market prices for products
   */
  async getMarketPrices(productIds: number[]): Promise<any[]> {
    const token = await this.getAccessToken();
    const url = `https://api.tcgplayer.com/pricing/marketprices/${productIds.join(',')}`;

    await this.sleep(RATE_LIMIT_DELAY);

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`TCGPlayer API error: ${response.statusText}`);
    }

    const data = await response.json() as any;
    return data.results || [];
  }

  /**
   * Get product details with pricing
   */
  async getProductsWithPricing(groupId: number): Promise<any[]> {
    const products: any[] = [];
    let offset = 0;
    const limit = 100;

    while (true) {
      const response = await this.getProducts(groupId, offset, limit);
      const batch = response.results || [];

      if (batch.length === 0) break;

      // Get pricing for this batch
      const productIds = batch.map((p: any) => p.productId);
      const prices = await this.getMarketPrices(productIds);

      // Merge pricing data
      const priceMap = new Map(prices.map(p => [p.productId, p]));

      for (const product of batch) {
        const pricing = priceMap.get(product.productId);
        products.push({
          ...product,
          pricing,
        });
      }

      if (batch.length < limit) break;
      offset += limit;
    }

    return products;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ============================================================================
// CHECKPOINT
// ============================================================================

interface Checkpoint {
  lastGroupId: number;
  processedGroups: number;
  totalProducts: number;
  startedAt: string;
  updatedAt: string;
}

function loadCheckpoint(): Checkpoint | null {
  if (existsSync(CHECKPOINT_FILE)) {
    return JSON.parse(readFileSync(CHECKPOINT_FILE, 'utf8'));
  }
  return null;
}

function saveCheckpoint(checkpoint: Checkpoint): void {
  checkpoint.updatedAt = new Date().toISOString();
  writeFileSync(CHECKPOINT_FILE, JSON.stringify(checkpoint, null, 2));
}

// ============================================================================
// MAIN HARVESTER
// ============================================================================

async function main() {
  if (!TCGPLAYER_PUBLIC_KEY || !TCGPLAYER_PRIVATE_KEY) {
    console.error('❌ TCGPlayer API keys not configured');
    console.error('   Set TCGPLAYER_PUBLIC_KEY and TCGPLAYER_PRIVATE_KEY in .env');
    process.exit(1);
  }

  console.log('🔄 TCGPLAYER ACTIVE LISTINGS HARVESTER');
  console.log('='.repeat(60));

  const prisma = new PrismaClient();
  const api = new TCGPlayerAPI(TCGPLAYER_PUBLIC_KEY, TCGPLAYER_PRIVATE_KEY);

  let checkpoint = loadCheckpoint();
  if (!checkpoint) {
    checkpoint = {
      lastGroupId: 0,
      processedGroups: 0,
      totalProducts: 0,
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  console.log(`📍 Checkpoint: ${checkpoint.processedGroups} groups, ${checkpoint.totalProducts} products\n`);

  // Get all Pokemon TCG groups (sets)
  console.log('📦 Fetching Pokemon TCG sets...');
  const groups = await api.getProductGroups();
  console.log(`   Found ${groups.length} sets\n`);

  // Process each group
  for (const group of groups) {
    // Skip already processed groups
    if (group.groupId <= checkpoint.lastGroupId) {
      continue;
    }

    console.log(`\n🎴 Processing: ${group.name} (ID: ${group.groupId})`);

    try {
      const products = await api.getProductsWithPricing(group.groupId);
      console.log(`   Found ${products.length} products`);

      let savedCount = 0;

      for (const product of products) {
        // Only save products with market pricing
        if (!product.pricing || !product.pricing.price) {
          continue;
        }

        const priceCents = Math.round(product.pricing.price * 100);

        // Save to database
        await prisma.unifiedMarketListing.upsert({
          where: {
            source_sourceId: {
              source: 'TCGPLAYER_ACTIVE',
              sourceId: String(product.productId),
            },
          },
          create: {
            source: 'TCGPLAYER_ACTIVE',
            sourceId: String(product.productId),
            title: product.name.substring(0, 500),
            rawTitle: product.name.substring(0, 500),
            cardName: product.name.substring(0, 255),
            setName: group.name.substring(0, 255),
            cardNumber: product.extendedData?.find((d: any) => d.name === 'Number')?.value?.substring(0, 10),
            variant: product.extendedData?.find((d: any) => d.name === 'Rarity')?.value?.substring(0, 100),
            priceCents,
            currency: 'USD',
            url: product.url?.substring(0, 500),
            dataQuality: 0.95, // TCGPlayer data is high quality
          },
          update: {
            priceCents,
            updatedAt: new Date(),
          },
        });

        savedCount++;
      }

      console.log(`   ✅ Saved ${savedCount} active listings`);

      checkpoint.lastGroupId = group.groupId;
      checkpoint.processedGroups++;
      checkpoint.totalProducts += savedCount;
      saveCheckpoint(checkpoint);

    } catch (error: any) {
      console.error(`   ❌ Error: ${error.message}`);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('✅ HARVEST COMPLETE');
  console.log('='.repeat(60));
  console.log(`📦 Sets Processed: ${checkpoint.processedGroups}`);
  console.log(`🎴 Products Saved: ${checkpoint.totalProducts}`);
  console.log('='.repeat(60));

  await prisma.$disconnect();
}

main().catch(console.error);
