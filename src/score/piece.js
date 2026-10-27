import { Rng, hashString } from '../core/rng.js';
import { MODES } from '../core/theory.js';
import { UNIVERSES, getUniverse } from '../universes.js';

// A station id is "<universe>-<code>", e.g. "dub-07" or "ice-K7QX2M".
// A bare code with no known universe prefix is assigned one by its hash.

export const STATIONS_PER_UNIVERSE = 12;

export function normalizeStation(raw) {
    const text = String(raw || '').trim().toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 24);
    if (!text) return 'tide-01';
    const [head, ...rest] = text.split('-');
    if (getUniverse(head) && rest.join('')) return `${head}-${rest.join('').toUpperCase()}`;
    const code = text.replace(/-/g, '').toUpperCase() || 'LOSTCODEX';
    const universe = UNIVERSES[hashString(code) % UNIVERSES.length];
    return `${universe.id}-${code}`;
}

export function stationId(universeIndex, n) {
    return `${UNIVERSES[universeIndex].id}-${String(n + 1).padStart(2, '0')}`;
}

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function randomCode(rand = Math.random) {
    let out = '';
    for (let i = 0; i < 6; i++) out += CODE_ALPHABET[Math.floor(rand() * CODE_ALPHABET.length)];
    return out;
}

// A piece is the handful of numbers a station turns into. Everything else is
// derived from these plus named random streams.
export function createPiece(raw) {
    const station = normalizeStation(raw);
    const universe = getUniverse(station.split('-')[0]);
    const seed = hashString(station);
    const rng = new Rng(seed);
    const modeName = rng.weighted(universe.modes);
    const tonic = rng.int(universe.tonic[0], universe.tonic[1]);
    const harsh = Math.pow(rng.next(), 1.7);
    const pulse = rng.chance(0.5) ? rng.range(0.35, 1) : 0;
    const brightness = rng.next();
    const density = rng.range(0.25, 0.85);
    const space = rng.next();
    const bpm = rng.int(universe.bpm[0], universe.bpm[1]);
    const r = universe.reverb;
    const h = universe.harmony;
    const piece = {
        station,
        code: station,
        seed,
        universe,
        key: { tonic, steps: MODES[modeName], mode: modeName, tuning: universe.tuning || 'equal' },
        harsh,
        pulse,
        brightness,
        density,
        space,
        bpm,
        reverbT60: r.t60[0] + (r.t60[1] - r.t60[0]) * space,
        reverbDamping: r.damping[0] + (r.damping[1] - r.damping[0]) * brightness,
        reverbSize: r.size ?? 1.6,
        echoSeconds: (60 / bpm) * (universe.echoBeats ?? 1.5),
        harmony: {
            ...h,
            holdMin: h.holdMin * (1.2 - density * 0.4),
            holdMax: h.holdMax * (1.2 - density * 0.4),
        },
    };
    piece.sceneWeights = Object.fromEntries(Object.entries(universe.scenes).map(([name, s]) => [
        name, typeof s.weight === 'function' ? s.weight(piece) : s.weight,
    ]));
    return piece;
}
