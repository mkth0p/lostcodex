import { DroneSources } from './drone-sources.js';
import { LoopBuffer } from './loop-buffer.js';
import { FilterRouter } from './filter-router.js';
import { ResonatorBank } from './resonator-bank.js';
import { EchoEngine } from './echo-engine.js';
import { AmbienceEngine } from './ambience-engine.js';
import { DroneModMatrix } from './mod-matrix-drone.js';
import { DroneRandomizer } from './randomizer.js';
import {
    DEFAULT_DRONE_EXPERT,
    DEFAULT_DRONE_MACROS,
    mapDroneMacrosToExpert,
    normalizeDroneExpert,
    normalizeDroneMacros,
    toDroneGenome,
} from './drone-macro-map.js';
import { DroneQualityPolicy } from './drone-quality-policy.js';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const BIOME_DRONE_PALETTES = {
    crystalline: { source: 'wavetable', brightness: 0.62, resonatorCap: 0.74, diffusionCap: 0.92, gain: 0.95 },
    volcanic: { source: 'supersaw', brightness: 0.56, resonatorCap: 0.82, diffusionCap: 0.68, gain: 0.9 },
    psychedelic: { source: 'hybrid', brightness: 0.72, resonatorCap: 0.76, diffusionCap: 0.84, gain: 0.94 },
    desert: { source: 'sine', brightness: 0.48, resonatorCap: 0.62, diffusionCap: 0.72, gain: 0.78 },
    oceanic: { source: 'hybrid', brightness: 0.52, resonatorCap: 0.62, diffusionCap: 0.9, gain: 1.02 },
    corrupted: { source: 'supersaw', brightness: 0.64, resonatorCap: 0.86, diffusionCap: 0.72, gain: 0.86 },
    barren: { source: 'sine', brightness: 0.32, resonatorCap: 0.52, diffusionCap: 0.7, gain: 0.58 },
    organic: { source: 'hybrid', brightness: 0.5, resonatorCap: 0.66, diffusionCap: 0.76, gain: 0.88 },
    ethereal: { source: 'wavetable', brightness: 0.62, resonatorCap: 0.66, diffusionCap: 0.92, gain: 1.04 },
    quantum: { source: 'hybrid', brightness: 0.68, resonatorCap: 0.86, diffusionCap: 0.8, gain: 0.88 },
    glacial: { source: 'sine', brightness: 0.44, resonatorCap: 0.58, diffusionCap: 0.88, gain: 0.9 },
    fungal: { source: 'hybrid', brightness: 0.5, resonatorCap: 0.7, diffusionCap: 0.76, gain: 0.9 },
    abyssal: { source: 'supersaw', brightness: 0.46, resonatorCap: 0.82, diffusionCap: 0.78, gain: 1.02 },
    nebula: { source: 'hybrid', brightness: 0.68, resonatorCap: 0.72, diffusionCap: 0.96, gain: 1.06 },
    arctic: { source: 'sine', brightness: 0.42, resonatorCap: 0.56, diffusionCap: 0.86, gain: 0.88 },
    storm: { source: 'supersaw', brightness: 0.58, resonatorCap: 0.78, diffusionCap: 0.74, gain: 0.84 },
    crystalloid: { source: 'wavetable', brightness: 0.64, resonatorCap: 0.74, diffusionCap: 0.82, gain: 0.94 },
    default: { source: 'hybrid', brightness: 0.55, resonatorCap: 0.72, diffusionCap: 0.84, gain: 0.9 },
};

function resolvePalette(biomeId = 'default') {
    return BIOME_DRONE_PALETTES[biomeId] || BIOME_DRONE_PALETTES.default;
}

function resolveFloorMix(sourceMode = 'hybrid') {
    switch (sourceMode) {
        case 'sine':
            return { root: 1, sub: 0.88, color: 0.12 };
        case 'supersaw':
            return { root: 0.26, sub: 0.24, color: 1 };
        case 'wavetable':
            return { root: 0.34, sub: 0.28, color: 0.86 };
        default:
            return { root: 0.72, sub: 0.48, color: 0.7 };
    }
}

