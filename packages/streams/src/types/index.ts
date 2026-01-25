/**
 * Stream types
 */

export interface StreamConfig {
  batchSize: number;
  flushIntervalMs: number;
}

export interface StreamMessage<T> {
  id: string;
  timestamp: Date;
  data: T;
}
