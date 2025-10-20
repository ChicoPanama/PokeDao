#!/usr/bin/env python3
"""
RunPod: Generate "I Don't Know" Refusal Examples with Llama 3.2 3B

Problem: 0% of training data teaches model to refuse answering
Solution: Generate 24,000 honest refusal examples

Strategy:
1. Generate diverse query types requiring refusal
2. Use Llama 3.2 3B to create natural refusal responses
3. 5 categories: obscure cards, real-time data, ambiguous, out-of-domain, unanswerable

Expected:
- Output: 24,000 refusal examples
- Time: ~30 minutes on RunPod RTX 4090
- Cost: ~$0.50

RunPod Setup:
- Template: RunPod PyTorch
- GPU: RTX 4090
- Storage: 20GB
"""

import json
import torch
from transformers import AutoModelForCausalLM, AutoTokenizer
from pathlib import Path
import time
import random
from tqdm import tqdm

# Configuration
MODEL_NAME = "meta-llama/Llama-3.2-3B-Instruct"
TARGET_COUNT = 24000
BATCH_SIZE = 16
MAX_NEW_TOKENS = 150

# Refusal categories and templates
REFUSAL_CATEGORIES = {
    "obscure_cards": {
        "count": 6000,
        "templates": [
            "What is the current market price for {card}?",
            "Is {card} a good investment right now?",
            "How much is {card} worth in PSA 10?",
            "What's the price trend for {card}?",
            "Should I buy {card} at ${price}?",
        ],
        "cards": [
            "Shiny Mew GX", "Ancient Mew Promo", "Prerelease Raichu",
            "Tropical Mega Battle Trophy", "Snap Cards Chansey",
            "Victory Orb Mew", "Shining Noctowl", "Crystal Celebi",
            "Gold Star Espeon", "Southern Islands Mew"
        ]
    },
    "real_time_data": {
        "count": 6000,
        "templates": [
            "What's the latest price for {card} on eBay?",
            "What did {card} sell for yesterday?",
            "Is {card} trending up or down this week?",
            "What's the current floor price for {card}?",
            "How many {card} listings are active right now?",
        ],
        "cards": [
            "Charizard VMAX", "Pikachu ex", "Umbreon VMAX",
            "Mewtwo VSTAR", "Rayquaza VMAX", "Giratina VSTAR"
        ]
    },
    "ambiguous_queries": {
        "count": 6000,
        "templates": [
            "What's the price of Pikachu?",  # Which Pikachu?
            "Is Charizard worth buying?",  # Which Charizard?
            "How much is the rainbow rare?",  # Which one?
            "Should I invest in this card?",  # What card?
            "What's a good price for this?",  # For what?
        ]
    },
    "out_of_domain": {
        "count": 4000,
        "templates": [
            "How do I cook pasta?",
            "What's the weather like today?",
            "Who won the Super Bowl in {year}?",
            "How do I fix my car engine?",
            "What's the best way to learn Python?",
            "Can you write me a poem about {topic}?",
            "What's the capital of {country}?",
            "How do I lose weight fast?",
        ]
    },
    "unanswerable": {
        "count": 2000,
        "templates": [
            "Will {card} be worth more in 10 years?",
            "What will {card} sell for next month?",
            "Is {card} going to get reprinted?",
            "Will Pokemon TCG crash in value?",
            "What if I bought {card} in 1999?",
        ]
    }
}

# Honest refusal response templates
REFUSAL_RESPONSES = [
    "I don't have current pricing data for {card} in my training set. I recommend checking TCGPlayer or eBay sold listings for the most recent sales.",
    "I don't have enough information to answer that question accurately. Could you provide more details about which specific {card} variant you're interested in?",
    "I'm trained on Pokemon TCG market data, not {topic}. I can only help with Pokemon card pricing and investment analysis.",
    "I cannot predict future prices with certainty. Market conditions change rapidly, and any prediction would be speculation.",
    "This question is too vague for me to provide a useful answer. There are many variants of {card} across different sets and conditions.",
    "I don't have real-time data access. My training data has a cutoff date, so I cannot provide current market prices.",
    "Insufficient data for {card}. This appears to be a rare or obscure card not well-represented in my training data.",
]

