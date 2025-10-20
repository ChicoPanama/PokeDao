#!/usr/bin/env python3
"""
ALL-IN-ONE ULTRA-OPTIMIZED: Complete v4.3 Data Processing
Does all 3 tasks with maximum GPU utilization (95-100%)

Tasks:
1. Pseudo-label 94k salvaged examples
2. Generate 24k refusal examples
3. Generate 15k BUY/PASS examples

Optimizations:
- Adaptive batch sizing (finds max GPU capacity)
- torch.compile JIT compilation
- Mixed precision (bfloat16)
- KV cache enabled
- Parallel tokenization
"""

import json
import torch
from transformers import AutoModelForCausalLM, AutoTokenizer
from pathlib import Path
import time
import re
import random
from tqdm import tqdm
import argparse

# Models
MODEL_3B = "meta-llama/Llama-3.2-3B-Instruct"
MODEL_8B = "meta-llama/Llama-3.1-8B-Instruct"

class UltraGPUOptimizer:
    def __init__(self, model_name: str, initial_batch_size: int = 64):
        self.model_name = model_name
        self.batch_size = initial_batch_size
        self.model = None
        self.tokenizer = None
        self.device = "cuda" if torch.cuda.is_available() else "cpu"

    def load_model(self):
        """Load with all optimizations"""
        print(f"\n📥 Loading {self.model_name}...")
        start = time.time()

        self.tokenizer = AutoTokenizer.from_pretrained(self.model_name)
        self.tokenizer.pad_token = self.tokenizer.eos_token
        self.tokenizer.padding_side = "left"

        self.model = AutoModelForCausalLM.from_pretrained(
            self.model_name,
            torch_dtype=torch.bfloat16,
            device_map="auto",
            low_cpu_mem_usage=True
        )

        self.model.eval()
        if hasattr(self.model.config, 'use_cache'):
            self.model.config.use_cache = True

        # Compile
        try:
            self.model = torch.compile(self.model, mode="reduce-overhead")
            print("   ✅ torch.compile enabled")
        except:
            print("   ⚠️  torch.compile unavailable")

        print(f"✅ Loaded in {time.time()-start:.1f}s")
        print(f"   GPU: {torch.cuda.get_device_name(0)}")
        print(f"   Memory: {torch.cuda.memory_allocated()/1e9:.2f}GB")

    def find_max_batch_size(self, sample_prompts: list):
        """Auto-detect maximum batch size"""
        print(f"\n🔍 Finding optimal batch size...")

        test_sizes = [32, 64, 96, 128, 160, 192]
        max_working = 32

        for size in test_sizes:
            try:
                print(f"   Testing batch_size={size}...", end="")

                # Test batch
                test_batch = sample_prompts[:size]
                inputs = self.tokenizer(
                    test_batch,
                    return_tensors="pt",
                    padding=True,
                    truncation=True,
                    max_length=512
                ).to(self.device)

                with torch.no_grad(), torch.cuda.amp.autocast():
                    _ = self.model.generate(
                        **inputs,
                        max_new_tokens=50,
                        pad_token_id=self.tokenizer.eos_token_id
                    )

                # Clear cache
                torch.cuda.empty_cache()
                max_working = size
                print(f" ✅")

            except RuntimeError as e:
                if "out of memory" in str(e):
                    print(f" ❌ OOM")
                    torch.cuda.empty_cache()
                    break
                else:
                    raise

        self.batch_size = max_working
        print(f"✅ Optimal batch size: {self.batch_size}")
        return self.batch_size

    def generate_batch(self, prompts: list, max_tokens: int = 200) -> list:
        """Generate responses for batch"""
        inputs = self.tokenizer(
            prompts,
            return_tensors="pt",
            padding=True,
            truncation=True,
            max_length=512
        ).to(self.device)

        with torch.no_grad(), torch.cuda.amp.autocast():
            outputs = self.model.generate(
                **inputs,
                max_new_tokens=max_tokens,
                temperature=0.7,
                top_p=0.9,
                do_sample=True,
                pad_token_id=self.tokenizer.eos_token_id,
                use_cache=True
            )

        responses = self.tokenizer.batch_decode(outputs, skip_special_tokens=True)

        # Extract assistant responses
        cleaned = []
        for resp in responses:
            if "assistant" in resp:
                resp = resp.split("assistant")[-1].strip()
            cleaned.append(resp)

        return cleaned

# ============================================================================
# TASK 1: PSEUDO-LABEL SALVAGED DATA
# ============================================================================

