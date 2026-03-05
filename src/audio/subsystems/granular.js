import { RNG } from '../../rng.js';

export function startGranularCloud(engine, p, dest) {
    if (!engine._granularEnabled) return; // user toggle
    const ctx = engine.ctx, ac = p.ac, sr = ctx.sampleRate;
    if (!ac.grainDensity || ac.grainDensity < 0.05) return;
    const perf = engine._getPerformanceProfile(p);
    const densityCap = 2.5 + (1 - perf.density) * 8.5;
    const effectiveDensity = Math.min(ac.grainDensity, densityCap);
    if (effectiveDensity < 0.05) return;

    // A single bus gain for the whole cloud - toggle ramps this
    const granularBus = ctx.createGain();
    granularBus.gain.setValueAtTime(0, ctx.currentTime);
    granularBus.gain.linearRampToValueAtTime(1, ctx.currentTime + 1.5); // fade in to stop clicks
    granularBus.connect(dest);
    engine.nodes.push(granularBus);
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
    const peak = 0.012 * Math.sqrt(Math.min(effectiveDensity, 9));

    const scheduleGrain = (rng) => {
        const nominalDur = ac.grainSize * 0.001 * (0.8 + rng.range(0, 0.5));

        // Click-free envelope
        const atkDur = Math.max(0.012, nominalDur * 0.30);
        const relDur = Math.max(0.018, nominalDur * 0.55);
        const holdDur = Math.max(0, nominalDur - atkDur - relDur);
        const totalEnv = atkDur + holdDur + relDur;

        const maxStart = Math.max(0, (bufLen / sr) - totalEnv - 0.05);
        const startPos = rng.range(0, maxStart);
        const centsOff = rng.range(-1, 1) * ac.grainPitchScatter;
        const playRate = Math.pow(2, centsOff / 1200);
        const pan = rng.range(-0.9, 0.9);

        const gs = ctx.createBufferSource();
        const env = ctx.createGain();
        const pn = ctx.createStereoPanner();
        gs.buffer = buf;
        gs.playbackRate.value = playRate;
        pn.pan.value = pan;

        // Hann-like curve
        const now = ctx.currentTime;
        env.gain.setValueAtTime(0, now);
        env.gain.linearRampToValueAtTime(peak * 0.5, now + atkDur * 0.5);
        env.gain.linearRampToValueAtTime(peak, now + atkDur);
        if (holdDur > 0.004) env.gain.setValueAtTime(peak, now + atkDur + holdDur);
        env.gain.linearRampToValueAtTime(peak * 0.5, now + atkDur + holdDur + relDur * 0.5);
        env.gain.linearRampToValueAtTime(0, now + totalEnv);

        gs.connect(env); env.connect(pn); pn.connect(granularBus);
        gs.start(now, startPos, totalEnv + 0.06);
        engine.nodes.push(gs, env, pn);
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
            if (effectiveDensity > 4 && activeNodes < 280 && grng.range(0, 1) < 0.24) {
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
