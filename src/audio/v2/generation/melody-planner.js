import { RNG } from '../../../rng.js';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const SOFT_BIOMES = new Set(['ethereal', 'nebula', 'glacial', 'arctic', 'oceanic', 'barren', 'crystalline']);

const MELODY_STYLE = {
    default: { density: 0.56, leap: 0.5, velocity: 0.66, highOct: 0.36, micro: 0.42 },
    ethereal: { density: 0.4, leap: 0.24, velocity: 0.5, highOct: 0.68, micro: 0.64 },
    nebula: { density: 0.38, leap: 0.26, velocity: 0.52, highOct: 0.7, micro: 0.68 },
    glacial: { density: 0.3, leap: 0.22, velocity: 0.44, highOct: 0.74, micro: 0.54 },
    arctic: { density: 0.32, leap: 0.24, velocity: 0.46, highOct: 0.72, micro: 0.52 },
    barren: { density: 0.22, leap: 0.14, velocity: 0.36, highOct: 0.52, micro: 0.26 },
    oceanic: { density: 0.48, leap: 0.3, velocity: 0.56, highOct: 0.52, micro: 0.46 },
    crystalline: { density: 0.46, leap: 0.3, velocity: 0.56, highOct: 0.62, micro: 0.58 },
    storm: { density: 0.56, leap: 0.46, velocity: 0.68, highOct: 0.28, micro: 0.38 },
    corrupted: { density: 0.54, leap: 0.48, velocity: 0.66, highOct: 0.36, micro: 0.6 },
    quantum: { density: 0.52, leap: 0.5, velocity: 0.66, highOct: 0.5, micro: 0.8 },
    volcanic: { density: 0.46, leap: 0.4, velocity: 0.62, highOct: 0.18, micro: 0.32 },
    fungal: { density: 0.64, leap: 0.46, velocity: 0.68, highOct: 0.36, micro: 0.42 },
    abyssal: { density: 0.36, leap: 0.32, velocity: 0.56, highOct: 0.16, micro: 0.38 },
};

const BIOME_VOICE_HINTS = {
    ethereal: {
        ambient: ['vowel_morph', 'choir', 'drone_morph'],
        motif: ['vowel_morph', 'choir'],
        intense: ['wavetable_morph'],
    },
    nebula: {
        ambient: ['vowel_morph', 'wavetable_morph', 'drone_morph'],
        motif: ['wavetable_morph', 'vowel_morph'],
        intense: ['phase_cluster', 'wavetable_morph'],
    },
    glacial: {
        ambient: ['granular_cloud', 'crystal_chimes', 'drone_morph'],
        motif: ['crystal_chimes', 'granular_cloud'],
        intense: ['modal_resonator'],
    },
    storm: {
        ambient: ['wavetable_morph', 'drone_morph'],
        motif: ['modal_resonator', 'phase_cluster'],
        intense: ['phase_cluster', 'modal_resonator'],
    },
    corrupted: {
        ambient: ['phase_cluster', 'wavetable_morph', 'drone_morph'],
        motif: ['phase_cluster', 'modal_resonator'],
        intense: ['phase_cluster', 'modal_resonator'],
    },
    abyssal: {
        ambient: ['gong', 'subpad', 'drone_morph'],
        motif: ['modal_resonator', 'gong'],
        intense: ['modal_resonator', 'gong'],
    },
    fungal: {
        ambient: ['hollow_pipe', 'marimba', 'drone_morph'],
        motif: ['marimba', 'hollow_pipe'],
        intense: ['modal_resonator', 'wavetable_morph'],
    },
    crystalline: {
        ambient: ['crystal_chimes', 'wavetable_morph', 'drone_morph'],
        motif: ['crystal_chimes', 'modal_resonator'],
        intense: ['modal_resonator', 'phase_cluster'],
    },
    default: {
        ambient: ['wavetable_morph', 'vowel_morph', 'drone_morph'],
        motif: ['wavetable_morph', 'drone_morph'],
        intense: ['phase_cluster', 'modal_resonator'],
    },
};

