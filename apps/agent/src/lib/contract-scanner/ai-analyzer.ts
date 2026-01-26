/**
 * AI-AUGMENTED VULNERABILITY ANALYSIS
 *
 * Uses LLM to contextualize static analysis findings:
 * - Assess true/false positives
 * - Identify attack paths
 * - Detect business logic flaws tools miss
 * - Deduplicate overlapping tool findings
 *
 * Supports Groq (primary) and DeepSeek (fallback).
 */

import OpenAI from 'openai';
import { createHash } from 'crypto';
import pino from 'pino';

import type {
  NormalizedFinding,
  EnrichedFinding,
  AIVulnerabilityAnalysis,
  AIAssessment,
  Exploitability,
  ScanSeverity,
} from './types.js';

const logger = pino({ name: 'ai-analyzer' });

// ============================================================================
// CONFIGURATION
// ============================================================================

const GROQ_API_KEY = process.env.GROQ_API_KEY || '';
const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.1-8b-instant';
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || '';

// In-memory analysis cache (1 hour TTL)
const analysisCache = new Map<string, { result: EnrichedFinding[]; expiresAt: number }>();
const CACHE_TTL_MS = 60 * 60 * 1000;

// ============================================================================
// MAIN ENTRY POINT
// ============================================================================

/**
 * Enrich static analysis findings with AI assessment.
 * Only processes medium+ severity findings to manage costs.
 */
export async function analyzeFindings(
  sourceCode: string,
  contractName: string,
  findings: NormalizedFinding[],
  protocolType?: string,
): Promise<EnrichedFinding[]> {
  if (!isAIAnalysisEnabled()) {
    logger.info('AI analysis disabled, returning findings unmodified');
    return findings.map(f => ({ ...f }));
  }

  // Check cache
  const cacheKey = createHash('sha256')
    .update(findings.map(f => f.findingHash).join('|'))
    .digest('hex')
    .slice(0, 16);

  const cached = analysisCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.result;
  }

  // Only send medium+ to AI (cost optimization)
  const significantFindings = findings.filter(
    f => f.severity !== 'LOW' && f.severity !== 'INFORMATIONAL',
  );

  if (significantFindings.length === 0) {
    return findings.map(f => ({ ...f }));
  }

  try {
    const analysis = await callLLMAnalysis(
      sourceCode,
      contractName,
      significantFindings,
      protocolType,
    );

    const enriched = mergeAIAnalysis(findings, analysis);

    // Cache result
    analysisCache.set(cacheKey, {
      result: enriched,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });

    // Clean old entries
    cleanCache();

    return enriched;
  } catch (error) {
    logger.warn(
      { error: (error as Error).message },
      'AI analysis failed, returning unmodified findings',
    );
    return findings.map(f => ({ ...f }));
  }
}

// ============================================================================
// LLM CALL
// ============================================================================

async function callLLMAnalysis(
  sourceCode: string,
  contractName: string,
  findings: NormalizedFinding[],
  protocolType?: string,
): Promise<AIVulnerabilityAnalysis> {
  const client = getClient();
  const model = getModel();

  // Truncate source to avoid token limits
  const truncatedSource = sourceCode.length > 8000
    ? sourceCode.slice(0, 8000) + '\n// ... [truncated]'
    : sourceCode;

  const findingsSummary = findings
    .map((f, i) => `${i + 1}. [${f.severity}/${f.confidence}] ${f.detector}: ${f.description.slice(0, 200)}`)
    .join('\n');

  const prompt = `You are a senior smart contract security auditor specializing in DeFi protocols.

CONTRACT: ${contractName}${protocolType ? ` (${protocolType} protocol)` : ''}

SOURCE CODE:
\`\`\`solidity
${truncatedSource}
\`\`\`

STATIC ANALYSIS FINDINGS:
${findingsSummary}

TASK: For each finding, assess:
1. TRUE_POSITIVE, FALSE_POSITIVE, or NEEDS_REVIEW
2. EXPLOITABLE, THEORETICAL, or UNLIKELY
3. Attack path if exploitable (1 sentence)
4. Recommended fix (1 sentence)

Also identify any ADDITIONAL business logic issues the tools missed, especially:
- Flash loan attack vectors
- Oracle manipulation opportunities
- MEV exposure (sandwich attacks, frontrunning)
- Cross-contract reentrancy
- Access control gaps

Respond in this EXACT format for each static finding:

FINDING_1: TRUE_POSITIVE | EXPLOITABLE | Attack: [path] | Fix: [recommendation]
FINDING_2: FALSE_POSITIVE | UNLIKELY | Attack: N/A | Fix: N/A
...

ADDITIONAL:
- [SEVERITY] [Title]: [Description] | Attack: [path] | Fix: [recommendation]

OVERALL_RISK: [CRITICAL/HIGH/MEDIUM/LOW]
SUMMARY: [1-2 sentence summary]`;

  const completion = await client.chat.completions.create({
    model,
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 1500,
    temperature: 0.2,
  });

  const response = completion.choices[0]?.message?.content || '';
  return parseAIResponse(response);
}

// ============================================================================
// RESPONSE PARSING
// ============================================================================

