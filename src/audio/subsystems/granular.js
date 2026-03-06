import { RNG } from '../../rng.js';

export function startGranularCloud(engine, p, dest) {
    if (!engine._granularEnabled) return; // user toggle
    const ctx = engine.ctx, ac = p.ac, sr = ctx.sampleRate;
    if (!ac.grainDensity || ac.grainDensity < 0.05) return;
    const perf = engine._getPerformanceProfile(p);
    const densityCap = 2.5 + (1 - perf.density) * 8.5;
    const effectiveDensity = Math.min(ac.grainDensity, densityCap);
    if (effectiveDensity < 0.05) return;
    const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
    const pushTransient = (ttlSec, ...nodes) => {
        if (typeof engine.nodes?.pushTransient === 'function') engine.nodes.pushTransient(ttlSec, ...nodes);
        else engine.nodes.push(...nodes);
    };

    // A single bus gain for the whole cloud - toggle ramps this
    const granularBus = ctx.createGain();
    const granularTone = ctx.createBiquadFilter();
    granularBus.gain.setValueAtTime(0, ctx.currentTime);
    granularBus.gain.linearRampToValueAtTime(0.85, ctx.currentTime + 1.8); // gentle fade-in to avoid startup clicks
    granularTone.type = 'lowpass';
    granularTone.frequency.value = Math.min(sr / 2 - 260, Math.max(820, (p.filterFreq || 1200) * 2.2));
    granularTone.Q.value = 0.4;
    granularBus.connect(granularTone);
    granularTone.connect(dest);
    engine.nodes.push(granularBus, granularTone);
    engine._granularBus = granularBus;

    const bufLen = sr * 2;
    const buf = ctx.createBuffer(2, bufLen, sr);
    const base = p.rootFreq;
    for (let ch = 0; ch < 2; ch++) {
        const d = buf.getChannelData(ch);
        const rng = new RNG(p.seed + ch * 999);
        for (let i = 0; i < bufLen; i++) {
            const t = i / sr;
            let s = Math.sin(2 * Math.PI * base * t) * 0.38
                + Math.sin(2 * Math.PI * base * 2 * t) * 0.16
                + Math.sin(2 * Math.PI * base * 3 * t) * 0.07;
            s += (engine._random('granular-seed-noise') * 2 - 1) * ac.noiseMul * 0.12;
            d[i] = s * (ch === 0 ? 1 : (0.88 + rng.range(0, 0.24)));
        }
    }

    const intervalMs = 1000 / effectiveDensity;
    const peak = 0.009 * Math.sqrt(Math.min(effectiveDensity, 9));
    const reference = buf.getChannelData(0);

    const findZeroCrossing = (approxSeconds) => {
        const target = Math.max(1, Math.min(reference.length - 2, Math.floor(approxSeconds * sr)));
        const radius = Math.min(280, Math.max(36, Math.floor(sr * 0.004)));
        const start = Math.max(1, target - radius);
        const end = Math.min(reference.length - 2, target + radius);
        let best = target;
        let bestAbs = Math.abs(reference[target]);
        for (let i = start; i <= end; i++) {
            const a = reference[i];
            const b = reference[i + 1];
            const absA = Math.abs(a);
            if ((a <= 0 && b >= 0) || (a >= 0 && b <= 0)) return i / sr;
            if (absA < bestAbs) {
                bestAbs = absA;
                best = i;
            }
        }
        return best / sr;
    };

    const scheduleGrain = (rng) => {
        const nominalDur = clamp(ac.grainSize * 0.001 * (0.74 + rng.range(0, 0.52)), 0.035, 0.12);

        // Click-free envelope
        const atkDur = Math.max(0.012, nominalDur * 0.32);
        const relDur = Math.max(0.012, nominalDur * 0.38);
        const holdDur = Math.max(0, nominalDur - atkDur - relDur);
        const totalEnv = atkDur + holdDur + relDur;

        const maxStart = Math.max(0, (bufLen / sr) - totalEnv - 0.05);
        const roughStartPos = rng.range(0, maxStart);
        const startPos = findZeroCrossing(roughStartPos);
        const centsOff = rng.range(-1, 1) * ac.grainPitchScatter * 0.75;
        const playRate = Math.pow(2, centsOff / 1200);
        const pan = rng.range(-0.75, 0.75);

        const startIdx = Math.max(1, Math.min(reference.length - 2, Math.floor(startPos * sr)));
        const transient = Math.max(Math.abs(reference[startIdx - 1]), Math.abs(reference[startIdx]), Math.abs(reference[startIdx + 1]));
        if (transient > 0.88) return;

        const gs = ctx.createBufferSource();
        const tone = ctx.createBiquadFilter();
        const env = ctx.createGain();
        const pn = ctx.createStereoPanner();
        gs.buffer = buf;
        gs.playbackRate.value = playRate;
        pn.pan.value = pan;
        tone.type = 'bandpass';
        tone.frequency.value = clamp((p.filterFreq || 900) * rng.range(0.55, 1.5), 180, 5200);
        tone.Q.value = 0.35 + rng.range(0, 1.05);

        // Hann-like curve
        const launch = ctx.currentTime + rng.range(0.003, 0.012);
        const peakLevel = peak * rng.range(0.68, 1.08);
        env.gain.setValueAtTime(0.0001, launch);
        env.gain.linearRampToValueAtTime(peakLevel * 0.6, launch + atkDur * 0.55);
        env.gain.linearRampToValueAtTime(peakLevel, launch + atkDur);
        if (holdDur > 0.004) env.gain.setValueAtTime(peakLevel, launch + atkDur + holdDur);
        env.gain.linearRampToValueAtTime(peakLevel * 0.5, launch + atkDur + holdDur + relDur * 0.5);
        env.gain.exponentialRampToValueAtTime(0.0001, launch + totalEnv);

        gs.connect(tone);
        tone.connect(env);
        env.connect(pn);
        pn.connect(granularBus);
        gs.start(launch, startPos, totalEnv + 0.04);
        pushTransient(totalEnv + 0.2, gs, tone, env, pn);
    };

    // Wait before firing grains to let the bus fade in and avoid load clicks.
    engine._setManagedTimeout(() => {
        if (!engine.playing) return;
        engine.intervals.push(setInterval(() => {
            if (!engine.playing) return;
            const grng = new RNG(p.seed + 40000 + engine.stepGrain++);
            const activeNodes = engine.nodes?.size || 0;
            if (activeNodes > 320 && grng.range(0, 1) < 0.65) return;
            scheduleGrain(grng);
            if (effectiveDensity > 5 && activeNodes < 280 && grng.range(0, 1) < 0.12) {
                engine._setManagedTimeout(() => {
                    if (engine.playing) scheduleGrain(grng);
                }, intervalMs * 0.35);
            }
        }, intervalMs));
    }, 500);
}

export function addChorusWidth(engine, source, dest, ac) {
    const ctx = engine.ctx;
    if (!ac.chorusWet || ac.chorusWet < 0.02) return;

    const wetG = ctx.createGain();
    wetG.gain.value = ac.chorusWet;
    wetG.connect(dest);
    engine.nodes.push(wetG);

    // 3 voices at musical delay primes (7, 13, 19ms)
    [7, 13, 19].forEach((ms, i) => {
        const del = ctx.createDelay(0.08);
        del.delayTime.value = ms * 0.001;
        // LFO slowly wobbles each voice's delay time
        const lfo = ctx.createOscillator();
        const lfoG = ctx.createGain();
        lfo.frequency.value = 0.28 + i * 0.13;
        lfoG.gain.value = ac.chorusDepth * 0.0001; // ms -> seconds
        lfo.connect(lfoG); lfoG.connect(del.delayTime);
        lfo.start();
        // Pan: L, R, slightly R (spread)
        const pan = ctx.createStereoPanner();
        pan.pan.value = [-0.7, 0.7, 0.3][i];
        source.connect(del); del.connect(pan); pan.connect(wetG);
        engine.nodes.push(del, lfo, lfoG, pan);
    });
}