function resolveFloorColorWave(sourceMode = 'hybrid') {
    if (sourceMode === 'supersaw') return 'sawtooth';
    if (sourceMode === 'wavetable') return 'triangle';
    if (sourceMode === 'sine') return 'sine';
    return 'triangle';
}

export class DroneEngine {
    constructor({ host, buses, eventBus } = {}) {
        this.host = host;
        this.ctx = host?.ctx;
        this.buses = buses;
        this.eventBus = eventBus;
        this.active = false;

        this.macros = { ...DEFAULT_DRONE_MACROS };
        this.expert = { ...DEFAULT_DRONE_EXPERT };
        this.genome = toDroneGenome(host?.planet);
        this.palette = resolvePalette(host?.planet?.biome?.id);

        const seed = host?.planet?.seed || 1;
        this.modMatrix = new DroneModMatrix(seed + 17117);
        this.randomizer = new DroneRandomizer(seed + 19211);
        this.qualityPolicy = new DroneQualityPolicy();
        this.sources = new DroneSources(host);

        this.loopBuffer = new LoopBuffer(this.ctx, { maxSeconds: 5 });
        this.filterRouter = new FilterRouter(this.ctx);
        this.resonator = new ResonatorBank(this.ctx);
        this.echo = new EchoEngine(this.ctx);
        this.ambience = new AmbienceEngine(this.ctx, seed + 21103);

        this.input = this.ctx.createGain();
        this.preCaptureTap = this.ctx.createGain();
        this.preCaptureRoute = this.ctx.createGain();
        this.postCaptureRoute = this.ctx.createGain();
        this.loopReturnGain = this.ctx.createGain();
        this.mainOut = this.ctx.createGain();
        this.padsSend = this.ctx.createGain();
        this.ambienceSend = this.ctx.createGain();
        this.resonatorBypass = this.ctx.createGain();
        this.dryBodySend = this.ctx.createGain();

        this.input.gain.value = 1;
        this.preCaptureTap.gain.value = 1;
        this.preCaptureRoute.gain.value = 1;
        this.postCaptureRoute.gain.value = 0;
        this.loopReturnGain.gain.value = 0.24;
        this.mainOut.gain.value = 0.64;
        this.padsSend.gain.value = 0.22;
        this.ambienceSend.gain.value = 0.18;
        this.resonatorBypass.gain.value = 0.34;
        this.dryBodySend.gain.value = 0.48;

        this.input.connect(this.filterRouter.input);
        this.filterRouter.output.connect(this.resonator.input);
        this.filterRouter.output.connect(this.resonatorBypass);
        this.filterRouter.output.connect(this.dryBodySend);
        this.resonatorBypass.connect(this.echo.input);
        this.resonator.output.connect(this.echo.input);
        this.echo.output.connect(this.ambience.input);
        this.ambience.output.connect(this.mainOut);
        this.dryBodySend.connect(this.mainOut);

        this.loopBuffer.output.connect(this.loopReturnGain);
        this.loopReturnGain.connect(this.input);

        this.preCaptureTap.connect(this.preCaptureRoute);
        this.preCaptureRoute.connect(this.loopBuffer.input);
        this.mainOut.connect(this.postCaptureRoute);
        this.postCaptureRoute.connect(this.loopBuffer.input);

        this.mainOut.connect(this.buses.layerGains.drones);
        this.mainOut.connect(this.padsSend);
        this.mainOut.connect(this.ambienceSend);
        this.padsSend.connect(this.buses.layerGains.pads);
        this.ambienceSend.connect(this.buses.layerGains.ambience);

        this.host.nodes.push(
            this.input,
            this.preCaptureTap,
            this.preCaptureRoute,
            this.postCaptureRoute,
            this.loopReturnGain,
            this.mainOut,
            this.padsSend,
            this.ambienceSend,
            this.resonatorBypass,
            this.dryBodySend,
            this.loopBuffer.input,
            this.loopBuffer.captureGain,
            this.loopBuffer.delay,
            this.loopBuffer.feedback,
            this.loopBuffer.tone,
            this.loopBuffer.output,
            this.filterRouter.input,
            this.filterRouter.output,
            this.filterRouter.filter,
            ...this.filterRouter.stages,
            this.resonator.input,
            this.resonator.output,
            this.resonator.feedback,
            ...this.resonator.filters,
            ...this.resonator.gains,
            this.echo.input,
            this.echo.output,
            this.echo.preTone,
            this.echo.delayL,
            this.echo.delayR,
            this.echo.gainL,
            this.echo.gainR,
            this.echo.feedbackLtoR,
            this.echo.feedbackRtoL,
            this.echo.panL,
            this.echo.panR,
            this.ambience.input,
            this.ambience.output,
            this.ambience.dry,
            this.ambience.wet,
            this.ambience.preDelay,
            this.ambience.convolver,
            this.ambience.tone,
        );

        this.captureMode = 'toggle';
        this.captureUntil = 0;
        this.lastQuality = this.qualityPolicy.resolve();
        this.lastMod = this.modMatrix.resolve({});
        this.lastMacroMod = {};
        this.lastMapped = normalizeDroneExpert(DEFAULT_DRONE_EXPERT);
        this.lastSection = 'INTRO';
        this.floor = null;
        this.userVolume = 0.92;
        this.state = {
            loopFill: 0,
            loopDirection: 'forward',
            filterPosition: this.expert.filterPosition,
            resonatorEnergy: 0,
            echoDensity: 0,
            ambienceDepth: 0,
            modAmount: 0,
            randomizerDepth: 0,
            outputLevel: this.mainOut.gain.value * this.userVolume,
        };
    }

