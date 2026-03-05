import { RNG } from '../../rng.js';

const fallbackClamp = (value, min, max) => Math.min(max, Math.max(min, value));

function useClamp(clamp, value, min, max) {
    return (typeof clamp === 'function' ? clamp : fallbackClamp)(value, min, max);
}

export function getMacroEventChance(biomeId, state, clamp) {
    const phaseMul = {
        DORMANT: 0,
        STIR: 0.22,
        BUILD: 0.58,
        SURGE: 1.0,
        CLIMAX: 0.82,
        FALLOUT: 0.34,
    }[state?.phase || 'STIR'] || 0.25;

    let base = 0.045;
    if (['storm', 'quantum', 'corrupted'].includes(biomeId)) base = 0.14;
    else if (['volcanic', 'psychedelic', 'organic'].includes(biomeId)) base = 0.1;
    else if (biomeId === 'fungal') base = 0.082;
    else if (['oceanic', 'abyssal', 'crystalline', 'crystalloid', 'desert'].includes(biomeId)) base = 0.075;

    return useClamp(clamp, base * phaseMul * (0.62 + (state?.energy || 0) * 0.78), 0, 0.24);
}

export function getMacroEventCooldown(biomeId, phase, rng) {
    let min = 8;
    let max = 15;
    if (['storm', 'quantum', 'corrupted'].includes(biomeId)) {
        min = 6;
        max = 11;
    } else if (['volcanic', 'organic', 'psychedelic'].includes(biomeId)) {
        min = 7;
        max = 13;
    } else if (biomeId === 'fungal') {
        min = 9;
        max = 15;
    } else if (['barren', 'glacial', 'arctic', 'nebula', 'ethereal'].includes(biomeId)) {
        min = 12;
        max = 20;
    }
    if (phase === 'SURGE' || phase === 'CLIMAX') min *= 0.8;
    return rng.range(min, max);
}

export function spawnFxNoise(engine, dest, opts = {}) {
    if (!engine.ctx || !engine._noiseBuffer || !dest) return;
    const ctx = engine.ctx;
    const t = ctx.currentTime + (opts.delay || 0);
    const dur = Math.max(0.06, opts.dur || 0.4);
    const src = ctx.createBufferSource();
    const filt = ctx.createBiquadFilter();
    const env = ctx.createGain();
    const pan = ctx.createStereoPanner();

    src.buffer = engine._noiseBuffer;
    src.playbackRate.value = opts.playbackRate || 1;
    filt.type = opts.filterType || 'bandpass';
    filt.Q.value = opts.q || 0.9;

    const startFreq = Math.max(40, opts.startFreq || 1600);
    const endFreq = Math.max(40, opts.endFreq || startFreq);
    filt.frequency.setValueAtTime(startFreq, t);
    if (opts.curve === 'linear' || endFreq >= startFreq) {
        filt.frequency.linearRampToValueAtTime(endFreq, t + dur);
    } else {
        filt.frequency.exponentialRampToValueAtTime(endFreq, t + dur);
    }

    pan.pan.value = opts.pan || 0;
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(opts.gain || 0.05, t + Math.min(0.05, dur * 0.25));
    env.gain.exponentialRampToValueAtTime(0.001, t + dur);

    src.connect(filt);
    filt.connect(env);
    env.connect(pan);
    pan.connect(dest);
    src.start(t);
    src.stop(t + dur + 0.05);
    engine.nodes.push(src, filt, env, pan);
}

export function spawnFxTone(engine, dest, opts = {}) {
    if (!engine.ctx || !dest) return;
    const ctx = engine.ctx;
    const t = ctx.currentTime + (opts.delay || 0);
    const dur = Math.max(0.05, opts.dur || 0.35);
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    const pan = ctx.createStereoPanner();
    const filter = opts.filterType ? ctx.createBiquadFilter() : null;

    osc.type = engine._resolveOscType(opts.wave || 'sine');
    const startFreq = Math.max(20, opts.startFreq || opts.freq || 440);
    const endFreq = Math.max(20, opts.endFreq || startFreq);
    osc.frequency.setValueAtTime(startFreq, t);
    if (opts.curve === 'linear' || endFreq >= startFreq) {
        osc.frequency.linearRampToValueAtTime(endFreq, t + dur);
    } else {
        osc.frequency.exponentialRampToValueAtTime(endFreq, t + dur);
    }

    pan.pan.value = opts.pan || 0;
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(opts.gain || 0.04, t + Math.min(0.04, dur * 0.22));
    env.gain.exponentialRampToValueAtTime(0.001, t + dur);

    if (filter) {
        filter.type = opts.filterType;
        filter.frequency.value = opts.filterFreq || Math.max(startFreq * 2.5, 300);
        filter.Q.value = opts.filterQ || 0.8;
        osc.connect(filter);
        filter.connect(env);
    } else {
        osc.connect(env);
    }
    env.connect(pan);
    pan.connect(dest);

    osc.start(t);
    osc.stop(t + dur + 0.05);
    if (filter) engine.nodes.push(osc, filter, env, pan);
    else engine.nodes.push(osc, env, pan);
}

