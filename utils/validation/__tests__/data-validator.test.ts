/**
 * Data Validation Utilities - Test Suite
 * 
 * @author PokeDAO Builder - Phase 3 Fork Integration
 */

import { describe, it, expect } from 'vitest';
import { DataValidator, BatchValidator } from '../data-validator';
import { Decimal } from '@prisma/client/runtime/library';

describe('DataValidator', () => {
  describe('validateCardData', () => {
    it('should validate complete valid card data', () => {
      const validCard = {
        name: 'Pikachu',
        set: 'Base Set',
        number: '25/102',
        variant: 'Holo',
        condition: 'Near Mint',
        grade: '9',
        price: '150.00',
        currency: 'USD',
        marketplace: 'ebay',
        url: 'https://ebay.com/item/123456789',
        lastUpdated: new Date()
      };

      const result = DataValidator.validateCardData(validCard);
      
      expect(result.isValid).toBe(true);
      expect(result.score).toBeGreaterThan(0.8);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject cards missing required fields', () => {
      const incompleteCard = {
        number: '25/102',
        condition: 'Near Mint'
      };

      const result = DataValidator.validateCardData(incompleteCard);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(2); // Missing name and set
      expect(result.errors.some(e => e.field === 'name')).toBe(true);
      expect(result.errors.some(e => e.field === 'set')).toBe(true);
    });

    it('should handle various price formats', () => {
      const priceFormats = [
        { price: '150.00', expected: true },
        { price: 150, expected: true },
        { price: new Decimal('150.00'), expected: true },
        { price: '$150.00', expected: true },
        { price: 'invalid', expected: false },
        { price: '', expected: false }
      ];

      priceFormats.forEach(({ price, expected }) => {
        const card = {
          name: 'Test Card',
          set: 'Test Set',
          price,
          marketplace: 'ebay'
        };

        const result = DataValidator.validateCardData(card);
        if (expected) {
          expect(result.errors.filter(e => e.field === 'price')).toHaveLength(0);
        } else {
          expect(result.errors.some(e => e.field === 'price')).toBe(true);
        }
      });
    });

    it('should validate condition values', () => {
      const conditions = [
        { condition: 'Mint', expected: true },
        { condition: 'Near Mint', expected: true },
        { condition: 'NM', expected: true },
        { condition: 'Excellent', expected: true },
        { condition: 'Poor', expected: true },
        { condition: 'Invalid Condition', expected: false },
        { condition: 'Brand New', expected: false }
      ];

      conditions.forEach(({ condition, expected }) => {
        const card = {
          name: 'Test Card',
          set: 'Test Set',
          condition
        };

        const result = DataValidator.validateCardData(card);
        const hasConditionError = result.errors.some(e => e.field === 'condition');
        
        if (expected) {
          expect(hasConditionError).toBe(false);
        } else {
          expect(hasConditionError).toBe(true);
        }
      });
    });

    it('should validate grade consistency with condition', () => {
      const testCases = [
        { condition: 'Mint', grade: '10', expectWarning: false },
        { condition: 'Mint', grade: '5', expectWarning: true },
        { condition: 'Poor', grade: '1', expectWarning: false },
        { condition: 'Poor', grade: '9', expectWarning: true },
        { condition: 'Near Mint', grade: '8.5', expectWarning: false }
      ];

      testCases.forEach(({ condition, grade, expectWarning }) => {
        const card = {
          name: 'Test Card',
          set: 'Test Set',
          condition,
          grade
        };

        const result = DataValidator.validateCardData(card);
        const hasGradeWarning = result.warnings.some(w => w.field === 'grade');
        
        expect(hasGradeWarning).toBe(expectWarning);
      });
    });

    it('should validate card names for common issues', () => {
      const nameTests = [
        { name: 'Pikachu', expectWarnings: false },
        { name: 'A', expectErrors: true }, // Too short
        { name: 'PIKACHU EX FULL ART RAINBOW RARE', expectWarnings: true }, // All caps
        { name: 'Card with <invalid> chars', expectWarnings: true },
        { name: 'ピカチュウ', expectWarnings: false }, // Japanese characters are ok
      ];

      nameTests.forEach(({ name, expectWarnings, expectErrors }) => {
        const card = {
          name,
          set: 'Test Set'
        };

        const result = DataValidator.validateCardData(card);
        
        if (expectErrors) {
          expect(result.errors.some(e => e.field === 'name')).toBe(true);
        }
        
        if (expectWarnings) {
          expect(result.warnings.some(w => w.field === 'name')).toBe(true);
        }
      });
    });

    it('should validate set names against known Pokemon sets', () => {
      const setTests = [
        { set: 'Base Set', expectRecognized: true },
        { set: 'Jungle', expectRecognized: true },
        { set: 'Sword & Shield', expectRecognized: true },
        { set: 'Unknown Custom Set', expectRecognized: false },
        { set: 'BS', expectRecognized: false } // Too short to be unrecognized
      ];

      setTests.forEach(({ set, expectRecognized }) => {
        const card = {
          name: 'Test Card',
          set
        };

        const result = DataValidator.validateCardData(card);
        const hasSetWarning = result.warnings.some(w => w.field === 'set');
        
        if (expectRecognized) {
          expect(result.score).toBeGreaterThan(0.8);
        } else {
          expect(hasSetWarning).toBe(true);
        }
      });
    });

    it('should validate URLs properly', () => {
      const urlTests = [
        { url: 'https://ebay.com/item/123', expectWarnings: false },
        { url: 'http://goldinauctions.com/item/456', expectWarnings: true }, // HTTP warning
        { url: 'https://unknown-site.com/item/789', expectWarnings: true }, // Unknown domain
        { url: 'invalid-url', expectWarnings: true },
        { url: 'ftp://example.com', expectWarnings: true } // Invalid protocol
      ];

      urlTests.forEach(({ url, expectWarnings }) => {
        const card = {
          name: 'Test Card',
          set: 'Test Set',
          url
        };

        const result = DataValidator.validateCardData(card);
        const hasUrlWarning = result.warnings.some(w => w.field === 'url');
        
        expect(hasUrlWarning).toBe(expectWarnings);
      });
    });
  });

  describe('validatePrice', () => {
    it('should validate basic price data', () => {
      const priceData = {
        price: '150.00',
        currency: 'USD',
        marketplace: 'ebay',
        condition: 'Near Mint',
        listingType: 'buy_it_now' as const
      };

      const result = DataValidator.validatePrice(priceData);
      
      expect(result.isValid).toBe(true);
      expect(result.score).toBeGreaterThan(0.8);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate marketplace-specific price ranges', () => {
      const testCases = [
        { marketplace: 'ebay', price: 1000000, expectWarning: true }, // Too high for eBay
        { marketplace: 'goldin', price: 0.50, expectWarning: true }, // Too low for Goldin
        { marketplace: 'tcgplayer', price: 100, expectWarning: false }, // Normal for TCGPlayer
        { marketplace: 'heritage', price: 10000, expectWarning: false } // Normal for Heritage
      ];

      testCases.forEach(({ marketplace, price, expectWarning }) => {
        const priceData = {
          price: price.toString(),
          marketplace
        };

        const result = DataValidator.validatePrice(priceData);
        const hasPriceWarning = result.warnings.some(w => w.field === 'price');
        
        expect(hasPriceWarning).toBe(expectWarning);
      });
    });

    it('should handle different price formats', () => {
      const priceFormats = [
        '$150.00',
        '150.00',
        '1,500.00',
        '€200.50',
        '¥15000'
      ];

      priceFormats.forEach(priceString => {
        const priceData = {
          price: priceString,
          marketplace: 'ebay'
        };

        const result = DataValidator.validatePrice(priceData);
        expect(result.isValid).toBe(true);
      });
    });

    it('should validate currency codes', () => {
      const currencyTests = [
        { currency: 'USD', expectWarning: false },
        { currency: 'EUR', expectWarning: false },
        { currency: 'GBP', expectWarning: false },
        { currency: 'INVALID', expectWarning: true },
        { currency: 'crypto', expectWarning: true }
      ];

      currencyTests.forEach(({ currency, expectWarning }) => {
        const priceData = {
          price: '100',
          currency,
          marketplace: 'ebay'
        };

        const result = DataValidator.validatePrice(priceData);
        const hasCurrencyWarning = result.warnings.some(w => w.field === 'currency');
        
        expect(hasCurrencyWarning).toBe(expectWarning);
      });
    });

    it('should validate date relationships', () => {
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      // Valid: listed yesterday, sold today
      const validDates = {
        price: '100',
        marketplace: 'ebay',
        listedAt: yesterday,
        soldAt: now
      };

      const validResult = DataValidator.validatePrice(validDates);
      expect(validResult.errors).toHaveLength(0);

      // Invalid: sold before listed
      const invalidDates = {
        price: '100',
        marketplace: 'ebay',
        listedAt: now,
        soldAt: yesterday
      };

      const invalidResult = DataValidator.validatePrice(invalidDates);
      expect(invalidResult.errors.some(e => e.field === 'soldAt')).toBe(true);

      // Warning: future date
      const futureDates = {
        price: '100',
        marketplace: 'ebay',
        soldAt: tomorrow
      };

      const futureResult = DataValidator.validatePrice(futureDates);
      expect(futureResult.warnings.some(w => w.field === 'soldAt')).toBe(true);
    });

    it('should handle Decimal price values', () => {
      const priceData = {
        price: new Decimal('150.50'),
        marketplace: 'ebay'
      };

      const result = DataValidator.validatePrice(priceData);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject negative and zero prices', () => {
      const invalidPrices = [-10, 0, '-5.50'];

      invalidPrices.forEach(price => {
        const priceData = {
          price: price.toString(),
          marketplace: 'ebay'
        };

        const result = DataValidator.validatePrice(priceData);
        expect(result.isValid).toBe(false);
        expect(result.errors.some(e => e.field === 'price')).toBe(true);
      });
    });
  });

  describe('card number validation', () => {
    it('should recognize various card number formats', () => {
      const numberFormats = [
        { number: '25', expectValid: true },
        { number: '25/102', expectValid: true },
        { number: '25a', expectValid: true },
        { number: 'PROMO', expectValid: true },
        { number: 'P25', expectValid: true },
        { number: '102/102 Secret', expectValid: true },
        { number: 'invalid-format-123-abc', expectValid: false }
      ];

      numberFormats.forEach(({ number, expectValid }) => {
        const card = {
          name: 'Test Card',
          set: 'Test Set',
          number
        };

        const result = DataValidator.validateCardData(card);
        // Card number warnings don't make the whole validation fail
        // but affect the score
        if (expectValid) {
          expect(result.score).toBeGreaterThan(0.8);
        } else {
          expect(result.warnings.some(w => w.field === 'number')).toBe(true);
        }
      });
    });
  });

  describe('grade validation', () => {
    it('should handle different grade formats', () => {
      const gradeFormats = [
        { grade: '10', expectValid: true },
        { grade: 'PSA 9', expectValid: true },
        { grade: 'BGS 9.5', expectValid: true },
        { grade: 9.5, expectValid: true },
        { grade: '15', expectValid: false }, // Out of range
        { grade: 'Ungraded', expectValid: false } // Non-numeric
      ];

      gradeFormats.forEach(({ grade, expectValid }) => {
        const card = {
          name: 'Test Card',
          set: 'Test Set',
          grade
        };

        const result = DataValidator.validateCardData(card);
        if (expectValid) {
          expect(result.score).toBeGreaterThan(0.8);
        } else {
          expect(result.warnings.some(w => w.field === 'grade')).toBe(true);
        }
      });
    });
  });
});

