const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function detectCpuClass() {
    const cores = Number(globalThis?.navigator?.hardwareConcurrency || 4);
    if (cores >= 12) return 'desktop-high';
    if (cores >= 8) return 'desktop-mid';
    if (cores >= 4) return 'mobile-balanced';
    return 'mobile-low';
}

export class AdaptiveQualityGovernor {
    constructor() {
        this.cpuClass = detectCpuClass();
        this.last = {
            qualityScalar: 1,
            voiceBudget: 64,
            counterlineEnabled: true,
            ambienceRateMul: 1,
            percussionDensityMul: 1,
            detailDensityMul: 1,
            continuityPriority: 1,
            cpuClass: this.cpuClass,
            cpuTier: this.cpuClass,
            degradeStage: 'full',
        };
    }

    evaluate({ activeNodes = 0, schedulerMaxLateMs = 0, macroComplexity = 0.5, backgroundMode = 'foreground-realtime' } = {}) {
        const nodePressure = clamp((activeNodes - 170) / 190, 0, 1);
        const latePressure = clamp(schedulerMaxLateMs / 12, 0, 1);
        const complexityPressure = clamp((macroComplexity - 0.55) * 1.6, 0, 1);
        let pressure = clamp(nodePressure * 0.54 + latePressure * 0.28 + complexityPressure * 0.18, 0, 1);
        if (backgroundMode === 'background-continuity') pressure = clamp(pressure + 0.25, 0, 1);

        const classBudget = this.cpuClass === 'desktop-high'
            ? 84
            : this.cpuClass === 'desktop-mid'
                ? 68
                : this.cpuClass === 'mobile-balanced'
                    ? 56
                    : 40;
        const voiceBudget = Math.max(20, Math.round(classBudget * (1 - pressure * 0.62)));
        const qualityScalar = clamp(1 - pressure * 0.7, 0.25, 1);
        const counterlineEnabled = qualityScalar > 0.58;
        const ambienceRateMul = clamp(0.62 + qualityScalar * 0.52, 0.38, 1.12);
        const percussionDensityMul = clamp(0.42 + qualityScalar * 0.36, 0.24, 0.88);
        const detailDensityMul = clamp(0.34 + qualityScalar * 0.8, 0.3, 1.18);
        const continuityPriority = clamp(0.72 + (1 - pressure) * 0.28, 0.72, 1);
        const degradeStage = qualityScalar > 0.84
            ? 'full'
            : qualityScalar > 0.64
                ? 'balanced'
                : qualityScalar > 0.46
                    ? 'reduced'
                    : 'survival';

        this.last = {
            qualityScalar,
            voiceBudget,
            counterlineEnabled,
            ambienceRateMul,
            percussionDensityMul,
            detailDensityMul,
            continuityPriority,
            cpuClass: this.cpuClass,
            cpuTier: this.cpuClass,
            degradeStage,
        };
        return this.last;
    }
}