export function spawnFxCluster(engine, dest, opts = {}) {
    const baseFreq = opts.baseFreq || 220;
    const ratios = opts.ratios || [1, 5 / 4, 3 / 2];
    ratios.forEach((ratio, i) => {
        spawnFxTone(engine, dest, {
            wave: opts.wave || 'sine',
            startFreq: baseFreq * ratio,
            endFreq: (opts.endMul || 0.96) * baseFreq * ratio,
            dur: opts.dur || 0.35,
            gain: (opts.gain || 0.028) * (1 - i * 0.08),
            pan: ratios.length > 1 ? ((i / (ratios.length - 1)) * 0.8) - 0.4 : 0,
            delay: (opts.delay || 0) + i * (opts.spacing || 0.03),
            curve: opts.curve || 'exp',
            filterType: opts.filterType,
            filterFreq: opts.filterFreq,
            filterQ: opts.filterQ,
        });
    });
}

export function firePhaseTransitionEvent(engine, p, dest, fromPhase, toPhase) {
    if (!engine.playing || !engine.ctx) return;
    const biomeId = p?.biome?.id;
    const root = p?.rootFreq || 220;
    const upward = ['BUILD', 'SURGE', 'CLIMAX'].includes(toPhase) && toPhase !== fromPhase;
    const rng = new RNG((p.seed || 0) + 130000 + engine.stepFX++);
    const pan = rng.range(-0.55, 0.55);

    switch (biomeId) {
        case 'storm':
            spawnFxNoise(engine, dest, { dur: upward ? 0.34 : 0.7, gain: 0.065, startFreq: upward ? 9000 : 1800, endFreq: upward ? 1400 : 220, q: 0.8, pan });
            if (upward) spawnFxTone(engine, dest, { wave: 'triangle', startFreq: root * 3.2, endFreq: root * 1.4, dur: 0.45, gain: 0.04, pan: -pan });
            break;
        case 'quantum':
        case 'corrupted':
            for (let i = 0; i < 3; i++) {
                spawnFxTone(engine, dest, {
                    wave: biomeId === 'quantum' ? 'square' : 'sawtooth',
                    startFreq: root * rng.range(6, 11),
                    endFreq: root * rng.range(2, 4),
                    dur: 0.08 + i * 0.02,
                    gain: 0.024,
                    pan: i % 2 === 0 ? -0.45 : 0.45,
                    delay: i * 0.035,
                });
            }
            break;
        case 'fungal':
            spawnFxNoise(engine, dest, { dur: 0.24, gain: 0.018, startFreq: 2600, endFreq: 720, filterType: 'bandpass', q: 1.3, pan });
            for (let i = 0; i < 3; i++) {
                spawnFxTone(engine, dest, {
                    wave: i === 1 ? 'triangle' : 'sine',
                    startFreq: root * (3.3 + i * 0.42),
                    endFreq: root * (2.15 + i * 0.25),
                    dur: 0.11 + i * 0.03,
                    gain: 0.014,
                    pan: pan * (i === 1 ? -0.35 : 0.45),
                    delay: i * 0.045,
                });
            }
            break;
        case 'organic':
        case 'desert':
            spawnFxNoise(engine, dest, { dur: 0.42, gain: 0.03, startFreq: 1800, endFreq: 500, filterType: 'bandpass', q: 1.1, pan });
            spawnFxCluster(engine, dest, {
                baseFreq: root * (biomeId === 'desert' ? 3.2 : 2.4),
                ratios: [1, 6 / 5, 3 / 2],
                wave: biomeId === 'desert' ? 'triangle' : 'sine',
                gain: 0.026,
                dur: 0.22,
                spacing: 0.04,
                endMul: 0.92,
            });
            break;
        case 'oceanic':
            spawnFxNoise(engine, dest, { dur: 1.0, gain: 0.038, startFreq: 1200, endFreq: 180, filterType: 'lowpass', q: 0.6, pan });
            spawnFxCluster(engine, dest, { baseFreq: root * 4.5, ratios: [1, 4 / 3], wave: 'sine', gain: 0.018, dur: 0.18, spacing: 0.09, endMul: 1.04 });
            break;
        case 'crystalline':
        case 'crystalloid':
        case 'glacial':
        case 'arctic':
            spawnFxCluster(engine, dest, {
                baseFreq: root * 6,
                ratios: biomeId === 'crystalloid' ? [1, 9 / 8, 3 / 2, 2] : [1, 5 / 4, 3 / 2],
                wave: 'sine',
                gain: 0.022,
                dur: 0.3,
                spacing: 0.035,
                endMul: 0.98,
            });
            break;
        case 'volcanic':
        case 'abyssal':
            spawnFxTone(engine, dest, { wave: 'triangle', startFreq: root * 1.5, endFreq: root * 0.8, dur: 0.6, gain: 0.05, pan, filterType: 'lowpass', filterFreq: root * 7 });
            spawnFxNoise(engine, dest, { dur: 0.45, gain: 0.03, startFreq: 800, endFreq: 120, filterType: 'lowpass', q: 0.7, pan: -pan });
            break;
        default:
            spawnFxNoise(engine, dest, { dur: upward ? 0.35 : 0.55, gain: 0.026, startFreq: upward ? 2600 : 1400, endFreq: upward ? 700 : 220, q: 0.8, pan });
            spawnFxTone(engine, dest, { wave: 'sine', startFreq: root * 4, endFreq: root * 2.8, dur: 0.25, gain: 0.018, pan: -pan });
            break;
    }
}