    activate(planet) {
        this.active = true;
        this.genome = toDroneGenome(planet);
        this.palette = resolvePalette(planet?.biome?.id);
        this.modMatrix.setSeed((planet?.seed || 1) + 17117);
        this.randomizer.setSeed((planet?.seed || 1) + 19211);
        if (!this.expert.sourceMode || this.expert.sourceMode === 'hybrid') {
            this.expert.sourceMode = this.palette.source;
        }
        this._applyRouting();
        this._startContinuousFloor();
        this._refreshRealtimeParams();
    }

    deactivate() {
        this.active = false;
        this.loopBuffer.setCaptureEnabled(false);
        this.captureUntil = 0;
        this._stopContinuousFloor();
    }

    setMacros(next = {}) {
        this.macros = normalizeDroneMacros({ ...this.macros, ...next });
        this._refreshRealtimeParams();
    }

    setExpert(next = {}) {
        this.expert = normalizeDroneExpert({ ...this.expert, ...next });
        this._applyRouting();
        this._refreshRealtimeParams();
    }

    setOutputLevel(level = 0.92) {
        if (!Number.isFinite(level)) return;
        this.userVolume = clamp(level, 0, 1.4);
        this._refreshRealtimeParams();
    }

    _userGainFactor() {
        const norm = clamp(this.userVolume / 1.4, 0, 1);
        return Math.pow(norm, 0.9) * 5.4;
    }

    setVariationSeed(seed) {
        if (!Number.isFinite(seed)) return;
        this.randomizer.setSeed(Math.round(seed));
        this.modMatrix.setSeed(Math.round(seed));
    }

    captureLoop({ mode = 'toggle', source = 'pre' } = {}) {
        this.captureMode = mode === 'momentary' ? 'momentary' : 'toggle';
        const sourceMode = source === 'post' ? 'post' : 'pre';
        this.expert = normalizeDroneExpert({ ...this.expert, looperSource: sourceMode });

        if (this.captureMode === 'momentary') {
            this.captureUntil = (this.ctx?.currentTime || 0) + 2.4;
            this.loopBuffer.setCaptureEnabled(true);
        } else {
            this.loopBuffer.setCaptureEnabled(!this.loopBuffer.captureEnabled);
            this.captureUntil = 0;
        }
        this._applyRouting();
        return this.getState();
    }

