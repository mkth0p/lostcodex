import { EventBus } from './events/event-bus.js';
import { BackgroundController } from './background/background-controller.js';
import { createBusTopology } from './graph/bus-topology.js';
import { VoicePool } from './graph/voice-pool.js';
import { FormEngine } from './generation/form-engine.js';
import { ModMatrix } from './modulation/mod-matrix.js';
import { AdaptiveQualityGovernor } from './quality/adaptive-quality.js';
import { SpatialEngine } from './spatial/spatial-engine.js';
import { VoiceFactory } from './synthesis/voice-factory.js';
import { DroneEngine } from './drone/drone-engine.js';
import { V1ComposerCore } from '../v1-plus/composer-core.js';
import { buildIdentityProfile } from '../v1-plus/identity-profile.js';
import { enforceLayerContracts, normalizeOverlayFlags } from '../v1-plus/layer-contracts.js';

export class AudioEngineV2 {
    constructor(host) {
        this.host = host;
        this.eventBus = new EventBus();
        this.eventBus.subscribe((event) => this.host._emitEvent(event));
        this.active = false;
        this.stepIndex = 0;
        this.barIndex = 0;
        this.section = 'INTRO';
        this.arrangementEnergy = 0.2;
        this.lastQuality = null;
        this.currentMod = null;
        this.channels = [];
        this.fallbackTimers = [];
        this.backgroundController = null;
        this.voicePool = null;
        this.voiceFactory = null;
        this.droneEngine = null;
        this.formEngine = null;
        this.composerCore = null;
        this.modMatrix = null;
        this.qualityGovernor = null;
        this.buses = null;
        this.lastMix = null;
        this.lastDrone = null;
        this.nextHarmonyBar = 0;
        this.moonNodes = [];
        this.identityProfile = null;
        this.identityDiagnostics = null;
        this.overlayFlags = normalizeOverlayFlags();
        this.paceOverride = 'auto';
    }

    start(planet) {
        const host = this.host;
        host._boot();
        host.stop();
        host.planet = planet;
        host._strictRngs = Object.create(null);
        host._voiceCooldowns = Object.create(null);
        host._resetSteps();
        host._melodyMode = 'V2_GENERATIVE';
        host._chordIndex = 0;
        host._chordName = 'I';
        host._currentChordIntervals = host._buildScaleChord('I', planet);
        host._moonProcCount = 0;
        host._moonLastBurst = 0;
        host._lastMoonProcAt = Number.NEGATIVE_INFINITY;

        host.transport = host._buildTransport(planet);
        host._startTransportScheduler();
        this.identityProfile = planet?.identityProfile || buildIdentityProfile(planet);
        this.overlayFlags = normalizeOverlayFlags(host._v2OverlayFlags || this.overlayFlags);
        this.paceOverride = host._planetPaceOverride || this.paceOverride || 'auto';

        this.spatialEngine = new SpatialEngine(host.ctx, host._spatial || {});
        this.buses = createBusTopology(host, planet, {
            layerMix: host._layerMix || {},
            macroSpace: host._macroControls?.space || 0.5,
        });
        this.voicePool = new VoicePool({ maxVoices: 64 });
        this.voiceFactory = new VoiceFactory(host, this.buses, this.voicePool, this.spatialEngine);
        this._setupMoonSubsystem(planet);
        this.droneEngine = new DroneEngine({ host, buses: this.buses, eventBus: this.eventBus });
        this.formEngine = new FormEngine(planet, { arrangement: host._arrangement });
        this.composerCore = new V1ComposerCore(host, planet, {
            identityProfile: this.identityProfile,
            overlayFlags: this.overlayFlags,
            paceOverride: this.paceOverride,
        });
        this.modMatrix = new ModMatrix(host._macroControls);
        this.qualityGovernor = new AdaptiveQualityGovernor();
        this.lastQuality = this.qualityGovernor.evaluate({
            activeNodes: host.nodes?.size || 0,
            schedulerMaxLateMs: host._transportScheduler?.getStats?.()?.maxLateMs || 0,
            macroComplexity: host._macroControls?.complexity || 0.5,
            backgroundMode: host._backgroundMode || 'foreground-realtime',
        });
        this.currentMod = this.modMatrix.resolve({
            sectionEnergy: this.arrangementEnergy,
            section: this.section,
            tension: host.tension || 0,
            qualityScalar: this.lastQuality.qualityScalar,
        });
        this.droneEngine.activate(planet);
        this.droneEngine.setMacros(host._droneMacros || {});
        this.droneEngine.setExpert(host._droneExpert || {});
        this.droneEngine.setOutputLevel(Number.isFinite(host._droneVolume) ? host._droneVolume : 0.92);
        this.lastDrone = this.droneEngine.getState();
        this.lastMix = this.buses?.getTelemetry?.() || null;

        this.backgroundController = new BackgroundController({
            onModeChange: (mode) => this._onBackgroundModeChange(mode),
            onPolicyChange: (policy) => {
                host._backgroundPolicy = policy;
                this.eventBus.emit({ type: 'background-policy', policy, engineMode: 'v2' });
            },
            onPauseRequested: () => this._pauseByFocus(),
        });
        this.backgroundController.attach();
        this.backgroundController.setPolicy(host._backgroundPolicy || 'realtime');
        host._backgroundMode = this.backgroundController.mode;

        host.playing = true;
        this.active = true;
        this.stepIndex = 0;
        this.barIndex = 0;
        this.nextHarmonyBar = 0;
        this.section = 'INTRO';
        this.arrangementEnergy = 0.2;
        this.identityDiagnostics = this.composerCore.getDiagnostics();
        host._startStateStream();
        host._emitState();
        this._scheduleChannels();
        this.eventBus.emit({ type: 'engine-start', engineMode: 'v2', seed: planet?.seed || 0 });
    }