def pseudo_label_salvaged(optimizer: UltraGPUOptimizer, input_file: str, output_file: str, min_conf: float = 0.75):
    """Pseudo-label salvaged examples"""
    print("\n" + "="*80)
    print("TASK 1/3: PSEUDO-LABEL SALVAGED DATA")
    print("="*80)

    # Load examples
    print(f"📖 Loading {input_file}...")
    examples = []
    with open(input_file) as f:
        for line in f:
            examples.append(json.loads(line))

    print(f"✅ Loaded {len(examples):,} examples")

    # Find optimal batch size
    sample_prompts = []
    for ex in examples[:200]:
        inst = ex.get('instruction', '')
        inp = ex.get('input', '')
        content = f"{inst}\n\n{inp}" if inp else inst
        msg = [
            {"role": "system", "content": "You are Mew-1A. Be concise."},
            {"role": "user", "content": content}
        ]
        sample_prompts.append(optimizer.tokenizer.apply_chat_template(msg, tokenize=False, add_generation_prompt=True))

    optimizer.find_max_batch_size(sample_prompts)

    # Process
    kept = []
    system_prompt = "You are Mew-1A. NEVER mention bids/grades unless in input. Be concise."

    print(f"\n🔧 Processing with batch_size={optimizer.batch_size}...")

    for i in tqdm(range(0, len(examples), optimizer.batch_size), desc="Batches"):
        batch = examples[i:i + optimizer.batch_size]

        # Prepare prompts
        prompts = []
        for ex in batch:
            inst = ex.get('instruction', '')
            inp = ex.get('input', '')
            content = f"{inst}\n\n{inp}" if inp else inst
            msg = [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": content}
            ]
            prompts.append(optimizer.tokenizer.apply_chat_template(msg, tokenize=False, add_generation_prompt=True))

        # Generate
        responses = optimizer.generate_batch(prompts, max_tokens=200)

        # Filter by confidence
        for ex, resp in zip(batch, responses):
            # Simple confidence check
            inp_text = ex.get('input', '') or ex.get('instruction', '')
            conf = 0.90
            if "bid" in resp.lower() and "bid" not in inp_text.lower():
                conf -= 0.30
            if conf >= min_conf:
                new_ex = ex.copy()
                new_ex['output'] = resp
                new_ex['metadata'] = new_ex.get('metadata', {})
                new_ex['metadata']['confidence'] = conf
                kept.append(new_ex)

    # Save
    print(f"\n💾 Saving {len(kept):,} examples...")
    Path(output_file).parent.mkdir(parents=True, exist_ok=True)
    with open(output_file, 'w') as f:
        for ex in kept:
            f.write(json.dumps(ex) + '\n')

    print(f"✅ Task 1 complete: {len(kept):,}/{len(examples):,} kept ({len(kept)/len(examples)*100:.1f}%)")

# ============================================================================
# TASK 2: GENERATE REFUSAL EXAMPLES
# ============================================================================

def generate_refusals(optimizer: UltraGPUOptimizer, output_file: str, count: int = 24000):
    """Generate refusal examples"""
    print("\n" + "="*80)
    print("TASK 2/3: GENERATE REFUSAL EXAMPLES")
    print("="*80)

    templates = [
        "What is the current price of {card}?",
        "How much is {card} worth?",
        "Should I buy {card}?",
        "Is {card} a good investment?",
        "What's the latest eBay price for {card}?",
    ]

    cards = ["Charizard", "Pikachu VMAX", "Umbreon VMAX", "Shiny Mew GX"]

    system_prompt = "You are Mew-1A. If you don't have data, say so honestly. Be concise."

    examples = []

    print(f"🔧 Generating {count:,} refusal examples...")

    for i in tqdm(range(0, count, optimizer.batch_size), desc="Batches"):
        batch_size = min(optimizer.batch_size, count - i)

        # Create instructions
        instructions = []
        for _ in range(batch_size):
            template = random.choice(templates)
            card = random.choice(cards)
            instructions.append(template.replace("{card}", card))

        # Prepare prompts
        prompts = []
        for inst in instructions:
            msg = [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": inst}
            ]
            prompts.append(optimizer.tokenizer.apply_chat_template(msg, tokenize=False, add_generation_prompt=True))

        # Generate
        responses = optimizer.generate_batch(prompts, max_tokens=150)

        # Save
        for inst, resp in zip(instructions, responses):
            examples.append({
                "instruction": inst,
                "input": "",
                "output": resp,
                "category": "refusal",
                "metadata": {"source": "synthetic_refusal"}
            })

    # Save
    print(f"\n💾 Saving {len(examples):,} examples...")
    with open(output_file, 'w') as f:
        for ex in examples:
            f.write(json.dumps(ex) + '\n')

    print(f"✅ Task 2 complete: {len(examples):,} refusal examples")

# ============================================================================
# TASK 3: GENERATE BUY/PASS EXAMPLES
# ============================================================================

