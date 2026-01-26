/**
 * SMART CONTRACT SCANNER TYPES
 *
 * Shared type definitions for the vulnerability scanning pipeline.
 */

// ============================================================================
// SLITHER TYPES
// ============================================================================

export interface SlitherResult {
  success: boolean;
  error?: string;
  results?: {
    detectors: SlitherFinding[];
  };
}

export interface SlitherFinding {
  check: string;
  impact: 'High' | 'Medium' | 'Low' | 'Informational';
  confidence: 'High' | 'Medium' | 'Low';
  description: string;
  markdown?: string;
  first_markdown_element?: string;
  elements: SlitherElement[];
}

export interface SlitherElement {
  type: string;
  name: string;
  source_mapping: {
    start: number;
    length: number;
    filename_relative: string;
    filename_absolute: string;
    filename_short: string;
    lines: number[];
  };
  type_specific_fields?: Record<string, unknown>;
}

// ============================================================================
// SCANNER TYPES
// ============================================================================

export type ScanSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFORMATIONAL';
export type ScanConfidence = 'HIGH' | 'MEDIUM' | 'LOW';
export type ScanTool = 'slither' | 'aderyn' | 'semgrep' | 'ai';
export type ScanType = 'FULL' | 'QUICK' | 'DEEP';
export type ScanStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
export type AIAssessment = 'TRUE_POSITIVE' | 'FALSE_POSITIVE' | 'NEEDS_REVIEW';
export type Exploitability = 'EXPLOITABLE' | 'THEORETICAL' | 'UNLIKELY';

export interface NormalizedFinding {
  detector: string;
  tool: ScanTool;
  severity: ScanSeverity;
  confidence: ScanConfidence;
  title: string;
  description: string;
  filePath?: string;
  lineNumbers: number[];
  codeSnippet?: string;
  findingHash: string;
}

export interface EnrichedFinding extends NormalizedFinding {
  aiAssessment?: AIAssessment;
  attackPath?: string;
  recommendation?: string;
  exploitability?: Exploitability;
}

export interface ScanRequest {
  address: string;
  chainId: number;
  chainName: string;
  scanType: ScanType;
  protocolName?: string;
  protocolSlug?: string;
  tvlUsd?: number;
  category?: string;
}

export interface ScanResult {
  contractId: string;
  scanId: string;
  status: ScanStatus;
  findings: EnrichedFinding[];
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  infoCount: number;
  durationMs: number;
  toolsUsed: ScanTool[];
  errorMessage?: string;
}

// ============================================================================
// AI ANALYSIS TYPES
// ============================================================================

export interface AIVulnerabilityAnalysis {
  findings: AIFindingAssessment[];
  additionalFindings: AIAdditionalFinding[];
  overallRisk: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  summary: string;
}

export interface AIFindingAssessment {
  detector: string;
  assessment: AIAssessment;
  exploitability: Exploitability;
  attackPath?: string;
  recommendation: string;
}

export interface AIAdditionalFinding {
  title: string;
  description: string;
  severity: ScanSeverity;
  category: string; // flash-loan, oracle-manipulation, mev, reentrancy, etc.
  attackPath?: string;
  recommendation: string;
}

// ============================================================================
// ALERT TYPES
// ============================================================================

export interface ScanAlertData {
  contractAddress: string;
  chainName: string;
  contractName?: string;
  protocolName?: string;
  tvlUsd?: number;
  scanId: string;
  findings: EnrichedFinding[];
  overallSeverity: ScanSeverity;
  summary: string;
}
