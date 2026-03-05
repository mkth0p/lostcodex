import { RNG } from '../../rng.js';
import { AMBIENT_PATTERN_BANK, BASE_BIOME_PATTERN_BANKS } from '../config/pattern-banks.js';

export function euclideanPattern(k, n) {
    if (k >= n) return new Array(n).fill(1);
    if (k <= 0) return new Array(n).fill(0);
    let pattern = [], counts = [], remainders = [];
    let divisor = n - k;
    remainders.push(k);
    let level = 0;
    while (true) {
        counts.push(Math.floor(divisor / remainders[level]));
        remainders.push(divisor % remainders[level]);
        divisor = remainders[level];
        level++;
        if (remainders[level] <= 1) break;
    }
    counts.push(divisor);
    const build = (level) => {
        if (level === -1) { pattern.push(0); return; }
        if (level === -2) { pattern.push(1); return; }
        for (let i = 0; i < counts[level]; i++) build(level - 1);
        if (remainders[level] !== 0) build(level - 2);
    };
    build(level);
    return pattern;

}

export function startPercussionSequencer(engine, p, dest) {
    const ctx = engine.ctx, base = p.rootFreq, bid = p.biome.id;
    const transport = engine.transport || engine._buildTransport(p);
    const stepTime = transport.stepSeconds;
    const cycleSteps = transport.cycleSteps;
    const rng = new RNG(p.seed);
    const tensionProfile = engine._tensionProfile || engine._getTensionProfile(p);
    const drumTone = engine._getDrumToneProfile(p);
    const fungalGroove = bid === 'fungal';
    const timbreLimits = typeof engine._getTimbreDeltaLimits === 'function'
        ? engine._getTimbreDeltaLimits(p)
        : {};
    const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
    const hatBrightnessMin = Number.isFinite(timbreLimits.hatBrightnessMin) ? timbreLimits.hatBrightnessMin : 0.58;
    const hatBrightnessMax = Number.isFinite(timbreLimits.hatBrightnessMax) ? timbreLimits.hatBrightnessMax : 1.45;
    const harshnessTame = Number.isFinite(timbreLimits.harshnessTame) ? timbreLimits.harshnessTame : 1;
    const cymbalTame = clamp(harshnessTame, 0.68, 1.1);

    // Live-toggle bus: fade in/out without stopping
    const percBody = ctx.createBiquadFilter();
    percBody.type = 'lowshelf';
    percBody.frequency.value = 220;
    percBody.gain.value = drumTone.bodyShelf;

    const percPresence = ctx.createBiquadFilter();
    percPresence.type = 'peaking';
    percPresence.frequency.value = drumTone.presenceFreq;
    percPresence.Q.value = 0.9;
    percPresence.gain.value = drumTone.presenceGain;

    const percAir = ctx.createBiquadFilter();
    percAir.type = 'highshelf';
    percAir.frequency.value = 3200;
    percAir.gain.value = drumTone.airShelf;

    const percBus = ctx.createGain();
    percBus.gain.setValueAtTime(0, ctx.currentTime);
    percBus.gain.linearRampToValueAtTime(
        engine._percussionEnabled ? engine._percVol : 0,
        ctx.currentTime + 0.5
    );
    percBody.connect(percPresence);
    percPresence.connect(percAir);
    percAir.connect(percBus);
    percBus.connect(dest);
    engine.nodes.push(percBody, percPresence, percAir, percBus);
    engine._percBus = percBus;

    // Kit variations per planet â€” tuned via seed
    const kit = {
        kPitch: rng.range(0.85, 1.2) * drumTone.kickPitch,
        kDecay: rng.range(0.7, 1.3) * drumTone.kickDecay,
        kPunch: drumTone.kickPunch,
        kClick: drumTone.kickClick,
        sPitch: rng.range(0.8, 1.3) * drumTone.snarePitch,
        sDecay: rng.range(0.6, 1.5) * drumTone.snareDecay,
        sNoise: drumTone.snareNoise,
        sBody: drumTone.snareBody,
        hPitch: rng.range(0.7, 1.4) * drumTone.hatPitch,
        hDecay: rng.range(0.5, 1.8) * drumTone.hatDecay,
        hBright: clamp(drumTone.hatBright, hatBrightnessMin, hatBrightnessMax),
        subWeight: drumTone.subWeight,
        extraTone: drumTone.extraTone
    };

    // All drum voices route through the per-biome shaping bus
    const dest2 = percBody;

    // Synthesize Drum Voices
    const playKick = (vel) => {
        const t = ctx.currentTime;
        const osc = ctx.createOscillator(), env = ctx.createGain();
        // Hard transient pitch envelope for punch
        osc.frequency.setValueAtTime(180 * kit.kPitch * kit.kPunch, t);
        osc.frequency.exponentialRampToValueAtTime(45 * kit.kPitch, t + 0.05 * kit.kDecay);
        env.gain.setValueAtTime(0, t);
        env.gain.linearRampToValueAtTime(vel, t + 0.005);
        env.gain.exponentialRampToValueAtTime(0.001, t + 0.4 * kit.kDecay);
        osc.connect(env); env.connect(dest2);
        osc.start(t); osc.stop(t + 0.5 * kit.kDecay);

        // Sweeping noise layer for attack punch
        const nSrc = ctx.createBufferSource();
        nSrc.buffer = engine._noiseBuffer;
        const nFilt = ctx.createBiquadFilter();
        nFilt.type = 'lowpass';
        nFilt.frequency.setValueAtTime(1000 * kit.kClick, t);
        nFilt.frequency.exponentialRampToValueAtTime(100 * Math.max(0.75, kit.kClick * 0.9), t + 0.05);
        const nEnv = ctx.createGain();
        nEnv.gain.setValueAtTime(vel * 0.4 * kit.kPunch, t);
        nEnv.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
        nSrc.connect(nFilt); nFilt.connect(nEnv); nEnv.connect(dest2);
        nSrc.start(t); nSrc.stop(t + 0.06);

        engine.nodes.push(osc, env, nSrc, nFilt, nEnv);
        if (p.ac.sidechainAmt > 0) engine._duck(p.ac.sidechainAmt, 0.4);
    };

    const playSnare = (vel) => {
        const t = ctx.currentTime;
        const noise = ctx.createBufferSource();
        noise.buffer = engine._noiseBuffer;
        const nFilt = ctx.createBiquadFilter();
        nFilt.type = 'bandpass';
        const snareBandBase = fungalGroove ? 2600 : 3500 * harshnessTame;
        nFilt.frequency.value = snareBandBase * kit.sPitch * kit.sNoise;
        nFilt.Q.value = fungalGroove ? 0.75 : 1.0;
        const nEnv = ctx.createGain();

        const osc = ctx.createOscillator(), tEnv = ctx.createGain();
        osc.type = fungalGroove ? 'sine' : 'triangle';
        osc.frequency.setValueAtTime((fungalGroove ? 220 : 280) * kit.sPitch, t);
        osc.frequency.exponentialRampToValueAtTime((fungalGroove ? 160 : 180) * kit.sPitch, t + (fungalGroove ? 0.07 : 0.05));

        // Crisper noise snap decoupled from tonal body
        nEnv.gain.setValueAtTime(0, t);
        nEnv.gain.linearRampToValueAtTime(vel * (fungalGroove ? 0.72 : 1.0) * kit.sNoise, t + 0.005);
        nEnv.gain.exponentialRampToValueAtTime(0.001, t + (fungalGroove ? 0.28 : 0.2) * kit.sDecay);

        // Shorter, punchier tonal body
        tEnv.gain.setValueAtTime(0, t);
        tEnv.gain.linearRampToValueAtTime(vel * (fungalGroove ? 0.42 : 0.7) * kit.sBody, t + 0.005);
        tEnv.gain.exponentialRampToValueAtTime(0.001, t + (fungalGroove ? 0.14 : 0.08) * kit.sDecay);

        noise.connect(nFilt); nFilt.connect(nEnv); nEnv.connect(dest2);
        osc.connect(tEnv); tEnv.connect(dest2);
        noise.start(t); osc.start(t);
        noise.stop(t + (fungalGroove ? 0.36 : 0.3) * kit.sDecay);
        osc.stop(t + (fungalGroove ? 0.26 : 0.2) * kit.sDecay);
        engine.nodes.push(noise, nFilt, nEnv, osc, tEnv);
    };

    const playHat = (vel, open) => {
        const t = ctx.currentTime;
        if (fungalGroove) {
            const osc1 = ctx.createOscillator(), osc2 = ctx.createOscillator();
            const bp = ctx.createBiquadFilter(), hp = ctx.createBiquadFilter(), env = ctx.createGain();
            osc1.type = 'triangle'; osc1.frequency.value = 760 * kit.hPitch;
            osc2.type = 'sine'; osc2.frequency.value = 1180 * kit.hPitch;
            bp.type = 'bandpass'; bp.frequency.value = 2400 * kit.hBright * (0.9 + cymbalTame * 0.1); bp.Q.value = 1.2;
            hp.type = 'highpass'; hp.frequency.value = 1400;

            const dur = (open ? 0.48 : 0.13) * kit.hDecay;
            env.gain.setValueAtTime(0, t);
            env.gain.linearRampToValueAtTime(vel * 0.34, t + 0.008);
            env.gain.exponentialRampToValueAtTime(0.001, t + dur);

            osc1.connect(bp); osc2.connect(bp); bp.connect(hp); hp.connect(env); env.connect(dest2);
            osc1.start(t); osc2.start(t);
            osc1.stop(t + dur + 0.05); osc2.stop(t + dur + 0.05);
            engine.nodes.push(osc1, osc2, bp, hp, env);
            return;
        }
        // Hat is high-passed squarish FM or just noise (using square for metallic sound)
        const osc1 = ctx.createOscillator(), osc2 = ctx.createOscillator();
        const filt = ctx.createBiquadFilter(), env = ctx.createGain();
        osc1.type = 'square'; osc1.frequency.value = 400 * kit.hPitch;
        osc2.type = 'square'; osc2.frequency.value = 600 * kit.hPitch;
        filt.type = 'highpass'; filt.frequency.value = 7000 * kit.hBright * cymbalTame;

        const dur = (open ? 0.35 : 0.08) * kit.hDecay;
        env.gain.setValueAtTime(0, t);
        env.gain.linearRampToValueAtTime(vel * 0.4, t + 0.01);
        env.gain.exponentialRampToValueAtTime(0.001, t + dur);

        osc1.connect(filt); osc2.connect(filt); filt.connect(env); env.connect(dest2);
        osc1.start(t); osc2.start(t);
        osc1.stop(t + dur + 0.05); osc2.stop(t + dur + 0.05);
        engine.nodes.push(osc1, osc2, filt, env);
    };

    const playSub = (vel, pitchOff) => {
        const t = ctx.currentTime;
        const osc = ctx.createOscillator(), env = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.value = base * Math.pow(2, pitchOff / 12);
        env.gain.setValueAtTime(0, t);
        env.gain.linearRampToValueAtTime(vel * 0.8 * kit.subWeight, t + 0.05);
        env.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
        osc.connect(env); env.connect(dest2);
        osc.start(t); osc.stop(t + 0.7);
        engine.nodes.push(osc, env);
    };

    //    Extra Percussion Voices                                        
    const playClave = (vel) => {
        const t = ctx.currentTime;
        const osc = ctx.createOscillator(), env = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = 2500 * kit.hPitch; // Wood block pitch range
        osc.frequency.exponentialRampToValueAtTime(1800 * kit.hPitch, t + 0.02);
        env.gain.setValueAtTime(vel * 0.5, t);
        env.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
        osc.connect(env); env.connect(dest2);
        osc.start(t); osc.stop(t + 0.08);
        engine.nodes.push(osc, env);
    };
    const playCowbell = (vel) => {
        const t = ctx.currentTime;
        const osc1 = ctx.createOscillator(), osc2 = ctx.createOscillator();
        const rmGain = ctx.createGain(), env = ctx.createGain(), filt = ctx.createBiquadFilter();

        // Inharmonic square waves
        osc1.type = 'square'; osc1.frequency.value = 540 * kit.hPitch;
        osc2.type = 'square'; osc2.frequency.value = 800 * kit.hPitch;

        // Ring modulation: osc1 modulates the amplitude of osc2 completely
        rmGain.gain.value = 0;
        osc1.connect(rmGain.gain);
        osc2.connect(rmGain);

        // Bandpass filter to tame harshness and shape the "tonk"
        filt.type = 'bandpass';
        filt.frequency.value = 900 * kit.hPitch * harshnessTame;
        filt.Q.value = 1.5;

        env.gain.setValueAtTime(0, t);
        env.gain.linearRampToValueAtTime(vel * 1.5, t + 0.005);
        env.gain.exponentialRampToValueAtTime(0.001, t + 0.4 * kit.hDecay);

        rmGain.connect(filt); filt.connect(env); env.connect(dest2);
        osc1.start(t); osc2.start(t);
        osc1.stop(t + 0.5); osc2.stop(t + 0.5);
        engine.nodes.push(osc1, osc2, rmGain, filt, env);
    };
    const playTom = (vel) => {
        const t = ctx.currentTime;
        const osc = ctx.createOscillator(), env = ctx.createGain();
        const pitch = 110 * kit.kPitch * rng.range(0.9, 1.1);
        // Randomized explosive pitch decay slope for stretched skin feel
        osc.frequency.setValueAtTime(pitch * rng.range(1.5, 2.8), t);
        osc.frequency.exponentialRampToValueAtTime(pitch, t + rng.range(0.04, 0.1));

        env.gain.setValueAtTime(0, t);
        env.gain.linearRampToValueAtTime(vel * 0.6, t + 0.01);
        env.gain.exponentialRampToValueAtTime(0.001, t + 0.35 * kit.kDecay);
        osc.connect(env); env.connect(dest2);
        osc.start(t); osc.stop(t + 0.45);
        engine.nodes.push(osc, env);
    };
    const playShaker = (vel) => {
        const t = ctx.currentTime;
        // Metallic FM oscillator pair instead of flat buffer source
        const mSrc = ctx.createOscillator(), mMod = ctx.createOscillator(), mModGain = ctx.createGain();
        mSrc.type = 'square'; mSrc.frequency.value = 4000 * kit.hPitch;
        mMod.type = 'square'; mMod.frequency.value = 6500 * kit.hPitch;
        mModGain.gain.value = 3000;
        mMod.connect(mModGain); mModGain.connect(mSrc.frequency);

        const filt = ctx.createBiquadFilter();
        filt.type = 'highpass'; filt.frequency.value = 5000 * (0.85 + harshnessTame * 0.15);
        const env = ctx.createGain();
        env.gain.setValueAtTime(0, t);
        env.gain.linearRampToValueAtTime(vel * 0.4, t + 0.01);
        env.gain.exponentialRampToValueAtTime(0.001, t + 0.08); // very short decay

        mSrc.connect(filt); filt.connect(env); env.connect(dest2);
        mSrc.start(t); mMod.start(t);
        mSrc.stop(t + 0.1); mMod.stop(t + 0.1);
        engine.nodes.push(mSrc, mMod, mModGain, filt, env);
    };
    const playConga = (vel) => {
        const t = ctx.currentTime;
        const osc = ctx.createOscillator(), env = ctx.createGain();
        osc.type = 'triangle';
        const pitch = 260 * kit.sPitch * rng.range(0.95, 1.05); // Organic pitch variance
        osc.frequency.setValueAtTime(pitch * rng.range(1.3, 1.8), t);
        osc.frequency.exponentialRampToValueAtTime(pitch * 0.9, t + rng.range(0.03, 0.08));

        env.gain.setValueAtTime(0, t);
        env.gain.linearRampToValueAtTime(vel * 0.5, t + 0.005);
        env.gain.exponentialRampToValueAtTime(0.001, t + 0.22 * kit.sDecay);
        osc.connect(env); env.connect(dest2);
        osc.start(t); osc.stop(t + 0.3);
        engine.nodes.push(osc, env);
    };
    const playRimshot = (vel) => {
        const t = ctx.currentTime;
        if (fungalGroove) {
            const osc = ctx.createOscillator(), env = ctx.createGain(), bp = ctx.createBiquadFilter();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(1650 * kit.hPitch, t);
            osc.frequency.exponentialRampToValueAtTime(980 * kit.hPitch, t + 0.03);
            bp.type = 'bandpass'; bp.frequency.value = 1450 * kit.hPitch; bp.Q.value = 2.4;
            env.gain.setValueAtTime(0, t);
            env.gain.linearRampToValueAtTime(vel * 0.18, t + 0.003);
            env.gain.exponentialRampToValueAtTime(0.001, t + 0.045);
            osc.connect(bp); bp.connect(env); env.connect(dest2);
            osc.start(t); osc.stop(t + 0.08);
            engine.nodes.push(osc, env, bp);
            return;
        }
        const osc = ctx.createOscillator(), env = ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(800 * kit.sPitch, t);
        osc.frequency.exponentialRampToValueAtTime(400, t + 0.02);
        env.gain.setValueAtTime(vel * 0.35, t);
        env.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
        osc.connect(env); env.connect(dest2);
        osc.start(t); osc.stop(t + 0.1);
        engine.nodes.push(osc, env);
    };
    const playBongo = (vel) => {
        const t = ctx.currentTime;
        const osc = ctx.createOscillator(), env = ctx.createGain();
        osc.type = 'sine';
        const pitch = 350 * kit.sPitch;
        osc.frequency.setValueAtTime(pitch * 1.2, t);
        osc.frequency.exponentialRampToValueAtTime(pitch, t + 0.05);
        env.gain.setValueAtTime(vel * 0.4, t);
        env.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
        osc.connect(env); env.connect(dest2);
        osc.start(t); osc.stop(t + 0.2);
        engine.nodes.push(osc, env);
    };
    const playTaiko = (vel) => {
        const t = ctx.currentTime;
        const osc = ctx.createOscillator(), env = ctx.createGain(), lpf = ctx.createBiquadFilter();
        osc.type = 'triangle';
        const pitch = 80 * kit.kPitch;
        osc.frequency.setValueAtTime(pitch * 2, t);
        osc.frequency.exponentialRampToValueAtTime(pitch, t + 0.1);
        lpf.type = 'lowpass'; lpf.frequency.value = 400; lpf.Q.value = 2;
        env.gain.setValueAtTime(0, t);
        env.gain.linearRampToValueAtTime(vel * 1.5, t + 0.01);
        env.gain.exponentialRampToValueAtTime(0.001, t + 0.8 * kit.kDecay);
        osc.connect(lpf); lpf.connect(env); env.connect(dest2);
        osc.start(t); osc.stop(t + 1.0);
        engine.nodes.push(osc, lpf, env);
    };
    const playWoodBlock = (vel) => {
        const t = ctx.currentTime;
        const osc = ctx.createOscillator(), env = ctx.createGain(), bpf = ctx.createBiquadFilter();
        osc.type = 'sine';
        osc.frequency.value = 1200 * kit.hPitch;
        bpf.type = 'bandpass'; bpf.frequency.value = 1200 * kit.hPitch; bpf.Q.value = 5;
        env.gain.setValueAtTime(vel * 0.6, t);
        env.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
        osc.connect(bpf); bpf.connect(env); env.connect(dest2);
        osc.start(t); osc.stop(t + 0.1);
        engine.nodes.push(osc, bpf, env);
    };

    // Map voice name â†’ function for biome-driven percVoices dispatch
    const extraVoices = { clave: playClave, cowbell: playCowbell, tom: playTom, shaker: playShaker, conga: playConga, rimshot: playRimshot, bongo: playBongo, taiko: playTaiko, woodblock: playWoodBlock };


    //    Biome Sequence Patterns (16 steps)   
    // 1=hit, 2=accent/openhat, 0=rest. Multiple arrays = planet seed chooses variation.
    const P = { ...BASE_BIOME_PATTERN_BANKS };
    const ambient = AMBIENT_PATTERN_BANK;

    // Euclidean patterns auto-generated for new exotic biomes
    const eu = (k, n) => euclideanPattern(k, n);
    P.quantum = {
        k: [eu(5, 16), eu(7, 16)],
        s: [eu(3, 16), eu(5, 16)],
        h: [eu(11, 16), eu(13, 16)],
        b: [eu(3, 16), eu(5, 16)]
    };
    P.fungal = {
        k: [
            [1, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0],
            [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0]
        ],
        s: [
            [0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0],
            [0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0]
        ],
        h: [
            [2, 0, 1, 1, 0, 1, 2, 0, 1, 1, 0, 1],
            [2, 0, 1, 1, 0, 0, 2, 0, 1, 1, 0, 1]
        ],
        b: [
            [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
            [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0]
        ]
    };
    P.abyssal = {
        k: [eu(2, 16), eu(3, 16)],
        s: [eu(1, 16), eu(2, 16)],
        h: [eu(4, 16), eu(6, 16)],
        b: [eu(2, 16), eu(4, 16)]
    };
    P.glacial = ambient; // Pure silence
    //    New Biome Patterns   
    P.nebula = ambient; // Choral / ambient â€” no percussion
    P.arctic = {
        // Just rare single clicks â€” vast silence between them
        k: [[1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0]],
        s: [[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]],
        h: [[2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0]],
        b: [[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]]
    };
    P.storm = {
        // Violent, irregular â€” dense and chaotic
        k: [eu(7, 16), eu(9, 16)],
        s: [eu(5, 16), eu(7, 16)],
        h: [[1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1], eu(13, 16)], // near-continuous
        b: [eu(5, 16), eu(7, 16)]
    };
    P.crystalloid = {
        // Precise euclidean â€” geometric and alien
        k: [eu(5, 16), eu(3, 16)],
        s: [eu(7, 16), eu(5, 16)],
        h: [eu(11, 16), eu(9, 16)],
        b: [eu(4, 16), eu(6, 16)]
    };

    //    Tribal / Organic Rhythms   
    const tribal = {
        k: [eu(2, 8), eu(3, 8)],
        s: [eu(3, 16), eu(5, 24)],
        h: [eu(9, 16), eu(13, 24)],
        b: [eu(3, 8), eu(4, 8)]
    };
    if (bid === 'fungal') {
        if (!p.ac.percVoices.includes('woodblock')) p.ac.percVoices.push('woodblock');
        if (!p.ac.percVoices.includes('clave')) p.ac.percVoices.push('clave');
    }
    if (['organic', 'desert'].includes(bid)) {
        P[bid] = tribal;
        if (!p.ac.percVoices.includes('taiko')) p.ac.percVoices.push('taiko');
        if (!p.ac.percVoices.includes('woodblock')) p.ac.percVoices.push('woodblock');
    }

    const bPats = P[bid] || ambient;

    // Pick specific array variations for this planet
    const basePercPatterns = {
        k: engine._fitPatternToCycle(rng.pick(bPats.k), cycleSteps),
        s: engine._fitPatternToCycle(rng.pick(bPats.s), cycleSteps),
        h: engine._fitPatternToCycle(rng.pick(bPats.h), cycleSteps),
        b: engine._fitPatternToCycle(rng.pick(bPats.b), cycleSteps)
    };
    const phasePatternBanks = engine._buildPhasePatternBanks(basePercPatterns, cycleSteps, p.seed, bid);
    const subPitch = rng.pick([0, -5, -7]);

    // Generate extra-voice Euclidean patterns from percVoices list
    const extraPats = {};
    const pVoices = p.ac.percVoices || [];
    pVoices.forEach((v, i) => {
        const k = [3, 4, 5, 6, 7][i % 5];
        extraPats[v] = engine._euclidean(Math.min(k, cycleSteps), cycleSteps);
    });
    if (bid === 'fungal') {
        const fungalExtraPatterns = {
            woodblock: [0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 1],
            clave: [0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 0, 0],
            bongo: [0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 1, 0],
            shaker: [0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1],
        };
        Object.keys(fungalExtraPatterns).forEach((voice) => {
            if (pVoices.includes(voice)) {
                extraPats[voice] = engine._fitPatternToCycle(fungalExtraPatterns[voice], cycleSteps);
            }
        });
    }

    // Swing offset (delays even 16th-steps by swing*stepTime)
    const swingAmt = (p.ac.swing || 0) * stepTime;

    let step = 0;
    let barCount = 0; // counts completed 16-step bars for fill detection
    const runPercussionStep = () => {
        if (!engine.playing) return;
        const seqRng = new RNG(p.seed + 50000 + engine.stepPerc++);
        const stepIndex = step;
        const swDelay = (stepIndex % 2 === 1) ? swingAmt : 0;
        const rhythmState = engine._getRhythmState(p, stepIndex, barCount, seqRng);
        const phasePatterns = phasePatternBanks[rhythmState.phase] || phasePatternBanks.STIR || basePercPatterns;
        const chaos = seqRng.range(0, 1) < rhythmState.chaosChance;

        // Velocity variance
        const velScale = 1 - (p.ac.velocityVar || 0) * seqRng.range(0, 1);

        //    Ghost notes: very quiet hat & snare on empty adjacent steps   
        // Fires only when the pattern has no hit on this step (off-beats)
        const doGhost = engine._ghostEnabled && !chaos
            && phasePatterns.k[stepIndex] === 0 && phasePatterns.s[stepIndex] === 0
            && seqRng.range(0, 1) < rhythmState.ghostChance;

        //    Fill detection: last 4 steps of a 16-step bar when fills on   
        const playStep = (s, state) => {
            let kickHit = phasePatterns.k[s] === 1;
            let snareHit = phasePatterns.s[s] === 1;
            let hatHit = phasePatterns.h[s];
            const subHit = phasePatterns.b[s] === 1;
            const dynVel = velScale * state.velocityLift;
            const kickVelMul = fungalGroove ? 0.8 : 1;
            const snareVelMul = fungalGroove ? 0.88 : 1;
            const hatVelMul = (fungalGroove ? 0.82 : 1) * cymbalTame;
            const subVelMul = fungalGroove ? 0.72 : 1;

            if (chaos) {
                if (!kickHit && s % 2 === 0 && seqRng.range(0, 1) < 0.28) kickHit = true;
                if (snareHit && seqRng.range(0, 1) < 0.35) snareHit = false;
                if (hatHit === 0 && seqRng.range(0, 1) < 0.65) {
                    hatHit = seqRng.range(0, 1) < state.openHatChance ? 2 : 1;
                }
            } else {
                if (!kickHit && seqRng.range(0, 1) < state.kickPush && (s % 4 === 0 || s === cycleSteps - 1)) {
                    kickHit = true;
                }
                if (!snareHit && seqRng.range(0, 1) < state.snarePush && (s + 2) % 4 === 0) {
                    snareHit = true;
                }
                if (hatHit === 0 && seqRng.range(0, 1) < state.hatPush) {
                    hatHit = seqRng.range(0, 1) < state.openHatChance ? 2 : 1;
                }
            }
            if (fungalGroove && hatHit === 0 && !chaos && ((s % 3) === 2 || s === cycleSteps - 1) && seqRng.range(0, 1) < 0.24) {
                hatHit = (s === cycleSteps - 1 && seqRng.range(0, 1) < 0.16) ? 2 : 1;
            }

            if (hatHit === 1 && seqRng.range(0, 1) < state.openHatChance * 0.28) hatHit = 2;

            if (kickHit) playKick(0.22 * dynVel * kickVelMul * (seqRng.range(0, 1) < state.accentChance ? 1.2 : 1));
            if (snareHit) playSnare(0.11 * dynVel * snareVelMul * (state.phase === 'CLIMAX' ? 1.15 : 1));
            if (hatHit === 1) playHat(0.038 * dynVel * hatVelMul, false);
            if (hatHit === 2) playHat(0.055 * dynVel * hatVelMul, true);
            if (subHit && !chaos) playSub(0.13 * dynVel * subVelMul, subPitch);

            pVoices.forEach(v => {
                if (extraPats[v]?.[s] !== 1 || !extraVoices[v]) return;
                const preferredLift = state.fillVoices.includes(v) ? 0.12 : 0;
                if (seqRng.range(0, 1) < engine._clamp(state.extraVoiceChance + preferredLift, 0, 0.95)) {
                    extraVoices[v](0.09 * dynVel);
                }
            });

            if (doGhost && !kickHit && !snareHit && hatHit === 0) {
                if (fungalGroove) {
                    if (seqRng.range(0, 1) < 0.75) playHat(0.022 * dynVel, seqRng.range(0, 1) < 0.18);
                    else playSnare(0.018 * dynVel);
                } else if (seqRng.range(0, 1) < 0.6) playHat(0.018 * dynVel, false);
                else playSnare(0.026 * dynVel);
            }

            if (state.fillActive) {
                const fillVel = (0.05 + seqRng.range(0, 0.05)) * dynVel;
                const fillPool = state.fillVoices.filter(v => extraVoices[v]);
                if (seqRng.range(0, 1) < state.fillChance) {
                    playHat(fillVel, seqRng.range(0, 1) < state.openHatChance);
                }
                if (seqRng.range(0, 1) < state.fillChance * 0.45 && s >= cycleSteps - 2) {
                    playSnare(0.08 * dynVel);
                }
                if (fillPool.length && seqRng.range(0, 1) < state.fillChance * 0.55) {
                    extraVoices[seqRng.pick(fillPool)](0.1 * dynVel);
                }
                engine._setManagedTimeout(() => {
                    if (!engine.playing) return;
                    if (fillPool.length && seqRng.range(0, 1) < state.fillChance * 0.4) {
                        extraVoices[seqRng.pick(fillPool)](0.075 * dynVel);
                    } else if (seqRng.range(0, 1) < state.fillChance * 0.6) {
                        playHat(fillVel * 0.7, false);
                    }
                }, (stepTime * 0.5) * 1000);
                if (fungalGroove && s >= cycleSteps - 2) {
                    const fungalFillPool = (fillPool.length ? fillPool : ['bongo', 'woodblock', 'clave', 'rimshot'])
                        .flatMap(v => v === 'rimshot' ? [v] : [v, v])
                        .filter(v => extraVoices[v]);
                    if (fungalFillPool.length && seqRng.range(0, 1) < state.fillChance * 0.62) {
                        engine._setManagedTimeout(() => {
                            if (!engine.playing) return;
                            extraVoices[seqRng.pick(fungalFillPool)](0.07 * dynVel);
                        }, (stepTime * 0.32) * 1000);
                    }
                    if (seqRng.range(0, 1) < state.fillChance * 0.54) {
                        engine._setManagedTimeout(() => {
                            if (!engine.playing) return;
                            playHat(fillVel * 0.82, false);
                        }, (stepTime * 0.68) * 1000);
                    }
                }
            }
        };

        if (swDelay > 0) {
            engine._setManagedTimeout(() => playStep(stepIndex, rhythmState), swDelay * 1000);
        } else {
            playStep(stepIndex, rhythmState);
        }

        if (engine._ghostEnabled && seqRng.range(0, 1) < rhythmState.accentChance * 0.35) {
            playHat(0.026 * rhythmState.velocityLift, false);
        }

        step = (step + 1) % cycleSteps;
        if (step === 0) barCount++;
    };

    const percussionScheduled = engine._scheduleRecurringChannel(
        'percussion',
        stepTime,
        () => runPercussionStep()
    );
    if (!percussionScheduled) {
        engine.intervals.push(setInterval(() => runPercussionStep(), stepTime * 1000));
    }

    //    Polyrhythm Layer (Hemiola / 3-against-4)   
    // Only on "complex" rhythmic biomes (fungal, crystalloid, quantum, psychedelic)
    const complexBiomes = ['fungal', 'crystalloid', 'quantum', 'psychedelic', 'corrupted'];
    if (complexBiomes.includes(p.biome.id) || rng.range(0, 1) < 0.25) {
        const polyVoicePool = (tensionProfile.polyVoices || []).filter(v => extraVoices[v]);
        let polyStep = 0;
        const tripletTime = (stepTime * 4) / 3; // 3 beats over 4 sub-steps
        const runPolyrhythmStep = () => {
            if (!engine.playing) return;
            const polyRng = new RNG(p.seed + 65000 + engine.stepFX++);
            const polyState = engine._getRhythmState(p, polyStep++ % cycleSteps, barCount, polyRng);
            if (polyState.energy < Math.max(0.18, tensionProfile.lowPoint - 0.04)) return;
            const voicePool = polyVoicePool.length ? polyVoicePool : ['clave', 'cowbell', 'conga'].filter(v => extraVoices[v]);
            const polySound = extraVoices[polyRng.pick(voicePool)];
            if (polySound && polyRng.range(0, 1) < engine._clamp(0.2 + polyState.energy * 0.38, 0.15, 0.82)) {
                polySound(0.07 * polyState.velocityLift);
            }
        };

        const polyScheduled = engine._scheduleRecurringChannel(
            'percussion-poly',
            tripletTime,
            () => runPolyrhythmStep()
        );
        if (!polyScheduled) {
            engine.intervals.push(setInterval(() => runPolyrhythmStep(), tripletTime * 1000));
        }
    }

}
