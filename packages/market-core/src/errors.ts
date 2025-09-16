// Error types and guards for the market pipeline
// Provides consistent error handling across all components

import { MarketSource } from './types';

// Base error class for all market pipeline errors
export class MarketPipelineError extends Error {
  public readonly source?: MarketSource;
  public readonly code: string;
  public readonly details?: unknown;
  public readonly timestamp: Date;

  constructor(
    message: string,
    source?: MarketSource,
    code: string = 'UNKNOWN_ERROR',
    details?: unknown
  ) {
    super(message);
    this.name = 'MarketPipelineError';
    this.source = source;
    this.code = code;
    this.details = details;
    this.timestamp = new Date();

    // Ensure proper prototype chain
    Object.setPrototypeOf(this, MarketPipelineError.prototype);
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      source: this.source,
      code: this.code,
      details: this.details,
      timestamp: this.timestamp.toISOString(),
      stack: this.stack
    };
  }
}

// Adapter-specific errors
export class AdapterError extends MarketPipelineError {
  constructor(message: string, source: MarketSource, details?: unknown) {
    super(message, source, 'ADAPTER_ERROR', details);
    this.name = 'AdapterError';
    Object.setPrototypeOf(this, AdapterError.prototype);
  }
}

// Validation errors
export class ValidationError extends MarketPipelineError {
  public readonly validationErrors: string[];

