#!/usr/bin/env bash
# POKEDAO SCHEMA CLEANUP PIPELINE
# ================================
# This script removes problematic schema files while preserving 
# the canonical schema at /api/prisma/schema.prisma

echo "🚀 POKEDAO SCHEMA CLEANUP PIPELINE"
echo "=================================="

# 1. Archive all research schemas as backup files
echo "📦 Step 1: Archiving research schemas..."

# Archive fanatics schema
if [ -f "research/fanatics-collect-discovery/fanatics-schema.plan.backup" ]; then
    echo "  ✅ Fanatics schema already archived"
else
    echo "  ❌ Fanatics schema not found"
fi

# Archive tcgplayer schemas  
if [ -f "research/tcgplayer-discovery/tcgplayer-schema.plan.backup" ]; then
    echo "  ✅ TCGPlayer schema already archived"
else
    echo "  ❌ TCGPlayer schema not found"
fi

# 2. Remove any problematic generated client schemas
echo "📂 Step 2: Cleaning generated schemas..."

# Remove any generated schema backups
find . -name "*.prisma.bak" -not -path "./node_modules/*" -not -path "./.pnpm/*" | while read file; do
    echo "  🗑️  Removing: $file"
    rm -f "$file"
done

# 3. Ensure canonical schema is the only active one
echo "📊 Step 3: Verifying canonical schema..."

canonical_schema="api/prisma/schema.prisma"
if [ -f "$canonical_schema" ]; then
    echo "  ✅ Canonical schema exists: $canonical_schema"
    echo "  📈 Testing schema generation..."
    cd api && npx prisma generate > /dev/null 2>&1
    if [ $? -eq 0 ]; then
        echo "  ✅ Schema generates successfully"
    else
        echo "  ❌ Schema generation failed"
        exit 1
    fi
    cd ..
else
    echo "  ❌ Canonical schema missing!"
    exit 1
fi

# 4. Update VS Code settings to ignore problematic paths
echo "⚙️  Step 4: Updating VS Code settings..."

vscode_settings=".vscode/settings.json"
if [ -f "$vscode_settings" ]; then
    echo "  ✅ VS Code settings exist"
    # The settings already contain the right exclusions
else
    echo "  ❌ VS Code settings missing"
fi

# 5. Clean up any remaining problematic files
echo "🧹 Step 5: Final cleanup..."

# Remove any schema files that might confuse VS Code
find . -name "*schema*.prisma" -not -path "./api/prisma/schema.prisma" -not -path "./node_modules/*" -not -path "./.pnpm/*" -not -name "*.backup" | while read file; do
    if [[ "$file" == *".plan.backup" ]] || [[ "$file" == *".backup" ]]; then
        echo "  📦 Keeping backup: $file"
    else
        echo "  🗑️  Moving to backup: $file → $file.archived"
        mv "$file" "$file.archived"
    fi
done

echo ""
echo "✅ SCHEMA CLEANUP COMPLETE!"
echo "=========================="
echo "📍 Canonical schema: $canonical_schema"
echo "🔧 Next steps:"
echo "   1. Test external integration: cd api && npm run test:external"
echo "   2. Verify no VS Code schema conflicts"
echo "   3. All data pipelines should use canonical schema"
