import { RNG } from './rng.js';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export const RARITY_ORDER = ['common', 'standard', 'uncommon', 'rare', 'anomalous', 'legendary'];

const RARITY_THRESHOLDS = [
    { key: 'common', max: 0.46, label: 'COMMON' },     // ~50%
    { key: 'standard', max: 0.56, label: 'STANDARD' }, // ~25%
    { key: 'uncommon', max: 0.61, label: 'UNCOMMON' }, // ~13%
    { key: 'rare', max: 0.65, label: 'RARE' },         // ~7%
    { key: 'anomalous', max: 0.68, label: 'ANOMALOUS' }, // ~4%
    { key: 'legendary', max: 1, label: 'LEGENDARY' },  // ~1%
];

const BIOME_RARITY_BIAS = {
    barren: 0.12,
    glacial: 0.18,
    arctic: 0.18,
    crystalline: 0.22,
    crystalloid: 0.28,
    volcanic: 0.26,
    desert: 0.15,
    oceanic: 0.16,
    organic: 0.16,
    fungal: 0.22,
    ethereal: 0.26,
    nebula: 0.32,
    abyssal: 0.3,
    storm: 0.34,
    corrupted: 0.4,
    quantum: 0.44,
    psychedelic: 0.28,
};

function toTier(score) {
    const safeScore = clamp(score, 0, 1);
    return RARITY_THRESHOLDS.find((tier) => safeScore <= tier.max) || RARITY_THRESHOLDS[RARITY_THRESHOLDS.length - 1];
}

export function rarityFromScore(score) {
    const tier = toTier(score);
    return {
        key: tier.key,
        label: tier.label,
        className: `rarity-${tier.key}`,
    };
}

function computeAddressComplexity(address = '') {
    const chars = [...(address || '')];
    const len = chars.length;
    if (!len) return { lengthNorm: 0, uniqueRatio: 0, bigramRatio: 0, repeatPenalty: 0 };

    const unique = new Set(chars).size;
    const uniqueRatio = unique / len;

    const bigrams = new Set();
    for (let i = 0; i < len - 1; i++) {
        bigrams.add(`${chars[i]}:${chars[i + 1]}`);
    }
    const bigramRatio = len > 1 ? bigrams.size / (len - 1) : 0;

    const lengthNorm = clamp((len - 3) / 18, 0, 1);
    const repeatPenalty = clamp((1 - uniqueRatio) * 0.9 + (1 - bigramRatio) * 0.1, 0, 1);
    return { lengthNorm, uniqueRatio, bigramRatio, repeatPenalty };
}

function computeHarmonyNovelty(scale = [], progression = []) {
    const scaleLen = Array.isArray(scale) ? scale.length : 0;
    const progressionSet = new Set(Array.isArray(progression) ? progression : []);
    const scaleComplexity = clamp((scaleLen - 5) / 7, 0, 1);
    const progressionComplexity = clamp((progressionSet.size - 2) / 4, 0, 1);
    return clamp(scaleComplexity * 0.6 + progressionComplexity * 0.4, 0, 1);
}

function computeSonicNovelty(ac = {}, tuningSystem = 'Equal', quarterToneProb = 0, octaveStretch = 1) {
    const stepCount = Number.isFinite(ac?.stepCount) ? ac.stepCount : 16;
    const unusualMeter = clamp(Math.abs(stepCount - 16) / 11, 0, 1);
    const waves = Array.isArray(ac?.melodyWaves) ? ac.melodyWaves : [];
    const voiceNovelty = clamp(new Set(waves).size / 10, 0, 1);
    const tuningNovelty = clamp(
        (tuningSystem !== 'Equal' ? 0.48 : 0.12) +
        clamp(quarterToneProb * 2.2, 0, 0.26) +
        clamp(Math.abs((octaveStretch || 1) - 1) * 35, 0, 0.18),
        0,
        1
    );
    return clamp(unusualMeter * 0.35 + voiceNovelty * 0.4 + tuningNovelty * 0.25, 0, 1);
}

export function computePlanetRarity(options = {}) {
    const {
        seed = 1,
        address = '',
        biomeId = 'barren',
        numMoons = 0,
        scale = [],
        progression = [],
        ac = null,
        tuningSystem = 'Equal',
        quarterToneProb = 0,
        octaveStretch = 1,
    } = options;

    const addressComplexity = computeAddressComplexity(address);
    const biomeBias = BIOME_RARITY_BIAS[biomeId] ?? 0.38;
    const moonBias = clamp((numMoons || 0) / 4, 0, 1);
    const harmonyNovelty = computeHarmonyNovelty(scale, progression);
    const sonicNovelty = computeSonicNovelty(ac, tuningSystem, quarterToneProb, octaveStretch);

    const base = clamp(
        addressComplexity.lengthNorm * 0.16 +
        addressComplexity.uniqueRatio * 0.12 +
        addressComplexity.bigramRatio * 0.1 +
        biomeBias * 0.22 +
        moonBias * 0.12 +
        harmonyNovelty * 0.11 +
        sonicNovelty * 0.17 -
        addressComplexity.repeatPenalty * 0.14,
        0,
        1
    );

    const rng = new RNG((seed ^ 0x517cc1b7) >>> 0);
    const jitter = rng.range(0, 1);
    let score = clamp(base * 0.6 + jitter * 0.4, 0, 1);

    if (score > 0.88 && jitter > 0.8) score = clamp(score + 0.03, 0, 1);
    if (addressComplexity.repeatPenalty > 0.65) score = clamp(score - 0.05, 0, 1);

    const tier = rarityFromScore(score);
    return {
        ...tier,
        score: Math.round(score * 1000) / 1000,
    };
}
