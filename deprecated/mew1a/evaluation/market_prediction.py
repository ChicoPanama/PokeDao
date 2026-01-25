"""
Market Prediction Evaluation Task

Tests the model's ability to predict future market trends and prices.
Uses GENERATIVE evaluation (full sampling required) to extract predictions.

Prediction Tasks:
- Price trend forecasting (up/down/stable over 30 days)
- Expected price change percentage
- Best time to buy/sell recommendations
- Market sentiment analysis

Example:
    Card: Charizard ex - Obsidian Flames
    Current Price: $52.00
    Recent Trend: Up 15% in 30 days
    Q: Will this card's price increase, decrease, or stay stable in the next 30 days?

    Ground Truth: Increase (actual price after 30 days: $58.50, +12.5%)
    Model Output: "I predict this card will increase in value. Expected: $57-60 (+10-15%)"
    → CORRECT ✓
"""

import json
import re
from pathlib import Path
from typing import Dict, Any, List, Optional

from .task_base import Task


class MarketPredictionTask(Task):
    """
    Generative evaluation task for market predictions.

    Requires full sampling to generate predictions, then parses the output
    to extract predicted trend/price and compares to ground truth.
    """

    def __init__(
        self,
        data_path: Optional[str] = None,
        start: int = 0,
        stop: Optional[int] = None,
        step: int = 1
    ):
        """
        Initialize market prediction task.

        Args:
            data_path: Path to test data JSON file (market_trends_200.json)
            start: Start index for slicing
            stop: Stop index for slicing (None = use full dataset)
            step: Step size for slicing
        """
        super().__init__(start, stop, step)

        if data_path is None:
            # Default path relative to this file
            data_path = Path(__file__).parent / "test_data" / "market_trends_200.json"

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
        """Generative evaluation - requires full sampling."""
        return "generative"

    @property
    def name(self) -> str:
        """Human-readable task name."""
        return "MarketPrediction"

    def num_examples(self) -> int:
        """Return total number of examples."""
        return len(self._examples)

    def get_example(self, index: int) -> Dict[str, Any]:
        """
        Get a single test example.

        Returns:
            {
                'prompt': str - The prediction question for the model
                'card_name': str - Card name
                'current_price': float - Price at time of prediction
                'price_30d_ago': float - Price 30 days before
                'actual_price_30d_later': float - Actual price 30 days later (ground truth)
                'actual_trend': str - Actual trend ('up', 'down', 'stable')
                'actual_change_pct': float - Actual percentage change
                'prediction_date': str - Date of prediction (for context)
                'outcome_date': str - Date of actual outcome
            }
        """
        example = self._examples[index]

        card_name = example['card_name']
        current_price = float(example['current_price'])
        price_30d_ago = float(example['price_30d_ago'])
        actual_price_30d_later = float(example['actual_price_30d_later'])
        prediction_date = example['prediction_date']
        outcome_date = example['outcome_date']

        # Calculate actual trend and change
        actual_change_pct = ((actual_price_30d_later - current_price) / current_price) * 100

        if actual_change_pct > 5:
            actual_trend = 'up'
        elif actual_change_pct < -5:
            actual_trend = 'down'
        else:
            actual_trend = 'stable'

        # Calculate recent trend (last 30 days before prediction)
        recent_change_pct = ((current_price - price_30d_ago) / price_30d_ago) * 100

        # Format prompt
        prompt = self._format_prompt(
            card_name,
            current_price,
            recent_change_pct,
            prediction_date
        )

        return {
            'prompt': prompt,
            'card_name': card_name,
            'current_price': current_price,
            'price_30d_ago': price_30d_ago,
            'recent_change_pct': recent_change_pct,
            'actual_price_30d_later': actual_price_30d_later,
            'actual_trend': actual_trend,
            'actual_change_pct': actual_change_pct,
            'prediction_date': prediction_date,
            'outcome_date': outcome_date,
            'metadata': example
        }

    def _format_prompt(
        self,
        card_name: str,
        current_price: float,
        recent_change_pct: float,
        prediction_date: str
    ) -> str:
        """
        Format the prediction prompt for the model.

        Asks for both direction (up/down/stable) and magnitude (percentage).
        """
        if recent_change_pct > 0:
            trend_desc = f"up {recent_change_pct:.1f}%"
        elif recent_change_pct < 0:
            trend_desc = f"down {abs(recent_change_pct):.1f}%"
        else:
            trend_desc = "stable"

        prompt = f"""Market Prediction Challenge

Card: {card_name}
Current Price: ${current_price:.2f}
30-Day Trend: {trend_desc}
Date: {prediction_date}

Question: Will this card's price INCREASE, DECREASE, or stay STABLE over the next 30 days?

Provide your prediction with:
1. Direction (INCREASE/DECREASE/STABLE)
2. Expected price or percentage change

Your prediction:"""

        return prompt

    def evaluate(self, example: Dict[str, Any], model_output: str) -> Dict[str, Any]:
        """
        Evaluate model output against ground truth.

        For generative evaluation:
        - Parse model's prediction (direction + magnitude)
        - Check if trend direction is correct
        - Measure prediction error for price/percentage
        - Calculate overall accuracy score

        Args:
            example: The test example from get_example()
            model_output: The model's full response

        Returns:
            {
                'correct': bool - Whether trend direction was correct
                'score': float - 0.0 to 1.0 (combines direction + magnitude accuracy)
                'predicted_trend': str - Extracted trend (up/down/stable)
                'actual_trend': str - Ground truth trend
                'predicted_change_pct': float - Extracted percentage (or None)
                'actual_change_pct': float - Ground truth percentage
                'magnitude_error': float - Error in percentage prediction
                'direction_correct': bool - Whether direction matched
                'magnitude_score': float - Score for magnitude accuracy (0.0-1.0)
            }
        """
        actual_trend = example['actual_trend']
        actual_change_pct = example['actual_change_pct']

        # Parse model output
        predicted_trend = self._parse_trend(model_output)
        predicted_change_pct = self._parse_percentage(model_output)
        predicted_price = self._parse_price(model_output, example['current_price'])

        # Check direction correctness
        direction_correct = (predicted_trend == actual_trend)

        # Calculate magnitude error (if we got a prediction)
        magnitude_error = None
        magnitude_score = 0.0

        if predicted_change_pct is not None:
            magnitude_error = abs(predicted_change_pct - actual_change_pct)
            # Score: 1.0 if error < 5%, 0.5 if < 10%, 0.25 if < 15%, 0.0 otherwise
            if magnitude_error < 5:
                magnitude_score = 1.0
            elif magnitude_error < 10:
                magnitude_score = 0.5
            elif magnitude_error < 15:
                magnitude_score = 0.25
            else:
                magnitude_score = 0.0
        elif predicted_price is not None:
            # Convert price prediction to percentage
            predicted_change_pct = ((predicted_price - example['current_price']) / example['current_price']) * 100
            magnitude_error = abs(predicted_change_pct - actual_change_pct)
            if magnitude_error < 5:
                magnitude_score = 1.0
            elif magnitude_error < 10:
                magnitude_score = 0.5
            elif magnitude_error < 15:
                magnitude_score = 0.25
            else:
                magnitude_score = 0.0

        # Overall score: 50% direction + 50% magnitude
        direction_score = 1.0 if direction_correct else 0.0
        overall_score = (direction_score * 0.5) + (magnitude_score * 0.5)

        return {
            'correct': direction_correct,
            'score': overall_score,
            'predicted_trend': predicted_trend,
            'actual_trend': actual_trend,
            'predicted_change_pct': predicted_change_pct,
            'predicted_price': predicted_price,
            'actual_change_pct': actual_change_pct,
            'magnitude_error': magnitude_error,
            'direction_correct': direction_correct,
            'magnitude_score': magnitude_score,
            'card_name': example['card_name'],
        }

    def _parse_trend(self, model_output: str) -> str:
        """
        Extract trend direction from model output.

        Returns: 'up', 'down', or 'stable'
        """
        output_upper = model_output.upper()

        # Check for explicit keywords
        if 'INCREASE' in output_upper or 'RISE' in output_upper or 'GAIN' in output_upper:
            return 'up'
        elif 'DECREASE' in output_upper or 'FALL' in output_upper or 'DROP' in output_upper or 'DECLINE' in output_upper:
            return 'down'
        elif 'STABLE' in output_upper or 'FLAT' in output_upper or 'UNCHANGED' in output_upper:
            return 'stable'

        # Check for percentage indicators
        # Look for +X% or -X%
        pct_match = re.search(r'([+-])\s*(\d+(?:\.\d+)?)\s*%', model_output)
        if pct_match:
            sign = pct_match.group(1)
            value = float(pct_match.group(2))
            if sign == '+' and value > 5:
                return 'up'
            elif sign == '-' and value > 5:
                return 'down'
            else:
                return 'stable'

        # Fallback: look for price predictions
        current_price = re.search(r'Current Price:\s*\$([0-9.]+)', model_output)
        predicted_price = re.search(r'(?:Expected|Predicted)[:\s]+\$([0-9.]+)', model_output)

        if current_price and predicted_price:
            curr = float(current_price.group(1))
            pred = float(predicted_price.group(1))
            diff_pct = ((pred - curr) / curr) * 100

            if diff_pct > 5:
                return 'up'
            elif diff_pct < -5:
                return 'down'
            else:
                return 'stable'

        # Default: invalid
        return 'invalid'

    def _parse_percentage(self, model_output: str) -> Optional[float]:
        """
        Extract predicted percentage change from model output.

        Returns: Percentage as float (e.g., 12.5 for +12.5%), or None if not found
        """
        # Look for patterns like: "+12%", "-8.5%", "15% increase"
        patterns = [
            r'([+-])\s*(\d+(?:\.\d+)?)\s*%',  # +12% or -8.5%
            r'(\d+(?:\.\d+)?)\s*%\s*(?:increase|up|gain)',  # "12% increase"
            r'(?:increase|up|gain).*?(\d+(?:\.\d+)?)\s*%',  # "increase by 12%"
            r'(\d+(?:\.\d+)?)\s*%\s*(?:decrease|down|drop)',  # "12% decrease"
            r'(?:decrease|down|drop).*?(\d+(?:\.\d+)?)\s*%',  # "decrease by 12%"
        ]

        for pattern in patterns:
            match = re.search(pattern, model_output, re.IGNORECASE)
            if match:
                if len(match.groups()) == 2:
                    # Pattern with sign
                    sign = match.group(1)
                    value = float(match.group(2))
                    return value if sign == '+' else -value
                else:
                    # Pattern without sign - infer from context
                    value = float(match.group(1))
                    if 'decrease' in model_output.lower() or 'down' in model_output.lower() or 'drop' in model_output.lower():
                        return -value
                    else:
                        return value

        return None

    def _parse_price(self, model_output: str, current_price: float) -> Optional[float]:
        """
        Extract predicted price from model output.

        Returns: Predicted price as float, or None if not found
        """
        # Look for patterns like: "$58.50", "$57-60", "Expected: $55"
        patterns = [
            r'(?:Expected|Predicted|Price)[:\s]+\$([0-9.]+)',  # "Expected: $58.50"
            r'\$([0-9.]+)\s*(?:in 30 days|next month)',  # "$58.50 in 30 days"
            r'(?:reach|hit|around)\s+\$([0-9.]+)',  # "reach $58.50"
        ]

        for pattern in patterns:
            match = re.search(pattern, model_output, re.IGNORECASE)
            if match:
                return float(match.group(1))

        # Look for price range: "$57-60"
        range_match = re.search(r'\$([0-9.]+)\s*-\s*\$?([0-9.]+)', model_output)
        if range_match:
            lower = float(range_match.group(1))
            upper = float(range_match.group(2))
            # Return midpoint
            return (lower + upper) / 2.0

        return None


# Example usage:
if __name__ == "__main__":
    # This would be used by the evaluation runner
    task = MarketPredictionTask()

    print(f"Task: {task.name}")
    print(f"Eval Type: {task.eval_type}")
    print(f"Number of examples: {len(task)}")

    # Get first example
    if len(task) > 0:
        example = task[0]
        print(f"\nExample prompt:\n{example['prompt']}")
        print(f"\nActual trend: {example['actual_trend']}")
        print(f"Actual change: {example['actual_change_pct']:.1f}%")
        print(f"Actual price: ${example['actual_price_30d_later']:.2f}")
