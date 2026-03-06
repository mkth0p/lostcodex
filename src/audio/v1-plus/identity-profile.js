import { RNG } from '../../rng.js';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const BIOME_IDENTITY_PRESETS = {
    crystalline: {
        paceBias: -0.2,
        droneSignature: 'glass-pillars',
        holdPolicy: { slow: [6, 20], medium: [4, 12], fast: [2, 7] },
        droneTargetDb: [-23, -15],
        percussionPresence: 0.2,
        melodyPresence: 0.38,
        ambiencePresence: 0.82,
        moonPresence: 0.34,
        cadenceBias: -0.12,
        harmonicComplexity: 0.42,
        microtonalBias: 0.55,
        toneTilt: 'cold-bright',
        layerTargets: { drones: 0.72, pads: 0.68, melody: 0.68, bass: 0.54, percussion: 0.32, ambience: 0.86, fx: 0.42 },
    },
    volcanic: {
        paceBias: 0.26,
        droneSignature: 'molten-grit',
        holdPolicy: { slow: [4, 10], medium: [2, 7], fast: [1, 4] },
        droneTargetDb: [-18, -10],
        percussionPresence: 0.82,
        melodyPresence: 0.44,
        ambiencePresence: 0.36,
        moonPresence: 0.28,
        cadenceBias: 0.34,
        harmonicComplexity: 0.58,
        microtonalBias: 0.32,
        toneTilt: 'hot-mid',
        layerTargets: { drones: 0.66, pads: 0.48, melody: 0.7, bass: 0.9, percussion: 1.05, ambience: 0.38, fx: 0.72 },
    },
    psychedelic: {
        paceBias: 0.24,
        droneSignature: 'morph-lattice',
        holdPolicy: { slow: [4, 11], medium: [2, 8], fast: [1, 5] },
        droneTargetDb: [-20, -12],
        percussionPresence: 0.66,
        melodyPresence: 0.68,
        ambiencePresence: 0.62,
        moonPresence: 0.44,
        cadenceBias: 0.12,
        harmonicComplexity: 0.76,
        microtonalBias: 0.78,
        toneTilt: 'prismatic-bright',
        layerTargets: { drones: 0.7, pads: 0.74, melody: 0.92, bass: 0.62, percussion: 0.86, ambience: 0.74, fx: 0.86 },
    },
    desert: {
        paceBias: -0.02,
        droneSignature: 'dust-resonance',
        holdPolicy: { slow: [6, 16], medium: [4, 10], fast: [2, 6] },
        droneTargetDb: [-24, -17],
        percussionPresence: 0.22,
        melodyPresence: 0.26,
        ambiencePresence: 0.5,
        moonPresence: 0.22,
        cadenceBias: 0.08,
        harmonicComplexity: 0.34,
        microtonalBias: 0.28,
        toneTilt: 'dry-mid',
        layerTargets: { drones: 0.62, pads: 0.52, melody: 0.56, bass: 0.58, percussion: 0.32, ambience: 0.6, fx: 0.42 },
    },
    oceanic: {
        paceBias: -0.22,
        droneSignature: 'tidal-bed',
        holdPolicy: { slow: [5, 14], medium: [4, 11], fast: [2, 7] },
        droneTargetDb: [-22, -14],
        percussionPresence: 0.18,
        melodyPresence: 0.34,
        ambiencePresence: 0.9,
        moonPresence: 0.42,
        cadenceBias: -0.08,
        harmonicComplexity: 0.52,
        microtonalBias: 0.56,
        toneTilt: 'deep-aquatic',
        layerTargets: { drones: 0.76, pads: 0.82, melody: 0.62, bass: 0.64, percussion: 0.24, ambience: 0.96, fx: 0.48 },
    },
    corrupted: {
        paceBias: 0.38,
        droneSignature: 'fracture-bloom',
        holdPolicy: { slow: [3, 8], medium: [2, 6], fast: [1, 4] },
        droneTargetDb: [-18, -9],
        percussionPresence: 0.88,
        melodyPresence: 0.72,
        ambiencePresence: 0.46,
        moonPresence: 0.46,
        cadenceBias: 0.22,
        harmonicComplexity: 0.9,
        microtonalBias: 0.92,
        toneTilt: 'fractured-bright',
        layerTargets: { drones: 0.7, pads: 0.56, melody: 0.96, bass: 0.7, percussion: 1.1, ambience: 0.52, fx: 1.02 },
    },
    barren: {
        paceBias: -0.4,
        droneSignature: 'void-hum',
        holdPolicy: { slow: [16, 48], medium: [12, 30], fast: [8, 20] },
        droneTargetDb: [-28, -20],
        percussionPresence: 0.02,
        melodyPresence: 0.08,
        ambiencePresence: 0.44,
        moonPresence: 0.08,
        cadenceBias: -0.6,
        harmonicComplexity: 0.12,
        microtonalBias: 0.18,
        toneTilt: 'dark-void',
        layerTargets: { drones: 0.48, pads: 0.38, melody: 0.26, bass: 0.4, percussion: 0.04, ambience: 0.48, fx: 0.18 },
    },
    organic: {
        paceBias: 0.08,
        droneSignature: 'bioswell',
        holdPolicy: { slow: [4, 12], medium: [3, 9], fast: [2, 6] },
        droneTargetDb: [-23, -15],
        percussionPresence: 0.54,
        melodyPresence: 0.62,
        ambiencePresence: 0.58,
        moonPresence: 0.4,
        cadenceBias: 0.1,
        harmonicComplexity: 0.62,
        microtonalBias: 0.42,
        toneTilt: 'warm-green',
        layerTargets: { drones: 0.62, pads: 0.62, melody: 0.86, bass: 0.64, percussion: 0.74, ambience: 0.66, fx: 0.5 },
    },
    ethereal: {
        paceBias: -0.31,
        droneSignature: 'phantom-choir',
        holdPolicy: { slow: [8, 24], medium: [6, 16], fast: [3, 10] },
        droneTargetDb: [-20, -14],
        percussionPresence: 0.04,
        melodyPresence: 0.26,
        ambiencePresence: 0.88,
        moonPresence: 0.36,
        cadenceBias: -0.42,
        harmonicComplexity: 0.54,
        microtonalBias: 0.74,
        toneTilt: 'balanced-airy',
        layerTargets: { drones: 0.82, pads: 0.86, melody: 0.58, bass: 0.42, percussion: 0.08, ambience: 0.94, fx: 0.34 },
    },
    quantum: {
        paceBias: 0.42,
        droneSignature: 'phase-fold',
        holdPolicy: { slow: [3, 9], medium: [2, 7], fast: [1, 5] },
        droneTargetDb: [-17, -8],
        percussionPresence: 0.76,
        melodyPresence: 0.74,
        ambiencePresence: 0.56,
        moonPresence: 0.52,
        cadenceBias: 0.18,
        harmonicComplexity: 0.95,
        microtonalBias: 0.98,
        toneTilt: 'hyper-bright',
        layerTargets: { drones: 0.68, pads: 0.58, melody: 0.98, bass: 0.68, percussion: 0.98, ambience: 0.58, fx: 1.08 },
    },
    glacial: {
        paceBias: -0.46,
        droneSignature: 'frozen-halo',
        holdPolicy: { slow: [12, 32], medium: [8, 22], fast: [4, 12] },
        droneTargetDb: [-22, -16],
        percussionPresence: 0.03,
        melodyPresence: 0.12,
        ambiencePresence: 0.84,
        moonPresence: 0.24,
        cadenceBias: -0.5,
        harmonicComplexity: 0.24,
        microtonalBias: 0.46,
        toneTilt: 'balanced-cold',
        layerTargets: { drones: 0.74, pads: 0.72, melody: 0.36, bass: 0.46, percussion: 0.06, ambience: 0.9, fx: 0.28 },
    },
    fungal: {
        paceBias: 0.18,
        droneSignature: 'mycelial-thrum',
        holdPolicy: { slow: [4, 12], medium: [3, 9], fast: [2, 6] },
        droneTargetDb: [-21, -13],
        percussionPresence: 0.72,
        melodyPresence: 0.58,
        ambiencePresence: 0.64,
        moonPresence: 0.44,
        cadenceBias: 0.16,
        harmonicComplexity: 0.68,
        microtonalBias: 0.52,
        toneTilt: 'earthy-mid',
        layerTargets: { drones: 0.62, pads: 0.54, melody: 0.82, bass: 0.64, percussion: 0.96, ambience: 0.68, fx: 0.58 },
    },
    abyssal: {
        paceBias: -0.14,
        droneSignature: 'pressure-bed',
        holdPolicy: { slow: [8, 22], medium: [5, 14], fast: [3, 8] },
        droneTargetDb: [-20, -12],
        percussionPresence: 0.16,
        melodyPresence: 0.22,
        ambiencePresence: 0.78,
        moonPresence: 0.38,
        cadenceBias: -0.26,
        harmonicComplexity: 0.44,
        microtonalBias: 0.36,
        toneTilt: 'sub-heavy',
        layerTargets: { drones: 0.84, pads: 0.64, melody: 0.52, bass: 0.96, percussion: 0.2, ambience: 0.82, fx: 0.4 },
    },
    nebula: {
        paceBias: -0.32,
        droneSignature: 'choral-veil',
        holdPolicy: { slow: [8, 20], medium: [6, 14], fast: [3, 9] },
        droneTargetDb: [-21, -13],
        percussionPresence: 0.05,
        melodyPresence: 0.24,
        ambiencePresence: 0.96,
        moonPresence: 0.34,
        cadenceBias: -0.3,
        harmonicComplexity: 0.66,
        microtonalBias: 0.78,
        toneTilt: 'choral-wide',
        layerTargets: { drones: 0.8, pads: 0.9, melody: 0.56, bass: 0.46, percussion: 0.08, ambience: 1.02, fx: 0.38 },
    },
    arctic: {
        paceBias: -0.39,
        droneSignature: 'polar-wisp',
        holdPolicy: { slow: [10, 26], medium: [7, 16], fast: [4, 10] },
        droneTargetDb: [-24, -16],
        percussionPresence: 0.05,
        melodyPresence: 0.16,
        ambiencePresence: 0.82,
        moonPresence: 0.26,
        cadenceBias: -0.42,
        harmonicComplexity: 0.3,
        microtonalBias: 0.42,
        toneTilt: 'cold-brittle',
        layerTargets: { drones: 0.68, pads: 0.64, melody: 0.42, bass: 0.5, percussion: 0.08, ambience: 0.88, fx: 0.26 },
    },
    storm: {
        paceBias: 0.35,
        droneSignature: 'electric-surge',
        holdPolicy: { slow: [3, 7], medium: [2, 5], fast: [1, 4] },
        droneTargetDb: [-16, -8],
        percussionPresence: 0.95,
        melodyPresence: 0.64,
        ambiencePresence: 0.42,
        moonPresence: 0.34,
        cadenceBias: 0.28,
        harmonicComplexity: 0.84,
        microtonalBias: 0.74,
        toneTilt: 'electric-harsh',
        layerTargets: { drones: 0.62, pads: 0.46, melody: 0.84, bass: 0.78, percussion: 1.14, ambience: 0.48, fx: 0.96 },
    },
    crystalloid: {
        paceBias: 0.22,
        droneSignature: 'prism-grid',
        holdPolicy: { slow: [4, 10], medium: [3, 8], fast: [2, 5] },
        droneTargetDb: [-22, -14],
        percussionPresence: 0.58,
        melodyPresence: 0.66,
        ambiencePresence: 0.6,
        moonPresence: 0.42,
        cadenceBias: 0.2,
        harmonicComplexity: 0.72,
        microtonalBias: 0.64,
        toneTilt: 'precise-bright',
        layerTargets: { drones: 0.7, pads: 0.68, melody: 0.9, bass: 0.62, percussion: 0.82, ambience: 0.66, fx: 0.62 },
    },
    default: {
        paceBias: 0,
        droneSignature: 'living-bed',
        holdPolicy: { slow: [6, 20], medium: [3, 10], fast: [1, 6] },
        droneTargetDb: [-23, -14],
        percussionPresence: 0.45,
        melodyPresence: 0.5,
        ambiencePresence: 0.6,
        moonPresence: 0.35,
        cadenceBias: 0,
        harmonicComplexity: 0.5,
        microtonalBias: 0.5,
        toneTilt: 'balanced',
        layerTargets: { drones: 0.7, pads: 0.7, melody: 0.84, bass: 0.72, percussion: 0.8, ambience: 0.66, fx: 0.65 },
    },
};

