"""
Prometheus Metrics for Mew-1A v4.3
===================================

Production observability metrics for monitoring model behavior, guardrails, and performance.

Metrics exported:
- mew1a_requests_total: Total requests by route and status
- mew1a_tfv_repaired_total: Total TFV guardrail repairs
- mew1a_zero_price_sanitized_total: Total zero-price sanitizations
- mew1a_latency_seconds: Request latency histogram
- mew1a_tokens_per_second: Token generation throughput
- mew1a_rag_augmented_total: Requests using RAG augmentation
"""

from prometheus_client import Counter, Histogram, Gauge, generate_latest, CONTENT_TYPE_LATEST
from typing import Optional
import time

# =============================================================================
# METRICS DEFINITIONS
# =============================================================================

# Request counters
requests_total = Counter(
    'mew1a_requests_total',
    'Total requests to Mew-1A endpoints',
    ['route', 'status']  # route: /generate, /analyze, /search, /health | status: 200, 400, 500
)

# Guardrail counters
tfv_repaired_total = Counter(
    'mew1a_tfv_repaired_total',
    'Total TFV guardrail repairs',
    ['route', 'footer_type']  # footer_type: full, oneliner, none
)

zero_price_sanitized_total = Counter(
    'mew1a_zero_price_sanitized_total',
    'Total zero-price sanitizations',
    ['route']
)

# RAG counters
rag_augmented_total = Counter(
    'mew1a_rag_augmented_total',
    'Total requests using RAG augmentation',
    ['route']
)

# Performance histograms
latency_seconds = Histogram(
    'mew1a_latency_seconds',
    'Request latency in seconds',
    ['route'],
    buckets=[0.5, 1.0, 2.0, 5.0, 10.0, 15.0, 30.0, 60.0, 90.0, 120.0]  # Extended for /analyze timeouts
)

tokens_per_second = Histogram(
    'mew1a_tokens_per_second',
    'Token generation throughput',
    ['route'],
    buckets=[5, 10, 20, 30, 40, 50, 75, 100, 150, 200]
)

# Model info (constant labels)
model_info = Gauge(
    'mew1a_model_info',
    'Model metadata',
    ['model_name', 'version', 'training_examples']
)

# Set model info (called once on startup)
model_info.labels(
    model_name='ChicoPanama/mew1a-v4.3',
    version='v4.3',
    training_examples='253810'
).set(1)

# Policy Engine contradiction tracking
reco_contradictions_total = Counter(
    'mew1a_reco_contradictions_total',
    'Model text contradicted policy recommendation',
    ['route']
)

# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

def record_request(route: str, status_code: int, latency: float):
    """
    Record a request with metrics.

    Args:
        route: Endpoint route (/generate, /analyze, etc.)
        status_code: HTTP status code
        latency: Request latency in seconds
    """
    requests_total.labels(route=route, status=str(status_code)).inc()
    latency_seconds.labels(route=route).observe(latency)


def record_generation(route: str, tokens: int, latency: float):
    """
    Record token generation metrics.

    Args:
        route: Endpoint route
        tokens: Number of tokens generated
        latency: Generation time in seconds
    """
    if latency > 0:
        tps = tokens / latency
        tokens_per_second.labels(route=route).observe(tps)


def record_guardrails(route: str, tfv_repaired: bool, footer_type: str, zero_sanitized: bool):
    """
    Record guardrail application metrics.

    Args:
        route: Endpoint route
        tfv_repaired: Whether TFV repair was needed
        footer_type: Type of footer shown (full, oneliner, none)
        zero_sanitized: Whether zero-price sanitization was applied
    """
    if tfv_repaired:
        tfv_repaired_total.labels(route=route, footer_type=footer_type).inc()

    if zero_sanitized:
        zero_price_sanitized_total.labels(route=route).inc()


def record_rag(route: str, was_augmented: bool):
    """
    Record RAG usage.

    Args:
        route: Endpoint route
        was_augmented: Whether RAG augmentation was used
    """
    if was_augmented:
        rag_augmented_total.labels(route=route).inc()


def record_contradiction(route: str):
    """
    Record policy recommendation contradiction.

    Args:
        route: Endpoint route
    """
    reco_contradictions_total.labels(route=route).inc()


def get_metrics_text() -> str:
    """
    Get Prometheus metrics in text format.

    Returns:
        Metrics text suitable for /metrics endpoint
    """
    return generate_latest().decode('utf-8')


# =============================================================================
# DERIVED METRICS (Calculated from base metrics)
# =============================================================================

def get_repair_rate() -> dict:
    """
    Calculate TFV repair rate.

    Returns:
        {
            "overall": float,  # repair_rate across all routes
            "by_route": {route: float}
        }
    """
    # This would be calculated from Prometheus queries in practice
    # For now, return structure for documentation
    return {
        "overall": 0.0,  # tfv_repaired_total / requests_total
        "by_route": {},  # Per-route repair rates
        "note": "Calculate via Prometheus: rate(mew1a_tfv_repaired_total[1h]) / rate(mew1a_requests_total[1h])"
    }


