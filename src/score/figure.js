import { notesInRange, pitchClass } from '../core/theory.js';
import { Lane, accent, instrumentEvent, smooth } from './lanes.js';

export { accent };

// Committed figures after 10K Audio's Gyro. A figure is a 2-bar grid of
// sixteenths whose notes name a chord voice (a row, 0 = lowest), never a
// pitch, so one figure plays over any chord and follows the harmony for free.
// It is built once and repeats; phrase forms (AABA, ABAB...) decide which of
// a few figures plays in each 2-bar slot. Every draw comes from a named fork,
// so a station always plays the same figures.

export const STEPS = 32; // two bars of sixteenths
const ROWS = 6;

// Gyro's weighted_random_curve: r^(2^p) pushes results hard towards 0, so a
// higher p means fewer notes, earlier in the bar and lower in the chord.
export function curve(rng, max, p) {
    return Math.min(max - 1, Math.floor(Math.pow(rng.next(), Math.pow(2, p)) * max));
}

// Gyro's arrange_repetition: slot i reuses one of the first
// max(round((1 - r) * n), 1) phrases with probability r, else it gets a new
// one. r = 0 gives ABCD, r = 1 gives AAAA, 0.5 gives AABA or ABAB.
export function repetitionForm(rng, n, r) {
    const form = [0];
    let made = 1;
    for (let i = 1; i < n; i++) {
        if (rng.chance(r)) {
            const pool = Math.max(Math.round((1 - r) * n), 1);
            form.push(rng.int(0, Math.min(pool, made) - 1));
        } else {
            form.push(made++);
        }
    }
    return form;
}

// One onset grid per scene, shared by every figure and drum kit in it (Gyro
// draws splatter_grid_time_grid once per pattern for all four layers). It is
// most of why layers sound arranged rather than scattered.
export function sceneGrid(rng, swing = 0) {
    const spacing = rng.weighted([[2, 4], [3, 2.5], [4, 3], [6, 1]]);
    const set = new Set([0, 16]);
    for (let s = 0; s < STEPS; s += spacing) set.add(s);
    // a few syncopations every layer agrees on
    const extra = rng.int(1, 3);
    for (let i = 0; i < extra; i++) set.add(rng.int(1, 15) + rng.pick([0, 16]));
    const onsets = [...set].sort((a, b) => a - b);
    return {
        spacing,
        onsets,
        swing,
        length: Math.max(1, Math.round(spacing * rng.pick([0.5, 1, 1, 1.5]))),
    };
}

// Time of grid step i (sixteenths counted from t = 0), with the piece's swing
// on the off sixteenths.
export function stepTime(i, step, swing) {
    return i * step + (i % 2 ? swing * step : 0);
}

// ------------------------------------------------------------ generators

// gaps of 2, 4, 6 or 8 sixteenths until the two bars are full
function grow(rng) {
    const out = [];
    for (let s = 0; s < STEPS; s += rng.weighted([[2, 3], [4, 3], [6, 2], [8, 1]])) out.push(s);
    return out;
}

function snapTo(onsets, s) {
    let best = onsets[0];
    for (const o of onsets) if (Math.abs(o - s) < Math.abs(best - s)) best = o;
    return best;
}

