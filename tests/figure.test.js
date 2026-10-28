import { describe, expect, it } from 'vitest';
import { Rng } from '../src/core/rng.js';
import { COMMON_TONES, Harmony, MODES } from '../src/core/theory.js';
import { Echo } from '../src/dsp/effects.js';
import { GENERATORS, STEPS, clean, curve, repetitionForm, sceneGrid } from '../src/score/figure.js';
import { createPiece } from '../src/score/piece.js';
import { Score } from '../src/score/score.js';

describe('figures', () => {
    it('curve leans towards zero as the bias grows', () => {
        const mean = (p) => {
            const rng = new Rng(9);
            let sum = 0;
            for (let i = 0; i < 2000; i++) sum += curve(rng, 6, p);
            return sum / 2000;
        };
        expect(mean(0)).toBeGreaterThan(mean(1));
        expect(mean(1)).toBeGreaterThan(mean(3));
    });

    it('repetition 0 never repeats, 1 always repeats the first phrase', () => {
        const rng = new Rng(3);
        expect(repetitionForm(rng, 4, 0)).toEqual([0, 1, 2, 3]);
        expect(repetitionForm(rng, 4, 1)).toEqual([0, 0, 0, 0]);
        for (let i = 0; i < 50; i++) {
            const form = repetitionForm(rng, 4, 0.5);
            expect(form[0]).toBe(0);
            // a slot only refers to phrases that already exist
            form.forEach((f, k) => expect(f).toBeLessThanOrEqual(k));
        }
    });

    it('cleans overlaps the way Gyro does', () => {
        const out = clean([
            { step: 0, row: 1, steps: 8 },
            { step: 4, row: 1, steps: 2 },
            { step: 30, row: 2, steps: 8 },
            { step: 6, row: 3, steps: 0 },
        ]);
        expect(out).toEqual([
            { step: 0, row: 1, steps: 4 },
            { step: 4, row: 1, steps: 2 },
            { step: 30, row: 2, steps: 2 },
        ]);
    });

    it('keeps hooks in the middle of the chord', () => {
        const rng = new Rng(5);
        const grid = sceneGrid(rng);
        const rows = [0, 0, 0, 0, 0, 0];
        for (let i = 0; i < 300; i++) for (const n of GENERATORS.hook(rng, grid, {})) rows[n.row]++;
        expect(rows[3]).toBeGreaterThan(rows[0] * 2);
        expect(rows[2]).toBeGreaterThan(rows[5]);
    });

    it('stays inside the two bars and the shared grid', () => {
        const rng = new Rng(11);
        for (let i = 0; i < 100; i++) {
            const grid = sceneGrid(rng);
            for (const name of ['bass', 'splatter', 'walk', 'chord']) {
                for (const n of clean(GENERATORS[name](rng, grid, { bias: 1 }))) {
                    expect(n.step).toBeGreaterThanOrEqual(0);
                    expect(n.step + n.steps).toBeLessThanOrEqual(STEPS);
                    expect(grid.onsets).toContain(n.step);
                }
            }
        }
    });
});

describe('tempo', () => {
    it('puts every figure and drum hit of a scene on one swung grid', () => {
        for (const code of ['neon-04', 'abyss-02', 'dub-05', 'orbit-07', 'bronze-01']) {
            const piece = createPiece(code);
            const score = new Score(piece);
            const step = 60 / piece.bpm / 4;
            for (let t = 1; t < 900; t += 1) {
                for (const ev of score.collect(t)) {
                    if (!['bass', 'kick', 'snare', 'stab'].includes(ev.layer)) continue;
                    const i = Math.round(ev.time / step);
                    const swung = i * step + (i % 2 ? piece.swing * step : 0);
                    const plain = i * step;
                    const off = Math.min(Math.abs(ev.time - swung), Math.abs(ev.time - plain));
                    expect(off, `${code} ${ev.layer} at ${ev.time}`).toBeLessThan(1e-6);
                }
            }
        }
    });

    it('starts melodies over a beat on the eighth-note grid', () => {
        const piece = createPiece('orbit-07');
        const score = new Score(piece, { sceneOverride: ['beat'] });
        const eighth = 60 / piece.bpm / 2;
        let seen = 0;
        for (let t = 1; t < 400; t += 1) {
            for (const ev of score.collect(t)) {
                if (ev.layer !== 'lead') continue;
                seen++;
                const k = ev.time / eighth;
                expect(Math.abs(k - Math.round(k))).toBeLessThan(1e-6);
            }
        }
        expect(seen).toBeGreaterThan(5);
    });

    it('echoes on the beat on both sides, even for the slowest universes', () => {
        const sr = 8000;
        for (const seconds of [0.375, 2.4]) {
            const echo = new Echo(sr, { seconds, feedback: 0.5 });
            const out = [0, 0];
            const hits = { l: [], r: [] };
            const n = Math.round(seconds * sr * 4.5);
            for (let i = 0; i < n; i++) {
                echo.process(i === 0 ? 1 : 0, out);
                if (Math.abs(out[0]) > 0.05) hits.l.push(i);
                if (Math.abs(out[1]) > 0.05) hits.r.push(i);
            }
            const d = Math.round(seconds * sr);
            // left at one delay, right at two, then the filtered repeats
            expect(hits.l[0]).toBe(d);
            expect(hits.r[0]).toBe(2 * d);
            // the filters in the feedback smear a repeat by a few samples only
            for (const i of [...hits.l, ...hits.r]) {
                const off = Math.min(i % d, d - (i % d));
                expect(off).toBeLessThan(0.004 * sr);
            }
        }
    });

    it('keeps the echo inside its buffer at slow tempos', () => {
        for (const code of ['cathedral-01', 'ice-04', 'bronze-02']) {
            expect(createPiece(code).echoSeconds).toBeLessThanOrEqual(2.5);
        }
    });
});

describe('harmony', () => {
    it('prefers chords that keep two notes over ones that keep none or all', () => {
        expect(COMMON_TONES[2]).toBeGreaterThan(COMMON_TONES[0]);
        expect(COMMON_TONES[2]).toBeGreaterThan(COMMON_TONES[4]);
        const counts = [0, 0, 0, 0, 0];
        for (let s = 0; s < 20; s++) {
            const h = new Harmony({ tonic: 48, steps: MODES.dorian }, new Rng(s), { holdMin: 10, holdMax: 10 });
            let prev = h.chordAt(0);
            for (let t = 10; t < 400; t += 10) {
                const c = h.chordAt(t);
                counts[Math.min(4, c.pcs.filter((pc) => prev.pcs.includes(pc)).length)]++;
                prev = c;
            }
        }
        expect(counts[1] + counts[2]).toBeGreaterThan(counts[0] + counts[3] + counts[4]);
    });
});

describe('form', () => {
    it('brings earlier scenes back', () => {
        let returns = 0;
        for (let i = 1; i <= 12; i++) {
            const score = new Score(createPiece(`tide-${String(i).padStart(2, '0')}`));
            score.collect(6000);
            const seen = new Set();
            for (const [k, type] of score.history.entries()) {
                if (k > 1 && seen.has(type)) returns++;
                seen.add(type);
            }
        }
        expect(returns).toBeGreaterThan(12);
    });
});
