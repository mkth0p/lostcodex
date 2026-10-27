import { describe, expect, it } from 'vitest';
import { Rng } from '../src/core/rng.js';
import { Harmony, MODES, degreeToMidi, isConsonantSet, isInKey, midiToHz, pitchClass } from '../src/core/theory.js';

const key = { tonic: 48, steps: MODES.dorian, mode: 'dorian' };

describe('pitch', () => {
    it('maps A4 to 440 Hz and octaves to exact doublings', () => {
        expect(midiToHz(69)).toBe(440);
        expect(midiToHz(81) / midiToHz(69)).toBeCloseTo(2, 12);
    });

    it('wraps scale degrees across octaves', () => {
        expect(degreeToMidi(key, 0)).toBe(48);
        expect(degreeToMidi(key, 7)).toBe(60);
        expect(degreeToMidi(key, -1)).toBe(46);
        expect(degreeToMidi(key, 2)).toBe(51);
    });

    it('rejects minor seconds and tritones against the bass', () => {
        expect(isConsonantSet(0, [0, 4, 7])).toBe(true);
        expect(isConsonantSet(0, [1, 5, 8])).toBe(false);
        expect(isConsonantSet(0, [6, 9])).toBe(false);
        expect(isConsonantSet(0, [4, 5])).toBe(false);
    });
});

describe('harmony', () => {
    for (const mode of Object.keys(MODES)) {
        it(`keeps every chord in ${mode} consonant and in key`, () => {
            const k = { tonic: 45, steps: MODES[mode], mode };
            const h = new Harmony(k, new Rng(7));
            for (let t = 0; t < 3600; t += 20) {
                const chord = h.chordAt(t);
                for (const m of [...chord.upper, chord.bass]) expect(isInKey(k, m)).toBe(true);
                expect(isConsonantSet(pitchClass(chord.bass), chord.pcs)).toBe(true);
            }
        });
    }

    it('holds chords for at least thirty seconds', () => {
        const h = new Harmony(key, new Rng(3), { holdMin: 30, holdMax: 60 });
        h.chordAt(1800);
        for (const c of h.chords) expect(c.end - c.start).toBeGreaterThanOrEqual(30);
    });
});