export const GENERATORS = {
    // few notes, early in the bar, mostly the bottom of the chord
    bass(rng, grid, { bias = 2 }) {
        const n = 2 + curve(rng, 5, 1);
        const notes = [{ step: 0, row: 0, steps: 4 }];
        for (let i = 1; i < n; i++) {
            notes.push({
                step: grid.onsets[curve(rng, grid.onsets.length, Math.max(0, bias - 1))],
                row: curve(rng, 3, 2),
                steps: rng.weighted([[1, 1], [2, 3], [3, 2], [4, 2], [6, 1]]),
            });
        }
        return notes;
    },
    // the melodic one: rows weighted 1,2,3,3,3,2 keep it in the middle of the
    // chord, away from the bass and the top
    hook(rng, grid, { lock = 0.7 }) {
        const onsets = rng.pick([[0, 3, 8, 12, 13, 30], [0, 4, 6, 8, 14], [0, 3, 4, 7, 8, 11, 12], [0, 6, 12, 16, 22], grow(rng)]);
        return onsets.map((s) => ({
            step: rng.chance(lock) ? snapTo(grid.onsets, s) : s,
            row: rng.weighted([[0, 1], [1, 2], [2, 3], [3, 3], [4, 3], [5, 2]]),
            steps: rng.weighted([[1, 1], [2, 1], [4, 5], [6, 5], [8, 2]]),
        }));
    },
    // scattered notes; the bias makes layers stratify by themselves
    splatter(rng, grid, { bias = 0 }) {
        const n = 2 + curve(rng, 8, 1);
        return Array.from({ length: n }, () => ({
            step: grid.onsets[curve(rng, grid.onsets.length, bias)],
            row: curve(rng, ROWS, bias),
            steps: rng.int(1, 8),
        }));
    },
    // Gyro's splatter grid: every shared onset, a clamped random walk on the rows
    walk(rng, grid, { density = 0.8, height = 4 }) {
        const base = rng.int(0, ROWS - height);
        let row = base + rng.int(0, height - 1);
        const notes = [];
        for (const step of grid.onsets) {
            if (step && !rng.chance(density)) continue;
            row = Math.max(base, Math.min(base + height - 1, row + rng.weighted([[-1, 2], [0, 1], [1, 2]])));
            notes.push({ step, row, steps: grid.length });
        }
        return notes;
    },
    // up, down, up-down or down-up over a window of rows, notes end to end
    arp(rng, grid, { rate = null }) {
        const span = rng.int(3, 5);
        const base = rng.int(0, ROWS - span);
        const len = rate ?? rng.weighted([[1, 6], [2, 4], [3, 1], [4, 1]]);
        const dir = rng.pick(['up', 'down', 'updown', 'downup']);
        const cycle = dir === 'up' || dir === 'down' ? span : 2 * span - 2;
        const notes = [];
        for (let k = 0, s = 0; s < STEPS; k++, s += len) {
            const p = k % cycle;
            const up = p < span ? p : cycle - p;
            const r = dir === 'up' ? p : dir === 'down' ? span - 1 - p : dir === 'updown' ? up : span - 1 - up;
            notes.push({ step: s, row: base + r, steps: len });
        }
        return notes;
    },
    // comping: two or three rows stacked on a few shared onsets
    chord(rng, grid, { hits = [2, 4] }) {
        const n = rng.int(hits[0], hits[1]);
        const pool = grid.onsets.filter((s) => s % 4 !== 0 || rng.chance(0.3));
        const steps = new Set();
        for (let i = 0; i < n && pool.length; i++) steps.add(pool[rng.int(0, pool.length - 1)]);
        const notes = [];
        for (const step of steps) {
            const top = rng.int(2, 4);
            for (let row = top - rng.int(1, 2); row <= top; row++) notes.push({ step, row, steps: rng.pick([1, 2, 2, 3]) });
        }
        return notes;
    },
    // a dense sixteenth line, for interlocking pairs
    line(rng, grid, { height = 4 }) {
        return GENERATORS.walk(rng, { ...grid, onsets: Array.from({ length: STEPS }, (_, i) => i), length: 1 }, { density: 1, height });
    },
    // EBM: the sequencer running sixteenths on the root, octave jumps in a
    // fixed cell (Front 242, Nitzer Ebb), the fifth at the end of a bar
    pump(rng) {
        const cell = rng.pick([[0, 0, 0, 0], [0, 12, 0, 12], [0, 0, 12, 0], [0, null, 0, 0], [0, 0, null, 12], [0, null, 12, 0]]);
        const turn = rng.chance(0.6);
        const notes = [];
        for (let s = 0; s < STEPS; s++) {
            const oct = cell[s % 4];
            if (oct === null) continue;
            const end = turn && s % 16 >= 14;
            notes.push({ step: s, row: end ? 1 : 0, oct: end ? 0 : oct, steps: 1 });
        }
        return notes;
    },
    // synthwave: eighths on the root, straight or jumping the octave
    octaves(rng) {
        const jump = rng.chance(0.65);
        const notes = [];
        for (let s = 0; s < STEPS; s += 2) notes.push({ step: s, row: 0, oct: jump && (s / 2) % 2 ? 12 : 0, steps: 2 });
        return notes;
    },
    // a 303 line: sixteenths with rests, accents, slides and octave jumps
    acid(rng, grid, { fill = 0.7 }) {
        const notes = [];
        for (let s = 0; s < STEPS; s++) {
            if (s && !rng.chance(fill)) continue;
            notes.push({
                step: s,
                row: rng.weighted([[0, 5], [1, 2], [2, 2], [3, 1]]),
                oct: rng.chance(0.22) ? 12 : 0,
                slide: s > 0 && rng.chance(0.25),
                acc: rng.chance(0.3) ? 1.6 : 0.8,
                steps: rng.weighted([[1, 3], [2, 1]]),
            });
        }
        return notes;
    },
    // reggae skank: a short chord chop on two and four
    skank(rng) {
        const top = rng.int(3, 4);
        const len = rng.pick([1, 1, 2]);
        const notes = [];
        for (const step of [4, 12, 20, 28]) for (let row = top - 2; row <= top; row++) notes.push({ step, row, steps: len });
        return notes;
    },
    // the organ bubble: a pair of sixteenths after every beat, low then high
    bubble(rng) {
        const notes = [];
        const lift = rng.int(1, 2);
        for (let beat = 0; beat < STEPS; beat += 4) {
            notes.push({ step: beat + 2, row: lift, steps: 1 }, { step: beat + 3, row: lift + 2, steps: 1 });
        }
        return notes;
    },
    // trap 808: a few long notes where the kick would be, some sliding
    trap(rng) {
        const bar = rng.pick([[0, 7, 10], [0, 10, 14], [0, 6, 11], [0, 3, 10, 14], [0, 11]]);
        const steps = [];
        for (const half of [0, 16]) for (const s of bar) steps.push(half + s);
        return steps.map((step, i) => ({
            step,
            row: i && rng.chance(0.3) ? rng.int(1, 2) : 0,
            oct: i && rng.chance(0.2) ? 12 : 0,
            slide: i > 0 && rng.chance(0.35),
            steps: (steps[i + 1] ?? STEPS) - step,
        }));
    },
    // complextro: a sixteenth line on the root and its octaves that switches
    // patch every few notes (Porter Robinson, Wolfgang Gartner, Zedd), with
    // rests, slides and the odd ratchet; the order of the patches is part of
    // the figure, so the switch-ups come back as written
    complex(rng, grid, { patches = [], fill = 0.72 }) {
        const count = patches.length || 4;
        const every = rng.weighted([[1, 2], [2, 3], [3, 1], [4, 2]]);
        const order = Array.from({ length: count }, (_, i) => i);
        for (let i = count - 1; i > 0; i--) {
            const j = rng.int(0, i);
            [order[i], order[j]] = [order[j], order[i]];
        }
        const cell = rng.pick([[0, 0, 12, 0], [0, 12, 0, 0], [0, 0, 0, 12], [0, null, 0, 12], [0, 0, null, 0], [0, 12, null, 24], [0, null, 12, 0]]);
        const notes = [];
        let k = 0;
        for (let s = 0; s < STEPS; s++) {
            const oct = cell[s % 4];
            if (oct === null || (s % 8 && !rng.chance(fill))) continue;
            const patch = rng.chance(0.15) ? rng.int(0, count - 1) : order[Math.floor(k / every) % count];
            notes.push({
                step: s,
                row: rng.chance(0.12) ? 1 : 0,
                oct,
                steps: rng.weighted([[1, 4], [2, 3], [3, 1], [4, 1]]),
                patch,
                slide: rng.chance(0.1),
                ratchet: rng.chance(0.07) ? rng.pick([2, 3, 4]) : 0,
            });
            k++;
        }
        return notes;
    },
    // dubstep: long notes, each its own patch and its own wobble speed
    // (cycles per beat), short ones sometimes doubled
    wub(rng, grid, { patches = [] }) {
        const count = patches.length || 4;
        const lens = rng.pick([[4, 4, 8, 4, 4, 8], [8, 2, 2, 4, 8, 8], [6, 6, 4, 8, 8], [3, 3, 2, 8, 4, 4, 8], [2, 2, 4, 2, 2, 4, 8, 8], [12, 4, 6, 6, 4]]);
        const notes = [];
        for (let s = 0, i = 0; s < STEPS; s += lens[i % lens.length], i++) {
            const len = lens[i % lens.length];
            if (s && rng.chance(0.12)) continue;
            notes.push({
                step: s,
                row: rng.chance(0.2) ? 1 : 0,
                oct: rng.chance(0.25) ? 12 : 0,
                steps: len,
                patch: rng.int(0, count - 1),
                lfoDiv: rng.pick([0.5, 1, 1, 1.5, 2, 2, 3, 4]),
                ratchet: len <= 2 && rng.chance(0.4) ? 2 : 0,
                slide: rng.chance(0.15),
            });
        }
        return notes;
    },
    // vocal chops: syllables of the station's word on a syncopated rhythm,
    // high in the chord; some stutter, some jump an octave (pitched-up chops)
    chop(rng, grid, { word = [{ vowels: ['a'] }], stutter = 0.14, up = 0.15 }) {
        const rhythm = rng.pick([[0, 3, 6, 8, 11, 14], [0, 2, 3, 6, 8, 10, 11, 14], [0, 3, 6, 10, 12], [2, 4, 6, 10, 14], [0, 6, 8, 10, 14], [0, 1, 2, 3, 8, 11, 14], [0, 3, 4, 7, 8, 12]]);
        const notes = [];
        let k = rng.int(0, word.length - 1);
        for (const half of [0, 16]) {
            const keep = half && rng.chance(0.5) ? rhythm.filter(() => rng.chance(0.75)) : rhythm;
            keep.forEach((step, i) => {
                const next = keep[i + 1] ?? 16;
                const syl = word[k++ % word.length];
                notes.push({
                    step: half + step,
                    row: rng.weighted([[2, 1], [3, 3], [4, 3], [5, 2]]),
                    oct: rng.chance(up) ? 12 : 0,
                    steps: Math.max(1, Math.min(4, next - step)),
                    ratchet: rng.chance(stutter) ? rng.pick([2, 3, 4]) : 0,
                    ev: { vowels: syl.vowels, cons: syl.cons },
                });
            });
        }
        return notes;
    },
    // trance: the bass rolls on the sixteenths between the kicks
    roll(rng, grid, { offsets = null }) {
        const offs = offsets ?? rng.pick([[1, 2, 3], [1, 2, 3], [2, 3], [1, 3], [2]]);
        const jump = rng.chance(0.4);
        const notes = [];
        for (let beat = 0; beat < STEPS; beat += 4) {
            for (const o of offs) notes.push({ step: beat + o, row: 0, oct: jump && o === 3 && beat % 8 === 4 ? 12 : 0, steps: 1 });
        }
        return notes;
    },
    // the whole chord on a rhythm: offbeat house stabs, a 3-3-2, a future
    // bass swell, a complextro syncopation
    stabs(rng, grid, { pattern = null, rows = [1, 4] }) {
        const p = pattern ?? rng.pick(STAB_RHYTHMS);
        const notes = [];
        for (const [step, steps] of p) for (let row = rows[0]; row <= rows[1]; row++) notes.push({ step, row, steps });
        return notes;
    },
    // a trance gate: the chord chopped in sixteenths by a fixed pattern
    gate(rng, grid, { rows = [1, 4] }) {
        const bits = rng.pick(['1011101110111011', '1101101101101101', '1110111011101110', '1011011010110110', '1111011101110111']);
        const notes = [];
        for (let s = 0; s < STEPS; s++) {
            if (bits[s % 16] === '1') for (let row = rows[0]; row <= rows[1]; row++) notes.push({ step: s, row, steps: 1 });
        }
        return notes;
    },
};

