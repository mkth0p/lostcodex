import { midiToHz } from '../core/theory.js';
import { Noise, OnePole, Saw, Svf, TAU, soft } from '../dsp/primitives.js';

// Attack / hold / release envelope with smooth (raised-cosine) attack and
// exponential release. Times in seconds.
class Envelope {
    constructor(sr, attack, hold, release) {
        this.sr = sr;
        this.a = Math.max(1, Math.round(attack * sr));
        this.h = Math.max(0, Math.round(hold * sr));
        this.relCoef = Math.exp(-6.9 / Math.max(1, release * sr));
        this.t = 0;
        this.level = 0;
        this.done = false;
    }

    next() {
        const t = this.t++;
        if (t < this.a) {
            this.level = 0.5 - 0.5 * Math.cos(Math.PI * t / this.a);
        } else if (t >= this.a + this.h) {
            this.level *= this.relCoef;
            if (this.level < 1e-4) this.done = true;
        }
        return this.level;
    }
}

// Tuned frequency for an event: the engine fills ev.hz from the piece's
// tuning; plain equal temperament otherwise.
function hzOf(ev) {
    return ev.hz ?? midiToHz(ev.midi);
}

class Voice {
    constructor(sr, ev) {
        this.sr = sr;
        this.gain = ev.gain ?? 0.2;
        const pan = Math.max(-1, Math.min(1, ev.pan ?? 0));
        this.pl = Math.cos((pan + 1) * Math.PI / 4);
        this.pr = Math.sin((pan + 1) * Math.PI / 4);
        this.rev = ev.reverb ?? 0.4;
        this.echo = ev.echo ?? 0;
        this.done = false;
        this.layer = ev.layer || 'misc';
    }
}

// ---------------------------------------------------------------- modal

const MODAL_PRESETS = {
    // felt piano: slightly stretched harmonic partials, two detuned strings
    piano(hz, vel) {
        const modes = [];
        const B = 0.00018 * Math.pow(hz / 261.6, 0.6);
        const base = 9 * Math.pow(261.6 / hz, 0.35);
        // felt hammers: soft velocity keeps the upper partials low
        const tilt = 2.6 - vel * 0.9;
        for (let n = 1; n <= 9; n++) {
            const ratio = n * Math.sqrt(1 + B * n * n);
            const hammer = Math.abs(Math.sin(Math.PI * n * 0.13)) / Math.sin(Math.PI * 0.13);
            const amp = hammer * Math.pow(n, -tilt);
            if (ratio * hz > 7000) break;
            const t60 = base / (1 + 0.8 * (n - 1));
            modes.push({ ratio: ratio * 0.9997, amp: amp * 0.5, t60 });
            modes.push({ ratio: ratio * 1.0004, amp: amp * 0.5, t60: t60 * 1.15 });
        }
        return { modes, attack: 0.006 };
    },
    // struck glass / celesta: near-harmonic body with a few bright modes that die fast
    glass(hz) {
        return {
            modes: [
                { ratio: 1, amp: 1, t60: 7 },
                { ratio: 2.0006, amp: 0.32, t60: 4 },
                { ratio: 3.003, amp: 0.1, t60: 2 },
                { ratio: 5.4, amp: 0.06, t60: 0.6 },
                { ratio: 8.93, amp: 0.03, t60: 0.25 },
            ].filter((m) => m.ratio * hz < 12000),
            attack: 0.002,
        };
    },
    // singing bowl: long beating fundamental pair and inharmonic overtones
    bowl() {
        return {
            modes: [
                { ratio: 1, amp: 0.7, t60: 18 },
                { ratio: 1.0025, amp: 0.5, t60: 16 },
                { ratio: 2.71, amp: 0.25, t60: 9 },
                { ratio: 5.15, amp: 0.08, t60: 4 },
            ],
            attack: 0.02,
        };
    },
    // tuned rosewood bar: 1 : 4 : 10 overtone tuning, short and warm
    marimba(hz, vel) {
        const t = 1.8 * Math.pow(261.6 / hz, 0.45);
        return {
            modes: [
                { ratio: 1, amp: 1, t60: t },
                { ratio: 3.93, amp: 0.12 + vel * 0.2, t60: t * 0.35 },
                { ratio: 9.2, amp: 0.02 + vel * 0.05, t60: t * 0.12 },
            ].filter((m) => m.ratio * hz < 12000),
            attack: 0.0025,
        };
    },
    // thumb piano tine
    kalimba(hz) {
        return {
            modes: [
                { ratio: 1, amp: 1, t60: 2.6 },
                { ratio: 1.0015, amp: 0.3, t60: 2.2 },
                { ratio: 5.95, amp: 0.1, t60: 0.35 },
                { ratio: 16.7, amp: 0.025, t60: 0.08 },
            ].filter((m) => m.ratio * hz < 14000),
            attack: 0.0015,
        };
    },
    // vibraphone bar without motor: long, round, 1 : 4 : 10
    vibes(hz) {
        return {
            modes: [
                { ratio: 1, amp: 1, t60: 6 },
                { ratio: 4, amp: 0.22, t60: 2 },
                { ratio: 10, amp: 0.04, t60: 0.5 },
            ].filter((m) => m.ratio * hz < 14000),
            attack: 0.003,
        };
    },
    // dark metal sheet for storm scenes: inharmonic, slow bloom
    metal(hz) {
        const ratios = [1, 1.59, 2.14, 2.3, 2.65, 2.92, 3.6, 4.15];
        return {
            modes: ratios.filter((r) => r * hz < 6000).map((r, i) => ({ ratio: r, amp: 1 / (1 + i * 0.7), t60: 8 / (1 + i * 0.4) })),
            attack: 0.04,
        };
    },
};

