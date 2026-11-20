import { DelayLine, OnePole, TAU } from './primitives.js';

class Allpass {
    constructor(samples, g) {
        this.line = new DelayLine(samples + 1);
        this.d = samples;
        this.g = g;
    }

    process(x) {
        const delayed = this.line.read(this.d);
        const v = x + this.g * delayed;
        this.line.write(v);
        return delayed - this.g * v;
    }
}

// longest echo the delay lines hold
const MAX_ECHO = 2.5;

const FDN_MS = [43.7, 53.1, 61.9, 71.3, 83.9, 97.1, 109.7, 127.3];
const DIFFUSER_MS = [4.77, 3.59, 12.73, 9.31];

// 8-line feedback delay network with input diffusion, in-loop damping and a
// slow delay modulation that keeps long tails from ringing metallically.
export class Reverb {
    constructor(sr, { size = 1.6, t60 = 12, damping = 5200, predelayMs = 40 } = {}) {
        this.sr = sr;
        this.n = FDN_MS.length;
        this.lens = FDN_MS.map((ms) => Math.round(ms * size * sr / 1000));
        this.lines = this.lens.map((len) => new DelayLine(len + 32));
        this.damp = this.lens.map(() => new OnePole(sr, damping));
        this.diffusers = DIFFUSER_MS.map((ms) => new Allpass(Math.round(ms * sr / 1000), 0.62));
        this.pre = new DelayLine(Math.round(0.2 * sr));
        this.preSamples = Math.max(1, Math.round(predelayMs * sr / 1000));
        this.inHp = new OnePole(sr, 180);
        this.inLp = new OnePole(sr, 9000);
        this.lfoPhase = 0;
        this.lfoInc = 0.11 / sr;
        this.out = new Float32Array(this.n);
        this.setT60(t60);
    }

    setT60(t60) {
        this.t60 = t60;
        this.gains = this.lens.map((len) => Math.pow(10, (-3 * len) / (t60 * this.sr)));
    }

    // Returns [l, r] through the provided array to avoid allocation.
    process(x, outLR) {
        let v = this.inHp.hp(x);
        v = this.inLp.lp(v);
        this.pre.write(v);
        v = this.pre.read(this.preSamples);
        for (let i = 0; i < this.diffusers.length; i++) v = this.diffusers[i].process(v);

        this.lfoPhase += this.lfoInc;
        if (this.lfoPhase > 1) this.lfoPhase -= 1;
        const mod = Math.sin(TAU * this.lfoPhase) * 6;

        let sum = 0;
        for (let i = 0; i < this.n; i++) {
            const m = i === 1 ? mod : i === 5 ? -mod : 0;
            const y = this.damp[i].lp(this.lines[i].read(this.lens[i] + m) * this.gains[i]);
            this.out[i] = y;
            sum += y;
        }
        const h = (2 / this.n) * sum;
        let l = 0;
        let r = 0;
        for (let i = 0; i < this.n; i++) {
            const y = this.out[i];
            const sign = (i & 2) ? -1 : 1;
            this.lines[i].write(y - h + v * sign);
            if (i & 1) r += y; else l += y;
        }
        outLR[0] = l * 0.5;
        outLR[1] = r * 0.5;
    }
}

// Stereo dub echo: a ping-pong with filtered cross-feedback. Both sides use
// the same time, so every repeat lands on the beat: left at one delay, right
// at two, left at three...
export class Echo {
    constructor(sr, { seconds = 0.75, feedback = 0.5 } = {}) {
        this.sr = sr;
        seconds = Math.min(MAX_ECHO, seconds);
        this.l = new DelayLine(Math.ceil(MAX_ECHO * sr) + 4);
        this.r = new DelayLine(Math.ceil(MAX_ECHO * sr) + 4);
        this.lpL = new OnePole(sr, 2600);
        this.lpR = new OnePole(sr, 2600);
        this.hpL = new OnePole(sr, 220);
        this.hpR = new OnePole(sr, 220);
        this.time = seconds * sr;
        this.target = this.time;
        this.feedback = feedback;
    }

    setTime(seconds) {
        this.target = Math.min(MAX_ECHO, seconds) * this.sr;
    }

    process(x, outLR) {
        this.time += (this.target - this.time) * 0.00005;
        const dl = this.l.read(this.time);
        const dr = this.r.read(this.time);
        const fl = this.hpL.hp(this.lpL.lp(dr));
        const fr = this.hpR.hp(this.lpR.lp(dl));
        this.l.write(x + fl * this.feedback);
        this.r.write(fr * this.feedback);
        outLR[0] = dl;
        outLR[1] = dr;
    }
}

