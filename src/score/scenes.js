import { notesInRange, pitchClass } from '../core/theory.js';

// A scene is a few minutes of one texture. It owns lanes; each lane is a tiny
// state machine that fires at `next` and returns events. Lanes never read
// wall-clock time, so the score is the same however it is chunked.

const smooth = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));

class Lane {
    constructor(scene, rng, first = 0) {
        this.scene = scene;
        this.rng = rng;
        this.next = scene.start + first;
    }

    get harmony() {
        return this.scene.harmony;
    }

    // Override: return an array of events at time t and advance this.next.
    fire() {
        this.next = Infinity;
        return [];
    }
}

// Long pad on the chord's bass/fifth, re-struck at every chord change.
class DroneLane extends Lane {
    constructor(scene, rng, opts) {
        super(scene, rng, opts.first ?? 0);
        this.opts = opts;
    }

    fire(t) {
        const chord = this.harmony.chordAt(t);
        const end = Math.min(chord.end, this.scene.end);
        const dur = Math.max(4, end - t);
        const level = this.scene.level(t + 4);
        const o = this.opts;
        const events = [];
        const root = chord.bass + 12 * (o.octave ?? 1);
        const notes = o.fifth ? [root, nearestFifth(chord, root)] : [root];
        for (const midi of notes) {
            events.push({
                type: 'pad', layer: 'drone', time: t, midi, preset: o.preset || 'warm',
                gain: (o.gain ?? 0.09) * Math.max(0.35, level), pan: this.rng.range(-0.3, 0.3),
                attack: o.attack ?? 7, dur, release: o.release ?? 9, cutoff: o.cutoff,
                detune: o.detune ?? 6, reverb: o.reverb ?? 0.5, drive: o.drive ?? 0,
            });
        }
        if (o.sub) {
            events.push({
                type: 'sub', layer: 'sub', time: t, midi: chord.bass, gain: o.sub * 0.6 * Math.max(0.35, level),
                attack: 5, dur, release: 6, reverb: 0.05,
            });
        }
        this.next = end;
        return events;
    }
}

function nearestFifth(chord, root) {
    const want = pitchClass(root + 7);
    if (chord.pcs.includes(want) || chord.pedal) return root + 7;
    return root + 12;
}

// Eno-style loop: a fixed period, a fixed voice of the chord, an instrument.
class LoopLane extends Lane {
    constructor(scene, rng, { period, voice, octave = 0, instrument, first }) {
        super(scene, rng, first ?? rng.range(2, period));
        this.period = period;
        this.voice = voice;
        this.octave = octave;
        this.instrument = instrument;
        this.pan = rng.range(-0.7, 0.7);
    }

    fire(t) {
        const chord = this.harmony.chordAt(t);
        const midi = chord.upper[this.voice % chord.upper.length] + 12 * this.octave;
        this.next = t + this.period;
        const level = this.scene.level(t);
        if (level < 0.08 || this.rng.chance(0.12)) return [];
        return [instrumentEvent(this.instrument, t, midi, level, this.pan, this.rng)];
    }
}

// Random-walk melody over chord (or scale) tones with Poisson timing.
class WanderLane extends Lane {
    constructor(scene, rng, { mean, lo, hi, instrument, dyad = 0, useScale = false, first }) {
        super(scene, rng, first ?? rng.range(1, mean * 2));
        Object.assign(this, { mean, lo, hi, instrument, dyad, useScale });
        this.pos = null;
    }

    fire(t) {
        const chord = this.harmony.chordAt(t);
        const pcs = this.useScale ? scalePcs(this.scene.key) : chord.pcs;
        const notes = notesInRange(pcs, this.lo, this.hi).filter((m) => !this.useScale || isSafeOver(chord, m));
        this.next = t + Math.max(0.25, this.rng.exp(this.mean));
        const level = this.scene.level(t);
        if (!notes.length || level < 0.05) return [];
        if (this.pos === null) this.pos = Math.floor(notes.length / 2);
        this.pos += this.rng.weighted([[-2, 1], [-1, 3], [0, 0.6], [1, 3], [2, 1]]);
        if (this.pos < 0) this.pos = 1;
        if (this.pos >= notes.length) this.pos = notes.length - 2;
        this.pos = Math.max(0, Math.min(notes.length - 1, this.pos));
        const midi = notes[this.pos];
        const pan = this.rng.range(-0.5, 0.5);
        const events = [instrumentEvent(this.instrument, t, midi, level, pan, this.rng)];
        if (this.dyad && this.rng.chance(this.dyad)) {
            const lower = notes[Math.max(0, this.pos - 2)];
            if (lower !== midi) events.push(instrumentEvent(this.instrument, t + this.rng.range(0.01, 0.08), lower, level * 0.7, pan, this.rng));
        }
        return events;
    }
}

