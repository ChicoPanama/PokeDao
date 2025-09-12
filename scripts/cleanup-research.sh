#!/usr/bin/env bash

# POKEDAO RESEARCH FOLDER CLEANUP PIPELINE
# ========================================
# This script cleans up the research folder and ensures compatibility
# with the canonical schema at /api/prisma/schema.prisma

set -e  # Exit on error

echo "🧹 POKEDAO RESEARCH CLEANUP PIPELINE"
echo "===================================="

RESEARCH_DIR="/Users/arcadio/dev/pokedao/research"
CANONICAL_SCHEMA="/Users/arcadio/dev/pokedao/api/prisma/schema.prisma"
BACKUP_DIR="/Users/arcadio/dev/pokedao/research-backup-$(date +%Y%m%d-%H%M%S)"

# Create backup directory
mkdir -p "$BACKUP_DIR"

echo "📊 ANALYSIS PHASE"
echo "=================="

# Count files by type
echo "📈 Research folder analysis:"
echo "  JavaScript files: $(find "$RESEARCH_DIR" -name "*.js" | wc -l | tr -d ' ')"
echo "  Database files: $(find "$RESEARCH_DIR" -name "*.db" | wc -l | tr -d ' ')"
echo "  JSON files: $(find "$RESEARCH_DIR" -name "*.json" | wc -l | tr -d ' ')"
echo "  Schema files: $(find "$RESEARCH_DIR" -name "*schema*" | wc -l | tr -d ' ')"
echo "  Image files: $(find "$RESEARCH_DIR" -name "*.png" | wc -l | tr -d ' ')"
echo "  CSV files: $(find "$RESEARCH_DIR" -name "*.csv" | wc -l | tr -d ' ')"

echo ""
echo "🗂️  CLEANUP PHASE"
echo "=================="

# 1. Archive old databases
echo "📦 Step 1: Archiving old database files..."
find "$RESEARCH_DIR" -name "*.db" -type f | while read db_file; do
    relative_path="${db_file#$RESEARCH_DIR/}"
    backup_path="$BACKUP_DIR/databases/$relative_path"
    mkdir -p "$(dirname "$backup_path")"
    mv "$db_file" "$backup_path"
    echo "  📦 Archived: $relative_path"
done

# 2. Clean up debug files
echo "🗑️  Step 2: Removing debug and temporary files..."
find "$RESEARCH_DIR" -name "debug-*.json" -delete 2>/dev/null || true
find "$RESEARCH_DIR" -name "debug-*.png" -delete 2>/dev/null || true
find "$RESEARCH_DIR" -name "temp-*.js" -delete 2>/dev/null || true
find "$RESEARCH_DIR" -name "*-temp.js" -delete 2>/dev/null || true
find "$RESEARCH_DIR" -name "*.log" -delete 2>/dev/null || true

# 3. Archive large data files
echo "📊 Step 3: Archiving large data files..."
find "$RESEARCH_DIR" -name "*.json" -size +1M | while read json_file; do
    relative_path="${json_file#$RESEARCH_DIR/}"
    backup_path="$BACKUP_DIR/large-data/$relative_path"
    mkdir -p "$(dirname "$backup_path")"
    mv "$json_file" "$backup_path"
    echo "  📦 Archived large file: $relative_path"
done

# 4. Consolidate scripts by category
echo "🗂️  Step 4: Organizing remaining scripts..."

# Create organized structure
mkdir -p "$RESEARCH_DIR/consolidated/extractors"
mkdir -p "$RESEARCH_DIR/consolidated/analyzers" 
mkdir -p "$RESEARCH_DIR/consolidated/integrations"
mkdir -p "$RESEARCH_DIR/consolidated/utilities"

# Move scripts to appropriate categories
find "$RESEARCH_DIR" -name "*extractor*.js" -not -path "*/consolidated/*" | head -10 | while read script; do
    filename=$(basename "$script")
    mv "$script" "$RESEARCH_DIR/consolidated/extractors/"
    echo "  📁 Moved to extractors: $filename"
done

find "$RESEARCH_DIR" -name "*analyzer*.js" -o -name "*analysis*.js" -not -path "*/consolidated/*" | head -10 | while read script; do
    filename=$(basename "$script")
    mv "$script" "$RESEARCH_DIR/consolidated/analyzers/"
    echo "  📁 Moved to analyzers: $filename"