    beforeStop() {
        if (!this.active && !this.backgroundController) return;
        this.channels.forEach((name) => this.host._transportScheduler?.removeChannel?.(name));
        this.channels = [];
        this.fallbackTimers.forEach((timer) => clearInterval(timer));
        this.fallbackTimers = [];
        if (this.backgroundController) {
            this.backgroundController.dispose();
            this.backgroundController = null;
        }
        this._disposeMoonSubsystem();
        this.droneEngine?.deactivate();
        this.droneEngine = null;
        this.composerCore = null;
        this.active = false;
        this.eventBus.emit({ type: 'engine-stop', engineMode: 'v2' });
    }

    setMacroControls(next = {}) {
        this.modMatrix?.setMacros(next);
    }

    setDroneMacros(next = {}) {
        this.droneEngine?.setMacros(next);
    }

    setDroneExpert(next = {}) {
        this.droneEngine?.setExpert(next);
    }

    captureDroneLoop(options = {}) {
        return this.droneEngine?.captureLoop(options) || this.lastDrone || null;
    }

    setDroneRandomizer(options = {}) {
        const state = this.droneEngine?.randomize(options) || this.lastDrone || null;
        this.lastDrone = state;
        return state;
    }

    setDroneVariationSeed(seed) {
        this.droneEngine?.setVariationSeed(seed);
    }

    setDroneVolume(level = 0.92) {
        this.droneEngine?.setOutputLevel(level);
    }

    getDroneState() {
        return this.droneEngine?.getState() || this.lastDrone || null;
    }

    setArrangement(next = {}) {
        this.formEngine?.setArrangement(next);
    }

    setFeatureFlags() {
        this._applyLayerMixWithFeatureGates();
    }

    setV2OverlayFlags(next = {}) {
        this.overlayFlags = normalizeOverlayFlags({
            ...this.overlayFlags,
            ...next,
        });
        this.composerCore?.setOverlayFlags(this.overlayFlags);
    }

    setPlanetPaceOverride(next = 'auto') {
        this.paceOverride = ['slow', 'medium', 'fast'].includes(next) ? next : 'auto';
        this.composerCore?.setPaceOverride(this.paceOverride);
    }

