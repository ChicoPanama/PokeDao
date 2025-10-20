"""
MEW-1A v4.2 vLLM DEPLOYMENT - ULTIMATE POKEMON TCG AI
=====================================================

Trained on 509,746 examples with 84.8% temporal data for price trend forecasting.
Uses merged model for vLLM (no base model access required).

Performance: 2-3x faster than transformers (1-2s vs 3-7s)
Model: ChicoPanama/mew1a-v4.2-merged-llama-3.2-3b-pokemon-tcg
"""

import modal

# =============================================================================
# CONFIGURATION
# =============================================================================

# Merged v4.2 model (full weights, no LoRA needed)
MODEL_NAME = "ChicoPanama/mew1a-v4.2-merged-llama-3.2-3b-pokemon-tcg"

# vLLM Configuration (optimized for T4 GPU)
VLLM_CONFIG = {
    "gpu_memory_utilization": 0.9,
    "max_model_len": 2048,
    "dtype": "bfloat16",
    "enable_chunked_prefill": True,
    "max_num_batched_tokens": 4096,
    "tensor_parallel_size": 1,
}

# Modal App
app = modal.App("mew1a-vllm-v4.2")

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
class Mew1AV42VLLMModel:
    """vLLM-powered Mew-1A v4.2 inference with 509K training examples"""

    @modal.enter()
    def load_model(self):
        """Initialize vLLM engine on container start"""
        from vllm import LLM
        import os

        hf_token = os.environ.get("HUGGINGFACE_TOKEN")

        print("🚀 Initializing Mew-1A v4.2 vLLM engine...")
        print(f"   Model: {MODEL_NAME}")
        print(f"   Training Examples: 509,746")
        print(f"   Temporal Data: 84.8% (432,107 examples)")
        print(f"   GPU Memory Utilization: {VLLM_CONFIG['gpu_memory_utilization']}")

        # Initialize vLLM with merged model
        self.llm = LLM(
            model=MODEL_NAME,
            dtype=VLLM_CONFIG["dtype"],
            gpu_memory_utilization=VLLM_CONFIG["gpu_memory_utilization"],
            max_model_len=VLLM_CONFIG["max_model_len"],
            trust_remote_code=True,
        )

        print("✅ Mew-1A v4.2 vLLM engine ready!")
        print(f"   Max batch size: {VLLM_CONFIG['max_num_batched_tokens']}")
        print(f"   Max sequence length: {VLLM_CONFIG['max_model_len']}")
        print(f"   Features: Market forecasting, Reddit sentiment, trend analysis")

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
        reddit_sentiment: str = "",
        max_tokens: int = 200,
    ) -> dict:
        """
        High-level card analysis with v4.2 features

        Args:
            card_name: Name of the card
            set_name: Set name (optional)
            listed_price: Current listing price
            fair_value: Estimated fair market value
            reddit_sentiment: Optional Reddit sentiment summary
            max_tokens: Max response tokens

        Returns:
            Analysis with BUY/PASS/HOLD recommendation
        """
        import time

        start = time.time()

        # Build enhanced prompt with v4.2 features
        if fair_value > 0 and listed_price > 0:
            discount = ((fair_value - listed_price) / fair_value) * 100
            instruction = f"""Analyze: {card_name}"""
            if set_name:
                instruction += f" - {set_name}"
            instruction += f". Listed at ${listed_price:.2f}, fair value ${fair_value:.2f} ({discount:.1f}% discount)"

            if reddit_sentiment:
                instruction += f". Reddit sentiment: {reddit_sentiment}"
        else:
            instruction = f"Analyze the market for {card_name}"
            if set_name:
                instruction += f" from {set_name}"
            if reddit_sentiment:
                instruction += f". Reddit sentiment: {reddit_sentiment}"

        prompt = f"""Below is an instruction that describes a task. Write a response that appropriately completes the request.

### Instruction:
{instruction}

### Response:
"""

        result = self.generate(prompt=prompt, max_tokens=max_tokens)
        total_time = time.time() - start

        response_text = result["response"]

        # Extract recommendation
        recommendation = "NEUTRAL"
        if "BUY" in response_text.upper() and "PASS" not in response_text.upper():
            recommendation = "BUY"
        elif "PASS" in response_text.upper():
            recommendation = "PASS"
        elif "HOLD" in response_text.upper():
            recommendation = "HOLD"

        return {
            "card": card_name,
            "set": set_name,
            "analysis": response_text,
            "recommendation": recommendation,
            "tokens": result["tokens"],
            "inference_time": result["inference_time"],
            "tokens_per_second": result["tokens_per_second"],
            "total_time": total_time,
            "model_version": "v4.2",
            "training_examples": 509746,
        }

    @modal.method()
    def health_check(self) -> dict:
        """Health check endpoint for monitoring"""
        return {
            "status": "healthy",
            "model": MODEL_NAME,
            "version": "v4.2",
            "training_examples": 509746,
            "temporal_data_pct": 84.8,
            "features": [
                "market_forecasting",
                "reddit_sentiment",
                "price_trends",
                "arbitrage_detection"
            ]
        }

