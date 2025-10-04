/**
 * Phygitals Data Ingestion
 *
 * Orchestrates collection of Pokemon card data from Phygitals marketplace
 */

import type { ActiveListing, CompSale } from '@pokedao/core';
import { createPhygitalsClient, type PhygitalsClient, type PhygitalsListing, type PhygitalsSale } from './client.js';
import {
  mapPhygitalsListingsToActiveListings,
  mapPhygitalsSalesToCompSales,
} from './mapper.js';

// ============================================================================
// INGESTION OPTIONS
// ============================================================================

export interface PhygitalsIngestionOptions {
  /**
   * Maximum number of pages to fetch (each page = ~100 items)
   * undefined = fetch all
   */
  maxPages?: number;

  /**
   * Items per page (default: 100, max recommended: 100)
   */
  itemsPerPage?: number;

  /**
   * Filter by grader (PSA, BGS, CGC, etc.)
   */
  grader?: string;

  /**
   * Filter by grade (10, 9.5, 9, etc.)
   */
  grade?: string;

  /**
   * Include sales history
   */
  includeSales?: boolean;

  /**
   * Maximum sales to fetch
   */
  maxSales?: number;

  /**
   * Progress callback
   */
  onProgress?: (current: number, total: number, type: 'listings' | 'sales') => void;

  /**
   * Custom client (for testing)
   */
  client?: PhygitalsClient;
}

export interface PhygitalsIngestionResult {
  listings: ActiveListing[];
  sales: CompSale[];
  metadata: {
    totalListings: number;
    totalSales: number;
    fetchedAt: Date;
    source: 'phygitals';
  };
}

// ============================================================================
// INGESTION
// ============================================================================

/**
 * Ingest Pokemon card data from Phygitals
 */
export async function ingestPhygitalsData(
  options: PhygitalsIngestionOptions = {}
): Promise<PhygitalsIngestionResult> {
  const client = options.client || createPhygitalsClient({
    requestsPerSecond: 2, // Respectful rate limiting
  });

  console.log('[Phygitals] Starting data ingestion...');

  // Fetch marketplace listings
  const rawListings = await client.getAllPokemonCards({
    maxPages: options.maxPages,
    itemsPerPage: options.itemsPerPage || 100,
    onProgress: (current, total) => {
      options.onProgress?.(current, total, 'listings');
    },
  });

  console.log(`[Phygitals] Fetched ${rawListings.length} raw listings`);

  // Filter by grader/grade if specified
  let filteredListings = rawListings;

  if (options.grader) {
    filteredListings = filteredListings.filter(
      listing => listing.grader?.toUpperCase().includes(options.grader!.toUpperCase())
    );
    console.log(`[Phygitals] Filtered to ${filteredListings.length} listings with grader: ${options.grader}`);
  }

  if (options.grade) {
    filteredListings = filteredListings.filter(
      listing => String(listing.grade) === String(options.grade)
    );
    console.log(`[Phygitals] Filtered to ${filteredListings.length} listings with grade: ${options.grade}`);
  }

  // Map to unified schema
  const listings = mapPhygitalsListingsToActiveListings(filteredListings);

  // Fetch sales history if requested
  let sales: CompSale[] = [];

  if (options.includeSales) {
    console.log('[Phygitals] Fetching sales history...');

    const maxSales = options.maxSales || 1000;
    const salesPerPage = 100;
    const maxPages = Math.ceil(maxSales / salesPerPage);

    const rawSales: PhygitalsSale[] = [];

    for (let page = 0; page < maxPages; page++) {
      const response = await client.getSalesData(salesPerPage, page);
      rawSales.push(...response.sales);

      options.onProgress?.(rawSales.length, response.total, 'sales');

      if (rawSales.length >= maxSales || response.sales.length === 0) {
        break;
      }
    }

    console.log(`[Phygitals] Fetched ${rawSales.length} sales records`);

    sales = mapPhygitalsSalesToCompSales(rawSales);
  }

  const result: PhygitalsIngestionResult = {
    listings,
    sales,
    metadata: {
      totalListings: listings.length,
      totalSales: sales.length,
      fetchedAt: new Date(),
      source: 'phygitals',
    },
  };

  console.log('[Phygitals] Ingestion complete');
  console.log(`  - Listings: ${listings.length}`);
  console.log(`  - Sales: ${sales.length}`);

  return result;
}

/**
 * Get available filters from Phygitals marketplace
 */
export async function getPhygitalsFilters() {
  const client = createPhygitalsClient();
  return client.getMarketplaceFilters();
}
