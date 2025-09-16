// Structured logging utilities using Pino
// Provides consistent logging across all market pipeline components

import pino from 'pino';

// Log levels
export enum LogLevel {
  TRACE = 'trace',
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
  FATAL = 'fatal'
}

// Log context interface
export interface LogContext {
  source?: string;
  operation?: string;
  listingId?: string;
  collectionSlug?: string;
  duration?: number;
  batchSize?: number;
  processed?: number;
  total?: number;
  error?: Error;
  [key: string]: any;
}

// Logger configuration
export interface LoggerConfig {
  level?: LogLevel;
  pretty?: boolean;
  redact?: string[];
  base?: Record<string, any>;
}

/**
 * Create a structured logger instance
 */
export function createLogger(config: LoggerConfig = {}): pino.Logger {
  const {
    level = LogLevel.INFO,
    pretty = false,
    redact = ['password', 'token', 'apiKey', 'secret'],
    base = {}
  } = config;

  const loggerConfig: pino.LoggerOptions = {
    level,
    redact,
    base: {
      pid: process.pid,
      hostname: require('os').hostname(),
      ...base
    }
  };

  if (pretty && process.env.NODE_ENV !== 'production') {
    loggerConfig.transport = {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:standard',
        ignore: 'pid,hostname'
      }
    };
  }

  return pino(loggerConfig);
}

/**
 * Default logger instance
 */
export const logger = createLogger({
  level: (process.env.LOG_LEVEL as LogLevel) || LogLevel.INFO,
  pretty: process.env.NODE_ENV !== 'production'
});

/**
 * Create a child logger with additional context
 */
export function createChildLogger(parent: pino.Logger, context: LogContext): pino.Logger {
  return parent.child(context);
}

/**
 * Log pipeline start
 */
export function logPipelineStart(logger: pino.Logger, context: LogContext): void {
  logger.info({
    ...context,
    operation: 'pipeline_start'
  }, 'Pipeline started');
}

/**
 * Log pipeline completion
 */
export function logPipelineComplete(logger: pino.Logger, context: LogContext): void {
  logger.info({
    ...context,
    operation: 'pipeline_complete'
  }, 'Pipeline completed successfully');
}

/**
 * Log pipeline error
 */
export function logPipelineError(logger: pino.Logger, error: Error, context: LogContext): void {
  logger.error({
    ...context,
    operation: 'pipeline_error',
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack
    }
  }, 'Pipeline failed');
}

/**
 * Log adapter operation
 */
export function logAdapterOperation(
  logger: pino.Logger,
  source: string,
  operation: string,
  context: LogContext = {}
): void {
  logger.info({
    ...context,
    source,
    operation: `adapter_${operation}`
  }, `${source} adapter: ${operation}`);
}

/**
 * Log batch processing
 */
export function logBatchProcessing(
  logger: pino.Logger,
  operation: string,
  processed: number,
  total: number,
  context: LogContext = {}
): void {
  const percentage = total > 0 ? (processed / total) * 100 : 0;
  
  logger.info({
    ...context,
    operation: `batch_${operation}`,
    processed,
    total,
    percentage: Math.round(percentage * 100) / 100
  }, `Batch ${operation}: ${processed}/${total} (${percentage.toFixed(1)}%)`);
}

/**
 * Log data quality metrics
 */
export function logDataQuality(
  logger: pino.Logger,
  metrics: {
    totalRecords: number;
    validRecords: number;
    invalidRecords: number;
    averageQuality: number;
    issues: string[];
  },
  context: LogContext = {}
): void {
  logger.info({
    ...context,
    operation: 'data_quality_assessment',
    ...metrics
  }, 'Data quality assessment completed');
}

/**
 * Log arbitrage opportunities
 */
export function logArbitrageOpportunities(
  logger: pino.Logger,
  opportunities: {
    total: number;
    highConfidence: number;
    totalProfit: number;
    averageMargin: number;
    riskDistribution: { low: number; medium: number; high: number };
  },
  context: LogContext = {}
): void {
  logger.info({
    ...context,
    operation: 'arbitrage_analysis',
    ...opportunities
  }, 'Arbitrage analysis completed');
}

/**
 * Log collection processing
 */
export function logCollectionProcessing(
  logger: pino.Logger,
  collectionSlug: string,
  metrics: {
    totalListings: number;
    totalOpportunities: number;
    averageMargin: number;
    totalProfit: number;
  },
  context: LogContext = {}
): void {
  logger.info({
    ...context,
    operation: 'collection_processing',
    collectionSlug,
    ...metrics
  }, `Collection ${collectionSlug} processed`);
}

/**
 * Log performance metrics
 */
export function logPerformanceMetrics(
  logger: pino.Logger,
  operation: string,
  metrics: {
    duration: number;
    throughput: number;
    memoryUsage: number;
    cpuUsage?: number;
  },
  context: LogContext = {}
): void {
  logger.info({
    ...context,
    operation: `performance_${operation}`,
    ...metrics
  }, `Performance metrics for ${operation}`);
}

/**
 * Log API rate limiting
 */
export function logRateLimit(
  logger: pino.Logger,
  source: string,
  remaining: number,
  resetTime: number,
  context: LogContext = {}
): void {
  logger.warn({
    ...context,
    source,
    operation: 'rate_limit',
    remaining,
    resetTime
  }, `Rate limit approaching for ${source}: ${remaining} requests remaining`);
}

