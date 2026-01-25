"""
MEW-1A vLLM DEPLOYMENT - High-Performance Inference
====================================================

vLLM provides 2-3x faster inference vs standard transformers with:
- PagedAttention for efficient memory management
- Continuous batching for higher throughput
- Optimized CUDA kernels
- Better GPU utilization (90%+ vs 70%)

Performance Expectations:
- Current (Modal + transformers): 3-7s per request, 60s cold start
- With vLLM: 1-2s per request, 20s cold start, 5-10x throughput

Deployment Options:
1. Modal Labs (serverless, recommended for production)
2. RunPod (dedicated GPU, better for high volume)
3. Local (development/testing)

Current Model: ChicoPanama/mew1a-llama-3.2-3b-tcg-pricing (v1)
Ready for v4: Just change MODEL_NAME when v4 training completes
"""

import modal
import os

# =============================================================================
# CONFIGURATION
# =============================================================================

# Model Configuration - SWAP THIS FOR V4 WHEN READY
MODEL_NAME = "ChicoPanama/mew1a-llama-3.2-3b-tcg-pricing"  # v1 (current)
# MODEL_NAME = "ChicoPanama/mew1a-v4-llama-3.2-3b-tcg-comprehensive"  # v4 (future)

BASE_MODEL = "meta-llama/Llama-3.2-3B-Instruct"

# vLLM Configuration
VLLM_CONFIG = {
    "gpu_memory_utilization": 0.9,  # Use 90% of GPU memory
    "max_model_len": 2048,  # Max sequence length
    "dtype": "bfloat16",  # Use bfloat16 for better performance
    "enable_chunked_prefill": True,  # Better batching
    "max_num_batched_tokens": 4096,  # Batch size limit
    "tensor_parallel_size": 1,  # Single GPU (T4)
}

# Modal App
app = modal.App("mew1a-vllm")

# =============================================================================
# DOCKER IMAGE WITH vLLM
# =============================================================================

vllm_image = (
    modal.Image.debian_slim(python_version="3.11")
    .pip_install(
        "vllm==0.6.6",  # Latest stable vLLM
        "huggingface-hub==0.27.1",
        "peft==0.14.0",  # For LoRA adapters
    )
)

# =============================================================================
# vLLM MODEL CLASS
# =============================================================================

@app.cls(
    image=vllm_image,
    gpu="T4",  # T4 GPU (cheapest option, perfect for 3B models)
    secrets=[modal.Secret.from_name("huggingface-secret")],
    scaledown_window=300,  # Keep warm for 5 minutes
    timeout=600,  # 10 minute max execution
)
class Mew1AVLLMModel:
    """vLLM-powered Mew-1A inference server"""

    def download_model(self):
        """Download model during build phase (cached in image)"""
        from huggingface_hub import snapshot_download
        import os

        hf_token = os.environ.get("HUGGINGFACE_TOKEN")

        print(f"📥 Downloading base model: {BASE_MODEL}")
        snapshot_download(
            BASE_MODEL,
            token=hf_token,
            ignore_patterns=["*.bin"],  # Only download safetensors
        )

        print(f"📥 Downloading Mew-1A adapters: {MODEL_NAME}")
        snapshot_download(
            MODEL_NAME,
            token=hf_token,
        )

        print("✅ Model download complete!")

    @modal.enter()
    def load_model(self):
        """Initialize vLLM engine on container start"""
        from vllm import LLM
        import os

        hf_token = os.environ.get("HUGGINGFACE_TOKEN")

        print("🚀 Initializing vLLM engine...")
        print(f"   Base Model: {BASE_MODEL}")
        print(f"   LoRA Adapters: {MODEL_NAME}")
        print(f"   GPU Memory Utilization: {VLLM_CONFIG['gpu_memory_utilization']}")

        # Initialize vLLM with LoRA support
        self.llm = LLM(
            model=BASE_MODEL,
            enable_lora=True,
            max_lora_rank=16,  # Match training config (r=16)
            dtype=VLLM_CONFIG["dtype"],
            gpu_memory_utilization=VLLM_CONFIG["gpu_memory_utilization"],
            max_model_len=VLLM_CONFIG["max_model_len"],
            trust_remote_code=True,
        )

        # Load LoRA adapters
        print("📦 Loading LoRA adapters into vLLM...")
        self.lora_id = MODEL_NAME

        print("✅ vLLM engine ready!")
        print(f"   Max batch size: {VLLM_CONFIG['max_num_batched_tokens']}")
        print(f"   Max sequence length: {VLLM_CONFIG['max_model_len']}")

    @modal.method()
    def generate(
        self,
        prompt: str,
        max_tokens: int = 200,
        temperature: float = 0.3,
        top_p: float = 0.9,
        use_lora: bool = True,
    ) -> dict:
        """
        Generate response using vLLM

        Args:
            prompt: Input prompt (should include instruction template)
            max_tokens: Max tokens to generate
            temperature: Sampling temperature (0.0 = deterministic)
            top_p: Nucleus sampling threshold
            use_lora: Whether to use LoRA adapters

        Returns:
            dict with response, tokens, and timing info
        """
        from vllm import SamplingParams
        import time

        start = time.time()

        # Configure sampling
        sampling_params = SamplingParams(
            temperature=temperature,
            top_p=top_p,
            max_tokens=max_tokens,
        )

        # Generate with LoRA if specified
        lora_request = None
        if use_lora:
            from vllm.lora.request import LoRARequest
            lora_request = LoRARequest("mew1a", 1, self.lora_id)

        # Run inference
        outputs = self.llm.generate(
            [prompt],
            sampling_params,
            lora_request=lora_request,
        )

        inference_time = time.time() - start

        # Extract response
        output = outputs[0]
        generated_text = output.outputs[0].text
        num_tokens = len(output.outputs[0].token_ids)

        return {
            "response": generated_text.strip(),
            "tokens": num_tokens,
            "inference_time": inference_time,
            "tokens_per_second": num_tokens / inference_time if inference_time > 0 else 0,
        }

    @modal.method()
    def analyze_card(
        self,
        card_name: str,
        set_name: str = "",
        listed_price: float = 0.0,
        fair_value: float = 0.0,
        max_tokens: int = 200,
    ) -> dict:
        """
        High-level card analysis (formatted prompt wrapper)

        Args:
            card_name: Pokemon card name
            set_name: Set name (optional)
            listed_price: Listed price
            fair_value: Computed fair value
            max_tokens: Max response tokens

        Returns:
            dict with analysis, recommendation, and metadata
        """
        import time

        start = time.time()

        # Build prompt using Mew-1A template
        if fair_value > 0 and listed_price > 0:
            discount = ((fair_value - listed_price) / fair_value) * 100

            instruction = f"""Analyze: {card_name}"""
            if set_name:
                instruction += f" - {set_name}"
            instruction += f". Listed at ${listed_price:.2f}, fair value ${fair_value:.2f}"

        else:
            instruction = f"Analyze the market for {card_name}"
            if set_name:
                instruction += f" from {set_name}"

        prompt = f"""Below is an instruction that describes a task. Write a response that appropriately completes the request.

### Instruction:
{instruction}

### Response:
"""

        # Generate response
        result = self.generate(
            prompt=prompt,
            max_tokens=max_tokens,
            temperature=0.3,
            top_p=0.9,
        )

        total_time = time.time() - start

        # Parse recommendation (BUY/PASS/NEUTRAL)
        response_text = result["response"]
        recommendation = "NEUTRAL"
        if "BUY" in response_text.upper() and "PASS" not in response_text.upper():
            recommendation = "BUY"
        elif "PASS" in response_text.upper():
            recommendation = "PASS"

        return {
            "card": card_name,
            "set": set_name,
            "analysis": response_text,
            "recommendation": recommendation,
            "tokens": result["tokens"],
            "inference_time": result["inference_time"],
            "tokens_per_second": result["tokens_per_second"],
            "total_time": total_time,
        }

