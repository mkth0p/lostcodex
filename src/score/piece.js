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

// The format a station plays, for universes that have them (Neon's radio
// formats): the numbered stations on the dial step through them in order, so
// every format is on the dial; any other code is assigned one by its hash.
export function formatOf(raw) {
    const station = normalizeStation(raw);
    const [id, code] = station.split('-');
    const formats = getUniverse(id).formats;
    if (!formats) return null;
    const n = /^\d{2}$/.test(code) ? Number(code) : 0;
    const i = n >= 1 && n <= STATIONS_PER_UNIVERSE ? n - 1 : hashString(`format:${station}`);
    return formats[i % formats.length];
}

// Which pass over its universe's formats a station is: neon-01 and neon-07
// play the same format, but neon-07 is the second pass, so it takes the next
// option for every role of the palette and never shares its sound set.
function formatPass(station, count) {
    const code = station.split('-')[1];
    const n = /^\d{2}$/.test(code) ? Number(code) : 0;
    if (n >= 1 && n <= STATIONS_PER_UNIVERSE) return Math.floor((n - 1) / count);
    return hashString(`pass:${station}`) % 97;
}

// A format's palette lists options for each role (bass, lead, pad, kit...).
// A station plays one option per role, and keeps a second one that its
// sections can swap in now and then, so a long listen keeps changing.
export function paletteFor(format, station, count) {
    const main = {};
    const alt = {};
    const pass = formatPass(station, count);
    for (const [role, options] of Object.entries(format.palette || {})) {
        const base = hashString(`${format.id}:${role}`) % options.length;
        main[role] = options[(base + pass) % options.length];
        alt[role] = options[(base + pass + 1) % options.length];
    }
    return { main, alt };
}

// A piece is the handful of numbers a station turns into. Everything else is
// derived from these plus named random streams.
export function createPiece(raw) {
    const station = normalizeStation(raw);
    const format = formatOf(station);
    const universe = format ? format.universe : getUniverse(station.split('-')[0]);
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
    // the echo always repeats on the beat; halve it rather than let it overflow
    let echoSeconds = (60 / bpm) * (universe.echoBeats ?? 1.5);
    while (echoSeconds > 2.5) echoSeconds /= 2;
    // one swing for the whole piece, so overlapping scenes never flam
    const sw = universe.swing || [0, 0];
    const swing = rng.fork('swing').range(sw[0], sw[1]);
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
        swing,
        reverbT60: r.t60[0] + (r.t60[1] - r.t60[0]) * space,
        reverbDamping: r.damping[0] + (r.damping[1] - r.damping[0]) * brightness,
        reverbSize: r.size ?? 1.6,
        echoSeconds,
        harmony: {
            ...h,
            holdMin: h.holdMin * (1.2 - density * 0.4),
            holdMax: h.holdMax * (1.2 - density * 0.4),
        },
    };
    if (format) {
        const { main, alt } = paletteFor(format, station, getUniverse(station.split('-')[0]).formats.length);
        piece.palette = main;
        piece.paletteAlt = alt;
    }
    piece.sceneWeights = universe.sceneWeights ? { ...universe.sceneWeights } : Object.fromEntries(Object.entries(universe.scenes).map(([name, s]) => [
        name, typeof s.weight === 'function' ? s.weight(piece) : s.weight,
    ]));
    return piece;
}
