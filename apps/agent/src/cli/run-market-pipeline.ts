#!/usr/bin/env ts-node

// CLI interface for the unified market pipeline
// Provides command-line access to all pipeline functionality

import { runPipeline } from '@pokedao/market-adapters/src/pipeline';
import { MarketSource } from '@pokedao/market-core/src/types';
import { generateReportDirectory } from '@pokedao/market-core/src/reports';
import { createLogger } from '@pokedao/market-core/src/logger';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

// CLI argument interface
interface CLIOptions {
  sources: string;
  collections?: string;
  mode: string;
  since?: string;
  limit?: number;
  dryRun: boolean;
  outputDir: string;
  verbose: boolean;
}

// Parse command line arguments
const argv = yargs(hideBin(process.argv))
  .scriptName('market-pipeline')
  .usage('$0 [options]')
  .option('sources', {
    type: 'string',
    default: 'ebay,tcgplayer',
    describe: 'Comma-separated list of sources to process',
    example: 'ebay,tcgplayer,fanatics'
  })
  .option('collections', {
    type: 'string',
    describe: 'Comma-separated list of collection slugs to process',
    example: 'slabs,prospects,watchlist'
  })
  .option('mode', {
    type: 'string',
    default: 'default',
    choices: ['conservative', 'default', 'aggressive'],
    describe: 'Pipeline execution mode'
  })
  .option('since', {
    type: 'string',
    describe: 'Only process listings since this date (ISO format)',
    example: '2025-01-01T00:00:00Z'
  })
  .option('limit', {
    type: 'number',
    describe: 'Maximum number of listings to process per source'
  })
  .option('dryRun', {
    type: 'boolean',
    default: false,
    describe: 'Run pipeline without persisting results'
  })
  .option('outputDir', {
    type: 'string',
    default: './reports',
    describe: 'Directory to save reports'
  })
  .option('verbose', {
    type: 'boolean',
    default: false,
    alias: 'v',
    describe: 'Enable verbose logging'
  })
  .help()
  .alias('help', 'h')
  .version('1.0.0')
  .alias('version', 'V')
  .example('$0 --sources=ebay --mode=conservative', 'Run conservative eBay-only pipeline')
  .example('$0 --collections=slabs,prospects --limit=1000', 'Process collections with limit')
  .example('$0 --since=2025-01-01 --dry-run', 'Dry run since January 1st')
  .epilogue('For more information, visit: https://github.com/pokedao/market-pipeline')
  .parseSync() as CLIOptions;

/**
 * Main CLI execution function
 */
async function main() {
  // Create logger with appropriate level
  const logger = createLogger({
    level: argv.verbose ? 'debug' : 'info',
    pretty: true
  });

  try {
    // Parse sources
    const sources = argv.sources.split(',').map(s => s.trim()) as MarketSource[];
    
    // Validate sources
    const validSources: MarketSource[] = Object.values(MarketSource);
    const invalidSources = sources.filter(s => !validSources.includes(s));
    
    if (invalidSources.length > 0) {
      logger.error(`Invalid sources: ${invalidSources.join(', ')}`);
      logger.info(`Valid sources: ${validSources.join(', ')}`);
      process.exit(1);
    }

    // Parse collections if provided
    const collections = argv.collections 
      ? argv.collections.split(',').map(s => s.trim())
      : undefined;

    // Parse since date if provided
    const since = argv.since ? new Date(argv.since) : undefined;
    
    // Validate since date
    if (since && isNaN(since.getTime())) {
      logger.error(`Invalid since date: ${argv.since}`);
      logger.info('Use ISO format: 2025-01-01T00:00:00Z');
      process.exit(1);
    }

    // Log pipeline configuration
    logger.info({
      sources: sources.join(', '),
      collections: collections?.join(', ') || 'none',
      mode: argv.mode,
      since: since?.toISOString() || 'none',
      limit: argv.limit || 'none',
      dryRun: argv.dryRun,
      outputDir: argv.outputDir
    }, 'Starting market pipeline');

    // Run the pipeline
    const results = await runPipeline({
      sources,
      collectionSlugs: collections,
      mode: argv.mode as any,
      since,
      limit: argv.limit,
      dryRun: argv.dryRun
    });

    // Generate reports if not dry run
    if (!argv.dryRun) {
      logger.info('Generating reports...');
      
      // Create report data structure
      const reportData = {
        timestamp: new Date().toISOString(),
        pipelineResults: results,
        opportunities: [], // Would be populated from results
        listings: [], // Would be populated from results
        collections: new Map(), // Would be populated from results
        metadata: {
          sources,
          mode: argv.mode,
          totalDuration: results.duration,
          version: '1.0.0'
        }
      };

      // Generate report directory
      await generateReportDirectory(reportData, argv.outputDir);
      
      logger.info(`Reports generated in: ${argv.outputDir}`);
    }

    // Log final results
    logger.info({
      duration: `${(results.duration / 1000).toFixed(1)}s`,
      totalListings: results.global.totalListings,
      totalOpportunities: results.global.totalOpportunities,
      totalProfit: `$${(results.global.totalProfitPotential / 100).toFixed(2)}`,
      averageMargin: `${results.global.avgProfitMargin.toFixed(1)}%`
    }, 'Pipeline completed successfully');

    // Log source breakdown
    logger.info('Source breakdown:');
    for (const [source, stats] of Object.entries(results.sources)) {
      logger.info(`  ${source}: ${stats.recordsProcessed} processed, ${stats.opportunitiesFound} opportunities`);
    }

    // Log collection breakdown if applicable
    if (collections && results.collections) {
      logger.info('Collection breakdown:');
      for (const [collection, stats] of Object.entries(results.collections)) {
        logger.info(`  ${collection}: ${stats.opportunitiesFound} opportunities, $${(stats.avgProfitMargin * 100).toFixed(2)} avg margin`);
      }
    }

  } catch (error) {
    logger.error({
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    }, 'Pipeline failed');

    process.exit(1);
  }
}

/**
 * Handle graceful shutdown
 */
process.on('SIGINT', () => {
  console.log('\nReceived SIGINT, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\nReceived SIGTERM, shutting down gracefully...');
  process.exit(0);
});

/**
 * Handle unhandled errors
 */
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

// Run the CLI
if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { main as runMarketPipeline };
