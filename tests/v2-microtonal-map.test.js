import { describe, expect, it } from 'vitest';
import { MicrotonalMap } from '../src/audio/v1-plus/microtonal-map.js';

describe('v2 microtonal map', () => {
    it('produces deterministic offsets for the same seed and input', () => {
        const profile = { paceClass: 'slow', microtonalWarp: 0.74 };
        const a = new MicrotonalMap(90210, profile);
        const b = new MicrotonalMap(90210, profile);
        const params = {
            step: 7,
            layer: 'melody',
            section: 'AFTERGLOW',
            paceOverride: 'auto',
            barIndex: 12,
            stepIndex: 98,
        };
        expect(b.offsetCents(params)).toBe(a.offsetCents(params));
    });

    it('keeps bass depth lower than melody depth and clamps probability', () => {
        const profile = { paceClass: 'medium', microtonalWarp: 0.68 };
        const map = new MicrotonalMap(47, profile);
        const bassDepth = map.getLayerDepth('bass', 'GROWTH', 'auto');
        const melodyDepth = map.getLayerDepth('melody', 'GROWTH', 'auto');
        expect(bassDepth).toBeLessThan(melodyDepth);

        const probability = map.probability(0.8, 'melody', 'SURGE', 'fast');
        expect(probability).toBeLessThanOrEqual(0.95);
        expect(probability).toBeGreaterThan(0.8);
    });
});
