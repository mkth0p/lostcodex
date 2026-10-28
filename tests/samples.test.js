import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { Engine } from '../src/engine/engine.js';
import { SampleBank } from '../src/engine/samples.js';
import { createPiece } from '../src/score/piece.js';
import { Score } from '../src/score/score.js';
import { UNIVERSES } from '../src/universes.js';

const pack = readFileSync(new URL('../samples/pack.bin', import.meta.url));
const bank = new SampleBank(pack);

function render(code, seconds, sr, opts) {
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

describe('sample pack', () => {
    it('decodes every zone the same way twice', () => {
        const again = new SampleBank(pack);
        for (const [name, ins] of Object.entries(bank.instruments)) {
            ins.zones.forEach((z, i) => expect(hash(z.data)).toBe(hash(again.instruments[name].zones[i].data)));
        }
    });

    it('has every sample the universes ask for', () => {
        const names = new Set();
        const src = readFileSync(new URL('../src/universes.js', import.meta.url), 'utf8')
            + readFileSync(new URL('../src/score/lanes.js', import.meta.url), 'utf8');
        for (const m of src.matchAll(/sample: '([a-z0-9]+)'/g)) names.add(m[1]);
        for (const m of src.matchAll(/stabSample: [^']*'([a-z0-9]+)'/g)) names.add(m[1]);
        for (const name of names) expect(bank.has(name), name).toBe(true);
    });

    it('stays small enough for phones', () => {
        expect(pack.length).toBeLessThan(3 * 1024 * 1024);
    });

    it('renders the same code to identical samples', () => {
        expect(hash(render('voices-SAME', 15, 22050, { samples: bank }))).toBe(hash(render('voices-SAME', 15, 22050, { samples: bank })));
    });

    it('rebuilds grain clouds identically', () => {
        const opts = { samples: bank, sceneOverride: ['burn'] };
        expect(hash(render('ash-GRAINS', 20, 22050, opts))).toBe(hash(render('ash-GRAINS', 20, 22050, opts)));
    });

    it('puts a kick in every Dub scene', () => {
        for (const scene of Object.keys(UNIVERSES.find((u) => u.id === 'dub').scenes)) {
            const score = new Score(createPiece('dub-KICK'), { sceneOverride: [scene] });
            const kicks = score.collect(120).filter((ev) => ev.type === 'kick');
            expect(kicks.length, scene).toBeGreaterThan(20);
        }
    });

    const scenes = UNIVERSES.flatMap((u) => Object.keys(u.scenes).map((scene) => [u.id, scene]));
    for (const [universe, scene] of scenes) {
        it(`does not lean on the limiter in ${universe}/${scene} more than the synth version`, () => {
            const leastGain = (samples) => {
                const engine = new Engine(`${universe}-LIMIT`, 16000, { sceneOverride: [scene], samples });
                const l = new Float32Array(128);
                const r = new Float32Array(128);
                let least = 1;
                for (let f = 0; f < 16000 * 40; f += 128) {
                    engine.render(l, r, 128);
                    least = Math.min(least, engine.limiter.gain);
                }
                return 20 * Math.log10(least);
            };
            expect(leastGain(bank)).toBeGreaterThan(Math.min(-1.5, leastGain(null) - 1.5));
        });

        it(`keeps ${universe}/${scene} with samples finite, audible and under the ceiling`, () => {
            const out = render(`${universe}-LEVELS`, 30, 16000, { sceneOverride: [scene], samples: bank });
            let peak = 0;
            let sum = 0;
            let bad = 0;
            for (let i = 0; i < out.length; i++) {
                if (!Number.isFinite(out[i])) bad++;
                peak = Math.max(peak, Math.abs(out[i]));
                sum += out[i] * out[i];
            }
            expect(bad).toBe(0);
            expect(peak).toBeLessThanOrEqual(0.9);
            expect(10 * Math.log10(sum / out.length)).toBeGreaterThan(-40);
        });
    }
});
