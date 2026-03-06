import { describe, expect, it } from 'vitest';
import { computePlanetRarity, rarityFromScore } from '../src/rarity.js';
import { generatePlanet } from '../src/planet.js';
import { resolvePlanetRarity } from '../src/ui/shared/rarity.js';

describe('rarity model', () => {
    it('maps scores to expected tier keys', () => {
        expect(rarityFromScore(0.1).key).toBe('common');
        expect(rarityFromScore(0.38).key).toBe('standard');
        expect(rarityFromScore(0.62).key).toBe('uncommon');
        expect(rarityFromScore(0.8).key).toBe('rare');
        expect(rarityFromScore(0.9).key).toBe('anomalous');
        expect(rarityFromScore(0.99).key).toBe('legendary');
    });

    it('is deterministic for identical planet inputs', () => {
        const input = {
            seed: 12345,
            address: '0123456789ab',
            biomeId: 'quantum',
            numMoons: 3,
            scale: [0, 2, 3, 5, 7, 8, 10],
            progression: ['I', 'V', 'vi', 'IV'],
            ac: { stepCount: 7, melodyWaves: ['granular_cloud', 'pulse'] },
            tuningSystem: 'Just',
            quarterToneProb: 0.1,
            octaveStretch: 1.012,
        };
        const first = computePlanetRarity(input);
        const second = computePlanetRarity(input);

        expect(second).toEqual(first);
        expect(first.score).toBeGreaterThanOrEqual(0);
        expect(first.score).toBeLessThanOrEqual(1);
    });

    it('exposes rarity and moon system fields in generated planets', () => {
        const planet = generatePlanet('0123456789ab');
        expect(typeof planet.rarityKey).toBe('string');
        expect(typeof planet.rarityClass).toBe('string');
        expect(typeof planet.rarityScore).toBe('number');
        expect(planet.rarityScore).toBeGreaterThanOrEqual(0);
        expect(planet.rarityScore).toBeLessThanOrEqual(1);
        expect(typeof planet.moonSystem).toBe('object');
        expect(planet.moonSystem).toHaveProperty('density');
        expect(planet.moonSystem).toHaveProperty('resonance');
        expect(typeof planet.v2).toBe('object');
        expect(planet.v2).toHaveProperty('formGenome');
        expect(planet.v2).toHaveProperty('rhythmGenome');
        expect(planet.v2).toHaveProperty('backgroundProfile');
    });

    it('resolves rarity from planet payload and from address fallback', () => {
        const fromPlanet = resolvePlanetRarity({
            rarityKey: 'legendary',
            rarityClass: 'LEGENDARY',
            rarityScore: 0.99,
        }, 'abc');
        expect(fromPlanet.key).toBe('legendary');
        expect(fromPlanet.label).toBe('LEGENDARY');

        const fallback = resolvePlanetRarity(null, 'abc');
        expect(fallback.key).toBe('common');
    });
});