export class ModalVoice extends Voice {
    constructor(sr, ev) {
        super(sr, ev);
        const hz = hzOf(ev);
        const preset = MODAL_PRESETS[ev.preset || 'piano'](hz, ev.velocity ?? 0.5);
        const n = preset.modes.length;
        this.n = n;
        this.re = new Float64Array(n);
        this.im = new Float64Array(n);
        this.c = new Float64Array(n);
        this.s = new Float64Array(n);
        let longest = 0;
        let ampSum = 0;
        for (const m of preset.modes) ampSum += m.amp;
        for (let i = 0; i < n; i++) {
            const m = preset.modes[i];
            const w = TAU * hz * m.ratio / sr;
            const decay = Math.pow(10, -3 / (m.t60 * sr));
            this.c[i] = Math.cos(w) * decay;
            this.s[i] = Math.sin(w) * decay;
            this.re[i] = m.amp / ampSum;
            longest = Math.max(longest, m.t60);
        }
        this.attack = Math.max(1, Math.round(preset.attack * sr));
        this.t = 0;
        this.max = Math.round(Math.min(longest, ev.ring ?? 30) * sr);
        // a damper (note off) shortens the ring
        this.damp = ev.dur ? Math.round(ev.dur * sr) : Infinity;
        this.dampCoef = Math.exp(-6.9 / (0.8 * sr));
        this.dampLevel = 1;
    }

    tick() {
        let y = 0;
        for (let i = 0; i < this.n; i++) {
            const re = this.re[i];
            const im = this.im[i];
            this.re[i] = re * this.c[i] - im * this.s[i];
            this.im[i] = re * this.s[i] + im * this.c[i];
            y += this.im[i];
        }
        const t = this.t++;
        if (t < this.attack) y *= t / this.attack;
        if (t > this.damp) {
            this.dampLevel *= this.dampCoef;
            y *= this.dampLevel;
            if (this.dampLevel < 1e-4) this.done = true;
        }
        if (t > this.max) this.done = true;
        return y * this.gain;
    }
}

// ---------------------------------------------------------------- pads

const DETUNE_SHAPE = [-1, 0.37, -0.29, 0.83, 0.05];
const FORMANTS = [[800, 1, 7], [1150, 0.5, 9], [2900, 0.2, 12]];
// vowel formants (F1, F2, F3) for the singing pad
const VOWELS = {
    a: [800, 1150, 2900],
    o: [450, 800, 2830],
    u: [325, 700, 2700],
    e: [400, 1600, 2700],
    i: [300, 1900, 2900],
};
const VOWEL_GAINS = [1, 0.55, 0.22];

