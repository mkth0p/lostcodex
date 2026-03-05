import { RNG } from '../../rng.js';

export function buildDrumToneProfile(options = {}) {
    const {
        biomeId = 'default',
        defaultTone,
        biomeTones,
    } = options;
    return {
        ...defaultTone,
        ...((biomeTones && biomeTones[biomeId]) || {}),
    };
}

export function fitPatternToCycle(pattern, targetLength) {
    const source = Array.isArray(pattern) && pattern.length ? pattern : [0];
    if (!Number.isFinite(targetLength) || targetLength <= 0) return source.slice();
    if (source.length === targetLength) return source.slice();

    const projected = new Array(targetLength).fill(0);
    source.forEach((value, index) => {
        if (!value) return;
        const mappedIndex = Math.min(targetLength - 1, Math.floor((index / source.length) * targetLength));
        projected[mappedIndex] = Math.max(projected[mappedIndex], value);
    });
    return projected;
}

export function getPhasePatternProfile(biomeId) {
    const profile = {
        DORMANT: { drop: 0.34, add: 0.01, open: 0.01, rotate: 0 },
        STIR: { drop: 0.18, add: 0.03, open: 0.03, rotate: 0 },
        BUILD: { drop: 0.07, add: 0.09, open: 0.08, rotate: 0 },
        SURGE: { drop: 0.02, add: 0.16, open: 0.14, rotate: 0 },
        CLIMAX: { drop: 0.0, add: 0.22, open: 0.22, rotate: 0 },
        FALLOUT: { drop: 0.24, add: 0.02, open: 0.04, rotate: 0 },
    };

    switch (biomeId) {
        case 'barren':
        case 'glacial':
        case 'arctic':
        case 'nebula':
        case 'ethereal':
            profile.DORMANT = { drop: 0.5, add: 0.0, open: 0.0, rotate: 0 };
            profile.STIR = { drop: 0.34, add: 0.01, open: 0.01, rotate: 0 };
            profile.BUILD = { drop: 0.16, add: 0.04, open: 0.04, rotate: 0 };
            profile.SURGE = { drop: 0.08, add: 0.08, open: 0.08, rotate: 0 };
            profile.CLIMAX = { drop: 0.04, add: 0.1, open: 0.1, rotate: 0 };
            profile.FALLOUT = { drop: 0.3, add: 0.01, open: 0.02, rotate: 0 };
            break;
        case 'oceanic':
            profile.DORMANT = { drop: 0.28, add: 0.01, open: 0.02, rotate: 0 };
            profile.STIR = { drop: 0.14, add: 0.03, open: 0.04, rotate: 0 };
            profile.BUILD = { drop: 0.05, add: 0.07, open: 0.08, rotate: 0 };
            profile.SURGE = { drop: 0.01, add: 0.13, open: 0.14, rotate: 0 };
            profile.CLIMAX = { drop: 0.0, add: 0.16, open: 0.18, rotate: 1 };
            profile.FALLOUT = { drop: 0.2, add: 0.02, open: 0.05, rotate: 0 };
            break;
        case 'fungal':
            profile.DORMANT = { drop: 0.18, add: 0.02, open: 0.03, rotate: 0 };
            profile.STIR = { drop: 0.07, add: 0.04, open: 0.05, rotate: 0 };
            profile.BUILD = { drop: 0.02, add: 0.08, open: 0.08, rotate: 0 };
            profile.SURGE = { drop: 0.0, add: 0.13, open: 0.1, rotate: 0 };
            profile.CLIMAX = { drop: 0.0, add: 0.16, open: 0.12, rotate: 1 };
            profile.FALLOUT = { drop: 0.14, add: 0.02, open: 0.04, rotate: 0 };
            break;
        case 'organic':
        case 'desert':
            profile.DORMANT = { drop: 0.2, add: 0.02, open: 0.02, rotate: 0 };
            profile.STIR = { drop: 0.08, add: 0.05, open: 0.04, rotate: 0 };
            profile.BUILD = { drop: 0.03, add: 0.11, open: 0.08, rotate: 0 };
            profile.SURGE = { drop: 0.0, add: 0.19, open: 0.12, rotate: 1 };
            profile.CLIMAX = { drop: 0.0, add: 0.23, open: 0.16, rotate: 1 };
            profile.FALLOUT = { drop: 0.18, add: 0.03, open: 0.04, rotate: 0 };
            break;
        case 'crystalline':
        case 'crystalloid':
            profile.DORMANT = { drop: 0.26, add: 0.01, open: 0.03, rotate: 0 };
            profile.STIR = { drop: 0.12, add: 0.04, open: 0.06, rotate: 0 };
            profile.BUILD = { drop: 0.04, add: 0.08, open: 0.12, rotate: 0 };
            profile.SURGE = { drop: 0.0, add: 0.12, open: 0.18, rotate: 1 };
            profile.CLIMAX = { drop: 0.0, add: 0.16, open: 0.24, rotate: 1 };
            profile.FALLOUT = { drop: 0.22, add: 0.02, open: 0.05, rotate: 0 };
            break;
        case 'quantum':
        case 'corrupted':
        case 'storm':
        case 'psychedelic':
            profile.DORMANT = { drop: 0.14, add: 0.04, open: 0.04, rotate: 0 };
            profile.STIR = { drop: 0.04, add: 0.09, open: 0.08, rotate: 0 };
            profile.BUILD = { drop: 0.0, add: 0.17, open: 0.12, rotate: 1 };
            profile.SURGE = { drop: 0.0, add: 0.26, open: 0.18, rotate: 1 };
            profile.CLIMAX = { drop: 0.0, add: 0.32, open: 0.24, rotate: 2 };
            profile.FALLOUT = { drop: 0.1, add: 0.05, open: 0.08, rotate: 0 };
            break;
        case 'volcanic':
        case 'abyssal':
            profile.DORMANT = { drop: 0.22, add: 0.01, open: 0.01, rotate: 0 };
            profile.STIR = { drop: 0.1, add: 0.03, open: 0.03, rotate: 0 };
            profile.BUILD = { drop: 0.03, add: 0.08, open: 0.05, rotate: 0 };
            profile.SURGE = { drop: 0.0, add: 0.14, open: 0.07, rotate: 0 };
            profile.CLIMAX = { drop: 0.0, add: 0.18, open: 0.1, rotate: 1 };
            profile.FALLOUT = { drop: 0.2, add: 0.02, open: 0.03, rotate: 0 };
            break;
        default:
            break;
    }

    return profile;
}

