const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function safeRamp(param, val, time, ctx) {
    if (!param || !ctx) return;
    const now = ctx.currentTime;
    param.cancelScheduledValues(now);
    param.setValueAtTime(param.value, now);
    param.linearRampToValueAtTime(val, time);
}
export class LoopBuffer {
    constructor(ctx, { maxSeconds = 5 } = {}) {
        this.ctx = ctx;
        this.maxSeconds = Math.max(1, maxSeconds);
        this.loopLength = this.maxSeconds * 0.62;
        this.loopStart = 0;
        this.varispeed = 1;
        this.sos = 0.42;
        this.captureEnabled = false;
        this.sourceMode = 'pre';
        this.fill = 0;
        this.direction = 'forward';

        this.input = ctx.createGain();
        this.captureGain = ctx.createGain();
        this.delay = ctx.createDelay(this.maxSeconds);
        this.feedback = ctx.createGain();
        this.tone = ctx.createBiquadFilter();
        this.output = ctx.createGain();

        this.captureGain.gain.value = 0;
        this.delay.delayTime.value = this.loopLength;
        this.feedback.gain.value = this.sos;
        this.tone.type = 'lowpass';
        this.tone.frequency.value = 7200;
        this.tone.Q.value = 0.25;
        this.output.gain.value = 0.55;

        this.input.connect(this.captureGain);
        this.captureGain.connect(this.delay);
        this.delay.connect(this.tone);
        this.tone.connect(this.output);
        this.tone.connect(this.feedback);
        this.feedback.connect(this.delay);
    }

    setLoopLength(norm = 0.62) {
        const safe = clamp(norm, 0, 1);
        this.loopLength = 0.04 + safe * (this.maxSeconds - 0.04);
        this._applyDelayTime();
    }

    setLoopStart(norm = 0) {
        this.loopStart = clamp(norm, 0, 1);
        this._applyDelayTime();
    }

    setVarispeed(next = 1) {
        const safe = clamp(next, -2, 2);
        this.varispeed = safe;
        this.direction = safe < 0 ? 'reverse' : 'forward';
        const toneCut = clamp(5600 + Math.abs(safe) * 2200, 1800, 9800);
        safeRamp(this.tone.frequency, toneCut, this.ctx.currentTime + 0.1, this.ctx);
    }

    setSoundOnSound(next = 0.42) {
        this.sos = clamp(next, 0, 0.96);
        safeRamp(this.feedback.gain, this.sos, this.ctx.currentTime + 0.08, this.ctx);
    }

    setCaptureEnabled(enabled) {
        this.captureEnabled = !!enabled;
        safeRamp(this.captureGain.gain, this.captureEnabled ? 1 : 0, this.ctx.currentTime + 0.04, this.ctx);
    }

    setSourceMode(mode = 'pre') {
        this.sourceMode = mode === 'post' ? 'post' : 'pre';
    }

    setOutputLevel(level = 0.55) {
        safeRamp(this.output.gain, clamp(level, 0, 1.2), this.ctx.currentTime + 0.1, this.ctx);
    }

    _applyDelayTime() {
        const maxOffset = Math.max(0, this.maxSeconds - this.loopLength);
        const offset = this.loopStart * maxOffset;
        const target = clamp(this.loopLength + offset, 0.02, this.maxSeconds);
        safeRamp(this.delay.delayTime, target, this.ctx.currentTime + 0.08, this.ctx);
    }

    tick(durationSec = 0) {
        const delta = Math.max(0, durationSec);
        if (this.captureEnabled) {
            this.fill = clamp(this.fill + delta / Math.max(0.01, this.loopLength), 0, 1);
        } else {
            this.fill = clamp(this.fill - delta * 0.02, 0, 1);
        }
        return this.fill;
    }

    connectInput(node) {
        if (!node?.connect) return;
        node.connect(this.input);
    }

    connectOutput(node) {
        if (!node?.connect) return;
        this.output.connect(node);
    }

    getState() {
        return {
            loopFill: this.fill,
            loopDirection: this.direction,
            loopLengthSec: this.loopLength,
            loopStart: this.loopStart,
            captureEnabled: this.captureEnabled,
            sourceMode: this.sourceMode,
            varispeed: this.varispeed,
            sos: this.sos,
        };
    }
}
