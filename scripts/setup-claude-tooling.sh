#!/bin/bash
# Setup script for Claude Code plugins and MCP servers
# Run this script after installing Claude Code CLI

set -e

echo "=== PokeDAO Claude Code Tooling Setup ==="
echo ""

# Check if claude CLI is available
if ! command -v claude &> /dev/null; then
    echo "Error: Claude Code CLI not found"
    echo "Install it first: npm install -g @anthropic/claude-code"
    exit 1
fi

echo "Claude Code version: $(claude --version)"
echo ""

# Install plugins
echo "=== Installing Plugins ==="

echo "1. Installing claude-hud (context visualization)..."
claude plugin install claude-hud || echo "  - claude-hud may already be installed or unavailable"

echo "2. Installing tdd-guard (TDD enforcement)..."
claude plugin install tdd-guard || echo "  - tdd-guard may already be installed or unavailable"

echo "3. Installing claude-code-safety-net (command protection)..."
claude plugin install claude-code-safety-net || echo "  - claude-code-safety-net may already be installed or unavailable"

echo ""

# Configure MCP servers
echo "=== Configuring MCP Servers ==="

# Check for DATABASE_URL
if [ -z "$DATABASE_URL" ]; then
    echo "Warning: DATABASE_URL not set. PostgreSQL MCP server will need manual configuration."
    echo "Set DATABASE_URL in .env and re-run this script."
else
    echo "1. Adding PostgreSQL MCP server..."
    claude mcp add --scope project postgres -- npx -y @modelcontextprotocol/server-postgres "$DATABASE_URL" || echo "  - PostgreSQL MCP may already be configured"
fi

# GitHub MCP
if [ -z "$GITHUB_TOKEN" ]; then
    echo "Warning: GITHUB_TOKEN not set. GitHub MCP server will need manual configuration."
else
    echo "2. Adding GitHub MCP server..."
    claude mcp add --scope project github -- npx -y @modelcontextprotocol/server-github || echo "  - GitHub MCP may already be configured"
fi

# Redis MCP
if [ -z "$REDIS_URL" ]; then
    echo "Warning: REDIS_URL not set. Redis MCP server will be skipped."
else
    echo "3. Adding Redis MCP server..."
    claude mcp add --scope project redis -- npx -y @modelcontextprotocol/server-redis "$REDIS_URL" || echo "  - Redis MCP may already be configured"
fi

echo ""
echo "=== Verifying Configuration ==="

echo "Installed plugins:"
claude plugin list || echo "Unable to list plugins"

echo ""
echo "Configured MCP servers:"
claude mcp list || echo "Unable to list MCP servers"

echo ""
echo "=== Setup Complete ==="
echo ""
echo "Next steps:"
echo "1. Ensure .env has DATABASE_URL, REDIS_URL, and GITHUB_TOKEN set"
echo "2. Run 'claude' in the project directory to start coding"
echo "3. Try: 'claude \"Describe the Signal table schema\"' to test PostgreSQL MCP"
echo "4. See CLAUDE.md for project-specific context"
