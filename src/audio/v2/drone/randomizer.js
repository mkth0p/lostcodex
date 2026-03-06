import { RNG } from '../../../rng.js';
import { normalizeDroneExpert } from './drone-macro-map.js';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const SOURCE_KEYS = ['sourceMode', 'loopLength', 'varispeed', 'sos'];
const FX_KEYS = ['filterCutoff', 'filterQ', 'filterPosition', 'resonatorTune', 'resonatorFeedback', 'resonatorSpread', 'echoTime', 'echoFeedback', 'echoTone', 'ambienceSpacetime', 'ambienceDecay'];
const MOD_KEYS = ['modMaster', 'modRate', 'modRouting'];

function targetKeys(target = 'all') {
    if (target === 'sources') return SOURCE_KEYS;
    if (target === 'fx') return FX_KEYS;
    if (target === 'mod') return MOD_KEYS;
    return [...SOURCE_KEYS, ...FX_KEYS, ...MOD_KEYS];
}

function mutateValue(rng, key, value, intensity) {
    if (key === 'sourceMode') {
        const pool = ['sine', 'supersaw', 'wavetable', 'hybrid'];
        if (rng.range(0, 1) < 0.55 + intensity * 0.35) {
            return pool[Math.floor(rng.range(0, pool.length)) % pool.length];
        }
        return value;
    }
    if (key === 'filterPosition') {
        const drift = Math.round((rng.range(-1, 1)) * (1 + intensity * 2));
        return clamp(Math.round(value) + drift, 0, 3);
    }

    const span = 0.08 + intensity * 0.22;
    if (key === 'varispeed') {
        return clamp(value + rng.range(-span, span) * 2.2, -2, 2);
    }
    if (key === 'sos') {
        return clamp(value + rng.range(-span, span), 0, 0.96);
    }
    return clamp(value + rng.range(-span, span), 0, 1);
}

export class DroneRandomizer {
    constructor(seed = 1) {
        this.seed = seed || 1;
        this.counter = 0;
        this.undoStack = [];
        this.redoStack = [];
    }

    setSeed(seed = 1) {
        this.seed = seed || 1;
        this.counter = 0;
        this.undoStack = [];
        this.redoStack = [];
    }

    apply({ target = 'all', intensity = 0.5, action = 'apply', state = {} } = {}) {
        if (action === 'undo') return this.undo(state);
        if (action === 'redo') return this.redo(state);
        return this._applyMutation(target, intensity, state);
    }

    undo(currentState = {}) {
        const prev = this.undoStack.pop();
        if (!prev) return normalizeDroneExpert(currentState);
        this.redoStack.push(normalizeDroneExpert(currentState));
        return normalizeDroneExpert(prev);
    }

    redo(currentState = {}) {
        const next = this.redoStack.pop();
        if (!next) return normalizeDroneExpert(currentState);
        this.undoStack.push(normalizeDroneExpert(currentState));
        return normalizeDroneExpert(next);
    }

    _applyMutation(target, intensity, state) {
        const safeIntensity = clamp(Number.isFinite(intensity) ? intensity : 0.5, 0, 1);
        const base = normalizeDroneExpert(state);
        const next = { ...base };
        const rng = new RNG(((this.seed || 1) + (++this.counter * 1013)) >>> 0);

        targetKeys(target).forEach((key) => {
            next[key] = mutateValue(rng, key, next[key], safeIntensity);
        });

        this.undoStack.push(base);
        if (this.undoStack.length > 16) this.undoStack.shift();
        this.redoStack = [];
        return normalizeDroneExpert(next);
    }
}
