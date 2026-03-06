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
            'setEngineMode',
            'getEngineMode',
            'setMacroControls',
            'setArrangement',
            'setV2OverlayFlags',
            'setPlanetPaceOverride',
            'getIdentityDiagnostics',
            'setLayerMix',
            'setSpatial',
            'setBackgroundPolicy',
            'enterBackgroundMode',
            'exitBackgroundMode',
            'subscribeEvents',
            'setDroneMacros',
            'setDroneExpert',
            'captureDroneLoop',
            'setDroneRandomizer',
            'setDroneVariationSeed',
            'setDroneVolume',
            'getDroneState',
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
        expect(lastState).toHaveProperty('engineMode');
        expect(lastState).toHaveProperty('section');
        expect(lastState).toHaveProperty('sectionProgress');
        expect(lastState).toHaveProperty('arrangementEnergy');
        expect(lastState).toHaveProperty('voiceBudget');
        expect(lastState).toHaveProperty('voiceStealCount');
        expect(lastState).toHaveProperty('eventRate');
        expect(lastState).toHaveProperty('cpuClass');
        expect(lastState).toHaveProperty('backgroundMode');
        expect(lastState).toHaveProperty('backgroundPolicy');
        expect(lastState).toHaveProperty('backgroundTimelineRemainingMs');
        expect(lastState).toHaveProperty('identityProfileId');
        expect(lastState).toHaveProperty('paceClass');
        expect(lastState).toHaveProperty('microtonalDepth');
        expect(lastState).toHaveProperty('droneAudibilityDb');
        expect(lastState).toHaveProperty('moonActivityRate');
        expect(lastState).toHaveProperty('harmonyHoldBarsCurrent');
        expect(lastState).toHaveProperty('compositionDensity');
        expect(lastState).toHaveProperty('drone');
        expect(lastState).toHaveProperty('mix');
        expect(lastState).toHaveProperty('quality');
        expect(lastState.drone).toHaveProperty('loopFill');
        expect(lastState.mix).toHaveProperty('preLimiterPeakDb');
        expect(lastState.quality).toHaveProperty('degradeStage');
        expect(lastState.debug).toHaveProperty('determinismMode');
        expect(lastState.debug).toHaveProperty('engineRefactorV2');
        expect(lastState.debug).toHaveProperty('engineMode');
        expect(lastState.debug).toHaveProperty('schedulerTickMs');
        expect(lastState.debug).toHaveProperty('schedulerHorizonMs');
        expect(lastState.debug).toHaveProperty('schedulerLateCallbacks');
        expect(lastState.debug).toHaveProperty('schedulerMaxLateMs');
        expect(lastState.debug).toHaveProperty('sectionProgress');
        expect(lastState.debug).toHaveProperty('paceClass');
        expect(lastState.debug).toHaveProperty('microtonalDepth');
        expect(lastState.debug).toHaveProperty('droneAudibilityDb');
        expect(lastState.debug).toHaveProperty('moonActivityRate');
        expect(lastState.debug).toHaveProperty('harmonyHoldBarsCurrent');
        expect(lastState.debug).toHaveProperty('compositionDensity');
        expect(lastState.debug).toHaveProperty('v2OverlayFlags');
        expect(lastState.debug).toHaveProperty('paceOverride');
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

    it('supports engine mode and background policy controls', () => {
        const engine = new AudioEngine();
        const modes = [];
        const unsubscribe = engine.subscribeEvents((event) => {
            if (event?.type === 'engine-mode') modes.push(event.mode);
        });

        expect(engine.getEngineMode()).toBe('v1');
        engine.setEngineMode('v2');
        expect(engine.getEngineMode()).toBe('v2');
        engine.setBackgroundPolicy('continuity');
        expect(engine.enterBackgroundMode()).toMatch(/background|paused/);
        expect(engine.exitBackgroundMode()).toBe('foreground-realtime');
        engine.setEngineMode('v1');
        unsubscribe();
        expect(modes).toContain('v2');
        expect(modes).toContain('v1');
    });

    it('supports drone APIs in v2 and safe no-op in v1', () => {
        const engine = new AudioEngine();
        const events = [];
        const unsubscribe = engine.subscribeEvents((event) => events.push(event));

        const v1State = engine.captureDroneLoop({ mode: 'toggle', source: 'pre' });
        expect(v1State).toBeTruthy();
        expect(events.some((event) => event.type === 'unsupported-feature')).toBe(true);

        engine.setEngineMode('v2');
        engine.setDroneMacros({ dream: 0.7, tail: 0.6 });
        engine.setDroneExpert({ sourceMode: 'wavetable', filterPosition: 2 });
        engine.setDroneVolume(0.88);
        const randomized = engine.setDroneRandomizer({ target: 'fx', intensity: 0.3, action: 'apply' });
        expect(randomized).toBeTruthy();
        const droneState = engine.getDroneState();
        expect(droneState).toBeTruthy();
        expect(droneState).toHaveProperty('continuityHealth');
        expect(droneState).toHaveProperty('bedMode');
        expect(droneState).toHaveProperty('supersawShare');
        expect(droneState).toHaveProperty('richnessTier');
        expect(events.some((event) => event.type === 'drone-macros')).toBe(true);
        expect(events.some((event) => event.type === 'drone-expert')).toBe(true);
        expect(events.some((event) => event.type === 'drone-volume')).toBe(true);
        expect(events.some((event) => event.type === 'drone-randomizer')).toBe(true);
        unsubscribe();
    });

    it('emits feature and overlay flag events', () => {
        const engine = new AudioEngine();
        const events = [];
        const unsubscribe = engine.subscribeEvents((event) => events.push(event));
        engine.setFeatureFlags({ granular: false, percussion: false, chords: false, arp: false, motif: false });
        engine.setV2OverlayFlags({ droneLayer: true, counterpoint: true });
        engine.setPlanetPaceOverride('slow');
        unsubscribe();
        expect(events.some((event) => event.type === 'feature-flags')).toBe(true);
        expect(events.some((event) => event.type === 'v2-overlay-flags')).toBe(true);
        expect(events.some((event) => event.type === 'pace-override')).toBe(true);
    });

    it('supports v2 overlay and pace override diagnostics APIs', () => {
        const engine = new AudioEngine();
        engine.setV2OverlayFlags({
            counterpoint: false,
            droneLayer: true,
        });
        engine.setPlanetPaceOverride('slow');
        const diagV1 = engine.getIdentityDiagnostics();
        expect(diagV1).toBeTruthy();
        expect(diagV1.paceClass).toBe('slow');
        expect(diagV1.overlayFlags.counterpoint).toBe(false);

        engine.setEngineMode('v2');
        engine.setV2OverlayFlags({ adaptivePercussion: false });
        engine.setPlanetPaceOverride('fast');
        const diagV2 = engine.getIdentityDiagnostics();
        expect(diagV2).toBeTruthy();
        expect(diagV2.overlayFlags.adaptivePercussion).toBe(false);
        expect(diagV2.paceOverride).toBe('fast');
    });

    it('uses smoothed tension telemetry state when running in v2 mode', () => {
        const engine = new AudioEngine();
        engine.setEngineMode('v2');
        const syntheticV2State = {
            section: 'SURGE',
            sectionProgress: 0.58,
            arrangementEnergy: 0.84,
            voiceBudget: 64,
            voiceStealCount: 0,
            eventRate: 0,
            cpuClass: 'desktop-mid',
            cpuTier: 'desktop-mid',
            degradeStage: 'full',
            backgroundMode: 'foreground-realtime',
            backgroundPolicy: 'realtime',
            backgroundTimelineRemainingMs: 0,
            featureFlags: {
                granular: true,
                percussion: true,
                chords: true,
                arp: true,
                motif: true,
            },
            effectiveFlags: {
                granular: true,
                percussion: true,
                chords: true,
                arp: true,
                motif: true,
            },
            identityProfileId: 'synthetic',
            paceClass: 'medium',
            microtonalDepth: 0.2,
            droneAudibilityDb: -18,
            moonActivityRate: 0.1,
            harmonyHoldBarsCurrent: 3,
            compositionDensity: 0.42,
            drone: { ...engine._droneState },
            mix: { ...engine._mixTelemetry },
            quality: { ...engine._qualityTelemetry },
        };
        engine._tensionState = { phase: 'BUILD', energy: 0.52, cyclePos: 0.4, pocket: 0.5 };
        engine._v2Engine.getState = () => syntheticV2State;

        const state = engine._snapshotState();
        const debug = engine.getDebugState();

        expect(state.tension.phase).toBe('BUILD');
        expect(state.tension.energy).toBeCloseTo(0.52, 6);
        expect(state.sectionProgress).toBeCloseTo(0.58, 6);
        expect(debug.tensionPhase).toBe('BUILD');
        expect(debug.tensionEnergy).toBeCloseTo(0.52, 6);
        expect(debug.sectionProgress).toBeCloseTo(0.58, 6);
    });
});