    getIdentityDiagnostics() {
        return this.identityDiagnostics || this.composerCore?.getDiagnostics() || {
            identityProfileId: this.identityProfile?.id || null,
            paceClass: this.identityProfile?.paceClass || 'medium',
            toneTilt: this.identityProfile?.toneTilt || 'balanced',
            droneTargetDb: this.identityProfile?.droneTargetDb || { min: -24, max: -14 },
            microtonalDepth: 0,
            droneAudibilityDb: -60,
            moonActivityRate: 0,
            harmonyHoldBarsCurrent: 0,
            compositionDensity: 0,
            overlayFlags: { ...this.overlayFlags },
            paceOverride: this.paceOverride,
        };
    }

    setLayerMix(next = {}) {
        this.buses?.setLayerMix(next);
    }

    setSpatial(next = {}) {
        this.spatialEngine?.update(next);
    }

    setBackgroundPolicy(policy = 'realtime') {
        if (!this.backgroundController) return;
        this.backgroundController.setPolicy(policy);
    }

    enterBackgroundMode() {
        if (!this.backgroundController) return this.host._backgroundMode;
        const mode = this.backgroundController.enterBackgroundMode();
        this._onBackgroundModeChange(mode);
        return mode;
    }

    exitBackgroundMode() {
        if (!this.backgroundController) return this.host._backgroundMode;
        const mode = this.backgroundController.exitBackgroundMode();
        this._onBackgroundModeChange(mode);
        return mode;
    }

    getState() {
        const featureFlags = this._getBaseFeatureFlags();
        const effectiveFlags = this._getFeatureFlags();
        const poolState = this.voicePool?.getState() || { voiceBudget: 0, voiceStealCount: 0, activeVoices: 0 };
        const bg = this.backgroundController?.getState() || {
            backgroundMode: this.host._backgroundMode || 'foreground-realtime',
            backgroundPolicy: this.host._backgroundPolicy || 'realtime',
            backgroundTimelineRemainingMs: this.host._backgroundTimelineRemainingMs || 0,
        };
        const mix = this.buses?.getTelemetry?.() || this.lastMix || {
            preLimiterPeakDb: -60,
            integratedLufs: -24,
        };
        const quality = this.lastQuality || {};
        const diagnostics = this.getIdentityDiagnostics();
        const drone = this.droneEngine?.getState() || this.lastDrone || {
            loopFill: 0,
            loopDirection: 'forward',
            filterPosition: 0,
            resonatorEnergy: 0,
            echoDensity: 0,
            ambienceDepth: 0,
            modAmount: 0,
            randomizerDepth: 0,
            degradeStage: 'full',
        };
        return {
            section: this.section,
            arrangementEnergy: this.arrangementEnergy,
            voiceBudget: poolState.voiceBudget,
            voiceStealCount: poolState.voiceStealCount,
            eventRate: this.eventBus.getRatePerSecond(),
            cpuClass: quality.cpuClass || 'unknown',
            cpuTier: quality.cpuTier || quality.cpuClass || 'unknown',
            degradeStage: quality.degradeStage || 'full',
            backgroundMode: bg.backgroundMode,
            backgroundPolicy: bg.backgroundPolicy,
            backgroundTimelineRemainingMs: bg.backgroundTimelineRemainingMs,
            identityProfileId: diagnostics.identityProfileId,
            paceClass: diagnostics.paceClass,
            microtonalDepth: diagnostics.microtonalDepth,
            droneAudibilityDb: diagnostics.droneAudibilityDb,
            moonActivityRate: diagnostics.moonActivityRate,
            harmonyHoldBarsCurrent: diagnostics.harmonyHoldBarsCurrent,
            compositionDensity: diagnostics.compositionDensity,
            featureFlags,
            effectiveFlags,
            drone,
            mix,
            quality: {
                cpuTier: quality.cpuTier || quality.cpuClass || 'unknown',
                degradeStage: quality.degradeStage || 'full',
            },
        };
    }

