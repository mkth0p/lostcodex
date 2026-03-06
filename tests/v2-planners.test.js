import { describe, expect, it, vi } from 'vitest';
import { FormEngine } from '../src/audio/v2/generation/form-engine.js';
import { HarmonyPlanner } from '../src/audio/v2/generation/harmony-planner.js';
import { MelodyPlanner } from '../src/audio/v2/generation/melody-planner.js';
import { RhythmPlanner } from '../src/audio/v2/generation/rhythm-planner.js';
import { V2ComposerCore } from '../src/audio/v2/composition/v2-composer-core.js';
import { normalizeMacroControls } from '../src/audio/v2/modulation/mod-matrix.js';
import { AdaptiveQualityGovernor } from '../src/audio/v2/quality/adaptive-quality.js';

const planet = {
    seed: 321321,
    progression: ['I', 'V', 'vi', 'IV'],
    scale: [0, 2, 3, 5, 7, 8, 10],
    motifBank: [[0, 2, 3, 5], [7, 5, 3, 2]],
    ac: { stepCount: 16 },
    v2: {
        richnessProfile: { tier: 'lush', harmonicity: 0.82, brightness: 0.66, density: 0.74 },
        fxProfile: { organic: 0.42, harmonic: 0.72, synthetic: 0.48, contrast: 0.55 },
    },
};