// [step, length] pairs over two bars
const STAB_RHYTHMS = [
    [2, 6, 10, 14, 18, 22, 26, 30].map((s) => [s, 2]),
    [[0, 3], [3, 3], [6, 2], [8, 3], [11, 3], [14, 2], [16, 3], [19, 3], [22, 2], [24, 3], [27, 3], [30, 2]],
    [[0, 6], [6, 4], [10, 6], [16, 6], [22, 4], [26, 6]],
    [[0, 2], [3, 1], [6, 2], [10, 1], [12, 2], [14, 2], [16, 2], [19, 1], [22, 2], [24, 1], [27, 1], [30, 2]],
    [[0, 3], [3, 3], [6, 4], [12, 4], [16, 3], [19, 3], [22, 2], [26, 6]],
];

// Cut the two bars into slots and let later slots repeat earlier ones,
// so a figure answers itself (cluster.lua's arrange step).
export function arrange(rng, notes, clusters, r) {
    if (clusters < 2) return notes;
    const size = STEPS / clusters;
    const form = repetitionForm(rng, clusters, r);
    const out = [];
    form.forEach((src, slot) => {
        for (const n of notes) {
            const s = n.step - src * size;
            if (s >= 0 && s < size) out.push({ ...n, step: s + slot * size });
        }
    });
    return out;
}

