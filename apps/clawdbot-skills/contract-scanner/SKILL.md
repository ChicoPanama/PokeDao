---
name: contract-scanner
description: Autonomous smart contract vulnerability scanner for DeFi protocols
metadata: {"clawdbot":{"requires":{"bins":["slither","node"],"env":["ETHERSCAN_API_KEY","TELEGRAM_BOT_TOKEN"]},"primaryEnv":"ETHERSCAN_API_KEY","emoji":"🔍"}}
---

## Instructions

Scan smart contracts for vulnerabilities using Slither static analysis and AI-augmented review.

When triggered, discover high-TVL DeFi protocols via DeFiLlama, fetch verified contract source
code from Etherscan V2 API (multi-chain), run Slither analysis, enrich findings with AI,
and send alerts via Telegram for critical/high severity findings.

### Capabilities

- **Multi-chain scanning** across Ethereum, Base, Arbitrum, Polygon, and Optimism
- **TVL-based prioritization** using DeFiLlama protocol data
- **Slither static analysis** with ~10.9% false positive rate
- **AI enrichment** via Groq/DeepSeek for false positive filtering and attack path analysis
- **Severity-based alerting** with 24-hour deduplication
- **Responsible disclosure** practices (never tests vulnerabilities on mainnet)

### Supported Commands

- `scan <address> [chain]` - Scan a specific contract address on a chain
- `status` - Show scanner health and recent scan results
- `findings <scanId>` - Show detailed findings for a scan
- `subscribe` - Subscribe to scanner alerts
- `unsubscribe` - Unsubscribe from alerts

### Alert Severity Levels

- **CRITICAL** - Reentrancy, delegatecall injection, selfdestruct
- **HIGH** - Access control, unchecked returns, oracle manipulation
- **MEDIUM** - Centralization risks, timestamp dependence
- **LOW** - Code style, gas optimization