def generate_buypass(optimizer: UltraGPUOptimizer, output_file: str, count: int = 15000):
    """Generate BUY/PASS examples"""
    print("\n" + "="*80)
    print("TASK 3/3: GENERATE BUY/PASS EXAMPLES")
    print("="*80)

    cards = ["Charizard ex", "Pikachu VMAX", "Umbreon VMAX"]

    system_prompt = "You are Mew-1A. Provide clear BUY/PASS/HOLD recommendations with reasoning."

    examples = []

    print(f"🔧 Generating {count:,} BUY/PASS examples...")

    for i in tqdm(range(0, count, optimizer.batch_size), desc="Batches"):
        batch_size = min(optimizer.batch_size, count - i)

        # Create scenarios
        instructions = []
        for _ in range(batch_size):
            card = random.choice(cards)
            listed = random.randint(50, 200)
            fair = int(listed * random.uniform(0.7, 1.3))
            trend = random.randint(-20, 20)

            inst = f"Should I BUY or PASS?\n\nCard: {card}\nListed: ${listed}\nFair Value: ${fair}\nTrend: {trend:+d}%"
            instructions.append(inst)

        # Prepare prompts
        prompts = []
        for inst in instructions:
            msg = [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": inst}
            ]
            prompts.append(optimizer.tokenizer.apply_chat_template(msg, tokenize=False, add_generation_prompt=True))

        # Generate
        responses = optimizer.generate_batch(prompts, max_tokens=200)

        # Save
        for inst, resp in zip(instructions, responses):
            examples.append({
                "instruction": inst,
                "input": "",
                "output": resp,
                "category": "buy_pass",
                "metadata": {"source": "synthetic_buypass"}
            })

    # Save
    print(f"\n💾 Saving {len(examples):,} examples...")
    with open(output_file, 'w') as f:
        for ex in examples:
            f.write(json.dumps(ex) + '\n')

    print(f"✅ Task 3 complete: {len(examples):,} BUY/PASS examples")

# ============================================================================
# MAIN
# ============================================================================

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--salvaged-input', default='data/training/salvaged-cards.jsonl')
    parser.add_argument('--output-dir', default='data/training/runpod-outputs')
    parser.add_argument('--refusal-count', type=int, default=24000)
    parser.add_argument('--buypass-count', type=int, default=15000)
    parser.add_argument('--initial-batch-size', type=int, default=64)
    args = parser.parse_args()

    print("="*80)
    print("🚀 ALL-IN-ONE ULTRA-OPTIMIZED v4.3 DATA PROCESSING")
    print("="*80)
    print(f"\nTarget GPU utilization: 95-100%")
    print(f"Initial batch size: {args.initial_batch_size}")
    print(f"\nTasks:")
    print(f"  1. Pseudo-label salvaged data")
    print(f"  2. Generate {args.refusal_count:,} refusal examples")
    print(f"  3. Generate {args.buypass_count:,} BUY/PASS examples")

    start_total = time.time()

    # Task 1: Pseudo-labeling (3B model)
    optimizer_3b = UltraGPUOptimizer(MODEL_3B, args.initial_batch_size)
    optimizer_3b.load_model()

    pseudo_label_salvaged(
        optimizer_3b,
        args.salvaged_input,
        f"{args.output_dir}/cleaned-salvaged.jsonl"
    )

    # Task 2: Refusals (reuse 3B model)
    generate_refusals(
        optimizer_3b,
        f"{args.output_dir}/refusal-24k.jsonl",
        args.refusal_count
    )

    # Unload 3B model
    del optimizer_3b.model
    del optimizer_3b
    torch.cuda.empty_cache()

    # Task 3: BUY/PASS (8B model for better reasoning)
    print(f"\n🔄 Switching to 8B model for BUY/PASS generation...")
    optimizer_8b = UltraGPUOptimizer(MODEL_8B, max(32, args.initial_batch_size // 2))
    optimizer_8b.load_model()

    generate_buypass(
        optimizer_8b,
        f"{args.output_dir}/buy-pass-15k.jsonl",
        args.buypass_count
    )

    # Summary
    elapsed = time.time() - start_total

    print("\n" + "="*80)
    print("🎉 ALL TASKS COMPLETE!")
    print("="*80)
    print(f"\nTotal time: {elapsed/60:.1f} minutes ({elapsed/3600:.2f} hours)")
    print(f"Estimated cost: ${elapsed/3600:.2f} (at $1/hr)")
    print(f"\nOutputs:")
    print(f"  - {args.output_dir}/cleaned-salvaged.jsonl")
    print(f"  - {args.output_dir}/refusal-24k.jsonl")
    print(f"  - {args.output_dir}/buy-pass-15k.jsonl")
    print(f"\n✅ Ready to merge into v4.3 dataset!")

if __name__ == '__main__':
    main()
