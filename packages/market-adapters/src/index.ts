// Main export file for market-adapters package
// Provides unified access to all marketplace adapters and utilities

import { MarketSource, MarketAdapter } from '@pokedao/market-core';

// Adapter imports
import * as ebay from './adapters/ebay/ingest';
import * as tcgplayer from './adapters/tcgplayer/ingest';
import * as fanatics from './adapters/fanatics/ingest';
import * as collectorcrypt from './adapters/collectorcrypt/ingest';

// Utility exports
export * from './normalize';
export * from './arbitrage';
export * from './pipeline';

// Cross-reference utilities
export * from './crossref/pokemon-tcg';

// Adapter registry
export const Adapters: Record<MarketSource, MarketAdapter> = {
  [MarketSource.EBAY]: ebay,
  [MarketSource.TCGPLAYER]: tcgplayer,
  [MarketSource.FANATICS]: fanatics,
  [MarketSource.COLLECTOR_CRYPT]: collectorcrypt,
  [MarketSource.MANUAL]: {
    SOURCE: MarketSource.MANUAL,
    ingest: async () => [],
    map: () => { throw new Error('Manual adapter not implemented'); },
    fees: () => 0
  },
  [MarketSource.CSV]: {
    SOURCE: MarketSource.CSV,
    ingest: async () => [],
    map: () => { throw new Error('CSV adapter not implemented'); },
    fees: () => 0
  }
};

// Adapter utilities
export function getAdapter(source: MarketSource): MarketAdapter {
  const adapter = Adapters[source];
  if (!adapter) {
    throw new Error(`No adapter found for source: ${source}`);
  }
  return adapter;
}

export function getAvailableAdapters(): MarketSource[] {
  return Object.keys(Adapters) as MarketSource[];
}

export function isAdapterAvailable(source: MarketSource): boolean {
  return source in Adapters;
}