    _scheduleChannels() {
        const host = this.host;
        const stepSec = host.transport?.stepSeconds || 0.125;
        const cycleSteps = host.transport?.cycleSteps || 16;

        const runStep = ({ scheduleTime }) => {
            if (!this.active || !host.playing) return;
            const cycleStep = this.stepIndex % cycleSteps;
            if (cycleStep === 0) this.barIndex++;

            const form = this.formEngine.update(this.barIndex);
            const sectionChanged = form.section !== this.section;
            this.section = form.section;
            this.arrangementEnergy = form.arrangementEnergy;

            const schedulerStats = host._transportScheduler?.getStats?.() || {};
            this.lastQuality = this.qualityGovernor.evaluate({
                activeNodes: host.nodes?.size || 0,
                schedulerMaxLateMs: schedulerStats.maxLateMs || 0,
                macroComplexity: host._macroControls?.complexity || 0.5,
                backgroundMode: host._backgroundMode || 'foreground-realtime',
            });
            this.voicePool.setBudget(this.lastQuality.voiceBudget);

            this.currentMod = this.modMatrix.resolve({
                sectionEnergy: this.arrangementEnergy,
                section: this.section,
                tension: host.tension || 0,
                qualityScalar: this.lastQuality.qualityScalar,
            });
            if (sectionChanged) {
                this.eventBus.emit({
                    type: 'section-change',
                    section: this.section,
                    arrangementEnergy: this.arrangementEnergy,
                    barIndex: this.barIndex,
                    engineMode: 'v2',
                });
            }
            const composition = this.composerCore?.composeStep({
                stepIndex: this.stepIndex,
                barIndex: this.barIndex,
                cycleStep,
                cycleSteps,
                scheduleTime,
                section: this.section,
                currentMod: this.currentMod,
                quality: this.lastQuality,
                voiceFactory: this.voiceFactory,
                droneEngine: this.droneEngine,
                eventBus: this.eventBus,
                layerMix: host._layerMix,
                mixTelemetry: this.lastMix,
            }) || {
                paceClass: this.identityProfile?.paceClass || 'medium',
                holdBars: 0,
                microtonalDepth: 0,
                moonActivityRate: 0,
                compositionDensity: 0,
                droneAudibilityDb: -60,
            };

            const featureFlags = this._getFeatureFlags();
            const anyLayerEnabled = featureFlags.granular
                || featureFlags.percussion
                || featureFlags.chords
                || featureFlags.arp
                || featureFlags.motif;

            if (anyLayerEnabled
                && featureFlags.chords
                && (this.stepIndex % Math.max(4, Math.round(cycleSteps / 2))) === 0
                && this.currentMod.dissonance > 0.56) {
                this.voiceFactory.playFxPulse(scheduleTime + stepSec * 0.1, this.currentMod);
                host.stepFX++;
            }

            this.buses.setMacroSpace(this.currentMod.space);
            const layerMix = enforceLayerContracts({
                layerMix: host._layerMix,
                identityProfile: this.identityProfile,
                section: this.section,
                qualityScalar: this.lastQuality.qualityScalar,
                paceClass: composition.paceClass || this.identityProfile?.paceClass || 'medium',
            });
            this.buses.setLayerMix(this._applyFeatureLayerGates(layerMix, featureFlags));
            this.lastMix = this.buses.getTelemetry?.() || this.lastMix;
            this.lastDrone = this.droneEngine?.getState?.() || this.lastDrone;
            this.identityDiagnostics = {
                identityProfileId: this.identityProfile?.id || null,
                paceClass: composition.paceClass || this.identityProfile?.paceClass || 'medium',
                toneTilt: this.identityProfile?.toneTilt || 'balanced',
                droneTargetDb: this.identityProfile?.droneTargetDb || { min: -24, max: -14 },
                microtonalDepth: composition.microtonalDepth || 0,
                droneAudibilityDb: composition.droneAudibilityDb ?? -60,
                moonActivityRate: composition.moonActivityRate || 0,
                harmonyHoldBarsCurrent: composition.holdBars || 0,
                compositionDensity: composition.compositionDensity || 0,
                percussionPresence: this.identityProfile?.percussionPresence ?? 0.5,
                melodyPresence: this.identityProfile?.melodyPresence ?? 0.5,
                ambiencePresence: this.identityProfile?.ambiencePresence ?? 0.6,
                overlayFlags: { ...this.overlayFlags },
                paceOverride: this.paceOverride,
            };

            this.stepIndex++;
        };

        this._scheduleChannel('v2-step', stepSec, runStep);
    }

