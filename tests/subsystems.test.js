import { describe, expect, it } from 'vitest';
import { buildTensionProfile, resolveRhythmState, resolveTensionState } from '../src/audio/subsystems/tension.js';
import {
    buildDrumToneProfile,
    buildPhasePatternBanks,
    fitPatternToCycle,
    getPhasePatternProfile
} from '../src/audio/subsystems/percussion.js';
import { getMelodyStride } from '../src/audio/subsystems/melody.js';
import { DEFAULT_TENSION_PROFILE, BIOME_TENSION_PROFILES } from '../src/audio/config/tension-profiles.js';
import { DEFAULT_DRUM_TONE, BIOME_DRUM_TONES } from '../src/audio/config/drum-profiles.js';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

describe('audio subsystem helpers', () => {
    it('builds tension profile with biome overrides and cloned arrays', () => {
        const profile = buildTensionProfile({
            biomeId: 'corrupted',
            melodyDensity: 0.2,
            clamp,
            defaultProfile: DEFAULT_TENSION_PROFILE,
            biomeProfiles: BIOME_TENSION_PROFILES,
        });

        expect(profile.climaxThreshold).toBeGreaterThanOrEqual(0.74);
        expect(profile.climaxThreshold).toBeLessThanOrEqual(0.92);
        expect(profile.fillVoices).not.toBe(BIOME_TENSION_PROFILES.corrupted.fillVoices);
        expect(profile.polyVoices).not.toBe(BIOME_TENSION_PROFILES.corrupted.polyVoices);
        expect(Array.isArray(profile.climaxRatios)).toBe(true);
    });

    it('resolves tension and rhythm states deterministically from inputs', () => {
        const profile = buildTensionProfile({
            biomeId: 'volcanic',
            melodyDensity: 0.11,
            clamp,
            defaultProfile: DEFAULT_TENSION_PROFILE,
            biomeProfiles: BIOME_TENSION_PROFILES,
        });
        const tensionState = resolveTensionState({
            tensionProfile: profile,
            tension: 0.71,
            tensionTick: 42,
            cycleSteps: 16,
            stepIndex: 7,
            climaxStartedDrain: false,
            climaxFired: false,
            clamp,
        });
        const rhythmState = resolveRhythmState({
            planet: { melodyDensity: 0.11 },
            stepIndex: 7,
            barCount: 3,
            fillsEnabled: true,
            tensionState,
            clamp,
        });

        expect(['DORMANT', 'STIR', 'BUILD', 'SURGE', 'CLIMAX', 'FALLOUT']).toContain(tensionState.phase);
        expect(rhythmState.energy).toBe(tensionState.energy);
        expect(rhythmState.chaosChance).toBeGreaterThanOrEqual(0);
        expect(rhythmState.chaosChance).toBeLessThanOrEqual(0.55);
        expect(Array.isArray(rhythmState.fillVoices)).toBe(true);
        expect(Array.isArray(rhythmState.polyVoices)).toBe(true);
    });

    it('computes percussion and melody helper outputs', () => {
        const drum = buildDrumToneProfile({
            biomeId: 'storm',
            defaultTone: DEFAULT_DRUM_TONE,
            biomeTones: BIOME_DRUM_TONES,
        });
        const fitted = fitPatternToCycle([1, 0, 0, 1], 8);
        const stride = getMelodyStride({
            melodyDensity: 0.03,
            cycleSteps: 16,
            clamp,
        });

        expect(drum).toHaveProperty('kickPitch');
        expect(drum).toHaveProperty('presenceFreq');
        expect(fitted.length).toBe(8);
        expect(fitted.some((v) => v > 0)).toBe(true);
        expect(stride).toBe(4);
    });

    it('builds phase pattern banks for all tension phases', () => {
        const profile = getPhasePatternProfile('storm');
        const banks = buildPhasePatternBanks({
            patterns: {
                k: [1, 0, 0, 0, 1, 0, 0, 0],
                s: [0, 0, 1, 0, 0, 0, 1, 0],
                h: [1, 1, 1, 1, 1, 1, 1, 1],
                b: [1, 0, 0, 0, 0, 0, 0, 0],
            },
            cycleSteps: 8,
            seed: 1234,
            biomeId: 'storm',
        });

        expect(profile).toHaveProperty('CLIMAX');
        expect(banks).toHaveProperty('DORMANT');
        expect(banks).toHaveProperty('CLIMAX');
        expect(banks.CLIMAX.k.length).toBe(8);
        expect(banks.SURGE.h.length).toBe(8);
    });
});