  constructor(message: string, validationErrors: string[], details?: unknown) {
    super(message, undefined, 'VALIDATION_ERROR', details);
    this.name = 'ValidationError';
    this.validationErrors = validationErrors;
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

// Cross-reference errors
export class CrossReferenceError extends MarketPipelineError {
  constructor(message: string, source?: MarketSource, details?: unknown) {
    super(message, source, 'CROSS_REFERENCE_ERROR', details);
    this.name = 'CrossReferenceError';
    Object.setPrototypeOf(this, CrossReferenceError.prototype);
  }
}

// Data quality errors
export class DataQualityError extends MarketPipelineError {
  public readonly qualityScore: number;

  constructor(message: string, qualityScore: number, details?: unknown) {
    super(message, undefined, 'DATA_QUALITY_ERROR', details);
    this.name = 'DataQualityError';
    this.qualityScore = qualityScore;
    Object.setPrototypeOf(this, DataQualityError.prototype);
  }
}

// Price normalization errors
export class PriceNormalizationError extends MarketPipelineError {
  public readonly originalPrice: number;
  public readonly currency: string;

  constructor(message: string, originalPrice: number, currency: string, details?: unknown) {
    super(message, undefined, 'PRICE_NORMALIZATION_ERROR', details);
    this.name = 'PriceNormalizationError';
    this.originalPrice = originalPrice;
    this.currency = currency;
    Object.setPrototypeOf(this, PriceNormalizationError.prototype);
  }
}

// Arbitrage calculation errors
export class ArbitrageError extends MarketPipelineError {
  public readonly listingId: string;

  constructor(message: string, listingId: string, details?: unknown) {
    super(message, undefined, 'ARBITRAGE_ERROR', details);
    this.name = 'ArbitrageError';
    this.listingId = listingId;
    Object.setPrototypeOf(this, ArbitrageError.prototype);
  }
}

// Collection errors
export class CollectionError extends MarketPipelineError {
  public readonly collectionSlug: string;

  constructor(message: string, collectionSlug: string, details?: unknown) {
    super(message, undefined, 'COLLECTION_ERROR', details);
    this.name = 'CollectionError';
    this.collectionSlug = collectionSlug;
    Object.setPrototypeOf(this, CollectionError.prototype);
  }
}

// Database errors
export class DatabaseError extends MarketPipelineError {
  public readonly operation: string;
  public readonly table?: string;

  constructor(message: string, operation: string, table?: string, details?: unknown) {
    super(message, undefined, 'DATABASE_ERROR', details);
    this.name = 'DatabaseError';
    this.operation = operation;
    this.table = table;
    Object.setPrototypeOf(this, DatabaseError.prototype);
  }
}

// Network/API errors
export class NetworkError extends MarketPipelineError {
  public readonly url?: string;
  public readonly statusCode?: number;

  constructor(message: string, source?: MarketSource, url?: string, statusCode?: number, details?: unknown) {
    super(message, source, 'NETWORK_ERROR', details);
    this.name = 'NetworkError';
    this.url = url;
    this.statusCode = statusCode;
    Object.setPrototypeOf(this, NetworkError.prototype);
  }
}

// Rate limiting errors
export class RateLimitError extends MarketPipelineError {
  public readonly retryAfter?: number;

  constructor(message: string, source?: MarketSource, retryAfter?: number, details?: unknown) {
    super(message, source, 'RATE_LIMIT_ERROR', details);
    this.name = 'RateLimitError';
    this.retryAfter = retryAfter;
    Object.setPrototypeOf(this, RateLimitError.prototype);
  }
}

// Configuration errors
export class ConfigurationError extends MarketPipelineError {
  public readonly configKey?: string;

  constructor(message: string, configKey?: string, details?: unknown) {
    super(message, undefined, 'CONFIGURATION_ERROR', details);
    this.name = 'ConfigurationError';
    this.configKey = configKey;
    Object.setPrototypeOf(this, ConfigurationError.prototype);
  }
}

// Timeout errors
export class TimeoutError extends MarketPipelineError {
  public readonly timeoutMs: number;

  constructor(message: string, timeoutMs: number, source?: MarketSource, details?: unknown) {
    super(message, source, 'TIMEOUT_ERROR', details);
    this.name = 'TimeoutError';
    this.timeoutMs = timeoutMs;
    Object.setPrototypeOf(this, TimeoutError.prototype);
  }
}

// Error type guards
export function isMarketPipelineError(error: unknown): error is MarketPipelineError {
  return error instanceof MarketPipelineError;
}

export function isAdapterError(error: unknown): error is AdapterError {
  return error instanceof AdapterError;
}

export function isValidationError(error: unknown): error is ValidationError {
  return error instanceof ValidationError;
}

export function isCrossReferenceError(error: unknown): error is CrossReferenceError {
  return error instanceof CrossReferenceError;
}

export function isDataQualityError(error: unknown): error is DataQualityError {
  return error instanceof DataQualityError;
}

export function isPriceNormalizationError(error: unknown): error is PriceNormalizationError {
  return error instanceof PriceNormalizationError;
}

export function isArbitrageError(error: unknown): error is ArbitrageError {
  return error instanceof ArbitrageError;
}

export function isCollectionError(error: unknown): error is CollectionError {
  return error instanceof CollectionError;
}

export function isDatabaseError(error: unknown): error is DatabaseError {
  return error instanceof DatabaseError;
}

export function isNetworkError(error: unknown): error is NetworkError {
  return error instanceof NetworkError;
}

export function isRateLimitError(error: unknown): error is RateLimitError {
  return error instanceof RateLimitError;
}

export function isConfigurationError(error: unknown): error is ConfigurationError {
  return error instanceof ConfigurationError;
}

export function isTimeoutError(error: unknown): error is TimeoutError {
  return error instanceof TimeoutError;
}

// Error classification
export function classifyError(error: unknown): {
  type: string;
  source?: MarketSource;
  code: string;
  isRetryable: boolean;
  severity: 'low' | 'medium' | 'high' | 'critical';
} {
  if (isMarketPipelineError(error)) {
    const isRetryable = isRetryableError(error);
    const severity = getErrorSeverity(error);
    
    return {
      type: error.name,
      source: error.source,
      code: error.code,
      isRetryable,
      severity
    };
  }
  
  // Unknown error
  return {
    type: 'UnknownError',
    code: 'UNKNOWN_ERROR',
    isRetryable: false,
    severity: 'high'
  };
}

// Determine if an error is retryable
export function isRetryableError(error: MarketPipelineError): boolean {
  switch (error.code) {
    case 'NETWORK_ERROR':
    case 'TIMEOUT_ERROR':
    case 'RATE_LIMIT_ERROR':
      return true;
    case 'VALIDATION_ERROR':
    case 'DATA_QUALITY_ERROR':
    case 'CONFIGURATION_ERROR':
      return false;
    default:
      return false;
  }
}

// Get error severity
export function getErrorSeverity(error: MarketPipelineError): 'low' | 'medium' | 'high' | 'critical' {
  switch (error.code) {
    case 'VALIDATION_ERROR':
    case 'DATA_QUALITY_ERROR':
      return 'low';
    case 'ADAPTER_ERROR':
    case 'CROSS_REFERENCE_ERROR':
    case 'PRICE_NORMALIZATION_ERROR':
      return 'medium';
    case 'ARBITRAGE_ERROR':
    case 'COLLECTION_ERROR':
    case 'DATABASE_ERROR':
      return 'high';
    case 'CONFIGURATION_ERROR':
    case 'NETWORK_ERROR':
      return 'critical';
    default:
      return 'medium';
  }
}

// Error aggregation
export class ErrorAggregator {
  private errors: MarketPipelineError[] = [];
  private maxErrors: number;

  constructor(maxErrors: number = 100) {
    this.maxErrors = maxErrors;
  }

  add(error: MarketPipelineError): void {
    if (this.errors.length < this.maxErrors) {
      this.errors.push(error);
    }
  }

  getErrors(): MarketPipelineError[] {
    return [...this.errors];
  }

  getErrorCount(): number {
    return this.errors.length;
  }

  getErrorsBySource(source: MarketSource): MarketPipelineError[] {
    return this.errors.filter(error => error.source === source);
  }

  getErrorsByCode(code: string): MarketPipelineError[] {
    return this.errors.filter(error => error.code === code);
  }

  getErrorSummary(): {
    total: number;
    bySource: Record<string, number>;
    byCode: Record<string, number>;
    bySeverity: Record<string, number>;
  } {
    const bySource: Record<string, number> = {};
    const byCode: Record<string, number> = {};
    const bySeverity: Record<string, number> = {};

    for (const error of this.errors) {
      // By source
      const source = error.source || 'unknown';
      bySource[source] = (bySource[source] || 0) + 1;

      // By code
      byCode[error.code] = (byCode[error.code] || 0) + 1;

      // By severity
      const severity = getErrorSeverity(error);
      bySeverity[severity] = (bySeverity[severity] || 0) + 1;
    }

    return {
      total: this.errors.length,
      bySource,
      byCode,
      bySeverity
    };
  }

  clear(): void {
    this.errors = [];
  }

  hasErrors(): boolean {
    return this.errors.length > 0;
  }

  hasCriticalErrors(): boolean {
    return this.errors.some(error => getErrorSeverity(error) === 'critical');
  }

  hasRetryableErrors(): boolean {
    return this.errors.some(error => isRetryableError(error));
  }
}

// Error recovery strategies
export class ErrorRecovery {
  static async retry<T>(
    fn: () => Promise<T>,
    maxRetries: number = 3,
    delay: number = 1000
  ): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;
        
        if (attempt < maxRetries && isRetryableError(error as MarketPipelineError)) {
          await new Promise(resolve => setTimeout(resolve, delay * attempt));
        } else {
          break;
        }
      }
    }
    
