"""
Generative Evaluator

Full sampling evaluation for generative tasks.
Inspired by NanoChat's generative evaluation (scripts/chat_eval.py lines 50-95).

Used for tasks requiring:
- Free-form text generation
- Market predictions with explanations
- Price estimates with reasoning
- Complex multi-step answers

Key Features:
- Deterministic inference using torch.Generator
- Temperature and top-k sampling controls
- Max token limits
- Graceful handling of long outputs

Example:
    Prompt: "Predict the price trend for Charizard ex over 30 days"
    Model Output: "I predict this card will INCREASE in value by 10-15%.
                   The recent uptrend and strong demand suggest continued growth.
                   Expected price: $57-60 (currently $52)."
    → Parse: Trend=UP, Change=+12.5%, Price=$58.50
"""

import torch
import math
from typing import Dict, Any, List, Optional
from transformers import AutoTokenizer, AutoModelForCausalLM


class GenerativeEvaluator:
    """
    Generative evaluation using full sampling.

    Evaluates tasks like:
    - Market predictions
    - Card analysis with explanations
    - Price forecasting
    - Multi-step reasoning
    """

    def __init__(
        self,
        model_name: str = "ChicoPanama/mew1a-llama-3.2-3b-tcg-pricing",
        device: str = "cuda" if torch.cuda.is_available() else "cpu",
        seed: int = 42
    ):
        """
        Initialize evaluator with model.

        Args:
            model_name: HuggingFace model name or path
            device: Device to run inference on
            seed: Random seed for deterministic inference
        """
        self.device = device
        self.model_name = model_name
        self.seed = seed

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

        # Set pad token if not set
        if self.tokenizer.pad_token is None:
            self.tokenizer.pad_token = self.tokenizer.eos_token

        print(f"Model loaded on {device}")

    def evaluate_task(
        self,
        task,
        max_examples: Optional[int] = None,
        temperature: float = 0.7,
        top_k: int = 50,
        max_new_tokens: int = 150
    ) -> Dict[str, Any]:
        """
        Evaluate a generative task.

        Args:
            task: Task instance (must have eval_type='generative')
            max_examples: Max examples to evaluate (None = all)
            temperature: Sampling temperature (0.0 = greedy, higher = more random)
            top_k: Top-k sampling parameter
            max_new_tokens: Max tokens to generate per response

        Returns:
            {
                'accuracy': float - Overall accuracy (0.0-1.0)
                'avg_score': float - Average score across examples
                'num_total': int - Total number of examples
                'predictions': List[Dict] - Individual predictions
                'task_name': str - Task name
            }
        """
        assert task.eval_type == "generative", \
            f"Task must be generative, got {task.eval_type}"

        num_examples = min(len(task), max_examples) if max_examples else len(task)
        predictions = []
        total_score = 0.0
        num_correct = 0

        print(f"Evaluating {num_examples} examples from task: {task.name}")
        print(f"Generation params: temp={temperature}, top_k={top_k}, max_tokens={max_new_tokens}")

        for i in range(num_examples):
            example = task[i]

            # Generate response
            generated_text = self._generate(
                prompt=example['prompt'],
                temperature=temperature,
                top_k=top_k,
                max_new_tokens=max_new_tokens,
                seed=self.seed + i  # Deterministic but different per example
            )

            # Evaluate using task's evaluate method
            eval_result = task.evaluate(example, generated_text)

            predictions.append({
                'example_idx': i,
                'prompt': example['prompt'],
                'generated_text': generated_text,
                'correct': eval_result['correct'],
                'score': eval_result['score'],
                **eval_result  # Include task-specific metrics
            })

            total_score += eval_result['score']
            if eval_result['correct']:
                num_correct += 1

            # Progress update
            if (i + 1) % 10 == 0 or (i + 1) == num_examples:
                accuracy_so_far = num_correct / (i + 1)
                avg_score_so_far = total_score / (i + 1)
                print(f"  Progress: {i+1}/{num_examples} | Accuracy: {accuracy_so_far:.3f} | Avg Score: {avg_score_so_far:.3f}")

        accuracy = num_correct / num_examples
        avg_score = total_score / num_examples

        return {
            'accuracy': accuracy,
            'avg_score': avg_score,
            'num_correct': num_correct,
            'num_total': num_examples,
            'predictions': predictions,
            'task_name': task.name,
        }

    def _generate(
        self,
        prompt: str,
        temperature: float = 0.7,
        top_k: int = 50,
        max_new_tokens: int = 150,
        seed: int = 42
    ) -> str:
        """
        Generate text using deterministic sampling.

        Args:
            prompt: Input prompt
            temperature: Sampling temperature
            top_k: Top-k sampling
            max_new_tokens: Max tokens to generate
            seed: Random seed for reproducibility

        Returns:
            Generated text (excluding prompt)
        """
        # Tokenize input
        inputs = self.tokenizer(
            prompt,
            return_tensors="pt",
            truncation=True,
            max_length=512
        ).to(self.device)

        input_length = inputs['input_ids'].shape[1]

        # Create generator for deterministic sampling
        generator = torch.Generator(device=self.device)
        generator.manual_seed(seed)

        # Generate
        with torch.no_grad():
            outputs = self.model.generate(
                **inputs,
                max_new_tokens=max_new_tokens,
                temperature=temperature if temperature > 0 else None,
                top_k=top_k if temperature > 0 else None,
                do_sample=temperature > 0,  # Greedy if temp=0
                pad_token_id=self.tokenizer.pad_token_id,
                eos_token_id=self.tokenizer.eos_token_id,
                generator=generator if temperature > 0 else None,
            )

        # Decode output (excluding input prompt)
        generated_tokens = outputs[0][input_length:]
        generated_text = self.tokenizer.decode(generated_tokens, skip_special_tokens=True)

        return generated_text.strip()

    def generate_example(
        self,
        prompt: str,
        temperature: float = 0.7,
        top_k: int = 50,
        max_new_tokens: int = 150
    ) -> str:
        """
        Generate text for a single example.

        Args:
            prompt: Input prompt
            temperature: Sampling temperature
            top_k: Top-k sampling
            max_new_tokens: Max tokens to generate

        Returns:
            Generated text
        """
        return self._generate(
            prompt=prompt,
            temperature=temperature,
            top_k=top_k,
            max_new_tokens=max_new_tokens,
            seed=self.seed
        )


# Example usage:
if __name__ == "__main__":
    from market_prediction import MarketPredictionTask

    # Initialize evaluator
    evaluator = GenerativeEvaluator(
        model_name="ChicoPanama/mew1a-llama-3.2-3b-tcg-pricing"
    )

    # Test on a single example
    prompt = """Market Prediction Challenge

Card: Charizard ex - Obsidian Flames
Current Price: $52.00
30-Day Trend: up 15.0%
Date: 2024-09-15

Question: Will this card's price INCREASE, DECREASE, or stay STABLE over the next 30 days?

Provide your prediction with:
1. Direction (INCREASE/DECREASE/STABLE)
2. Expected price or percentage change

Your prediction:"""

    result = evaluator.generate_example(
        prompt,
        temperature=0.7,
        max_new_tokens=150
    )

    print(f"\nSingle Example Test:")
    print(f"Prompt: {prompt[:150]}...")
    print(f"\nGenerated Response:")
    print(result)
