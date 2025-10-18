/**
 * Mew-1A v4.2 Streaming Client
 *
 * Server-Sent Events (SSE) client for real-time streaming inference
 * Following NanoChat's architecture patterns for production-grade streaming
 *
 * @module mew1a-streaming
 */

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface StreamingConfig {
  /** Modal endpoint URL for streaming */
  streamUrl: string;
  /** Health check endpoint URL */
  healthUrl: string;
  /** Maximum tokens to generate (default: 200) */
  maxTokens?: number;
  /** Temperature for sampling (default: 0.3) */
  temperature?: number;
  /** Top-p sampling parameter (default: 0.9) */
  topP?: number;
  /** Request timeout in milliseconds (default: 60000) */
  timeout?: number;
}

export interface StreamToken {
  /** Generated token text */
  token: string;
  /** Whether streaming is complete */
  done: boolean;
  /** Elapsed time in seconds */
  time: number;
}

export interface StreamMetrics {
  /** Total tokens generated */
  totalTokens: number;
  /** Elapsed time in seconds */
  elapsedTime: number;
  /** Tokens per second */
  tokensPerSecond: number;
  /** Full generated text */
  text: string;
}

export interface HealthStatus {
  /** Server status */
  status: 'healthy' | 'unhealthy';
  /** Whether model is loaded */
  modelLoaded: boolean;
  /** Model name */
  modelName: string;
  /** Server uptime in seconds */
  uptime: number;
  /** Model startup time in seconds */
  startupTime: number;
}

export type StreamCallback = (token: string, done: boolean, metrics?: StreamMetrics) => void;
export type ErrorCallback = (error: Error) => void;

// ============================================================================
// Mew-1A Streaming Client
// ============================================================================

export class Mew1AStreamingClient {
  private config: Required<StreamingConfig>;
  private eventSource: EventSource | null = null;
  private abortController: AbortController | null = null;

  constructor(config: StreamingConfig) {
    this.config = {
      streamUrl: config.streamUrl,
      healthUrl: config.healthUrl,
      maxTokens: config.maxTokens ?? 200,
      temperature: config.temperature ?? 0.3,
      topP: config.topP ?? 0.9,
      timeout: config.timeout ?? 60000,
    };
  }

