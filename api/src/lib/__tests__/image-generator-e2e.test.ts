import { describe, it, expect, beforeAll } from 'vitest';
import {
  generateMockPriceHistory,
  generatePriceChart,
  fetchCardImage,
  createCardOverlay,
  combineImages,
  generateTwitterImage
} from '../image-generator.js';
import { writeFileSync } from 'fs';

// These tests make REAL API calls and generate REAL images
describe('Image Generator - E2E Real API Tests', () => {
  const POKEMON_TCG_API_KEY = process.env.POKEMON_TCG_API_KEY || '221c33c8-ef23-4165-b2a5-c4f6cafa4cb7';

  beforeAll(() => {
    if (!POKEMON_TCG_API_KEY) {
      throw new Error('POKEMON_TCG_API_KEY required for E2E tests');
    }
  });

  describe('generateMockPriceHistory - Real Execution', () => {
    it('should generate realistic price history', () => {
      const history = generateMockPriceHistory(100, 30);

      expect(history).toHaveLength(31);
      expect(history[0].price).toBeGreaterThan(0);
      expect(history[history.length - 1].price).toBeGreaterThan(0);

      console.log(`✓ Generated ${history.length} price points ranging from $${Math.min(...history.map(h => h.price)).toFixed(2)} to $${Math.max(...history.map(h => h.price)).toFixed(2)}`);
    });

    it('should generate history with different durations', () => {
      [7, 14, 30, 60, 90].forEach(days => {
        const history = generateMockPriceHistory(100, days);
        expect(history).toHaveLength(days + 1);
      });

      console.log('✓ Successfully generated histories for 7, 14, 30, 60, and 90 days');
    });
  });

  describe('generatePriceChart - Real SVG Generation', () => {
    it('should generate real SVG chart for BULLISH signal', async () => {
      const history = generateMockPriceHistory(100, 30);
      const svg = await generatePriceChart(history, 'BULLISH');

      expect(svg).toContain('<svg');
      expect(svg).toContain('</svg>');
      expect(svg).toContain('#22c55e'); // Green color
      expect(svg).toContain('<path'); // Chart line

      // Save for manual inspection
      writeFileSync('/tmp/test-chart-bullish.svg', svg);
      console.log('✓ Generated BULLISH SVG chart (saved to /tmp/test-chart-bullish.svg)');
    });

    it('should generate real SVG chart for BEARISH signal', async () => {
      const history = generateMockPriceHistory(100, 30);
      const svg = await generatePriceChart(history, 'BEARISH');

      expect(svg).toContain('#ef4444'); // Red color
      writeFileSync('/tmp/test-chart-bearish.svg', svg);
      console.log('✓ Generated BEARISH SVG chart (saved to /tmp/test-chart-bearish.svg)');
    });

    it('should generate real SVG chart for NEUTRAL signal', async () => {
      const history = generateMockPriceHistory(100, 30);
      const svg = await generatePriceChart(history, 'NEUTRAL');

      expect(svg).toContain('#6b7280'); // Gray color
      writeFileSync('/tmp/test-chart-neutral.svg', svg);
      console.log('✓ Generated NEUTRAL SVG chart (saved to /tmp/test-chart-neutral.svg)');
    });
  });

  describe('fetchCardImage - Real Pokemon TCG API Calls', () => {
    it('should fetch real Charizard image from Pokemon TCG API', async () => {
      const imageBuffer = await fetchCardImage('Charizard', 'Base Set');

      expect(imageBuffer).not.toBeNull();
      expect(Buffer.isBuffer(imageBuffer)).toBe(true);
      expect(imageBuffer!.length).toBeGreaterThan(1000); // Real image should be substantial

      writeFileSync('/tmp/test-charizard.png', imageBuffer!);
      console.log(`✓ Fetched real Charizard image (${imageBuffer!.length} bytes, saved to /tmp/test-charizard.png)`);
    }, 30000); // 30 second timeout

    it('should fetch real Pikachu image', async () => {
      const imageBuffer = await fetchCardImage('Pikachu');

      expect(imageBuffer).not.toBeNull();
      expect(Buffer.isBuffer(imageBuffer)).toBe(true);

      writeFileSync('/tmp/test-pikachu.png', imageBuffer!);
      console.log(`✓ Fetched real Pikachu image (${imageBuffer!.length} bytes)`);
    }, 30000);

    it('should fetch real Mewtwo image', async () => {
      const imageBuffer = await fetchCardImage('Mewtwo', 'Base Set');

      expect(imageBuffer).not.toBeNull();
      expect(Buffer.isBuffer(imageBuffer)).toBe(true);

      console.log(`✓ Fetched real Mewtwo image (${imageBuffer!.length} bytes)`);
    }, 30000);

    it('should handle non-existent card gracefully', async () => {
      const imageBuffer = await fetchCardImage('NonExistentCard12345', 'FakeSet');

      // Should return null for non-existent cards
      expect(imageBuffer).toBeNull();

      console.log('✓ Handled non-existent card correctly (returned null)');
    }, 30000);
  });

  describe('createCardOverlay - Real Image Processing', () => {
    it('should create real overlay on Charizard image', async () => {
      const cardImage = await fetchCardImage('Charizard', 'Base Set');
      expect(cardImage).not.toBeNull();

      const mockAnalysis = {
        signal: 'BUY' as const,
        conviction: 85,
        avgScore: 0.75,
        avgConfidence: 0.88,
        agreement: 0.92,
        reasoning: 'Strong buy signal with high conviction',
        card: {
          name: 'Charizard',
          setName: 'Base Set',
          grade: '9',
          gradeCompany: 'PSA'
        },
        pricing: {
          listed: 850,
          fairValue: 1000,
          discount: 15,
          lowestAvailable: 900
        },
        market: {
          salesCount: 150,
          avgVolume30d: 50000,
          priceChange7d: 5.2,
          priceChange30d: 12.8
        }
      };

      const result = await createCardOverlay(cardImage!, mockAnalysis);

      expect(Buffer.isBuffer(result)).toBe(true);
      expect(result.length).toBeGreaterThan(1000);

      writeFileSync('/tmp/test-charizard-overlay.png', result);
      console.log(`✓ Created real overlay on Charizard (${result.length} bytes, saved to /tmp/test-charizard-overlay.png)`);
    }, 30000);
  });

  describe('combineImages - Real Image Composition', () => {
    it('should combine real card and chart images', async () => {
      const cardImage = await fetchCardImage('Pikachu');
      expect(cardImage).not.toBeNull();

      const history = generateMockPriceHistory(50, 30);
      const chartSvg = await generatePriceChart(history, 'BULLISH');

      // Convert SVG to buffer for combination
      const chartBuffer = Buffer.from(chartSvg);

      const combined = await combineImages(cardImage!, chartBuffer);

      expect(Buffer.isBuffer(combined)).toBe(true);
      expect(combined.length).toBeGreaterThan(1000);

      writeFileSync('/tmp/test-combined.png', combined);
      console.log(`✓ Combined real card and chart images (${combined.length} bytes, saved to /tmp/test-combined.png)`);
    }, 30000);
  });

  describe('generateTwitterImage - Full Pipeline', () => {
    it('should generate complete Twitter image from real data', async () => {
      const mockAnalysis = {
        signal: 'BUY' as const,
        conviction: 75,
        avgScore: 0.7,
        avgConfidence: 0.85,
        agreement: 0.9,
        reasoning: 'Solid buy signal with good fundamentals',
        card: {
          name: 'Charizard',
          setName: 'Base Set',
          grade: '9',
          gradeCompany: 'PSA'
        },
        pricing: {
          listed: 850,
          fairValue: 1000,
          discount: 15,
          lowestAvailable: 900
        },
        market: {
          salesCount: 100,
          avgVolume30d: 40000,
          priceChange7d: 3.5,
          priceChange30d: 10.2
        }
      };

      const twitterImage = await generateTwitterImage(mockAnalysis);

      expect(Buffer.isBuffer(twitterImage)).toBe(true);
      expect(twitterImage.length).toBeGreaterThan(5000); // Full Twitter image should be substantial

      writeFileSync('/tmp/test-twitter-full.png', twitterImage);
      console.log(`✓ Generated complete Twitter image (${twitterImage.length} bytes, saved to /tmp/test-twitter-full.png)`);
      console.log(`  Card: ${mockAnalysis.card.name} - ${mockAnalysis.card.setName}`);
      console.log(`  Signal: ${mockAnalysis.signal} (${mockAnalysis.conviction}% conviction)`);
      console.log(`  Price: $${mockAnalysis.pricing.listed} (${mockAnalysis.pricing.discount}% discount)`);
    }, 60000); // 60 second timeout for full pipeline

    it('should generate Twitter image for PASS signal', async () => {
      const mockAnalysis = {
        signal: 'PASS' as const,
        conviction: 80,
        avgScore: -0.7,
        avgConfidence: 0.88,
        agreement: 0.85,
        reasoning: 'Overpriced - avoid',
        card: {
          name: 'Pikachu',
          setName: 'Jungle'
        },
        pricing: {
          listed: 120,
          fairValue: 80,
          discount: -50
        },
        market: {
          salesCount: 50,
          avgVolume30d: 15000,
          priceChange7d: -5.2,
          priceChange30d: -10.5
        }
      };

      const twitterImage = await generateTwitterImage(mockAnalysis);

      expect(Buffer.isBuffer(twitterImage)).toBe(true);
      writeFileSync('/tmp/test-twitter-pass.png', twitterImage);
      console.log(`✓ Generated PASS signal Twitter image (saved to /tmp/test-twitter-pass.png)`);
    }, 60000);

    it('should generate Twitter image for WATCH signal', async () => {
      const mockAnalysis = {
        signal: 'WATCH' as const,
        conviction: 50,
        avgScore: 0.2,
        avgConfidence: 0.6,
        agreement: 0.7,
        reasoning: 'Mixed signals - monitor',
        card: {
          name: 'Mewtwo'
        },
        pricing: {
          listed: 200,
          fairValue: 210,
          discount: 5
        },
        market: {
          salesCount: 30,
          avgVolume30d: 12000,
          priceChange7d: 1.2,
          priceChange30d: -2.3
        }
      };

      const twitterImage = await generateTwitterImage(mockAnalysis);

      expect(Buffer.isBuffer(twitterImage)).toBe(true);
      writeFileSync('/tmp/test-twitter-watch.png', twitterImage);
      console.log(`✓ Generated WATCH signal Twitter image (saved to /tmp/test-twitter-watch.png)`);
    }, 60000);
  });
});
