import { describe, expect, it } from 'vitest';
import { GLYPHS } from '../src/data.js';
import { decodeAddress, encodeAddress } from '../src/ui/shared/address-codec.js';

describe('address-codec', () => {
    it('round-trips known glyph addresses', () => {
        const address = `${GLYPHS[0]}${GLYPHS[5]}${GLYPHS[10]}${GLYPHS[15]}`;
        const encoded = encodeAddress(address);
        const decoded = decodeAddress(encoded);
        expect(decoded).toBe(address);
    });

    it('returns an empty string for invalid encoded values', () => {
        expect(decodeAddress('')).toBe('');
        expect(decodeAddress('%%%')).toBe('');
    });
});
