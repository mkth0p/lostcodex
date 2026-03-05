const fallbackClamp = (value, min, max) => Math.min(max, Math.max(min, value));

export function getMelodyStride(options = {}) {
    const {
        melodyDensity = 0.05,
        cycleSteps = 16,
        clamp,
    } = options;
    const clampFn = typeof clamp === 'function' ? clamp : fallbackClamp;
    const density = clampFn(melodyDensity, 0.01, 0.35);
    let stride = density >= 0.2 ? 1 : density >= 0.09 ? 2 : 4;
    if (cycleSteps <= 8 && stride > 1) stride -= 1;
    return clampFn(stride, 1, cycleSteps);
}

export function getPerformanceProfile(options = {}) {
    const {
        melodyDensity = 0.05,
        stepSeconds = 0.125,
        activeNodes = 0,
        clamp,
    } = options;
    const clampFn = typeof clamp === 'function' ? clamp : fallbackClamp;
    const density = clampFn(melodyDensity, 0.01, 0.35);
    const nodePressure = clampFn((activeNodes - 170) / 220, 0, 1);
    const speedPressure = clampFn((0.14 - stepSeconds) / 0.07, 0, 1);
    const densityPressure = clampFn((density - 0.1) / 0.18, 0, 1);
    const pressure = clampFn(nodePressure * 0.55 + speedPressure * 0.2 + densityPressure * 0.25, 0, 1);
    return {
        density,
        stepSeconds,
        activeNodes,
        pressure,
        scalar: 1 - pressure * 0.7,
    };
}

export function getAdditiveVoiceLifetime(name, atk, dur) {
    const baseLifetime = Math.max(0.4, (atk || 0) + (dur || 0));
    switch (name) {
        case 'marimba': return Math.min(baseLifetime, 2.6) + 0.3;
        case 'metallic': return 10.5;
        case 'crystal_chimes': return 15.8;
        case 'gong': return 20.8;
        case 'brass_pad': return Math.max(atk || 0, 1.5) + (dur || 0) + 0.9;
        default: return baseLifetime + 0.8;
    }
}

export const MelodySubsystem = {
    id: 'melody',
    getMelodyStride,
    getPerformanceProfile,
    getAdditiveVoiceLifetime,
};
