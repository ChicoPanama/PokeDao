import { describe, it, expect } from 'vitest';
import { computeFairValue } from '../src/index.js';
// Helper: value within [min, max]
const within = (value, min, max) => value >= min && value <= max;
describe('computeFairValue', () => {
    it('computes a reasonable FV from simple comps (uses soldPrice)', () => {
        const comps = [
            { soldPrice: 100, source: 'mock', date: '2025-01-01' },
            { soldPrice: 110, source: 'mock', date: '2025-01-02' },
            { soldPrice: 90, source: 'mock', date: '2025-01-03' },
        ];
        const res = computeFairValue(comps);
        expect(typeof res.fv).toBe('number');
        expect(within(res.fv, 90, 110)).toBe(true);
        expect(typeof res.confidence).toBe('number');
        expect(res.confidence).toBeGreaterThanOrEqual(0);
        expect(res.confidence).toBeLessThanOrEqual(1);
        if (res.basis) {
            const basis = res.basis;
            expect((basis.nComps ?? basis.n ?? 0)).toBeGreaterThanOrEqual(3);
        }
    });
    it('handles a single comp gracefully (no assumptions on exact FV)', () => {
        const comps = [{ soldPrice: 250, source: 'mock', date: '2025-01-01' }];
        const res = computeFairValue(comps);
        expect(typeof res.fv).toBe('number');
        expect(res.fv).toBeGreaterThanOrEqual(0);
        expect(res.confidence).toBeGreaterThanOrEqual(0);
        expect(res.confidence).toBeLessThanOrEqual(1);
    });
    it('handles empty comps without throwing', () => {
        const res = computeFairValue([]);
        expect(typeof res.fv).toBe('number');
        expect(res.fv).toBeGreaterThanOrEqual(0);
        expect(res.confidence).toBeGreaterThanOrEqual(0);
        expect(res.confidence).toBeLessThanOrEqual(1);
    });
});