    randomize({ target = 'all', intensity = 0.5, action = 'apply' } = {}) {
        this.expert = this.randomizer.apply({
            target,
            intensity,
            action,
            state: this.expert,
        });
        this.state.randomizerDepth = clamp(Number.isFinite(intensity) ? intensity : this.state.randomizerDepth, 0, 1);
        this._applyRouting();
        this._refreshRealtimeParams();
        return this.getState();
    }

    schedule({ scheduleTime = 0, durationSec = 6, section = 'INTRO', modulation = {}, quality = {} } = {}) {
        if (!this.active) return false;

        this.lastMacroMod = modulation || {};
        this.lastQuality = this.qualityPolicy.resolve({
            qualityScalar: quality.qualityScalar ?? 1,
            backgroundMode: this.host?._backgroundMode || 'foreground-realtime',
            cpuClass: quality.cpuClass || this.host?._v2Engine?.lastQuality?.cpuClass || 'desktop-mid',
        });
        this.lastSection = section;

        const mappedBase = mapDroneMacrosToExpert(this.macros, this.expert, this.genome);
        const mapped = {
            ...mappedBase,
            resonatorFeedback: clamp(mappedBase.resonatorFeedback, 0, this.palette.resonatorCap),
            ambienceSpacetime: clamp(mappedBase.ambienceSpacetime, 0, this.palette.diffusionCap),
        };
        this.lastMapped = mapped;
        this._updateContinuousFloorFrequencies(mapped, scheduleTime);

        this.modMatrix.setControls({
            master: mapped.modMaster,
            rate: mapped.modRate,
            routing: mapped.modRouting,
        });
        this.lastMod = this.modMatrix.resolve({
            scheduleTime,
            section,
            qualityScalar: this.lastQuality.qualityScalar,
        });

        if (this.captureMode === 'momentary' && this.captureUntil > 0 && this.ctx.currentTime >= this.captureUntil) {
            this.loopBuffer.setCaptureEnabled(false);
            this.captureUntil = 0;
        }

        this._applyParams(mapped, this.lastMod, modulation);

        const triggered = this.sources.trigger({
            scheduleTime,
            durationSec,
            params: {
                sourceMode: mapped.sourceMode || this.palette.source,
                dream: this.macros.dream,
                texture: this.macros.texture,
                motion: this.macros.motion,
                resonance: this.macros.resonance,
                diffusion: this.macros.diffusion,
                tail: this.macros.tail,
            },
            modulation: this.lastMod,
            quality: this.lastQuality,
            output: this.input,
            preCapture: this.preCaptureTap,
            section,
        });

        this.state.loopFill = this.loopBuffer.tick(durationSec);
        this.state.loopDirection = this.loopBuffer.direction;
        this.state.filterPosition = mapped.filterPosition;
        this.state.resonatorEnergy = this.resonator.getEnergyEstimate();
        this.state.echoDensity = this.echo.getDensityEstimate();
        this.state.ambienceDepth = this.ambience.getDepthEstimate();
        this.state.modAmount = this.lastMod.motionDepth;
        this.state.outputLevel = this.mainOut.gain.value;

        this.eventBus?.emit({
            type: 'drone-frame',
            section,
            degradeStage: this.lastQuality.degradeStage,
            loopFill: this.state.loopFill,
            sourceMode: mapped.sourceMode,
            ttlSec: triggered?.ttlSec || 0,
            engineMode: 'v2',
        });

        return true;
    }

    _refreshRealtimeParams() {
        if (!this.active || !this.ctx) return;
        const mappedBase = mapDroneMacrosToExpert(this.macros, this.expert, this.genome);
        const mapped = {
            ...mappedBase,
            resonatorFeedback: clamp(mappedBase.resonatorFeedback, 0, this.palette.resonatorCap),
            ambienceSpacetime: clamp(mappedBase.ambienceSpacetime, 0, this.palette.diffusionCap),
        };
        this.lastMapped = mapped;
        this.modMatrix.setControls({
            master: mapped.modMaster,
            rate: mapped.modRate,
            routing: mapped.modRouting,
        });
        this.lastMod = this.modMatrix.resolve({
            scheduleTime: this.ctx.currentTime,
            section: this.lastSection,
            qualityScalar: this.lastQuality?.qualityScalar || 1,
        });
        this._updateContinuousFloorFrequencies(mapped, this.ctx.currentTime);
        this._applyParams(mapped, this.lastMod, this.lastMacroMod || this.host?._macroControls || {});
        this.state.filterPosition = mapped.filterPosition;
        this.state.outputLevel = this.mainOut.gain.value;
    }

