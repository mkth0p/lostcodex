import { describe, expect, it } from 'vitest';
import { FormEngine } from '../src/audio/v2/generation/form-engine.js';
import { HarmonyPlanner } from '../src/audio/v2/generation/harmony-planner.js';
import { MelodyPlanner } from '../src/audio/v2/generation/melody-planner.js';
import { RhythmPlanner } from '../src/audio/v2/generation/rhythm-planner.js';
import { normalizeMacroControls } from '../src/audio/v2/modulation/mod-matrix.js';
import { AdaptiveQualityGovernor } from '../src/audio/v2/quality/adaptive-quality.js';

const planet = {
    seed: 321321,
    progression: ['I', 'V', 'vi', 'IV'],
    scale: [0, 2, 3, 5, 7, 8, 10],
    motifBank: [[0, 2, 3, 5], [7, 5, 3, 2]],
    ac: { stepCount: 16 },
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
});
