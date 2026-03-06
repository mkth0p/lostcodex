import { RNG } from '../../../rng.js';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const RHYTHM_STYLE = {
    default: { density: 0.52, velocity: 0.72, fill: 0.56, ghost: 0.5, maxVoices: 3 },
    ethereal: { density: 0.2, velocity: 0.48, fill: 0.2, ghost: 0.24, maxVoices: 1 },
    nebula: { density: 0.18, velocity: 0.46, fill: 0.18, ghost: 0.2, maxVoices: 1 },
    glacial: { density: 0.14, velocity: 0.44, fill: 0.14, ghost: 0.16, maxVoices: 1 },
    arctic: { density: 0.16, velocity: 0.46, fill: 0.16, ghost: 0.2, maxVoices: 1 },
    barren: { density: 0.1, velocity: 0.4, fill: 0.1, ghost: 0.14, maxVoices: 1 },
    crystalline: { density: 0.3, velocity: 0.58, fill: 0.3, ghost: 0.28, maxVoices: 2 },
    oceanic: { density: 0.32, velocity: 0.6, fill: 0.3, ghost: 0.3, maxVoices: 2 },
    abyssal: { density: 0.26, velocity: 0.64, fill: 0.26, ghost: 0.22, maxVoices: 2 },
    desert: { density: 0.36, velocity: 0.66, fill: 0.4, ghost: 0.34, maxVoices: 2 },
    organic: { density: 0.5, velocity: 0.72, fill: 0.56, ghost: 0.5, maxVoices: 3 },
    fungal: { density: 0.64, velocity: 0.76, fill: 0.66, ghost: 0.6, maxVoices: 4 },
    storm: { density: 0.62, velocity: 0.74, fill: 0.56, ghost: 0.46, maxVoices: 4 },
    corrupted: { density: 0.58, velocity: 0.72, fill: 0.54, ghost: 0.48, maxVoices: 4 },
    quantum: { density: 0.56, velocity: 0.7, fill: 0.52, ghost: 0.44, maxVoices: 4 },
    volcanic: { density: 0.66, velocity: 0.8, fill: 0.62, ghost: 0.54, maxVoices: 4 },
    psychedelic: { density: 0.58, velocity: 0.76, fill: 0.58, ghost: 0.52, maxVoices: 4 },
    crystalloid: { density: 0.56, velocity: 0.72, fill: 0.54, ghost: 0.46, maxVoices: 4 },
};

