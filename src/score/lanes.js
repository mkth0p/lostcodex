import { notesInRange, pitchClass } from '../core/theory.js';

// Lanes are tiny state machines owned by a scene. Each fires at `next`,
// returns events and moves `next` on. They never read wall-clock time, so
// the score is the same however it is chunked.

export const smooth = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));

// Accent of a sixteenth inside two bars: the 2-bar downbeat, then bars, half
// bars, beats, eighths. Gyro leaves velocity to chance; this keeps the pulse.
export function accent(step) {
    const s = ((step % 32) + 32) % 32;
    if (s === 0) return 1;
    if (s % 16 === 0) return 0.92;
    if (s % 8 === 0) return 0.84;
    if (s % 4 === 0) return 0.76;
    return s % 2 === 0 ? 0.64 : 0.54;
}

export class Lane {
    constructor(scene, rng, first = 0) {
        this.scene = scene;
        this.rng = rng;
        this.next = scene.start + first;
    }

    get harmony() {
        return this.scene.harmony;
    }

    fire() {
        this.next = Infinity;
        return [];
    }
}

function scalePcs(key) {
    return key.steps.map((s) => pitchClass(key.tonic + s));
}

// Passing scale tones are fine unless they rub a semitone or tritone on the bass.
function isSafeOver(chord, midi) {
    const d = pitchClass(midi - chord.bass);
    return d !== 1 && d !== 6;
}

function nearestFifth(chord, root) {
    const want = pitchClass(root + 7);
    if (chord.pcs.includes(want) || chord.pedal) return root + 7;
    return root + 12;
}

// ------------------------------------------------------------- instruments

