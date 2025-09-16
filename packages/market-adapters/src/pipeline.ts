// Unified pipeline orchestrator
// Coordinates the entire market data processing pipeline across all sources

import { 
  MarketSource, 
  CanonicalListing, 
  ArbitrageOpportunity,
  PipelineOptions, 
  PipelineResults,
  CollectionSlug,
  PipelineMode
} from '@pokedao/market-core';
import { 
  getAdapter, 
  getAvailableAdapters 
} from './index';
import { normalizeListing, assessDataQuality } from './normalize';
import { batchDetectArbitrageOpportunities } from './arbitrage';
import { batchCrossReference } from './crossref/pokemon-tcg';
import { 
  createLogger, 
  logPipelineStart, 
  logPipelineComplete, 
  logPipelineError,
  logAdapterOperation,
  logBatchProcessing,
  logDataQuality,
  logArbitrageOpportunities
} from '@pokedao/market-core/src/logger';
import { 
  processInBatches, 
  createPerformanceTimer 
} from '@pokedao/market-core/src/batching';
import { 
  MarketPipelineError,
  AdapterError 
} from '@pokedao/market-core/src/errors';

// Pipeline stage results
interface PipelineStageResults {
  listings: CanonicalListing[];
  crossReferences: Map<string, any>;
  opportunities: ArbitrageOpportunity[];
  collections: Map<CollectionSlug, ArbitrageOpportunity[]>;
  statistics: any;
}

// Pipeline configuration
interface PipelineConfig {
  batchSize: number;
  concurrency: number;
  enableCrossReference: boolean;
  enableCollections: boolean;
  logLevel: string;
}

/**
 * Run the complete market pipeline
 */
export async function runPipeline(options: PipelineOptions): Promise<PipelineResults> {
  const logger = createLogger({ level: 'info' });
  const startTime = new Date();
  
  try {
    logPipelineStart(logger, {
      sources: options.sources.join(','),
      mode: options.mode || 'default',
      limit: options.limit,
      dryRun: options.dryRun
    });
    
    // Validate options
    validatePipelineOptions(options);
    
    // Initialize pipeline configuration
    const config: PipelineConfig = {
      batchSize: 1000,
      concurrency: 5,
      enableCrossReference: true,
      enableCollections: true,
      logLevel: 'info'
    };
    
    // Stage 1: Ingest data from all sources
    const stage1Results = await runIngestionStage(options, config, logger);
    
    // Stage 2: Normalize and clean data
    const stage2Results = await runNormalizationStage(stage1Results, config, logger);
    
    // Stage 3: Cross-reference with external APIs
    const stage3Results = await runCrossReferenceStage(stage2Results, config, logger);
    
    // Stage 4: Detect arbitrage opportunities
    const stage4Results = await runArbitrageStage(stage3Results, options, config, logger);
    
    // Stage 5: Generate collections and reports
    const finalResults = await runCollectionStage(stage4Results, options, config, logger);
    
    const endTime = new Date();
    const duration = endTime.getTime() - startTime.getTime();
    
    // Compile final results
    const results: PipelineResults = {
      startTime,
      endTime,
      duration,
      sources: finalResults.statistics.sources,
      collections: finalResults.statistics.collections,
      global: finalResults.statistics.global
    };
    
    logPipelineComplete(logger, {
      duration,
      totalListings: finalResults.listings.length,
      totalOpportunities: finalResults.opportunities.length,
      totalProfit: finalResults.statistics.global.totalProfitPotential
    });
    
    return results;
    
  } catch (error) {
    logPipelineError(logger, error as Error, {
      sources: options.sources.join(','),
      mode: options.mode || 'default'
    });
    throw error;
  }
}

/**
 * Stage 1: Ingest data from all sources
 */
