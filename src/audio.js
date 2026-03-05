import { RNG } from './rng.js';
import { buildVoice, ADDITIVE_VOICE_NAMES } from './voices.js';
import { CHORD_TEMPLATES } from './data.js';
import { NodeRegistry as CoreNodeRegistry } from './audio/core/node-registry.js';
import { buildTransport } from './audio/core/transport.js';
import { LookaheadScheduler } from './audio/core/scheduler.js';

const STATE_UPDATE_INTERVAL_MS = 100;
const SCHEDULER_TICK_MS = 25;
const SCHEDULER_HORIZON_SEC = 0.12;

const NATIVE_OSC_TYPES = new Set(['sine', 'square', 'sawtooth', 'triangle']);
const OSC_TYPE_FALLBACKS = {
    bell: 'sine',
    brass: 'sawtooth',
    choir: 'triangle',
    electric_piano: 'triangle',
    glass: 'sine',
    organ: 'triangle',
    pluck: 'triangle',
    pulse: 'square',
    reed: 'triangle',
    saw_sync: 'sawtooth',
    wood: 'triangle',
};

const MELODY_VOICE_COSTS = {
    choir: 0.55,
    crystal_chimes: 0.45,
    drone_morph: 0.7,
    gong: 0.95,
    granular_cloud: 1.0,
    metallic: 0.4,
    strings: 0.5,
    subpad: 0.6,
    vowel_morph: 0.65,
};

const MELODY_VOICE_COOLDOWNS = {
    choir: 0.8,
    crystal_chimes: 0.65,
    drone_morph: 1.1,
    gong: 1.8,
    granular_cloud: 1.25,
    metallic: 0.45,
    strings: 0.7,
    subpad: 1.0,
    vowel_morph: 0.9,
};

const DEFAULT_TENSION_PROFILE = {
    riseRate: 0.028,
    riseVariance: 0.008,
    drainRate: 0.055,
    floor: 0.08,
    reset: 0.42,
    climaxThreshold: 0.87,
    pulseDepth: 0.05,
    pulseRate: 0.85,
    pulseLift: 0.012,
    surgeChance: 0.08,
    surgeAmount: 0.04,
    surgeDecay: 0.58,
    filterMul: 2.5,
    fmMul: 5.0,
    ghostBias: 1.0,
    fillBias: 1.0,
    chaosBias: 1.0,
    accentBias: 1.0,
    kickBias: 1.0,
    snareBias: 1.0,
    hatBias: 1.0,
    openHatBias: 1.0,
    extraBias: 1.0,
    fillEvery: 4,
    fillStart: 0.72,
    fillVoices: ['tom', 'shaker'],
    polyVoices: ['clave', 'cowbell', 'conga'],
    phaseOffset: 0,
    lowPoint: 0.22,
    buildPoint: 0.48,
    surgePoint: 0.74,
    climaxRatios: [1, 5 / 4, 3 / 2, 2, 5 / 2],
    climaxSpacing: 0.08,
    climaxGain: 0.085,
    climaxHold: 10,
    climaxRelease: 16,
    climaxMasterBoost: 1.35,
};

const BIOME_TENSION_PROFILES = {
    abyssal: {
        riseRate: 0.02,
        riseVariance: 0.004,
        drainRate: 0.035,
        pulseDepth: 0.035,
        pulseRate: 0.45,
        pulseLift: 0.006,
        surgeChance: 0.03,
        surgeAmount: 0.025,
        filterMul: 1.4,
        fmMul: 2.4,
        fillBias: 0.35,
        accentBias: 0.55,
        kickBias: 0.65,
        snareBias: 0.55,
        hatBias: 0.18,
        openHatBias: 0.35,
        extraBias: 0.4,
        fillEvery: 6,
        fillStart: 0.84,
        fillVoices: ['tom', 'taiko'],
        polyVoices: ['taiko', 'tom'],
        surgePoint: 0.8,
        climaxRatios: [1, 4 / 3, 3 / 2, 2, 8 / 3],
        climaxSpacing: 0.14,
        climaxGain: 0.07,
        climaxHold: 12,
        climaxRelease: 18,
        climaxMasterBoost: 1.22,
    },
    arctic: {
        riseRate: 0.017,
        riseVariance: 0.003,
        drainRate: 0.03,
        pulseDepth: 0.06,
        pulseRate: 0.5,
        pulseLift: 0.01,
        surgeChance: 0.02,
        surgeAmount: 0.018,
        filterMul: 1.2,
        fmMul: 2.1,
        ghostBias: 0.45,
        fillBias: 0.08,
        chaosBias: 0.05,
        accentBias: 0.35,
        kickBias: 0.25,
        snareBias: 0.2,
        hatBias: 0.15,
        openHatBias: 0.2,
        extraBias: 0.15,
        fillEvery: 8,
        fillStart: 0.88,
        fillVoices: ['woodblock'],
        polyVoices: ['woodblock'],
        surgePoint: 0.82,
        climaxRatios: [1, 9 / 8, 3 / 2, 2, 9 / 4],
        climaxSpacing: 0.16,
        climaxGain: 0.06,
        climaxHold: 13,
        climaxRelease: 19,
        climaxMasterBoost: 1.16,
    },
    barren: {
        riseRate: 0.016,
        riseVariance: 0.002,
        drainRate: 0.028,
        pulseDepth: 0.04,
        pulseRate: 0.42,
        pulseLift: 0.007,
        surgeChance: 0.015,
        surgeAmount: 0.012,
        filterMul: 1.1,
        fmMul: 1.8,
        ghostBias: 0.4,
        fillBias: 0.05,
        chaosBias: 0.04,
        accentBias: 0.28,
        kickBias: 0.22,
        snareBias: 0.18,
        hatBias: 0.12,
        openHatBias: 0.16,
        extraBias: 0.12,
        fillEvery: 8,
        fillStart: 0.9,
        fillVoices: [],
        polyVoices: [],
        surgePoint: 0.82,
        climaxRatios: [1, 6 / 5, 3 / 2, 2, 12 / 5],
        climaxSpacing: 0.18,
        climaxGain: 0.055,
        climaxHold: 12,
        climaxRelease: 19,
        climaxMasterBoost: 1.14,
    },
    corrupted: {
        riseRate: 0.038,
        riseVariance: 0.018,
        drainRate: 0.07,
        pulseDepth: 0.03,
        pulseRate: 1.45,
        pulseLift: 0.02,
        surgeChance: 0.24,
        surgeAmount: 0.085,
        surgeDecay: 0.72,
        filterMul: 4.8,
        fmMul: 8.5,
        ghostBias: 0.65,
        fillBias: 1.45,
        chaosBias: 1.55,
        accentBias: 1.35,
        kickBias: 1.45,
        snareBias: 1.25,
        hatBias: 1.55,
        openHatBias: 1.35,
        extraBias: 1.35,
        fillEvery: 2,
        fillStart: 0.58,
        fillVoices: ['tom', 'shaker', 'cowbell'],
        polyVoices: ['cowbell', 'clave', 'shaker'],
        lowPoint: 0.18,
        buildPoint: 0.38,
        surgePoint: 0.62,
        climaxThreshold: 0.82,
        climaxRatios: [1, 16 / 15, 45 / 32, 2, 64 / 45],
        climaxSpacing: 0.05,
        climaxGain: 0.09,
        climaxHold: 8,
        climaxRelease: 13,
        climaxMasterBoost: 1.38,
    },
    crystalline: {
        riseRate: 0.022,
        riseVariance: 0.004,
        drainRate: 0.04,
        pulseDepth: 0.02,
        pulseRate: 0.62,
        pulseLift: 0.008,
        surgeChance: 0.03,
        surgeAmount: 0.02,
        filterMul: 1.8,
        fmMul: 3.1,
        ghostBias: 0.55,
        fillBias: 0.5,
        chaosBias: 0.18,
        accentBias: 0.95,
        kickBias: 0.5,
        snareBias: 0.65,
        hatBias: 0.6,
        openHatBias: 0.75,
        extraBias: 0.75,
        fillEvery: 5,
        fillStart: 0.78,
        fillVoices: ['cowbell', 'shaker'],
        polyVoices: ['cowbell', 'clave'],
        climaxRatios: [1, 9 / 8, 3 / 2, 2, 9 / 4],
        climaxSpacing: 0.1,
        climaxGain: 0.075,
        climaxHold: 10,
        climaxRelease: 15,
    },
    crystalloid: {
        riseRate: 0.024,
        riseVariance: 0.005,
        drainRate: 0.042,
        pulseDepth: 0.024,
        pulseRate: 0.78,
        pulseLift: 0.01,
        surgeChance: 0.05,
        surgeAmount: 0.028,
        filterMul: 2.0,
        fmMul: 3.6,
        ghostBias: 0.65,
        fillBias: 0.62,
        chaosBias: 0.25,
        accentBias: 1.05,
        kickBias: 0.72,
        snareBias: 0.82,
        hatBias: 0.72,
        openHatBias: 0.82,
        extraBias: 0.88,
        fillEvery: 4,
        fillStart: 0.76,
        fillVoices: ['cowbell', 'clave'],
        polyVoices: ['cowbell', 'clave'],
        climaxRatios: [1, 10 / 9, 3 / 2, 2, 5 / 2],
        climaxSpacing: 0.09,
        climaxGain: 0.078,
        climaxHold: 9,
        climaxRelease: 14,
    },
    desert: {
        riseRate: 0.021,
        riseVariance: 0.006,
        drainRate: 0.04,
        pulseDepth: 0.07,
        pulseRate: 0.78,
        pulseLift: 0.012,
        surgeChance: 0.05,
        surgeAmount: 0.03,
        filterMul: 1.8,
        fmMul: 3.2,
        ghostBias: 1.1,
        fillBias: 0.72,
        chaosBias: 0.22,
        accentBias: 0.9,
        kickBias: 0.8,
        snareBias: 0.72,
        hatBias: 0.55,
        openHatBias: 0.55,
        extraBias: 0.85,
        fillEvery: 5,
        fillStart: 0.8,
        fillVoices: ['shaker', 'clave'],
        polyVoices: ['clave', 'shaker'],
        climaxRatios: [1, 6 / 5, 3 / 2, 2, 12 / 5],
        climaxSpacing: 0.12,
        climaxGain: 0.072,
        climaxHold: 10,
        climaxRelease: 15,
    },
    ethereal: {
        riseRate: 0.019,
        riseVariance: 0.004,
        drainRate: 0.032,
        pulseDepth: 0.09,
        pulseRate: 0.52,
        pulseLift: 0.014,
        surgeChance: 0.02,
        surgeAmount: 0.016,
        filterMul: 1.55,
        fmMul: 2.2,
        ghostBias: 0.6,
        fillBias: 0.12,
        chaosBias: 0.05,
        accentBias: 0.42,
        kickBias: 0.25,
        snareBias: 0.22,
        hatBias: 0.18,
        openHatBias: 0.25,
        extraBias: 0.18,
        fillEvery: 8,
        fillStart: 0.88,
        fillVoices: ['shaker'],
        polyVoices: ['shaker'],
        surgePoint: 0.8,
        climaxRatios: [1, 5 / 4, 3 / 2, 2, 3],
        climaxSpacing: 0.14,
        climaxGain: 0.068,
        climaxHold: 12,
        climaxRelease: 18,
        climaxMasterBoost: 1.18,
    },
    fungal: {
        riseRate: 0.027,
        riseVariance: 0.01,
        drainRate: 0.05,
        pulseDepth: 0.08,
        pulseRate: 1.18,
        pulseLift: 0.014,
        surgeChance: 0.08,
        surgeAmount: 0.045,
        filterMul: 2.4,
        fmMul: 4.2,
        ghostBias: 1.55,
        fillBias: 0.74,
        chaosBias: 0.28,
        accentBias: 1.05,
        kickBias: 0.88,
        snareBias: 0.92,
        hatBias: 1.15,
        openHatBias: 0.72,
        extraBias: 1.08,
        fillEvery: 3,
        fillStart: 0.68,
        fillVoices: ['woodblock', 'clave', 'bongo', 'rimshot', 'shaker'],
        polyVoices: ['clave', 'bongo', 'woodblock'],
        lowPoint: 0.2,
        buildPoint: 0.42,
        surgePoint: 0.68,
        climaxRatios: [1, 7 / 6, 3 / 2, 2, 7 / 3],
        climaxSpacing: 0.09,
        climaxGain: 0.08,
        climaxHold: 9,
        climaxRelease: 15,
    },
    glacial: {
        riseRate: 0.016,
        riseVariance: 0.003,
        drainRate: 0.03,
        pulseDepth: 0.085,
        pulseRate: 0.38,
        pulseLift: 0.012,
        surgeChance: 0.015,
        surgeAmount: 0.014,
        filterMul: 1.05,
        fmMul: 1.8,
        ghostBias: 0.25,
        fillBias: 0.04,
        chaosBias: 0.03,
        accentBias: 0.25,
        kickBias: 0.18,
        snareBias: 0.15,
        hatBias: 0.08,
        openHatBias: 0.12,
        extraBias: 0.08,
        fillEvery: 8,
        fillStart: 0.92,
        fillVoices: [],
        polyVoices: [],
        surgePoint: 0.84,
        climaxRatios: [1, 9 / 8, 3 / 2, 2, 27 / 16],
        climaxSpacing: 0.18,
        climaxGain: 0.052,
        climaxHold: 14,
        climaxRelease: 22,
        climaxMasterBoost: 1.12,
    },
    nebula: {
        riseRate: 0.018,
        riseVariance: 0.004,
        drainRate: 0.032,
        pulseDepth: 0.1,
        pulseRate: 0.48,
        pulseLift: 0.014,
        surgeChance: 0.03,
        surgeAmount: 0.02,
        filterMul: 1.45,
        fmMul: 2.0,
        ghostBias: 0.55,
        fillBias: 0.1,
        chaosBias: 0.07,
        accentBias: 0.36,
        kickBias: 0.2,
        snareBias: 0.18,
        hatBias: 0.12,
        openHatBias: 0.18,
        extraBias: 0.14,
        fillEvery: 8,
        fillStart: 0.88,
        fillVoices: [],
        polyVoices: [],
        surgePoint: 0.8,
        climaxRatios: [1, 5 / 4, 3 / 2, 2, 15 / 4],
        climaxSpacing: 0.15,
        climaxGain: 0.064,
        climaxHold: 12,
        climaxRelease: 19,
        climaxMasterBoost: 1.17,
    },
    oceanic: {
        riseRate: 0.022,
        riseVariance: 0.005,
        drainRate: 0.038,
        pulseDepth: 0.1,
        pulseRate: 0.6,
        pulseLift: 0.016,
        surgeChance: 0.04,
        surgeAmount: 0.022,
        filterMul: 1.7,
        fmMul: 2.6,
        ghostBias: 1.15,
        fillBias: 0.42,
        chaosBias: 0.12,
        accentBias: 0.62,
        kickBias: 0.5,
        snareBias: 0.4,
        hatBias: 0.35,
        openHatBias: 0.5,
        extraBias: 0.55,
        fillEvery: 6,
        fillStart: 0.82,
        fillVoices: ['conga', 'tom'],
        polyVoices: ['conga', 'shaker'],
        climaxRatios: [1, 4 / 3, 3 / 2, 2, 3],
        climaxSpacing: 0.13,
        climaxGain: 0.072,
        climaxHold: 11,
        climaxRelease: 17,
        climaxMasterBoost: 1.2,
    },
    organic: {
        riseRate: 0.026,
        riseVariance: 0.009,
        drainRate: 0.048,
        pulseDepth: 0.075,
        pulseRate: 1.05,
        pulseLift: 0.014,
        surgeChance: 0.07,
        surgeAmount: 0.038,
        filterMul: 2.1,
        fmMul: 3.8,
        ghostBias: 1.25,
        fillBias: 0.92,
        chaosBias: 0.35,
        accentBias: 1.05,
        kickBias: 0.95,
        snareBias: 0.9,
        hatBias: 0.78,
        openHatBias: 0.72,
        extraBias: 1.15,
        fillEvery: 3,
        fillStart: 0.7,
        fillVoices: ['conga', 'clave', 'woodblock'],
        polyVoices: ['conga', 'clave', 'bongo'],
        lowPoint: 0.2,
        buildPoint: 0.43,
        surgePoint: 0.7,
        climaxRatios: [1, 6 / 5, 3 / 2, 2, 12 / 5],
        climaxSpacing: 0.1,
        climaxGain: 0.078,
        climaxHold: 9,
        climaxRelease: 15,
    },
    psychedelic: {
        riseRate: 0.03,
        riseVariance: 0.012,
        drainRate: 0.055,
        pulseDepth: 0.075,
        pulseRate: 1.38,
        pulseLift: 0.018,
        surgeChance: 0.12,
        surgeAmount: 0.05,
        surgeDecay: 0.65,
        filterMul: 3.2,
        fmMul: 6.0,
        ghostBias: 0.9,
        fillBias: 1.1,
        chaosBias: 0.7,
        accentBias: 1.2,
        kickBias: 1.0,
        snareBias: 0.95,
        hatBias: 1.1,
        openHatBias: 1.25,
        extraBias: 1.05,
        fillEvery: 3,
        fillStart: 0.66,
        fillVoices: ['cowbell', 'shaker', 'conga'],
        polyVoices: ['cowbell', 'conga', 'clave'],
        lowPoint: 0.18,
        buildPoint: 0.4,
        surgePoint: 0.66,
        climaxRatios: [1, 7 / 6, 3 / 2, 2, 21 / 8],
        climaxSpacing: 0.07,
        climaxGain: 0.086,
        climaxHold: 8,
        climaxRelease: 14,
        climaxMasterBoost: 1.32,
    },
    quantum: {
        riseRate: 0.04,
        riseVariance: 0.02,
        drainRate: 0.075,
        pulseDepth: 0.035,
        pulseRate: 1.7,
        pulseLift: 0.022,
        surgeChance: 0.26,
        surgeAmount: 0.095,
        surgeDecay: 0.74,
        filterMul: 5.2,
        fmMul: 9.5,
        ghostBias: 0.75,
        fillBias: 1.5,
        chaosBias: 1.65,
        accentBias: 1.45,
        kickBias: 1.5,
        snareBias: 1.35,
        hatBias: 1.65,
        openHatBias: 1.5,
        extraBias: 1.45,
        fillEvery: 2,
        fillStart: 0.55,
        fillVoices: ['cowbell', 'clave', 'shaker'],
        polyVoices: ['cowbell', 'clave', 'conga'],
        lowPoint: 0.16,
        buildPoint: 0.34,
        surgePoint: 0.58,
        climaxThreshold: 0.8,
        climaxRatios: [1, 17 / 16, 45 / 32, 2, 51 / 32],
        climaxSpacing: 0.045,
        climaxGain: 0.094,
        climaxHold: 7,
        climaxRelease: 12,
        climaxMasterBoost: 1.4,
    },
    storm: {
        riseRate: 0.036,
        riseVariance: 0.016,
        drainRate: 0.068,
        pulseDepth: 0.028,
        pulseRate: 1.25,
        pulseLift: 0.018,
        surgeChance: 0.21,
        surgeAmount: 0.08,
        surgeDecay: 0.7,
        filterMul: 4.5,
        fmMul: 7.8,
        ghostBias: 0.7,
        fillBias: 1.38,
        chaosBias: 1.35,
        accentBias: 1.3,
        kickBias: 1.35,
        snareBias: 1.2,
        hatBias: 1.55,
        openHatBias: 1.28,
        extraBias: 1.3,
        fillEvery: 2,
        fillStart: 0.6,
        fillVoices: ['tom', 'conga', 'shaker'],
        polyVoices: ['cowbell', 'conga', 'clave'],
        lowPoint: 0.18,
        buildPoint: 0.38,
        surgePoint: 0.62,
        climaxThreshold: 0.82,
        climaxRatios: [1, 6 / 5, 3 / 2, 2, 12 / 5],
        climaxSpacing: 0.055,
        climaxGain: 0.09,
        climaxHold: 8,
        climaxRelease: 13,
        climaxMasterBoost: 1.36,
    },
    volcanic: {
        riseRate: 0.034,
        riseVariance: 0.012,
        drainRate: 0.058,
        pulseDepth: 0.045,
        pulseRate: 0.95,
        pulseLift: 0.016,
        surgeChance: 0.14,
        surgeAmount: 0.06,
        surgeDecay: 0.66,
        filterMul: 3.6,
        fmMul: 6.5,
        ghostBias: 0.6,
        fillBias: 1.05,
        chaosBias: 0.9,
        accentBias: 1.2,
        kickBias: 1.3,
        snareBias: 0.92,
        hatBias: 0.9,
        openHatBias: 0.72,
        extraBias: 1.0,
        fillEvery: 3,
        fillStart: 0.66,
        fillVoices: ['tom', 'taiko', 'shaker'],
        polyVoices: ['taiko', 'tom', 'cowbell'],
        lowPoint: 0.2,
        buildPoint: 0.4,
        surgePoint: 0.68,
        climaxRatios: [1, 6 / 5, 3 / 2, 2, 9 / 4],
        climaxSpacing: 0.075,
        climaxGain: 0.088,
        climaxHold: 9,
        climaxRelease: 14,
        climaxMasterBoost: 1.34,
    },
};

const DEFAULT_DRUM_TONE = {
    kickPitch: 1.0,
    kickDecay: 1.0,
    kickPunch: 1.0,
    kickClick: 1.0,
    snarePitch: 1.0,
    snareDecay: 1.0,
    snareNoise: 1.0,
    snareBody: 1.0,
    hatPitch: 1.0,
    hatDecay: 1.0,
    hatBright: 1.0,
    subWeight: 1.0,
    extraTone: 1.0,
    bodyShelf: 0,
    airShelf: 0,
    presenceFreq: 2000,
    presenceGain: 0,
};