// Gyro's clean_array: the earlier of two overlapping notes on a row is cut
// short, zero-length notes go, nothing runs past the end of the figure.
export function clean(notes) {
    const sorted = notes
        .filter((n) => n.step >= 0 && n.step < STEPS)
        .sort((a, b) => a.step - b.step || a.row - b.row);
    const out = [];
    const last = new Map();
    for (const n of sorted) {
        const prev = last.get(n.row);
        if (prev && prev.step === n.step) continue;
        if (prev && prev.step + prev.steps > n.step) prev.steps = n.step - prev.step;
        const note = { ...n, steps: Math.min(n.steps, STEPS - n.step) };
        out.push(note);
        last.set(n.row, note);
    }
    return out.filter((n) => n.steps > 0);
}

// ------------------------------------------------------------------ lane

// Plays committed figures on the scene's grid. Options:
//   gen        generator name (bass, hook, splatter, walk, arp, chord, line)
//   bias       Gyro's per-layer exponent: higher = sparser, earlier, lower
//   lo, hi     register the chord voices are taken from
//   root       row 0 is the bass note of the chord (bass figures)
//   rate       grid steps per figure step (2 = eighths)
//   repeat     arrange_repetition, inside a figure and across the form
//   clusters   slots per figure for the inner repetition
//   interlock  0 or 1: play only even or odd sixteenths of the figure, so two
//              lanes built from the same fork interlock (kotekan)
//   evolve     chance a later figure is redrawn at the end of each form
//   ring       let struck instruments ring instead of damping them
export class FigureLane extends Lane {
    constructor(scene, rng, opts) {
        super(scene, rng, 0);
        const o = { bias: 0, rate: 1, repeat: 0.5, clusters: 2, legato: 0.9, gain: 1, evolve: 0.2, root: false, ...opts };
        this.o = o;
        this.grid = scene.grid;
        this.step = (60 / scene.piece.bpm / 4) * o.rate;
        this.swing = o.rate === 1 ? this.grid.swing : 0;
        this.index = Math.ceil(scene.start / this.step);
        // forms count from the lane's first step, so a section that starts on
        // a bar line (a drop) starts on its first figure
        this.first = this.index;
        this.next = stepTime(this.index, this.step, this.swing);
        this.build = rng.fork('pattern');
        this.slots = o.slots ?? 4;
        this.form = repetitionForm(this.build, this.slots, o.repeat);
        this.figures = [];
        for (let k = 0; k <= Math.max(...this.form); k++) this.figures.push(this._figure());
        this.pan = o.pan ?? rng.range(-0.5, 0.5);
        this.last = null;
    }

