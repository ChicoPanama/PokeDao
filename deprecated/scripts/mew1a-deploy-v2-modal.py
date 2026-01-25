#!/usr/bin/env python3

"""
Mew-1A v2 Modal Labs Deployment Script

Deploy the trained Mew-1A v2 model to Modal Labs serverless GPU for production.

Features:
- Serverless GPU inference (pay-per-use)
- Cold start: ~60s (model download + load)
- Warm inference: 3-7s per request
- Auto-scaling based on demand
- REST API endpoint

Cost: $0.00015/sec GPU time (T4 GPU)
"""

import modal
from modal import Image, Stub, web_endpoint, Secret

# Modal configuration
MODEL_NAME = "ChicoPanama/mew1a-v2-llama-3.2-3b-tcg-pricing"
BASE_MODEL = "meta-llama/Llama-3.2-3B-Instruct"

# Create Modal app
stub = Stub("mew1a-v2-tcg-pricing")

# Define container image with all dependencies
image = (
    Image.debian_slim(python_version="3.11")
    .pip_install(
        "torch==2.1.0",
        "transformers==4.36.0",
        "peft==0.7.0",
        "accelerate==0.25.0",
        "bitsandbytes==0.41.3",
        "scipy==1.11.4",
        "huggingface-hub==0.20.0",
    )
)


@stub.cls(
    gpu="T4",  # NVIDIA T4 (16GB VRAM) - good balance of cost/performance
    image=image,
    secrets=[Secret.from_name("huggingface-secret")],  # For model access
    container_idle_timeout=300,  # Keep warm for 5 minutes
    timeout=600,  # 10 minute timeout per request
)
class Mew1AModel:
    """Mew-1A v2 Model Handler"""

    def __enter__(self):
        """Load model on container startup"""
        import torch
        from transformers import AutoModelForCausalLM, AutoTokenizer
        from peft import PeftModel

        print(f"🤖 Loading Mew-1A v2 from HuggingFace: {MODEL_NAME}")

        # Load base model
        self.base_model = AutoModelForCausalLM.from_pretrained(
            BASE_MODEL,
            torch_dtype=torch.bfloat16,
            device_map="auto",
            trust_remote_code=True,
        )

        # Load LoRA adapters
        self.model = PeftModel.from_pretrained(
            self.base_model,
            MODEL_NAME,
            torch_dtype=torch.bfloat16,
        )

        # Load tokenizer
        self.tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)
        self.tokenizer.pad_token = self.tokenizer.eos_token
        self.tokenizer.padding_side = "right"

        print("✅ Mew-1A v2 loaded and ready!")

    @modal.method()
    def generate(
        self,
        prompt: str,
        max_new_tokens: int = 300,
        temperature: float = 0.7,
        top_p: float = 0.9,
        do_sample: bool = True,
    ) -> str:
        """
        Generate response from Mew-1A v2

        Args:
            prompt: Input prompt (instruction-tuning format)
            max_new_tokens: Maximum tokens to generate
            temperature: Sampling temperature (0.0 = deterministic)
            top_p: Nucleus sampling parameter
            do_sample: Whether to use sampling

        Returns:
            Generated text response
        """
        import torch

        # Tokenize input
        inputs = self.tokenizer(
            prompt,
            return_tensors="pt",
            truncation=True,
            max_length=512,
        ).to(self.model.device)

        # Generate
        with torch.no_grad():
            outputs = self.model.generate(
                **inputs,
                max_new_tokens=max_new_tokens,
                temperature=temperature,
                top_p=top_p,
                do_sample=do_sample,
                pad_token_id=self.tokenizer.eos_token_id,
            )

        # Decode
        response = self.tokenizer.decode(outputs[0], skip_special_tokens=True)

        # Extract only the generated part (after prompt)
        if "### Response:" in response:
            response = response.split("### Response:")[-1].strip()

        return response

    @modal.method()
    def analyze_card(
        self,
        card_name: str,
        set_name: str,
        listed_price: float,
        listing_count: int = None,
        fair_value: float = None,
    ) -> dict:
        """
        Analyze a Pokemon card for investment potential

        Args:
            card_name: Name of the card
            set_name: Pokemon TCG set name
            listed_price: Current listing price
            listing_count: Number of active listings (optional)
            fair_value: Estimated fair market value (optional)

        Returns:
            Dict with analysis, recommendation, and reasoning
        """

        # Build instruction
        instruction = f"Analyze: {card_name} - {set_name}. Listed at ${listed_price:.2f}"

        if listing_count is not None:
            instruction += f", {listing_count} active listings"

        if fair_value is not None:
            instruction += f", fair value ${fair_value:.2f}"

        # Format as instruction-tuning prompt
        prompt = f"""Below is an instruction that describes a task. Write a response that appropriately completes the request.

### Instruction:
{instruction}

### Response:
"""

        # Generate analysis
        analysis = self.generate(prompt, max_new_tokens=300, temperature=0.7)

        # Parse response for structured output
        result = {
            "card_name": card_name,
            "set_name": set_name,
            "listed_price": listed_price,
            "analysis": analysis,
            "model_version": "mew1a-v2",
        }

        # Try to extract recommendation
        if "RECOMMENDATION:" in analysis:
            rec_line = [
                line for line in analysis.split("\n") if "RECOMMENDATION:" in line
            ]
            if rec_line:
                result["recommendation"] = rec_line[0].split("RECOMMENDATION:")[-1].strip()

        return result


