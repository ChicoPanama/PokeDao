#!/usr/bin/env python3
"""
RunPod: Generate BUY/PASS Investment Decision Examples with Llama 3.1 8B

Problem: Only 2% of training data has explicit BUY/PASS recommendations
Solution: Generate 15,000 investment decision examples with reasoning

Strategy:
1. Generate scenarios: overpriced, underpriced, trending up/down
2. Use Llama 3.1 8B to create financial reasoning chains
3. Explicit BUY/PASS/HOLD recommendations with justification

Expected:
- Output: 15,000 BUY/PASS examples
- Time: ~20 minutes on RunPod RTX 4090
- Cost: ~$0.40

RunPod Setup:
- Template: RunPod PyTorch
- GPU: RTX 4090 or A100
- Storage: 30GB
"""

import json
import torch
from transformers import AutoModelForCausalLM, AutoTokenizer
from pathlib import Path
import time
import random
from tqdm import tqdm

# Configuration
MODEL_NAME = "meta-llama/Llama-3.1-8B-Instruct"  # Better reasoning than 3.2-3B
TARGET_COUNT = 15000
BATCH_SIZE = 8
MAX_NEW_TOKENS = 200

# Investment scenario templates
SCENARIOS = {
    "strong_buy": {
        "count": 3000,
        "templates": [
            "{card} - Listed ${listed}, Fair Value ${fair_value}, trending up {trend}%",
            "{card} PSA {grade} - Listed ${listed}, Recent sales ${fair_value}, increasing demand",
            "{card} - Current price ${listed}, Historically sells for ${fair_value}, limited supply",
        ],
        "logic": lambda: {
            "listed": random.randint(30, 80),
            "fair_value": lambda l: l * random.uniform(1.2, 1.5),  # 20-50% underpriced
            "trend": random.randint(5, 20),  # Trending up
            "grade": random.choice([9, 9.5, 10])
        }
    },
    "moderate_buy": {
        "count": 3000,
        "templates": [
            "{card} - Listed ${listed}, Fair Value ${fair_value}, stable market",
            "{card} - Current ${listed}, Average recent ${fair_value}, good condition",
            "{card} PSA {grade} - Listed ${listed}, Typical range ${fair_value}",
        ],
        "logic": lambda: {
            "listed": random.randint(40, 100),
            "fair_value": lambda l: l * random.uniform(1.05, 1.15),  # 5-15% underpriced
            "trend": random.randint(-2, 5),  # Stable
            "grade": random.choice([8, 8.5, 9])
        }
    },
    "hold": {
        "count": 3000,
        "templates": [
            "{card} - Listed ${listed}, Fair Value ${fair_value}, uncertain trend",
            "{card} - Current ${listed}, Market value ${fair_value}, mixed signals",
            "{card} - Listed ${listed}, Fair ${fair_value}, low volume",
        ],
        "logic": lambda: {
            "listed": random.randint(50, 150),
            "fair_value": lambda l: l * random.uniform(0.95, 1.05),  # At fair value
            "trend": random.randint(-3, 3),  # Flat
            "grade": random.choice([7, 8, 9])
        }
    },
    "pass": {
        "count": 4000,
        "templates": [
            "{card} - Listed ${listed}, Fair Value ${fair_value}, trending down {trend}%",
            "{card} - Current ${listed}, Recently sold ${fair_value}, declining interest",
            "{card} PSA {grade} - Listed ${listed}, Market value ${fair_value}, overpriced",
        ],
        "logic": lambda: {
            "listed": random.randint(80, 200),
            "fair_value": lambda l: l * random.uniform(0.6, 0.9),  # 10-40% overpriced
            "trend": random.randint(-20, -5),  # Trending down
            "grade": random.choice([7, 8, 9])
        }
    },
    "strong_pass": {
        "count": 2000,
        "templates": [
            "{card} - Listed ${listed}, Fair Value ${fair_value}, trending down {trend}%",
            "{card} - Asking ${listed}, Typical ${fair_value}, major red flags",
            "{card} - Listed ${listed}, Fair ${fair_value}, reprint announced",
        ],
        "logic": lambda: {
            "listed": random.randint(100, 300),
            "fair_value": lambda l: l * random.uniform(0.4, 0.7),  # 30-60% overpriced!
            "trend": random.randint(-35, -15),  # Crashing
            "grade": random.choice([6, 7, 8])
        }
    }
}

# Common Pokemon cards for scenarios
CARDS = [
    "Charizard ex", "Pikachu VMAX", "Umbreon VMAX", "Mewtwo VSTAR",
    "Rayquaza VMAX", "Giratina VSTAR", "Lugia VSTAR", "Arceus VSTAR",
    "Charizard VSTAR", "Pikachu ex", "Mew VMAX", "Dragonite VSTAR",
    "Blastoise ex", "Venusaur ex", "Gengar VMAX", "Machamp VMAX"
]

