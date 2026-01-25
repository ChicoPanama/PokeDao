#!/usr/bin/env python3
"""
Generate v4.3.1 LoRA Patch Training Data
========================================

Creates 200-example focused dataset to fix model BUY bias:
- 100 BUY examples (discount ≥10%)
- 50 PASS examples (premium ≥10%)
- 50 HOLD examples (within ±10%)

Goal: Reduce contradiction rate from 37.5% to <5%
"""

import json
import random
from typing import List, Dict

# Popular Pokemon cards for realistic training
CARDS = [
    "Charizard ex", "Pikachu VMAX", "Lugia V", "Mewtwo VSTAR", "Umbreon VMAX",
    "Rayquaza VMAX", "Giratina VSTAR", "Mew VMAX", "Greninja ex", "Miraidon ex",
    "Koraidon ex", "Charizard V", "Alakazam ex", "Gardevoir ex", "Lucario VSTAR",
    "Dragonite VSTAR", "Moltres", "Zapdos", "Articuno", "Arceus VSTAR",
    "Dialga VSTAR", "Palkia VSTAR", "Garchomp ex", "Typhlosion VSTAR", "Decidueye VSTAR",
    "Inteleon VMAX", "Cinderace VMAX", "Rillaboom VMAX", "Zacian V", "Zamazenta V",
    "Eternatus VMAX", "Duraludon VMAX", "Machamp VMAX", "Gengar VMAX", "Blastoise VMAX"
]

SETS = [
    "Obsidian Flames", "Paldea Evolved", "Scarlet & Violet", "Crown Zenith",
    "Silver Tempest", "Lost Origin", "Astral Radiance", "Brilliant Stars",
    "Fusion Strike", "Evolving Skies", "Chilling Reign", "Battle Styles",
    "Vivid Voltage", "Champion's Path", "Darkness Ablaze", "Rebel Clash",
    "Paradox Rift", "Temporal Forces", "Twilight Masquerade", "Shrouded Fable"
]


def create_buy_example(card: str, set_name: str, tfv: float, discount_pct: float) -> Dict:
    """Create BUY training example (discount ≥10%)"""
    listed = tfv * (1 - discount_pct / 100)

    prompt = f"""Analyze this Pokémon card deal:

Card: {card} - {set_name}
Listed Price: ${listed:.2f}
Fair Value (TFV): ${tfv:.2f}

Should I buy this card?"""

    # Correct BUY response
    response = f"""BUY

Reasoning: The listed price (${listed:.2f}) is {discount_pct:.1f}% below the Fair Value of ${tfv:.2f}. This represents a discount of ${tfv - listed:.2f}, making it an undervalued deal worth purchasing."""

    return {
        "messages": [
            {"role": "user", "content": prompt},
            {"role": "assistant", "content": response}
        ]
    }


def create_pass_example(card: str, set_name: str, tfv: float, premium_pct: float) -> Dict:
    """Create PASS training example (premium ≥10%)"""
    listed = tfv * (1 + premium_pct / 100)

    prompt = f"""Analyze this Pokémon card deal:

Card: {card} - {set_name}
Listed Price: ${listed:.2f}
Fair Value (TFV): ${tfv:.2f}

Should I buy this card?"""

    # Correct PASS response
    response = f"""PASS

Reasoning: The listed price (${listed:.2f}) is {premium_pct:.1f}% above the Fair Value of ${tfv:.2f}. This represents a premium of ${listed - tfv:.2f}, making it overpriced. I recommend passing on this deal."""

    return {
        "messages": [
            {"role": "user", "content": prompt},
            {"role": "assistant", "content": response}
        ]
    }


def create_hold_example(card: str, set_name: str, tfv: float, variance_pct: float) -> Dict:
    """Create HOLD training example (within ±10%)"""
    listed = tfv * (1 + variance_pct / 100)

    prompt = f"""Analyze this Pokémon card deal:

Card: {card} - {set_name}
Listed Price: ${listed:.2f}
Fair Value (TFV): ${tfv:.2f}

Should I buy this card?"""

    # Correct HOLD response
    if variance_pct >= 0:
        response = f"""HOLD

Reasoning: The listed price (${listed:.2f}) is {abs(variance_pct):.1f}% above the Fair Value of ${tfv:.2f}, a premium of ${listed - tfv:.2f}. This is within the ±10% fair value band, so it's neither a strong buy nor a clear pass. Consider holding off unless you specifically need this card."""
    else:
        response = f"""HOLD

Reasoning: The listed price (${listed:.2f}) is {abs(variance_pct):.1f}% below the Fair Value of ${tfv:.2f}, a discount of ${tfv - listed:.2f}. This is within the ±10% fair value band, so it's neither a strong buy nor a clear pass. Consider holding off unless you specifically need this card."""

    return {
        "messages": [
            {"role": "user", "content": prompt},
            {"role": "assistant", "content": response}
        ]
    }