async function runIngestionStage(
  options: PipelineOptions,
  config: PipelineConfig,
  logger: any
): Promise<PipelineStageResults> {
  const timer = createPerformanceTimer(logger, 'ingestion');
  
  logAdapterOperation(logger, 'pipeline', 'ingestion_start', {
    sources: options.sources.join(',')
  });
  
  const allListings: CanonicalListing[] = [];
  const sourceStats: any = {};
  
  // Process each source
  for (const source of options.sources) {
    try {
      const adapter = getAdapter(source);
      
      logAdapterOperation(logger, source, 'ingest', {
        since: options.since?.toISOString(),
        limit: options.limit
      });
      
      // Ingest raw data
      const rawData = await adapter.ingest({
        since: options.since,
        limit: options.limit
      });
      
      // Map to canonical format
      const listings = rawData.map(item => adapter.map(item));
      
      // Track statistics
      sourceStats[source] = {
        recordsProcessed: rawData.length,
        recordsCleaned: listings.length,
        recordsMatched: 0, // Will be updated in cross-reference stage
        opportunitiesFound: 0, // Will be updated in arbitrage stage
        errors: 0
      };
      
      allListings.push(...listings);
      
      logAdapterOperation(logger, source, 'ingest_complete', {
        recordsProcessed: rawData.length,
        listingsGenerated: listings.length
      });
      
    } catch (error) {
      logger.error({
        source,
        operation: 'ingestion_error',
        error: error instanceof Error ? error.message : String(error)
      }, `Failed to ingest data from ${source}`);
      
      sourceStats[source] = {
        recordsProcessed: 0,
        recordsCleaned: 0,
        recordsMatched: 0,
        opportunitiesFound: 0,
        errors: 1
      };
    }
  }
  
  const duration = timer.end();
  
  logger.info({
    operation: 'ingestion_complete',
    duration,
    totalListings: allListings.length,
    sourceStats
  }, 'Data ingestion completed');
  
  return {
    listings: allListings,
    crossReferences: new Map(),
    opportunities: [],
    collections: new Map(),
    statistics: { sources: sourceStats }
  };
}

/**
 * Stage 2: Normalize and clean data
 */
async function runNormalizationStage(
  previousResults: PipelineStageResults,
  config: PipelineConfig,
  logger: any
): Promise<PipelineStageResults> {
  const timer = createPerformanceTimer(logger, 'normalization');
  
  logger.info({
    operation: 'normalization_start',
    totalListings: previousResults.listings.length
  }, 'Starting data normalization');
  
  // Normalize listings in batches
  const normalizedListings = await processInBatches(
    previousResults.listings,
    async (batch) => batch.map(listing => normalizeListing(listing)),
    config.batchSize,
    {
      onProgress: (processed, total) => {
        logBatchProcessing(logger, 'normalization', processed, total);
      }
    }
  );
  
  // Assess data quality
  const qualityAssessment = assessDataQuality(normalizedListings);
  
  logDataQuality(logger, {
    totalRecords: normalizedListings.length,
    validRecords: normalizedListings.filter(l => (l.dataQualityScore || 0) > 0.5).length,
    invalidRecords: normalizedListings.filter(l => (l.dataQualityScore || 0) <= 0.5).length,
    averageQuality: qualityAssessment.overallScore,
    issues: qualityAssessment.issues
  });
  
  const duration = timer.end();
  
  logger.info({
    operation: 'normalization_complete',
    duration,
    totalListings: normalizedListings.length,
    averageQuality: qualityAssessment.overallScore
  }, 'Data normalization completed');
  
  return {
    ...previousResults,
    listings: normalizedListings,
    statistics: {
      ...previousResults.statistics,
      quality: qualityAssessment
    }
  };
}

/**
 * Stage 3: Cross-reference with external APIs
 */
async function runCrossReferenceStage(
  previousResults: PipelineStageResults,
  config: PipelineConfig,
  logger: any
): Promise<PipelineStageResults> {
  if (!config.enableCrossReference) {
    return previousResults;
  }
  
  const timer = createPerformanceTimer(logger, 'cross_reference');
  
  logger.info({
    operation: 'cross_reference_start',
    totalListings: previousResults.listings.length
  }, 'Starting cross-reference matching');
  
  // Filter high-quality listings for cross-reference
  const highQualityListings = previousResults.listings.filter(
    listing => (listing.dataQualityScore || 0) > 0.5
  );
  
  // Cross-reference with Pokemon TCG API
  const crossReferences = await batchCrossReference(highQualityListings, {
    concurrency: config.concurrency,
    useCache: true
  });
  
  // Update source statistics with cross-reference results
  const updatedSourceStats = { ...previousResults.statistics.sources };
  for (const [listingId, crossRefData] of crossReferences) {
    const listing = previousResults.listings.find(l => l.id === listingId);
    if (listing && crossRefData.matchType !== 'none') {
      updatedSourceStats[listing.source].recordsMatched++;
    }
  }
  
  const duration = timer.end();
  
  logger.info({
    operation: 'cross_reference_complete',
    duration,
    totalListings: highQualityListings.length,
    matchesFound: Array.from(crossReferences.values()).filter(cr => cr.matchType !== 'none').length
  }, 'Cross-reference matching completed');
  
  return {
    ...previousResults,
    crossReferences,
    statistics: {
      ...previousResults.statistics,
      sources: updatedSourceStats
    }
  };
}