    _applyRouting() {
        const sourceMode = this.expert.looperSource === 'post' ? 'post' : 'pre';
        this.loopBuffer.setSourceMode(sourceMode);
        this.preCaptureRoute.gain.linearRampToValueAtTime(sourceMode === 'pre' ? 1 : 0, this.ctx.currentTime + 0.05);
        this.postCaptureRoute.gain.linearRampToValueAtTime(sourceMode === 'post' ? 1 : 0, this.ctx.currentTime + 0.05);
    }

    _startContinuousFloor() {
        if (!this.ctx || this.floor) return;
        const ctx = this.ctx;
        const bus = ctx.createGain();
        const tone = ctx.createBiquadFilter();
        const pan = ctx.createStereoPanner();
        const captureTap = ctx.createGain();
        const rootOsc = ctx.createOscillator();
        const subOsc = ctx.createOscillator();
        const colorOsc = ctx.createOscillator();
        const rootGain = ctx.createGain();
        const subGain = ctx.createGain();
        const colorGain = ctx.createGain();
        const wobble = ctx.createOscillator();
        const wobbleDepth = ctx.createGain();

        rootOsc.type = 'sine';
        subOsc.type = 'sine';
        colorOsc.type = resolveFloorColorWave(this.expert.sourceMode || this.palette.source);
        wobble.type = 'sine';
        wobble.frequency.value = 0.02;
        wobbleDepth.gain.value = 5;

        tone.type = 'lowpass';
        tone.frequency.value = 1800;
        tone.Q.value = 0.8;
        bus.gain.value = 0.0001;
        captureTap.gain.value = 0.66;

        rootOsc.connect(rootGain);
        subOsc.connect(subGain);
        colorOsc.connect(colorGain);
        rootGain.connect(bus);
        subGain.connect(bus);
        colorGain.connect(bus);
        bus.connect(tone);
        tone.connect(pan);
        pan.connect(this.input);
        pan.connect(captureTap);
        captureTap.connect(this.preCaptureTap);

        wobble.connect(wobbleDepth);
        wobbleDepth.connect(rootOsc.detune);
        wobbleDepth.connect(colorOsc.detune);

        const now = ctx.currentTime + 0.01;
        rootOsc.start(now);
        subOsc.start(now);
        colorOsc.start(now);
        wobble.start(now);

        this.floor = {
            bus,
            tone,
            pan,
            captureTap,
            rootOsc,
            subOsc,
            colorOsc,
            rootGain,
            subGain,
            colorGain,
            wobble,
            wobbleDepth,
        };

        this.host.nodes.push(
            bus,
            tone,
            pan,
            captureTap,
            rootOsc,
            subOsc,
            colorOsc,
            rootGain,
            subGain,
            colorGain,
            wobble,
            wobbleDepth,
        );

        this._updateContinuousFloorFrequencies(this.lastMapped, now);
        this._applyContinuousFloorParams(this.lastMapped, this.lastMod, this.lastMacroMod);
    }

    _stopContinuousFloor() {
        if (!this.floor || !this.ctx) return;
        const now = this.ctx.currentTime;
        const floor = this.floor;
        floor.bus.gain.cancelScheduledValues(now);
        floor.bus.gain.setValueAtTime(floor.bus.gain.value, now);
        floor.bus.gain.linearRampToValueAtTime(0.0001, now + 0.12);
        [floor.rootOsc, floor.subOsc, floor.colorOsc, floor.wobble].forEach((osc) => {
            try { osc.stop(now + 0.2); } catch { }
        });
        this.floor = null;
    }

