export class LookaheadScheduler {
    constructor(ctx, { tickMs = 25, horizonSec = 0.12 } = {}) {
        this.ctx = ctx;
        this.tickMs = Math.max(5, tickMs);
        this.horizonSec = Math.max(0.02, horizonSec);
        this._timer = null;
        this._channels = new Map();
        this._stats = {
            tickCount: 0,
            lateCallbacks: 0,
            maxLateMs: 0,
            lastTickAtMs: 0,
        };
    }

    start() {
        if (this._timer) return;
        this._stats.lastTickAtMs = Date.now();
        this._timer = setInterval(() => this._tick(), this.tickMs);
    }

    stop() {
        if (this._timer) {
            clearInterval(this._timer);
            this._timer = null;
        }
        this._channels.clear();
    }

    addRecurringChannel(name, { startTime, intervalSec, handler }) {
        if (!name || typeof handler !== 'function') return;
        const stepSec = Math.max(0.001, intervalSec || 0.001);
        const firstTime = Number.isFinite(startTime)
            ? startTime
            : (this.ctx?.currentTime || 0);
        this._channels.set(name, {
            name,
            handler,
            nextTime: firstTime,
            intervalSec: stepSec,
            enabled: true,
        });
    }

    removeChannel(name) {
        this._channels.delete(name);
    }

    getStats() {
        return {
            ...this._stats,
            channelCount: this._channels.size,
            tickMs: this.tickMs,
            horizonSec: this.horizonSec,
        };
    }

    _tick() {
        const nowSec = this.ctx?.currentTime || 0;
        const horizon = nowSec + this.horizonSec;
        this._stats.tickCount++;
        this._stats.lastTickAtMs = Date.now();

        this._channels.forEach((channel, name) => {
            if (!channel.enabled) return;
            let guard = 0;
            while (channel.nextTime <= horizon && channel.enabled && guard < 64) {
                const lateMs = Math.max(0, (nowSec - channel.nextTime) * 1000);
                if (lateMs > 0) {
                    this._stats.lateCallbacks++;
                    this._stats.maxLateMs = Math.max(this._stats.maxLateMs, lateMs);
                }
                try {
                    const maybeNext = channel.handler({
                        scheduleTime: channel.nextTime,
                        nowTime: nowSec,
                        horizonTime: horizon,
                        lateMs,
                        channel: name,
                    });
                    if (Number.isFinite(maybeNext) && maybeNext > channel.nextTime) {
                        channel.nextTime = maybeNext;
                    } else {
                        channel.nextTime += channel.intervalSec;
                    }
                } catch (err) {
                    channel.enabled = false;
                    console.warn(`Scheduler channel "${name}" disabled due to error:`, err);
                }
                guard++;
            }
            if (guard >= 64) {
                channel.enabled = false;
                console.warn(`Scheduler channel "${name}" exceeded safety guard and was disabled.`);
            }
        });
    }
}