const BIOME_DRUM_TONES = {
    abyssal: {
        kickPitch: 0.72,
        kickDecay: 1.35,
        kickPunch: 1.15,
        kickClick: 0.7,
        snarePitch: 0.82,
        snareNoise: 0.68,
        hatBright: 0.6,
        subWeight: 1.45,
        extraTone: 0.78,
        bodyShelf: 5.5,
        airShelf: -4.5,
        presenceFreq: 850,
        presenceGain: 1.5,
    },
    arctic: {
        kickPitch: 0.95,
        kickDecay: 0.8,
        snarePitch: 1.08,
        snareNoise: 0.82,
        hatBright: 1.25,
        extraTone: 1.18,
        bodyShelf: -1.5,
        airShelf: 3.5,
        presenceFreq: 4200,
        presenceGain: 2.5,
    },
    barren: {
        kickPitch: 0.9,
        kickDecay: 0.85,
        kickClick: 0.8,
        snareNoise: 0.75,
        hatBright: 0.9,
        subWeight: 0.85,
        extraTone: 0.88,
        bodyShelf: -2.5,
        airShelf: -2.5,
        presenceFreq: 1500,
        presenceGain: -1,
    },
    corrupted: {
        kickPitch: 1.08,
        kickDecay: 0.82,
        kickPunch: 1.24,
        kickClick: 1.25,
        snarePitch: 1.12,
        snareNoise: 1.45,
        snareBody: 0.85,
        hatPitch: 1.1,
        hatDecay: 0.85,
        hatBright: 1.45,
        subWeight: 0.78,
        extraTone: 1.18,
        bodyShelf: 1.5,
        airShelf: 5.5,
        presenceFreq: 3600,
        presenceGain: 4.5,
    },
    crystalline: {
        kickPitch: 0.94,
        kickDecay: 0.82,
        snarePitch: 1.08,
        snareNoise: 0.92,
        hatPitch: 1.1,
        hatBright: 1.25,
        extraTone: 1.16,
        bodyShelf: -1.2,
        airShelf: 3.2,
        presenceFreq: 3200,
        presenceGain: 2.2,
    },
    crystalloid: {
        kickPitch: 0.98,
        kickDecay: 0.88,
        snarePitch: 1.05,
        snareNoise: 0.96,
        hatPitch: 1.05,
        hatBright: 1.18,
        extraTone: 1.1,
        bodyShelf: -0.5,
        airShelf: 2.8,
        presenceFreq: 3000,
        presenceGain: 2.6,
    },
    desert: {
        kickPitch: 0.92,
        kickDecay: 0.94,
        kickClick: 0.9,
        snareNoise: 0.78,
        snareBody: 1.08,
        hatBright: 0.88,
        subWeight: 0.92,
        extraTone: 0.96,
        bodyShelf: 1,
        airShelf: -1.5,
        presenceFreq: 1800,
        presenceGain: 1.2,
    },
    ethereal: {
        kickPitch: 0.98,
        kickDecay: 0.88,
        kickClick: 0.72,
        snareNoise: 0.7,
        snareBody: 0.8,
        hatPitch: 1.05,
        hatDecay: 1.2,
        hatBright: 1.08,
        subWeight: 0.85,
        extraTone: 1.05,
        bodyShelf: -2.2,
        airShelf: 2,
        presenceFreq: 2600,
        presenceGain: 1.2,
    },
    fungal: {
        kickPitch: 0.96,
        kickDecay: 0.9,
        kickPunch: 0.86,
        kickClick: 0.66,
        snarePitch: 1.02,
        snareNoise: 0.92,
        snareBody: 0.58,
        hatPitch: 1.08,
        hatDecay: 1.2,
        hatBright: 1.02,
        subWeight: 0.68,
        extraTone: 1.08,
        bodyShelf: -0.8,
        airShelf: 2.4,
        presenceFreq: 2800,
        presenceGain: 1.6,
    },
    glacial: {
        kickPitch: 0.95,
        kickDecay: 0.78,
        kickClick: 0.76,
        snarePitch: 1.12,
        snareNoise: 0.7,
        hatPitch: 1.12,
        hatBright: 1.35,
        extraTone: 1.2,
        bodyShelf: -2,
        airShelf: 4.2,
        presenceFreq: 4500,
        presenceGain: 3.2,
    },
    nebula: {
        kickPitch: 1.0,
        kickDecay: 0.86,
        kickClick: 0.74,
        snarePitch: 1.05,
        snareNoise: 0.72,
        hatBright: 1.15,
        extraTone: 1.12,
        bodyShelf: -1.8,
        airShelf: 3.8,
        presenceFreq: 3800,
        presenceGain: 2,
    },
    oceanic: {
        kickPitch: 0.9,
        kickDecay: 1.15,
        kickClick: 0.72,
        snareNoise: 0.68,
        snareBody: 0.92,
        hatPitch: 0.95,
        hatDecay: 1.08,
        hatBright: 0.76,
        subWeight: 1.12,
        extraTone: 0.9,
        bodyShelf: 3.8,
        airShelf: -2.5,
        presenceFreq: 1400,
        presenceGain: 1.8,
    },
    organic: {
        kickPitch: 0.94,
        kickDecay: 0.92,
        kickClick: 0.88,
        snareNoise: 0.82,
        snareBody: 1.1,
        hatPitch: 0.95,
        hatDecay: 1.02,
        hatBright: 0.84,
        subWeight: 1.0,
        extraTone: 0.92,
        bodyShelf: 2.2,
        airShelf: -1.2,
        presenceFreq: 1700,
        presenceGain: 1.6,
    },
    psychedelic: {
        kickPitch: 1.02,
        kickDecay: 0.94,
        kickClick: 1.08,
        snarePitch: 1.04,
        snareNoise: 1.15,
        hatPitch: 1.06,
        hatDecay: 1.05,
        hatBright: 1.18,
        extraTone: 1.08,
        bodyShelf: 0.5,
        airShelf: 3.5,
        presenceFreq: 2800,
        presenceGain: 3.4,
    },
    quantum: {
        kickPitch: 1.12,
        kickDecay: 0.84,
        kickPunch: 1.28,
        kickClick: 1.28,
        snarePitch: 1.18,
        snareNoise: 1.52,
        snareBody: 0.82,
        hatPitch: 1.18,
        hatDecay: 0.82,
        hatBright: 1.5,
        subWeight: 0.72,
        extraTone: 1.24,
        bodyShelf: 1.8,
        airShelf: 6,
        presenceFreq: 4200,
        presenceGain: 5.4,
    },
    storm: {
        kickPitch: 1.02,
        kickDecay: 0.9,
        kickPunch: 1.22,
        kickClick: 1.16,
        snarePitch: 1.08,
        snareNoise: 1.34,
        hatPitch: 1.05,
        hatDecay: 0.92,
        hatBright: 1.32,
        subWeight: 0.88,
        extraTone: 1.06,
        bodyShelf: 1.2,
        airShelf: 4.8,
        presenceFreq: 3400,
        presenceGain: 4.2,
    },
    volcanic: {
        kickPitch: 0.9,
        kickDecay: 1.18,
        kickPunch: 1.26,
        kickClick: 0.95,
        snarePitch: 0.96,
        snareNoise: 1.02,
        hatPitch: 0.9,
        hatDecay: 0.95,
        hatBright: 0.9,
        subWeight: 1.24,
        extraTone: 0.92,
        bodyShelf: 4.5,
        airShelf: -1.5,
        presenceFreq: 1100,
        presenceGain: 2.6,
    },
};

export class AudioEngine {
    constructor() {
        this.ctx = null; this.masterGain = null;
        this.reverbGain = null; this.dryGain = null;
        this.melodyBus = null; this.melodyFilter = null;
        this.transport = null;
        this.recordDest = null;
        this.analyser = null; this.nodes = new CoreNodeRegistry(); this.intervals = [];
        this.playing = false; this.planet = null; this.lastStep = undefined;
        this._vol = 0.7; this._reverb = 0.6; this._drift = 0.4; this._density = 0.5;
        this._granularEnabled = true;
        this._percussionEnabled = true;
        this._percVol = 0.8;
        this._determinismMode = 'identity';
        this._strictRngs = Object.create(null);
        this._listeners = new Set();
        this._stateTimer = null;
        this._worklets = { bitcrusherReady: false, loadPromise: null };
        this._transportScheduler = null;
        this._engineRefactorV2 = true;
        if (typeof window !== 'undefined') {
            const rawFlag = new URLSearchParams(window.location?.search || '').get('engine_refactor_v2');
            if (rawFlag === '0' || rawFlag === 'false') this._engineRefactorV2 = false;
            if (rawFlag === '1' || rawFlag === 'true') this._engineRefactorV2 = true;
        }
        this._noiseBuffer = null; // Cached noise buffer for percussion
        // Melody feature flags (toggled live from UI)
        this._chordEnabled = true;
        this._arpEnabled = true;
        this._pitchBendEnabled = true;
        this._motifEnabled = true;
        // Rhythm feature flags
        this._ghostEnabled = true;
        this._fillsEnabled = true;
        this.tension = 0;
        this._tensionBaseValue = 0;
        this._tensionTick = 0;
        this._tensionSurge = 0;
        this._tensionProfile = null;
        this._tensionState = { phase: 'DORMANT', energy: 0, cyclePos: 0, pocket: 0.5 };
        this._lastTensionPhase = 'DORMANT';
        this._lastPhaseEventTime = 0;
        this._macroEventCooldownUntil = 0;

        // Harmony & Progression state
        this._progression = [];
        this._chordIndex = 0;
        this._currentChordIntervals = [0, 4, 7]; // Default to Maj triad
        this._chordName = 'I';

        // Phrasing state
        this._phraseLength = 0;
        this._restProb = 0.05;
        this._melodyHistory = [];
        this._melodyMode = 'GENERATIVE';
        this._lastMelodyStep = null;
        this._activeMotifIdx = 0;
        this._motifSwapCounter = 0;
        this._voiceCooldowns = Object.create(null);
        this._moonBus = null;
        this._moonProfile = [];
        this._moonProcCount = 0;
        this._moonLastBurst = 0;
        this._lastMoonProcAt = Number.NEGATIVE_INFINITY;

        this._resetSteps();
    }

    _resetSteps() {
        this.stepNote = 0; this.stepGrain = 0; this.stepPerc = 0; this.stepFX = 0; this.stepChord = 0;
    }

    _seedFromLabel(label = 'default') {
        let h = 2166136261 >>> 0;
        for (let i = 0; i < label.length; i++) {
            h ^= label.charCodeAt(i);
            h = Math.imul(h, 16777619) >>> 0;
        }
        return h || 1;
    }

    _random(label = 'default') {
        if (this._determinismMode !== 'strict') return Math.random();
        if (!this._strictRngs[label]) {
            const base = (this.planet?.seed || 1) ^ this._seedFromLabel(label);
            this._strictRngs[label] = new RNG(base >>> 0);
        }
        return this._strictRngs[label].next();
    }

    _snapshotState() {
        const transport = this.transport
            ? {
                bpm: this.transport.bpm,
                cycleSteps: this.transport.cycleSteps,
                stepMs: Math.round(this.transport.stepMs),
                cycleMs: Math.round(this.transport.cycleMs),
            }
            : null;

        return {
            transport,
            tension: {
                phase: this._tensionState?.phase || 'DORMANT',
                energy: this._tensionState?.energy || 0,
            },
            melody: this.getMelodyState(),
            debug: this.getDebugState(),
            chord: this.getChord(),
            playing: this.playing,
        };
    }

    _emitState() {
        if (!this._listeners.size) return;
        const state = this._snapshotState();
        this._listeners.forEach((listener) => {
            try {
                listener(state);
            } catch (e) {
                console.warn('AudioEngine state listener failed:', e);
            }
        });
    }

    _startStateStream() {
        if (this._stateTimer) clearInterval(this._stateTimer);
        this._stateTimer = setInterval(() => this._emitState(), STATE_UPDATE_INTERVAL_MS);
    }

    _stopStateStream() {
        if (this._stateTimer) {
            clearInterval(this._stateTimer);
            this._stateTimer = null;
        }
    }

    _startTransportScheduler() {
        if (!this._engineRefactorV2 || !this.ctx) return;
        this._stopTransportScheduler();
        this._transportScheduler = new LookaheadScheduler(this.ctx, {
            tickMs: SCHEDULER_TICK_MS,
            horizonSec: SCHEDULER_HORIZON_SEC,
        });
        this._transportScheduler.start();
    }

    _stopTransportScheduler() {
        if (!this._transportScheduler) return;
        this._transportScheduler.stop();
        this._transportScheduler = null;
    }

    _scheduleRecurringChannel(name, intervalSec, handler, startOffsetSec = 0.02) {
        if (!this._transportScheduler || typeof handler !== 'function') return false;
        const startTime = (this.ctx?.currentTime || 0) + Math.max(0, startOffsetSec);
        this._transportScheduler.addRecurringChannel(name, {
            startTime,
            intervalSec,
            handler,
        });
        return true;
    }

    _ensureAudioWorklets() {
        if (!this.ctx?.audioWorklet || this._worklets.loadPromise) return;
        const bitcrusherModuleUrl = new URL('./audio/worklets/bitcrusher-processor.js', import.meta.url);
        this._worklets.loadPromise = this.ctx.audioWorklet
            .addModule(bitcrusherModuleUrl)
            .then(() => { this._worklets.bitcrusherReady = true; })
            .catch((err) => {
                this._worklets.bitcrusherReady = false;
                console.warn('Bitcrusher worklet unavailable, using fallback:', err);
            });
    }

    _boot() {
        if (!this.ctx) {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
            this.analyser = this.ctx.createAnalyser();
            this.analyser.fftSize = 512;

            // 3-Band EQ (Tier 5 Mixer)
            this.eqLow = this.ctx.createBiquadFilter();
            this.eqLow.type = 'lowshelf'; this.eqLow.frequency.value = 250;
            this.eqMid = this.ctx.createBiquadFilter();
            this.eqMid.type = 'peaking'; this.eqMid.frequency.value = 1000; this.eqMid.Q.value = 1;
            this.eqHigh = this.ctx.createBiquadFilter();
            this.eqHigh.type = 'highshelf'; this.eqHigh.frequency.value = 4000;

            this.masterGain = this.ctx.createGain();
            this.masterGain.gain.value = this._vol;

            // Master limiter/compressor to prevent clipping during climax events
            this.compressor = this.ctx.createDynamicsCompressor();
            this.compressor.threshold.value = -0.5; // Strict limit just below 0dB
            this.compressor.knee.value = 0;       // Hard knee for limiting
            this.compressor.ratio.value = 20;     // Infinite-ratio limiting
            this.compressor.attack.value = 0.001; // Instant snap
            this.compressor.release.value = 0.1;  // Fast recovery

            // 20Hz DC-Offset Filter — prevents pops and subsonic build-up
            this.dcFilter = this.ctx.createBiquadFilter();
            this.dcFilter.type = 'highpass'; this.dcFilter.frequency.value = 20;

            this.eqLow.connect(this.eqMid);
            this.eqMid.connect(this.eqHigh);
            this.eqHigh.connect(this.masterGain);
            this.masterGain.connect(this.compressor);
            this.compressor.connect(this.dcFilter);
            this.dcFilter.connect(this.analyser);
            if (this.ctx.createMediaStreamDestination) {
                this.recordDest = this.ctx.createMediaStreamDestination();
                this.dcFilter.connect(this.recordDest);
            }
            this.analyser.connect(this.ctx.destination);

            // Pre-build shared noise buffer for percussion (snare/shaker)
            const nLen = this.ctx.sampleRate;
            const nBuf = this.ctx.createBuffer(1, nLen, this.ctx.sampleRate);
            const nd = nBuf.getChannelData(0);
            for (let i = 0; i < nLen; i++) nd[i] = this._random('boot-noise') * 2 - 1;
            this._noiseBuffer = nBuf;
            // Set up AudioListener for HRTF spatial audio (Tier 3)
            const L = this.ctx.listener;
            if (L.positionX) {
                L.positionX.value = 0; L.positionY.value = 1.6; L.positionZ.value = 0;
                L.forwardX.value = 0; L.forwardY.value = 0; L.forwardZ.value = -1;
                L.upX.value = 0; L.upY.value = 1; L.upZ.value = 0;
            } else if (L.setPosition) {
                L.setPosition(0, 1.6, 0);
                L.setOrientation(0, 0, -1, 0, 1, 0);
            }
            this._ensureAudioWorklets();
        }
        if (this.ctx.state === 'suspended') this.ctx.resume();
    }

    _buildReverb(decay, seed) {
        const ctx = this.ctx;
        const rng = new RNG(seed || 0);
        // Cap IR length to 4s to avoid massive buffer allocation on long-reverb biomes
        const len = ctx.sampleRate * Math.min(Math.max(2, decay), 4);
        const ir = ctx.createBuffer(2, len, ctx.sampleRate);
        for (let c = 0; c < 2; c++) {
            const d = ir.getChannelData(c);
            // Early reflections
            [0.015, 0.025, 0.04, 0.06, 0.09].forEach((t, i) => {
                const p = Math.round(t * ctx.sampleRate);
                if (p < len) d[p] += (0.7 - i * 0.12) * (rng.range(0, 1) > .5 ? 1 : -1);
            });
            // Diffuse tail
            for (let i = 0; i < len; i++) {
                const t = i / len;
                if (i > 0.04 * ctx.sampleRate)
                    d[i] += rng.range(-1, 1) * Math.pow(1 - t, 1.6) * 0.55;
            }
            // High-frequency damping (simulates air absorption in real rooms)
            let prev = 0;
            for (let i = 0; i < len; i++) {
                const damping = 0.3 + 0.7 * (1 - i / len);
                d[i] = prev + damping * (d[i] - prev);
                prev = d[i];
            }
        }
        const conv = ctx.createConvolver();
        conv.buffer = ir;
        return conv;
    }

    _resolveOscType(type, fallback = 'sine') {
        if (NATIVE_OSC_TYPES.has(type)) return type;
        return OSC_TYPE_FALLBACKS[type] || fallback;
    }

    _getOctaveMultiplier(multiplier, planet) {
        const safeMultiplier = Number.isFinite(multiplier) && multiplier > 0 ? multiplier : 1;
        const stretch = planet?.octaveStretch || 1;
        if (stretch === 1) return safeMultiplier;
        return safeMultiplier * Math.pow(stretch, Math.max(0, Math.log2(safeMultiplier)));
    }

    _getStepFrequency(planet, step, octaveMultiplier = 1) {
        const norm = ((step % 12) + 12) % 12;
        const octaveShift = Math.floor(step / 12);
        const octaveBase = 2 * (planet?.octaveStretch || 1);
        const baseMultiplier = this._getOctaveMultiplier(octaveMultiplier, planet);
        const stepRatio = (planet.useJI && planet.jiRatios)
            ? planet.jiRatios[norm]
            : Math.pow(2, norm / 12);
        return planet.rootFreq * baseMultiplier * stepRatio * Math.pow(octaveBase, octaveShift);
    }

    _clamp(value, min, max) {
        return Math.min(max, Math.max(min, value));
    }

    _getTensionProfile(planet) {
        const biomeId = planet?.biome?.id || 'default';
        const density = this._clamp(planet?.melodyDensity || 0.05, 0.01, 0.35);
        const merged = {
            ...DEFAULT_TENSION_PROFILE,
            ...(BIOME_TENSION_PROFILES[biomeId] || {})
        };
        const densityLift = (density - 0.08) * 0.05;
        return {
            ...merged,
            riseRate: this._clamp(merged.riseRate + densityLift, 0.012, 0.05),
            surgeChance: this._clamp(merged.surgeChance + densityLift * 1.8, 0, 0.35),
            climaxThreshold: this._clamp(merged.climaxThreshold, 0.74, 0.92),
            fillVoices: [...(merged.fillVoices || [])],
            polyVoices: [...(merged.polyVoices || [])],
            climaxRatios: [...(merged.climaxRatios || DEFAULT_TENSION_PROFILE.climaxRatios)],
        };
    }

    _getDrumToneProfile(planet) {
        const biomeId = planet?.biome?.id || 'default';
        return {
            ...DEFAULT_DRUM_TONE,
            ...(BIOME_DRUM_TONES[biomeId] || {})
        };
    }

