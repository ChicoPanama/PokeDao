#!/bin/bash

###############################################################################
# COMPREHENSIVE DATA AUDIT
# Finds ALL Pokemon card data across the entire project
###############################################################################

echo "🔍 COMPREHENSIVE DATA AUDIT - Finding ALL Card Data"
echo "============================================================"
echo ""

# Location 1: PostgreSQL
echo "📍 LOCATION 1: PostgreSQL (Docker - pokedao-postgres)"
echo "------------------------------------------------------------"
psql postgresql://pokedao:pokedao@localhost:5432/pokedao -t -c "
SELECT
  table_name || ': ' || records || ' records, ' || unique_cards || ' unique cards'
FROM (
  SELECT
    'UnifiedMarketListing' as table_name,
    COUNT(*) as records,
    COUNT(DISTINCT \"cardName\") as unique_cards
  FROM \"UnifiedMarketListing\"
  UNION ALL
  SELECT
    'Card',
    COUNT(*),
    COUNT(DISTINCT name)
  FROM \"Card\"
  UNION ALL
  SELECT
    'CompSale',
    COUNT(*),
    COUNT(DISTINCT \"cardId\")
  FROM \"CompSale\"
  UNION ALL
  SELECT
    'official_pokemon_cards',
    COUNT(*),
    COUNT(DISTINCT id)
  FROM official_pokemon_cards
  UNION ALL
  SELECT
    'canonical_cards',
    COUNT(*),
    COUNT(DISTINCT id)
  FROM canonical_cards
) t
WHERE records > 0;
"
echo ""

# Location 2: SQLite Databases
echo "📍 LOCATION 2: SQLite Databases (Research Backup)"
echo "------------------------------------------------------------"

total_sqlite_records=0

for db in research-backup-20250911-172521/databases/tcgplayer-discovery/*.db; do
    dbname=$(basename "$db")

    # Get all tables
    tables=$(sqlite3 "$db" "SELECT name FROM sqlite_master WHERE type='table';" 2>/dev/null)

    if [ ! -z "$tables" ]; then
        db_total=0
        echo ""
        echo "=== $dbname ==="

        echo "$tables" | while read table; do
            if [ ! -z "$table" ]; then
                count=$(sqlite3 "$db" "SELECT COUNT(*) FROM \"$table\";" 2>/dev/null || echo "0")
                if [ "$count" -gt 0 ]; then
                    echo "  - $table: $count records"
                    db_total=$((db_total + count))
                fi
            fi
        done
    fi
done

echo ""
echo ""

# Location 3: JSON Data Files
echo "📍 LOCATION 3: JSON Data Files"
echo "------------------------------------------------------------"
for json in data/*.json; do
    if [ -f "$json" ]; then
        size=$(ls -lh "$json" | awk '{print $5}')
        lines=$(wc -l < "$json" 2>/dev/null || echo "0")
        echo "  - $(basename $json): $size ($lines lines)"
    fi
done

echo ""
echo ""

# Location 4: Data Lake
echo "📍 LOCATION 4: Data Lake (Parquet Files)"
echo "------------------------------------------------------------"
echo "  Bronze: $(ls -1 data_lake/bronze/*.parquet 2>/dev/null | wc -l | tr -d ' ') files"
echo "  Silver: $(ls -1 data_lake/silver/*.parquet 2>/dev/null | wc -l | tr -d ' ') files"
echo "  Gold: $(ls -1 data_lake/gold/*.parquet 2>/dev/null | wc -l | tr -d ' ') files"

echo ""
echo ""

# Summary
echo "============================================================"
echo "📊 SUMMARY"
echo "============================================================"
echo ""
echo "PRIMARY DATA (PostgreSQL):"
psql postgresql://pokedao:pokedao@localhost:5432/pokedao -t -c "
SELECT '  Total Records: ' || COUNT(*) FROM \"UnifiedMarketListing\"
UNION ALL
SELECT '  Unique Cards: ' || COUNT(DISTINCT \"cardName\") FROM \"UnifiedMarketListing\"
UNION ALL
SELECT '  Sources: JUSTTCG (' || (SELECT COUNT(*) FROM \"UnifiedMarketListing\" WHERE source='JUSTTCG') || '), EBAY (' || (SELECT COUNT(*) FROM \"UnifiedMarketListing\" WHERE source='EBAY') || ')';
"

echo ""
echo "ARCHIVED DATA (SQLite):"
echo "  Databases: $(ls -1 research-backup-20250911-172521/databases/tcgplayer-discovery/*.db 2>/dev/null | wc -l | tr -d ' ')"
echo "  Status: Historical/Not currently used"

echo ""
echo "============================================================"
