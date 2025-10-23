"""
Card Knowledge Evaluation Task

Tests the model's factual knowledge about Pokemon TCG cards.
Uses categorical evaluation (multiple choice) for fast evaluation.

Knowledge Categories:
- Card Rarity (Common, Uncommon, Rare, Ultra Rare, etc.)
- Card Type (Fire, Water, Grass, Lightning, Psychic, etc.)
- HP Value (Health Points)
- Set Information (Base Set, Jungle, Fossil, etc.)
- Card Number in Set
- Attack Names and Damage
- Weakness/Resistance

Example:
    Q: What is the rarity of Charizard from Base Set?
    A) Common
    B) Uncommon
    C) Rare Holo ✓
    D) Ultra Rare
"""

import json
import re
from pathlib import Path
from typing import Dict, Any, List, Optional

from .task_base import Task


class CardKnowledgeTask(Task):
    """
    Categorical evaluation task for card knowledge.

    Tests factual knowledge about Pokemon cards using multiple choice format.
    Fast logit-based evaluation without full sampling.
    """

    def __init__(
        self,
        data_path: Optional[str] = None,
        start: int = 0,
        stop: Optional[int] = None,
        step: int = 1
    ):
        """
        Initialize card knowledge task.

        Args:
            data_path: Path to test data JSON file (card_knowledge_500.json)
            start: Start index for slicing
            stop: Stop index for slicing (None = use full dataset)
            step: Step size for slicing
        """
        super().__init__(start, stop, step)

        if data_path is None:
            # Default path relative to this file
            data_path = Path(__file__).parent / "test_data" / "card_knowledge_500.json"

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
        return "CardKnowledge"

    def num_examples(self) -> int:
        """Return total number of examples."""
        return len(self._examples)

    def get_example(self, index: int) -> Dict[str, Any]:
        """
        Get a single test example.

        Returns:
            {
                'prompt': str - The knowledge question for the model
                'question_type': str - Type of knowledge being tested
                'card_name': str - Card being asked about
                'choices': List[str] - Multiple choice options (4 choices)
                'correct_choice': int - Index of correct answer (0-3)
                'correct_answer': str - The correct answer text
            }
        """
        example = self._examples[index]

        card_name = example['card_name']
        question_type = example['question_type']
        correct_answer = example['correct_answer']
        distractors = example['distractors']  # List of 3 wrong answers

        # Build choices (1 correct + 3 distractors, randomized)
        choices = self._build_choices(correct_answer, distractors)
        correct_choice = choices.index(correct_answer)

        # Format prompt
        prompt = self._format_prompt(card_name, question_type, choices)

        return {
            'prompt': prompt,
            'question_type': question_type,
            'card_name': card_name,
            'choices': choices,
            'correct_choice': correct_choice,
            'correct_answer': correct_answer,
            'metadata': example
        }

    def _build_choices(self, correct: str, distractors: List[str]) -> List[str]:
        """
        Build 4-choice list from correct answer + distractors.

        In the test data, distractors are already randomized.
        We'll insert the correct answer at position 1 for consistency.
        """
        # Place correct answer at index 1, distractors at 0, 2, 3
        choices = [
            distractors[0],
            correct,
            distractors[1],
            distractors[2]
        ]
        return choices

    def _format_prompt(
        self,
        card_name: str,
        question_type: str,
        choices: List[str]
    ) -> str:
        """
        Format the prompt for the model.

        Question types:
        - rarity: "What is the rarity of {card}?"
        - type: "What type is {card}?"
        - hp: "What is the HP of {card}?"
        - set: "Which set is {card} from?"
        - card_number: "What is the card number of {card}?"
        - attack: "What is the main attack of {card}?"
        - weakness: "What is the weakness of {card}?"
        """
        question_templates = {
            'rarity': f"What is the rarity of {card_name}?",
            'type': f"What type is {card_name}?",
            'hp': f"What is the HP of {card_name}?",
            'set': f"Which set is {card_name} from?",
            'card_number': f"What is the card number of {card_name} in its set?",
            'attack': f"What is the main attack of {card_name}?",
            'weakness': f"What is the weakness of {card_name}?",
            'resistance': f"What is the resistance of {card_name}?",
        }

        question = question_templates.get(question_type, f"Question about {card_name}:")

        choices_text = "\n".join([f"{chr(65+i)}. {choice}" for i, choice in enumerate(choices)])

        prompt = f"""{question}

{choices_text}

Answer with just the letter (A, B, C, or D):"""

        return prompt

    def evaluate(self, example: Dict[str, Any], model_output: str) -> Dict[str, Any]:
        """
        Evaluate model output against ground truth.

        For categorical evaluation:
        - Parse model's choice (A/B/C/D)
        - Check if it matches correct_choice
        - Track accuracy by question type

        Args:
            example: The test example from get_example()
            model_output: The model's response (should be "A", "B", "C", or "D")

        Returns:
            {
                'correct': bool - Whether choice was correct
                'score': float - 1.0 if correct, 0.0 if wrong
                'predicted_choice': str - Model's choice (A/B/C/D)
                'correct_choice': str - Ground truth choice
                'question_type': str - Type of knowledge tested
                'card_name': str - Card name
            }
        """
        correct_choice_idx = example['correct_choice']
        correct_choice_letter = chr(65 + correct_choice_idx)  # 0→A, 1→B, etc.

        # Parse model output (extract first letter A-D)
        predicted_choice = self._parse_choice(model_output)

        # Check if correct
        is_correct = (predicted_choice == correct_choice_letter)

        return {
            'correct': is_correct,
            'score': 1.0 if is_correct else 0.0,
            'predicted_choice': predicted_choice,
            'correct_choice': correct_choice_letter,
            'question_type': example['question_type'],
            'card_name': example['card_name'],
            'correct_answer': example['correct_answer'],
        }

    def _parse_choice(self, model_output: str) -> str:
        """
        Extract choice letter (A/B/C/D) from model output.

        Handles various formats:
        - "A"
        - "The answer is B"
        - "C"
        - "I think D"
        """
        model_output = model_output.strip().upper()

        # Try to find A, B, C, or D in the output
        for choice in ['A', 'B', 'C', 'D']:
            if choice in model_output:
                return choice

        # Fallback: invalid choice
        return "INVALID"


# Example usage:
if __name__ == "__main__":
    # This would be used by the evaluation runner
    task = CardKnowledgeTask()

    print(f"Task: {task.name}")
    print(f"Eval Type: {task.eval_type}")
    print(f"Number of examples: {len(task)}")

    # Get first example
    if len(task) > 0:
        example = task[0]
        print(f"\nExample prompt:\n{example['prompt']}")
        print(f"\nCorrect choice: {chr(65 + example['correct_choice'])}")
        print(f"Correct answer: {example['correct_answer']}")
        print(f"Question type: {example['question_type']}")
