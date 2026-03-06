const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export class BackgroundTimeline {
    constructor() {
        this.remainingMs = 0;
        this.lastTickAt = Date.now();
    }

    setRemaining(ms) {
        this.remainingMs = clamp(Math.round(ms || 0), 0, 1000 * 60 * 60);
        this.lastTickAt = Date.now();
    }

    refill(ms) {
        this.setRemaining((this.remainingMs || 0) + (ms || 0));
    }

    tick(nowMs = Date.now()) {
        const delta = Math.max(0, nowMs - this.lastTickAt);
        this.remainingMs = clamp(this.remainingMs - delta, 0, 1000 * 60 * 60);
        this.lastTickAt = nowMs;
        return this.remainingMs;
    }

    getRemainingMs() {
        this.tick(Date.now());
        return this.remainingMs;
    }
}