    _getPhasePatternProfile(biomeId) {
        const profile = {
            DORMANT: { drop: 0.34, add: 0.01, open: 0.01, rotate: 0 },
            STIR: { drop: 0.18, add: 0.03, open: 0.03, rotate: 0 },
            BUILD: { drop: 0.07, add: 0.09, open: 0.08, rotate: 0 },
            SURGE: { drop: 0.02, add: 0.16, open: 0.14, rotate: 0 },
            CLIMAX: { drop: 0.0, add: 0.22, open: 0.22, rotate: 0 },
            FALLOUT: { drop: 0.24, add: 0.02, open: 0.04, rotate: 0 },
        };

        switch (biomeId) {
            case 'barren':
            case 'glacial':
            case 'arctic':
            case 'nebula':
            case 'ethereal':
                profile.DORMANT = { drop: 0.5, add: 0.0, open: 0.0, rotate: 0 };
                profile.STIR = { drop: 0.34, add: 0.01, open: 0.01, rotate: 0 };
                profile.BUILD = { drop: 0.16, add: 0.04, open: 0.04, rotate: 0 };
                profile.SURGE = { drop: 0.08, add: 0.08, open: 0.08, rotate: 0 };
                profile.CLIMAX = { drop: 0.04, add: 0.1, open: 0.1, rotate: 0 };
                profile.FALLOUT = { drop: 0.3, add: 0.01, open: 0.02, rotate: 0 };
                break;
            case 'oceanic':
                profile.DORMANT = { drop: 0.28, add: 0.01, open: 0.02, rotate: 0 };
                profile.STIR = { drop: 0.14, add: 0.03, open: 0.04, rotate: 0 };
                profile.BUILD = { drop: 0.05, add: 0.07, open: 0.08, rotate: 0 };
                profile.SURGE = { drop: 0.01, add: 0.13, open: 0.14, rotate: 0 };
                profile.CLIMAX = { drop: 0.0, add: 0.16, open: 0.18, rotate: 1 };
                profile.FALLOUT = { drop: 0.2, add: 0.02, open: 0.05, rotate: 0 };
                break;
            case 'fungal':
                profile.DORMANT = { drop: 0.18, add: 0.02, open: 0.03, rotate: 0 };
                profile.STIR = { drop: 0.07, add: 0.04, open: 0.05, rotate: 0 };
                profile.BUILD = { drop: 0.02, add: 0.08, open: 0.08, rotate: 0 };
                profile.SURGE = { drop: 0.0, add: 0.13, open: 0.1, rotate: 0 };
                profile.CLIMAX = { drop: 0.0, add: 0.16, open: 0.12, rotate: 1 };
                profile.FALLOUT = { drop: 0.14, add: 0.02, open: 0.04, rotate: 0 };
                break;
            case 'organic':
            case 'desert':
                profile.DORMANT = { drop: 0.2, add: 0.02, open: 0.02, rotate: 0 };
                profile.STIR = { drop: 0.08, add: 0.05, open: 0.04, rotate: 0 };
                profile.BUILD = { drop: 0.03, add: 0.11, open: 0.08, rotate: 0 };
                profile.SURGE = { drop: 0.0, add: 0.19, open: 0.12, rotate: 1 };
                profile.CLIMAX = { drop: 0.0, add: 0.23, open: 0.16, rotate: 1 };
                profile.FALLOUT = { drop: 0.18, add: 0.03, open: 0.04, rotate: 0 };
                break;
            case 'crystalline':
            case 'crystalloid':
                profile.DORMANT = { drop: 0.26, add: 0.01, open: 0.03, rotate: 0 };
                profile.STIR = { drop: 0.12, add: 0.04, open: 0.06, rotate: 0 };
                profile.BUILD = { drop: 0.04, add: 0.08, open: 0.12, rotate: 0 };
                profile.SURGE = { drop: 0.0, add: 0.12, open: 0.18, rotate: 1 };
                profile.CLIMAX = { drop: 0.0, add: 0.16, open: 0.24, rotate: 1 };
                profile.FALLOUT = { drop: 0.22, add: 0.02, open: 0.05, rotate: 0 };
                break;
            case 'quantum':
            case 'corrupted':
            case 'storm':
            case 'psychedelic':
                profile.DORMANT = { drop: 0.14, add: 0.04, open: 0.04, rotate: 0 };
                profile.STIR = { drop: 0.04, add: 0.09, open: 0.08, rotate: 0 };
                profile.BUILD = { drop: 0.0, add: 0.17, open: 0.12, rotate: 1 };
                profile.SURGE = { drop: 0.0, add: 0.26, open: 0.18, rotate: 1 };
                profile.CLIMAX = { drop: 0.0, add: 0.32, open: 0.24, rotate: 2 };
                profile.FALLOUT = { drop: 0.1, add: 0.05, open: 0.08, rotate: 0 };
                break;
            case 'volcanic':
            case 'abyssal':
                profile.DORMANT = { drop: 0.22, add: 0.01, open: 0.01, rotate: 0 };
                profile.STIR = { drop: 0.1, add: 0.03, open: 0.03, rotate: 0 };
                profile.BUILD = { drop: 0.03, add: 0.08, open: 0.05, rotate: 0 };
                profile.SURGE = { drop: 0.0, add: 0.14, open: 0.07, rotate: 0 };
                profile.CLIMAX = { drop: 0.0, add: 0.18, open: 0.1, rotate: 1 };
                profile.FALLOUT = { drop: 0.2, add: 0.02, open: 0.03, rotate: 0 };
                break;
            default:
                break;
        }

        return profile;
    }

    _transformPhasePattern(pattern, voice, phaseCfg, rng) {
        const source = Array.isArray(pattern) ? pattern.slice() : [];
        const len = source.length;
        if (!len) return source;

        const voiceAddBias = voice === 'k' ? 0.58 : voice === 's' ? 0.42 : voice === 'h' ? 0.88 : 0.32;
        const voiceDropBias = voice === 'h' ? 0.75 : voice === 'b' ? 0.95 : 0.7;

        for (let i = 0; i < len; i++) {
            const strong = i % 4 === 0;
            const backbeat = (i + 2) % 4 === 0;
            const offbeat = i % 2 === 1;
            const turnaround = i >= len - 2;
            const prevHit = source[(i - 1 + len) % len] > 0;
            const nextHit = source[(i + 1) % len] > 0;
            const nearHit = prevHit || nextHit;
            const slotWeight = voice === 'k'
                ? (strong ? 1 : turnaround ? 0.72 : offbeat ? 0.2 : 0.42)
                : voice === 's'
                    ? (backbeat ? 1 : offbeat ? 0.26 : 0.14)
                    : voice === 'h'
                        ? (offbeat ? 1 : strong ? 0.28 : 0.6)
                        : (strong ? 0.72 : turnaround ? 0.28 : 0.1);

            if (source[i]) {
                const protect = strong || backbeat
                    ? (voice === 'k' || voice === 's' ? 0.08 : 0.16)
                    : turnaround
                        ? 0.45
                        : 1;
                if (rng.range(0, 1) < phaseCfg.drop * protect * voiceDropBias) {
                    source[i] = 0;
                    continue;
                }
                if (voice === 'h' && source[i] === 1 && rng.range(0, 1) < phaseCfg.open * slotWeight * 0.85) {
                    source[i] = 2;
                }
                continue;
            }

            let addChance = phaseCfg.add * slotWeight * voiceAddBias;
            if (nearHit) addChance *= voice === 'h' ? 0.55 : 0.2;
            if (voice === 'k' && offbeat && !turnaround) addChance *= 0.35;
            if (voice === 's' && !backbeat && !offbeat) addChance *= 0.2;
            if (voice === 'b' && !strong) addChance *= 0.25;

            if (rng.range(0, 1) < addChance) {
                source[i] = voice === 'h' && rng.range(0, 1) < phaseCfg.open * (offbeat ? 1 : 0.35) ? 2 : 1;
            }
        }

        const rotateBase = voice === 'h' ? Math.min(1, phaseCfg.rotate || 0) : 0;
        const rotate = ((rotateBase % len) + len) % len;
        if (!rotate) return source;
        return source.slice(len - rotate).concat(source.slice(0, len - rotate));
    }

    _buildPhasePatternBanks(patterns, cycleSteps, seed, biomeId) {
        const profile = this._getPhasePatternProfile(biomeId);
        const phases = ['DORMANT', 'STIR', 'BUILD', 'SURGE', 'CLIMAX', 'FALLOUT'];
        const voices = ['k', 's', 'h', 'b'];
        const banks = {};

        phases.forEach((phase, phaseIdx) => {
            banks[phase] = {};
            voices.forEach((voice, voiceIdx) => {
                const phaseSeed = (seed + 97000 + phaseIdx * 173 + voiceIdx * 29 + cycleSteps * 7) >>> 0;
                banks[phase][voice] = this._transformPhasePattern(
                    patterns[voice],
                    voice,
                    profile[phase],
                    new RNG(phaseSeed)
                );
            });
        });

        return banks;
    }

    _getMacroEventChance(biomeId, state) {
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

        return this._clamp(base * phaseMul * (0.62 + (state?.energy || 0) * 0.78), 0, 0.24);
    }

    _getMacroEventCooldown(biomeId, phase, rng) {
        let min = 8, max = 15;
        if (['storm', 'quantum', 'corrupted'].includes(biomeId)) { min = 6; max = 11; }
        else if (['volcanic', 'organic', 'psychedelic'].includes(biomeId)) { min = 7; max = 13; }
        else if (biomeId === 'fungal') { min = 9; max = 15; }
        else if (['barren', 'glacial', 'arctic', 'nebula', 'ethereal'].includes(biomeId)) { min = 12; max = 20; }
        if (phase === 'SURGE' || phase === 'CLIMAX') min *= 0.8;
        return rng.range(min, max);
    }

    _spawnFxNoise(dest, opts = {}) {
        if (!this.ctx || !this._noiseBuffer || !dest) return;
        const ctx = this.ctx;
        const t = ctx.currentTime + (opts.delay || 0);
        const dur = Math.max(0.06, opts.dur || 0.4);
        const src = ctx.createBufferSource();
        const filt = ctx.createBiquadFilter();
        const env = ctx.createGain();
        const pan = ctx.createStereoPanner();

        src.buffer = this._noiseBuffer;
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
        this.nodes.push(src, filt, env, pan);
    }

    _spawnFxTone(dest, opts = {}) {
        if (!this.ctx || !dest) return;
        const ctx = this.ctx;
        const t = ctx.currentTime + (opts.delay || 0);
        const dur = Math.max(0.05, opts.dur || 0.35);
        const osc = ctx.createOscillator();
        const env = ctx.createGain();
        const pan = ctx.createStereoPanner();
        const filter = opts.filterType ? ctx.createBiquadFilter() : null;

        osc.type = this._resolveOscType(opts.wave || 'sine');
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
        if (filter) this.nodes.push(osc, filter, env, pan);
        else this.nodes.push(osc, env, pan);
    }

