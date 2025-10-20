#!/usr/bin/env python3
"""
MEW-1A GGUF CONVERSION SCRIPT
Convert Mew-1A model to GGUF format for local Ollama inference

This allows you to run Mew-1A locally on your Mac with no cloud costs!

Requirements:
    pip install llama-cpp-python transformers huggingface-hub

Usage:
    python3 scripts/convert-to-gguf.py --model v4.2
    python3 scripts/convert-to-gguf.py --model v1
"""

import os
import sys
import argparse
import subprocess
from pathlib import Path

# Configuration
MODEL_CONFIGS = {
    "v1": {
        "hf_repo": "ChicoPanama/mew1a-llama-3.2-3b-tcg-pricing",
        "output_name": "mew1a-v1-3b",
        "is_lora": True,  # v1 is LoRA only, needs merging first
    },
    "v4.2": {
        "hf_repo": "ChicoPanama/mew1a-v4.2-merged-llama-3.2-3b-pokemon-tcg",
        "output_name": "mew1a-v4.2-3b",
        "is_lora": False,  # v4.2 will be merged model
    },
}

# Quantization options (from smallest to largest)
QUANTIZATION_LEVELS = {
    "Q2_K": "Smallest, lowest quality (1.5 GB)",
    "Q3_K_M": "Small, good quality (2.0 GB)",
    "Q4_K_M": "Medium, very good quality (2.5 GB) - RECOMMENDED",
    "Q5_K_M": "Large, excellent quality (3.0 GB)",
    "Q6_K": "Very large, near-original quality (3.5 GB)",
    "Q8_0": "Largest, highest quality (4.0 GB)",
}

def print_header(text):
    print("\n" + "=" * 80)
    print(text)
    print("=" * 80 + "\n")

def print_step(text):
    print(f"✓ {text}")

def print_error(text):
    print(f"✗ {text}")

def check_prerequisites():
    """Check if required tools are installed"""
    print_header("CHECKING PREREQUISITES")

    # Check llama.cpp
    llama_cpp_dir = Path.home() / "llama.cpp"
    if not llama_cpp_dir.exists():
        print_error("llama.cpp not found")
        print("\nInstalling llama.cpp...")
        print("This will download and build llama.cpp (~5 minutes)")

        # Clone llama.cpp
        subprocess.run([
            "git", "clone", "https://github.com/ggerganov/llama.cpp.git",
            str(llama_cpp_dir)
        ], check=True)

        # Build llama.cpp
        subprocess.run(["make"], cwd=llama_cpp_dir, check=True)

        print_step("llama.cpp installed")
    else:
        print_step("llama.cpp found")

    # Check Python dependencies
    try:
        import transformers
        import huggingface_hub
        print_step("Python dependencies installed")
    except ImportError:
        print_error("Missing Python dependencies")
        print("\nInstalling dependencies...")
        subprocess.run([
            "pip", "install", "transformers", "huggingface-hub", "sentencepiece"
        ], check=True)
        print_step("Dependencies installed")

    return llama_cpp_dir

def download_model(hf_repo, output_dir):
    """Download model from HuggingFace"""
    print_header(f"DOWNLOADING MODEL: {hf_repo}")

    from huggingface_hub import snapshot_download

    hf_token = os.environ.get("HUGGINGFACE_TOKEN")

    model_path = snapshot_download(
        repo_id=hf_repo,
        local_dir=output_dir,
        token=hf_token,
    )

    print_step(f"Model downloaded to {output_dir}")
    return model_path

def convert_to_gguf(model_dir, output_file, llama_cpp_dir):
    """Convert HuggingFace model to GGUF format"""
    print_header("CONVERTING TO GGUF FORMAT")

    convert_script = llama_cpp_dir / "convert_hf_to_gguf.py"

    if not convert_script.exists():
        # Older llama.cpp versions use different script name
        convert_script = llama_cpp_dir / "convert.py"

    print(f"Running conversion script: {convert_script}")
    print(f"Input: {model_dir}")
    print(f"Output: {output_file}")
    print("\nThis may take 5-10 minutes...\n")

    subprocess.run([
        "python3",
        str(convert_script),
        str(model_dir),
        "--outfile", str(output_file),
        "--outtype", "f16",  # FP16 precision
    ], check=True)

    print_step(f"GGUF file created: {output_file}")

def quantize_model(input_file, output_file, quant_type, llama_cpp_dir):
    """Quantize GGUF model"""
    print_header(f"QUANTIZING TO {quant_type}")

    print(f"Input: {input_file}")
    print(f"Output: {output_file}")
    print(f"Quantization: {QUANTIZATION_LEVELS[quant_type]}")
    print("\nThis may take 3-5 minutes...\n")

    quantize_bin = llama_cpp_dir / "llama-quantize"

    subprocess.run([
        str(quantize_bin),
        str(input_file),
        str(output_file),
        quant_type,
    ], check=True)

    print_step(f"Quantized model created: {output_file}")

def create_modelfile(model_path, output_name):
    """Create Ollama Modelfile"""
    print_header("CREATING OLLAMA MODELFILE")

    modelfile_content = f"""FROM {model_path}

TEMPLATE """Below is an instruction that describes a task. Write a response that appropriately completes the request.

### Instruction:
{{{{ .Prompt }}}}

