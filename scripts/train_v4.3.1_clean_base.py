#!/usr/bin/env python3
import os, json, torch
from datasets import Dataset
from transformers import AutoModelForCausalLM, AutoTokenizer, TrainingArguments
from peft import LoraConfig, get_peft_model
from trl import SFTTrainer

print('='*80)
print('MEW-1A v4.3.1 - BUY/PASS/HOLD ALIGNMENT (Clean Llama-3.2-3B Base)')
print('='*80)

BASE_MODEL='meta-llama/Llama-3.2-3B-Instruct'
OUTPUT_DIR='./mew1a-v4.3.1-lora'
MERGED_DIR='./mew1a-v4.3.1-merged'
DATASET_PATH='./data/mew1a-v4.3.1-lora-patch.jsonl'
HF_REPO='ChicoPanama/mew1a-v4.3.1'

# LoRA config
lora_config=LoraConfig(r=16,lora_alpha=32,target_modules=['q_proj','v_proj','k_proj','o_proj','gate_proj','up_proj','down_proj'],lora_dropout=0.05,bias='none',task_type='CAUSAL_LM')

print(f'Loading base model: {BASE_MODEL}')
model=AutoModelForCausalLM.from_pretrained(BASE_MODEL,torch_dtype=torch.bfloat16,device_map='auto',token=os.environ.get('HUGGINGFACE_TOKEN'))

print('Applying LoRA')
model=get_peft_model(model,lora_config)
model.print_trainable_parameters()

print('Loading tokenizer')
tokenizer=AutoTokenizer.from_pretrained(BASE_MODEL,token=os.environ.get('HUGGINGFACE_TOKEN'))
tokenizer.pad_token=tokenizer.eos_token
tokenizer.padding_side='right'

print(f'Loading dataset: {DATASET_PATH}')
with open(DATASET_PATH,'r') as f:data=[json.loads(line) for line in f]
print(f'{len(data)} examples loaded')

# Count categories
buy_count=sum(1 for ex in data if 'BUY' in ex['messages'][1]['content'][:10])
pass_count=sum(1 for ex in data if 'PASS' in ex['messages'][1]['content'][:10])
hold_count=sum(1 for ex in data if 'HOLD' in ex['messages'][1]['content'][:10])
print(f'  BUY: {buy_count}, PASS: {pass_count}, HOLD: {hold_count}')

dataset=Dataset.from_list(data)

def formatting_func(example):
    user_msg=example['messages'][0]['content']
    assistant_msg=example['messages'][1]['content']
    return f"<|begin_of_text|><|start_header_id|>user<|end_header_id|>\n\n{user_msg}<|eot_id|><|start_header_id|>assistant<|end_header_id|>\n\n{assistant_msg}<|eot_id|>"

training_args=TrainingArguments(
    output_dir=OUTPUT_DIR,
    num_train_epochs=3,
    per_device_train_batch_size=2,
    gradient_accumulation_steps=8,
    gradient_checkpointing=True,
    learning_rate=2e-4,
    bf16=True,
    logging_steps=5,
    save_strategy='epoch',
    save_total_limit=2,
    warmup_ratio=0.1,
    lr_scheduler_type='cosine',
    optim='adamw_torch',
    report_to='none',
    max_grad_norm=0.3,
    weight_decay=0.01
)

print('Initializing SFTTrainer')
trainer=SFTTrainer(
    model=model,
    train_dataset=dataset,
    tokenizer=tokenizer,
    args=training_args,
    formatting_func=formatting_func,
    max_seq_length=1024,
    packing=False
)

print('Starting training (15-20 minutes on A6000)')
print('Goal: Reduce contradiction rate from 37.5% to <5%')
print('='*80)
trainer.train()

print('\nSaving LoRA adapters...')
model.save_pretrained(OUTPUT_DIR)
tokenizer.save_pretrained(OUTPUT_DIR)
print(f'✅ LoRA adapters saved to {OUTPUT_DIR}')

# Merge LoRA with base model
print('\nMerging LoRA adapters with base model...')
from peft import PeftModel

base_model_reload=AutoModelForCausalLM.from_pretrained(
    BASE_MODEL,
    torch_dtype=torch.bfloat16,
    device_map='auto',
    token=os.environ.get('HUGGINGFACE_TOKEN')
)

model_with_lora=PeftModel.from_pretrained(base_model_reload,OUTPUT_DIR)
merged_model=model_with_lora.merge_and_unload()

print(f'Saving merged model to {MERGED_DIR}')
merged_model.save_pretrained(MERGED_DIR)
tokenizer.save_pretrained(MERGED_DIR)
print(f'✅ Merged model saved to {MERGED_DIR}')

# Upload to HuggingFace
if os.environ.get('HUGGINGFACE_TOKEN'):
    print(f'\nUploading to HuggingFace: {HF_REPO}')
    from huggingface_hub import HfApi
    api=HfApi()
    api.upload_folder(
        folder_path=MERGED_DIR,
        repo_id=HF_REPO,
        repo_type='model',
        token=os.environ['HUGGINGFACE_TOKEN']
    )
    print(f'✅ Model uploaded to https://huggingface.co/{HF_REPO}')
else:
    print('\n⚠️  HUGGINGFACE_TOKEN not set, skipping upload')

print('\n'+'='*80)
print('✅ V4.3.1 TRAINING COMPLETE!')
print('='*80)
print('\nNext steps:')
print('1. Deploy to Modal Labs')
print('2. Run Rules Baseline evaluator')
print('3. Verify contradiction rate <5%')
print('='*80)