export class PadVoice extends Voice {
    constructor(sr, ev, rng) {
        super(sr, ev);
        const hz = hzOf(ev);
        const count = ev.oscs ?? 4;
        const spread = ev.detune ?? 7;
        this.oscs = [];
        this.baseHz = [];
        for (let i = 0; i < count; i++) {
            // uneven spread so the beating never settles into a regular pulse
            const cents = count === 1 ? 0 : spread * DETUNE_SHAPE[i % DETUNE_SHAPE.length];
            const f = hz * Math.pow(2, cents / 1200);
            this.oscs.push(new Saw(sr, f, rng.next()));
            this.baseHz.push(f);
        }
        this.kind = ev.preset || 'warm';
        this.cutoff = ev.cutoff ?? Math.min(5000, hz * 6 + 400);
        this.filter = new Svf(sr, this.cutoff, ev.q ?? 0.8);
        this.formants = this.kind === 'choir'
            ? FORMANTS.map(([f, g, q]) => ({ svf: new Svf(sr, f, q), g }))
            : null;
        if (this.kind === 'voice') {
            // two vowels the voice slowly moves between
            this.vowelA = VOWELS[ev.vowels?.[0] || 'a'];
            this.vowelB = VOWELS[ev.vowels?.[1] || 'o'];
            this.formants = VOWEL_GAINS.map((g, i) => ({ svf: new Svf(sr, this.vowelA[i], 8 + i * 3), g }));
            this.morphPhase = rng.next();
            this.morphInc = (0.04 + rng.next() * 0.06) / sr;
            this.breath = new Noise((rng.next() * 4294967295) >>> 0);
        }
        // bit and rate reduction for the ash universe
        this.crush = ev.crush ?? 0;
        this.crushBits = Math.pow(2, ev.bits ?? 6);
        this.held = 0;
        this.drive = ev.drive ?? 0;
        this.env = new Envelope(sr, ev.attack ?? 4, ev.dur ?? 8, ev.release ?? 6);
        this.lfo = rng.next();
        this.lfoInc = (0.05 + rng.next() * 0.1) / sr;
        this.wow = (ev.wow ?? 3) / 1200;
        this.filterEnv = ev.filterEnv ?? 0;
        this.counter = 0;
        this.norm = 1 / Math.sqrt(count);
    }

    tick() {
        const e = this.env.next();
        if (this.env.done) this.done = true;
        // control-rate updates every 32 samples
        if ((this.counter++ & 31) === 0) {
            this.lfo += this.lfoInc * 32;
            const l = Math.sin(TAU * this.lfo);
            const ratio = 1 + this.wow * l * 0.69;
            for (let i = 0; i < this.oscs.length; i++) this.oscs[i].setHz(this.baseHz[i] * ratio);
            const fc = this.cutoff * (1 + 0.25 * l) * (1 + this.filterEnv * e);
            this.filter.set(fc);
            if (this.vowelA) {
                this.morphPhase += this.morphInc * 32;
                const m = 0.5 - 0.5 * Math.cos(TAU * this.morphPhase);
                for (let i = 0; i < 3; i++) {
                    this.formants[i].svf.set(this.vowelA[i] + (this.vowelB[i] - this.vowelA[i]) * m);
                }
            }
        }
        let x = 0;
        for (let i = 0; i < this.oscs.length; i++) x += this.oscs[i].next();
        x *= this.norm;
        let y;
        if (this.formants) {
            if (this.breath) x += this.breath.next() * 0.12;
            y = this.filter.process(x) * (this.vowelA ? 0.12 : 0.25);
            for (const f of this.formants) {
                f.svf.process(x);
                y += f.svf.band * f.svf.k * f.g * 1.6;
            }
        } else {
            y = this.filter.process(x);
        }
        if (this.drive > 0) y = soft(y * (1 + this.drive * 4)) / (1 + this.drive);
        if (this.crush) {
            if (this.counter % this.crush === 0) this.held = Math.round(y * this.crushBits) / this.crushBits;
            y = this.held;
        }
        return y * e * this.gain;
    }
}

// ---------------------------------------------------------------- organ

const ORGAN_STOPS = {
    // principal: soft, round, a little octave and twelfth
    flue: [[1, 1], [2, 0.42], [3, 0.16], [4, 0.2], [6, 0.06], [8, 0.07]],
    // reed: brighter, odd harmonics forward
    reed: [[1, 1], [2, 0.3], [3, 0.45], [4, 0.15], [5, 0.3], [7, 0.15], [9, 0.07]],
    // flute stop: almost pure
    gedackt: [[1, 1], [3, 0.12], [2, 0.08]],
};

