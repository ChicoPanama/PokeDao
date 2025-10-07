/**
 * IMAGE GENERATOR FOR TWITTER POSTS
 * Generates card images with price overlays and price charts
 */

import sharp from 'sharp';
import * as fs from 'fs';
import * as path from 'path';
import type { AIAnalysisResult } from './ai-ensemble.js';

const IMAGES_DIR = path.join(process.cwd(), 'data', 'images');

// Ensure images directory exists
if (!fs.existsSync(IMAGES_DIR)) {
  fs.mkdirSync(IMAGES_DIR, { recursive: true });
}

/**
 * Fetch Pokemon card image from PokemonTCG.io API
 */
export async function fetchCardImage(cardName: string, setName?: string): Promise<Buffer | null> {
  try {
    // Search for card using Pokemon TCG API
    const searchQuery = setName ? `name:"${cardName}" set.name:"${setName}"` : `name:"${cardName}"`;
    const url = `https://api.pokemontcg.io/v2/cards?q=${encodeURIComponent(searchQuery)}&pageSize=1`;

    const response = await fetch(url);
    if (!response.ok) {
      console.warn(`Pokemon TCG API error: ${response.status}`);
      return null;
    }

    const data: any = await response.json();
    if (!data.data || data.data.length === 0) {
      console.warn(`No card image found for ${cardName} ${setName || ''}`);
      return null;
    }

    // Get hi-res image URL
    const imageUrl = data.data[0].images.large; // or .small for smaller version

    // Download image
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      console.warn(`Failed to download card image: ${imageResponse.status}`);
      return null;
    }

    const arrayBuffer = await imageResponse.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (error: any) {
    console.error(`Error fetching card image: ${error.message}`);
    return null;
  }
}

/**
 * Create price overlay on card image
 */
export async function createCardOverlay(
  cardImageBuffer: Buffer,
  analysisResult: AIAnalysisResult
): Promise<Buffer> {
  const discount = analysisResult.pricing.discount;
  const recommendation = analysisResult.recommendation;

  // Determine overlay color based on recommendation
  let overlayColor: { r: number; g: number; b: number; alpha: number };
  if (recommendation === 'STRONG_BUY') {
    overlayColor = { r: 34, g: 197, b: 94, alpha: 0.9 }; // Green
  } else if (recommendation === 'BUY') {
    overlayColor = { r: 59, g: 130, b: 246, alpha: 0.9 }; // Blue
  } else if (recommendation === 'HOLD') {
    overlayColor = { r: 251, g: 191, b: 36, alpha: 0.9 }; // Yellow
  } else {
    overlayColor = { r: 239, g: 68, b: 68, alpha: 0.9 }; // Red
  }

  // Create SVG overlay
  const svgOverlay = `
    <svg width="488" height="680">
      <!-- Top banner with recommendation -->
      <rect x="0" y="0" width="488" height="80" fill="rgba(${overlayColor.r}, ${overlayColor.g}, ${overlayColor.b}, ${overlayColor.alpha})" />
      <text x="244" y="35" font-family="Arial, sans-serif" font-size="28" font-weight="bold" fill="white" text-anchor="middle">
        ${recommendation.replace('_', ' ')}
      </text>
      <text x="244" y="60" font-family="Arial, sans-serif" font-size="18" fill="white" text-anchor="middle">
        ${discount.toFixed(1)}% ${discount < 0 ? 'Below' : 'Above'} FV
      </text>

      <!-- Bottom banner with price -->
      <rect x="0" y="600" width="488" height="80" fill="rgba(0, 0, 0, 0.85)" />
      <text x="244" y="635" font-family="Arial, sans-serif" font-size="24" font-weight="bold" fill="white" text-anchor="middle">
        $${analysisResult.pricing.listed.toFixed(2)}
      </text>
      <text x="244" y="660" font-family="Arial, sans-serif" font-size="16" fill="#9CA3AF" text-anchor="middle">
        FV: $${analysisResult.pricing.fairValue.toFixed(2)} | ${analysisResult.market.salesCount} comps
      </text>
    </svg>
  `;

  // Composite SVG onto card image
  const result = await sharp(cardImageBuffer)
    .resize(488, 680, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
    .composite([
      {
        input: Buffer.from(svgOverlay),
        top: 0,
        left: 0,
      },
    ])
    .png()
    .toBuffer();

  return result;
}

/**
 * Generate 30-day price chart using SVG
 */
export async function generatePriceChart(
  cardName: string,
  priceHistory: Array<{ date: Date; price: number }>
): Promise<Buffer> {
  const width = 800;
  const height = 400;
  const padding = { top: 60, right: 40, bottom: 60, left: 80 };

  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  // Calculate price range
  const prices = priceHistory.map(p => p.price);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const priceRange = maxPrice - minPrice;
  const paddedMin = minPrice - priceRange * 0.1;
  const paddedMax = maxPrice + priceRange * 0.1;
  const paddedRange = paddedMax - paddedMin;

  // Generate line path
  const points = priceHistory.map((p, i) => {
    const x = padding.left + (i / (priceHistory.length - 1)) * chartWidth;
    const y = padding.top + chartHeight - ((p.price - paddedMin) / paddedRange) * chartHeight;
    return { x, y };
  });

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x},${p.y}`).join(' ');

  // Generate area path (filled region below line)
  const areaPath = `M ${padding.left},${padding.top + chartHeight} L ${points.map(p => `${p.x},${p.y}`).join(' L ')} L ${padding.left + chartWidth},${padding.top + chartHeight} Z`;

  // Generate Y-axis labels
  const yAxisLabels = [];
  const numYLabels = 5;
  for (let i = 0; i <= numYLabels; i++) {
    const price = paddedMin + (paddedRange * i) / numYLabels;
    const y = padding.top + chartHeight - (i / numYLabels) * chartHeight;
    yAxisLabels.push({ price, y });
  }

  // Generate X-axis labels (show every 5 days)
  const xAxisLabels = priceHistory
    .filter((_, i) => i % 5 === 0 || i === priceHistory.length - 1)
    .map((p, idx) => {
      const i = priceHistory.indexOf(p);
      const x = padding.left + (i / (priceHistory.length - 1)) * chartWidth;
      const label = p.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      return { x, label };
    });

  const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <!-- Background -->
      <rect width="${width}" height="${height}" fill="white"/>

      <!-- Title -->
      <text x="${width / 2}" y="35" font-family="Arial, sans-serif" font-size="20" font-weight="bold" fill="#1F2937" text-anchor="middle">
        ${cardName} - 30 Day Price Trend
      </text>

      <!-- Grid lines -->
      ${yAxisLabels.map(({ y }) => `
        <line x1="${padding.left}" y1="${y}" x2="${padding.left + chartWidth}" y2="${y}" stroke="#E5E7EB" stroke-width="1"/>
      `).join('')}

      <!-- Area fill -->
      <path d="${areaPath}" fill="rgba(59, 130, 246, 0.1)"/>

      <!-- Line -->
      <path d="${linePath}" fill="none" stroke="rgb(59, 130, 246)" stroke-width="3"/>

      <!-- Y-axis labels -->
      ${yAxisLabels.map(({ price, y }) => `
        <text x="${padding.left - 10}" y="${y + 5}" font-family="Arial, sans-serif" font-size="14" fill="#6B7280" text-anchor="end">
          $${price.toFixed(0)}
        </text>
      `).join('')}

      <!-- X-axis labels -->
      ${xAxisLabels.map(({ x, label }) => `
        <text x="${x}" y="${padding.top + chartHeight + 30}" font-family="Arial, sans-serif" font-size="12" fill="#6B7280" text-anchor="middle">
          ${label}
        </text>
      `).join('')}

      <!-- X-axis line -->
      <line x1="${padding.left}" y1="${padding.top + chartHeight}" x2="${padding.left + chartWidth}" y2="${padding.top + chartHeight}" stroke="#9CA3AF" stroke-width="2"/>

      <!-- Y-axis line -->
      <line x1="${padding.left}" y1="${padding.top}" x2="${padding.left}" y2="${padding.top + chartHeight}" stroke="#9CA3AF" stroke-width="2"/>
    </svg>
  `;

  // Convert SVG to PNG using sharp
  const buffer = await sharp(Buffer.from(svg))
    .png()
    .toBuffer();

  return buffer;
}

