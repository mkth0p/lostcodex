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
    i: 0,
    ii: 2,
    iii: 4,
    III: 4,
    IV: 5,
    iv: 5,
    V: 7,
    v: 7,
    vi: 9,
    VI: 9,
    vii: 11,
    bVI: 8,
    bVII: 10,
    VII: 11,
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const KNOWN_CHORDS = new Set(['I', 'i', 'ii', 'iii', 'III', 'IV', 'iv', 'V', 'v', 'vi', 'VI', 'bVI', 'VII', 'bVII', 'vii']);
const DARK_BIOMES = new Set(['storm', 'volcanic', 'corrupted', 'abyssal', 'barren']);
const BRIGHT_COLOR_CHORDS = new Set(['IV', 'vi', 'VI', 'III', 'bVI', 'bVII', 'ii']);

const BIOME_COLOR_POOL = {
    ethereal: [{ symbol: 'vi', weight: 0.66 }, { symbol: 'IV', weight: 0.58 }, { symbol: 'ii', weight: 0.44 }],
    nebula: [{ symbol: 'vi', weight: 0.64 }, { symbol: 'iii', weight: 0.58 }, { symbol: 'ii', weight: 0.42 }],
    glacial: [{ symbol: 'IV', weight: 0.6 }, { symbol: 'ii', weight: 0.38 }, { symbol: 'vi', weight: 0.36 }],
    arctic: [{ symbol: 'IV', weight: 0.54 }, { symbol: 'ii', weight: 0.36 }, { symbol: 'vi', weight: 0.34 }],
    oceanic: [{ symbol: 'ii', weight: 0.58 }, { symbol: 'IV', weight: 0.5 }, { symbol: 'vi', weight: 0.46 }],
    crystalline: [{ symbol: 'ii', weight: 0.56 }, { symbol: 'V', weight: 0.52 }, { symbol: 'vi', weight: 0.44 }],
    fungal: [{ symbol: 'iii', weight: 0.68 }, { symbol: 'ii', weight: 0.54 }, { symbol: 'vi', weight: 0.42 }],
    volcanic: [{ symbol: 'V', weight: 0.72 }, { symbol: 'ii', weight: 0.5 }, { symbol: 'iii', weight: 0.36 }],
    storm: [{ symbol: 'ii', weight: 0.68 }, { symbol: 'V', weight: 0.64 }, { symbol: 'iii', weight: 0.48 }],
    corrupted: [{ symbol: 'iii', weight: 0.76 }, { symbol: 'ii', weight: 0.6 }, { symbol: 'V', weight: 0.48 }],
    quantum: [{ symbol: 'iii', weight: 0.74 }, { symbol: 'vi', weight: 0.6 }, { symbol: 'bVI', weight: 0.6 }],
    abyssal: [{ symbol: 'vi', weight: 0.74 }, { symbol: 'iii', weight: 0.66 }, { symbol: 'ii', weight: 0.44 }],
    default: [{ symbol: 'ii', weight: 0.56 }, { symbol: 'IV', weight: 0.52 }, { symbol: 'vi', weight: 0.44 }],
};

const BIOME_PATHS = {
    storm: ['I', 'ii', 'V', 'iii'],
    crystalline: ['I', 'ii', 'V', 'vi'],
    fungal: ['i', 'iii', 'ii', 'V'],
    quantum: ['I', 'bVI', 'iii', 'V'],
    corrupted: ['i', 'iii', 'bVII', 'V'],
    abyssal: ['i', 'vi', 'IV', 'ii'],
    volcanic: ['I', 'V', 'ii', 'V'],
    ethereal: ['I', 'vi', 'IV', 'ii'],
    default: ['I', 'IV', 'V', 'I'],
};