// One place that knows how each instrument is played: type, envelope,
// sends and a sensible level. Lanes only choose notes and timing.
// `sample` names an instrument of the sample pack (rendered from real
// instruments and synths); the synth voice described next to it plays
// instead when the pack is not loaded. Events of type 'sample' have no synth
// fallback and are simply skipped then.
// `extra.vel` (0..1) sets the velocity, e.g. from a figure's accents.
export function instrumentEvent(name, time, midi, level, pan, rng, extra = {}) {
    const vel = extra.vel ?? 0.3 + rng.next() * 0.4;
    const base = { time, midi, pan };
    let ev;
    switch (name) {
        case 'piano':
            ev = { type: 'modal', sample: 'felt', trim: 0.45, layer: 'keys', preset: 'piano', velocity: vel, gain: 0.3 * level * (0.6 + vel), reverb: 0.55, echo: 0.04, dur: 12 };
            break;
        case 'glass':
            ev = { type: 'modal', layer: 'bells', preset: 'glass', gain: 0.12 * level * (0.6 + vel), reverb: 0.75, echo: 0.12 };
            break;
        case 'bowl':
            ev = { type: 'modal', layer: 'bells', preset: 'bowl', gain: 0.07 * level, reverb: 0.7 };
            break;
        case 'vibes':
            ev = { type: 'modal', sample: 'vibes', layer: 'bells', preset: 'vibes', gain: 0.16 * level * (0.6 + vel), reverb: 0.6, echo: 0.1 };
            break;
        case 'metal':
            ev = { type: 'modal', layer: 'texture', preset: 'metal', gain: 0.06 * level, reverb: 0.9, echo: 0.1 };
            break;
        case 'marimba':
            ev = { type: 'modal', sample: 'marimba', trim: 0.7, layer: 'keys', preset: 'marimba', velocity: vel, gain: 0.17 * level * (0.6 + vel), reverb: 0.35, echo: 0.05 };
            break;
        case 'kalimba':
            ev = { type: 'modal', sample: 'kalimba', layer: 'keys', preset: 'kalimba', gain: 0.22 * level * (0.6 + vel), reverb: 0.4, echo: 0.15 };
            break;
        case 'choir':
            ev = { type: 'pad', sample: 'choir', trim: 0.8, layer: 'choir', preset: 'choir', gain: 0.14 * level, attack: 2.5, dur: 3, release: 6, reverb: 0.7, detune: 9, cutoff: 3200 };
            break;
        case 'voice':
            ev = { type: 'pad', sample: 'ooh', layer: 'choir', preset: 'voice', gain: 0.16 * level, attack: 1.8, dur: 2.5, release: 5, reverb: 0.75, detune: 12, oscs: 5, cutoff: 3600, wow: 5, vowels: [rng.pick(['a', 'o', 'u']), rng.pick(['e', 'o', 'a'])] };
            break;
        case 'organ':
            ev = { type: 'organ', sample: 'pipes', trim: 0.75, layer: 'organ', preset: 'gedackt', gain: 0.2 * level, attack: 3, dur: 6, release: 7, reverb: 0.8 };
            break;
        case 'flute':
            ev = { type: 'flute', sample: 'xiao', layer: 'lead', gain: 0.1 * level * (0.7 + vel), dur: 1, attack: 0.1, release: 0.6, reverb: 0.55, echo: 0.2 };
            break;
        case 'lead':
            ev = { type: 'lead', layer: 'lead', gain: 0.08 * level * (0.7 + vel), dur: 1, attack: 0.06, release: 0.9, reverb: 0.45, echo: 0.3, cutoff: 1100 + vel * 900 };
            break;
        case 'celesta':
            ev = { type: 'modal', sample: 'celesta', layer: 'bells', preset: 'glass', gain: 0.12 * level * (0.6 + vel), reverb: 0.7, echo: 0.12 };
            break;
        case 'tine':
            ev = { type: 'modal', sample: 'tine', layer: 'keys', preset: 'vibes', gain: 0.14 * level * (0.6 + vel), reverb: 0.45, echo: 0.3, dur: 3 };
            break;
        case 'mflute':
            // Mellotron flute on worn tape (Boards of Canada)
            ev = { type: 'lead', sample: 'mflute', layer: 'lead', gain: 0.1 * level * (0.7 + vel), dur: 1, attack: 0.06, release: 0.7, reverb: 0.45, echo: 0.3, cutoff: 2600, wow: 16 };
            break;
        case 'mstrings':
            ev = { type: 'pad', sample: 'mstrings', layer: 'pad', preset: 'warm', gain: 0.09 * level, attack: 2.5, dur: 2.5, release: 5, reverb: 0.6, detune: 10, wow: 10, cutoff: 3000 };
            break;
        case 'mchoir':
            ev = { type: 'pad', sample: 'mchoir', layer: 'choir', preset: 'choir', gain: 0.12 * level, attack: 2, dur: 3, release: 6, reverb: 0.7, detune: 9, cutoff: 3200, wow: 8 };
            break;
        case 'monks':
            ev = { type: 'pad', sample: 'monks', layer: 'choir', preset: 'voice', gain: 0.14 * level, attack: 2.5, dur: 4, release: 6, reverb: 0.8, detune: 10, oscs: 5, cutoff: 2400, vowels: ['o', 'u'] };
            break;
        case 'glassbow':
            ev = { type: 'modal', sample: 'glassbow', layer: 'bells', preset: 'bowl', gain: 0.08 * level, attack: 3, dur: 5, release: 7, reverb: 0.85, echo: 0.1, scatter: true };
            break;
        case 'crush':
            // a felt piano crushed to a few bits (a bit-reduced pad without the pack)
            ev = { type: 'pad', sample: 'felt', layer: 'pad', preset: 'warm', gain: 0.08 * level, attack: 2, dur: 3, release: 6, reverb: 0.6, detune: 14, drive: 0.6, crush: 6, bits: 5, cutoff: 2400 };
            break;
        case 'acid':
            // squelchy resonant bass: the accent opens the filter and drives it
            ev = { type: 'acid', layer: 'bass', gain: 0.16 * level, velocity: vel, cutoff: 260 + vel * 380, envAmt: 2 + vel * 7, decay: 0.16 + vel * 0.1, q: 7, drive: 0.4 + vel * 0.5, glide: 0.04, reverb: 0.08, echo: 0.12 };
            break;
        case 'ebass':
            // electro bass: square-ish, short, a little resonance
            ev = { type: 'acid', layer: 'bass', gain: 0.18 * level, velocity: vel, square: 0.7, cutoff: 200, envAmt: 3 + vel * 4, decay: 0.12, q: 2.2, drive: 0.3, reverb: 0.06, echo: 0.05 };
            break;
        case 'dubbass':
            // round sub bass that only just speaks on small speakers
            ev = { type: 'acid', layer: 'bass', gain: 0.1 * level, velocity: vel, square: 0.35, cutoff: 150, envAmt: 0.9, decay: 0.3, q: 0.9, drive: 0.35, reverb: 0.03 };
            break;
        case 'pluck':
            // short filtered saw, for arps that live in the echo
            ev = { type: 'acid', layer: 'keys', gain: 0.06 * level, velocity: vel, cutoff: 700 + vel * 600, envAmt: 5, decay: 0.08 + vel * 0.05, q: 2.4, drive: 0.15, reverb: 0.5, echo: 0.45 };
            break;
        case 'grit':
            // the same pluck pushed into distortion (Night City arps)
            ev = { type: 'acid', layer: 'keys', gain: 0.055 * level, velocity: vel, detune: 7, cutoff: 1100 + vel * 900, envAmt: 4, decay: 0.07 + vel * 0.05, q: 3, drive: 1.4, reverb: 0.3, echo: 0.35 };
            break;
        case 'brass':
            // CS-80 brass (Vangelis): the filter blooms after the note starts
            ev = { type: 'brass', layer: 'pad', velocity: vel, gain: 0.11 * level, cutoff: 650, filterAmt: 3.5, attack: 0.25, dur: 2, release: 1.2, reverb: 0.75, echo: 0.15 };
            break;
        case 'brasslead':
            // the Blade Runner lead: brass with a slow vibrato, sliding down as it ends
            ev = { type: 'brass', layer: 'lead', velocity: vel, gain: 0.085 * level, cutoff: 900, filterAmt: 2.5, attack: 0.12, release: 1.4, glide: 0.12, vibrato: 18, slide: 2, reverb: 0.8, echo: 0.35 };
            break;
        case 'horn':
            // the 2049 horn: low brass, driven until it tears
            ev = { type: 'brass', layer: 'pad', velocity: 1, gain: 0.2 * level, cutoff: 260, filterAmt: 5, fdecay: 3, attack: 0.05, dur: 2, release: 3, drive: 0.9, reverb: 0.6, echo: 0.1 };
            break;
        case 'reese':
            // two saws beating against each other over a sine sub, driven
            ev = { type: 'acid', layer: 'bass', velocity: vel, gain: 0.13 * level, detune: 22, sub: 0.45, cutoff: 360 + vel * 260, envAmt: 1.4, decay: 0.3, q: 1.3, drive: 1, wobble: 0.35, reverb: 0.04 };
            break;
        case 'scream':
            // an ugly, singing lead (Polivoks): resonant, detuned, overdriven
            ev = { type: 'acid', layer: 'lead', velocity: vel, gain: 0.07 * level, square: 0.5, detune: 9, cutoff: 800 + vel * 500, envAmt: 3, decay: 0.35, q: 8, drive: 1.3, glide: 0.05, reverb: 0.35, echo: 0.35 };
            break;
        case 'stab':
            // dub chord stab: a click of a chord thrown into the echo
            ev = { type: 'pad', layer: 'stab', preset: 'warm', gain: 0.07 * level * (0.6 + vel), attack: 0.006, dur: 0.08, release: 0.3, cutoff: 650 + vel * 400, filterEnv: 1.5, q: 1.2, oscs: 2, detune: 5, reverb: 0.25, echo: 0.65, wow: 0 };
            break;
        case 'saron':
            ev = { type: 'modal', layer: 'keys', preset: 'saron', velocity: vel, gain: 0.13 * level * (0.6 + vel), reverb: 0.45, echo: 0.06 };
            break;
        case 'bonang':
            ev = { type: 'modal', layer: 'bells', preset: 'bonang', velocity: vel, gain: 0.11 * level * (0.6 + vel), reverb: 0.5, echo: 0.08 };
            break;
        case 'gong':
            ev = { type: 'modal', layer: 'drone', preset: 'gong', gain: 0.2 * level, reverb: 0.7, echo: 0.05 };
            break;
        case 'ping':
            // sonar: a pure ping thrown far into the echo
            ev = { type: 'modal', layer: 'bells', preset: 'ping', gain: 0.1 * level * (0.6 + vel), reverb: 0.85, echo: 0.5 };
            break;
        case 'whale':
            ev = { type: 'lead', layer: 'lead', gain: 0.07 * level, dur: 2, attack: 0.9, release: 3, glide: 1.4, cutoff: 800, q: 1.6, wow: 35, detune: 4, reverb: 0.85, echo: 0.35 };
            break;
        case 'swell':
        default:
            ev = { type: 'pad', sample: 'strings', layer: 'pad', preset: 'warm', gain: 0.09 * level, attack: 3, dur: 2, release: 7, reverb: 0.6, detune: 8 };
    }
    return { ...ev, ...base, ...extra };
}

