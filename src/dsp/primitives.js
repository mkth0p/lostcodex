// Small, allocation-free DSP building blocks. Pure JS so the same code runs
// in the AudioWorklet and in Node (tests and offline renders).

export const TAU = Math.PI * 2;

export function dbToGain(db) {
    return Math.pow(10, db / 20);
}

// Deterministic white noise (xorshift32), independent of the score streams.
export class Noise {
    constructor(seed = 1) {
        this.s = (seed >>> 0) || 1;
    }

    next() {
        let s = this.s;
        s ^= s << 13;
        s ^= s >>> 17;
        s ^= s << 5;
        this.s = s >>> 0;
        return (this.s / 2147483648) - 1;
    }
}

export class OnePole {
    constructor(sr, hz = 1000) {
        this.sr = sr;
        this.z = 0;
        this.set(hz);
    }

    set(hz) {
        this.a = 1 - Math.exp(-TAU * Math.min(hz, this.sr * 0.45) / this.sr);
    }

    lp(x) {
        this.z += this.a * (x - this.z);
        return this.z;
    }

    hp(x) {
        return x - this.lp(x);
    }
}

// Topology-preserving-transform state variable filter (Zavalishin).
export class Svf {
    constructor(sr, hz = 1000, q = 0.707) {
        this.sr = sr;
        this.ic1 = 0;
        this.ic2 = 0;
        this.set(hz, q);
    }

    set(hz, q = this.q) {
        this.q = q;
        const g = Math.tan(Math.PI * Math.min(hz, this.sr * 0.45) / this.sr);
        const k = 1 / q;
        this.a1 = 1 / (1 + g * (g + k));
        this.a2 = g * this.a1;
        this.a3 = g * this.a2;
        this.k = k;
    }

    // Returns lowpass; band and high are left on the instance.
    process(x) {
        const v3 = x - this.ic2;
        const v1 = this.a1 * this.ic1 + this.a2 * v3;
        const v2 = this.ic2 + this.a2 * this.ic1 + this.a3 * v3;
        this.ic1 = 2 * v1 - this.ic1;
        this.ic2 = 2 * v2 - this.ic2;
        this.band = v1;
        this.high = x - this.k * v1 - v2;
        return v2;
    }
}

// Band-limited sawtooth via PolyBLEP.
export class Saw {
    constructor(sr, hz, phase = 0) {
        this.sr = sr;
        this.phase = phase;
        this.setHz(hz);
    }

    setHz(hz) {
        this.inc = hz / this.sr;
    }

    next() {
        const t = this.phase;
        const dt = this.inc;
        let y = 2 * t - 1;
        if (t < dt) {
            const x = t / dt;
            y -= x + x - x * x - 1;
        } else if (t > 1 - dt) {
            const x = (t - 1) / dt;
            y -= x * x + x + x + 1;
        }
        this.phase += dt;
        if (this.phase >= 1) this.phase -= 1;
        return y;
    }
}

export class DelayLine {
    constructor(maxSamples) {
        this.buf = new Float32Array(maxSamples + 2);
        this.size = this.buf.length;
        this.w = 0;
    }

    write(x) {
        this.buf[this.w] = x;
        this.w = (this.w + 1) % this.size;
    }

    // fractional read, delay in samples (>= 1)
    read(delay) {
        let r = this.w - delay;
        while (r < 0) r += this.size;
        const i = Math.floor(r);
        const f = r - i;
        const a = this.buf[i % this.size];
        const b = this.buf[(i + 1) % this.size];
        return a + (b - a) * f;
    }
}

// Gentle soft saturation with unity small-signal gain.
export function soft(x) {
    if (x > 3) return 1;
    if (x < -3) return -1;
    const x2 = x * x;
    return x * (27 + x2) / (27 + 9 * x2);
}
