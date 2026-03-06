import { RNG } from '../../rng.js';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const BIOME_MOON_BEHAVIOR = {
    crystalline: { density: 0.62, resonance: 0.86, drift: 0.22, brightness: 1.16 },
    crystalloid: { density: 0.68, resonance: 0.9, drift: 0.25, brightness: 1.2 },
    glacial: { density: 0.48, resonance: 0.78, drift: 0.12, brightness: 1.1 },
    arctic: { density: 0.47, resonance: 0.8, drift: 0.11, brightness: 1.08 },
    ethereal: { density: 0.63, resonance: 0.72, drift: 0.24, brightness: 1.05 },
    nebula: { density: 0.7, resonance: 0.76, drift: 0.27, brightness: 1.12 },
    fungal: { density: 0.66, resonance: 0.58, drift: 0.3, brightness: 0.92 },
    quantum: { density: 0.82, resonance: 0.84, drift: 0.36, brightness: 1.28 },
    corrupted: { density: 0.78, resonance: 0.8, drift: 0.34, brightness: 1.22 },
    storm: { density: 0.72, resonance: 0.7, drift: 0.31, brightness: 1.18 },
    abyssal: { density: 0.54, resonance: 0.66, drift: 0.18, brightness: 0.82 },
    default: { density: 0.58, resonance: 0.68, drift: 0.2, brightness: 1 },
};

function getBiomeMoonBehavior(planet) {
    return BIOME_MOON_BEHAVIOR[planet?.biome?.id] || BIOME_MOON_BEHAVIOR.default;
}

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
            return ['sine', 'triangle'];
        case 'organic':
        case 'fungal':
        case 'desert':
            return ['triangle', 'sine'];
        case 'corrupted':
        case 'quantum':
        case 'storm':
            return ['triangle', 'square', 'sawtooth'];
        case 'volcanic':
        case 'abyssal':
            return ['triangle', 'sine', 'sawtooth'];
        default:
            return ['sine', 'triangle'];
    }
}

function resolveMoonLanes(moonCount, moonSystem, rng) {
    const base = moonSystem?.density || 0.6;
    const lanes = [];
    for (let i = 0; i < moonCount; i++) {
        const laneSeed = clamp(Math.round(2 + i + base * 5 + rng.range(-0.6, 0.8)), 2, 9);
        const stride = laneSeed % 2 === 0 ? laneSeed : laneSeed + 1;
        lanes.push({
            stride: clamp(stride, 2, 10),
            phaseOffset: rng.int(0, stride),
            offbeatChance: clamp(0.1 + base * 0.36 + rng.range(-0.05, 0.09), 0.05, 0.62),
        });
    }
    return lanes;
}

