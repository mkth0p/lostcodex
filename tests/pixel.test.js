import { describe, expect, it } from 'vitest';
import { Glitch } from '../src/dsp/effects.js';
import { Engine } from '../src/engine/engine.js';
import { createPiece, formatOf } from '../src/score/piece.js';
import { Score } from '../src/score/score.js';
import { getUniverse } from '../src/universes.js';

const code = (n) => `pixel-${String(n).padStart(2, '0')}`;
const DIAL = Array.from({ length: 12 }, (_, i) => code(i + 1));

describe('pixel', () => {
    it('puts six formats on the dial, each a song with edits', () => {
        const ids = new Set(DIAL.map((c) => formatOf(c).id));
        expect([...ids].sort()).toEqual(['bloghouse', 'bubblegum', 'complextro', 'hazard', 'roar', 'trance']);
        for (const c of DIAL) {
            const plan = new Score(createPiece(c)).plan;
            expect(plan, c).toBeTruthy();
            expect(plan.glitch, c).toBeTruthy();
        }
    });

    it('never shares an instrument between two formats', () => {
        const owner = new Map();
        for (const f of getUniverse('pixel').formats) {
            for (const options of Object.values(f.palette)) {
                for (const o of options) {
                    for (const name of [o].flat().map((x) => (typeof x === 'string' ? x : x.ins)).filter(Boolean)) {
                        if (owner.has(name)) expect(owner.get(name), name).toBe(f.id);
                        owner.set(name, f.id);
                    }
                }
            }
        }
        expect(owner.size).toBeGreaterThan(60);
    });

    it('cuts drops up with edits that stay inside their section and never overlap', () => {
        for (const c of DIAL) {
            const plan = new Score(createPiece(c)).plan;
            plan.index(14);
            let drops = 0;
            for (const s of plan.sections) {
                let last = s.start;
                for (const fx of s.fx) {
                    expect(fx.start, c).toBeGreaterThanOrEqual(last - 1e-9);
                    expect(fx.end, c).toBeLessThanOrEqual(s.end + 1e-9);
                    expect(fx.end).toBeGreaterThan(fx.start);
                    last = fx.end;
                }
                if (plan.isDrop(s)) drops += s.fx.length;
            }
            expect(drops, c).toBeGreaterThan(3);
        }
    });

    it('switches the complextro bass between patches within a bar', () => {
        const c = DIAL.find((x) => formatOf(x).id === 'complextro');
        const score = new Score(createPiece(c));
        const drop = score.plan.index(2);
        expect(drop.role).toBe('drop');
        const bass = score.collect(drop.end).filter((ev) => ev.type === 'morph' && ev.layer === 'bass' && ev.time >= drop.start);
        const bar = score.plan.bar;
        let switches = 0;
        for (let t = drop.start; t < drop.end; t += bar) {
            const inBar = bass.filter((ev) => ev.time >= t && ev.time < t + bar);
            const sounds = new Set(inBar.map((ev) => `${ev.filter}:${ev.fm}:${ev.pulse}:${ev.pitch}:${ev.vowels}`));
            if (sounds.size > 1) switches++;
        }
        expect(switches).toBeGreaterThan(drop.bars / 2);
    });

    it('chops a word of its own for every station', () => {
        for (const c of DIAL) {
            const ev = new Score(createPiece(c)).collect(200).filter((e) => e.type === 'vox');
            expect(ev.length, c).toBeGreaterThan(20);
            for (const e of ev) expect(e.vowels?.length, c).toBeGreaterThan(0);
        }
        const word = (c) => new Score(createPiece(c)).collect(200).filter((e) => e.type === 'vox').slice(0, 8).map((e) => e.vowels.join(''));
        expect(word('pixel-01')).not.toEqual(word('pixel-07'));
    });

    it('cycles a four-chord loop through its drops', () => {
        for (const c of DIAL) {
            const score = new Score(createPiece(c));
            const { plan, harmony } = score;
            expect(harmony.loop, c).toHaveLength(4);
            plan.index(6);
            for (const s of plan.sections.filter((x) => plan.isDrop(x))) {
                const len = harmony.loopBars * plan.bar;
                for (let k = 0; k * len < s.end - s.start - 1e-6; k++) {
                    expect(harmony.chordAt(s.start + k * len + 0.01).rootDegree, c).toBe(harmony.loop[k % 4]);
                }
            }
        }
    });

    it('renders every format the same way twice, finite and under the ceiling', () => {
        for (const c of DIAL.slice(0, 6)) {
            const run = () => {
                const e = new Engine(c, 16000);
                const l = new Float32Array(128);
                const r = new Float32Array(128);
                let h = 0x811c9dc5;
                let peak = 0;
                let sum = 0;
                const n = 16000 * 70;
                for (let f = 0; f < n; f += 128) {
                    e.render(l, r, 128);
                    for (let i = 0; i < 128; i++) {
                        expect(Number.isFinite(l[i]) && Number.isFinite(r[i])).toBe(true);
                        peak = Math.max(peak, Math.abs(l[i]), Math.abs(r[i]));
                        sum += l[i] * l[i];
                        h = Math.imul(h ^ Math.round(l[i] * 1e6), 0x01000193);
                    }
                }
                return { h: h >>> 0, peak, rms: Math.sqrt(sum / n) };
            };
            const a = run();
            expect(run().h, c).toBe(a.h);
            expect(a.peak, c).toBeLessThanOrEqual(0.9);
            expect(a.rms, c).toBeGreaterThan(0.02);
        }
    });
});

describe('glitch', () => {
    const feed = (g, fx, n, src = (i) => Math.sin(i * 0.01) * ((i % 1000) / 1000)) => {
        g.set(fx);
        const out = [];
        const lr = [0, 0];
        for (let i = 0; i < n; i++) {
            lr[0] = src(i);
            lr[1] = src(i);
            g.process(lr, i);
            out.push(lr[0]);
        }
        return out;
    };

    it('repeats the first slice of its window', () => {
        const g = new Glitch(8000, 1);
        const out = feed(g, { kind: 'repeat', a: 1000, b: 2000, len: 200 }, 2500);
        // inside each repeat, away from the slice fades, the first slice comes back
        for (const k of [250, 450, 650, 850]) expect(out[1000 + k]).toBeCloseTo(out[1000 + (k % 200)], 6);
        expect(out[2300]).not.toBeCloseTo(out[1000 + 100], 3);
    });

    it('stops like a record and plays the past backwards', () => {
        const g = new Glitch(8000, 1);
        const out = feed(g, { kind: 'stop', a: 1000, b: 2000 }, 2000, () => 0.5);
        // the platter has nearly stopped and the sound has faded with it
        expect(Math.abs(out[1950])).toBeLessThan(0.06);
        expect(out[1100]).toBeCloseTo(0.5, 3);
        const h = new Glitch(8000, 1);
        const rev = feed(h, { kind: 'reverse', a: 1000, b: 1400 }, 1400, (i) => i / 2000);
        expect(rev[1200]).toBeCloseTo(799 / 2000, 6);
    });
});
