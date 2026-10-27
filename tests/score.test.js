import { describe, expect, it } from 'vitest';
import { isInKey } from '../src/core/theory.js';
import { createPiece, normalizeStation, stationId } from '../src/score/piece.js';
import { UNIVERSES } from '../src/universes.js';
import { Score } from '../src/score/score.js';

function eventsFor(code, seconds, step = 0.5) {
    const score = new Score(createPiece(code));
    const out = [];
    for (let t = step; t <= seconds; t += step) out.push(...score.collect(t));
    return { score, events: out };
}

describe('piece', () => {
    it('normalizes stations so case and punctuation do not matter', () => {
        expect(normalizeStation(' Dub-07 ')).toBe('dub-07');
        expect(normalizeStation('ice-k7qx2m')).toBe('ice-K7QX2M');
        expect(createPiece('k7qx2m').seed).toBe(createPiece('K7QX2M').seed);
    });

    it('gives a bare code a universe of its own', () => {
        const id = normalizeStation('k7qx-2m');
        expect(id.endsWith('-K7QX2M')).toBe(true);
        expect(UNIVERSES.map((u) => u.id)).toContain(id.split('-')[0]);
    });

    it('names dial stations by universe and number', () => {
        expect(stationId(2, 6)).toBe('dub-07');
        expect(createPiece('dub-07').universe.id).toBe('dub');
    });

    it('gives different codes different pieces', () => {
        const seeds = new Set(['A', 'B', 'C', 'D', 'E', 'F'].map((c) => createPiece(c).seed));
        expect(seeds.size).toBe(6);
    });
});

describe('score', () => {
    it('plays only notes from the key, for many pieces', () => {
        for (let i = 0; i < 40; i++) {
            const code = stationId(i % UNIVERSES.length, Math.floor(i / UNIVERSES.length));
            const { key } = createPiece(code);
            const { events } = eventsFor(code, 900, 2);
            for (const ev of events) {
                for (const m of ev.midis || (ev.midi === undefined ? [] : [ev.midi])) {
                    expect(isInKey(key, m), `${code} ${ev.layer} ${m}`).toBe(true);
                }
            }
        }
    });

    it('does not depend on how the timeline is chunked', () => {
        const a = eventsFor('CHUNKS', 600, 0.25).events;
        const b = eventsFor('CHUNKS', 600, 7.5).events;
        const key = (e) => `${e.time.toFixed(6)}|${e.layer}|${e.midi}|${e.gain.toFixed(6)}`;
        expect(a.map(key).sort()).toEqual(b.map(key).sort());
    });

    it('opens gently and keeps scenes overlapping without gaps', () => {
        const piece = createPiece('tide-GAPS');
        const score = new Score(piece);
        expect(piece.universe.opening).toContain(score.scenes[0].type);
        for (let t = 0; t < 3000; t += 10) {
            score.collect(t + 0.1);
            expect(score.sceneAt(t)).not.toBeNull();
        }
    });
});
