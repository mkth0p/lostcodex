import { describe, expect, it } from 'vitest';
import { DroneRandomizer } from '../src/audio/v2/drone/randomizer.js';
import { DEFAULT_DRONE_EXPERT } from '../src/audio/v2/drone/drone-macro-map.js';

function runSequence(seed) {
    const randomizer = new DroneRandomizer(seed);
    let state = { ...DEFAULT_DRONE_EXPERT };
    state = randomizer.apply({ target: 'sources', intensity: 0.42, action: 'apply', state });
    state = randomizer.apply({ target: 'fx', intensity: 0.65, action: 'apply', state });
    state = randomizer.apply({ target: 'mod', intensity: 0.35, action: 'apply', state });
    state = randomizer.apply({ action: 'undo', state });
    state = randomizer.apply({ action: 'redo', state });
    return state;
}

describe('v2 drone randomizer determinism', () => {
    it('replays identical randomizer state for same seed and actions', () => {
        const runA = runSequence(20260306);
        const runB = runSequence(20260306);
        expect(runB).toEqual(runA);
    });

    it('differs with different seeds', () => {
        const runA = runSequence(11);
        const runB = runSequence(99);
        expect(runB).not.toEqual(runA);
    });
});