// ------------------------------------------------------------------ lanes

// Long tones on the bass (and fifth), optionally the whole chord, re-struck
// at every chord change. `voice` picks pad, organ or singing pad; `sample`
// plays a looped instrument of the pack instead (`sampleOnly`: nothing
// without the pack, for layers that only add to a synth drone), and `grain`
// ({ density, size, octaves, reverse, jitter }) turns it into a grain cloud
// that never repeats (also pack-only).
export class DroneLane extends Lane {
    constructor(scene, rng, opts = {}) {
        super(scene, rng, opts.first ?? 0);
        this.opts = opts;
    }

    fire(t) {
        const chord = this.harmony.chordAt(t);
        const end = Math.min(chord.end, this.scene.end);
        const dur = Math.max(4, end - t);
        const level = Math.max(0.35, this.scene.level(t + 4));
        const o = this.opts;
        const root = chord.bass + 12 * (o.octave ?? 1);
        let notes = o.fifth ? [root, nearestFifth(chord, root)] : [root];
        if (o.upper) notes = notes.concat(chord.upper.map((m) => m + 12 * (o.upperOctave ?? 0)));
        const events = notes.map((midi, i) => {
            const common = {
                time: t + (o.stagger ? i * this.rng.range(0.5, o.stagger) : 0),
                midi,
                gain: (o.gain ?? 0.09) * level * (i > 1 ? 0.7 : 1),
                pan: this.rng.range(-0.35, 0.35),
                attack: o.attack ?? 7,
                dur,
                release: o.release ?? 9,
                reverb: o.reverb ?? 0.5,
                layer: 'drone',
            };
            if (o.sample) {
                common.sample = o.sample;
                common.scatter = true;
                common.wow = o.wow;
                common.drive = o.drive;
                common.cutoff = o.cutoff;
                common.echo = o.echo;
                // a grain cloud rebuilt from the sample for the whole chord
                if (o.grain) return { ...common, ...o.grain, type: 'grain' };
                if (o.sampleOnly) return { ...common, type: 'sample' };
            }
            if (o.voice === 'organ') return { ...common, type: 'organ', preset: o.preset || 'flue' };
            return {
                ...common, type: 'pad', preset: o.preset || 'warm', cutoff: o.cutoff, detune: o.detune ?? 6,
                drive: o.drive ?? 0, crush: o.crush ?? 0, bits: o.bits, oscs: o.oscs, vowels: o.vowels, wow: o.wow,
                // side-chained to the beat grid
                pump: o.pump ? { beat: 60 / this.scene.piece.bpm, depth: o.pump } : undefined,
            };
        });
        if (o.sub) {
            events.push({ type: 'sub', layer: 'sub', time: t, midi: chord.bass, gain: o.sub * 0.6 * level, attack: 5, dur, release: 6, reverb: 0.05 });
        }
        this.next = end;
        return events;
    }
}

