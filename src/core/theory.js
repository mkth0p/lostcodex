// Pitch and harmony. Every note in the engine is produced here as a MIDI
// number from a scale degree, so nothing can drift out of key.

export const MODES = {
    lydian: [0, 2, 4, 6, 7, 9, 11],
    ionian: [0, 2, 4, 5, 7, 9, 11],
    mixolydian: [0, 2, 4, 5, 7, 9, 10],
    dorian: [0, 2, 3, 5, 7, 9, 10],
    aeolian: [0, 2, 3, 5, 7, 8, 10],
    phrygian: [0, 1, 3, 5, 7, 8, 10],
    pentMajor: [0, 2, 4, 7, 9],
    pentMinor: [0, 3, 5, 7, 10],
    hirajoshi: [0, 2, 3, 7, 8],
    // gamelan pelog (selisir), folded into twelve equal steps
    pelog: [0, 1, 3, 7, 8],
};

// Five-limit just ratios over the tonic, used by universes that hold a
// tonic pedal and only build chords on degrees that stay pure over it.
export const JUST_RATIOS = [1, 16 / 15, 9 / 8, 6 / 5, 5 / 4, 4 / 3, 45 / 32, 3 / 2, 8 / 5, 5 / 3, 9 / 5, 15 / 8];

export function tuneHz(key, midi) {
    if (key.tuning !== 'just') return midiToHz(midi);
    const rel = midi - key.tonic;
    const octave = Math.floor(rel / 12);
    const pc = rel - octave * 12;
    return midiToHz(key.tonic) * Math.pow(2, octave) * JUST_RATIOS[pc];
}

// Upper-structure shapes, as scale-degree offsets from the chord root.
// Open, airy voicings: added 9ths, suspensions, stacked fourths.
export const SHAPES = {
    add9: [0, 2, 4, 8],
    sus2: [0, 1, 4, 7],
    open: [0, 4, 7, 9],
    seventh: [0, 2, 4, 6],
    quartal: [0, 3, 6, 9],
    spread: [0, 4, 6, 9],
};

export function midiToHz(midi) {
    return 440 * Math.pow(2, (midi - 69) / 12);
}

export function degreeToMidi(key, degree) {
    const len = key.steps.length;
    const octave = Math.floor(degree / len);
    const idx = degree - octave * len;
    return key.tonic + key.steps[idx] + 12 * octave;
}

export function pitchClass(midi) {
    return ((midi % 12) + 12) % 12;
}

export function isInKey(key, midi) {
    const rel = pitchClass(midi - key.tonic);
    return key.steps.includes(rel);
}

// All MIDI notes in [lo, hi] whose pitch class is in pcs.
export function notesInRange(pcs, lo, hi) {
    const out = [];
    for (let m = Math.ceil(lo); m <= hi; m++) {
        if (pcs.includes(pitchClass(m))) out.push(m);
    }
    return out;
}

export function nearestNote(pcs, target) {
    let best = target;
    let bestDist = Infinity;
    for (let d = 0; d <= 6; d++) {
        for (const m of [target - d, target + d]) {
            if (pcs.includes(pitchClass(m)) && d < bestDist) {
                best = m;
                bestDist = d;
            }
        }
        if (bestDist < Infinity) break;
    }
    return best;
}

// A chord is usable when no voice sits a semitone or tritone above the bass
// and no two chord tones form a minor second.
export function isConsonantSet(bassPc, pcs) {
    for (const pc of pcs) {
        const fromBass = pitchClass(pc - bassPc);
        if (fromBass === 1 || fromBass === 6) return false;
    }
    for (let i = 0; i < pcs.length; i++) {
        for (let j = i + 1; j < pcs.length; j++) {
            const d = pitchClass(pcs[j] - pcs[i]);
            if (d === 1 || d === 11) return false;
        }
    }
    return true;
}

export function buildChord(key, rootDegree, shapeName, pedal) {
    const shape = SHAPES[shapeName];
    const degrees = shape.map((o) => rootDegree + o);
    const pcs = [...new Set(degrees.map((d) => pitchClass(degreeToMidi(key, d))))];
    const bass = pedal ? key.tonic - 12 : degreeToMidi(key, rootDegree) - 12;
    const bassPc = pitchClass(bass);
    if (!isConsonantSet(bassPc, pcs)) return null;
    if (!pcs.includes(bassPc) && !pedal) return null;
    return { rootDegree, shape: shapeName, pcs, bass: bass < key.tonic - 14 ? bass + 12 : bass, pedal };
}

// Move each previous voice to the nearest tone of the new chord, then make
// sure every chord tone is covered by someone.
export function voiceLead(prev, pcs, lo = 52, hi = 79) {
    const next = prev.map((m) => {
        let n = nearestNote(pcs, m);
        while (n < lo) n += 12;
        while (n > hi) n -= 12;
        return n;
    });
    for (const pc of pcs) {
        if (next.some((m) => pitchClass(m) === pc)) continue;
        // reassign the voice whose pitch class is duplicated and moves least
        let bestIdx = -1;
        let bestCost = Infinity;
        for (let i = 0; i < next.length; i++) {
            const dup = next.filter((m) => pitchClass(m) === pitchClass(next[i])).length > 1;
            if (!dup) continue;
            const cand = nearestNote([pc], prev[i]);
            const cost = Math.abs(cand - prev[i]);
            if (cost < bestCost) {
                bestCost = cost;
                bestIdx = i;
            }
        }
        if (bestIdx >= 0) {
            let n = nearestNote([pc], prev[bestIdx]);
            while (n < lo) n += 12;
            while (n > hi) n -= 12;
            next[bestIdx] = n;
        }
    }
    return next.sort((a, b) => a - b);
}

