/**
 * CONTRACT SCANNER WORKER
 *
 * Autonomous smart contract vulnerability scanner that:
 * 1. Discovers high-TVL protocols via DeFiLlama
 * 2. Fetches verified contract source from Etherscan V2
 * 3. Runs Slither static analysis
 * 4. Enriches findings with AI analysis
 * 5. Stores results in PostgreSQL
 * 6. Sends alerts via Telegram / Clawdbot
 *
 * Schedule: Every 4 hours (0 *\/4 * * *)
 * Chains: Ethereum, Base, Arbitrum, Polygon, Optimism
 */

import { BaseWorker } from './base-worker.js';
import { EtherscanClient, SUPPORTED_CHAINS } from '@pokedao/adapters';
import { DefiLlamaClient } from '@pokedao/adapters';
import {
  runSlither,
  analyzeFindings,
  ScannerAlertService,
} from '../lib/contract-scanner/index.js';
import type {
  ScanRequest,
  ScanResult,
  NormalizedFinding,
  EnrichedFinding,
  ScanSeverity,
  ScanTool,
} from '../lib/contract-scanner/types.js';

// ============================================================================
// CONFIGURATION
// ============================================================================

const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY || '';
const MIN_TVL_USD = parseInt(process.env.SCANNER_MIN_TVL || '10000000', 10); // $10M default
const MAX_CONTRACTS_PER_RUN = parseInt(process.env.SCANNER_MAX_CONTRACTS || '10', 10);
const SCAN_CHAINS = (process.env.SCANNER_CHAINS || 'ethereum,base,arbitrum')
  .split(',')
  .map(c => c.trim());
const AI_ENRICHMENT_ENABLED = process.env.SCANNER_AI_ENABLED !== 'false';

const SEVERITY_ORDER: Record<ScanSeverity, number> = {
  CRITICAL: 4,
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
  INFORMATIONAL: 0,
};

// ============================================================================
// WORKER
// ============================================================================

class ContractScannerWorker extends BaseWorker {
  private etherscan: EtherscanClient;
  private defillama: DefiLlamaClient;
  private alertService!: ScannerAlertService;

  constructor() {
    super({
      name: 'contract-scanner',
      cronPattern: process.env.SCANNER_CRON || '0 */4 * * *', // Every 4 hours
      maxRetries: 2,
      retryDelayMs: 5000,
      timeoutMs: 600_000, // 10 min timeout
    });

    this.etherscan = new EtherscanClient({
      apiKey: ETHERSCAN_API_KEY,
      maxRetries: 3,
      requestsPerSecond: 4, // Stay below 5/sec free tier
    });

    this.defillama = new DefiLlamaClient();
  }

  // ============================================================================
  // MAIN RUN
  // ============================================================================

  protected async run(): Promise<void> {
    if (!ETHERSCAN_API_KEY) {
      this.logger.warn('ETHERSCAN_API_KEY not set, skipping scan');
      return;
    }

    // Initialize alert service
    this.alertService = new ScannerAlertService(this.redis);
    const prisma = await this.getPrisma();

    this.logger.info(
      { chains: SCAN_CHAINS, minTvl: MIN_TVL_USD, maxContracts: MAX_CONTRACTS_PER_RUN },
      'Starting contract scanner',
    );

    let totalScanned = 0;
    let totalFindings = 0;

    for (const chainKey of SCAN_CHAINS) {
      const chain = SUPPORTED_CHAINS[chainKey];
      if (!chain) {
        this.logger.warn({ chain: chainKey }, 'Unknown chain, skipping');
        continue;
      }

      try {
        const results = await this.scanChain(prisma, chain.chainId, chain.name, chainKey);
        totalScanned += results.scanned;
        totalFindings += results.findings;
      } catch (error) {
        this.logger.error(
          { chain: chainKey, error: (error as Error).message },
          'Chain scan failed',
        );
      }
    }

    this.incrementItemsProcessed(totalScanned);
    this.logger.info(
      { totalScanned, totalFindings },
      'Contract scanner run complete',
    );
  }

  // ============================================================================
  // CHAIN SCANNING
  // ============================================================================

