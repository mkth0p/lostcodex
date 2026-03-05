import { RNG } from '../../rng.js';

export function getMoonWavePool(planet) {
    switch (planet?.biome?.id) {
        case 'crystalline':
        case 'crystalloid':
        case 'glacial':
        case 'arctic':
            return ['sine', 'triangle'];
        case 'oceanic':
        case 'ethereal':
        case 'nebula':
            return ['sine'];
        case 'organic':
        case 'fungal':
        case 'desert':
            return ['triangle', 'sine'];
        case 'corrupted':
        case 'quantum':
        case 'storm':
        case 'psychedelic':
            return ['triangle', 'square'];
        case 'volcanic':
        case 'abyssal':
            return ['triangle', 'sine'];
        default:
            return ['sine', 'triangle'];
    }
}

export function buildMoonProfile(engine, planet) {
    const moonCount = engine._clamp(Math.round(planet?.numMoons || 0), 0, 4);
    if (!moonCount) return [];

    const rng = new RNG((planet?.seed || 0) + 205000);
    const waves = getMoonWavePool(planet);
    const panPositions = moonCount === 1
        ? [0]
        : moonCount === 2
            ? [-0.42, 0.42]
            : moonCount === 3
                ? [-0.58, 0, 0.58]
                : [-0.66, -0.22, 0.22, 0.66];
    const profiles = [];

    for (let i = 0; i < moonCount; i++) {
        const leadingMoon = i === 0;
        const delayBase = 0.75 + i * 0.85;
        let degreeShift = rng.pick([1, 2, 4, 5]);
        if (!leadingMoon && rng.bool(0.4)) degreeShift += 1;
        if (leadingMoon && moonCount > 1 && rng.bool(0.28)) degreeShift = -1;

        profiles.push({
            delaySteps: delayBase + rng.pick([0, 0.25, 0.5]),
            degreeShift,
            octaveOffset: (!leadingMoon && rng.bool(0.4)) ? 1 : 0,
            gain: engine._clamp(0.11 - i * 0.022, 0.05, 0.11),
            chance: engine._clamp(0.64 - i * 0.16, 0.22, 0.68),
            pan: (panPositions[i] ?? 0) + rng.range(-0.08, 0.08),
            detuneCents: rng.range(-9, 9),
            filterMul: 2.3 + i * 0.55 + rng.range(-0.2, 0.25),
            wave: rng.pick(waves),
        });
    }

    return profiles;
}

export function shiftScaleStep(planet, baseStep, degreeShift = 0, octaveOffset = 0) {
    const scale = Array.isArray(planet?.scale) && planet.scale.length ? planet.scale : null;
    if (!scale) return baseStep + degreeShift + octaveOffset * 12;

    const norm = ((baseStep % 12) + 12) % 12;
    let degreeIndex = scale.indexOf(norm);
    if (degreeIndex === -1) {
        let nearestIdx = 0;
        let nearestDist = Infinity;
        scale.forEach((value, idx) => {
            const direct = Math.abs(value - norm);
            const wrapped = Math.min(direct, 12 - direct);
            if (wrapped < nearestDist) {
                nearestDist = wrapped;
                nearestIdx = idx;
            }
        });
        degreeIndex = nearestIdx;
    }

    const scaleOctave = Math.floor(baseStep / 12);
    const absoluteDegree = degreeIndex + scaleOctave * scale.length + degreeShift + octaveOffset * scale.length;
    const wrappedDegree = ((absoluteDegree % scale.length) + scale.length) % scale.length;
    const octave = Math.floor((absoluteDegree - wrappedDegree) / scale.length);
    return scale[wrappedDegree] + octave * 12;
}