/**
 * Combine card image and chart into single Twitter image
 */
export async function combineImages(cardBuffer: Buffer, chartBuffer: Buffer): Promise<Buffer> {
  // Resize images to fit Twitter's optimal dimensions (2:1 ratio)
  const twitterWidth = 1200;
  const twitterHeight = 675;

  // Card on left (600x675), chart on right (600x675)
  const cardResized = await sharp(cardBuffer)
    .resize(600, 675, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
    .toBuffer();

  const chartResized = await sharp(chartBuffer)
    .resize(600, 675, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
    .toBuffer();

  // Create composite image
  const combined = await sharp({
    create: {
      width: twitterWidth,
      height: twitterHeight,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    },
  })
    .composite([
      { input: cardResized, left: 0, top: 0 },
      { input: chartResized, left: 600, top: 0 },
    ])
    .png()
    .toBuffer();

  return combined;
}

/**
 * Generate complete Twitter image with card + chart
 */
export async function generateTwitterImage(
  analysisResult: AIAnalysisResult,
  priceHistory?: Array<{ date: Date; price: number }>
): Promise<{ imagePath: string; buffer: Buffer }> {
  console.log(`🖼️  Generating Twitter image for ${analysisResult.card.name}...`);

  // Step 1: Fetch card image
  const cardImageBuffer = await fetchCardImage(analysisResult.card.name, analysisResult.card.setName);

  if (!cardImageBuffer) {
    throw new Error(`Failed to fetch card image for ${analysisResult.card.name}`);
  }

  // Step 2: Add price overlay
  const cardWithOverlay = await createCardOverlay(cardImageBuffer, analysisResult);

  // Step 3: Generate price chart (if history provided)
  let finalImage: Buffer;

  if (priceHistory && priceHistory.length > 0) {
    const chart = await generatePriceChart(analysisResult.card.name, priceHistory);
    finalImage = await combineImages(cardWithOverlay, chart);
  } else {
    // Just use card with overlay if no price history
    finalImage = await sharp(cardWithOverlay)
      .resize(1200, 675, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
      .toBuffer();
  }

  // Step 4: Save to disk
  const timestamp = Date.now();
  const filename = `${analysisResult.card.name.replace(/\s+/g, '_')}_${timestamp}.png`;
  const imagePath = path.join(IMAGES_DIR, filename);

  await sharp(finalImage).toFile(imagePath);

  console.log(`✅ Image saved: ${imagePath}`);

  return {
    imagePath,
    buffer: finalImage,
  };
}

/**
 * Generate mock price history for testing
 */
export function generateMockPriceHistory(basePrice: number, days: number = 30): Array<{ date: Date; price: number }> {
  const history: Array<{ date: Date; price: number }> = [];
  const today = new Date();

  for (let i = days; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);

    // Add some randomness to simulate price fluctuations
    const variance = (Math.random() - 0.5) * 0.2; // ±10% variance
    const price = basePrice * (1 + variance);

    history.push({
      date,
      price: Math.round(price * 100) / 100,
    });
  }

  return history;
}
