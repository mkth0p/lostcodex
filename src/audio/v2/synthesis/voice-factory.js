import { RNG } from '../../../rng.js';
import { ADDITIVE_VOICE_NAMES, buildVoice } from '../../../voices.js';
import {
    triggerBirdCall,
    triggerCrystalShard,
    triggerDelaySwell,
    triggerGlitchPulse,
    triggerHat,
    triggerHarmonicShimmer,
    triggerKick,
    triggerRainDrop,
    triggerNoiseWash,
    triggerRustle,
    triggerShaker,
    triggerSnare,
    triggerThunderRumble,
    triggerTom,
    triggerWindGust,
    triggerWoodblock,
} from './voice-primitives.js';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const SOFT_BIOMES = new Set(['ethereal', 'nebula', 'glacial', 'arctic', 'barren', 'oceanic', 'crystalline']);
const HARSH_ADDITIVE_VOICES = new Set(['phase_cluster', 'modal_resonator']);
const NOISE_AMBIENCE_BIOMES = new Set(['storm', 'corrupted', 'quantum', 'volcanic']);
const AMBIENCE_VOICE_POOLS = {
    crystalline: ['crystal_chimes', 'wavetable_morph', 'drone_morph'],
    volcanic: ['bowed_metal', 'subpad', 'modal_resonator'],
    psychedelic: ['vowel_morph', 'wavetable_morph', 'drone_morph'],
    desert: ['hollow_pipe', 'drone_morph', 'bowed_metal'],
    oceanic: ['drone_morph', 'granular_cloud', 'vowel_morph'],
    corrupted: ['phase_cluster', 'granular_cloud', 'wavetable_morph'],
    barren: ['drone_morph', 'vowel_morph'],
    organic: ['hollow_pipe', 'drone_morph', 'marimba'],
    ethereal: ['drone_morph', 'vowel_morph', 'granular_cloud'],
    quantum: ['phase_cluster', 'granular_cloud', 'wavetable_morph'],
    nebula: ['drone_morph', 'vowel_morph', 'wavetable_morph'],
    glacial: ['granular_cloud', 'wavetable_morph', 'drone_morph'],
    fungal: ['marimba', 'hollow_pipe', 'drone_morph'],
    abyssal: ['drone_morph', 'modal_resonator', 'gong'],
    arctic: ['granular_cloud', 'drone_morph', 'wavetable_morph'],
    storm: ['phase_cluster', 'granular_cloud', 'subpad'],
    crystalloid: ['crystal_chimes', 'modal_resonator', 'wavetable_morph'],
};

const BIOME_LEAD_VOICE_BIAS = {
    crystalline: ['crystal_chimes', 'modal_resonator', 'wavetable_morph'],
    crystalloid: ['crystal_chimes', 'modal_resonator', 'phase_cluster'],
    fungal: ['marimba', 'hollow_pipe', 'modal_resonator'],
    organic: ['hollow_pipe', 'marimba', 'wavetable_morph'],
    storm: ['phase_cluster', 'modal_resonator', 'wavetable_morph'],
    desert: ['hollow_pipe', 'pluck', 'wavetable_morph'],
    oceanic: ['vowel_morph', 'wavetable_morph', 'drone_morph'],
    volcanic: ['bowed_metal', 'modal_resonator', 'subpad'],
    abyssal: ['gong', 'modal_resonator', 'subpad'],
};

const BIOME_TEXTURE_PROFILES = {
    organic: [
        { type: 'bird', layer: 'ambience', lane: [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0], chance: 0.45, level: 0.11 },
    ],
    fungal: [
        { type: 'bird', layer: 'ambience', lane: [0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0], chance: 0.38, level: 0.1 },
        { type: 'rain', layer: 'ambience', lane: [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0], chance: 0.35, level: 0.06 },
    ],
    oceanic: [
        { type: 'rain', layer: 'ambience', lane: [1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1], chance: 0.44, level: 0.08 },
    ],
    storm: [
        { type: 'rain', layer: 'ambience', lane: [1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0], chance: 0.6, level: 0.09 },
        { type: 'thunder', layer: 'fx', lane: [2, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0], chance: 0.28, level: 0.14 },
    ],
    crystalline: [
        { type: 'crystal', layer: 'fx', lane: [2, 0, 1, 0, 1, 0, 2, 0, 1, 0, 1, 0, 2, 0, 1, 0], chance: 0.58, level: 0.11 },
    ],
    crystalloid: [
        { type: 'crystal', layer: 'fx', lane: [2, 0, 1, 1, 0, 1, 2, 0, 1, 1, 0, 1, 2, 0, 1, 1], chance: 0.6, level: 0.12 },
    ],
    desert: [
        { type: 'bird', layer: 'ambience', lane: [0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1], chance: 0.28, level: 0.1 },
    ],
    default: [],
};

const FX_LANE_PATTERNS = {
    organic: [1, 0, 1, 0, 1, 0, 0, 1, 1, 0, 1, 0, 0, 1, 0, 1],
    harmonic: [2, 0, 1, 0, 1, 0, 2, 0, 1, 0, 1, 0, 2, 0, 1, 0],
    synthetic: [1, 0, 0, 1, 1, 0, 1, 0, 2, 0, 0, 1, 1, 0, 1, 0],
};

const FX_LANE_EVENT_POOL = {
    organic: {
        default: ['wind', 'rustle', 'rain'],
        oceanic: ['rain', 'wind'],
        organic: ['bird', 'rustle', 'rain'],
        fungal: ['rustle', 'bird', 'rain'],
        storm: ['rain', 'wind', 'thunder'],
        desert: ['wind', 'rustle'],
        volcanic: ['wind', 'thunder'],
    },
    harmonic: {
        default: ['crystal', 'shimmer'],
        crystalline: ['crystal', 'shimmer'],
        crystalloid: ['crystal', 'shimmer'],
        glacial: ['shimmer', 'crystal'],
        nebula: ['shimmer', 'crystal'],
        ethereal: ['shimmer'],
        abyssal: ['shimmer', 'crystal'],
    },
    synthetic: {
        default: ['delay', 'glitch'],
        storm: ['glitch', 'delay', 'thunder'],
        corrupted: ['glitch', 'delay'],
        quantum: ['glitch', 'delay', 'shimmer'],
        volcanic: ['delay', 'glitch'],
        barren: ['delay'],
    },
};

const DRONE_BED_STYLE_BY_BIOME = {
    crystalline: 'glass',
    crystalloid: 'glass',
    glacial: 'glass',
    arctic: 'glass',
    storm: 'storm',
    volcanic: 'storm',
    corrupted: 'storm',
    abyssal: 'abyssal',
    oceanic: 'breath',
    organic: 'breath',
    fungal: 'pulse',
    desert: 'pulse',
    quantum: 'fm',
    nebula: 'fm',
    psychedelic: 'fm',
    ethereal: 'breath',
    barren: 'pulse',
    default: 'core',
};

const DRONE_BED_STYLE_PROFILES = {
    core: { filter: 'lowpass', q: 0.58, pulse: false, noise: false, fm: false, droneSend: 0.78, padSend: 0.54, layers: [{ ratio: 1, wave: 'sine', gain: 0.44 }, { ratio: 0.5, wave: 'sine', gain: 0.22 }, { ratio: 1.5, wave: 'triangle', gain: 0.2 }] },
    glass: { filter: 'bandpass', q: 1.1, pulse: false, noise: false, fm: true, droneSend: 0.66, padSend: 0.62, layers: [{ ratio: 1, wave: 'triangle', gain: 0.36 }, { ratio: 1.5, wave: 'triangle', gain: 0.24 }, { ratio: 2.01, wave: 'sine', gain: 0.14 }] },
    storm: { filter: 'lowpass', q: 0.86, pulse: true, noise: true, fm: true, droneSend: 0.82, padSend: 0.36, layers: [{ ratio: 1, wave: 'sawtooth', gain: 0.36 }, { ratio: 0.5, wave: 'sine', gain: 0.24 }, { ratio: 1.25, wave: 'triangle', gain: 0.2 }] },
    breath: { filter: 'lowpass', q: 0.52, pulse: false, noise: true, fm: false, droneSend: 0.62, padSend: 0.68, layers: [{ ratio: 1, wave: 'sine', gain: 0.34 }, { ratio: 0.5, wave: 'sine', gain: 0.2 }, { ratio: 1.33, wave: 'triangle', gain: 0.2 }] },
    pulse: { filter: 'bandpass', q: 1, pulse: true, noise: false, fm: false, droneSend: 0.84, padSend: 0.4, layers: [{ ratio: 1, wave: 'triangle', gain: 0.38 }, { ratio: 0.5, wave: 'sine', gain: 0.25 }, { ratio: 1.5, wave: 'triangle', gain: 0.18 }] },
    fm: { filter: 'highpass', q: 0.72, pulse: true, noise: false, fm: true, droneSend: 0.58, padSend: 0.66, layers: [{ ratio: 1, wave: 'triangle', gain: 0.32 }, { ratio: 1.5, wave: 'triangle', gain: 0.18 }, { ratio: 2, wave: 'sine', gain: 0.14 }] },
    abyssal: { filter: 'lowpass', q: 0.92, pulse: false, noise: true, fm: true, droneSend: 0.9, padSend: 0.28, layers: [{ ratio: 1, wave: 'sine', gain: 0.46 }, { ratio: 0.5, wave: 'sine', gain: 0.28 }, { ratio: 0.75, wave: 'triangle', gain: 0.18 }] },
};