    _getFeatureFlags() {
        const base = this._getBaseFeatureFlags();
        return {
            granular: base.granular || this.overlayFlags.ambientEcosystem,
            percussion: base.percussion || this.overlayFlags.adaptivePercussion,
            chords: base.chords || this.overlayFlags.extendedHarmony || this.overlayFlags.droneLayer || this.overlayFlags.moonCanons,
            arp: base.arp || this.overlayFlags.counterpoint,
            motif: base.motif || this.overlayFlags.counterpoint || this.overlayFlags.microtonalWarp || this.overlayFlags.moonCanons,
        };
    }

    _getBaseFeatureFlags() {
        return {
            granular: this.host._granularEnabled !== false,
            percussion: this.host._percussionEnabled !== false,
            chords: this.host._chordEnabled !== false,
            arp: this.host._arpEnabled !== false,
            motif: this.host._motifEnabled !== false,
        };
    }

    _applyFeatureLayerGates(layerMix = {}, flags = this._getFeatureFlags()) {
        const mix = { ...layerMix };
        if (!flags.percussion) mix.percussion = 0;
        if (!flags.granular) mix.ambience = 0;
        if (!flags.motif) mix.melody = 0;
        if (!flags.arp) mix.bass = 0;
        if (!flags.chords) {
            mix.drones = 0;
            mix.pads = 0;
            mix.fx = 0;
        }
        if (!this.overlayFlags.droneLayer) mix.drones = 0;
        if (!this.overlayFlags.ambientEcosystem) mix.ambience = Math.min(mix.ambience || 0, 0.05);

        const allDisabled = !flags.granular && !flags.percussion && !flags.chords && !flags.arp && !flags.motif;
        if (allDisabled) {
            return {
                drones: 0,
                pads: 0,
                melody: 0,
                bass: 0,
                percussion: 0,
                ambience: 0,
                fx: 0,
            };
        }
        return mix;
    }

    _applyLayerMixWithFeatureGates() {
        if (!this.active || !this.buses) return;
        const flags = this._getFeatureFlags();
        const base = enforceLayerContracts({
            layerMix: this.host._layerMix,
            identityProfile: this.identityProfile,
            section: this.section,
            qualityScalar: this.lastQuality?.qualityScalar || 1,
            paceClass: this.identityDiagnostics?.paceClass || this.identityProfile?.paceClass || 'medium',
        });
        this.buses.setLayerMix(this._applyFeatureLayerGates(base, flags));
    }