function parseAIResponse(response: string): AIVulnerabilityAnalysis {
  const findingAssessments: AIVulnerabilityAnalysis['findings'] = [];
  const additionalFindings: AIVulnerabilityAnalysis['additionalFindings'] = [];

  // Parse individual finding assessments
  const findingRegex = /FINDING_(\d+):\s*(TRUE_POSITIVE|FALSE_POSITIVE|NEEDS_REVIEW)\s*\|\s*(EXPLOITABLE|THEORETICAL|UNLIKELY)\s*\|\s*Attack:\s*(.*?)\s*\|\s*Fix:\s*(.*?)(?:\n|$)/gi;
  let match;
  while ((match = findingRegex.exec(response)) !== null) {
    findingAssessments.push({
      detector: `finding_${match[1]}`,
      assessment: match[2].toUpperCase() as AIAssessment,
      exploitability: match[3].toUpperCase() as Exploitability,
      attackPath: match[4] !== 'N/A' ? match[4] : undefined,
      recommendation: match[5] !== 'N/A' ? match[5] : '',
    });
  }

  // Parse additional findings
  const additionalRegex = /- \[(CRITICAL|HIGH|MEDIUM|LOW)\]\s*(.*?):\s*(.*?)\s*\|\s*Attack:\s*(.*?)\s*\|\s*Fix:\s*(.*?)(?:\n|$)/gi;
  while ((match = additionalRegex.exec(response)) !== null) {
    additionalFindings.push({
      title: match[2].trim(),
      description: match[3].trim(),
      severity: match[1].toUpperCase() as ScanSeverity,
      category: categorizeAdditionalFinding(match[2]),
      attackPath: match[4] !== 'N/A' ? match[4].trim() : undefined,
      recommendation: match[5] !== 'N/A' ? match[5].trim() : '',
    });
  }

  // Parse overall risk
  const riskMatch = response.match(/OVERALL_RISK:\s*(CRITICAL|HIGH|MEDIUM|LOW)/i);
  const overallRisk = (riskMatch?.[1]?.toUpperCase() ?? 'MEDIUM') as AIVulnerabilityAnalysis['overallRisk'];

  // Parse summary
  const summaryMatch = response.match(/SUMMARY:\s*(.+?)$/im);
  const summary = summaryMatch?.[1]?.trim() ?? 'Analysis complete.';

  return {
    findings: findingAssessments,
    additionalFindings,
    overallRisk,
    summary,
  };
}

function categorizeAdditionalFinding(title: string): string {
  const lower = title.toLowerCase();
  if (lower.includes('flash loan')) return 'flash-loan';
  if (lower.includes('oracle')) return 'oracle-manipulation';
  if (lower.includes('mev') || lower.includes('sandwich') || lower.includes('frontrun')) return 'mev';
  if (lower.includes('reentrancy')) return 'reentrancy';
  if (lower.includes('access')) return 'access-control';
  if (lower.includes('overflow') || lower.includes('underflow')) return 'arithmetic';
  return 'business-logic';
}

// ============================================================================
// MERGE AI RESULTS WITH STATIC FINDINGS
// ============================================================================

function mergeAIAnalysis(
  findings: NormalizedFinding[],
  analysis: AIVulnerabilityAnalysis,
): EnrichedFinding[] {
  const enriched: EnrichedFinding[] = [];

  // Enrich existing findings with AI assessments
  for (let i = 0; i < findings.length; i++) {
    const finding = findings[i];
    const aiAssessment = analysis.findings[i]; // Positional matching

    enriched.push({
      ...finding,
      aiAssessment: aiAssessment?.assessment,
      attackPath: aiAssessment?.attackPath,
      recommendation: aiAssessment?.recommendation,
      exploitability: aiAssessment?.exploitability,
    });
  }

  // Add AI-detected additional findings
  for (const additional of analysis.additionalFindings) {
    const hashInput = `ai|${additional.title}|${additional.severity}`;
    const findingHash = createHash('sha256').update(hashInput).digest('hex').slice(0, 16);

    enriched.push({
      detector: `ai-${additional.category}`,
      tool: 'ai',
      severity: additional.severity,
      confidence: 'MEDIUM', // AI findings get medium confidence by default
      title: additional.title,
      description: additional.description,
      lineNumbers: [],
      findingHash,
      aiAssessment: 'NEEDS_REVIEW',
      attackPath: additional.attackPath,
      recommendation: additional.recommendation,
      exploitability: 'THEORETICAL',
    });
  }

  return enriched;
}

// ============================================================================
// CLIENT HELPERS
// ============================================================================

function getClient(): OpenAI {
  if (GROQ_API_KEY) {
    return new OpenAI({
      baseURL: 'https://api.groq.com/openai/v1',
      apiKey: GROQ_API_KEY,
    });
  }

  if (DEEPSEEK_API_KEY) {
    return new OpenAI({
      baseURL: 'https://api.deepseek.com',
      apiKey: DEEPSEEK_API_KEY,
    });
  }

  throw new Error('No AI provider configured (GROQ_API_KEY or DEEPSEEK_API_KEY required)');
}

function getModel(): string {
  if (GROQ_API_KEY) return GROQ_MODEL;
  if (DEEPSEEK_API_KEY) return 'deepseek-chat';
  return GROQ_MODEL;
}

export function isAIAnalysisEnabled(): boolean {
  return !!(GROQ_API_KEY || DEEPSEEK_API_KEY);
}

// ============================================================================
// CACHE MANAGEMENT
// ============================================================================

function cleanCache(): void {
  const now = Date.now();
  for (const [key, entry] of analysisCache.entries()) {
    if (entry.expiresAt < now) {
      analysisCache.delete(key);
    }
  }
  // Limit size
  if (analysisCache.size > 500) {
    const entries = Array.from(analysisCache.entries())
      .sort((a, b) => a[1].expiresAt - b[1].expiresAt);
    for (const [key] of entries.slice(0, entries.length - 500)) {
      analysisCache.delete(key);
    }
  }
}
