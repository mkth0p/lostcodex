import { RNG } from '../../rng.js';
import { HarmonyGraph } from './harmony-graph.js';
import { MicrotonalMap } from './microtonal-map.js';
import { DEFAULT_OVERLAY_FLAGS, estimateDroneAudibilityDb, normalizeOverlayFlags } from './layer-contracts.js';
import { resolvePaceClass } from './identity-profile.js';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export class V1ComposerCore {
    constructor(host, planet, { identityProfile = null, overlayFlags = DEFAULT_OVERLAY_FLAGS, paceOverride = 'auto' } = {}) {
        this.host = host;
        this.planet = planet;
        this.identityProfile = identityProfile || planet?.identityProfile || null;
        this.overlayFlags = normalizeOverlayFlags(overlayFlags);
        this.paceOverride = paceOverride || 'auto';

        this.harmonyGraph = new HarmonyGraph(planet, this.identityProfile);
        this.microtonalMap = new MicrotonalMap(
            this.identityProfile?.microtonalMapSeed || ((planet?.seed || 1) + 33881),
            this.identityProfile,
        );

        this.melodyStride = Math.max(1, this.host._getMelodyStride(planet, this.host.transport?.cycleSteps || 16));
        this.nextHarmonyBar = 0;
        this.harmonyHoldBarsCurrent = 0;
        this.lastMoonProcCount = 0;
        this.moonActivityRate = 0;
        this.compositionDensity = 0;
        this.melodyEvents = 0;
        this.percussionEvents = 0;
        this.stepWindow = 0;
        this.lastMicrotonalDepth = 0;
        this.lastPaceClass = resolvePaceClass(this.identityProfile, this.paceOverride);
        this.lastDroneAudibilityDb = -60;
        this.lastCounterlineAtStep = -999;
        this.nextDroneBar = 0;
    }

    setOverlayFlags(next = {}) {
        this.overlayFlags = normalizeOverlayFlags({
            ...this.overlayFlags,
            ...next,
        });
    }

    setPaceOverride(next = 'auto') {
        this.paceOverride = next === 'slow' || next === 'medium' || next === 'fast' ? next : 'auto';
    }

    getDiagnostics() {
        return {
            identityProfileId: this.identityProfile?.id || null,
            paceClass: this.lastPaceClass,
            microtonalDepth: this.lastMicrotonalDepth,
            droneAudibilityDb: this.lastDroneAudibilityDb,
            moonActivityRate: this.moonActivityRate,
            harmonyHoldBarsCurrent: this.harmonyHoldBarsCurrent,
            compositionDensity: this.compositionDensity,
            overlayFlags: { ...this.overlayFlags },
            paceOverride: this.paceOverride,
        };
    }

    _profileScalar(name, fallback = 0.5, min = 0, max = 1) {
        const value = this.identityProfile?.[name];
        if (!Number.isFinite(value)) return clamp(fallback, min, max);
        return clamp(value, min, max);
    }

    _resolveHoldRange(kind = 'holdPolicy') {
        const byPace = this.identityProfile?.[kind]?.[this.lastPaceClass];
        if (Array.isArray(byPace) && byPace.length >= 2) {
            const min = clamp(Math.round(byPace[0]), 1, 96);
            const max = clamp(Math.max(min + 1, Math.round(byPace[1])), min + 1, 112);
            return [min, max];
        }
        if (this.lastPaceClass === 'slow') return [5, 10];
        if (this.lastPaceClass === 'fast') return [2, 4];
        return [3, 6];
    }

    _resolveMelodyStride(section = 'INTRO', currentMod = null, quality = null) {
        const cycleSteps = Math.max(1, this.host.transport?.cycleSteps || 16);
        const pace = this.lastPaceClass;
        const melodyPresence = this._profileScalar('melodyPresence', 0.5);
        let stride = this.melodyStride;
        if (pace === 'slow') stride += 1;
        else if (pace === 'fast') stride -= 1;
        if (melodyPresence < 0.2) stride += 2;
        else if (melodyPresence < 0.35) stride += 1;
        else if (melodyPresence > 0.72) stride -= 1;
        if (section === 'SURGE') stride -= 1;
        if (section === 'AFTERGLOW') stride += 1;
        if ((currentMod?.melodyRateMul || 1) > 1.05) stride -= 1;
        if ((quality?.qualityScalar || 1) < 0.55) stride += 1;
        return clamp(Math.round(stride), 1, cycleSteps);
    }

    _buildPercussionEvents(cycleStep, barIndex, section, currentMod, quality) {
        if (!this.overlayFlags.adaptivePercussion || !this.host._percussionEnabled) return [];
        const percussionPresence = this._profileScalar('percussionPresence', 0.5);
        if (percussionPresence <= 0.02) return [];
        const cycleSteps = Math.max(1, this.host.transport?.cycleSteps || 16);
        const rng = new RNG(((this.planet.seed || 1) + 521003 + barIndex * 181 + cycleStep * 29) >>> 0);
        const rhythm = this.host._getRhythmState(this.planet, cycleStep, barIndex, rng);
        const events = [];
        const offbeat = cycleStep % 2 === 1;
        const paceMul = this.lastPaceClass === 'slow' ? 0.58 : this.lastPaceClass === 'fast' ? 1.22 : 1;
        const qualityMul = clamp((quality?.percussionDensityMul || 1) * (currentMod?.percussionDensityMul || 1), 0.2, 1.4);
        const densityProfileMul = clamp(0.2 + percussionPresence * 1.3, 0.06, 1.45);
        const density = clamp((0.16 + rhythm.energy * 0.42 + (this.identityProfile?.rhythmEcology || 0.5) * 0.28) * paceMul * qualityMul * densityProfileMul, 0.01, 1.18);
        if (percussionPresence < 0.08 && section !== 'SURGE' && rng.range(0, 1) > percussionPresence * 3.8) return [];

        const kickChance = clamp((offbeat ? 0.04 : 0.22) + rhythm.kickPush * 1.8, 0.02, 0.86) * density;
        const snareChance = clamp(((cycleStep + 2) % 4 === 0 ? 0.3 : 0.05) + rhythm.snarePush * 1.6, 0.02, 0.78) * density * clamp(0.3 + percussionPresence * 1.1, 0.12, 1.3);
        const hatChance = clamp(0.08 + rhythm.hatPush * 1.5 + Math.abs(rhythm.energy - 0.4) * 0.18, 0.03, 0.9) * density * clamp(0.2 + percussionPresence * 1.2, 0.08, 1.28);
        const ghostChance = this.host._ghostEnabled ? clamp(rhythm.ghostChance * (offbeat ? 1.3 : 0.7), 0, 0.55) : 0;
        const allowSnare = percussionPresence >= 0.1 || section === 'SURGE';
        const allowHat = percussionPresence >= 0.12 || section === 'SURGE';

        if (rng.range(0, 1) < kickChance) {
            events.push({ voice: 'kick', velocity: clamp(0.18 + rhythm.velocityLift * 0.16, 0.08, 0.78), microShiftMs: rng.range(-3, 2) });
        }
        if (allowSnare && rng.range(0, 1) < snareChance) {
            events.push({ voice: 'snare', velocity: clamp(0.1 + rhythm.velocityLift * 0.14, 0.06, 0.68), microShiftMs: rng.range(-2, 3) });
        }
        if (allowHat && rng.range(0, 1) < hatChance) {
            events.push({
                voice: 'hat',
                velocity: clamp(0.045 + rhythm.velocityLift * 0.1, 0.03, 0.36),
                microShiftMs: rng.range(-2, 2),
                open: rng.range(0, 1) < rhythm.openHatChance,
            });
        }
        if (ghostChance > 0 && allowHat && rng.range(0, 1) < ghostChance) {
            events.push({ voice: 'ghost', velocity: clamp(0.026 + rhythm.energy * 0.05, 0.02, 0.14), microShiftMs: rng.range(-5, 5) });
        }

        if (this.host._fillsEnabled && rhythm.fillActive && percussionPresence >= 0.14 && rng.range(0, 1) < rhythm.fillChance) {
            events.push({ voice: 'tom', velocity: clamp(0.09 + rhythm.velocityLift * 0.11, 0.06, 0.56), microShiftMs: rng.range(-3, 3) });
            if (cycleStep >= cycleSteps - 2 && rng.range(0, 1) < 0.58) {
                events.push({ voice: 'clack', velocity: clamp(0.07 + rhythm.energy * 0.12, 0.04, 0.4), microShiftMs: rng.range(-2, 2) });
            }
        }
        return events;
    }

    _maybeScheduleCounterline(scheduleTime, currentMod, quality) {
        if (!this.overlayFlags.counterpoint || !quality?.counterlineEnabled) return;
        if (!(this.host._arpEnabled || this.overlayFlags.counterpoint)) return;
        if (this.host.stepNote - this.lastCounterlineAtStep < 3) return;
        const step = this.host._lastMelodyStep;
        if (!Number.isFinite(step)) return;
        const rng = new RNG(((this.planet.seed || 1) + 334003 + this.host.stepNote * 31) >>> 0);
        if (rng.range(0, 1) > clamp(0.16 + (this.identityProfile?.motifVolatility || 0.4) * 0.2, 0.08, 0.4)) return;
        const shift = rng.pick([-2, -1, 1, 2, 3]);
        const counterline = this.host._shiftScaleStep(this.planet, step, shift, rng.pick([0, 0, 1]));
        this.host._v2Engine?.voiceFactory?.playCounterline(counterline, scheduleTime + (this.host.transport?.stepSeconds || 0.125) * 0.24, currentMod || {});
        this.lastCounterlineAtStep = this.host.stepNote;
    }

    _ensureMoonPresence() {
        if (!this.overlayFlags.moonCanons) return;
        if (!this.host._moonProfile?.length) return;
        const moonPresence = this._profileScalar('moonPresence', 0.35);
        if (moonPresence < 0.05) return;
        const rng = new RNG(((this.planet.seed || 1) + this.host.stepNote * 23 + this.host.stepPerc * 37 + 77011) >>> 0);
        if (rng.range(0, 1) > clamp(0.12 + moonPresence * 0.72, 0.08, 0.9)) return;
        const agoMs = Number.isFinite(this.host._lastMoonProcAt)
            ? ((this.host.ctx.currentTime - this.host._lastMoonProcAt) * 1000)
            : Number.POSITIVE_INFINITY;
        const minGapMs = 1700 + (1 - moonPresence) * 7600;
        if (agoMs < minGapMs) return;
        const root = Number.isFinite(this.host._currentChordIntervals?.[0]) ? this.host._currentChordIntervals[0] : this.planet.scale?.[0] || 0;
        this.host._scheduleMoonCanons(this.planet, this.host._moonBus || this.host._v2Engine?.buses?.layerGains?.melody, root, {
            perf: this.host._getPerformanceProfile(this.planet),
            mode: 'MOTIF',
            phrasePos: 0,
            isPhraseEnd: true,
            isResponse: false,
            force: true,
        });
        this.host._setManagedTimeout(() => {
            if (!this.host.playing) return;
            this.host._moonProcCount += 1;
            this.host._moonLastBurst = 1;
            this.host._lastMoonProcAt = this.host.ctx?.currentTime || 0;
        }, 40);
    }

    composeStep({
        stepIndex = 0,
        barIndex = 0,
        cycleStep = 0,
        cycleSteps = 16,
        scheduleTime = 0,
        section = 'INTRO',
        currentMod = {},
        quality = {},
        voiceFactory = null,
        droneEngine = null,
        eventBus = null,
        layerMix = null,
        mixTelemetry = null,
    } = {}) {
        this.lastPaceClass = resolvePaceClass(this.identityProfile, this.paceOverride);
        const baseFeatures = {
            granular: this.host._granularEnabled !== false,
            percussion: this.host._percussionEnabled !== false,
            chords: this.host._chordEnabled !== false,
            arp: this.host._arpEnabled !== false,
            motif: this.host._motifEnabled !== false,
        };
        const features = {
            granular: baseFeatures.granular || this.overlayFlags.ambientEcosystem,
            percussion: baseFeatures.percussion || this.overlayFlags.adaptivePercussion,
            chords: baseFeatures.chords || this.overlayFlags.extendedHarmony || this.overlayFlags.droneLayer || this.overlayFlags.moonCanons,
            arp: baseFeatures.arp || this.overlayFlags.counterpoint,
            motif: baseFeatures.motif || this.overlayFlags.counterpoint || this.overlayFlags.microtonalWarp || this.overlayFlags.moonCanons,
        };
        const allDisabled = !features.granular && !features.percussion && !features.chords && !features.arp && !features.motif;

        const outputs = {
            chordChanged: false,
            holdBars: this.harmonyHoldBarsCurrent,
            percussionCount: 0,
            melodyPlayed: false,
            paceClass: this.lastPaceClass,
            microtonalDepth: this.lastMicrotonalDepth,
            moonActivityRate: this.moonActivityRate,
            compositionDensity: this.compositionDensity,
            droneAudibilityDb: this.lastDroneAudibilityDb,
        };

        if (allDisabled) {
            this.lastMicrotonalDepth = 0;
            this.compositionDensity = 0;
            this.moonActivityRate = 0;
            this.lastDroneAudibilityDb = -60;
            outputs.microtonalDepth = 0;
            outputs.compositionDensity = 0;
            outputs.moonActivityRate = 0;
            outputs.droneAudibilityDb = -60;
            return outputs;
        }

        if (features.chords && cycleStep === 0 && this.overlayFlags.extendedHarmony && barIndex >= this.nextHarmonyBar) {
            const harmony = this.harmonyGraph.next({
                barIndex,
                section,
                dissonance: currentMod?.dissonance || 0.35,
                stability: currentMod?.stability || 0.5,
                cadenceStrength: this.host._arrangement?.cadenceStrength || 0.5,
                paceOverride: this.paceOverride,
            });
            this.nextHarmonyBar = barIndex + (harmony.holdBars || 1);
            this.harmonyHoldBarsCurrent = harmony.holdBars || 1;
            outputs.holdBars = this.harmonyHoldBarsCurrent;
            if (harmony.changed || barIndex === 0) {
                this.host._chordName = harmony.symbol;
                this.host._currentChordIntervals = this.host._buildScaleChord(harmony.symbol, this.planet);
                outputs.chordChanged = true;
                if (voiceFactory) {
                    const chordDur = clamp((this.host.transport?.stepSeconds || 0.125) * Math.max(4, cycleSteps * 0.42) * this.harmonyHoldBarsCurrent, 1.6, 14);
                    voiceFactory.playChordBloom(scheduleTime + (this.host.transport?.stepSeconds || 0.125) * 0.03, chordDur, currentMod);
                }
                eventBus?.emit?.({
                    type: 'chord-change',
                    chord: harmony.symbol,
                    barIndex,
                    holdBars: this.harmonyHoldBarsCurrent,
                    paceClass: this.lastPaceClass,
                    engineMode: 'v2',
                });
            }
        }

        const quarter = Math.max(1, Math.floor(cycleSteps / 4));
        const half = Math.max(1, Math.floor(cycleSteps / 2));
        if (features.arp && (cycleStep === 0 || cycleStep === quarter || cycleStep === half)) {
            const bassDur = clamp((this.host.transport?.stepSeconds || 0.125) * Math.max(2.1, cycleSteps * 0.15), 0.45, 2.1);
            voiceFactory?.playBassPulse(scheduleTime + (this.host.transport?.stepSeconds || 0.125) * 0.04, bassDur, currentMod);
        }

        if (features.chords && cycleStep === 0 && this.overlayFlags.droneLayer && barIndex >= this.nextDroneBar) {
            const rng = new RNG(((this.planet.seed || 1) + 441721 + barIndex * 47) >>> 0);
            const [minHold, maxHold] = this._resolveHoldRange('holdPolicy');
            const slowMul = this.lastPaceClass === 'slow' ? 0.8 : this.lastPaceClass === 'fast' ? 0.55 : 0.65;
            const holdMin = Math.max(1, Math.round(minHold * slowMul));
            const holdMax = Math.max(holdMin + 1, Math.round(maxHold * slowMul));
            const holdBars = rng.int(holdMin, holdMax + 1);
            this.nextDroneBar = barIndex + holdBars;
            const paceMul = this.lastPaceClass === 'slow' ? 1.4 : this.lastPaceClass === 'fast' ? 0.9 : 1.15;
            const droneDur = clamp((this.host.transport?.stepSeconds || 0.125) * cycleSteps * holdBars * paceMul, 6, 84);
            const usingDroneEngine = !!droneEngine;
            if (usingDroneEngine) {
                droneEngine.schedule({
                    scheduleTime,
                    durationSec: droneDur,
                    section,
                    modulation: currentMod,
                    quality,
                });
            } else {
                voiceFactory?.playDroneBed(scheduleTime, droneDur, currentMod);
                if (voiceFactory && section !== 'SURGE') {
                    voiceFactory.playDroneBed(scheduleTime + (this.host.transport?.stepSeconds || 0.125) * 0.08, clamp(droneDur * 0.58, 2.5, 11), {
                        ...currentMod,
                        texture: clamp((currentMod?.texture || 0.5) * 0.86, 0, 1),
                    });
                }
            }
        }

        const percussionEvents = features.percussion
            ? this._buildPercussionEvents(cycleStep, barIndex, section, currentMod, quality)
            : [];
        if (percussionEvents.length && voiceFactory) {
            voiceFactory.triggerPercussion(percussionEvents, scheduleTime);
            this.host.stepPerc++;
            outputs.percussionCount = percussionEvents.length;
        }

        const localRng = new RNG(((this.planet.seed || 1) + 145003 + stepIndex * 17 + barIndex * 7) >>> 0);
        const stride = this._resolveMelodyStride(section, currentMod, quality);
        if (features.motif && (cycleStep === 0 || (stepIndex % stride) === 0)) {
            const isResponse = cycleStep >= Math.ceil(cycleSteps / 2);
            const isPhraseEnd = cycleStep === cycleSteps - 1;
            const targetRest = this.host._getTargetRestProbability(this.planet, {
                cycleStep,
                cycleSteps,
                isResponse,
                isPhraseEnd,
                tension: this.host.tension || 0,
            });
            const volatility = this.identityProfile?.motifVolatility || 0.5;
            this.host._restProb = clamp(this.host._restProb + (targetRest - this.host._restProb) * (0.24 + volatility * 0.12), 0.06, 0.94);

            const playChance = 1 - this.host._restProb;
            const melodyPresence = this._profileScalar('melodyPresence', 0.5);
            const adjustedPlayChance = clamp(playChance * clamp(0.26 + melodyPresence * 1.2, 0.12, 1.36), 0.02, 0.98);
            if (localRng.range(0, 1) < adjustedPlayChance) {
                const originalQuarterToneProb = this.planet.quarterToneProb || 0;
                const microDepth = this.microtonalMap.getLayerDepth('melody', section, this.paceOverride);
                this.lastMicrotonalDepth = clamp(microDepth, 0, 1.4);
                if (this.overlayFlags.microtonalWarp) {
                    this.planet.quarterToneProb = this.microtonalMap.probability(originalQuarterToneProb, 'melody', section, this.paceOverride);
                }
                this.host._scheduleNote(this.planet, this.host._v2Engine?.buses?.layerGains?.melody || this.host.melodyBus, this.planet.ac, scheduleTime);
                this.planet.quarterToneProb = originalQuarterToneProb;
                this.host._phraseLength++;
                this.melodyEvents++;
                outputs.melodyPlayed = true;
                this._maybeScheduleCounterline(scheduleTime, currentMod, quality);
            } else {
                this.host._phraseLength = 0;
                this.host.stepNote++;
            }
        }

        if (cycleStep === 0 && this.overlayFlags.ambientEcosystem && this.host._granularEnabled) {
            const ambiencePresence = this._profileScalar('ambiencePresence', 0.6, 0, 1.2);
            const ambienceEveryBase = this.lastPaceClass === 'slow' ? 2 : this.lastPaceClass === 'fast' ? 4 : 3;
            const ambienceEvery = clamp(Math.round(ambienceEveryBase + (0.65 - ambiencePresence) * 2.2), 1, 7);
            if ((barIndex % ambienceEvery) === 0) {
                voiceFactory?.playAmbience(scheduleTime, currentMod);
                this.host.stepGrain++;
            }
        }

        if (features.motif || features.chords) this._ensureMoonPresence();
        const moonDelta = Math.max(0, (this.host._moonProcCount || 0) - this.lastMoonProcCount);
        this.lastMoonProcCount = this.host._moonProcCount || 0;
        this.moonActivityRate = clamp(this.moonActivityRate * 0.82 + moonDelta * 0.18, 0, 6);

        this.stepWindow++;
        const stepDensity = clamp((outputs.percussionCount * 0.08) + (outputs.melodyPlayed ? 0.16 : 0), 0, 1);
        this.compositionDensity = clamp(this.compositionDensity * 0.92 + stepDensity * 0.08, 0, 1);
        outputs.compositionDensity = this.compositionDensity;
        outputs.moonActivityRate = this.moonActivityRate;
        outputs.microtonalDepth = this.lastMicrotonalDepth;
        this.lastDroneAudibilityDb = estimateDroneAudibilityDb({
            droneState: droneEngine?.getState?.() || this.host._v2Engine?.lastDrone,
            mixTelemetry,
            layerMix,
            identityProfile: this.identityProfile,
        });
        outputs.droneAudibilityDb = this.lastDroneAudibilityDb;
        return outputs;
    }
}