export function fireSignatureMacroEvent(engine, p, dest, state) {
    if (!engine.playing || !engine.ctx) return;
    const biomeId = p?.biome?.id;
    const root = p?.rootFreq || 220;
    const rng = new RNG((p.seed || 0) + 140000 + engine.stepFX++);
    const energy = state?.energy || 0;

    switch (biomeId) {
        case 'storm':
            for (let i = 0; i < 3 + Math.round(energy * 2); i++) {
                spawnFxNoise(engine, dest, {
                    dur: 0.12 + rng.range(0, 0.08),
                    gain: 0.04 + energy * 0.025,
                    startFreq: rng.range(6500, 11000),
                    endFreq: rng.range(800, 1800),
                    q: 0.9,
                    pan: rng.range(-0.8, 0.8),
                    delay: i * 0.07
                });
            }
            spawnFxTone(engine, dest, { wave: 'triangle', startFreq: root * 2.2, endFreq: root * 0.65, dur: 1.1, gain: 0.055, pan: 0, filterType: 'lowpass', filterFreq: root * 8 });
            break;
        case 'quantum':
            for (let i = 0; i < 4 + Math.round(energy * 3); i++) {
                spawnFxTone(engine, dest, {
                    wave: i % 2 === 0 ? 'square' : 'triangle',
                    startFreq: root * rng.range(7, 13),
                    endFreq: root * rng.range(1.5, 4),
                    dur: 0.05 + rng.range(0, 0.05),
                    gain: 0.02 + energy * 0.01,
                    pan: i % 2 === 0 ? -0.75 : 0.75,
                    delay: i * 0.045
                });
            }
            break;
        case 'corrupted':
            for (let i = 0; i < 3; i++) {
                spawnFxNoise(engine, dest, { dur: 0.18, gain: 0.032, startFreq: rng.range(2400, 6000), endFreq: rng.range(400, 1200), q: 1.2, pan: rng.range(-0.7, 0.7), delay: i * 0.06 });
            }
            spawnFxCluster(engine, dest, { baseFreq: root * 5.5, ratios: [1, 16 / 15, 45 / 32], wave: 'sawtooth', gain: 0.02, dur: 0.16, spacing: 0.03 });
            break;
        case 'fungal':
            for (let i = 0; i < 4 + Math.round(energy * 2); i++) {
                spawnFxTone(engine, dest, {
                    wave: i % 3 === 0 ? 'triangle' : 'sine',
                    startFreq: root * (3.1 + rng.range(0, 2.4)),
                    endFreq: root * (2.0 + rng.range(0, 1.2)),
                    dur: 0.08 + rng.range(0, 0.05),
                    gain: 0.012 + energy * 0.006,
                    pan: rng.range(-0.7, 0.7),
                    delay: i * 0.055,
                });
            }
            spawnFxNoise(engine, dest, { dur: 0.36, gain: 0.018, startFreq: 1800, endFreq: 520, filterType: 'bandpass', q: 1.1 });
            spawnFxCluster(engine, dest, { baseFreq: root * 3.0, ratios: [1, 9 / 8, 4 / 3, 3 / 2], wave: 'triangle', gain: 0.016, dur: 0.12, spacing: 0.045, endMul: 0.97 });
            break;
        case 'organic':
            spawnFxNoise(engine, dest, { dur: 0.9, gain: 0.03, startFreq: 1800, endFreq: 300, filterType: 'bandpass', q: 0.8 });
            spawnFxCluster(engine, dest, { baseFreq: root * 2.8, ratios: [1, 6 / 5, 3 / 2], wave: 'triangle', gain: 0.022, dur: 0.2, spacing: 0.07, endMul: 0.88 });
            break;
        case 'oceanic':
            spawnFxNoise(engine, dest, { dur: 1.8, gain: 0.038, startFreq: 900, endFreq: 140, filterType: 'lowpass', q: 0.55 });
            spawnFxCluster(engine, dest, { baseFreq: root * 4.2, ratios: [1, 4 / 3, 2], wave: 'sine', gain: 0.016, dur: 0.22, spacing: 0.12, endMul: 1.06 });
            break;
        case 'abyssal':
            spawnFxTone(engine, dest, { wave: 'triangle', startFreq: root * 1.15, endFreq: root * 0.42, dur: 1.8, gain: 0.07, filterType: 'lowpass', filterFreq: root * 6 });
            spawnFxNoise(engine, dest, { dur: 0.9, gain: 0.025, startFreq: 500, endFreq: 80, filterType: 'lowpass', q: 0.7 });
            break;
        case 'volcanic':
            spawnFxTone(engine, dest, { wave: 'triangle', startFreq: root * 2.4, endFreq: root * 0.8, dur: 1.2, gain: 0.06, filterType: 'lowpass', filterFreq: root * 8 });
            spawnFxNoise(engine, dest, { dur: 0.7, gain: 0.03, startFreq: 1600, endFreq: 180, filterType: 'lowpass', q: 0.7 });
            break;
        case 'crystalline':
        case 'crystalloid':
        case 'glacial':
        case 'arctic':
            spawnFxCluster(engine, dest, {
                baseFreq: root * 6.5,
                ratios: biomeId === 'crystalloid' ? [1, 9 / 8, 3 / 2, 2, 5 / 2] : [1, 5 / 4, 3 / 2, 2],
                wave: 'sine',
                gain: 0.02,
                dur: 0.28,
                spacing: 0.045,
                endMul: 0.98
            });
            break;
        case 'desert':
            spawnFxNoise(engine, dest, { dur: 1.1, gain: 0.03, startFreq: 2600, endFreq: 400, filterType: 'bandpass', q: 0.7 });
            spawnFxCluster(engine, dest, { baseFreq: root * 3.6, ratios: [1, 6 / 5, 3 / 2], wave: 'triangle', gain: 0.018, dur: 0.16, spacing: 0.09, endMul: 0.92 });
            break;
        case 'nebula':
        case 'ethereal':
            spawnFxCluster(engine, dest, { baseFreq: root * 4.8, ratios: [1, 5 / 4, 3 / 2, 2], wave: 'sine', gain: 0.02, dur: 0.65, spacing: 0.08, endMul: 1.01 });
            break;
        default:
            spawnFxTone(engine, dest, { wave: 'sine', startFreq: root * 4, endFreq: root * 2.6, dur: 0.4, gain: 0.022 });
            break;
    }
}

export const FxSubsystem = {
    id: 'fx',
    getMacroEventChance,
    getMacroEventCooldown,
    spawnFxNoise,
    spawnFxTone,
    spawnFxCluster,
    firePhaseTransitionEvent,
    fireSignatureMacroEvent,
};