// Each moon acts like a quiet satellite canon: a delayed, scale-aware answer to the lead line.
export function scheduleMoonCanons(engine, planet, dest, step, meta = {}) {
    if (!engine.ctx || !engine.playing || !Number.isFinite(step)) return;
    const moons = engine._moonProfile || [];
    if (!moons.length) return;

    const perf = meta.perf || engine._getPerformanceProfile(planet);
    if (perf.pressure > 0.78) return;

    const transport = engine.transport || engine._buildTransport(planet);
    const rng = new RNG((planet?.seed || 0) + 111000 + (engine.stepNote * 37) + ((meta.phrasePos || 0) * 17));
    const modeBias = meta.mode === 'MOTIF' ? 0.16 : meta.mode === 'RESPONSE' ? 0.1 : 0;
    const phraseBias = meta.isPhraseEnd ? 0.12 : meta.isResponse ? 0.06 : 0;
    const baseChance = engine._clamp(
        (0.05 + moons.length * 0.07 + modeBias + phraseBias + (engine.tension || 0) * 0.08) * (0.68 + perf.scalar * 0.32),
        0.06,
        0.64
    );
    if (rng.range(0, 1) >= baseChance) return;

    const ctx = engine.ctx;
    const moonDest = engine._moonBus || dest;
    if (!moonDest) return;
    const nyquist = ctx.sampleRate / 2;
    let scheduledCount = 0;
    let firstDelaySeconds = Infinity;

    moons.forEach((moon, idx) => {
        if (rng.range(0, 1) > moon.chance * (0.65 + perf.scalar * 0.35)) return;

        const shiftedStep = shiftScaleStep(planet, step, moon.degreeShift, moon.octaveOffset);
        let freq = engine._getStepFrequency(planet, shiftedStep, 1);
        if (!Number.isFinite(freq)) return;

        freq *= Math.pow(2, moon.detuneCents / 1200);
        freq = engine._clamp(freq, 60, nyquist - 240);

        const start = ctx.currentTime + moon.delaySteps * transport.stepSeconds;
        const dur = engine._clamp(
            transport.stepSeconds * (1.25 + idx * 0.4 + (meta.isPhraseEnd ? 0.55 : 0.18)),
            0.18,
            1.6
        );
        const peak = moon.gain * (meta.isPhraseEnd ? 1.12 : meta.mode === 'MOTIF' ? 1.06 : 1) * (0.86 + rng.range(0, 0.22));
        scheduledCount++;
        firstDelaySeconds = Math.min(firstDelaySeconds, moon.delaySteps * transport.stepSeconds);

        const osc = ctx.createOscillator();
        const filt = ctx.createBiquadFilter();
        const env = ctx.createGain();
        const pan = ctx.createStereoPanner();

        osc.type = engine._resolveOscType(moon.wave, 'sine');
        osc.frequency.setValueAtTime(Math.min(nyquist - 240, freq * (1.02 + idx * 0.015)), start);
        osc.frequency.exponentialRampToValueAtTime(freq, start + Math.min(0.18, dur * 0.32));

        filt.type = 'bandpass';
        filt.frequency.value = engine._clamp(freq * moon.filterMul, 280, Math.min(nyquist - 200, 6800 + idx * 650));
        filt.Q.value = 0.85 + idx * 0.25;

        pan.pan.value = engine._clamp(moon.pan, -0.95, 0.95);

        env.gain.setValueAtTime(0, start);
        env.gain.linearRampToValueAtTime(peak, start + Math.min(0.04, dur * 0.22));
        env.gain.exponentialRampToValueAtTime(0.001, start + dur);

        osc.connect(filt);
        filt.connect(env);
        env.connect(pan);
        pan.connect(moonDest);
        osc.start(start);
        osc.stop(start + dur + 0.05);
        engine.nodes.pushTransient(moon.delaySteps * transport.stepSeconds + dur + 0.2, osc, filt, env, pan);
    });

    if (scheduledCount > 0 && Number.isFinite(firstDelaySeconds)) {
        engine._setManagedTimeout(() => {
            if (!engine.playing) return;
            engine._moonProcCount += scheduledCount;
            engine._moonLastBurst = scheduledCount;
            engine._lastMoonProcAt = engine.ctx?.currentTime || 0;
        }, firstDelaySeconds * 1000);
    }
}

export function applyBiomeMelodyGesture(planet, wType, mode, phrasePos, isPhraseEnd, atk, dur) {
    if (planet?.biome?.id !== 'fungal') return { atk, dur };

    let nextAtk = atk;
    let nextDur = dur;

    if (['marimba', 'wood', 'pluck'].includes(wType)) {
        nextAtk = Math.min(nextAtk, 0.035);
        nextDur *= 0.68;
    } else if (['hollow_pipe', 'reed', 'pulse'].includes(wType)) {
        nextAtk = Math.min(nextAtk, 0.12);
        nextDur *= 0.62;
    } else if (wType === 'crystal_chimes') {
        nextAtk = Math.min(nextAtk, 0.04);
        nextDur *= 0.58;
    } else {
        nextAtk = Math.min(nextAtk, 0.22);
        nextDur *= 0.72;
    }

    if (mode === 'MOTIF') nextDur *= 0.84;
    else if (mode === 'RESPONSE') nextDur *= 0.78;

    if (!isPhraseEnd && phrasePos <= 2) nextDur *= 0.82;
    if (isPhraseEnd) nextDur *= 0.9;

    return {
        atk: Math.max(0.008, nextAtk),
        dur: Math.max(0.12, nextDur),
    };
}
