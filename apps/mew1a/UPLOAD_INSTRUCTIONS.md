# How to Upload Mew-1A Training Data to HuggingFace

## Method 1: Web UI (Easiest - Recommended)

### Step 1: Create New Dataset
1. Go to: https://huggingface.co/new-dataset
2. Owner: Your username (e.g., `your-username`)
3. Dataset name: `pokedao-mew1a-training-data`
4. License: Select "other" (proprietary)
5. Click **"Create dataset"**

### Step 2: Upload Files
1. Click **"Files and versions"** tab
2. Click **"Add file"** → **"Upload files"**
3. Upload these 2 files:
   - `/Users/arcadio/dev/pokedao/data/mew1a-training-data.jsonl`
   - The README below (copy and save as `README.md`)

### Step 3: README Content
```markdown
# Project Mew-1A Training Dataset

The world's first AI training dataset specifically for Pokemon TCG pricing analysis.

## Dataset Description

This dataset contains 258 high-quality examples extracted from 400,000+ real market listings across 5 major marketplaces:
- eBay (11,795 listings)
- Courtyard (353,201 tokenized assets)
- Collector Crypt (22,442 listings)
- Phygitals (20,487 NFTs)
- TCGPlayer (1 listing)

## Task

Instruction-tuned text generation for TCG market analysis:
- Input: Card details, pricing data, market metrics
- Output: Investment recommendation with conviction score and analysis

## Format

JSONL with instruction-tuning format:
\`\`\`json
{
  "instruction": "You are a TCG market analyst...",
  "input": "Card: Charizard - Base Set PSA 10\\nListed Price: $5000...",
  "output": "RECOMMENDATION: STRONG_BUY\\nCONVICTION: 85%..."
}
\`\`\`

## Statistics

- Total Examples: 258
- STRONG_BUY: 152 (58.9%)
- HOLD: 69 (26.7%)
- BUY: 25 (9.7%)
- PASS: 12 (4.7%)
- Avg Input Length: 217 chars
- Avg Output Length: 233 chars

## Recommended Base Model

\`meta-llama/Llama-3.2-3B-Instruct\`

## Training Configuration

```python
{
  "base_model": "meta-llama/Llama-3.2-3B-Instruct",
  "task": "text-generation",
  "learning_rate": 2e-4,
  "num_epochs": 3,
  "batch_size": 4,
  "gradient_accumulation_steps": 4,
  "max_seq_length": 512,
  "lora_r": 8,
  "lora_alpha": 16,
  "lora_dropout": 0.05
}
```

## Fine-Tuning

### Using HuggingFace AutoTrain
1. Go to: https://huggingface.co/autotrain
2. Create new project → "Text Generation"
3. Select this dataset
4. Base model: `meta-llama/Llama-3.2-3B-Instruct`
5. Configure parameters above
6. Train! (~$20-30, 2-4 hours)

### Using Local Training
```bash
# Install dependencies
pip install transformers datasets peft accelerate

# Run training script
python train_mew1a.py --dataset your-username/pokedao-mew1a-training-data
```

## Citation

If you use this dataset, please cite:
```
@dataset{pokedao_mew1a_2025,
  title={Project Mew-1A: Pokemon TCG Pricing AI Training Dataset},
  author={PokeDAO Team},
  year={2025},
  url={https://huggingface.co/datasets/your-username/pokedao-mew1a-training-data}
}
```

## License

Proprietary - PokeDAO 2025

## Contact

- GitHub: https://github.com/ChicoPanama/PokeDao
- Email: team@pokedao.xyz
```

---

## Method 2: Using HuggingFace CLI (Alternative)

### Install CLI
```bash
pip install huggingface_hub
huggingface-cli login
# Enter token: your_huggingface_token_here
```

### Create and Upload
```bash
# Create dataset
huggingface-cli repo create pokedao-mew1a-training-data --type dataset

# Upload files
huggingface-cli upload your-username/pokedao-mew1a-training-data \
  /Users/arcadio/dev/pokedao/data/mew1a-training-data.jsonl \
  --repo-type dataset
```

---

## After Upload

Once uploaded, your dataset will be at:
`https://huggingface.co/datasets/your-username/pokedao-mew1a-training-data`

**Next: Fine-tune the model using HuggingFace AutoTrain!**