function scalePcs(key) {
    return key.steps.map((s) => pitchClass(key.tonic + s));
}

// Passing scale tones are fine unless they rub a semitone against the bass.
function isSafeOver(chord, midi) {
    const d = pitchClass(midi - chord.bass);
    return d !== 1 && d !== 6;
}

function instrumentEvent(instrument, time, midi, level, pan, rng) {
    const vel = 0.3 + rng.next() * 0.4;
    switch (instrument) {
        case 'piano':
            return { type: 'modal', layer: 'keys', preset: 'piano', time, midi, velocity: vel, gain: 0.3 * level * (0.6 + vel), pan, reverb: 0.55, echo: 0.04, dur: 12 };
        case 'glass':
            return { type: 'modal', layer: 'bells', preset: 'glass', time, midi, gain: 0.12 * level * (0.6 + vel), pan, reverb: 0.75, echo: 0.12 };
        case 'bowl':
            return { type: 'modal', layer: 'bells', preset: 'bowl', time, midi, gain: 0.07 * level, pan, reverb: 0.7 };
        case 'metal':
            return { type: 'modal', layer: 'texture', preset: 'metal', time, midi, gain: 0.06 * level, pan, reverb: 0.9, echo: 0.1 };
        case 'choir':
            return { type: 'pad', layer: 'choir', preset: 'choir', time, midi, gain: 0.14 * level, pan, attack: 2.5, dur: 3, release: 6, reverb: 0.7, detune: 9, cutoff: 3200 };
        case 'swell':
        default:
            return { type: 'pad', layer: 'pad', preset: 'warm', time, midi, gain: 0.09 * level, pan, attack: 3, dur: 2, release: 7, reverb: 0.6, detune: 8 };
    }
}

// Four-on-the-floor muffled pulse with dub chord stabs (Gas / Basic Channel).
class PulseLane extends Lane {
    constructor(scene, rng, bpm) {
        super(scene, rng, 0);
        this.step = 60 / bpm / 4;
        this.index = 0;
        this.stabSteps = rng.pick([[3, 10], [2, 7, 11], [6, 14], [3, 11, 14]]);
        this.tickProb = rng.range(0.4, 0.9);
        // tuned to the tonic, in the 35-65 Hz range
        this.kickMidi = 25 + pitchClass(scene.key.tonic - 25);
        // align to the grid relative to piece time zero so overlapping scenes agree
        this.index = Math.ceil(scene.start / this.step);
        this.next = this.index * this.step;
    }

    fire(t) {
        const s = this.index % 16;
        const bar = Math.floor(this.index / 16);
        this.index++;
        this.next = this.index * this.step;
        const level = this.scene.level(t);
        const events = [];
        const chord = this.harmony.chordAt(t);
        if (s % 4 === 0 && level > 0.55) {
            events.push({ type: 'kick', layer: 'kick', time: t, midi: this.kickMidi, gain: 0.2 * smooth((level - 0.55) / 0.3), reverb: 0.06 });
        }
        if (s % 4 === 2 && level > 0.65 && this.rng.chance(this.tickProb)) {
            events.push({ type: 'tick', layer: 'ticks', time: t, gain: 0.2 * level, pan: 0.25, reverb: 0.2, echo: 0.25, tone: 7500, decay: 0.04 });
        }
        if (s % 2 === 1 && level > 0.8 && this.rng.chance(0.12)) {
            events.push({ type: 'tick', layer: 'ticks', time: t, gain: 0.08, pan: -0.3, reverb: 0.2, tone: 10000, decay: 0.02 });
        }
        if (this.stabSteps.includes(s) && level > 0.3 && (bar % 2 === 0 || this.rng.chance(0.6))) {
            const pan = this.rng.range(-0.3, 0.3);
            for (const m of chord.upper.slice(0, 3)) {
                events.push({
                    type: 'pad', layer: 'stab', preset: 'warm', time: t, midi: m - 12, gain: 0.1 * level, pan,
                    attack: 0.006, dur: 0.08, release: 0.28, cutoff: 700, filterEnv: 1.5, q: 1.2,
                    oscs: 2, detune: 5, reverb: 0.25, echo: 0.65, wow: 0,
                });
            }
        }
        return events;
    }
}

// Storm: chord-tuned resonant noise beds that swell and overlap.
class ResonantLane extends Lane {
    constructor(scene, rng, { harsh }) {
        super(scene, rng, 0);
        this.harsh = harsh;
    }