const BIOME_PACE_BIAS = Object.fromEntries(
    Object.entries(BIOME_IDENTITY_PRESETS).map(([biomeId, preset]) => [biomeId, preset.paceBias || 0]),
);

function paceFromScore(score = 0) {
    if (score <= -0.14) return 'slow';
    if (score >= 0.18) return 'fast';
    return 'medium';
}

function toCompact(value = 0) {
    return Math.round(clamp(value, 0, 1) * 1000) / 1000;
}

function toDb(value = -24) {
    return Math.round(value * 10) / 10;
}

function buildHoldPolicy(preset = null, rng = null) {
    const source = preset?.holdPolicy || BIOME_IDENTITY_PRESETS.default.holdPolicy;
    const policy = {};
    ['slow', 'medium', 'fast'].forEach((pace) => {
        const hold = source[pace] || BIOME_IDENTITY_PRESETS.default.holdPolicy[pace];
        const jitter = pace === 'slow' ? 2 : 1;
        const min = clamp(Math.round((hold[0] || 1) + (rng ? rng.range(-jitter, jitter) : 0)), 1, 64);
        const maxBase = Math.round((hold[1] || (min + 2)) + (rng ? rng.range(-jitter * 2, jitter * 2) : 0));
        const max = clamp(Math.max(min + 1, maxBase), min + 1, 72);
        policy[pace] = [min, max];
    });
    return policy;
}

