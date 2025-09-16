// Batching and streaming utilities for processing large datasets
// Provides efficient chunking and streaming for memory-constrained operations

/**
 * Process items in batches with configurable batch size
 */
export async function processInBatches<T, R>(
  items: T[],
  processor: (batch: T[]) => Promise<R[]>,
  batchSize: number = 1000,
  options: {
    onProgress?: (processed: number, total: number) => void;
    onError?: (error: Error, batch: T[]) => void;
    continueOnError?: boolean;
  } = {}
): Promise<R[]> {
  const results: R[] = [];
  const { onProgress, onError, continueOnError = true } = options;
  
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    
    try {
      const batchResults = await processor(batch);
      results.push(...batchResults);
      
      if (onProgress) {
        onProgress(Math.min(i + batchSize, items.length), items.length);
      }
    } catch (error) {
      if (onError) {
        onError(error as Error, batch);
      }
      
      if (!continueOnError) {
        throw error;
      }
    }
  }
  
  return results;
}

/**
 * Stream items in batches for memory efficiency
 */
export async function* streamInBatches<T>(
  items: T[],
  batchSize: number = 1000
): AsyncGenerator<T[], void, unknown> {
  for (let i = 0; i < items.length; i += batchSize) {
    yield items.slice(i, i + batchSize);
  }
}

/**
 * Process items with concurrency control
 */
export async function processWithConcurrency<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  concurrency: number = 5,
  options: {
    onProgress?: (processed: number, total: number) => void;
    onError?: (error: Error, item: T) => void;
    continueOnError?: boolean;
  } = {}
): Promise<R[]> {
  const results: R[] = [];
  const { onProgress, onError, continueOnError = true } = options;
  let processed = 0;
  
  const processItem = async (item: T): Promise<R | null> => {
    try {
      const result = await processor(item);
      processed++;
      
      if (onProgress) {
        onProgress(processed, items.length);
      }
      
      return result;
    } catch (error) {
      if (onError) {
        onError(error as Error, item);
      }
      
      if (!continueOnError) {
        throw error;
      }
      
      processed++;
      return null;
    }
  };
  
  // Process items in chunks with concurrency limit
  for (let i = 0; i < items.length; i += concurrency) {
    const chunk = items.slice(i, i + concurrency);
    const chunkResults = await Promise.all(chunk.map(processItem));
    
    // Filter out null results (from errors)
    results.push(...chunkResults.filter(result => result !== null) as R[]);
  }
  
  return results;
}

/**
 * Create a batched processor with built-in error handling
 */
export function createBatchedProcessor<T, R>(
  processor: (batch: T[]) => Promise<R[]>,
  options: {
    batchSize?: number;
    maxRetries?: number;
    retryDelay?: number;
    onProgress?: (processed: number, total: number) => void;
    onError?: (error: Error, batch: T[], attempt: number) => void;
  } = {}
) {
  const {
    batchSize = 1000,
    maxRetries = 3,
    retryDelay = 1000,
    onProgress,
    onError
  } = options;
  
  return async (items: T[]): Promise<R[]> => {
    const results: R[] = [];
    
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      let lastError: Error | null = null;
      
      // Retry logic
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          const batchResults = await processor(batch);
          results.push(...batchResults);
          break; // Success, exit retry loop
        } catch (error) {
          lastError = error as Error;
          
          if (onError) {
            onError(lastError, batch, attempt);
          }
          
          if (attempt < maxRetries) {
            // Wait before retry
            await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
          }
        }
      }
      
      // If all retries failed, throw the last error
      if (lastError && !results.length) {
        throw lastError;
      }
      
      if (onProgress) {
        onProgress(Math.min(i + batchSize, items.length), items.length);
      }
    }
    
    return results;
  };
}

/**
 * Create a memory-efficient stream processor
 */
export function createStreamProcessor<T, R>(
  processor: (item: T) => Promise<R>,
  options: {
    bufferSize?: number;
    concurrency?: number;
    onProgress?: (processed: number) => void;
    onError?: (error: Error, item: T) => void;
  } = {}
) {
  const {
    bufferSize = 1000,
    concurrency = 5,
    onProgress,
    onError
  } = options;
  
  return async function* processStream(
    items: AsyncIterable<T> | T[]
  ): AsyncGenerator<R, void, unknown> {
    const buffer: T[] = [];
    let processed = 0;
    
    const processBuffer = async (): Promise<R[]> => {
      const results: R[] = [];
      const chunks = [];
      
      // Split buffer into chunks for concurrent processing
      for (let i = 0; i < buffer.length; i += concurrency) {
        chunks.push(buffer.slice(i, i + concurrency));
      }
      
      for (const chunk of chunks) {
        const chunkResults = await Promise.all(
          chunk.map(async (item) => {
            try {
              return await processor(item);
            } catch (error) {
              if (onError) {
                onError(error as Error, item);
              }
              throw error;
            }
          })
        );
        
        results.push(...chunkResults);
        processed += chunk.length;
        
        if (onProgress) {
          onProgress(processed);
        }
      }
      
      return results;
    };
    
    // Process items from iterable
    for await (const item of items) {
      buffer.push(item);
      
      if (buffer.length >= bufferSize) {
        const results = await processBuffer();
        for (const result of results) {
          yield result;
        }
        buffer.length = 0; // Clear buffer
      }
    }
    
    // Process remaining items in buffer
    if (buffer.length > 0) {
      const results = await processBuffer();
      for (const result of results) {
        yield result;
      }
    }
  };
}

