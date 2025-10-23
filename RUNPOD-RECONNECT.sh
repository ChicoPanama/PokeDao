#!/bin/bash
# Quick reconnect to RunPod and start training

echo "🔌 Connecting to RunPod..."
echo ""

# Copy training script to clipboard for easy paste
cat << 'EOF'
========================================================================
COPY THIS ENTIRE BLOCK AND PASTE INTO RUNPOD:
========================================================================

# Install dependencies
pip install -q transformers datasets peft accelerate wandb bitsandbytes

# Set token
export HUGGINGFACE_TOKEN=$HUGGINGFACE_TOKEN

# Create training script
cat > train.py << 'ENDPYTHON'
#!/usr/bin/env python3
import os
import torch
from datasets import load_dataset
from transformers import AutoTokenizer, AutoModelForCausalLM, TrainingArguments, Trainer, DataCollatorForLanguageModeling
from peft import LoraConfig, get_peft_model
import wandb

MODEL_NAME = "meta-llama/Llama-3.2-3B-Instruct"
DATASET_NAME = "ChicoPanama/mew1a-v4.2-pokemon-tcg-ultimate-complete"
OUTPUT_DIR = "./mew1a-v4.2"
HF_TOKEN = os.environ.get("HUGGINGFACE_TOKEN")

print("🚀 MEW-1A v4.2 TRAINING - 509,746 examples\n")

wandb.init(project="mew1a-v4.2", name="mew1a-v4.2-training")

print("📦 Loading dataset...")
dataset = load_dataset(DATASET_NAME, token=HF_TOKEN)
print(f"✅ {len(dataset['train'])} examples loaded\n")

print("🔤 Loading tokenizer...")
tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME, token=HF_TOKEN)
tokenizer.pad_token = tokenizer.eos_token
tokenizer.padding_side = "right"

print("🤖 Loading model...")
model = AutoModelForCausalLM.from_pretrained(MODEL_NAME, token=HF_TOKEN, torch_dtype=torch.bfloat16, device_map="auto")

print("⚙️  Configuring LoRA...")
lora_config = LoraConfig(r=16, lora_alpha=32, target_modules=["q_proj","k_proj","v_proj","o_proj","gate_proj","up_proj","down_proj"], lora_dropout=0.05, bias="none", task_type="CAUSAL_LM")
model = get_peft_model(model, lora_config)
model.print_trainable_parameters()

def format_instruction(ex):
    return f"""<|begin_of_text|><|start_header_id|>system<|end_header_id|>

You are Mew-1A, an expert Pokemon TCG investment analyst.<|eot_id|><|start_header_id|>user<|end_header_id|>

{ex['instruction']}

{ex['input']}<|eot_id|><|start_header_id|>assistant<|end_header_id|>

{ex['output']}<|eot_id|>"""

def tokenize_function(examples):
    texts = [format_instruction({'instruction': examples['instruction'][i], 'input': examples['input'][i], 'output': examples['output'][i]}) for i in range(len(examples['instruction']))]
    return tokenizer(texts, truncation=True, max_length=1024, padding=False)

print("🔄 Tokenizing...")
tokenized = dataset.map(tokenize_function, batched=True, remove_columns=dataset["train"].column_names)

training_args = TrainingArguments(
    output_dir=OUTPUT_DIR,
    num_train_epochs=3,
    per_device_train_batch_size=4,
    gradient_accumulation_steps=8,
    learning_rate=2e-4,
    lr_scheduler_type="cosine",
    warmup_ratio=0.03,
    logging_steps=50,
    save_steps=1000,
    save_total_limit=3,
    bf16=True,
    gradient_checkpointing=True,
    optim="adamw_torch",
    report_to="wandb",
)

trainer = Trainer(
    model=model,
    args=training_args,
    train_dataset=tokenized["train"],
    data_collator=DataCollatorForLanguageModeling(tokenizer=tokenizer, mlm=False),
)

print("\n🔥 STARTING TRAINING (18-24 hours)...\n")
trainer.train()

print("\n✅ TRAINING COMPLETE!")
trainer.save_model(f"{OUTPUT_DIR}/final")
tokenizer.save_pretrained(f"{OUTPUT_DIR}/final")

print("☁️  Uploading to HuggingFace...")
model.push_to_hub("ChicoPanama/mew1a-v4.2-llama-3.2-3b-pokemon-tcg-ultimate", token=HF_TOKEN)
tokenizer.push_to_hub("ChicoPanama/mew1a-v4.2-llama-3.2-3b-pokemon-tcg-ultimate", token=HF_TOKEN)

wandb.finish()
print("\n🎉 COMPLETE!\n")
ENDPYTHON

# Start training
echo ""
echo "🚀 Starting training..."
python3 train.py 2>&1 | tee training.log

========================================================================
EOF

echo ""
echo "Now run this command to connect:"
echo ""
echo "ssh 9kak0o915a39u7-64411a76@ssh.runpod.io -i ~/.ssh/id_ed25519"
echo ""
