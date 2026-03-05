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

export const MelodySubsystem = {
    id: 'melody',
    getMelodyStride,
};
