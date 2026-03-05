import { describe, expect, it } from 'vitest';
import { AudioEngine } from '../src/audio.js';

describe('AudioEngine API contract', () => {
    it('exposes required stable methods', () => {
        const engine = new AudioEngine();
        const methods = [
            'start',
            'stop',
            'crossfadeTo',
            'setVolume',
            'setReverb',
            'getAnalyser',
            'getRecordingStream',
            'getChord',
            'getMelodyState',
            'getDebugState',
            'setMix',
            'setPerformance',
            'setFeatureFlags',
            'setDeterminismMode',
            'subscribeState',
            'triggerNavigationFx',
        ];

        methods.forEach((name) => {
            expect(typeof engine[name]).toBe('function');
        });
    });

    it('emits an immediate state snapshot to subscribers', () => {
        const engine = new AudioEngine();
        let lastState = null;
        const unsubscribe = engine.subscribeState((state) => {
            lastState = state;
        });

        expect(lastState).toBeTruthy();
        expect(lastState).toHaveProperty('transport');
        expect(lastState).toHaveProperty('tension');
        expect(lastState).toHaveProperty('melody');
        expect(lastState).toHaveProperty('debug');
        expect(lastState).toHaveProperty('chord');
        expect(lastState.debug).toHaveProperty('determinismMode');
        expect(lastState.debug).toHaveProperty('engineRefactorV2');
        expect(lastState.debug).toHaveProperty('schedulerTickMs');
        expect(lastState.debug).toHaveProperty('schedulerHorizonMs');
        expect(lastState.debug).toHaveProperty('schedulerLateCallbacks');
        expect(lastState.debug).toHaveProperty('schedulerMaxLateMs');
        unsubscribe();
    });

    it('supports strict determinism random stream reset', () => {
        const engine = new AudioEngine();
        engine.planet = { seed: 12345 };
        engine.setDeterminismMode('strict');
        const runA = [engine._random('melody'), engine._random('melody'), engine._random('melody')];

        engine.setDeterminismMode('strict');
        engine.planet = { seed: 12345 };
        const runB = [engine._random('melody'), engine._random('melody'), engine._random('melody')];
        expect(runB).toEqual(runA);
    });
});