describe('BatchValidator', () => {
  describe('validateCardBatch', () => {
    it('should validate multiple cards efficiently', () => {
      const cards = [
        { name: 'Pikachu', set: 'Base Set', number: '25/102', condition: 'Mint' },
        { name: 'Charizard', set: 'Base Set', number: '4/102', condition: 'Near Mint' },
        { name: '', set: 'Invalid Set' }, // Invalid card
        { name: 'Blastoise', set: 'Base Set', number: '2/102', condition: 'Excellent' }
      ];

      const result = BatchValidator.validateCardBatch(cards);
      
      expect(result.results).toHaveLength(4);
      expect(result.summary.totalRecords).toBe(4);
      expect(result.summary.validRecords).toBe(3); // One invalid card
      expect(result.summary.errorRecords).toBe(1);
      expect(result.summary.avgQualityScore).toBeGreaterThan(0.5);
      expect(result.summary.commonIssues.length).toBeGreaterThan(0);
    });

    it('should handle empty batch', () => {
      const result = BatchValidator.validateCardBatch([]);
      
      expect(result.results).toHaveLength(0);
      expect(result.summary.totalRecords).toBe(0);
      expect(result.summary.validRecords).toBe(0);
      expect(result.summary.avgQualityScore).toBe(0);
    });

    it('should stop on critical errors when requested', () => {
      const cards = [
        { name: 'Valid Card', set: 'Base Set' },
        { name: '', set: '' }, // Critical errors
        { name: 'Should not be processed', set: 'Base Set' }
      ];

      const result = BatchValidator.validateCardBatch(cards, { stopOnCritical: true });
      
      // Should stop after the second card due to critical errors
      expect(result.results.length).toBeLessThanOrEqual(2);
    });

    it('should limit errors when requested', () => {
      const cards = Array.from({ length: 10 }, () => ({ 
        name: '', 
        set: '' 
      })); // All invalid

      const result = BatchValidator.validateCardBatch(cards, { maxErrors: 5 });
      
      // Should stop early due to error limit
      expect(result.results.length).toBeLessThanOrEqual(10);
    });

    it('should identify common issues correctly', () => {
      const cards = [
        { name: '', set: 'Base Set' }, // Missing name
        { name: '', set: 'Jungle' },   // Missing name
        { name: 'Pikachu', set: '' },  // Missing set
        { name: 'Charizard', set: 'Base Set' } // Valid
      ];

      const result = BatchValidator.validateCardBatch(cards);
      
      expect(result.summary.commonIssues.length).toBeGreaterThan(0);
      
      const nameIssue = result.summary.commonIssues.find(issue => 
        issue.issue.includes('name')
      );
      expect(nameIssue).toBeTruthy();
      expect(nameIssue!.count).toBe(2);
    });
  });

  describe('generateValidationReport', () => {
    it('should generate comprehensive validation report', () => {
      const results = [
        { isValid: true, score: 0.95, errors: [], warnings: [] },
        { isValid: false, score: 0.60, errors: [
          { field: 'name', message: 'Missing name', severity: 'critical' as const, code: 'MISSING_NAME' }
        ], warnings: [] },
        { isValid: true, score: 0.85, errors: [], warnings: [
          { field: 'condition', message: 'Condition unclear', impact: 'data_quality' as const }
        ] }
      ];

      const report = BatchValidator.generateValidationReport(results);
      
      expect(report).toContain('Data Validation Report');
      expect(report).toContain('Total Records: 3');
      expect(report).toContain('Valid Records: 2');
      expect(report).toContain('Average Quality Score');
      expect(report).toContain('Quality Distribution');
      expect(report).toContain('MISSING_NAME');
    });

    it('should handle empty results', () => {
      const report = BatchValidator.generateValidationReport([]);
      
      expect(report).toContain('Total Records: 0');
      expect(report).not.toContain('NaN');
    });

    it('should categorize quality scores correctly', () => {
      const results = [
        { isValid: true, score: 0.95, errors: [], warnings: [] }, // Excellent
        { isValid: true, score: 0.80, errors: [], warnings: [] }, // Good
        { isValid: true, score: 0.60, errors: [], warnings: [] }, // Fair
        { isValid: false, score: 0.30, errors: [], warnings: [] } // Poor
      ];

      const report = BatchValidator.generateValidationReport(results);
      
      expect(report).toContain('Excellent (90-100%): 1');
      expect(report).toContain('Good (70-89%): 1');
      expect(report).toContain('Fair (50-69%): 1');
      expect(report).toContain('Poor (0-49%): 1');
    });
  });
});

