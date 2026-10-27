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
        const hz = midiToHz(ev.midi);
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

export class PadVoice extends Voice {
    constructor(sr, ev, rng) {
        super(sr, ev);
        const hz = midiToHz(ev.midi);
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
        }
        let x = 0;
        for (let i = 0; i < this.oscs.length; i++) x += this.oscs[i].next();
        x *= this.norm;
        let y;
        if (this.formants) {
            y = this.filter.process(x) * 0.25;
            for (const f of this.formants) {
                f.svf.process(x);
                y += f.svf.band * f.svf.k * f.g * 1.6;
            }
        } else {
            y = this.filter.process(x);
        }
        if (this.drive > 0) y = soft(y * (1 + this.drive * 4)) / (1 + this.drive);
        return y * e * this.gain;
    }
}

// ---------------------------------------------------------------- sub

export class SubVoice extends Voice {
    constructor(sr, ev) {
        super(sr, ev);
        this.inc = midiToHz(ev.midi) / sr;
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
        this.low = midiToHz(ev.midi ?? 31);
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

// ---------------------------------------------------------------- texture

// Noise driven through resonators tuned to chord tones: harsh grain that
// still sits in the key.
export class ResonantNoiseVoice extends Voice {
    constructor(sr, ev, rng) {
        super(sr, ev);
        this.noise = new Noise((rng.next() * 4294967295) >>> 0);
        this.bands = (ev.midis || [ev.midi]).map((m) => new Svf(sr, midiToHz(m), ev.q ?? 40));
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

export const VOICE_TYPES = {
    modal: ModalVoice,
    pad: PadVoice,
    sub: SubVoice,
    kick: KickVoice,
    tick: TickVoice,
    resonant: ResonantNoiseVoice,
};