const CHORD_BLOOM_STYLE_BY_BIOME = {
    crystalline: 'shimmer',
    crystalloid: 'shimmer',
    storm: 'pulse',
    volcanic: 'pulse',
    corrupted: 'pulse',
    abyssal: 'low',
    oceanic: 'spread',
    organic: 'spread',
    fungal: 'pulse',
    desert: 'pulse',
    quantum: 'shimmer',
    nebula: 'spread',
    psychedelic: 'spread',
    ethereal: 'shimmer',
    glacial: 'shimmer',
    arctic: 'shimmer',
    barren: 'low',
    default: 'core',
};

const CHORD_BLOOM_PROFILES = {
    core: { filter: 'lowpass', q: 0.74, wave: 'triangle', sustainMul: 0.86, tapEvery: 1.2, tapGain: 0.32, octaveBase: [1.55, 1.8, 2.02, 2.3], pattern: [0, 1, 2, 1, 3, 2] },
    shimmer: { filter: 'bandpass', q: 1.02, wave: 'triangle', sustainMul: 0.82, tapEvery: 0.88, tapGain: 0.28, octaveBase: [1.72, 2.05, 2.34, 2.62], pattern: [0, 2, 1, 3, 2, 4, 1] },
    pulse: { filter: 'lowpass', q: 0.86, wave: 'sawtooth', sustainMul: 0.76, tapEvery: 0.7, tapGain: 0.36, octaveBase: [1.42, 1.66, 1.94, 2.22], pattern: [0, 0, 2, 1, 3, 1, 2, 4] },
    spread: { filter: 'highpass', q: 0.66, wave: 'triangle', sustainMul: 0.9, tapEvery: 1.35, tapGain: 0.24, octaveBase: [1.7, 2.02, 2.28, 2.5], pattern: [0, 1, 2, 3, 2, 4, 1] },
    low: { filter: 'lowpass', q: 0.92, wave: 'sine', sustainMul: 0.88, tapEvery: 1.5, tapGain: 0.22, octaveBase: [1.1, 1.35, 1.62, 1.88], pattern: [0, 1, 0, 2, 1, 3] },
};

const AMBIENCE_TEXTURE_BEHAVIOR = {
    crystalline: { crystals: 2, rain: 0, birds: 0, thunder: 0, noiseMul: 0.16 },
    crystalloid: { crystals: 3, rain: 0, birds: 0, thunder: 0, noiseMul: 0.18 },
    storm: { crystals: 0, rain: 5, birds: 0, thunder: 1, noiseMul: 0.46 },
    oceanic: { crystals: 0, rain: 4, birds: 0, thunder: 0, noiseMul: 0.28 },
    organic: { crystals: 0, rain: 1, birds: 2, thunder: 0, noiseMul: 0.18 },
    fungal: { crystals: 0, rain: 2, birds: 1, thunder: 0, noiseMul: 0.22 },
    desert: { crystals: 0, rain: 0, birds: 1, thunder: 0, noiseMul: 0.12 },
    abyssal: { crystals: 1, rain: 0, birds: 0, thunder: 1, noiseMul: 0.34 },
    volcanic: { crystals: 0, rain: 0, birds: 0, thunder: 1, noiseMul: 0.42 },
    corrupted: { crystals: 1, rain: 1, birds: 0, thunder: 1, noiseMul: 0.5 },
    quantum: { crystals: 2, rain: 1, birds: 0, thunder: 0, noiseMul: 0.36 },
    default: { crystals: 0, rain: 0, birds: 0, thunder: 0, noiseMul: 0.2 },
};

function automateLongVoiceGate(param, {
    scheduleTime = 0,
    dur = 2,
    stepSeconds = 0.125,
    rng = null,
    intensity = 0.4,
    patternLengths = [5, 7],
} = {}) {
    if (!param || !rng) return;
    const patternLen = rng.pick(patternLengths);
    const pattern = [];
    for (let i = 0; i < patternLen; i++) {
        const chance = i === 0 ? 0.98 : clamp(0.28 + intensity * 0.5 + (i % 3 === 0 ? 0.12 : 0), 0.12, 0.95);
        pattern.push(rng.bool(chance) ? 1 : 0);
    }
    if (!pattern.some((v) => v === 1)) pattern[0] = 1;

    const tick = clamp(stepSeconds * rng.pick([0.5, 0.75, 1]), 0.07, 0.32);
    let t = scheduleTime;
    let idx = 0;
    param.cancelScheduledValues(scheduleTime);
    param.setValueAtTime(0.0001, scheduleTime);
    while (t < scheduleTime + dur) {
        const on = pattern[idx % patternLen] === 1;
        const level = on
            ? clamp(0.72 + intensity * 0.44 + (idx % patternLen === 0 ? 0.18 : 0), 0.46, 1.34)
            : clamp(0.22 + intensity * 0.18, 0.1, 0.58);
        param.linearRampToValueAtTime(level, t + Math.min(0.03, tick * 0.48));
        t += tick;
        idx++;
    }
    param.linearRampToValueAtTime(0.0001, scheduleTime + dur);
}

function chooseMelodyVoice(planet, rng, voiceHint = null, section = 'INTRO') {
    const available = Array.isArray(planet?.ac?.melodyWaves) && planet.ac.melodyWaves.length
        ? planet.ac.melodyWaves
        : ['sine'];
    if (voiceHint && available.includes(voiceHint)) return voiceHint;
    if (voiceHint && ADDITIVE_VOICE_NAMES.includes(voiceHint)) return voiceHint;

    let pool = available.slice();
    const biomeId = planet?.biome?.id || 'default';
    const leadBias = BIOME_LEAD_VOICE_BIAS[biomeId];
    if (Array.isArray(leadBias) && leadBias.length && section !== 'AFTERGLOW') {
        const preferred = pool.filter((voice) => leadBias.includes(voice));
        if (preferred.length) pool = preferred;
    }
    if (SOFT_BIOMES.has(biomeId)) {
        const softened = pool.filter((voice) => !HARSH_ADDITIVE_VOICES.has(voice));
        if (softened.length) pool = softened;
    }
    if (section !== 'AFTERGLOW' && pool.length > 1) {
        const lessDrone = pool.filter((voice) => voice !== 'drone_morph');
        if (lessDrone.length) pool = lessDrone;
    }
    if (section === 'AFTERGLOW') {
        const tailVoices = pool.filter((voice) => ['drone_morph', 'wavetable_morph', 'vowel_morph', 'choir', 'subpad', 'strings', 'granular_cloud'].includes(voice));
        if (tailVoices.length) pool = tailVoices;
    }
    return rng.pick(pool.length ? pool : available);
}

function scheduleRelease(pool, voiceId, ttlSec) {
    if (!voiceId) return;
    setTimeout(() => pool.releaseVoice(voiceId), Math.max(30, Math.round(ttlSec * 1000)));
}

function rngFromSeed(seed = 1) {
    return new RNG((seed >>> 0) + 0x9e3779b9);
}

function resolveTierBaseDensity(tier = 'balanced') {
    if (tier === 'lush') return 0.44;
    if (tier === 'sparse') return 0.18;
    return 0.3;
}

