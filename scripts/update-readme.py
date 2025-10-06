#!/usr/bin/env python3
"""Apply README updates from docs/README_FINAL_UPDATES.md"""

import re

# Read current README
with open('README.md', 'r') as f:
    content = f.read()

# 1. Fix PokeStrategy - remove warehouse, add on-chain details
content = content.replace(
    "- Manages physical custody through verified warehouses",
    "- Manages tokenized Pokemon card assets on-chain\n- Fully on-chain settlement and custody (no physical warehouses)"
)

content = content.replace(
    "- Executes buys/sells via integrated APIs (Phygitals, Collector Crypt)",
    "- Executes buys/sells via integrated NFT marketplaces (Phygitals, Collector Crypt, Courtyard)"
)

content = content.replace(
    "On-chain transparency builds institutional credibility.",
    "On-chain transparency and tokenized custody eliminate counterparty risk."
)

# 2. Add System Overview diagram after "Three Core Products"
system_overview = '''
---

## System Overview

```mermaid
graph TB
    subgraph Sources[📦 Data Sources - 9 Marketplaces]
        direction LR
        eBay[eBay<br/>22,376 listings]
        JustTCG[JustTCG<br/>2,428 listings]
        CC[Collector Crypt<br/>17,763 cards]
        Courtyard[Courtyard<br/>33,266 NFTs]
        Phygitals[Phygitals<br/>20,487 NFTs]
        TCGdex[TCGdex Layer 0<br/>21,627 official cards]
    end

    subgraph Lakehouse[🗄️ Data Lakehouse]
        Bronze[Bronze<br/>Raw Parquet]
        Silver[Silver<br/>Normalized]
        Gold[Gold<br/>TFV/Liquidity]
    end

    subgraph Analysis[⚡ Analysis Engine]
        TFV[True Fair Value<br/>Weighted Consensus]
        Liq[Liquidity Metrics<br/>Sales Velocity]
        Opp[Opportunity Score<br/>Risk-Adjusted]
    end

    subgraph AI[🧠 AI Ensemble]
        Mew[Mew-1A<br/>TCG Specialist<br/>10k examples]
        Deep[DeepSeek R1<br/>Deep Reasoning]
    end

    subgraph Products[🎯 Three Products]
        PokeDex[PokeDex<br/>Signal Engine]
        Strategy[PokeStrategy<br/>On-Chain Vault]
        Twitter[X/Twitter<br/>Public Signals]
    end

    Sources --> Bronze
    Bronze --> Silver
    Silver --> Gold
    Gold --> Analysis
    Analysis --> AI
    AI --> PokeDex
    PokeDex --> Twitter
    PokeDex --> Strategy
    Strategy -.Executes.-> Phygitals
    Strategy -.Executes.-> CC
    Strategy -.Executes.-> Courtyard

    style Mew fill:#ff6b6b,color:#fff
    style PokeDex fill:#4ecdc4,color:#fff
    style Strategy fill:#ffe66d,color:#000
    style Gold fill:#ffd700,color:#000
```

'''

# Insert after the PokeStrategy value proposition
content = content.replace(
    "On-chain transparency and tokenized custody eliminate counterparty risk.\n\n---\n\n## Why This Matters",
    f"On-chain transparency and tokenized custody eliminate counterparty risk.\n{system_overview}\n## Why This Matters"
)

# Write updated README
with open('README.md', 'w') as f:
    f.write(content)

print("✅ README updated successfully!")
print("  - Fixed PokeStrategy (removed warehouse, added on-chain details)")
print("  - Added System Overview diagram")
print("\nNext: git add README.md && git commit && git push")