export function transformPhasePattern(pattern, voice, phaseCfg, rng) {
    const source = Array.isArray(pattern) ? pattern.slice() : [];
    const len = source.length;
    if (!len) return source;

    const voiceAddBias = voice === 'k' ? 0.58 : voice === 's' ? 0.42 : voice === 'h' ? 0.88 : 0.32;
    const voiceDropBias = voice === 'h' ? 0.75 : voice === 'b' ? 0.95 : 0.7;

    for (let i = 0; i < len; i++) {
        const strong = i % 4 === 0;
        const backbeat = (i + 2) % 4 === 0;
        const offbeat = i % 2 === 1;
        const turnaround = i >= len - 2;
        const prevHit = source[(i - 1 + len) % len] > 0;
        const nextHit = source[(i + 1) % len] > 0;
        const nearHit = prevHit || nextHit;
        const slotWeight = voice === 'k'
            ? (strong ? 1 : turnaround ? 0.72 : offbeat ? 0.2 : 0.42)
            : voice === 's'
                ? (backbeat ? 1 : offbeat ? 0.26 : 0.14)
                : voice === 'h'
                    ? (offbeat ? 1 : strong ? 0.28 : 0.6)
                    : (strong ? 0.72 : turnaround ? 0.28 : 0.1);

        if (source[i]) {
            const protect = strong || backbeat
                ? (voice === 'k' || voice === 's' ? 0.08 : 0.16)
                : turnaround
                    ? 0.45
                    : 1;
            if (rng.range(0, 1) < phaseCfg.drop * protect * voiceDropBias) {
                source[i] = 0;
                continue;
            }
            if (voice === 'h' && source[i] === 1 && rng.range(0, 1) < phaseCfg.open * slotWeight * 0.85) {
                source[i] = 2;
            }
            continue;
        }

        let addChance = phaseCfg.add * slotWeight * voiceAddBias;
        if (nearHit) addChance *= voice === 'h' ? 0.55 : 0.2;
        if (voice === 'k' && offbeat && !turnaround) addChance *= 0.35;
        if (voice === 's' && !backbeat && !offbeat) addChance *= 0.2;
        if (voice === 'b' && !strong) addChance *= 0.25;

        if (rng.range(0, 1) < addChance) {
            source[i] = voice === 'h' && rng.range(0, 1) < phaseCfg.open * (offbeat ? 1 : 0.35) ? 2 : 1;
        }
    }

    const rotateBase = voice === 'h' ? Math.min(1, phaseCfg.rotate || 0) : 0;
    const rotate = ((rotateBase % len) + len) % len;
    if (!rotate) return source;
    return source.slice(len - rotate).concat(source.slice(0, len - rotate));
}

export function buildPhasePatternBanks(options = {}) {
    const {
        patterns,
        cycleSteps,
        seed,
        biomeId,
    } = options;
    const profile = getPhasePatternProfile(biomeId);
    const phases = ['DORMANT', 'STIR', 'BUILD', 'SURGE', 'CLIMAX', 'FALLOUT'];
    const voices = ['k', 's', 'h', 'b'];
    const banks = {};

    phases.forEach((phase, phaseIdx) => {
        banks[phase] = {};
        voices.forEach((voice, voiceIdx) => {
            const phaseSeed = (seed + 97000 + phaseIdx * 173 + voiceIdx * 29 + cycleSteps * 7) >>> 0;
            banks[phase][voice] = transformPhasePattern(
                patterns[voice],
                voice,
                profile[phase],
                new RNG(phaseSeed)
            );
        });
    });

    return banks;
}

export const PercussionSubsystem = {
    id: 'percussion',
    buildDrumToneProfile,
    fitPatternToCycle,
    getPhasePatternProfile,
    transformPhasePattern,
    buildPhasePatternBanks,
};
