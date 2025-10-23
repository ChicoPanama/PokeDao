"""
Categorical Evaluator

Fast evaluation using logits only, without full sampling.
Inspired by NanoChat's categorical evaluation (scripts/chat_eval.py lines 115-180).

Key Advantage: 10-100x faster than generative evaluation.

How it works:
1. Get model logits for the next token
2. Extract probabilities for answer tokens (A/B/C/D, BUY/PASS, etc.)
3. Select highest probability token as prediction
4. Compare to ground truth

Example:
    Prompt: "BUY or PASS? Card: Charizard $45, Fair value $52"
    Model logits: { "BUY": 0.85, "PASS": 0.15 }
    Prediction: "BUY" (85% confidence)
    Ground truth: "BUY"
    → CORRECT ✓
"""

import torch
import torch.nn.functional as F
from typing import Dict, Any, List, Optional, Tuple
from transformers import AutoTokenizer, AutoModelForCausalLM


class CategoricalEvaluator:
    """
    Fast categorical evaluation using logits.

    Evaluates tasks like:
    - BUY/PASS decisions (2 choices)
    - Multiple choice questions (4 choices: A/B/C/D)
    - Price range selection
    """

    def __init__(
        self,
        model_name: str = "ChicoPanama/mew1a-llama-3.2-3b-tcg-pricing",
        device: str = "cuda" if torch.cuda.is_available() else "cpu"
    ):
        """
        Initialize evaluator with model.

        Args:
            model_name: HuggingFace model name or path
            device: Device to run inference on
        """
        self.device = device
        self.model_name = model_name

        print(f"Loading model: {model_name}")
        self.tokenizer = AutoTokenizer.from_pretrained(model_name)
        self.model = AutoModelForCausalLM.from_pretrained(
            model_name,
            torch_dtype=torch.float16 if device == "cuda" else torch.float32,
            device_map="auto" if device == "cuda" else None
        )

        if device == "cpu":
            self.model = self.model.to(device)

        self.model.eval()

        print(f"Model loaded on {device}")

    def evaluate_task(
        self,
        task,
        batch_size: int = 8,
        max_examples: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Evaluate a categorical task.

        Args:
            task: Task instance (must have eval_type='categorical')
            batch_size: Batch size for inference
            max_examples: Max examples to evaluate (None = all)

        Returns:
            {
                'accuracy': float - Overall accuracy (0.0-1.0)
                'num_correct': int - Number of correct predictions
                'num_total': int - Total number of examples
                'predictions': List[Dict] - Individual predictions
                'task_name': str - Task name
            }
        """
        assert task.eval_type == "categorical", \
            f"Task must be categorical, got {task.eval_type}"

        num_examples = min(len(task), max_examples) if max_examples else len(task)
        predictions = []
        num_correct = 0

        print(f"Evaluating {num_examples} examples from task: {task.name}")

        for i in range(0, num_examples, batch_size):
            batch_end = min(i + batch_size, num_examples)
            batch_examples = [task[j] for j in range(i, batch_end)]

            # Evaluate batch
            batch_results = self._evaluate_batch(batch_examples, task)

            for example, result in zip(batch_examples, batch_results):
                # Score using task's evaluate method
                eval_result = task.evaluate(example, result['predicted_answer'])

                predictions.append({
                    'example_idx': i + len(predictions),
                    'prompt': example['prompt'],
                    'predicted_answer': result['predicted_answer'],
                    'confidence': result['confidence'],
                    'correct': eval_result['correct'],
                    'score': eval_result['score'],
                    **eval_result  # Include task-specific metrics
                })

                if eval_result['correct']:
                    num_correct += 1

            # Progress update
            if (batch_end % 50 == 0) or (batch_end == num_examples):
                accuracy_so_far = num_correct / batch_end
                print(f"  Progress: {batch_end}/{num_examples} | Accuracy: {accuracy_so_far:.3f}")

        accuracy = num_correct / num_examples

        return {
            'accuracy': accuracy,
            'num_correct': num_correct,
            'num_total': num_examples,
            'predictions': predictions,
            'task_name': task.name,
        }

    def _evaluate_batch(
        self,
        examples: List[Dict[str, Any]],
        task
    ) -> List[Dict[str, Any]]:
        """
        Evaluate a batch of examples using logits.

        Returns list of:
        {
            'predicted_answer': str - The predicted answer
            'confidence': float - Confidence (0.0-1.0)
            'logits': Dict[str, float] - Logits for each answer choice
        }
        """
        prompts = [ex['prompt'] for ex in examples]

        # Tokenize prompts
        inputs = self.tokenizer(
            prompts,
            return_tensors="pt",
            padding=True,
            truncation=True,
            max_length=512
        ).to(self.device)

        # Get logits
        with torch.no_grad():
            outputs = self.model(**inputs)
            logits = outputs.logits  # (batch_size, seq_len, vocab_size)

        # Get logits for next token (last position)
        next_token_logits = logits[:, -1, :]  # (batch_size, vocab_size)

        results = []

        for i, example in enumerate(examples):
            # Determine answer choices based on task type
            if task.name == "BuyPass":
                answer_choices = ["BUY", "PASS"]
            elif task.name in ["PricingAccuracy", "CardKnowledge"]:
                answer_choices = ["A", "B", "C", "D"]
            else:
                # Default: extract from example
                if 'choices' in example:
                    answer_choices = ["A", "B", "C", "D"]
                else:
                    raise ValueError(f"Unknown task type: {task.name}")

            # Get token IDs for answer choices
            choice_token_ids = []
            for choice in answer_choices:
                # Handle space prefix (Llama tokenizer often needs this)
                tokens_with_space = self.tokenizer.encode(f" {choice}", add_special_tokens=False)
                tokens_no_space = self.tokenizer.encode(choice, add_special_tokens=False)

                # Use the first token (most reliable)
                if len(tokens_with_space) > 0:
                    choice_token_ids.append(tokens_with_space[0])
                elif len(tokens_no_space) > 0:
                    choice_token_ids.append(tokens_no_space[0])
                else:
                    raise ValueError(f"Could not tokenize choice: {choice}")

            # Extract logits for answer tokens
            choice_logits = next_token_logits[i, choice_token_ids]  # (num_choices,)

            # Apply softmax to get probabilities
            choice_probs = F.softmax(choice_logits, dim=-1)

            # Get predicted choice
            pred_idx = torch.argmax(choice_probs).item()
            predicted_answer = answer_choices[pred_idx]
            confidence = choice_probs[pred_idx].item()

            # Build logits dict
            logits_dict = {
                choice: choice_probs[j].item()
                for j, choice in enumerate(answer_choices)
            }

            results.append({
                'predicted_answer': predicted_answer,
                'confidence': confidence,
                'logits': logits_dict,
            })

        return results

    def evaluate_example(
        self,
        prompt: str,
        answer_choices: List[str]
    ) -> Dict[str, Any]:
        """
        Evaluate a single example.

        Args:
            prompt: The prompt text
            answer_choices: List of possible answers (e.g., ["A", "B", "C", "D"])

        Returns:
            {
                'predicted_answer': str - The predicted answer
                'confidence': float - Confidence (0.0-1.0)
                'logits': Dict[str, float] - Probability for each choice
            }
        """
        # Tokenize prompt
        inputs = self.tokenizer(
            prompt,
            return_tensors="pt",
            truncation=True,
            max_length=512
        ).to(self.device)

        # Get logits
        with torch.no_grad():
            outputs = self.model(**inputs)
            logits = outputs.logits  # (1, seq_len, vocab_size)

        # Get logits for next token
        next_token_logits = logits[0, -1, :]  # (vocab_size,)

        # Get token IDs for answer choices
        choice_token_ids = []
        for choice in answer_choices:
            tokens_with_space = self.tokenizer.encode(f" {choice}", add_special_tokens=False)
            tokens_no_space = self.tokenizer.encode(choice, add_special_tokens=False)

            if len(tokens_with_space) > 0:
                choice_token_ids.append(tokens_with_space[0])
            elif len(tokens_no_space) > 0:
                choice_token_ids.append(tokens_no_space[0])
            else:
                raise ValueError(f"Could not tokenize choice: {choice}")

        # Extract logits for answer tokens
        choice_logits = next_token_logits[choice_token_ids]  # (num_choices,)

        # Apply softmax
        choice_probs = F.softmax(choice_logits, dim=-1)

        # Get prediction
        pred_idx = torch.argmax(choice_probs).item()
        predicted_answer = answer_choices[pred_idx]
        confidence = choice_probs[pred_idx].item()

        # Build logits dict
        logits_dict = {
            choice: choice_probs[j].item()
            for j, choice in enumerate(answer_choices)
        }

        return {
            'predicted_answer': predicted_answer,
            'confidence': confidence,
            'logits': logits_dict,
        }


# Example usage:
if __name__ == "__main__":
    from pricing_accuracy import PricingAccuracyTask
    from buy_pass_task import BuyPassTask

    # Initialize evaluator
    evaluator = CategoricalEvaluator(
        model_name="ChicoPanama/mew1a-llama-3.2-3b-tcg-pricing"
    )

    # Test on a single example
    prompt = """BUY or PASS?

Card: Charizard ex - Obsidian Flames
Listed Price: $45.00
Fair Value: $52.00
Discount: 13.5%
Market Trend: stable

Decision (BUY or PASS):"""

    result = evaluator.evaluate_example(prompt, ["BUY", "PASS"])
    print(f"\nSingle Example Test:")
    print(f"Prompt: {prompt[:100]}...")
    print(f"Prediction: {result['predicted_answer']}")
    print(f"Confidence: {result['confidence']:.3f}")
    print(f"Logits: {result['logits']}")
