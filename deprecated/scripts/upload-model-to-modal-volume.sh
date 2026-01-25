#!/bin/bash
# Upload merged model to Modal volume for deployment
# This bypasses the need for HuggingFace

set -e

echo "======================================================================"
echo "📤 UPLOADING MEW-1A v4.3 TO MODAL VOLUME"
echo "======================================================================"
echo ""

# Check if merged model exists on RunPod
echo "🔍 Checking for merged model on RunPod..."
ssh root@194.68.245.86 -p 22025 -i ~/.ssh/id_ed25519 "ls -lh /workspace/pokedao/mew1a-v4.3-merged/"

echo ""
echo "📦 Creating Modal volume for model storage..."
modal volume create mew1a-v4.3-model || echo "Volume may already exist"

echo ""
echo "📤 Uploading model to Modal volume..."
echo "   (This uses Modal's direct upload from RunPod)"
echo ""

# Create script to upload from RunPod to Modal
cat > /tmp/upload-to-modal.py << 'EOF'
import modal

app = modal.App("upload-v4.3")
volume = modal.Volume.from_name("mew1a-v4.3-model", create_if_missing=True)

@app.function(volumes={"/model": volume})
def upload_model():
    import subprocess
    import os

    print("Copying model files to Modal volume...")
    subprocess.run([
        "cp", "-r",
        "/workspace/pokedao/mew1a-v4.3-merged/",
        "/model/mew1a-v4.3/"
    ], check=True)

    print("✅ Upload complete!")
    volume.commit()

if __name__ == "__main__":
    with app.run():
        upload_model.remote()
EOF

echo "Running upload script..."
scp -P 22025 -i ~/.ssh/id_ed25519 /tmp/upload-to-modal.py root@194.68.245.86:/workspace/pokedao/
ssh root@194.68.245.86 -p 22025 -i ~/.ssh/id_ed25519 "cd /workspace/pokedao && modal run upload-to-modal.py"

echo ""
echo "======================================================================"
echo "🎉 UPLOAD COMPLETE!"
echo "======================================================================"
echo "Model is now available in Modal volume: mew1a-v4.3-model"
echo "Next: Deploy to Modal Labs"
echo "======================================================================"
