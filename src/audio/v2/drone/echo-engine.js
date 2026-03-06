const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export class EchoEngine {
    constructor(ctx) {
        this.ctx = ctx;
        this.input = ctx.createGain();
        this.output = ctx.createGain();

        this.preTone = ctx.createBiquadFilter();
        this.preTone.type = 'lowpass';
        this.preTone.frequency.value = 4200;

        this.delayL = ctx.createDelay(4);
        this.delayR = ctx.createDelay(4);
        this.gainL = ctx.createGain();
        this.gainR = ctx.createGain();
        this.feedbackLtoR = ctx.createGain();
        this.feedbackRtoL = ctx.createGain();

        this.panL = ctx.createStereoPanner();
        this.panR = ctx.createStereoPanner();
        this.panL.pan.value = -0.45;
        this.panR.pan.value = 0.45;

        this.input.connect(this.preTone);
        this.preTone.connect(this.delayL);
        this.preTone.connect(this.delayR);

        this.delayL.connect(this.gainL);
        this.delayR.connect(this.gainR);
        this.gainL.connect(this.panL);
        this.gainR.connect(this.panR);
        this.panL.connect(this.output);
        this.panR.connect(this.output);

        this.delayL.connect(this.feedbackLtoR);
        this.feedbackLtoR.connect(this.delayR);
        this.delayR.connect(this.feedbackRtoL);
        this.feedbackRtoL.connect(this.delayL);

        this.setParams({ timeNorm: 0.42, feedbackNorm: 0.32, toneNorm: 0.5 });
    }

    setParams({ timeNorm, feedbackNorm, toneNorm } = {}) {
        if (Number.isFinite(timeNorm)) {
            const safe = clamp(timeNorm, 0, 1);
            const baseSec = 0.06 + Math.pow(safe, 1.4) * 1.9;
            this.delayL.delayTime.linearRampToValueAtTime(baseSec, this.ctx.currentTime + 0.08);
            this.delayR.delayTime.linearRampToValueAtTime(baseSec * 1.27, this.ctx.currentTime + 0.08);
            const wet = clamp(0.08 + safe * 0.36, 0.06, 0.48);
            this.gainL.gain.linearRampToValueAtTime(wet, this.ctx.currentTime + 0.08);
            this.gainR.gain.linearRampToValueAtTime(wet, this.ctx.currentTime + 0.08);
        }

        if (Number.isFinite(feedbackNorm)) {
            const safe = clamp(feedbackNorm, 0, 1);
            const fb = clamp(0.08 + safe * 0.58, 0.06, 0.72);
            this.feedbackLtoR.gain.linearRampToValueAtTime(fb, this.ctx.currentTime + 0.08);
            this.feedbackRtoL.gain.linearRampToValueAtTime(fb * 0.92, this.ctx.currentTime + 0.08);
        }

        if (Number.isFinite(toneNorm)) {
            const safe = clamp(toneNorm, 0, 1);
            const toneHz = 800 + Math.pow(safe, 1.3) * 8600;
            this.preTone.frequency.linearRampToValueAtTime(toneHz, this.ctx.currentTime + 0.08);
        }
    }

    getDensityEstimate() {
        const t = this.delayL.delayTime.value;
        const fb = this.feedbackLtoR.gain.value;
        return clamp((fb * 0.78) + (t * 0.12), 0, 1);
    }
}