function buildDroneTarget(preset = null, rng = null) {
    const [baseMin, baseMax] = preset?.droneTargetDb || BIOME_IDENTITY_PRESETS.default.droneTargetDb;
    const jitterMin = rng ? rng.range(-0.9, 0.9) : 0;
    const jitterMax = rng ? rng.range(-0.9, 0.9) : 0;
    const min = clamp(baseMin + jitterMin, -36, -8);
    const max = clamp(Math.max(min + 2, baseMax + jitterMax), min + 2, -4);
    return {
        min: toDb(min),
        max: toDb(max),
    };
}

export function getBiomeIdentityPreset(biomeId = 'default') {
    return BIOME_IDENTITY_PRESETS[biomeId] || BIOME_IDENTITY_PRESETS.default;
}

export function resolvePaceClass(identityProfile = null, override = 'auto') {
    if (override === 'slow' || override === 'medium' || override === 'fast') return override;
    return identityProfile?.paceClass || 'medium';
}

export function buildIdentityProfile(planet = {}) {
    const seed = (planet?.seed || 1) + 275401;
    const rng = new RNG(seed >>> 0);
    const biomeId = planet?.biome?.id || 'default';
    const preset = getBiomeIdentityPreset(biomeId);
    const moonDensity = clamp(planet?.moonSystem?.density || 0.4, 0, 1);
    const resonance = clamp(planet?.moonSystem?.resonance || 0.4, 0, 1);
    const rarity = clamp(planet?.rarityScore || 0, 0, 1);
    const melodyDensity = clamp(planet?.melodyDensity || 0.08, 0.01, 0.35);
    const chordAudibility = clamp(planet?.ac?.chordAudibility || 0.3, 0, 1);
    const biomeBias = BIOME_PACE_BIAS[biomeId] || 0;

    const paceScore = clamp(
        biomeBias
        + (melodyDensity - 0.1) * 1.1
        + (1 - chordAudibility) * 0.26
        + ((preset.harmonicComplexity || 0.5) - 0.5) * 0.22
        + rng.range(-0.12, 0.14),
        -1,
        1,
    );
    const paceClass = paceFromScore(paceScore);

    const harmonyDrift = toCompact(0.2 + (preset.harmonicComplexity || 0.5) * 0.32 + rarity * 0.24 + moonDensity * 0.15 + rng.range(-0.1, 0.14));
    const motifVolatility = toCompact(0.14 + (preset.melodyPresence || 0.5) * 0.64 + melodyDensity * 0.32 + rng.range(-0.09, 0.11));
    const rhythmEcology = toCompact(0.12 + (preset.percussionPresence || 0.5) * 0.66 + moonDensity * 0.18 + (paceClass === 'fast' ? 0.1 : paceClass === 'slow' ? -0.08 : 0) + rng.range(-0.08, 0.09));
    const moonBias = toCompact(0.1 + (preset.moonPresence || 0.35) * 0.5 + moonDensity * 0.22 + resonance * 0.1 + rng.range(-0.07, 0.09));
    const microtonalWarp = toCompact(0.14 + (preset.microtonalBias || 0.5) * 0.58 + rarity * 0.18 + (planet?.quarterToneProb || 0) * 0.45 + rng.range(-0.07, 0.1));
    const compositionLift = toCompact(0.14 + (preset.harmonicComplexity || 0.5) * 0.42 + rarity * 0.2 + (paceClass === 'medium' ? 0.04 : 0) + rng.range(-0.07, 0.08));
    const holdPolicy = buildHoldPolicy(preset, rng);
    const droneTargetDb = buildDroneTarget(preset, rng);
    const layerTargets = preset.layerTargets || BIOME_IDENTITY_PRESETS.default.layerTargets;

    return {
        id: `${biomeId}-${(seed >>> 0).toString(16)}`,
        biomeId,
        paceClass,
        paceScore: toCompact((paceScore + 1) * 0.5),
        harmonyDrift,
        motifVolatility,
        rhythmEcology,
        droneSignature: preset.droneSignature || BIOME_IDENTITY_PRESETS.default.droneSignature,
        moonBias,
        microtonalWarp,
        microtonalMapSeed: ((seed + 8803 + Math.floor(rarity * 997)) >>> 0),
        compositionLift,
        holdPolicy,
        cadenceBias: toCompact(clamp((preset.cadenceBias || 0) * 0.5 + rng.range(-0.08, 0.08), -1, 1) * 0.5 + 0.5) * 2 - 1,
        droneTargetDb,
        percussionPresence: toCompact(clamp((preset.percussionPresence || 0.5) + rng.range(-0.08, 0.08), 0, 1)),
        melodyPresence: toCompact(clamp((preset.melodyPresence || 0.5) + rng.range(-0.08, 0.08), 0, 1)),
        ambiencePresence: toCompact(clamp((preset.ambiencePresence || 0.6) + rng.range(-0.08, 0.08), 0, 1.2)),
        moonPresence: toCompact(clamp((preset.moonPresence || 0.35) + rng.range(-0.08, 0.08), 0, 1)),
        harmonicComplexity: toCompact(clamp((preset.harmonicComplexity || 0.5) + rng.range(-0.08, 0.08), 0, 1)),
        toneTilt: preset.toneTilt || 'balanced',
        layerTargets: {
            drones: toCompact(clamp((layerTargets.drones || 0.7) + rng.range(-0.06, 0.06), 0, 1.4)),
            pads: toCompact(clamp((layerTargets.pads || 0.7) + rng.range(-0.06, 0.06), 0, 1.4)),
            melody: toCompact(clamp((layerTargets.melody || 0.84) + rng.range(-0.06, 0.06), 0, 1.4)),
            bass: toCompact(clamp((layerTargets.bass || 0.72) + rng.range(-0.06, 0.06), 0, 1.4)),
            percussion: toCompact(clamp((layerTargets.percussion || 0.8) + rng.range(-0.06, 0.06), 0, 1.4)),
            ambience: toCompact(clamp((layerTargets.ambience || 0.66) + rng.range(-0.06, 0.06), 0, 1.4)),
            fx: toCompact(clamp((layerTargets.fx || 0.65) + rng.range(-0.06, 0.06), 0, 1.4)),
        },
    };
}