/**
 * Create a progress tracker
 */
export function createProgressTracker(total: number) {
  let processed = 0;
  const startTime = Date.now();
  
  return {
    update: (increment: number = 1) => {
      processed += increment;
      const elapsed = Date.now() - startTime;
      const rate = processed / elapsed; // items per ms
      const remaining = total - processed;
      const eta = remaining / rate; // ms remaining
      
      return {
        processed,
        total,
        percentage: (processed / total) * 100,
        elapsed,
        rate: rate * 1000, // items per second
        eta
      };
    },
    
    getStats: () => ({
      processed,
      total,
      percentage: (processed / total) * 100,
      elapsed: Date.now() - startTime
    })
  };
}

/**
 * Create a rate limiter
 */
export function createRateLimiter(requestsPerSecond: number) {
  const queue: Array<() => void> = [];
  let lastRequest = 0;
  const minInterval = 1000 / requestsPerSecond;
  
  return async function rateLimit<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      const execute = async () => {
        const now = Date.now();
        const timeSinceLastRequest = now - lastRequest;
        
        if (timeSinceLastRequest < minInterval) {
          const delay = minInterval - timeSinceLastRequest;
          await new Promise(resolve => setTimeout(resolve, delay));
        }
        
        lastRequest = Date.now();
        
        try {
          const result = await fn();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      };
      
      queue.push(execute);
      
      // Process queue sequentially
      if (queue.length === 1) {
        processQueue();
      }
    });
  };
  
  async function processQueue() {
    while (queue.length > 0) {
      const next = queue.shift();
      if (next) {
        await next();
      }
    }
  }
}

/**
 * Create a memory monitor
 */
export function createMemoryMonitor(options: {
  maxMemoryMB?: number;
  onWarning?: (usage: number) => void;
  onError?: (usage: number) => void;
} = {}) {
  const { maxMemoryMB = 512, onWarning, onError } = options;
  const maxMemoryBytes = maxMemoryMB * 1024 * 1024;
  
  return {
    check: (): { usage: number; percentage: number; status: 'ok' | 'warning' | 'error' } => {
      const usage = process.memoryUsage();
      const heapUsed = usage.heapUsed;
      const percentage = (heapUsed / maxMemoryBytes) * 100;
      
      let status: 'ok' | 'warning' | 'error' = 'ok';
      
      if (percentage >= 90) {
        status = 'error';
        if (onError) onError(heapUsed);
      } else if (percentage >= 75) {
        status = 'warning';
        if (onWarning) onWarning(heapUsed);
      }
      
      return {
        usage: heapUsed,
        percentage,
        status
      };
    },
    
    forceGC: () => {
      if (global.gc) {
        global.gc();
      }
    }
  };
}

/**
 * Create a timeout wrapper
 */
export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  errorMessage: string = 'Operation timed out'
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(errorMessage)), timeoutMs);
    })
  ]);
}

/**
 * Create a retry wrapper
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number;
    retryDelay?: number;
    backoffMultiplier?: number;
    onRetry?: (attempt: number, error: Error) => void;
  } = {}
): Promise<T> {
  const {
    maxRetries = 3,
    retryDelay = 1000,
    backoffMultiplier = 2,
    onRetry
  } = options;
  
  let lastError: Error;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      
      if (attempt < maxRetries) {
        if (onRetry) {
          onRetry(attempt, lastError);
        }
        
        const delay = retryDelay * Math.pow(backoffMultiplier, attempt - 1);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError!;
}

/**
 * Create a circuit breaker
 */
export function createCircuitBreaker<T>(
  fn: () => Promise<T>,
  options: {
    failureThreshold?: number;
    resetTimeout?: number;
    onStateChange?: (state: 'closed' | 'open' | 'half-open') => void;
  } = {}
) {
  const {
    failureThreshold = 5,
    resetTimeout = 60000,
    onStateChange
  } = options;
  
  let state: 'closed' | 'open' | 'half-open' = 'closed';
  let failureCount = 0;
  let lastFailureTime = 0;
  
  return async (): Promise<T> => {
    if (state === 'open') {
      if (Date.now() - lastFailureTime > resetTimeout) {
        state = 'half-open';
        if (onStateChange) onStateChange(state);
      } else {
        throw new Error('Circuit breaker is open');
      }
    }
    
    try {
      const result = await fn();
      
      if (state === 'half-open') {
        state = 'closed';
        failureCount = 0;
        if (onStateChange) onStateChange(state);
      }
      
      return result;
    } catch (error) {
      failureCount++;
      lastFailureTime = Date.now();
      
      if (failureCount >= failureThreshold) {
        state = 'open';
        if (onStateChange) onStateChange(state);
      }
      
      throw error;
    }
  };
}