    fire(t) {
        const chord = this.harmony.chordAt(t);
        const pool = notesInRange(chord.pcs, 48, 86);
        const midis = [];
        for (let i = 0; i < 4 && pool.length; i++) midis.push(pool.splice(this.rng.int(0, pool.length - 1), 1)[0]);
        const dur = this.rng.range(10, 20);
        this.next = t + dur * this.rng.range(0.55, 0.8);
        const level = this.scene.level(t + 6);
        if (level < 0.1) return [];
        return [{
            type: 'resonant', layer: 'texture', time: t, midis, gain: 0.16 * level,
            pan: this.rng.range(-0.6, 0.6), attack: this.rng.range(4, 8), dur, release: 8,
            q: 25 + this.rng.next() * 45, drive: 0.2 + this.harsh * 0.6, reverb: 0.6, echo: 0.08,
        }];
    }
}

const SCENE_BUILDERS = {
    drift(scene, rng) {
        const lanes = [new DroneLane(scene, rng.fork('drone'), { fifth: true, gain: 0.055, sub: 0.04 })];
        const instruments = scene.piece.brightness > 0.5
            ? ['piano', 'glass', 'swell', 'choir', 'piano', 'glass']
            : ['piano', 'swell', 'choir', 'piano', 'swell', 'glass'];
        const periods = [17.3, 19.7, 23.1, 26.9, 29.3, 31.7, 37.1, 41.3];
        const count = 4 + Math.round(scene.piece.density * 2);
        for (let i = 0; i < count; i++) {
            const r = rng.fork(`loop${i}`);
            lanes.push(new LoopLane(scene, r, {
                period: periods[(i * 3 + rng.int(0, 7)) % periods.length] * rng.range(0.92, 1.08),
                voice: i,
                octave: instruments[i] === 'glass' ? 1 : i === 0 ? -1 : 0,
                instrument: instruments[i],
            }));
        }
        return lanes;
    },
    sparse(scene, rng) {
        return [
            new DroneLane(scene, rng.fork('drone'), { gain: 0.05, cutoff: 500, sub: 0.03 }),
            new WanderLane(scene, rng.fork('piano'), { mean: 6.5, lo: 55, hi: 81, instrument: 'piano', dyad: 0.3, useScale: true }),
            new WanderLane(scene, rng.fork('glass'), { mean: 23, lo: 79, hi: 96, instrument: 'glass' }),
        ];
    },
    shimmer(scene, rng) {
        return [
            new DroneLane(scene, rng.fork('drone'), { fifth: true, gain: 0.06, sub: 0.03 }),
            new DroneLane(scene, rng.fork('choir'), { preset: 'choir', octave: 3, gain: 0.05, attack: 9, detune: 10, cutoff: 3600, reverb: 0.8 }),
            new WanderLane(scene, rng.fork('glass'), { mean: 1.6, lo: 72, hi: 96, instrument: 'glass' }),
            new WanderLane(scene, rng.fork('bowl'), { mean: 19, lo: 55, hi: 72, instrument: 'bowl' }),
        ];
    },
    pulse(scene, rng) {
        return [
            new DroneLane(scene, rng.fork('drone'), { gain: 0.06, cutoff: 600, sub: 0.07 }),
            new PulseLane(scene, rng.fork('pulse'), scene.piece.bpm),
            new WanderLane(scene, rng.fork('choir'), { mean: 11, lo: 64, hi: 84, instrument: 'choir' }),
        ];
    },
    storm(scene, rng) {
        const harsh = scene.piece.harsh;
        return [
            new DroneLane(scene, rng.fork('drone'), { fifth: true, gain: 0.08, sub: 0.07, drive: 0.3 + harsh * 0.5, cutoff: 900, detune: 14 }),
            new ResonantLane(scene, rng.fork('res'), { harsh }),
            new ResonantLane(scene, rng.fork('res2'), { harsh }),
            new WanderLane(scene, rng.fork('metal'), { mean: 9, lo: 36, hi: 60, instrument: 'metal' }),
        ];
    },
};

export class Scene {
    constructor({ type, start, end, fade, piece, harmony, rng }) {
        Object.assign(this, { type, start, end, fade, piece, harmony, key: piece.key });
        this.lanes = SCENE_BUILDERS[type](this, rng);
    }

    level(t) {
        return smooth((t - this.start) / this.fade) * (1 - smooth((t - (this.end - this.fade)) / this.fade));
    }

    // All events with time in [from, to), in lane order.
    collect(to, out) {
        for (const lane of this.lanes) {
            while (lane.next < to && lane.next < this.end) {
                const t = lane.next;
                const events = lane.fire(t);
                for (const ev of events) out.push(ev);
                if (lane.next <= t) lane.next = t + 0.05;
            }
        }
    }

    get finished() {
        return this.lanes.every((lane) => lane.next >= this.end);
    }
}
