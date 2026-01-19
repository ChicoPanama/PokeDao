---
name: pokedao-architecture
description: |
  PokeDAO project architecture and structure guide. Use when:
  (1) Working on any PokeDAO feature or bug fix
  (2) Need to understand the monorepo structure
  (3) Working with the Telegram bot, ML pipeline, or signal system
  (4) Questions about where to add new functionality
  Key components: Telegram bot (Grammy), ML signals, Prisma DB, Redis cache
author: Claude Code
version: 1.0.0
date: 2025-01-19
---

# PokeDAO Project Architecture

## Problem

PokeDAO is a complex monorepo with multiple apps and packages. Understanding where code lives and how components interact is essential for effective development.

## Context / Trigger Conditions

- Working on any PokeDAO feature
- Adding new bot commands or handlers
- Modifying the ML/signal pipeline
- Debugging cross-package issues
- Understanding data flow

## Solution

### Project Structure

```
pokedao/
├── apps/
│   ├── agent/          # Signal processing agent
│   │   └── src/tick.ts # Main tick loop for signals
│   └── mew1a/          # ML/vLLM deployment
├── bot/                # Telegram bot (Grammy)
│   └── src/
│       ├── index.ts           # Bot entry point
│       ├── commands/          # Bot commands (/start, /wallet, /alerts, etc.)
│       ├── callbacks/         # Callback query handlers
│       ├── alerts/            # Alert formatting and sending
│       ├── middleware/        # Auth, rate limiting
│       └── lib/               # Shared utilities (config, logger, prisma)
├── ml/                 # ML system
│   └── src/alertSystem.ts    # Alert generation from signals
├── packages/           # Shared packages
│   ├── core/           # Core utilities
│   ├── storage/        # Database/storage layer
│   └── analysis/       # Analysis tools
└── prisma/             # Database schema
```

### Key Technologies

- **Bot Framework**: Grammy (Telegram)
- **Database**: Prisma + PostgreSQL
- **Cache**: Redis (ioredis)
- **Logging**: Pino
- **Validation**: Zod
- **Runtime**: Node.js with TypeScript

### Adding New Bot Commands

1. Create command file in `bot/src/commands/[name].ts`
2. Export handler function
3. Register in `bot/src/index.ts` with `bot.command()`

### Adding New Alert Types

1. Define alert structure in `ml/src/alertSystem.ts`
2. Add formatter in `bot/src/alerts/formatter.ts`
3. Update sender logic in `bot/src/alerts/sender.ts`

## Verification

- Run `pnpm typecheck` from root to verify types
- Run `pnpm dev` in bot/ to test bot locally
- Check logs with pino-pretty for debugging

## Notes

- This is a pnpm workspace monorepo
- Use workspace dependencies: `@pokedao/core`, `@pokedao/storage`, `@pokedao/analysis`
- Environment variables defined in `.env.example`
- Deployed via render.yaml configuration
