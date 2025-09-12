/**
 * ENHANCED CANONICAL SCHEMA ADAPTER
 * =================================
 * This adapter ensures ALL research scripts use the canonical schema
 * at /api/prisma/schema.prisma with zero conflicts
 */

import { PrismaClient } from '@prisma/client';

// Standard normalization function for all research scripts
export function normalizeCardData(rawCard) {
  // Handle all known field variations from research sources
  const normalized = {
    name: rawCard.name || rawCard.cardName || rawCard.title || rawCard.itemName,
    set: rawCard.set || rawCard.setName || rawCard.expansion || rawCard.series,
    number: String(rawCard.number || rawCard.cardNumber || rawCard.num || rawCard.cardNum || ''),
    variant: rawCard.variant || rawCard.variantType || rawCard.finish,
    grade: rawCard.grade || rawCard.grading || rawCard.condition_grade,
    condition: rawCard.condition || rawCard.cardCondition || rawCard.item_condition,
    language: rawCard.language || 'English',
    
    // Enhanced normalization fields
    normalizedName: rawCard.normalizedName || normalizeString(rawCard.name || rawCard.cardName || rawCard.title),
    setCode: rawCard.setCode || extractSetCode(rawCard.set || rawCard.setName),
    rarity: rawCard.rarity || rawCard.rarityType,
    cardType: rawCard.cardType || rawCard.type || 'Pokemon',
    category: rawCard.category || 'Pokemon'
  };

  // Remove empty/null values
  Object.keys(normalized).forEach(key => {
    if (normalized[key] === null || normalized[key] === undefined || normalized[key] === '') {
      delete normalized[key];
    }
  });

  return normalized;
}

// Helper function to normalize strings
function normalizeString(str) {
  if (!str) return null;
  return str.trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

// Helper function to extract set codes
function extractSetCode(setName) {
  if (!setName) return null;
  // Common set code patterns
  const patterns = [
    /\(([A-Z0-9]+)\)/,  // (BSE), (JUN), etc.
    /([A-Z]{2,4})\s*$/,  // BSE, JUN at end
    /^([A-Z]{2,4})\s/    // BSE, JUN at start
  ];
  
  for (const pattern of patterns) {
    const match = setName.match(pattern);
    if (match) return match[1];
  }
  return null;
}

// Database connection helper with enhanced error handling
export async function getCanonicalPrisma() {
  try {
    const prisma = new PrismaClient({
      datasources: {
        db: {
          url: process.env.DATABASE_URL || 'postgresql://localhost:5432/pokedao'
        }
      }
    });
    
    // Test connection
    await prisma.$connect();
    return prisma;
  } catch (error) {
    console.error('❌ Failed to connect to canonical database:', error.message);
    throw new Error(`Canonical database connection failed: ${error.message}`);
  }
}

// Utility function to validate data against canonical schema
export function validateCanonicalData(data) {
  const required = ['name', 'set', 'number'];
  const missing = required.filter(field => !data[field]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required fields for canonical schema: ${missing.join(', ')}`);
  }
  
  return true;
}

// Migration helper for old research data
export function migrateResearchData(oldData) {
  console.log('🔄 Migrating research data to canonical format...');
  
  if (Array.isArray(oldData)) {
    return oldData.map(item => normalizeCardData(item));
  } else {
    return normalizeCardData(oldData);
  }
}

console.log('✅ Enhanced canonical schema adapter loaded');
console.log('📍 Using schema: /api/prisma/schema.prisma');
