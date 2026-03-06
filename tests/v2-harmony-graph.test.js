import { describe, expect, it } from 'vitest';
import { HarmonyGraph } from '../src/audio/v1-plus/harmony-graph.js';

const PLANET = {
    seed: 991122,
    progression: ['I', 'IV', 'V', 'vi'],
};

describe('v2 harmony graph', () => {
    it('generates deterministic chord+hold sequences for fixed input', () => {
        const identityProfile = { paceClass: 'medium' };
        const a = new HarmonyGraph(PLANET, identityProfile);
        const b = new HarmonyGraph(PLANET, identityProfile);
        const seqA = [];
        const seqB = [];
        for (let barIndex = 0; barIndex < 24; barIndex++) {
            seqA.push(a.next({
                barIndex,
                section: 'GROWTH',
                dissonance: 0.42,
                stability: 0.56,
                cadenceStrength: 0.58,
                paceOverride: 'auto',
            }));
            seqB.push(b.next({
                barIndex,
                section: 'GROWTH',
                dissonance: 0.42,
                stability: 0.56,
                cadenceStrength: 0.58,
                paceOverride: 'auto',
            }));
        }
        expect(seqB).toEqual(seqA);
    });

    it('applies pace-class hold policies in growth section', () => {
        const graph = new HarmonyGraph(PLANET, { paceClass: 'medium' });
        const slow = graph.next({ barIndex: 0, section: 'GROWTH', paceOverride: 'slow' });
        const medium = graph.next({ barIndex: 1, section: 'GROWTH', paceOverride: 'medium' });
        const fast = graph.next({ barIndex: 2, section: 'GROWTH', paceOverride: 'fast' });
        expect(slow.holdBars).toBeGreaterThanOrEqual(6);
        expect(slow.holdBars).toBeLessThanOrEqual(24);
        expect(medium.holdBars).toBeGreaterThanOrEqual(3);
        expect(medium.holdBars).toBeLessThanOrEqual(10);
        expect(fast.holdBars).toBeGreaterThanOrEqual(1);
        expect(fast.holdBars).toBeLessThanOrEqual(6);
    });
});
