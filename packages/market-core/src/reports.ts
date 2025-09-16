// Report generation utilities for JSON, CSV, and Markdown formats
// Provides consistent reporting across all pipeline components

import fs from 'fs';
import path from 'path';
import { ArbitrageOpportunity, CanonicalListing, PipelineResults, ReportOptions, MarketSource, CollectionSlug } from './types';

// Report data interfaces
export interface ReportData {
  timestamp: string;
  pipelineResults: PipelineResults;
  opportunities: ArbitrageOpportunity[];
  listings: CanonicalListing[];
  collections?: Map<CollectionSlug, ArbitrageOpportunity[]>;
  metadata: {
    sources: MarketSource[];
    mode: string;
    totalDuration: number;
    version: string;
  };
}

export interface CollectionReportData {
  collectionSlug: CollectionSlug;
  opportunities: ArbitrageOpportunity[];
  statistics: {
    totalOpportunities: number;
    averageMargin: number;
    totalProfit: number;
    riskDistribution: { low: number; medium: number; high: number };
    topOpportunities: ArbitrageOpportunity[];
  };
}

/**
 * Write summary report in Markdown format
 */
export async function writeSummaryMd(
  data: ReportData,
  outputPath: string,
  options: ReportOptions = { format: 'json' }
): Promise<void> {
  const { topN = 20, filters } = options;
  const filteredOpportunities = applyFilters(data.opportunities, filters);
  
  const markdown = generateSummaryMarkdown(data, filteredOpportunities, topN);
  
  await fs.promises.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.promises.writeFile(outputPath, markdown, 'utf8');
}

/**
 * Write opportunities in CSV format
 */
export async function writeOpportunitiesCsv(
  opportunities: ArbitrageOpportunity[],
  outputPath: string,
  options: ReportOptions = { format: 'json' }
): Promise<void> {
  const filteredOpportunities = applyFilters(opportunities, options.filters);
  
  const csv = generateOpportunitiesCsv(filteredOpportunities);
  
  await fs.promises.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.promises.writeFile(outputPath, csv, 'utf8');
}

/**
 * Write quality report in JSON format
 */
export async function writeQualityJson(
  data: ReportData,
  outputPath: string
): Promise<void> {
  const qualityData = {
    timestamp: data.timestamp,
    pipelineResults: data.pipelineResults,
    dataQuality: {
      totalListings: data.listings.length,
      averageQualityScore: calculateAverageQualityScore(data.listings),
      qualityDistribution: calculateQualityDistribution(data.listings),
      issues: extractQualityIssues(data.listings)
    },
    metadata: data.metadata
  };
  
  await fs.promises.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.promises.writeFile(outputPath, JSON.stringify(qualityData, null, 2), 'utf8');
}

/**
 * Write collection-specific reports
 */
export async function writeCollectionReports(
  data: ReportData,
  outputDir: string,
  options: ReportOptions = { format: 'json' }
): Promise<void> {
  if (!data.collections) {
    return;
  }
  
  for (const [collectionSlug, opportunities] of data.collections) {
    const collectionData: CollectionReportData = {
      collectionSlug,
      opportunities,
      statistics: calculateCollectionStatistics(opportunities)
    };
    
    const collectionDir = path.join(outputDir, collectionSlug);
    await fs.promises.mkdir(collectionDir, { recursive: true });
    
    // Write collection summary
    const summaryPath = path.join(collectionDir, 'summary.md');
    await writeCollectionSummary(collectionData, summaryPath);
    
    // Write collection opportunities
    const csvPath = path.join(collectionDir, 'opportunities.csv');
    await writeOpportunitiesCsv(opportunities, csvPath, options);
    
    // Write collection JSON
    const jsonPath = path.join(collectionDir, 'data.json');
    await fs.promises.writeFile(jsonPath, JSON.stringify(collectionData, null, 2), 'utf8');
  }
}

/**
 * Generate comprehensive report directory structure
 */
