#!/usr/bin/env python3
"""Replace Mermaid diagram with ASCII art in README"""

import re

# Read current README
with open('README.md', 'r') as f:
    content = f.read()

# Find and replace the Mermaid diagram with ASCII art
mermaid_pattern = r'```mermaid\n.*?```'

ascii_diagram = '''```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          POKEDAO SYSTEM OVERVIEW                             │
└─────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────┐
│  📦 DATA SOURCES (9 Marketplaces)                                        │
│  ─────────────────────────────────────────────────────────────────────   │
│  • eBay (22,376 listings)        • Courtyard (33,266 NFTs)              │
│  • JustTCG (2,428 listings)      • Phygitals (20,487 NFTs)              │
│  • Collector Crypt (17,763)      • TCGdex Layer 0 (21,627 official)     │
└──────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  🗄️  DATA LAKEHOUSE (Medallion Architecture)                            │
│  ─────────────────────────────────────────────────────────────────────   │
│                                                                           │
│  [Bronze Layer]  ──▶  [Silver Layer]  ──▶  [Gold Layer]                 │
│   Raw Parquet        Normalized          TFV/Liquidity                   │
│   SHA256 Hashes      Deduplicated        Aggregations                    │
│                                                                           │
└──────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  ⚡ ANALYSIS ENGINE                                                       │
│  ─────────────────────────────────────────────────────────────────────   │
│  • True Fair Value (TFV) - Weighted consensus pricing                    │
│  • Liquidity Metrics - Sales velocity, days-to-clear                     │
│  • Opportunity Score - Risk-adjusted discount detection                  │
└──────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  🧠 AI ENSEMBLE                                                           │
│  ─────────────────────────────────────────────────────────────────────   │
│  • Mew-1A (TCG Specialist) - 10k examples, Llama-3.2-3B fine-tuned       │
│  • DeepSeek R1 (Deep Reasoning) - Multi-step analysis                    │
└──────────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    │               │               │
                    ▼               ▼               ▼
        ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
        │   PokeDex    │ │ PokeStrategy │ │  X/Twitter   │
        │    Signal    │ │  On-Chain    │ │   Public     │
        │    Engine    │ │    Vault     │ │   Signals    │
        └──────────────┘ └──────────────┘ └──────────────┘
                            │
                            │ Executes on
                            ▼
                ┌───────────────────────────┐
                │   NFT Marketplaces        │
                │  • Phygitals              │
                │  • Collector Crypt        │
                │  • Courtyard              │
                └───────────────────────────┘

KEY:
─── Data Flow          ▶ Transformation          │ Pipeline Stage
```'''

# Replace Mermaid with ASCII
content = re.sub(mermaid_pattern, ascii_diagram, content, flags=re.DOTALL)

# Write updated README
with open('README.md', 'w') as f:
    f.write(content)

print("✅ README updated with ASCII diagram!")
print("  - Replaced Mermaid with clean ASCII art")
print("  - Shows complete data flow from sources to products")
print("\nNext: git add README.md && git commit && git push")
