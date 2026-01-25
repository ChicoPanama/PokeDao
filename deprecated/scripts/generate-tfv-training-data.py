#!/usr/bin/env python3
"""
Generate additional training examples for v4.3.1 LoRA patch.
Adds 80 more examples (30 TFV + 50 BUY/PASS) to existing 120.
"""

import json
import random

# Additional 30 TFV terminology examples
tfv_examples = [
    ("Define TFV", "TFV (True Fair Value) is an estimated market-clearing price for a Pokemon card based on recent normalized sales data."),
    ("What is TFV short for?", "TFV is short for True Fair Value, a pricing metric used in Pokemon TCG to estimate fair market value."),
    ("TFV vs listing price?", "TFV is estimated market value; listing price is seller's asking price. Compare them to find discounts or premiums."),
    ("Can TFV be wrong?", "Yes, TFV is an estimate based on data. It can be wrong due to data lags, low sample size, or market volatility."),
    ("Does TFV include tax?", "No, TFV is card value only. Sales tax, shipping, and fees are separate costs to account for."),
    ("TFV for sealed products?", "TFV primarily applies to singles. For sealed products, use 'market price' metrics based on sealed sales data."),
    ("Is TFV live pricing?", "TFV updates as new sales occur but isn't real-time. Expect lag of hours to days depending on card trading volume."),
    ("What affects TFV accuracy?", "TFV accuracy depends on: sales volume, data recency, market stability, and quality of price normalization."),
    ("TFV vs buylist price?", "Buylist prices are typically 40-60% of TFV. Buylist needs margin to resell at TFV profitably."),
    ("Can I sell at TFV?", "Selling at exactly TFV can be difficult. Most sales occur at ±10% of TFV depending on urgency and platform."),
    ("TFV for Japanese cards?", "Japanese cards have separate TFV from English. Market demand and collector base differ by language."),
    ("Does TFV predict trends?", "TFV shows current value, not future. However, TFV trends over time can indicate market direction."),
    ("TFV for error cards?", "Error cards have their own TFV, often higher than corrected versions due to scarcity and collector interest."),
    ("Is TFV the same as eBay sold?", "TFV often uses eBay sold data but may normalize (remove outliers, weight recent sales) for accuracy."),
    ("TFV reliability threshold?", "TFV is most reliable with 10+ sales in past 30 days. Below that, treat as rough estimate only."),
    ("Can TFV spike suddenly?", "Yes. TFV can spike from hype, tournament results, or supply shocks. Spikes often correct downward."),
    ("TFV for pre-release cards?", "Pre-release cards have separate TFV from regular release due to different stamping and limited availability."),
    ("Does TFV include cert fees?", "No. Grading/authentication fees are separate. TFV is market value of graded card, not cost to grade."),
    ("TFV margin of error?", "Typical TFV margin of error is ±10-15% depending on data quality and market volatility."),
    ("Can raw cards have TFV?", "Yes. Raw (ungraded) cards have separate TFV from graded versions, usually lower due to condition uncertainty."),
    ("TFV for promos?", "Promotional cards have separate TFV based on their distribution method and scarcity."),
    ("Is TFV weighted by volume?", "Good TFV calculations weight recent sales more heavily and may weight higher-volume sales."),
    ("TFV for tournament prizes?", "Tournament prize cards often have premium TFV due to limited distribution and collector demand."),
    ("Does TFV change daily?", "TFV can change daily for high-volume cards. Low-volume cards may have static TFV for weeks."),
    ("TFV for damaged cards?", "Heavily damaged cards typically sell at 10-30% of NM TFV. Damage reduces TFV significantly."),
    ("Can TFV be gamed?", "TFV can be temporarily manipulated by fake sales or wash trading, but reputable sources filter these out."),
    ("TFV vs PWCC index?", "PWCC and other indices are similar to TFV (market-based pricing) but may use different data sources or methodologies."),
    ("Is TFV updated manually?", "TFV is typically auto-calculated from sales data feeds. Manual updates are rare and only for data corrections."),
    ("TFV for cards with no sales?", "Cards with zero recent sales lack TFV estimates. Use comparable cards or older price data as proxy."),
    ("Does TFV factor in playability?", "TFV reflects playability indirectly through demand. Meta cards see higher TFV due to competitive player demand."),
]

