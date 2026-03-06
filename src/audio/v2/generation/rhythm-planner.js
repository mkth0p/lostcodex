import { RNG } from '../../../rng.js';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const RHYTHM_STYLE = {
    default: { density: 0.44, velocity: 0.68, fill: 0.55, ghost: 0.5, maxVoices: 3 },
    ethereal: { density: 0.18, velocity: 0.45, fill: 0.2, ghost: 0.25, maxVoices: 1 },
    nebula: { density: 0.14, velocity: 0.42, fill: 0.16, ghost: 0.2, maxVoices: 1 },
    glacial: { density: 0.1, velocity: 0.4, fill: 0.12, ghost: 0.15, maxVoices: 1 },
    arctic: { density: 0.12, velocity: 0.42, fill: 0.14, ghost: 0.18, maxVoices: 1 },
    barren: { density: 0.08, velocity: 0.38, fill: 0.1, ghost: 0.12, maxVoices: 1 },
    crystalline: { density: 0.22, velocity: 0.52, fill: 0.24, ghost: 0.24, maxVoices: 2 },
    oceanic: { density: 0.26, velocity: 0.56, fill: 0.28, ghost: 0.28, maxVoices: 2 },
    abyssal: { density: 0.2, velocity: 0.62, fill: 0.22, ghost: 0.2, maxVoices: 2 },
    desert: { density: 0.3, velocity: 0.62, fill: 0.38, ghost: 0.34, maxVoices: 2 },
    organic: { density: 0.42, velocity: 0.68, fill: 0.5, ghost: 0.46, maxVoices: 3 },
    fungal: { density: 0.56, velocity: 0.72, fill: 0.62, ghost: 0.58, maxVoices: 4 },
    storm: { density: 0.5, velocity: 0.68, fill: 0.52, ghost: 0.44, maxVoices: 3 },
    corrupted: { density: 0.46, velocity: 0.66, fill: 0.5, ghost: 0.46, maxVoices: 3 },
    quantum: { density: 0.44, velocity: 0.64, fill: 0.48, ghost: 0.42, maxVoices: 3 },
    volcanic: { density: 0.6, velocity: 0.76, fill: 0.58, ghost: 0.52, maxVoices: 3 },
    psychedelic: { density: 0.5, velocity: 0.72, fill: 0.54, ghost: 0.5, maxVoices: 3 },
    crystalloid: { density: 0.46, velocity: 0.68, fill: 0.5, ghost: 0.44, maxVoices: 3 },
};

const EVENT_PRIORITY = {
    kick: 0,
    snare: 1,
    tom: 2,
    hat: 3,
    shaker: 4,
    clack: 5,
    ghost: 6,
};

export class RhythmPlanner {
    constructor(planet) {
        this.seed = (planet?.seed || 1) + 116503;
        this.stepCount = Math.max(4, planet?.ac?.stepCount || 16);
        this.polymeterLanes = [this.stepCount, Math.max(3, this.stepCount - 3), Math.max(5, this.stepCount + 2)];
        this.biomeId = planet?.biome?.id || 'default';
        this.style = RHYTHM_STYLE[this.biomeId] || RHYTHM_STYLE.default;
        this.melodyDensity = clamp(planet?.melodyDensity || 0.08, 0.01, 0.35);
        this.chordAudibility = clamp(planet?.ac?.chordAudibility || 0.3, 0, 1);
        this.baseDensityMul = clamp(this.style.density * (0.55 + this.melodyDensity * 2.1), 0.06, 1.2);
        this.baseVelocityMul = clamp(this.style.velocity * (0.7 + this.chordAudibility * 0.55), 0.28, 1);
    }