function resolveFxLaneWeights({ planet, modulation = {}, section = 'INTRO', quality = {} } = {}) {
    const tier = modulation?.richnessTier || planet?.v2?.richnessProfile?.tier || 'balanced';
    const fx = modulation?.fxProfile || planet?.v2?.fxProfile || { organic: 0.4, harmonic: 0.4, synthetic: 0.4, contrast: 0.4 };
    const qualityScalar = clamp((quality?.qualityScalar ?? 1) * (quality?.detailDensityMul ?? 1), 0.2, 1.3);
    const sectionMul = section === 'SURGE'
        ? { organic: 1.12, harmonic: 0.98, synthetic: 1.28 }
        : section === 'AFTERGLOW'
            ? { organic: 0.86, harmonic: 1.22, synthetic: 0.82 }
            : section === 'GROWTH'
                ? { organic: 1.04, harmonic: 1.1, synthetic: 1.06 }
                : { organic: 1, harmonic: 1, synthetic: 1 };
    const contrastWindow = !!modulation?.contrastWindow;
    const contrastLift = contrastWindow ? 1.22 : 1;
    return {
        tier,
        baseDensity: resolveTierBaseDensity(tier),
        organic: clamp((fx.organic ?? 0.4) * sectionMul.organic * qualityScalar, 0, 1.4),
        harmonic: clamp((fx.harmonic ?? 0.4) * sectionMul.harmonic * qualityScalar * (contrastWindow ? 1.18 : 1), 0, 1.5),
        synthetic: clamp((fx.synthetic ?? 0.4) * sectionMul.synthetic * qualityScalar * contrastLift, 0, 1.5),
    };
}

function pickFxLaneEventType(lane = 'organic', biomeId = 'default', rng) {
    const poolByLane = FX_LANE_EVENT_POOL[lane] || FX_LANE_EVENT_POOL.organic;
    const pool = poolByLane[biomeId] || poolByLane.default || ['rain'];
    return rng.pick(pool);
}

export class VoiceFactory {
    constructor(host, buses, voicePool, spatialEngine) {
        this.host = host;
        this.buses = buses;
        this.voicePool = voicePool;
        this.spatialEngine = spatialEngine;
        this.seedBase = (host.planet?.seed || 1) + 131011;
        this.lastAmbienceAt = Number.NEGATIVE_INFINITY;
    }

    updateRouting(buses, spatialEngine) {
        this.buses = buses;
        this.spatialEngine = spatialEngine;
    }

    _triggerTextureType(type, dest, when, velocity, seed, durationHintSec = 0.8) {
        const host = this.host;
        switch (type) {
            case 'bird':
                triggerBirdCall(host, dest, when, velocity, seed);
                return 0.8;
            case 'rain':
                triggerRainDrop(host, dest, when, velocity, seed);
                return 0.7;
            case 'crystal':
                triggerCrystalShard(host, dest, when, velocity, seed);
                return 1.0;
            case 'thunder':
                triggerThunderRumble(host, dest, when, velocity, seed);
                return 3.0;
            case 'wind':
                triggerWindGust(host, dest, when, Math.max(0.5, durationHintSec), velocity, seed);
                return Math.max(0.8, durationHintSec + 0.2);
            case 'rustle':
                triggerRustle(host, dest, when, velocity, seed);
                return 0.5;
            case 'shimmer':
                triggerHarmonicShimmer(host, dest, when, velocity, seed);
                return 1.2;
            case 'delay':
                triggerDelaySwell(host, dest, when, Math.max(0.6, durationHintSec), velocity, seed);
                return Math.max(0.8, durationHintSec + 0.3);
            case 'glitch':
                triggerGlitchPulse(host, dest, when, velocity, seed);
                return 0.45;
            default:
                return 0;
        }
    }

    playMelody(event, scheduleTime, modulation = {}) {
        if (!event?.play || !Number.isFinite(event.step)) return false;
        const host = this.host;
        const planet = host.planet;
        const ctx = host.ctx;
        if (!planet || !ctx) return false;

        const rng = new RNG(this.seedBase + host.stepNote * 41 + event.step * 7);
        const voice = chooseMelodyVoice(planet, rng, event.voiceHint, event.section);
        const microRatio = Math.pow(2, (event.microCents || 0) / 1200);
        const freq = host._getStepFrequency(planet, event.step, event.octave || 3) * microRatio;
        const nowSec = ctx.currentTime;
        const durSec = clamp((0.32 + (event.durScale || 1) * 0.45) * (0.78 + (modulation.texture || 0.5) * 0.6), 0.18, 2.6);
        const ttlSec = durSec + 0.5;
        const melodicTrim = clamp(0.72 + (modulation.stability || 0.5) * 0.2, 0.6, 0.9);
        const booking = this.voicePool.requestVoice({
            nowSec,
            ttlSec,
            kind: 'melody',
            weight: ADDITIVE_VOICE_NAMES.includes(voice) ? 1.2 : 1,
        });
        if (!booking.granted) return false;

        const spatial = this.spatialEngine?.createPanner((planet.seed + host.stepNote * 13) >>> 0, rng.range(-0.4, 0.4));
        const panner = spatial?.panner || ctx.createStereoPanner();
        const voiceOut = ctx.createGain();
        panner.connect(this.buses.layerGains.melody);
        voiceOut.connect(panner);

        if (ADDITIVE_VOICE_NAMES.includes(voice)) {
            voiceOut.gain.value = clamp((event.velocity || 0.5) * 0.24 * melodicTrim, 0.06, 0.24);
            buildVoice(voice, ctx, freq, voiceOut, rng, 0.04, durSec, host.nodes);
            host.nodes.pushTransient(ttlSec, voiceOut, panner);
        } else {
            const osc = ctx.createOscillator();
            const env = ctx.createGain();
            osc.type = host._resolveOscType(voice, 'sine');
            osc.frequency.value = freq;
            env.gain.setValueAtTime(0.0001, scheduleTime);
            env.gain.linearRampToValueAtTime(clamp((event.velocity || 0.5) * 0.25 * melodicTrim, 0.05, 0.26), scheduleTime + 0.02);
            env.gain.exponentialRampToValueAtTime(0.0001, scheduleTime + durSec);
            osc.connect(env);
            env.connect(voiceOut);
            osc.start(scheduleTime);
            osc.stop(scheduleTime + durSec + 0.03);
            host.nodes.pushTransient(ttlSec, osc, env, voiceOut, panner);
        }

        if (spatial?.lfo) host.nodes.pushTransient(ttlSec, spatial.lfo, spatial.lfoGain);
        scheduleRelease(this.voicePool, booking.id, ttlSec);
        host._lastMelodyStep = event.step;
        return true;
    }

    playCounterline(step, scheduleTime, modulation = {}) {
        if (!Number.isFinite(step)) return;
        const host = this.host;
        const planet = host.planet;
        if (!planet || !host.ctx) return;
        const rng = new RNG(this.seedBase + host.stepNote * 53 + 7000);
        const freq = host._getStepFrequency(planet, step, rng.pick([2, 3]));
        const durSec = clamp(0.25 + (modulation.motion || 0.5) * 0.3, 0.16, 1.2);
        const booking = this.voicePool.requestVoice({
            nowSec: host.ctx.currentTime,
            ttlSec: durSec + 0.4,
            kind: 'counterline',
            weight: 0.8,
        });
        if (!booking.granted) return;

        const osc = host.ctx.createOscillator();
        const env = host.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.value = freq;
        env.gain.setValueAtTime(0.0001, scheduleTime);
        env.gain.linearRampToValueAtTime(0.07, scheduleTime + 0.03);
        env.gain.exponentialRampToValueAtTime(0.0001, scheduleTime + durSec);
        osc.connect(env);
        env.connect(this.buses.layerGains.melody);
        osc.start(scheduleTime);
        osc.stop(scheduleTime + durSec + 0.03);
        host.nodes.pushTransient(durSec + 0.45, osc, env);
        scheduleRelease(this.voicePool, booking.id, durSec + 0.42);
    }

    triggerPercussion(events = [], scheduleTime = 0) {
        if (!events.length) return;
        const host = this.host;
        const dest = this.buses.layerGains.percussion;
        const percSoftening = clamp(1 - (host.planet?.ac?.chordAudibility || 0.3) * 0.32, 0.62, 1);
        const seedBase = this.seedBase + host.stepPerc * 211;
        events.forEach((event, index) => {
            const micro = (event.microShiftMs || 0) / 1000;
            const when = Math.max(host.ctx.currentTime, scheduleTime + micro);
            const velocity = clamp((event.velocity || 0.3) * 0.86 * percSoftening, 0.035, 0.78);
            const seed = seedBase + index * 19;
            switch (event.voice) {
                case 'kick':
                    triggerKick(host, dest, when, velocity, seed);
                    break;
                case 'snare':
                    triggerSnare(host, dest, when, velocity, seed);
                    break;
                case 'hat':
                    triggerHat(host, dest, when, velocity, { open: !!event.open, seed });
                    break;
                case 'shaker':
                    triggerShaker(host, dest, when, velocity, seed);
                    break;
                case 'ghost':
                    triggerHat(host, dest, when, velocity * 0.5, { open: false, seed });
                    break;
                case 'tom':
                    triggerTom(host, dest, when, velocity, seed);
                    break;
                case 'clack':
                    if (rngFromSeed(seed).bool(0.5)) {
                        triggerShaker(host, dest, when, velocity * 0.72, seed + 77);
                    } else {
                        triggerWoodblock(host, dest, when, velocity * 0.84, seed + 91);
                    }
                    break;
                case 'woodblock':
                    triggerWoodblock(host, dest, when, velocity, seed + 109);
                    break;
                default:
                    break;
            }
        });
    }