export async function generateReportDirectory(
  data: ReportData,
  baseOutputDir: string,
  options: ReportOptions = { format: 'json' }
): Promise<void> {
  const timestamp = new Date().toISOString().split('T')[0];
  const reportDir = path.join(baseOutputDir, timestamp);
  
  // Create main report files
  await writeSummaryMd(data, path.join(reportDir, 'summary.md'), options);
  await writeOpportunitiesCsv(data.opportunities, path.join(reportDir, 'opportunities.csv'), options);
  await writeQualityJson(data, path.join(reportDir, 'quality.json'));
  
  // Create global JSON export
  await fs.promises.writeFile(
    path.join(reportDir, 'complete-data.json'),
    JSON.stringify(data, null, 2),
    'utf8'
  );
  
  // Create collection reports
  await writeCollectionReports(data, path.join(reportDir, 'collections'), options);
  
  // Create README for the report directory
  await writeReportReadme(data, reportDir, options);
}

/**
 * Apply filters to opportunities
 */
function applyFilters(
  opportunities: ArbitrageOpportunity[],
  filters?: ReportOptions['filters']
): ArbitrageOpportunity[] {
  if (!filters) {
    return opportunities;
  }
  
  return opportunities.filter(opportunity => {
    if (filters.minProfitMargin && opportunity.marginPct < filters.minProfitMargin) {
      return false;
    }
    
    if (filters.maxRisk && opportunity.risk > filters.maxRisk) {
      return false;
    }
    
    if (filters.minConfidence && opportunity.confidence < filters.minConfidence) {
      return false;
    }
    
    if (filters.collections && !filters.collections.some(c => opportunity.collectionTags.includes(c))) {
      return false;
    }
    
    if (filters.sources && !filters.sources.includes(opportunity.source)) {
      return false;
    }
    
    return true;
  });
}

/**
 * Generate summary markdown
 */
function generateSummaryMarkdown(
  data: ReportData,
  opportunities: ArbitrageOpportunity[],
  topN: number
): string {
  const { pipelineResults, metadata } = data;
  const topOpportunities = opportunities.slice(0, topN);
  
  return `# Market Pipeline Report

## Executive Summary
- **Generated**: ${data.timestamp}
- **Sources**: ${metadata.sources.join(', ')}
- **Mode**: ${metadata.mode}
- **Duration**: ${formatDuration(metadata.totalDuration)}
- **Total Opportunities**: ${opportunities.length.toLocaleString()}
- **Total Profit Potential**: $${opportunities.reduce((sum, o) => sum + o.netProfit, 0).toLocaleString()}

## Pipeline Results

### Source Breakdown
${Object.entries(pipelineResults.sources).map(([source, stats]) => `
#### ${source}
- Records Processed: ${stats.recordsProcessed.toLocaleString()}
- Records Cleaned: ${stats.recordsCleaned.toLocaleString()}
- Records Matched: ${stats.recordsMatched.toLocaleString()}
- Opportunities Found: ${stats.opportunitiesFound.toLocaleString()}
- Errors: ${stats.errors.toLocaleString()}
`).join('\n')}

### Global Statistics
- **Total Listings**: ${pipelineResults.global.totalListings.toLocaleString()}
- **Total Opportunities**: ${pipelineResults.global.totalOpportunities.toLocaleString()}
- **Average Profit Margin**: ${pipelineResults.global.avgProfitMargin.toFixed(1)}%
- **Total Profit Potential**: $${pipelineResults.global.totalProfitPotential.toLocaleString()}

## Top ${topN} Opportunities

${topOpportunities.map((opp, i) => `
### ${i + 1}. ${opp.canonicalId} (${opp.source})
- **Price**: $${(opp.expectedResale / 100).toLocaleString()}
- **Profit**: $${(opp.netProfit / 100).toLocaleString()} (${opp.marginPct.toFixed(1)}%)
- **Risk**: ${opp.risk} | **Confidence**: ${(opp.confidence * 100).toFixed(1)}%
- **Liquidity**: ${opp.liquidity} | **Velocity**: ${(opp.velocity * 100).toFixed(1)}%
- **Collections**: ${opp.collectionTags.join(', ') || 'None'}
`).join('\n')}

## Risk Analysis

### Risk Distribution
${calculateRiskDistribution(opportunities)}

### Confidence Analysis
${calculateConfidenceAnalysis(opportunities)}

## Recommendations

1. **High-Confidence Opportunities**: Focus on opportunities with confidence > 80%
2. **Risk Management**: Prioritize LOW and MEDIUM risk opportunities
3. **Liquidity**: Consider HIGH liquidity cards for faster turnover
4. **Market Timing**: Monitor demand trends for optimal entry points

---
*Report generated by Market Pipeline v${metadata.version}*
`;
}