### Response:
"""

PARAMETER temperature 0.3
PARAMETER top_p 0.9
PARAMETER stop "### Instruction:"
PARAMETER stop "### Response:"

SYSTEM You are Mew-1A, an expert Pokemon TCG investment advisor trained on 500K+ market examples.
"""

    modelfile_path = Path(f"Modelfile.{output_name}")
    modelfile_path.write_text(modelfile_content)

    print_step(f"Modelfile created: {modelfile_path}")
    print("\nModelfile contents:")
    print("-" * 80)
    print(modelfile_content)
    print("-" * 80)

    return modelfile_path

def create_ollama_model(modelfile, model_name):
    """Create Ollama model from Modelfile"""
    print_header(f"CREATING OLLAMA MODEL: {model_name}")

    print("Running: ollama create...")
    print("This registers the model with Ollama for easy usage.\n")

    try:
        subprocess.run([
            "ollama", "create", model_name, "-f", str(modelfile)
        ], check=True)

        print_step(f"Ollama model created: {model_name}")
        return True
    except subprocess.CalledProcessError:
        print_error("Failed to create Ollama model")
        print("Make sure Ollama is installed: https://ollama.ai")
        return False

def main():
    parser = argparse.ArgumentParser(description="Convert Mew-1A to GGUF/Ollama format")
    parser.add_argument(
        "--model",
        choices=["v1", "v4.2"],
        required=True,
        help="Model version to convert"
    )
    parser.add_argument(
        "--quant",
        choices=list(QUANTIZATION_LEVELS.keys()),
        default="Q4_K_M",
        help="Quantization level (default: Q4_K_M - recommended)"
    )
    parser.add_argument(
        "--skip-download",
        action="store_true",
        help="Skip download if model already exists locally"
    )

    args = parser.parse_args()

    config = MODEL_CONFIGS[args.model]

    print_header("MEW-1A GGUF CONVERSION")
    print(f"Model: {args.model}")
    print(f"HuggingFace: {config['hf_repo']}")
    print(f"Quantization: {args.quant} - {QUANTIZATION_LEVELS[args.quant]}")

    # Setup paths
    work_dir = Path("./gguf-conversion")
    work_dir.mkdir(exist_ok=True)

    model_dir = work_dir / config['output_name']
    gguf_f16 = work_dir / f"{config['output_name']}-f16.gguf"
    gguf_quant = work_dir / f"{config['output_name']}-{args.quant}.gguf"

    # Step 1: Check prerequisites
    llama_cpp_dir = check_prerequisites()

    # Step 2: Handle LoRA models (v1)
    if config['is_lora']:
        print_error("v1 is LoRA-only and needs merging first!")
        print("\nOptions:")
        print("1. Wait for v4.2 training to complete (merged model)")
        print("2. Manually merge v1 LoRA using merge-lora-v4.2.py script")
        print("3. Use existing Modal deployment for v1")
        sys.exit(1)

    # Step 3: Download model
    if not args.skip_download or not model_dir.exists():
        download_model(config['hf_repo'], model_dir)
    else:
        print_step(f"Using existing model at {model_dir}")

    # Step 4: Convert to GGUF (FP16)
    if not gguf_f16.exists():
        convert_to_gguf(model_dir, gguf_f16, llama_cpp_dir)
    else:
        print_step(f"Using existing FP16 GGUF: {gguf_f16}")

    # Step 5: Quantize
    if not gguf_quant.exists():
        quantize_model(gguf_f16, gguf_quant, args.quant, llama_cpp_dir)
    else:
        print_step(f"Using existing quantized GGUF: {gguf_quant}")

    # Step 6: Create Modelfile
    modelfile = create_modelfile(gguf_quant.absolute(), config['output_name'])

    # Step 7: Create Ollama model (optional)
    ollama_name = f"mew1a:{args.model.replace('.', '')}-{args.quant.lower()}"
    ollama_created = create_ollama_model(modelfile, ollama_name)

    # Summary
    print_header("✅ CONVERSION COMPLETE!")

    print(f"📁 GGUF Model: {gguf_quant}")
    print(f"📊 File Size: {gguf_quant.stat().st_size / (1024**3):.2f} GB")
    print(f"🎯 Quantization: {args.quant} - {QUANTIZATION_LEVELS[args.quant]}")

    if ollama_created:
        print(f"\n🚀 Ollama Model: {ollama_name}")
        print("\n" + "=" * 80)
        print("USAGE WITH OLLAMA")
        print("=" * 80)
        print(f"\n# Run the model:")
        print(f"ollama run {ollama_name}")
        print(f"\n# Test with a prompt:")
        print(f'ollama run {ollama_name} "Analyze: Charizard ex from Obsidian Flames listed at $45, fair value $52"')
        print(f"\n# Use in code:")
        print(f"curl http://localhost:11434/api/generate -d '{{")
        print(f'  "model": "{ollama_name}",')
        print(f'  "prompt": "Analyze: Pikachu VMAX"')
        print(f"}}'")
    else:
        print("\n⚠️  Ollama model creation skipped (Ollama not installed)")
        print("\nYou can still use the GGUF file directly with llama.cpp:")
        print(f"  {llama_cpp_dir}/llama-cli -m {gguf_quant} -p 'Analyze: Charizard ex'")

    print("\n" + "=" * 80)
    print("NEXT STEPS")
    print("=" * 80)
    print("\n1. Test the model locally (no cloud costs!)")
    print("2. Compare inference speed vs Modal deployment")
    print("3. Use for development/testing without API calls")
    print("4. Build local NanoChat UI for interactive testing")

    print("\n✅ Ready for local inference!\n")

if __name__ == "__main__":
    main()