describe('v2 planners', () => {
    it('generates deterministic form and harmony transitions', () => {
        const formA = new FormEngine(planet, { arrangement: { formDepth: 0.7, phraseLengthBias: 0.6 } });
        const formB = new FormEngine(planet, { arrangement: { formDepth: 0.7, phraseLengthBias: 0.6 } });
        const seqA = [];
        const seqB = [];
        for (let bar = 0; bar < 16; bar++) {
            seqA.push(formA.update(bar).section);
            seqB.push(formB.update(bar).section);
        }
        expect(seqA).toEqual(seqB);

        const harmonyA = new HarmonyPlanner(planet);
        const harmonyB = new HarmonyPlanner(planet);
        const chordsA = [];
        const chordsB = [];
        for (let bar = 0; bar < 12; bar++) {
            chordsA.push(harmonyA.next({ barIndex: bar, section: 'GROWTH', dissonance: 0.4, stability: 0.6 }).symbol);
            chordsB.push(harmonyB.next({ barIndex: bar, section: 'GROWTH', dissonance: 0.4, stability: 0.6 }).symbol);
        }
        expect(chordsA).toEqual(chordsB);
    });

    it('produces deterministic melody and rhythm decisions', () => {
        const melodyA = new MelodyPlanner(planet);
        const melodyB = new MelodyPlanner(planet);
        const rhythmA = new RhythmPlanner(planet);
        const rhythmB = new RhythmPlanner(planet);

        for (let i = 0; i < 32; i++) {
            const ma = melodyA.planStep({ stepIndex: i, barIndex: Math.floor(i / 16), section: 'SURGE', complexity: 0.62, motion: 0.57, dissonance: 0.33, qualityScalar: 0.9, counterlineEnabled: true });
            const mb = melodyB.planStep({ stepIndex: i, barIndex: Math.floor(i / 16), section: 'SURGE', complexity: 0.62, motion: 0.57, dissonance: 0.33, qualityScalar: 0.9, counterlineEnabled: true });
            expect(mb).toEqual(ma);

            const ra = rhythmA.planStep({ stepIndex: i, barIndex: Math.floor(i / 16), section: 'SURGE', energy: 0.8, complexity: 0.63, motion: 0.5, dissonance: 0.4, fillsEnabled: true, ghostEnabled: true, densityMul: 1 });
            const rb = rhythmB.planStep({ stepIndex: i, barIndex: Math.floor(i / 16), section: 'SURGE', energy: 0.8, complexity: 0.63, motion: 0.5, dissonance: 0.4, fillsEnabled: true, ghostEnabled: true, densityMul: 1 });
            expect(rb).toEqual(ra);
        }
    });

    it('normalizes macro controls and computes quality envelopes', () => {
        const macros = normalizeMacroControls({
            complexity: 3,
            motion: -1,
            dissonance: 0.6,
            texture: 0.2,
            space: 0.9,
            stability: 0.4,
        });
        expect(macros.complexity).toBe(1);
        expect(macros.motion).toBe(0);

        const governor = new AdaptiveQualityGovernor();
        const result = governor.evaluate({
            activeNodes: 280,
            schedulerMaxLateMs: 4,
            macroComplexity: 0.7,
            backgroundMode: 'foreground-realtime',
        });
        expect(result.voiceBudget).toBeGreaterThan(20);
        expect(result.qualityScalar).toBeGreaterThan(0.2);
        expect(result.qualityScalar).toBeLessThanOrEqual(1);
    });

    it('maintains deterministic phrase anchor memory in melody/harmony planners', () => {
        const melodyA = new MelodyPlanner(planet);
        const melodyB = new MelodyPlanner(planet);
        const harmonyA = new HarmonyPlanner(planet);
        const harmonyB = new HarmonyPlanner(planet);
        const anchorHitsA = [];
        const anchorHitsB = [];
        const harmonyWindowsA = [];
        const harmonyWindowsB = [];

        for (let i = 0; i < 96; i++) {
            const barIndex = Math.floor(i / 16);
            const stepA = melodyA.planStep({
                stepIndex: i,
                barIndex,
                section: 'GROWTH',
                complexity: 0.62,
                motion: 0.57,
                dissonance: 0.33,
                qualityScalar: 0.9,
                counterlineEnabled: true,
            });
            const stepB = melodyB.planStep({
                stepIndex: i,
                barIndex,
                section: 'GROWTH',
                complexity: 0.62,
                motion: 0.57,
                dissonance: 0.33,
                qualityScalar: 0.9,
                counterlineEnabled: true,
            });
            anchorHitsA.push(stepA.anchorHit);
            anchorHitsB.push(stepB.anchorHit);
        }

        for (let bar = 0; bar < 24; bar++) {
            const hA = harmonyA.next({ barIndex: bar, section: 'GROWTH', dissonance: 0.42, stability: 0.6, cadenceStrength: 0.52 });
            const hB = harmonyB.next({ barIndex: bar, section: 'GROWTH', dissonance: 0.42, stability: 0.6, cadenceStrength: 0.52 });
            harmonyWindowsA.push([hA.phraseAnchor, hA.brightWindowActive, hA.symbol]);
            harmonyWindowsB.push([hB.phraseAnchor, hB.brightWindowActive, hB.symbol]);
        }

        expect(anchorHitsA).toEqual(anchorHitsB);
        expect(anchorHitsA.some(Boolean)).toBe(true);
        expect(harmonyWindowsA).toEqual(harmonyWindowsB);
    });

    it('resets section progress correctly at section rollover boundaries', () => {
        const form = new FormEngine(planet, { arrangement: { formDepth: 0.7, phraseLengthBias: 0.6 } });
        form.sectionBarLength = 2;
        form.sectionBarStart = 0;
        form.sectionIndex = 0;
        form.section = 'INTRO';

        const state = form.update(2);
        const expectedProgress = (2 - form.sectionBarStart + 1) / Math.max(1, form.sectionBarLength);

        expect(state.section).toBe('GROWTH');
        expect(state.sectionProgress).toBeCloseTo(expectedProgress, 8);
        expect(state.sectionProgress).toBeLessThan(1);
    });

    it('propagates section progress to drone scheduler decisions', () => {
        const host = {
            transport: { stepSeconds: 0.125 },
            _granularEnabled: false,
            _percussionEnabled: false,
            _chordEnabled: true,
            _arpEnabled: false,
            _motifEnabled: false,
            _arrangement: { cadenceStrength: 0.5 },
            _currentChordIntervals: [0, 4, 7],
            _chordName: 'I',
            _moonProfile: [],
            _moonProcCount: 0,
            _lastMoonProcAt: Number.NEGATIVE_INFINITY,
            _v2Engine: { buses: { layerGains: { melody: null } } },
            _scheduleMoonCanons: () => {},
            _getPerformanceProfile: () => ({}),
            _buildScaleChord: () => [0, 4, 7],
            stepNote: 0,
            stepPerc: 0,
            stepFX: 0,
            stepGrain: 0,
            tension: 0.3,
            ctx: { currentTime: 0 },
            _shiftScaleStep: (_planet, step) => step,
            _getStepFrequency: () => 220,
            planet,
        };
        const droneEngine = {
            schedule: vi.fn(),
            getState: () => ({ outputLevel: 0.5, resonatorEnergy: 0.2, loopFill: 0.1 }),
        };
        const composer = new V2ComposerCore(host, planet);
        composer.composeStep({
            stepIndex: 0,
            barIndex: 0,
            cycleStep: 0,
            cycleSteps: 16,
            scheduleTime: 0,
            section: 'GROWTH',
            sectionProgress: 0.42,
            currentMod: { complexity: 0.5, motion: 0.5, dissonance: 0.35, stability: 0.55 },
            quality: { qualityScalar: 1 },
            droneEngine,
            voiceFactory: null,
            eventBus: null,
            layerMix: { drones: 0.7 },
            mixTelemetry: { preLimiterPeakDb: -20 },
        });

        expect(droneEngine.schedule).toHaveBeenCalledTimes(1);
        const [{ sectionProgress }] = droneEngine.schedule.mock.calls[0];
        expect(sectionProgress).toBeCloseTo(0.42, 6);
    });
});
