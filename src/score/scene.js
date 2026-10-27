import { smooth } from './lanes.js';

// A scene is a few minutes of one texture inside a universe. Its lanes come
// from the universe's builder for that scene type.
export class Scene {
    constructor({ type, start, end, fade, piece, harmony, rng }) {
        Object.assign(this, { type, start, end, fade, piece, harmony, key: piece.key });
        this.lanes = piece.universe.scenes[type].build(this, rng, piece);
    }

    level(t) {
        return smooth((t - this.start) / this.fade) * (1 - smooth((t - (this.end - this.fade)) / this.fade));
    }

    // All events with time before `to`, in lane order.
    collect(to, out) {
        for (const lane of this.lanes) {
            while (lane.next < to && lane.next < this.end) {
                const t = lane.next;
                const events = lane.fire(t);
                for (const ev of events) out.push(ev);
                if (lane.next <= t) lane.next = t + 0.05;
            }
        }
    }

    get finished() {
        return this.lanes.every((lane) => lane.next >= this.end);
    }
}
