/**
 * Intelligent Deduplication Module
 *
 * MIT Recommendation: Keep strategic duplicates for better analysis
 * - One listing per source (for cross-marketplace comparison)
 * - Price variations (for fair value calculation)
 * - Temporal diversity (oldest + newest for trend analysis)
 * - Remove true duplicates and suspicious entries
 *
 * Philosophy: Not all "duplicates" should be removed.
 * Multiple observations of the same card at different prices/times are valuable data.
 *
 * Usage:
 *   const deduplicator = new IntelligentDeduplicator();
 *   const { kept, removed } = deduplicator.deduplicate(listings);
 */

import { createHash } from 'crypto';

// ============================================================================
// TYPES
// ============================================================================

export interface DeduplicationResult {
  kept: any[];
  removed: any[];
  stats: DeduplicationStats;
}

export interface DeduplicationStats {
  totalInput: number;
  totalKept: number;
  totalRemoved: number;
  removalRate: number;
  removalReasons: Record<string, number>;
  sourceDistribution: Record<string, number>;
}

export enum DuplicateType {
  EXACT = 'EXACT', // 100% identical records
  SUSPICIOUS = 'SUSPICIOUS', // Same price, date, source (likely data error)
  PRICE_VARIATION = 'PRICE_VARIATION', // Same card, different prices (KEEP)
  SOURCE_VARIATION = 'SOURCE_VARIATION', // Same card, different sources (KEEP)
  TEMPORAL_VARIATION = 'TEMPORAL_VARIATION', // Same card, different dates (KEEP)
}

export interface DuplicateGroup {
  canonicalId: string; // Card identifier
  records: any[];
  duplicateType: DuplicateType;
  shouldKeep: any[]; // Records to keep
  shouldRemove: any[]; // Records to remove
  reason: string;
}

// ============================================================================
// INTELLIGENT DEDUPLICATOR
// ============================================================================

export class IntelligentDeduplicator {
  private config: DeduplicationConfig;

  constructor(config: Partial<DeduplicationConfig> = {}) {
    this.config = {
      keepOnePerSource: config.keepOnePerSource ?? true,
      keepPriceVariations: config.keepPriceVariations ?? true,
      keepTemporalDiversity: config.keepTemporalDiversity ?? true,
      priceVariationThreshold: config.priceVariationThreshold ?? 0.05, // 5% difference
      minDaysBetweenObservations: config.minDaysBetweenObservations ?? 7,
      maxObservationsPerCard: config.maxObservationsPerCard ?? 50,
      removeSuspiciousDuplicates: config.removeSuspiciousDuplicates ?? true,
    };
  }

  /**
   * Perform intelligent deduplication on listings
   */
  deduplicate(records: any[]): DeduplicationResult {
    const stats: DeduplicationStats = {
      totalInput: records.length,
      totalKept: 0,
      totalRemoved: 0,
      removalRate: 0,
      removalReasons: {},
      sourceDistribution: {},
    };

    // Step 1: Group records by canonical card ID
    const groups = this.groupByCanonicalId(records);

    const kept: any[] = [];
    const removed: any[] = [];

    // Step 2: Process each group
    for (const group of groups) {
      const result = this.processGroup(group);

      kept.push(...result.shouldKeep);
      removed.push(...result.shouldRemove);

      // Track removal reasons
      if (result.shouldRemove.length > 0) {
        stats.removalReasons[result.reason] =
          (stats.removalReasons[result.reason] || 0) + result.shouldRemove.length;
      }
    }

    // Update stats
    stats.totalKept = kept.length;
    stats.totalRemoved = removed.length;
    stats.removalRate = removed.length / records.length;

    // Source distribution
    for (const record of kept) {
      const source = record.source || 'UNKNOWN';
      stats.sourceDistribution[source] = (stats.sourceDistribution[source] || 0) + 1;
    }

    return { kept, removed, stats };
  }

