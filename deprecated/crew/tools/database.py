"""
Database Tools for CrewAI Agents

Provides tools for querying PokeDAO's PostgreSQL database.
"""

import os
from typing import List, Dict, Any, Optional
from crewai.tools import BaseTool
from pydantic import Field
import psycopg2
from psycopg2.extras import RealDictCursor


DATABASE_URL = os.getenv("DATABASE_URL", "")


def get_connection():
    """Get a database connection."""
    return psycopg2.connect(DATABASE_URL, cursor_factory=RealDictCursor)


class CompsLookupTool(BaseTool):
    """
    Tool for looking up comparable sales (comps) for a card.
    """

    name: str = "comps_lookup"
    description: str = (
        "Look up recent comparable sales for a Pokemon card. "
        "Input should be the card name and optionally grade. "
        "Returns recent sale prices to help determine fair value."
    )

    def _run(self, card_name: str, grade: Optional[str] = None, days: int = 90) -> str:
        """Execute the comps lookup."""
        try:
            with get_connection() as conn:
                with conn.cursor() as cur:
                    query = """
                        SELECT
                            cs."priceCents" / 100.0 as price_usd,
                            cs."soldAt",
                            cs.source,
                            cs.grade,
                            c.name as card_name,
                            c.set as set_name
                        FROM "CompSale" cs
                        JOIN "Card" c ON cs."cardId" = c.id
                        WHERE c.name ILIKE %s
                        AND cs."soldAt" > NOW() - INTERVAL '%s days'
                    """
                    params = [f"%{card_name}%", days]

                    if grade:
                        query += " AND cs.grade = %s"
                        params.append(grade)

                    query += " ORDER BY cs.\"soldAt\" DESC LIMIT 20"

                    cur.execute(query, params)
                    results = cur.fetchall()

                    if not results:
                        return f"No comparable sales found for '{card_name}' in the last {days} days."

                    # Format results
                    lines = [f"Found {len(results)} comparable sales for '{card_name}':\n"]
                    for r in results:
                        lines.append(
                            f"- ${r['price_usd']:.2f} ({r['grade'] or 'Raw'}) "
                            f"from {r['source']} on {r['soldAt'].strftime('%Y-%m-%d')}"
                        )

                    # Calculate stats
                    prices = [r['price_usd'] for r in results]
                    avg_price = sum(prices) / len(prices)
                    min_price = min(prices)
                    max_price = max(prices)

                    lines.append(f"\nStats: Avg ${avg_price:.2f}, Min ${min_price:.2f}, Max ${max_price:.2f}")

                    return "\n".join(lines)

        except Exception as e:
            return f"Error looking up comps: {str(e)}"


class PriceHistoryTool(BaseTool):
    """
    Tool for getting price history trends for a card.
    """

    name: str = "price_history"
    description: str = (
        "Get price history and trends for a Pokemon card. "
        "Input should be the card name. "
        "Returns historical price data to identify trends."
    )

    def _run(self, card_name: str, days: int = 180) -> str:
        """Execute the price history lookup."""
        try:
            with get_connection() as conn:
                with conn.cursor() as cur:
                    query = """
                        WITH monthly_avg AS (
                            SELECT
                                DATE_TRUNC('month', cs."soldAt") as month,
                                AVG(cs."priceCents") / 100.0 as avg_price,
                                COUNT(*) as sale_count
                            FROM "CompSale" cs
                            JOIN "Card" c ON cs."cardId" = c.id
                            WHERE c.name ILIKE %s
                            AND cs."soldAt" > NOW() - INTERVAL '%s days'
                            GROUP BY DATE_TRUNC('month', cs."soldAt")
                            ORDER BY month
                        )
                        SELECT * FROM monthly_avg
                    """

                    cur.execute(query, [f"%{card_name}%", days])
                    results = cur.fetchall()

                    if not results:
                        return f"No price history found for '{card_name}'."

                    lines = [f"Price history for '{card_name}' (last {days} days):\n"]
                    for r in results:
                        lines.append(
                            f"- {r['month'].strftime('%Y-%m')}: "
                            f"${r['avg_price']:.2f} avg ({r['sale_count']} sales)"
                        )

                    # Calculate trend
                    if len(results) >= 2:
                        first_price = results[0]['avg_price']
                        last_price = results[-1]['avg_price']
                        change_pct = ((last_price - first_price) / first_price) * 100
                        trend = "📈 UP" if change_pct > 5 else "📉 DOWN" if change_pct < -5 else "➡️ STABLE"
                        lines.append(f"\nTrend: {trend} ({change_pct:+.1f}%)")

                    return "\n".join(lines)

        except Exception as e:
            return f"Error getting price history: {str(e)}"


class ActiveListingsTool(BaseTool):
    """
    Tool for finding active market listings.
    """

    name: str = "active_listings"
    description: str = (
        "Find active market listings for a Pokemon card. "
        "Input should be the card name. "
        "Returns current listings with prices to identify buying opportunities."
    )

    def _run(self, card_name: str, limit: int = 10) -> str:
        """Execute the active listings lookup."""
        try:
            with get_connection() as conn:
                with conn.cursor() as cur:
                    query = """
                        SELECT
                            l.id,
                            l.price,
                            l.source,
                            l.url,
                            l.grade,
                            l.condition,
                            l.seller,
                            c.name as card_name,
                            c.set as set_name
                        FROM "Listing" l
                        JOIN "Card" c ON l."cardId" = c.id
                        WHERE c.name ILIKE %s
                        AND l."isActive" = true
                        ORDER BY l.price ASC
                        LIMIT %s
                    """

                    cur.execute(query, [f"%{card_name}%", limit])
                    results = cur.fetchall()

                    if not results:
                        return f"No active listings found for '{card_name}'."

                    lines = [f"Active listings for '{card_name}':\n"]
                    for r in results:
                        grade_str = f" ({r['grade']})" if r['grade'] else ""
                        lines.append(
                            f"- ${r['price']:.2f}{grade_str} on {r['source']}"
                        )
                        if r['url']:
                            lines.append(f"  URL: {r['url']}")

                    return "\n".join(lines)

        except Exception as e:
            return f"Error finding listings: {str(e)}"
