/**
 * ETHERSCAN V2 API CLIENT
 *
 * Unified multi-chain client using Etherscan V2 API.
 * Single API key works across 60+ EVM chains via chainid parameter.
 *
 * Features:
 * - Multi-chain support (Ethereum, Base, Arbitrum, Polygon, Optimism)
 * - Rate limiting (5 calls/sec free tier)
 * - Retry with exponential backoff
 * - Verified contract source code fetching
 */

import { z } from 'zod';

// ============================================================================
// TYPES
// ============================================================================

export const ChainConfigSchema = z.object({
  chainId: z.number(),
  name: z.string(),
  explorerUrl: z.string().optional(),
});

export type ChainConfig = z.infer<typeof ChainConfigSchema>;

export const ContractSourceSchema = z.object({
  name: z.string(),
  sourceCode: z.string(),
  abi: z.unknown(),
  compilerVersion: z.string(),
  optimizationUsed: z.boolean(),
  runs: z.number().optional(),
  constructorArguments: z.string().optional(),
  evmVersion: z.string().optional(),
  isProxy: z.boolean(),
  implementationAddress: z.string().optional(),
});

export type ContractSource = z.infer<typeof ContractSourceSchema>;

export interface EtherscanClientConfig {
  apiKey: string;
  maxRetries?: number;
  retryDelayMs?: number;
  requestsPerSecond?: number;
}

// ============================================================================
// CHAIN REGISTRY
// ============================================================================

export const SUPPORTED_CHAINS: Record<string, ChainConfig> = {
  ethereum: { chainId: 1, name: 'Ethereum', explorerUrl: 'https://etherscan.io' },
  base: { chainId: 8453, name: 'Base', explorerUrl: 'https://basescan.org' },
  arbitrum: { chainId: 42161, name: 'Arbitrum', explorerUrl: 'https://arbiscan.io' },
  polygon: { chainId: 137, name: 'Polygon', explorerUrl: 'https://polygonscan.com' },
  optimism: { chainId: 10, name: 'Optimism', explorerUrl: 'https://optimistic.etherscan.io' },
  avalanche: { chainId: 43114, name: 'Avalanche', explorerUrl: 'https://snowscan.xyz' },
  bsc: { chainId: 56, name: 'BSC', explorerUrl: 'https://bscscan.com' },
};

// ============================================================================
// CLIENT
// ============================================================================

export class EtherscanClient {
  private readonly baseUrl = 'https://api.etherscan.io/v2/api';
  private readonly apiKey: string;
  private readonly maxRetries: number;
  private readonly retryDelayMs: number;
  private readonly requestsPerSecond: number;
  private lastRequestTime = 0;

  constructor(config: EtherscanClientConfig) {
    this.apiKey = config.apiKey;
    this.maxRetries = config.maxRetries ?? 3;
    this.retryDelayMs = config.retryDelayMs ?? 1000;
    this.requestsPerSecond = config.requestsPerSecond ?? 5;
  }

  /**
   * Fetch verified contract source code from any supported chain
   */
  async getContractSource(chainId: number, address: string): Promise<ContractSource | null> {
    const data = await this.call(chainId, {
      module: 'contract',
      action: 'getsourcecode',
      address,
    });

    if (!data?.result?.[0]) return null;

    const raw = data.result[0];

    // "NOTOK" or unverified contract
    if (raw.ABI === 'Contract source code not verified') {
      return null;
    }

    let abi: unknown = null;
    try {
      abi = JSON.parse(raw.ABI);
    } catch {
      // ABI may not be valid JSON
    }

    return {
      name: raw.ContractName || '',
      sourceCode: raw.SourceCode || '',
      abi,
      compilerVersion: raw.CompilerVersion || '',
      optimizationUsed: raw.OptimizationUsed === '1',
      runs: raw.Runs ? parseInt(raw.Runs, 10) : undefined,
      constructorArguments: raw.ConstructorArguments || undefined,
      evmVersion: raw.EVMVersion || undefined,
      isProxy: raw.Proxy === '1',
      implementationAddress: raw.Implementation || undefined,
    };
  }

  /**
   * Get list of newly verified contracts (via internal transactions as proxy)
   * Etherscan doesn't have a direct "new contracts" endpoint,
   * so we monitor contract creation transactions on recent blocks.
   */
  async getRecentContractCreations(chainId: number, startBlock: number, endBlock: number): Promise<string[]> {
    const data = await this.call(chainId, {
      module: 'account',
      action: 'txlistinternal',
      startblock: startBlock.toString(),
      endblock: endBlock.toString(),
      sort: 'desc',
    });

    if (!data?.result || !Array.isArray(data.result)) return [];

    // Filter for contract creation transactions (to address is empty)
    return data.result
      .filter((tx: any) => tx.type === 'create' && tx.contractAddress)
      .map((tx: any) => tx.contractAddress as string);
  }

  /**
   * Check if a contract is verified
   */
  async isContractVerified(chainId: number, address: string): Promise<boolean> {
    const source = await this.getContractSource(chainId, address);
    return source !== null;
  }

  /**
   * Get the latest block number for a chain
   */
  async getBlockNumber(chainId: number): Promise<number> {
    const data = await this.call(chainId, {
      module: 'proxy',
      action: 'eth_blockNumber',
    });

    if (!data?.result) return 0;
    return parseInt(data.result, 16);
  }

  // ============================================================================
  // INTERNAL
  // ============================================================================

  private async call(chainId: number, params: Record<string, string>): Promise<any> {
    await this.rateLimit();

    const url = new URL(this.baseUrl);
    url.searchParams.set('chainid', chainId.toString());
    url.searchParams.set('apikey', this.apiKey);
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }

    return this.withRetry(async () => {
      const response = await fetch(url.toString(), {
        headers: { 'User-Agent': 'PokeDao-Scanner/1.0' },
      });

      if (response.status === 429) {
        const retryAfter = parseInt(response.headers.get('Retry-After') || '5', 10);
        await this.sleep(retryAfter * 1000);
        throw new Error('Rate limited (429)');
      }

      if (!response.ok) {
        throw new Error(`Etherscan API error: ${response.status} ${response.statusText}`);
      }

      const json = await response.json();

      // Etherscan returns status "0" for errors
      if (json.status === '0' && json.message === 'NOTOK') {
        throw new Error(`Etherscan error: ${json.result}`);
      }

      return json;
    });
  }

  private async withRetry<T>(fn: () => Promise<T>): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;
        if (attempt < this.maxRetries) {
          const delay = this.retryDelayMs * Math.pow(2, attempt - 1);
          await this.sleep(delay);
        }
      }
    }

    throw lastError;
  }

  private async rateLimit(): Promise<void> {
    const minInterval = 1000 / this.requestsPerSecond;
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;

    if (elapsed < minInterval) {
      await this.sleep(minInterval - elapsed);
    }

    this.lastRequestTime = Date.now();
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