  /**
   * Group records by canonical card identifier
   */
  private groupByCanonicalId(records: any[]): DuplicateGroup[] {
    const groups = new Map<string, any[]>();

    for (const record of records) {
      const canonicalId = this.getCanonicalId(record);
      if (!groups.has(canonicalId)) {
        groups.set(canonicalId, []);
      }
      groups.get(canonicalId)!.push(record);
    }

    return Array.from(groups.entries()).map(([canonicalId, recs]) => ({
      canonicalId,
      records: recs,
      duplicateType: this.classifyDuplicateType(recs),
      shouldKeep: [],
      shouldRemove: [],
      reason: '',
    }));
  }

  /**
   * Generate canonical identifier for a card
   * Same card = same set, number, variant, grade
   */
  private getCanonicalId(record: any): string {
    const parts = [
      (record.setName || record.canonicalSet || '').toLowerCase().trim(),
      (record.cardNumber || '').toLowerCase().trim(),
      (record.variant || 'base').toLowerCase().trim(),
      (record.gradeCompany || 'raw').toLowerCase().trim(),
      (record.grade || '').toString(),
    ];

    const key = parts.join('|');
    return createHash('md5').update(key).digest('hex');
  }

  /**
   * Classify the type of duplication in a group
   */
  private classifyDuplicateType(records: any[]): DuplicateType {
    if (records.length === 1) return DuplicateType.PRICE_VARIATION; // Not a duplicate

    // Check for exact duplicates
    const hashes = records.map((r) => this.recordHash(r));
    const uniqueHashes = new Set(hashes);
    if (uniqueHashes.size === 1) return DuplicateType.EXACT;

    // Check for suspicious duplicates (same price, date, source)
    const priceDateSource = records.map((r) =>
      `${r.priceCents}_${r.listedAt || r.soldAt}_${r.source}`.toLowerCase()
    );
    if (new Set(priceDateSource).size < records.length) {
      return DuplicateType.SUSPICIOUS;
    }

    // Check for source variations
    const sources = new Set(records.map((r) => r.source));
    if (sources.size > 1) return DuplicateType.SOURCE_VARIATION;

    // Check for price variations
    const prices = records.map((r) => r.priceCents || r.soldPriceCents);
    const priceSet = new Set(prices);
    if (priceSet.size > 1) return DuplicateType.PRICE_VARIATION;

    // Check for temporal variations
    const dates = records
      .map((r) => r.listedAt || r.soldAt)
      .filter(Boolean)
      .map((d) => new Date(d).getTime());
    if (dates.length > 0) {
      const minDate = Math.min(...dates);
      const maxDate = Math.max(...dates);
      const daysDiff = (maxDate - minDate) / (1000 * 60 * 60 * 24);
      if (daysDiff >= this.config.minDaysBetweenObservations) {
        return DuplicateType.TEMPORAL_VARIATION;
      }
    }

    return DuplicateType.EXACT;
  }

  /**
   * Process a duplicate group and decide what to keep
   */
  private processGroup(group: DuplicateGroup): DuplicateGroup {
    const { records, duplicateType } = group;

    // Single record - always keep
    if (records.length === 1) {
      group.shouldKeep = records;
      group.reason = 'SINGLE_RECORD';
      return group;
    }

    switch (duplicateType) {
      case DuplicateType.EXACT:
        return this.handleExactDuplicates(group);

      case DuplicateType.SUSPICIOUS:
        return this.handleSuspiciousDuplicates(group);

      case DuplicateType.SOURCE_VARIATION:
        return this.handleSourceVariations(group);

      case DuplicateType.PRICE_VARIATION:
        return this.handlePriceVariations(group);

      case DuplicateType.TEMPORAL_VARIATION:
        return this.handleTemporalVariations(group);

      default:
        // Default: keep all
        group.shouldKeep = records;
        group.reason = 'DEFAULT_KEEP_ALL';
        return group;
    }
  }

