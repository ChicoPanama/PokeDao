#!/usr/bin/env bash
set -euo pipefail

echo "1) Building scripts to dist/scripts"
pnpm run build:scripts

echo "2) Checking compiled scripts in dist/scripts"
ls -la ./dist/scripts || echo "No dist/scripts found"

echo "3) Running the env self-test from dist"
if [ -f ./dist/scripts/validate-env-selftest.js ]; then
  node ./dist/scripts/validate-env-selftest.js || echo "Self-test failed (expected if env vars not set)"
else
  echo "No compiled selftest found"
fi

echo "dev-check finished"