done

find "$RESEARCH_DIR" -name "*integration*.js" -o -name "*harvester*.js" -not -path "*/consolidated/*" | head -10 | while read script; do
    filename=$(basename "$script")
    mv "$script" "$RESEARCH_DIR/consolidated/integrations/"
    echo "  📁 Moved to integrations: $filename"
done

# 5. Remove node_modules from research (they should use workspace)
echo "🗑️  Step 5: Cleaning node_modules..."
find "$RESEARCH_DIR" -name "node_modules" -type d | while read node_modules; do
    echo "  🗑️  Removing: ${node_modules#$RESEARCH_DIR/}"
    rm -rf "$node_modules"
done

# 6. Create canonical schema compatibility adapters
echo "🔗 Step 6: Creating canonical schema adapters..."

cat > "$RESEARCH_DIR/consolidated/canonical-adapter.js" << 'EOF'
/**
 * CANONICAL SCHEMA ADAPTER
 * ========================
 * This adapter ensures all research scripts use the canonical schema
 * at /api/prisma/schema.prisma
 */

// Re-export the canonical Prisma client
export { PrismaClient } from '../../../api/node_modules/@prisma/client/index.js';

// Standard normalization function for all research scripts
export function normalizeCardData(rawCard) {
  return {
    name: rawCard.name || rawCard.cardName || rawCard.title,
    set: rawCard.set || rawCard.setName || rawCard.expansion,
    number: rawCard.number || rawCard.cardNumber || rawCard.num,
    variant: rawCard.variant || rawCard.variantType,
    grade: rawCard.grade || rawCard.grading,
    condition: rawCard.condition || rawCard.cardCondition,
    normalizedName: rawCard.normalizedName,
    setCode: rawCard.setCode,
    rarity: rawCard.rarity,
    cardType: rawCard.cardType || rawCard.type,
    category: rawCard.category || 'Pokemon'
  };
}

// Database connection helper
export async function getCanonicalPrisma() {
  const { PrismaClient } = await import('../../../api/node_modules/@prisma/client/index.js');
  return new PrismaClient({
    datasources: {
      db: {
        url: process.env.DATABASE_URL
      }
    }
  });
}

console.log('✅ Using canonical schema adapter');
EOF

# 7. Create research documentation
cat > "$RESEARCH_DIR/README.md" << 'EOF'
# PokeDAO Research Folder

This folder contains research scripts and data collection tools that have been organized and made compatible with the canonical schema.

## Structure

- `consolidated/extractors/` - Data extraction scripts
- `consolidated/analyzers/` - Data analysis scripts  
- `consolidated/integrations/` - Integration and harvesting scripts
- `consolidated/utilities/` - Utility scripts
- `consolidated/canonical-adapter.js` - Canonical schema adapter

## Usage

All scripts should use the canonical schema adapter:

```javascript
import { PrismaClient, normalizeCardData, getCanonicalPrisma } from './canonical-adapter.js';
```

## Canonical Schema

The single source of truth is: `/api/prisma/schema.prisma`

All data should be normalized to this schema format before storage.
EOF

echo ""
echo "✅ CLEANUP COMPLETE!"
echo "===================="
echo "📍 Backup location: $BACKUP_DIR"
echo "📂 Organized structure: $RESEARCH_DIR/consolidated/"
echo "🔗 Canonical adapter: $RESEARCH_DIR/consolidated/canonical-adapter.js"
echo ""
echo "📊 Final counts:"
echo "  Remaining JS files: $(find "$RESEARCH_DIR" -name "*.js" | wc -l | tr -d ' ')"
echo "  Remaining JSON files: $(find "$RESEARCH_DIR" -name "*.json" | wc -l | tr -d ' ')"
echo "  Archived databases: $(find "$BACKUP_DIR" -name "*.db" 2>/dev/null | wc -l | tr -d ' ')"
echo ""
echo "🔧 Next steps:"
echo "   1. Update research scripts to use canonical-adapter.js"
echo "   2. Test key research functionality"
echo "   3. Remove duplicate/obsolete scripts"
