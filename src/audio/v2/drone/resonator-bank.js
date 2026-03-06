const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export class ResonatorBank {
    constructor(ctx) {
        this.ctx = ctx;
        this.input = ctx.createGain();
        this.output = ctx.createGain();
        this.feedback = ctx.createGain();
        this.filters = [];
        this.gains = [];
        this.baseHz = 220;
        this.tune = 0.45;
        this.spread = 0.36;

        const ratios = [1, 1.52, 2.26];
        ratios.forEach((ratio, idx) => {
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

    setParams({ tuneNorm, feedbackNorm, spreadNorm, baseHz } = {}) {
        if (Number.isFinite(baseHz)) this.baseHz = clamp(baseHz, 60, 1800);
        if (Number.isFinite(tuneNorm)) this.tune = clamp(tuneNorm, 0, 1);
        if (Number.isFinite(spreadNorm)) this.spread = clamp(spreadNorm, 0, 1);

        const spreadCents = this.spread * 45;
        const tuneRatio = Math.pow(2, ((this.tune - 0.5) * 140) / 1200);
        const base = this.baseHz * tuneRatio;
        const ratios = [1, 1.52, 2.26];

        this.filters.forEach((filter, idx) => {
            const cents = (idx - 1) * spreadCents;
            const spreadRatio = Math.pow(2, cents / 1200);
            const freq = clamp(base * ratios[idx] * spreadRatio, 90, this.ctx.sampleRate / 2 - 220);
            filter.frequency.linearRampToValueAtTime(freq, this.ctx.currentTime + 0.08);
            filter.Q.linearRampToValueAtTime(1.8 + this.tune * 7 + idx * 0.9, this.ctx.currentTime + 0.08);
        });

        if (Number.isFinite(feedbackNorm)) {
            const safe = clamp(feedbackNorm, 0, 1);
            const fb = clamp(0.04 + safe * 0.38, 0, 0.42);
            this.feedback.gain.linearRampToValueAtTime(fb, this.ctx.currentTime + 0.08);
        }
    }

    getEnergyEstimate() {
        return clamp(this.feedback.gain.value * 2.2, 0, 1);
    }
}