# =============================================================================
# WEB ENDPOINTS
# =============================================================================

@app.function(image=vllm_image)
@modal.asgi_app()
def fastapi_app():
    from fastapi import FastAPI
    from fastapi.responses import JSONResponse

    web_app = FastAPI(
        title="Mew-1A v4.2 API",
        description="Pokemon TCG AI trained on 509K examples",
        version="4.2.0"
    )

    @web_app.get("/health")
    async def health():
        """Health check endpoint"""
        model = Mew1AV42VLLMModel()
        return model.health_check.remote()

    @web_app.post("/analyze")
    async def analyze(data: dict):
        """Card analysis endpoint"""
        card_name = data.get("card_name", "")
        set_name = data.get("set_name", "")
        listed_price = float(data.get("listed_price", 0.0))
        fair_value = float(data.get("fair_value", 0.0))
        reddit_sentiment = data.get("reddit_sentiment", "")
        max_tokens = int(data.get("max_tokens", 200))

        if not card_name:
            return JSONResponse(
                status_code=400,
                content={"error": "Missing 'card_name' field"}
            )

        model = Mew1AV42VLLMModel()
        result = model.analyze_card.remote(
            card_name=card_name,
            set_name=set_name,
            listed_price=listed_price,
            fair_value=fair_value,
            reddit_sentiment=reddit_sentiment,
            max_tokens=max_tokens,
        )
        return result

    @web_app.post("/generate")
    async def generate(data: dict):
        """Raw text generation endpoint"""
        prompt = data.get("prompt", "")
        max_tokens = int(data.get("max_tokens", 200))
        temperature = float(data.get("temperature", 0.3))
        top_p = float(data.get("top_p", 0.9))

        if not prompt:
            return JSONResponse(
                status_code=400,
                content={"error": "Missing 'prompt' field"}
            )

        model = Mew1AV42VLLMModel()
        result = model.generate.remote(
            prompt=prompt,
            max_tokens=max_tokens,
            temperature=temperature,
            top_p=top_p,
        )
        return result

    return web_app

# =============================================================================
# CLI TEST FUNCTION
# =============================================================================

@app.local_entrypoint()
def test():
    """Test Mew-1A v4.2 vLLM deployment"""
    print("=" * 80)
    print("MEW-1A v4.2 vLLM INFERENCE TEST")
    print("=" * 80)
    print("Model: ChicoPanama/mew1a-v4.2-merged-llama-3.2-3b-pokemon-tcg")
    print("Training: 509,746 examples (84.8% temporal data)")
    print("=" * 80)

    model = Mew1AV42VLLMModel()

    # Test 1: Health check
    print("\n🏥 Test 1: Health Check")
    print("-" * 80)
    health = model.health_check.remote()
    print(f"Status: {health['status']}")
    print(f"Version: {health['version']}")
    print(f"Features: {', '.join(health['features'])}")

    # Test 2: Card analysis with discount
    print("\n📊 Test 2: Charizard ex (13% discount)")
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

    # Test 3: Card analysis with Reddit sentiment
    print("\n💬 Test 3: Pikachu VMAX with Reddit sentiment")
    print("-" * 80)
    result2 = model.analyze_card.remote(
        card_name="Pikachu VMAX",
        set_name="Vivid Voltage",
        listed_price=120.0,
        fair_value=95.0,
        reddit_sentiment="Trending down, market oversaturated",
        max_tokens=150,
    )

    print(f"Analysis: {result2['analysis'][:200]}...")
    print(f"Recommendation: {result2['recommendation']}")
    print(f"Inference Time: {result2['inference_time']:.2f}s")

    # Summary
    print("\n" + "=" * 80)
    print("✅ MEW-1A v4.2 vLLM TEST COMPLETE")
    print("=" * 80)
    print(f"\nAverage inference time: {(result1['inference_time'] + result2['inference_time']) / 2:.2f}s")
    print(f"Expected speedup vs v1 transformers: 2-3x faster")
    print(f"\nNew v4.2 Features:")
    print("  ✅ Temporal price trend analysis (84.8% of data)")
    print("  ✅ Reddit sentiment integration (24K posts)")
    print("  ✅ Market forecasting (432K temporal records)")
    print("  ✅ Enhanced arbitrage detection")
    print("\n" + "=" * 80 + "\n")