const BIOME_MELODY_GATES = {
    default: [
        [2, 0, 1, 0, 1, 0, 1, 0, 2, 0, 1, 0, 1, 0, 1, 0],
        [2, 0, 1, 0, 0, 1, 1, 0, 2, 0, 1, 0, 0, 1, 1, 0],
    ],
    crystalline: [
        [2, 0, 1, 0, 1, 0, 2, 0, 1, 0, 1, 0, 2, 0, 1, 0],
        [2, 0, 0, 1, 1, 0, 2, 0, 1, 0, 0, 1, 2, 0, 1, 0],
    ],
    crystalloid: [
        [2, 0, 1, 1, 0, 1, 2, 0, 1, 1, 0, 1, 2, 0, 1, 1],
        [2, 0, 1, 0, 1, 1, 2, 1, 0, 1, 1, 0, 2, 1, 0, 1],
    ],
    storm: [
        [2, 1, 0, 1, 2, 1, 0, 1, 2, 1, 0, 1, 2, 1, 0, 1],
        [2, 0, 1, 1, 2, 0, 1, 1, 2, 0, 1, 1, 2, 1, 0, 1],
    ],
    quantum: [
        [2, 0, 1, 1, 0, 2, 1, 0, 2, 0, 1, 1, 0, 2, 1, 0],
        [2, 1, 0, 2, 0, 1, 0, 1, 2, 1, 0, 2, 0, 1, 0, 1],
    ],
    corrupted: [
        [2, 1, 0, 1, 2, 0, 1, 1, 2, 1, 0, 1, 2, 0, 1, 1],
        [2, 0, 1, 0, 2, 1, 1, 0, 2, 0, 1, 1, 2, 1, 0, 1],
    ],
    fungal: [
        [2, 0, 1, 1, 0, 1, 2, 0, 1, 1, 0, 1, 2, 0, 1, 1],
        [2, 0, 1, 0, 1, 1, 2, 0, 1, 0, 1, 1, 2, 0, 1, 0],
    ],
    organic: [
        [2, 0, 1, 0, 1, 1, 0, 1, 2, 0, 1, 0, 1, 1, 0, 1],
        [2, 0, 0, 1, 1, 0, 1, 0, 2, 0, 1, 1, 0, 1, 0, 1],
    ],
    ethereal: [
        [2, 0, 0, 1, 0, 0, 1, 0, 2, 0, 0, 1, 0, 0, 1, 0],
        [2, 0, 1, 0, 0, 0, 1, 0, 2, 0, 1, 0, 0, 0, 1, 0],
    ],
    nebula: [
        [2, 0, 1, 0, 0, 1, 0, 0, 2, 0, 1, 0, 0, 1, 0, 0],
        [2, 0, 0, 1, 0, 1, 0, 0, 2, 0, 0, 1, 0, 1, 0, 0],
    ],
    barren: [
        [2, 0, 0, 0, 1, 0, 0, 0, 2, 0, 0, 0, 1, 0, 0, 0],
        [2, 0, 0, 0, 0, 1, 0, 0, 2, 0, 0, 0, 0, 1, 0, 0],
    ],
};

function normalizePattern(pattern = []) {
    if (!Array.isArray(pattern) || !pattern.length) return [];
    return pattern.map((value) => {
        if (value >= 2) return 2;
        if (value >= 1) return 1;
        return 0;
    });
}

function pickPattern(patterns = [], seed = 1, fallback = [2, 0, 1, 0, 1, 0, 1, 0]) {
    const options = Array.isArray(patterns) && patterns.length ? patterns : [fallback];
    const rng = new RNG(seed >>> 0);
    return normalizePattern(rng.pick(options) || fallback);
}

function rotate(values, shift) {
    if (!values.length) return values;
    const n = values.length;
    const offset = ((shift % n) + n) % n;
    return values.map((_, index) => values[(index + offset) % n]);
}

function invertAroundRoot(motif, root = 0) {
    return motif.map((value) => root - (value - root));
}

function stretchRhythm(length, factor = 1) {
    return Math.max(1, Math.round(length * factor));
}