# =============================================================================
# WEB ENDPOINT (FastAPI)
# =============================================================================

@app.function(image=vllm_image)
@modal.web_endpoint(method="POST")
def analyze(data: dict):
    """
    HTTP POST endpoint for card analysis

    Usage:
        curl -X POST https://your-app.modal.run/analyze \\
             -H "Content-Type: application/json" \\
             -d '{
                   "card_name": "Charizard ex",
                   "set_name": "Obsidian Flames",
                   "listed_price": 45.0,
                   "fair_value": 52.0
                 }'

    Returns:
        {
          "analysis": "BUY recommendation...",
          "recommendation": "BUY",
          "tokens": 87,
          "inference_time": 1.23,
          "tokens_per_second": 70.7
        }
    """
    # Extract parameters
    card_name = data.get("card_name", "")
    set_name = data.get("set_name", "")
    listed_price = float(data.get("listed_price", 0.0))
    fair_value = float(data.get("fair_value", 0.0))
    max_tokens = int(data.get("max_tokens", 200))

    if not card_name:
        return {"error": "Missing 'card_name' field"}, 400

    # Call model
    model = Mew1AVLLMModel()
    result = model.analyze_card.remote(
        card_name=card_name,
        set_name=set_name,
        listed_price=listed_price,
        fair_value=fair_value,
        max_tokens=max_tokens,
    )

    return result

# =============================================================================
# CLI FUNCTIONS (for testing/development)
# =============================================================================

@app.local_entrypoint()
def test():
    """Test vLLM deployment with sample analysis"""
    print("=" * 80)
    print("MEW-1A vLLM INFERENCE TEST")
    print("=" * 80)

    model = Mew1AVLLMModel()

    # Test case 1: BUY recommendation (13% discount)
    print("\n📊 Test 1: Charizard ex (13% discount)")
    print("-" * 80)
    result1 = model.analyze_card.remote(
        card_name="Charizard ex",
        set_name="Obsidian Flames",
        listed_price=45.0,
        fair_value=52.0,
        max_tokens=150,
    )

    print(f"Analysis: {result1['analysis'][:200]}...")
    print(f"Recommendation: {result1['recommendation']}")
    print(f"Inference Time: {result1['inference_time']:.2f}s")
    print(f"Tokens/sec: {result1['tokens_per_second']:.1f}")

    # Test case 2: PASS recommendation (overpriced)
    print("\n📊 Test 2: Pikachu VMAX (overpriced)")
    print("-" * 80)
    result2 = model.analyze_card.remote(
        card_name="Pikachu VMAX",
        set_name="Vivid Voltage",
        listed_price=120.0,
        fair_value=95.0,
        max_tokens=150,
    )

    print(f"Analysis: {result2['analysis'][:200]}...")
    print(f"Recommendation: {result2['recommendation']}")
    print(f"Inference Time: {result2['inference_time']:.2f}s")
    print(f"Tokens/sec: {result2['tokens_per_second']:.1f}")

    print("\n" + "=" * 80)
    print("✅ vLLM TEST COMPLETE")
    print("=" * 80)
    print(f"\nAverage inference time: {(result1['inference_time'] + result2['inference_time']) / 2:.2f}s")
    print(f"Expected improvement vs transformers: 2-3x faster")
