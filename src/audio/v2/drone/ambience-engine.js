import { RNG } from '../../../rng.js';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function buildImpulse(ctx, decaySec = 3.5, seed = 1) {
    const len = Math.max(1, Math.floor(ctx.sampleRate * decaySec));
    const buffer = ctx.createBuffer(2, len, ctx.sampleRate);
    const rng = new RNG(seed || 1);
    for (let ch = 0; ch < 2; ch++) {
        const data = buffer.getChannelData(ch);
        for (let i = 0; i < len; i++) {
            const t = i / len;
            const env = Math.pow(1 - t, 2.1 + ch * 0.2);
            data[i] = ((rng.next() * 2) - 1) * env;
        }
    }
    return buffer;
}

export class AmbienceEngine {
    constructor(ctx, seed = 1) {
        this.ctx = ctx;
        this.seed = seed;
        this.input = ctx.createGain();
        this.output = ctx.createGain();
        this.dry = ctx.createGain();
        this.wet = ctx.createGain();
        this.preDelay = ctx.createDelay(0.25);
        this.convolver = ctx.createConvolver();
        this.tone = ctx.createBiquadFilter();

        this.tone.type = 'lowpass';
        this.tone.frequency.value = 6800;
        this.preDelay.delayTime.value = 0.032;
        this.convolver.buffer = buildImpulse(ctx, 3.6, this.seed + 991);

        this.input.connect(this.dry);
        this.input.connect(this.preDelay);
        this.preDelay.connect(this.convolver);
        this.convolver.connect(this.tone);
        this.tone.connect(this.wet);
        this.dry.connect(this.output);
        this.wet.connect(this.output);

        this.setParams({ spacetimeNorm: 0.62, decayNorm: 0.58 });
    }

    setParams({ spacetimeNorm, decayNorm } = {}) {
        if (Number.isFinite(spacetimeNorm)) {
            const safe = clamp(spacetimeNorm, 0, 1);
            this.preDelay.delayTime.linearRampToValueAtTime(0.008 + safe * 0.11, this.ctx.currentTime + 0.08);
            this.wet.gain.linearRampToValueAtTime(clamp(0.12 + safe * 0.64, 0.1, 0.82), this.ctx.currentTime + 0.08);
            this.dry.gain.linearRampToValueAtTime(clamp(0.92 - safe * 0.42, 0.38, 0.95), this.ctx.currentTime + 0.08);
        }

        if (Number.isFinite(decayNorm)) {
            const safe = clamp(decayNorm, 0, 1);
            const toneHz = 1600 + Math.pow(safe, 1.1) * 8800;
            this.tone.frequency.linearRampToValueAtTime(toneHz, this.ctx.currentTime + 0.08);
            const prev = Number.isFinite(this._lastDecayNorm) ? this._lastDecayNorm : safe;
            if (Math.abs(safe - prev) > 0.2) {
                const decaySec = 1.8 + safe * 5.2;
                this.convolver.buffer = buildImpulse(this.ctx, decaySec, this.seed + Math.round(safe * 1000));
                this._lastDecayNorm = safe;
            }
        }
    }

    getDepthEstimate() {
        return clamp(this.wet.gain.value * 1.2, 0, 1);
    }
}