# 50 BUY/PASS regression tests (ensuring existing logic not broken)
buy_pass_examples = []

# Generate varied BUY/PASS examples
cards = [
    "Charizard ex", "Pikachu VMAX", "Mewtwo ex", "Lugia ex", "Gengar VMAX",
    "Rayquaza VMAX", "Umbreon VMAX", "Espeon VMAX", "Sylveon VMAX", "Glaceon VMAX",
    "Leafeon VMAX", "Flareon VMAX", "Jolteon VMAX", "Vaporeon VMAX", "Eevee VMAX",
    "Dragonite VSTAR", "Giratina VSTAR", "Arceus VSTAR", "Dialga VSTAR", "Palkia VSTAR",
    "Mew ex", "Genesect VMAX", "Zapdos ex", "Articuno ex", "Moltres ex"
]

# Generate 25 BUY scenarios (listed < TFV)
for i in range(25):
    card = random.choice(cards)
    tfv = random.randint(30, 100)
    discount = random.uniform(0.10, 0.25)  # 10-25% discount
    listed = int(tfv * (1 - discount))
    discount_pct = int(discount * 100)

    buy_pass_examples.append(
        (f"{card} listed ${listed}, TFV ${tfv}. Buy or pass?",
         f"BUY. Listed price (${listed}) is {discount_pct}% below TFV (${tfv}), indicating a discount opportunity. Recommendation: Buy if condition and authenticity verified, accounting for fees.")
    )

# Generate 25 PASS scenarios (listed > TFV or listed ≈ TFV)
for i in range(25):
    card = random.choice(cards)
    tfv = random.randint(30, 100)

    if i < 15:  # 15 clear PASS (overpriced)
        premium = random.uniform(0.15, 0.35)  # 15-35% premium
        listed = int(tfv * (1 + premium))
        premium_pct = int(premium * 100)
        buy_pass_examples.append(
            (f"{card} listed ${listed}, TFV ${tfv}. Buy or pass?",
             f"PASS. Listed price (${listed}) is {premium_pct}% ABOVE TFV (${tfv}), indicating overpricing. Unless you urgently need this card, wait for better pricing or negotiate down.")
        )
    else:  # 10 NEUTRAL/marginal scenarios
        diff = random.uniform(-0.05, 0.08)  # -5% to +8%
        listed = int(tfv * (1 + diff))

        if diff < 0:
            discount_pct = abs(int(diff * 100))
            buy_pass_examples.append(
                (f"{card} listed ${listed}, TFV ${tfv}. Buy or pass?",
                 f"NEUTRAL/BUY. Listed is {discount_pct}% below TFV, a modest discount. If you need the card, buy now. If not urgent, could wait for larger discount.")
            )
        else:
            premium_pct = int(diff * 100)
            buy_pass_examples.append(
                (f"{card} listed ${listed}, TFV ${tfv}. Buy or pass?",
                 f"NEUTRAL/PASS. Listed is {premium_pct}% above TFV, slightly overpriced but close to market. If you urgently need it, acceptable. Otherwise negotiate or wait.")
            )

# Combine all examples
all_examples = []

# Add TFV examples
for instruction, output in tfv_examples:
    all_examples.append({
        "instruction": instruction,
        "input": "",
        "output": output
    })

# Add BUY/PASS examples
for instruction, output in buy_pass_examples:
    all_examples.append({
        "instruction": instruction,
        "input": "",
        "output": output
    })

# Write to JSONL file (append to existing)
output_file = "/Users/arcadio/dev/pokedao/data/tfv/v4.3.1_training_set.jsonl"
with open(output_file, "a") as f:
    for example in all_examples:
        f.write(json.dumps(example) + "\n")

print(f"✅ Added {len(all_examples)} examples ({len(tfv_examples)} TFV + {len(buy_pass_examples)} BUY/PASS)")
print(f"📊 Total examples in dataset:")

# Count total lines
with open(output_file, "r") as f:
    total = len(f.readlines())
print(f"   {total} training examples")
print(f"📁 Dataset: {output_file}")