    _figure() {
        const o = this.o;
        const rng = this.build;
        let notes = GENERATORS[o.gen](rng, this.grid, o);
        if (!['arp', 'line', 'pump', 'octaves', 'trap', 'skank', 'bubble', 'roll', 'stabs', 'gate', 'wub', 'chop'].includes(o.gen)) notes = arrange(rng, notes, o.clusters, o.repeat);
        notes = clean(notes);
        if (o.interlock !== undefined) {
            notes = notes.filter((n) => n.step % 2 === o.interlock).map((n) => ({ ...n, row: n.row + o.interlock }));
        }
        if (!notes.length) notes = [{ step: 0, row: 0, steps: 2 }];
        // velocity is accent plus a little seeded life, fixed with the figure
        const byStep = Array.from({ length: STEPS }, () => []);
        for (const n of notes) {
            n.vel = Math.min(1, accent(n.step) * rng.range(0.88, 1.08) * (n.acc ?? 1));
            byStep[n.step].push(n);
        }
        return byStep;
    }

    _voices(chord) {
        const o = this.o;
        if (!o.root) return notesInRange(chord.pcs, o.lo, o.hi);
        let bass = chord.bass;
        while (bass < o.lo) bass += 12;
        while (bass - 12 >= o.lo) bass -= 12;
        return [bass, ...notesInRange(chord.pcs, bass + 1, o.hi)];
    }