// Eno-style loop: a fixed period, a fixed voice of the chord, one instrument.
export class LoopLane extends Lane {
    constructor(scene, rng, { period, voice, octave = 0, instrument, skip = 0.12, first }) {
        super(scene, rng, first ?? rng.range(2, period));
        Object.assign(this, { period, voice, octave, instrument, skip });
        this.pan = rng.range(-0.7, 0.7);
    }

    fire(t) {
        const chord = this.harmony.chordAt(t);
        const midi = chord.upper[this.voice % chord.upper.length] + 12 * this.octave;
        this.next = t + this.period;
        const level = this.scene.level(t);
        if (level < 0.08 || this.rng.chance(this.skip)) return [];
        return [instrumentEvent(this.instrument, t, midi, level, this.pan, this.rng)];
    }
}

// Random-walk melody over chord (or scale) tones with Poisson timing.
export class WanderLane extends Lane {
    constructor(scene, rng, { mean, lo, hi, instrument, dyad = 0, useScale = false, first, extra }) {
        super(scene, rng, first ?? rng.range(1, mean * 2));
        Object.assign(this, { mean, lo, hi, instrument, dyad, useScale, extra });
        this.pos = null;
    }

    fire(t) {
        const chord = this.harmony.chordAt(t);
        const pcs = this.useScale ? scalePcs(this.scene.key) : chord.pcs;
        const notes = notesInRange(pcs, this.lo, this.hi).filter((m) => !this.useScale || isSafeOver(chord, m));
        this.next = t + Math.max(0.12, this.rng.exp(this.mean));
        const level = this.scene.level(t);
        if (!notes.length || level < 0.05) return [];
        if (this.pos === null) this.pos = Math.floor(notes.length / 2);
        this.pos += this.rng.weighted([[-2, 1], [-1, 3], [0, 0.6], [1, 3], [2, 1]]);
        this.pos = Math.max(0, Math.min(notes.length - 1, this.pos));
        const midi = notes[this.pos];
        const pan = this.rng.range(-0.5, 0.5);
        const events = [instrumentEvent(this.instrument, t, midi, level, pan, this.rng, this.extra)];
        if (this.dyad && this.rng.chance(this.dyad)) {
            const lower = notes[Math.max(0, this.pos - 2)];
            if (lower !== midi) events.push(instrumentEvent(this.instrument, t + this.rng.range(0.01, 0.08), lower, level * 0.7, pan, this.rng, this.extra));
        }
        return events;
    }
}