function nearestScaleIndex(scale, step) {
    if (!scale.length) return 0;
    const norm = ((step % 12) + 12) % 12;
    let nearestIdx = 0;
    let nearestDist = Infinity;
    scale.forEach((value, idx) => {
        const direct = Math.abs(value - norm);
        const wrapped = Math.min(direct, 12 - direct);
        if (wrapped < nearestDist) {
            nearestDist = wrapped;
            nearestIdx = idx;
        }
    });
    return nearestIdx;
}

function shiftScaleDegree(scale, step, degreeShift = 0) {
    if (!scale.length) return step + degreeShift;
    const baseIdx = nearestScaleIndex(scale, step);
    const baseOct = Math.floor(step / 12);
    const absDegree = baseIdx + baseOct * scale.length + degreeShift;
    const wrapped = ((absDegree % scale.length) + scale.length) % scale.length;
    const octave = Math.floor((absDegree - wrapped) / scale.length);
    return scale[wrapped] + octave * 12;
}

export class MelodyPlanner {
    constructor(planet) {
        this.seed = (planet?.seed || 1) + 103301;
        this.scale = Array.isArray(planet?.scale) && planet.scale.length ? planet.scale : [0, 2, 4, 5, 7, 9, 11];
        this.motifBank = Array.isArray(planet?.motifBank) && planet.motifBank.length
            ? planet.motifBank.map((motif) => motif.slice())
            : [this.scale.slice(0, 4)];
        this.biomeId = planet?.biome?.id || 'default';
        this.style = MELODY_STYLE[this.biomeId] || MELODY_STYLE.default;
        this.melodyDensity = clamp(planet?.melodyDensity || 0.08, 0.01, 0.35);
        this.chordAudibility = clamp(planet?.ac?.chordAudibility || 0.3, 0, 1);
        this.quarterToneProb = clamp(planet?.quarterToneProb || 0, 0, 1);
        this.melodyOcts = Array.isArray(planet?.ac?.melodyOcts) && planet.ac.melodyOcts.length
            ? planet.ac.melodyOcts.slice()
            : [2, 3, 4];
        this.moonDensity = clamp(planet?.moonSystem?.density || 0.4, 0, 1);
        const gateOptions = BIOME_MELODY_GATES[this.biomeId] || BIOME_MELODY_GATES.default;
        this.gatePattern = pickPattern(gateOptions, this.seed + 5093);
        this.lastStep = this.scale[0];
        this.lastCounterStep = this.scale[Math.min(2, this.scale.length - 1)];
        this.history = [];
        this.activeMotifIdx = 0;
        this.motifSwapCounter = 0;
        this.lastMode = 'GENERATIVE';
        this.softBiome = SOFT_BIOMES.has(this.biomeId);
        this.richnessProfile = planet?.v2?.richnessProfile || { tier: 'balanced', harmonicity: 0.5, brightness: 0.5, density: 0.5 };
        this.anchorCycleBars = this.richnessProfile.tier === 'sparse'
            ? 6
            : this.richnessProfile.tier === 'lush'
                ? 4
                : 5;
        this.anchorWindowBars = this.richnessProfile.tier === 'lush' ? 2 : 1;
        this.anchorStep = this.motifBank?.[0]?.[0] ?? this.scale[0];
        this.lastAnchorBar = -9999;
    }