    fire(t) {
        const i = this.index++;
        this.next = stepTime(this.index, this.step, this.swing);
        const cycle = this.slots * STEPS;
        const pos = (i - this.first) % cycle;
        // at the end of each form, now and then redraw a later figure: the
        // first one stays, so the piece keeps its theme
        if (pos === 0 && this.figures.length > 1 && this.build.chance(this.o.evolve)) {
            this.figures[this.build.int(1, this.figures.length - 1)] = this._figure();
        }
        const here = this.figures[this.form[Math.floor(pos / STEPS)]][pos % STEPS];
        if (!here.length) return [];
        const level = this.scene.level(t);
        if (level < 0.12) return [];
        // rows resolve against the chord sounding now (Gyro's repitch), so a
        // chord change lands mid-figure without restarting it
        const voices = this._voices(this.harmony.chordAt(t));
        if (!voices.length) return [];
        const o = this.o;
        const fade = smooth((level - 0.12) / 0.4);
        const out = [];
        for (const n of here) {
            const midi = voices[Math.min(n.row, voices.length - 1)] + (n.oct || 0);
            // a slide starts from the lane's last note (303 and 808 glides)
            const slide = n.slide && this.last !== null ? { fromMidi: this.last } : {};
            this.last = midi;
            // a lane can switch patch from note to note (complextro)
            const instrument = o.patches ? o.patches[(n.patch || 0) % o.patches.length] : o.instrument;
            const per = { ...n.ev };
            if (n.lfoDiv) per.lfo = n.lfoDiv * this.scene.piece.bpm / 60;
            // the chord as a chip arpeggio, from this note up
            // ducked by an imagined kick on every beat (side-chain)
            if (o.pump) per.pump = { beat: 60 / this.scene.piece.bpm, depth: o.pump };
            if (o.chordArp) per.arp = [0, ...voices.filter((v) => v > midi && v < midi + 12).map((v) => v - midi)];
            const gain = fade * o.gain * (0.55 + 0.45 * n.vel);
            const len = n.steps * this.step;
            const hits = n.ratchet > 1 ? n.ratchet : 1;
            for (let j = 0; j < hits; j++) {
                out.push(instrumentEvent(
                    instrument, t + (j * len) / hits, midi,
                    gain * (j ? 0.85 : 1), this.pan, this.rng,
                    // `ring` lets struck instruments sound out instead of being damped
                    { ...(o.ring ? {} : { dur: (len / hits) * (hits > 1 ? 0.7 : o.legato) }), vel: n.vel, ...(j ? {} : slide), ...per, ...o.extra },
                ));
            }
        }
        return out;
    }
}

