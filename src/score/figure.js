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
};

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
        this.next = stepTime(this.index, this.step, this.swing);
        this.build = rng.fork('pattern');
        this.slots = o.slots ?? 4;
        this.form = repetitionForm(this.build, this.slots, o.repeat);
        this.figures = [];
        for (let k = 0; k <= Math.max(...this.form); k++) this.figures.push(this._figure());
        this.pan = o.pan ?? rng.range(-0.5, 0.5);
    }

    _figure() {
        const o = this.o;
        const rng = this.build;
        let notes = GENERATORS[o.gen](rng, this.grid, o);
        if (o.gen !== 'arp' && o.gen !== 'line') notes = arrange(rng, notes, o.clusters, o.repeat);
        notes = clean(notes);
        if (o.interlock !== undefined) {
            notes = notes.filter((n) => n.step % 2 === o.interlock).map((n) => ({ ...n, row: n.row + o.interlock }));
        }
        if (!notes.length) notes = [{ step: 0, row: 0, steps: 2 }];
        // velocity is accent plus a little seeded life, fixed with the figure
        const byStep = Array.from({ length: STEPS }, () => []);
        for (const n of notes) {
            n.vel = Math.min(1, accent(n.step) * rng.range(0.88, 1.08));
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
        const pos = ((i % cycle) + cycle) % cycle;
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
        return here.map((n) => instrumentEvent(
            o.instrument, t, voices[Math.min(n.row, voices.length - 1)],
            fade * o.gain * (0.55 + 0.45 * n.vel), this.pan, this.rng,
            // `ring` lets struck instruments sound out instead of being damped
            { ...(o.ring ? {} : { dur: n.steps * this.step * o.legato }), vel: n.vel, ...o.extra },
        ));
    }
}

// Drums on the same grid, as committed 2-bar figures with a fill in the last
// slot of each form. Styles: four (four to the floor), electro (808 breaks),
// halfstep (shuffled half-time, after Burial).
const KICKS = {
    four: [[0, 4, 8, 12]],
    electro: [[0, 10], [0, 6, 10], [0, 3, 10], [0, 7, 10, 13], [0, 6, 11]],
    halfstep: [[0, 10], [0, 11], [0, 7, 10], [0, 14]],
};

export class KitLane extends Lane {
    constructor(scene, rng, { style = 'four', kick = {}, gain = 1, clap = 0.11, hat = 0.1, perc = 0.06, open = 0.3 } = {}) {
        super(scene, rng, 0);
        this.grid = scene.grid;
        this.step = 60 / scene.piece.bpm / 4;
        this.swing = this.grid.swing;
        this.index = Math.ceil(scene.start / this.step);
        this.next = stepTime(this.index, this.step, this.swing);
        Object.assign(this, { style, kickShape: kick, gain, clap, hat, perc, open });
        this.kickMidi = 25 + pitchClass(scene.key.tonic - 25);
        const b = rng.fork('pattern');
        this.slots = 4;
        this.form = repetitionForm(b, this.slots, 0.75);
        const bar = b.pick(KICKS[style] || KICKS.four);
        const base = [];
        for (const half of [0, 16]) {
            for (const s of bar) base.push({ step: half + s, kind: 'kick' });
            if (style === 'halfstep') base.push({ step: half + 8, kind: 'clap' });
            else for (const s of [4, 12]) base.push({ step: half + s, kind: 'clap' });
        }
        // hats: eighths, sixteenths or the shared grid, with Gyro accents
        const hatEvery = style === 'halfstep' ? 0 : b.pick([1, 2, 2]);
        for (let s = 0; s < STEPS; s++) {
            const onGrid = this.grid.onsets.includes(s);
            if (hatEvery ? s % hatEvery === 0 : onGrid || b.chance(0.3)) base.push({ step: s, kind: style === 'four' && s % 4 === 2 && b.chance(open * 2) ? 'open' : 'hat' });
            if (onGrid && s % 4 !== 0 && b.chance(0.5)) base.push({ step: s, kind: 'perc' });
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
        const pos = i % cycle;
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
                    out.push({ type: 'kick', layer: 'kick', time: t, midi: this.kickMidi, gain: 0.17 * g * (0.7 + 0.3 * v), reverb: 0.04, ...this.kickShape });
                    break;
                case 'clap':
                    out.push({ type: 'clap', layer: 'snare', time: t, gain: this.clap * g * (0.6 + 0.4 * v), reverb: 0.35, echo: 0.12, pan: 0.04 });
                    break;
                case 'hat':
                case 'open':
                    out.push({ type: 'tick', layer: 'ticks', time: t, gain: this.hat * g * v * v, pan: -0.25, reverb: 0.12, tone: 8500, decay: n.kind === 'open' ? 0.16 : 0.03 });
                    break;
                case 'perc':
                    if (this.perc) out.push({ type: 'tick', layer: 'ticks', time: t, gain: this.perc * g * v, pan: 0.35, reverb: 0.3, echo: 0.3, tone: 2400, decay: 0.05 });
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