    _updateContinuousFloorFrequencies(mapped = this.lastMapped, when = this.ctx?.currentTime || 0) {
        if (!this.floor || !this.ctx || !this.host?.planet) return;
        const planet = this.host.planet;
        const intervals = Array.isArray(this.host._currentChordIntervals) && this.host._currentChordIntervals.length
            ? this.host._currentChordIntervals
            : [planet.scale?.[0] || 0, planet.scale?.[2] || 4];
        const rootStep = intervals[0] || 0;
        const colorStep = intervals[Math.min(1, intervals.length - 1)] || rootStep;
        const rootHz = this.host._getStepFrequency(planet, rootStep, 0.62);
        const colorHz = this.host._getStepFrequency(planet, colorStep, 0.94);
        const sourceMode = mapped?.sourceMode || this.expert.sourceMode || this.palette.source;
        const safeWhen = Math.max(this.ctx.currentTime, when || this.ctx.currentTime);

        this.floor.colorOsc.type = resolveFloorColorWave(sourceMode);
        this.floor.rootOsc.frequency.exponentialRampToValueAtTime(Math.max(20, rootHz), safeWhen + 0.16);
        this.floor.subOsc.frequency.exponentialRampToValueAtTime(Math.max(16, rootHz * 0.5), safeWhen + 0.16);
        this.floor.colorOsc.frequency.exponentialRampToValueAtTime(Math.max(26, colorHz), safeWhen + 0.16);
    }

    _applyContinuousFloorParams(mapped = this.lastMapped, mod = {}, macroMod = {}) {
        if (!this.floor || !this.ctx) return;
        const now = this.ctx.currentTime;
        const sourceMode = mapped?.sourceMode || this.expert.sourceMode || this.palette.source;
        const mix = resolveFloorMix(sourceMode);
        const paletteGain = clamp(this.palette?.gain ?? 0.9, 0.45, 1.24);
        const paletteBrightness = clamp(this.palette?.brightness ?? 0.55, 0.2, 1);
        const dream = this.macros.dream || 0.5;
        const texture = this.macros.texture || 0.5;
        const resonance = this.macros.resonance || 0.5;
        const motion = this.macros.motion || 0.5;
        const tail = this.macros.tail || 0.5;
        const diffusion = this.macros.diffusion || 0.5;
        const motionScalar = clamp(1 - ((macroMod?.motion || 0.5) * 0.12), 0.78, 1.02);

        const userGain = this._userGainFactor();
        this.floor.bus.gain.linearRampToValueAtTime(clamp(0.2 + dream * 0.34 + texture * 0.12, 0.16, 0.72) * motionScalar * userGain * paletteGain, now + 0.12);
        this.floor.rootGain.gain.linearRampToValueAtTime(clamp((0.24 + dream * 0.34) * mix.root, 0.06, 0.62), now + 0.12);
        this.floor.subGain.gain.linearRampToValueAtTime(clamp((0.14 + dream * 0.26) * mix.sub, 0.04, 0.52), now + 0.12);
        this.floor.colorGain.gain.linearRampToValueAtTime(clamp((0.08 + texture * 0.34) * mix.color, 0.03, 0.56), now + 0.12);
        this.floor.tone.frequency.linearRampToValueAtTime(
            clamp(220 + texture * (1100 + paletteBrightness * 1700) + (mod?.filterCutoffShift || 0) * 620, 150, 5200),
            now + 0.12,
        );
        this.floor.tone.Q.linearRampToValueAtTime(clamp(0.4 + resonance * 2.6, 0.3, 4.8), now + 0.12);
        this.floor.pan.pan.linearRampToValueAtTime(clamp((mod?.panShift || 0) * 0.45, -0.35, 0.35), now + 0.12);
        this.floor.captureTap.gain.linearRampToValueAtTime(clamp(0.54 + tail * 0.34, 0.42, 0.94), now + 0.12);
        this.floor.wobble.frequency.linearRampToValueAtTime(
            clamp(0.006 + motion * 0.08 + (mod?.rateHz || 0) * 0.18, 0.005, 0.2),
            now + 0.12,
        );
        this.floor.wobbleDepth.gain.linearRampToValueAtTime(
            clamp(2 + motion * 18 + diffusion * 8 + Math.abs(mod?.detuneShiftCents || 0) * 0.08, 2, 30),
            now + 0.12,
        );
    }

