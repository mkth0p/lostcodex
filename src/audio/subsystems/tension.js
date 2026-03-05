const fallbackClamp = (value, min, max) => Math.min(max, Math.max(min, value));

function useClamp(clamp, value, min, max) {
    return (typeof clamp === 'function' ? clamp : fallbackClamp)(value, min, max);
}

export function buildTensionProfile(options = {}) {
    const {
        biomeId = 'default',
        melodyDensity = 0.05,
        clamp,
        defaultProfile,
        biomeProfiles,
    } = options;

    const density = useClamp(clamp, melodyDensity, 0.01, 0.35);
    const merged = {
        ...defaultProfile,
        ...((biomeProfiles && biomeProfiles[biomeId]) || {}),
    };
    const densityLift = (density - 0.08) * 0.05;

    return {
        ...merged,
        riseRate: useClamp(clamp, merged.riseRate + densityLift, 0.012, 0.05),
        surgeChance: useClamp(clamp, merged.surgeChance + densityLift * 1.8, 0, 0.35),
        climaxThreshold: useClamp(clamp, merged.climaxThreshold, 0.74, 0.92),
        fillVoices: [...(merged.fillVoices || [])],
        polyVoices: [...(merged.polyVoices || [])],
        climaxRatios: [...(merged.climaxRatios || defaultProfile.climaxRatios)],
    };
}

export function resolveTensionState(options = {}) {
    const {
        tensionProfile,
        tension = 0,
        tensionTick = 0,
        cycleSteps = 16,
        stepIndex = 0,
        climaxStartedDrain = false,
        climaxFired = false,
        clamp,
    } = options;
    const safeCycleSteps = Math.max(1, cycleSteps || 1);
    const cyclePos = ((stepIndex % safeCycleSteps) + safeCycleSteps) % safeCycleSteps / safeCycleSteps;
    const energy = useClamp(clamp, tension || 0, 0, 1);
    const phaseAngle = (tensionTick || 0) * tensionProfile.pulseRate + cyclePos * Math.PI * 2 + tensionProfile.phaseOffset;
    const pocket = 0.5 + Math.sin(phaseAngle) * 0.5;

    let phase = 'DORMANT';
    if (climaxStartedDrain) phase = 'FALLOUT';
    else if (climaxFired || energy >= Math.min(0.98, tensionProfile.climaxThreshold + 0.06)) phase = 'CLIMAX';
    else if (energy >= tensionProfile.surgePoint) phase = 'SURGE';
    else if (energy >= tensionProfile.buildPoint) phase = 'BUILD';
    else if (energy >= tensionProfile.lowPoint) phase = 'STIR';

    return { phase, energy, cyclePos, pocket, profile: tensionProfile };
}

export function resolveRhythmState(options = {}) {
    const {
        planet,
        barCount = 0,
        fillsEnabled = true,
        tensionState,
        clamp,
    } = options;
    const tension = tensionState;
    const profile = tension.profile;
    const density = useClamp(clamp, (planet?.melodyDensity || 0.05) * 4.5, 0.2, 1.4);
    const pocketLift = Math.max(0, tension.pocket - 0.42);
    const phaseBoost = tension.phase === 'SURGE'
        ? 0.08
        : tension.phase === 'CLIMAX'
            ? 0.14
            : tension.phase === 'FALLOUT'
                ? -0.05
                : 0;
    const fillModulo = Math.max(2, Math.round(profile.fillEvery || 4));
    const fillBar = (barCount % fillModulo) === fillModulo - 1;
    const fillWindow = tension.cyclePos >= profile.fillStart;
    const preferredFillVoices = (profile.fillVoices || []).filter((v) => typeof v === 'string');
    const preferredPolyVoices = (profile.polyVoices || []).filter((v) => typeof v === 'string');

    return {
        phase: tension.phase,
        energy: tension.energy,
        chaosChance: useClamp(
            clamp,
            Math.max(0, tension.energy - profile.surgePoint) * 1.2 * profile.chaosBias
            + (tension.phase === 'CLIMAX' ? 0.05 * profile.chaosBias : 0),
            0,
            0.55
        ),
        ghostChance: useClamp(
            clamp,
            (0.045 + tension.energy * 0.08 + pocketLift * 0.12) * profile.ghostBias,
            0.01,
            0.45
        ),
        fillActive: fillsEnabled && fillWindow && fillBar
            && tension.energy > Math.max(profile.lowPoint, profile.buildPoint - 0.08),
        fillChance: useClamp(
            clamp,
            (0.12 + tension.energy * 0.24 + phaseBoost + pocketLift * 0.08) * profile.fillBias,
            0.04,
            0.95
        ),
        accentChance: useClamp(
            clamp,
            (0.03 + tension.energy * 0.12 + pocketLift * 0.08) * profile.accentBias,
            0.02,
            0.52
        ),
        kickPush: useClamp(
            clamp,
            (tension.energy * 0.05 + (tension.phase === 'SURGE' ? 0.05 : 0)) * profile.kickBias * density,
            0,
            0.32
        ),
        snarePush: useClamp(
            clamp,
            (tension.energy * 0.045 + (tension.phase === 'CLIMAX' ? 0.045 : 0)) * profile.snareBias * density,
            0,
            0.24
        ),
        hatPush: useClamp(
            clamp,
            (0.02 + tension.energy * 0.1 + Math.abs(tension.pocket - 0.5) * 0.16) * profile.hatBias,
            0,
            0.5
        ),
        openHatChance: useClamp(
            clamp,
            (0.06 + tension.energy * 0.14 + (tension.phase === 'SURGE' ? 0.08 : 0)) * profile.openHatBias,
            0.03,
            0.72
        ),
        extraVoiceChance: useClamp(
            clamp,
            (0.08 + tension.energy * 0.14 + (tension.phase === 'BUILD' ? 0.04 : 0)) * profile.extraBias,
            0.02,
            0.95
        ),
        velocityLift: useClamp(
            clamp,
            1 + tension.energy * 0.18 + (tension.phase === 'CLIMAX' ? 0.12 : tension.phase === 'FALLOUT' ? -0.06 : 0),
            0.82,
            1.36
        ),
        fillVoices: preferredFillVoices,
        polyVoices: preferredPolyVoices,
    };
}

export const TensionSubsystem = {
    id: 'tension',
    buildTensionProfile,
    resolveTensionState,
    resolveRhythmState,
};
