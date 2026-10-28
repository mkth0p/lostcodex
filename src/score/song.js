import { pitchClass } from '../core/theory.js';
import { Lane, instrumentEvent } from './lanes.js';

// Song form, for universes that want drops rather than slow crossfades. A
// plan lays sections end to end on bar lines: intro, a build-up, a drop, a
// breakdown, another build-up and drop, then round again with variations.
// Build-ups hold a tension chord, roll a snare from quarters to thirty-
// seconds under a riser while the whole mix is high-passed, and stop half a
// bar early so the reverb hangs in the gap; drops land on the tonic with an
// impact. Everything is drawn from a seeded stream, so the song is the same
// every time the station plays.

export const DROPS = ['drop', 'drive'];

// Scenes of a universe with formats are named "<format>:<role>"; the role is
// what the song form and the visuals care about.
export function roleOf(type) {
    return type ? type.split(':').pop() : null;
}

// Section lengths in bars, by role; a format can change them (`song.bars`).
const BARS = { intro: [16], rain: [8, 16], build: [4, 8, 8], drop: [16, 16, 32], break: [8, 16], build2: [4, 8], drop2: [16, 32] };

export class SongPlan {
    constructor(piece, rng) {
        const u = piece.universe;
        this.bar = 240 / piece.bpm;
        this.rng = rng;
        this.prefix = u.formatId ? `${u.formatId}:` : '';
        this.bars = { ...BARS, ...(u.song.bars || {}) };
        this.sections = [];
        this.end = 0;
        this.cycle = 0;
        this.drops = DROPS.filter((d) => u.scenes[this.prefix + d]);
        this.firstDrop = rng.pick(this.drops);
    }

    _push(role, bars, fadeIn, fadeOut) {
        const start = this.end;
        this.end = start + bars * this.bar;
        this.sections.push({ type: this.prefix + role, role, bars, start, end: this.end, fadeIn, fadeOut });
    }

    // drops come back: mostly the piece's own drop, sometimes the other one
    _drop() {
        if (this.drops.length < 2 || this.rng.chance(0.65)) return this.firstDrop;
        return this.drops.find((d) => d !== this.firstDrop);
    }

    _cycle() {
        const r = this.rng;
        const first = this.cycle === 0;
        const bar = this.bar;
        const b = this.bars;
        this._push('rain', r.pick(first ? b.intro : b.rain), first ? 8 : 0.02, bar);
        this._push('build', r.pick(b.build), 0.02, 0.02);
        this._push(this._drop(), r.pick(b.drop), 0.01, 0.02);
        this._push('break', r.pick(b.break), 0.02, bar);
        this._push('build', r.pick(b.build2), 0.02, 0.02);
        this._push(this._drop(), r.pick(b.drop2), 0.01, 0.02);
        this.cycle++;
    }

    index(i) {
        while (this.sections.length <= i) this._cycle();
        return this.sections[i];
    }

    at(t) {
        while (this.end <= t) this._cycle();
        for (let i = this.sections.length - 1; i >= 0; i--) {
            if (this.sections[i].start <= t) return this.sections[i];
        }
        return this.sections[0];
    }

    isDrop(section) {
        return DROPS.includes(section.role);
    }

    // When the gap before a drop starts: the last half bar of a build.
    gap(section) {
        return section.end - this.bar / 2;
    }

    // Master-bus moves: a high-pass that climbs through each build, and the
    // dry signal pulled out in the gap so only the reverb is left.
    mix(t) {
        const s = this.at(t);
        if (s.role !== 'build') return { hp: 28, dry: 1 };
        const gap = this.gap(s);
        if (t >= gap) return { hp: 900, dry: 0.08 };
        const p = Math.max(0, (t - s.start) / (gap - s.start));
        return { hp: 28 * Math.pow(500 / 28, p * p), dry: 1 };
    }
}

// A snare roll that accelerates through a build: quarters, eighths,
// sixteenths, then thirty-seconds, louder, brighter and higher as it goes,
// silent in the gap.
export class RollLane extends Lane {
    constructor(scene, rng, { gain = 1, clap = true } = {}) {
        super(scene, rng, 0);
        this.unit = 60 / scene.piece.bpm / 8;
        this.index = Math.ceil(scene.start / this.unit - 1e-9);
        this.first = this.index;
        this.next = this.index * this.unit;
        this.gapAt = scene.end - (240 / scene.piece.bpm) / 2;
        Object.assign(this, { gain, clap });
    }