function normalizeChord(symbol = 'I') {
    const cleaned = String(symbol).trim().replace(/[^A-Za-z0-9#b]/g, '');
    if (!cleaned) return 'I';
    if (KNOWN_CHORDS.has(cleaned)) return cleaned;
    if (cleaned.toLowerCase() === 'viio') return 'vii';
    return cleaned;
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
        this.richnessProfile = planet?.v2?.richnessProfile || { tier: 'balanced', harmonicity: 0.5, brightness: 0.5, density: 0.5 };
        this.fxProfile = planet?.v2?.fxProfile || { organic: 0.4, harmonic: 0.4, synthetic: 0.4, contrast: 0.4 };
        this.isDarkBiome = DARK_BIOMES.has(this.biomeId);
        this.progression = Array.isArray(planet?.progression) && planet.progression.length
            ? planet.progression.map((symbol) => normalizeChord(symbol))
            : ['I', 'IV', 'V', 'I'];
        this.colorPool = BIOME_COLOR_POOL[this.biomeId] || BIOME_COLOR_POOL.default;
        this.path = BIOME_PATHS[this.biomeId] || BIOME_PATHS.default;
        this.lastSymbol = this.progression[0];
        this.repeatCount = 0;
        this.rootHistory = [];
        this.phraseSpanBars = this.richnessProfile.tier === 'sparse'
            ? 6
            : this.richnessProfile.tier === 'lush'
                ? 4
                : 5;
    }

    next({ barIndex = 0, section = 'INTRO', dissonance = 0.2, stability = 0.5, cadenceStrength = 0.5 } = {}) {
        const rng = new RNG(this.seed + barIndex * 131);
        const loopIndex = barIndex % this.progression.length;
        const pathIndex = barIndex % this.path.length;
        const baseSymbol = this.progression[loopIndex];
        const pathSymbol = this.path[pathIndex] || baseSymbol;
        const prevSymbol = this.progression[(loopIndex - 1 + this.progression.length) % this.progression.length];
        const nextSymbol = this.progression[(loopIndex + 1) % this.progression.length];
        const instability = clamp((1 - stability) * 0.56 + dissonance * 0.46, 0, 1);
        const cadenceBias = clamp(cadenceStrength, 0, 1);
        const turnAround = loopIndex === this.progression.length - 1;
        const downbeat = loopIndex === 0;
        const phraseAnchor = (barIndex % this.phraseSpanBars) === 0;
        const contrast = clamp(this.fxProfile.contrast ?? 0.4, 0, 1);
        const contrastAllowed = this.isDarkBiome && (section === 'GROWTH' || section === 'AFTERGLOW');
        const contrastCycle = clamp(Math.round(10 - contrast * 5), 4, 12);
        const contrastLen = clamp(Math.round(1 + contrast * 2), 1, 3);
        const cycleIdx = Math.floor(barIndex / contrastCycle);
        const contrastRng = new RNG(this.seed + 55531 + cycleIdx * 337 + section.length * 17);
        const contrastStart = contrastRng.int(0, Math.max(1, contrastCycle - contrastLen + 1));
        const cyclePos = barIndex % contrastCycle;
        const brightWindowActive = contrastAllowed && cyclePos >= contrastStart && cyclePos < (contrastStart + contrastLen);
        const candidates = new Map();

        addWeight(candidates, baseSymbol, 1.74);
        addWeight(candidates, pathSymbol, 0.84);
        addWeight(candidates, prevSymbol, 0.44);
        addWeight(candidates, nextSymbol, 0.4);
        if (phraseAnchor) addWeight(candidates, pathSymbol, 0.7);

        if (section === 'SURGE') {
            addWeight(candidates, 'V', 0.82);
            addWeight(candidates, 'ii', 0.68);
            if (instability > 0.46) addWeight(candidates, 'iii', 0.46);
        } else if (section === 'RELEASE') {
            addWeight(candidates, 'I', 0.82);
            addWeight(candidates, 'IV', 0.68);
            addWeight(candidates, 'vi', 0.42);
        } else if (section === 'AFTERGLOW') {
            addWeight(candidates, 'I', 0.78);
            addWeight(candidates, 'vi', 0.7);
            if (rng.bool(0.3 + cadenceBias * 0.24)) addWeight(candidates, 'IV', 0.54);
        } else if (section === 'GROWTH') {
            addWeight(candidates, 'IV', 0.58);
            addWeight(candidates, 'ii', 0.48);
            addWeight(candidates, 'vi', 0.42);
        }

        const colorLift = clamp(0.1 + instability * 0.38 + this.moonDensity * 0.16, 0.1, 0.72);
        this.colorPool.forEach((entry) => addWeight(candidates, entry.symbol, entry.weight * colorLift));
        if (brightWindowActive) {
            addWeight(candidates, 'IV', 0.42 + contrast * 0.18);
            addWeight(candidates, 'vi', 0.32 + contrast * 0.18);
            addWeight(candidates, 'ii', 0.26 + contrast * 0.16);
        }

        if (instability > 0.56 && rng.bool(instability * 0.5)) {
            addWeight(candidates, SECONDARY_DOMINANTS[baseSymbol] || baseSymbol, 0.52 + instability * 0.32);
            if (instability > 0.76) {
                const daringPool = ['bVI', 'bVII', 'III', 'iv', 'v'];
                addWeight(candidates, rng.pick(daringPool), instability * 0.9);
            }
        }

        if (turnAround && cadenceBias > 0.4) {
            addWeight(candidates, 'V', 0.76);
            if (instability > 0.54) addWeight(candidates, 'ii', 0.42);
        }
        if (downbeat && cadenceBias > 0.26) {
            addWeight(candidates, 'I', 0.82);
        }
        if (this.lastSymbol === 'V' && cadenceBias > 0.34) {
            addWeight(candidates, 'I', 0.88);
        }
        if (this.lastSymbol === 'ii' && cadenceBias > 0.4) {
            addWeight(candidates, 'V', 0.62);
        }

        let symbol = baseSymbol;
        let bestScore = -Infinity;
        candidates.forEach((weight, candidate) => {
            const stepDist = chordDistance(candidate, this.lastSymbol);
            const voiceLead = 1 - clamp(stepDist / 6, 0, 1);
            const tonicPull = candidate === 'I' ? cadenceBias * 0.46 + (downbeat ? 0.08 : 0) : 0;
            const dominantLift = candidate === 'V' ? (turnAround ? 0.2 : section === 'SURGE' ? 0.16 : 0.05) : 0;
            const colorWeight = ['ii', 'iii', 'vi', 'IV', 'bVI', 'bVII'].includes(candidate) ? instability * 0.18 : 0;
            const sectionLift = section === 'AFTERGLOW' && candidate === 'vi'
                ? 0.12
                : section === 'RELEASE' && ['I', 'IV'].includes(candidate)
                    ? 0.11
                    : 0;
            const resolution = this.lastSymbol === 'V' && candidate === 'I' ? 0.2 : 0;
            const repetitionPenalty = candidate === this.lastSymbol ? 0.14 + this.repeatCount * 0.08 : 0;
            const jumpPenalty = section !== 'SURGE' ? clamp((stepDist - 4) * 0.08, 0, 0.32) : 0;
            const whiplashPenalty = this.rootHistory.length >= 2
                ? clamp(Math.abs((this.rootHistory[this.rootHistory.length - 1] || 0) - (this.rootHistory[this.rootHistory.length - 2] || 0)) / 12, 0, 1)
                    * clamp(stepDist / 7, 0, 1)
                    * (section === 'SURGE' ? 0.04 : 0.14)
                : 0;
            const darkPenalty = this.isDarkBiome && !brightWindowActive && BRIGHT_COLOR_CHORDS.has(candidate)
                ? 0.16 + (1 - (this.richnessProfile?.brightness ?? 0.5)) * 0.08
                : 0;
            const anchorLift = phraseAnchor && (candidate === pathSymbol || candidate === baseSymbol || candidate === 'I') ? 0.12 : 0;
            const score = weight * 0.6
                + voiceLead * 0.3
                + tonicPull
                + dominantLift
                + colorWeight
                + sectionLift
                + resolution
                + anchorLift
                - repetitionPenalty
                - jumpPenalty
                - whiplashPenalty
                - darkPenalty
                + rng.range(-0.05, 0.05);
            if (score > bestScore) {
                bestScore = score;
                symbol = candidate;
            }
        });

        const changed = symbol !== this.lastSymbol;
        this.repeatCount = changed ? 0 : this.repeatCount + 1;

        let holdBars = section === 'SURGE' ? 1 : 2;
        if (section === 'INTRO' || section === 'AFTERGLOW') holdBars += 1;
        if (stability > 0.66 && this.moonDensity > 0.45 && section !== 'SURGE') holdBars += 1;
        if (instability > 0.7 || turnAround) holdBars = Math.max(1, holdBars - 1);
        if (this.richnessProfile.tier === 'sparse' && section !== 'SURGE') holdBars += 1;
        if (this.richnessProfile.tier === 'lush' && section !== 'AFTERGLOW') holdBars -= 0.2;
        if (phraseAnchor && section !== 'SURGE') holdBars += 1;
        if (brightWindowActive && section !== 'SURGE') holdBars = Math.max(1, holdBars - 0.3);
        if (this.repeatCount > 1) holdBars = 1;
        holdBars = Math.round(clamp(holdBars + rng.range(-0.4, 0.4), 1, 6));

        this.lastSymbol = symbol;
        this.rootHistory.push(CHORD_ROOT[symbol] ?? 0);
        if (this.rootHistory.length > 8) this.rootHistory.shift();
        return {
            symbol,
            changed,
            holdBars,
            phraseAnchor,
            brightWindowActive,
            colorBias: brightWindowActive ? 1 : 0,
        };
    }
}