  private async scanChain(
    prisma: any,
    chainId: number,
    chainName: string,
    chainKey: string,
  ): Promise<{ scanned: number; findings: number }> {
    this.logger.info({ chain: chainName }, 'Scanning chain');

    // 1. Get high-TVL protocols on this chain
    const protocols = await this.withRetry(
      () => this.defillama.getProtocolsByChain(chainName, MIN_TVL_USD),
      'defillama-protocols',
    );

    this.logger.info(
      { chain: chainName, protocolsFound: protocols.length },
      'Protocols discovered',
    );

    let scanned = 0;
    let totalFindings = 0;

    // 2. Process top protocols (limited per run)
    for (const protocol of protocols.slice(0, MAX_CONTRACTS_PER_RUN)) {
      try {
        // Skip if recently scanned (dedup)
        const dedupKey = `${protocol.slug}:${chainId}`;
        if (await this.isDuplicate(dedupKey)) {
          continue;
        }

        // For now we need the contract address from the protocol data.
        // DeFiLlama doesn't always provide contract addresses directly,
        // so we check if the protocol slug matches a known address pattern
        // or fetch from their GitHub adapters.
        // As a practical approach, we try to resolve addresses from protocol details.
        const addresses = await this.resolveProtocolAddresses(protocol, chainId);

        for (const address of addresses.slice(0, 3)) { // Max 3 contracts per protocol
          const result = await this.scanContract(prisma, {
            address,
            chainId,
            chainName,
            scanType: 'FULL',
            protocolName: protocol.name,
            protocolSlug: protocol.slug,
            tvlUsd: protocol.chainTvls?.[chainName] ?? protocol.tvl ?? 0,
            category: protocol.category,
          });

          if (result) {
            scanned++;
            totalFindings += result.findings.length;
          }
        }

        // Mark protocol as processed (rescan after 24h)
        await this.markProcessed(dedupKey, 86400);
      } catch (error) {
        this.logger.error(
          { protocol: protocol.name, error: (error as Error).message },
          'Protocol scan failed',
        );
      }
    }

    return { scanned, findings: totalFindings };
  }

  // ============================================================================
  // CONTRACT SCANNING
  // ============================================================================

  private async scanContract(
    prisma: any,
    request: ScanRequest,
  ): Promise<ScanResult | null> {
    const startTime = Date.now();

    this.logger.info(
      { address: request.address, chain: request.chainName, protocol: request.protocolName },
      'Scanning contract',
    );

    // 1. Fetch contract source from Etherscan
    const source = await this.withRetry(
      () => this.etherscan.getContractSource(request.chainId, request.address),
      'etherscan-source',
    );

    if (!source) {
      this.logger.info({ address: request.address }, 'Contract not verified, skipping');
      return null;
    }

    // 2. Upsert contract in database
    const contract = await prisma.smartContract.upsert({
      where: {
        address_chainId: {
          address: request.address,
          chainId: request.chainId,
        },
      },
      create: {
        address: request.address,
        chainId: request.chainId,
        chainName: request.chainName,
        name: source.name,
        compilerVersion: source.compilerVersion,
        sourceCode: source.sourceCode,
        abi: source.abi,
        isProxy: source.isProxy,
        implementationAddress: source.implementationAddress,
        protocolName: request.protocolName,
        protocolSlug: request.protocolSlug,
        tvlUsd: request.tvlUsd,
        category: request.category,
        verified: true,
      },
      update: {
        name: source.name,
        sourceCode: source.sourceCode,
        abi: source.abi,
        isProxy: source.isProxy,
        implementationAddress: source.implementationAddress,
        tvlUsd: request.tvlUsd,
        verified: true,
      },
    });

    // 3. Create scan record
    const scan = await prisma.contractScan.create({
      data: {
        contractId: contract.id,
        scanType: request.scanType,
        toolsUsed: ['slither'],
        status: 'RUNNING',
      },
    });

    const toolsUsed: ScanTool[] = ['slither'];
    let allFindings: EnrichedFinding[] = [];

    try {
      // 4. Run Slither static analysis
      const slitherFindings = await runSlither(
        source.sourceCode,
        source.name,
        source.compilerVersion,
        { excludeLow: false },
      );

      this.logger.info(
        { address: request.address, slitherFindings: slitherFindings.length },
        'Slither analysis complete',
      );

      // 5. AI enrichment (if enabled and there are significant findings)
      if (AI_ENRICHMENT_ENABLED && slitherFindings.some(f => f.severity !== 'INFORMATIONAL')) {
        toolsUsed.push('ai');
        allFindings = await analyzeFindings(
          source.sourceCode,
          source.name,
          slitherFindings,
          request.category,
        );
      } else {
        allFindings = slitherFindings.map(f => ({ ...f }));
      }

      // 6. Count by severity
      const counts = this.countBySeverity(allFindings);
      const durationMs = Date.now() - startTime;

      // 7. Store findings in database
      for (const finding of allFindings) {
        await prisma.scanFinding.upsert({
          where: {
            scanId_findingHash: {
              scanId: scan.id,
              findingHash: finding.findingHash,
            },
          },
          create: {
            scanId: scan.id,
            detector: finding.detector,
            tool: finding.tool,
            severity: finding.severity,
            confidence: finding.confidence,
            title: finding.title,
            description: finding.description,
            filePath: finding.filePath,
            lineNumbers: finding.lineNumbers,
            codeSnippet: finding.codeSnippet,
            aiAssessment: finding.aiAssessment,
            attackPath: finding.attackPath,
            recommendation: finding.recommendation,
            exploitability: finding.exploitability,
            findingHash: finding.findingHash,
          },
          update: {
            aiAssessment: finding.aiAssessment,
            attackPath: finding.attackPath,
            recommendation: finding.recommendation,
            exploitability: finding.exploitability,
          },
        });
      }

      // 8. Update scan record
      await prisma.contractScan.update({
        where: { id: scan.id },
        data: {
          status: 'COMPLETED',
          findingsCount: allFindings.length,
          criticalCount: counts.CRITICAL,
          highCount: counts.HIGH,
          mediumCount: counts.MEDIUM,
          lowCount: counts.LOW,
          infoCount: counts.INFORMATIONAL,
          durationMs,
          toolsUsed,
          slitherOutput: slitherFindings as any,
          completedAt: new Date(),
        },
      });

      // 9. Update contract last scan time
      await prisma.smartContract.update({
        where: { id: contract.id },
        data: { lastScannedAt: new Date() },
      });

      // 10. Send alerts for significant findings
      const overallSeverity = this.getOverallSeverity(allFindings);
      if (SEVERITY_ORDER[overallSeverity] >= SEVERITY_ORDER['MEDIUM']) {
        await this.alertService.sendAlert({
          contractAddress: request.address,
          chainName: request.chainName,
          contractName: source.name,
          protocolName: request.protocolName,
          tvlUsd: request.tvlUsd,
          scanId: scan.id,
          findings: allFindings,
          overallSeverity,
          summary: `Found ${allFindings.length} issues (${counts.CRITICAL} critical, ${counts.HIGH} high) in ${source.name} on ${request.chainName}.`,
        });

        // Also queue for Clawdbot
        await this.alertService.queueAlert({
          contractAddress: request.address,
          chainName: request.chainName,
          contractName: source.name,
          protocolName: request.protocolName,
          tvlUsd: request.tvlUsd,
          scanId: scan.id,
          findings: allFindings,
          overallSeverity,
          summary: `Found ${allFindings.length} issues in ${source.name} on ${request.chainName}.`,
        });
      }

      const result: ScanResult = {
        contractId: contract.id,
        scanId: scan.id,
        status: 'COMPLETED',
        findings: allFindings,
        criticalCount: counts.CRITICAL,
        highCount: counts.HIGH,
        mediumCount: counts.MEDIUM,
        lowCount: counts.LOW,
        infoCount: counts.INFORMATIONAL,
        durationMs,
        toolsUsed,
      };

      this.logger.info(
        {
          address: request.address,
          findings: allFindings.length,
          critical: counts.CRITICAL,
          high: counts.HIGH,
          durationMs,
        },
        'Contract scan complete',
      );

      return result;
    } catch (error) {
      const durationMs = Date.now() - startTime;

      // Update scan as failed
      await prisma.contractScan.update({
        where: { id: scan.id },
        data: {
          status: 'FAILED',
          errorMessage: (error as Error).message,
          durationMs,
          completedAt: new Date(),
        },
      });

      this.logger.error(
        { address: request.address, error: (error as Error).message },
        'Contract scan failed',
      );

      return null;
    }
  }