// A repeating figure of N steps (Reich / Takada): each lane has its own
// length, so several lanes phase against each other. Degrees snap to the
// current chord or scale at play time.
export class OstinatoLane extends Lane {
    constructor(scene, rng, { bpm, perBeat = 2, length, instrument, lo, hi, rest = 0.3, useScale = true, accent = 1 }) {
        super(scene, rng, 0);
        this.step = 60 / bpm / perBeat;
        this.sixteenths = 4 / perBeat;
        this.index = Math.ceil(scene.start / this.step);
        this.next = this.index * this.step;
        this.pattern = Array.from({ length }, () => (rng.chance(rest) ? null : rng.int(0, 6)));
        if (this.pattern.every((p) => p === null)) this.pattern[0] = 0;
        Object.assign(this, { instrument, lo, hi, useScale, accent });
        this.pan = rng.range(-0.6, 0.6);
        this.mutateEvery = length * rng.int(6, 12);
    }

    fire(t) {
        const i = this.index++;
        this.next = this.index * this.step;
        // now and then a step changes, so the figure evolves slowly
        if (i % this.mutateEvery === 0 && i > 0) {
            const k = this.rng.int(0, this.pattern.length - 1);
            this.pattern[k] = this.rng.chance(0.25) ? null : this.rng.int(0, 6);
        }
        const deg = this.pattern[i % this.pattern.length];
        const level = this.scene.level(t);
        if (deg === null || level < 0.1) return [];
        const chord = this.harmony.chordAt(t);
        const pcs = this.useScale ? scalePcs(this.scene.key) : chord.pcs;
        const notes = notesInRange(pcs, this.lo, this.hi).filter((m) => isSafeOver(chord, m));
        if (!notes.length) return [];
        const midi = notes[deg % notes.length];
        const strong = i % this.pattern.length === 0 ? 1 : 0.75;
        const vel = 0.25 + 0.5 * accent(i * this.sixteenths);
        return [instrumentEvent(this.instrument, t, midi, level * strong * this.accent, this.pan, this.rng, { vel })];
    }
}