// Look-ahead peak limiter, last in the chain.
export class Limiter {
    constructor(sr, ceiling = 0.89) {
        this.ceiling = ceiling;
        this.look = Math.round(0.003 * sr);
        this.dl = new DelayLine(this.look + 2);
        this.dr = new DelayLine(this.look + 2);
        this.env = 0;
        this.gain = 1;
        this.envRelease = Math.exp(-1 / (0.05 * sr));
        this.attack = 1 - Math.exp(-1 / (0.0015 * sr));
        this.release = 1 - Math.exp(-1 / (0.4 * sr));
    }

    process(lr) {
        const peak = Math.max(Math.abs(lr[0]), Math.abs(lr[1]));
        this.env = Math.max(peak, this.env * this.envRelease);
        const target = this.env > this.ceiling ? this.ceiling / this.env : 1;
        this.gain += (target - this.gain) * (target < this.gain ? this.attack : this.release);
        this.dl.write(lr[0]);
        this.dr.write(lr[1]);
        lr[0] = this.dl.read(this.look) * this.gain;
        lr[1] = this.dr.read(this.look) * this.gain;
        if (lr[0] > this.ceiling) lr[0] = this.ceiling; else if (lr[0] < -this.ceiling) lr[0] = -this.ceiling;
        if (lr[1] > this.ceiling) lr[1] = this.ceiling; else if (lr[1] < -this.ceiling) lr[1] = -this.ceiling;
    }
}

// Edits on the master, the way a producer cuts the bounce of a track in the
// DAW (glitch and stutter edits): `repeat` loops the first `len` frames of
// its window like a beat repeat, `stop` slows the record to a halt (tape
// stop), `reverse` plays the window's last moments backwards, `mute` cuts
// everything, `crush` holds samples and drops bits. Everything is keyed to
// absolute frames, so an edit sounds the same however the blocks fall.
export class Glitch {
    constructor(sr, seconds = 3) {
        let size = 1;
        while (size < sr * seconds) size <<= 1;
        this.size = size;
        this.mask = size - 1;
        this.l = new Float32Array(size);
        this.r = new Float32Array(size);
        this.fx = null;
        this.fade = Math.round(0.003 * sr);
        this.held = [0, 0];
    }

    // fx: { kind, a, b (frames), len (frames, for repeat), bits, every }
    set(fx) {
        this.fx = fx;
    }

    _read(buf, p) {
        const i = Math.floor(p);
        const f = p - i;
        const a = buf[i & this.mask];
        return a + (buf[(i + 1) & this.mask] - a) * f;
    }

    process(lr, frame) {
        const w = frame & this.mask;
        this.l[w] = lr[0];
        this.r[w] = lr[1];
        const fx = this.fx;
        if (!fx || frame < fx.a || frame >= fx.b) return;
        const k = frame - fx.a;
        const span = fx.b - fx.a;
        // crossfade with the live signal at both ends of the window
        const edge = Math.min(k, span - k);
        const mix = edge < this.fade ? edge / this.fade : 1;
        let g = 1;
        let src;
        switch (fx.kind) {
            case 'repeat': {
                // the first pass is the live signal itself
                if (k < fx.len) return;
                const n = k % fx.len;
                src = fx.a + n;
                // short fades where each slice restarts, so the cut never clicks
                const e = Math.min(n, fx.len - n);
                if (e < this.fade) g = e / this.fade;
                break;
            }
            case 'stop': {
                // the platter slows as (1 - x)^2: the position is its integral
                const x = 1 - k / span;
                src = fx.a + (span / 3) * (1 - x * x * x);
                g = Math.min(1, x * 6) ** 2;
                break;
            }
            case 'reverse':
                src = fx.a - 1 - k;
                break;
            case 'mute':
                lr[0] *= 1 - mix;
                lr[1] *= 1 - mix;
                return;
            case 'crush': {
                if (k % fx.every === 0) {
                    this.held[0] = Math.round(lr[0] * fx.bits) / fx.bits;
                    this.held[1] = Math.round(lr[1] * fx.bits) / fx.bits;
                }
                lr[0] += (this.held[0] - lr[0]) * mix;
                lr[1] += (this.held[1] - lr[1]) * mix;
                return;
            }
            default:
                return;
        }
        const yl = this._read(this.l, src) * g;
        const yr = this._read(this.r, src) * g;
        lr[0] += (yl - lr[0]) * mix;
        lr[1] += (yr - lr[1]) * mix;
    }
}
