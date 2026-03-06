import { RNG } from '../../../rng.js';
import { ADDITIVE_VOICE_NAMES, buildVoice } from '../../../voices.js';
import {
    triggerHat,
    triggerKick,
    triggerNoiseWash,
    triggerShaker,
    triggerSnare,
    triggerTom,
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

function chooseMelodyVoice(planet, rng, voiceHint = null, section = 'INTRO') {
    const available = Array.isArray(planet?.ac?.melodyWaves) && planet.ac.melodyWaves.length
        ? planet.ac.melodyWaves
        : ['sine'];
    if (voiceHint && available.includes(voiceHint)) return voiceHint;
    if (voiceHint && ADDITIVE_VOICE_NAMES.includes(voiceHint)) return voiceHint;

    let pool = available.slice();
    const biomeId = planet?.biome?.id || 'default';
    if (SOFT_BIOMES.has(biomeId)) {
        const softened = pool.filter((voice) => !HARSH_ADDITIVE_VOICES.has(voice));
        if (softened.length) pool = softened;
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
                    triggerShaker(host, dest, when, velocity * 0.7, seed + 77);
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
        const rng = new RNG(this.seedBase + host.stepChord * 59 + host.stepNote * 3);

        const dur = clamp(durationSec, 2.2, 12);
        const ttlSec = dur + 1.2;
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

        const droneOsc = ctx.createOscillator();
        const padOsc = ctx.createOscillator();
        const droneFilter = ctx.createBiquadFilter();
        const padFilter = ctx.createBiquadFilter();
        const droneEnv = ctx.createGain();
        const padEnv = ctx.createGain();
        const motionLfo = ctx.createOscillator();
        const motionGain = ctx.createGain();

        const droneWave = host._resolveOscType(planet?.ac?.droneWave || 'sine', 'sine');
        const padWave = host._resolveOscType(planet?.ac?.padWave || 'triangle', 'triangle');
        const droneFreq = host._getStepFrequency(planet, rootStep, 0.75);
        const padFreq = host._getStepFrequency(planet, colorStep, 1.05);
        const filterBase = clamp(planet?.ac?.filterBase || 1100, 160, 5200);
        const attack = clamp(0.7 + (modulation.space || 0.5) * 0.7, 0.4, 1.8);
        const droneLevel = clamp(0.09 + (modulation.texture || 0.5) * 0.08 + (planet?.ac?.chordAudibility || 0.3) * 0.08, 0.07, 0.24);
        const padLevel = clamp(0.08 + (modulation.space || 0.5) * 0.09 + (planet?.ac?.chordAudibility || 0.3) * 0.06, 0.06, 0.22);

        droneOsc.type = droneWave;
        padOsc.type = padWave;
        droneOsc.frequency.value = droneFreq;
        padOsc.frequency.value = padFreq;

        droneFilter.type = 'lowpass';
        droneFilter.frequency.value = clamp(filterBase * 1.8, 240, 4400);
        droneFilter.Q.value = 0.5;
        padFilter.type = 'lowpass';
        padFilter.frequency.value = clamp(filterBase * 2.5, 420, 6800);
        padFilter.Q.value = 0.62;

        motionLfo.frequency.value = 0.025 + (modulation.motion || 0.5) * 0.08;
        motionGain.gain.value = 5 + (modulation.motion || 0.5) * 12;
        motionLfo.connect(motionGain);
        motionGain.connect(droneOsc.detune);
        motionGain.connect(padOsc.detune);

        droneEnv.gain.setValueAtTime(0.0001, scheduleTime);
        droneEnv.gain.linearRampToValueAtTime(droneLevel, scheduleTime + attack);
        droneEnv.gain.setValueAtTime(droneLevel * 0.9, scheduleTime + dur * 0.75);
        droneEnv.gain.exponentialRampToValueAtTime(0.0001, scheduleTime + dur);

        padEnv.gain.setValueAtTime(0.0001, scheduleTime);
        padEnv.gain.linearRampToValueAtTime(padLevel, scheduleTime + attack * 1.1);
        padEnv.gain.setValueAtTime(padLevel * 0.86, scheduleTime + dur * 0.72);
        padEnv.gain.exponentialRampToValueAtTime(0.0001, scheduleTime + dur);

        droneOsc.connect(droneFilter);
        droneFilter.connect(droneEnv);
        droneEnv.connect(this.buses.layerGains.drones);

        padOsc.connect(padFilter);
        padFilter.connect(padEnv);
        padEnv.connect(this.buses.layerGains.pads);

        motionLfo.start(scheduleTime);
        motionLfo.stop(scheduleTime + dur + 0.2);
        droneOsc.start(scheduleTime);
        droneOsc.stop(scheduleTime + dur + 0.03);
        padOsc.start(scheduleTime);
        padOsc.stop(scheduleTime + dur + 0.03);

        host.nodes.pushTransient(ttlSec, droneOsc, padOsc, droneFilter, padFilter, droneEnv, padEnv, motionLfo, motionGain);

        const signatureVoices = {
            crystalline: ['crystal_chimes', 'wavetable_morph', 'glass'],
            volcanic: ['bowed_metal', 'subpad', 'modal_resonator'],
            psychedelic: ['vowel_morph', 'phase_cluster', 'wavetable_morph'],
            desert: ['hollow_pipe', 'bowed_metal', 'pluck'],
            organic: ['hollow_pipe', 'marimba', 'drone_morph'],
            ethereal: ['drone_morph', 'vowel_morph', 'choir'],
            quantum: ['phase_cluster', 'wavetable_morph', 'granular_cloud'],
            nebula: ['vowel_morph', 'wavetable_morph', 'drone_morph'],
            glacial: ['granular_cloud', 'wavetable_morph'],
            arctic: ['granular_cloud', 'crystal_chimes'],
            oceanic: ['drone_morph', 'vowel_morph'],
            fungal: ['marimba', 'hollow_pipe', 'modal_resonator'],
            abyssal: ['gong', 'modal_resonator'],
            storm: ['phase_cluster', 'bowed_metal', 'subpad'],
            corrupted: ['phase_cluster', 'modal_resonator', 'granular_cloud'],
            crystalloid: ['crystal_chimes', 'modal_resonator', 'wavetable_morph'],
            barren: ['drone_morph', 'vowel_morph'],
            default: ['drone_morph', 'wavetable_morph'],
        };
        const voicePool = signatureVoices[planet?.biome?.id] || signatureVoices.default;
        if (rng.bool(0.46 + (modulation.texture || 0.5) * 0.2)) {
            const accentVoice = rng.pick(voicePool);
            const accentGain = ctx.createGain();
            const accentAttack = clamp(attack * 1.15, 0.5, 2.4);
            const accentDur = clamp(dur * 0.92, 2, 11);
            accentGain.gain.setValueAtTime(0.0001, scheduleTime);
            accentGain.gain.linearRampToValueAtTime(clamp(droneLevel * 0.55, 0.04, 0.12), scheduleTime + accentAttack);
            accentGain.gain.exponentialRampToValueAtTime(0.0001, scheduleTime + accentDur);
            accentGain.connect(this.buses.layerGains.drones);
            buildVoice(accentVoice, ctx, droneFreq * rng.range(0.5, 1.3), accentGain, rng, accentAttack, accentDur, host.nodes);
            host.nodes.pushTransient(ttlSec, accentGain);
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
        const dur = clamp(durationSec, 1.2, 8);
        const ttlSec = dur + 0.5;
        const booking = this.voicePool.requestVoice({
            nowSec: ctx.currentTime,
            ttlSec,
            kind: 'chord',
            weight: 1.3,
        });
        if (!booking.granted) return false;

        const rng = new RNG(this.seedBase + host.stepChord * 41 + this.host.stepNote * 7);
        const chordOut = ctx.createGain();
        const chordFilter = ctx.createBiquadFilter();
        const attack = clamp(0.35 + (modulation.space || 0.5) * 0.5, 0.2, 1.2);
        const level = clamp(0.08 + (planet?.ac?.chordAudibility || 0.3) * 0.14 + (modulation.texture || 0.5) * 0.06, 0.05, 0.22);
        const filterBase = clamp((planet?.ac?.filterBase || 1200) * 2.2, 380, 7600);
        const wave = this.host._resolveOscType(planet?.ac?.padWave || 'triangle', 'triangle');

        chordFilter.type = 'lowpass';
        chordFilter.frequency.value = filterBase;
        chordFilter.Q.value = 0.7;
        chordOut.gain.setValueAtTime(0.0001, scheduleTime);
        chordOut.gain.linearRampToValueAtTime(level, scheduleTime + attack);
        chordOut.gain.setValueAtTime(level * 0.86, scheduleTime + dur * 0.68);
        chordOut.gain.exponentialRampToValueAtTime(0.0001, scheduleTime + dur);
        chordOut.connect(this.buses.layerGains.pads);

        const octaveMul = [1.7, 1.9, 2.05];
        const nodes = [chordOut, chordFilter];
        intervals.forEach((step, idx) => {
            const osc = ctx.createOscillator();
            const voiceGain = ctx.createGain();
            const quarterTone = (planet?.quarterToneProb || 0) > 0 && rng.bool((planet?.quarterToneProb || 0) * 0.7)
                ? rng.pick([-50, 50])
                : 0;
            osc.type = wave;
            osc.frequency.value = host._getStepFrequency(planet, step, octaveMul[idx] || 1.8);
            osc.detune.value = quarterTone + rng.range(-8, 8);
            voiceGain.gain.value = 1 / (2.8 + idx * 0.4);
            osc.connect(voiceGain);
            voiceGain.connect(chordFilter);
            osc.start(scheduleTime);
            osc.stop(scheduleTime + dur + 0.03);
            nodes.push(osc, voiceGain);
        });

        chordFilter.connect(chordOut);
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
        const seed = this.seedBase + host.stepGrain * 307;
        const rng = new RNG(seed);
        const dur = clamp(3.4 + (modulation.space || 0.5) * 3.1, 2.8, 9.2);
        const ttlSec = dur + 0.9;
        const booking = this.voicePool.requestVoice({
            nowSec: ctx.currentTime,
            ttlSec,
            kind: 'ambience',
            weight: 1.35,
        });
        if (!booking.granted) return false;

        const ambienceOut = ctx.createGain();
        const ambienceLevel = clamp(0.06 + (modulation.ambienceGainMul || 1) * 0.06, 0.04, 0.18);
        const ambienceAttack = clamp(dur * 0.26, 0.8, 2.7);
        ambienceOut.gain.setValueAtTime(0.0001, scheduleTime);
        ambienceOut.gain.linearRampToValueAtTime(ambienceLevel, scheduleTime + ambienceAttack);
        ambienceOut.gain.setValueAtTime(ambienceLevel * 0.86, scheduleTime + dur * 0.72);
        ambienceOut.gain.exponentialRampToValueAtTime(0.0001, scheduleTime + dur);
        ambienceOut.connect(this.buses.layerGains.ambience);

        const pool = AMBIENCE_VOICE_POOLS[biomeId] || ['granular_cloud', 'drone_morph', 'vowel_morph', 'wavetable_morph'];
        let choice = rng.pick(pool);
        if (choice === 'granular_cloud' && SOFT_BIOMES.has(biomeId) && rng.bool(0.68)) {
            choice = rng.pick(['drone_morph', 'vowel_morph', 'wavetable_morph']);
        }
        const chord = Array.isArray(host._currentChordIntervals) && host._currentChordIntervals.length
            ? host._currentChordIntervals
            : (Array.isArray(planet.scale) && planet.scale.length ? planet.scale.slice(0, 3) : [0, 4, 7]);
        const step = rng.pick(chord);
        const octave = SOFT_BIOMES.has(biomeId) ? rng.pick([1, 2]) : rng.pick([1, 2, 3]);
        const freq = host._getStepFrequency(planet, step || 0, octave);
        const voiceAtk = choice === 'granular_cloud' ? Math.max(1.0, ambienceAttack * 0.9) : ambienceAttack;
        const voiceDur = choice === 'granular_cloud' ? Math.max(3.4, dur * 0.84) : dur;
        buildVoice(choice, ctx, freq, ambienceOut, rng, voiceAtk, voiceDur, host.nodes);

        if (NOISE_AMBIENCE_BIOMES.has(biomeId) && rng.bool(0.18 + (modulation.dissonance || 0.2) * 0.22)) {
            const noiseGain = clamp(0.02 + (modulation.dissonance || 0.2) * 0.04, 0.015, 0.08);
            triggerNoiseWash(host, this.buses.layerGains.ambience, scheduleTime + rng.range(0.05, 0.22), dur * 0.66, noiseGain, seed + 701);
        }

        host.nodes.pushTransient(ttlSec, ambienceOut);
        this.lastAmbienceAt = scheduleTime;
        scheduleRelease(this.voicePool, booking.id, ttlSec);
        return true;
    }

    playFxPulse(scheduleTime, modulation = {}) {
        const host = this.host;
        const ctx = host.ctx;
        const osc = ctx.createOscillator();
        const env = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(230 + (modulation.dissonance || 0.2) * 210, scheduleTime);
        osc.frequency.exponentialRampToValueAtTime(130, scheduleTime + 0.32);
        env.gain.setValueAtTime(0.0001, scheduleTime);
        env.gain.linearRampToValueAtTime(0.04, scheduleTime + 0.03);
        env.gain.exponentialRampToValueAtTime(0.0001, scheduleTime + 0.35);
        osc.connect(env);
        env.connect(this.buses.layerGains.fx);
        osc.start(scheduleTime);
        osc.stop(scheduleTime + 0.4);
        host.nodes.pushTransient(0.62, osc, env);
    }
}
