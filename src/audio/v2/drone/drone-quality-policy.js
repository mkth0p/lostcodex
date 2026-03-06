const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export class DroneQualityPolicy {
    resolve({
        qualityScalar = 1,
        backgroundMode = 'foreground-realtime',
        cpuClass = 'desktop-mid',
        richnessTier = 'balanced',
    } = {}) {
        let scalar = clamp(qualityScalar, 0.2, 1);
        if (backgroundMode === 'background-continuity') scalar = clamp(scalar - 0.12, 0.2, 1);

        const desktopBias = cpuClass.startsWith('desktop') ? 1 : 0.86;
        const richnessBias = richnessTier === 'lush'
            ? (cpuClass.startsWith('desktop') ? 0.08 : 0.04)
            : richnessTier === 'sparse'
                ? -0.04
                : 0;
        const effective = clamp(scalar * desktopBias + richnessBias, 0.2, 1);
        const degradeStage = effective > 0.84
            ? 'full'
            : effective > 0.62
                ? 'balanced'
                : effective > 0.42
                    ? 'reduced'
                    : 'survival';

        // Degrade order: accents -> supersaw/noise -> bed complexity.
        const accentDensityMul = degradeStage === 'full'
            ? 1
            : degradeStage === 'balanced'
                ? 0.72
                : degradeStage === 'reduced'
                    ? 0.46
                    : 0.28;
        const supersawMul = degradeStage === 'full'
            ? 1
            : degradeStage === 'balanced'
                ? 0.78
                : degradeStage === 'reduced'
                    ? 0.52
                    : 0.26;
        const noiseMul = degradeStage === 'full'
            ? 1
            : degradeStage === 'balanced'
                ? 0.8
                : degradeStage === 'reduced'
                    ? 0.58
                    : 0.34;
        const bedComplexity = degradeStage === 'full'
            ? (richnessTier === 'lush' ? 1 : richnessTier === 'sparse' ? 0.78 : 0.9)
            : degradeStage === 'balanced'
                ? (richnessTier === 'lush' ? 0.86 : 0.78)
                : degradeStage === 'reduced'
                    ? 0.66
                    : 0.52;

        return {
            qualityScalar: effective,
            degradeStage,
            sourceComplexity: clamp(0.46 + effective * 0.64, 0.35, 1),
            maxSupersawVoices: supersawMul > 0.9 ? 5 : supersawMul > 0.62 ? 3 : 2,
            shimmerEnabled: effective > 0.52,
            ambienceEnabled: effective > 0.3,
            echoEnabled: effective > 0.36,
            accentDensityMul,
            supersawMul,
            noiseMul,
            bedComplexity,
        };
    }
}