// Sung or played phrases built from a remembered motif, gliding between
// notes, with rests between phrases. Motifs are varied, not replaced, so the
// melody feels like it belongs to the piece.
export class PhraseLane extends Lane {
    constructor(scene, rng, { bpm, instrument, lo, hi, rest = [4, 12], repeat = 0.6, extra }) {
        super(scene, rng, 0);
        Object.assign(this, { instrument, lo, hi, rest, repeat, extra });
        this.beat = 60 / bpm;
        // phrases start and move on the eighth-note grid shared with the beat
        this.unit = this.beat / 2;
        this.next = onGrid(scene.start + rng.range(6, 18), this.unit);
        this.motifs = [this._newMotif()];
        this.phrases = 0;
        this.queue = [];
        this.lastHz = null;
        this.lastMidi = null;
    }

    _newMotif() {
        const len = this.rng.int(3, 6);
        const steps = [];
        for (let i = 0; i < len; i++) {
            steps.push({ move: i === 0 ? 0 : this.rng.weighted([[-2, 1], [-1, 3], [1, 3], [2, 1.5], [3, 0.5]]), beats: this.rng.pick([0.5, 1, 1, 1.5, 2, 3]) });
        }
        steps[len - 1].beats = Math.max(steps[len - 1].beats, 2);
        return steps;
    }

    // Gyro's repetition pool: with probability `repeat` a phrase reuses one
    // of the first few motifs, else it states a new one, so the melody has
    // returns (AABA, ABAC...) instead of wandering off.
    _pickMotif() {
        const n = this.phrases++;
        if (n === 0) return this.motifs[0];
        if (this.rng.chance(this.repeat)) {
            const pool = Math.max(1, Math.min(this.motifs.length, Math.round((1 - this.repeat) * 4)));
            return this.motifs[this.rng.int(0, pool - 1)];
        }
        const m = this._newMotif();
        if (this.motifs.length < 4) this.motifs.push(m);
        else this.motifs[this.rng.int(1, 3)] = m;
        return m;
    }

