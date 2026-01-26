/**
 * SLITHER STATIC ANALYSIS RUNNER
 *
 * Runs Slither against Solidity contracts and normalizes findings.
 * Slither has ~10.9% false positive rate and sub-second execution.
 *
 * Features:
 * - Writes contract source to temp directory
 * - Runs Slither via subprocess
 * - Parses JSON output
 * - Normalizes findings to common format
 * - Cleanup of temp files
 */

import { spawn } from 'child_process';
import { createHash } from 'crypto';
import { mkdtemp, writeFile, readFile, rm, mkdir } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import pino from 'pino';

import type {
  SlitherResult,
  SlitherFinding,
  NormalizedFinding,
  ScanSeverity,
  ScanConfidence,
} from './types.js';

const logger = pino({ name: 'slither-runner' });

// ============================================================================
// SEVERITY MAPPING
// ============================================================================

function mapSeverity(impact: string): ScanSeverity {
  switch (impact.toLowerCase()) {
    case 'high':
      return 'HIGH';
    case 'medium':
      return 'MEDIUM';
    case 'low':
      return 'LOW';
    case 'informational':
      return 'INFORMATIONAL';
    default:
      return 'LOW';
  }
}

function mapConfidence(confidence: string): ScanConfidence {
  switch (confidence.toLowerCase()) {
    case 'high':
      return 'HIGH';
    case 'medium':
      return 'MEDIUM';
    case 'low':
      return 'LOW';
    default:
      return 'LOW';
  }
}

// Detectors that indicate critical severity (override Slither's "High")
const CRITICAL_DETECTORS = new Set([
  'reentrancy-eth',
  'arbitrary-send-eth',
  'controlled-delegatecall',
  'suicidal',
  'unprotected-upgrade',
]);

// ============================================================================
// RUNNER
// ============================================================================

export interface SlitherRunnerConfig {
  timeoutMs?: number;
  excludeLow?: boolean;
  filterPaths?: string[];
}

/**
 * Run Slither analysis on a Solidity contract source
 */
export async function runSlither(
  sourceCode: string,
  contractName: string,
  compilerVersion?: string,
  config: SlitherRunnerConfig = {},
): Promise<NormalizedFinding[]> {
  const {
    timeoutMs = 120_000,
    excludeLow = false,
    filterPaths = ['node_modules', 'test', 'tests', 'mock'],
  } = config;

  // Create temp directory for contract
  const tempDir = await mkdtemp(join(tmpdir(), 'slither-scan-'));
  const contractPath = join(tempDir, `${contractName || 'Contract'}.sol`);
  const outputPath = join(tempDir, 'slither-output.json');

  try {
    // Write source code
    // Handle Etherscan's multi-source format (JSON with sources object)
    let finalSourceCode = sourceCode;
    if (sourceCode.startsWith('{{') || sourceCode.startsWith('{')) {
      try {
        const parsed = JSON.parse(sourceCode.startsWith('{{')
          ? sourceCode.slice(1, -1)
          : sourceCode);

        if (parsed.sources) {
          // Multi-file contract - write each source file
          for (const [filePath, fileData] of Object.entries(parsed.sources as Record<string, { content: string }>)) {
            const fullPath = join(tempDir, filePath);
            const dir = fullPath.substring(0, fullPath.lastIndexOf('/'));
            await mkdir(dir, { recursive: true });
            await writeFile(fullPath, fileData.content, 'utf-8');
          }
          // Point to the main contract
          const mainFile = Object.keys(parsed.sources).find(
            f => f.includes(contractName) || f.endsWith('.sol')
          );
          if (mainFile) {
            return await executeSlither(
              join(tempDir, mainFile),
              outputPath,
              timeoutMs,
              excludeLow,
              filterPaths,
              compilerVersion,
            );
          }
        }
      } catch {
        // Not JSON, treat as plain source
      }
    }

    await writeFile(contractPath, finalSourceCode, 'utf-8');

    return await executeSlither(
      contractPath,
      outputPath,
      timeoutMs,
      excludeLow,
      filterPaths,
      compilerVersion,
    );
  } finally {
    // Cleanup temp directory
    await rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}

async function executeSlither(
  contractPath: string,
  outputPath: string,
  timeoutMs: number,
  excludeLow: boolean,
  filterPaths: string[],
  compilerVersion?: string,
): Promise<NormalizedFinding[]> {
  const args = [
    contractPath,
    '--json', outputPath,
  ];

  if (excludeLow) {
    args.push('--exclude-low');
  }

  if (filterPaths.length > 0) {
    args.push('--filter-paths', filterPaths.join('|'));
  }

  // Set solc version if specified
  if (compilerVersion) {
    const version = compilerVersion.replace(/^v/, '').split('+')[0];
    args.push('--solc-solcs-select', version);
  }

  return new Promise((resolve, reject) => {
    const slither = spawn('slither', args, {
      timeout: timeoutMs,
      env: {
        ...process.env,
        // Suppress Slither's color output
        NO_COLOR: '1',
      },
    });

    let stderr = '';
    slither.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    slither.on('close', async (code) => {
      try {
        // Slither exits with non-zero when findings exist, so don't check code
        const outputContent = await readFile(outputPath, 'utf-8').catch(() => null);

        if (!outputContent) {
          // No output file - could be a compilation error
          if (stderr.includes('Compilation')) {
            logger.warn({ stderr: stderr.slice(0, 500) }, 'Slither compilation error');
            resolve([]);
            return;
          }
          logger.warn({ code, stderr: stderr.slice(0, 500) }, 'Slither produced no output');
          resolve([]);
          return;
        }

        const result: SlitherResult = JSON.parse(outputContent);

        if (!result.success && result.error) {
          logger.warn({ error: result.error }, 'Slither analysis error');
          resolve([]);
          return;
        }

        const findings = result.results?.detectors ?? [];
        const normalized = findings.map(normalizeSlitherFinding);

        logger.info(
          { findingsCount: normalized.length },
          'Slither analysis complete',
        );

        resolve(normalized);
      } catch (error) {
        logger.error({ error: (error as Error).message }, 'Error parsing Slither output');
        resolve([]);
      }
    });

    slither.on('error', (error) => {
      if ((error as any).code === 'ENOENT') {
        logger.error('Slither not found. Install with: pip install slither-analyzer');
        resolve([]);
      } else {
        reject(error);
      }
    });
  });
}

// ============================================================================
// NORMALIZATION
// ============================================================================

function normalizeSlitherFinding(finding: SlitherFinding): NormalizedFinding {
  const severity = CRITICAL_DETECTORS.has(finding.check)
    ? 'CRITICAL'
    : mapSeverity(finding.impact);

  const filePath = finding.elements?.[0]?.source_mapping?.filename_relative;
  const lineNumbers = finding.elements?.[0]?.source_mapping?.lines ?? [];

  // Generate dedup hash from detector + location
  const hashInput = [
    finding.check,
    severity,
    filePath ?? '',
    lineNumbers.join(','),
  ].join('|');

  const findingHash = createHash('sha256').update(hashInput).digest('hex').slice(0, 16);

  // Build a readable title from the check name
  const title = finding.check
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

  return {
    detector: finding.check,
    tool: 'slither',
    severity,
    confidence: mapConfidence(finding.confidence),
    title,
    description: finding.description || finding.markdown || '',
    filePath,
    lineNumbers,
    codeSnippet: finding.first_markdown_element,
    findingHash,
  };
}
