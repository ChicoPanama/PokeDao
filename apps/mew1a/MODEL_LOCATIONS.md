# MEW-1A Model Locations

Quick reference for all MEW-1A model components.

## Local Files

| Component | Path | Size |
|-----------|------|------|
| LoRA Adapter | `models/mew1a-v4.3-lora/adapter_model.safetensors` | 93MB |
| Tokenizer | `models/mew1a-v4.3-lora/tokenizer.json` | 16MB |
| FAISS Index | `data/vector-store/faiss.index` | ~330MB |
| Card Metadata | `data/vector-store/metadata.pkl` | - |
| Cards JSON | `data/vector-store/cards.json` | 139MB |
| Training Patches | `data/tfv/v4.3.1_training_set.jsonl` | - |

## HuggingFace (Remote)

| Resource | Identifier |
|----------|------------|
| Production Model | `ChicoPanama/mew1a-v4.3.1` |
| Training Dataset | `ChicoPanama/pokedao-mew1a-training-data-layered` |
| Base Model | `meta-llama/Llama-3.2-3B-Instruct` |

## Modal Labs Deployment

| Resource | Location |
|----------|----------|
| vLLM Endpoint | `https://chicopanama--mew1a-vllm-analyze.modal.run` |
| Deploy Script | `apps/mew1a/vllm_deploy_vector_rag.py` |
| Volume | `mew1a-vector-store` (Modal) |

## API Integration

| Component | File |
|-----------|------|
| Mew1AClient | `api/src/lib/ai-ensemble.ts` |
| Ensemble Config | `api/src/lib/ai-ensemble.ts` |

## Model Specs

- **Architecture**: Llama-3.2-3B-Instruct + LoRA
- **LoRA Rank**: 16, Alpha: 32
- **Trainable Params**: 24.3M (0.75% of base)
- **Training Examples**: 253,810+
- **Vector Store**: 482,298 cards indexed
- **Inference**: 1-2s (vLLM) / 3-7s (transformers)

## Environment Variables

```bash
HUGGINGFACE_TOKEN=hf_...           # Required for model downloads
VLLM_ENDPOINT=https://...          # Optional, has default
USE_VLLM=true                      # Default: true
```
