import { DroneSources } from './drone-sources.js';
import { RNG } from '../../../rng.js';
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
const HARSH_BIOMES = new Set(['storm', 'volcanic', 'corrupted']);
const NON_HARSH_SUPERSAW_CAP = {
    sparse: 0.1,
    balanced: 0.18,
    lush: 0.28,
};

function safeRamp(param, val, time, ctx) {
    if (!param || !ctx) return;
    const now = ctx.currentTime;
    param.cancelScheduledValues(now);
    param.setValueAtTime(param.value, now);
    param.linearRampToValueAtTime(val, time);
}

const BIOME_DRONE_PALETTES = {
    crystalline: { source: 'wavetable', sceneModes: ['wavetable', 'hybrid', 'sine'], brightness: 0.74, resonatorCap: 0.82, diffusionCap: 0.95, gain: 1.05 },
    volcanic: { source: 'supersaw', sceneModes: ['supersaw', 'hybrid', 'sine'], brightness: 0.44, resonatorCap: 0.88, diffusionCap: 0.62, gain: 0.95 },
    psychedelic: { source: 'hybrid', sceneModes: ['hybrid', 'wavetable', 'supersaw'], brightness: 0.82, resonatorCap: 0.76, diffusionCap: 0.88, gain: 0.98 },
    desert: { source: 'sine', sceneModes: ['sine', 'hybrid', 'wavetable'], brightness: 0.38, resonatorCap: 0.58, diffusionCap: 0.64, gain: 0.72 },
    oceanic: { source: 'hybrid', sceneModes: ['hybrid', 'sine', 'wavetable'], brightness: 0.48, resonatorCap: 0.72, diffusionCap: 0.94, gain: 1.12 },
    corrupted: { source: 'supersaw', sceneModes: ['supersaw', 'hybrid', 'wavetable'], brightness: 0.72, resonatorCap: 0.94, diffusionCap: 0.58, gain: 0.84 },
    barren: { source: 'sine', sceneModes: ['sine', 'wavetable'], brightness: 0.22, resonatorCap: 0.48, diffusionCap: 0.66, gain: 0.52 },
    organic: { source: 'hybrid', sceneModes: ['hybrid', 'sine', 'wavetable'], brightness: 0.44, resonatorCap: 0.74, diffusionCap: 0.82, gain: 0.92 },
    ethereal: { source: 'wavetable', sceneModes: ['wavetable', 'sine', 'hybrid'], brightness: 0.68, resonatorCap: 0.62, diffusionCap: 0.98, gain: 1.15 },
    quantum: { source: 'hybrid', sceneModes: ['hybrid', 'supersaw', 'wavetable'], brightness: 0.76, resonatorCap: 0.92, diffusionCap: 0.78, gain: 0.94 },
    glacial: { source: 'sine', sceneModes: ['sine', 'wavetable'], brightness: 0.38, resonatorCap: 0.54, diffusionCap: 0.96, gain: 1.08 },
    fungal: { source: 'hybrid', sceneModes: ['hybrid', 'sine', 'supersaw'], brightness: 0.48, resonatorCap: 0.78, diffusionCap: 0.82, gain: 1.02 },
    abyssal: { source: 'supersaw', sceneModes: ['supersaw', 'hybrid', 'sine'], brightness: 0.32, resonatorCap: 0.96, diffusionCap: 0.84, gain: 1.25 },
    nebula: { source: 'hybrid', sceneModes: ['hybrid', 'wavetable', 'sine'], brightness: 0.74, resonatorCap: 0.68, diffusionCap: 0.98, gain: 1.2 },
    arctic: { source: 'sine', sceneModes: ['sine', 'wavetable'], brightness: 0.36, resonatorCap: 0.52, diffusionCap: 0.92, gain: 0.96 },
    storm: { source: 'supersaw', sceneModes: ['supersaw', 'hybrid', 'wavetable'], brightness: 0.62, resonatorCap: 0.84, diffusionCap: 0.78, gain: 0.88 },
    crystalloid: { source: 'wavetable', sceneModes: ['wavetable', 'hybrid', 'supersaw'], brightness: 0.78, resonatorCap: 0.72, diffusionCap: 0.88, gain: 1.04 },
    default: { source: 'hybrid', sceneModes: ['hybrid', 'sine', 'wavetable'], brightness: 0.55, resonatorCap: 0.72, diffusionCap: 0.84, gain: 0.9 },
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

function sectionSourceBias(section = 'INTRO') {
    if (section === 'SURGE') return ['supersaw', 'hybrid', 'wavetable'];
    if (section === 'AFTERGLOW') return ['sine', 'wavetable', 'hybrid'];
    if (section === 'RELEASE') return ['wavetable', 'sine', 'hybrid'];
    return ['hybrid', 'wavetable', 'sine'];
}

function resolveSupersawCap(biomeId = 'default', tier = 'balanced', section = 'INTRO') {
    if (HARSH_BIOMES.has(biomeId)) {
        const sectionLift = section === 'SURGE' ? 0.14 : section === 'RELEASE' ? 0.06 : 0;
        return clamp(0.62 + sectionLift + (tier === 'lush' ? 0.08 : 0), 0.5, 0.96);
    }
    const base = NON_HARSH_SUPERSAW_CAP[tier] ?? NON_HARSH_SUPERSAW_CAP.balanced;
    const sectionLift = section === 'SURGE' ? 0.04 : section === 'AFTERGLOW' ? -0.04 : 0;
    return clamp(base + sectionLift, 0.06, 0.32);
}

function enforceSourcePolicy(sourceMode = 'hybrid', biomeId = 'default', tier = 'balanced') {
    if (HARSH_BIOMES.has(biomeId)) return sourceMode;
    if (sourceMode !== 'supersaw') return sourceMode;
    if (tier === 'lush') return 'wavetable';
    return 'hybrid';
}

export class DroneEngine {
    constructor({ host, buses, eventBus } = {}) {
        this.host = host;
        this.ctx = host?.ctx;
        this.buses = buses;
        this.eventBus = eventBus;
        this.active = false;

        this.macros = { ...DEFAULT_DRONE_MACROS };
        this.expert = { ...DEFAULT_DRONE_EXPERT, ...(host?.planet?.expertSeeds || {}) };
        this.genome = toDroneGenome(host?.planet);
        this.palette = resolvePalette(host?.planet?.biome?.id);
        this.biomeId = host?.planet?.biome?.id || 'default';
        this.richnessProfile = host?.planet?.v2?.richnessProfile || { tier: 'balanced', harmonicity: 0.5, brightness: 0.5, density: 0.5 };
        this.fxProfile = host?.planet?.v2?.fxProfile || { organic: 0.4, harmonic: 0.4, synthetic: 0.4, contrast: 0.4 };
        this.richnessTier = this.richnessProfile.tier || 'balanced';

        const seed = host?.planet?.seed || 1;
        this.modMatrix = new DroneModMatrix(seed + 17117);
        this.randomizer = new DroneRandomizer(seed + 19211);
        this.qualityPolicy = new DroneQualityPolicy();
        this.sources = new DroneSources(host);

        this.loopBuffer = new LoopBuffer(this.ctx, { maxSeconds: 5 });
        this.filterRouter = new FilterRouter(this.ctx);
        this.resonator = new ResonatorBank(this.ctx, seed + 20331);
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
        this.sceneCounter = 0;
        this.lastScene = {
            sourceMode: this.expert.sourceMode || this.palette.source,
            filterType: this.expert.filterType || 'lowpass',
            sceneMorph: 0.5,
            crossfadeSec: 1.6,
        };
        this.floor = null;
        this.userVolume = 0.92;
        this.lastScheduleTime = Number.NEGATIVE_INFINITY;
        this.lastSupersawShare = 0;
        this.lastAccentCount = 0;
        this.lastSceneCrossfade = 1.6;
        this.bedMode = 'persistent';
        this.continuity = {
            dropouts: 0,
            lastDropoutAt: Number.NEGATIVE_INFINITY,
            health: 1,
        };
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
            continuityHealth: 1,
            bedMode: this.bedMode,
            supersawShare: 0,
            richnessTier: this.richnessTier,
        };
    }

    activate(planet) {
        this.active = true;
        this.genome = toDroneGenome(planet);
        this.palette = resolvePalette(planet?.biome?.id);
        this.biomeId = planet?.biome?.id || 'default';
        this.richnessProfile = planet?.v2?.richnessProfile || { tier: 'balanced', harmonicity: 0.5, brightness: 0.5, density: 0.5 };
        this.fxProfile = planet?.v2?.fxProfile || { organic: 0.4, harmonic: 0.4, synthetic: 0.4, contrast: 0.4 };
        this.richnessTier = this.richnessProfile.tier || 'balanced';
        this.modMatrix.setSeed((planet?.seed || 1) + 17117);
        this.randomizer.setSeed((planet?.seed || 1) + 19211);
        this.sceneCounter = 0;
        if (!this.expert.sourceMode || this.expert.sourceMode === 'hybrid') {
            this.expert.sourceMode = enforceSourcePolicy(this.palette.source, this.biomeId, this.richnessTier);
        }
        this.lastScene = {
            sourceMode: this.expert.sourceMode,
            filterType: this.expert.filterType || 'lowpass',
            sceneMorph: 0.5,
            crossfadeSec: 1.6,
        };
        this.lastScheduleTime = Number.NEGATIVE_INFINITY;
        this.lastSupersawShare = 0;
        this.lastAccentCount = 0;
        this.lastSceneCrossfade = 1.6;
        this.continuity = {
            dropouts: 0,
            lastDropoutAt: Number.NEGATIVE_INFINITY,
            health: 1,
        };
        this.state.continuityHealth = 1;
        this.state.bedMode = this.bedMode;
        this.state.supersawShare = 0;
        this.state.richnessTier = this.richnessTier;
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
        this.expert.sourceMode = enforceSourcePolicy(this.expert.sourceMode, this.biomeId, this.richnessTier);
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
        this.expert.sourceMode = enforceSourcePolicy(this.expert.sourceMode, this.biomeId, this.richnessTier);
        this.state.randomizerDepth = clamp(Number.isFinite(intensity) ? intensity : this.state.randomizerDepth, 0, 1);
        this._applyRouting();
        this._refreshRealtimeParams();
        return this.getState();
    }

    _resolveSceneCrossfadeSec(section = 'INTRO', requestedSec = null) {
        if (Number.isFinite(requestedSec)) return clamp(requestedSec, 0.7, 4.2);
        const tierBase = this.richnessTier === 'sparse'
            ? 2.2
            : this.richnessTier === 'lush'
                ? 1.3
                : 1.7;
        const sectionMul = section === 'SURGE'
            ? 0.82
            : section === 'AFTERGLOW'
                ? 1.18
                : section === 'RELEASE'
                    ? 1.12
                    : 1;
        const seedBase = (this.host?.planet?.seed || 1) + this.sceneCounter * 83 + section.length * 23;
        const rng = new RNG(seedBase >>> 0);
        return clamp(tierBase * sectionMul + rng.range(-0.18, 0.24), 0.7, 4.2);
    }

    _computeContinuityHealth({
        scheduleTime = 0,
        previousScheduleTime = this.lastScheduleTime,
        sceneCrossfadeSec = 1.6,
        durationSec = 6,
        sectionProgress = 0,
    } = {}) {
        const now = this.ctx?.currentTime || scheduleTime || 0;
        const floorGain = this.floor?.bus?.gain?.value ?? 0;
        if (floorGain < 0.02 && (now - this.continuity.lastDropoutAt) > 0.5) {
            this.continuity.dropouts += 1;
            this.continuity.lastDropoutAt = now;
        }
        const dropoutPenalty = clamp(this.continuity.dropouts * 0.16, 0, 0.7);
        const floorPenalty = clamp((0.035 - floorGain) * 4.4, 0, 0.5);
        const effectiveScheduleTime = scheduleTime || now;
        const gapSec = Number.isFinite(previousScheduleTime) && previousScheduleTime > 0
            ? Math.max(0, effectiveScheduleTime - previousScheduleTime)
            : 0;
        const tierSpacingMul = this.richnessTier === 'sparse'
            ? 1.65
            : this.richnessTier === 'lush'
                ? 1
                : 1.28;
        const sectionSpacingMul = this.lastSection === 'AFTERGLOW'
            ? 1.22
            : this.lastSection === 'SURGE'
                ? 0.9
                : 1;
        const progressMul = this.lastSection === 'SURGE'
            ? (0.92 + clamp(sectionProgress, 0, 1) * 0.08)
            : (1 + clamp(sectionProgress, 0, 1) * 0.16);
        const expectedSpacingSec = clamp(
            Math.max(5.5, durationSec * 0.72) * tierSpacingMul * sectionSpacingMul * progressMul,
            8,
            34,
        );
        const slackSec = clamp(expectedSpacingSec * 0.44, 2.4, 13);
        const spacingPenalty = Number.isFinite(previousScheduleTime) && previousScheduleTime > 0
            ? clamp((gapSec - expectedSpacingSec - slackSec) / Math.max(10, expectedSpacingSec * 1.9), 0, 0.2)
            : 0;
        const crossfadeScore = clamp(sceneCrossfadeSec / 2.4, 0.35, 1);
        this.continuity.health = clamp(1 - dropoutPenalty - floorPenalty - spacingPenalty + (crossfadeScore - 0.35) * 0.14, 0, 1);
        return this.continuity.health;
    }

    _resolveScene(section = 'INTRO', mapped = this.lastMapped, { sceneCrossfadeSec = null } = {}) {
        const sourceMode = enforceSourcePolicy(
            mapped?.sourceMode || this.expert.sourceMode || this.palette.source,
            this.biomeId,
            this.richnessTier,
        );
        const modePool = Array.isArray(this.palette?.sceneModes) && this.palette.sceneModes.length
            ? this.palette.sceneModes
            : [this.palette.source, 'hybrid', 'sine'];
        const policyPool = modePool
            .map((mode) => enforceSourcePolicy(mode, this.biomeId, this.richnessTier))
            .filter((mode, idx, arr) => arr.indexOf(mode) === idx);
        const sectionPool = sectionSourceBias(section);
        const filtered = policyPool.filter((mode) => sectionPool.includes(mode));
        const pool = filtered.length ? filtered : policyPool;
        const seedBase = (this.host?.planet?.seed || 1)
            + this.sceneCounter * 971
            + Math.round((this.macros.texture || 0.5) * 97)
            + Math.round((this.macros.motion || 0.5) * 131);
        const rng = new RNG(seedBase >>> 0);

        let mode = sourceMode;
        const driftChance = clamp(
            0.18
            + (this.macros.texture || 0.5) * 0.28
            + (this.macros.motion || 0.5) * 0.22
            + (section === 'SURGE' ? 0.18 : section === 'AFTERGLOW' ? 0.08 : 0),
            0.08,
            0.78,
        );
        if (rng.bool(driftChance)) mode = rng.pick(pool);
        mode = enforceSourcePolicy(mode, this.biomeId, this.richnessTier);

        const filterType = section === 'SURGE'
            ? rng.pick(['bandpass', 'notch', mapped.filterType || 'lowpass'])
            : section === 'AFTERGLOW'
                ? rng.pick(['lowpass', 'lowpass', 'bandpass'])
                : mapped.filterType || 'lowpass';
        const sceneMorph = clamp(
            0.28
            + (this.macros.dream || 0.5) * 0.24
            + (this.macros.texture || 0.5) * 0.24
            + (section === 'SURGE' ? 0.14 : section === 'AFTERGLOW' ? 0.08 : 0),
            0.05,
            1,
        );
        const crossfadeSec = this._resolveSceneCrossfadeSec(section, sceneCrossfadeSec);
        const supersawCap = resolveSupersawCap(this.biomeId, this.richnessTier, section);
        const allowSupersawLead = HARSH_BIOMES.has(this.biomeId);
        this.sceneCounter++;
        return {
            sourceMode: mode,
            filterType,
            sceneMorph,
            sceneSeed: seedBase >>> 0,
            crossfadeSec,
            supersawCap,
            allowSupersawLead,
        };
    }

    schedule({
        scheduleTime = 0,
        durationSec = 6,
        section = 'INTRO',
        modulation = {},
        quality = {},
        sceneCrossfadeSec = null,
        accentDensity = 0.64,
        sectionProgress = 0,
        richnessTier = null,
        richnessProfile = null,
        fxProfile = null,
        phraseAnchor = false,
        contrastWindow = false,
    } = {}) {
        if (!this.active) return false;

        if (richnessProfile) this.richnessProfile = richnessProfile;
        if (fxProfile) this.fxProfile = fxProfile;
        if (richnessTier) this.richnessTier = richnessTier;

        this.lastMacroMod = modulation || {};
        this.lastQuality = this.qualityPolicy.resolve({
            qualityScalar: quality.qualityScalar ?? 1,
            backgroundMode: this.host?._backgroundMode || 'foreground-realtime',
            cpuClass: quality.cpuClass || this.host?._v2Engine?.lastQuality?.cpuClass || 'desktop-mid',
            richnessTier: this.richnessTier,
        });
        this.lastSection = section;

        const mappedBase = mapDroneMacrosToExpert(this.macros, this.expert, this.genome);
        const scene = this._resolveScene(section, mappedBase, { sceneCrossfadeSec });
        const mapped = {
            ...mappedBase,
            sourceMode: scene.sourceMode,
            filterType: scene.filterType,
            resonatorFeedback: clamp(mappedBase.resonatorFeedback, 0, this.palette.resonatorCap),
            ambienceSpacetime: clamp(mappedBase.ambienceSpacetime, 0, this.palette.diffusionCap),
        };
        this.lastScene = scene;
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

        this._applyParams(mapped, this.lastMod, {
            ...modulation,
            richnessTier: this.richnessTier,
            richnessProfile: this.richnessProfile,
            fxProfile: this.fxProfile,
            sceneCrossfadeSec: scene.crossfadeSec,
            contrastWindow,
            phraseAnchor,
        });

        const effectiveAccentDensity = clamp(
            accentDensity
            * (this.lastQuality.accentDensityMul ?? 1)
            * (this.richnessTier === 'sparse' ? 0.8 : this.richnessTier === 'lush' ? 1.12 : 1)
            * (phraseAnchor ? 1.08 : 1),
            0.05,
            1.4,
        );
        const accentSeed = ((this.host?.planet?.seed || 1) + Math.round(scheduleTime * 1000) + this.sceneCounter * 73 + section.length * 31) >>> 0;
        const accentRng = new RNG(accentSeed);
        const triggerChance = clamp(
            0.2
            + effectiveAccentDensity * 0.52
            + (section === 'SURGE' ? 0.12 : section === 'AFTERGLOW' ? -0.06 : 0)
            + (contrastWindow ? 0.08 : 0),
            0.08,
            0.94,
        );
        const shouldTriggerAccent = accentRng.bool(triggerChance);

        let triggered = null;
        if (shouldTriggerAccent) {
            triggered = this.sources.trigger({
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
                    sceneMorph: scene.sceneMorph,
                    sceneSeed: scene.sceneSeed,
                    biomeId: this.biomeId || this.host?.planet?.biome?.id || 'default',
                    genome: this.genome,
                    accentMode: true,
                    accentStrength: clamp(0.58 + effectiveAccentDensity * 0.54, 0.2, 1.3),
                    accentDensity: effectiveAccentDensity,
                    richnessTier: this.richnessTier,
                    richnessProfile: this.richnessProfile,
                    fxProfile: this.fxProfile,
                    supersawCap: scene.supersawCap,
                    allowSupersawLead: scene.allowSupersawLead,
                },
                modulation: {
                    ...this.lastMod,
                    contrastWindow,
                    phraseAnchor,
                },
                quality: this.lastQuality,
                output: this.input,
                preCapture: this.preCaptureTap,
                section,
            });
        }

        const nextSupersaw = Number.isFinite(triggered?.supersawShare)
            ? clamp(triggered.supersawShare, 0, 1)
            : clamp(this.lastSupersawShare * 0.92, 0, 1);
        this.lastSupersawShare = clamp(this.lastSupersawShare * 0.56 + nextSupersaw * 0.44, 0, 1);
        this.lastAccentCount = Number.isFinite(triggered?.accentCount)
            ? Math.max(0, Math.round(triggered.accentCount))
            : 0;
        this.lastSceneCrossfade = scene.crossfadeSec;
        const previousScheduleTime = this.lastScheduleTime;

        this.state.loopFill = this.loopBuffer.tick(durationSec);
        this.state.loopDirection = this.loopBuffer.direction;
        this.state.filterPosition = mapped.filterPosition;
        this.state.resonatorEnergy = this.resonator.getEnergyEstimate();
        this.state.echoDensity = this.echo.getDensityEstimate();
        this.state.ambienceDepth = this.ambience.getDepthEstimate();
        this.state.modAmount = this.lastMod.motionDepth;
        this.state.outputLevel = this.mainOut.gain.value;
        this.state.supersawShare = this.lastSupersawShare;
        this.state.richnessTier = this.richnessTier;
        this.state.bedMode = this.bedMode;
        this.state.continuityHealth = this._computeContinuityHealth({
            scheduleTime,
            previousScheduleTime,
            sceneCrossfadeSec: scene.crossfadeSec,
            durationSec,
            sectionProgress,
        });
        this.lastScheduleTime = scheduleTime;

        this.eventBus?.emit({
            type: 'drone-frame',
            section,
            degradeStage: this.lastQuality.degradeStage,
            loopFill: this.state.loopFill,
            sourceMode: mapped.sourceMode,
            sceneMorph: scene.sceneMorph,
            ttlSec: triggered?.ttlSec || 0,
            continuityHealth: this.state.continuityHealth,
            supersawShare: this.state.supersawShare,
            sceneCrossfade: scene.crossfadeSec,
            accentCount: this.lastAccentCount,
            richnessTier: this.richnessTier,
            engineMode: 'v2',
        });

        return true;
    }

    _refreshRealtimeParams() {
        if (!this.active || !this.ctx) return;
        const mappedBase = mapDroneMacrosToExpert(this.macros, this.expert, this.genome);
        const scene = this.lastScene || this._resolveScene(this.lastSection, mappedBase);
        const mapped = {
            ...mappedBase,
            sourceMode: scene.sourceMode || mappedBase.sourceMode,
            filterType: scene.filterType || mappedBase.filterType,
            resonatorFeedback: clamp(mappedBase.resonatorFeedback, 0, this.palette.resonatorCap),
            ambienceSpacetime: clamp(mappedBase.ambienceSpacetime, 0, this.palette.diffusionCap),
        };
        this.lastScene = {
            sourceMode: mapped.sourceMode,
            filterType: mapped.filterType,
            sceneMorph: scene.sceneMorph ?? this.lastScene?.sceneMorph ?? 0.5,
            sceneSeed: scene.sceneSeed ?? this.lastScene?.sceneSeed ?? ((this.host?.planet?.seed || 1) >>> 0),
            crossfadeSec: scene.crossfadeSec ?? this.lastScene?.crossfadeSec ?? this.lastSceneCrossfade ?? 1.6,
            supersawCap: scene.supersawCap ?? this.lastScene?.supersawCap ?? resolveSupersawCap(this.biomeId, this.richnessTier, this.lastSection),
            allowSupersawLead: scene.allowSupersawLead ?? this.lastScene?.allowSupersawLead ?? HARSH_BIOMES.has(this.biomeId),
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
        colorOsc.type = resolveFloorColorWave(enforceSourcePolicy(this.expert.sourceMode || this.palette.source, this.biomeId, this.richnessTier));
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
        const sceneMorph = clamp(this.lastScene?.sceneMorph ?? 0.5, 0, 1);
        const safeWhen = Math.max(this.ctx.currentTime, when || this.ctx.currentTime);

        this.floor.colorOsc.type = resolveFloorColorWave(sourceMode);
        this.floor.rootOsc.frequency.exponentialRampToValueAtTime(Math.max(20, rootHz * (0.92 + sceneMorph * 0.18)), safeWhen + 0.16);
        this.floor.subOsc.frequency.exponentialRampToValueAtTime(Math.max(16, rootHz * (0.46 + sceneMorph * 0.08)), safeWhen + 0.16);
        this.floor.colorOsc.frequency.exponentialRampToValueAtTime(Math.max(26, colorHz * (0.96 + sceneMorph * 0.26)), safeWhen + 0.16);
    }

    _applyContinuousFloorParams(mapped = this.lastMapped, mod = {}, macroMod = {}) {
        if (!this.floor || !this.ctx) return;
        const now = this.ctx.currentTime;
        const baseSourceMode = mapped?.sourceMode || this.expert.sourceMode || this.palette.source;
        const sourceMode = enforceSourcePolicy(baseSourceMode, this.biomeId, this.richnessTier);
        const sceneMorph = clamp(this.lastScene?.sceneMorph ?? 0.5, 0, 1);
        const mix = resolveFloorMix(sourceMode);
        const supersawCap = resolveSupersawCap(this.biomeId, this.richnessTier, this.lastSection);
        if (!HARSH_BIOMES.has(this.biomeId)) {
            mix.color *= clamp(supersawCap * 1.8, 0.12, 0.52);
            mix.root = clamp(mix.root + 0.22, 0.4, 1.3);
            mix.sub = clamp(mix.sub + 0.12, 0.22, 1.1);
        }
        if (this.richnessTier === 'lush') {
            mix.color = clamp(mix.color * 1.08, 0.08, 1.1);
            mix.root = clamp(mix.root * 1.06, 0.3, 1.24);
        } else if (this.richnessTier === 'sparse') {
            mix.color = clamp(mix.color * 0.78, 0.06, 0.74);
            mix.root = clamp(mix.root * 0.92, 0.24, 1.12);
        }
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
        safeRamp(this.floor.bus.gain, clamp(0.2 + dream * 0.34 + texture * 0.12 + sceneMorph * 0.08, 0.16, 0.84) * motionScalar * userGain * paletteGain, now + 0.12, this.ctx);
        safeRamp(this.floor.rootGain.gain, clamp((0.24 + dream * 0.34 + (1 - sceneMorph) * 0.08) * mix.root, 0.06, 0.74), now + 0.12, this.ctx);
        safeRamp(this.floor.subGain.gain, clamp((0.14 + dream * 0.26 + (1 - sceneMorph) * 0.04) * mix.sub, 0.04, 0.6), now + 0.12, this.ctx);
        safeRamp(this.floor.colorGain.gain, clamp((0.08 + texture * 0.34 + sceneMorph * 0.12) * mix.color, 0.03, 0.7), now + 0.12, this.ctx);

        const hzCutoff = clamp(220 + texture * (1100 + paletteBrightness * 1700) + (mod?.filterCutoffShift || 0) * 620, 150, 5200);
        safeRamp(this.floor.tone.frequency, hzCutoff, now + 0.12, this.ctx);
        safeRamp(this.floor.tone.Q, clamp(0.4 + resonance * 2.6, 0.3, 4.8), now + 0.12, this.ctx);
        safeRamp(this.floor.pan.pan, clamp((mod?.panShift || 0) * 0.45, -0.35, 0.35), now + 0.12, this.ctx);
        safeRamp(this.floor.captureTap.gain, clamp(0.54 + tail * 0.34, 0.42, 0.94), now + 0.12, this.ctx);

        const wobbleHz = clamp(0.006 + motion * 0.08 + (mod?.rateHz || 0) * 0.18, 0.005, 0.2);
        safeRamp(this.floor.wobble.frequency, wobbleHz, now + 0.12, this.ctx);
        const wobbleDepthVal = clamp(2 + motion * 18 + diffusion * 8 + Math.abs(mod?.detuneShiftCents || 0) * 0.08, 2, 30);
        safeRamp(this.floor.wobbleDepth.gain, wobbleDepthVal, now + 0.12, this.ctx);
    }

    _applyParams(mapped, mod, macroMod) {
        const sceneMorph = clamp(this.lastScene?.sceneMorph ?? 0.5, 0, 1);
        this.loopBuffer.setLoopLength(mapped.loopLength);
        this.loopBuffer.setLoopStart(mapped.loopStart);
        this.loopBuffer.setVarispeed(mapped.varispeed);
        this.loopBuffer.setSoundOnSound(mapped.sos);

        this.filterRouter.setFilter({
            type: mapped.filterType,
            cutoffNorm: clamp(mapped.filterCutoff + mod.filterCutoffShift * 0.3 + sceneMorph * 0.08, 0, 1),
            qNorm: clamp(mapped.filterQ + sceneMorph * 0.14, 0, 1),
            position: mapped.filterPosition,
        });

        const rootStep = Array.isArray(this.host?._currentChordIntervals) && this.host._currentChordIntervals.length
            ? this.host._currentChordIntervals[0]
            : (this.host?.planet?.scale?.[0] || 0);
        const rootHz = this.host._getStepFrequency(this.host.planet, rootStep, 1);
        const fxContext = {
            section: this.lastSection,
            richnessTier: this.richnessTier,
            richnessProfile: this.richnessProfile,
            fxProfile: this.fxProfile,
            biomeId: this.biomeId,
            harsh: HARSH_BIOMES.has(this.biomeId),
            sceneMorph,
            contrastWindow: !!macroMod?.contrastWindow,
        };

        this.resonator.setParams({
            tuneNorm: clamp(mapped.resonatorTune + mod.resonatorShift + sceneMorph * 0.08, 0, 1),
            feedbackNorm: clamp(mapped.resonatorFeedback + sceneMorph * 0.1, 0, 1),
            spreadNorm: clamp(mapped.resonatorSpread + sceneMorph * 0.08, 0, 1),
            baseHz: rootHz,
        }, fxContext);

        safeRamp(
            this.resonatorBypass.gain,
            clamp(0.24 + this.macros.dream * 0.22 + this.macros.texture * 0.18, 0.18, 0.74),
            this.ctx.currentTime + 0.08,
            this.ctx
        );

        safeRamp(
            this.dryBodySend.gain,
            clamp(0.32 + this.macros.dream * 0.28 + this.macros.texture * 0.22, 0.26, 1.08),
            this.ctx.currentTime + 0.08,
            this.ctx
        );

        this.echo.setParams({
            timeNorm: clamp(mapped.echoTime + sceneMorph * 0.08, 0, 1),
            feedbackNorm: clamp(mapped.echoFeedback + sceneMorph * 0.06, 0, 1),
            toneNorm: clamp(mapped.echoTone + sceneMorph * 0.1, 0, 1),
        }, fxContext);

        this.ambience.setParams({
            spacetimeNorm: clamp(mapped.ambienceSpacetime + sceneMorph * 0.1, 0, 1),
            decayNorm: clamp(mapped.ambienceDecay + sceneMorph * 0.08, 0, 1),
        }, fxContext);

        safeRamp(
            this.loopReturnGain.gain,
            clamp(0.1 + this.macros.texture * 0.3 + this.macros.dream * 0.18, 0.08, 0.66),
            this.ctx.currentTime + 0.08,
            this.ctx
        );

        const macroSpace = clamp((this.macros.diffusion + this.macros.tail) * 0.5, 0, 1);
        const motionScalar = clamp(1 - ((macroMod?.motion || 0.5) * 0.18), 0.72, 1);
        const userGain = this._userGainFactor();
        const paletteGain = clamp(this.palette?.gain ?? 0.9, 0.45, 1.24);

        safeRamp(this.mainOut.gain, clamp(0.62 + this.macros.dream * 0.3 + sceneMorph * 0.08, 0.58, 1.18) * motionScalar * userGain * paletteGain, this.ctx.currentTime + 0.08, this.ctx);
        safeRamp(this.padsSend.gain, clamp(0.18 + macroSpace * 0.28 + sceneMorph * 0.12, 0.14, 0.72) * userGain * 0.62 * paletteGain, this.ctx.currentTime + 0.08, this.ctx);
        safeRamp(this.ambienceSend.gain, clamp(0.18 + this.macros.diffusion * 0.32 + (1 - sceneMorph) * 0.14, 0.14, 0.76) * userGain * 0.68 * paletteGain, this.ctx.currentTime + 0.08, this.ctx);
        this._applyContinuousFloorParams(mapped, mod, macroMod);
        this.state.outputLevel = this.mainOut.gain.value;
    }

    getState() {
        return {
            ...this.state,
            sourceMode: this.lastScene?.sourceMode || this.lastMapped.sourceMode || this.expert.sourceMode,
            sceneMorph: this.lastScene?.sceneMorph ?? 0.5,
            sceneCrossfade: this.lastSceneCrossfade,
            accentCount: this.lastAccentCount,
            continuityHealth: this.state.continuityHealth ?? this.continuity.health ?? 1,
            bedMode: this.bedMode,
            supersawShare: this.state.supersawShare ?? this.lastSupersawShare ?? 0,
            richnessTier: this.richnessTier,
            captureEnabled: this.loopBuffer.captureEnabled,
            loopSource: this.loopBuffer.sourceMode,
            degradeStage: this.lastQuality.degradeStage,
        };
    }

    getControls() {
        return {
            macros: { ...this.macros },
            expert: { ...this.expert },
            genome: { ...this.genome },
            playing: this.active,
            lastStatus: this.modMatrix.lastStatus,
        };
    }
}