// Gyro's tables, indexed by the number of common tones and by the root
// motion in semitones (folded to 0..6).
export const COMMON_TONES = [-10, 5, 9, 7, 0, -4, -8];
const ROOT_MOTION = [5, 6, 6, 5, 3, 6, -18];

const ROOT_WEIGHTS = [[0, 5], [3, 3], [5, 3], [4, 2], [1, 1.5], [6, 1.5], [2, 1]];

// Lazily extended chord timeline. Chords hold for a long time and change by
// small voice-leading moves; the tonic pedal is common.
export class Harmony {
    constructor(key, rng, { holdMin = 36, holdMax = 90, pedalProb = 0.5, roots = null, shapes = null, plan = null } = {}) {
        this.key = key;
        this.rng = rng;
        // a song plan (src/score/song.js) puts chord changes on bar lines,
        // holds a tension chord through each build and lands drops on the tonic
        this.plan = plan;
        this.holdMin = holdMin;
        this.holdMax = holdMax;
        this.pedalProb = pedalProb;
        this.pedalOnly = pedalProb >= 1;
        this.roots = roots ? ROOT_WEIGHTS.filter(([d]) => roots.includes(d)) : ROOT_WEIGHTS;
        this.shapes = shapes || Object.keys(SHAPES);
        this.chords = [];
        const openers = ['add9', 'open', 'sus2'].filter((name) => this.shapes.includes(name));
        const first = buildChord(key, 0, rng.pick(openers.length ? openers : this.shapes), true)
            || buildChord(key, 0, 'open', true)
            || { rootDegree: 0, shape: 'root', pcs: [pitchClass(key.tonic), pitchClass(key.tonic + 7)], bass: key.tonic - 12, pedal: true };
        const upper = voiceLead([60, 64, 67, 71].map((m) => nearestNote(first.pcs, m)), first.pcs);
        this.chords.push({ ...first, upper, start: 0, end: plan ? this._planEnd(0) : this._hold() });
    }

    _planEnd(start) {
        const s = this.plan.at(start + 1e-6);
        return Math.min(s.end, start + this.rng.pick([2, 4, 4]) * this.plan.bar);
    }

    // the first chord built on one of these degrees that differs from prev
    _chordOn(prev, degrees) {
        for (const degree of degrees) {
            if (degree >= this.key.steps.length) continue;
            for (const shape of this.shapes) {
                const chord = buildChord(this.key, degree, shape, false);
                if (chord && !(chord.rootDegree === prev.rootDegree && chord.shape === prev.shape)) return chord;
            }
        }
        return this._nextChord(prev);
    }

    _planned(prev, start) {
        const s = this.plan.at(start + 1e-6);
        if (s.role === 'build') return { chord: this._chordOn(prev, [6, 4, 5]), end: s.end };
        if (this.plan.isDrop(s) && start - s.start < 1e-6) return { chord: this._chordOn(prev, [0]), end: start + 4 * this.plan.bar };
        return { chord: this._nextChord(prev), end: this._planEnd(start) };
    }

    _hold() {
        return this.rng.range(this.holdMin, this.holdMax);
    }

    // Gyro's progression scorer: every candidate is scored as a move from the
    // last chord and one of the best three is drawn. Two shared notes score
    // best and none or all are penalised, so the harmony moves without
    // lurching; steps and fourths or fifths in the bass beat a tritone; the
    // top voice should hold or move by a small, singable interval.
    _nextChord(prev) {
        const candidates = [];
        const prevBass = pitchClass(prev.pedal ? this.key.tonic : degreeToMidi(this.key, prev.rootDegree));
        const prevTop = prev.upper[prev.upper.length - 1];
        for (const [degree, weight] of this.roots) {
            if (degree >= this.key.steps.length) continue;
            for (const shape of this.shapes) {
                const pedal = this.rng.chance(this.pedalProb);
                const chord = buildChord(this.key, degree, shape, pedal);
                if (!chord || (this.pedalOnly && !chord.pedal)) continue;
                const same = chord.rootDegree === prev.rootDegree && chord.shape === prev.shape;
                if (same) continue;
                const common = chord.pcs.filter((pc) => prev.pcs.includes(pc)).length;
                let score = COMMON_TONES[Math.min(common, COMMON_TONES.length - 1)];
                const root = pitchClass(degreeToMidi(this.key, degree));
                score += ROOT_MOTION[Math.min(pitchClass(root - prevBass), pitchClass(prevBass - root))];
                const top = voiceLead(prev.upper, chord.pcs);
                const leap = Math.abs(top[top.length - 1] - prevTop);
                if (leap === 0) score += 4;
                else if ([2, 3, 5, 7].includes(leap)) score += 3;
                else if (leap > 14) score -= 6;
                // the universe's taste in roots, and the tonic returning often
                score += 4 * Math.log(weight) + (degree === 0 ? 2 : 0);
                candidates.push([chord, score]);
            }
        }
        if (!candidates.length) return { ...prev };
        candidates.sort((a, b) => b[1] - a[1]);
        const top3 = candidates.slice(0, 3).map(([chord], i) => [chord, [3, 2, 1][i]]);
        return this.rng.weighted(top3);
    }

    chordAt(t) {
        let last = this.chords[this.chords.length - 1];
        while (last.end <= t) {
            const start = last.end;
            const next = this.plan ? this._planned(last, start) : { chord: this._nextChord(last), end: start + this._hold() };
            const chord = next.chord;
            const upper = voiceLead(last.upper, chord.pcs);
            last = { ...chord, upper, start, end: Math.max(next.end, start + 0.5) };
            this.chords.push(last);
            if (this.chords.length > 64) this.chords.shift();
        }
        for (let i = this.chords.length - 1; i >= 0; i--) {
            if (this.chords[i].start <= t) return this.chords[i];
        }
        return this.chords[0];
    }
}
