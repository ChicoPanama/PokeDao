import { describe, it, expect, vi, beforeAll } from 'vitest';
import {
  fetchCardImage,
  createCardOverlay,
  generatePriceChart,
  combineImages,
  generateTwitterImage,
  generateMockPriceHistory,
} from '../image-generator.js';
import type { AIAnalysisResult } from '../ai-ensemble.js';
import sharp from 'sharp';
import * as fs from 'fs';
import * as path from 'path';

describe('Image Generator - Full Coverage', () => {
  const IMAGES_DIR = path.join(process.cwd(), 'data', 'images');

  beforeAll(() => {
    // Ensure images directory exists
    if (!fs.existsSync(IMAGES_DIR)) {
      fs.mkdirSync(IMAGES_DIR, { recursive: true });
    }
  });

  const mockAnalysisResult: AIAnalysisResult = {
    card: {
      name: 'Charizard',
      setName: 'Base Set',
    },
    pricing: {
      listed: 100,
      fairValue: 120,
      discount: -16.67,
    },
    market: {
      salesCount: 50,
      avgVolume30d: 10,
      priceChange7d: 5,
      priceChange30d: 15,
    },
    recommendation: 'BUY',
    convictionScore: 85,
    alphaSignalStrength: 15,
    mew1aAnalysis: {
      model: 'mew1a-llama-3.2',
      recommendation: 'BUY',
      reasoning: 'Strong buy',
      confidence: 90,
      responseTime: 1000,
    },
    quickAnalysis: {
      model: 'ollama-qwen',
      sentiment: 'bullish',
      keyPoints: ['Good discount', 'High volume'],
      confidence: 85,
      responseTime: 500,
    },
    deepAnalysis: {
      model: 'deepseek-r1',
      investmentThesis: 'Strong opportunity',
      riskFactors: ['Market risk'],
      catalysts: ['New release'],
      priceTarget: 150,
      timeHorizon: '6mo',
      confidence: 88,
      responseTime: 2000,
    },
    redditSentiment: {
      sentiment: 'BULLISH',
      score: 0.7,
      confidence: 0.8,
      discussionVolume: 5,
      topPosts: [],
    },
    ensemble: {
      agreementLevel: 0.9,
      conflictingSignals: [],
      finalVerdict: 'Strong consensus',
    },
    liquidityAdjustedFV: 115,
    sellProbability: 0.9,
    daysToSell: 3,
    whaleActivity: false,
  };

  describe('fetchCardImage', () => {
    it('should fetch card image successfully', async () => {
      const originalFetch = global.fetch;
      const mockImageData = await sharp({
        create: {
          width: 100,
          height: 100,
          channels: 3,
          background: { r: 255, g: 0, b: 0 },
        },
      })
        .png()
        .toBuffer();

      global.fetch = vi.fn()
        // Pokemon TCG API search
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            data: [
              {
                id: 'base1-4',
                name: 'Charizard',
                images: {
                  small: 'https://images.pokemontcg.io/base1/4.png',
                  large: 'https://images.pokemontcg.io/base1/4_hires.png',
                },
              },
            ],
          }),
        })
        // Image download
        .mockResolvedValueOnce({
          ok: true,
          arrayBuffer: async () => mockImageData.buffer,
        });

      const buffer = await fetchCardImage('Charizard', 'Base Set');

      expect(buffer).toBeDefined();
      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer!.length).toBeGreaterThan(0);

      global.fetch = originalFetch;
    }, 30000);

    it('should return null when Pokemon TCG API fails', async () => {
      const originalFetch = global.fetch;
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const buffer = await fetchCardImage('NonExistent', 'NonExistent');

      expect(buffer).toBeNull();
      expect(consoleWarnSpy).toHaveBeenCalledWith('Pokemon TCG API error: 500');

      consoleWarnSpy.mockRestore();
      global.fetch = originalFetch;
    });

    it('should return null when no card found', async () => {
      const originalFetch = global.fetch;
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [],
        }),
      });

      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const buffer = await fetchCardImage('NonExistent');

      expect(buffer).toBeNull();
      expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('No card image found'));

      consoleWarnSpy.mockRestore();
      global.fetch = originalFetch;
    });

    it('should return null when image download fails', async () => {
      const originalFetch = global.fetch;
      global.fetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            data: [
              {
                images: {
                  large: 'https://example.com/image.png',
                },
              },
            ],
          }),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 404,
        });

      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const buffer = await fetchCardImage('Charizard');

      expect(buffer).toBeNull();
      expect(consoleWarnSpy).toHaveBeenCalledWith('Failed to download card image: 404');

      consoleWarnSpy.mockRestore();
      global.fetch = originalFetch;
    });

    it('should handle fetch errors gracefully', async () => {
      const originalFetch = global.fetch;
      global.fetch = vi.fn().mockRejectedValueOnce(new Error('Network error'));

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const buffer = await fetchCardImage('Charizard');

      expect(buffer).toBeNull();
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Error fetching card image'));

      consoleErrorSpy.mockRestore();
      global.fetch = originalFetch;
    });
  });

  describe('createCardOverlay', () => {
    it('should create STRONG_BUY overlay (green)', async () => {
      const mockCard = await sharp({
        create: {
          width: 488,
          height: 680,
          channels: 3,
          background: { r: 255, g: 255, b: 255 },
        },
      })
        .png()
        .toBuffer();

      const result = await createCardOverlay(mockCard, {
        ...mockAnalysisResult,
        recommendation: 'STRONG_BUY',
        pricing: { ...mockAnalysisResult.pricing, discount: -20 },
      });

      expect(result).toBeInstanceOf(Buffer);
      expect(result.length).toBeGreaterThan(0);

      // Verify it's a valid PNG
      const metadata = await sharp(result).metadata();
      expect(metadata.format).toBe('png');
      expect(metadata.width).toBe(488);
      expect(metadata.height).toBe(680);
    }, 10000);

    it('should create BUY overlay (blue)', async () => {
      const mockCard = await sharp({
        create: {
          width: 488,
          height: 680,
          channels: 3,
          background: { r: 255, g: 255, b: 255 },
        },
      })
        .png()
        .toBuffer();

      const result = await createCardOverlay(mockCard, {
        ...mockAnalysisResult,
        recommendation: 'BUY',
      });

      expect(result).toBeInstanceOf(Buffer);
      const metadata = await sharp(result).metadata();
      expect(metadata.format).toBe('png');
    });

    it('should create HOLD overlay (yellow)', async () => {
      const mockCard = await sharp({
        create: {
          width: 488,
          height: 680,
          channels: 3,
          background: { r: 255, g: 255, b: 255 },
        },
      })
        .png()
        .toBuffer();

      const result = await createCardOverlay(mockCard, {
        ...mockAnalysisResult,
        recommendation: 'HOLD',
      });

      expect(result).toBeInstanceOf(Buffer);
      const metadata = await sharp(result).metadata();
      expect(metadata.format).toBe('png');
    });

    it('should create SELL/PASS overlay (red)', async () => {
      const mockCard = await sharp({
        create: {
          width: 488,
          height: 680,
          channels: 3,
          background: { r: 255, g: 255, b: 255 },
        },
      })
        .png()
        .toBuffer();

      const result = await createCardOverlay(mockCard, {
        ...mockAnalysisResult,
        recommendation: 'SELL',
      });

      expect(result).toBeInstanceOf(Buffer);
      const metadata = await sharp(result).metadata();
      expect(metadata.format).toBe('png');
    });

    it('should handle positive discount (above FV)', async () => {
      const mockCard = await sharp({
        create: {
          width: 488,
          height: 680,
          channels: 3,
          background: { r: 255, g: 255, b: 255 },
        },
      })
        .png()
        .toBuffer();

      const result = await createCardOverlay(mockCard, {
        ...mockAnalysisResult,
        pricing: { ...mockAnalysisResult.pricing, discount: 25 },
      });

      expect(result).toBeInstanceOf(Buffer);
    });
  });

  describe('generatePriceChart', () => {
    it('should generate price chart with trend data', async () => {
      const priceHistory = [
        { date: new Date('2024-01-01'), price: 100 },
        { date: new Date('2024-01-15'), price: 110 },
        { date: new Date('2024-01-30'), price: 120 },
      ];

      const buffer = await generatePriceChart('Charizard', priceHistory);

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);

      const metadata = await sharp(buffer).metadata();
      expect(metadata.format).toBe('png');
      expect(metadata.width).toBe(800);
      expect(metadata.height).toBe(400);
    });

    it('should handle single data point', async () => {
      const priceHistory = [{ date: new Date('2024-01-01'), price: 100 }];

      const buffer = await generatePriceChart('Pikachu', priceHistory);

      expect(buffer).toBeInstanceOf(Buffer);
      const metadata = await sharp(buffer).metadata();
      expect(metadata.format).toBe('png');
    });

    it('should handle 30-day history', async () => {
      const priceHistory = generateMockPriceHistory(100, 30);

      const buffer = await generatePriceChart('Mewtwo', priceHistory);

      expect(buffer).toBeInstanceOf(Buffer);
      const metadata = await sharp(buffer).metadata();
      expect(metadata.width).toBe(800);
      expect(metadata.height).toBe(400);
    });
  });

  describe('combineImages', () => {
    it('should combine card and chart images', async () => {
      const cardBuffer = await sharp({
        create: {
          width: 488,
          height: 680,
          channels: 3,
          background: { r: 255, g: 0, b: 0 },
        },
      })
        .png()
        .toBuffer();

      const chartBuffer = await sharp({
        create: {
          width: 800,
          height: 400,
          channels: 3,
          background: { r: 0, g: 255, b: 0 },
        },
      })
        .png()
        .toBuffer();

      const combined = await combineImages(cardBuffer, chartBuffer);

      expect(combined).toBeInstanceOf(Buffer);

      const metadata = await sharp(combined).metadata();
      expect(metadata.format).toBe('png');
      expect(metadata.width).toBe(1200);
      expect(metadata.height).toBe(675);
    });
  });

  describe('generateTwitterImage', () => {
    it('should generate complete Twitter image with price history', async () => {
      const originalFetch = global.fetch;
      const mockImageData = await sharp({
        create: {
          width: 488,
          height: 680,
          channels: 3,
          background: { r: 255, g: 0, b: 0 },
        },
      })
        .png()
        .toBuffer();

      global.fetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            data: [
              {
                images: {
                  large: 'https://example.com/charizard.png',
                },
              },
            ],
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          arrayBuffer: async () => mockImageData.buffer,
        });

      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const priceHistory = generateMockPriceHistory(100, 30);
      const result = await generateTwitterImage(mockAnalysisResult, priceHistory);

      expect(result).toBeDefined();
      expect(result.imagePath).toContain('Charizard');
      expect(result.imagePath.endsWith('.png')).toBe(true);
      expect(result.buffer).toBeInstanceOf(Buffer);
      expect(fs.existsSync(result.imagePath)).toBe(true);

      // Cleanup
      fs.unlinkSync(result.imagePath);

      consoleLogSpy.mockRestore();
      global.fetch = originalFetch;
    }, 30000);

    it('should generate Twitter image without price history', async () => {
      const originalFetch = global.fetch;
      const mockImageData = await sharp({
        create: {
          width: 488,
          height: 680,
          channels: 3,
          background: { r: 255, g: 0, b: 0 },
        },
      })
        .png()
        .toBuffer();

      global.fetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            data: [
              {
                images: {
                  large: 'https://example.com/pikachu.png',
                },
              },
            ],
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          arrayBuffer: async () => mockImageData.buffer,
        });

      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const pikachuResult = {
        ...mockAnalysisResult,
        card: {
          ...mockAnalysisResult.card,
          name: 'Pikachu',
        },
      };

      const result = await generateTwitterImage(pikachuResult);

      expect(result).toBeDefined();
      expect(result.imagePath).toContain('Pikachu');
      expect(fs.existsSync(result.imagePath)).toBe(true);

      // Cleanup
      fs.unlinkSync(result.imagePath);

      consoleLogSpy.mockRestore();
      global.fetch = originalFetch;
    }, 30000);

    it('should throw error when card image fetch fails', async () => {
      const originalFetch = global.fetch;
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      await expect(generateTwitterImage(mockAnalysisResult)).rejects.toThrow(
        'Failed to fetch card image for Charizard'
      );

      consoleLogSpy.mockRestore();
      consoleWarnSpy.mockRestore();
      global.fetch = originalFetch;
    });
  });

  describe('generateMockPriceHistory', () => {
    it('should generate 30-day price history by default', () => {
      const history = generateMockPriceHistory(100);

      expect(history).toHaveLength(31); // 0 to 30 days = 31 entries
      // Price should be within variance range (±20%)
      expect(history[0].price).toBeGreaterThan(80);
      expect(history[0].price).toBeLessThan(120);
      expect(history[0].date).toBeInstanceOf(Date);
    });

    it('should generate custom day range', () => {
      const history = generateMockPriceHistory(50, 7);

      expect(history).toHaveLength(8); // 0 to 7 days = 8 entries
      expect(history[0].price).toBeCloseTo(50, -1);
    });

    it('should add price variance', () => {
      const history = generateMockPriceHistory(100, 10);

      // Check that prices vary
      const prices = history.map(h => h.price);
      const allSame = prices.every(p => p === prices[0]);
      expect(allSame).toBe(false);

      // Check variance is within ±10%
      prices.forEach(price => {
        expect(price).toBeGreaterThan(80);
        expect(price).toBeLessThan(120);
      });
    });

    it('should have chronological dates', () => {
      const history = generateMockPriceHistory(100, 5);

      for (let i = 1; i < history.length; i++) {
        expect(history[i].date.getTime()).toBeGreaterThan(history[i - 1].date.getTime());
      }
    });
  });
});
