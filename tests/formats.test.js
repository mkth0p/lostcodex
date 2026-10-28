import { describe, expect, it } from 'vitest';
import { createPiece, formatOf } from '../src/score/piece.js';
import { Score } from '../src/score/score.js';
import { getUniverse } from '../src/universes.js';

const code = (u, n) => `${u}-${String(n).padStart(2, '0')}`;

describe('formats', () => {
    for (const u of ['neon', 'dub']) {
        const formats = getUniverse(u).formats;

        it(`puts every ${u} format on the dial`, () => {
            const seen = new Set();
            for (let n = 1; n <= 12; n++) seen.add(formatOf(code(u, n)).id);
            expect(seen.size).toBe(formats.length);
        });

        it(`never gives two ${u} stations of one format the same sound set`, () => {
            for (let a = 1; a <= 12; a++) {
                for (let b = a + 1; b <= 12; b++) {
                    const fa = formatOf(code(u, a));
                    if (fa !== formatOf(code(u, b))) continue;
                    const pa = createPiece(code(u, a)).palette;
                    const pb = createPiece(code(u, b)).palette;
                    for (const [name, options] of Object.entries(fa.palette)) {
                        // with three passes over a two-option role, two stations must share
                        if (options.length < 3 && Math.max(a, b) > 2 * formats.length) continue;
                        expect(pa[name], `${code(u, a)} vs ${code(u, b)}: ${name}`).not.toEqual(pb[name]);
                    }
                }
            }
        });
    }

    it('keeps a kick in every Dub station', () => {
        for (let n = 1; n <= 12; n++) {
            const kicks = new Score(createPiece(code('dub', n))).collect(180).filter((ev) => ev.type === 'kick');
            expect(kicks.length, code('dub', n)).toBeGreaterThan(20);
        }
    });

    it('swaps in the second choice now and then, the same way every time', () => {
        const leads = (c) => new Score(createPiece(c)).collect(900).filter((ev) => ev.layer === 'lead').map((ev) => ev.sample || ev.type);
        const a = leads('neon-07');
        expect(a).toEqual(leads('neon-07'));
        expect(new Set(a).size).toBeGreaterThan(1);
    });
});
