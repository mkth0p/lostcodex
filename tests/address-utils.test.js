import { describe, expect, it } from 'vitest';
import { GLYPHS } from '../src/data.js';
import { randomAddress } from '../src/ui/shared/address-utils.js';

describe('randomAddress', () => {
    it('returns glyph-only addresses within configured bounds', () => {
        const address = randomAddress(6, 8);
        expect(address.length).toBeGreaterThanOrEqual(6);
        expect(address.length).toBeLessThanOrEqual(8);
        [...address].forEach((glyph) => {
            expect(GLYPHS.includes(glyph)).toBe(true);
        });
    });
});
