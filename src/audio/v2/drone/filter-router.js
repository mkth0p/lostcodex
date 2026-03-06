const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function safeRamp(param, val, time, ctx) {
    if (!param || !ctx) return;
    const now = ctx.currentTime;
    param.cancelScheduledValues(now);
    param.setValueAtTime(param.value, now);
    param.linearRampToValueAtTime(val, time);
}
function safeDisconnect(node) {
    try { node.disconnect(); } catch { }
}

export class FilterRouter {
    constructor(ctx) {
        this.ctx = ctx;
        this.input = ctx.createGain();
        this.output = ctx.createGain();
        this.stages = [ctx.createGain(), ctx.createGain(), ctx.createGain(), ctx.createGain()];
        this.filter = ctx.createBiquadFilter();
        this.position = 1;

        this.filter.type = 'lowpass';
        this.filter.frequency.value = 2400;
        this.filter.Q.value = 0.8;
        this._rewire(this.position);
    }

    _rewire(position = 1) {
        const pos = clamp(Math.round(position), 0, 3);
        this.position = pos;

        [this.input, this.filter, this.output, ...this.stages].forEach(safeDisconnect);

        // Build linear chain input -> stage0 -> stage1 -> stage2 -> stage3 -> output
        // and insert filter before the selected stage index.
        if (pos === 0) {
            this.input.connect(this.filter);
            this.filter.connect(this.stages[0]);
        } else {
            this.input.connect(this.stages[0]);
        }

        for (let i = 0; i < this.stages.length - 1; i++) {
            if (i === pos - 1) {
                this.stages[i].connect(this.filter);
                this.filter.connect(this.stages[i + 1]);
            } else {
                this.stages[i].connect(this.stages[i + 1]);
            }
        }
        this.stages[this.stages.length - 1].connect(this.output);
    }

    setFilter({ type, cutoffNorm, qNorm, position } = {}) {
        if (typeof type === 'string') {
            const resolved = ['lowpass', 'bandpass', 'highpass', 'notch'].includes(type) ? type : 'lowpass';
            this.filter.type = resolved;
        }
        if (Number.isFinite(cutoffNorm)) {
            const safe = clamp(cutoffNorm, 0, 1);
            const hz = 120 + Math.pow(safe, 1.6) * 8800;
            safeRamp(this.filter.frequency, hz, this.ctx.currentTime + 0.08, this.ctx);
        }
        if (Number.isFinite(qNorm)) {
            const safe = clamp(qNorm, 0, 1);
            const q = 0.2 + safe * 14;
            safeRamp(this.filter.Q, q, this.ctx.currentTime + 0.08, this.ctx);
        }
        if (Number.isFinite(position) && Math.round(position) !== this.position) {
            this._rewire(position);
        }
    }

    getState() {
        return {
            filterPosition: this.position,
            filterType: this.filter.type,
            filterHz: this.filter.frequency.value,
            filterQ: this.filter.Q.value,
        };
    }
}
