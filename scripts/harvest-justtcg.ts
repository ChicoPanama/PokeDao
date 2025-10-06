/**
 * JustTCG Marketplace Harvester
 *
 * Harvests Pokemon TCG listings from JustTCG.com
 *
 * Note: JustTCG doesn't have a public API, so this uses web scraping.
 * Rate limit: 1 request/second to be respectful
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import fetch from 'node-fetch';
import * as cheerio from 'cheerio';
import { writeFileSync, existsSync, readFileSync } from 'fs';

// ============================================================================
// CONFIG
// ============================================================================

const BASE_URL = 'https://www.justtcg.com';
const POKEMON_URL = `${BASE_URL}/collections/pokemon-cards`;
const CHECKPOINT_FILE = 'data/justtcg-checkpoint.json';
const RATE_LIMIT_DELAY = 1000; // 1 second between requests

// ============================================================================
// CHECKPOINT
// ============================================================================

interface Checkpoint {
  lastPage: number;
  totalProducts: number;
  startedAt: string;
  updatedAt: string;
}

function loadCheckpoint(): Checkpoint | null {
  if (existsSync(CHECKPOINT_FILE)) {
    return JSON.parse(readFileSync(CHECKPOINT_FILE, 'utf8'));
  }
  return null;
}

function saveCheckpoint(checkpoint: Checkpoint): void {
  checkpoint.updatedAt = new Date().toISOString();
  writeFileSync(CHECKPOINT_FILE, JSON.stringify(checkpoint, null, 2));
}

// ============================================================================
// SCRAPER
// ============================================================================

async function scrapePage(pageNum: number): Promise<any[]> {
  const url = pageNum === 1 ? POKEMON_URL : `${POKEMON_URL}?page=${pageNum}`;

  await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY));

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const html = await response.text();
  const $ = cheerio.load(html);

  const products: any[] = [];

  // Find product cards
  $('.product-card').each((i, elem) => {
    const $elem = $(elem);

    const title = $elem.find('.product-card__title').text().trim();
    const priceText = $elem.find('.price').first().text().trim();
    const link = $elem.find('a').first().attr('href');
    const imageUrl = $elem.find('img').first().attr('src');

    // Parse price
    const priceMatch = priceText.match(/\$?([\d,.]+)/);
    const price = priceMatch ? parseFloat(priceMatch[1].replace(/,/g, '')) : 0;

    if (title && price > 0 && link) {
      products.push({
        title,
        price,
        url: link.startsWith('http') ? link : `${BASE_URL}${link}`,
        imageUrl: imageUrl?.startsWith('http') ? imageUrl : imageUrl ? `https:${imageUrl}` : undefined,
      });
    }
  });

  return products;
}

// ============================================================================
// PARSER
// ============================================================================

function parseCardDetails(title: string): {
  cardName?: string;
  setName?: string;
  cardNumber?: string;
  gradeCompany?: string;
  grade?: number;
  variant?: string;
  language?: string;
  edition?: string;
  dataQuality: number;
} {
  const result: any = {
    dataQuality: 0.5, // Base quality
  };

  // Grade parsing (PSA 10, BGS 9.5, CGC 9, etc)
  const gradeMatch = title.match(/\b(PSA|BGS|CGC|SGC|ACE)\s+(\d+(?:\.\d+)?)\b/i);
  if (gradeMatch) {
    result.gradeCompany = gradeMatch[1].toUpperCase();
    result.grade = parseFloat(gradeMatch[2]);
    result.dataQuality += 0.1;
  }

  // Card number (#123/456 or #123)
  const numMatch = title.match(/#(\d+)(?:\/\d+)?/);
  if (numMatch) {
    result.cardNumber = numMatch[1];
    result.dataQuality += 0.1;
  }

  // Set name (comprehensive list - same as eBay)
  const setPatterns = [
    /Base Set/i,
    /Jungle/i,
    /Fossil/i,
    /Team Rocket/i,
    /Gym Heroes/i,
    /Gym Challenge/i,
    /Neo Genesis/i,
    /Neo Discovery/i,
    /Neo Revelation/i,
    /Neo Destiny/i,
    /Legendary Collection/i,
    /Expedition/i,
    /Aquapolis/i,
    /Skyridge/i,
    /EX Ruby & Sapphire/i,
    /FireRed & LeafGreen/i,
    /Evolutions/i,
    /Shining Fates/i,
    /Crown Zenith/i,
    /Lost Origin/i,
    /Brilliant Stars/i,
    /Fusion Strike/i,
    /Evolving Skies/i,
    /Chilling Reign/i,
    /Battle Styles/i,
    /Vivid Voltage/i,
    /Champions Path/i,
    /Darkness Ablaze/i,
    /Rebel Clash/i,
    /Sword & Shield/i,
    /Cosmic Eclipse/i,
    /Hidden Fates/i,
    /Unified Minds/i,
    /Unbroken Bonds/i,
    /Team Up/i,
    /Lost Thunder/i,
    /Celestial Storm/i,
    /Forbidden Light/i,
    /Ultra Prism/i,
    /Crimson Invasion/i,
    /Shining Legends/i,
    /Burning Shadows/i,
    /Guardians Rising/i,
    /Sun & Moon/i,
    /Scarlet & Violet/i,
    /Obsidian Flames/i,
    /Paldean Fates/i,
    /Paradox Rift/i,
    /151/i,
    /Prismatic Evolutions/i,
  ];

  for (const pattern of setPatterns) {
    const match = title.match(pattern);
    if (match) {
      result.setName = match[0];
      result.dataQuality += 0.15;
      break;
    }
  }

  // Language
  const langMatch = title.match(/\b(japanese|korean|chinese|german|french|italian|spanish)\b/i);
  if (langMatch) {
    result.language = langMatch[0];
  }

  // Edition (1st Edition, Unlimited, Shadowless)
  const editionMatch = title.match(/\b(1st edition|shadowless|unlimited)\b/i);
  if (editionMatch) {
    result.edition = editionMatch[0];
  }

  // Variant (Holo, Reverse Holo, etc)
  const variantMatch = title.match(/\b(holo|reverse holo|non-holo|holographic|holofoil)\b/i);
  if (variantMatch) {
    result.variant = variantMatch[0];
  }

  // Card name - extract Pokemon name more intelligently
  let cleanTitle = title;

  // Remove parsed elements
  if (gradeMatch) cleanTitle = cleanTitle.replace(gradeMatch[0], '');
  if (numMatch) cleanTitle = cleanTitle.replace(numMatch[0], '');
  if (result.setName) cleanTitle = cleanTitle.replace(new RegExp(result.setName, 'i'), '');
  if (result.variant) cleanTitle = cleanTitle.replace(new RegExp(result.variant, 'i'), '');
  if (result.language) cleanTitle = cleanTitle.replace(new RegExp(result.language, 'i'), '');
  if (result.edition) cleanTitle = cleanTitle.replace(new RegExp(result.edition, 'i'), '');

  // Remove common keywords
  cleanTitle = cleanTitle.replace(/\b(pokemon|tcg|card|rare|ultra rare|secret rare|full art|alt art|rainbow|gold|promo)\b/gi, '');

  // Extract Pokemon name (capitalized words, possibly with EX/GX/V/VMAX suffixes)
  const nameMatch = cleanTitle.match(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2}(?:\s+(?:EX|GX|V|VMAX|VSTAR|ex|gx))?)\b/);
  if (nameMatch) {
    result.cardName = nameMatch[1].trim();
    result.dataQuality += 0.15;
  }

  // Fallback: Use beginning of original title if no Pokemon name found
  if (!result.cardName) {
    const fallbackMatch = title.match(/^([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})/);
    result.cardName = fallbackMatch ? fallbackMatch[1] : 'Unknown';
  }

  return result;
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log('🔄 JUSTTCG HARVESTER');
  console.log('='.repeat(60));

  const prisma = new PrismaClient();

  let checkpoint = loadCheckpoint();
  if (!checkpoint) {
    checkpoint = {
      lastPage: 0,
      totalProducts: 0,
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  console.log(`📍 Checkpoint: Page ${checkpoint.lastPage}, ${checkpoint.totalProducts} products\n`);

  let currentPage = checkpoint.lastPage + 1;
  let hasMorePages = true;

  while (hasMorePages) {
    console.log(`\n📄 Scraping page ${currentPage}...`);

    try {
      const products = await scrapePage(currentPage);

      if (products.length === 0) {
        console.log('   No more products found');
        hasMorePages = false;
        break;
      }

      console.log(`   Found ${products.length} products`);

      let savedCount = 0;

      for (const product of products) {
        const parsed = parseCardDetails(product.title);
        const priceCents = Math.round(product.price * 100);

        // Generate unique ID from URL
        const sourceId = product.url.split('/').pop() || `page${currentPage}-${savedCount}`;

        await prisma.unifiedMarketListing.upsert({
          where: {
            source_sourceId: {
              source: 'JUSTTCG',
              sourceId,
            },
          },
          create: {
            source: 'JUSTTCG',
            sourceId,
            title: product.title.substring(0, 500),
            rawTitle: product.title.substring(0, 500),
            cardName: parsed.cardName?.substring(0, 255) || 'Unknown',
            setName: parsed.setName?.substring(0, 255) || 'Unknown',
            cardNumber: parsed.cardNumber?.substring(0, 10),
            gradeCompany: parsed.gradeCompany as any,
            grade: parsed.grade,
            priceCents,
            currency: 'USD',
            url: product.url.substring(0, 500),
            dataQuality: parsed.dataQuality,
          },
          update: {
            priceCents,
            cardName: parsed.cardName?.substring(0, 255) || 'Unknown',
            setName: parsed.setName?.substring(0, 255) || 'Unknown',
            cardNumber: parsed.cardNumber?.substring(0, 10),
            gradeCompany: parsed.gradeCompany as any,
            grade: parsed.grade,
            dataQuality: parsed.dataQuality,
            updatedAt: new Date(),
          },
        });

        savedCount++;
      }

      console.log(`   ✅ Saved ${savedCount} listings`);

      checkpoint.lastPage = currentPage;
      checkpoint.totalProducts += savedCount;
      saveCheckpoint(checkpoint);

      currentPage++;

      // Limit to 50 pages for initial harvest (can increase later)
      if (currentPage > 50) {
        console.log('\n   Reached page limit (50). Stopping.');
        hasMorePages = false;
      }

    } catch (error: any) {
      console.error(`   ❌ Error: ${error.message}`);
      hasMorePages = false;
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('✅ HARVEST COMPLETE');
  console.log('='.repeat(60));
  console.log(`📄 Pages Scraped: ${checkpoint.lastPage}`);
  console.log(`🎴 Products Saved: ${checkpoint.totalProducts}`);
  console.log('='.repeat(60));

  await prisma.$disconnect();
}

main().catch(console.error);
