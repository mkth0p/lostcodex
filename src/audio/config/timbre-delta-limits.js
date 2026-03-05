export const DEFAULT_TIMBRE_DELTA_LIMITS = {
    reverbWetBoostMax: 1.32,
    filterBurstMulMax: 5.0,
    chordGlideSec: 2.2,
    padGainMax: 0.86,
    hatBrightnessMin: 0.58,
    hatBrightnessMax: 1.45,
    harshnessTame: 0.9,
    longTailMaxDefaultDur: 5.5,
    longTailMaxDur: {
        choir: 4.8,
        crystal_chimes: 5.6,
        drone_morph: 4.4,
        gong: 7.4,
        granular_cloud: 1.25,
        strings: 5.2,
        subpad: 5.8,
        vowel_morph: 4.6,
    },
};

export const BIOME_TIMBRE_DELTA_LIMITS = {
    storm: {
        filterBurstMulMax: 4.2,
        hatBrightnessMax: 1.18,
        harshnessTame: 0.82,
        chordGlideSec: 2.0,
    },
    corrupted: {
        filterBurstMulMax: 4.0,
        hatBrightnessMax: 1.15,
        harshnessTame: 0.8,
        chordGlideSec: 2.0,
    },
    fungal: {
        hatBrightnessMax: 1.22,
        longTailMaxDefaultDur: 4.8,
        chordGlideSec: 1.85,
    },
    volcanic: {
        harshnessTame: 0.86,
        hatBrightnessMax: 1.2,
        chordGlideSec: 1.9,
    },
    nebula: {
        reverbWetBoostMax: 1.28,
        chordGlideSec: 2.4,
    },
    abyssal: {
        chordGlideSec: 2.6,
        longTailMaxDefaultDur: 6.0,
    },
};

export function resolveTimbreDeltaLimits(biomeId = 'default') {
    const biomeLimits = BIOME_TIMBRE_DELTA_LIMITS[biomeId] || {};
    const baseLongTail = DEFAULT_TIMBRE_DELTA_LIMITS.longTailMaxDur || {};
    const biomeLongTail = biomeLimits.longTailMaxDur || {};
    return {
        ...DEFAULT_TIMBRE_DELTA_LIMITS,
        ...biomeLimits,
        longTailMaxDur: {
            ...baseLongTail,
            ...biomeLongTail,
        },
    };
}