class RefusalGenerator:
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

    def generate_query(self, category: str) -> dict:
        """Generate a query for given category"""
        cat_config = REFUSAL_CATEGORIES[category]
        template = random.choice(cat_config["templates"])

        # Fill in placeholders
        if "{card}" in template:
            card = random.choice(cat_config.get("cards", ["Unknown Card"]))
            template = template.replace("{card}", card)

        if "{price}" in template:
            price = random.randint(20, 500)
            template = template.replace("{price}", str(price))

        if "{year}" in template:
            year = random.randint(2000, 2024)
            template = template.replace("{year}", str(year))

        if "{topic}" in template:
            topics = ["love", "nature", "friendship", "coding"]
            template = template.replace("{topic}", random.choice(topics))

        if "{country}" in template:
            countries = ["France", "Japan", "Brazil", "Canada"]
            template = template.replace("{country}", random.choice(countries))

        return {
            "instruction": template,
            "input": "",
            "category": f"refusal_{category}"
        }

    def generate_refusal_response(self, instruction: str) -> str:
        """Generate honest refusal response"""
        system_prompt = """You are Mew-1A, a Pokemon TCG investment analyst.

CRITICAL RULE: If you don't have enough information, or the question is outside your expertise, or requires real-time data you don't have, SAY SO HONESTLY.

Be helpful by:
1. Clearly stating what you don't know
2. Explaining why you can't answer (lack of data, outside domain, etc.)
3. Suggesting where the user could find the answer
4. Being concise (2-3 sentences)

NEVER make up information. NEVER guess. Honesty is more valuable than a wrong answer."""

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": instruction}
        ]

        prompt = self.tokenizer.apply_chat_template(
            messages,
            tokenize=False,
            add_generation_prompt=True
        )

        inputs = self.tokenizer(prompt, return_tensors="pt", truncation=True, max_length=256).to(self.device)

        with torch.no_grad():
            outputs = self.model.generate(
                **inputs,
                max_new_tokens=MAX_NEW_TOKENS,
                temperature=0.7,
                top_p=0.9,
                do_sample=True,
                pad_token_id=self.tokenizer.eos_token_id
            )

        response = self.tokenizer.decode(outputs[0], skip_special_tokens=True)
        response = response.split("assistant")[-1].strip()

        return response

    def generate_batch(self, category: str, count: int) -> list:
        """Generate a batch of refusal examples"""
        examples = []

        for _ in tqdm(range(count), desc=f"Generating {category}"):
            query = self.generate_query(category)
            output = self.generate_refusal_response(query["instruction"])

            examples.append({
                "instruction": query["instruction"],
                "input": query["input"],
                "output": output,
                "category": query["category"],
                "metadata": {
                    "source": "synthetic_refusal",
                    "model": self.model_name,
                    "category": category
                }
            })

        return examples

def main():
    import argparse
    parser = argparse.ArgumentParser(description='Generate refusal examples on RunPod')
    parser.add_argument('--output', required=True, help='Output JSONL file')
    parser.add_argument('--count', type=int, default=TARGET_COUNT, help='Total examples to generate')
    args = parser.parse_args()

    print("=" * 80)
    print("RUNPOD: GENERATE REFUSAL EXAMPLES")
    print("=" * 80)
    print(f"\nTarget: {args.count:,} examples")
    print(f"Output: {args.output}")
    print(f"Model: {MODEL_NAME}")

    # Initialize generator
    generator = RefusalGenerator()
    generator.load_model()

    # Generate examples by category
    print(f"\n🔧 Generating refusal examples...")
    start_time = time.time()

    all_examples = []

    for category, config in REFUSAL_CATEGORIES.items():
        # Calculate proportional count
        proportion = config["count"] / TARGET_COUNT
        count = int(args.count * proportion)

        print(f"\n📝 Category: {category} ({count:,} examples)")
        examples = generator.generate_batch(category, count)
        all_examples.extend(examples)

    elapsed = time.time() - start_time

    print(f"\n✅ Generation complete!")
    print(f"\n📊 Results:")
    print(f"   Total examples: {len(all_examples):,}")
    print(f"   Generation time: {elapsed/60:.1f} minutes")
    print(f"   Rate: {len(all_examples)/elapsed:.1f} examples/second")

    # Category breakdown
    from collections import Counter
    category_counts = Counter(ex['metadata']['category'] for ex in all_examples)
    print(f"\n   Category breakdown:")
    for cat, count in category_counts.most_common():
        print(f"      {cat}: {count:,}")

    # Save examples
    print(f"\n💾 Saving to {args.output}...")
    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    with open(output_path, 'w') as f:
        for ex in all_examples:
            f.write(json.dumps(ex) + '\n')

    print(f"✅ Saved {len(all_examples):,} examples")

    # Sample outputs
    print(f"\n📋 Sample refusal examples:")
    for ex in all_examples[:5]:
        print(f"\n   Q: {ex['instruction']}")
        print(f"   A: {ex['output'][:100]}...")

    print("\n" + "=" * 80)
    print("COMPLETE!")
    print("=" * 80)
    print(f"\n✅ Generated {len(all_examples):,} refusal examples")
    print(f"✅ Time: {elapsed/60:.1f} minutes")
    print(f"✅ Estimated cost: ${(elapsed/3600) * 1.00:.2f} (RTX 4090 @ $1/hr)")

if __name__ == '__main__':
    main()
