export function buildTransport(stepCount, bpm) {
    const safeBpm = Number.isFinite(bpm) && bpm > 0 ? bpm : 120;
    const cycleSteps = Math.max(4, Math.min(32, Math.round(stepCount || 16)));
    const stepSeconds = 15 / safeBpm;

    return {
        bpm: safeBpm,
        cycleSteps,
        stepSeconds,
        stepMs: stepSeconds * 1000,
        cycleMs: stepSeconds * 1000 * cycleSteps,
    };
}

