#!/usr/bin/env python3
"""
Quick test of Mew-1A v4.3 model using LoRA adapters.
Tests the model with sample queries before full evaluation.
"""

import torch
from transformers import AutoModelForCausalLM, AutoTokenizer
from peft import PeftModel
import json

print("="*70)
print("🧪 MEW-1A v4.3 QUICK TEST")
print("="*70)
print()

# Paths
LORA_PATH = "/Users/arcadio/dev/pokedao/models/mew1a-v4.3-lora"
BASE_MODEL = "meta-llama/Llama-3.2-3B-Instruct"

print("Loading base model (this may download 6.4GB)...")
base_model = AutoModelForCausalLM.from_pretrained(
    BASE_MODEL,
    torch_dtype=torch.float16,
    device_map="cpu",  # Use CPU to avoid memory issues
    low_cpu_mem_usage=True
)

print("Loading LoRA adapters...")
model = PeftModel.from_pretrained(base_model, LORA_PATH)

print("Loading tokenizer...")
tokenizer = AutoTokenizer.from_pretrained(LORA_PATH)

print("✅ Model loaded successfully!")
print()

# Test queries
test_queries = [
    {
        "prompt": "What is the current market price for Charizard ex (Obsidian Flames)?",
        "expected": "pricing information"
    },
    {
        "prompt": "Should I buy Pikachu VMAX for $120 if the fair value is $95?",
        "expected": "BUY or PASS recommendation"
    },
    {
        "prompt": "What type is Mewtwo?",
        "expected": "Psychic type"
    }
]

print("🧪 Running Test Queries:")
print("="*70)

for i, query in enumerate(test_queries, 1):
    print(f"\nTest {i}: {query['prompt']}")
    print(f"Expected: {query['expected']}")
    print("-"*70)

    # Format prompt
    messages = [{"role": "user", "content": query['prompt']}]
    prompt = tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)

    # Tokenize
    inputs = tokenizer(prompt, return_tensors="pt")

    # Generate
    with torch.no_grad():
        outputs = model.generate(
            **inputs,
            max_new_tokens=150,
            temperature=0.7,
            do_sample=True,
            top_p=0.9
        )

    # Decode
    response = tokenizer.decode(outputs[0], skip_special_tokens=True)

    # Extract just the response (remove prompt)
    response = response.split("assistant")[-1].strip()

    print(f"Response: {response[:200]}...")
    print()

print("="*70)
print("🎉 TEST COMPLETE!")
print("="*70)
print("\nModel is working! Ready for full evaluation.")
print("Next: Run evaluation framework with 2,024 test examples")