@stub.function(image=image)
@web_endpoint(method="POST")
def analyze_card_endpoint(data: dict):
    """
    REST API endpoint for card analysis

    POST /analyze_card
    Body: {
        "card_name": "Charizard ex",
        "set_name": "Obsidian Flames",
        "listed_price": 45.00,
        "listing_count": 15,  # optional
        "fair_value": 52.00    # optional
    }

    Returns: {
        "card_name": "Charizard ex",
        "set_name": "Obsidian Flames",
        "listed_price": 45.00,
        "analysis": "ANALYSIS: Strong BUY opportunity...",
        "recommendation": "BUY",
        "model_version": "mew1a-v2"
    }
    """
    model = Mew1AModel()
    return model.analyze_card.remote(
        card_name=data["card_name"],
        set_name=data["set_name"],
        listed_price=data["listed_price"],
        listing_count=data.get("listing_count"),
        fair_value=data.get("fair_value"),
    )


@stub.function(image=image)
@web_endpoint(method="POST")
def generate_endpoint(data: dict):
    """
    Raw text generation endpoint

    POST /generate
    Body: {
        "prompt": "Below is an instruction...",
        "max_tokens": 300,     # optional
        "temperature": 0.7     # optional
    }

    Returns: {
        "response": "Generated text..."
    }
    """
    model = Mew1AModel()
    response = model.generate.remote(
        prompt=data["prompt"],
        max_new_tokens=data.get("max_tokens", 300),
        temperature=data.get("temperature", 0.7),
    )
    return {"response": response, "model_version": "mew1a-v2"}


@stub.local_entrypoint()
def main():
    """Test the deployed model locally"""
    print("=" * 80)
    print("Testing Mew-1A v2 Deployment")
    print("=" * 80)

    # Test card analysis
    print("\n📊 Testing card analysis...")
    model = Mew1AModel()
    result = model.analyze_card.remote(
        card_name="Charizard ex",
        set_name="Obsidian Flames",
        listed_price=45.00,
        listing_count=15,
        fair_value=52.00,
    )

    print("\n✅ Analysis Result:")
    print(f"Card: {result['card_name']} - {result['set_name']}")
    print(f"Listed Price: ${result['listed_price']:.2f}")
    print(f"\n{result['analysis']}")

    if "recommendation" in result:
        print(f"\n🎯 Recommendation: {result['recommendation']}")

    print("\n" + "=" * 80)
    print("✅ Deployment test complete!")
    print("=" * 80)


# Deployment instructions
"""
DEPLOYMENT INSTRUCTIONS:

1. Install Modal CLI:
   pip install modal

2. Setup Modal account:
   modal setup

3. Create HuggingFace secret in Modal dashboard:
   - Go to https://modal.com/secrets
   - Create secret named "huggingface-secret"
   - Add key: HUGGINGFACE_TOKEN = your_token_here

4. Deploy to Modal:
   modal deploy scripts/mew1a-deploy-v2-modal.py

5. Test the deployment:
   modal run scripts/mew1a-deploy-v2-modal.py

6. Get endpoint URLs:
   modal app list
   modal app show mew1a-v2-tcg-pricing

7. Use the API:
   curl -X POST https://your-username--mew1a-v2-tcg-pricing-analyze-card-endpoint.modal.run \\
     -H "Content-Type: application/json" \\
     -d '{
       "card_name": "Charizard ex",
       "set_name": "Obsidian Flames",
       "listed_price": 45.00,
       "listing_count": 15,
       "fair_value": 52.00
     }'

COST ESTIMATION:
- Cold start: ~60s @ $0.00015/sec = $0.009
- Warm inference: ~5s @ $0.00015/sec = $0.00075 per request
- 1,000 requests/day: ~$0.75/day = $22.50/month
- 10,000 requests/day: ~$7.50/day = $225/month

Pay only for actual usage - no idle costs!

MONITORING:
- View logs: modal app logs mew1a-v2-tcg-pricing
- View metrics: modal app stats mew1a-v2-tcg-pricing
- Update deployment: modal deploy scripts/mew1a-deploy-v2-modal.py
"""
