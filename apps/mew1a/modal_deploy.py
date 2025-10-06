"""
MEW-1A MODAL LABS DEPLOYMENT
Serverless GPU inference for Pokemon TCG pricing model
"""

import modal

# Create Modal app
app = modal.App("mew1a-tcg-pricing")

# Define GPU image with all dependencies
image = (
    modal.Image.debian_slim(python_version="3.11")
    .pip_install(
        "transformers==4.47.1",
        "torch==2.6.0",
        "peft==0.14.0",
        "accelerate==1.2.1",
        "huggingface-hub==0.27.1",
        "fastapi==0.115.0",  # Required for web endpoints
    )
)

# GPU configuration - T4 is cheapest, good for 3B models
GPU_CONFIG = "T4"

@app.cls(
    image=image,
    gpu=GPU_CONFIG,
    secrets=[modal.Secret.from_name("huggingface-secret")],
    scaledown_window=300,  # Keep warm for 5 min
)
class Mew1AModel:
    def download_model(self):
        """Download model during build phase"""
        from transformers import AutoModelForCausalLM, AutoTokenizer
        from peft import PeftModel
        import os

        # Get HuggingFace token
        hf_token = os.environ.get("HUGGINGFACE_TOKEN")

        print("📥 Downloading base model...")
        base_model = AutoModelForCausalLM.from_pretrained(
            "meta-llama/Llama-3.2-3B-Instruct",
            token=hf_token,
            device_map="auto",
            torch_dtype="auto",
        )

        print("📥 Downloading Mew-1A LoRA adapters...")
        model = PeftModel.from_pretrained(
            base_model,
            "ChicoPanama/mew1a-llama-3.2-3b-tcg-pricing",
            token=hf_token,
        )

        print("📥 Downloading tokenizer...")
        tokenizer = AutoTokenizer.from_pretrained(
            "ChicoPanama/mew1a-llama-3.2-3b-tcg-pricing",
            token=hf_token,
        )

        print("✅ Model download complete!")

    @modal.enter()
    def load_model(self):
        """Load model into GPU memory on container start"""
        from transformers import AutoModelForCausalLM, AutoTokenizer
        from peft import PeftModel
        import torch
        import os

        hf_token = os.environ.get("HUGGINGFACE_TOKEN")

        print("🚀 Loading Mew-1A into GPU...")

        # Load base model
        base_model = AutoModelForCausalLM.from_pretrained(
            "meta-llama/Llama-3.2-3B-Instruct",
            token=hf_token,
            device_map="auto",
            torch_dtype=torch.bfloat16,
        )

        # Load LoRA adapters
        self.model = PeftModel.from_pretrained(
            base_model,
            "ChicoPanama/mew1a-llama-3.2-3b-tcg-pricing",
            token=hf_token,
        )

        # Load tokenizer
        self.tokenizer = AutoTokenizer.from_pretrained(
            "ChicoPanama/mew1a-llama-3.2-3b-tcg-pricing",
            token=hf_token,
        )

        # Set padding token
        if self.tokenizer.pad_token is None:
            self.tokenizer.pad_token = self.tokenizer.eos_token

        print("✅ Mew-1A loaded and ready!")

    @modal.method()
    def analyze(self, prompt: str, max_tokens: int = 200) -> dict:
        """
        Analyze Pokemon TCG card opportunity

        Args:
            prompt: Analysis prompt with card details
            max_tokens: Maximum tokens to generate

        Returns:
            dict with 'response' and 'tokens' keys
        """
        import torch
        import time

        start = time.time()

        # Tokenize
        inputs = self.tokenizer(
            prompt,
            return_tensors="pt",
            padding=True,
            truncation=True,
            max_length=512,
        ).to(self.model.device)

        # Generate
        with torch.no_grad():
            outputs = self.model.generate(
                **inputs,
                max_new_tokens=max_tokens,
                temperature=0.3,
                top_p=0.9,
                do_sample=True,
                pad_token_id=self.tokenizer.pad_token_id,
            )

        # Decode
        response = self.tokenizer.decode(
            outputs[0][inputs.input_ids.shape[1]:],
            skip_special_tokens=True,
        )

        inference_time = time.time() - start

        return {
            "response": response.strip(),
            "tokens": outputs[0].shape[0] - inputs.input_ids.shape[1],
            "inference_time": inference_time,
        }

# Web endpoint (FastAPI)
@app.function(
    image=image,
    secrets=[modal.Secret.from_name("huggingface-secret")],
)
@modal.fastapi_endpoint(method="POST")
def analyze_card(data: dict):
    """
    HTTP endpoint for card analysis

    POST /analyze_card
    Body: {"prompt": "...", "max_tokens": 200}
    """
    prompt = data.get("prompt", "")
    max_tokens = data.get("max_tokens", 200)

    if not prompt:
        return {"error": "Missing 'prompt' field"}, 400

    # Call the model
    model = Mew1AModel()
    result = model.analyze.remote(prompt, max_tokens)

    return result