    playDroneBed(scheduleTime, durationSec = 6, modulation = {}) {
        const host = this.host;
        const planet = host.planet;
        const ctx = host.ctx;
        if (!planet || !ctx) return false;
        const biomeId = planet?.biome?.id || 'default';
        const rng = new RNG(this.seedBase + host.stepChord * 59 + host.stepNote * 3 + host.stepGrain * 11);

        const dur = clamp(durationSec, 2.2, 18);
        const ttlSec = dur + 1.4;
        const booking = this.voicePool.requestVoice({
            nowSec: ctx.currentTime,
            ttlSec,
            kind: 'drone',
            weight: 1.5,
        });
        if (!booking.granted) return false;

        const intervals = Array.isArray(host._currentChordIntervals) && host._currentChordIntervals.length
            ? host._currentChordIntervals
            : [planet.scale?.[0] || 0, planet.scale?.[2] || 4];
        const rootStep = intervals[0] || 0;
        const colorStep = intervals[Math.min(1, intervals.length - 1)] || intervals[0] || 0;
        const fifthStep = host._shiftScaleStep(planet, rootStep, 4, 0);
        const rootFreq = host._getStepFrequency(planet, rootStep, 0.76);
        const colorFreq = host._getStepFrequency(planet, colorStep, 1.02);
        const fifthFreq = host._getStepFrequency(planet, fifthStep, 1.16);
        const styleId = DRONE_BED_STYLE_BY_BIOME[biomeId] || DRONE_BED_STYLE_BY_BIOME.default;
        const style = DRONE_BED_STYLE_PROFILES[styleId] || DRONE_BED_STYLE_PROFILES.core;
        const stepSeconds = host.transport?.stepSeconds || 0.125;

        const body = ctx.createGain();
        const tone = ctx.createBiquadFilter();
        const env = ctx.createGain();
        const gate = ctx.createGain();
        const pan = ctx.createStereoPanner();
        const droneSend = ctx.createGain();
        const padSend = ctx.createGain();
        const motionLfo = ctx.createOscillator();
        const motionGain = ctx.createGain();

        const attack = clamp(0.48 + (modulation.space || 0.5) * 0.9 + (styleId === 'glass' ? 0.18 : 0), 0.32, 2.8);
        const level = clamp(0.1 + (modulation.texture || 0.5) * 0.1 + (planet?.ac?.chordAudibility || 0.3) * 0.12, 0.08, 0.3);
        const filterBase = clamp(planet?.ac?.filterBase || 1100, 180, 6200);

        tone.type = style.filter;
        tone.frequency.value = clamp(
            filterBase
            * (styleId === 'abyssal' ? 1.2 : styleId === 'glass' ? 2.2 : styleId === 'fm' ? 1.85 : 1.65)
            * (0.8 + (modulation.texture || 0.5) * 0.52),
            180,
            8800,
        );
        tone.Q.value = clamp(style.q + (modulation.complexity || 0.5) * 0.56, 0.4, 3.8);
        pan.pan.value = rng.range(-0.22, 0.22);
        droneSend.gain.value = clamp(style.droneSend * (0.76 + (modulation.motion || 0.5) * 0.34), 0.22, 1.1);
        padSend.gain.value = clamp(style.padSend * (0.68 + (modulation.space || 0.5) * 0.42), 0.12, 1);

        env.gain.setValueAtTime(0.0001, scheduleTime);
        env.gain.linearRampToValueAtTime(level, scheduleTime + attack);
        env.gain.setValueAtTime(level * 0.84, scheduleTime + dur * 0.64);
        env.gain.exponentialRampToValueAtTime(0.0001, scheduleTime + dur);
        if (style.pulse) {
            automateLongVoiceGate(gate.gain, {
                scheduleTime,
                dur,
                stepSeconds,
                rng,
                intensity: clamp((modulation.motion || 0.5) * 0.78 + 0.18, 0.2, 0.95),
                patternLengths: styleId === 'storm' ? [5, 7, 9] : [5, 7],
            });
        } else {
            gate.gain.setValueAtTime(1, scheduleTime);
        }

        body.connect(tone);
        tone.connect(env);
        env.connect(gate);
        gate.connect(pan);
        pan.connect(droneSend);
        pan.connect(padSend);
        droneSend.connect(this.buses.layerGains.drones);
        padSend.connect(this.buses.layerGains.pads);

        const nodes = [body, tone, env, gate, pan, droneSend, padSend, motionLfo, motionGain];
        const detuneTargets = [];
        const frequencyPool = [rootFreq, colorFreq, fifthFreq, rootFreq * 2.02];
        style.layers.forEach((layer, idx) => {
            const osc = ctx.createOscillator();
            const voiceGain = ctx.createGain();
            osc.type = host._resolveOscType(layer.wave, style.wave || 'triangle');
            const f = frequencyPool[idx % frequencyPool.length] || (rootFreq * (layer.ratio || 1));
            osc.frequency.value = Math.max(20, f * (layer.ratio || 1));
            osc.detune.value = rng.range(-11, 11);
            voiceGain.gain.value = clamp(layer.gain * (0.8 + (modulation.texture || 0.5) * 0.5), 0.04, 0.56);
            osc.connect(voiceGain);
            voiceGain.connect(body);
            osc.start(scheduleTime);
            osc.stop(scheduleTime + dur + 0.03);
            nodes.push(osc, voiceGain);
            detuneTargets.push(osc.detune);
        });

        if (style.fm) {
            const carrier = ctx.createOscillator();
            const modOsc = ctx.createOscillator();
            const modGain = ctx.createGain();
            const fmGain = ctx.createGain();
            carrier.type = styleId === 'storm' ? 'sawtooth' : 'triangle';
            modOsc.type = 'sine';
            carrier.frequency.value = colorFreq;
            modOsc.frequency.value = rootFreq * rng.pick([1.5, 2, 2.5, 3]);
            modGain.gain.value = clamp(rootFreq * (0.08 + (modulation.complexity || 0.5) * 0.28), 10, 420);
            fmGain.gain.value = clamp(0.06 + (modulation.texture || 0.5) * 0.1, 0.04, 0.2);
            modOsc.connect(modGain);
            modGain.connect(carrier.frequency);
            carrier.connect(fmGain);
            fmGain.connect(body);
            modOsc.start(scheduleTime);
            carrier.start(scheduleTime);
            modOsc.stop(scheduleTime + dur + 0.04);
            carrier.stop(scheduleTime + dur + 0.04);
            nodes.push(carrier, modOsc, modGain, fmGain);
            detuneTargets.push(carrier.detune);
        }

        if (style.noise) {
            const len = Math.floor(ctx.sampleRate * Math.max(0.6, dur * 0.66));
            const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
            const data = buffer.getChannelData(0);
            let smooth = 0;
            for (let i = 0; i < len; i++) {
                smooth = smooth * 0.985 + (rng.next() * 2 - 1) * 0.08;
                data[i] = smooth;
            }
            const source = ctx.createBufferSource();
            const noiseFilter = ctx.createBiquadFilter();
            const noiseGain = ctx.createGain();
            source.buffer = buffer;
            noiseFilter.type = styleId === 'glass' ? 'bandpass' : 'lowpass';
            noiseFilter.frequency.value = styleId === 'glass'
                ? clamp(1800 + (modulation.texture || 0.5) * 2400, 900, 6800)
                : clamp(260 + (modulation.texture || 0.5) * 680, 140, 2200);
            noiseFilter.Q.value = styleId === 'glass' ? 1.2 : 0.48;
            noiseGain.gain.setValueAtTime(0.0001, scheduleTime);
            noiseGain.gain.linearRampToValueAtTime(clamp(0.02 + (modulation.dissonance || 0.2) * 0.05, 0.015, 0.09), scheduleTime + attack * 0.66);
            noiseGain.gain.exponentialRampToValueAtTime(0.0001, scheduleTime + dur);
            source.connect(noiseFilter);
            noiseFilter.connect(noiseGain);
            noiseGain.connect(body);
            source.start(scheduleTime);
            source.stop(scheduleTime + dur + 0.03);
            nodes.push(source, noiseFilter, noiseGain);
        }

        motionLfo.type = 'sine';
        motionLfo.frequency.value = clamp(0.018 + (modulation.motion || 0.5) * 0.16 + (style.pulse ? 0.05 : 0), 0.01, 0.6);
        motionGain.gain.value = clamp(4 + (modulation.motion || 0.5) * 20 + (style.fm ? 6 : 0), 4, 32);
        motionLfo.connect(motionGain);
        detuneTargets.forEach((target) => motionGain.connect(target));
        motionLfo.start(scheduleTime);
        motionLfo.stop(scheduleTime + dur + 0.2);

        host.nodes.pushTransient(ttlSec, ...nodes);

        if (styleId === 'storm' && rng.bool(0.34 + (modulation.dissonance || 0.2) * 0.3)) {
            triggerRainDrop(host, this.buses.layerGains.ambience, scheduleTime + rng.range(0.06, 0.22), 0.09, this.seedBase + host.stepChord * 97);
        }
        if (styleId === 'glass' && rng.bool(0.38)) {
            triggerCrystalShard(host, this.buses.layerGains.fx, scheduleTime + rng.range(0.08, 0.3), 0.09, this.seedBase + host.stepChord * 101);
        }
        if (styleId === 'storm' && rng.bool(0.14 + (modulation.dissonance || 0.2) * 0.26)) {
            triggerThunderRumble(host, this.buses.layerGains.fx, scheduleTime + dur * rng.range(0.18, 0.54), 0.08, this.seedBase + host.stepChord * 103);
        }

        scheduleRelease(this.voicePool, booking.id, ttlSec);
        return true;
    }

