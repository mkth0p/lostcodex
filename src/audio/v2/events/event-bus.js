export class EventBus {
    constructor({ windowMs = 15000 } = {}) {
        this._listeners = new Set();
        this._eventWindowMs = Math.max(1000, windowMs);
        this._eventTimes = [];
        this._sequence = 0;
    }

    emit(event = {}) {
        const nowMs = Date.now();
        this._eventTimes.push(nowMs);
        this._prune(nowMs);
        const payload = {
            id: ++this._sequence,
            ts: nowMs,
            ...event,
        };
        this._listeners.forEach((listener) => {
            try {
                listener(payload);
            } catch (err) {
                console.warn('V2 event listener failed:', err);
            }
        });
        return payload;
    }

    subscribe(listener) {
        if (typeof listener !== 'function') return () => { };
        this._listeners.add(listener);
        return () => this._listeners.delete(listener);
    }

    clear() {
        this._listeners.clear();
        this._eventTimes = [];
        this._sequence = 0;
    }

    getRatePerSecond() {
        this._prune(Date.now());
        return (this._eventTimes.length / this._eventWindowMs) * 1000;
    }

    _prune(nowMs) {
        const cutoff = nowMs - this._eventWindowMs;
        while (this._eventTimes.length && this._eventTimes[0] < cutoff) {
            this._eventTimes.shift();
        }
    }
}