// Additive organ pipe with a celeste rank and slowly breathing partials.
export class OrganVoice extends Voice {
    constructor(sr, ev, rng) {
        super(sr, ev);
        const hz = hzOf(ev);
        const stops = ORGAN_STOPS[ev.preset || 'flue'].filter(([r]) => r * hz < 9000);
        const partials = [];
        for (const [ratio, amp] of stops) {
            partials.push([ratio, amp]);
            if (ratio <= 2) partials.push([ratio * Math.pow(2, 2.2 / 1200), amp * 0.6]);
        }
        this.n = partials.length;
        this.re = new Float64Array(this.n);
        this.im = new Float64Array(this.n);
        this.c = new Float64Array(this.n);
        this.s = new Float64Array(this.n);
        this.amp = new Float64Array(this.n);
        this.breathPhase = new Float64Array(this.n);
        let sum = 0;
        for (const [, a] of partials) sum += a;
        for (let i = 0; i < this.n; i++) {
            const w = TAU * hz * partials[i][0] / sr;
            this.c[i] = Math.cos(w);
            this.s[i] = Math.sin(w);
            this.re[i] = 1;
            this.amp[i] = partials[i][1] / sum;
            this.breathPhase[i] = rng.next();
        }
        this.breathInc = (0.02 + rng.next() * 0.05) / sr;
        this.weights = new Float64Array(this.amp);
        this.env = new Envelope(sr, ev.attack ?? 6, ev.dur ?? 20, ev.release ?? 10);
        this.counter = 0;
    }

    tick() {
        const e = this.env.next();
        if (this.env.done) this.done = true;
        if ((this.counter++ & 63) === 0) {
            for (let i = 0; i < this.n; i++) {
                this.breathPhase[i] += this.breathInc * 64 * (1 + i * 0.37);
                this.weights[i] = this.amp[i] * (0.75 + 0.25 * Math.sin(TAU * this.breathPhase[i]));
                // renormalise the rotators so long notes never drift in level
                const mag = Math.hypot(this.re[i], this.im[i]);
                this.re[i] /= mag;
                this.im[i] /= mag;
            }
        }
        let y = 0;
        for (let i = 0; i < this.n; i++) {
            const re = this.re[i];
            const im = this.im[i];
            this.re[i] = re * this.c[i] - im * this.s[i];
            this.im[i] = re * this.s[i] + im * this.c[i];
            y += this.im[i] * this.weights[i];
        }
        return y * e * this.gain;
    }
}

// ---------------------------------------------------------------- flute

// Breathy flute: near-sine body, breath noise around the pitch, delayed vibrato.
export class FluteVoice extends Voice {
    constructor(sr, ev, rng) {
        super(sr, ev);
        this.hz = hzOf(ev);
        this.fromHz = ev.fromHz ?? this.hz;
        this.phase = rng.next();
        this.t = 0;
        this.glide = Math.round(0.07 * sr);
        this.noise = new Noise((rng.next() * 4294967295) >>> 0);
        this.breath = new Svf(sr, this.hz * 2, 1.6);
        this.env = new Envelope(sr, ev.attack ?? 0.12, ev.dur ?? 1, ev.release ?? 0.5);
        this.vib = rng.range(4.6, 5.6) / sr;
        this.vibPhase = 0;
        this.airy = ev.airy ?? 0.18;
    }

    tick() {
        const e = this.env.next();
        if (this.env.done) this.done = true;
        const t = this.t++;
        const g = t < this.glide ? t / this.glide : 1;
        const vibDepth = Math.min(1, Math.max(0, (t / this.sr - 0.35) * 1.5)) * 0.007;
        this.vibPhase += this.vib;
        const hz = (this.fromHz + (this.hz - this.fromHz) * g) * (1 + vibDepth * Math.sin(TAU * this.vibPhase));
        this.phase += hz / this.sr;
        if (this.phase > 1) this.phase -= 1;
        const p = TAU * this.phase;
        const body = Math.sin(p) + 0.22 * Math.sin(2 * p) + 0.06 * Math.sin(3 * p);
        this.breath.process(this.noise.next());
        const chiff = t < this.sr * 0.05 ? 1 - t / (this.sr * 0.05) : 0;
        const y = body * 0.8 + this.breath.band * this.breath.k * (this.airy + chiff * 0.6) * 3;
        return y * e * this.gain;
    }
}

// ---------------------------------------------------------------- lead