    planStep({
        stepIndex = 0,
        barIndex = 0,
        section = 'INTRO',
        complexity = 0.5,
        motion = 0.5,
        dissonance = 0.35,
        tension = 0,
        chordIntervals = [],
        chordSymbol = 'I',
        qualityScalar = 1,
        counterlineEnabled = true,
    } = {}) {
        const rng = new RNG(this.seed + barIndex * 173 + stepIndex * 29);
        const gateLen = this.gatePattern.length || 16;
        const gateCell = this.gatePattern[stepIndex % gateLen] || 0;
        const gateMul = gateCell >= 2 ? 1.28 : gateCell === 1 ? 1.04 : 0.54;

        const phraseBase = 4 + Math.round((motion + complexity) * 4 + this.moonDensity * 2.6);
        const phraseLen = stretchRhythm(
            phraseBase,
            section === 'AFTERGLOW' ? 1.3 : section === 'SURGE' ? 0.86 : 1,
        );
        const phrasePos = stepIndex % phraseLen;
        const anchorCyclePos = ((barIndex % this.anchorCycleBars) + this.anchorCycleBars) % this.anchorCycleBars;
        const anchorWindowActive = anchorCyclePos < this.anchorWindowBars;
        const anchorDue = anchorWindowActive && phrasePos <= Math.max(1, Math.floor(phraseLen * 0.25));
        const isResponse = phrasePos >= Math.floor(phraseLen / 2);
        const isPhraseEnd = phrasePos === phraseLen - 1;
        const chordToneSet = new Set(
            (Array.isArray(chordIntervals) ? chordIntervals : [])
                .map((value) => ((value % 12) + 12) % 12),
        );

        if (phrasePos === 0) {
            this.motifSwapCounter++;
            const swapEvery = clamp(Math.round(2 + (1 - this.style.density) * 2.6 - complexity * 1.2), 1, 5);
            if (this.motifSwapCounter >= swapEvery) {
                this.motifSwapCounter = 0;
                this.activeMotifIdx = (this.activeMotifIdx + 1) % this.motifBank.length;
            }
        }

        const styleDensity = this.style.density * (0.74 + this.melodyDensity * 1.9) * (0.82 + gateMul * 0.32);
        let playChance = clamp(
            (0.24 + complexity * 0.26 + motion * 0.17 + tension * 0.09 - (1 - qualityScalar) * 0.24) * styleDensity,
            0.07,
            0.95,
        );
        if (gateCell === 0 && !isResponse && section !== 'SURGE') playChance *= 0.78;
        if (isPhraseEnd) playChance *= 0.84;
        if (section === 'AFTERGLOW') playChance *= 0.8;
        if (section === 'SURGE') playChance *= 1.14;
        if (anchorDue && section !== 'SURGE') {
            playChance = Math.max(playChance, clamp(0.62 + this.moonDensity * 0.2 + this.style.density * 0.12, 0.56, 0.9));
        }
        const shouldPlay = rng.bool(playChance);

        let step = null;
        let mode = 'GENERATIVE';
        let anchorHit = false;
        if (shouldPlay) {
            const motifChance = clamp(
                (isResponse ? 0.34 : 0.16)
                + this.style.density * 0.18
                + complexity * 0.14
                + this.moonDensity * 0.08
                + (gateCell >= 2 ? 0.08 : 0),
                0.08,
                0.9,
            );
            const responseChance = clamp(
                (isResponse ? 0.28 : 0.08)
                + motion * 0.16
                + this.style.leap * 0.09
                + this.moonDensity * 0.06
                + (gateCell === 0 ? -0.04 : 0.05),
                0.05,
                0.72,
            );

            if (anchorDue && section !== 'SURGE') {
                mode = 'ANCHOR';
                anchorHit = true;
                const anchorVariation = this.richnessProfile.tier === 'lush'
                    ? rng.pick([0, 0, 1, -1, 2, -2])
                    : rng.pick([0, 0, 1, -1]);
                step = shiftScaleDegree(this.scale, this.anchorStep, anchorVariation);
                this.lastAnchorBar = barIndex;
            } else if (this.motifBank.length && rng.bool(motifChance)) {
                mode = 'MOTIF';
                const motif = this._buildMotif(rng, complexity, dissonance, section, this.activeMotifIdx);
                step = motif[phrasePos % motif.length];
                if (section === 'AFTERGLOW') step = shiftScaleDegree(this.scale, step, rng.pick([-1, 0, 1]));
            } else if (this.history.length >= 4 && rng.bool(responseChance)) {
                mode = 'RESPONSE';
                const anchor = this.history[this.history.length - 4 + (phrasePos % 4)];
                const variation = rng.pick([-2, -1, 0, 1, 2, 3, -3]);
                step = shiftScaleDegree(this.scale, anchor, variation);
            } else {
                mode = 'GENERATIVE';
                step = this._chooseGenerativeStep(rng, {
                    phrasePos,
                    isResponse,
                    isPhraseEnd,
                    section,
                    complexity,
                    dissonance,
                    chordToneSet,
                    chordSymbol,
                });
            }

            if (!Number.isFinite(step)) step = this.scale[0];
            this.lastStep = step;
            this.history.push(step);
            if (this.history.length > 28) this.history.shift();
            this.lastMode = mode;
            if ((mode === 'MOTIF' || mode === 'ANCHOR') && Number.isFinite(step)) {
                this.anchorStep = step;
            }
        }

        const microChance = clamp((0.08 + dissonance * 0.16 + this.quarterToneProb * 0.22) * this.style.micro, 0.04, 0.66);
        const microCents = shouldPlay && rng.bool(microChance)
            ? (this.quarterToneProb > 0 && rng.bool(this.quarterToneProb * 0.6)
                ? rng.pick([-50, 50]) * clamp(0.5 + dissonance * 0.55, 0.45, 1)
                : rng.range(-24, 24))
            : 0;

        let counterline = null;
        if (counterlineEnabled && qualityScalar > 0.58 && rng.bool(0.1 + complexity * 0.14 + this.moonDensity * 0.06)) {
            const idx = this.scale.indexOf(this.lastCounterStep);
            const safeIdx = idx >= 0 ? idx : 0;
            const movePool = section === 'AFTERGLOW' ? [-2, -1, 1] : [-3, -2, -1, 1, 2, 3];
            const nextIdx = ((safeIdx + rng.pick(movePool)) % this.scale.length + this.scale.length) % this.scale.length;
            this.lastCounterStep = this.scale[nextIdx] + (rng.bool(0.18) ? 12 : 0);
            counterline = this.lastCounterStep;
        }

        let subStep = null;
        const subChance = clamp(
            (0.07 + complexity * 0.12 + motion * 0.1 + this.moonDensity * 0.09)
            * (gateCell > 0 ? 1.22 : 0.7),
            0.02,
            0.56,
        );
        if (shouldPlay && rng.bool(subChance)) {
            const shiftPool = this.biomeId === 'crystalline'
                ? [2, 3, 4, -3]
                : this.biomeId === 'storm'
                    ? [-3, -2, 2, 3]
                    : [-3, -2, 2, 3, 4];
            subStep = shiftScaleDegree(this.scale, step, rng.pick(shiftPool));
        }

        const voiceHint = this._pickVoiceHint(rng, { mode, section, dissonance, complexity, gateCell });
        const octave = this._pickOctave(rng, { section, mode, gateCell });
        let velocity = clamp((0.2 + complexity * 0.32 + motion * 0.16 + (isPhraseEnd ? 0.05 : 0)) * this.style.velocity, 0.08, 0.92);
        if (section === 'AFTERGLOW') velocity *= 0.88;
        if (gateCell >= 2) velocity *= 1.08;
        if (!shouldPlay) velocity = 0;
        let durScale = section === 'AFTERGLOW' ? 1.4 : section === 'SURGE' ? 0.9 : 1.06;
        if (mode === 'MOTIF') durScale *= 1.08;
        if (this.softBiome && section !== 'SURGE') durScale *= 1.08;
        if (gateCell === 0) durScale *= 1.12;

        return {
            play: shouldPlay,
            step: shouldPlay ? step : null,
            subStep,
            octave,
            velocity,
            durScale,
            microCents,
            section,
            voiceHint,
            counterline,
            mode,
            anchorDue,
            anchorHit,
            anchorStep: this.anchorStep,
            phrasePos,
            phraseLen,
            isResponse,
            isPhraseEnd,
            gateCell,
        };
    }

