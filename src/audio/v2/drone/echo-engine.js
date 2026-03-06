const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function safeRamp(param, val, time, ctx) {
    if (!param || !ctx) return;
    const now = ctx.currentTime;
    param.cancelScheduledValues(now);
    param.setValueAtTime(param.value, now);
    param.linearRampToValueAtTime(val, time);
}
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

    setParams({ timeNorm, feedbackNorm, toneNorm } = {}, context = {}) {
        const section = context?.section || 'INTRO';
        const richnessTier = context?.richnessTier || 'balanced';
        const fxProfile = context?.fxProfile || {};
        const synthetic = clamp(fxProfile?.synthetic ?? 0.4, 0, 1);
        const contrast = clamp(fxProfile?.contrast ?? 0.4, 0, 1);
        const harsh = !!context?.harsh;

        if (Number.isFinite(timeNorm)) {
            const safe = clamp(timeNorm, 0, 1);
            const sectionMul = section === 'SURGE' ? 0.86 : section === 'AFTERGLOW' ? 1.18 : section === 'RELEASE' ? 1.1 : 1;
            const tierMul = richnessTier === 'sparse' ? 1.1 : richnessTier === 'lush' ? 0.94 : 1;
            const baseSec = (0.06 + Math.pow(safe, 1.4) * 1.9) * sectionMul * tierMul;
            const stereoRatio = clamp(1.14 + synthetic * 0.26 + (harsh ? 0.08 : 0), 1.05, 1.44);
            safeRamp(this.delayL.delayTime, baseSec, this.ctx.currentTime + 0.08, this.ctx);
            safeRamp(this.delayR.delayTime, baseSec * stereoRatio, this.ctx.currentTime + 0.08, this.ctx);
            const wet = clamp(0.08 + safe * 0.32 + synthetic * 0.12 + (section === 'AFTERGLOW' ? 0.04 : 0), 0.06, 0.58);
            safeRamp(this.gainL.gain, wet, this.ctx.currentTime + 0.08, this.ctx);
            safeRamp(this.gainR.gain, clamp(wet * (0.92 + contrast * 0.12), 0.05, 0.6), this.ctx.currentTime + 0.08, this.ctx);
            const spread = clamp(0.24 + synthetic * 0.42 + (section === 'SURGE' ? 0.18 : 0), 0.18, 0.88);
            safeRamp(this.panL.pan, -spread, this.ctx.currentTime + 0.08, this.ctx);
            safeRamp(this.panR.pan, spread, this.ctx.currentTime + 0.08, this.ctx);
        }

        if (Number.isFinite(feedbackNorm)) {
            const safe = clamp(feedbackNorm, 0, 1);
            const sectionLift = section === 'SURGE' ? 0.06 : section === 'AFTERGLOW' ? -0.04 : 0;
            const fb = clamp(0.08 + safe * 0.52 + synthetic * 0.08 + sectionLift, 0.06, harsh ? 0.78 : 0.68);
            safeRamp(this.feedbackLtoR.gain, fb, this.ctx.currentTime + 0.08, this.ctx);
            safeRamp(this.feedbackRtoL.gain, clamp(fb * (0.88 + contrast * 0.1), 0.05, 0.76), this.ctx.currentTime + 0.08, this.ctx);
        }

        if (Number.isFinite(toneNorm)) {
            const safe = clamp(toneNorm, 0, 1);
            const toneHz = 800 + Math.pow(safe, 1.3) * 8200 + synthetic * 1200 + (section === 'SURGE' ? 600 : 0);
            safeRamp(this.preTone.frequency, toneHz, this.ctx.currentTime + 0.08, this.ctx);
        }
    }

    getDensityEstimate() {
        const t = this.delayL.delayTime.value;
        const fb = this.feedbackLtoR.gain.value;
        return clamp((fb * 0.78) + (t * 0.12), 0, 1);
    }
}