def get_5xx_rate() -> dict:
    """
    Calculate 5xx error rate.

    Returns:
        {
            "overall": float,
            "by_route": {route: float}
        }
    """
    return {
        "overall": 0.0,  # 5xx requests / total requests
        "by_route": {},
        "note": "Calculate via Prometheus: rate(mew1a_requests_total{status=~'5..'}[15m]) / rate(mew1a_requests_total[15m])"
    }


# =============================================================================
# PROMETHEUS QUERIES (For Grafana dashboards)
# =============================================================================

PROMETHEUS_QUERIES = {
    # SLO: p95 latency < 10s
    "p95_latency": 'histogram_quantile(0.95, rate(mew1a_latency_seconds_bucket[5m]))',

    # SLO: 5xx rate < 1%
    "5xx_rate_overall": 'rate(mew1a_requests_total{status=~"5.."}[15m]) / rate(mew1a_requests_total[15m])',

    # /analyze specific 5xx rate (1% threshold)
    "analyze_5xx_rate": 'rate(mew1a_requests_total{route="/analyze",status=~"5.."}[15m]) / rate(mew1a_requests_total{route="/analyze"}[15m])',

    # TFV repair rate (overall)
    "tfv_repair_rate": 'rate(mew1a_tfv_repaired_total[1h]) / rate(mew1a_requests_total[1h])',

    # Zero-price sanitization rate
    "zero_sanitization_rate": 'rate(mew1a_zero_price_sanitized_total[1h]) / rate(mew1a_requests_total[1h])',

    # RAG usage rate
    "rag_usage_rate": 'rate(mew1a_rag_augmented_total[5m]) / rate(mew1a_requests_total[5m])',

    # Throughput (requests per second)
    "requests_per_second": 'rate(mew1a_requests_total[1m])',

    # Average tokens per second
    "avg_tokens_per_second": 'rate(mew1a_tokens_per_second_sum[5m]) / rate(mew1a_tokens_per_second_count[5m])',
}


GRAFANA_ALERTS = {
    "p95_latency_high": {
        "query": PROMETHEUS_QUERIES["p95_latency"],
        "warn_threshold": 10.0,  # seconds
        "critical_threshold": 15.0,
        "duration": "5m",
    },
    "5xx_rate_elevated": {
        "query": PROMETHEUS_QUERIES["5xx_rate_overall"],
        "warn_threshold": 0.05,  # 5%
        "critical_threshold": 0.10,  # 10%
        "duration": "5m",
    },
    "analyze_5xx_spike": {
        "query": PROMETHEUS_QUERIES["analyze_5xx_rate"],
        "critical_threshold": 0.01,  # 1% (triggers auto-failover)
        "duration": "15m",
    },
    "tfv_repair_rate_post_lora": {
        "query": PROMETHEUS_QUERIES["tfv_repair_rate"],
        "critical_threshold": 0.10,  # 10% after v4.3.1 deployed
        "duration": "2h",
        "note": "Only enable after v4.3.1 LoRA deployment",
    },
}


# =============================================================================
# USAGE EXAMPLE
# =============================================================================

def example_usage():
    """Example of how to use metrics in endpoints"""

    # In your endpoint handler:
    start_time = time.time()

    try:
        # ... your endpoint logic ...
        result = {
            "response": "BUY - Listed price is 13% below TFV",
            "tokens": 42,
            "inference_time": 5.2,
            "guardrails": {
                "tfv_repaired": True,
                "footer_type": "oneliner",
                "zero_price_sanitized": False,
            },
            "rag_augmented": True,
        }

        # Record metrics
        latency = time.time() - start_time
        record_request(route="/generate", status_code=200, latency=latency)
        record_generation(route="/generate", tokens=result["tokens"], latency=result["inference_time"])
        record_guardrails(
            route="/generate",
            tfv_repaired=result["guardrails"]["tfv_repaired"],
            footer_type=result["guardrails"]["footer_type"],
            zero_sanitized=result["guardrails"]["zero_price_sanitized"]
        )
        record_rag(route="/generate", was_augmented=result["rag_augmented"])

        return result

    except Exception as e:
        # Record error
        latency = time.time() - start_time
        record_request(route="/generate", status_code=500, latency=latency)
        raise


if __name__ == "__main__":
    print("Mew-1A Prometheus Metrics")
    print("=" * 80)
    print("\nDefined Metrics:")
    print("  - mew1a_requests_total (counter)")
    print("  - mew1a_tfv_repaired_total (counter)")
    print("  - mew1a_zero_price_sanitized_total (counter)")
    print("  - mew1a_rag_augmented_total (counter)")
    print("  - mew1a_latency_seconds (histogram)")
    print("  - mew1a_tokens_per_second (histogram)")
    print("  - mew1a_model_info (gauge)")
    print("\nPrometheus Queries:")
    for name, query in PROMETHEUS_QUERIES.items():
        print(f"  {name}:")
        print(f"    {query}")
    print("\nGrafana Alerts:")
    for name, config in GRAFANA_ALERTS.items():
        print(f"  {name}: {config['query'][:60]}...")
