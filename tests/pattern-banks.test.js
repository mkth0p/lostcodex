import { describe, expect, it } from 'vitest';
import { AMBIENT_PATTERN_BANK, BASE_BIOME_PATTERN_BANKS } from '../src/audio/config/pattern-banks.js';

describe('pattern banks config', () => {
    it('exposes required biome banks and rhythm voices', () => {
        const requiredBiomes = ['volcanic', 'psychedelic', 'corrupted', 'oceanic', 'organic', 'desert', 'crystalline'];
        const requiredVoices = ['k', 's', 'h', 'b'];

        requiredBiomes.forEach((biomeId) => {
            const bank = BASE_BIOME_PATTERN_BANKS[biomeId];
            expect(bank).toBeTruthy();
            requiredVoices.forEach((voice) => {
                expect(Array.isArray(bank[voice])).toBe(true);
                expect(bank[voice].length).toBeGreaterThan(0);
            });
        });
    });

    it('keeps ambient bank silent across all voices', () => {
        ['k', 's', 'h', 'b'].forEach((voice) => {
            const variants = AMBIENT_PATTERN_BANK[voice];
            expect(Array.isArray(variants)).toBe(true);
            expect(variants.length).toBe(1);
            expect(variants[0].length).toBe(16);
            expect(variants[0].every((step) => step === 0)).toBe(true);
        });
    });
});