/**
 * Generate opportunities CSV
 */
function generateOpportunitiesCsv(opportunities: ArbitrageOpportunity[]): string {
  const headers = [
    'ID',
    'Card Name',
    'Set Code',
    'Card Number',
    'Grade',
    'Grading Company',
    'Source',
    'Expected Resale',
    'Net Profit',
    'Margin %',
    'Liquidity',
    'Velocity',
    'Demand',
    'Volatility',
    'Confidence',
    'Risk Level',
    'Collection Tags',
    'Created At'
  ];
  
  const rows = opportunities.map(opp => [
    opp.id,
    opp.canonicalId,
    opp.source,
    opp.risk,
    opp.liquidity,
    '',
    opp.source,
    opp.expectedResale,
    opp.netProfit,
    opp.marginPct.toFixed(2),
    opp.liquidity,
    opp.velocity.toFixed(3),
    opp.demand,
    opp.volatility.toFixed(3),
    opp.confidence.toFixed(3),
    opp.risk,
    opp.collectionTags.join(';'),
    opp.createdAt.toISOString()
  ]);
  
  return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
}

/**
 * Write collection summary
 */
async function writeCollectionSummary(
  data: CollectionReportData,
  outputPath: string
): Promise<void> {
  const { collectionSlug, opportunities, statistics } = data;
  
  const markdown = `# Collection Report: ${collectionSlug}

## Summary
- **Total Opportunities**: ${statistics.totalOpportunities.toLocaleString()}
- **Average Margin**: ${statistics.averageMargin.toFixed(1)}%
- **Total Profit Potential**: $${(statistics.totalProfit / 100).toLocaleString()}

## Risk Distribution
- **Low Risk**: ${statistics.riskDistribution.low}
- **Medium Risk**: ${statistics.riskDistribution.medium}
- **High Risk**: ${statistics.riskDistribution.high}

## Top Opportunities

${statistics.topOpportunities.slice(0, 10).map((opp, i) => `
### ${i + 1}. ${opp.canonicalId}
- **Profit**: $${(opp.netProfit / 100).toLocaleString()} (${opp.marginPct.toFixed(1)}%)
- **Risk**: ${opp.risk} | **Confidence**: ${(opp.confidence * 100).toFixed(1)}%
- **Source**: ${opp.source}
`).join('\n')}

---
*Generated: ${new Date().toISOString()}*
`;
  
  await fs.promises.writeFile(outputPath, markdown, 'utf8');
}

/**
 * Write report README
 */
async function writeReportReadme(
  data: ReportData,
  outputDir: string,
  options: ReportOptions
): Promise<void> {
  const readme = `# Market Pipeline Report

Generated: ${data.timestamp}

## Files

- \`summary.md\` - Executive summary and analysis
- \`opportunities.csv\` - Complete opportunities data for spreadsheet analysis
- \`quality.json\` - Data quality metrics and pipeline results
- \`complete-data.json\` - Full dataset export
- \`collections/\` - Collection-specific reports

## Usage

1. Review the summary for key insights
2. Import the CSV into Excel/Google Sheets for detailed analysis
3. Check collection-specific reports for targeted analysis
4. Use the JSON files for programmatic analysis

## Filters Applied

${options.filters ? Object.entries(options.filters).map(([key, value]) => `- ${key}: ${value}`).join('\n') : 'None'}

---
*Generated by Market Pipeline*
`;
  
  await fs.promises.writeFile(path.join(outputDir, 'README.md'), readme, 'utf8');
}

/**
 * Calculate average quality score
 */
function calculateAverageQualityScore(listings: CanonicalListing[]): number {
  if (listings.length === 0) return 0;
  
  const totalScore = listings.reduce((sum, listing) => 
    sum + (listing.dataQualityScore || 0), 0);
  
  return Math.round((totalScore / listings.length) * 1000) / 1000;
}

/**
 * Calculate quality distribution
 */
function calculateQualityDistribution(listings: CanonicalListing[]): Record<string, number> {
  const distribution: Record<string, number> = {
    'excellent': 0,
    'good': 0,
    'fair': 0,
    'poor': 0
  };
  
  for (const listing of listings) {
    const score = listing.dataQualityScore || 0;
    
    if (score >= 0.8) distribution.excellent++;
    else if (score >= 0.6) distribution.good++;
    else if (score >= 0.4) distribution.fair++;
    else distribution.poor++;
  }
  
  return distribution;
}

