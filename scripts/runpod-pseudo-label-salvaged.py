#!/usr/bin/env python3
"""
RunPod: Pseudo-Label Salvaged Data with Llama 3.2 3B

Problem: 129k salvaged examples have 48.3% hallucination rate
Solution: Use Llama 3.2 3B to regenerate outputs WITHOUT hallucinations

Strategy:
1. Load salvaged data with card names recovered by rules
2. For each example, use Llama 3.2 3B to regenerate output
3. Strict prompt: "Do NOT mention bid counts or grades unless in input"
4. Keep only high-confidence outputs

Expected:
- Input: 129,089 salvaged examples (48% hallucinations)
- Output: ~120,000 cleaned examples (<5% hallucinations)
- Time: 2-3 hours on RunPod RTX 4090
- Cost: ~$2-3

RunPod Setup:
- Template: RunPod PyTorch
- GPU: RTX 4090 or A100
- Storage: 50GB
"""

import json
import torch
from transformers import AutoModelForCausalLM, AutoTokenizer
from pathlib import Path
import time
from tqdm import tqdm

# Configuration
MODEL_NAME = "meta-llama/Llama-3.2-3B-Instruct"
BATCH_SIZE = 8  # Process 8 examples at once
MAX_NEW_TOKENS = 200
TEMPERATURE = 0.6
TOP_P = 0.9

# Hallucination-prevention system prompt
SYSTEM_PROMPT = """You are Mew-1A, an expert Pokemon TCG investment analyst.

CRITICAL RULES - DO NOT VIOLATE:
1. NEVER mention bid counts unless explicitly provided in the input
2. NEVER mention grading (PSA/BGS/CGC) unless explicitly in the input
3. NEVER fabricate specific prices unless given in the input
4. Use price ranges when uncertain: "$40-60" not "$53.27"
5. If lacking data, say: "Insufficient data for specific details"

OUTPUT FORMAT:
- Keep responses under 150 words
- Be direct and factual
- Focus on price assessment and market trends
- End with clear recommendation when appropriate
"""

class PseudoLabeler:
    def __init__(self, model_name: str = MODEL_NAME):
        self.model_name = model_name
        self.model = None
        self.tokenizer = None
        self.device = "cuda" if torch.cuda.is_available() else "cpu"

        print(f"🔧 Initializing PseudoLabeler")
        print(f"   Model: {model_name}")
        print(f"   Device: {self.device}")

    def load_model(self):
        """Load model and tokenizer"""
        print(f"\n📥 Loading model from HuggingFace...")
        start = time.time()

        self.tokenizer = AutoTokenizer.from_pretrained(
            self.model_name,
            trust_remote_code=True
        )

        self.model = AutoModelForCausalLM.from_pretrained(
            self.model_name,
            torch_dtype=torch.bfloat16 if self.device == "cuda" else torch.float32,
            device_map="auto",
            trust_remote_code=True
        )

        elapsed = time.time() - start
        print(f"✅ Model loaded in {elapsed:.1f}s")

        # Get model memory footprint
        if self.device == "cuda":
            mem_gb = torch.cuda.max_memory_allocated() / 1e9
            print(f"   GPU Memory: {mem_gb:.2f}GB")

    def format_prompt(self, instruction: str, input_text: str) -> str:
        """Format prompt for Llama 3.2 3B Instruct"""
        messages = [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": f"{instruction}\n\nInput: {input_text}"}
        ]

        return self.tokenizer.apply_chat_template(
            messages,
            tokenize=False,
            add_generation_prompt=True
        )

    def generate_output(self, instruction: str, input_text: str) -> tuple[str, float]:
        """
        Generate clean output for salvaged example
        Returns: (output_text, confidence_score)
        """
        prompt = self.format_prompt(instruction, input_text)

        inputs = self.tokenizer(
            prompt,
            return_tensors="pt",
            truncation=True,
            max_length=512
        ).to(self.device)

        with torch.no_grad():
            outputs = self.model.generate(
                **inputs,
                max_new_tokens=MAX_NEW_TOKENS,
                temperature=TEMPERATURE,
                top_p=TOP_P,
                do_sample=True,
                pad_token_id=self.tokenizer.eos_token_id
            )

        # Decode output
        full_output = self.tokenizer.decode(outputs[0], skip_special_tokens=True)

        # Extract just the generated response (after the prompt)
        response = full_output.split("assistant")[-1].strip()

        # Simple confidence score based on output quality
        confidence = self.calculate_confidence(response, input_text)

        return response, confidence

    def calculate_confidence(self, output: str, input_text: str) -> float:
        """
        Calculate confidence score for generated output
        Lower confidence if it hallucinates
        """
        confidence = 0.90  # Start high

        # Check 1: Hallucinated bid counts? (Lower confidence)
        if "bid" in output.lower() and "bid" not in input_text.lower():
            confidence -= 0.30

        # Check 2: Hallucinated grades? (Lower confidence)
        grade_pattern = r'(PSA|BGS|CGC|SGC)\s*\d+'
        import re
        if re.search(grade_pattern, output, re.IGNORECASE):
            if not re.search(grade_pattern, input_text, re.IGNORECASE):
                confidence -= 0.25

        # Check 3: Too short? (Lower confidence)
        if len(output) < 30:
            confidence -= 0.20

        # Check 4: Contains "I don't" or refusal? (Boost confidence - honest!)
        if re.search(r"(I don't|insufficient|unable to|cannot determine)", output, re.IGNORECASE):
            confidence += 0.05

        # Check 5: Reasonable length?
        if 50 <= len(output) <= 250:
            confidence += 0.05

        return max(0.0, min(1.0, confidence))

    def process_batch(self, examples: list) -> list:
        """Process a batch of examples"""
        results = []

        for ex in examples:
            instruction = ex.get('instruction', '')
            input_text = ex.get('input', '')

            try:
                new_output, confidence = self.generate_output(instruction, input_text)

                # Update example
                ex['output'] = new_output
                ex['metadata']['_pseudo_labeled'] = True
                ex['metadata']['_pseudo_confidence'] = round(confidence, 3)
                ex['metadata']['_original_output'] = ex.get('output')  # Keep original for comparison

                results.append(ex)

            except Exception as e:
                print(f"⚠️  Error processing example: {e}")
                # Keep original if generation fails
                results.append(ex)

        return results