// Warm detuned analog lead with tape wow and flutter, gliding between notes.
export class LeadVoice extends Voice {
    constructor(sr, ev, rng) {
        super(sr, ev);
        this.hz = hzOf(ev);
        this.fromHz = ev.fromHz ?? this.hz;
        this.a = new Saw(sr, this.hz, rng.next());
        this.b = new Saw(sr, this.hz, rng.next());
        this.subPhase = 0;
        this.filter = new Svf(sr, ev.cutoff ?? 1400, ev.q ?? 1.1);
        this.cutoff = ev.cutoff ?? 1400;
        this.env = new Envelope(sr, ev.attack ?? 0.05, ev.dur ?? 1, ev.release ?? 0.8);
        this.t = 0;
        this.glide = Math.round((ev.glide ?? 0.09) * sr);
        this.wow = (ev.wow ?? 14) / 1200;
        this.wowPhase = rng.next();
        this.wowInc = rng.range(0.35, 0.7) / sr;
        this.flutterPhase = 0;
        this.flutterInc = rng.range(5.5, 7.5) / sr;
        this.detune = Math.pow(2, (ev.detune ?? 8) / 1200);
        this.counter = 0;
    }

    tick() {
        const e = this.env.next();
        if (this.env.done) this.done = true;
        const t = this.t++;
        if ((this.counter++ & 15) === 0) {
            this.wowPhase += this.wowInc * 16;
            this.flutterPhase += this.flutterInc * 16;
            const g = t < this.glide ? t / this.glide : 1;
            const base = this.fromHz + (this.hz - this.fromHz) * g;
            const mod = 1 + this.wow * Math.sin(TAU * this.wowPhase) + this.wow * 0.2 * Math.sin(TAU * this.flutterPhase);
            this.a.setHz(base * mod);
            this.b.setHz(base * mod * this.detune);
            this.subInc = base * mod * 0.5 / this.sr;
            this.filter.set(this.cutoff * (0.6 + 0.8 * e));
        }
        this.subPhase += this.subInc;
        if (this.subPhase > 1) this.subPhase -= 1;
        const x = (this.a.next() + this.b.next()) * 0.5 + Math.sin(TAU * this.subPhase) * 0.35;
        return soft(this.filter.process(x) * 1.3) * e * this.gain;
    }
}

// ---------------------------------------------------------------- noise bed

// Tape hiss / vinyl bed: filtered noise with sparse soft crackles.
export class NoiseBedVoice extends Voice {
    constructor(sr, ev, rng) {
        super(sr, ev);
        this.noise = new Noise((rng.next() * 4294967295) >>> 0);
        this.lp = new OnePole(sr, ev.tone ?? 6000);
        this.hp = new OnePole(sr, ev.low ?? 300);
        this.env = new Envelope(sr, ev.attack ?? 4, ev.dur ?? 30, ev.release ?? 6);
        this.crackle = (ev.crackle ?? 0) / sr;
        this.pop = 0;
        this.popLp = new OnePole(sr, 2500);
    }

    tick() {
        const e = this.env.next();
        if (this.env.done) this.done = true;
        const n = this.noise.next();
        let y = this.hp.hp(this.lp.lp(n)) * 0.6;
        if (this.crackle && (n * 0.5 + 0.5) < this.crackle) this.pop = (n > 0 ? 1 : -1) * (0.5 + Math.abs(n));
        y += this.popLp.lp(this.pop) * 0.8;
        this.pop *= 0.6;
        return y * e * this.gain;
    }
}

// ---------------------------------------------------------------- sub

export class SubVoice extends Voice {
    constructor(sr, ev) {
        super(sr, ev);
        this.inc = hzOf(ev) / sr;
        this.phase = 0;
        this.env = new Envelope(sr, ev.attack ?? 3, ev.dur ?? 8, ev.release ?? 4);
    }

    tick() {
        const e = this.env.next();
        if (this.env.done) this.done = true;
        this.phase += this.inc;
        if (this.phase > 1) this.phase -= 1;
        const p = TAU * this.phase;
        return (Math.sin(p) + 0.18 * Math.sin(2 * p)) * e * this.gain;
    }
}

// ---------------------------------------------------------------- pulse kit

export class KickVoice extends Voice {
    constructor(sr, ev) {
        super(sr, ev);
        this.t = 0;
        this.phase = 0;
        this.lp = new OnePole(sr, ev.tone ?? 160);
        this.ampCoef = Math.exp(-6.9 / (0.42 * sr));
        this.amp = 1;
        this.low = ev.midi === undefined ? midiToHz(31) : hzOf(ev);
    }