/**
 * Log cache operations
 */
export function logCacheOperation(
  logger: pino.Logger,
  operation: 'hit' | 'miss' | 'set' | 'delete',
  key: string,
  context: LogContext = {}
): void {
  logger.debug({
    ...context,
    operation: `cache_${operation}`,
    cacheKey: key
  }, `Cache ${operation}: ${key}`);
}

/**
 * Log database operations
 */
export function logDatabaseOperation(
  logger: pino.Logger,
  operation: 'insert' | 'update' | 'delete' | 'select',
  table: string,
  count: number,
  duration: number,
  context: LogContext = {}
): void {
  logger.debug({
    ...context,
    operation: `db_${operation}`,
    table,
    count,
    duration
  }, `Database ${operation}: ${table} (${count} records, ${duration}ms)`);
}

/**
 * Log validation errors
 */
export function logValidationError(
  logger: pino.Logger,
  entity: string,
  errors: string[],
  context: LogContext = {}
): void {
  logger.warn({
    ...context,
    operation: 'validation_error',
    entity,
    errors
  }, `Validation failed for ${entity}: ${errors.join(', ')}`);
}

/**
 * Log cross-reference matching
 */
export function logCrossReference(
  logger: pino.Logger,
  source: string,
  matches: {
    exact: number;
    fuzzy: number;
    partial: number;
    none: number;
  },
  context: LogContext = {}
): void {
  logger.info({
    ...context,
    operation: 'cross_reference',
    source,
    ...matches
  }, `Cross-reference matching completed for ${source}`);
}

/**
 * Create a performance timer
 */
export function createPerformanceTimer(logger: pino.Logger, operation: string, context: LogContext = {}) {
  const startTime = Date.now();
  
  return {
    end: (additionalContext: LogContext = {}) => {
      const duration = Date.now() - startTime;
      logPerformanceMetrics(logger, operation, {
        duration,
        throughput: 0, // Will be calculated by caller
        memoryUsage: process.memoryUsage().heapUsed
      }, { ...context, ...additionalContext });
      return duration;
    }
  };
}

/**
 * Create a batch progress logger
 */
export function createBatchProgressLogger(
  logger: pino.Logger,
  operation: string,
  total: number,
  context: LogContext = {}
) {
  let processed = 0;
  const startTime = Date.now();
  
  return {
    update: (increment: number = 1) => {
      processed += increment;
      const percentage = (processed / total) * 100;
      const elapsed = Date.now() - startTime;
      const rate = processed / elapsed * 1000; // items per second
      
      logBatchProcessing(logger, operation, processed, total, {
        ...context,
        percentage: Math.round(percentage * 100) / 100,
        rate: Math.round(rate * 100) / 100
      });
    },
    
    complete: () => {
      const duration = Date.now() - startTime;
      const rate = processed / duration * 1000;
      
      logPerformanceMetrics(logger, operation, {
        duration,
        throughput: Math.round(rate * 100) / 100,
        memoryUsage: process.memoryUsage().heapUsed
      }, context);
    }
  };
}

/**
 * Create a structured error logger
 */
export function createErrorLogger(logger: pino.Logger, context: LogContext = {}) {
  return {
    log: (error: Error, additionalContext: LogContext = {}) => {
      logger.error({
        ...context,
        ...additionalContext,
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack
        }
      }, error.message);
    }
  };
}

/**
 * Log memory usage
 */
export function logMemoryUsage(logger: pino.Logger, context: LogContext = {}): void {
  const usage = process.memoryUsage();
  const usageMB = {
    rss: Math.round(usage.rss / 1024 / 1024 * 100) / 100,
    heapTotal: Math.round(usage.heapTotal / 1024 / 1024 * 100) / 100,
    heapUsed: Math.round(usage.heapUsed / 1024 / 1024 * 100) / 100,
    external: Math.round(usage.external / 1024 / 1024 * 100) / 100
  };
  
  logger.debug({
    ...context,
    operation: 'memory_usage',
    ...usageMB
  }, 'Memory usage report');
}

/**
 * Create a logger middleware for Express
 */
export function createExpressLogger(logger: pino.Logger) {
  return (req: any, res: any, next: any) => {
    const start = Date.now();
    
    res.on('finish', () => {
      const duration = Date.now() - start;
      
      logger.info({
        method: req.method,
        url: req.url,
        statusCode: res.statusCode,
        duration,
        userAgent: req.get('User-Agent'),
        ip: req.ip
      }, 'HTTP request');
    });
    
    next();
  };
}

/**
 * Create a logger for database queries
 */
export function createDatabaseLogger(logger: pino.Logger) {
  return {
    query: (query: string, params: any[], duration: number) => {
      logger.debug({
        operation: 'db_query',
        query: query.substring(0, 200), // Truncate long queries
        paramCount: params.length,
        duration
      }, 'Database query executed');
    },
    
    error: (error: Error, query: string) => {
      logger.error({
        operation: 'db_error',
        query: query.substring(0, 200),
        error: {
          name: error.name,
          message: error.message
        }
      }, 'Database query failed');
    }
  };
}
