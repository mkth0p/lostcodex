import { RNG } from './rng.js';
import { NodeRegistry as CoreNodeRegistry } from './audio/core/node-registry.js';
import { buildTransport } from './audio/core/transport.js';
import { LookaheadScheduler } from './audio/core/scheduler.js';
import { DEFAULT_TENSION_PROFILE, BIOME_TENSION_PROFILES } from './audio/config/tension-profiles.js';
import { DEFAULT_DRUM_TONE, BIOME_DRUM_TONES } from './audio/config/drum-profiles.js';
import { buildTensionProfile, resolveRhythmState, resolveTensionState } from './audio/subsystems/tension.js';
import { fireClimaxEvent, startTensionArcLoop } from './audio/subsystems/tension-engine.js';
import {
    buildDrumToneProfile,
    buildPhasePatternBanks,
    fitPatternToCycle,
    getPhasePatternProfile,
    transformPhasePattern
} from './audio/subsystems/percussion.js';
import { euclideanPattern, startPercussionSequencer } from './audio/subsystems/percussion-sequencer.js';
import {
    getAdditiveVoiceLifetime as resolveAdditiveVoiceLifetime,
    getMelodyStride,
    getPerformanceProfile as resolvePerformanceProfile
} from './audio/subsystems/melody.js';
import { scheduleMelodyNote } from './audio/subsystems/melody-sequencer.js';
import {
    applyBiomeMelodyGesture,
    buildMoonProfile,
    getMoonWavePool,
    scheduleMoonCanons,
    shiftScaleStep
} from './audio/subsystems/moon.js';
import { startEnginePlayback } from './audio/subsystems/startup.js';
import {
    firePhaseTransitionEvent as emitPhaseTransitionEvent,
    fireSignatureMacroEvent as emitSignatureMacroEvent,
    getMacroEventChance,
    getMacroEventCooldown,
    spawnFxCluster,
    spawnFxNoise,
    spawnFxTone
} from './audio/subsystems/fx.js';
import { buildBitcrusherNode, buildPhaserGraph } from './audio/subsystems/effects-construction.js';
import { addChorusWidth, startGranularCloud } from './audio/subsystems/granular.js';
import { startNatureAmbience } from './audio/subsystems/ambience.js';
import {
    buildScaleChord,
    getChordDegreeIndex,
    getChordFunctionKey,
    normalizeChordSymbol,
    scheduleBassNote,
    startBassLine,
    updateChordProgression
} from './audio/subsystems/harmony.js';
import { updateChordProgressionLegacy } from './audio/legacy/chord-fallback.js';
import { resolveLegacyAudioToggles } from './audio/legacy/toggles.js';

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
        this._legacyAudioToggles = resolveLegacyAudioToggles();
        this._engineRefactorV2 = !this._legacyAudioToggles.chordProgressionFallback;
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

            // 20Hz DC-Offset Filter â€” prevents pops and subsonic build-up
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
        return buildTensionProfile({
            biomeId: planet?.biome?.id || 'default',
            melodyDensity: planet?.melodyDensity || 0.05,
            clamp: (value, min, max) => this._clamp(value, min, max),
            defaultProfile: DEFAULT_TENSION_PROFILE,
            biomeProfiles: BIOME_TENSION_PROFILES,
        });
    }

    _getDrumToneProfile(planet) {
        return buildDrumToneProfile({
            biomeId: planet?.biome?.id || 'default',
            defaultTone: DEFAULT_DRUM_TONE,
            biomeTones: BIOME_DRUM_TONES,
        });
    }

    _getPhasePatternProfile(biomeId) {
        return getPhasePatternProfile(biomeId);
    }

    _transformPhasePattern(pattern, voice, phaseCfg, rng) {
        return transformPhasePattern(pattern, voice, phaseCfg, rng);
    }

    _buildPhasePatternBanks(patterns, cycleSteps, seed, biomeId) {
        return buildPhasePatternBanks({
            patterns,
            cycleSteps,
            seed,
            biomeId
        });
    }

    _getMacroEventChance(biomeId, state) {
        return getMacroEventChance(
            biomeId,
            state,
            (value, min, max) => this._clamp(value, min, max)
        );
    }

    _getMacroEventCooldown(biomeId, phase, rng) {
        return getMacroEventCooldown(biomeId, phase, rng);
    }

    _spawnFxNoise(dest, opts = {}) {
        spawnFxNoise(this, dest, opts);
    }

    _spawnFxTone(dest, opts = {}) {
        spawnFxTone(this, dest, opts);
    }

    _spawnFxCluster(dest, opts = {}) {
        spawnFxCluster(this, dest, opts);
    }

    _firePhaseTransitionEvent(p, dest, fromPhase, toPhase) {
        emitPhaseTransitionEvent(this, p, dest, fromPhase, toPhase);
    }

    _fireSignatureMacroEvent(p, dest, state) {
        emitSignatureMacroEvent(this, p, dest, state);
    }

    _getTensionState(planet, stepIndex = 0) {
        const profile = this._tensionProfile || this._getTensionProfile(planet);
        return resolveTensionState({
            tensionProfile: profile,
            tension: this.tension,
            tensionTick: this._tensionTick,
            cycleSteps: Math.max(1, this.transport?.cycleSteps || planet?.ac?.stepCount || 16),
            stepIndex,
            climaxStartedDrain: this._climaxStartedDrain,
            climaxFired: this._climaxFired,
            clamp: (value, min, max) => this._clamp(value, min, max),
        });
    }

    _getRhythmState(planet, stepIndex, barCount, _rng) {
        return resolveRhythmState({
            planet,
            stepIndex,
            barCount,
            fillsEnabled: this._fillsEnabled,
            tensionState: this._getTensionState(planet, stepIndex),
            clamp: (value, min, max) => this._clamp(value, min, max),
        });
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
        return fitPatternToCycle(pattern, targetLength);
    }

    _getMelodyStride(planet, cycleSteps) {
        return getMelodyStride({
            melodyDensity: planet?.melodyDensity || 0.05,
            cycleSteps,
            clamp: (value, min, max) => this._clamp(value, min, max),
        });
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
        return resolveAdditiveVoiceLifetime(name, atk, dur);
    }

    _getPerformanceProfile(planet) {
        return resolvePerformanceProfile({
            melodyDensity: planet?.melodyDensity || 0.05,
            stepSeconds: this.transport?.stepSeconds || 0.125,
            activeNodes: this.nodes?.size || 0,
            clamp: (value, min, max) => this._clamp(value, min, max),
        });
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
        return getMoonWavePool(planet);
    }

    _buildMoonProfile(planet) {
        return buildMoonProfile(this, planet);
    }

    _shiftScaleStep(planet, baseStep, degreeShift = 0, octaveOffset = 0) {
        return shiftScaleStep(planet, baseStep, degreeShift, octaveOffset);
    }

    // Each moon acts like a quiet satellite canon: a delayed, scale-aware answer to the lead line.
    _scheduleMoonCanons(planet, dest, step, meta = {}) {
        scheduleMoonCanons(this, planet, dest, step, meta);
    }

    _applyBiomeMelodyGesture(planet, wType, mode, phrasePos, isPhraseEnd, atk, dur) {
        return applyBiomeMelodyGesture(planet, wType, mode, phrasePos, isPhraseEnd, atk, dur);
    }

    _markMelodyVoiceUsage(wType, planet) {
        if (!this.ctx || !MELODY_VOICE_COOLDOWNS[wType]) return;
        const perf = this._getPerformanceProfile(planet);
        this._voiceCooldowns[wType] = this.ctx.currentTime + (MELODY_VOICE_COOLDOWNS[wType] * (0.8 + perf.pressure * 0.9));
    }

    _normalizeChordSymbol(symbol) {
        return normalizeChordSymbol(symbol);
    }

    _getChordFunctionKey(symbol) {
        return getChordFunctionKey(symbol);
    }

    _getChordDegreeIndex(symbol, scaleLength) {
        return getChordDegreeIndex(symbol, scaleLength);
    }

    _buildScaleChord(symbol, planet) {
        return buildScaleChord(symbol, planet);
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
        scheduleMelodyNote(this, planet, dest, ac, scheduledTime);
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

    //    GRANULAR SYNTHESIS                                              
    _startGranular(p, dest) {
        startGranularCloud(this, p, dest);
    }

    //    CHORUS / STEREO WIDENING                                        
    // 3 voices, each: short delay + LFO wobble + stereo pan â†’ into wet bus
    _addChorus(source, dest, ac) {
        addChorusWidth(this, source, dest, ac);
    }

    //    SIDECHAIN DUCK                                                  
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

    //    TIER 2: PERCUSSION SEQUENCER                                   
    // Euclidean rhythm helper: distributes k hits evenly over n steps
    _euclidean(k, n) {
        return euclideanPattern(k, n);
    }


    _startPercussion(p, dest) {
        startPercussionSequencer(this, p, dest);
    }


    //    TIER 2: HARMONIC TENSION ARC                                   
    // Tension rises from 0 â†’1 over ~60 seconds while listening.
    // It modulates filter, LFO, melody density, and dissonance.
    // At tension â‰¥0.85 a climax chord fires then tension resets to 0.45.
    _startTensionArc(p, filt) {
        startTensionArcLoop(this, p, filt);
    }


    // Fires a rich swelling chord at climax, then fades
    _fireClimax(p, dest) {
        fireClimaxEvent(this, p, dest);
    }


    _startNatureAmbiance(p, dest) {
        startNatureAmbience(this, p, dest);
    }

    //    TIER 3: DOPPLER WHOOSH                                         
    // Synthesises a descending-frequency noise burst suggesting spatial travel.
    // Call on navigation â€” plays through the analyser so the scope reacts to it.
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
                const fInst = 3200 * Math.exp(-t * 3); // sweeps 3200 â†’ ~60 Hz
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
        src.onended = () => { try { src.disconnect(); g.disconnect(); } catch { } };
    }

    start(planet) {
        startEnginePlayback(this, planet);
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
            } catch { }
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
        try { listener(this._snapshotState()); } catch { }
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

    //    BASS LINE GENERATOR                                            
    _startBass(p, dest) {
        startBassLine(this, p, dest);
    }

    _scheduleBassNote(p, dest, octScale, gateSeconds = 0.4, scheduledTime = null) {
        scheduleBassNote(this, p, dest, octScale, gateSeconds, scheduledTime);
    }

    //    EFFECTS CONSTRUCTION                                           
    _buildBitcrusher(bits, normFreq) {
        return buildBitcrusherNode(this, bits, normFreq);
    }

    _buildPhaser() {
        return buildPhaserGraph(this);
    }

    //    HARMONIC PROGRESSION                                           
    _updateChord() {
        if (this._legacyAudioToggles.chordProgressionFallback) {
            updateChordProgressionLegacy(this);
            return;
        }
        updateChordProgression(this);
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
