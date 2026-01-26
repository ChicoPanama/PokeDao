/**
 * PriceCharting API Client
 *
 * Fetches Pokemon card prices from PriceCharting.com
 * Requires paid subscription for API access.
 *
 * API Docs: https://www.pricecharting.com/api-documentation
 *
 * Note: PriceCharting uses cents for all prices.
 * Field mapping:
 *   loose-price     = Ungraded
 *   cib-price       = PSA 7 / 7.5
 *   new-price       = PSA 8 / 8.5
 *   graded-price    = PSA 9
 *   box-only-price  = PSA 9.5
 *   manual-only-price = PSA 10
 *   bgs-10-price    = BGS 10
 *   condition-17-price = CGC 10
 *   condition-18-price = SGC 10
 */

import { z } from 'zod';
import pino from 'pino';

const logger = pino({ name: 'pricecharting-client' });

// API Response Schemas
const ProductSchema = z.object({
  status: z.string(),
  id: z.string(),
  'product-name': z.string(),
  'console-name': z.string(),
  'loose-price': z.number().optional(),
  'cib-price': z.number().optional(),
  'new-price': z.number().optional(),
  'graded-price': z.number().optional(),
  'box-only-price': z.number().optional(),
  'manual-only-price': z.number().optional(),
  'bgs-10-price': z.number().optional(),
  'condition-17-price': z.number().optional(),
  'condition-18-price': z.number().optional(),
  'release-date': z.string().optional(),
  upc: z.string().optional(),
  asin: z.string().optional(),
  epid: z.string().optional(),
  genre: z.string().optional(),
  'sales-volume': z.number().optional(),
});

const ProductsResponseSchema = z.object({
  status: z.string(),
  products: z
    .array(
      z.object({
        id: z.string(),
        'product-name': z.string(),
        'console-name': z.string(),
      })
    )
    .optional(),
});

export type PriceChartingProduct = z.infer<typeof ProductSchema>;

export interface GradedPrice {
  grade: string;
  grader: string;
  priceCents: number;
}

export interface NormalizedCardPrice {
  priceChartingId: string;
  productName: string;
  consoleName: string;
  prices: GradedPrice[];
  releaseDate: string | null;
  salesVolume: number | null;
  upc: string | null;
  fetchedAt: Date;
}

export class PriceChartingClient {
  private baseUrl = 'https://www.pricecharting.com/api';
  private token: string;
  private requestCount = 0;
  private lastRequestTime = 0;
  private minRequestInterval = 500; // ms between requests

  constructor(token: string) {
    if (!token) {
      throw new Error('PriceCharting API token is required');
    }
    this.token = token;
  }

  private async throttle(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;
    if (elapsed < this.minRequestInterval) {
      await new Promise((resolve) =>
        setTimeout(resolve, this.minRequestInterval - elapsed)
      );
    }
    this.lastRequestTime = Date.now();
    this.requestCount++;
  }

  async getProductById(id: string): Promise<PriceChartingProduct | null> {
    await this.throttle();

    try {
      const url = `${this.baseUrl}/product?t=${this.token}&id=${id}`;
      const response = await fetch(url);
      const data = (await response.json()) as { status: string; 'error-message'?: string };

      if (data.status === 'error') {
        logger.warn({ id, error: data['error-message'] }, 'Product not found');
        return null;
      }

      return ProductSchema.parse(data);
    } catch (error) {
      logger.error({ id, error }, 'Failed to fetch product by ID');
      throw error;
    }
  }

  async getProductByUPC(upc: string): Promise<PriceChartingProduct | null> {
    await this.throttle();

    try {
      const url = `${this.baseUrl}/product?t=${this.token}&upc=${upc}`;
      const response = await fetch(url);
      const data = (await response.json()) as { status: string };

      if (data.status === 'error') {
        return null;
      }

      return ProductSchema.parse(data);
    } catch (error) {
      logger.error({ upc, error }, 'Failed to fetch product by UPC');
      throw error;
    }
  }

  async searchProduct(query: string): Promise<PriceChartingProduct | null> {
    await this.throttle();

    try {
      const url = `${this.baseUrl}/product?t=${this.token}&q=${encodeURIComponent(query)}`;
      const response = await fetch(url);
      const data = (await response.json()) as { status: string };

      if (data.status === 'error') {
        logger.debug({ query }, 'No product found for query');
        return null;
      }

      return ProductSchema.parse(data);
    } catch (error) {
      logger.error({ query, error }, 'Failed to search product');
      throw error;
    }
  }

  async searchProducts(
    query: string
  ): Promise<Array<{ id: string; name: string; console: string }>> {
    await this.throttle();

    try {
      const url = `${this.baseUrl}/products?t=${this.token}&q=${encodeURIComponent(query)}`;
      const response = await fetch(url);
      const data = await response.json();

      const parsed = ProductsResponseSchema.parse(data);

      if (parsed.status === 'error' || !parsed.products) {
        return [];
      }

      return parsed.products.map((p) => ({
        id: p.id,
        name: p['product-name'],
        console: p['console-name'],
      }));
    } catch (error) {
      logger.error({ query, error }, 'Failed to search products');
      throw error;
    }
  }

  /**
   * Normalize product response into a list of graded prices
   */
  normalizeProduct(product: PriceChartingProduct): NormalizedCardPrice {
    const prices: GradedPrice[] = [];

    // Map PriceCharting fields to standard grade names
    const gradeMapping: Array<{
      field: keyof PriceChartingProduct;
      grade: string;
      grader: string;
    }> = [
      { field: 'loose-price', grade: 'UNGRADED', grader: 'NONE' },
      { field: 'cib-price', grade: '7', grader: 'PSA' },
      { field: 'new-price', grade: '8', grader: 'PSA' },
      { field: 'graded-price', grade: '9', grader: 'PSA' },
      { field: 'box-only-price', grade: '9.5', grader: 'PSA' },
      { field: 'manual-only-price', grade: '10', grader: 'PSA' },
      { field: 'bgs-10-price', grade: '10', grader: 'BGS' },
      { field: 'condition-17-price', grade: '10', grader: 'CGC' },
      { field: 'condition-18-price', grade: '10', grader: 'SGC' },
    ];

    for (const mapping of gradeMapping) {
      const value = product[mapping.field] as number | undefined;
      if (value !== undefined && value > 0) {
        prices.push({
          grade: mapping.grade,
          grader: mapping.grader,
          priceCents: value, // Already in cents
        });
      }
    }

    return {
      priceChartingId: product.id,
      productName: product['product-name'],
      consoleName: product['console-name'],
      prices,
      releaseDate: product['release-date'] || null,
      salesVolume: product['sales-volume'] || null,
      upc: product.upc || null,
      fetchedAt: new Date(),
    };
  }

  getRequestCount(): number {
    return this.requestCount;
  }
}