const RHYTHM_PATTERN_BANK = {
    default: {
        kick: [[2, 0, 0, 0, 1, 0, 0, 0, 2, 0, 0, 0, 1, 0, 0, 0]],
        snare: [[0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0]],
        hat: [[1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0]],
        shaker: [[0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0]],
        poly: [[0, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1]],
    },
    crystalline: {
        kick: [[2, 0, 0, 0, 0, 0, 1, 0, 2, 0, 0, 0, 0, 0, 1, 0]],
        snare: [[0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0]],
        hat: [[2, 0, 1, 0, 1, 0, 2, 0, 1, 0, 1, 0, 2, 0, 1, 0]],
        shaker: [[0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0]],
        poly: [[0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1]],
    },
    crystalloid: {
        kick: [[2, 0, 1, 0, 0, 1, 2, 0, 1, 0, 0, 1, 2, 0, 1, 0]],
        snare: [[0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1]],
        hat: [[2, 1, 1, 0, 1, 1, 2, 1, 1, 0, 1, 1, 2, 1, 1, 0]],
        shaker: [[0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1]],
        poly: [[0, 1, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0]],
    },
    storm: {
        kick: [[2, 0, 1, 0, 2, 0, 1, 0, 2, 0, 1, 0, 2, 1, 0, 1]],
        snare: [[0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0, 1]],
        hat: [[2, 1, 1, 1, 2, 1, 1, 1, 2, 1, 1, 1, 2, 1, 1, 1]],
        shaker: [[0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1]],
        poly: [[1, 0, 1, 0, 1, 0, 1, 0, 0, 1, 0, 1, 0]],
    },
    volcanic: {
        kick: [[2, 0, 0, 1, 2, 0, 0, 1, 2, 0, 1, 0, 2, 0, 0, 1]],
        snare: [[0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0]],
        hat: [[1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0]],
        shaker: [[0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0]],
        poly: [[0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0]],
    },
    fungal: {
        kick: [[2, 0, 0, 0, 0, 0, 2, 0, 0, 1, 0, 0], [2, 0, 0, 0, 0, 1, 2, 0, 0, 1, 0, 0]],
        snare: [[0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0], [0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0]],
        hat: [[2, 0, 1, 1, 0, 1, 2, 0, 1, 1, 0, 1], [2, 0, 1, 1, 0, 0, 2, 0, 1, 1, 0, 1]],
        shaker: [[0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1]],
        poly: [[0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0]],
    },
    organic: {
        kick: [[2, 0, 0, 0, 1, 0, 2, 0, 0, 1, 0, 0, 2, 0, 0, 1]],
        snare: [[0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0]],
        hat: [[1, 0, 1, 1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1, 1, 0]],
        shaker: [[0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0]],
        poly: [[0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0]],
    },
    oceanic: {
        kick: [[2, 0, 0, 0, 1, 0, 0, 1, 2, 0, 0, 0, 1, 0, 0, 1]],
        snare: [[0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0]],
        hat: [[1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0]],
        shaker: [[0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0]],
        poly: [[0, 0, 1, 0, 1, 0, 0, 1, 0, 1, 0]],
    },
    quantum: {
        kick: [[2, 0, 1, 0, 0, 1, 2, 0, 1, 0, 0, 1, 2, 0, 1, 0]],
        snare: [[0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1]],
        hat: [[2, 1, 1, 0, 2, 1, 1, 0, 2, 1, 1, 0, 2, 1, 1, 0]],
        shaker: [[0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1]],
        poly: [[1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 1, 0, 0]],
    },
    corrupted: {
        kick: [[2, 0, 1, 0, 2, 0, 0, 1, 2, 0, 1, 0, 2, 0, 0, 1]],
        snare: [[0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0, 1]],
        hat: [[2, 1, 1, 0, 2, 1, 1, 0, 2, 1, 1, 0, 2, 1, 1, 0]],
        shaker: [[0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0]],
        poly: [[0, 1, 0, 1, 0, 1, 0, 0, 1, 0, 1, 0]],
    },
    desert: {
        kick: [[2, 0, 0, 0, 1, 0, 0, 0, 2, 0, 0, 1, 0, 0, 0, 0]],
        snare: [[0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0]],
        hat: [[1, 0, 1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0]],
        shaker: [[0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0]],
        poly: [[0, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0]],
    },
    ethereal: {
        kick: [[2, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0]],
        snare: [[0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0]],
        hat: [[1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0]],
        shaker: [[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]],
        poly: [[0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0]],
    },
    nebula: {
        kick: [[2, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0]],
        snare: [[0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0]],
        hat: [[1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0]],
        shaker: [[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]],
        poly: [[0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]],
    },
    glacial: {
        kick: [[2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]],
        snare: [[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0]],
        hat: [[1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0]],
        shaker: [[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]],
        poly: [[0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0]],
    },
    arctic: {
        kick: [[2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0]],
        snare: [[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0]],
        hat: [[1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0]],
        shaker: [[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]],
        poly: [[0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0]],
    },
    barren: {
        kick: [[2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0]],
        snare: [[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0]],
        hat: [[1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0]],
        shaker: [[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]],
        poly: [[0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0]],
    },
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

function normalizePattern(pattern = []) {
    if (!Array.isArray(pattern) || !pattern.length) return [];
    return pattern.map((value) => {
        if (value >= 2) return 2;
        if (value >= 1) return 1;
        return 0;
    });
}

function pickPattern(patterns = [], seed = 1, fallback = [1, 0, 0, 0]) {
    const options = Array.isArray(patterns) && patterns.length ? patterns : [fallback];
    const rng = new RNG(seed >>> 0);
    return normalizePattern(rng.pick(options) || fallback);
}

function getPatternCell(pattern = [], stepIndex = 0, stepCount = 16) {
    if (!pattern.length) return 0;
    const safeStepCount = Math.max(1, stepCount);
    const position = (stepIndex % safeStepCount) / safeStepCount;
    const idx = Math.floor(position * pattern.length) % pattern.length;
    return pattern[idx] || 0;
}

export class RhythmPlanner {
    constructor(planet) {
        this.seed = (planet?.seed || 1) + 116503;
        this.stepCount = Math.max(4, planet?.ac?.stepCount || 16);
        this.biomeId = planet?.biome?.id || 'default';
        this.style = RHYTHM_STYLE[this.biomeId] || RHYTHM_STYLE.default;
        this.melodyDensity = clamp(planet?.melodyDensity || 0.08, 0.01, 0.35);
        this.chordAudibility = clamp(planet?.ac?.chordAudibility || 0.3, 0, 1);
        this.baseDensityMul = clamp(this.style.density * (0.62 + this.melodyDensity * 1.95), 0.08, 1.35);
        this.baseVelocityMul = clamp(this.style.velocity * (0.72 + this.chordAudibility * 0.58), 0.3, 1.05);

        const bank = RHYTHM_PATTERN_BANK[this.biomeId] || RHYTHM_PATTERN_BANK.default;
        this.patterns = {
            kick: pickPattern(bank.kick, this.seed + 11, [2, 0, 0, 0, 1, 0, 0, 0, 2, 0, 0, 0, 1, 0, 0, 0]),
            snare: pickPattern(bank.snare, this.seed + 23, [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0]),
            hat: pickPattern(bank.hat, this.seed + 37, [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0]),
            shaker: pickPattern(bank.shaker, this.seed + 51, [0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0]),
            poly: pickPattern(bank.poly, this.seed + 67, [0, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0]),
        };
        this.polyCycle = Math.max(5, this.patterns.poly.length || this.stepCount - 3);
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
        const turnAround = main >= this.stepCount - 2;
        const surgeBias = section === 'SURGE' ? 1 : section === 'RELEASE' ? 0.76 : section === 'AFTERGLOW' ? 0.64 : 0.9;
        const sectionEnergy = section === 'AFTERGLOW' ? energy * 0.64 : energy;
        const density = clamp(
            (0.2 + complexity * 0.25 + motion * 0.1) * densityMul * surgeBias * this.baseDensityMul,
            0.04,
            0.98,
        );

        const kickCell = getPatternCell(this.patterns.kick, main, this.stepCount);
        const snareCell = getPatternCell(this.patterns.snare, main, this.stepCount);
        const hatCell = getPatternCell(this.patterns.hat, main, this.stepCount);
        const shakerCell = getPatternCell(this.patterns.shaker, main, this.stepCount);
        const polyCell = getPatternCell(this.patterns.poly, stepIndex, this.polyCycle);

        const kickChance = clamp((0.36 + sectionEnergy * 0.16 + complexity * 0.08) * density * (kickCell >= 2 ? 1.18 : 0.9), 0.02, 0.98);
        const snareChance = clamp((0.32 + complexity * 0.1 + (section === 'SURGE' ? 0.06 : 0)) * density * (snareCell >= 1 ? 1.12 : 0.4), 0.02, 0.95);
        const hatChance = clamp((0.22 + density * 0.32 + dissonance * 0.06) * (hatCell >= 1 ? 1.08 : 0.34), 0.02, 0.98);
        const shakerChance = clamp((0.16 + motion * 0.2 + complexity * 0.08) * density * (shakerCell >= 1 ? 1.06 : 0.38), 0.02, 0.9);

        if (kickCell > 0 && rng.bool(kickChance)) {
            events.push({
                voice: 'kick',
                velocity: clamp((0.28 + sectionEnergy * 0.22 + (kickCell >= 2 ? 0.08 : 0)) * this.baseVelocityMul, 0.08, 0.82),
                microShiftMs: rng.range(-4, 2),
            });
        } else if (!off && rng.bool(clamp(0.05 + density * 0.12, 0.02, 0.32))) {
            events.push({
                voice: 'kick',
                velocity: clamp((0.12 + sectionEnergy * 0.08) * this.baseVelocityMul, 0.05, 0.42),
                microShiftMs: rng.range(-3, 2),
            });
        }

        if (snareCell > 0 && rng.bool(snareChance)) {
            events.push({
                voice: 'snare',
                velocity: clamp((0.22 + complexity * 0.18 + (snareCell >= 2 ? 0.05 : 0)) * this.baseVelocityMul, 0.07, 0.68),
                microShiftMs: rng.range(-2, 3),
            });
        }

        if (hatCell > 0 && rng.bool(hatChance)) {
            events.push({
                voice: 'hat',
                velocity: clamp((0.09 + density * 0.16 + (hatCell >= 2 ? 0.04 : 0)) * this.baseVelocityMul, 0.03, 0.42),
                microShiftMs: rng.range(-2, 2),
                open: hatCell >= 2 || rng.bool((0.04 + complexity * 0.1) * density),
            });
        }

        if (shakerCell > 0 && rng.bool(shakerChance)) {
            events.push({
                voice: 'shaker',
                velocity: clamp((0.06 + motion * 0.14) * this.baseVelocityMul, 0.025, 0.3),
                microShiftMs: rng.range(-2, 2),
            });
        }

        if (polyCell > 0 && rng.bool(clamp((0.08 + complexity * 0.16 + dissonance * 0.12) * density, 0.02, 0.54))) {
            events.push({
                voice: rng.bool(0.56) ? 'clack' : 'tom',
                velocity: clamp((0.1 + complexity * 0.12 + (polyCell >= 2 ? 0.05 : 0)) * this.baseVelocityMul, 0.045, 0.52),
                microShiftMs: rng.range(-3, 3),
            });
        }

        if (ghostEnabled && rng.bool(clamp((0.04 + complexity * 0.1) * this.style.ghost * density, 0.01, 0.28))) {
            events.push({
                voice: 'ghost',
                velocity: clamp(0.03 + complexity * 0.06, 0.02, 0.12),
                microShiftMs: rng.range(-6, 6),
            });
        }

        if (fillsEnabled && turnAround && rng.bool(clamp((0.08 + complexity * 0.2 + sectionEnergy * 0.12) * this.style.fill * densityMul, 0.02, 0.72))) {
            events.push({
                voice: 'tom',
                velocity: clamp((0.16 + sectionEnergy * 0.14 + complexity * 0.12) * this.baseVelocityMul, 0.06, 0.58),
                microShiftMs: rng.range(-3, 3),
            });
            if (rng.bool(clamp((0.22 + dissonance * 0.2) * density, 0.04, 0.7))) {
                events.push({
                    voice: 'clack',
                    velocity: clamp((0.12 + dissonance * 0.14) * this.baseVelocityMul, 0.05, 0.4),
                    microShiftMs: rng.range(-2, 2),
                });
            }
        }

        if (events.length > this.style.maxVoices) {
            events.sort((a, b) => (EVENT_PRIORITY[a.voice] || 99) - (EVENT_PRIORITY[b.voice] || 99));
            return events.slice(0, this.style.maxVoices);
        }

        return events;
    }
}