    planStep({
        stepIndex = 0,
        barIndex = 0,
        section = 'INTRO',
        energy = 0.3,
        complexity = 0.5,
        motion = 0.5,
        dissonance = 0.35,
        fillsEnabled = true,
        ghostEnabled = true,
        densityMul = 1,
    } = {}) {
        const rng = new RNG(this.seed + barIndex * 409 + stepIndex * 37);
        const events = [];
        const main = stepIndex % this.stepCount;
        const off = main % 2 === 1;
        const backbeat = main % Math.max(2, Math.floor(this.stepCount / 4)) === 0;
        const surgeBias = section === 'SURGE' ? 0.95 : section === 'RELEASE' ? 0.72 : section === 'AFTERGLOW' ? 0.62 : 0.88;
        const sectionEnergy = section === 'AFTERGLOW' ? energy * 0.6 : energy;
        const density = clamp((0.16 + complexity * 0.22 + motion * 0.09) * densityMul * surgeBias * this.baseDensityMul, 0.03, 0.86);

        const kickChance = clamp(((off ? 0.05 : 0.24) + sectionEnergy * 0.14 + complexity * 0.06) * density, 0.01, 0.7);
        const snareChance = clamp(((backbeat ? 0.38 : 0.06) + complexity * 0.08) * density, 0.01, 0.64);
        const hatChance = clamp((0.14 + density * 0.22 + dissonance * 0.03), 0.01, 0.65);
        const shakerChance = clamp((0.06 + motion * 0.14 + complexity * 0.06) * density, 0.01, 0.48);

        if (rng.bool(kickChance)) events.push({ voice: 'kick', velocity: clamp((0.26 + sectionEnergy * 0.2) * this.baseVelocityMul, 0.08, 0.72), microShiftMs: rng.range(-3, 2) });
        if (rng.bool(snareChance)) events.push({ voice: 'snare', velocity: clamp((0.2 + complexity * 0.16) * this.baseVelocityMul, 0.07, 0.62), microShiftMs: rng.range(-2, 3) });
        if (rng.bool(hatChance)) events.push({ voice: 'hat', velocity: clamp((0.08 + density * 0.13) * this.baseVelocityMul, 0.03, 0.34), microShiftMs: rng.range(-2, 2), open: rng.bool((0.03 + complexity * 0.08) * density) });
        if (rng.bool(shakerChance)) events.push({ voice: 'shaker', velocity: clamp((0.05 + motion * 0.12) * this.baseVelocityMul, 0.025, 0.28), microShiftMs: rng.range(-2, 2) });

        if (ghostEnabled && rng.bool(clamp((0.03 + complexity * 0.08) * this.style.ghost * density, 0.01, 0.22))) {
            events.push({ voice: 'ghost', velocity: clamp(0.03 + complexity * 0.05, 0.02, 0.1), microShiftMs: rng.range(-5, 6) });
        }

        const turnAround = main >= this.stepCount - 2;
        if (fillsEnabled && turnAround && rng.bool(clamp((0.05 + complexity * 0.18 + sectionEnergy * 0.12) * this.style.fill * densityMul, 0.01, 0.54))) {
            const laneLen = rng.pick(this.polymeterLanes);
            const laneStep = stepIndex % laneLen;
            if (laneStep % 2 === 0) {
                events.push({ voice: 'tom', velocity: clamp((0.14 + sectionEnergy * 0.12 + complexity * 0.1) * this.baseVelocityMul, 0.06, 0.54), microShiftMs: rng.range(-3, 3) });
            }
            if (rng.bool(clamp((0.18 + dissonance * 0.16) * density, 0.02, 0.48))) {
                events.push({ voice: 'clack', velocity: clamp((0.09 + dissonance * 0.12) * this.baseVelocityMul, 0.05, 0.36), microShiftMs: rng.range(-2, 2) });
            }
        }

        if (events.length > this.style.maxVoices) {
            events.sort((a, b) => (EVENT_PRIORITY[a.voice] || 99) - (EVENT_PRIORITY[b.voice] || 99));
            return events.slice(0, this.style.maxVoices);
        }

        return events;
    }
}