/**
 * Stage 4: Detect arbitrage opportunities
 */
async function runArbitrageStage(
  previousResults: PipelineStageResults,
  options: PipelineOptions,
  config: PipelineConfig,
  logger: any
): Promise<PipelineStageResults> {
  const timer = createPerformanceTimer(logger, 'arbitrage');
  
  logger.info({
    operation: 'arbitrage_start',
    totalListings: previousResults.listings.length,
    mode: options.mode
  }, 'Starting arbitrage detection');
  
  // Prepare arbitrage contexts
  const arbitrageContexts = new Map<string, any>();
  
  for (const listing of previousResults.listings) {
    const crossRefData = previousResults.crossReferences.get(listing.id);
    
    // Determine expected resale price
    let expectedResalePrice = listing.price; // Default to current price
    
    if (crossRefData?.tcgPlayerData?.marketPrice) {
      expectedResalePrice = Math.round(crossRefData.tcgPlayerData.marketPrice * 100); // Convert to cents
    } else if (crossRefData?.tcgPlayerData?.midPrice) {
      expectedResalePrice = Math.round(crossRefData.tcgPlayerData.midPrice * 100);
    }
    
    arbitrageContexts.set(listing.id, {
      expectedResalePrice,
      crossReferenceData: crossRefData,
      marketPrices: crossRefData?.tcgPlayerData ? [
        crossRefData.tcgPlayerData.marketPrice,
        crossRefData.tcgPlayerData.lowPrice,
        crossRefData.tcgPlayerData.highPrice
      ].filter(Boolean) : undefined
    });
  }
  
  // Detect arbitrage opportunities
  const opportunities = batchDetectArbitrageOpportunities(
    previousResults.listings,
    arbitrageContexts,
    options.mode as PipelineMode || 'default'
  );
  
  // Update source statistics
  const updatedSourceStats = { ...previousResults.statistics.sources };
  for (const opportunity of opportunities) {
    const listing = previousResults.listings.find(l => l.id === opportunity.canonicalId);
    if (listing) {
      updatedSourceStats[listing.source].opportunitiesFound++;
    }
  }
  
  logArbitrageOpportunities(logger, {
    total: opportunities.length,
    highConfidence: opportunities.filter(o => o.confidence >= 0.8).length,
    totalProfit: opportunities.reduce((sum, o) => sum + o.netProfit, 0),
    averageMargin: opportunities.length > 0 
      ? opportunities.reduce((sum, o) => sum + o.marginPct, 0) / opportunities.length 
      : 0,
    riskDistribution: opportunities.reduce((acc, o) => {
      acc[o.risk.toLowerCase()] = (acc[o.risk.toLowerCase()] || 0) + 1;
      return acc;
    }, {} as Record<string, number>)
  });
  
  const duration = timer.end();
  
  logger.info({
    operation: 'arbitrage_complete',
    duration,
    totalOpportunities: opportunities.length
  }, 'Arbitrage detection completed');
  
  return {
    ...previousResults,
    opportunities,
    statistics: {
      ...previousResults.statistics,
      sources: updatedSourceStats
    }
  };
}

/**
 * Stage 5: Generate collections and reports
 */
