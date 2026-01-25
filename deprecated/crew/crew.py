"""
PokeDAO CrewAI Multi-Agent System

Orchestrates specialized AI agents for Pokemon TCG trading signal generation.

Agents:
1. Price Analyst - Calculates True Fair Value
2. Market Scanner - Finds arbitrage opportunities
3. Risk Assessor - Evaluates trading risks
4. Content Writer - Generates signal content

Usage:
    python -m apps.crew.crew --card "Charizard VMAX" --verbose
"""

import os
import argparse
from typing import Optional
from dotenv import load_dotenv

from crewai import Crew, Task, Process
from langchain_openai import ChatOpenAI

from agents.price_analyst import create_price_analyst
from agents.market_scanner import create_market_scanner
from agents.risk_assessor import create_risk_assessor
from agents.content_writer import create_content_writer


# Load environment variables
load_dotenv()


def create_llm(model: str = "gpt-4o-mini") -> ChatOpenAI:
    """Create the LLM for agents."""
    return ChatOpenAI(
        model=model,
        temperature=0.7,
        api_key=os.getenv("OPENAI_API_KEY"),
    )


def create_analysis_crew(card_name: str, llm: Optional[ChatOpenAI] = None) -> Crew:
    """
    Create the full analysis crew for a card.

    Args:
        card_name: The card to analyze
        llm: Optional LLM to use (defaults to gpt-4o-mini)

    Returns:
        Configured Crew ready to execute
    """
    if llm is None:
        llm = create_llm()

    # Create agents
    price_analyst = create_price_analyst(llm)
    market_scanner = create_market_scanner(llm)
    risk_assessor = create_risk_assessor(llm)
    content_writer = create_content_writer(llm)

    # Create tasks
    pricing_task = Task(
        description=f"""
        Analyze the fair market value for: {card_name}

        Steps:
        1. Look up recent comparable sales for this card
        2. Analyze price trends over the past 6 months
        3. Consider grade premiums if applicable
        4. Calculate a True Fair Value (TFV) with confidence level

        Output a pricing analysis with:
        - TFV estimate in USD
        - Price range (low to high)
        - Confidence level (Low/Medium/High)
        - Key comparable sales that support your valuation
        - Any notable price trends
        """,
        expected_output="Detailed pricing analysis with TFV, price range, and supporting comps",
        agent=price_analyst,
    )

    scanning_task = Task(
        description=f"""
        Scan the market for opportunities on: {card_name}

        Using the pricing analysis provided, find:
        1. Active listings priced below fair value
        2. Calculate the arbitrage spread for each opportunity
        3. Factor in marketplace fees and shipping costs
        4. Rank opportunities by potential profit

        Output:
        - List of opportunities with prices and spreads
        - Best opportunity highlighted
        - Total cost including fees
        """,
        expected_output="List of market opportunities with arbitrage calculations",
        agent=market_scanner,
        context=[pricing_task],
    )

    risk_task = Task(
        description=f"""
        Assess risks for trading opportunities on: {card_name}

        For each opportunity identified, evaluate:
        1. Seller reputation and history
        2. Authenticity concerns (counterfeits, regrades)
        3. Market liquidity (how quickly can this be resold?)
        4. Price volatility risk
        5. Condition/grading variance risk

        Output:
        - Overall risk score (1-10, where 10 is highest risk)
        - Specific risk factors with likelihood
        - Risk mitigation recommendations
        - Go/No-Go recommendation for each opportunity
        """,
        expected_output="Risk assessment with scores, factors, and recommendations",
        agent=risk_assessor,
        context=[pricing_task, scanning_task],
    )

    content_task = Task(
        description=f"""
        Create trading signal content for: {card_name}

        Using all the analysis provided, create:

        1. **Investment Thesis** (2-3 sentences):
           - Why this is an opportunity
           - Key supporting data points

        2. **Telegram Alert** (formatted for mobile):
           - Use emojis appropriately
           - Include price, spread, and risk level
           - Add a call to action

        3. **X/Twitter Thread** (3-5 tweets):
           - Hook tweet with the opportunity
           - Supporting data tweets
           - Risk disclosure
           - Disclaimer tweet

        Ensure all content is:
        - Factual and data-driven
        - Balanced (opportunity + risks)
        - Compliant (no financial advice claims)
        """,
        expected_output="Complete content package with thesis, Telegram alert, and X thread",
        agent=content_writer,
        context=[pricing_task, scanning_task, risk_task],
    )

    # Create crew
    crew = Crew(
        agents=[price_analyst, market_scanner, risk_assessor, content_writer],
        tasks=[pricing_task, scanning_task, risk_task, content_task],
        process=Process.sequential,
        verbose=True,
    )

    return crew


def analyze_card(card_name: str, verbose: bool = False) -> dict:
    """
    Run full analysis on a card.

    Args:
        card_name: The card to analyze
        verbose: Whether to print verbose output

    Returns:
        Analysis results dictionary
    """
    print(f"\n{'='*60}")
    print(f"ANALYZING: {card_name}")
    print(f"{'='*60}\n")

    crew = create_analysis_crew(card_name)
    result = crew.kickoff()

    return {
        "card": card_name,
        "result": str(result),
        "tasks_output": [str(task.output) for task in crew.tasks],
    }


def main():
    """CLI entry point."""
    parser = argparse.ArgumentParser(
        description="PokeDAO CrewAI Analysis System"
    )
    parser.add_argument(
        "--card",
        type=str,
        required=True,
        help="Card name to analyze (e.g., 'Charizard VMAX')"
    )
    parser.add_argument(
        "--verbose",
        action="store_true",
        help="Enable verbose output"
    )
    parser.add_argument(
        "--model",
        type=str,
        default="gpt-4o-mini",
        help="LLM model to use (default: gpt-4o-mini)"
    )

    args = parser.parse_args()

    result = analyze_card(args.card, verbose=args.verbose)

    print("\n" + "="*60)
    print("FINAL RESULT")
    print("="*60)
    print(result["result"])


if __name__ == "__main__":
    main()
