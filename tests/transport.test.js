import { describe, expect, it } from 'vitest';
import { buildTransport } from '../src/audio/core/transport.js';

describe('buildTransport', () => {
    it('builds a bounded cycle from bpm and step count', () => {
        const t = buildTransport(16, 120);
        expect(t.bpm).toBe(120);
        expect(t.cycleSteps).toBe(16);
        expect(t.stepMs).toBeCloseTo(125, 5);
        expect(t.cycleMs).toBeCloseTo(2000, 5);
    });

    it('guards invalid values', () => {
        const t = buildTransport(99, -10);
        expect(t.bpm).toBe(120);
        expect(t.cycleSteps).toBe(32);
    });
});
