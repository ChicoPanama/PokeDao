"""
Price Analyst Agent

Specializes in calculating True Fair Value (TFV) for Pokemon cards
using comparable sales data and market trends.
"""

from crewai import Agent
from ..tools.database import CompsLookupTool, PriceHistoryTool


def create_price_analyst(llm=None) -> Agent:
    """
    Create the Price Analyst agent.

    This agent is responsible for:
    - Analyzing comparable sales data
    - Calculating fair market value
    - Identifying price trends
    - Providing pricing confidence levels
    """
    return Agent(
        role="Pokemon TCG Price Analyst",
        goal=(
            "Calculate accurate True Fair Value (TFV) for Pokemon cards "
            "using comparable sales data, price trends, and market conditions. "
            "Provide pricing with confidence levels and supporting evidence."
        ),
        backstory=(
            "You are an expert Pokemon TCG price analyst with 10 years of experience "
            "in the collectibles market. You have deep knowledge of:\n"
            "- PSA, BGS, and CGC grading standards and their price premiums\n"
            "- Historical price patterns for vintage and modern cards\n"
            "- Market dynamics including seasonal trends and hype cycles\n"
            "- The difference between retail, auction, and private sale pricing\n\n"
            "You are known for your accurate valuations and ability to spot "
            "pricing anomalies. You always cite specific comparable sales when "
            "making price recommendations."
        ),
        tools=[CompsLookupTool(), PriceHistoryTool()],
        llm=llm,
        verbose=True,
        allow_delegation=False,
    )