    tick() {
        const t = this.t++ / this.sr;
        const hz = this.low + 70 * Math.exp(-t / 0.035);
        this.phase += hz / this.sr;
        this.amp *= this.ampCoef;
        if (this.amp < 1e-4) this.done = true;
        const y = Math.sin(TAU * this.phase) * this.amp;
        return this.lp.lp(y) * 1.8 * this.gain;
    }
}

export class TickVoice extends Voice {
    constructor(sr, ev, rng) {
        super(sr, ev);
        this.noise = new Noise((rng.next() * 4294967295) >>> 0);
        this.svf = new Svf(sr, ev.tone ?? 8000, 1.2);
        this.coef = Math.exp(-6.9 / ((ev.decay ?? 0.05) * sr));
        this.amp = 1;
    }

    tick() {
        this.amp *= this.coef;
        if (this.amp < 1e-4) this.done = true;
        this.svf.process(this.noise.next());
        return this.svf.high * this.amp * this.gain;
    }
}

// Soft lo-fi snare: a short tuned body under band-passed noise.
export class SnareVoice extends Voice {
    constructor(sr, ev, rng) {
        super(sr, ev);
        this.noise = new Noise((rng.next() * 4294967295) >>> 0);
        this.svf = new Svf(sr, ev.tone ?? 1800, 0.9);
        this.body = (ev.body ?? 185) / sr;
        this.phase = 0;
        this.nCoef = Math.exp(-6.9 / ((ev.decay ?? 0.2) * sr));
        this.bCoef = Math.exp(-6.9 / (0.09 * sr));
        this.n = 1;
        this.b = 1;
    }

    tick() {
        this.n *= this.nCoef;
        this.b *= this.bCoef;
        if (this.n < 1e-4) this.done = true;
        this.phase += this.body;
        this.svf.process(this.noise.next());
        return (this.svf.band * this.svf.k * this.n * 1.4 + Math.sin(TAU * this.phase) * this.b * 0.6) * this.gain;
    }
}

// ---------------------------------------------------------------- texture

// Noise driven through resonators tuned to chord tones: harsh grain that
// still sits in the key.
export class ResonantNoiseVoice extends Voice {
    constructor(sr, ev, rng) {
        super(sr, ev);
        this.noise = new Noise((rng.next() * 4294967295) >>> 0);
        const freqs = ev.hzs || (ev.midis || [ev.midi]).map((m) => midiToHz(m));
        this.bands = freqs.map((f) => new Svf(sr, f, ev.q ?? 40));
        this.air = new Svf(sr, ev.air ?? 1400, 0.6);
        this.airGain = ev.airGain ?? 0.08;
        this.drive = ev.drive ?? 0.4;
        this.env = new Envelope(sr, ev.attack ?? 6, ev.dur ?? 10, ev.release ?? 8);
        this.lfo = rng.next();
        this.lfoInc = (0.03 + rng.next() * 0.08) / sr;
        this.norm = Math.sqrt(ev.q ?? 40) * 0.9 / Math.sqrt(this.bands.length);
    }

    tick() {
        const e = this.env.next();
        if (this.env.done) this.done = true;
        this.lfo += this.lfoInc;
        const swell = 0.6 + 0.4 * Math.sin(TAU * this.lfo);
        const x = this.noise.next();
        let y = 0;
        for (const b of this.bands) {
            b.process(x);
            y += b.band * b.k;
        }
        this.air.process(x);
        y = y * this.norm + this.air.band * this.airGain * swell;
        y = soft(y * (1 + this.drive * 3)) / (1 + this.drive);
        return y * e * swell * this.gain;
    }
}

// ---------------------------------------------------------------- sampled