/**
 * Extract quality issues
 */
function extractQualityIssues(listings: CanonicalListing[]): string[] {
  const issues: string[] = [];
  
  const missingFields = {
    cardName: 0,
    setName: 0,
    cardNumber: 0,
    url: 0
  };
  
  for (const listing of listings) {
    if (!listing.cardName) missingFields.cardName++;
    if (!listing.setName) missingFields.setName++;
    if (!listing.cardNumber) missingFields.cardNumber++;
    if (!listing.url) missingFields.url++;
  }
  
  if (missingFields.cardName > 0) {
    issues.push(`Missing card names: ${missingFields.cardName}`);
  }
  if (missingFields.setName > 0) {
    issues.push(`Missing set names: ${missingFields.setName}`);
  }
  if (missingFields.cardNumber > 0) {
    issues.push(`Missing card numbers: ${missingFields.cardNumber}`);
  }
  if (missingFields.url > 0) {
    issues.push(`Missing URLs: ${missingFields.url}`);
  }
  
  return issues;
}

/**
 * Calculate collection statistics
 */
function calculateCollectionStatistics(opportunities: ArbitrageOpportunity[]): CollectionReportData['statistics'] {
  if (opportunities.length === 0) {
    return {
      totalOpportunities: 0,
      averageMargin: 0,
      totalProfit: 0,
      riskDistribution: { low: 0, medium: 0, high: 0 },
      topOpportunities: []
    };
  }
  
  const averageMargin = opportunities.reduce((sum, o) => sum + o.marginPct, 0) / opportunities.length;
  const totalProfit = opportunities.reduce((sum, o) => sum + o.netProfit, 0);
  
  const riskDistribution = opportunities.reduce((acc, o) => {
    acc[o.risk.toLowerCase() as keyof typeof acc]++;
    return acc;
  }, { low: 0, medium: 0, high: 0 });
  
  const topOpportunities = opportunities
    .sort((a, b) => b.netProfit - a.netProfit)
    .slice(0, 10);
  
  return {
    totalOpportunities: opportunities.length,
    averageMargin: Math.round(averageMargin * 100) / 100,
    totalProfit: Math.round(totalProfit),
    riskDistribution,
    topOpportunities
  };
}

/**
 * Calculate risk distribution
 */
function calculateRiskDistribution(opportunities: ArbitrageOpportunity[]): string {
  const distribution = opportunities.reduce((acc, o) => {
    acc[o.risk.toLowerCase() as keyof typeof acc]++;
    return acc;
  }, { low: 0, medium: 0, high: 0 });
  
  const total = opportunities.length;
  
  return `
- **Low Risk**: ${distribution.low} (${((distribution.low / total) * 100).toFixed(1)}%)
- **Medium Risk**: ${distribution.medium} (${((distribution.medium / total) * 100).toFixed(1)}%)
- **High Risk**: ${distribution.high} (${((distribution.high / total) * 100).toFixed(1)}%)
`;
}

/**
 * Calculate confidence analysis
 */
function calculateConfidenceAnalysis(opportunities: ArbitrageOpportunity[]): string {
  const avgConfidence = opportunities.reduce((sum, o) => sum + o.confidence, 0) / opportunities.length;
  const highConfidence = opportunities.filter(o => o.confidence >= 0.8).length;
  const mediumConfidence = opportunities.filter(o => o.confidence >= 0.6 && o.confidence < 0.8).length;
  const lowConfidence = opportunities.filter(o => o.confidence < 0.6).length;
  
  return `
- **Average Confidence**: ${(avgConfidence * 100).toFixed(1)}%
- **High Confidence (≥80%)**: ${highConfidence} (${((highConfidence / opportunities.length) * 100).toFixed(1)}%)
- **Medium Confidence (60-79%)**: ${mediumConfidence} (${((mediumConfidence / opportunities.length) * 100).toFixed(1)}%)
- **Low Confidence (<60%)**: ${lowConfidence} (${((lowConfidence / opportunities.length) * 100).toFixed(1)}%)
`;
}

/**
 * Format duration in human-readable format
 */
function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}
