# Deprecated Code

This folder contains code that has been deprecated as of 2026-01-25 during the
transition to the 3-layer architecture.

## Why Deprecated

The PokeDAO system has been restructured into a clean 3-layer architecture:
1. **Layer 1**: Data Collection Workers (pure TypeScript, no LLM)
2. **Layer 2**: Signal Processing (TypeScript + Groq for thesis generation)
3. **Layer 3**: User Interface (Clawdbot Skills + Telegram Bot)

The deprecated code includes legacy ML deployment, training infrastructure, and
unused bot components that are no longer needed in the new architecture.

## Contents

| Folder | Description | Reason Deprecated |
|--------|-------------|-------------------|
| `mew1a/` | MEW-1A custom LLM (Modal Labs + vLLM) | Replaced by Groq API + template-based thesis |
| `mew1a-chat/` | Static HTML chat interface | Not integrated with new architecture |
| `ml/` | ML services and vLLM clients | Functionality moved to `apps/agent/src/processor/` |
| `worker/` | Legacy data harvesting worker | Replaced by `apps/agent/src/workers/` |
| `phase4/` | Old Python implementation | Completely superseded |
| `crew/` | CrewAI Python agent | Not used in production |
| `scripts/` | MEW training/deployment scripts | No longer needed |
| `data/` | Training data for MEW-1A | Model training complete |
| `bot-handlers/` | Old bot handler pattern | Replaced by `bot/src/commands/` |
| `bot-discord/` | Discord bot integration | Low usage (10 imports vs 61 for Telegram) |
| `workers/` | MEW keep-warm worker | Modal deployment deprecated |
| `config/` | Grafana dashboards for MEW | Monitoring deprecated with MEW |

## Can This Code Be Deleted?

Yes, this code can be safely deleted after confirming the new architecture is
stable in production. The code is preserved here for:

1. Historical reference
2. Potential future model training
3. Rollback capability (unlikely needed)

## Migration Notes

### For MEW-1A Functionality
The investment thesis generation has been replaced by:
- **Template-based thesis** (70% of cases) - instant, free
- **Groq LLM thesis** (30% of cases) - ~$0.00014 per call

See `apps/agent/src/processor/thesis-generator.ts` for the new implementation.

### For Data Collection
The old worker package has been replaced by specialized workers:
- `ebay-worker.ts` - eBay sold listings
- `crypto-worker.ts` - Magic Eden, Courtyard
- `reddit-worker.ts` - Reddit sentiment
- `psa-worker.ts` - PSA population data

See `apps/agent/src/workers/` for the new implementations.

### For Bot Commands
The handler pattern has been consolidated into `bot/src/commands/`.
Discord support has been minimized in favor of Telegram + Clawdbot skills.

## Restoring Deprecated Code

If you need to restore any of this code:

```bash
# Move back to active codebase
mv deprecated/mew1a apps/mew1a

# Update workspace in package.json
# Re-install dependencies
pnpm install
```

## Contact

For questions about this deprecation, see the commit history or contact the
PokeDAO development team.
