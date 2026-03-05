import { RNG } from '../../rng.js';
import { buildScaleChord, getChordFunctionKey, normalizeChordSymbol } from '../subsystems/harmony.js';

const LEGACY_CHORD_TRANSITIONS = {
    I: { IV: 4, V: 5, vi: 3, ii: 2 },
    ii: { V: 6, vi: 2, IV: 2 },
    iii: { vi: 5, IV: 3, I: 2 },
    IV: { I: 3, V: 5, ii: 2 },
    V: { I: 7, vi: 2, iii: 1 },
    vi: { IV: 4, ii: 3, V: 3 },
    vii: { I: 8, iii: 2 },
    i: { iv: 4, v: 4, VI: 3, VII: 3 },
    III: { VI: 5, iv: 3, i: 2 },
    iv: { i: 4, v: 4, ii: 2 },
    v: { i: 6, VI: 3, III: 1 },
    VI: { iv: 4, ii: 3, v: 3 },
    VII: { III: 6, i: 4 },
};

export function updateChordProgressionLegacy(engine) {
    if (!engine.playing || !engine._progression || !engine._progression.length) return;

    engine._chordName = normalizeChordSymbol(engine._progression[engine._chordIndex]);
    const chordName = engine._chordName || 'I';
    const chordKey = getChordFunctionKey(chordName);
    const intervals = buildScaleChord(chordName, engine.planet);
    engine._currentChordIntervals = intervals;

    const now = engine.ctx ? engine.ctx.currentTime : 0;
    const ramp = 2.5;
    if (engine.harmonicNodes && engine.ctx) {
        const rootPitch = engine._getStepFrequency(engine.planet, intervals[0], 1);
        if (engine.harmonicNodes.baseOsc) engine.harmonicNodes.baseOsc.frequency.linearRampToValueAtTime(rootPitch * 0.5, now + ramp);
        if (engine.harmonicNodes.d1) engine.harmonicNodes.d1.frequency.linearRampToValueAtTime(rootPitch, now + ramp);
        if (engine.harmonicNodes.d2) engine.harmonicNodes.d2.frequency.linearRampToValueAtTime(rootPitch * 2 + (engine.planet?.droneDetune || 0), now + ramp);
        if (engine.harmonicNodes.fmCarrier) engine.harmonicNodes.fmCarrier.frequency.linearRampToValueAtTime(rootPitch, now + ramp);
        if (engine.harmonicNodes.fmMod) engine.harmonicNodes.fmMod.frequency.linearRampToValueAtTime(rootPitch * (engine.planet?.ac?.fmRatio || 1), now + ramp);

        if (engine.harmonicNodes.pads) {
            engine.harmonicNodes.pads.forEach((pad) => {
                const interval = intervals[pad.stepIndex % intervals.length];
                const oct = pad.stepIndex > 2 ? 2 : 1;
                const targetFreq = engine._getStepFrequency(engine.planet, interval, (engine.planet?.ac?.octScale || 1) * oct);
                pad.osc.frequency.linearRampToValueAtTime(targetFreq + (targetFreq * pad.detuneRatio), now + ramp);
            });
        }
    }

    const transitionMap = LEGACY_CHORD_TRANSITIONS[chordKey] || {};
    const pool = [];
    engine._progression.forEach((candidate) => {
        const weight = transitionMap[getChordFunctionKey(candidate)] || 1;
        for (let i = 0; i < weight; i++) pool.push(candidate);
    });

    const rng = new RNG((engine.planet?.seed || 0) + 90000 + engine.stepChord++);
    const nextTarget = pool.length ? rng.pick(pool) : engine._progression[0];
    engine._chordIndex = engine._progression.indexOf(nextTarget);
    if (engine._chordIndex === -1) engine._chordIndex = 0;

    const transport = engine.transport || engine._buildTransport(engine.planet);
    let minCycles = 2;
    let maxCycles = 3;
    if (['V', 'vii', 'v', 'ii'].includes(chordKey)) {
        minCycles = 1;
        maxCycles = 2;
    }
    if (['I', 'i', 'vi', 'VI'].includes(chordKey)) {
        minCycles = 2;
        maxCycles = 4;
    }
    if (transport.cycleSteps <= 8 && !['V', 'vii', 'v', 'ii'].includes(chordKey)) {
        minCycles += 1;
        maxCycles += 1;
    }

    const chordCycles = rng.int(minCycles, maxCycles + 1);
    const durationMs = transport.cycleMs * chordCycles;
    engine._setManagedTimeout(() => engine._updateChord(), durationMs);
}