    fire(t) {
        const level = this.scene.level(t);
        const chord = this.harmony.chordAt(t);
        if (!this.queue.length) {
            const motif = this._pickMotif().map((s) => ({ ...s, move: this.rng.chance(0.15) ? s.move + this.rng.pick([-1, 1]) : s.move }));
            // start each phrase on a chord tone
            const starts = notesInRange(chord.pcs, this.lo + 4, this.hi - 6);
            const start = starts.length ? this.rng.pick(starts) : this.lo + 7;
            const scale = notesInRange(scalePcs(this.scene.key), this.lo, this.hi);
            let idx = scale.indexOf(start);
            if (idx < 0) idx = Math.floor(scale.length / 2);
            this.queue = motif.map((s) => {
                idx = Math.max(0, Math.min(scale.length - 1, idx + s.move));
                return { midi: scale[idx], beats: s.beats };
            });
            this.queue[this.queue.length - 1].last = true;
        }
        const note = this.queue.shift();
        const dur = note.beats * this.beat;
        let midi = note.midi;
        if (note.last && !chord.pcs.includes(pitchClass(midi))) {
            // phrases end on a chord tone
            midi = notesInRange(chord.pcs, midi - 3, midi + 3)[0] ?? midi;
        }
        const rest = note.last ? this.rng.range(this.rest[0], this.rest[1]) * this.beat : 0;
        this.next = onGrid(t + dur + rest, this.unit);
        if (level < 0.1) {
            this.lastMidi = null;
            return [];
        }
        const ev = instrumentEvent(this.instrument, t, midi, level, this.rng.range(-0.25, 0.25), this.rng, {
            dur: dur * 0.92,
            fromMidi: this.lastMidi ?? midi,
            vel: note.last ? 0.45 : 0.55 + 0.15 * (Math.round(t / this.beat) % 2 === 0),
            ...this.extra,
        });
        this.lastMidi = note.last ? null : midi;
        return [ev];
    }
}

// The next point of a grid of `unit` seconds counted from t = 0 (the clock
// every beat and figure in a piece shares).
export function onGrid(t, unit) {
    return Math.ceil(t / unit - 1e-6) * unit;
}

// Four-on-the-floor muffled pulse with dub chord stabs (Gas / Basic Channel).
export class PulseLane extends Lane {
    constructor(scene, rng, { bpm, stabs = true, kick = 0.2, kickShape = null, ticks = 0.2, stabCutoff = 700, stabGain = 0.1, stabSample = null }) {
        super(scene, rng, 0);
        this.step = 60 / bpm / 4;
        this.index = Math.ceil(scene.start / this.step);
        this.next = this.index * this.step;
        this.stabSteps = rng.pick([[3, 10], [2, 7, 11], [6, 14], [3, 11, 14]]);
        this.tickProb = rng.range(0.4, 0.9);
        Object.assign(this, { stabs, kick, kickShape, ticks, stabCutoff, stabGain, stabSample });
        // tuned to the tonic, in the 35-65 Hz range
        this.kickMidi = 25 + pitchClass(scene.key.tonic - 25);
    }

    fire(t) {
        const s = this.index % 16;
        const bar = Math.floor(this.index / 16);
        this.index++;
        this.next = this.index * this.step;
        const level = this.scene.level(t);
        const events = [];
        const chord = this.harmony.chordAt(t);
        if (this.kick && s % 4 === 0 && level > 0.55) {
            events.push({ type: 'kick', layer: 'kick', time: t, midi: this.kickMidi, gain: this.kick * smooth((level - 0.55) / 0.3), reverb: 0.06, ...this.kickShape });
        }
        if (this.ticks && s % 4 === 2 && level > 0.65 && this.rng.chance(this.tickProb)) {
            events.push({ type: 'tick', layer: 'ticks', time: t, gain: this.ticks * level, pan: 0.25, reverb: 0.2, echo: 0.25, tone: 7500, decay: 0.04 });
        }
        if (this.ticks && s % 2 === 1 && level > 0.8 && this.rng.chance(0.12)) {
            events.push({ type: 'tick', layer: 'ticks', time: t, gain: this.ticks * 0.4, pan: -0.3, reverb: 0.2, tone: 10000, decay: 0.02 });
        }
        if (this.stabs && this.stabSteps.includes(s) && level > 0.3 && (bar % 2 === 0 || this.rng.chance(0.6))) {
            const pan = this.rng.range(-0.3, 0.3);
            for (const m of chord.upper.slice(0, 3)) {
                events.push({
                    type: 'pad', layer: 'stab', preset: 'warm', time: t, midi: m - 12, gain: this.stabGain * level, pan,
                    attack: 0.006, dur: 0.08, release: 0.28, cutoff: this.stabCutoff, filterEnv: 1.5, q: 1.2,
                    oscs: 2, detune: 5, reverb: 0.25, echo: 0.65, wow: 0,
                    // with the pack, a damped Rhodes chord under the same envelope
                    sample: this.stabSample || undefined,
                });
            }
        }
        return events;
    }
}

