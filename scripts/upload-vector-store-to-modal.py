#!/usr/bin/env python3
"""
Upload Vector Store to Modal Volume

Uploads FAISS index and metadata to Modal Labs volume for Vector RAG deployment.
"""

import modal

# Create Modal app
app = modal.App("upload-vector-store")

# Reference the volume
vector_store_volume = modal.Volume.from_name("mew1a-vector-store", create_if_missing=True)

@app.function(
    image=modal.Image.debian_slim(python_version="3.11"),
    volumes={"/vector-store": vector_store_volume},
    mounts=[modal.Mount.from_local_dir("data/vector-store", remote_path="/local-vector-store")],
)
def upload_files():
    """Upload vector store files to Modal volume"""
    import shutil
    from pathlib import Path

    print("📤 Uploading vector store files to Modal volume...")

    # Local paths (mounted to /local-vector-store in container)
    local_base = Path("/local-vector-store")
    files_to_upload = [
        "faiss.index",
        "metadata.pkl",
        "cards.json"
    ]

    # Upload each file
    for filename in files_to_upload:
        local_path = local_base / filename
        remote_path = Path("/vector-store") / filename

        if not local_path.exists():
            print(f"  ⚠️  Warning: {local_path} not found, skipping")
            continue

        print(f"  📄 Uploading {filename}...")
        with open(local_path, 'rb') as f:
            data = f.read()

        with open(remote_path, 'wb') as f:
            f.write(data)

        file_size = local_path.stat().st_size / (1024 * 1024)  # MB
        print(f"     ✅ {filename} uploaded ({file_size:.1f} MB)")

    # Commit the volume
    vector_store_volume.commit()

    print("\n✅ Vector store uploaded to Modal volume successfully!")
    print(f"   Volume: mew1a-vector-store")
    print(f"   Files: {', '.join(files_to_upload)}")

@app.local_entrypoint()
def main():
    """Main entry point"""
    print("=" * 80)
    print("UPLOAD VECTOR STORE TO MODAL VOLUME")
    print("=" * 80)
    print()

    upload_files.remote()

    print()
    print("=" * 80)
    print("✅ UPLOAD COMPLETE")
    print("=" * 80)
    print()
    print("Next steps:")
    print("  1. Deploy Vector RAG: modal deploy apps/mew1a/vllm_deploy_vector_rag.py")
    print("  2. Test deployment: modal run apps/mew1a/vllm_deploy_vector_rag.py")
    print()

if __name__ == "__main__":
    main()
