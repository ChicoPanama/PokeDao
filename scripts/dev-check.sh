#!/usr/bin/env bash
set -euo pipefail

echo "1) Ensure no compiled .js files remain tracked under /scripts"
if git ls-files --error-unmatch scripts/*.js > /dev/null 2>&1; then
	echo "Found tracked scripts/*.js — removing from index..."
	git rm --cached --ignore-unmatch scripts/*.js || true
	echo "Please commit the removal with a descriptive message."
else
	echo "No tracked scripts/*.js found."
fi

echo "2) Build TypeScript into ./dist"
pnpm run build

echo "3) Check compiled scripts in dist/scripts"
ls -la ./dist/scripts || true

echo "4) Run the env self-test from dist"
if [ -f ./dist/scripts/validate-env-selftest.js ]; then
	node ./dist/scripts/validate-env-selftest.js || true
else
	echo "No compiled selftest found; ensure TypeScript build emitted files."
fi

echo "dev-check finished"
