"""
MEW-1A vLLM DEPLOYMENT (Using Merged v1 Model - No Llama Access Required)
===========================================================================

This version uses your already-merged Mew-1A v1 model directly.
No need for Llama 3.2 base model access!

Performance: Same 2-3x speedup with vLLM
Model: ChicoPanama/mew1a-llama-3.2-3b-tcg-pricing (merged)
"""

import modal

# =============================================================================
# CONFIGURATION
# =============================================================================

# Use your merged model directly (no base model needed!)
MODEL_NAME = "ChicoPanama/mew1a-llama-3.2-3b-tcg-pricing"

# vLLM Configuration
VLLM_CONFIG = {
    "gpu_memory_utilization": 0.9,
    "max_model_len": 2048,
    "dtype": "bfloat16",
    "enable_chunked_prefill": True,
    "max_num_batched_tokens": 4096,
    "tensor_parallel_size": 1,
}

# Modal App
app = modal.App("mew1a-vllm-v1-merged")

# =============================================================================
# DOCKER IMAGE WITH vLLM
# =============================================================================

vllm_image = (
    modal.Image.debian_slim(python_version="3.11")
    .pip_install(
        "vllm==0.6.6",
        "huggingface-hub==0.27.1",
    )
)

# =============================================================================
# vLLM MODEL CLASS
# =============================================================================

@app.cls(
    image=vllm_image,
    gpu="T4",
    secrets=[modal.Secret.from_name("huggingface-secret")],
    scaledown_window=300,
    timeout=600,
)
class Mew1AVLLMModel:
    """vLLM-powered Mew-1A inference (merged model, no LoRA)"""

    @modal.enter()
    def load_model(self):
        """Initialize vLLM engine on container start"""
        from vllm import LLM
        import os

        hf_token = os.environ.get("HUGGINGFACE_TOKEN")

        print("🚀 Initializing vLLM engine...")
        print(f"   Model: {MODEL_NAME} (merged, no LoRA needed)")
        print(f"   GPU Memory Utilization: {VLLM_CONFIG['gpu_memory_utilization']}")

        # Initialize vLLM with merged model (no LoRA)
        self.llm = LLM(
            model=MODEL_NAME,
            dtype=VLLM_CONFIG["dtype"],
            gpu_memory_utilization=VLLM_CONFIG["gpu_memory_utilization"],
            max_model_len=VLLM_CONFIG["max_model_len"],
            trust_remote_code=True,
        )

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
    ) -> dict:
        """Generate response using vLLM"""
        from vllm import SamplingParams
        import time

        start = time.time()

        sampling_params = SamplingParams(
            temperature=temperature,
            top_p=top_p,
            max_tokens=max_tokens,
        )

        outputs = self.llm.generate([prompt], sampling_params)

        inference_time = time.time() - start

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
        """High-level card analysis"""
        import time

        start = time.time()

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

        result = self.generate(prompt=prompt, max_tokens=max_tokens)
        total_time = time.time() - start

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
# WEB ENDPOINT
# =============================================================================

@app.function(image=vllm_image)
@modal.asgi_app()
def fastapi_app():
    from fastapi import FastAPI

    web_app = FastAPI()

    @web_app.post("/analyze")
    async def analyze(data: dict):
        card_name = data.get("card_name", "")
        set_name = data.get("set_name", "")
        listed_price = float(data.get("listed_price", 0.0))
        fair_value = float(data.get("fair_value", 0.0))
        max_tokens = int(data.get("max_tokens", 200))

        if not card_name:
            return {"error": "Missing 'card_name' field"}

        model = Mew1AVLLMModel()
        result = model.analyze_card.remote(
            card_name=card_name,
            set_name=set_name,
            listed_price=listed_price,
            fair_value=fair_value,
            max_tokens=max_tokens,
        )
        return result

    return web_app

# =============================================================================
# CLI TEST FUNCTION
# =============================================================================

@app.local_entrypoint()
def test():
    """Test vLLM deployment"""
    print("=" * 80)
    print("MEW-1A vLLM INFERENCE TEST (Merged v1 Model)")
    print("=" * 80)

    model = Mew1AVLLMModel()

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

    print("\n" + "=" * 80)
    print("✅ vLLM TEST COMPLETE")
    print("=" * 80)
    print(f"\nInference time: {result1['inference_time']:.2f}s")
    print(f"Expected speedup vs transformers: 2-3x faster")