def main():
    import argparse
    parser = argparse.ArgumentParser(description='Pseudo-label salvaged data on RunPod')
    parser.add_argument('--input', required=True, help='Salvaged data JSONL')
    parser.add_argument('--output', required=True, help='Cleaned data JSONL')
    parser.add_argument('--min-confidence', type=float, default=0.75, help='Min confidence to keep (default: 0.75)')
    parser.add_argument('--max-examples', type=int, default=None, help='Max examples to process (for testing)')
    args = parser.parse_args()

    print("=" * 80)
    print("RUNPOD: PSEUDO-LABEL SALVAGED DATA")
    print("=" * 80)
    print(f"\nInput: {args.input}")
    print(f"Output: {args.output}")
    print(f"Min Confidence: {args.min_confidence}")
    print(f"Model: {MODEL_NAME}")

    # Initialize
    labeler = PseudoLabeler()
    labeler.load_model()

    # Load salvaged data
    print(f"\n📖 Loading salvaged data...")
    examples = []
    with open(args.input, 'r') as f:
        for i, line in enumerate(f):
            if args.max_examples and i >= args.max_examples:
                break
            examples.append(json.loads(line))

    total = len(examples)
    print(f"✅ Loaded {total:,} salvaged examples")

    # Process in batches
    print(f"\n🔧 Pseudo-labeling with Llama 3.2 3B...")
    print(f"   Batch Size: {BATCH_SIZE}")
    print(f"   Expected Time: ~{total / 600:.1f} hours")

    start_time = time.time()
    cleaned = []
    discarded_low_conf = 0

    # Process with progress bar
    for i in tqdm(range(0, total, BATCH_SIZE), desc="Processing batches"):
        batch = examples[i:i+BATCH_SIZE]
        results = labeler.process_batch(batch)

        # Filter by confidence
        for ex in results:
            conf = ex.get('metadata', {}).get('_pseudo_confidence', 0)
            if conf >= args.min_confidence:
                cleaned.append(ex)
            else:
                discarded_low_conf += 1

        # Progress update every 1000 examples
        if (i + BATCH_SIZE) % 1000 == 0:
            elapsed = time.time() - start_time
            rate = (i + BATCH_SIZE) / elapsed if elapsed > 0 else 0
            remaining = (total - i) / rate if rate > 0 else 0
            print(f"\n   Processed {i+BATCH_SIZE:,}/{total:,} | "
                  f"Rate: {rate:.1f} ex/sec | "
                  f"ETA: {remaining/60:.1f} min")

    elapsed_total = time.time() - start_time

    print(f"\n✅ Processing complete!")
    print(f"\n📊 Results:")
    print(f"   Total processed: {total:,}")
    print(f"   High confidence (≥{args.min_confidence}): {len(cleaned):,} ({len(cleaned)/total*100:.1f}%)")
    print(f"   Low confidence discarded: {discarded_low_conf:,} ({discarded_low_conf/total*100:.1f}%)")
    print(f"   Processing time: {elapsed_total/3600:.2f} hours")
    print(f"   Rate: {total/elapsed_total:.1f} examples/second")

    # Save cleaned data
    print(f"\n💾 Saving cleaned data to {args.output}...")
    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    with open(output_path, 'w') as f:
        for ex in cleaned:
            f.write(json.dumps(ex) + '\n')

    print(f"✅ Saved {len(cleaned):,} cleaned examples")

    # Quality report
    avg_confidence = sum(ex['metadata']['_pseudo_confidence'] for ex in cleaned) / len(cleaned) if cleaned else 0
    print(f"\n📊 Quality Metrics:")
    print(f"   Average Confidence: {avg_confidence*100:.1f}%")
    print(f"   Expected Hallucination Rate: <10% (vs 48% before)")

    # Sample outputs
    print(f"\n📋 Sample cleaned outputs:")
    for ex in cleaned[:3]:
        meta = ex['metadata']
        print(f"\n   Card: {meta.get('card_name')}")
        print(f"   Confidence: {meta['_pseudo_confidence']*100:.0f}%")
        print(f"   Output: {ex['output'][:100]}...")

    print("\n" + "=" * 80)
    print("COMPLETE!")
    print("=" * 80)
    print(f"\n✅ Cleaned {len(cleaned):,} examples with Llama 3.2 3B")
    print(f"✅ Processing time: {elapsed_total/3600:.2f} hours")
    print(f"✅ Estimated cost: ${(elapsed_total/3600) * 1.00:.2f} (RTX 4090 @ $1/hr)")
    print(f"\nNext step: Audit cleaned data to verify hallucination reduction")

if __name__ == '__main__':
    main()
