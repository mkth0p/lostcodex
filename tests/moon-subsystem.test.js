import { describe, expect, it } from 'vitest';
import { buildMoonProfile, shiftScaleStep } from '../src/audio/subsystems/moon.js';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

describe('moon subsystem', () => {
    it('builds deterministic moon profiles with lane metadata', () => {
        const engine = { _clamp: clamp };
        const planet = {
            seed: 424242,
            numMoons: 3,
            biome: { id: 'crystalline' },
            moonSystem: {
                density: 0.71,
                resonance: 0.82,
                phaseWarp: 0.48,
                orbitSpread: 0.66,
                temporalDrift: 0.29,
            },
        };

        const a = buildMoonProfile(engine, planet);
        const b = buildMoonProfile(engine, planet);

        expect(b).toEqual(a);
        expect(a.length).toBe(3);
        expect(a[0]).toHaveProperty('laneStride');
        expect(a[0]).toHaveProperty('lanePhaseOffset');
        expect(a[0]).toHaveProperty('laneOffbeatChance');
        expect(a[0].chance).toBeGreaterThan(0);
        expect(a[0].gain).toBeGreaterThan(0);
    });

    it('projects scale steps across degree shifts and octaves', () => {
        const planet = { scale: [0, 2, 3, 5, 7, 8, 10] };
        const shifted = shiftScaleStep(planet, 7, 2, 1);
        const fallback = shiftScaleStep({}, 7, 2, 1);

        expect(Number.isFinite(shifted)).toBe(true);
        expect(fallback).toBe(21);
    });
});
