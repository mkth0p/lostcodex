const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export class DroneQualityPolicy {
    resolve({ qualityScalar = 1, backgroundMode = 'foreground-realtime', cpuClass = 'desktop-mid' } = {}) {
        let scalar = clamp(qualityScalar, 0.2, 1);
        if (backgroundMode === 'background-continuity') scalar = clamp(scalar - 0.12, 0.2, 1);

        const desktopBias = cpuClass.startsWith('desktop') ? 1 : 0.86;
        const effective = clamp(scalar * desktopBias, 0.2, 1);
        const degradeStage = effective > 0.84
            ? 'full'
            : effective > 0.62
                ? 'balanced'
                : effective > 0.42
                    ? 'reduced'
                    : 'survival';

        return {
            qualityScalar: effective,
            degradeStage,
            sourceComplexity: clamp(0.46 + effective * 0.64, 0.35, 1),
            maxSupersawVoices: effective > 0.72 ? 5 : effective > 0.5 ? 3 : 2,
            shimmerEnabled: effective > 0.52,
            ambienceEnabled: effective > 0.3,
            echoEnabled: effective > 0.36,
        };
    }
}
