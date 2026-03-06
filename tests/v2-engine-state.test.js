import { describe, expect, it, vi } from 'vitest';
import { AudioEngineV2 } from '../src/audio/v2/engine-v2.js';

function createHarness({ formUpdate } = {}) {
    let scheduledHandler = null;
    const host = {
        _emitEvent: () => {},
        playing: true,
        transport: { stepSeconds: 0.125, cycleSteps: 16 },
        _scheduleRecurringChannel: vi.fn((_name, _interval, handler) => {
            scheduledHandler = handler;
            return true;
        }),
        _transportScheduler: { getStats: () => ({ maxLateMs: 0 }) },
        _layerMix: {},
        _macroControls: { complexity: 0.5, space: 0.5 },
        _backgroundMode: 'foreground-realtime',
        _arrangement: {},
        _granularEnabled: false,
        _percussionEnabled: false,
        _chordEnabled: false,
        _arpEnabled: false,
        _motifEnabled: false,
        stepFX: 0,
        nodes: { size: 0 },
        tension: 0,
        _tensionState: { phase: 'DORMANT', energy: 0, cyclePos: 0, pocket: 0.5 },
        _vol: 0.7,
    };
    const engine = new AudioEngineV2(host);
    engine.active = true;
    engine.overlayFlags = {
        extendedHarmony: false,
        counterpoint: false,
        microtonalWarp: false,
        droneLayer: false,
        moonCanons: false,
        adaptivePercussion: false,
        ambientEcosystem: false,
    };
    engine.identityProfile = {
        id: 'identity-test',
        paceClass: 'medium',
        toneTilt: 'balanced',
        droneTargetDb: { min: -24, max: -14 },
        percussionPresence: 0.5,
        melodyPresence: 0.5,
        ambiencePresence: 0.6,
    };

    const modResolve = vi.fn(() => ({
        complexity: 0.4,
        motion: 0.4,
        dissonance: 0.3,
        space: 0.5,
    }));
    const composeStep = vi.fn(() => ({
        paceClass: 'medium',
        holdBars: 0,
        microtonalDepth: 0,
        moonActivityRate: 0,
        compositionDensity: 0,
        droneAudibilityDb: -40,
    }));
    engine.formEngine = {
        update: vi.fn(
            formUpdate || (() => ({ section: 'INTRO', arrangementEnergy: 0.2, sectionProgress: 0 })),
        ),
    };
    engine.qualityGovernor = {
        evaluate: vi.fn(() => ({
            voiceBudget: 64,
            qualityScalar: 1,
            cpuClass: 'desktop-mid',
            cpuTier: 'desktop-mid',
            degradeStage: 'full',
        })),
    };
    engine.voicePool = {
        setBudget: vi.fn(),
        getState: () => ({ voiceBudget: 64, voiceStealCount: 0, activeVoices: 0 }),
    };
    engine.modMatrix = { resolve: modResolve };
    engine.composerCore = { composeStep };
    engine.voiceFactory = { playFxPulse: vi.fn() };
    engine.droneEngine = { getState: () => ({ continuityHealth: 1 }) };
    engine.buses = {
        setMacroSpace: vi.fn(),
        setLayerMix: vi.fn(),
        getTelemetry: () => ({ preLimiterPeakDb: -18, integratedLufs: -20 }),
    };
    engine._scheduleChannels();
    return { engine, host, runStep: scheduledHandler, composeStep, modResolve };
}

describe('v2 engine scheduler state', () => {
    it('starts bar indexing at 0 and advances on cycle rollover only', () => {
        const { engine, runStep, composeStep } = createHarness();
        expect(typeof runStep).toBe('function');

        for (let i = 0; i < 16; i++) runStep({ scheduleTime: i * 0.125 });
        expect(engine.barIndex).toBe(0);
        runStep({ scheduleTime: 16 * 0.125 });
        expect(engine.barIndex).toBe(1);
        expect(composeStep.mock.calls[0][0].barIndex).toBe(0);
        expect(composeStep.mock.calls[16][0].barIndex).toBe(1);
    });

    it('syncs host tension from v2 form energy and propagates section progress', () => {
        const { engine, host, runStep, composeStep, modResolve } = createHarness({
            formUpdate: () => ({ section: 'GROWTH', arrangementEnergy: 0.58, sectionProgress: 0.42 }),
        });
        runStep({ scheduleTime: 0 });
        const firstTension = host.tension;
        runStep({ scheduleTime: 0.125 });

        expect(firstTension).toBeGreaterThan(0);
        expect(firstTension).toBeLessThan(0.58);
        expect(host.tension).toBeGreaterThan(firstTension);
        expect(host._tensionState.phase).toBe('BUILD');
        expect(host._tensionState.energy).toBeCloseTo(host.tension, 6);
        expect(host._tensionState.cyclePos).toBeCloseTo(0.42, 6);
        expect(modResolve.mock.calls[0][0].tension).toBeCloseTo(firstTension, 6);
        expect(composeStep.mock.calls[0][0].sectionProgress).toBeCloseTo(0.42, 6);
        expect(engine.getState().sectionProgress).toBeCloseTo(0.42, 6);
    });
});
