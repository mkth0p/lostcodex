import { describe, expect, it } from 'vitest';
import { Engine } from '../src/engine/engine.js';

function render(code, seconds, sr = 22050, opts = {}) {
    const engine = new Engine(code, sr, opts);
    const n = Math.round(seconds * sr);
    const out = new Float32Array(n * 2);
    const l = new Float32Array(128);
    const r = new Float32Array(128);
    for (let f = 0; f < n; f += 128) {
        engine.render(l, r, 128);
        for (let i = 0; i < 128 && f + i < n; i++) {
            out[(f + i) * 2] = l[i];
            out[(f + i) * 2 + 1] = r[i];
        }
    }
    return out;
}

function hash(buf) {
    let h = 0x811c9dc5;
    const bytes = new Uint8Array(buf.buffer);
    for (let i = 0; i < bytes.length; i++) h = Math.imul(h ^ bytes[i], 0x01000193);
    return h >>> 0;
}

describe('engine', () => {
    it('renders the same code to identical samples', () => {
        expect(hash(render('SAME', 20))).toBe(hash(render('SAME', 20)));
    });

    it('renders different codes differently', () => {
        expect(hash(render('ONE', 10))).not.toBe(hash(render('TWO', 10)));
    });

    for (const scene of ['drift', 'sparse', 'shimmer', 'pulse', 'storm']) {
        it(`keeps the ${scene} scene finite, audible and under the ceiling`, () => {
            const out = render('LEVELS', 50, 16000, { sceneOverride: [scene] });
            let peak = 0;
            let sum = 0;
            let bad = 0;
            for (let i = 0; i < out.length; i++) {
                if (!Number.isFinite(out[i])) bad++;
                peak = Math.max(peak, Math.abs(out[i]));
                sum += out[i] * out[i];
            }
            const rmsDb = 10 * Math.log10(sum / out.length);
            expect(bad).toBe(0);
            expect(peak).toBeLessThanOrEqual(0.9);
            expect(rmsDb).toBeGreaterThan(-40);
        });
    }
});
