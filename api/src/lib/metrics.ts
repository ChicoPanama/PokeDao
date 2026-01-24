/**
 * Minimal in-memory metrics for Prometheus scraping.
 *
 * Exposes counters and histograms in Prom text format without external deps.
 */

type Route = '/api/cards/search-variants' | '/api/cards/comprehensive-analysis' | string;

const reqCounters: Record<string, Record<string, number>> = Object.create(null); // route -> status -> count
const durSums: Record<string, number> = Object.create(null); // route -> total seconds
const durCounts: Record<string, number> = Object.create(null); // route -> count
const cacheHits: Record<string, number> = Object.create(null); // endpoint id -> hits

function inc(map: Record<string, number>, key: string, by = 1) {
  map[key] = (map[key] || 0) + by;
}

export function recordRequest(route: Route, status: number, durationSeconds: number) {
  const statusKey = String(status);
  if (!reqCounters[route]) reqCounters[route] = Object.create(null);
  inc(reqCounters[route], statusKey);
  inc(durSums, route, durationSeconds);
  inc(durCounts, route, 1);
}

export function recordCacheHit(endpoint: 'search-variants' | 'comprehensive-analysis' | 'gateway') {
  inc(cacheHits, endpoint, 1);
}

export function getMetricsText(): string {
  const lines: string[] = [];
  lines.push('# HELP api_requests_total Total API requests by route and status');
  lines.push('# TYPE api_requests_total counter');
  for (const route of Object.keys(reqCounters)) {
    const statuses = reqCounters[route];
    for (const status of Object.keys(statuses)) {
      lines.push(`api_requests_total{route="${route}",status="${status}"} ${statuses[status]}`);
    }
  }
  lines.push('# HELP api_request_duration_seconds_sum Sum of request durations in seconds by route');
  lines.push('# TYPE api_request_duration_seconds_sum gauge');
  for (const route of Object.keys(durSums)) {
    lines.push(`api_request_duration_seconds_sum{route="${route}"} ${durSums[route]}`);
  }
  lines.push('# HELP api_request_duration_seconds_count Number of requests observed for duration by route');
  lines.push('# TYPE api_request_duration_seconds_count gauge');
  for (const route of Object.keys(durCounts)) {
    lines.push(`api_request_duration_seconds_count{route="${route}"} ${durCounts[route]}`);
  }
  lines.push('# HELP api_cache_hits_total Cache hits by endpoint');
  lines.push('# TYPE api_cache_hits_total counter');
  for (const ep of Object.keys(cacheHits)) {
    lines.push(`api_cache_hits_total{endpoint="${ep}"} ${cacheHits[ep]}`);
  }
  return lines.join('\n');
}

