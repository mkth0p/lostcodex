import { describe, expect, it } from 'vitest';
import { buildTensionProfile, resolveRhythmState, resolveTensionState } from '../src/audio/subsystems/tension.js';
import {
    buildDrumToneProfile,
    buildPhasePatternBanks,
    fitPatternToCycle,
    getPhasePatternProfile
} from '../src/audio/subsystems/percussion.js';
import {
    getAdditiveVoiceLifetime,
    getMelodyStride,
    getPerformanceProfile
} from '../src/audio/subsystems/melody.js';
import { getMacroEventChance, getMacroEventCooldown } from '../src/audio/subsystems/fx.js';
import { startNatureAmbience } from '../src/audio/subsystems/ambience.js';
import {
    buildScaleChord,
    getChordFunctionKey,
    normalizeChordSymbol,
    resolveBassPattern,
    selectNextChord
} from '../src/audio/subsystems/harmony.js';
import { DEFAULT_TENSION_PROFILE, BIOME_TENSION_PROFILES } from '../src/audio/config/tension-profiles.js';
import { DEFAULT_DRUM_TONE, BIOME_DRUM_TONES } from '../src/audio/config/drum-profiles.js';
import { resolveTimbreDeltaLimits } from '../src/audio/config/timbre-delta-limits.js';

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

    it('computes macro event chance and cooldown bounds', () => {
        const chance = getMacroEventChance('storm', { phase: 'SURGE', energy: 0.8 }, clamp);
        const cooldown = getMacroEventCooldown('storm', 'SURGE', {
            range(min, max) { return (min + max) / 2; },
        });

        expect(chance).toBeGreaterThanOrEqual(0);
        expect(chance).toBeLessThanOrEqual(0.24);
        expect(cooldown).toBeGreaterThan(0);
    });

    it('returns early for ambience when no features are configured', () => {
        const engine = { ctx: null };
        const planet = {
            ac: { ambianceFeatures: [] },
            biome: { id: 'barren' },
        };
        expect(() => startNatureAmbience(engine, planet, null)).not.toThrow();
    });

    it('derives deterministic bass pattern projection from seed', () => {
        const fit = (pattern, targetLength) => {
            const projected = new Array(targetLength).fill(0);
            pattern.forEach((value, index) => {
                if (!value) return;
                const mappedIndex = Math.min(targetLength - 1, Math.floor((index / pattern.length) * targetLength));
                projected[mappedIndex] = Math.max(projected[mappedIndex], value);
            });
            return projected;
        };
        const a = resolveBassPattern(12345, 16, fit);
        const b = resolveBassPattern(12345, 16, fit);

        expect(a).toEqual(b);
        expect(a.length).toBe(16);
        expect(a.every((step) => step === 0 || step === 1)).toBe(true);
    });

    it('computes melody performance profile and additive lifetime helpers', () => {
        const perf = getPerformanceProfile({
            melodyDensity: 0.22,
            stepSeconds: 0.09,
            activeNodes: 260,
            clamp,
        });
        const gongLife = getAdditiveVoiceLifetime('gong', 0.2, 0.8);
        const defaultLife = getAdditiveVoiceLifetime('triangle', 0.2, 0.8);

        expect(perf.pressure).toBeGreaterThanOrEqual(0);
        expect(perf.pressure).toBeLessThanOrEqual(1);
        expect(perf.scalar).toBeGreaterThan(0);
        expect(gongLife).toBe(20.8);
        expect(defaultLife).toBeGreaterThan(0.8);
    });

    it('normalizes chord symbols and selects weighted next chord', () => {
        expect(normalizeChordSymbol(' ii° ')).toBe('ii');
        expect(getChordFunctionKey('ii°')).toBe('ii');
        expect(buildScaleChord('IV', { scale: [0, 2, 4, 5, 7, 9, 11] })).toEqual([5, 9, 12]);

        const next = selectNextChord({
            currentChordKey: 'V',
            progression: ['I', 'ii', 'V'],
            getChordFunctionKey,
            rng: { pick: (values) => values[0] },
        });
        expect(next.nextChordIndex).toBe(0);
    });

    it('resolves timbre delta limits with biome overrides and fallback defaults', () => {
        const storm = resolveTimbreDeltaLimits('storm');
        const fallback = resolveTimbreDeltaLimits('unknown-biome');

        expect(storm.filterBurstMulMax).toBeLessThan(5);
        expect(storm.harshnessTame).toBeLessThan(1);
        expect(storm.longTailMaxDur.gong).toBeGreaterThan(1);
        expect(fallback.chordGlideSec).toBeGreaterThan(0.5);
        expect(fallback.longTailMaxDur.granular_cloud).toBeGreaterThan(0.2);
    });
});