    _applyParams(mapped, mod, macroMod) {
        this.loopBuffer.setLoopLength(mapped.loopLength);
        this.loopBuffer.setLoopStart(mapped.loopStart);
        this.loopBuffer.setVarispeed(mapped.varispeed);
        this.loopBuffer.setSoundOnSound(mapped.sos);

        this.filterRouter.setFilter({
            type: mapped.filterType,
            cutoffNorm: clamp(mapped.filterCutoff + mod.filterCutoffShift * 0.3, 0, 1),
            qNorm: mapped.filterQ,
            position: mapped.filterPosition,
        });

        const rootStep = Array.isArray(this.host?._currentChordIntervals) && this.host._currentChordIntervals.length
            ? this.host._currentChordIntervals[0]
            : (this.host?.planet?.scale?.[0] || 0);
        const rootHz = this.host._getStepFrequency(this.host.planet, rootStep, 1);

        this.resonator.setParams({
            tuneNorm: clamp(mapped.resonatorTune + mod.resonatorShift, 0, 1),
            feedbackNorm: mapped.resonatorFeedback,
            spreadNorm: mapped.resonatorSpread,
            baseHz: rootHz,
        });
        this.resonatorBypass.gain.linearRampToValueAtTime(
            clamp(0.24 + this.macros.dream * 0.22 + this.macros.texture * 0.18, 0.18, 0.74),
            this.ctx.currentTime + 0.08,
        );
        this.dryBodySend.gain.linearRampToValueAtTime(
            clamp(0.32 + this.macros.dream * 0.28 + this.macros.texture * 0.22, 0.26, 1.08),
            this.ctx.currentTime + 0.08,
        );

        this.echo.setParams({
            timeNorm: mapped.echoTime,
            feedbackNorm: mapped.echoFeedback,
            toneNorm: mapped.echoTone,
        });

        this.ambience.setParams({
            spacetimeNorm: mapped.ambienceSpacetime,
            decayNorm: mapped.ambienceDecay,
        });

        this.loopReturnGain.gain.linearRampToValueAtTime(
            clamp(0.1 + this.macros.texture * 0.3 + this.macros.dream * 0.18, 0.08, 0.66),
            this.ctx.currentTime + 0.08,
        );

        const macroSpace = clamp((this.macros.diffusion + this.macros.tail) * 0.5, 0, 1);
        const motionScalar = clamp(1 - ((macroMod?.motion || 0.5) * 0.18), 0.72, 1);
        const userGain = this._userGainFactor();
        const paletteGain = clamp(this.palette?.gain ?? 0.9, 0.45, 1.24);
        this.mainOut.gain.linearRampToValueAtTime(clamp(0.62 + this.macros.dream * 0.3, 0.58, 1.08) * motionScalar * userGain * paletteGain, this.ctx.currentTime + 0.08);
        this.padsSend.gain.linearRampToValueAtTime(clamp(0.18 + macroSpace * 0.28, 0.14, 0.56) * userGain * 0.62 * paletteGain, this.ctx.currentTime + 0.08);
        this.ambienceSend.gain.linearRampToValueAtTime(clamp(0.18 + this.macros.diffusion * 0.32, 0.14, 0.62) * userGain * 0.68 * paletteGain, this.ctx.currentTime + 0.08);
        this._applyContinuousFloorParams(mapped, mod, macroMod);
        this.state.outputLevel = this.mainOut.gain.value;
    }

    getState() {
        return {
            ...this.state,
            sourceMode: this.lastMapped.sourceMode || this.expert.sourceMode,
            captureEnabled: this.loopBuffer.captureEnabled,
            loopSource: this.loopBuffer.sourceMode,
            degradeStage: this.lastQuality.degradeStage,
        };
    }

    getControls() {
        return {
            macros: { ...this.macros },
            expert: { ...this.expert },
        };
    }
}