    playBassPulse(scheduleTime, durationSec = 0.8, modulation = {}) {
        const host = this.host;
        const planet = host.planet;
        const ctx = host.ctx;
        if (!planet || !ctx) return false;

        const dur = clamp(durationSec, 0.35, 2.4);
        const ttlSec = dur + 0.4;
        const booking = this.voicePool.requestVoice({
            nowSec: ctx.currentTime,
            ttlSec,
            kind: 'bass',
            weight: 1.2,
        });
        if (!booking.granted) return false;

        const step = Array.isArray(host._currentChordIntervals) && host._currentChordIntervals.length
            ? host._currentChordIntervals[0]
            : (planet.scale?.[0] || 0);
        const freq = host._getStepFrequency(planet, step || 0, 0.56);
        const osc = ctx.createOscillator();
        const sub = ctx.createOscillator();
        const filter = ctx.createBiquadFilter();
        const env = ctx.createGain();

        osc.type = 'triangle';
        sub.type = 'sine';
        osc.frequency.value = freq;
        sub.frequency.value = Math.max(24, freq * 0.5);

        filter.type = 'lowpass';
        filter.frequency.value = clamp(220 + (modulation.motion || 0.5) * 180, 120, 520);
        filter.Q.value = 0.6;

        const level = clamp(0.08 + (modulation.complexity || 0.5) * 0.07, 0.06, 0.17);
        env.gain.setValueAtTime(0.0001, scheduleTime);
        env.gain.linearRampToValueAtTime(level, scheduleTime + 0.04);
        env.gain.exponentialRampToValueAtTime(0.0001, scheduleTime + dur);

        osc.connect(filter);
        sub.connect(filter);
        filter.connect(env);
        env.connect(this.buses.layerGains.bass);

        osc.start(scheduleTime);
        sub.start(scheduleTime);
        osc.stop(scheduleTime + dur + 0.03);
        sub.stop(scheduleTime + dur + 0.03);

        host.nodes.pushTransient(ttlSec, osc, sub, filter, env);
        scheduleRelease(this.voicePool, booking.id, ttlSec);
        return true;
    }

    playChordBloom(scheduleTime, durationSec = 2.6, modulation = {}) {
        const host = this.host;
        const planet = host.planet;
        const ctx = host.ctx;
        if (!planet || !ctx) return false;

        const intervals = Array.isArray(host._currentChordIntervals) && host._currentChordIntervals.length >= 3
            ? host._currentChordIntervals.slice(0, 3)
            : [0, 4, 7];
        const dur = clamp(durationSec, 1.2, 14);
        const ttlSec = dur + 0.8;
        const booking = this.voicePool.requestVoice({
            nowSec: ctx.currentTime,
            ttlSec,
            kind: 'chord',
            weight: 1.3,
        });
        if (!booking.granted) return false;

        const biomeId = planet?.biome?.id || 'default';
        const richnessTier = modulation?.richnessTier || planet?.v2?.richnessProfile?.tier || 'balanced';
        const phraseAnchor = !!modulation?.phraseAnchor;
        const contrastWindow = !!modulation?.contrastWindow;
        const styleId = CHORD_BLOOM_STYLE_BY_BIOME[biomeId] || CHORD_BLOOM_STYLE_BY_BIOME.default;
        const style = CHORD_BLOOM_PROFILES[styleId] || CHORD_BLOOM_PROFILES.core;
        const rng = new RNG(this.seedBase + host.stepChord * 41 + this.host.stepNote * 7 + host.stepPerc * 5);

        const chordSteps = intervals.slice();
        chordSteps.push(host._shiftScaleStep(planet, intervals[0], 2, 0));
        chordSteps.push(host._shiftScaleStep(planet, intervals[0], 7, 0));

        const chordBody = ctx.createGain();
        const chordFilter = ctx.createBiquadFilter();
        const chordEnv = ctx.createGain();
        const rhythmGate = ctx.createGain();
        const padSend = ctx.createGain();
        const droneSend = ctx.createGain();
        const attack = clamp(
            0.24 + (modulation.space || 0.5) * 0.58 + (phraseAnchor ? 0.08 : 0) + (richnessTier === 'sparse' ? 0.08 : 0),
            0.16,
            1.6,
        );
        const level = clamp(
            0.08
            + (planet?.ac?.chordAudibility || 0.3) * 0.14
            + (modulation.texture || 0.5) * 0.08
            + (richnessTier === 'lush' ? 0.02 : richnessTier === 'sparse' ? -0.02 : 0)
            + (contrastWindow ? 0.018 : 0),
            0.04,
            0.28,
        );
        const filterBase = clamp((planet?.ac?.filterBase || 1200) * (styleId === 'low' ? 1.6 : styleId === 'shimmer' ? 2.5 : 2.1), 280, 9800);
        const baseWave = host._resolveOscType(planet?.ac?.padWave || style.wave || 'triangle', style.wave || 'triangle');
        const stepSeconds = host.transport?.stepSeconds || 0.125;

        chordFilter.type = style.filter;
        chordFilter.frequency.value = clamp(filterBase * (0.74 + (modulation.texture || 0.5) * 0.58), 220, 9800);
        chordFilter.Q.value = clamp(style.q + (modulation.complexity || 0.5) * 0.46, 0.3, 4);
        padSend.gain.value = clamp(0.74 + (modulation.space || 0.5) * 0.3, 0.36, 1.2);
        droneSend.gain.value = clamp(0.16 + (modulation.texture || 0.5) * 0.22, 0.08, 0.5);

        chordEnv.gain.setValueAtTime(0.0001, scheduleTime);
        chordEnv.gain.linearRampToValueAtTime(level, scheduleTime + attack);
        chordEnv.gain.setValueAtTime(level * style.sustainMul, scheduleTime + dur * 0.62);
        chordEnv.gain.exponentialRampToValueAtTime(0.0001, scheduleTime + dur);
        if (styleId === 'pulse') {
            automateLongVoiceGate(rhythmGate.gain, {
                scheduleTime,
                dur,
                stepSeconds,
                rng,
                intensity: clamp(0.26 + (modulation.motion || 0.5) * 0.66, 0.2, 0.96),
                patternLengths: [5, 7, 9],
            });
        } else {
            rhythmGate.gain.setValueAtTime(1, scheduleTime);
        }

        chordBody.connect(chordFilter);
        chordFilter.connect(chordEnv);
        chordEnv.connect(rhythmGate);
        rhythmGate.connect(padSend);
        rhythmGate.connect(droneSend);
        padSend.connect(this.buses.layerGains.pads);
        droneSend.connect(this.buses.layerGains.drones);

        const nodes = [chordBody, chordFilter, chordEnv, rhythmGate, padSend, droneSend];
        const detuneTargets = [];

        for (let idx = 0; idx < 3; idx++) {
            const step = chordSteps[idx];
            const osc = ctx.createOscillator();
            const voiceGain = ctx.createGain();
            const quarterTone = (planet?.quarterToneProb || 0) > 0 && rng.bool((planet?.quarterToneProb || 0) * 0.72)
                ? rng.pick([-50, 50])
                : 0;
            osc.type = baseWave;
            osc.frequency.value = host._getStepFrequency(planet, step, style.octaveBase[idx] || 1.8);
            osc.detune.value = quarterTone + rng.range(-10, 10);
            voiceGain.gain.value = clamp((1 / (2.6 + idx * 0.35)) * (0.84 + (modulation.texture || 0.5) * 0.26), 0.16, 0.56);
            osc.connect(voiceGain);
            voiceGain.connect(chordBody);
            osc.start(scheduleTime);
            osc.stop(scheduleTime + dur + 0.03);
            nodes.push(osc, voiceGain);
            detuneTargets.push(osc.detune);
        }

        const tapDensityBias = clamp(
            (modulation?.bloomTapBias || 0)
            + (phraseAnchor ? 0.12 : 0)
            + (richnessTier === 'lush' ? 0.08 : richnessTier === 'sparse' ? -0.1 : 0),
            -0.2,
            0.32,
        );
        const tapSpacing = clamp(
            stepSeconds * style.tapEvery * (0.86 + (1 - (modulation.motion || 0.5)) * 0.3 - tapDensityBias),
            0.07,
            0.5,
        );
        const tapDur = clamp(stepSeconds * (0.72 + (modulation.motion || 0.5) * 1.18), 0.08, 0.68);
        const tapStart = scheduleTime + attack * 0.32;
        const maxTaps = Math.max(3, Math.round(dur / tapSpacing));
        for (let i = 0; i < maxTaps; i++) {
            const when = tapStart + i * tapSpacing;
            if (when > scheduleTime + dur * 0.9) break;
            const patternIndex = style.pattern[i % style.pattern.length] ?? 0;
            const step = chordSteps[patternIndex % chordSteps.length];
            const octave = (style.octaveBase[(patternIndex + i) % style.octaveBase.length] || 1.9) * (contrastWindow ? 1.06 : 1);
            const osc = ctx.createOscillator();
            const env = ctx.createGain();
            osc.type = host._resolveOscType(rng.pick([style.wave, 'triangle', 'sine']), 'triangle');
            osc.frequency.value = host._getStepFrequency(planet, step, octave * rng.range(0.94, 1.04));
            osc.detune.value = rng.range(-12, 12);
            env.gain.setValueAtTime(0.0001, when);
            env.gain.linearRampToValueAtTime(clamp(level * style.tapGain, 0.03, 0.12), when + Math.min(0.03, tapDur * 0.35));
            env.gain.exponentialRampToValueAtTime(0.0001, when + tapDur);
            osc.connect(env);
            env.connect(chordBody);
            osc.start(when);
            osc.stop(when + tapDur + 0.02);
            nodes.push(osc, env);
            detuneTargets.push(osc.detune);
        }

        const sway = ctx.createOscillator();
        const swayGain = ctx.createGain();
        sway.type = 'sine';
        sway.frequency.value = clamp(0.035 + (modulation.motion || 0.5) * 0.18 + (styleId === 'pulse' ? 0.06 : 0), 0.02, 0.48);
        swayGain.gain.value = clamp(5 + (modulation.motion || 0.5) * 16, 4, 24);
        sway.connect(swayGain);
        detuneTargets.forEach((target) => swayGain.connect(target));
        sway.start(scheduleTime);
        sway.stop(scheduleTime + dur + 0.1);
        nodes.push(sway, swayGain);

        if ((styleId === 'shimmer' || biomeId === 'crystalline' || biomeId === 'crystalloid') && rng.bool(0.44)) {
            triggerCrystalShard(host, this.buses.layerGains.fx, scheduleTime + rng.range(0.08, 0.24), 0.1, this.seedBase + host.stepChord * 173);
        }

        host.nodes.pushTransient(ttlSec, ...nodes);
        scheduleRelease(this.voicePool, booking.id, ttlSec);
        host.stepChord++;
        return true;
    }