// Plays a zone of the sample pack, repitched to the tuned note with cubic
// interpolation. One-shots ring out (a damper shortens them after `dur`);
// loops hold on their crossfaded loop under an attack / hold / release
// envelope. Optional tape wow, low-pass, drive and bit crush.
export class SampleVoice extends Voice {
    constructor(sr, ev, rng) {
        super(sr, ev);
        const bank = ev.bank;
        const ins = bank.instruments[ev.sample];
        const hz = hzOf(ev);
        const zone = bank.zone(ev.sample, ev.midi ?? 60);
        this.data = zone.data;
        this.len = zone.data.length;
        this.loopStart = zone.loopStart;
        this.loop = zone.loopStart >= 0;
        this.inc = (hz / zone.hz) * (bank.sampleRate / sr);
        this.fromInc = ev.fromHz ? (ev.fromHz / zone.hz) * (bank.sampleRate / sr) : this.inc;
        this.glide = Math.round((ev.glide ?? 0.08) * sr);
        // loops can start somewhere inside the loop, so held notes never sound copied
        this.pos = this.loop && ev.scatter ? zone.loopStart + (this.len - zone.loopStart) * rng.next() : 0;
        // every instrument comes out at about the loudness of the synth voice
        // it stands in for, at the same gain
        this.gain *= (ev.trim ?? 1) * Math.min(16, (this.loop ? 0.4 : 0.25) / ins.rms) / 32768;
        // the meter (analysis only) tells sampled layers apart
        this.layer = `${this.layer}:${ev.sample}`;
        if (this.loop) {
            this.env = new Envelope(sr, ev.attack ?? 0.02, ev.dur ?? 4, ev.release ?? 2);
        } else {
            this.env = null;
            this.damp = ev.dur ? Math.round(ev.dur * sr) : Infinity;
            this.dampCoef = Math.exp(-6.9 / ((ev.release ?? 1.2) * sr));
            this.dampLevel = 1;
        }
        this.t = 0;
        this.wow = (ev.wow ?? 0) / 1200;
        this.wowPhase = rng.next();
        this.wowInc = rng.range(0.3, 0.6) / sr;
        this.lp = ev.cutoff ? new OnePole(sr, ev.cutoff) : null;
        this.drive = ev.drive ?? 0;
        this.crush = ev.crush ?? 0;
        this.crushBits = Math.pow(2, (ev.bits ?? 8) - 1);
        this.held = 0;
        this.rate = this.fromInc;
        this.counter = 0;
    }

    tick() {
        const t = this.t++;
        if ((this.counter++ & 15) === 0) {
            const g = t < this.glide ? t / this.glide : 1;
            let inc = this.fromInc + (this.inc - this.fromInc) * g;
            if (this.wow) {
                this.wowPhase += this.wowInc * 16;
                inc *= 1 + this.wow * Math.sin(TAU * this.wowPhase);
            }
            this.rate = inc;
        }
        let e = 1;
        if (this.env) {
            e = this.env.next();
            if (this.env.done) this.done = true;
        } else if (t > this.damp) {
            this.dampLevel *= this.dampCoef;
            e = this.dampLevel;
            if (e < 1e-4) this.done = true;
        }
        // cubic (Catmull-Rom) read between samples
        const d = this.data;
        const i = this.pos | 0;
        const f = this.pos - i;
        const a = d[i > 0 ? i - 1 : 0];
        const b = d[i];
        let c;
        let n;
        if (i + 2 < this.len) {
            c = d[i + 1];
            n = d[i + 2];
        } else {
            // past the end a loop continues from its loop start, a one-shot from silence
            c = i + 1 < this.len ? d[i + 1] : this.loop ? d[this.loopStart] : 0;
            n = this.loop ? d[this.loopStart + i + 2 - this.len] : 0;
        }
        let y = b + 0.5 * f * (c - a + f * (2 * a - 5 * b + 4 * c - n + f * (3 * (b - c) + n - a)));
        this.pos += this.rate;
        if (this.pos >= this.len) {
            if (this.loop) this.pos -= this.len - this.loopStart;
            else this.done = true;
        }
        y *= this.gain;
        if (this.lp) y = this.lp.lp(y);
        if (this.drive > 0) y = soft(y * (1 + this.drive * 4)) / (1 + this.drive);
        if (this.crush) {
            if (t % this.crush === 0) this.held = Math.round(y * this.crushBits) / this.crushBits;
            y = this.held;
        }
        return y * e;
    }
}

export const VOICE_TYPES = {
    modal: ModalVoice,
    pad: PadVoice,
    sub: SubVoice,
    kick: KickVoice,
    tick: TickVoice,
    resonant: ResonantNoiseVoice,
    organ: OrganVoice,
    flute: FluteVoice,
    lead: LeadVoice,
    bed: NoiseBedVoice,
    snare: SnareVoice,
    sample: SampleVoice,
};