def generate_training_data() -> List[Dict]:
    """Generate 200 balanced training examples"""
    examples = []

    # 100 BUY examples (discount ≥10%)
    print("Generating 100 BUY examples...")
    for i in range(100):
        card = random.choice(CARDS)
        set_name = random.choice(SETS)
        tfv = random.uniform(20.0, 200.0)  # $20-$200 TFV range
        discount_pct = random.uniform(10.0, 40.0)  # 10-40% discount

        examples.append(create_buy_example(card, set_name, tfv, discount_pct))

    # 50 PASS examples (premium ≥10%)
    print("Generating 50 PASS examples...")
    for i in range(50):
        card = random.choice(CARDS)
        set_name = random.choice(SETS)
        tfv = random.uniform(20.0, 200.0)
        premium_pct = random.uniform(10.0, 40.0)  # 10-40% premium

        examples.append(create_pass_example(card, set_name, tfv, premium_pct))

    # 50 HOLD examples (within ±10%)
    print("Generating 50 HOLD examples...")
    for i in range(50):
        card = random.choice(CARDS)
        set_name = random.choice(SETS)
        tfv = random.uniform(20.0, 200.0)
        variance_pct = random.uniform(-9.9, 9.9)  # Within ±10%

        examples.append(create_hold_example(card, set_name, tfv, variance_pct))

    # Shuffle to mix categories
    random.shuffle(examples)

    return examples


def save_jsonl(examples: List[Dict], output_path: str):
    """Save training data in JSONL format"""
    with open(output_path, 'w') as f:
        for example in examples:
            f.write(json.dumps(example) + '\n')

    print(f"✅ Saved {len(examples)} examples to {output_path}")


def print_sample(examples: List[Dict], n: int = 3):
    """Print sample examples for verification"""
    print(f"\n{'='*80}")
    print(f"SAMPLE EXAMPLES (first {n})")
    print(f"{'='*80}\n")

    for i, example in enumerate(examples[:n], 1):
        user_msg = example["messages"][0]["content"]
        assistant_msg = example["messages"][1]["content"]

        print(f"--- Example {i} ---")
        print(f"USER:\n{user_msg}\n")
        print(f"ASSISTANT:\n{assistant_msg}\n")
        print(f"{'-'*80}\n")


if __name__ == "__main__":
    print("="*80)
    print("V4.3.1 LoRA PATCH - TRAINING DATA GENERATOR")
    print("="*80)
    print("Goal: Teach model to align text with BUY/PASS/HOLD policy decisions")
    print("Target: Reduce contradiction rate from 37.5% to <5%")
    print("="*80 + "\n")

    # Generate training data
    examples = generate_training_data()

    # Count by decision type
    buy_count = sum(1 for ex in examples if "BUY\n\nReasoning:" in ex["messages"][1]["content"])
    pass_count = sum(1 for ex in examples if "PASS\n\nReasoning:" in ex["messages"][1]["content"])
    hold_count = sum(1 for ex in examples if "HOLD\n\nReasoning:" in ex["messages"][1]["content"])

    print(f"\nDataset Statistics:")
    print(f"  BUY examples: {buy_count}")
    print(f"  PASS examples: {pass_count}")
    print(f"  HOLD examples: {hold_count}")
    print(f"  Total: {len(examples)}")

    # Save to file
    output_path = "/Users/arcadio/dev/pokedao/data/training/mew1a-v4.3.1-lora-patch.jsonl"
    save_jsonl(examples, output_path)

    # Print samples
    print_sample(examples, n=3)

    print(f"\n{'='*80}")
    print("✅ TRAINING DATA GENERATION COMPLETE")
    print(f"{'='*80}")
    print(f"\nNext steps:")
    print(f"1. scp {output_path} root@194.68.245.86:/workspace/data/")
    print(f"2. SSH into RunPod: ssh root@194.68.245.86 -p 22025 -i ~/.ssh/id_ed25519")
    print(f"3. Run training script (15-20 min)")
    print(f"4. Validate with Rules Baseline evaluator")
    print(f"5. Deploy to Modal Labs")