    _spawnFxCluster(dest, opts = {}) {
        const baseFreq = opts.baseFreq || 220;
        const ratios = opts.ratios || [1, 5 / 4, 3 / 2];
        ratios.forEach((ratio, i) => {
            this._spawnFxTone(dest, {
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

    _firePhaseTransitionEvent(p, dest, fromPhase, toPhase) {
        if (!this.playing || !this.ctx) return;
        const biomeId = p?.biome?.id;
        const root = p?.rootFreq || 220;
        const upward = ['BUILD', 'SURGE', 'CLIMAX'].includes(toPhase) && toPhase !== fromPhase;
        const rng = new RNG((p.seed || 0) + 130000 + this.stepFX++);
        const pan = rng.range(-0.55, 0.55);

        switch (biomeId) {
            case 'storm':
                this._spawnFxNoise(dest, { dur: upward ? 0.34 : 0.7, gain: 0.065, startFreq: upward ? 9000 : 1800, endFreq: upward ? 1400 : 220, q: 0.8, pan });
                if (upward) this._spawnFxTone(dest, { wave: 'triangle', startFreq: root * 3.2, endFreq: root * 1.4, dur: 0.45, gain: 0.04, pan: -pan });
                break;
            case 'quantum':
            case 'corrupted':
                for (let i = 0; i < 3; i++) {
                    this._spawnFxTone(dest, {
                        wave: biomeId === 'quantum' ? 'square' : 'sawtooth',
                        startFreq: root * rng.range(6, 11),
                        endFreq: root * rng.range(2, 4),
                        dur: 0.08 + i * 0.02,
                        gain: 0.024,
                        pan: (i % 2 === 0 ? -0.45 : 0.45),
                        delay: i * 0.035,
                    });
                }
                break;
            case 'fungal':
                this._spawnFxNoise(dest, { dur: 0.24, gain: 0.018, startFreq: 2600, endFreq: 720, filterType: 'bandpass', q: 1.3, pan });
                for (let i = 0; i < 3; i++) {
                    this._spawnFxTone(dest, {
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
                this._spawnFxNoise(dest, { dur: 0.42, gain: 0.03, startFreq: 1800, endFreq: 500, filterType: 'bandpass', q: 1.1, pan });
                this._spawnFxCluster(dest, {
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
                this._spawnFxNoise(dest, { dur: 1.0, gain: 0.038, startFreq: 1200, endFreq: 180, filterType: 'lowpass', q: 0.6, pan });
                this._spawnFxCluster(dest, { baseFreq: root * 4.5, ratios: [1, 4 / 3], wave: 'sine', gain: 0.018, dur: 0.18, spacing: 0.09, endMul: 1.04 });
                break;
            case 'crystalline':
            case 'crystalloid':
            case 'glacial':
            case 'arctic':
                this._spawnFxCluster(dest, {
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
                this._spawnFxTone(dest, { wave: 'triangle', startFreq: root * 1.5, endFreq: root * 0.8, dur: 0.6, gain: 0.05, pan, filterType: 'lowpass', filterFreq: root * 7 });
                this._spawnFxNoise(dest, { dur: 0.45, gain: 0.03, startFreq: 800, endFreq: 120, filterType: 'lowpass', q: 0.7, pan: -pan });
                break;
            default:
                this._spawnFxNoise(dest, { dur: upward ? 0.35 : 0.55, gain: 0.026, startFreq: upward ? 2600 : 1400, endFreq: upward ? 700 : 220, q: 0.8, pan });
                this._spawnFxTone(dest, { wave: 'sine', startFreq: root * 4, endFreq: root * 2.8, dur: 0.25, gain: 0.018, pan: -pan });
                break;
        }
    }

    _fireSignatureMacroEvent(p, dest, state) {
        if (!this.playing || !this.ctx) return;
        const biomeId = p?.biome?.id;
        const root = p?.rootFreq || 220;
        const rng = new RNG((p.seed || 0) + 140000 + this.stepFX++);
        const energy = state?.energy || 0;

        switch (biomeId) {
            case 'storm':
                for (let i = 0; i < 3 + Math.round(energy * 2); i++) {
                    this._spawnFxNoise(dest, {
                        dur: 0.12 + rng.range(0, 0.08),
                        gain: 0.04 + energy * 0.025,
                        startFreq: rng.range(6500, 11000),
                        endFreq: rng.range(800, 1800),
                        q: 0.9,
                        pan: rng.range(-0.8, 0.8),
                        delay: i * 0.07
                    });
                }
                this._spawnFxTone(dest, { wave: 'triangle', startFreq: root * 2.2, endFreq: root * 0.65, dur: 1.1, gain: 0.055, pan: 0, filterType: 'lowpass', filterFreq: root * 8 });
                break;
            case 'quantum':
                for (let i = 0; i < 4 + Math.round(energy * 3); i++) {
                    this._spawnFxTone(dest, {
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
                    this._spawnFxNoise(dest, { dur: 0.18, gain: 0.032, startFreq: rng.range(2400, 6000), endFreq: rng.range(400, 1200), q: 1.2, pan: rng.range(-0.7, 0.7), delay: i * 0.06 });
                }
                this._spawnFxCluster(dest, { baseFreq: root * 5.5, ratios: [1, 16 / 15, 45 / 32], wave: 'sawtooth', gain: 0.02, dur: 0.16, spacing: 0.03 });
                break;
            case 'fungal':
                for (let i = 0; i < 4 + Math.round(energy * 2); i++) {
                    this._spawnFxTone(dest, {
                        wave: i % 3 === 0 ? 'triangle' : 'sine',
                        startFreq: root * (3.1 + rng.range(0, 2.4)),
                        endFreq: root * (2.0 + rng.range(0, 1.2)),
                        dur: 0.08 + rng.range(0, 0.05),
                        gain: 0.012 + energy * 0.006,
                        pan: rng.range(-0.7, 0.7),
                        delay: i * 0.055,
                    });
                }
                this._spawnFxNoise(dest, { dur: 0.36, gain: 0.018, startFreq: 1800, endFreq: 520, filterType: 'bandpass', q: 1.1 });
                this._spawnFxCluster(dest, { baseFreq: root * 3.0, ratios: [1, 9 / 8, 4 / 3, 3 / 2], wave: 'triangle', gain: 0.016, dur: 0.12, spacing: 0.045, endMul: 0.97 });
                break;
            case 'organic':
                this._spawnFxNoise(dest, { dur: 0.9, gain: 0.03, startFreq: 1800, endFreq: 300, filterType: 'bandpass', q: 0.8 });
                this._spawnFxCluster(dest, { baseFreq: root * 2.8, ratios: [1, 6 / 5, 3 / 2], wave: 'triangle', gain: 0.022, dur: 0.2, spacing: 0.07, endMul: 0.88 });
                break;
            case 'oceanic':
                this._spawnFxNoise(dest, { dur: 1.8, gain: 0.038, startFreq: 900, endFreq: 140, filterType: 'lowpass', q: 0.55 });
                this._spawnFxCluster(dest, { baseFreq: root * 4.2, ratios: [1, 4 / 3, 2], wave: 'sine', gain: 0.016, dur: 0.22, spacing: 0.12, endMul: 1.06 });
                break;
            case 'abyssal':
                this._spawnFxTone(dest, { wave: 'triangle', startFreq: root * 1.15, endFreq: root * 0.42, dur: 1.8, gain: 0.07, filterType: 'lowpass', filterFreq: root * 6 });
                this._spawnFxNoise(dest, { dur: 0.9, gain: 0.025, startFreq: 500, endFreq: 80, filterType: 'lowpass', q: 0.7 });
                break;
            case 'volcanic':
                this._spawnFxTone(dest, { wave: 'triangle', startFreq: root * 2.4, endFreq: root * 0.8, dur: 1.2, gain: 0.06, filterType: 'lowpass', filterFreq: root * 8 });
                this._spawnFxNoise(dest, { dur: 0.7, gain: 0.03, startFreq: 1600, endFreq: 180, filterType: 'lowpass', q: 0.7 });
                break;
            case 'crystalline':
            case 'crystalloid':
            case 'glacial':
            case 'arctic':
                this._spawnFxCluster(dest, {
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
                this._spawnFxNoise(dest, { dur: 1.1, gain: 0.03, startFreq: 2600, endFreq: 400, filterType: 'bandpass', q: 0.7 });
                this._spawnFxCluster(dest, { baseFreq: root * 3.6, ratios: [1, 6 / 5, 3 / 2], wave: 'triangle', gain: 0.018, dur: 0.16, spacing: 0.09, endMul: 0.92 });
                break;
            case 'nebula':
            case 'ethereal':
                this._spawnFxCluster(dest, { baseFreq: root * 4.8, ratios: [1, 5 / 4, 3 / 2, 2], wave: 'sine', gain: 0.02, dur: 0.65, spacing: 0.08, endMul: 1.01 });
                break;
            default:
                this._spawnFxTone(dest, { wave: 'sine', startFreq: root * 4, endFreq: root * 2.6, dur: 0.4, gain: 0.022 });
                break;
        }
    }

    _getTensionState(planet, stepIndex = 0) {
        const profile = this._tensionProfile || this._getTensionProfile(planet);
        const cycleSteps = Math.max(1, this.transport?.cycleSteps || planet?.ac?.stepCount || 16);
        const cyclePos = ((stepIndex % cycleSteps) + cycleSteps) % cycleSteps / cycleSteps;
        const energy = this._clamp(this.tension || 0, 0, 1);
        const phaseAngle = (this._tensionTick || 0) * profile.pulseRate + cyclePos * Math.PI * 2 + profile.phaseOffset;
        const pocket = 0.5 + Math.sin(phaseAngle) * 0.5;

        let phase = 'DORMANT';
        if (this._climaxStartedDrain) phase = 'FALLOUT';
        else if (this._climaxFired || energy >= Math.min(0.98, profile.climaxThreshold + 0.06)) phase = 'CLIMAX';
        else if (energy >= profile.surgePoint) phase = 'SURGE';
        else if (energy >= profile.buildPoint) phase = 'BUILD';
        else if (energy >= profile.lowPoint) phase = 'STIR';

        return { phase, energy, cyclePos, pocket, profile };
    }

    _getRhythmState(planet, stepIndex, barCount, rng) {
        const tension = this._getTensionState(planet, stepIndex);
        const profile = tension.profile;
        const density = this._clamp((planet?.melodyDensity || 0.05) * 4.5, 0.2, 1.4);
        const pocketLift = Math.max(0, tension.pocket - 0.42);
        const phaseBoost = tension.phase === 'SURGE'
            ? 0.08
            : tension.phase === 'CLIMAX'
                ? 0.14
                : tension.phase === 'FALLOUT'
                    ? -0.05
                    : 0;
        const fillModulo = Math.max(2, Math.round(profile.fillEvery || 4));
        const fillBar = (barCount % fillModulo) === fillModulo - 1;
        const fillWindow = tension.cyclePos >= profile.fillStart;
        const preferredFillVoices = (profile.fillVoices || []).filter(v => typeof v === 'string');
        const preferredPolyVoices = (profile.polyVoices || []).filter(v => typeof v === 'string');

        return {
            phase: tension.phase,
            energy: tension.energy,
            chaosChance: this._clamp(
                Math.max(0, tension.energy - profile.surgePoint) * 1.2 * profile.chaosBias
                + (tension.phase === 'CLIMAX' ? 0.05 * profile.chaosBias : 0),
                0,
                0.55
            ),
            ghostChance: this._clamp(
                (0.045 + tension.energy * 0.08 + pocketLift * 0.12) * profile.ghostBias,
                0.01,
                0.45
            ),
            fillActive: this._fillsEnabled && fillWindow && fillBar
                && tension.energy > Math.max(profile.lowPoint, profile.buildPoint - 0.08),
            fillChance: this._clamp(
                (0.12 + tension.energy * 0.24 + phaseBoost + pocketLift * 0.08) * profile.fillBias,
                0.04,
                0.95
            ),
            accentChance: this._clamp(
                (0.03 + tension.energy * 0.12 + pocketLift * 0.08) * profile.accentBias,
                0.02,
                0.52
            ),
            kickPush: this._clamp(
                (tension.energy * 0.05 + (tension.phase === 'SURGE' ? 0.05 : 0)) * profile.kickBias * density,
                0,
                0.32
            ),
            snarePush: this._clamp(
                (tension.energy * 0.045 + (tension.phase === 'CLIMAX' ? 0.045 : 0)) * profile.snareBias * density,
                0,
                0.24
            ),
            hatPush: this._clamp(
                (0.02 + tension.energy * 0.1 + Math.abs(tension.pocket - 0.5) * 0.16) * profile.hatBias,
                0,
                0.5
            ),
            openHatChance: this._clamp(
                (0.06 + tension.energy * 0.14 + (tension.phase === 'SURGE' ? 0.08 : 0)) * profile.openHatBias,
                0.03,
                0.72
            ),
            extraVoiceChance: this._clamp(
                (0.08 + tension.energy * 0.14 + (tension.phase === 'BUILD' ? 0.04 : 0)) * profile.extraBias,
                0.02,
                0.95
            ),
            velocityLift: this._clamp(
                1 + tension.energy * 0.18 + (tension.phase === 'CLIMAX' ? 0.12 : tension.phase === 'FALLOUT' ? -0.06 : 0),
                0.82,
                1.36
            ),
            fillVoices: preferredFillVoices,
            polyVoices: preferredPolyVoices,
        };
    }

    _setManagedTimeout(fn, delayMs) {
        let timeoutId = null;
        timeoutId = setTimeout(() => {
            const idx = this.intervals.indexOf(timeoutId);
            if (idx !== -1) this.intervals.splice(idx, 1);
            fn();
        }, delayMs);
        this.intervals.push(timeoutId);
        return timeoutId;
    }

    _buildTransport(planet) {
        return buildTransport(planet?.ac?.stepCount || 16, planet?.bpm || 120);
    }

    _fitPatternToCycle(pattern, targetLength) {
        const source = Array.isArray(pattern) && pattern.length ? pattern : [0];
        if (!Number.isFinite(targetLength) || targetLength <= 0) return source.slice();
        if (source.length === targetLength) return source.slice();

        const projected = new Array(targetLength).fill(0);
        source.forEach((value, index) => {
            if (!value) return;
            const mappedIndex = Math.min(targetLength - 1, Math.floor((index / source.length) * targetLength));
            projected[mappedIndex] = Math.max(projected[mappedIndex], value);
        });
        return projected;
    }

    _getMelodyStride(planet, cycleSteps) {
        const density = this._clamp(planet?.melodyDensity || 0.05, 0.01, 0.35);
        let stride = density >= 0.2 ? 1 : density >= 0.09 ? 2 : 4;
        if (cycleSteps <= 8 && stride > 1) stride -= 1;
        return this._clamp(stride, 1, cycleSteps);
    }

    _getTargetRestProbability(planet, opts = {}) {
        const cycleSteps = Math.max(1, opts.cycleSteps || this.transport?.cycleSteps || 16);
        const density = this._clamp(planet?.melodyDensity || 0.05, 0.01, 0.35);
        const biomeId = planet?.biome?.id;
        const densityBias = 0.55 + (this._density * 0.9);
        let target = 0.84 - (density * 2.25 * densityBias);

        if (opts.isResponse) target -= 0.06;
        if ((opts.cycleStep || 0) === 0) target -= 0.05;
        if (opts.isPhraseEnd) target += 0.18;
        target -= this._clamp((opts.tension || 0) * 0.12, 0, 0.12);

        let phraseCap = Math.max(2, Math.round(cycleSteps * (0.32 + (1 - density) * 0.08)));
        if (biomeId === 'fungal') {
            target -= 0.05;
            if (((opts.cycleStep || 0) % 3) === 0) target -= 0.035;
            if (opts.isResponse) target -= 0.025;
            if (opts.isPhraseEnd) target -= 0.07;
            phraseCap = Math.max(2, Math.round(cycleSteps * 0.22));
        }
        if (this._phraseLength >= phraseCap) {
            target += Math.min(0.26, (this._phraseLength - phraseCap + 1) * 0.08);
        }
        if (cycleSteps <= 7) target += 0.04;

        return this._clamp(target, 0.08, 0.92);
    }

    _getAdditiveVoiceLifetime(name, atk, dur) {
        const baseLifetime = Math.max(0.4, (atk || 0) + (dur || 0));
        switch (name) {
            case 'marimba': return Math.min(baseLifetime, 2.6) + 0.3;
            case 'metallic': return 10.5;
            case 'crystal_chimes': return 15.8;
            case 'gong': return 20.8;
            case 'brass_pad': return Math.max(atk || 0, 1.5) + (dur || 0) + 0.9;
            default: return baseLifetime + 0.8;
        }
    }

    _getPerformanceProfile(planet) {
        const density = this._clamp(planet?.melodyDensity || 0.05, 0.01, 0.35);
        const stepSeconds = this.transport?.stepSeconds || 0.125;
        const activeNodes = this.nodes?.size || 0;
        const nodePressure = this._clamp((activeNodes - 170) / 220, 0, 1);
        const speedPressure = this._clamp((0.14 - stepSeconds) / 0.07, 0, 1);
        const densityPressure = this._clamp((density - 0.1) / 0.18, 0, 1);
        const pressure = this._clamp(nodePressure * 0.55 + speedPressure * 0.2 + densityPressure * 0.25, 0, 1);
        return {
            density,
            stepSeconds,
            activeNodes,
            pressure,
            scalar: 1 - pressure * 0.7,
        };
    }

    _pickMelodyWave(planet, ac, rng) {
        const waves = ac?.melodyWaves?.length ? ac.melodyWaves : ['sine'];
        const perf = this._getPerformanceProfile(planet);
        const now = this.ctx?.currentTime || 0;
        const weighted = [];

        waves.forEach((wave) => {
            const cost = MELODY_VOICE_COSTS[wave] || 0;
            const readyAt = this._voiceCooldowns[wave] || 0;
            let weight = 1.15 - cost * perf.pressure * 0.9;

            if (readyAt > now) weight *= 0.08;
            if (perf.activeNodes > 280 && cost > 0.4) weight *= 0.22;
            if (perf.pressure > 0.55 && wave === 'granular_cloud') weight *= 0.15;
            if (perf.pressure > 0.45 && wave === 'drone_morph') weight *= 0.35;

            if (weight < 0.12) return;
            const copies = Math.max(1, Math.round(this._clamp(weight, 0.12, 1.4) * 6));
            for (let i = 0; i < copies; i++) weighted.push(wave);
        });

        if (weighted.length) return rng.pick(weighted);
        return waves.find((wave) => (MELODY_VOICE_COSTS[wave] || 0) < 0.4) || waves[0];
    }

    _getAdditiveVoiceEnvelope(wType, rng, atk, dur) {
        switch (wType) {
            case 'choir': return { atk: rng.range(0.6, 1.8), dur: rng.range(2.4, 5.2) };
            case 'crystal_chimes': return { atk: 0.02, dur: rng.range(2.5, 6.0) };
            case 'drone_morph': return { atk: rng.range(0.2, 0.9), dur: rng.range(1.8, 4.5) };
            case 'gong': return { atk: 0.03, dur: rng.range(5.0, 9.0) };
            case 'granular_cloud': return { atk: rng.range(0.03, 0.18), dur: rng.range(0.5, 1.6) };
            case 'marimba': return { atk: 0.02, dur: rng.range(0.4, 1.0) };
            case 'metallic': return { atk: 0.04, dur: rng.range(1.4, 3.6) };
            case 'strings': return { atk: rng.range(0.8, 2.0), dur: rng.range(3.0, 6.5) };
            case 'subpad': return { atk: rng.range(1.2, 2.5), dur: rng.range(3.5, 6.5) };
            case 'theremin': return { atk: rng.range(0.12, 0.45), dur: rng.range(1.4, 3.5) };
            case 'vowel_morph': return { atk: rng.range(0.5, 1.5), dur: rng.range(2.0, 4.5) };
            default: return { atk, dur };
        }
    }

    _shapeMelodyEnvelope(wType, atk, dur, planet) {
        const perf = this._getPerformanceProfile(planet);
        const requestedSpan = Math.max(0.12, (atk || 0) + (dur || 0));
        let maxSpan = (perf.stepSeconds * (12 + (1 - perf.density) * 14)) * (1.05 - perf.pressure * 0.2);
        const cost = MELODY_VOICE_COSTS[wType] || 0;

        if (cost > 0.75) maxSpan *= 0.72;
        else if (cost > 0.45) maxSpan *= 0.86;

        if (['pulse', 'pluck', 'wood', 'marimba'].includes(wType)) maxSpan *= 0.8;
        if (['theremin', 'vowel_morph', 'choir'].includes(wType)) maxSpan *= 1.08;

        maxSpan = this._clamp(maxSpan, 0.65, 8.5);
        if (requestedSpan <= maxSpan) return { atk, dur };

        const attackRatio = this._clamp((atk || 0) / requestedSpan, 0.08, 0.6);
        const nextAtk = this._clamp(maxSpan * attackRatio, 0.015, Math.max(0.08, maxSpan * 0.55));
        const nextDur = Math.max(0.12, maxSpan - nextAtk);
        return { atk: nextAtk, dur: nextDur };
    }

    _getMoonWavePool(planet) {
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

    _buildMoonProfile(planet) {
        const moonCount = this._clamp(Math.round(planet?.numMoons || 0), 0, 4);
        if (!moonCount) return [];

        const rng = new RNG((planet?.seed || 0) + 205000);
        const waves = this._getMoonWavePool(planet);
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
                gain: this._clamp(0.11 - i * 0.022, 0.05, 0.11),
                chance: this._clamp(0.64 - i * 0.16, 0.22, 0.68),
                pan: (panPositions[i] ?? 0) + rng.range(-0.08, 0.08),
                detuneCents: rng.range(-9, 9),
                filterMul: 2.3 + i * 0.55 + rng.range(-0.2, 0.25),
                wave: rng.pick(waves),
            });
        }

        return profiles;
    }

    _shiftScaleStep(planet, baseStep, degreeShift = 0, octaveOffset = 0) {
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
    _scheduleMoonCanons(planet, dest, step, meta = {}) {
        if (!this.ctx || !this.playing || !Number.isFinite(step)) return;
        const moons = this._moonProfile || [];
        if (!moons.length) return;

        const perf = meta.perf || this._getPerformanceProfile(planet);
        if (perf.pressure > 0.78) return;

        const transport = this.transport || this._buildTransport(planet);
        const rng = new RNG((planet?.seed || 0) + 111000 + (this.stepNote * 37) + ((meta.phrasePos || 0) * 17));
        const modeBias = meta.mode === 'MOTIF' ? 0.16 : meta.mode === 'RESPONSE' ? 0.1 : 0;
        const phraseBias = meta.isPhraseEnd ? 0.12 : meta.isResponse ? 0.06 : 0;
        const baseChance = this._clamp(
            (0.05 + moons.length * 0.07 + modeBias + phraseBias + (this.tension || 0) * 0.08) * (0.68 + perf.scalar * 0.32),
            0.06,
            0.64
        );
        if (rng.range(0, 1) >= baseChance) return;

        const ctx = this.ctx;
        const moonDest = this._moonBus || dest;
        if (!moonDest) return;
        const nyquist = ctx.sampleRate / 2;
        let scheduledCount = 0;
        let firstDelaySeconds = Infinity;

        moons.forEach((moon, idx) => {
            if (rng.range(0, 1) > moon.chance * (0.65 + perf.scalar * 0.35)) return;

            const shiftedStep = this._shiftScaleStep(planet, step, moon.degreeShift, moon.octaveOffset);
            let freq = this._getStepFrequency(planet, shiftedStep, 1);
            if (!Number.isFinite(freq)) return;

            freq *= Math.pow(2, moon.detuneCents / 1200);
            freq = this._clamp(freq, 60, nyquist - 240);

            const start = ctx.currentTime + moon.delaySteps * transport.stepSeconds;
            const dur = this._clamp(
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

            osc.type = this._resolveOscType(moon.wave, 'sine');
            osc.frequency.setValueAtTime(Math.min(nyquist - 240, freq * (1.02 + idx * 0.015)), start);
            osc.frequency.exponentialRampToValueAtTime(freq, start + Math.min(0.18, dur * 0.32));

            filt.type = 'bandpass';
            filt.frequency.value = this._clamp(freq * moon.filterMul, 280, Math.min(nyquist - 200, 6800 + idx * 650));
            filt.Q.value = 0.85 + idx * 0.25;

            pan.pan.value = this._clamp(moon.pan, -0.95, 0.95);

            env.gain.setValueAtTime(0, start);
            env.gain.linearRampToValueAtTime(peak, start + Math.min(0.04, dur * 0.22));
            env.gain.exponentialRampToValueAtTime(0.001, start + dur);

            osc.connect(filt);
            filt.connect(env);
            env.connect(pan);
            pan.connect(moonDest);
            osc.start(start);
            osc.stop(start + dur + 0.05);
            this.nodes.pushTransient(moon.delaySteps * transport.stepSeconds + dur + 0.2, osc, filt, env, pan);
        });

        if (scheduledCount > 0 && Number.isFinite(firstDelaySeconds)) {
            this._setManagedTimeout(() => {
                if (!this.playing) return;
                this._moonProcCount += scheduledCount;
                this._moonLastBurst = scheduledCount;
                this._lastMoonProcAt = this.ctx?.currentTime || 0;
            }, firstDelaySeconds * 1000);
        }
    }

    _applyBiomeMelodyGesture(planet, wType, mode, phrasePos, isPhraseEnd, atk, dur) {
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

    _markMelodyVoiceUsage(wType, planet) {
        if (!this.ctx || !MELODY_VOICE_COOLDOWNS[wType]) return;
        const perf = this._getPerformanceProfile(planet);
        this._voiceCooldowns[wType] = this.ctx.currentTime + (MELODY_VOICE_COOLDOWNS[wType] * (0.8 + perf.pressure * 0.9));
    }

    _normalizeChordSymbol(symbol) {
        return `${symbol || 'I'}`.replace(/Â/g, '').trim() || 'I';
    }

    _getChordFunctionKey(symbol) {
        return this._normalizeChordSymbol(symbol).replace(/[^ivIV]/g, '') || 'I';
    }

    _getChordDegreeIndex(symbol, scaleLength) {
        const roman = this._getChordFunctionKey(symbol).toUpperCase();
        const degreeOrder = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];
        const rawIndex = Math.max(0, degreeOrder.indexOf(roman));
        if (!scaleLength || scaleLength >= degreeOrder.length) return rawIndex;
        return Math.min(rawIndex, scaleLength - 1);
    }

    _buildScaleChord(symbol, planet) {
        const normalized = this._normalizeChordSymbol(symbol);
        const scale = Array.isArray(planet?.scale) && planet.scale.length ? planet.scale : null;
        if (!scale || scale.length < 3) return CHORD_TEMPLATES[normalized] || [0, 4, 7];

        const rootIndex = this._getChordDegreeIndex(normalized, scale.length);
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

    _osc(type, freq, gain, dest) {
        const o = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        o.type = this._resolveOscType(type); o.frequency.value = freq; g.gain.value = gain;
        o.connect(g); g.connect(dest); o.start();
        this.nodes.push(o, g);
        return { osc: o, gain: g };
    }

    _lfo(rate, depth, param, type = 'sine') {
        const l = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        l.type = type; l.frequency.value = rate;
        g.gain.value = 0; // Start at 0
        g.gain.setValueAtTime(0, this.ctx.currentTime);
        g.gain.linearRampToValueAtTime(depth, this.ctx.currentTime + 0.5); // Fade in lfo depth
        l.connect(g); g.connect(param); l.start();
        this.nodes.push(l, g);
        return g; // Return gain node for live depth control
    }

    // _lfoOnce: LFO that runs for `dur` seconds then stops (for pitch bend, envelope-tied vibrato)
    _lfoOnce(ctx, rate, depth, param, startTime, dur) {
        const l = ctx.createOscillator();
        const g = ctx.createGain();
        l.type = 'sine'; l.frequency.value = rate; g.gain.value = 0;
        // Fade in the vibrato after atk, fade out before note ends
        g.gain.setValueAtTime(0, startTime);
        g.gain.linearRampToValueAtTime(depth, startTime + dur * 0.3);
        g.gain.linearRampToValueAtTime(0, startTime + dur * 0.9);
        l.connect(g); g.connect(param);
        l.start(startTime); l.stop(startTime + dur + 0.1);
        this.nodes.push(l, g);
    }

    _scheduleNote(planet, dest, ac, scheduledTime = null) {
        const ctx = this.ctx;
        // Tier 4: Strict Determinism & Scaled Generation
        // A unique RNG seed composed of the planet seed + the total number of notes fired
        const rng = new RNG(planet.seed + 1000 + this.stepNote++);
        const biomeId = planet?.biome?.id;

        // Motif / Phrase logic
        let step = null;
        const phrasePos = this.stepNote % 8; // 8-step micro-phrases
        const isResponse = (this.stepNote % 16) >= 8;
        const isPhraseEnd = phrasePos === 7;
        const motifChance = biomeId === 'fungal' ? (isResponse ? 0.62 : 0.26) : (isResponse ? 0.4 : 0.15);
        const responseChance = biomeId === 'fungal' ? (isResponse ? 0.46 : 0.08) : (isResponse ? 0.35 : 0.05);

        // 1. Motif Recall (Bank-based)
        // High chance of motif during response, or some chance anytime
        if (this._motifEnabled && planet.motifBank?.length > 0 && rng.range(0, 1) < motifChance) {
            this._melodyMode = 'MOTIF';
            const bank = planet.motifBank[this._activeMotifIdx];
            step = bank[phrasePos % bank.length];
        }
        // 2. Call & Response: History recall
        else if (this._melodyHistory.length >= 4 && rng.range(0, 1) < responseChance) {
            this._melodyMode = 'RESPONSE';
            const variation = biomeId === 'fungal' ? rng.int(-1, 1) : rng.int(-1, 2);
            const hIdx = this.stepNote % 4;
            step = this._melodyHistory[this._melodyHistory.length - 4 + hIdx] + variation;
        }
        // 3. Generative structure (Scale weights)
        else {
            const WEIGHTS = { 0: 4, 7: 3, 12: 4, 4: 2, 3: 2, 9: 2, 5: 2, 2: 1, 10: 1, 11: 0.4, 1: 0.3, 6: 0.2 };
            const sc = planet.scale;
            const pool = [];
            sc.forEach(s => {
                const norm = ((s % 12) + 12) % 12;
                const isRestNote = norm === 0 || norm === 7;

                let structBias = 1;
                if (isResponse || isPhraseEnd) {
                    structBias *= isRestNote ? 4 : 0.5; // Resolve
                } else {
                    structBias *= !isRestNote ? 2 : 1;  // Tension
                }

                const tensionBias = (this.tension || 0) > 0.6 && (norm === 6 || norm === 1) ? 2.5 : 1;
                const isChordTone = this._currentChordIntervals.some(ci => ci % 12 === norm);
                let chordBias = isChordTone ? 4 : 1;
                let motionBias = 1;
                let fungalBias = 1;

                const chordAudibility = ac && ac.chordAudibility !== undefined ? ac.chordAudibility : 0.5;
                if (!isChordTone) chordBias *= (1 - chordAudibility * 0.8);
                if (this.lastStep !== undefined && biomeId === 'fungal') {
                    const diff = Math.abs(s - this.lastStep);
                    if (diff <= 2) motionBias *= 2.8;
                    else if (diff <= 5) motionBias *= 1.85;
                    else if (diff >= 9) motionBias *= 0.42;
                }
                if (biomeId === 'fungal') {
                    const degreeIndex = sc.indexOf(s);
                    if (degreeIndex >= 0) {
                        fungalBias *= 1.02 + ((degreeIndex / Math.max(1, sc.length - 1)) * 0.55);
                    }
                    if (!isResponse && !isPhraseEnd && norm === 0) fungalBias *= 0.72;
                    if (isPhraseEnd && (norm === 3 || norm === 4 || norm === 9)) fungalBias *= 1.3;
                }

                const w = (WEIGHTS[norm] || 0.5) * tensionBias * chordBias * structBias * motionBias * fungalBias;
                for (let i = 0; i < Math.max(1, Math.round(w * 2)); i++) pool.push(s);
            });

            if (this.lastStep !== undefined) {
                sc.forEach(s => {
                    const diff = Math.abs(s - this.lastStep);
                    if (diff > 0 && diff <= 5) pool.push(s, s); // Leading tone / step-wise motion
                });
            }
            step = pool.length > 0 ? rng.pick(pool) : sc[0];
            this._melodyMode = 'GENERATIVE';
        }

        this._melodyHistory.push(step);
        if (this._melodyHistory.length > 16) this._melodyHistory.shift();

        if (step === null || isNaN(step)) return; // Note rests here

        this.lastStep = step;
        this._lastMelodyStep = step;

        const oct = ac ? rng.pick(ac.melodyOcts) : rng.pick([2, 3, 4]);

        // Tier 4: Microtonal / Just Intonation / Pythagorean override
        let freq = this._getStepFrequency(planet, step, oct);
        // Quarter-tone micro-detuning: probabilistic ±50 cents offset
        if ((planet.quarterToneProb || 0) > 0 && rng.next() < planet.quarterToneProb) {
            const centsOff = rng.range(-50, 50);
            freq *= Math.pow(2, centsOff / 1200);
        }
        // Clamp to audible range and stay safely below Nyquist (sampleRate / 2)
        const nyquist = ctx.sampleRate / 2;
        freq = Math.max(20, Math.min(freq || 440, nyquist - 200));

        const osc = ctx.createOscillator();
        const env = ctx.createGain();
        const wType = this._pickMelodyWave(planet, ac, rng);
        const perf = this._getPerformanceProfile(planet);

        let atk = rng.range(0.8, 4.5);
        let dur = rng.range(3.5, 15);

        // Custom PeriodicWave voices — each has hand-crafted harmonic content
        if (wType === 'bell') {
            const real = new Float32Array([0, 1, 0, 0, 0.2, 0, 0, 0.05, 0, 0, 0, 0, 0, 0.01]);
            const imag = new Float32Array(14);
            osc.setPeriodicWave(ctx.createPeriodicWave(real, imag));
            atk = 0.05; dur = rng.range(6, 15);
        } else if (wType === 'wood') {
            const real = new Float32Array([0, 0, 1, 0.5, 0, 0.2, 0, 0.1]);
            const imag = new Float32Array([0, 0.8, 0, 0, 0, 0, 0, 0]);
            osc.setPeriodicWave(ctx.createPeriodicWave(real, imag));
            atk = 0.03; dur = rng.range(0.5, 1.5);
        } else if (wType === 'glass') {
            // Shimmery inharmonic partials (Pyrex glass bowl)
            const real = new Float32Array([0, 1, 0, 0.5, 0, 0, 0.12, 0, 0, 0.04, 0, 0, 0, 0, 0.02]);
            const imag = new Float32Array([0, 0, 0.3, 0, 0.15, 0, 0, 0.06, 0, 0, 0.02, 0, 0, 0, 0]);
            osc.setPeriodicWave(ctx.createPeriodicWave(real, imag));
            atk = 0.02; dur = rng.range(4, 12);
        } else if (wType === 'brass') {
            // Rich odd harmonics + strong fundamental (like a muted trumpet)
            const real = new Float32Array([0, 1, 0.05, 0.55, 0.04, 0.35, 0.03, 0.22, 0.02, 0.12, 0.01, 0.06]);
            const imag = new Float32Array(12);
            osc.setPeriodicWave(ctx.createPeriodicWave(real, imag));
            atk = rng.range(0.08, 0.4); dur = rng.range(1.5, 5);
        } else if (wType === 'organ') {
            // Chapel organ: 8' + 4' + 2 2/3' + 2' drawbars
            const real = new Float32Array([0, 1, 0.8, 0.5, 0, 0.3, 0, 0.2, 0.1]);
            const imag = new Float32Array(9);
            osc.setPeriodicWave(ctx.createPeriodicWave(real, imag));
            atk = 0.015; dur = rng.range(2, 8);
        } else if (wType === 'pluck') {
            // Karplus-Strong-ish: bright attack, fast exponential decay
            const real = new Float32Array([0, 1, 0.45, 0.25, 0.15, 0.08, 0.04, 0.02]);
            const imag = new Float32Array([0, 0, 0.2, 0.1, 0.05, 0, 0, 0]);
            osc.setPeriodicWave(ctx.createPeriodicWave(real, imag));
            atk = 0.008; dur = rng.range(0.4, 2.5);
        } else if (wType === 'pulse') {
            const real = new Float32Array(16);
            const imag = new Float32Array(16);
            for (let h = 1; h < 16; h++) {
                real[h] = Math.sin(0.1 * Math.PI * h) / (Math.PI * h * 0.1);
            }
            osc.setPeriodicWave(ctx.createPeriodicWave(real, imag));
            atk = rng.range(0.2, 1.5); dur = rng.range(2, 10);
        } else if (wType === 'reed') {
            // Oboe/Bassoon-like: Strong odd harmonics but with a warm fundamental
            const real = new Float32Array([0, 1, 0, 0.8, 0.1, 0.5, 0.05, 0.3, 0.02, 0.15, 0.01, 0.08]);
            const imag = new Float32Array(12);
            osc.setPeriodicWave(ctx.createPeriodicWave(real, imag));
            atk = rng.range(0.04, 0.15); dur = rng.range(1.5, 4);
        } else if (wType === 'electric_piano') {
            // Tine-like spectrum: High-frequency attack partials, strong fundamental
            const real = new Float32Array([0, 1, 0.1, 0, 0, 0.4, 0, 0, 0, 0.2, 0, 0, 0, 0, 0.05]);
            const imag = new Float32Array(15);
            osc.setPeriodicWave(ctx.createPeriodicWave(real, imag));
            atk = Math.max(0.01, rng.range(0.01, 0.03)); dur = rng.range(1.5, 6);
        } else if (wType === 'saw_sync') {
            // Hard sync simulation: many high partials
            const real = new Float32Array(32);
            const imag = new Float32Array(32);
            for (let h = 1; h < 32; h++) {
                real[h] = 1 / h;
                // Add resonant peaks simulating a swept sync oscillator
                if (h > 8 && h < 14) real[h] *= 2.5;
            }
            osc.setPeriodicWave(ctx.createPeriodicWave(real, imag));
            atk = rng.range(0.05, 0.2); dur = rng.range(1, 4);
        } else if (ADDITIVE_VOICE_NAMES.includes(wType)) {
            ({ atk, dur } = this._getAdditiveVoiceEnvelope(wType, rng, atk, dur));
            ({ atk, dur } = this._applyBiomeMelodyGesture(planet, wType, this._melodyMode, phrasePos, isPhraseEnd, atk, dur));
            ({ atk, dur } = this._shapeMelodyEnvelope(wType, atk, dur, planet));
            this._markMelodyVoiceUsage(wType, planet);
            // ── Additive synthesis voice (self-contained, returns early)
            // Build a panner for spatial placement, same as normal notes
            const panner = ctx.createPanner();
            panner.panningModel = 'HRTF';
            panner.distanceModel = 'inverse';
            panner.refDistance = 1;
            panner.maxDistance = 40;
            panner.rolloffFactor = 0.8;
            const az = rng.range(-0.5, 0.5) * Math.PI * 1.8;
            const el = rng.range(-0.5, 0.5) * Math.PI * 0.5;
            const d = 2.5 + rng.range(0, 3);
            const sx = Math.cos(el) * Math.sin(az) * d;
            const sy = Math.sin(el) * d + 1.6;
            const sz = Math.cos(el) * Math.cos(az) * d;
            if (panner.positionX) {
                panner.positionX.value = sx; panner.positionY.value = sy; panner.positionZ.value = sz;
            } else if (panner.setPosition) { panner.setPosition(sx, sy, sz); }
            panner.connect(dest);
            this.nodes.pushTransient(this._getAdditiveVoiceLifetime(wType, atk, dur), panner);
            buildVoice(wType, ctx, freq, panner, rng, atk, dur, this.nodes);
            this._scheduleMoonCanons(planet, dest, step, {
                perf,
                mode: this._melodyMode,
                phrasePos,
                isPhraseEnd,
                isResponse,
            });
            return; // voices.js handles full envelope - no further processing needed
        } else {
            osc.type = this._resolveOscType(wType);
        }


        ({ atk, dur } = this._applyBiomeMelodyGesture(planet, wType, this._melodyMode, phrasePos, isPhraseEnd, atk, dur));
        ({ atk, dur } = this._shapeMelodyEnvelope(wType, atk, dur, planet));
        this._markMelodyVoiceUsage(wType, planet);

        osc.frequency.value = freq;
        const now = Number.isFinite(scheduledTime) ? Math.max(ctx.currentTime, scheduledTime) : ctx.currentTime;
        env.gain.setValueAtTime(0, now);

        const isDecayVoice = ['bell', 'wood', 'glass', 'pluck', 'brass', 'organ'].includes(wType);
        if (isDecayVoice) {
            // Exponential decay for all struck/plucked instruments
            env.gain.linearRampToValueAtTime(0.25 + rng.range(0, 0.1), now + atk);
            env.gain.exponentialRampToValueAtTime(0.001, now + atk + dur);
        } else {
            // Swelling envelope for oscillator waves (sine, square, etc.)
            env.gain.linearRampToValueAtTime(0.18 + rng.range(0, 0.08), now + atk);
            env.gain.linearRampToValueAtTime(0, now + atk + dur);
        }

        // Tier 3: HRTF spatial panner
        const panner = ctx.createPanner();
        panner.panningModel = 'HRTF';
        panner.distanceModel = 'inverse';
        panner.refDistance = 1;
        panner.maxDistance = 40;
        panner.rolloffFactor = 0.8;
        // Seeded 3D position
        const azimuth = rng.range(-0.5, 0.5) * Math.PI * 1.8;
        const elevation = rng.range(-0.5, 0.5) * Math.PI * 0.5;
        const dist = 2.5 + rng.range(0, 3);
        const sx = Math.cos(elevation) * Math.sin(azimuth) * dist;
        const sy = Math.sin(elevation) * dist + 1.6;
        const sz = Math.cos(elevation) * Math.cos(azimuth) * dist;
        if (panner.positionX) {
            panner.positionX.value = sx; panner.positionY.value = sy; panner.positionZ.value = sz;
        } else if (panner.setPosition) {
            panner.setPosition(sx, sy, sz);
        }
        osc.connect(env); env.connect(panner); panner.connect(dest);
        osc.start(now); osc.stop(now + atk + dur + 0.1);
        this.nodes.push(osc, env, panner);
        // Auto-cleanup when note ends to prevent node accumulation
        osc.onended = () => { try { osc.disconnect(); env.disconnect(); panner.disconnect(); } catch (e) { } };

        // ── Pitch bend vibrato (gated by flag)
        const bendScale = biomeId === 'fungal' ? 0.55 : 1;
        const bendCents = (this._pitchBendEnabled && ac && ac.pitchBend) ? ac.pitchBend * bendScale : 0;
        if (bendCents > 0) {
            const bendHz = freq * (Math.pow(2, bendCents / 1200) - 1);
            this._lfoOnce(ctx, rng.range(3, 9), bendHz * rng.range(0.3, 1), osc.frequency, now, atk + dur);
        }

        // ── Chord layer (gated by flag)
        this._scheduleMoonCanons(planet, dest, step, {
            perf,
            mode: this._melodyMode,
            phrasePos,
            isPhraseEnd,
            isResponse,
        });

        const chordLoadScale = perf.activeNodes > 280 ? 0.3 : (0.55 + perf.scalar * 0.45);
        const chordProb = ((this._chordEnabled && ac && ac.chordProb) ? ac.chordProb : 0) * chordLoadScale;
        if (chordProb > 0 && rng.next() < chordProb && planet.scale.length >= 3) {
            const intervals = [3, 4, 5, 7, 8, 9]; // thirds, fourth, fifths, sixths
            const numNotes = rng.bool(0.4) ? 2 : 1;
            for (let i = 0; i < numNotes; i++) {
                const iv = rng.pick(intervals);
                const chordFreq = freq * Math.pow(2, iv / 12);
                const co = ctx.createOscillator(), ce = ctx.createGain();
                const wType2 = ac ? rng.pick(ac.melodyWaves) : 'sine';
                // Re-use same waveform type as the main note (simplified)
                const validNative = ['sine', 'square', 'sawtooth', 'triangle'];
                if (validNative.includes(wType2)) {
                    co.type = wType2;
                } else { co.type = validNative[rng.int(0, 4)]; }
                co.frequency.value = chordFreq;
                ce.gain.setValueAtTime(0, now);
                ce.gain.linearRampToValueAtTime(0.08 + rng.range(0, 0.05), now + atk * 1.2);
                ce.gain.linearRampToValueAtTime(0, now + atk + dur * 0.8);
                const cp = ctx.createStereoPanner();
                cp.pan.value = rng.range(-0.5, 0.5);
                co.connect(ce); ce.connect(cp); cp.connect(dest);
                co.start(now); co.stop(now + atk + dur + 0.15);
                this.nodes.push(co, ce, cp);
            }
        }

        // ── Arp run (gated by flag)
        const arpLoadScale = perf.activeNodes > 250 ? 0.15 : perf.scalar;
        const arpProb = ((this._arpEnabled && ac && ac.arpProb) ? ac.arpProb : 0) * arpLoadScale;
        if (arpProb > 0 && rng.next() < arpProb && planet.scale.length >= 4) {
            const sc = planet.scale;
            const arpSpan = perf.pressure > 0.6 ? 2 : (perf.pressure > 0.35 ? 3 : 4);
            const startIdx = rng.int(0, Math.max(1, sc.length - arpSpan));
            const arpNotes = sc.slice(startIdx, startIdx + arpSpan);
            const arpSpeed = rng.range(0.08, 0.22); // seconds between notes
            arpNotes.forEach((s, i) => {
                const arpFreq = this._getStepFrequency(planet, s, oct || 1);
                const ao = ctx.createOscillator(), ae = ctx.createGain();
                const nw = ac ? ac.melodyWaves.find(w => NATIVE_OSC_TYPES.has(w)) : 'sine';
                ao.type = this._resolveOscType(nw, 'sine');
                ao.frequency.value = arpFreq;
                const t0 = now + i * arpSpeed;
                ae.gain.setValueAtTime(0, t0);
                ae.gain.linearRampToValueAtTime(0.12, t0 + 0.02);
                ae.gain.exponentialRampToValueAtTime(0.001, t0 + 0.18);
                ao.connect(ae); ae.connect(dest);
                ao.start(t0); ao.stop(t0 + 0.22);
                this.nodes.push(ao, ae);
            });
        }
    }

    start(planet) {
        this._boot();
        this.stop();
        this.planet = planet;
        this._strictRngs = Object.create(null);
        this._voiceCooldowns = Object.create(null);
        this._resetSteps();
        const ctx = this.ctx, p = planet, ac = p.ac;
        const transport = this._buildTransport(p);
        this.transport = transport;
        this._startTransportScheduler();

        // Effect chain -> routes into EQ -> MasterGain
        const conv = this._buildReverb(p.reverbDecay, p.seed);
        const wet = ctx.createGain(); wet.gain.value = this._reverb;
        const dry = ctx.createGain(); dry.gain.value = 1 - this._reverb * 0.5;
        this.reverbGain = wet; this.dryGain = dry;
        conv.connect(wet); wet.connect(this.eqLow);
        dry.connect(this.eqLow);
        this.nodes.push(conv, wet, dry);

        // Delay — feedback & time vary per biome.
        // IMPORTANT: clamp feedback gain to 0.75 to prevent runaway infinite echo.
        const del = ctx.createDelay(5);
        const safeFb = Math.min(ac.delayFb, 0.75); // hard ceiling prevents feedback explosion
        const fb = ctx.createGain(); fb.gain.value = safeFb;
        const dlf = ctx.createBiquadFilter(); dlf.type = 'lowpass'; dlf.frequency.value = ac.filterBase * 0.8;
        del.delayTime.value = 0.25 + (p.seed % 120) / 300;
        del.connect(fb); fb.connect(dlf); dlf.connect(del); // feedback loop (safe)
        // Delay sends to reverb at reduced gain (-10dB) to avoid compounding feedback
        const delSend = ctx.createGain(); delSend.gain.value = 0.32;
        del.connect(delSend); delSend.connect(conv);
        this.nodes.push(del, fb, dlf, delSend);

        // Master filter — controlled by biome base freq
        const filt = ctx.createBiquadFilter();
        filt.type = 'lowpass'; filt.frequency.value = p.filterFreq; filt.Q.value = 1.2;
        this.nodes.push(filt);

        // ── NEW EFFECTS CHAIN (Tier 2) ──────────────────────────
        let effectNode = filt;

        // Bitcrusher for Corrupted/Storm biomes
        if (['corrupted', 'storm'].includes(p.biome.id)) {
            const bc = this._buildBitcrusher(4, 0.5); // bit depth, norm frequency
            effectNode.connect(bc);
            effectNode = bc;
            this.nodes.push(bc);
        }

        // Phaser for Psychedelic/Nebula biomes
        if (['psychedelic', 'nebula'].includes(p.biome.id)) {
            const ph = this._buildPhaser();
            effectNode.connect(ph.input);
            effectNode = ph.output;
            this.nodes.push(...ph.nodes);
        }

        // Final chain to destinations
        effectNode.connect(conv);
        effectNode.connect(del);
        effectNode.connect(dry);

        this.tensionLfos = [];
        const fLfo = this._lfo(p.lfoRate * 0.12, p.filterFreq * 0.20, filt.frequency);
        if (fLfo) this.tensionLfos.push(fLfo);

        // ── Harmony & Phrasing Initialization ──
        this._progression = p.progression;
        this._chordIndex = 0;
        // _updateChord() will be called once at the end of start() to kick off the recursive loop
        this._phraseLength = 0;
        this._restProb = 0.05;
        this.lastStep = undefined;
        this._lastMelodyStep = null;
        this._melodyHistory = [];
        this._activeMotifIdx = 0;
        this._motifSwapCounter = 0;

        // Drone — Tier 4: Custom Wavetable base + dynamic FM
        const base = p.rootFreq;
        this.harmonicNodes = { pads: [] };

        // Custom Seeded PeriodicWave for drone fundamental
        const wRng = new RNG(p.seed);
        const real = new Float32Array(16), imag = new Float32Array(16);
        real[0] = 0; imag[0] = 0;
        for (let i = 1; i < 16; i++) {
            real[i] = wRng.range(0, 1) / i; imag[i] = wRng.range(0, 1) / i;
        }
        const wave = ctx.createPeriodicWave(real, imag);
        const baseOsc = ctx.createOscillator(); baseOsc.setPeriodicWave(wave);
        const baseGain = ctx.createGain();
        baseGain.gain.value = 0.4 * (p.ac.chordAudibility !== undefined ? p.ac.chordAudibility : 0.5);
        baseOsc.frequency.value = base * 0.5; // sub octave
        baseOsc.connect(baseGain); baseGain.connect(filt);
        baseOsc.start();
        this.nodes.push(baseOsc, baseGain);
        this.harmonicNodes.baseOsc = baseOsc;
        this._lfo(p.lfoRate * 0.2, base * 0.01, baseOsc.frequency);

        const d1 = this._osc(ac.droneWave, base, 0.045, filt);
        const d2 = this._osc(ac.droneWave, base * 2 + p.droneDetune, 0.025, filt);
        this.harmonicNodes.d1 = d1.osc;
        this.harmonicNodes.d2 = d2.osc;

        // Simple FM synthesis for drone
        const fmMod = ctx.createOscillator(), fmModG = ctx.createGain();
        fmMod.type = 'sine'; fmMod.frequency.value = base * ac.fmRatio;
        this.fmIndexBase = ac.fmIndex * (0.7 + p.lfoRate); // stored for tension morphing
        fmModG.gain.value = this.fmIndexBase;
        this.fmModGainNode = fmModG; // store for tension morphing
        const fmCarrier = ctx.createOscillator(), fmCarrierG = ctx.createGain();
        fmCarrier.type = this._resolveOscType(ac.droneWave); fmCarrier.frequency.value = base;
        fmCarrierG.gain.value = 0.04 * (p.ac.chordAudibility !== undefined ? p.ac.chordAudibility : 0.5);
        fmMod.connect(fmModG); fmModG.connect(fmCarrier.frequency);
        fmCarrier.connect(fmCarrierG); fmCarrierG.connect(filt);
        fmMod.start(); fmCarrier.start();
        this.nodes.push(fmMod, fmModG, fmCarrier, fmCarrierG);
        this.harmonicNodes.fmMod = fmMod;
        this.harmonicNodes.fmCarrier = fmCarrier;

        this._lfo(p.lfoRate * 0.3, base * 0.014, d1.osc.frequency);
        this._lfo(p.lfoRate * 0.55, base * 0.025, d2.osc.frequency, 'triangle');

        // Pad — intro phase: pads fade in from silence over ~15s (was 45s)
        const padBus = ctx.createGain();
        padBus.gain.setValueAtTime(0, ctx.currentTime);
        const padTarget = 1.0 * (p.ac.chordAudibility !== undefined ? p.ac.chordAudibility : 0.5);
        padBus.gain.linearRampToValueAtTime(padTarget, ctx.currentTime + 15);
        padBus.connect(filt);
        this.nodes.push(padBus);
        p.scale.slice(0, 5).forEach((step, i) => {
            const freq = this._getStepFrequency(p, step, ac.octScale);
            const det = (i % 2 === 0 ? 1 : -1) * p.padDetune * 0.012 * freq;
            const pad = this._osc(ac.padWave, freq + det, 0.018, padBus);
            this._lfo(p.lfoRate * (0.09 + i * 0.07), freq * 0.005, pad.osc.frequency);
            this.harmonicNodes.pads.push({ osc: pad.osc, stepIndex: i, detuneRatio: det / freq });
        });
        this.padBus = padBus;

        // Noise texture — biome controls how noisy
        if (p.noiseLevel > 0.01) {
            const blen = ctx.sampleRate * 3;
            const buf = ctx.createBuffer(1, blen, ctx.sampleRate);
            const nd = buf.getChannelData(0);
            for (let i = 0; i < blen; i++) nd[i] = this._random('bed-noise') * 2 - 1;
            const ns = ctx.createBufferSource(); ns.buffer = buf; ns.loop = true;
            const nf = ctx.createBiquadFilter();
            // volcanic: low rumble; crystaline: high shimmer; desert: mid wind
            nf.type = p.biome.id === 'volcanic' ? 'lowpass' : (p.biome.id === 'crystalline' ? 'highpass' : 'bandpass');
            nf.frequency.value = 200 + p.seed % 1200; nf.Q.value = 4;
            const ng = ctx.createGain(); ng.gain.value = p.noiseLevel * 0.18;
            ns.connect(nf); nf.connect(ng); ng.connect(filt);
            ns.start();
            this.nodes.push(ns, nf, ng);
        }

        // Unified Melody Sequencer — phrase/rest/motif logic consolidated
        const melodyBus = ctx.createGain();
        const melodyFilter = ctx.createBiquadFilter();
        const melodyFilterFreq = Math.max(180, Math.min(ac.melFiltFreq || p.filterFreq || 2400, ctx.sampleRate / 2 - 200));
        melodyBus.gain.setValueAtTime(0, ctx.currentTime);
        melodyBus.gain.linearRampToValueAtTime(1, ctx.currentTime + 20);
        melodyFilter.type = 'lowpass';
        melodyFilter.frequency.setValueAtTime(melodyFilterFreq, ctx.currentTime);
        melodyFilter.Q.value = Math.max(0.0001, ac.melFiltQ || 0.7);
        melodyBus.connect(melodyFilter);
        melodyFilter.connect(filt);
        this.nodes.push(melodyBus, melodyFilter);
        this.melodyBus = melodyBus;
        this.melodyFilter = melodyFilter;
        this._moonProfile = this._buildMoonProfile(p);
        if (this._moonProfile.length) {
            const moonBus = ctx.createGain();
            moonBus.gain.setValueAtTime(0, ctx.currentTime);
            moonBus.gain.linearRampToValueAtTime(this._clamp(0.16 + this._moonProfile.length * 0.06, 0.18, 0.36), ctx.currentTime + 12);
            moonBus.connect(melodyFilter);
            this.nodes.push(moonBus);
            this._moonBus = moonBus;
        } else {
            this._moonBus = null;
        }
        this.playing = true;
        this._startStateStream();
        this._emitState();

        const baseMelodyStride = this._getMelodyStride(p, transport.cycleSteps);
        let melodyTransportStep = 0;
        const runMelodyStep = (scheduleTime = null) => {
            const seqRng = new RNG(p.seed + 10000 + melodyTransportStep);
            const tension = this.tension || 0;
            const cycleStep = melodyTransportStep % transport.cycleSteps;
            const isResponse = cycleStep >= Math.ceil(transport.cycleSteps / 2);
            const isPhraseEnd = cycleStep === transport.cycleSteps - 1;

            // 2. Motif Swapping (Variety)
            if (cycleStep === 0) {
                this._motifSwapCounter++;
                if (this._motifSwapCounter >= 2) {
                    this._motifSwapCounter = 0;
                    this._activeMotifIdx = (this._activeMotifIdx + 1) % (p.motifBank?.length || 1);
                }
            }

            // 3. Step-quantized melody gate: tension can tighten the stride,
            // drift can nudge it by whole grid steps without leaving the transport.
            let melodyStride = baseMelodyStride;
            if (tension > 0.72 && melodyStride > 1) melodyStride -= 1;
            if (this._drift > 0.15 && seqRng.range(0, 1) < this._drift * 0.22) {
                melodyStride += seqRng.bool(0.6) ? 1 : -1;
            }
            melodyStride = this._clamp(melodyStride, 1, transport.cycleSteps);
            const shouldAttempt = cycleStep === 0 || (cycleStep % melodyStride) === 0;

            // 4. Rest logic now tracks a biome-aware target instead of runaway fatigue swings.
            if (shouldAttempt) {
                const targetRest = this._getTargetRestProbability(p, {
                    cycleStep,
                    cycleSteps: transport.cycleSteps,
                    isResponse,
                    isPhraseEnd,
                    tension,
                });
                this._restProb += (targetRest - this._restProb) * 0.28;
                this._restProb = this._clamp(this._restProb, 0.08, 0.92);

                if (seqRng.range(0, 1) >= this._restProb) {
                    this._scheduleNote(p, melodyBus, ac, scheduleTime);
                    this._phraseLength++;
                } else {
                    this._phraseLength = 0;
                    this.stepNote++;
                }
            }

            if (!shouldAttempt && isPhraseEnd) {
                this._restProb = this._clamp(this._restProb + 0.04, 0.08, 0.92);
            }

            melodyTransportStep++;
        };

        const melodyScheduled = this._scheduleRecurringChannel(
            'melody',
            transport.stepSeconds,
            ({ scheduleTime }) => {
                if (!this.playing) return;
                runMelodyStep(scheduleTime);
            }
        );

        if (!melodyScheduled) {
            const scheduleLoop = () => {
                if (!this.playing) return;
                runMelodyStep();
                this._setManagedTimeout(scheduleLoop, transport.stepMs);
            };
            scheduleLoop();
        }

        const startMacroFxLoop = (name, intervalMs, callback) => {
            const scheduled = this._scheduleRecurringChannel(
                name,
                intervalMs / 1000,
                () => {
                    if (!this.playing) return;
                    callback();
                }
            );
            if (!scheduled) {
                this.intervals.push(setInterval(() => {
                    if (!this.playing) return;
                    callback();
                }, intervalMs));
            }
        };

        // Biome-specific periodic effects
        if (p.biome.id === 'corrupted') {
            startMacroFxLoop('macroFx', 700, () => {
                const rng = new RNG(p.seed + 20000 + this.stepFX++);
                if (rng.range(0, 1) < 0.2) {
                    const orig = filt.frequency.value;
                    const nyquist = ctx.sampleRate / 2;
                    filt.frequency.setValueAtTime(Math.min(orig * (0.2 + rng.range(0, 3)), nyquist), ctx.currentTime);
                    filt.frequency.setValueAtTime(Math.min(orig, nyquist), ctx.currentTime + 0.04 + rng.range(0, 0.12));
                }
            });
        }
        if (p.biome.id === 'organic') {
            // Pulsing life-like tremolo
            this._lfo(p.lfoRate * 2.5, 0.25, wet.gain);
        }
        if (p.biome.id === 'barren') {
            // Very occasional lone ping
            startMacroFxLoop('macroFx-barren', 4000, () => {
                const rng = new RNG(p.seed + 30000 + this.stepFX++);
                if (rng.range(0, 1) < 0.08) this._scheduleNote(p, filt, ac);
            });
        }
        if (p.biome.id === 'storm') {
            // Random chaotic filter bursts — electrical chaos
            startMacroFxLoop('macroFx-storm', 300, () => {
                const rng = new RNG(p.seed + 60000 + this.stepFX++);
                if (rng.range(0, 1) < 0.35) {
                    const orig = filt.frequency.value;
                    const nyquist = ctx.sampleRate / 2;
                    const spike = Math.min(orig * rng.range(0.1, 8), nyquist);
                    filt.frequency.setValueAtTime(spike, ctx.currentTime);
                    filt.frequency.exponentialRampToValueAtTime(Math.min(orig, nyquist), ctx.currentTime + rng.range(0.02, 0.18));
                }
            });
        }
        if (p.biome.id === 'nebula') {
            // Push extra wet reverb for the immense nebular space
            wet.gain.linearRampToValueAtTime(Math.min(this._reverb * 1.4, 1), ctx.currentTime + 8);
            // Slowly evolve formant movement via LFO on filter
            this._lfo(0.018, p.filterFreq * 0.3, filt.frequency, 'sine');
        }

        // FM layer moved to Tier 4 custom wavetable block above.

        // ── TIER 2: PERCUSSION SEQUENCER ──────────────────────────
        this._startPercussion(p, filt);

        // ── Tier 2: Bass Line Generator ───────────────────────────
        this._startBass(p, filt);

        // ── Tier 1: Granular cloud ─────────────────────────────────
        this._startGranular(p, filt);

        // ── Tier 1: Chorus / stereo widening ──────────────────────
        this._addChorus(filt, this.masterGain, ac);

        // ── Tier 1: Nature Ambiance ───────────────────────────────
        this._startNatureAmbiance(p, filt);

        // ── Tier 2: Harmonic tension arc ──────────────────────────
        this.tension = 0;
        this.tensionFilt = filt;
        this.tensionBase = { filtFreq: p.filterFreq, lfoRate: p.lfoRate };
        this._startTensionArc(p, filt);

        // Immediately apply initial chord frequencies to the bed
        this._updateChord();
    }

    _syncChordBed() {
        this._chordName = this._normalizeChordSymbol(this._progression[this._chordIndex]);
        this._currentChordIntervals = this._buildScaleChord(this._chordName, this.planet);

        if (!this.harmonicNodes || !this.planet || !this.ctx) return;

        const now = this.ctx.currentTime;
        const rootOffset = this._currentChordIntervals[0];
        const newRootFreq = this._getStepFrequency(this.planet, rootOffset, 1);
        const glide = 2.0; // Slow, smooth chord transitions

        if (this.harmonicNodes.baseOsc) {
            this.harmonicNodes.baseOsc.frequency.linearRampToValueAtTime(newRootFreq * 0.5, now + glide);
            this.harmonicNodes.d1.frequency.linearRampToValueAtTime(newRootFreq, now + glide);
            this.harmonicNodes.d2.frequency.linearRampToValueAtTime(newRootFreq * 2 + this.planet.droneDetune, now + glide);
            this.harmonicNodes.fmMod.frequency.linearRampToValueAtTime(newRootFreq * this.planet.ac.fmRatio, now + glide);
            this.harmonicNodes.fmCarrier.frequency.linearRampToValueAtTime(newRootFreq, now + glide);
        }

        const chordInts = this._currentChordIntervals;
        this.harmonicNodes.pads.forEach((pData, i) => {
            const cStep = chordInts[i % chordInts.length];
            const octBase = i >= 3 ? 2 : 1;
            const newFreq = this._getStepFrequency(this.planet, cStep, this.planet.ac.octScale * octBase);
            const newFreqWithDetune = newFreq + (newFreq * pData.detuneRatio);
            pData.osc.frequency.linearRampToValueAtTime(newFreqWithDetune, now + glide);
        });
    }

    // ── GRANULAR SYNTHESIS ─────────────────────────────────────────────
    _startGranular(p, dest) {
        if (!this._granularEnabled) return; // user toggle
        const ctx = this.ctx, ac = p.ac, sr = ctx.sampleRate;
        if (!ac.grainDensity || ac.grainDensity < 0.05) return;
        const perf = this._getPerformanceProfile(p);
        const densityCap = 2.5 + (1 - perf.density) * 8.5;
        const effectiveDensity = Math.min(ac.grainDensity, densityCap);
        if (effectiveDensity < 0.05) return;

        // A single bus gain for the whole cloud — toggle ramps this
        const granularBus = ctx.createGain();
        granularBus.gain.setValueAtTime(0, ctx.currentTime);
        granularBus.gain.linearRampToValueAtTime(1, ctx.currentTime + 1.5); // fade in to stop clicks
        granularBus.connect(dest);
        this.nodes.push(granularBus);
        this._granularBus = granularBus;

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
                s += (this._random('granular-seed-noise') * 2 - 1) * ac.noiseMul * 0.12;
                d[i] = s * (ch === 0 ? 1 : (0.88 + rng.range(0, 0.24)));
            }
        }

        const intervalMs = 1000 / effectiveDensity;
        const peak = 0.012 * Math.sqrt(Math.min(effectiveDensity, 9));

        const scheduleGrain = (rng) => {
            const nominalDur = ac.grainSize * 0.001 * (0.8 + rng.range(0, 0.5));

            // CLICK-FREE envelope
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
            this.nodes.push(gs, env, pn);
        };
        // Wait a moment before firing grains to let the bus fade in and avoid load clicks
        this._setManagedTimeout(() => {
            if (!this.playing) return;
            this.intervals.push(setInterval(() => {
                if (!this.playing) return;
                const grng = new RNG(p.seed + 40000 + this.stepGrain++);
                const activeNodes = this.nodes?.size || 0;
                if (activeNodes > 320 && grng.range(0, 1) < 0.65) return;
                scheduleGrain(grng);
                if (effectiveDensity > 4 && activeNodes < 280 && grng.range(0, 1) < 0.24) {
                    this._setManagedTimeout(() => {
                        if (this.playing) scheduleGrain(grng);
                    }, intervalMs * 0.35);
                }
            }, intervalMs));
        }, 500);
    }

    // ── CHORUS / STEREO WIDENING ───────────────────────────────────────
    // 3 voices, each: short delay + LFO wobble + stereo pan → into wet bus
    _addChorus(source, dest, ac) {
        const ctx = this.ctx;
        if (!ac.chorusWet || ac.chorusWet < 0.02) return;

        const wetG = ctx.createGain();
        wetG.gain.value = ac.chorusWet;
        wetG.connect(dest);
        this.nodes.push(wetG);

        // 3 voices at musical delay primes (7, 13, 19ms)
        [7, 13, 19].forEach((ms, i) => {
            const del = ctx.createDelay(0.08);
            del.delayTime.value = ms * 0.001;
            // LFO slowly wobbles each voice's delay time
            const lfo = ctx.createOscillator();
            const lfoG = ctx.createGain();
            lfo.frequency.value = 0.28 + i * 0.13;
            lfoG.gain.value = ac.chorusDepth * 0.0001; // ms → seconds
            lfo.connect(lfoG); lfoG.connect(del.delayTime);
            lfo.start();
            // Pan: L, R, slightly R (spread)
            const pan = ctx.createStereoPanner();
            pan.pan.value = [-0.7, 0.7, 0.3][i];
            source.connect(del); del.connect(pan); pan.connect(wetG);
            this.nodes.push(del, lfo, lfoG, pan);
        });
    }

    // ── SIDECHAIN DUCK ─────────────────────────────────────────────────
    // Called by rhythmic pulses to briefly dip the main filter gain
    _duck(amt, rel) {
        if (!amt || !this.masterGain) return;
        const g = this.masterGain;
        const now = this.ctx.currentTime;
        g.gain.cancelScheduledValues(now);
        g.gain.setValueAtTime(g.gain.value, now);
        g.gain.linearRampToValueAtTime(this._vol * (1 - amt), now + 0.04);
        g.gain.linearRampToValueAtTime(this._vol, now + 0.04 + (rel || 0.35));
    }

    // ── TIER 2: PERCUSSION SEQUENCER ──────────────────────────────────
    // Euclidean rhythm helper: distributes k hits evenly over n steps
    _euclidean(k, n) {
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

    _startPercussion(p, dest) {
        const ctx = this.ctx, base = p.rootFreq, bid = p.biome.id;
        const transport = this.transport || this._buildTransport(p);
        const stepTime = transport.stepSeconds;
        const cycleSteps = transport.cycleSteps;
        const rng = new RNG(p.seed);
        const tensionProfile = this._tensionProfile || this._getTensionProfile(p);
        const drumTone = this._getDrumToneProfile(p);
        const fungalGroove = bid === 'fungal';

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
            this._percussionEnabled ? this._percVol : 0,
            ctx.currentTime + 0.5
        );
        percBody.connect(percPresence);
        percPresence.connect(percAir);
        percAir.connect(percBus);
        percBus.connect(dest);
        this.nodes.push(percBody, percPresence, percAir, percBus);
        this._percBus = percBus;

        // Kit variations per planet — tuned via seed
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
            hBright: drumTone.hatBright,
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
            nSrc.buffer = this._noiseBuffer;
            const nFilt = ctx.createBiquadFilter();
            nFilt.type = 'lowpass';
            nFilt.frequency.setValueAtTime(1000 * kit.kClick, t);
            nFilt.frequency.exponentialRampToValueAtTime(100 * Math.max(0.75, kit.kClick * 0.9), t + 0.05);
            const nEnv = ctx.createGain();
            nEnv.gain.setValueAtTime(vel * 0.4 * kit.kPunch, t);
            nEnv.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
            nSrc.connect(nFilt); nFilt.connect(nEnv); nEnv.connect(dest2);
            nSrc.start(t); nSrc.stop(t + 0.06);

            this.nodes.push(osc, env, nSrc, nFilt, nEnv);
            if (p.ac.sidechainAmt > 0) this._duck(p.ac.sidechainAmt, 0.4);
        };

        const playSnare = (vel) => {
            const t = ctx.currentTime;
            const noise = ctx.createBufferSource();
            noise.buffer = this._noiseBuffer;
            const nFilt = ctx.createBiquadFilter();
            nFilt.type = 'bandpass';
            nFilt.frequency.value = (fungalGroove ? 2600 : 3500) * kit.sPitch * kit.sNoise;
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
            this.nodes.push(noise, nFilt, nEnv, osc, tEnv);
        };

        const playHat = (vel, open) => {
            const t = ctx.currentTime;
            if (fungalGroove) {
                const osc1 = ctx.createOscillator(), osc2 = ctx.createOscillator();
                const bp = ctx.createBiquadFilter(), hp = ctx.createBiquadFilter(), env = ctx.createGain();
                osc1.type = 'triangle'; osc1.frequency.value = 760 * kit.hPitch;
                osc2.type = 'sine'; osc2.frequency.value = 1180 * kit.hPitch;
                bp.type = 'bandpass'; bp.frequency.value = 2400 * kit.hBright; bp.Q.value = 1.2;
                hp.type = 'highpass'; hp.frequency.value = 1400;

                const dur = (open ? 0.48 : 0.13) * kit.hDecay;
                env.gain.setValueAtTime(0, t);
                env.gain.linearRampToValueAtTime(vel * 0.34, t + 0.008);
                env.gain.exponentialRampToValueAtTime(0.001, t + dur);

                osc1.connect(bp); osc2.connect(bp); bp.connect(hp); hp.connect(env); env.connect(dest2);
                osc1.start(t); osc2.start(t);
                osc1.stop(t + dur + 0.05); osc2.stop(t + dur + 0.05);
                this.nodes.push(osc1, osc2, bp, hp, env);
                return;
            }
            // Hat is high-passed squarish FM or just noise (using square for metallic sound)
            const osc1 = ctx.createOscillator(), osc2 = ctx.createOscillator();
            const filt = ctx.createBiquadFilter(), env = ctx.createGain();
            osc1.type = 'square'; osc1.frequency.value = 400 * kit.hPitch;
            osc2.type = 'square'; osc2.frequency.value = 600 * kit.hPitch;
            filt.type = 'highpass'; filt.frequency.value = 7000 * kit.hBright;

            const dur = (open ? 0.35 : 0.08) * kit.hDecay;
            env.gain.setValueAtTime(0, t);
            env.gain.linearRampToValueAtTime(vel * 0.4, t + 0.01);
            env.gain.exponentialRampToValueAtTime(0.001, t + dur);

            osc1.connect(filt); osc2.connect(filt); filt.connect(env); env.connect(dest2);
            osc1.start(t); osc2.start(t);
            osc1.stop(t + dur + 0.05); osc2.stop(t + dur + 0.05);
            this.nodes.push(osc1, osc2, filt, env);
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
            this.nodes.push(osc, env);
        };

        // ── Extra Percussion Voices ───────────────────────────────────────
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
            this.nodes.push(osc, env);
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
            filt.frequency.value = 900 * kit.hPitch;
            filt.Q.value = 1.5;

            env.gain.setValueAtTime(0, t);
            env.gain.linearRampToValueAtTime(vel * 1.5, t + 0.005);
            env.gain.exponentialRampToValueAtTime(0.001, t + 0.4 * kit.hDecay);

            rmGain.connect(filt); filt.connect(env); env.connect(dest2);
            osc1.start(t); osc2.start(t);
            osc1.stop(t + 0.5); osc2.stop(t + 0.5);
            this.nodes.push(osc1, osc2, rmGain, filt, env);
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
            this.nodes.push(osc, env);
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
            filt.type = 'highpass'; filt.frequency.value = 5000;
            const env = ctx.createGain();
            env.gain.setValueAtTime(0, t);
            env.gain.linearRampToValueAtTime(vel * 0.4, t + 0.01);
            env.gain.exponentialRampToValueAtTime(0.001, t + 0.08); // very short decay

            mSrc.connect(filt); filt.connect(env); env.connect(dest2);
            mSrc.start(t); mMod.start(t);
            mSrc.stop(t + 0.1); mMod.stop(t + 0.1);
            this.nodes.push(mSrc, mMod, mModGain, filt, env);
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
            this.nodes.push(osc, env);
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
                this.nodes.push(osc, env, bp);
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
            this.nodes.push(osc, env);
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
            this.nodes.push(osc, env);
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
            this.nodes.push(osc, lpf, env);
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
            this.nodes.push(osc, bpf, env);
        };

        // Map voice name → function for biome-driven percVoices dispatch
        const extraVoices = { clave: playClave, cowbell: playCowbell, tom: playTom, shaker: playShaker, conga: playConga, rimshot: playRimshot, bongo: playBongo, taiko: playTaiko, woodblock: playWoodBlock };


        // ── Biome Sequence Patterns (16 steps) ──
        // 1=hit, 2=accent/openhat, 0=rest. Multiple arrays = planet seed chooses variation.
        const P = {
            volcanic: {
                k: [[1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0], [1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 1, 0, 0]],
                s: [[0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0], [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1, 0]],
                h: [[1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0], [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]],
                b: [[1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0], [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0]]
            },
            psychedelic: {
                k: [[1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 1, 0], [1, 0, 0, 0, 1, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0]],
                s: [[0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1], [0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0]],
                h: [[1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 1, 0], [1, 0, 2, 0, 1, 0, 2, 0, 1, 0, 2, 0, 1, 0, 2, 0]],
                b: [[1, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0], [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0]]
            },
            corrupted: {
                // High-energy breakbeat / glitch / DnB feel
                k: [[1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 1, 0, 0, 0, 0], [1, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0]],
                s: [[0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1], [0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 0]],
                h: [[1, 0, 1, 1, 1, 0, 1, 0, 1, 1, 1, 0, 1, 0, 1, 1], [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1, 1]], // fast 16ths
                b: [[1, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0], [1, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0]]
            },
            oceanic: {
                k: [[1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0]],
                s: [[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0]], // sparse
                h: [[1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0], [0, 0, 2, 0, 0, 0, 2, 0, 0, 0, 2, 0, 0, 0, 2, 0]],
                b: [[1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0], [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0]]
            },
            organic: {
                // Latin/syncopated feel
                k: [[1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0], [1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0]],
                s: [[0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0], [0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0]], // claves-ish
                h: [[1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0], [1, 1, 2, 0, 1, 1, 2, 0, 1, 1, 2, 0, 1, 1, 2, 0]],
                b: [[1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0], [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]]
            },
            desert: {
                k: [[1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0], [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0]],
                s: [[0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0]],
                h: [[1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0], [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0]],
                b: [[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]]
            },
            crystalline: {
                k: [[1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0]],
                s: [[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]],
                h: [[2, 0, 0, 0, 2, 0, 0, 0, 2, 0, 0, 0, 2, 0, 0, 0], [2, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0]], // just bells/open hats
                b: [[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]]
            }
        };
        // Fallback for barren/ethereal which are ambient
        const ambient = { k: [[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]], s: [[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]], h: [[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]], b: [[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]] };

        // Euclidean patterns auto-generated for new exotic biomes
        const eu = (k, n) => this._euclidean(k, n);
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
        // ── New Biome Patterns ──
        P.nebula = ambient; // Choral / ambient — no percussion
        P.arctic = {
            // Just rare single clicks — vast silence between them
            k: [[1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0]],
            s: [[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]],
            h: [[2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0]],
            b: [[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]]
        };
        P.storm = {
            // Violent, irregular — dense and chaotic
            k: [eu(7, 16), eu(9, 16)],
            s: [eu(5, 16), eu(7, 16)],
            h: [[1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1], eu(13, 16)], // near-continuous
            b: [eu(5, 16), eu(7, 16)]
        };
        P.crystalloid = {
            // Precise euclidean — geometric and alien
            k: [eu(5, 16), eu(3, 16)],
            s: [eu(7, 16), eu(5, 16)],
            h: [eu(11, 16), eu(9, 16)],
            b: [eu(4, 16), eu(6, 16)]
        };

        // ── Tribal / Organic Rhythms ──
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
            k: this._fitPatternToCycle(rng.pick(bPats.k), cycleSteps),
            s: this._fitPatternToCycle(rng.pick(bPats.s), cycleSteps),
            h: this._fitPatternToCycle(rng.pick(bPats.h), cycleSteps),
            b: this._fitPatternToCycle(rng.pick(bPats.b), cycleSteps)
        };
        const phasePatternBanks = this._buildPhasePatternBanks(basePercPatterns, cycleSteps, p.seed, bid);
        const subPitch = rng.pick([0, -5, -7]);

        // Generate extra-voice Euclidean patterns from percVoices list
        const extraPats = {};
        const pVoices = p.ac.percVoices || [];
        pVoices.forEach((v, i) => {
            const k = [3, 4, 5, 6, 7][i % 5];
            extraPats[v] = this._euclidean(Math.min(k, cycleSteps), cycleSteps);
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
                    extraPats[voice] = this._fitPatternToCycle(fungalExtraPatterns[voice], cycleSteps);
                }
            });
        }

        // Swing offset (delays even 16th-steps by swing*stepTime)
        const swingAmt = (p.ac.swing || 0) * stepTime;

        let step = 0;
        let barCount = 0; // counts completed 16-step bars for fill detection
        const runPercussionStep = () => {
            if (!this.playing) return;
            const seqRng = new RNG(p.seed + 50000 + this.stepPerc++);
            const stepIndex = step;
            const swDelay = (stepIndex % 2 === 1) ? swingAmt : 0;
            const rhythmState = this._getRhythmState(p, stepIndex, barCount, seqRng);
            const phasePatterns = phasePatternBanks[rhythmState.phase] || phasePatternBanks.STIR || basePercPatterns;
            const chaos = seqRng.range(0, 1) < rhythmState.chaosChance;

            // Velocity variance
            const velScale = 1 - (p.ac.velocityVar || 0) * seqRng.range(0, 1);

            // ── Ghost notes: very quiet hat & snare on empty adjacent steps ──
            // Fires only when the pattern has no hit on this step (off-beats)
            const doGhost = this._ghostEnabled && !chaos
                && phasePatterns.k[stepIndex] === 0 && phasePatterns.s[stepIndex] === 0
                && seqRng.range(0, 1) < rhythmState.ghostChance;

            // ── Fill detection: last 4 steps of a 16-step bar when fills on ──
            const playStep = (s, state) => {
                let kickHit = phasePatterns.k[s] === 1;
                let snareHit = phasePatterns.s[s] === 1;
                let hatHit = phasePatterns.h[s];
                const subHit = phasePatterns.b[s] === 1;
                const dynVel = velScale * state.velocityLift;
                const kickVelMul = fungalGroove ? 0.8 : 1;
                const snareVelMul = fungalGroove ? 0.88 : 1;
                const hatVelMul = fungalGroove ? 0.82 : 1;
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
                    if (seqRng.range(0, 1) < this._clamp(state.extraVoiceChance + preferredLift, 0, 0.95)) {
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
                    this._setManagedTimeout(() => {
                        if (!this.playing) return;
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
                            this._setManagedTimeout(() => {
                                if (!this.playing) return;
                                extraVoices[seqRng.pick(fungalFillPool)](0.07 * dynVel);
                            }, (stepTime * 0.32) * 1000);
                        }
                        if (seqRng.range(0, 1) < state.fillChance * 0.54) {
                            this._setManagedTimeout(() => {
                                if (!this.playing) return;
                                playHat(fillVel * 0.82, false);
                            }, (stepTime * 0.68) * 1000);
                        }
                    }
                }
            };

            if (swDelay > 0) {
                this._setManagedTimeout(() => playStep(stepIndex, rhythmState), swDelay * 1000);
            } else {
                playStep(stepIndex, rhythmState);
            }

            if (this._ghostEnabled && seqRng.range(0, 1) < rhythmState.accentChance * 0.35) {
                playHat(0.026 * rhythmState.velocityLift, false);
            }

            step = (step + 1) % cycleSteps;
            if (step === 0) barCount++;
        };

        const percussionScheduled = this._scheduleRecurringChannel(
            'percussion',
            stepTime,
            () => runPercussionStep()
        );
        if (!percussionScheduled) {
            this.intervals.push(setInterval(() => runPercussionStep(), stepTime * 1000));
        }

        // ── Polyrhythm Layer (Hemiola / 3-against-4) ──
        // Only on "complex" rhythmic biomes (fungal, crystalloid, quantum, psychedelic)
        const complexBiomes = ['fungal', 'crystalloid', 'quantum', 'psychedelic', 'corrupted'];
        if (complexBiomes.includes(p.biome.id) || rng.range(0, 1) < 0.25) {
            const polyVoicePool = (tensionProfile.polyVoices || []).filter(v => extraVoices[v]);
            let polyStep = 0;
            const tripletTime = (stepTime * 4) / 3; // 3 beats over 4 sub-steps
            const runPolyrhythmStep = () => {
                if (!this.playing) return;
                const polyRng = new RNG(p.seed + 65000 + this.stepFX++);
                const polyState = this._getRhythmState(p, polyStep++ % cycleSteps, barCount, polyRng);
                if (polyState.energy < Math.max(0.18, tensionProfile.lowPoint - 0.04)) return;
                const voicePool = polyVoicePool.length ? polyVoicePool : ['clave', 'cowbell', 'conga'].filter(v => extraVoices[v]);
                const polySound = extraVoices[polyRng.pick(voicePool)];
                if (polySound && polyRng.range(0, 1) < this._clamp(0.2 + polyState.energy * 0.38, 0.15, 0.82)) {
                    polySound(0.07 * polyState.velocityLift);
                }
            };

            const polyScheduled = this._scheduleRecurringChannel(
                'percussion-poly',
                tripletTime,
                () => runPolyrhythmStep()
            );
            if (!polyScheduled) {
                this.intervals.push(setInterval(() => runPolyrhythmStep(), tripletTime * 1000));
            }
        }
    }

    // ── TIER 2: HARMONIC TENSION ARC ──────────────────────────────────
    // Tension rises from 0 →1 over ~60 seconds while listening.
    // It modulates filter, LFO, melody density, and dissonance.
    // At tension ≥0.85 a climax chord fires then tension resets to 0.45.
    _startTensionArc(p, filt) {
        const ctx = this.ctx;
        const base = this.tensionBase;
        const profile = this._tensionProfile = this._getTensionProfile(p);
        this.tension = 0;
        this._tensionBaseValue = 0;
        this._tensionTick = 0;
        this._tensionSurge = 0;
        this._tensionState = { phase: 'DORMANT', energy: 0, cyclePos: 0, pocket: 0.5 };
        this._climaxFired = false;
        this._climaxStartedDrain = false;

        const runTensionArcStep = () => {
            if (!this.playing) return;
            const nyquist = ctx.sampleRate / 2;
            const arcRng = new RNG(p.seed + 88000 + this._tensionTick);
            const density = this._clamp(p.melodyDensity || 0.05, 0.01, 0.35);
            const wave = Math.sin((this._tensionTick + profile.phaseOffset) * profile.pulseRate) * profile.pulseDepth;

            // Increment tension ONLY if we are not in the climax release phase
            if (!this._climaxStartedDrain) {
                const surgeHit = arcRng.range(0, 1) < profile.surgeChance
                    ? arcRng.range(profile.surgeAmount * 0.35, profile.surgeAmount)
                    : 0;
                const drift = arcRng.range(-profile.riseVariance, profile.riseVariance);
                this._tensionSurge = Math.max(0, this._tensionSurge * profile.surgeDecay + surgeHit - profile.surgeAmount * 0.08);
                this._tensionBaseValue = this._clamp(
                    this._tensionBaseValue + profile.riseRate + ((density - 0.08) * 0.05) + drift + (wave * profile.pulseLift),
                    0,
                    1
                );
            } else {
                this._tensionSurge *= 0.45;
                this._tensionBaseValue = Math.max(profile.floor, this._tensionBaseValue - profile.drainRate);
                if (this._tensionBaseValue <= profile.reset) {
                    this._climaxFired = false;
                    this._climaxStartedDrain = false;
                }
            }

            this.tension = this._clamp(this._tensionBaseValue + wave + this._tensionSurge, 0, 1);
            this._tensionTick++;
            const prevPhase = this._tensionState?.phase || 'DORMANT';
            const state = this._getTensionState(p, this.stepPerc || 0);
            this._tensionState = state;
            this._lastTensionPhase = state.phase;

            if (prevPhase !== state.phase && !(prevPhase === 'DORMANT' && state.phase === 'STIR')) {
                if ((ctx.currentTime - this._lastPhaseEventTime) > 1.25) {
                    this._lastPhaseEventTime = ctx.currentTime;
                    this._firePhaseTransitionEvent(p, filt, prevPhase, state.phase);
                }
            }
            if (ctx.currentTime >= this._macroEventCooldownUntil) {
                const macroChance = this._getMacroEventChance(p.biome.id, state);
                if (arcRng.range(0, 1) < macroChance) {
                    this._fireSignatureMacroEvent(p, filt, state);
                    this._macroEventCooldownUntil = ctx.currentTime + this._getMacroEventCooldown(p.biome.id, state.phase, arcRng);
                }
            }

            // ─ Filter & FM morphing as tension rises ────────────────────────
            const tSq = state.energy * state.energy;
            const lfoDepth = (base ? base.lfoRate : 0.1) * 1000 * state.energy; // Estimating depth
            const safeCeiling = nyquist - lfoDepth - 400; // Leave headroom for LFO peaks

            // Dynamic LFO Depth Scaling: reduce LFO impact as we hit the ceiling
            if (this.tensionLfos) {
                this.tensionLfos.forEach(lg => {
                    const reduction = 1.0 - (state.energy * 0.7); // Scale down to 30% depth
                    const originalDepth = base ? base.filtFreq * 0.20 : 200;
                    lg.gain.linearRampToValueAtTime(originalDepth * reduction, ctx.currentTime + 2);
                });
            }

            const newFiltFreq = Math.min(
                (base ? base.filtFreq : 1000) * (1 + state.energy * profile.filterMul),
                safeCeiling
            );
            if (this.tensionFilt) {
                this.tensionFilt.frequency.linearRampToValueAtTime(
                    Math.max(20, newFiltFreq), ctx.currentTime + 2
                );
            }
            if (this.fmModGainNode && this.fmIndexBase) {
                // Morph FM harshness according to each biome's own arc profile.
                const newIndex = this.fmIndexBase * (1 + tSq * profile.fmMul);
                this.fmModGainNode.gain.linearRampToValueAtTime(
                    newIndex, ctx.currentTime + 2
                );
            }

            // ─ Update tension bar UI ──────────────────────────────────────
            this._emitState();

            // ─ Climax event at tension ≥ 0.85 ────────────────────────────
            if (state.energy >= profile.climaxThreshold && !this._climaxFired) {
                this._climaxFired = true;
                this._fireClimax(p, filt);
            }

            // If climax fired, wait until it HITS 1.0 before starting the drain
            // This ensures the UI bar feels "maxed out" for a moment
            if (this._climaxFired && state.energy >= 0.98) {
                this._climaxStartedDrain = true;
            }
        };

        const tensionScheduled = this._scheduleRecurringChannel(
            'tension',
            2,
            () => runTensionArcStep()
        );
        if (!tensionScheduled) {
            this.intervals.push(setInterval(() => runTensionArcStep(), 2000));
        }
    }

    // Fires a rich swelling chord at climax, then fades
    _fireClimax(p, dest) {
        const ctx = this.ctx, base = p.rootFreq;
        const profile = this._tensionProfile || this._getTensionProfile(p);
        const ratios = profile.climaxRatios || DEFAULT_TENSION_PROFILE.climaxRatios;
        ratios.forEach((ratio, i) => {
            const o = ctx.createOscillator(), g = ctx.createGain(), pan = ctx.createStereoPanner();
            o.type = this._resolveOscType(p.ac.padWave); o.frequency.value = base * ratio;
            pan.pan.value = ratios.length > 1
                ? ((i / (ratios.length - 1)) * 0.9) - 0.45
                : 0;

            const now = ctx.currentTime + i * profile.climaxSpacing;
            g.gain.setValueAtTime(0, now);
            g.gain.linearRampToValueAtTime(profile.climaxGain, now + 2.5);
            g.gain.linearRampToValueAtTime(profile.climaxGain, now + profile.climaxHold);
            g.gain.linearRampToValueAtTime(0, now + profile.climaxRelease);

            o.connect(pan); pan.connect(g); g.connect(dest);
            o.start(now); o.stop(now + profile.climaxRelease + 1);
            this.nodes.push(o, g, pan);
        });
        // Brief master swell
        const mg = this.masterGain;
        const now = ctx.currentTime;
        mg.gain.linearRampToValueAtTime(this._vol * profile.climaxMasterBoost, now + 3);
        mg.gain.linearRampToValueAtTime(this._vol, now + Math.max(8, profile.climaxHold + 2));
    }

    _startNatureAmbiance(p, dest) {
        const ctx = this.ctx, ac = p.ac, bid = p.biome.id;
        const features = ac.ambianceFeatures || [];
        if (features.length === 0) return;

        const ambBus = ctx.createGain();
        const ambTarget = bid === 'fungal' ? 0.58 : 0.5;
        ambBus.gain.setValueAtTime(0, ctx.currentTime);
        ambBus.gain.linearRampToValueAtTime(ambTarget, ctx.currentTime + 2);
        ambBus.connect(dest);
        this.nodes.push(ambBus);

        const startAmbienceLoop = (name, intervalMs, callback) => {
            const scheduled = this._scheduleRecurringChannel(
                `ambience-${name}`,
                intervalMs / 1000,
                () => {
                    if (!this.playing) return;
                    callback();
                }
            );
            if (!scheduled) {
                this.intervals.push(setInterval(() => {
                    if (!this.playing) return;
                    callback();
                }, intervalMs));
            }
        };

        features.forEach(feat => {
            if (feat === 'birds') {
                startAmbienceLoop('birds', 1500, () => {
                    if (!this.playing) return;
                    const rng = new RNG(p.seed + (this.stepFX++ || 0) + 70000);
                    if (rng.range(0, 1) < 0.2) {
                        const t = ctx.currentTime;
                        const o = ctx.createOscillator(), g = ctx.createGain();
                        const f0 = 2000 + rng.range(0, 3000);
                        o.frequency.setValueAtTime(f0, t);
                        o.frequency.exponentialRampToValueAtTime(f0 * rng.range(0.5, 1.5), t + 0.1);
                        g.gain.setValueAtTime(0, t);
                        g.gain.linearRampToValueAtTime(0.04, t + 0.01);
                        g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
                        o.connect(g); g.connect(ambBus);
                        o.start(t); o.stop(t + 0.2);
                        this.nodes.push(o, g);
                    }
                });
            }
            if (feat === 'rain') {
                startAmbienceLoop('rain', 100, () => {
                    if (!this.playing) return;
                    const rng = new RNG(p.seed + (this.stepFX++ || 0) + 80000);
                    if (rng.range(0, 1) < 0.6) {
                        const t = ctx.currentTime;
                        const n = ctx.createBufferSource();
                        n.buffer = this._noiseBuffer;
                        const f = ctx.createBiquadFilter();
                        f.type = 'highpass'; f.frequency.value = 4000 + rng.range(0, 4000);
                        const g = ctx.createGain();
                        g.gain.setValueAtTime(0, t);
                        g.gain.linearRampToValueAtTime(0.08, t + 0.005);
                        g.gain.exponentialRampToValueAtTime(0.001, t + 0.03);
                        n.connect(f); f.connect(g); g.connect(ambBus);
                        n.start(t); n.stop(t + 0.05);
                        this.nodes.push(n, f, g);
                    }
                });
            }
            if (feat === 'bubbles') {
                startAmbienceLoop('bubbles', 240, () => {
                    if (!this.playing) return;
                    const rng = new RNG(p.seed + (this.stepFX++ || 0) + 81000);
                    if (rng.range(0, 1) < 0.42) {
                        const t = ctx.currentTime;
                        const dur = rng.range(0.18, 0.55);
                        const f0 = 180 + rng.range(0, 260);
                        const o = ctx.createOscillator();
                        const f = ctx.createBiquadFilter();
                        const g = ctx.createGain();
                        const pan = ctx.createStereoPanner();
                        o.type = 'sine';
                        o.frequency.setValueAtTime(f0, t);
                        o.frequency.exponentialRampToValueAtTime(f0 * rng.range(1.4, 2.6), t + dur);
                        f.type = 'bandpass'; f.frequency.value = f0 * 4; f.Q.value = 1.2;
                        pan.pan.value = rng.range(-0.7, 0.7);
                        g.gain.setValueAtTime(0, t);
                        g.gain.linearRampToValueAtTime(0.018 + rng.range(0, 0.018), t + 0.03);
                        g.gain.exponentialRampToValueAtTime(0.001, t + dur);
                        o.connect(f); f.connect(g); g.connect(pan); pan.connect(ambBus);
                        o.start(t); o.stop(t + dur + 0.05);
                        this.nodes.push(o, f, g, pan);
                    }
                });
            }
            if (feat === 'dew') {
                startAmbienceLoop('dew', 650, () => {
                    if (!this.playing) return;
                    const rng = new RNG(p.seed + (this.stepFX++ || 0) + 81250);
                    if (rng.range(0, 1) < 0.22) {
                        const t = ctx.currentTime;
                        const dur = rng.range(0.16, 0.42);
                        const baseFreq = 620 + rng.range(0, 980);
                        const o = ctx.createOscillator();
                        const bp = ctx.createBiquadFilter();
                        const g = ctx.createGain();
                        const pan = ctx.createStereoPanner();
                        o.type = rng.range(0, 1) < 0.6 ? 'sine' : 'triangle';
                        o.frequency.setValueAtTime(baseFreq * rng.range(1.08, 1.35), t);
                        o.frequency.exponentialRampToValueAtTime(baseFreq, t + dur * 0.85);
                        bp.type = 'bandpass'; bp.frequency.value = baseFreq * 1.8; bp.Q.value = 1.5;
                        pan.pan.value = rng.range(-0.75, 0.75);
                        g.gain.setValueAtTime(0, t);
                        g.gain.linearRampToValueAtTime(0.012 + rng.range(0, 0.01), t + 0.02);
                        g.gain.exponentialRampToValueAtTime(0.001, t + dur);
                        o.connect(bp); bp.connect(g); g.connect(pan); pan.connect(ambBus);
                        o.start(t); o.stop(t + dur + 0.03);
                        this.nodes.push(o, bp, g, pan);
                    }
                });
            }
            if (feat === 'thunder' && bid === 'storm') {
                startAmbienceLoop('thunder', 5000, () => {
                    if (!this.playing) return;
                    const rng = new RNG(p.seed + (this.stepFX++ || 0) + 90000);
                    if (rng.range(0, 1) < 0.05) {
                        const t = ctx.currentTime;
                        const n = ctx.createBufferSource();
                        n.buffer = this._noiseBuffer;
                        const f = ctx.createBiquadFilter();
                        f.type = 'lowpass'; f.frequency.value = 100 + rng.range(0, 200);
                        const g = ctx.createGain();
                        g.gain.setValueAtTime(0, t);
                        g.gain.linearRampToValueAtTime(0.4, t + 0.1);
                        g.gain.exponentialRampToValueAtTime(0.001, t + 3.0);
                        n.connect(f); f.connect(g); g.connect(ambBus);
                        n.start(t); n.stop(t + 3.1);
                        this.nodes.push(n, f, g);
                    }
                });
            }
            if (feat === 'lightning' && bid === 'storm' && this._noiseBuffer) {
                startAmbienceLoop('lightning', 1800, () => {
                    if (!this.playing) return;
                    const rng = new RNG(p.seed + (this.stepFX++ || 0) + 90500);
                    if (rng.range(0, 1) < 0.08) {
                        const t = ctx.currentTime;
                        const n = ctx.createBufferSource();
                        const hp = ctx.createBiquadFilter();
                        const bp = ctx.createBiquadFilter();
                        const g = ctx.createGain();
                        const baseFreq = 3800 + rng.range(0, 4200);
                        n.buffer = this._noiseBuffer;
                        hp.type = 'highpass'; hp.frequency.value = baseFreq;
                        bp.type = 'bandpass'; bp.frequency.value = baseFreq * 0.85; bp.Q.value = 2.2;
                        g.gain.setValueAtTime(0, t);
                        g.gain.linearRampToValueAtTime(0.16 + rng.range(0, 0.05), t + 0.004);
                        g.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
                        n.connect(hp); hp.connect(bp); bp.connect(g); g.connect(ambBus);
                        n.start(t); n.stop(t + 0.16);
                        if (dest?.frequency) {
                            const flashFreq = Math.min(ctx.sampleRate / 2 - 200, Math.max(dest.frequency.value * 1.7, 5000));
                            dest.frequency.setValueAtTime(dest.frequency.value, t);
                            dest.frequency.linearRampToValueAtTime(flashFreq, t + 0.01);
                            dest.frequency.exponentialRampToValueAtTime(Math.max(80, p.filterFreq), t + 0.18);
                        }
                        this.nodes.push(n, hp, bp, g);
                    }
                });
            }
            if (feat === 'wind') {
                const n = ctx.createBufferSource();
                if (this._noiseBuffer) {
                    n.buffer = this._noiseBuffer; n.loop = true;
                    const f = ctx.createBiquadFilter();
                    f.type = 'bandpass'; f.frequency.value = 800; f.Q.value = 0.5;
                    const g = ctx.createGain(); g.gain.value = 0.05;
                    n.connect(f); f.connect(g); g.connect(ambBus);
                    n.start();
                    this._lfo(0.05, 400, f.frequency);
                    this.nodes.push(n, f, g);
                }
            }
            if (feat === 'rustle' && this._noiseBuffer) {
                const n = ctx.createBufferSource();
                const hp = ctx.createBiquadFilter();
                const bp = ctx.createBiquadFilter();
                const g = ctx.createGain();
                const pan = ctx.createStereoPanner();
                n.buffer = this._noiseBuffer; n.loop = true;
                hp.type = 'highpass'; hp.frequency.value = bid === 'fungal' ? 240 : 650;
                bp.type = 'bandpass'; bp.frequency.value = bid === 'fungal' ? 920 : 1800; bp.Q.value = bid === 'fungal' ? 0.72 : 0.9;
                g.gain.value = bid === 'fungal' ? 0.024 : 0.018;
                pan.pan.value = 0;
                n.connect(hp); hp.connect(bp); bp.connect(g); g.connect(pan); pan.connect(ambBus);
                n.start();
                this._lfo(0.07, bid === 'fungal' ? 250 : 520, bp.frequency, 'triangle');
                this._lfo(0.11, g.gain.value * 0.55, g.gain, 'sine');
                if (bid === 'fungal') this._lfo(0.035, 0.45, pan.pan, 'sine');
                this.nodes.push(n, hp, bp, g, pan);
            }
            if (feat === 'spores' && this._noiseBuffer) {
                startAmbienceLoop('spores', 1200, () => {
                    if (!this.playing) return;
                    const rng = new RNG(p.seed + (this.stepFX++ || 0) + 91500);
                    if (rng.range(0, 1) < 0.28) {
                        const t = ctx.currentTime;
                        const dur = rng.range(0.45, 1.1);
                        const n = ctx.createBufferSource();
                        const f = ctx.createBiquadFilter();
                        const g = ctx.createGain();
                        const pan = ctx.createStereoPanner();
                        n.buffer = this._noiseBuffer;
                        n.playbackRate.value = bid === 'fungal' ? rng.range(0.55, 1.1) : rng.range(0.4, 0.9);
                        f.type = 'bandpass'; f.frequency.value = (bid === 'fungal' ? 800 : 1200) + rng.range(0, bid === 'fungal' ? 1800 : 2800); f.Q.value = 0.7 + rng.range(0, 1.2);
                        pan.pan.value = rng.range(-0.6, 0.6);
                        g.gain.setValueAtTime(0, t);
                        g.gain.linearRampToValueAtTime((bid === 'fungal' ? 0.016 : 0.022) + rng.range(0, 0.02), t + dur * 0.35);
                        g.gain.exponentialRampToValueAtTime(0.001, t + dur);
                        n.connect(f); f.connect(g); g.connect(pan); pan.connect(ambBus);
                        n.start(t); n.stop(t + dur + 0.05);
                        this.nodes.push(n, f, g, pan);
                        if (bid === 'fungal') {
                            const o = ctx.createOscillator();
                            const og = ctx.createGain();
                            const of = ctx.createBiquadFilter();
                            o.type = rng.range(0, 1) < 0.5 ? 'sine' : 'triangle';
                            o.frequency.setValueAtTime(420 + rng.range(0, 520), t);
                            o.frequency.exponentialRampToValueAtTime((680 + rng.range(0, 680)) * rng.range(0.95, 1.08), t + dur * 0.7);
                            of.type = 'bandpass'; of.frequency.value = 1200 + rng.range(0, 900); of.Q.value = 1.1;
                            og.gain.setValueAtTime(0, t);
                            og.gain.linearRampToValueAtTime(0.006 + rng.range(0, 0.008), t + dur * 0.18);
                            og.gain.exponentialRampToValueAtTime(0.001, t + dur * 0.82);
                            o.connect(of); of.connect(og); og.connect(pan);
                            o.start(t); o.stop(t + dur + 0.04);
                            this.nodes.push(o, og, of);
                        }
                    }
                });
            }
        });
    }

    // ── TIER 3: DOPPLER WHOOSH ────────────────────────────────────────
    // Synthesises a descending-frequency noise burst suggesting spatial travel.
    // Call on navigation — plays through the analyser so the scope reacts to it.
    _dopplerWhoosh() {
        if (!this.ctx) return;
        const ctx = this.ctx, sr = ctx.sampleRate;
        const dur = 1.5;
        const buf = ctx.createBuffer(2, sr * dur, sr);
        for (let ch = 0; ch < 2; ch++) {
            const d = buf.getChannelData(ch);
            const phase = ch === 1 ? Math.PI * 0.15 : 0; // slight L/R phase offset
            for (let i = 0; i < d.length; i++) {
                const t = i / sr;
                const env = t < 0.08 ? t / 0.08 : Math.exp(-(t - 0.08) * 4.5);
                const fInst = 3200 * Math.exp(-t * 3); // sweeps 3200 → ~60 Hz
                const tone = Math.sin(2 * Math.PI * fInst * t + phase) * 0.5;
                const noise = (this._random('doppler-noise') * 2 - 1) * 0.5;
                d[i] = (tone + noise) * env * 0.14;
            }
        }
        const src = ctx.createBufferSource();
        src.buffer = buf;
        const g = ctx.createGain(); g.gain.value = this._vol;
        src.connect(g); g.connect(this.analyser);
        src.start();
        src.onended = () => { try { src.disconnect(); g.disconnect(); } catch (e) { } };
    }

    stop() {
        this._stopTransportScheduler();
        this.intervals.forEach(clearInterval);
        this.intervals = [];
        this._stopStateStream();
        this.tension = 0;
        const t = this.ctx ? this.ctx.currentTime : 0;
        this.nodes.forEach(n => {
            try {
                if (n.stop) n.stop(t + 0.01);
                n.disconnect();
            } catch (e) { }
        });
        this.nodes.clear();
        this.melodyBus = null;
        this.melodyFilter = null;
        this._moonBus = null;
        this._moonProfile = [];
        this._moonProcCount = 0;
        this._moonLastBurst = 0;
        this._lastMoonProcAt = Number.NEGATIVE_INFINITY;
        this.transport = null;
        this._lastMelodyStep = null;
        this._voiceCooldowns = Object.create(null);
        this._tensionBaseValue = 0;
        this._tensionTick = 0;
        this._tensionSurge = 0;
        this._tensionProfile = null;
        this._tensionState = { phase: 'DORMANT', energy: 0, cyclePos: 0, pocket: 0.5 };
        this._lastTensionPhase = 'DORMANT';
        this._lastPhaseEventTime = 0;
        this._macroEventCooldownUntil = 0;
        this.playing = false;
        this._emitState();
    }

    setVolume(v) {
        this._vol = v;
        if (this.masterGain) this.masterGain.gain.linearRampToValueAtTime(v, this.ctx.currentTime + 0.1);
        this._emitState();
    }
    setReverb(v) {
        this._reverb = v;
        if (this.reverbGain) {
            this.reverbGain.gain.linearRampToValueAtTime(v, this.ctx.currentTime + 0.2);
            this.dryGain.gain.linearRampToValueAtTime(1 - v * 0.5, this.ctx.currentTime + 0.2);
        }
        this._emitState();
    }
    setMix({ volume, reverb, eqLow, eqMid, eqHigh, percussionVolume } = {}) {
        if (Number.isFinite(volume)) this.setVolume(volume);
        if (Number.isFinite(reverb)) this.setReverb(reverb);
        if (Number.isFinite(eqLow) && this.eqLow) this.eqLow.gain.value = eqLow;
        if (Number.isFinite(eqMid) && this.eqMid) this.eqMid.gain.value = eqMid;
        if (Number.isFinite(eqHigh) && this.eqHigh) this.eqHigh.gain.value = eqHigh;
        if (Number.isFinite(percussionVolume)) {
            this._percVol = percussionVolume;
            if (this._percussionEnabled && this._percBus && this.ctx) {
                const now = this.ctx.currentTime;
                this._percBus.gain.cancelScheduledValues(now);
                this._percBus.gain.setValueAtTime(this._percBus.gain.value, now);
                this._percBus.gain.linearRampToValueAtTime(this._percVol, now + 0.1);
            }
        }
        this._emitState();
    }
    setPerformance({ drift, density } = {}) {
        if (Number.isFinite(drift)) this._drift = this._clamp(drift, 0, 1);
        if (Number.isFinite(density)) this._density = this._clamp(density, 0, 1);
        this._emitState();
    }
    setFeatureFlags({ granular, percussion, chords, arp, pitchBend, motif, ghost, fills } = {}) {
        if (typeof granular === 'boolean') {
            this._granularEnabled = granular;
            if (this._granularBus && this.ctx) {
                const now = this.ctx.currentTime;
                this._granularBus.gain.cancelScheduledValues(now);
                this._granularBus.gain.setValueAtTime(this._granularBus.gain.value, now);
                this._granularBus.gain.linearRampToValueAtTime(granular ? 1 : 0, now + 1.5);
            }
        }
        if (typeof percussion === 'boolean') {
            this._percussionEnabled = percussion;
            if (this._percBus && this.ctx) {
                const now = this.ctx.currentTime;
                this._percBus.gain.cancelScheduledValues(now);
                this._percBus.gain.setValueAtTime(this._percBus.gain.value, now);
                this._percBus.gain.linearRampToValueAtTime(percussion ? this._percVol : 0, now + 0.2);
            }
        }
        if (typeof chords === 'boolean') this._chordEnabled = chords;
        if (typeof arp === 'boolean') this._arpEnabled = arp;
        if (typeof pitchBend === 'boolean') this._pitchBendEnabled = pitchBend;
        if (typeof motif === 'boolean') this._motifEnabled = motif;
        if (typeof ghost === 'boolean') this._ghostEnabled = ghost;
        if (typeof fills === 'boolean') this._fillsEnabled = fills;
        this._emitState();
    }
    setDeterminismMode(mode = 'identity') {
        const nextMode = mode === 'strict' ? 'strict' : 'identity';
        this._determinismMode = nextMode;
        this._strictRngs = Object.create(null);
        this._emitState();
    }
    subscribeState(listener) {
        if (typeof listener !== 'function') return () => { };
        this._listeners.add(listener);
        try { listener(this._snapshotState()); } catch (e) { }
        return () => this._listeners.delete(listener);
    }
    triggerNavigationFx() {
        if (!this.playing) return;
        this._dopplerWhoosh();
    }
    getAnalyser() { return this.analyser; }
    getRecordingStream() { return this.recordDest?.stream || null; }

    // Smooth crossfade: fade current out, start new, fade in
    crossfadeTo(planet, cb) {
        if (!this.masterGain || !this.ctx) { this.start(planet); if (cb) cb(); return; }
        const ctx = this.ctx;
        const fadeOut = 1.1;
        this.masterGain.gain.linearRampToValueAtTime(0, ctx.currentTime + fadeOut);
        // Stop old nodes after fade, start new quietly, then ramp up
        this._setManagedTimeout(() => {
            this.stop();
            this.start(planet);
            const now2 = this.ctx.currentTime;
            this.masterGain.gain.cancelScheduledValues(now2);
            this.masterGain.gain.setValueAtTime(0, now2);
            this.masterGain.gain.linearRampToValueAtTime(this._vol, now2 + 1.5);
            if (cb) cb();
        }, fadeOut * 1000);
    }

    // ── BASS LINE GENERATOR ───────────────────────────────────────────
    _startBass(p, dest) {
        const ctx = this.ctx;
        const transport = this.transport || this._buildTransport(p);
        const bassBus = ctx.createGain();
        bassBus.gain.value = 0.55;
        bassBus.connect(dest);
        this.nodes.push(bassBus);

        // Bass pattern: 1=note, 0=rest. 8-step patterns (half-bar)
        const patterns = [
            [1, 0, 0, 0, 1, 0, 0, 0], // Steady 1/4s
            [1, 0, 0, 1, 0, 0, 1, 0], // Syncopated
            [0, 0, 1, 0, 0, 0, 1, 0], // Off-beat
            [1, 1, 1, 1, 1, 1, 1, 1], // Driving 1/8ths
            [1, 0, 1, 0, 1, 0, 1, 0], // Simple 1/8ths
        ];
        const rng = new RNG(p.seed + 777);
        const activePattern = this._fitPatternToCycle(rng.pick(patterns), transport.cycleSteps);
        const bassOctave = p.biome.id === 'abyssal' ? 0.5 : 1.0;
        const bassStepMs = transport.stepMs;
        let bassStep = 0;
        const bassScheduled = this._scheduleRecurringChannel(
            'bass',
            transport.stepSeconds,
            ({ scheduleTime }) => {
                if (!this.playing) return;
                if (activePattern[bassStep]) {
                    this._scheduleBassNote(p, bassBus, bassOctave, transport.stepSeconds * 1.9, scheduleTime);
                }
                bassStep = (bassStep + 1) % transport.cycleSteps;
            }
        );

        if (!bassScheduled) {
            this.intervals.push(setInterval(() => {
                if (!this.playing) return;
                if (activePattern[bassStep]) {
                    this._scheduleBassNote(p, bassBus, bassOctave, transport.stepSeconds * 1.9);
                }
                bassStep = (bassStep + 1) % transport.cycleSteps;
            }, bassStepMs));
        }
    }

    _scheduleBassNote(p, dest, octScale, gateSeconds = 0.4, scheduledTime = null) {
        const ctx = this.ctx;
        // Bass always stays on the ROOT of the current chord for stability
        const chordBase = this._currentChordIntervals[0];
        const freq = this._getStepFrequency(p, chordBase, octScale);

        const osc = ctx.createOscillator();
        const sub = ctx.createOscillator();
        const env = ctx.createGain();

        // Sub-bass voice: Sine + Triangle for weight
        osc.type = 'triangle';
        sub.type = 'sine';
        osc.frequency.value = freq;
        sub.frequency.value = freq * 0.5;

        const now = Number.isFinite(scheduledTime) ? Math.max(ctx.currentTime, scheduledTime) : ctx.currentTime;
        const noteDur = Math.max(0.22, gateSeconds || 0.4);
        env.gain.setValueAtTime(0, now);
        env.gain.linearRampToValueAtTime(0.4, now + Math.min(0.03, noteDur * 0.18));
        env.gain.exponentialRampToValueAtTime(0.001, now + noteDur * 0.85);

        osc.connect(env); sub.connect(env);
        env.connect(dest);
        osc.start(now); sub.start(now);
        osc.stop(now + noteDur); sub.stop(now + noteDur);
        this.nodes.push(osc, sub, env);
    }

    // ── EFFECTS CONSTRUCTION ──────────────────────────────────────────
    _buildBitcrusher(bits, normFreq) {
        const ctx = this.ctx;
        if (ctx.audioWorklet && this._worklets.bitcrusherReady) {
            return new AudioWorkletNode(ctx, 'bitcrusher-processor', {
                numberOfInputs: 1,
                numberOfOutputs: 1,
                outputChannelCount: [2],
                parameterData: { bits, normFreq },
            });
        }

        // Fallback quantizer when worklets are unavailable.
        const shaper = ctx.createWaveShaper();
        const samples = 2048;
        const curve = new Float32Array(samples);
        const levels = Math.max(2, Math.pow(2, Math.max(1, bits)));
        for (let i = 0; i < samples; i++) {
            const x = (i * 2) / (samples - 1) - 1;
            curve[i] = Math.round(x * levels) / levels;
        }
        shaper.curve = curve;
        shaper.oversample = 'none';
        return shaper;
    }

    _buildPhaser() {
        const ctx = this.ctx;
        const input = ctx.createGain();
        const output = ctx.createGain();
        const stages = 4;
        const filters = [];

        // All-pass filters for phasing effect
        for (let i = 0; i < stages; i++) {
            const f = ctx.createBiquadFilter();
            f.type = 'allpass';
            f.frequency.value = 1000;
            filters.push(f);
        }

        for (let i = 0; i < stages - 1; i++) filters[i].connect(filters[i + 1]);
        input.connect(filters[0]);
        filters[stages - 1].connect(output);

        // Sweeping LFO
        const lfo = ctx.createOscillator();
        const lfoDepth = ctx.createGain();
        lfo.type = 'sine';
        lfo.frequency.value = 0.5;
        lfoDepth.gain.value = 800;
        lfo.connect(lfoDepth);

        filters.forEach(f => {
            lfoDepth.connect(f.frequency);
        });
        lfo.start();

        return { input, output, nodes: [...filters, lfo, lfoDepth, input, output] };
    }

    // ── HARMONIC PROGRESSION ──────────────────────────────────────────
    _updateChord() {
        if (!this.playing || !this._progression || !this._progression.length) return;

        this._chordName = this._normalizeChordSymbol(this._progression[this._chordIndex]);
        const c = this._chordName || 'I';
        const cKey = this._getChordFunctionKey(c);
        const intervals = this._buildScaleChord(c, this.planet);
        this._currentChordIntervals = intervals;

        // Dynamic Drone/Pad frequency ramping
        const now = this.ctx ? this.ctx.currentTime : 0;
        const ramp = 2.5; // seconds to smoothly glide

        if (this.harmonicNodes && this.ctx) {
            const rootPitch = this._getStepFrequency(this.planet, intervals[0], 1);
            if (this.harmonicNodes.baseOsc) this.harmonicNodes.baseOsc.frequency.linearRampToValueAtTime(rootPitch * 0.5, now + ramp);
            if (this.harmonicNodes.d1) this.harmonicNodes.d1.frequency.linearRampToValueAtTime(rootPitch, now + ramp);
            if (this.harmonicNodes.d2) this.harmonicNodes.d2.frequency.linearRampToValueAtTime(rootPitch * 2 + (this.planet?.droneDetune || 0), now + ramp);
            if (this.harmonicNodes.fmCarrier) this.harmonicNodes.fmCarrier.frequency.linearRampToValueAtTime(rootPitch, now + ramp);
            if (this.harmonicNodes.fmMod) this.harmonicNodes.fmMod.frequency.linearRampToValueAtTime(rootPitch * (this.planet?.ac?.fmRatio || 1), now + ramp);

            if (this.harmonicNodes.pads) {
                this.harmonicNodes.pads.forEach(pad => {
                    const interval = intervals[pad.stepIndex % intervals.length];
                    const oct = pad.stepIndex > 2 ? 2 : 1;
                    const targetFreq = this._getStepFrequency(this.planet, interval, (this.planet?.ac?.octScale || 1) * oct);
                    pad.osc.frequency.linearRampToValueAtTime(targetFreq + (targetFreq * pad.detuneRatio), now + ramp);
                });
            }
        }

        // ── MARKOV PROBABILISTIC SELECTION ──────────────────────────
        const transitions = {
            'I': { 'IV': 4, 'V': 5, 'vi': 3, 'ii': 2 },
            'ii': { 'V': 6, 'vi': 2, 'IV': 2 },
            'iii': { 'vi': 5, 'IV': 3, 'I': 2 },
            'IV': { 'I': 3, 'V': 5, 'ii': 2 },
            'V': { 'I': 7, 'vi': 2, 'iii': 1 },
            'vi': { 'IV': 4, 'ii': 3, 'V': 3 },
            'vii': { 'I': 8, 'iii': 2 },
            // Minor scale transitions
            'i': { 'iv': 4, 'v': 4, 'VI': 3, 'VII': 3 },
            'ii°': { 'v': 7, 'i': 3 },
            'III': { 'VI': 5, 'iv': 3, 'i': 2 },
            'iv': { 'i': 4, 'v': 4, 'ii°': 2 },
            'v': { 'i': 6, 'VI': 3, 'III': 1 },
            'VI': { 'iv': 4, 'ii°': 3, 'v': 3 },
            'VII': { 'III': 6, 'i': 4 }
        };

        const tMap = transitions[cKey] || {};
        let pool = [];
        this._progression.forEach((cand) => {
            const weight = tMap[this._getChordFunctionKey(cand)] || 1; // 1 represents a fallback equal likelihood if no rules exist
            for (let i = 0; i < weight; i++) pool.push(cand);
        });

        // Pick next chord from the Markov weighted pool
        const rng = new RNG((this.planet?.seed || 0) + 90000 + this.stepChord++);
        const nextTarget = pool.length ? rng.pick(pool) : this._progression[0];
        this._chordIndex = this._progression.indexOf(nextTarget);
        if (this._chordIndex === -1) this._chordIndex = 0;

        // ── VARIABLE CHORD DURATION BASED ON TENSION ────────────────
        // High tension chords (V, vii) might resolve faster, or hold for dramatic effect
        const isTension = ['V', 'vii', 'v', 'ii°'].includes(c);
        const isRest = ['I', 'i', 'vi', 'VI'].includes(c);

        const transport = this.transport || this._buildTransport(this.planet);
        let minCycles = 2, maxCycles = 3;
        if (['V', 'vii', 'v', 'ii'].includes(cKey)) { minCycles = 1; maxCycles = 2; }
        if (['I', 'i', 'vi', 'VI'].includes(cKey)) { minCycles = 2; maxCycles = 4; }
        if (transport.cycleSteps <= 8 && !['V', 'vii', 'v', 'ii'].includes(cKey)) {
            minCycles += 1;
            maxCycles += 1;
        }

        const chordCycles = rng.int(minCycles, maxCycles + 1);
        const durMs = transport.cycleMs * chordCycles;

        this._setManagedTimeout(() => this._updateChord(), durMs);
    }

    getChord() {
        return this._chordName || 'I';
    }
    getMelodyState() {
        const motifCount = this.planet?.motifBank?.length || 0;
        return {
            mode: this._melodyMode,
            phraseLength: this._phraseLength,
            restProb: this._restProb,
            motifEnabled: this._motifEnabled,
            motifIndex: motifCount ? this._activeMotifIdx + 1 : 0,
            motifCount,
            step: this._lastMelodyStep
        };
    }

    getDebugState() {
        const transport = this.transport || (this.planet ? this._buildTransport(this.planet) : null);
        const perf = this.planet ? this._getPerformanceProfile(this.planet) : null;
        const now = this.ctx?.currentTime || 0;
        const schedulerStats = this._transportScheduler?.getStats ? this._transportScheduler.getStats() : null;
        const moonLastProcAgoMs = Number.isFinite(this._lastMoonProcAt)
            ? Math.max(0, Math.round((now - this._lastMoonProcAt) * 1000))
            : null;
        return {
            activeNodes: this.nodes?.size || 0,
            load: perf?.pressure || 0,
            determinismMode: this._determinismMode,
            engineRefactorV2: this._engineRefactorV2,
            schedulerTickMs: schedulerStats?.tickMs || 0,
            schedulerHorizonMs: schedulerStats ? Math.round((schedulerStats.horizonSec || 0) * 1000) : 0,
            schedulerLateCallbacks: schedulerStats?.lateCallbacks || 0,
            schedulerMaxLateMs: schedulerStats ? Math.round(schedulerStats.maxLateMs || 0) : 0,
            tensionPhase: this._tensionState?.phase || 'DORMANT',
            tensionEnergy: this._tensionState?.energy || 0,
            cycleSteps: transport?.cycleSteps || 0,
            stepMs: transport ? Math.round(transport.stepMs) : 0,
            bpm: transport?.bpm || 0,
            moonCount: this._moonProfile?.length || this.planet?.numMoons || 0,
            moonProcCount: this._moonProcCount || 0,
            moonLastBurst: this._moonLastBurst || 0,
            moonLastProcAgoMs,
            moonProcActive: moonLastProcAgoMs !== null && moonLastProcAgoMs < 900,
        };
    }
}
