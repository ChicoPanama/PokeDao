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

  describe('generatePriceChart - Real PNG Generation', () => {
    it('should generate real PNG chart', async () => {
      const history = generateMockPriceHistory(100, 30);
      const chartBuffer = await generatePriceChart('Test Card', history);

      expect(Buffer.isBuffer(chartBuffer)).toBe(true);
      expect(chartBuffer.length).toBeGreaterThan(1000); // PNG should be substantial

      // Save for manual inspection
      writeFileSync('/tmp/test-chart.png', chartBuffer);
      console.log(`✓ Generated PNG chart (${chartBuffer.length} bytes, saved to /tmp/test-chart.png)`);
    });

    it('should generate charts for different price histories', async () => {
      const shortHistory = generateMockPriceHistory(50, 7);
      const longHistory = generateMockPriceHistory(200, 60);

      const shortChart = await generatePriceChart('Short Term Card', shortHistory);
      const longChart = await generatePriceChart('Long Term Card', longHistory);

      expect(Buffer.isBuffer(shortChart)).toBe(true);
      expect(Buffer.isBuffer(longChart)).toBe(true);

      writeFileSync('/tmp/test-chart-short.png', shortChart);
      writeFileSync('/tmp/test-chart-long.png', longChart);
      console.log('✓ Generated charts for different time periods');
    });

    it('should handle volatile price history', async () => {
      const history = generateMockPriceHistory(100, 30);
      const chartBuffer = await generatePriceChart('Volatile Card', history);

      expect(Buffer.isBuffer(chartBuffer)).toBe(true);
      writeFileSync('/tmp/test-chart-volatile.png', chartBuffer);
      console.log('✓ Generated chart for volatile price history');
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
        recommendation: 'STRONG_BUY' as const,
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
      const chartBuffer = await generatePriceChart('Pikachu', history);

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
        recommendation: 'BUY' as const,
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

      const result = await generateTwitterImage(mockAnalysis);

      expect(Buffer.isBuffer(result.buffer)).toBe(true);
      expect(result.buffer.length).toBeGreaterThan(5000); // Full Twitter image should be substantial
      expect(result.imagePath).toBeTruthy();

      writeFileSync('/tmp/test-twitter-full.png', result.buffer);
      console.log(`✓ Generated complete Twitter image (${result.buffer.length} bytes, saved to /tmp/test-twitter-full.png)`);
      console.log(`  Card: ${mockAnalysis.card.name} - ${mockAnalysis.card.setName}`);
      console.log(`  Signal: ${mockAnalysis.signal} (${mockAnalysis.conviction}% conviction)`);
      console.log(`  Price: $${mockAnalysis.pricing.listed} (${mockAnalysis.pricing.discount}% discount)`);
    }, 60000); // 60 second timeout for full pipeline

    it('should generate Twitter image for PASS signal', async () => {
      const mockAnalysis = {
        signal: 'PASS' as const,
        recommendation: 'SELL' as const,
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

      const result = await generateTwitterImage(mockAnalysis);

      expect(Buffer.isBuffer(result.buffer)).toBe(true);
      writeFileSync('/tmp/test-twitter-pass.png', result.buffer);
      console.log(`✓ Generated PASS signal Twitter image (saved to /tmp/test-twitter-pass.png)`);
    }, 60000);

    it('should generate Twitter image for WATCH signal', async () => {
      const mockAnalysis = {
        signal: 'WATCH' as const,
        recommendation: 'HOLD' as const,
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

      const result = await generateTwitterImage(mockAnalysis);

      expect(Buffer.isBuffer(result.buffer)).toBe(true);
      writeFileSync('/tmp/test-twitter-watch.png', result.buffer);
      console.log(`✓ Generated WATCH signal Twitter image (saved to /tmp/test-twitter-watch.png)`);
    }, 60000);
  });
});
