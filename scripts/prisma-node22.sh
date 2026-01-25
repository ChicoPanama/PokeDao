#!/bin/bash
# Run prisma commands with Node.js 22 to avoid ESM/CommonJS conflicts
# Usage: ./scripts/prisma-node22.sh generate
#        ./scripts/prisma-node22.sh migrate dev --name my_migration

NODE22_PATH="$HOME/.nvm/versions/node/v22.22.0/bin"

if [ ! -d "$NODE22_PATH" ]; then
  # Try to find any Node.js 22.x version
  NODE22_PATH=$(ls -d "$HOME/.nvm/versions/node/v22."* 2>/dev/null | head -1)/bin
fi

if [ ! -d "$NODE22_PATH" ]; then
  echo "Error: Node.js 22 not found. Install it with: nvm install 22"
  exit 1
fi

export PATH="$NODE22_PATH:$PATH"
echo "Using Node.js: $(node --version)"

exec ./node_modules/.bin/prisma "$@"
