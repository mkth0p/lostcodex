import { RNG } from '../../../rng.js';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function safeRamp(param, val, time, ctx) {
    if (!param || !ctx) return;
    const now = ctx.currentTime;
    param.cancelScheduledValues(now);
    param.setValueAtTime(param.value, now);
    param.linearRampToValueAtTime(val, time);
}
function buildImpulse(ctx, decaySec = 3.5, seed = 1, { color = 'neutral', spread = 1 } = {}) {
    const len = Math.max(1, Math.floor(ctx.sampleRate * decaySec));
    const buffer = ctx.createBuffer(2, len, ctx.sampleRate);
    const rng = new RNG(seed || 1);
    for (let ch = 0; ch < 2; ch++) {
        const data = buffer.getChannelData(ch);
        let smooth = 0;
        for (let i = 0; i < len; i++) {
            const t = i / len;
            const env = Math.pow(1 - t, 2.1 + ch * 0.2);
            const white = (rng.next() * 2) - 1;
            let sample = white;
            if (color === 'dark') {
                smooth = smooth * 0.986 + white * 0.08;
                sample = smooth;
            } else if (color === 'bright') {
                const prev = i > 0 ? data[i - 1] : 0;
                sample = white - prev * 0.72;
            }
            data[i] = sample * env * spread;
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
        this._lastImpulseKey = 'init';

        this.input.connect(this.dry);
        this.input.connect(this.preDelay);
        this.preDelay.connect(this.convolver);
        this.convolver.connect(this.tone);
        this.tone.connect(this.wet);
        this.dry.connect(this.output);
        this.wet.connect(this.output);

        this.setParams({ spacetimeNorm: 0.62, decayNorm: 0.58 });
    }

    setParams({ spacetimeNorm, decayNorm } = {}, context = {}) {
        const section = context?.section || 'INTRO';
        const richnessTier = context?.richnessTier || 'balanced';
        const fxProfile = context?.fxProfile || {};
        const organic = clamp(fxProfile?.organic ?? 0.4, 0, 1);
        const harmonic = clamp(fxProfile?.harmonic ?? 0.4, 0, 1);
        const synthetic = clamp(fxProfile?.synthetic ?? 0.4, 0, 1);

        if (Number.isFinite(spacetimeNorm)) {
            const safe = clamp(spacetimeNorm, 0, 1);
            const sectionMul = section === 'AFTERGLOW' ? 1.22 : section === 'SURGE' ? 0.88 : 1;
            const tierMul = richnessTier === 'lush' ? 1.08 : richnessTier === 'sparse' ? 0.9 : 1;
            safeRamp(this.preDelay.delayTime, (0.008 + safe * 0.11) * sectionMul, this.ctx.currentTime + 0.08, this.ctx);
            safeRamp(this.wet.gain, clamp((0.12 + safe * 0.56 + harmonic * 0.14) * tierMul, 0.08, 0.88), this.ctx.currentTime + 0.08, this.ctx);
            safeRamp(this.dry.gain, clamp(0.92 - safe * 0.36 - harmonic * 0.12 + organic * 0.08, 0.34, 0.95), this.ctx.currentTime + 0.08, this.ctx);
        }

        if (Number.isFinite(decayNorm)) {
            const safe = clamp(decayNorm, 0, 1);
            const toneHz = 1400 + Math.pow(safe, 1.1) * 8400 + synthetic * 1200;
            safeRamp(this.tone.frequency, toneHz, this.ctx.currentTime + 0.08, this.ctx);
            const prev = Number.isFinite(this._lastDecayNorm) ? this._lastDecayNorm : safe;
            const decaySec = 1.8 + safe * 5.2 + (section === 'AFTERGLOW' ? 0.6 : 0) + (richnessTier === 'lush' ? 0.4 : 0);
            const impulseColor = harmonic > 0.6 ? 'bright' : organic > 0.6 ? 'dark' : 'neutral';
            const impulseSpread = clamp(0.86 + synthetic * 0.22, 0.7, 1.2);
            const impulseKey = `${Math.round(safe * 100)}:${section}:${richnessTier}:${impulseColor}:${Math.round(impulseSpread * 100)}`;
            if (Math.abs(safe - prev) > 0.18 || impulseKey !== this._lastImpulseKey) {
                this.convolver.buffer = buildImpulse(
                    this.ctx,
                    decaySec,
                    this.seed + Math.round(safe * 1000) + section.length * 37,
                    { color: impulseColor, spread: impulseSpread },
                );
                this._lastDecayNorm = safe;
                this._lastImpulseKey = impulseKey;
            }
        }
    }

    getDepthEstimate() {
        return clamp(this.wet.gain.value * 1.2, 0, 1);
    }
}
