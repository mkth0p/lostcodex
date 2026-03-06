import { describe, expect, it } from 'vitest';
import {
    DEFAULT_DRONE_EXPERT,
    DEFAULT_DRONE_MACROS,
    mapDroneMacrosToExpert,
    normalizeDroneExpert,
    normalizeDroneMacros,
    toDroneGenome,
} from '../src/audio/v2/drone/drone-macro-map.js';
import { DroneEngine } from '../src/audio/v2/drone/drone-engine.js';
import { DroneQualityPolicy } from '../src/audio/v2/drone/drone-quality-policy.js';

describe('v2 drone api utilities', () => {
    it('normalizes drone macro and expert control ranges', () => {
        const macros = normalizeDroneMacros({ dream: 2, texture: -1, motion: 0.7, resonance: 0.9, diffusion: 0.3, tail: 1.2 });
        expect(macros.dream).toBe(1);
        expect(macros.texture).toBe(0);
        expect(macros.tail).toBe(1);

        const expert = normalizeDroneExpert({
            expertPriority: 'invalid',
            sourceMode: 'invalid',
            looperSource: 'post',
            loopLength: 2,
            varispeed: 4,
            sos: 2,
            filterPosition: 9,
            filterType: 'lowpass',
        });
        expect(expert.expertPriority).toBe(DEFAULT_DRONE_EXPERT.expertPriority);
        expect(expert.sourceMode).toBe(DEFAULT_DRONE_EXPERT.sourceMode);
        expect(expert.looperSource).toBe('post');
        expect(expert.loopLength).toBe(1);
        expect(expert.varispeed).toBe(2);
        expect(expert.sos).toBe(0.96);
        expect(expert.filterPosition).toBe(3);
    });

    it('maps macros to expert controls with deterministic genome bias', () => {
        const mappedA = mapDroneMacrosToExpert(DEFAULT_DRONE_MACROS, DEFAULT_DRONE_EXPERT, {
            profile: 0.8,
            resonator: 0.75,
            ambience: 0.4,
            echo: 0.6,
            mod: 0.7,
        });
        const mappedB = mapDroneMacrosToExpert(DEFAULT_DRONE_MACROS, DEFAULT_DRONE_EXPERT, {
            profile: 0.8,
            resonator: 0.75,
            ambience: 0.4,
            echo: 0.6,
            mod: 0.7,
        });
        expect(mappedB).toEqual(mappedA);
        expect(mappedA.loopLength).toBeGreaterThan(0);
        expect(mappedA.loopLength).toBeLessThanOrEqual(1);
    });

    it('respects expert priority mode in macro mapping', () => {
        const expertLocked = normalizeDroneExpert({
            ...DEFAULT_DRONE_EXPERT,
            expertPriority: 'expert',
            filterCutoff: 0.21,
            echoFeedback: 0.77,
            sourceMode: 'wavetable',
        });
        const mappedExpert = mapDroneMacrosToExpert(
            { ...DEFAULT_DRONE_MACROS, texture: 1, tail: 1, motion: 1, resonance: 1, diffusion: 1, dream: 1 },
            expertLocked,
            { profile: 1, resonator: 1, ambience: 1, echo: 1, mod: 1 },
        );
        expect(mappedExpert.filterCutoff).toBeCloseTo(expertLocked.filterCutoff, 6);
        expect(mappedExpert.echoFeedback).toBeCloseTo(expertLocked.echoFeedback, 6);
        expect(mappedExpert.sourceMode).toBe(expertLocked.sourceMode);
    });

    it('extracts normalized drone genome defaults', () => {
        const genome = toDroneGenome({
            v2: {
                droneGenome: {
                    profile: 2,
                    source: -1,
                    loop: 0.5,
                },
            },
        });
        expect(genome.profile).toBe(1);
        expect(genome.source).toBe(0);
        expect(genome.loop).toBe(0.5);
        expect(genome.filter).toBeGreaterThanOrEqual(0);
    });

    it('applies continuity-first degrade policy ordering', () => {
        const policy = new DroneQualityPolicy();
        const full = policy.resolve({ qualityScalar: 1, backgroundMode: 'foreground-realtime', cpuClass: 'desktop-high', richnessTier: 'lush' });
        const reduced = policy.resolve({ qualityScalar: 0.48, backgroundMode: 'background-continuity', cpuClass: 'mobile-balanced', richnessTier: 'lush' });

        expect(full.accentDensityMul).toBeGreaterThan(reduced.accentDensityMul);
        expect(full.supersawMul).toBeGreaterThan(reduced.supersawMul);
        expect(full.noiseMul).toBeGreaterThan(reduced.noiseMul);
        expect(reduced.bedComplexity).toBeGreaterThan(0.45);
    });

    it('keeps continuity health stable for long sparse holds while penalizing true gaps', () => {
        const healthyStub = {
            ctx: { currentTime: 120 },
            floor: { bus: { gain: { value: 0.08 } } },
            continuity: { dropouts: 0, lastDropoutAt: Number.NEGATIVE_INFINITY, health: 1 },
            lastScheduleTime: 88,
            lastSection: 'AFTERGLOW',
            richnessTier: 'sparse',
        };
        const poorStub = {
            ctx: { currentTime: 140 },
            floor: { bus: { gain: { value: 0.004 } } },
            continuity: { dropouts: 2, lastDropoutAt: Number.NEGATIVE_INFINITY, health: 1 },
            lastScheduleTime: 88,
            lastSection: 'SURGE',
            richnessTier: 'lush',
        };

        const healthy = DroneEngine.prototype._computeContinuityHealth.call(healthyStub, {
            scheduleTime: 108,
            previousScheduleTime: 88,
            sceneCrossfadeSec: 2.2,
            durationSec: 22,
            sectionProgress: 0.8,
        });
        const poor = DroneEngine.prototype._computeContinuityHealth.call(poorStub, {
            scheduleTime: 136,
            previousScheduleTime: 88,
            sceneCrossfadeSec: 0.8,
            durationSec: 6,
            sectionProgress: 0.2,
        });

        expect(healthy).toBeGreaterThan(0.7);
        expect(poor).toBeLessThan(healthy);
    });
});