    fire(t) {
        const k = this.index++ - this.first;
        this.next = this.index * this.unit;
        if (t >= this.gapAt - 1e-6) {
            this.next = Infinity;
            return [];
        }
        const p = Math.max(0, (t - this.scene.start) / (this.gapAt - this.scene.start));
        const every = p < 0.5 ? 8 : p < 0.75 ? 4 : p < 0.92 ? 2 : 1;
        if (k % every) return [];
        const g = this.gain * (0.25 + 0.75 * Math.pow(p, 1.4));
        // the sixteenths swing with the rest of the piece; the thirty-seconds
        // between them are a roll, marked as such
        const n = this.index - 1;
        const at = n % 2 ? t : t + ((n >> 1) % 2 ? this.scene.piece.swing * this.unit * 2 : 0);
        const out = [{
            type: 'snare', layer: 'snare', time: at, roll: true, gain: 0.12 * g, tone: 1800 + 3200 * p, body: 180 * Math.pow(2, p),
            decay: 0.14 - 0.06 * p, reverb: 0.3 + 0.4 * p, echo: 0.1, pan: ((k / every) % 2 ? 0.15 : -0.15) * p,
        }];
        if (this.clap && k % 8 === 0) out.push({ type: 'clap', layer: 'snare', time: at, gain: 0.08 * g, reverb: 0.5, pan: 0 });
        return out;
    }
}

// One riser across the build, ending exactly where the gap starts.
export class RiserLane extends Lane {
    constructor(scene, rng, { gain = 1 } = {}) {
        super(scene, rng, 0);
        this.gain = gain;
    }

    fire(t) {
        this.next = Infinity;
        const chord = this.harmony.chordAt(t);
        const dur = this.scene.end - (240 / this.scene.piece.bpm) / 2 - t;
        return [
            { type: 'riser', layer: 'texture', time: t, midi: chord.bass + 24, dur, from: 250, to: 9000, rise: 12, gain: 0.07 * this.gain, reverb: 0.5, echo: 0.2, pan: 0 },
            // a second, noise-only riser panned wide for the top end
            { type: 'riser', layer: 'texture', time: t + dur * 0.4, midi: chord.bass + 36, dur: dur * 0.6, from: 2000, to: 14000, rise: 0, saw: 0, gain: 0.05 * this.gain, reverb: 0.4, pan: 0.5 },
        ];
    }
}

// The moment a section lands. 'drop': crash, a boomy kick, a sub drop
// sweeping down and the low horn (Blade Runner 2049). 'down': a crash and a
// downlifter, for the end of a drop going into a quieter section.
export class ImpactLane extends Lane {
    constructor(scene, rng, { kind = 'drop', gain = 1 } = {}) {
        super(scene, rng, 0);
        Object.assign(this, { kind, gain });
        // nothing to land on at the very start of a piece
        if (scene.start <= 0) this.next = Infinity;
    }

    fire(t) {
        this.next = Infinity;
        const bar = 240 / this.scene.piece.bpm;
        const chord = this.harmony.chordAt(t);
        const kickMidi = 25 + pitchClass(this.scene.key.tonic - 25);
        const g = this.gain;
        const out = [
            { type: 'bed', layer: 'texture', time: t, gain: 0.1 * g, tone: 11000, low: 2500, attack: 0.002, dur: 0.05, release: 2.4, reverb: 0.6, pan: 0 },
            { type: 'riser', layer: 'texture', time: t, midi: chord.bass + 24, dur: bar * 2, from: 9000, to: 300, rise: 12, down: true, saw: 0.2, gain: 0.05 * g, reverb: 0.6, pan: -0.3 },
        ];
        if (this.kind === 'drop') {
            out.push(
                { type: 'kick', layer: 'kick', time: t, midi: kickMidi, gain: 0.18 * g, punch: 150, sweep: 0.09, decay: 1.3, tone: 900, click: 0.7, drive: 1, reverb: 0.25 },
                { type: 'kick', layer: 'sub', time: t, midi: kickMidi, gain: 0.13 * g, punch: 70, sweep: 0.45, decay: 2.6, tone: 180, reverb: 0 },
                instrumentEvent('horn', t, chord.bass + 12, g, 0, this.rng, { dur: bar * 1.5 }),
                instrumentEvent('horn', t + 0.01, chord.bass + 24, g * 0.6, 0.2, this.rng, { dur: bar * 1.5 }),
            );
        }
        return out;
    }
}
