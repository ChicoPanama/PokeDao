"""
Market Scanner Agent

Specializes in identifying arbitrage opportunities and undervalued listings
across multiple marketplaces.
"""

from crewai import Agent
from ..tools.database import ActiveListingsTool, CompsLookupTool


def create_market_scanner(llm=None) -> Agent:
    """
    Create the Market Scanner agent.

    This agent is responsible for:
    - Scanning active listings across marketplaces
    - Identifying price discrepancies
    - Calculating arbitrage spreads
    - Flagging undervalued cards
    """
    return Agent(
        role="Pokemon TCG Market Scanner",
        goal=(
            "Identify profitable trading opportunities by scanning market listings "
            "and comparing them against fair value. Find arbitrage opportunities "
            "where cards are listed significantly below market value."
        ),
        backstory=(
            "You are a former quantitative trader who now specializes in collectibles "
            "arbitrage. Your skills include:\n"
            "- Real-time market scanning across eBay, TCGPlayer, and other platforms\n"
            "- Statistical analysis of pricing inefficiencies\n"
            "- Understanding of marketplace fees, shipping, and true cost calculations\n"
            "- Quick identification of mispriced listings before they sell\n\n"
            "You have a keen eye for spotting listings that are priced below market "
            "due to seller error, poor photos, or incorrect categorization. You always "
            "calculate the full cost including fees and shipping when evaluating deals."
        ),
        tools=[ActiveListingsTool(), CompsLookupTool()],
        llm=llm,
        verbose=True,
        allow_delegation=False,
    )
