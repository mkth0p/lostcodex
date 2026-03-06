import { RNG } from '../../../rng.js';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function seededPhase(seed, salt) {
    const rng = new RNG(((seed || 1) ^ (salt * 2654435761)) >>> 0);
    return rng.range(0, Math.PI * 2);
}

export class DroneModMatrix {
    constructor(seed = 1) {
        this.seed = seed || 1;
        this.master = 0.5;
        this.rate = 0.4;
        this.routing = 0.5;
        this._phases = [0, 1, 2, 3].map((idx) => seededPhase(this.seed, idx + 11));
    }

    setSeed(seed = 1) {
        this.seed = seed || 1;
        this._phases = [0, 1, 2, 3].map((idx) => seededPhase(this.seed, idx + 11));
    }

    setControls({ master, rate, routing } = {}) {
        if (Number.isFinite(master)) this.master = clamp(master, 0, 1);
        if (Number.isFinite(rate)) this.rate = clamp(rate, 0, 1);
        if (Number.isFinite(routing)) this.routing = clamp(routing, 0, 1);
    }

    resolve({ scheduleTime = 0, section = 'INTRO', qualityScalar = 1 } = {}) {
        const sectionLift = section === 'SURGE'
            ? 0.14
            : section === 'GROWTH'
                ? 0.08
                : section === 'AFTERGLOW'
                    ? -0.06
                    : 0;
        const sectionRateMul = section === 'SURGE'
            ? 1.34
            : section === 'GROWTH'
                ? 1.12
                : section === 'AFTERGLOW'
                    ? 0.78
                    : 1;
        const master = clamp(this.master + sectionLift, 0, 1);
        const rateHz = clamp((0.004 + this.rate * 0.065) * sectionRateMul, 0.003, 0.16);
        const depth = clamp(master * (0.32 + this.routing * 0.48) * qualityScalar, 0, 1);

        const lane = (idx, mul = 1) => {
            const phase = this._phases[idx] || 0;
            const raw = Math.sin((scheduleTime * rateHz * Math.PI * 2 * mul) + phase);
            return raw;
        };

        const geoLane = Math.sin((scheduleTime * 0.0005 * Math.PI * 2) + (this._phases[0] || 0));

        return {
            // Increased filter shift from 0.48 to 1.15 for more dramatic sweeps
            filterCutoffShift: (lane(0, 0.65) * 0.4 + geoLane * 0.6) * depth * 1.15,

            // Increased detune from 28.0 to 125.0 cents for warped stability
            detuneShiftCents: (lane(1, 0.52) * 0.5 + geoLane * 0.5) * depth * 125.0,

            // Increased resonator shift from 0.28 to 0.55
            resonatorShift: lane(2, 0.84) * depth * 0.55,

            panShift: (lane(3, 0.42) * 0.7 + geoLane * 0.3) * depth * 0.55,

            // Increased shimmer chance top end from 0.6 to 0.88
            shimmerChance: clamp(0.08 + Math.max(0, lane(0, 0.34)) * depth * 0.45, 0.04, 0.88),
            motionDepth: depth,
            rateHz,
        };
    }
}