    _setupMoonSubsystem(planet) {
        const host = this.host;
        const ctx = host.ctx;
        host._moonProfile = host._buildMoonProfile(planet);
        host._moonProcCount = 0;
        host._moonLastBurst = 0;
        host._lastMoonProcAt = Number.NEGATIVE_INFINITY;
        host._moonBus = null;
        this.moonNodes = [];

        if (!ctx || !host._moonProfile?.length || !this.buses?.layerGains) return;

        const ac = planet?.ac || {};
        const moonSystem = planet?.moonSystem || {};
        const moonInput = ctx.createGain();
        const moonTone = ctx.createBiquadFilter();
        const moonAir = ctx.createBiquadFilter();
        const moonDry = ctx.createGain();
        const moonDelay = ctx.createDelay(2.2);
        const moonFeedback = ctx.createGain();
        const moonDelayMix = ctx.createGain();
        const moonAmbience = ctx.createGain();

        moonInput.gain.setValueAtTime(0, ctx.currentTime);
        const moonGainTarget = host._clamp(
            0.14 + host._moonProfile.length * 0.055 + (moonSystem.density || 0.4) * 0.08,
            0.12,
            0.42,
        );
        moonInput.gain.linearRampToValueAtTime(moonGainTarget, ctx.currentTime + 9);

        moonTone.type = 'bandpass';
        moonTone.frequency.setValueAtTime(
            host._clamp((ac.melFiltFreq || planet?.filterFreq || 1600) * (0.54 + (moonSystem.resonance || 0.5) * 0.46), 220, ctx.sampleRate / 2 - 400),
            ctx.currentTime,
        );
        moonTone.Q.value = host._clamp(1 + (moonSystem.resonance || 0.4) * 2.6, 0.7, 4.6);

        moonAir.type = 'highshelf';
        moonAir.frequency.value = 2600;
        moonAir.gain.value = host._clamp(-1.8 + (moonSystem.phaseWarp || 0.3) * 4.8, -3, 3.2);

        moonDry.gain.value = host._clamp(0.68 + (moonSystem.density || 0.5) * 0.18, 0.55, 0.92);
        moonDelay.delayTime.value = host._clamp((host.transport?.stepSeconds || 0.125) * (1.55 + (moonSystem.orbitSpread || 0.5) * 0.78), 0.12, 1.2);
        moonFeedback.gain.value = host._clamp(0.2 + (moonSystem.temporalDrift || 0.2) * 0.34, 0.14, 0.45);
        moonDelayMix.gain.value = host._clamp(0.12 + (moonSystem.phaseWarp || 0.2) * 0.3, 0.1, 0.38);
        moonAmbience.gain.value = host._clamp(0.09 + (moonSystem.orbitSpread || 0.4) * 0.26, 0.08, 0.32);

        moonInput.connect(moonTone);
        moonTone.connect(moonAir);
        moonAir.connect(moonDry);
        moonDry.connect(this.buses.layerGains.melody);
        moonAir.connect(moonDelay);
        moonDelay.connect(moonFeedback);
        moonFeedback.connect(moonDelay);
        moonDelay.connect(moonDelayMix);
        moonDelayMix.connect(this.buses.layerGains.melody);
        moonDelayMix.connect(moonAmbience);
        moonAmbience.connect(this.buses.layerGains.ambience);

        this.moonNodes = [moonInput, moonTone, moonAir, moonDry, moonDelay, moonFeedback, moonDelayMix, moonAmbience];
        this.moonNodes.forEach((node) => host.nodes.push(node));
        host._moonBus = moonInput;
    }

    _disposeMoonSubsystem() {
        this.host._moonBus = null;
        this.host._moonProfile = [];
        this.host._moonProcCount = 0;
        this.host._moonLastBurst = 0;
        this.host._lastMoonProcAt = Number.NEGATIVE_INFINITY;
        this.moonNodes = [];
    }

    _scheduleChannel(name, intervalSec, handler) {
        const scheduled = this.host._scheduleRecurringChannel(name, intervalSec, handler, 0.03);
        if (scheduled) {
            this.channels.push(name);
            return;
        }
        const timer = setInterval(() => handler({ scheduleTime: this.host.ctx?.currentTime || 0 }), Math.max(10, Math.round(intervalSec * 1000)));
        this.fallbackTimers.push(timer);
    }

    _pauseByFocus() {
        if (!this.host.masterGain || !this.host.ctx) return;
        const now = this.host.ctx.currentTime;
        this.host.masterGain.gain.cancelScheduledValues(now);
        this.host.masterGain.gain.setValueAtTime(this.host.masterGain.gain.value, now);
        this.host.masterGain.gain.linearRampToValueAtTime(0, now + 0.2);
    }

    _onBackgroundModeChange(mode) {
        this.host._backgroundMode = mode;
        const bgState = this.backgroundController?.getState();
        this.host._backgroundTimelineRemainingMs = bgState?.backgroundTimelineRemainingMs || 0;
        if (!this.host.masterGain || !this.host.ctx) return;
        const now = this.host.ctx.currentTime;
        const background = mode !== 'foreground-realtime';
        const targetVol = background ? this.host._vol * 0.78 : this.host._vol;
        this.host.masterGain.gain.cancelScheduledValues(now);
        this.host.masterGain.gain.setValueAtTime(this.host.masterGain.gain.value, now);
        this.host.masterGain.gain.linearRampToValueAtTime(targetVol, now + 0.35);
        this.eventBus.emit({
            type: 'background-mode',
            mode,
            policy: this.backgroundController?.policy || 'realtime',
            engineMode: 'v2',
        });
    }
}