    playBiomeSignatureFm(scheduleTime, durationSec = 1.8, modulation = {}) {
        const host = this.host;
        const planet = host.planet;
        const ctx = host.ctx;
        if (!planet || !ctx) return false;

        const biomeId = planet?.biome?.id || 'default';
        const profileMap = {
            crystalline: { ratio: 3.8, indexMul: 0.26, layer: 'ambience', level: 0.1, wave: 'sine' },
            volcanic: { ratio: 1.4, indexMul: 0.62, layer: 'bass', level: 0.12, wave: 'triangle' },
            psychedelic: { ratio: 2.8, indexMul: 0.58, layer: 'melody', level: 0.11, wave: 'triangle' },
            desert: { ratio: 4.2, indexMul: 0.32, layer: 'ambience', level: 0.09, wave: 'sine' },
            organic: { ratio: 2.2, indexMul: 0.34, layer: 'melody', level: 0.1, wave: 'triangle' },
            ethereal: { ratio: 2.4, indexMul: 0.35, layer: 'pads', level: 0.09, wave: 'sine' },
            nebula: { ratio: 3.1, indexMul: 0.42, layer: 'pads', level: 0.11, wave: 'triangle' },
            glacial: { ratio: 4.6, indexMul: 0.22, layer: 'ambience', level: 0.08, wave: 'sine' },
            oceanic: { ratio: 2.0, indexMul: 0.28, layer: 'pads', level: 0.1, wave: 'triangle' },
            storm: { ratio: 1.4, indexMul: 0.62, layer: 'melody', level: 0.11, wave: 'sawtooth' },
            corrupted: { ratio: 1.1, indexMul: 0.7, layer: 'fx', level: 0.12, wave: 'square' },
            quantum: { ratio: 5.2, indexMul: 0.85, layer: 'fx', level: 0.1, wave: 'triangle' },
            fungal: { ratio: 1.9, indexMul: 0.38, layer: 'melody', level: 0.1, wave: 'triangle' },
            abyssal: { ratio: 0.9, indexMul: 0.48, layer: 'bass', level: 0.11, wave: 'sine' },
            arctic: { ratio: 4.0, indexMul: 0.24, layer: 'ambience', level: 0.09, wave: 'sine' },
            crystalloid: { ratio: 3.2, indexMul: 0.44, layer: 'pads', level: 0.1, wave: 'triangle' },
            barren: { ratio: 5.0, indexMul: 0.18, layer: 'ambience', level: 0.075, wave: 'sine' },
            default: { ratio: 2.2, indexMul: 0.36, layer: 'pads', level: 0.1, wave: 'triangle' },
        };
        const profile = profileMap[biomeId] || profileMap.default;
        const dur = clamp(durationSec, 0.8, 5.5);
        const ttlSec = dur + 0.6;

        const booking = this.voicePool.requestVoice({
            nowSec: ctx.currentTime,
            ttlSec,
            kind: 'fm-signature',
            weight: 1.15,
        });
        if (!booking.granted) return false;

        const step = Array.isArray(host._currentChordIntervals) && host._currentChordIntervals.length
            ? host._currentChordIntervals[0]
            : (planet.scale?.[0] || 0);
        const carrierFreq = host._getStepFrequency(planet, step || 0, 1.35);
        const fmRatio = clamp((planet?.ac?.fmRatio || 2.2) * profile.ratio * 0.45, 0.5, 8.5);
        const fmIndexNorm = clamp((planet?.ac?.fmIndex || 40) / 140, 0.06, 1.4);
        const modIndex = clamp(carrierFreq * fmIndexNorm * profile.indexMul, 12, 520);

        const carrier = ctx.createOscillator();
        const mod = ctx.createOscillator();
        const modGain = ctx.createGain();
        const env = ctx.createGain();
        const fmFilter = ctx.createBiquadFilter();
        carrier.type = profile.wave;
        mod.type = 'sine';
        carrier.frequency.value = carrierFreq;
        mod.frequency.value = carrierFreq * fmRatio;
        modGain.gain.value = modIndex;

        fmFilter.type = 'lowpass';
        fmFilter.frequency.value = clamp((planet?.ac?.filterBase || 1200) * 2.4, 220, 9000);
        fmFilter.Q.value = 0.62;

        const peak = clamp(profile.level + (modulation.complexity || 0.5) * 0.05, 0.07, 0.2);
        env.gain.setValueAtTime(0.0001, scheduleTime);
        env.gain.linearRampToValueAtTime(peak, scheduleTime + Math.min(0.22, dur * 0.35));
        env.gain.setValueAtTime(peak * 0.75, scheduleTime + dur * 0.6);
        env.gain.exponentialRampToValueAtTime(0.0001, scheduleTime + dur);

        mod.connect(modGain);
        modGain.connect(carrier.frequency);
        carrier.connect(fmFilter);
        fmFilter.connect(env);
        env.connect(this.buses.layerGains[profile.layer] || this.buses.layerGains.pads);

        mod.start(scheduleTime);
        carrier.start(scheduleTime);
        mod.stop(scheduleTime + dur + 0.04);
        carrier.stop(scheduleTime + dur + 0.04);

        host.nodes.pushTransient(ttlSec, carrier, mod, modGain, env, fmFilter);
        scheduleRelease(this.voicePool, booking.id, ttlSec);
        return true;
    }