  /**
   * Check server health and model status
   */
  async checkHealth(): Promise<HealthStatus> {
    try {
      const response = await fetch(this.config.healthUrl);

      if (!response.ok) {
        throw new Error(`Health check failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      return {
        status: data.status,
        modelLoaded: data.model_loaded,
        modelName: data.model_name,
        uptime: data.uptime,
        startupTime: data.startup_time,
      };
    } catch (error) {
      throw new Error(`Health check error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Stream inference with SSE (Server-Sent Events)
   *
   * @param prompt - Input prompt for the model
   * @param onToken - Callback for each streamed token
   * @param onError - Error callback
   * @returns Promise that resolves with final metrics when streaming completes
   */
  async stream(
    prompt: string,
    onToken: StreamCallback,
    onError?: ErrorCallback
  ): Promise<StreamMetrics> {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      let tokenCount = 0;
      let fullText = '';

      // Build URL with query parameters
      const url = new URL(this.config.streamUrl);
      url.searchParams.append('prompt', prompt);
      url.searchParams.append('max_tokens', String(this.config.maxTokens));
      url.searchParams.append('temperature', String(this.config.temperature));
      url.searchParams.append('top_p', String(this.config.topP));

      // Create EventSource for SSE
      this.eventSource = new EventSource(url.toString());

      // Handle incoming messages
      this.eventSource.onmessage = (event) => {
        try {
          const data: StreamToken = JSON.parse(event.data);

          if (data.done) {
            // Streaming complete
            const elapsedTime = (Date.now() - startTime) / 1000;
            const tokensPerSecond = tokenCount / elapsedTime;

            const metrics: StreamMetrics = {
              totalTokens: tokenCount,
              elapsedTime,
              tokensPerSecond,
              text: fullText,
            };

            onToken('', true, metrics);
            this.cleanup();
            resolve(metrics);
          } else if (data.token) {
            // New token received
            fullText += data.token;
            tokenCount++;
            onToken(data.token, false);
          }
        } catch (error) {
          const err = new Error(`Failed to parse SSE data: ${error instanceof Error ? error.message : String(error)}`);
          if (onError) onError(err);
          this.cleanup();
          reject(err);
        }
      };

      // Handle errors
      this.eventSource.onerror = (event) => {
        const error = new Error('SSE connection error');

        if (fullText.length === 0) {
          // No data received - connection failed
          if (onError) onError(error);
          this.cleanup();
          reject(error);
        } else {
          // Partial data received - mark as incomplete
          const elapsedTime = (Date.now() - startTime) / 1000;
          const tokensPerSecond = tokenCount / elapsedTime;

          const metrics: StreamMetrics = {
            totalTokens: tokenCount,
            elapsedTime,
            tokensPerSecond,
            text: fullText,
          };

          if (onError) onError(new Error('Stream interrupted'));
          this.cleanup();
          resolve(metrics);
        }
      };

      // Timeout
      setTimeout(() => {
        if (this.eventSource && this.eventSource.readyState !== EventSource.CLOSED) {
          const error = new Error(`Streaming timeout after ${this.config.timeout}ms`);
          if (onError) onError(error);
          this.cleanup();
          reject(error);
        }
      }, this.config.timeout);
    });
  }

  /**
   * Generate response without streaming (single response)
   *
   * @param prompt - Input prompt for the model
   * @returns Generated text and metrics
   */
  async generate(prompt: string): Promise<StreamMetrics> {
    let fullText = '';

    const metrics = await this.stream(
      prompt,
      (token, done) => {
        if (!done) {
          fullText += token;
        }
      }
    );

    return metrics;
  }

  /**
   * Stop ongoing streaming
   */
  stop(): void {
    this.cleanup();
  }

  /**
   * Clean up resources
   */
  private cleanup(): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Create a Mew-1A streaming client with default Modal endpoints
 */
export function createMew1AClient(
  customConfig?: Partial<StreamingConfig>
): Mew1AStreamingClient {
  const defaultConfig: StreamingConfig = {
    streamUrl: 'https://chicopanama--mew1a-v42-streaming-model-stream.modal.run',
    healthUrl: 'https://chicopanama--mew1a-v42-streaming-model-health.modal.run',
    maxTokens: 200,
    temperature: 0.3,
    topP: 0.9,
    timeout: 60000,
  };

  return new Mew1AStreamingClient({
    ...defaultConfig,
    ...customConfig,
  });
}

/**
 * Quick helper for streaming with default client
 */
export async function streamMew1A(
  prompt: string,
  onToken: StreamCallback,
  onError?: ErrorCallback
): Promise<StreamMetrics> {
  const client = createMew1AClient();
  return client.stream(prompt, onToken, onError);
}

/**
 * Quick helper for non-streaming generation
 */
export async function generateMew1A(prompt: string): Promise<string> {
  const client = createMew1AClient();
  const metrics = await client.generate(prompt);
  return metrics.text;
}

// ============================================================================
// Example Usage
// ============================================================================

/**
 * Example: Basic streaming
 *
 * ```typescript
 * import { streamMew1A } from './mew1a-streaming';
 *
 * await streamMew1A(
 *   'Analyze: Charizard ex - Obsidian Flames. Listed $45, fair value $52',
 *   (token, done, metrics) => {
 *     if (done) {
 *       console.log(`\nComplete! ${metrics.totalTokens} tokens in ${metrics.elapsedTime}s`);
 *     } else {
 *       process.stdout.write(token);
 *     }
 *   },
 *   (error) => {
 *     console.error('Error:', error.message);
 *   }
 * );
 * ```
 */

/**
 * Example: Using the client class
 *
 * ```typescript
 * import { createMew1AClient } from './mew1a-streaming';
 *
 * const client = createMew1AClient({
 *   maxTokens: 300,
 *   temperature: 0.5,
 * });
 *
 * // Check health
 * const health = await client.checkHealth();
 * console.log('Model status:', health.status);
 *
 * // Stream response
 * const metrics = await client.stream(
 *   'BUY or PASS? Pikachu VMAX - Listed $120',
 *   (token) => console.log(token)
 * );
 *
 * console.log('Metrics:', metrics);
 * ```
 */

/**
 * Example: Simple generation (no streaming callback needed)
 *
 * ```typescript
 * import { generateMew1A } from './mew1a-streaming';
 *
 * const response = await generateMew1A(
 *   'What is the market trend for Umbreon VMAX cards?'
 * );
 *
 * console.log(response);
 * ```
 */
