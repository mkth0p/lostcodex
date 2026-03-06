const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export const DEFAULT_OVERLAY_FLAGS = Object.freeze({
    extendedHarmony: true,
    counterpoint: true,
    microtonalWarp: true,
    droneLayer: true,
    moonCanons: true,
    adaptivePercussion: true,
    ambientEcosystem: true,
});

export function normalizeOverlayFlags(next = {}) {
    return {
        extendedHarmony: typeof next.extendedHarmony === 'boolean' ? next.extendedHarmony : DEFAULT_OVERLAY_FLAGS.extendedHarmony,
        counterpoint: typeof next.counterpoint === 'boolean' ? next.counterpoint : DEFAULT_OVERLAY_FLAGS.counterpoint,
        microtonalWarp: typeof next.microtonalWarp === 'boolean' ? next.microtonalWarp : DEFAULT_OVERLAY_FLAGS.microtonalWarp,
        droneLayer: typeof next.droneLayer === 'boolean' ? next.droneLayer : DEFAULT_OVERLAY_FLAGS.droneLayer,
        moonCanons: typeof next.moonCanons === 'boolean' ? next.moonCanons : DEFAULT_OVERLAY_FLAGS.moonCanons,
        adaptivePercussion: typeof next.adaptivePercussion === 'boolean' ? next.adaptivePercussion : DEFAULT_OVERLAY_FLAGS.adaptivePercussion,
        ambientEcosystem: typeof next.ambientEcosystem === 'boolean' ? next.ambientEcosystem : DEFAULT_OVERLAY_FLAGS.ambientEcosystem,
    };
}

export function enforceLayerContracts({
    layerMix = {},
    identityProfile = null,
    section = 'INTRO',
    qualityScalar = 1,
    paceClass = 'medium',
} = {}) {
    const profileTargets = identityProfile?.layerTargets || {};
    const targetDroneDb = identityProfile?.droneTargetDb || null;
    const dronePresence = targetDroneDb
        ? clamp(((targetDroneDb.max + 30) / 24), 0.12, 1)
        : 0.52;
    const melodyPresence = clamp(identityProfile?.melodyPresence ?? 0.5, 0.02, 1);
    const percussionPresence = clamp(identityProfile?.percussionPresence ?? 0.5, 0.02, 1);
    const ambiencePresence = clamp(identityProfile?.ambiencePresence ?? 0.6, 0.05, 1.2);
    const ambientBias = identityProfile?.paceClass === 'slow' ? 0.18 : identityProfile?.paceClass === 'fast' ? -0.04 : 0.08;
    const paceBias = paceClass === 'slow' ? 0.14 : paceClass === 'fast' ? -0.08 : 0;
    const sectionBias = section === 'SURGE' ? 0.08 : section === 'AFTERGLOW' ? 0.12 : 0;
    const qualityBias = clamp(qualityScalar, 0.25, 1);

    const drones = clamp((layerMix.drones ?? profileTargets.drones ?? 0.7) + ambientBias + paceBias + sectionBias, 0.02, 1.28)
        * (0.56 + qualityBias * 0.42)
        * clamp(0.42 + dronePresence * 0.92, 0.24, 1.26);
    const pads = clamp((layerMix.pads ?? profileTargets.pads ?? 0.7) + ambientBias * 0.7 + sectionBias * 0.4, 0.02, 1.24)
        * (0.64 + qualityBias * 0.36)
        * clamp(0.48 + ambiencePresence * 0.62, 0.24, 1.32);
    const melody = clamp((layerMix.melody ?? profileTargets.melody ?? 0.84) + (paceClass === 'slow' ? -0.08 : paceClass === 'fast' ? 0.05 : 0), 0.02, 1.3)
        * (0.62 + qualityBias * 0.36)
        * clamp(0.34 + melodyPresence * 1.04, 0.12, 1.42);
    const bass = clamp((layerMix.bass ?? profileTargets.bass ?? 0.72) + (paceClass === 'fast' ? 0.06 : 0), 0.02, 1.2)
        * (0.66 + qualityBias * 0.34);
    const percussion = clamp((layerMix.percussion ?? profileTargets.percussion ?? 0.8) + (paceClass === 'slow' ? -0.2 : paceClass === 'fast' ? 0.08 : -0.04), 0.01, 1.2)
        * (0.54 + qualityBias * 0.46)
        * clamp(0.08 + percussionPresence * 1.34, 0.03, 1.46);
    const ambience = clamp((layerMix.ambience ?? profileTargets.ambience ?? 0.66) + ambientBias * 1.05 + sectionBias * 0.6, 0.02, 1.36)
        * (0.66 + qualityBias * 0.34)
        * clamp(0.32 + ambiencePresence * 0.94, 0.16, 1.56);
    const fx = clamp((layerMix.fx ?? profileTargets.fx ?? 0.65) + (paceClass === 'slow' ? -0.1 : paceClass === 'fast' ? 0.05 : -0.03), 0.01, 1.1)
        * (0.58 + qualityBias * 0.42);

    return { drones, pads, melody, bass, percussion, ambience, fx };
}

export function estimateDroneAudibilityDb({ droneState = null, mixTelemetry = null, layerMix = null, identityProfile = null } = {}) {
    if (!droneState) return -60;
    const droneBusDb = mixTelemetry?.layerDb?.drones?.rmsDb;
    const droneActivity = clamp(
        (droneState?.outputLevel || 0) * 0.55
        + (droneState?.resonatorEnergy || 0) * 0.25
        + (droneState?.loopFill || 0) * 0.2,
        0,
        2,
    );
    if (Number.isFinite(droneBusDb) && !(droneBusDb <= -90 && droneActivity > 0.28)) {
        return Math.round(clamp(droneBusDb, -96, 6) * 10) / 10;
    }

    const resonance = droneState?.resonatorEnergy ?? 0;
    const ambience = droneState?.ambienceDepth ?? 0;
    const loop = droneState?.loopFill ?? 0;
    const outputLevel = clamp(droneState?.outputLevel ?? 0.35, 0, 1.2);
    const drones = layerMix?.drones ?? 0.7;
    const signal = clamp(
        0.16
        + drones * 0.34
        + outputLevel * 0.44
        + resonance * 0.18
        + ambience * 0.16
        + loop * 0.1,
        0.02,
        1.25,
    );
    const inferredDb = -50 + signal * 30;
    const peakDb = Number.isFinite(mixTelemetry?.preLimiterPeakDb) ? mixTelemetry.preLimiterPeakDb : null;
    const blended = peakDb === null
        ? inferredDb
        : ((inferredDb * 0.72) + ((peakDb - 5) * 0.28));

    const target = identityProfile?.droneTargetDb;
    const constrained = target && Number.isFinite(target.min) && Number.isFinite(target.max)
        ? clamp((blended * 0.68) + (((target.min + target.max) * 0.5) * 0.32), target.min - 10, target.max + 10)
        : blended;
    return Math.round(clamp(constrained, -60, -6) * 10) / 10;
}