    playAmbience(scheduleTime, modulation = {}) {
        const host = this.host;
        const planet = host.planet;
        const ctx = host.ctx;
        if (!planet || !ctx) return false;
        if ((scheduleTime - this.lastAmbienceAt) < 1.1) return false;

        const biomeId = planet?.biome?.id || 'default';
        const richnessTier = modulation?.richnessTier || planet?.v2?.richnessProfile?.tier || 'balanced';
        const fxProfile = modulation?.fxProfile || planet?.v2?.fxProfile || { organic: 0.4, harmonic: 0.4, synthetic: 0.4, contrast: 0.4 };
        const seed = this.seedBase + host.stepGrain * 307;
        const rng = new RNG(seed);
        const textureBehavior = AMBIENCE_TEXTURE_BEHAVIOR[biomeId] || AMBIENCE_TEXTURE_BEHAVIOR.default;
        const dur = clamp(
            3.2
            + (modulation.space || 0.5) * 3.5
            + (biomeId === 'ethereal' ? 0.8 : 0)
            + (richnessTier === 'lush' ? 1.1 : richnessTier === 'sparse' ? -0.6 : 0),
            2.6,
            12.6,
        );
        const ttlSec = dur + 1.1;
        const booking = this.voicePool.requestVoice({
            nowSec: ctx.currentTime,
            ttlSec,
            kind: 'ambience',
            weight: 1.35,
        });
        if (!booking.granted) return false;

        const ambienceBus = ctx.createGain();
        const ambienceFilter = ctx.createBiquadFilter();
        const ambienceOut = ctx.createGain();
        const ambiencePan = ctx.createStereoPanner();
        const panLfo = ctx.createOscillator();
        const panDepth = ctx.createGain();
        const filterLfo = ctx.createOscillator();
        const filterDepth = ctx.createGain();

        const ambienceLevel = clamp(
            0.05
            + (modulation.ambienceGainMul || 1) * 0.06
            + (textureBehavior.noiseMul || 0) * 0.03
            + (fxProfile.organic ?? 0.4) * 0.04
            + (richnessTier === 'lush' ? 0.02 : 0),
            0.035,
            0.25,
        );
        const ambienceAttack = clamp(dur * 0.26, 0.8, 2.7);
        const filterBase = clamp((planet?.ac?.filterBase || 1200) * (SOFT_BIOMES.has(biomeId) ? 2.2 : 1.8), 500, 9800);

        ambienceFilter.type = SOFT_BIOMES.has(biomeId) ? 'lowpass' : 'bandpass';
        ambienceFilter.frequency.value = clamp(filterBase * (0.74 + (modulation.texture || 0.5) * 0.54), 380, 9800);
        ambienceFilter.Q.value = clamp(0.5 + (modulation.complexity || 0.5) * 0.76, 0.4, 2.8);
        ambiencePan.pan.value = rng.range(-0.3, 0.3);

        ambienceOut.gain.setValueAtTime(0.0001, scheduleTime);
        ambienceOut.gain.linearRampToValueAtTime(ambienceLevel, scheduleTime + ambienceAttack);
        ambienceOut.gain.setValueAtTime(ambienceLevel * 0.86, scheduleTime + dur * 0.72);
        ambienceOut.gain.exponentialRampToValueAtTime(0.0001, scheduleTime + dur);

        ambienceBus.connect(ambienceFilter);
        ambienceFilter.connect(ambienceOut);
        ambienceOut.connect(ambiencePan);
        ambiencePan.connect(this.buses.layerGains.ambience);

        panLfo.type = 'sine';
        panLfo.frequency.value = clamp(0.014 + (modulation.motion || 0.5) * 0.05, 0.01, 0.12);
        panDepth.gain.value = clamp(0.12 + (modulation.space || 0.5) * 0.26, 0.08, 0.48);
        panLfo.connect(panDepth);
        panDepth.connect(ambiencePan.pan);

        filterLfo.type = 'sine';
        filterLfo.frequency.value = clamp(0.01 + (modulation.texture || 0.5) * 0.06, 0.008, 0.2);
        filterDepth.gain.value = clamp(filterBase * (0.04 + (modulation.motion || 0.5) * 0.08), 40, 920);
        filterLfo.connect(filterDepth);
        filterDepth.connect(ambienceFilter.frequency);

        const pool = AMBIENCE_VOICE_POOLS[biomeId] || ['granular_cloud', 'drone_morph', 'vowel_morph', 'wavetable_morph'];
        let primary = rng.pick(pool);
        if (primary === 'granular_cloud' && SOFT_BIOMES.has(biomeId) && rng.bool(0.68)) {
            primary = rng.pick(['drone_morph', 'vowel_morph', 'wavetable_morph']);
        }
        const secondaryPool = pool.filter((voice) => voice !== primary);
        let secondary = secondaryPool.length ? rng.pick(secondaryPool) : primary;
        if (secondary === primary) secondary = rng.pick(['drone_morph', 'vowel_morph', 'wavetable_morph']);

        const chord = Array.isArray(host._currentChordIntervals) && host._currentChordIntervals.length
            ? host._currentChordIntervals
            : (Array.isArray(planet.scale) && planet.scale.length ? planet.scale.slice(0, 3) : [0, 4, 7]);
        const primaryStep = rng.pick(chord);
        const secondaryStep = rng.pick(chord);
        const primaryOctave = SOFT_BIOMES.has(biomeId) ? rng.pick([1, 2]) : rng.pick([1, 2, 3]);
        const secondaryOctave = SOFT_BIOMES.has(biomeId) ? rng.pick([2, 3]) : rng.pick([1, 2, 3]);
        const primaryFreq = host._getStepFrequency(planet, primaryStep || 0, primaryOctave);
        const secondaryFreq = host._getStepFrequency(planet, secondaryStep || 0, secondaryOctave);

        const primaryGain = ctx.createGain();
        primaryGain.gain.value = clamp(0.62 + (modulation.texture || 0.5) * 0.24, 0.4, 1);
        primaryGain.connect(ambienceBus);
        const primaryAtk = primary === 'granular_cloud' ? Math.max(1.0, ambienceAttack * 0.92) : ambienceAttack;
        const primaryDur = primary === 'granular_cloud' ? Math.max(3.4, dur * 0.84) : dur;
        buildVoice(primary, ctx, primaryFreq, primaryGain, rng, primaryAtk, primaryDur, host.nodes);

        const secondaryGain = ctx.createGain();
        secondaryGain.gain.value = clamp(0.34 + (modulation.space || 0.5) * 0.24, 0.22, 0.78);
        secondaryGain.connect(ambienceBus);
        buildVoice(secondary, ctx, secondaryFreq * rng.range(0.5, 1.22), secondaryGain, rng, Math.max(0.4, ambienceAttack * 0.6), Math.max(2.2, dur * 0.74), host.nodes);

        if (NOISE_AMBIENCE_BIOMES.has(biomeId) && rng.bool(0.14 + (modulation.dissonance || 0.2) * 0.24 + (textureBehavior.noiseMul || 0) * 0.24 + (fxProfile.synthetic ?? 0.4) * 0.14)) {
            const noiseGain = clamp(0.016 + (modulation.dissonance || 0.2) * 0.04 + (textureBehavior.noiseMul || 0) * 0.05, 0.012, 0.12);
            triggerNoiseWash(host, this.buses.layerGains.ambience, scheduleTime + rng.range(0.05, 0.22), dur * rng.range(0.46, 0.82), noiseGain, seed + 701);
        }

        const queueCount = (count) => Math.max(0, Math.round(count * (0.72 + (modulation.texture || 0.5) * 0.52 + (richnessTier === 'lush' ? 0.24 : richnessTier === 'sparse' ? -0.2 : 0))));
        const rainBursts = queueCount(textureBehavior.rain || 0);
        const crystalBursts = queueCount(textureBehavior.crystals || 0);
        const birdBursts = queueCount(textureBehavior.birds || 0);
        const thunderBursts = queueCount(textureBehavior.thunder || 0);
        for (let i = 0; i < rainBursts; i++) {
            const when = scheduleTime + rng.range(0.08, dur * 0.82);
            triggerRainDrop(host, this.buses.layerGains.ambience, when, clamp(0.04 + (modulation.texture || 0.5) * 0.08, 0.03, 0.16), seed + 809 + i * 5);
        }
        for (let i = 0; i < crystalBursts; i++) {
            const when = scheduleTime + rng.range(0.14, dur * 0.66);
            triggerCrystalShard(host, this.buses.layerGains.fx, when, clamp(0.05 + (modulation.texture || 0.5) * 0.08, 0.04, 0.16), seed + 907 + i * 7);
        }
        for (let i = 0; i < birdBursts; i++) {
            const when = scheduleTime + rng.range(0.12, dur * 0.74);
            triggerBirdCall(host, this.buses.layerGains.ambience, when, clamp(0.05 + (modulation.motion || 0.5) * 0.09, 0.04, 0.18), seed + 977 + i * 11);
        }
        for (let i = 0; i < thunderBursts; i++) {
            const when = scheduleTime + rng.range(dur * 0.18, dur * 0.76);
            triggerThunderRumble(host, this.buses.layerGains.fx, when, clamp(0.06 + (modulation.dissonance || 0.2) * 0.09, 0.05, 0.18), seed + 1049 + i * 13);
        }

        panLfo.start(scheduleTime);
        filterLfo.start(scheduleTime);
        panLfo.stop(scheduleTime + dur + 0.2);
        filterLfo.stop(scheduleTime + dur + 0.2);

        host.nodes.pushTransient(
            ttlSec,
            ambienceBus,
            ambienceFilter,
            ambienceOut,
            ambiencePan,
            panLfo,
            panDepth,
            filterLfo,
            filterDepth,
            primaryGain,
            secondaryGain,
        );
        this.lastAmbienceAt = scheduleTime;
        scheduleRelease(this.voicePool, booking.id, ttlSec);
        return true;
    }