// Drums on the same grid, as committed 2-bar figures with a fill in the last
// slot of each form. Styles: four (four to the floor), electro (808 breaks),
// halfstep (shuffled half-time, after Burial).
const KICKS = {
    four: [[0, 4, 8, 12]],
    // broken industrial kicks under a backbeat
    breaks: [[0, 7, 10], [0, 3, 10, 11], [0, 6, 9, 14], [0, 10, 13]],
    electro: [[0, 10], [0, 6, 10], [0, 3, 10], [0, 7, 10, 13], [0, 6, 11]],
    halfstep: [[0, 10], [0, 11], [0, 7, 10], [0, 14]],
    // trap: half-time, the kick following the 808
    trap: [[0, 7, 10], [0, 10, 14], [0, 6, 11], [0, 3, 10, 14]],
    ebm: [[0, 4, 8, 12]],
    // the score's tribal drums: a kick and toms answering it
    tribal: [[0, 6, 10], [0, 3, 8, 11], [0, 10, 12]],
    // roots reggae: the one drop, kick and rim together on the third beat
    onedrop: [[8]],
    // UK steppers: a kick on every beat under a half-time snare
    steppers: [[0, 4, 8, 12]],
    // hyperpop bounce: half-time, the kick skipping around the clap
    bounce: [[0, 3, 6, 10], [0, 7, 10, 11], [0, 3, 10, 14], [0, 6, 7, 10]],
    // drum & bass: the two-step, snares on two and four of the half-time bar
    dnb: [[0, 10], [0, 7, 10], [0, 10, 11], [0, 6, 10]],
};
const HALF_TIME = ['halfstep', 'trap', 'tribal', 'onedrop', 'steppers', 'bounce'];

export class KitLane extends Lane {
    constructor(scene, rng, { style = 'four', kick = {}, kickGain = 1, gain = 1, clap = 0.11, snare = 0, hat = 0.1, perc = 0.06, metal = 0, open = 0.3, toms = 0, rolls = 0 } = {}) {
        super(scene, rng, 0);
        this.grid = scene.grid;
        this.step = 60 / scene.piece.bpm / 4;
        this.swing = this.grid.swing;
        this.index = Math.ceil(scene.start / this.step);
        this.first = this.index;
        this.next = stepTime(this.index, this.step, this.swing);
        Object.assign(this, { style, kickShape: kick, kickGain, gain, clap, snare, hat, perc, metal, open, toms });
        this.kickMidi = 25 + pitchClass(scene.key.tonic - 25);
        const b = rng.fork('pattern');
        this.slots = 4;
        this.form = repetitionForm(b, this.slots, 0.75);
        const bar = b.pick(KICKS[style] || KICKS.four);
        const base = [];
        for (const half of [0, 16]) {
            for (const s of bar) base.push({ step: half + s, kind: 'kick' });
            if (HALF_TIME.includes(style)) base.push({ step: half + 8, kind: 'clap' });
            else for (const s of [4, 12]) base.push({ step: half + s, kind: 'clap' });
        }
        // hats: eighths, sixteenths or the shared grid, with Gyro accents
        const rolling = style === 'trap' || style === 'bounce';
        const hatEvery = style === 'halfstep' || style === 'tribal' ? 0 : rolling || style === 'onedrop' ? 2 : b.pick([1, 2, 2]);
        for (let s = 0; s < STEPS; s++) {
            const onGrid = this.grid.onsets.includes(s);
            // EBM and techno: the open hat on every offbeat
            const open = style === 'ebm' ? s % 4 === 2 : style === 'four' && s % 4 === 2 && b.chance(this.open * 2);
            // trap: now and then the hat breaks into a roll of triplets or 32nds
            if (rolling && s % 2 === 0 && b.chance(rolls)) base.push({ step: s, kind: 'roll', n: b.pick([3, 4, 6]), len: b.pick([1, 2, 2]) });
            else if (hatEvery ? s % hatEvery === 0 : onGrid || b.chance(0.3)) base.push({ step: s, kind: open ? 'open' : 'hat' });
            if (onGrid && s % 4 !== 0 && b.chance(0.5)) base.push({ step: s, kind: 'perc' });
            if (toms && onGrid && s % 8 !== 0 && b.chance(0.6)) base.push({ step: s, kind: 'tom', pitch: b.pick([7, 12, 15, 19]) });
        }
        // the fill: a few extra hits in the last half bar, and a ghost before it
        const fill = base.filter((n) => n.step < 28);
        for (let s = 28; s < STEPS; s++) if (b.chance(0.55)) fill.push({ step: s, kind: b.pick(['clap', 'perc', 'kick']) });
        this.figures = [base, fill].map((list) => {
            const byStep = Array.from({ length: STEPS }, () => []);
            for (const n of list) byStep[n.step].push({ ...n, vel: accent(n.step) * b.range(0.85, 1.05) });
            return byStep;
        });
    }