  /**
   * Handle exact duplicates - keep only one
   */
  private handleExactDuplicates(group: DuplicateGroup): DuplicateGroup {
    const { records } = group;

    // Sort by data quality, then by date
    const sorted = records.sort((a, b) => {
      const qualityA = a.dataQuality || 0.5;
      const qualityB = b.dataQuality || 0.5;
      if (qualityA !== qualityB) return qualityB - qualityA; // Higher quality first

      // Tie-break by recency
      const dateA = new Date(a.createdAt || a.listedAt || 0).getTime();
      const dateB = new Date(b.createdAt || b.listedAt || 0).getTime();
      return dateB - dateA;
    });

    group.shouldKeep = [sorted[0]];
    group.shouldRemove = sorted.slice(1);
    group.reason = 'EXACT_DUPLICATE';

    return group;
  }

  /**
   * Handle suspicious duplicates - keep only one, flag others
   */
  private handleSuspiciousDuplicates(group: DuplicateGroup): DuplicateGroup {
    if (!this.config.removeSuspiciousDuplicates) {
      group.shouldKeep = group.records;
      group.reason = 'SUSPICIOUS_BUT_KEPT';
      return group;
    }

    // Keep the one with highest data quality
    const sorted = group.records.sort((a, b) => {
      const qualityA = a.dataQuality || 0.5;
      const qualityB = b.dataQuality || 0.5;
      return qualityB - qualityA;
    });

    group.shouldKeep = [sorted[0]];
    group.shouldRemove = sorted.slice(1);
    group.reason = 'SUSPICIOUS_DUPLICATE';

    return group;
  }

  /**
   * Handle source variations - keep one per source
   */
  private handleSourceVariations(group: DuplicateGroup): DuplicateGroup {
    if (!this.config.keepOnePerSource) {
      // Just keep highest quality
      return this.handleExactDuplicates(group);
    }

    // Group by source
    const bySource = new Map<string, any[]>();
    for (const record of group.records) {
      const source = record.source || 'UNKNOWN';
      if (!bySource.has(source)) {
        bySource.set(source, []);
      }
      bySource.get(source)!.push(record);
    }

    // Keep best from each source
    group.shouldKeep = [];
    group.shouldRemove = [];

    for (const [source, recs] of bySource.entries()) {
      const sorted = recs.sort((a, b) => {
        const qualityA = a.dataQuality || 0.5;
        const qualityB = b.dataQuality || 0.5;
        return qualityB - qualityA;
      });

      group.shouldKeep.push(sorted[0]);
      group.shouldRemove.push(...sorted.slice(1));
    }

    group.reason = 'SOURCE_VARIATION_KEPT';

    return group;
  }

  /**
   * Handle price variations - keep strategically for TFV
   */
  private handlePriceVariations(group: DuplicateGroup): DuplicateGroup {
    if (!this.config.keepPriceVariations) {
      return this.handleExactDuplicates(group);
    }

    const { records } = group;

    // Sort by price
    const sorted = records.sort((a, b) => {
      const priceA = a.priceCents || a.soldPriceCents || 0;
      const priceB = b.priceCents || b.soldPriceCents || 0;
      return priceA - priceB;
    });

    // Keep price variations above threshold
    group.shouldKeep = [];
    group.shouldRemove = [];

    for (let i = 0; i < sorted.length; i++) {
      const current = sorted[i];
      const currentPrice = current.priceCents || current.soldPriceCents || 0;

      // Always keep first
      if (i === 0) {
        group.shouldKeep.push(current);
        continue;
      }

      // Check if price differs significantly from last kept
      const lastKept = group.shouldKeep[group.shouldKeep.length - 1];
      const lastPrice = lastKept.priceCents || lastKept.soldPriceCents || 0;

      const priceDiff = Math.abs(currentPrice - lastPrice) / lastPrice;

      if (priceDiff >= this.config.priceVariationThreshold) {
        group.shouldKeep.push(current);
      } else {
        group.shouldRemove.push(current);
      }
    }

    // Limit max observations
    if (group.shouldKeep.length > this.config.maxObservationsPerCard) {
      // Keep outliers (min, max) and randomly sample middle
      const min = group.shouldKeep[0];
      const max = group.shouldKeep[group.shouldKeep.length - 1];
      const middle = group.shouldKeep.slice(1, -1);

      // Sample middle
      const keepCount = this.config.maxObservationsPerCard - 2;
      const sampled = this.randomSample(middle, keepCount);

      group.shouldRemove.push(...middle.filter((r) => !sampled.includes(r)));
      group.shouldKeep = [min, ...sampled, max];
    }

    group.reason = 'PRICE_VARIATION_KEPT';

    return group;
  }