    playBiomeTextureStep({
        stepIndex = 0,
        barIndex = 0,
        cycleStep = 0,
        cycleSteps = 16,
        scheduleTime = 0,
        section = 'INTRO',
        modulation = {},
        quality = {},
    } = {}) {
        const host = this.host;
        const planet = host.planet;
        const ctx = host.ctx;
        if (!planet || !ctx) return 0;

        const biomeId = planet?.biome?.id || 'default';
        const profiles = BIOME_TEXTURE_PROFILES[biomeId] || BIOME_TEXTURE_PROFILES.default;
        const laneWeights = resolveFxLaneWeights({
            planet,
            modulation,
            section,
            quality,
        });
        const qualityScalar = clamp(quality?.qualityScalar ?? 1, 0.2, 1.2);

        let fired = 0;
        profiles.forEach((profile, idx) => {
            const lane = Array.isArray(profile.lane) && profile.lane.length ? profile.lane : [];
            if (!lane.length) return;
            const laneIndex = Math.floor(((cycleStep % Math.max(1, cycleSteps)) / Math.max(1, cycleSteps)) * lane.length) % lane.length;
            const laneCell = lane[laneIndex] || 0;
            if (laneCell <= 0) return;

            const rng = new RNG(this.seedBase + 700003 + stepIndex * 37 + idx * 131);
            const sectionMul = section === 'SURGE'
                ? (profile.type === 'thunder' ? 1.44 : 1.16)
                : section === 'AFTERGLOW'
                    ? 0.8
                    : 1;
            const qualityMul = clamp(0.66 + (quality?.qualityScalar ?? 1) * 0.46, 0.4, 1.2);
            const laneMul = laneCell >= 2 ? 1.24 : 1;
            const chance = clamp((profile.chance || 0.4) * sectionMul * qualityMul * laneMul, 0.03, 0.95);
            if (!rng.bool(chance)) return;

            const dur = profile.type === 'thunder' ? 2.9 : profile.type === 'crystal' ? 1 : 0.9;
            const booking = this.voicePool.requestVoice({
                nowSec: ctx.currentTime,
                ttlSec: dur,
                kind: `texture-${profile.type}`,
                weight: 0.64,
            });
            if (!booking.granted) return;

            const velocity = clamp(
                (profile.level || 0.08)
                * (0.76 + (modulation.texture || 0.5) * 0.58)
                * (laneCell >= 2 ? 1.22 : 1),
                0.01,
                0.26,
            );
            const when = Math.max(ctx.currentTime, scheduleTime + rng.range(0.01, (host.transport?.stepSeconds || 0.125) * 0.32));
            const layer = profile.layer || 'ambience';
            const dest = this.buses.layerGains[layer] || this.buses.layerGains.ambience;
            const seed = this.seedBase + 771001 + stepIndex * 53 + idx * 19;
            const firedDur = this._triggerTextureType(profile.type, dest, when, velocity, seed, dur);
            if (firedDur > 0) {
                fired++;
                scheduleRelease(this.voicePool, booking.id, firedDur);
            } else {
                this.voicePool.releaseVoice(booking.id);
            }
        });

        const lanes = ['organic', 'harmonic', 'synthetic'];
        lanes.forEach((lane, laneIndex) => {
            const lanePattern = FX_LANE_PATTERNS[lane] || FX_LANE_PATTERNS.organic;
            const lanePos = (stepIndex + barIndex * 3 + laneIndex * 5 + cycleStep) % lanePattern.length;
            const laneCell = lanePattern[lanePos] || 0;
            if (laneCell <= 0) return;

            const laneWeight = clamp(laneWeights?.[lane] ?? 0, 0, 1.5);
            if (laneWeight < 0.05) return;

            const laneRng = new RNG(this.seedBase + 990001 + stepIndex * 61 + barIndex * 37 + laneIndex * 211);
            const laneChance = clamp(
                laneWeights.baseDensity
                * laneWeight
                * (laneCell >= 2 ? 1.24 : 1)
                * qualityScalar
                * (section === 'SURGE' ? (lane === 'synthetic' ? 1.22 : 1.06) : section === 'AFTERGLOW' ? (lane === 'harmonic' ? 1.24 : 0.86) : 1),
                0.02,
                0.94,
            );
            if (!laneRng.bool(laneChance)) return;

            const type = pickFxLaneEventType(lane, biomeId, laneRng);
            const layer = lane === 'organic'
                ? 'ambience'
                : lane === 'harmonic' && laneRng.bool(0.32)
                    ? 'pads'
                    : 'fx';
            const dest = this.buses.layerGains[layer] || this.buses.layerGains.fx || this.buses.layerGains.ambience;
            const when = Math.max(ctx.currentTime, scheduleTime + laneRng.range(0.008, (host.transport?.stepSeconds || 0.125) * 0.42));
            const velocity = clamp(
                (0.05 + laneWeight * 0.14) * (laneCell >= 2 ? 1.18 : 1),
                0.015,
                lane === 'synthetic' ? 0.24 : 0.2,
            );
            const durationHint = lane === 'organic' ? 1.3 : lane === 'harmonic' ? 1.05 : 0.72;
            const booking = this.voicePool.requestVoice({
                nowSec: ctx.currentTime,
                ttlSec: durationHint + 1,
                kind: `lane-${lane}-${type}`,
                weight: lane === 'synthetic' ? 0.7 : 0.62,
            });
            if (!booking.granted) return;

            const seed = this.seedBase + 994003 + stepIndex * 73 + barIndex * 47 + laneIndex * 19;
            const firedDur = this._triggerTextureType(type, dest, when, velocity, seed, durationHint);
            if (firedDur > 0) {
                fired++;
                scheduleRelease(this.voicePool, booking.id, firedDur);
            } else {
                this.voicePool.releaseVoice(booking.id);
            }
        });
        return fired;
    }

    playFxPulse(scheduleTime, modulation = {}) {
        const host = this.host;
        const ctx = host.ctx;
        const osc = ctx.createOscillator();
        const tone = ctx.createBiquadFilter();
        const env = ctx.createGain();
        const dissonance = clamp(modulation.dissonance || 0.2, 0, 1);
        const section = modulation.section || 'INTRO';
        const sectionProgress = clamp(modulation.sectionProgress ?? 0.5, 0, 1);
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(185 + dissonance * 135 + sectionProgress * 28, scheduleTime);
        osc.frequency.exponentialRampToValueAtTime(112, scheduleTime + 0.48);
        tone.type = 'lowpass';
        tone.frequency.setValueAtTime(section === 'SURGE' ? 1800 : 1450, scheduleTime);
        tone.Q.value = 0.55;
        const peak = section === 'SURGE' ? 0.024 : 0.017;
        env.gain.setValueAtTime(0.0001, scheduleTime);
        env.gain.linearRampToValueAtTime(peak, scheduleTime + 0.055);
        env.gain.exponentialRampToValueAtTime(0.0001, scheduleTime + 0.55);
        osc.connect(tone);
        tone.connect(env);
        env.connect(this.buses.layerGains.fx);
        osc.start(scheduleTime);
        osc.stop(scheduleTime + 0.6);
        host.nodes.pushTransient(0.82, osc, tone, env);
    }
}