// Lazy half-time beat: kick, soft snare on three, a few hats (lo-fi).
export class BeatLane extends Lane {
    constructor(scene, rng, { bpm, swing = 0.08 }) {
        super(scene, rng, 0);
        this.step = 60 / bpm / 4;
        this.index = Math.ceil(scene.start / this.step);
        this.next = this.index * this.step;
        this.swing = swing;
        this.kicks = rng.pick([[0, 10], [0, 7, 10], [0, 6], [0, 11, 14]]);
        this.kickMidi = 25 + pitchClass(scene.key.tonic - 25);
    }

    fire(t) {
        const s = this.index % 16;
        this.index++;
        this.next = this.index * this.step + (this.index % 2 ? this.swing * this.step : 0);
        const level = this.scene.level(t);
        if (level < 0.5) return [];
        const g = smooth((level - 0.5) / 0.35);
        const events = [];
        if (this.kicks.includes(s)) events.push({ type: 'kick', layer: 'kick', time: t, midi: this.kickMidi, gain: 0.17 * g, reverb: 0.05, tone: 140 });
        if (s === 8) events.push({ type: 'snare', layer: 'snare', time: t, gain: 0.12 * g, reverb: 0.3, echo: 0.1, pan: 0.05 });
        if (s % 2 === 0 && this.rng.chance(0.55)) events.push({ type: 'tick', layer: 'ticks', time: t, gain: 0.06 * g, pan: -0.2, reverb: 0.15, tone: 6500, decay: 0.03 });
        return events;
    }
}

// Chord-tuned resonant noise beds that swell and overlap.
export class ResonantLane extends Lane {
    constructor(scene, rng, { harsh = 0.5, lo = 48, hi = 86, q = [25, 70], gain = 0.16, length = [10, 20] } = {}) {
        super(scene, rng, 0);
        Object.assign(this, { harsh, lo, hi, q, gain, length });
    }

    fire(t) {
        const chord = this.harmony.chordAt(t);
        const pool = notesInRange(chord.pcs, this.lo, this.hi);
        const midis = [];
        for (let i = 0; i < 4 && pool.length; i++) midis.push(pool.splice(this.rng.int(0, pool.length - 1), 1)[0]);
        const dur = this.rng.range(this.length[0], this.length[1]);
        this.next = t + dur * this.rng.range(0.55, 0.8);
        const level = this.scene.level(t + 6);
        if (level < 0.1) return [];
        return [{
            type: 'resonant', layer: 'texture', time: t, midis, gain: this.gain * level,
            pan: this.rng.range(-0.6, 0.6), attack: this.rng.range(4, 8), dur, release: 8,
            q: this.rng.range(this.q[0], this.q[1]), drive: 0.2 + this.harsh * 0.6, reverb: 0.6, echo: 0.08,
        }];
    }
}

// Tape hiss / vinyl crackle under the whole scene.
export class BedLane extends Lane {
    constructor(scene, rng, { gain = 0.02, tone = 6000, low = 300, crackle = 0 } = {}) {
        super(scene, rng, 0);
        Object.assign(this, { gain, tone, low, crackle });
    }

    fire(t) {
        const dur = 40;
        this.next = t + dur - 8;
        return [{
            type: 'bed', layer: 'bed', time: t, gain: this.gain * Math.max(0.3, this.scene.level(t + 8)),
            attack: 6, dur, release: 8, tone: this.tone, low: this.low, crackle: this.crackle, reverb: 0.1,
            pan: this.rng.range(-0.2, 0.2),
        }];
    }
}