  // ============================================================================
  // HELPERS
  // ============================================================================

  /**
   * Resolve contract addresses for a protocol.
   * DeFiLlama's API primarily returns token addresses, so we use
   * the protocol details endpoint to find contract addresses.
   */
  private async resolveProtocolAddresses(
    protocol: any,
    chainId: number,
  ): Promise<string[]> {
    try {
      const details = await this.defillama.getProtocol(protocol.slug);
      const addresses: string[] = [];

      // Check for contract addresses in the protocol data
      if (details?.address) {
        addresses.push(details.address);
      }

      // Check chain-specific addresses
      const chainName = Object.entries(SUPPORTED_CHAINS)
        .find(([_, c]) => c.chainId === chainId)?.[1]?.name;

      if (chainName && details?.currentChainTvls) {
        // Protocol details may have addresses in various fields
        for (const key of Object.keys(details.currentChainTvls)) {
          if (key.toLowerCase().includes(chainName.toLowerCase())) {
            // Found chain-specific data
            break;
          }
        }
      }

      // If protocol has a token address, that's often the main contract
      if (details?.tokenAddress && addresses.length === 0) {
        addresses.push(details.tokenAddress);
      }

      return addresses.filter(a => a && a.startsWith('0x') && a.length === 42);
    } catch {
      return [];
    }
  }

  private countBySeverity(findings: EnrichedFinding[]): Record<ScanSeverity, number> {
    const counts: Record<ScanSeverity, number> = {
      CRITICAL: 0,
      HIGH: 0,
      MEDIUM: 0,
      LOW: 0,
      INFORMATIONAL: 0,
    };

    for (const f of findings) {
      counts[f.severity]++;
    }

    return counts;
  }

  private getOverallSeverity(findings: EnrichedFinding[]): ScanSeverity {
    let highest: ScanSeverity = 'INFORMATIONAL';

    for (const f of findings) {
      if (SEVERITY_ORDER[f.severity] > SEVERITY_ORDER[highest]) {
        highest = f.severity;
      }
    }

    return highest;
  }
}

// ============================================================================
// EXPORT SINGLETON
// ============================================================================

export const contractScannerWorker = new ContractScannerWorker();