    throw lastError!;
  }

  static async withFallback<T>(
    primary: () => Promise<T>,
    fallback: () => Promise<T>
  ): Promise<T> {
    try {
      return await primary();
    } catch (error) {
      if (isRetryableError(error as MarketPipelineError)) {
        return await fallback();
      }
      throw error;
    }
  }

  static async withCircuitBreaker<T>(
    fn: () => Promise<T>,
    failureThreshold: number = 5,
    resetTimeout: number = 60000
  ): Promise<T> {
    // Simple circuit breaker implementation
    let failures = 0;
    let lastFailureTime = 0;
    let isOpen = false;

    if (isOpen) {
      if (Date.now() - lastFailureTime > resetTimeout) {
        isOpen = false;
        failures = 0;
      } else {
        throw new Error('Circuit breaker is open');
      }
    }

    try {
      const result = await fn();
      failures = 0; // Reset on success
      return result;
    } catch (error) {
      failures++;
      lastFailureTime = Date.now();
      
      if (failures >= failureThreshold) {
        isOpen = true;
      }
      
      throw error;
    }
  }
}

// Error formatting utilities
export function formatError(error: unknown): string {
  if (isMarketPipelineError(error)) {
    return `${error.name}: ${error.message} (${error.code})${error.source ? ` [${error.source}]` : ''}`;
  }
  
  if (error instanceof Error) {
    return `${error.name}: ${error.message}`;
  }
  
  return String(error);
}

export function formatErrorForLogging(error: unknown): Record<string, any> {
  if (isMarketPipelineError(error)) {
    return {
      name: error.name,
      message: error.message,
      code: error.code,
      source: error.source,
      details: error.details,
      timestamp: error.timestamp,
      stack: error.stack
    };
  }
  
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack
    };
  }
  
  return {
    error: String(error)
  };
}