    _buildMotif(rng, complexity, dissonance, section, motifIdx) {
        const base = this.motifBank[motifIdx % this.motifBank.length] || this.scale.slice(0, 4);
        let motif = base.slice();
        if (complexity > 0.56 && rng.bool(complexity * 0.42)) motif = rotate(motif, rng.pick([1, 2, -1]));
        if (dissonance > 0.5 && rng.bool(dissonance * 0.34)) motif = invertAroundRoot(motif, motif[0] || 0);
        if (section === 'SURGE' && rng.bool(0.14 + complexity * 0.16)) motif = rotate(motif, 2);
        if (section === 'AFTERGLOW' && rng.bool(0.16 + this.moonDensity * 0.2)) motif = motif.slice().reverse();
        return motif;
    }

    _chooseGenerativeStep(rng, {
        phrasePos,
        isResponse,
        isPhraseEnd,
        section,
        complexity,
        dissonance,
        chordToneSet,
        chordSymbol,
    }) {
        const pool = [];
        this.scale.forEach((scaleStep) => {
            const norm = ((scaleStep % 12) + 12) % 12;
            const chordTone = chordToneSet.has(norm);
            let weight = 1;

            if (chordTone) {
                weight *= 2.7;
            } else {
                weight *= clamp(1 - this.chordAudibility * 0.52 + dissonance * 0.24, 0.34, 1.5);
            }

            const tonicOrFifth = norm === 0 || norm === 7;
            if (isPhraseEnd || isResponse) {
                weight *= tonicOrFifth || chordTone ? 2.2 : 0.72;
            } else {
                weight *= !chordTone ? (1.04 + dissonance * 0.14) : 1;
            }

            if (Number.isFinite(this.lastStep)) {
                const diff = Math.abs(scaleStep - this.lastStep);
                if (diff <= 2) weight *= 1.78;
                else if (diff <= 5) weight *= 1.2;
                else if (diff >= 9) weight *= 0.5 + complexity * 0.22;
            }

            if (section === 'AFTERGLOW' && !chordTone) weight *= 0.72;
            if (section === 'SURGE' && !chordTone) weight *= 1.08 + dissonance * 0.12;
            if (section === 'INTRO' && phrasePos < 2 && !tonicOrFifth) weight *= 0.82;
            if (this.biomeId === 'fungal' && norm === 0 && !isPhraseEnd) weight *= 0.78;
            if (chordSymbol === 'V' && norm === 11) weight *= 1.22;

            const copies = clamp(Math.round(weight * 4), 1, 16);
            for (let i = 0; i < copies; i++) pool.push(scaleStep);
        });

        let step = pool.length ? rng.pick(pool) : this.scale[0];
        const leapChance = clamp((0.06 + complexity * 0.18 + dissonance * 0.11) * this.style.leap, 0.02, 0.56);
        if (rng.bool(leapChance)) {
            step = shiftScaleDegree(this.scale, step, rng.pick([3, -3, 4, -4, 5, -5]));
        } else if (rng.bool(0.26 + this.moonDensity * 0.12)) {
            step = shiftScaleDegree(this.scale, step, rng.pick([0, 1, -1, 2, -2]));
        }
        return step;
    }

