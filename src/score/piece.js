import { Rng, hashString } from '../core/rng.js';
import { MODES } from '../core/theory.js';

export const SCENE_TYPES = ['drift', 'sparse', 'shimmer', 'pulse', 'storm'];

export function normalizeCode(code) {
    return String(code || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12) || 'LOSTCODEX';
}

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function randomCode(rand = Math.random) {
    let out = '';
    for (let i = 0; i < 6; i++) out += CODE_ALPHABET[Math.floor(rand() * CODE_ALPHABET.length)];
    return out;
}

// A piece is the handful of numbers an address turns into. Everything else
// is derived from these plus named random streams.
export function createPiece(rawCode) {
    const code = normalizeCode(rawCode);
    const seed = hashString(code);
    const rng = new Rng(seed);
    const modeName = rng.weighted([
        ['lydian', 2], ['ionian', 2], ['mixolydian', 1.5], ['dorian', 2], ['aeolian', 2], ['phrygian', 0.6],
    ]);
    const tonic = 43 + rng.int(0, 11);
    const harsh = Math.pow(rng.next(), 1.7);
    const pulse = rng.chance(0.5) ? rng.range(0.35, 1) : 0;
    const brightness = rng.next();
    const density = rng.range(0.25, 0.85);
    const space = rng.range(0.55, 1);
    const bpm = rng.int(96, 122);

    return {
        code,
        seed,
        key: { tonic, steps: MODES[modeName], mode: modeName },
        harsh,
        pulse,
        brightness,
        density,
        space,
        bpm,
        reverbT60: 7 + space * 13,
        echoSeconds: (60 / bpm) * 1.5,
        holdMin: 30 + (1 - density) * 30,
        holdMax: 70 + (1 - density) * 50,
        pedalProb: 0.35 + (1 - harsh) * 0.3,
        sceneWeights: {
            drift: 3,
            sparse: 1 + (1 - density) * 1.5,
            shimmer: 0.6 + brightness * 2,
            pulse: pulse * 3.2,
            storm: harsh * 4,
        },
    };
}