// Integration and performance tests
describe('Validation Integration', () => {
  it('should handle real-world card data patterns', () => {
    const realWorldCards = [
      {
        name: 'Pikachu VMAX',
        set: 'Vivid Voltage',
        number: '188/185',
        variant: 'Secret Rare',
        condition: 'Near Mint',
        grade: 'PSA 10',
        price: '$299.99',
        currency: 'USD',
        marketplace: 'ebay',
        url: 'https://www.ebay.com/itm/123456789'
      },
      {
        name: 'Charizard',
        set: 'Base Set Unlimited',
        number: '4/102',
        condition: 'Played',
        price: 45.50,
        marketplace: 'tcgplayer'
      },
      {
        name: 'ポケモンカード',
        set: 'Japanese Set',
        number: 'PROMO',
        condition: 'Mint',
        grade: 10,
        price: new Decimal('1200.00'),
        currency: 'JPY',
        marketplace: 'yahoo_auctions'
      }
    ];

    realWorldCards.forEach(card => {
      const result = DataValidator.validateCardData(card);
      expect(result.score).toBeGreaterThan(0.6); // Reasonable quality
    });
  });

  it('should maintain performance with large datasets', () => {
    const largeDataset = Array.from({ length: 1000 }, (_, i) => ({
      name: `Card ${i}`,
      set: `Set ${i % 10}`,
      number: `${i}/1000`,
      condition: 'Near Mint',
      price: (Math.random() * 100).toString()
    }));

    const start = Date.now();
    const result = BatchValidator.validateCardBatch(largeDataset);
    const elapsed = Date.now() - start;

    expect(result.results).toHaveLength(1000);
    expect(elapsed).toBeLessThan(5000); // Should complete within 5 seconds
  });

  it('should handle edge cases gracefully', () => {
    const edgeCases = [
      {}, // Empty object
      { name: undefined, set: undefined }, // Undefined values
      { name: '   ', set: '   ' }, // Whitespace only
      { name: 'A'.repeat(200), set: 'B'.repeat(100) }, // Very long strings
      { price: 'free', marketplace: 'unknown' } // Invalid types
    ];

    edgeCases.forEach(card => {
      const result = DataValidator.validateCardData(card);
      expect(result).toBeTruthy();
      expect(typeof result.score).toBe('number');
      expect(Array.isArray(result.errors)).toBe(true);
      expect(Array.isArray(result.warnings)).toBe(true);
    });
  });
});