    _pickVoiceHint(rng, { mode, section, dissonance, complexity, gateCell }) {
        const hints = BIOME_VOICE_HINTS[this.biomeId] || BIOME_VOICE_HINTS.default;
        if (section === 'AFTERGLOW') return rng.pick(hints.ambient);
        if (mode === 'MOTIF' && rng.bool(0.6 + (gateCell >= 2 ? 0.12 : 0))) return rng.pick(hints.motif);
        if (section === 'SURGE' && (dissonance > 0.66 || complexity > 0.7)) {
            if (this.softBiome) return rng.pick(['wavetable_morph', 'vowel_morph']);
            return rng.pick(hints.intense);
        }
        if (mode === 'RESPONSE' && rng.bool(0.42)) {
            return this.softBiome ? rng.pick(['vowel_morph', 'wavetable_morph']) : rng.pick(['modal_resonator', 'wavetable_morph']);
        }
        return null;
    }

    _pickOctave(rng, { section, mode, gateCell }) {
        const available = this.melodyOcts.length ? this.melodyOcts.slice() : [2, 3, 4];
        const prefersHigh = rng.bool(this.style.highOct);
        let pool = available.slice();
        if (section === 'AFTERGLOW') {
            pool = prefersHigh ? available.filter((oct) => oct >= 3) : available.filter((oct) => oct >= 2);
        } else if (section === 'SURGE') {
            pool = this.softBiome ? available.filter((oct) => oct >= 2) : available.filter((oct) => oct <= 3);
        }
        if (mode === 'RESPONSE' && pool.length > 1) {
            pool = pool.filter((oct) => oct <= 3);
        }
        if (gateCell >= 2 && pool.length > 1) {
            const high = pool.filter((oct) => oct >= 3);
            if (high.length && rng.bool(0.62)) pool = high;
        }
        if (!pool.length) pool = available;
        return rng.pick(pool);
    }
}