export function buildMoonProfile(engine, planet) {
    const moonCount = engine._clamp(Math.round(planet?.numMoons || 0), 0, 4);
    if (!moonCount) return [];

    const rng = new RNG((planet?.seed || 0) + 205000);
    const moonSystem = planet?.moonSystem || {};
    const behavior = getBiomeMoonBehavior(planet);
    const waves = getMoonWavePool(planet);
    const panPositions = moonCount === 1
        ? [0]
        : moonCount === 2
            ? [-0.45, 0.45]
            : moonCount === 3
                ? [-0.62, 0, 0.62]
                : [-0.72, -0.24, 0.24, 0.72];

    const lanes = resolveMoonLanes(moonCount, moonSystem, rng);
    const profiles = [];
    const harmonicShifts = [1, 2, 4, 5, 7, -1];

    for (let i = 0; i < moonCount; i++) {
        const leadingMoon = i === 0;
        const delayBase = 0.75 + i * (0.74 + (moonSystem?.orbitSpread || 0.5) * 0.18);
        let degreeShift = rng.pick(harmonicShifts);
        if (!leadingMoon && rng.bool(0.35)) degreeShift += rng.pick([-1, 1]);
        if (leadingMoon && moonCount > 1 && rng.bool(0.22)) degreeShift = -1;

        const baseGain = clamp(0.095 - i * 0.016 + behavior.resonance * 0.02, 0.045, 0.14);
        const baseChance = clamp(0.58 - i * 0.13 + behavior.density * 0.18, 0.16, 0.86);
        const lane = lanes[i];

        profiles.push({
            laneStride: lane.stride,
            lanePhaseOffset: lane.phaseOffset,
            laneOffbeatChance: lane.offbeatChance,
            delaySteps: clamp(delayBase + rng.pick([0, 0.25, 0.5, 0.75]), 0.5, 4.2),
            degreeShift,
            octaveOffset: (!leadingMoon && rng.bool(0.34)) ? 1 : 0,
            gain: baseGain,
            chance: baseChance,
            pan: (panPositions[i] ?? 0) + rng.range(-0.08, 0.08),
            detuneCents: rng.range(-8, 8) * (1 + (moonSystem?.phaseWarp || 0.25) * 0.35),
            filterMul: clamp(2.2 + i * 0.5 + rng.range(-0.18, 0.24), 1.5, 4.4),
            wave: rng.pick(waves),
            resonance: clamp(behavior.resonance + rng.range(-0.16, 0.15), 0.25, 1),
            brightness: clamp(behavior.brightness + rng.range(-0.12, 0.14), 0.75, 1.45),
            driftRate: clamp(behavior.drift + (moonSystem?.temporalDrift || 0.2) * 0.45 + rng.range(-0.08, 0.1), 0.02, 0.72),
            swell: clamp(0.2 + rng.range(0, 0.46), 0.12, 0.74),
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

function passesMoonLaneGate(engine, moon, rng) {
    const laneStride = Math.max(1, moon.laneStride || 1);
    const lanePos = ((engine.stepNote + (moon.lanePhaseOffset || 0)) % laneStride + laneStride) % laneStride;
    if (lanePos === 0) return true;
    return rng.range(0, 1) < (moon.laneOffbeatChance || 0.2);
}

function buildMoonEnvelope(transportStepSeconds, moon, meta = {}) {
    const phraseLift = meta.isPhraseEnd ? 1.18 : meta.mode === 'MOTIF' ? 1.08 : 1;
    const attack = clamp(transportStepSeconds * (0.08 + moon.swell * 0.22), 0.01, 0.14);
    const hold = clamp(transportStepSeconds * (0.2 + moon.resonance * 0.38), 0.04, 0.42);
    const release = clamp(transportStepSeconds * (1.1 + moon.resonance * 2.2), 0.16, 1.9);
    const peak = clamp(moon.gain * phraseLift, 0.01, 0.22);
    return { attack, hold, release, peak };
}

export function scheduleMoonCanons(engine, planet, dest, step, meta = {}) {
    if (!engine.ctx || !engine.playing || !Number.isFinite(step)) return;
    const moons = engine._moonProfile || [];
    if (!moons.length) return;
    const forced = !!meta.force;

    const perf = meta.perf || engine._getPerformanceProfile(planet);
    if (perf.pressure > 0.82) return;

    const transport = engine.transport || engine._buildTransport(planet);
    const moonSystem = planet?.moonSystem || {};
    const behavior = getBiomeMoonBehavior(planet);
    const rng = new RNG((planet?.seed || 0) + 111000 + (engine.stepNote * 37) + ((meta.phrasePos || 0) * 17));
    const modeBias = meta.mode === 'MOTIF' ? 0.12 : meta.mode === 'RESPONSE' ? 0.08 : 0;
    const phraseBias = meta.isPhraseEnd ? 0.1 : meta.isResponse ? 0.05 : 0;
    const tension = engine.tension || 0;
    const baseChance = clamp(
        (0.06 + moons.length * 0.06 + modeBias + phraseBias + tension * 0.09 + (moonSystem?.density || 0.5) * 0.14)
        * (0.7 + perf.scalar * 0.3),
        0.06,
        0.86
    );
    if (!forced && rng.range(0, 1) >= baseChance) return;

    const ctx = engine.ctx;
    const moonDest = engine._moonBus || dest;
    if (!moonDest) return;
    const nyquist = ctx.sampleRate / 2;
    let scheduledCount = 0;
    let firstDelaySeconds = Infinity;

    moons.forEach((moon, idx) => {
        if (!passesMoonLaneGate(engine, moon, rng)) return;

        const chanceScale = 0.62 + perf.scalar * 0.38 + (moonSystem?.density || 0.4) * 0.2;
        if (!forced && rng.range(0, 1) > moon.chance * chanceScale) return;

        const shiftedStep = shiftScaleStep(planet, step, moon.degreeShift, moon.octaveOffset);
        let freq = engine._getStepFrequency(planet, shiftedStep, 1);
        if (!Number.isFinite(freq)) return;

        const driftCents = Math.sin((engine.stepNote + idx * 3.2) * moon.driftRate * 0.28) * 6;
        freq *= Math.pow(2, (moon.detuneCents + driftCents) / 1200);
        freq = engine._clamp(freq, 60, nyquist - 240);

        const start = ctx.currentTime + moon.delaySteps * transport.stepSeconds;
        const env = buildMoonEnvelope(transport.stepSeconds, moon, meta);
        const dur = env.attack + env.hold + env.release;

        scheduledCount++;
        firstDelaySeconds = Math.min(firstDelaySeconds, moon.delaySteps * transport.stepSeconds);

        const osc = ctx.createOscillator();
        const filt = ctx.createBiquadFilter();
        const amp = ctx.createGain();
        const pan = ctx.createStereoPanner();
        const wobble = ctx.createOscillator();
        const wobbleGain = ctx.createGain();

        osc.type = engine._resolveOscType(moon.wave, 'sine');
        osc.frequency.setValueAtTime(Math.min(nyquist - 220, freq * (1.02 + idx * 0.012)), start);
        osc.frequency.exponentialRampToValueAtTime(freq, start + Math.min(0.16, env.attack + env.hold * 0.35));

        filt.type = 'bandpass';
        filt.frequency.value = engine._clamp(freq * moon.filterMul * moon.brightness, 220, Math.min(nyquist - 200, 7600 + idx * 700));
        filt.Q.value = 0.9 + moon.resonance * 2.2;

        pan.pan.value = engine._clamp(moon.pan, -0.95, 0.95);
        wobble.type = 'sine';
        wobble.frequency.value = 0.08 + moon.driftRate * 0.38;
        wobbleGain.gain.value = 0.06 + moon.resonance * 0.1;
        wobble.connect(wobbleGain);
        wobbleGain.connect(pan.pan);

        amp.gain.setValueAtTime(0, start);
        amp.gain.linearRampToValueAtTime(env.peak, start + env.attack);
        amp.gain.setValueAtTime(env.peak * 0.92, start + env.attack + env.hold);
        amp.gain.exponentialRampToValueAtTime(0.0008, start + dur);

        osc.connect(filt);
        filt.connect(amp);
        amp.connect(pan);
        pan.connect(moonDest);
        osc.start(start);
        osc.stop(start + dur + 0.06);
        wobble.start(start);
        wobble.stop(start + dur + 0.06);

        if (behavior.brightness > 1.14 && rng.bool(0.35)) {
            const shimmer = ctx.createGain();
            shimmer.gain.setValueAtTime(0, start);
            shimmer.gain.linearRampToValueAtTime(env.peak * 0.18, start + env.attack * 0.7);
            shimmer.gain.exponentialRampToValueAtTime(0.0009, start + dur * 0.68);

            const shimmerOsc = ctx.createOscillator();
            shimmerOsc.type = 'sine';
            shimmerOsc.frequency.setValueAtTime(Math.min(nyquist - 220, freq * 2.01), start);
            shimmerOsc.frequency.exponentialRampToValueAtTime(Math.min(nyquist - 220, freq * 2.48), start + dur * 0.32);
            shimmerOsc.connect(shimmer);
            shimmer.connect(moonDest);
            shimmerOsc.start(start);
            shimmerOsc.stop(start + dur * 0.72);
            engine.nodes.pushTransient(moon.delaySteps * transport.stepSeconds + dur + 0.3, shimmerOsc, shimmer);
        }

        engine.nodes.pushTransient(moon.delaySteps * transport.stepSeconds + dur + 0.3, osc, filt, amp, pan, wobble, wobbleGain);
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

    if (['marimba', 'wood', 'pluck', 'modal_resonator'].includes(wType)) {
        nextAtk = Math.min(nextAtk, 0.035);
        nextDur *= 0.68;
    } else if (['hollow_pipe', 'reed', 'pulse', 'phase_cluster'].includes(wType)) {
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
