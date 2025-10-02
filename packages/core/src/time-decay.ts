/**
 * Time decay utilities for weighing recent data more heavily
 */

/**
 * Exponential time decay weight
 *
 * w(t) = exp(-age / tau)
 *
 * where:
 * - age = days since the observation
 * - tau = half-life in days (default 30)
 *
 * @param timestamp - When the observation occurred
 * @param halfLifeDays - Half-life parameter (default 30)
 * @param now - Reference time (default Date.now())
 * @returns Weight between 0 and 1
 *
 * @example
 * // 30 days ago with 30-day half-life → weight ≈ 0.5
 * const weight = timeDecayWeight(thirtyDaysAgo, 30);
 *
 * // 60 days ago with 30-day half-life → weight ≈ 0.25
 * const weight = timeDecayWeight(sixtyDaysAgo, 30);
 */
export function timeDecayWeight(
  timestamp: Date | string | number,
  halfLifeDays: number = 30,
  now: number = Date.now()
): number {
  const ts = typeof timestamp === 'number'
    ? timestamp
    : new Date(timestamp).getTime();

  const ageDays = (now - ts) / (1000 * 60 * 60 * 24);

  if (ageDays < 0) return 1; // Future date → full weight

  return Math.exp(-ageDays / halfLifeDays);
}

/**
 * Apply time decay to a list of values with timestamps
 *
 * @param items - Array of {value, timestamp}
 * @param halfLifeDays - Half-life parameter
 * @returns Array of {value, weight}
 */
export function applyTimeDecay<T extends { timestamp: Date | string | number }>(
  items: T[],
  halfLifeDays: number = 30
): Array<{ item: T; weight: number }> {
  const now = Date.now();

  return items.map(item => ({
    item,
    weight: timeDecayWeight(item.timestamp, halfLifeDays, now),
  }));
}

/**
 * Weighted median using time decay
 *
 * @param values - Array of numbers
 * @param timestamps - Corresponding timestamps
 * @param halfLifeDays - Half-life for decay
 * @returns Weighted median
 */
export function weightedMedian(
  values: number[],
  timestamps: (Date | string | number)[],
  halfLifeDays: number = 30
): number {
  if (values.length === 0) return 0;
  if (values.length === 1) return values[0];

  const now = Date.now();

  // Compute weights
  const weighted = values.map((value, i) => ({
    value,
    weight: timeDecayWeight(timestamps[i], halfLifeDays, now),
  }));

  // Sort by value
  weighted.sort((a, b) => a.value - b.value);

  // Compute cumulative weights
  const totalWeight = weighted.reduce((sum, w) => sum + w.weight, 0);
  const halfWeight = totalWeight / 2;

  let cumWeight = 0;
  for (const w of weighted) {
    cumWeight += w.weight;
    if (cumWeight >= halfWeight) {
      return w.value;
    }
  }

  return weighted[weighted.length - 1].value;
}

/**
 * Weighted mean using time decay
 */
export function weightedMean(
  values: number[],
  timestamps: (Date | string | number)[],
  halfLifeDays: number = 30
): number {
  if (values.length === 0) return 0;

  const now = Date.now();

  let sumWeightedValue = 0;
  let sumWeight = 0;

  for (let i = 0; i < values.length; i++) {
    const weight = timeDecayWeight(timestamps[i], halfLifeDays, now);
    sumWeightedValue += values[i] * weight;
    sumWeight += weight;
  }

  return sumWeight > 0 ? sumWeightedValue / sumWeight : 0;
}

/**
 * Bucket a date to a fixed interval
 * Used for deduplication fingerprints
 *
 * @param date - Date to bucket
 * @param bucketDays - Bucket size in days (default 1)
 * @returns ISO date string of bucket start
 */
export function bucketDate(
  date: Date | string | number,
  bucketDays: number = 1
): string {
  const d = new Date(date);
  const daysSinceEpoch = Math.floor(d.getTime() / (1000 * 60 * 60 * 24));
  const bucket = Math.floor(daysSinceEpoch / bucketDays) * bucketDays;
  return new Date(bucket * 1000 * 60 * 60 * 24).toISOString().split('T')[0];
}

/**
 * Calculate age in days from timestamp
 */
export function ageDays(timestamp: Date | string | number, now: number = Date.now()): number {
  const ts = typeof timestamp === 'number'
    ? timestamp
    : new Date(timestamp).getTime();

  return (now - ts) / (1000 * 60 * 60 * 24);
}
