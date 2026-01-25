#!/bin/bash
# Wrapper script to run Prisma with Node.js 22
# Required due to ESM/CommonJS conflict with zeptomatch in Prisma 7.x
# See: https://github.com/prisma/prisma/issues/25587

# Try NVM first, then fnm
NODE22_PATH="$HOME/.nvm/versions/node/v22.22.0/bin/node"

if [ ! -f "$NODE22_PATH" ]; then
  NODE22_PATH="$HOME/.nvm/versions/node/v22.19.0/bin/node"
fi

if [ ! -f "$NODE22_PATH" ]; then
  NODE22_PATH="$HOME/.fnm/node-versions/v22.22.0/installation/bin/node"
fi

if [ ! -f "$NODE22_PATH" ]; then
  echo "Error: Node.js 22 not found. Install with: nvm install 22 or fnm install 22"
  exit 1
fi

# Find the prisma build directory
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PRISMA_BUILD="$SCRIPT_DIR/../node_modules/prisma/build/index.js"

if [ ! -f "$PRISMA_BUILD" ]; then
  # Try pnpm location
  PRISMA_BUILD=$(find "$SCRIPT_DIR/../node_modules/.pnpm" -name "index.js" -path "*/prisma/build/*" 2>/dev/null | head -1)
fi

if [ ! -f "$PRISMA_BUILD" ]; then
  echo "Error: Prisma build not found"
  exit 1
fi

# Run prisma with Node 22
exec "$NODE22_PATH" "$PRISMA_BUILD" "$@"