class BuyPassGenerator:
    def __init__(self, model_name: str = MODEL_NAME):
        self.model_name = model_name
        self.model = None
        self.tokenizer = None
        self.device = "cuda" if torch.cuda.is_available() else "cpu"

    def load_model(self):
        """Load model and tokenizer"""
        print(f"\n📥 Loading {self.model_name}...")
        start = time.time()

        self.tokenizer = AutoTokenizer.from_pretrained(self.model_name, trust_remote_code=True)
        self.model = AutoModelForCausalLM.from_pretrained(
            self.model_name,
            torch_dtype=torch.bfloat16 if self.device == "cuda" else torch.float32,
            device_map="auto",
            trust_remote_code=True
        )

        print(f"✅ Model loaded in {time.time() - start:.1f}s")

    def create_scenario(self, category: str) -> dict:
        """Create investment scenario"""
        config = SCENARIOS[category]
        template = random.choice(config["templates"])
        card = random.choice(CARDS)

        # Generate numbers
        params = config["logic"]()
        listed = params["listed"]
        fair_value = int(params["fair_value"](listed)) if callable(params["fair_value"]) else params["fair_value"]
        trend = params.get("trend", 0)
        grade = params.get("grade")

        # Fill template
        scenario = template.format(
            card=card,
            listed=listed,
            fair_value=fair_value,
            trend=abs(trend),
            grade=grade
        )

        return {
            "scenario": scenario,
            "card": card,
            "listed": listed,
            "fair_value": fair_value,
            "expected_decision": self.map_category_to_decision(category)
        }

    def map_category_to_decision(self, category: str) -> str:
        """Map scenario category to expected decision"""
        mapping = {
            "strong_buy": "BUY",
            "moderate_buy": "BUY",
            "hold": "HOLD",
            "pass": "PASS",
            "strong_pass": "PASS"
        }
        return mapping.get(category, "HOLD")

    def generate_decision(self, scenario: str, expected: str) -> str:
        """Generate BUY/PASS decision with reasoning"""
        system_prompt = """You are Mew-1A, a Pokemon TCG investment analyst specializing in buy/sell decisions.

When analyzing investment opportunities:
1. Compare listed price vs fair value
2. Consider price trends (up/down)
3. Assess condition and grading
4. Make clear BUY, PASS, or HOLD recommendation
5. Provide 2-3 sentence reasoning

Format:
Recommendation: [BUY/PASS/HOLD]
Reasoning: [Why this decision makes financial sense]

Be concise and actionable."""

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"Should I buy this card?\n\n{scenario}"}
        ]

        prompt = self.tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
        inputs = self.tokenizer(prompt, return_tensors="pt", truncation=True, max_length=384).to(self.device)

        with torch.no_grad():
            outputs = self.model.generate(
                **inputs,
                max_new_tokens=MAX_NEW_TOKENS,
                temperature=0.6,
                top_p=0.9,
                do_sample=True,
                pad_token_id=self.tokenizer.eos_token_id
            )

        response = self.tokenizer.decode(outputs[0], skip_special_tokens=True)
        response = response.split("assistant")[-1].strip()

        return response

    def generate_batch(self, category: str, count: int) -> list:
        """Generate batch of BUY/PASS examples"""
        examples = []

        for _ in tqdm(range(count), desc=f"Generating {category}"):
            scenario_data = self.create_scenario(category)
            output = self.generate_decision(scenario_data["scenario"], scenario_data["expected_decision"])

            examples.append({
                "instruction": "Should I buy this card?",
                "input": scenario_data["scenario"],
                "output": output,
                "category": "investment_decision",
                "metadata": {
                    "source": "synthetic_investment",
                    "model": self.model_name,
                    "scenario_type": category,
                    "expected_decision": scenario_data["expected_decision"],
                    "card": scenario_data["card"]
                }
            })

        return examples

def main():
    import argparse
    parser = argparse.ArgumentParser(description='Generate BUY/PASS examples on RunPod')
    parser.add_argument('--output', required=True, help='Output JSONL file')
    parser.add_argument('--count', type=int, default=TARGET_COUNT, help='Total examples')
    args = parser.parse_args()

    print("=" * 80)
    print("RUNPOD: GENERATE BUY/PASS INVESTMENT EXAMPLES")
    print("=" * 80)
    print(f"\nTarget: {args.count:,} examples")
    print(f"Output: {args.output}")
    print(f"Model: {MODEL_NAME}")

    generator = BuyPassGenerator()
    generator.load_model()

    print(f"\n🔧 Generating investment decision examples...")
    start_time = time.time()

    all_examples = []

    for category, config in SCENARIOS.items():
        proportion = config["count"] / TARGET_COUNT
        count = int(args.count * proportion)

        print(f"\n📝 Scenario: {category} ({count:,} examples)")
        examples = generator.generate_batch(category, count)
        all_examples.extend(examples)

    elapsed = time.time() - start_time

    print(f"\n✅ Generation complete!")
    print(f"\n📊 Results:")
    print(f"   Total examples: {len(all_examples):,}")
    print(f"   Time: {elapsed/60:.1f} minutes")
    print(f"   Rate: {len(all_examples)/elapsed:.1f} ex/sec")

    # Decision breakdown
    from collections import Counter
    decisions = Counter(ex['metadata']['expected_decision'] for ex in all_examples)
    print(f"\n   Decision breakdown:")
    for decision, count in decisions.most_common():
        print(f"      {decision}: {count:,} ({count/len(all_examples)*100:.1f}%)")

    # Save
    print(f"\n💾 Saving to {args.output}...")
    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    with open(output_path, 'w') as f:
        for ex in all_examples:
            f.write(json.dumps(ex) + '\n')

    print(f"✅ Saved {len(all_examples):,} examples")

    # Samples
    print(f"\n📋 Sample investment decisions:")
    for ex in random.sample(all_examples, 3):
        print(f"\n   Input: {ex['input']}")
        print(f"   Output: {ex['output'][:120]}...")

    print("\n" + "=" * 80)
    print("COMPLETE!")
    print("=" * 80)
    print(f"\n✅ Generated {len(all_examples):,} BUY/PASS examples")
    print(f"✅ Time: {elapsed/60:.1f} minutes")
    print(f"✅ Cost: ${(elapsed/3600) * 1.00:.2f} (RTX 4090)")

if __name__ == '__main__':
    main()