async function runCollectionStage(
  previousResults: PipelineStageResults,
  options: PipelineOptions,
  config: PipelineConfig,
  logger: any
): Promise<PipelineStageResults> {
  if (!config.enableCollections || !options.collectionSlugs) {
    return previousResults;
  }
  
  const timer = createPerformanceTimer(logger, 'collections');
  
  logger.info({
    operation: 'collections_start',
    totalOpportunities: previousResults.opportunities.length,
    collections: options.collectionSlugs.join(',')
  }, 'Starting collection processing');
  
  // Group opportunities by collections
  const collections = new Map<CollectionSlug, ArbitrageOpportunity[]>();
  
  for (const collectionSlug of options.collectionSlugs) {
    const collectionOpportunities = previousResults.opportunities.filter(
      opp => opp.collectionTags.includes(collectionSlug)
    );
    
    collections.set(collectionSlug, collectionOpportunities);
    
    logger.info({
      operation: 'collection_processed',
      collectionSlug,
      opportunities: collectionOpportunities.length
    }, `Collection ${collectionSlug} processed`);
  }
  
  // Calculate global statistics
  const globalStats = {
    totalListings: previousResults.listings.length,
    totalOpportunities: previousResults.opportunities.length,
    avgProfitMargin: previousResults.opportunities.length > 0
      ? previousResults.opportunities.reduce((sum, o) => sum + o.marginPct, 0) / previousResults.opportunities.length
      : 0,
    totalProfitPotential: previousResults.opportunities.reduce((sum, o) => sum + o.netProfit, 0)
  };
  
  // Calculate collection statistics
  const collectionStats: any = {};
  for (const [collectionSlug, opportunities] of collections) {
    collectionStats[collectionSlug] = {
      totalListings: previousResults.listings.filter(l => 
        opportunities.some(o => o.canonicalId === l.id)
      ).length,
      opportunitiesFound: opportunities.length,
      avgProfitMargin: opportunities.length > 0
        ? opportunities.reduce((sum, o) => sum + o.marginPct, 0) / opportunities.length
        : 0,
      topOpportunities: opportunities
        .sort((a, b) => b.netProfit - a.netProfit)
        .slice(0, 10)
    };
  }
  
  const duration = timer.end();
  
  logger.info({
    operation: 'collections_complete',
    duration,
    totalCollections: collections.size
  }, 'Collection processing completed');
  
  return {
    ...previousResults,
    collections,
    statistics: {
      ...previousResults.statistics,
      collections: collectionStats,
      global: globalStats
    }
  };
}

/**
 * Validate pipeline options
 */
function validatePipelineOptions(options: PipelineOptions): void {
  if (!options.sources || options.sources.length === 0) {
    throw new MarketPipelineError('No sources specified');
  }
  
  const availableAdapters = getAvailableAdapters();
  const invalidSources = options.sources.filter(source => !availableAdapters.includes(source));
  
  if (invalidSources.length > 0) {
    throw new MarketPipelineError(`Invalid sources: ${invalidSources.join(', ')}`);
  }
  
  if (options.limit && options.limit <= 0) {
    throw new MarketPipelineError('Limit must be positive');
  }
  
  if (options.collectionSlugs) {
    for (const slug of options.collectionSlugs) {
      if (!/^[a-z0-9-]+$/.test(slug)) {
        throw new MarketPipelineError(`Invalid collection slug: ${slug}`);
      }
    }
  }
}

/**
 * Run pipeline for specific sources only
 */
export async function runSourcePipeline(
  sources: MarketSource[],
  options: Omit<PipelineOptions, 'sources'> = {}
): Promise<PipelineResults> {
  return runPipeline({
    ...options,
    sources
  });
}

/**
 * Run pipeline for specific collections only
 */
export async function runCollectionPipeline(
  collectionSlugs: CollectionSlug[],
  options: Omit<PipelineOptions, 'collectionSlugs'> = {}
): Promise<PipelineResults> {
  return runPipeline({
    ...options,
    collectionSlugs
  });
}

/**
 * Get pipeline status
 */
export function getPipelineStatus(): {
  availableSources: MarketSource[];
  defaultOptions: Partial<PipelineOptions>;
} {
  return {
    availableSources: getAvailableAdapters(),
    defaultOptions: {
      mode: 'default',
      batchSize: 1000,
      concurrency: 5,
      enableCrossReference: true,
      enableCollections: true
    }
  };
}
