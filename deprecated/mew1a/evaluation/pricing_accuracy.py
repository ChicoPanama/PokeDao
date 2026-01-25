"""
Pricing Accuracy Evaluation Task

Tests the model's ability to accurately predict Pokemon TCG card prices.
Uses categorical evaluation (logit-based) for fast evaluation without sampling.

Evaluation Criteria:
- Exact Match: Predicted price == Ground truth price
- ±5% Tolerance: |predicted - actual| / actual <= 0.05
- ±10% Tolerance: |predicted - actual| / actual <= 0.10
- ±15% Tolerance: |predicted - actual| / actual <= 0.15

Example:
    Card: Charizard ex - Obsidian Flames
    Actual Price: $52.00
    Predicted Price: $49.00
    Error: 5.77% → Passes ±10% tolerance
"""

import json
import re
from pathlib import Path
from typing import Dict, Any, List, Optional

from .task_base import Task


class PricingAccuracyTask(Task):
    """
    Categorical evaluation task for pricing accuracy.

    Uses multiple-choice format where model selects from price ranges.
    This allows fast logit-based evaluation without full sampling.
    """

    def __init__(
        self,
        data_path: Optional[str] = None,
        start: int = 0,
        stop: Optional[int] = None,
        step: int = 1
    ):
        """
        Initialize pricing accuracy task.

        Args:
            data_path: Path to test data JSON file (historical_deals_1000.json)
            start: Start index for slicing
            stop: Stop index for slicing (None = use full dataset)
            step: Step size for slicing
        """
        super().__init__(start, stop, step)

        if data_path is None:
            # Default path relative to this file
            data_path = Path(__file__).parent / "test_data" / "historical_deals_1000.json"

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
        return "PricingAccuracy"

    def num_examples(self) -> int:
        """Return total number of examples."""
        return len(self._examples)

    def get_example(self, index: int) -> Dict[str, Any]:
        """
        Get a single test example.

        Returns:
            {
                'prompt': str - The pricing question for the model
                'target_price': float - Ground truth price
                'card_name': str - Card name
                'sold_date': str - When the card sold
                'choices': List[str] - Multiple choice options
                'correct_choice': int - Index of correct price range
            }
        """
        example = self._examples[index]

        card_name = example['card_name']
        target_price = float(example['sold_price'])
        sold_date = example.get('sold_date', 'Unknown')

        # Generate multiple choice options based on actual price
        choices = self._generate_choices(target_price)
        correct_choice = self._get_correct_choice(target_price, choices)

        # Format prompt for the model
        prompt = self._format_prompt(card_name, choices, sold_date)

        return {
            'prompt': prompt,
            'target_price': target_price,
            'card_name': card_name,
            'sold_date': sold_date,
            'choices': choices,
            'correct_choice': correct_choice,
            'metadata': example
        }

    def _generate_choices(self, actual_price: float) -> List[str]:
        """
        Generate 4 plausible price range choices.

        Strategy:
        - One correct range (±10% of actual)
        - Three distractors (lower, higher, much higher)
        """
        # Correct range: ±10%
        lower_bound = actual_price * 0.9
        upper_bound = actual_price * 1.1
        correct = f"${lower_bound:.2f} - ${upper_bound:.2f}"

        # Distractor 1: Much lower (50-70% of actual)
        low_price = actual_price * 0.6
        distractor_low = f"${low_price * 0.9:.2f} - ${low_price * 1.1:.2f}"

        # Distractor 2: Higher (130-150% of actual)
        high_price = actual_price * 1.4
        distractor_high = f"${high_price * 0.9:.2f} - ${high_price * 1.1:.2f}"

        # Distractor 3: Much higher (200-220% of actual)
        very_high_price = actual_price * 2.1
        distractor_very_high = f"${very_high_price * 0.9:.2f} - ${very_high_price * 1.1:.2f}"

        # Randomize order (but track correct answer)
        choices = [distractor_low, correct, distractor_high, distractor_very_high]

        return choices

    def _get_correct_choice(self, actual_price: float, choices: List[str]) -> int:
        """Find which choice contains the actual price."""
        for i, choice in enumerate(choices):
            # Parse choice range (e.g., "$45.00 - $55.00")
            match = re.match(r'\$([0-9.]+)\s*-\s*\$([0-9.]+)', choice)
            if match:
                lower = float(match.group(1))
                upper = float(match.group(2))
                if lower <= actual_price <= upper:
                    return i

        # Fallback: choice 1 (where we placed the correct range)
        return 1

    def _format_prompt(self, card_name: str, choices: List[str], sold_date: str) -> str:
        """
        Format the prompt for the model.

        Returns a prompt that asks the model to select the correct price range.
        """
        choices_text = "\n".join([f"{chr(65+i)}. {choice}" for i, choice in enumerate(choices)])

        prompt = f"""What is the fair market value for this Pokemon card?

Card: {card_name}
Reference Date: {sold_date}

Select the price range:
{choices_text}

Answer with just the letter (A, B, C, or D):"""

        return prompt

    def evaluate(self, example: Dict[str, Any], model_output: str) -> Dict[str, Any]:
        """
        Evaluate model output against ground truth.

        For categorical evaluation:
        - Parse model's choice (A/B/C/D)
        - Check if it matches correct_choice
        - Calculate price error metrics

        Args:
            example: The test example from get_example()
            model_output: The model's response (should be "A", "B", "C", or "D")

        Returns:
            {
                'correct': bool - Whether choice was correct
                'score': float - 1.0 if correct, 0.0 if wrong
                'predicted_choice': str - Model's choice (A/B/C/D)
                'correct_choice': str - Ground truth choice
                'price_error_pct': float - Percentage error (if parseable)
                'passes_5pct': bool - Whether within ±5%
                'passes_10pct': bool - Whether within ±10%
                'passes_15pct': bool - Whether within ±15%
            }
        """
        target_price = example['target_price']
        correct_choice_idx = example['correct_choice']
        correct_choice_letter = chr(65 + correct_choice_idx)  # 0→A, 1→B, etc.

        # Parse model output (extract first letter A-D)
        predicted_choice = self._parse_choice(model_output)

        # Check if correct
        is_correct = (predicted_choice == correct_choice_letter)

        # Try to extract predicted price from model output (if available)
        predicted_price = self._extract_price_from_output(model_output, example['choices'])

        # Calculate price error metrics
        price_error_pct = None
        passes_5pct = None
        passes_10pct = None
        passes_15pct = None

        if predicted_price is not None:
            price_error_pct = abs(predicted_price - target_price) / target_price * 100
            passes_5pct = price_error_pct <= 5.0
            passes_10pct = price_error_pct <= 10.0
            passes_15pct = price_error_pct <= 15.0

        return {
            'correct': is_correct,
            'score': 1.0 if is_correct else 0.0,
            'predicted_choice': predicted_choice,
            'correct_choice': correct_choice_letter,
            'predicted_price': predicted_price,
            'target_price': target_price,
            'price_error_pct': price_error_pct,
            'passes_5pct': passes_5pct,
            'passes_10pct': passes_10pct,
            'passes_15pct': passes_15pct,
        }

    def _parse_choice(self, model_output: str) -> str:
        """
        Extract choice letter (A/B/C/D) from model output.

        Handles various formats:
        - "A"
        - "The answer is B"
        - "C. $50-60"
        - "I choose D"
        """
        model_output = model_output.strip().upper()

        # Try to find A, B, C, or D in the output
        for choice in ['A', 'B', 'C', 'D']:
            if choice in model_output:
                return choice

        # Fallback: invalid choice
        return "INVALID"

    def _extract_price_from_output(
        self,
        model_output: str,
        choices: List[str]
    ) -> Optional[float]:
        """
        Extract predicted price from model output.

        If model chose a price range, return the midpoint.
        """
        predicted_choice = self._parse_choice(model_output)

        if predicted_choice == "INVALID":
            return None

        # Get the choice index (A→0, B→1, etc.)
        choice_idx = ord(predicted_choice) - 65

        if choice_idx < 0 or choice_idx >= len(choices):
            return None

        # Parse the chosen price range
        choice = choices[choice_idx]
        match = re.match(r'\$([0-9.]+)\s*-\s*\$([0-9.]+)', choice)

        if match:
            lower = float(match.group(1))
            upper = float(match.group(2))
            # Return midpoint
            return (lower + upper) / 2.0

        return None


# Example usage:
if __name__ == "__main__":
    # This would be used by the evaluation runner
    task = PricingAccuracyTask()

    print(f"Task: {task.name}")
    print(f"Eval Type: {task.eval_type}")
    print(f"Number of examples: {len(task)}")

    # Get first example
    if len(task) > 0:
        example = task[0]
        print(f"\nExample prompt:\n{example['prompt']}")
        print(f"\nCorrect choice: {chr(65 + example['correct_choice'])}")
        print(f"Target price: ${example['target_price']:.2f}")
