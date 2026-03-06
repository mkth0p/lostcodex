import { RNG } from '../../../rng.js';
import { resolvePaceClass } from '../../v1-plus/identity-profile.js';
import { DEFAULT_OVERLAY_FLAGS, estimateDroneAudibilityDb, normalizeOverlayFlags } from '../../v1-plus/layer-contracts.js';
import { HarmonyPlanner } from '../generation/harmony-planner.js';
import { MelodyPlanner } from '../generation/melody-planner.js';
import { RhythmPlanner } from '../generation/rhythm-planner.js';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const SUBMELODY_SHIFT_BY_BIOME = {
    crystalline: [2, 4, -3],
    crystalloid: [2, 3, 5, -2],
    storm: [-2, 2, 3],
    fungal: [-3, -2, 2, 4],
    desert: [-2, 2, 5],
    organic: [-2, -1, 2, 3],
    quantum: [-4, -2, 3, 5],
    default: [-3, -2, 2, 3, 4],
};
const DARK_BIOMES = new Set(['storm', 'volcanic', 'corrupted', 'abyssal', 'barren']);

export class V2ComposerCore {
    constructor(host, planet, { identityProfile = null, overlayFlags = DEFAULT_OVERLAY_FLAGS, paceOverride = 'auto' } = {}) {
        this.host = host;
        this.planet = planet;
        this.identityProfile = identityProfile || planet?.identityProfile || null;
        this.overlayFlags = normalizeOverlayFlags(overlayFlags);
        this.paceOverride = paceOverride || 'auto';

        this.harmonyPlanner = new HarmonyPlanner(planet);
        this.melodyPlanner = new MelodyPlanner(planet);
        this.rhythmPlanner = new RhythmPlanner(planet);
        this.richnessProfile = planet?.v2?.richnessProfile || { tier: 'balanced', harmonicity: 0.5, brightness: 0.5, density: 0.5 };
        this.fxProfile = planet?.v2?.fxProfile || { organic: 0.4, harmonic: 0.4, synthetic: 0.4, contrast: 0.4 };
        this.isDarkBiome = DARK_BIOMES.has(planet?.biome?.id || '');

        this.nextHarmonyBar = 0;
        this.harmonyHoldBarsCurrent = 0;
        this.nextDroneBar = 0;

        this.lastMoonProcCount = 0;
        this.moonActivityRate = 0;
        this.compositionDensity = 0;
        this.lastMicrotonalDepth = 0;
        this.lastDroneAudibilityDb = -60;
        this.lastPaceClass = resolvePaceClass(this.identityProfile, this.paceOverride);

        this.melodyEvents = 0;
        this.percussionEvents = 0;
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
            const max = clamp(Math.max(min + 1, Math.round(byPace[1])), min + 1, 128);
            return [min, max];
        }
        if (this.lastPaceClass === 'slow') return [5, 12];
        if (this.lastPaceClass === 'fast') return [1, 5];
        return [3, 8];
    }

    _resolveDroneHoldBars(section = 'INTRO', barIndex = 0) {
        const [minHold, maxHold] = this._resolveHoldRange('holdPolicy');
        const rng = new RNG(((this.planet.seed || 1) + 90111 + barIndex * 59) >>> 0);
        const paceScale = this.lastPaceClass === 'slow' ? 0.66 : this.lastPaceClass === 'fast' ? 0.48 : 0.58;
        let holdMin = Math.max(1, Math.round(minHold * paceScale));
        let holdMax = Math.max(holdMin + 1, Math.round(maxHold * paceScale));
        if (this.richnessProfile.tier === 'sparse') {
            holdMin += 1;
            holdMax += 2;
        } else if (this.richnessProfile.tier === 'lush') {
            holdMin = Math.max(1, holdMin - 1);
            holdMax = Math.max(holdMin + 1, holdMax - 1);
        }
        if (section === 'SURGE') holdMax = Math.max(1, holdMax - 1);
        if (section === 'AFTERGLOW') holdMin += 1;
        return rng.int(holdMin, holdMax + 1);
    }

    _resolveSceneCrossfadeSec(section = 'INTRO', barIndex = 0, sectionProgress = 0) {
        const tierBase = this.richnessProfile.tier === 'sparse'
            ? 2.1
            : this.richnessProfile.tier === 'lush'
                ? 1.35
                : 1.7;
        const sectionMul = section === 'SURGE'
            ? 0.82
            : section === 'AFTERGLOW'
                ? 1.2
                : section === 'RELEASE'
                    ? 1.15
                    : 1;
        const progressLift = clamp(sectionProgress, 0, 1) * (
            section === 'SURGE'
                ? -0.12
                : section === 'AFTERGLOW'
                    ? 0.2
                    : 0.06
        );
        const rng = new RNG(((this.planet.seed || 1) + 433101 + barIndex * 41 + section.length * 17) >>> 0);
        return clamp(tierBase * sectionMul + progressLift + rng.range(-0.2, 0.24), 0.7, 4.2);
    }

    _resolveAccentDensity(section = 'INTRO', qualityScalar = 1, currentMod = {}, sectionProgress = 0) {
        const tierBase = this.richnessProfile.tier === 'sparse'
            ? 0.36
            : this.richnessProfile.tier === 'lush'
                ? 0.92
                : 0.64;
        const sectionMul = section === 'SURGE'
            ? 1.24
            : section === 'AFTERGLOW'
                ? 0.78
                : 1;
        const progressMul = section === 'SURGE'
            ? (0.88 + clamp(sectionProgress, 0, 1) * 0.26)
            : section === 'AFTERGLOW'
                ? (1.02 - clamp(sectionProgress, 0, 1) * 0.22)
                : (0.94 + clamp(sectionProgress, 0, 1) * 0.12);
        return clamp(
            tierBase
            * sectionMul
            * progressMul
            * (0.55 + qualityScalar * 0.7)
            * (0.72 + (currentMod?.complexity || 0.5) * 0.52),
            0.12,
            1.4,
        );
    }

    _isDarkContrastWindow(section = 'INTRO', barIndex = 0, harmony = null) {
        if (!this.isDarkBiome) return false;
        if (section !== 'GROWTH' && section !== 'AFTERGLOW') return false;
        if (harmony?.brightWindowActive) return true;
        const contrast = clamp(this.fxProfile?.contrast ?? 0.4, 0, 1);
        const cycle = clamp(Math.round(10 - contrast * 5), 4, 12);
        const span = clamp(Math.round(1 + contrast * 2), 1, 3);
        const cycleIdx = Math.floor(barIndex / cycle);
        const rng = new RNG(((this.planet.seed || 1) + 74411 + cycleIdx * 173 + section.length * 13) >>> 0);
        const start = rng.int(0, Math.max(1, cycle - span + 1));
        const pos = barIndex % cycle;
        return pos >= start && pos < (start + span);
    }

    _updateMoonActivity() {
        const moonDelta = Math.max(0, (this.host._moonProcCount || 0) - this.lastMoonProcCount);
        this.lastMoonProcCount = this.host._moonProcCount || 0;
        this.moonActivityRate = clamp(this.moonActivityRate * 0.82 + moonDelta * 0.18, 0, 8);
    }

    _maybeMoonCanon({
        _scheduleTime = 0,
        cycleStep = 0,
        cycleSteps = 16,
        section = 'INTRO',
        melodyStep = null,
        qualityScalar = 1,
    } = {}) {
        if (!this.overlayFlags.moonCanons) return;
        if (!this.host._moonProfile?.length) return;

        const moonPresence = this._profileScalar('moonPresence', 0.35);
        if (moonPresence < 0.06) return;
        if (!Number.isFinite(melodyStep) && cycleStep !== 0) return;

        const rng = new RNG(((this.planet.seed || 1) + 911003 + this.host.stepNote * 17 + cycleStep * 31) >>> 0);
        const chance = clamp(
            (0.06 + moonPresence * 0.26 + (section === 'AFTERGLOW' ? 0.08 : 0) + (section === 'SURGE' ? 0.06 : 0))
            * (0.5 + qualityScalar * 0.6),
            0.04,
            0.5,
        );
        if (!rng.bool(chance)) return;

        const agoMs = Number.isFinite(this.host._lastMoonProcAt)
            ? ((this.host.ctx.currentTime - this.host._lastMoonProcAt) * 1000)
            : Number.POSITIVE_INFINITY;
        const minGapMs = 1800 + (1 - moonPresence) * 6400;
        if (agoMs < minGapMs) return;

        const root = Number.isFinite(melodyStep)
            ? melodyStep
            : (Number.isFinite(this.host._currentChordIntervals?.[0]) ? this.host._currentChordIntervals[0] : this.planet.scale?.[0] || 0);
        this.host._scheduleMoonCanons(this.planet, this.host._moonBus || this.host._v2Engine?.buses?.layerGains?.melody, root, {
            perf: this.host._getPerformanceProfile(this.planet),
            mode: 'MOTIF',
            phrasePos: cycleStep % Math.max(1, cycleSteps),
            isPhraseEnd: cycleStep === cycleSteps - 1,
            isResponse: cycleStep >= Math.ceil(cycleSteps / 2),
            force: false,
            section,
        });
    }

    composeStep({
        stepIndex = 0,
        barIndex = 0,
        cycleStep = 0,
        cycleSteps = 16,
        scheduleTime = 0,
        section = 'INTRO',
        sectionProgress = 0,
        currentMod = {},
        quality = {},
        voiceFactory = null,
        droneEngine = null,
        eventBus = null,
        layerMix = null,
        mixTelemetry = null,
    } = {}) {
        this.lastPaceClass = resolvePaceClass(this.identityProfile, this.paceOverride);
        const stepSeconds = this.host.transport?.stepSeconds || 0.125;
        const qualityScalar = clamp(quality?.qualityScalar ?? 1, 0.2, 1);

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

        let lastHarmony = null;
        if (features.chords && this.overlayFlags.extendedHarmony && cycleStep === 0 && barIndex >= this.nextHarmonyBar) {
            const harmony = this.harmonyPlanner.next({
                barIndex,
                section,
                dissonance: currentMod?.dissonance || 0.35,
                stability: currentMod?.stability || 0.5,
                cadenceStrength: this.host._arrangement?.cadenceStrength || 0.5,
            });
            lastHarmony = harmony;
            const [holdMin, holdMax] = this._resolveHoldRange('holdPolicy');
            const holdTarget = clamp(
                (harmony.holdBars || 1)
                + (this.lastPaceClass === 'slow' ? 1 : this.lastPaceClass === 'fast' ? -0.5 : 0)
                + (section === 'AFTERGLOW' ? 1 : section === 'SURGE' ? -0.4 : 0),
                holdMin,
                holdMax,
            );
            const holdBars = clamp(Math.round(holdTarget), 1, Math.max(1, holdMax));
            this.nextHarmonyBar = barIndex + holdBars;
            this.harmonyHoldBarsCurrent = holdBars;
            outputs.holdBars = holdBars;

            if (harmony.changed || barIndex === 0) {
                this.host._chordName = harmony.symbol;
                this.host._currentChordIntervals = this.host._buildScaleChord(harmony.symbol, this.planet);
                outputs.chordChanged = true;
                const contrastWindow = this._isDarkContrastWindow(section, barIndex, harmony);
                const chordDur = clamp(stepSeconds * Math.max(4, cycleSteps * 0.48) * holdBars, 1.2, 16);
                if (voiceFactory) {
                    voiceFactory.playChordBloom(scheduleTime + stepSeconds * 0.03, chordDur, {
                        ...currentMod,
                        richnessTier: this.richnessProfile.tier,
                        richnessProfile: this.richnessProfile,
                        fxProfile: this.fxProfile,
                        phraseAnchor: !!harmony.phraseAnchor,
                        contrastWindow,
                        bloomTapBias: harmony.phraseAnchor ? 0.14 : 0,
                    });
                }
                eventBus?.emit?.({
                    type: 'chord-change',
                    chord: harmony.symbol,
                    barIndex,
                    holdBars,
                    paceClass: this.lastPaceClass,
                    engineMode: 'v2',
                });
            }

            const harmonicSignatureChance = clamp(
                0.18 + this._profileScalar('harmonicComplexity', 0.5) * 0.32 + (section === 'SURGE' ? 0.08 : 0),
                0.1,
                0.72,
            );
            const harmonicRng = new RNG(((this.planet.seed || 1) + 992003 + barIndex * 31) >>> 0);
            const contrastWindow = this._isDarkContrastWindow(section, barIndex, harmony);
            const signatureBias = this.richnessProfile.tier === 'lush'
                ? 1.18
                : this.richnessProfile.tier === 'sparse'
                    ? 0.82
                    : 1;
            if (voiceFactory && harmonicRng.bool(harmonicSignatureChance * qualityScalar * signatureBias)) {
                voiceFactory.playBiomeSignatureFm(
                    scheduleTime + stepSeconds * 0.08,
                    clamp(stepSeconds * cycleSteps * 0.44, 0.9, 3.2),
                    {
                        ...currentMod,
                        richnessTier: this.richnessProfile.tier,
                        richnessProfile: this.richnessProfile,
                        fxProfile: this.fxProfile,
                        contrastWindow,
                    },
                );
            }
        }

        if (features.arp) {
            const pulseStride = this.lastPaceClass === 'slow'
                ? Math.max(2, Math.floor(cycleSteps / 2))
                : this.lastPaceClass === 'fast'
                    ? Math.max(1, Math.floor(cycleSteps / 4))
                    : Math.max(2, Math.floor(cycleSteps / 3));
            if ((cycleStep % pulseStride) === 0) {
                const bassDur = clamp(stepSeconds * Math.max(2, cycleSteps * 0.12), 0.35, 2.2);
                voiceFactory?.playBassPulse(scheduleTime + stepSeconds * 0.04, bassDur, currentMod);
            }
        }

        if (features.chords && this.overlayFlags.droneLayer && cycleStep === 0 && barIndex >= this.nextDroneBar) {
            const holdBars = this._resolveDroneHoldBars(section, barIndex);
            this.nextDroneBar = barIndex + holdBars;
            const droneDur = clamp(
                stepSeconds * cycleSteps * holdBars * (this.lastPaceClass === 'slow' ? 1.3 : this.lastPaceClass === 'fast' ? 0.82 : 1.05),
                4.5,
                68,
            );
            if (droneEngine) {
                const contrastWindow = this._isDarkContrastWindow(section, barIndex, lastHarmony);
                droneEngine.schedule({
                    scheduleTime,
                    durationSec: droneDur,
                    section,
                    modulation: currentMod,
                    quality,
                    sectionProgress,
                    sceneCrossfadeSec: this._resolveSceneCrossfadeSec(section, barIndex, sectionProgress),
                    accentDensity: this._resolveAccentDensity(section, qualityScalar, currentMod, sectionProgress),
                    richnessTier: this.richnessProfile.tier,
                    richnessProfile: this.richnessProfile,
                    fxProfile: this.fxProfile,
                    phraseAnchor: !!lastHarmony?.phraseAnchor,
                    contrastWindow,
                });
            } else if (voiceFactory) {
                voiceFactory.playDroneBed(scheduleTime, droneDur, currentMod);
            }
        }

        const melodyPresence = this._profileScalar('melodyPresence', 0.5);
        const localRng = new RNG(((this.planet.seed || 1) + 211003 + stepIndex * 17 + barIndex * 113) >>> 0);
        if (features.motif) {
            const melodyEvent = this.melodyPlanner.planStep({
                stepIndex,
                barIndex,
                section,
                complexity: currentMod?.complexity || 0.5,
                motion: currentMod?.motion || 0.5,
                dissonance: currentMod?.dissonance || 0.35,
                tension: this.host.tension || 0,
                chordIntervals: this.host._currentChordIntervals || [],
                chordSymbol: this.host._chordName || 'I',
                qualityScalar,
                counterlineEnabled: !!quality?.counterlineEnabled,
            });

            const beatAnchor = cycleStep === 0 || cycleStep === Math.floor(cycleSteps / 2);
            const playChanceMul = clamp(0.46 + melodyPresence * 1.06 + (currentMod?.complexity || 0.5) * 0.22, 0.24, 1.48);
            const shouldPlay = melodyEvent.play && (beatAnchor || localRng.bool(playChanceMul * 0.78));
            if (shouldPlay && voiceFactory) {
                const played = voiceFactory.playMelody({
                    ...melodyEvent,
                    velocity: clamp((melodyEvent.velocity || 0.2) * (0.84 + melodyPresence * 0.4), 0.04, 0.92),
                }, scheduleTime, currentMod);
                if (played) {
                    this.host.stepNote++;
                    this.melodyEvents++;
                    outputs.melodyPlayed = true;
                    this.lastMicrotonalDepth = clamp(
                        Math.abs(melodyEvent.microCents || 0) / 48
                        + (melodyEvent.mode === 'MOTIF' ? 0.16 : melodyEvent.mode === 'RESPONSE' ? 0.12 : 0.08),
                        0,
                        1.4,
                    );

                    if (quality?.counterlineEnabled && Number.isFinite(melodyEvent.counterline) && localRng.bool(0.22 + (currentMod?.motion || 0.5) * 0.26)) {
                        voiceFactory.playCounterline(
                            melodyEvent.counterline,
                            scheduleTime + stepSeconds * 0.22,
                            { ...currentMod, texture: clamp((currentMod?.texture || 0.5) * 0.86, 0, 1) },
                        );
                        this.host.stepNote++;
                    }

                    const subShiftPool = SUBMELODY_SHIFT_BY_BIOME[this.planet?.biome?.id] || SUBMELODY_SHIFT_BY_BIOME.default;
                    const subChance = clamp(
                        0.08
                        + melodyPresence * 0.18
                        + (currentMod?.motion || 0.5) * 0.16
                        + (melodyEvent.mode === 'MOTIF' ? 0.1 : 0),
                        0.02,
                        0.62,
                    );
                    if (qualityScalar > 0.44 && localRng.bool(subChance)) {
                        const subStep = this.host._shiftScaleStep(this.planet, melodyEvent.step, localRng.pick(subShiftPool), localRng.pick([-1, 0]));
                        const subEvent = {
                            ...melodyEvent,
                            step: subStep,
                            octave: Math.max(1, (melodyEvent.octave || 3) - 1),
                            velocity: clamp((melodyEvent.velocity || 0.2) * 0.56, 0.025, 0.46),
                            durScale: clamp((melodyEvent.durScale || 1) * 0.86, 0.52, 1.58),
                            microCents: (melodyEvent.microCents || 0) * 0.5,
                            voiceHint: null,
                        };
                        if (voiceFactory.playMelody(subEvent, scheduleTime + stepSeconds * 0.24, {
                            ...currentMod,
                            texture: clamp((currentMod?.texture || 0.5) * 0.82, 0, 1),
                        })) {
                            this.host.stepNote++;
                        }
                    }

                    this._maybeMoonCanon({
                        scheduleTime,
                        cycleStep,
                        cycleSteps,
                        section,
                        melodyStep: melodyEvent.step,
                        qualityScalar,
                    });
                }
            } else {
                this.lastMicrotonalDepth = clamp(this.lastMicrotonalDepth * 0.9, 0, 1.4);
            }
        }

        if (features.percussion && this.overlayFlags.adaptivePercussion && voiceFactory) {
            const percussionPresence = this._profileScalar('percussionPresence', 0.5);
            if (percussionPresence > 0.02 || section === 'SURGE') {
                const percussionEvents = this.rhythmPlanner.planStep({
                    stepIndex,
                    barIndex,
                    section,
                    energy: clamp((currentMod?.complexity || 0.5) * 0.62 + (currentMod?.motion || 0.5) * 0.28, 0, 1),
                    complexity: currentMod?.complexity || 0.5,
                    motion: currentMod?.motion || 0.5,
                    dissonance: currentMod?.dissonance || 0.35,
                    fillsEnabled: this.host._fillsEnabled,
                    ghostEnabled: this.host._ghostEnabled,
                    densityMul: clamp(
                        (currentMod?.percussionDensityMul || 1)
                        * (quality?.percussionDensityMul || 1)
                        * (0.36 + percussionPresence * 1.14),
                        0.12,
                        1.58,
                    ),
                });
                if (percussionEvents.length) {
                    voiceFactory.triggerPercussion(percussionEvents, scheduleTime);
                    this.host.stepPerc++;
                    this.percussionEvents += percussionEvents.length;
                    outputs.percussionCount = percussionEvents.length;
                }
            }
        }

        if (features.granular && this.overlayFlags.ambientEcosystem && voiceFactory && cycleStep === 0) {
            const ambiencePresence = this._profileScalar('ambiencePresence', 0.6, 0, 1.2);
            const ambienceEveryBase = this.lastPaceClass === 'slow' ? 2 : this.lastPaceClass === 'fast' ? 4 : 3;
            const ambienceEvery = clamp(
                Math.round(
                    ambienceEveryBase
                    + (0.68 - ambiencePresence) * 2.4
                    + (1 - (quality?.ambienceRateMul || 1)) * 3.2,
                ),
                1,
                8,
            );
            if ((barIndex % ambienceEvery) === 0 && voiceFactory.playAmbience(scheduleTime, {
                ...currentMod,
                richnessTier: this.richnessProfile.tier,
                richnessProfile: this.richnessProfile,
                fxProfile: this.fxProfile,
            })) {
                this.host.stepGrain++;
            }
        }

        if (this.overlayFlags.ambientEcosystem && voiceFactory?.playBiomeTextureStep) {
            const textureEvents = voiceFactory.playBiomeTextureStep({
                stepIndex,
                barIndex,
                cycleStep,
                cycleSteps,
                scheduleTime,
                section,
                modulation: {
                    ...currentMod,
                    richnessTier: this.richnessProfile.tier,
                    richnessProfile: this.richnessProfile,
                    fxProfile: this.fxProfile,
                    contrastWindow: this._isDarkContrastWindow(section, barIndex, lastHarmony),
                },
                quality,
            });
            if (textureEvents > 0) this.host.stepFX += textureEvents;
        }

        this._updateMoonActivity();
        const stepDensity = clamp(
            (outputs.percussionCount * 0.07)
            + (outputs.melodyPlayed ? 0.24 : 0),
            0,
            1,
        );
        this.compositionDensity = clamp(this.compositionDensity * 0.9 + stepDensity * 0.1, 0, 1);

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
