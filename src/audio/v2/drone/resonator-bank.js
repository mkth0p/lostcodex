const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function safeRamp(param, val, time, ctx) {
    if (!param || !ctx) return;
    const now = ctx.currentTime;
    param.cancelScheduledValues(now);
    param.setValueAtTime(param.value, now);
    param.linearRampToValueAtTime(val, time);
}
import { RNG } from '../../../rng.js';

export class ResonatorBank {
    constructor(ctx, seed = 1) {
        this.ctx = ctx;
        this.input = ctx.createGain();
        this.output = ctx.createGain();
        this.feedback = ctx.createGain();
        this.filters = [];
        this.gains = [];
        this.baseHz = 220;
        this.tune = 0.45;
        this.spread = 0.36;
        this.richnessTier = 'balanced';
        this.harsh = false;

        const rng = new RNG((seed ^ 0x6e73b2) >>> 0);
        this.baseRatios = [
            1,
            rng.range(1.4, 1.8),
            rng.range(2.0, 3.5),
        ];
        this.ratios = this.baseRatios.slice();

        this.ratios.forEach((ratio, idx) => {
            const filter = ctx.createBiquadFilter();
            const gain = ctx.createGain();
            filter.type = 'bandpass';
            filter.frequency.value = this.baseHz * ratio;
            filter.Q.value = 2.4 + idx * 1.8;
            gain.gain.value = [0.48, 0.32, 0.2][idx];

            this.input.connect(filter);
            filter.connect(gain);
            gain.connect(this.output);
            this.filters.push(filter);
            this.gains.push(gain);
        });

        this.output.connect(this.feedback);
        this.feedback.connect(this.input);
        this.feedback.gain.value = 0.12;
    }

    _resolveRatios({ richnessTier = this.richnessTier, harsh = this.harsh, harmonicity = 0.5 } = {}) {
        const harmonicLift = clamp(harmonicity, 0, 1);
        if (harsh) {
            return [
                1,
                clamp(this.baseRatios[1] * (0.92 + harmonicLift * 0.22), 1.2, 2.2),
                clamp(this.baseRatios[2] * (0.9 + harmonicLift * 0.32), 1.8, 4.2),
            ];
        }
        if (richnessTier === 'lush') {
            return [
                1,
                clamp(this.baseRatios[1] * (1.04 + harmonicLift * 0.16), 1.35, 2.4),
                clamp(this.baseRatios[2] * (0.96 + harmonicLift * 0.28), 2.1, 4.8),
            ];
        }
        if (richnessTier === 'sparse') {
            return [
                1,
                clamp(this.baseRatios[1] * 0.92, 1.2, 1.9),
                clamp(this.baseRatios[2] * 0.82, 1.6, 3.2),
            ];
        }
        return this.baseRatios.slice();
    }

    setParams({ tuneNorm, feedbackNorm, spreadNorm, baseHz } = {}, context = {}) {
        const nextTier = context?.richnessTier || this.richnessTier;
        const nextHarsh = !!context?.harsh;
        const harmonicity = clamp(context?.richnessProfile?.harmonicity ?? 0.5, 0, 1);
        if (nextTier !== this.richnessTier || nextHarsh !== this.harsh || Number.isFinite(context?.richnessProfile?.harmonicity)) {
            this.richnessTier = nextTier;
            this.harsh = nextHarsh;
            this.ratios = this._resolveRatios({ richnessTier: nextTier, harsh: nextHarsh, harmonicity });
        }

        if (Number.isFinite(baseHz)) this.baseHz = clamp(baseHz, 60, 1800);
        if (Number.isFinite(tuneNorm)) this.tune = clamp(tuneNorm, 0, 1);
        if (Number.isFinite(spreadNorm)) this.spread = clamp(spreadNorm, 0, 1);

        const spreadCap = this.harsh ? 54 : this.richnessTier === 'lush' ? 48 : 38;
        const tuneDepth = this.harsh ? 150 : this.richnessTier === 'lush' ? 132 : 110;
        const spreadCents = this.spread * spreadCap;
        const tuneRatio = Math.pow(2, ((this.tune - 0.5) * tuneDepth) / 1200);
        const base = this.baseHz * tuneRatio;

        this.filters.forEach((filter, idx) => {
            const cents = (idx - 1) * spreadCents;
            const spreadRatio = Math.pow(2, cents / 1200);
            const freq = clamp(base * this.ratios[idx] * spreadRatio, 90, this.ctx.sampleRate / 2 - 220);
            safeRamp(filter.frequency, freq, this.ctx.currentTime + 0.08, this.ctx);
            safeRamp(filter.Q, 1.8 + this.tune * 7 + idx * 0.9, this.ctx.currentTime + 0.08, this.ctx);
        });

        if (Number.isFinite(feedbackNorm)) {
            const safe = clamp(feedbackNorm, 0, 1);
            const fbCap = this.harsh ? 0.46 : this.richnessTier === 'lush' ? 0.36 : 0.32;
            const fb = clamp(0.04 + safe * fbCap, 0, fbCap);
            safeRamp(this.feedback.gain, fb, this.ctx.currentTime + 0.08, this.ctx);
        }
    }

    getEnergyEstimate() {
        return clamp(this.feedback.gain.value * 2.2, 0, 1);
    }
}
