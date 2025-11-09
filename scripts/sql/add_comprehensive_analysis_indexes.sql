-- Add indexes for comprehensive analysis hot paths

-- Optimize market listings lookups by canonical id and active flag
CREATE INDEX IF NOT EXISTS idx_market_listings_comprehensive 
ON market_listings (canonical_card_id, is_active, price_cents)
WHERE is_active = true;

-- Speed up sale records recent history by card and recency
CREATE INDEX IF NOT EXISTS idx_sale_records_recent 
ON sale_records (canonical_card_id, sold_at DESC);

-- Help sibling/variant queries by set + card number
CREATE INDEX IF NOT EXISTS idx_canonical_cards_set_number 
ON canonical_cards (canonical_set, card_number)
WHERE card_number IS NOT NULL;

