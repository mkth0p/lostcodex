import { afterEach, describe, expect, it, vi } from 'vitest';
import { LookaheadScheduler } from '../src/audio/core/scheduler.js';

describe('LookaheadScheduler', () => {
    afterEach(() => {
        vi.useRealTimers();
    });

    it('dispatches recurring callbacks ahead of playback time', () => {
        vi.useFakeTimers();

        const ctx = { currentTime: 0 };
        const events = [];
        const scheduler = new LookaheadScheduler(ctx, { tickMs: 10, horizonSec: 0.05 });
        scheduler.addRecurringChannel('melody', {
            startTime: 0,
            intervalSec: 0.02,
            handler: ({ scheduleTime }) => {
                events.push(scheduleTime);
            },
        });
        scheduler.start();

        for (let i = 0; i < 12; i++) {
            ctx.currentTime += 0.01;
            vi.advanceTimersByTime(10);
        }

        scheduler.stop();
        expect(events.length).toBeGreaterThan(3);
        for (let i = 1; i < events.length; i++) {
            expect(events[i]).toBeGreaterThan(events[i - 1]);
        }
    });
});
