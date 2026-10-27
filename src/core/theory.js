// Pitch and harmony. Every note in the engine is produced here as a MIDI
// number from a scale degree, so nothing can drift out of key.

export const MODES = {
    lydian: [0, 2, 4, 6, 7, 9, 11],
    ionian: [0, 2, 4, 5, 7, 9, 11],
    mixolydian: [0, 2, 4, 5, 7, 9, 10],
    dorian: [0, 2, 3, 5, 7, 9, 10],
    aeolian: [0, 2, 3, 5, 7, 8, 10],
    phrygian: [0, 1, 3, 5, 7, 8, 10],
};

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

const ROOT_WEIGHTS = [[0, 5], [3, 3], [5, 3], [4, 2], [1, 1.5], [6, 1.5], [2, 1]];

// Lazily extended chord timeline. Chords hold for a long time and change by
// small voice-leading moves; the tonic pedal is common.
export class Harmony {
    constructor(key, rng, { holdMin = 36, holdMax = 90, pedalProb = 0.5 } = {}) {
        this.key = key;
        this.rng = rng;
        this.holdMin = holdMin;
        this.holdMax = holdMax;
        this.pedalProb = pedalProb;
        this.chords = [];
        const first = buildChord(key, 0, rng.pick(['add9', 'open', 'sus2']), true)
            || buildChord(key, 0, 'open', true);
        const upper = voiceLead([60, 64, 67, 71].map((m) => nearestNote(first.pcs, m)), first.pcs);
        this.chords.push({ ...first, upper, start: 0, end: this._hold() });
    }

    _hold() {
        return this.rng.range(this.holdMin, this.holdMax);
    }

    _nextChord(prev) {
        const candidates = [];
        for (const [degree, weight] of ROOT_WEIGHTS) {
            for (const shape of Object.keys(SHAPES)) {
                const pedal = this.rng.chance(this.pedalProb);
                const chord = buildChord(this.key, degree, shape, pedal);
                if (!chord) continue;
                const same = chord.rootDegree === prev.rootDegree && chord.shape === prev.shape;
                if (same) continue;
                const common = chord.pcs.filter((pc) => prev.pcs.includes(pc)).length;
                // favour two or more common tones; tonic returns often
                const score = weight * (0.4 + common * 0.6) * (degree === 0 ? 1.2 : 1);
                candidates.push([chord, score]);
            }
        }
        return this.rng.weighted(candidates);
    }

    chordAt(t) {
        let last = this.chords[this.chords.length - 1];
        while (last.end <= t) {
            const chord = this._nextChord(last);
            const upper = voiceLead(last.upper, chord.pcs);
            const start = last.end;
            last = { ...chord, upper, start, end: start + this._hold() };
            this.chords.push(last);
            if (this.chords.length > 64) this.chords.shift();
        }
        for (let i = this.chords.length - 1; i >= 0; i--) {
            if (this.chords[i].start <= t) return this.chords[i];
        }
        return this.chords[0];
    }
}