  /**
   * Handle temporal variations - keep for trend analysis
   */
  private handleTemporalVariations(group: DuplicateGroup): DuplicateGroup {
    if (!this.config.keepTemporalDiversity) {
      return this.handleExactDuplicates(group);
    }

    const { records } = group;

    // Sort by date
    const sorted = records.sort((a, b) => {
      const dateA = new Date(a.listedAt || a.soldAt || 0).getTime();
      const dateB = new Date(b.listedAt || b.soldAt || 0).getTime();
      return dateA - dateB;
    });

    // Keep temporal diversity
    group.shouldKeep = [];
    group.shouldRemove = [];

    for (let i = 0; i < sorted.length; i++) {
      const current = sorted[i];
      const currentDate = new Date(current.listedAt || current.soldAt || 0).getTime();

      // Always keep first
      if (i === 0) {
        group.shouldKeep.push(current);
        continue;
      }

      // Check if date differs significantly from last kept
      const lastKept = group.shouldKeep[group.shouldKeep.length - 1];
      const lastDate = new Date(lastKept.listedAt || lastKept.soldAt || 0).getTime();

      const daysDiff = (currentDate - lastDate) / (1000 * 60 * 60 * 24);

      if (daysDiff >= this.config.minDaysBetweenObservations) {
        group.shouldKeep.push(current);
      } else {
        group.shouldRemove.push(current);
      }
    }

    // Limit max observations
    if (group.shouldKeep.length > this.config.maxObservationsPerCard) {
      // Keep oldest + newest + sample middle
      const oldest = group.shouldKeep[0];
      const newest = group.shouldKeep[group.shouldKeep.length - 1];
      const middle = group.shouldKeep.slice(1, -1);

      const keepCount = this.config.maxObservationsPerCard - 2;
      const sampled = this.randomSample(middle, keepCount);

      group.shouldRemove.push(...middle.filter((r) => !sampled.includes(r)));
      group.shouldKeep = [oldest, ...sampled, newest];
    }

    group.reason = 'TEMPORAL_VARIATION_KEPT';

    return group;
  }

  // ==========================================================================
  // HELPERS
  // ==========================================================================

  /**
   * Generate hash for exact duplicate detection
   */
  private recordHash(record: any): string {
    const parts = [
      record.title || '',
      record.priceCents || record.soldPriceCents || '',
      record.source || '',
      record.sourceId || '',
      record.listedAt || record.soldAt || '',
      record.cardName || '',
      record.setName || '',
      record.cardNumber || '',
      record.gradeCompany || '',
      record.grade || '',
    ];

    const key = parts.join('|').toLowerCase();
    return createHash('md5').update(key).digest('hex');
  }

  /**
   * Random sample without replacement
   */
  private randomSample<T>(array: T[], count: number): T[] {
    const shuffled = [...array].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, Math.min(count, array.length));
  }
}

// ============================================================================
// CONFIGURATION
// ============================================================================

export interface DeduplicationConfig {
  keepOnePerSource: boolean; // Keep one listing per marketplace
  keepPriceVariations: boolean; // Keep price comps for TFV
  keepTemporalDiversity: boolean; // Keep temporal spread for trends
  priceVariationThreshold: number; // Minimum % price difference to keep (0-1)
  minDaysBetweenObservations: number; // Minimum days between kept observations
  maxObservationsPerCard: number; // Max observations per card
  removeSuspiciousDuplicates: boolean; // Remove likely data errors
}

// ============================================================================
// EXPORTS
// ============================================================================

export default IntelligentDeduplicator;