    fire(t) {
        const i = this.index++;
        this.next = stepTime(this.index, this.step, this.swing);
        const cycle = this.slots * STEPS;
        const pos = (i - this.first) % cycle;
        const slot = Math.floor(pos / STEPS);
        const fig = slot === this.slots - 1 ? 1 : 0;
        const level = this.scene.level(t);
        if (level < 0.45) return [];
        const g = smooth((level - 0.45) / 0.35) * this.gain;
        const out = [];
        for (const n of this.figures[fig][pos % STEPS]) {
            const v = n.vel;
            switch (n.kind) {
                case 'kick':
                    if (this.kickGain) out.push({ type: 'kick', layer: 'kick', time: t, midi: this.kickMidi, gain: 0.17 * this.kickGain * g * (0.7 + 0.3 * v), reverb: 0.04, ...this.kickShape });
                    break;
                case 'clap':
                    out.push({ type: 'clap', layer: 'snare', time: t, gain: this.clap * g * (0.6 + 0.4 * v), reverb: 0.35, echo: 0.12, pan: 0.04 });
                    // a snare under the clap, thrown into a big room (gated-reverb feel)
                    if (this.snare) out.push({ type: 'snare', layer: 'snare', time: t, gain: this.snare * g * (0.6 + 0.4 * v), tone: 2600, body: 190, decay: 0.16, reverb: 0.6, pan: -0.04 });
                    break;
                case 'tom':
                    out.push({ type: 'kick', layer: 'snare', time: t, midi: this.kickMidi + n.pitch, gain: this.toms * g * v, punch: 90, sweep: 0.05, decay: 0.32, tone: 2200, click: 0.3, drive: 0.7, reverb: 0.35, pan: ((n.pitch % 5) - 2) * 0.12 });
                    break;
                case 'roll':
                    for (let k = 0; k < n.n; k++) {
                        out.push({ type: 'tick', layer: 'ticks', time: t + (k * n.len * this.step) / n.n, gain: this.hat * g * (0.5 + 0.5 * k / n.n), pan: -0.2, reverb: 0.1, tone: 9000, decay: 0.025 });
                    }
                    break;
                case 'hat':
                case 'open':
                    out.push({ type: 'tick', layer: 'ticks', time: t, gain: this.hat * g * v * v, pan: -0.25, reverb: 0.12, tone: 8500, decay: n.kind === 'open' ? 0.16 : 0.03 });
                    break;
                case 'perc':
                    if (this.perc) out.push({ type: 'tick', layer: 'ticks', time: t, gain: this.perc * g * v, pan: 0.35, reverb: 0.3, echo: 0.3, tone: 2400, decay: 0.05 });
                    if (this.metal) {
                        // struck metal on a chord tone: industrial, still in key
                        const tones = notesInRange(this.harmony.chordAt(t).pcs, 76, 90);
                        if (tones.length) out.push({ type: 'modal', layer: 'ticks', preset: 'metal', time: t, midi: tones[i % tones.length], gain: this.metal * g * v, ring: 0.45, pan: (i % 3) * 0.3 - 0.3, reverb: 0.35, echo: 0.25 });
                    }
                    break;
                default:
            }
        }
        return out;
    }
}

// One struck note every few bars, on the bar line: the gong that closes a
// gamelan cycle, or any other marker of the large form.
export class CycleLane extends Lane {
    constructor(scene, rng, { bars = 4, instrument = 'gong', octave = 1, gain = 1, extra } = {}) {
        super(scene, rng, 0);
        this.period = (60 / scene.piece.bpm) * 4 * bars;
        this.index = Math.ceil(scene.start / this.period);
        this.next = this.index * this.period;
        Object.assign(this, { instrument, octave, gain, extra });
    }

    fire(t) {
        this.index++;
        this.next = this.index * this.period;
        const level = this.scene.level(t);
        if (level < 0.2) return [];
        const chord = this.harmony.chordAt(t);
        return [instrumentEvent(this.instrument, t, chord.bass + 12 * this.octave, level * this.gain, this.rng.range(-0.2, 0.2), this.rng, { vel: 1, ...this.extra })];
    }
}
