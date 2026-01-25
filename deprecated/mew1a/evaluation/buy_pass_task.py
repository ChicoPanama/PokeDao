"""
BUY/PASS Decision Evaluation Task

Tests the model's ability to make correct BUY vs PASS recommendations.
Uses categorical evaluation (binary choice) for fast evaluation.

Decision Criteria (Ground Truth):
- BUY: Listed price < Fair value AND (discount >= 10% OR trending up)
- PASS: Listed price >= Fair value OR poor deal
- STRONG BUY: Discount >= 20% AND trending up
- STRONG PASS: Listed price > 120% fair value

Example:
    Card: Charizard ex - Obsidian Flames
    Listed: $45.00
    Fair Value: $52.00
    Discount: 13.5%
    Trend: Stable
    → Recommendation: BUY ✓
"""

import json
import re
from pathlib import Path
from typing import Dict, Any, List, Optional

from .task_base import Task


class BuyPassTask(Task):
    """
    Categorical evaluation task for BUY/PASS recommendations.

    Tests the model's ability to make correct trading decisions based on:
    - Listed price vs fair value
    - Discount percentage
    - Market trends
    - Card popularity
    """

    def __init__(
        self,
        data_path: Optional[str] = None,
        start: int = 0,
        stop: Optional[int] = None,
        step: int = 1
    ):
        """
        Initialize BUY/PASS task.

        Args:
            data_path: Path to test data JSON file (buy_pass_scenarios_500.json)
            start: Start index for slicing
            stop: Stop index for slicing (None = use full dataset)
            step: Step size for slicing
        """
        super().__init__(start, stop, step)

        if data_path is None:
            # Default path relative to this file
            data_path = Path(__file__).parent / "test_data" / "buy_pass_scenarios_500.json"

        self.data_path = Path(data_path)
        self._examples = self._load_examples()

    def _load_examples(self) -> List[Dict[str, Any]]:
        """Load test examples from JSON file."""
        if not self.data_path.exists():
            raise FileNotFoundError(
                f"Test data not found at {self.data_path}. "
                "Run scripts/extract_test_data.ts to generate test datasets."
            )

        with open(self.data_path, 'r') as f:
            data = json.load(f)

        return data

    @property
    def eval_type(self) -> str:
        """Categorical evaluation - fast logit-based."""
        return "categorical"

    @property
    def name(self) -> str:
        """Human-readable task name."""
        return "BuyPass"

    def num_examples(self) -> int:
        """Return total number of examples."""
        return len(self._examples)

    def get_example(self, index: int) -> Dict[str, Any]:
        """
        Get a single test example.

        Returns:
            {
                'prompt': str - The BUY/PASS scenario for the model
                'card_name': str - Card name
                'listed_price': float - Current listing price
                'fair_value': float - Fair market value
                'discount_pct': float - Discount percentage (negative = premium)
                'trend': str - Market trend (up/down/stable)
                'correct_decision': str - Ground truth ("BUY" or "PASS")
                'reasoning': str - Why this is the correct decision
            }
        """
        example = self._examples[index]

        card_name = example['card_name']
        listed_price = float(example['listed_price'])
        fair_value = float(example['fair_value'])
        discount_pct = float(example['discount_pct'])
        trend = example['trend']
        correct_decision = example['correct_decision']  # "BUY" or "PASS"
        reasoning = example.get('reasoning', '')

        # Format prompt
        prompt = self._format_prompt(
            card_name,
            listed_price,
            fair_value,
            discount_pct,
            trend
        )

        return {
            'prompt': prompt,
            'card_name': card_name,
            'listed_price': listed_price,
            'fair_value': fair_value,
            'discount_pct': discount_pct,
            'trend': trend,
            'correct_decision': correct_decision,
            'reasoning': reasoning,
            'metadata': example
        }

    def _format_prompt(
        self,
        card_name: str,
        listed_price: float,
        fair_value: float,
        discount_pct: float,
        trend: str
    ) -> str:
        """
        Format the BUY/PASS prompt for the model.

        Mimics the format used in training data.
        """
        # Format trend description
        trend_text = {
            'up': 'trending up 8%',
            'down': 'trending down 12%',
            'stable': 'stable',
            'volatile': 'volatile (±15%)'
        }.get(trend, trend)

        prompt = f"""BUY or PASS?

Card: {card_name}
Listed Price: ${listed_price:.2f}
Fair Value: ${fair_value:.2f}
Discount: {discount_pct:.1f}%
Market Trend: {trend_text}

Decision (BUY or PASS):"""

        return prompt

    def evaluate(self, example: Dict[str, Any], model_output: str) -> Dict[str, Any]:
        """
        Evaluate model output against ground truth.

        For categorical evaluation:
        - Parse model's decision (BUY or PASS)
        - Check if it matches correct_decision
        - Track accuracy by scenario type

        Args:
            example: The test example from get_example()
            model_output: The model's response (should contain "BUY" or "PASS")

        Returns:
            {
                'correct': bool - Whether decision was correct
                'score': float - 1.0 if correct, 0.0 if wrong
                'predicted_decision': str - Model's decision (BUY/PASS)
                'correct_decision': str - Ground truth decision
                'discount_pct': float - Discount percentage
                'trend': str - Market trend
                'scenario_type': str - Type of scenario (good_deal, bad_deal, etc.)
            }
        """
        correct_decision = example['correct_decision']

        # Parse model output (extract BUY or PASS)
        predicted_decision = self._parse_decision(model_output)

        # Check if correct
        is_correct = (predicted_decision == correct_decision)

        # Categorize scenario type for analysis
        scenario_type = self._categorize_scenario(
            example['discount_pct'],
            example['trend']
        )

        return {
            'correct': is_correct,
            'score': 1.0 if is_correct else 0.0,
            'predicted_decision': predicted_decision,
            'correct_decision': correct_decision,
            'discount_pct': example['discount_pct'],
            'trend': example['trend'],
            'scenario_type': scenario_type,
            'card_name': example['card_name'],
            'reasoning': example['reasoning'],
        }

    def _parse_decision(self, model_output: str) -> str:
        """
        Extract BUY or PASS decision from model output.

        Handles various formats:
        - "BUY"
        - "PASS"
        - "I recommend BUY"
        - "This is a PASS"
        - "Decision: BUY"
        - "Strong BUY" → "BUY"
        - "Strong PASS" → "PASS"
        """
        model_output = model_output.strip().upper()

        # Check for BUY (including "STRONG BUY")
        if 'BUY' in model_output and 'PASS' not in model_output:
            return "BUY"

        # Check for PASS (including "STRONG PASS")
        if 'PASS' in model_output:
            return "PASS"

        # If both appear, take the first one
        buy_idx = model_output.find('BUY')
        pass_idx = model_output.find('PASS')

        if buy_idx >= 0 and (pass_idx < 0 or buy_idx < pass_idx):
            return "BUY"
        elif pass_idx >= 0:
            return "PASS"

        # Fallback: invalid decision
        return "INVALID"

    def _categorize_scenario(self, discount_pct: float, trend: str) -> str:
        """
        Categorize scenario type for detailed analysis.

        Categories:
        - strong_buy: Discount >= 20%, trending up
        - good_buy: Discount 10-20%, stable/up
        - marginal_buy: Discount 5-10%, trending up
        - overpriced: Premium > 10%
        - fair_price: Discount 0-5%
        - trending_down: Any discount but trending down
        """
        if discount_pct >= 20 and trend == 'up':
            return 'strong_buy'
        elif discount_pct >= 10 and trend in ['up', 'stable']:
            return 'good_buy'
        elif discount_pct >= 5 and trend == 'up':
            return 'marginal_buy'
        elif discount_pct < -10:
            return 'overpriced'
        elif -5 <= discount_pct <= 5:
            return 'fair_price'
        elif trend == 'down':
            return 'trending_down'
        else:
            return 'other'


# Example usage:
if __name__ == "__main__":
    # This would be used by the evaluation runner
    task = BuyPassTask()

    print(f"Task: {task.name}")
    print(f"Eval Type: {task.eval_type}")
    print(f"Number of examples: {len(task)}")

    # Get first example
    if len(task) > 0:
        example = task[0]
        print(f"\nExample prompt:\n{example['prompt']}")
        print(f"\nCorrect decision: {example['correct_decision']}")
        print(f"Discount: {example['discount_pct']:.1f}%")
        print(f"Trend: {example['trend']}")
        print(f"Reasoning: {example['reasoning']}")
