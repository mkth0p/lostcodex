import { describe, expect, it } from 'vitest';
import { BIOMES } from '../src/data.js';
import { buildIdentityProfile, getBiomeIdentityPreset, resolvePaceClass } from '../src/audio/v1-plus/identity-profile.js';

const PLANET = {
    seed: 774411,
    biome: { id: 'crystalline' },
    moonSystem: {
        density: 0.64,
        resonance: 0.58,
        phaseWarp: 0.42,
        orbitSpread: 0.51,
        temporalDrift: 0.3,
    },
    rarityScore: 0.72,
    melodyDensity: 0.12,
    quarterToneProb: 0.2,
    ac: {
        chordAudibility: 0.44,
    },
};

describe('v2 identity profile', () => {
    it('builds deterministic identity profile fields from a planet seed', () => {
        const a = buildIdentityProfile(PLANET);
        const b = buildIdentityProfile(PLANET);
        expect(b).toEqual(a);
        expect(a).toHaveProperty('id');
        expect(a).toHaveProperty('paceClass');
        expect(a).toHaveProperty('harmonyDrift');
        expect(a).toHaveProperty('motifVolatility');
        expect(a).toHaveProperty('rhythmEcology');
        expect(a).toHaveProperty('droneSignature');
        expect(a).toHaveProperty('moonBias');
        expect(a).toHaveProperty('microtonalMapSeed');
        expect(a).toHaveProperty('holdPolicy');
        expect(a).toHaveProperty('droneTargetDb');
        expect(a).toHaveProperty('layerTargets');
        expect(a.holdPolicy.slow[1]).toBeGreaterThan(a.holdPolicy.slow[0]);
        expect(a.droneTargetDb.max).toBeGreaterThan(a.droneTargetDb.min);
    });

    it('resolves pace class with override precedence', () => {
        const profile = buildIdentityProfile(PLANET);
        expect(resolvePaceClass(profile, 'slow')).toBe('slow');
        expect(resolvePaceClass(profile, 'medium')).toBe('medium');
        expect(resolvePaceClass(profile, 'fast')).toBe('fast');
        expect(resolvePaceClass(profile, 'auto')).toBe(profile.paceClass);
    });

    it('provides a concrete identity preset for every biome', () => {
        BIOMES.forEach((biome) => {
            const preset = getBiomeIdentityPreset(biome.id);
            expect(preset).toBeTruthy();
            expect(preset).toHaveProperty('holdPolicy');
            expect(preset).toHaveProperty('droneTargetDb');
            expect(preset).toHaveProperty('layerTargets');
        });
    });
});
