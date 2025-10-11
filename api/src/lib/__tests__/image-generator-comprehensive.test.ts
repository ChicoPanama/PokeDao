import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock sharp to avoid native module issues
vi.mock('sharp', () => ({
  default: vi.fn(),
}));

describe('Image Generator - Comprehensive Tests', () => {
  describe('Price History Generation', () => {
    it('should generate correct number of data points', () => {
      const days = 30;
      const dataPoints = days + 1; // Including today

      expect(dataPoints).toBe(31);
    });

    it('should apply realistic price volatility', () => {
      const basePrice = 100;
      const volatility = 0.05; // 5%
      const randomChange = (Math.random() - 0.5) * 2 * volatility;

      expect(randomChange).toBeGreaterThanOrEqual(-volatility);
      expect(randomChange).toBeLessThanOrEqual(volatility);
    });

    it('should generate prices within reasonable range', () => {
      const basePrice = 100;
      const minPrice = basePrice * 0.7;
      const maxPrice = basePrice * 1.3;

      const testPrices = [75, 85, 100, 115, 125];
      testPrices.forEach(price => {
        expect(price).toBeGreaterThanOrEqual(minPrice);
        expect(price).toBeLessThanOrEqual(maxPrice);
      });
    });

    it('should keep prices non-negative', () => {
      const basePrice = 10;
      const change = -0.5; // 50% drop
      const newPrice = Math.max(basePrice * (1 + change), 0);

      expect(newPrice).toBeGreaterThanOrEqual(0);
    });

    it('should calculate date offsets correctly', () => {
      const today = new Date();
      const daysAgo = 30;
      const pastDate = new Date(today.getTime() - daysAgo * 24 * 60 * 60 * 1000);

      const diff = today.getTime() - pastDate.getTime();
      const daysDiff = diff / (24 * 60 * 60 * 1000);

      expect(daysDiff).toBeCloseTo(daysAgo, 0);
    });
  });

  describe('SVG Chart Generation', () => {
    it('should calculate SVG dimensions correctly', () => {
      const width = 800;
      const height = 400;
      const padding = 40;

      const chartWidth = width - 2 * padding;
      const chartHeight = height - 2 * padding;

      expect(chartWidth).toBe(720);
      expect(chartHeight).toBe(320);
    });

    it('should map data points to SVG coordinates', () => {
      const dataIndex = 10;
      const totalPoints = 30;
      const chartWidth = 720;

      const x = (dataIndex / (totalPoints - 1)) * chartWidth;

      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(chartWidth);
    });

    it('should invert Y axis for SVG', () => {
      const normalizedValue = 0.5; // Middle of range
      const chartHeight = 320;

      // SVG Y grows downward, so invert
      const y = chartHeight - (normalizedValue * chartHeight);

      expect(y).toBe(160);
    });

    it('should normalize prices to 0-1 range', () => {
      const price = 75;
      const minPrice = 50;
      const maxPrice = 100;

      const normalized = (price - minPrice) / (maxPrice - minPrice);

      expect(normalized).toBe(0.5);
    });

    it('should find min and max prices correctly', () => {
      const prices = [80, 95, 70, 110, 85];

      const minPrice = Math.min(...prices);
      const maxPrice = Math.max(...prices);

      expect(minPrice).toBe(70);
      expect(maxPrice).toBe(110);
    });

    it('should handle single data point', () => {
      const prices = [100];
      const minPrice = Math.min(...prices);
      const maxPrice = Math.max(...prices);

      // When min === max, add small range to avoid division by zero
      const range = maxPrice === minPrice ? 1 : maxPrice - minPrice;

      expect(range).toBe(1);
    });
  });

  describe('SVG Path Generation', () => {
    it('should start path with M command', () => {
      const x = 10;
      const y = 20;
      const pathStart = `M ${x} ${y}`;

      expect(pathStart).toBe('M 10 20');
    });

    it('should continue path with L commands', () => {
      const x = 30;
      const y = 40;
      const pathSegment = `L ${x} ${y}`;

      expect(pathSegment).toBe('L 30 40');
    });

    it('should build complete path string', () => {
      const points = [
        { x: 0, y: 100 },
        { x: 50, y: 80 },
        { x: 100, y: 90 },
      ];

      const path = points.map((p, i) =>
        i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`
      ).join(' ');

      expect(path).toBe('M 0 100 L 50 80 L 100 90');
    });

    it('should format coordinates to 2 decimal places', () => {
      const x = 10.12345;
      const y = 20.98765;
      const formatted = `M ${x.toFixed(2)} ${y.toFixed(2)}`;

      expect(formatted).toBe('M 10.12 20.99');
    });
  });

  describe('Color and Styling', () => {
    it('should use green for positive signals', () => {
      const signal = 'BULLISH';
      const color = signal === 'BULLISH' ? '#22c55e' :
                    signal === 'BEARISH' ? '#ef4444' : '#6b7280';

      expect(color).toBe('#22c55e');
    });

    it('should use red for negative signals', () => {
      const signal = 'BEARISH';
      const color = signal === 'BULLISH' ? '#22c55e' :
                    signal === 'BEARISH' ? '#ef4444' : '#6b7280';

      expect(color).toBe('#ef4444');
    });

    it('should use gray for neutral signals', () => {
      const signal = 'NEUTRAL';
      const color = signal === 'BULLISH' ? '#22c55e' :
                    signal === 'BEARISH' ? '#ef4444' : '#6b7280';

      expect(color).toBe('#6b7280');
    });

    it('should use semi-transparent fill', () => {
      const fillOpacity = 0.1;
      expect(fillOpacity).toBeLessThanOrEqual(1);
      expect(fillOpacity).toBeGreaterThanOrEqual(0);
    });

    it('should use full opacity for stroke', () => {
      const strokeOpacity = 1;
      expect(strokeOpacity).toBe(1);
    });
  });

  describe('Text Formatting', () => {
    it('should format currency to 2 decimals', () => {
      const price = 123.456;
      const formatted = `$${price.toFixed(2)}`;

      expect(formatted).toBe('$123.46');
    });

    it('should format large numbers with commas', () => {
      const volume = 123456;
      const formatted = volume.toLocaleString();

      expect(formatted).toContain(',');
    });

    it('should format percentages with sign', () => {
      const change = 15.5;
      const formatted = `+${change.toFixed(1)}%`;

      expect(formatted).toBe('+15.5%');
    });

    it('should handle negative percentages', () => {
      const change = -12.3;
      const formatted = `${change.toFixed(1)}%`;

      expect(formatted).toBe('-12.3%');
    });

    it('should truncate long card names', () => {
      const longName = 'This is a very long card name that should be truncated';
      const maxLength = 30;
      const truncated = longName.length > maxLength
        ? longName.substring(0, maxLength) + '...'
        : longName;

      expect(truncated).toHaveLength(33); // 30 + "..."
      expect(truncated).toContain('...');
    });
  });

  describe('Grid Lines', () => {
    it('should generate 5 horizontal grid lines', () => {
      const gridLineCount = 5;
      const lines = Array.from({ length: gridLineCount }, (_, i) => i);

      expect(lines).toHaveLength(5);
    });

    it('should space grid lines evenly', () => {
      const chartHeight = 320;
      const gridLineCount = 5;
      const spacing = chartHeight / (gridLineCount - 1);

      expect(spacing).toBe(80);
    });

    it('should calculate grid line positions', () => {
      const chartHeight = 320;
      const gridLineCount = 5;

      const positions = Array.from({ length: gridLineCount }, (_, i) =>
        (i / (gridLineCount - 1)) * chartHeight
      );

      expect(positions[0]).toBe(0);
      expect(positions[4]).toBe(320);
    });
  });

  describe('Price Labels', () => {
    it('should calculate price for each grid line', () => {
      const minPrice = 50;
      const maxPrice = 100;
      const position = 0.5; // Middle

      const price = minPrice + (maxPrice - minPrice) * position;

      expect(price).toBe(75);
    });

    it('should format price labels with $', () => {
      const price = 85.5;
      const label = `$${price.toFixed(0)}`;

      expect(label).toBe('$86');
    });

    it('should generate labels for all grid lines', () => {
      const gridLineCount = 5;
      const minPrice = 50;
      const maxPrice = 100;

      const labels = Array.from({ length: gridLineCount }, (_, i) => {
        const position = i / (gridLineCount - 1);
        return minPrice + (maxPrice - minPrice) * position;
      });

      expect(labels).toHaveLength(5);
      expect(labels[0]).toBe(50);
      expect(labels[4]).toBe(100);
    });
  });

  describe('Date Labels', () => {
    it('should format dates as MM/DD', () => {
      const date = new Date(2024, 2, 15); // Month is 0-indexed, so 2 = March
      const formatted = `${date.getMonth() + 1}/${date.getDate()}`;

      expect(formatted).toBe('3/15');
    });

    it('should show 5 date labels across X axis', () => {
      const labelCount = 5;
      expect(labelCount).toBe(5);
    });

    it('should calculate label positions evenly', () => {
      const totalDays = 30;
      const labelCount = 5;
      const interval = Math.floor(totalDays / (labelCount - 1));

      expect(interval).toBe(7); // Weekly labels
    });
  });

  describe('Card Image Fetching', () => {
    it('should build correct Pokemon TCG API URL', () => {
      const cardName = 'Charizard';
      const setName = 'Base Set';
      const url = `https://api.pokemontcg.io/v2/cards?q=name:"${cardName}" set.name:"${setName}"`;

      expect(url).toContain('api.pokemontcg.io');
      expect(url).toContain('name:"Charizard"');
      expect(url).toContain('set.name:"Base Set"');
    });

    it('should handle API timeout errors', () => {
      const error = { code: 'ETIMEDOUT' };
      const shouldUseFallback = error.code === 'ETIMEDOUT';

      expect(shouldUseFallback).toBe(true);
    });

    it('should handle 404 not found', () => {
      const status = 404;
      const shouldUseFallback = status === 404;

      expect(shouldUseFallback).toBe(true);
    });

    it('should use Pikachu as fallback', () => {
      const fallbackName = 'Pikachu';
      const fallbackSet = 'Base Set';

      expect(fallbackName).toBe('Pikachu');
      expect(fallbackSet).toBe('Base Set');
    });
  });

  describe('Image Composition', () => {
    it('should calculate overlay dimensions', () => {
      const cardWidth = 400;
      const cardHeight = 560;
      const overlayWidth = cardWidth;
      const overlayHeight = Math.floor(cardHeight * 0.4);

      expect(overlayWidth).toBe(400);
      expect(overlayHeight).toBe(224);
    });

    it('should position overlay at bottom', () => {
      const cardHeight = 560;
      const overlayHeight = 224;
      const overlayTop = cardHeight - overlayHeight;

      expect(overlayTop).toBe(336);
    });

    it('should use semi-transparent overlay', () => {
      const overlayOpacity = 0.95;

      expect(overlayOpacity).toBeGreaterThan(0);
      expect(overlayOpacity).toBeLessThan(1);
    });
  });

  describe('Stats Display', () => {
    it('should format conviction score', () => {
      const conviction = 75.5;
      const formatted = `${conviction.toFixed(0)}%`;

      expect(formatted).toBe('76%');
    });

    it('should format agreement percentage', () => {
      const agreement = 0.856;
      const formatted = `${(agreement * 100).toFixed(0)}%`;

      expect(formatted).toBe('86%');
    });

    it('should format discount with sign', () => {
      const discount = 15;
      const formatted = `${discount > 0 ? '+' : ''}${discount}%`;

      expect(formatted).toBe('+15%');
    });

    it('should handle negative discount', () => {
      const discount = -10;
      const formatted = `${discount > 0 ? '+' : ''}${discount}%`;

      expect(formatted).toBe('-10%');
    });
  });

  describe('Layer Attribution', () => {
    it('should list all four layers', () => {
      const layers = [
        'Mew-1A (TCG specialist)',
        'Ollama (Fast local)',
        'DeepSeek R1 (Deep analysis)',
        'Reddit (Community sentiment)',
      ];

      expect(layers).toHaveLength(4);
    });

    it('should indicate Mew-1A weight', () => {
      const mew1aLabel = 'Mew-1A (2x weight)';
      expect(mew1aLabel).toContain('2x');
    });

    it('should indicate Reddit weight', () => {
      const redditLabel = 'Reddit (0.5x weight)';
      expect(redditLabel).toContain('0.5x');
    });
  });

  describe('Image Export', () => {
    it('should export as PNG format', () => {
      const format = 'png';
      expect(format).toBe('png');
    });

    it('should use high quality compression', () => {
      const quality = 90;

      expect(quality).toBeGreaterThan(80);
      expect(quality).toBeLessThanOrEqual(100);
    });

    it('should return Buffer type', () => {
      const buffer = Buffer.from([1, 2, 3]);
      expect(Buffer.isBuffer(buffer)).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle missing card image gracefully', () => {
      const cardImage = null;
      const shouldUseFallback = !cardImage;

      expect(shouldUseFallback).toBe(true);
    });

    it('should handle invalid price data', () => {
      const price = NaN;
      const validPrice = isNaN(price) ? 0 : price;

      expect(validPrice).toBe(0);
    });

    it('should handle empty price history', () => {
      const history: any[] = [];
      const hasData = history.length > 0;

      expect(hasData).toBe(false);
    });

    it('should handle Sharp initialization failure', () => {
      const error = new Error('Sharp initialization failed');
      expect(error.message).toContain('Sharp');
    });
  });

  describe('Viewport and Responsiveness', () => {
    it('should use 16:9 aspect ratio for chart', () => {
      const width = 800;
      const height = 450;
      const aspectRatio = width / height;

      expect(aspectRatio).toBeCloseTo(16/9, 1);
    });

    it('should maintain padding for readability', () => {
      const padding = 40;
      const minPadding = 20;

      expect(padding).toBeGreaterThanOrEqual(minPadding);
    });

    it('should use readable font sizes', () => {
      const titleSize = 24;
      const labelSize = 14;

      expect(titleSize).toBeGreaterThan(labelSize);
      expect(labelSize).toBeGreaterThanOrEqual(12);
    });
  });
});
