import { RNG } from '../../rng.js';
import { CHORD_TEMPLATES } from '../../data.js';

export const BASS_PATTERNS = [
    [1, 0, 0, 0, 1, 0, 0, 0],
    [1, 0, 0, 1, 0, 0, 1, 0],
    [0, 0, 1, 0, 0, 0, 1, 0],
    [1, 1, 1, 1, 1, 1, 1, 1],
    [1, 0, 1, 0, 1, 0, 1, 0],
];

export const CHORD_TRANSITIONS = {
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

export function resolveBassPattern(seed, cycleSteps, fitPatternToCycle) {
    const rng = new RNG(seed + 777);
    const picked = rng.pick(BASS_PATTERNS);
    if (typeof fitPatternToCycle === 'function') {
        return fitPatternToCycle(picked, cycleSteps);
    }
    return picked.slice();
}

export function normalizeChordSymbol(symbol) {
    const raw = `${symbol || 'I'}`.trim();
    if (!raw) return 'I';
    // Normalize common glyph variants so legacy encoded symbols still resolve.
    const canonical = raw
        .replace(/[°º]/g, '')
        .replace(/dim/gi, '')
        .replace(/[^\w#+-]/g, '');
    return canonical || 'I';
}

export function getChordFunctionKey(symbol) {
    const normalized = normalizeChordSymbol(symbol);
    const match = normalized.match(/[ivIV]+/);
    return match ? match[0] : 'I';
}

export function getChordDegreeIndex(symbol, scaleLength) {
    const roman = getChordFunctionKey(symbol).toUpperCase();
    const degreeOrder = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];
    const rawIndex = Math.max(0, degreeOrder.indexOf(roman));
    if (!scaleLength || scaleLength >= degreeOrder.length) return rawIndex;
    return Math.min(rawIndex, scaleLength - 1);
}

export function buildScaleChord(symbol, planet) {
    const normalized = normalizeChordSymbol(symbol);
    const scale = Array.isArray(planet?.scale) && planet.scale.length ? planet.scale : null;
    if (!scale || scale.length < 3) return CHORD_TEMPLATES[normalized] || [0, 4, 7];

    const rootIndex = getChordDegreeIndex(normalized, scale.length);
    const chord = [];
    for (let i = 0; i < 3; i++) {
        const absIndex = rootIndex + i * 2;
        const scaleIndex = absIndex % scale.length;
        const octave = Math.floor(absIndex / scale.length);
        chord.push(scale[scaleIndex] + octave * 12);
    }

    for (let i = 1; i < chord.length; i++) {
        while (chord[i] <= chord[i - 1]) chord[i] += 12;
    }
    return chord;
}

export function selectNextChord(options = {}) {
    const {
        currentChordKey,
        progression,
        getChordFunctionKey,
        rng,
    } = options;
    const tMap = CHORD_TRANSITIONS[currentChordKey] || {};
    const pool = [];
    progression.forEach((cand) => {
        const weight = tMap[getChordFunctionKey(cand)] || 1;
        for (let i = 0; i < weight; i++) pool.push(cand);
    });
    const nextTarget = pool.length ? rng.pick(pool) : progression[0];
    let nextChordIndex = progression.indexOf(nextTarget);
    if (nextChordIndex === -1) nextChordIndex = 0;
    return { nextTarget, nextChordIndex };
}

export function scheduleBassNote(engine, p, dest, octScale, gateSeconds = 0.4, scheduledTime = null) {
    const ctx = engine.ctx;
    const chordBase = engine._currentChordIntervals[0];
    const freq = engine._getStepFrequency(p, chordBase, octScale);

    const osc = ctx.createOscillator();
    const sub = ctx.createOscillator();
    const env = ctx.createGain();

    osc.type = 'triangle';
    sub.type = 'sine';
    osc.frequency.value = freq;
    sub.frequency.value = freq * 0.5;

    const now = Number.isFinite(scheduledTime) ? Math.max(ctx.currentTime, scheduledTime) : ctx.currentTime;
    const noteDur = Math.max(0.22, gateSeconds || 0.4);
    env.gain.setValueAtTime(0, now);
    env.gain.linearRampToValueAtTime(0.4, now + Math.min(0.03, noteDur * 0.18));
    env.gain.exponentialRampToValueAtTime(0.001, now + noteDur * 0.85);

    osc.connect(env);
    sub.connect(env);
    env.connect(dest);
    osc.start(now);
    sub.start(now);
    osc.stop(now + noteDur);
    sub.stop(now + noteDur);
    engine.nodes.push(osc, sub, env);
}

export function startBassLine(engine, p, dest) {
    const ctx = engine.ctx;
    const transport = engine.transport || engine._buildTransport(p);
    const bassBus = ctx.createGain();
    bassBus.gain.value = 0.55;
    bassBus.connect(dest);
    engine.nodes.push(bassBus);

    const activePattern = resolveBassPattern(
        p.seed,
        transport.cycleSteps,
        (pattern, length) => engine._fitPatternToCycle(pattern, length)
    );
    const bassOctave = p.biome.id === 'abyssal' ? 0.5 : 1.0;
    const bassStepMs = transport.stepMs;
    let bassStep = 0;
    const bassScheduled = engine._scheduleRecurringChannel(
        'bass',
        transport.stepSeconds,
        ({ scheduleTime }) => {
            if (!engine.playing) return;
            if (activePattern[bassStep]) {
                scheduleBassNote(engine, p, bassBus, bassOctave, transport.stepSeconds * 1.9, scheduleTime);
            }
            bassStep = (bassStep + 1) % transport.cycleSteps;
        }
    );

    if (!bassScheduled) {
        engine.intervals.push(setInterval(() => {
            if (!engine.playing) return;
            if (activePattern[bassStep]) {
                scheduleBassNote(engine, p, bassBus, bassOctave, transport.stepSeconds * 1.9);
            }
            bassStep = (bassStep + 1) % transport.cycleSteps;
        }, bassStepMs));
    }
}

export function updateChordProgression(engine) {
    if (!engine.playing || !engine._progression || !engine._progression.length) return;

    engine._chordName = normalizeChordSymbol(engine._progression[engine._chordIndex]);
    const c = engine._chordName || 'I';
    const cKey = getChordFunctionKey(c);
    const intervals = buildScaleChord(c, engine.planet);
    engine._currentChordIntervals = intervals;

    const now = engine.ctx ? engine.ctx.currentTime : 0;
    const ramp = typeof engine._getChordGlideSeconds === 'function'
        ? engine._getChordGlideSeconds(engine.planet)
        : 2.2;

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

    const rng = new RNG((engine.planet?.seed || 0) + 90000 + engine.stepChord++);
    const next = selectNextChord({
        currentChordKey: cKey,
        progression: engine._progression,
        getChordFunctionKey,
        rng,
    });
    engine._chordIndex = next.nextChordIndex;

    const transport = engine.transport || engine._buildTransport(engine.planet);
    let minCycles = 2;
    let maxCycles = 3;
    if (['V', 'vii', 'v', 'ii'].includes(cKey)) {
        minCycles = 1;
        maxCycles = 2;
    }
    if (['I', 'i', 'vi', 'VI'].includes(cKey)) {
        minCycles = 2;
        maxCycles = 4;
    }
    if (transport.cycleSteps <= 8 && !['V', 'vii', 'v', 'ii'].includes(cKey)) {
        minCycles += 1;
        maxCycles += 1;
    }

    const chordCycles = rng.int(minCycles, maxCycles + 1);
    const durMs = transport.cycleMs * chordCycles;
    engine._setManagedTimeout(() => engine._updateChord(), durMs);
}

export const HarmonySubsystem = {
    id: 'harmony',
    resolveBassPattern,
    normalizeChordSymbol,
    getChordFunctionKey,
    getChordDegreeIndex,
    buildScaleChord,
    selectNextChord,
    scheduleBassNote,
    startBassLine,
    updateChordProgression,
};
