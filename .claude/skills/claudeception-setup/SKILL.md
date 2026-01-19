---
name: claudeception-setup
description: |
  How to set up Claudeception continuous learning in a project. Use when:
  (1) User asks to install or set up Claudeception
  (2) User wants automatic skill extraction
  (3) "embedded git repository" warning when adding cloned skill repo
  (4) Setting up Claude Code hooks for automation
author: Claude Code
version: 1.0.0
date: 2025-01-19
---

# Claudeception Setup Guide

## Problem

Setting up Claudeception requires multiple steps: cloning the repo, handling the embedded git issue, configuring hooks for automation, and creating project-specific skills.

## Context / Trigger Conditions

- User wants to implement Claudeception
- "warning: adding embedded git repository" error
- Need to set up automatic skill extraction
- Configuring `~/.claude/settings.json` for hooks

## Solution

### Step 1: Clone Claudeception

```bash
# User-level (personal)
git clone https://github.com/blader/Claudeception.git ~/.claude/skills/claudeception

# Project-level (shared with team)
git clone https://github.com/blader/Claudeception.git .claude/skills/claudeception
```

### Step 2: Fix Embedded Git Repository Issue

When adding to a git project, you'll get "embedded git repository" warning. Fix by removing the nested `.git`:

```bash
rm -rf .claude/skills/claudeception/.git
git add .claude/
```

### Step 3: Set Up Automation Hooks (Optional but Recommended)

```bash
mkdir -p ~/.claude/hooks
cp ~/.claude/skills/claudeception/scripts/claudeception-activator.sh ~/.claude/hooks/
chmod +x ~/.claude/hooks/claudeception-activator.sh
```

### Step 4: Configure settings.json

Create or update `~/.claude/settings.json`:

```json
{
  "hooks": {
    "UserPromptSubmit": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "~/.claude/hooks/claudeception-activator.sh"
          }
        ]
      }
    ]
  }
}
```

### Step 5: Create Project-Specific Skill

Create `.claude/skills/[project-name]-architecture/SKILL.md` with project structure and patterns.

## Verification

1. Check skills directory exists: `ls .claude/skills/`
2. Check hook is executable: `ls -la ~/.claude/hooks/`
3. Verify settings.json is valid JSON: `cat ~/.claude/settings.json | jq .`

## Example

**Before**: Claude Code starts fresh each session, relearning the same solutions

**After**: Knowledge accumulates - debugging patterns, project quirks, and workarounds are automatically preserved and surfaced when relevant

## Notes

- User-level skills (`~/.claude/skills/`) work across all projects
- Project-level skills (`.claude/skills/`) are shared with anyone who clones the repo
- The hook triggers on every prompt but only extracts when valuable knowledge is found
- Skills are matched semantically, not by exact command names
