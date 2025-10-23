"""
Bits Per Byte (BPB) Calculator

Vocabulary-size independent loss metric for fair model comparison.
Inspired by NanoChat's BPB implementation (nanochat/loss_eval.py).

Why BPB?
- Traditional cross-entropy loss depends on vocabulary size
- BPB normalizes by UTF-8 byte count
- Allows fair comparison between models with different tokenizers
- Lower is better (measures compression efficiency)

Formula:
    BPB = total_nats / (log(2) * total_bytes)
    where nats = cross-entropy loss per token

Example:
    Model A (32k vocab): Loss = 0.140, BPB = 0.95
    Model B (128k vocab): Loss = 0.160, BPB = 0.92 ← Better!
"""

import torch
import math
import json
from pathlib import Path
from typing import Dict, Any, List, Optional, Tuple
from transformers import AutoTokenizer, AutoModelForCausalLM
from datasets import load_dataset


class BPBCalculator:
    """
    Calculate bits-per-byte metric for language models.

    BPB is a vocabulary-independent metric that measures how well
    a model compresses text data.
    """

    def __init__(
        self,
        model_name: str,
        device: str = "cuda" if torch.cuda.is_available() else "cpu"
    ):
        """
        Initialize BPB calculator with model.

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

        # Build token → byte count mapping
        self._build_token_bytes_map()

        print(f"Model loaded on {device}")

    def _build_token_bytes_map(self):
        """
        Build mapping from token ID to UTF-8 byte count.

        This is used to normalize loss by actual text content.
        """
        vocab_size = len(self.tokenizer)
        self.token_bytes = torch.zeros(vocab_size, dtype=torch.long)

        print("Building token → byte count mapping...")

        for token_id in range(vocab_size):
            # Decode token to string
            token_str = self.tokenizer.decode([token_id])

            # Count UTF-8 bytes
            num_bytes = len(token_str.encode('utf-8'))

            self.token_bytes[token_id] = num_bytes

        print(f"Token bytes map built: {vocab_size} tokens")

    def calculate_bpb(
        self,
        texts: List[str],
        batch_size: int = 8,
        max_length: int = 512
    ) -> Dict[str, Any]:
        """
        Calculate BPB on a list of texts.

        Args:
            texts: List of text strings to evaluate
            batch_size: Batch size for processing
            max_length: Max sequence length

        Returns:
            {
                'bpb': float - Bits per byte
                'total_nats': float - Total cross-entropy loss (nats)
                'total_bytes': int - Total UTF-8 bytes processed
                'num_tokens': int - Total tokens processed
                'num_examples': int - Number of text examples
            }
        """
        total_nats = 0.0
        total_bytes = 0
        num_tokens = 0

        print(f"Calculating BPB on {len(texts)} examples...")

        for i in range(0, len(texts), batch_size):
            batch_texts = texts[i:i+batch_size]

            # Process batch
            batch_nats, batch_bytes, batch_tokens = self._process_batch(
                batch_texts,
                max_length
            )

            total_nats += batch_nats
            total_bytes += batch_bytes
            num_tokens += batch_tokens

            # Progress update
            if (i + batch_size) % 50 == 0 or (i + batch_size) >= len(texts):
                processed = min(i + batch_size, len(texts))
                bpb_so_far = total_nats / (math.log(2) * total_bytes) if total_bytes > 0 else 0
                print(f"  Progress: {processed}/{len(texts)} | BPB: {bpb_so_far:.4f}")

        # Calculate final BPB
        bpb = total_nats / (math.log(2) * total_bytes) if total_bytes > 0 else 0.0

        return {
            'bpb': bpb,
            'total_nats': total_nats,
            'total_bytes': total_bytes,
            'num_tokens': num_tokens,
            'num_examples': len(texts),
        }

    def _process_batch(
        self,
        texts: List[str],
        max_length: int
    ) -> Tuple[float, int, int]:
        """
        Process a batch of texts and return (nats, bytes, tokens).

        Args:
            texts: List of text strings
            max_length: Max sequence length

        Returns:
            (total_nats, total_bytes, total_tokens)
        """
        # Tokenize
        encodings = self.tokenizer(
            texts,
            return_tensors="pt",
            padding=True,
            truncation=True,
            max_length=max_length
        ).to(self.device)

        input_ids = encodings['input_ids']
        attention_mask = encodings['attention_mask']

        # Prepare targets (shifted by 1)
        # Target is next token prediction
        targets = input_ids.clone()
        targets[:, :-1] = input_ids[:, 1:]
        targets[:, -1] = self.tokenizer.pad_token_id or self.tokenizer.eos_token_id

        # Get model outputs
        with torch.no_grad():
            outputs = self.model(input_ids=input_ids, attention_mask=attention_mask)
            logits = outputs.logits  # (batch_size, seq_len, vocab_size)

        # Calculate loss per position (no reduction)
        loss_fct = torch.nn.CrossEntropyLoss(reduction='none')

        # Reshape for loss calculation
        batch_size, seq_len, vocab_size = logits.shape
        logits_flat = logits.view(-1, vocab_size)  # (batch_size * seq_len, vocab_size)
        targets_flat = targets.view(-1)  # (batch_size * seq_len,)

        # Calculate loss per position
        loss_per_position = loss_fct(logits_flat, targets_flat)  # (batch_size * seq_len,)
        loss_per_position = loss_per_position.view(batch_size, seq_len)  # (batch_size, seq_len)

        # Get byte counts per token
        token_bytes_map = self.token_bytes.to(self.device)
        num_bytes_per_position = token_bytes_map[targets]  # (batch_size, seq_len)

        # Mask out padding positions
        # Only count positions where attention_mask = 1 AND num_bytes > 0
        valid_mask = (attention_mask == 1) & (num_bytes_per_position > 0)

        # Sum loss (nats)
        batch_nats = (loss_per_position * valid_mask).sum().item()

        # Sum bytes
        batch_bytes = (num_bytes_per_position * valid_mask).sum().item()

        # Count tokens
        batch_tokens = valid_mask.sum().item()

        return batch_nats, batch_bytes, batch_tokens

    def calculate_bpb_from_dataset(
        self,
        dataset_name: str,
        split: str = "train",
        text_field: str = "text",
        max_examples: Optional[int] = None,
        batch_size: int = 8,
        max_length: int = 512
    ) -> Dict[str, Any]:
        """
        Calculate BPB on a HuggingFace dataset.

        Args:
            dataset_name: HuggingFace dataset name
            split: Dataset split (train/test/validation)
            text_field: Field containing text
            max_examples: Max examples to process (None = all)
            batch_size: Batch size
            max_length: Max sequence length

        Returns:
            BPB results dict
        """
        print(f"Loading dataset: {dataset_name} (split={split})")
        dataset = load_dataset(dataset_name, split=split)

        if max_examples:
            dataset = dataset.select(range(min(max_examples, len(dataset))))

        texts = [example[text_field] for example in dataset]

        return self.calculate_bpb(texts, batch_size, max_length)


# Example usage:
if __name__ == "__main__":
    # Calculate BPB for v4.2 model
    calculator = BPBCalculator(
        model_name="ChicoPanama/mew1a-llama-3.2-3b-tcg-pricing"
    )

    # Test on sample texts
    test_texts = [
        "Charizard ex - Obsidian Flames. Listed $45, fair value $52, discount 13%. BUY.",
        "Pikachu VMAX - Listed $120, fair value $95, trending down 12%. PASS.",
        "Mewtwo & Mew-GX - Listed $85, fair value $90, discount 5%, trending up. BUY.",
    ]

    results = calculator.calculate_bpb(test_texts)

    print("\n" + "=" * 60)
    print("BPB CALCULATION RESULTS")
    print("=" * 60)
    print(f"Model: {calculator.model_name}")
    print(f"BPB: {results['bpb']:.4f}")
    print(f"Total Nats: {results['total_nats']:.2f}")
    print(f"Total Bytes: {results['total_bytes']}")
    print(f"Total Tokens: {results['num_tokens']}")
    print(f"Num Examples: {results['num_examples']}")
    print("=" * 60)
