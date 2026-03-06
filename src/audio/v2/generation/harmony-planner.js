import { RNG } from '../../../rng.js';

const SECONDARY_DOMINANTS = {
    ii: 'V',
    iii: 'V',
    IV: 'I',
    V: 'ii',
    vi: 'V',
};

const CHORD_ROOT = {
    I: 0,
    ii: 2,
    iii: 4,
    IV: 5,
    V: 7,
    vi: 9,
    vii: 11,
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const KNOWN_CHORDS = new Set(['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii']);

const BIOME_COLOR_POOL = {
    ethereal: [{ symbol: 'vi', weight: 0.64 }, { symbol: 'IV', weight: 0.56 }, { symbol: 'ii', weight: 0.42 }],
    nebula: [{ symbol: 'vi', weight: 0.62 }, { symbol: 'iii', weight: 0.58 }, { symbol: 'ii', weight: 0.4 }],
    glacial: [{ symbol: 'IV', weight: 0.58 }, { symbol: 'ii', weight: 0.36 }, { symbol: 'vi', weight: 0.34 }],
    arctic: [{ symbol: 'IV', weight: 0.52 }, { symbol: 'ii', weight: 0.34 }, { symbol: 'vi', weight: 0.32 }],
    oceanic: [{ symbol: 'ii', weight: 0.56 }, { symbol: 'IV', weight: 0.48 }, { symbol: 'vi', weight: 0.44 }],
    crystalline: [{ symbol: 'ii', weight: 0.54 }, { symbol: 'V', weight: 0.5 }, { symbol: 'vi', weight: 0.42 }],
    fungal: [{ symbol: 'iii', weight: 0.66 }, { symbol: 'ii', weight: 0.52 }, { symbol: 'vi', weight: 0.4 }],
    volcanic: [{ symbol: 'V', weight: 0.68 }, { symbol: 'ii', weight: 0.48 }, { symbol: 'iii', weight: 0.34 }],
    storm: [{ symbol: 'ii', weight: 0.66 }, { symbol: 'V', weight: 0.62 }, { symbol: 'iii', weight: 0.46 }],
    corrupted: [{ symbol: 'iii', weight: 0.72 }, { symbol: 'ii', weight: 0.58 }, { symbol: 'V', weight: 0.46 }],
    quantum: [{ symbol: 'iii', weight: 0.7 }, { symbol: 'vi', weight: 0.58 }, { symbol: 'ii', weight: 0.56 }],
    abyssal: [{ symbol: 'vi', weight: 0.72 }, { symbol: 'iii', weight: 0.64 }, { symbol: 'ii', weight: 0.42 }],
    default: [{ symbol: 'ii', weight: 0.54 }, { symbol: 'IV', weight: 0.5 }, { symbol: 'vi', weight: 0.42 }],
};

function normalizeChord(symbol = 'I') {
    const cleaned = String(symbol).trim().replace(/[^ivIV]/g, '');
    return cleaned || 'I';
}

function chordDistance(a = 'I', b = 'I') {
    const ra = CHORD_ROOT[a] ?? 0;
    const rb = CHORD_ROOT[b] ?? 0;
    const diff = Math.abs(ra - rb);
    return Math.min(diff, 12 - diff);
}

function addWeight(map, symbol, weight) {
    const normalized = normalizeChord(symbol);
    if (!KNOWN_CHORDS.has(normalized)) return;
    if (!Number.isFinite(weight) || weight <= 0) return;
    map.set(normalized, (map.get(normalized) || 0) + weight);
}

export class HarmonyPlanner {
    constructor(planet) {
        this.seed = (planet?.seed || 1) + 91003;
        this.biomeId = planet?.biome?.id || 'default';
        this.moonDensity = clamp(planet?.moonSystem?.density || 0.45, 0, 1);
        this.progression = Array.isArray(planet?.progression) && planet.progression.length
            ? planet.progression.map((symbol) => normalizeChord(symbol))
            : ['I', 'IV', 'V', 'I'];
        this.colorPool = BIOME_COLOR_POOL[this.biomeId] || BIOME_COLOR_POOL.default;
        this.lastSymbol = this.progression[0];
    }

    next({ barIndex = 0, section = 'INTRO', dissonance = 0.2, stability = 0.5, cadenceStrength = 0.5 } = {}) {
        const rng = new RNG(this.seed + barIndex * 131);
        const loopIndex = barIndex % this.progression.length;
        const baseSymbol = this.progression[loopIndex];
        const prevSymbol = this.progression[(loopIndex - 1 + this.progression.length) % this.progression.length];
        const nextSymbol = this.progression[(loopIndex + 1) % this.progression.length];
        const instability = clamp((1 - stability) * 0.58 + dissonance * 0.42, 0, 1);
        const cadenceBias = clamp(cadenceStrength, 0, 1);
        const turnAround = loopIndex === this.progression.length - 1;
        const downbeat = loopIndex === 0;
        const candidates = new Map();

        addWeight(candidates, baseSymbol, 1.9);
        addWeight(candidates, prevSymbol, 0.4);
        addWeight(candidates, nextSymbol, 0.36);

        if (section === 'SURGE') {
            addWeight(candidates, 'V', 0.72);
            addWeight(candidates, 'ii', 0.6);
            if (instability > 0.42) addWeight(candidates, 'iii', 0.42);
        } else if (section === 'RELEASE') {
            addWeight(candidates, 'I', 0.78);
            addWeight(candidates, 'IV', 0.62);
            addWeight(candidates, 'vi', 0.4);
        } else if (section === 'AFTERGLOW') {
            addWeight(candidates, 'I', 0.72);
            addWeight(candidates, 'vi', 0.64);
            if (rng.bool(0.3 + cadenceBias * 0.2)) addWeight(candidates, 'IV', 0.5);
        } else if (section === 'GROWTH') {
            addWeight(candidates, 'IV', 0.52);
            addWeight(candidates, 'ii', 0.44);
            addWeight(candidates, 'vi', 0.38);
        }

        const colorLift = clamp(0.08 + instability * 0.36 + this.moonDensity * 0.14, 0.08, 0.62);
        this.colorPool.forEach((entry) => addWeight(candidates, entry.symbol, entry.weight * colorLift));

        if (instability > 0.66 && rng.bool(instability * 0.32)) {
            addWeight(candidates, SECONDARY_DOMINANTS[baseSymbol] || baseSymbol, 0.48 + instability * 0.24);
        }

        if (turnAround && cadenceBias > 0.42) {
            addWeight(candidates, 'V', 0.72);
            if (instability > 0.55) addWeight(candidates, 'ii', 0.38);
        }
        if (downbeat && cadenceBias > 0.28) {
            addWeight(candidates, 'I', 0.76);
        }
        if (this.lastSymbol === 'V' && cadenceBias > 0.34) {
            addWeight(candidates, 'I', 0.84);
        }
        if (this.lastSymbol === 'ii' && cadenceBias > 0.4) {
            addWeight(candidates, 'V', 0.56);
        }

        let symbol = baseSymbol;
        let bestScore = -Infinity;
        candidates.forEach((weight, candidate) => {
            const stepDist = chordDistance(candidate, this.lastSymbol);
            const voiceLead = 1 - clamp(stepDist / 6, 0, 1);
            const tonicPull = candidate === 'I' ? cadenceBias * 0.44 + (downbeat ? 0.08 : 0) : 0;
            const dominantLift = candidate === 'V' ? (turnAround ? 0.18 : section === 'SURGE' ? 0.14 : 0.04) : 0;
            const colorWeight = ['ii', 'iii', 'vi', 'IV'].includes(candidate) ? instability * 0.16 : 0;
            const sectionLift = section === 'AFTERGLOW' && candidate === 'vi'
                ? 0.11
                : section === 'RELEASE' && ['I', 'IV'].includes(candidate)
                    ? 0.1
                    : 0;
            const resolution = this.lastSymbol === 'V' && candidate === 'I' ? 0.18 : 0;
            const repetitionPenalty = candidate === this.lastSymbol ? 0.12 : 0;
            const score = weight * 0.62
                + voiceLead * 0.28
                + tonicPull
                + dominantLift
                + colorWeight
                + sectionLift
                + resolution
                - repetitionPenalty
                + rng.range(-0.05, 0.05);
            if (score > bestScore) {
                bestScore = score;
                symbol = candidate;
            }
        });

        const changed = symbol !== this.lastSymbol;
        let holdBars = section === 'SURGE' ? 1 : 2;
        if (section === 'INTRO' || section === 'AFTERGLOW') holdBars += 1;
        if (stability > 0.66 && this.moonDensity > 0.45 && section !== 'SURGE') holdBars += 1;
        if (instability > 0.72 || turnAround) holdBars = Math.max(1, holdBars - 1);
        holdBars = Math.round(clamp(holdBars + rng.range(-0.35, 0.35), 1, 4));
        this.lastSymbol = symbol;
        return {
            symbol,
            changed,
            holdBars,
        };
    }
}
