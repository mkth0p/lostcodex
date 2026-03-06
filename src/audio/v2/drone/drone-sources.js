import { RNG } from '../../../rng.js';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const HARSH_BIOMES = new Set(['storm', 'volcanic', 'corrupted']);

const ARCHITECTURE_BY_BIOME = {
    crystalline: ['shimmer', 'harmonic', 'fm'],
    crystalloid: ['shimmer', 'fm', 'harmonic'],
    glacial: ['shimmer', 'harmonic'],
    arctic: ['harmonic', 'shimmer'],
    storm: ['noisy', 'pulse', 'fm'],
    volcanic: ['noisy', 'pulse', 'harmonic'],
    corrupted: ['noisy', 'fm', 'pulse'],
    abyssal: ['pulse', 'fm', 'harmonic'],
    organic: ['harmonic', 'pulse', 'shimmer'],
    fungal: ['pulse', 'harmonic', 'noisy'],
    desert: ['harmonic', 'pulse'],
    oceanic: ['harmonic', 'shimmer', 'fm'],
    ethereal: ['shimmer', 'harmonic', 'fm'],
    nebula: ['fm', 'shimmer', 'harmonic'],
    quantum: ['fm', 'pulse', 'noisy'],
    psychedelic: ['fm', 'shimmer', 'harmonic'],
    barren: ['harmonic', 'pulse'],
    default: ['harmonic', 'fm', 'pulse'],
};

const ARCHITECTURE_BLEND = {
    harmonic: { sine: 1.08, sub: 0.92, supersaw: 0.54, wavetable: 0.46, fm: 0.24, noise: 0.04 },
    fm: { sine: 0.62, sub: 0.54, supersaw: 0.22, wavetable: 0.88, fm: 0.86, noise: 0.08 },
    noisy: { sine: 0.42, sub: 0.72, supersaw: 0.76, wavetable: 0.34, fm: 0.3, noise: 0.28 },
    pulse: { sine: 0.74, sub: 0.86, supersaw: 0.7, wavetable: 0.3, fm: 0.2, noise: 0.1 },
    shimmer: { sine: 0.56, sub: 0.42, supersaw: 0.18, wavetable: 1, fm: 0.5, noise: 0.06 },
};

function createWavetable(ctx) {
    const real = new Float32Array([0, 1, 0.42, 0.18, 0.07, 0.03, 0.02]);
    const imag = new Float32Array(real.length);
    return ctx.createPeriodicWave(real, imag);
}

function buildSupersawVoices(ctx, freq, count, rng) {
    const detunes = [-18, -9, 0, 9, 18, -26, 26];
    const nodes = [];
    for (let i = 0; i < count; i++) {
        const osc = ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.value = freq;
        osc.detune.value = detunes[i % detunes.length] + rng.range(-2.5, 2.5);
        nodes.push(osc);
    }
    return nodes;
}

function resolveSourceBlend(mode = 'hybrid', texture = 0.5, {
    supersawCap = 1,
    allowSupersawLead = true,
    richnessTier = 'balanced',
} = {}) {
    const safeTexture = clamp(texture, 0, 1);
    let blend;
    switch (mode) {
        case 'sine':
            blend = { sine: 1, sub: 0.78, supersaw: 0.04 + safeTexture * 0.06, wavetable: 0.06 };
            break;
        case 'supersaw':
            blend = { sine: 0.22, sub: 0.26, supersaw: 1, wavetable: 0.16 + safeTexture * 0.08 };
            break;
        case 'wavetable':
            blend = { sine: 0.2, sub: 0.24, supersaw: 0.08, wavetable: 1 };
            break;
        default:
            blend = { sine: 0.58, sub: 0.4, supersaw: 0.72, wavetable: 0.62 };
            break;
    }

    if (richnessTier === 'lush') {
        blend.wavetable += 0.12;
        blend.sine += 0.06;
        blend.supersaw *= 0.92;
    } else if (richnessTier === 'sparse') {
        blend.sine *= 0.92;
        blend.sub *= 0.9;
        blend.wavetable *= 0.82;
        blend.supersaw *= 0.7;
    }

    const cap = clamp(supersawCap, 0, 1);
    const beforeSaw = blend.supersaw;
    blend.supersaw = clamp(
        beforeSaw * cap * (allowSupersawLead ? 1 : 0.68),
        0,
        allowSupersawLead ? 1.1 : 0.32,
    );
    const redistributed = Math.max(0, beforeSaw - blend.supersaw);
    blend.sine += redistributed * 0.56;
    blend.wavetable += redistributed * 0.44;
    return blend;
}

function resolveArchitecture({ biomeId = 'default', section = 'INTRO', sourceMode = 'hybrid', sceneMorph = 0.5, rng }) {
    const pool = ARCHITECTURE_BY_BIOME[biomeId] || ARCHITECTURE_BY_BIOME.default;
    const weighted = pool.slice();
    if (sourceMode === 'sine' && !weighted.includes('harmonic')) weighted.unshift('harmonic');
    if (sourceMode === 'supersaw' && !weighted.includes('pulse')) weighted.unshift('pulse');
    if (sourceMode === 'wavetable' && !weighted.includes('shimmer')) weighted.unshift('shimmer');
    if (section === 'SURGE') weighted.unshift('pulse');
    if (section === 'AFTERGLOW') weighted.unshift('shimmer');
    if (sceneMorph > 0.74) weighted.unshift('fm');
    if (sceneMorph < 0.32) weighted.unshift('harmonic');
    return rng.pick(weighted);
}

function spawnOscLayer({
    ctx,
    type = 'sine',
    frequency = 220,
    detune = 0,
    gain = 0.1,
    scheduleTime = 0,
    dur = 1,
    bus = null,
    nodes = [],
    detuneTargets = [],
} = {}) {
    const osc = ctx.createOscillator();
    const layerGain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = Math.max(20, frequency);
    osc.detune.value = detune;
    layerGain.gain.value = gain;
    osc.connect(layerGain);
    layerGain.connect(bus);
    osc.start(scheduleTime);
    osc.stop(scheduleTime + dur + 0.04);
    nodes.push(osc, layerGain);
    if (osc?.detune) detuneTargets.push(osc.detune);
}

function createNoiseBuffer(ctx, durSec = 2, rng, tint = 'neutral') {
    const len = Math.max(64, Math.floor(ctx.sampleRate * Math.max(0.2, durSec)));
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let acc = 0;
    for (let i = 0; i < len; i++) {
        const white = rng.next() * 2 - 1;
        if (tint === 'dark') {
            acc = acc * 0.985 + white * 0.08;
            data[i] = acc;
        } else if (tint === 'bright') {
            const prev = i > 0 ? data[i - 1] : 0;
            data[i] = white - prev * 0.78;
        } else {
            data[i] = white;
        }
    }
    return buffer;
}

function automateRhythmGate(param, {
    scheduleTime = 0,
    dur = 1,
    section = 'INTRO',
    motion = 0.5,
    texture = 0.5,
    seed = 1,
    stepSeconds = 0.125,
} = {}) {
    const rng = new RNG((seed >>> 0) + 91507);
    const pulseLen = section === 'SURGE'
        ? rng.pick([5, 7, 9])
        : section === 'AFTERGLOW'
            ? rng.pick([6, 8])
            : rng.pick([5, 7, 8]);
    const gatePattern = [];
    for (let i = 0; i < pulseLen; i++) {
        const bias = i === 0 ? 0.98 : 0.3 + texture * 0.32 + (i % 3 === 0 ? 0.14 : 0);
        gatePattern.push(rng.bool(clamp(bias, 0.1, 0.98)) ? 1 : 0);
    }
    if (!gatePattern.some((v) => v === 1)) gatePattern[0] = 1;

    const tick = clamp(stepSeconds * (section === 'SURGE' ? 0.5 : 0.75), 0.07, 0.28);
    let t = scheduleTime;
    let idx = 0;
    param.cancelScheduledValues(scheduleTime);
    param.setValueAtTime(0.0001, scheduleTime);
    while (t < scheduleTime + dur) {
        const on = gatePattern[idx % pulseLen] === 1;
        const level = on
            ? clamp(0.74 + motion * 0.36 + (idx % pulseLen === 0 ? 0.2 : 0), 0.5, 1.3)
            : clamp(0.26 + texture * 0.24, 0.14, 0.62);
        param.linearRampToValueAtTime(level, t + Math.min(0.03, tick * 0.48));
        t += tick;
        idx++;
    }
    param.linearRampToValueAtTime(0.0001, scheduleTime + dur);
}

export class DroneSources {
    constructor(host) {
        this.host = host;
        this._wavetable = null;
    }

    trigger({ scheduleTime, durationSec, params, modulation, quality, output, preCapture, postCapture, section = 'INTRO' }) {
        const host = this.host;
        const ctx = host.ctx;
        const planet = host.planet;
        if (!ctx || !planet || !output) return null;

        const sceneMorph = clamp(params.sceneMorph ?? 0.5, 0, 1);
        const richnessTier = params.richnessTier || 'balanced';
        const biomeId = params.biomeId || planet?.biome?.id || 'default';
        const harshBiome = HARSH_BIOMES.has(biomeId);
        const harmonicity = clamp(params?.richnessProfile?.harmonicity ?? params?.harmonicity ?? 0.5, 0, 1);
        const density = clamp(params?.richnessProfile?.density ?? params?.density ?? 0.5, 0, 1);
        const accentMode = params.accentMode !== false;
        const accentStrength = clamp(params.accentStrength ?? 0.72, 0.15, 1.4);
        const accentDensity = clamp(params.accentDensity ?? 0.68, 0.12, 1.4);
        const sourceComplexity = clamp(
            (quality?.sourceComplexity ?? 0.8)
            * (quality?.bedComplexity ?? 0.85)
            * (richnessTier === 'lush' ? 1.08 : richnessTier === 'sparse' ? 0.74 : 0.92),
            0.22,
            1.2,
        );
        const supersawCap = clamp(
            params.supersawCap ?? (harshBiome ? 0.92 : (richnessTier === 'lush' ? 0.24 : richnessTier === 'balanced' ? 0.16 : 0.1)),
            0,
            1,
        );
        const allowSupersawLead = params.allowSupersawLead ?? harshBiome;
        const sceneSeed = Number.isFinite(params.sceneSeed) ? (params.sceneSeed >>> 0) : ((planet.seed + host.stepChord * 307) >>> 0);
        const rng = new RNG((planet.seed + host.stepChord * 911 + host.stepNote * 131 + sceneSeed * 7) >>> 0);
        const root = Array.isArray(host._currentChordIntervals) && host._currentChordIntervals.length
            ? host._currentChordIntervals[0]
            : (planet.scale?.[0] || 0);
        const color = Array.isArray(host._currentChordIntervals) && host._currentChordIntervals.length > 1
            ? host._currentChordIntervals[1]
            : root;

        const rootFreq = host._getStepFrequency(planet, root, 0.82);
        const colorFreq = host._getStepFrequency(planet, color, 1.1);
        const fifthFreq = host._getStepFrequency(planet, host._shiftScaleStep?.(planet, root, 4, 0) ?? color, 1.18);
        const accentMinDur = accentMode
            ? (harshBiome ? 0.9 : 1.15)
            : 1.8;
        const accentMaxDur = accentMode
            ? (richnessTier === 'sparse' ? 10.4 : 9.6)
            : 14;
        const dur = clamp(
            durationSec * (accentMode ? (richnessTier === 'sparse' ? 0.62 : 0.78) : 1),
            accentMinDur,
            accentMaxDur,
        );
        const ttlSec = dur + 0.9;

        const carrierBus = ctx.createGain();
        const tone = ctx.createBiquadFilter();
        const gate = ctx.createGain();
        const pan = ctx.createStereoPanner();
        const env = ctx.createGain();
        const architecture = resolveArchitecture({
            biomeId,
            section,
            sourceMode: params.sourceMode || 'hybrid',
            sceneMorph,
            rng,
        });
        const architectureMix = {
            ...(ARCHITECTURE_BLEND[architecture] || ARCHITECTURE_BLEND.harmonic),
        };
        if (richnessTier === 'lush') {
            architectureMix.fm *= 1.16;
            architectureMix.wavetable *= 1.14;
            architectureMix.supersaw *= 0.9;
            architectureMix.noise *= 0.92;
        } else if (richnessTier === 'sparse') {
            architectureMix.fm *= 0.74;
            architectureMix.wavetable *= 0.82;
            architectureMix.noise *= 0.7;
            architectureMix.supersaw *= 0.72;
        }
        architectureMix.harmonic *= clamp(0.82 + density * 0.34, 0.72, 1.24);
        if (!allowSupersawLead) architectureMix.supersaw *= 0.58;
        architectureMix.supersaw *= clamp(supersawCap * 1.24, 0.05, 1.12);
        architectureMix.noise *= clamp(quality?.noiseMul ?? 1, 0.2, 1.2);

        const attack = clamp(
            (0.24 + params.tail * 1.2 + (architecture === 'shimmer' ? 0.14 : architecture === 'noisy' ? -0.06 : 0))
            * (accentMode ? (0.72 + accentStrength * 0.24) : 1),
            0.14,
            2.4,
        );
        const peak = clamp(
            (0.14 + params.dream * 0.22 + params.texture * 0.12 + sceneMorph * 0.1 + (section === 'SURGE' ? 0.06 : 0))
            * (0.56 + accentStrength * 0.48),
            0.08,
            0.68,
        );
        const sustain = clamp(
            peak * (0.54 + params.diffusion * 0.24 + (architecture === 'pulse' ? -0.08 : 0.04)),
            0.08,
            0.52,
        );

        env.gain.setValueAtTime(0.0001, scheduleTime);
        env.gain.linearRampToValueAtTime(peak, scheduleTime + attack);
        env.gain.linearRampToValueAtTime(sustain, Math.max(scheduleTime + attack, scheduleTime + dur * 0.66));
        if (architecture === 'pulse' || section === 'SURGE' || accentDensity > 0.95) {
            automateRhythmGate(gate.gain, {
                scheduleTime,
                dur,
                section,
                motion: params.motion || 0.5,
                texture: params.texture || 0.5,
                seed: sceneSeed,
                stepSeconds: host.transport?.stepSeconds || 0.125,
            });
        } else {
            gate.gain.setValueAtTime(1, scheduleTime);
        }
        env.gain.exponentialRampToValueAtTime(0.0001, scheduleTime + dur);

        tone.type = architecture === 'noisy'
            ? 'bandpass'
            : architecture === 'fm' && section === 'SURGE'
                ? 'highpass'
                : 'lowpass';
        tone.frequency.value = clamp(
            280
            + params.texture * 3100
            + sceneMorph * 900
            + (modulation?.filterCutoffShift || 0) * 900,
            140,
            7200,
        );
        tone.Q.value = clamp(0.4 + params.resonance * 3.6 + (architecture === 'noisy' ? 0.7 : 0), 0.35, 8);
        pan.pan.value = clamp((modulation?.panShift || 0) * 0.8, -0.9, 0.9);

        carrierBus.connect(tone);
        tone.connect(env);
        env.connect(gate);
        gate.connect(pan);
        pan.connect(output);
        if (postCapture?.connect) pan.connect(postCapture);

        const nodes = [carrierBus, tone, env, gate, pan];
        const sourceMode = params.sourceMode || 'hybrid';
        const blend = resolveSourceBlend(sourceMode, params.texture, {
            supersawCap,
            allowSupersawLead,
            richnessTier,
        });
        const detuneTargets = [];
        let accentCount = 0;

        spawnOscLayer({
            ctx,
            type: 'sine',
            frequency: rootFreq,
            detune: modulation?.detuneShiftCents || 0,
            gain: clamp((0.3 + params.dream * 0.3) * blend.sine * architectureMix.sine * sourceComplexity, 0.02, 0.94),
            scheduleTime,
            dur,
            bus: carrierBus,
            nodes,
            detuneTargets,
        });
        spawnOscLayer({
            ctx,
            type: 'sine',
            frequency: Math.max(24, rootFreq * 0.5),
            detune: (modulation?.detuneShiftCents || 0) * 0.32,
            gain: clamp((0.1 + params.dream * 0.2) * blend.sub * architectureMix.sub * sourceComplexity, 0.02, 0.54),
            scheduleTime,
            dur,
            bus: carrierBus,
            nodes,
            detuneTargets,
        });

        if (architecture === 'harmonic' || architecture === 'shimmer') {
            const harmonicWave = architecture === 'shimmer' ? 'triangle' : 'sine';
            const harmonicCountBase = architecture === 'shimmer' ? 3 : 2;
            const harmonicCount = clamp(
                Math.round(harmonicCountBase * sourceComplexity * (richnessTier === 'lush' ? 1.2 : richnessTier === 'sparse' ? 0.78 : 1)),
                1,
                3,
            );
            const freqs = [colorFreq, fifthFreq, rootFreq * 2.01];
            for (let i = 0; i < harmonicCount; i++) {
                spawnOscLayer({
                    ctx,
                    type: harmonicWave,
                    frequency: freqs[i] || colorFreq,
                    detune: rng.range(-14, 14) + (modulation?.detuneShiftCents || 0) * 0.4,
                    gain: clamp(
                        (0.04 + params.texture * 0.14 + harmonicity * 0.08)
                        * (1 / (1 + i * 0.3))
                        * sourceComplexity,
                        0.01,
                        0.24,
                    ),
                    scheduleTime,
                    dur,
                    bus: carrierBus,
                    nodes,
                    detuneTargets,
                });
            }
            accentCount += harmonicCount;
        }

        if (blend.supersaw > 0.01 && (quality?.supersawMul ?? 1) > 0.05) {
            const sawStrength = blend.supersaw * architectureMix.supersaw * clamp(quality?.supersawMul ?? 1, 0.12, 1);
            const count = Math.max(
                1,
                Math.round((quality?.maxSupersawVoices || 4) * clamp(sawStrength * 1.1, 0.2, 1.2)),
            );
            const saws = buildSupersawVoices(ctx, colorFreq, count, rng);
            const sawBus = ctx.createGain();
            sawBus.gain.value = clamp(
                (0.04 + params.texture * 0.16 + sceneMorph * 0.08)
                * sawStrength
                * sourceComplexity,
                0.008,
                0.44,
            );
            const sawFilter = ctx.createBiquadFilter();
            sawFilter.type = architecture === 'noisy' ? 'bandpass' : 'lowpass';
            sawFilter.frequency.value = clamp(420 + params.texture * 3600 + sceneMorph * 800, 240, 7600);
            sawFilter.Q.value = architecture === 'noisy' ? 1.2 : 0.7;
            if (sawBus.gain.value > 0.01) {
                sawBus.connect(sawFilter);
                sawFilter.connect(carrierBus);
                nodes.push(sawBus, sawFilter, ...saws);
                saws.forEach((osc) => osc.connect(sawBus));
                saws.forEach((osc) => {
                    osc.start(scheduleTime);
                    osc.stop(scheduleTime + dur + 0.04);
                });
                accentCount++;
            }
        }

        if (blend.wavetable > 0.01) {
            if (!this._wavetable) this._wavetable = createWavetable(ctx);
            const wt = ctx.createOscillator();
            wt.setPeriodicWave(this._wavetable);
            wt.frequency.value = Math.max(20, rootFreq * (architecture === 'shimmer' ? 0.75 : 0.5));
            wt.detune.value = 4 + (modulation?.detuneShiftCents || 0) * 0.5;
            const wtGain = ctx.createGain();
            wtGain.gain.value = clamp(
                (0.05 + params.texture * 0.2 + sceneMorph * 0.06)
                * blend.wavetable
                * architectureMix.wavetable
                * sourceComplexity,
                0.01,
                0.48,
            );
            wt.connect(wtGain);
            wtGain.connect(carrierBus);
            nodes.push(wt, wtGain);
            detuneTargets.push(wt.detune);
            wt.start(scheduleTime);
            wt.stop(scheduleTime + dur + 0.04);
            accentCount++;
        }

        if (architectureMix.fm > 0.14 && sourceComplexity > 0.34) {
            const carrier = ctx.createOscillator();
            const mod = ctx.createOscillator();
            const modGain = ctx.createGain();
            const fmGain = ctx.createGain();
            carrier.type = architecture === 'fm' ? 'triangle' : 'sine';
            mod.type = 'sine';
            carrier.frequency.value = colorFreq * (architecture === 'fm' ? 1.01 : 0.5);
            mod.frequency.value = Math.max(20, rootFreq * (architecture === 'fm' ? rng.pick([1.5, 2, 2.5, 3]) : 2));
            modGain.gain.value = clamp(rootFreq * (0.04 + params.resonance * 0.24) * architectureMix.fm, 6, 440);
            fmGain.gain.value = clamp(
                (0.02 + params.texture * 0.1 + sceneMorph * 0.05)
                * architectureMix.fm
                * sourceComplexity,
                0.01,
                0.34,
            );
            mod.connect(modGain);
            modGain.connect(carrier.frequency);
            carrier.connect(fmGain);
            fmGain.connect(carrierBus);
            nodes.push(carrier, mod, modGain, fmGain);
            detuneTargets.push(carrier.detune);
            mod.start(scheduleTime);
            carrier.start(scheduleTime);
            mod.stop(scheduleTime + dur + 0.04);
            carrier.stop(scheduleTime + dur + 0.04);
            accentCount++;
        }

        if (architectureMix.noise > 0.02 && (quality?.noiseMul ?? 1) > 0.2) {
            const noise = ctx.createBufferSource();
            const noiseFilter = ctx.createBiquadFilter();
            const noiseGain = ctx.createGain();
            const tint = architecture === 'noisy' ? 'dark' : architecture === 'shimmer' ? 'bright' : 'neutral';
            noise.buffer = createNoiseBuffer(ctx, dur * 0.9, rng, tint);
            noiseFilter.type = architecture === 'noisy' ? 'lowpass' : 'bandpass';
            noiseFilter.frequency.value = architecture === 'noisy'
                ? clamp(220 + params.texture * 680 + sceneMorph * 220, 120, 1800)
                : clamp(1200 + params.texture * 2600 + sceneMorph * 1200, 600, 6400);
            noiseFilter.Q.value = architecture === 'noisy' ? 0.48 : 1.1;
            noiseGain.gain.setValueAtTime(0.0001, scheduleTime);
            noiseGain.gain.linearRampToValueAtTime(
                clamp(
                    (0.008 + params.texture * 0.06 + params.diffusion * 0.04)
                    * architectureMix.noise
                    * sourceComplexity,
                    0.005,
                    0.12,
                ),
                scheduleTime + Math.min(0.44, attack * 0.84),
            );
            noiseGain.gain.exponentialRampToValueAtTime(0.0001, scheduleTime + dur);
            noise.connect(noiseFilter);
            noiseFilter.connect(noiseGain);
            noiseGain.connect(carrierBus);
            nodes.push(noise, noiseFilter, noiseGain);
            noise.start(scheduleTime);
            noise.stop(scheduleTime + dur + 0.04);
            accentCount++;
        }

        if (
            quality?.shimmerEnabled
            && section !== 'RELEASE'
            && sourceComplexity > 0.42
            && rng.range(0, 1) < (modulation?.shimmerChance || 0.2)
        ) {
            const shimmer = ctx.createOscillator();
            shimmer.type = rng.pick(['triangle', 'sine']);
            shimmer.frequency.value = rootFreq * rng.pick(architecture === 'shimmer' ? [2.01, 2.5, 3, 4] : [2.01, 2.5, 3]);
            const shimmerGain = ctx.createGain();
            shimmerGain.gain.setValueAtTime(0.0001, scheduleTime + attack * 0.3);
            shimmerGain.gain.linearRampToValueAtTime(
                clamp((0.01 + sceneMorph * 0.02 + harmonicity * 0.012) * sourceComplexity, 0.006, 0.04),
                scheduleTime + attack * 0.8,
            );
            shimmerGain.gain.exponentialRampToValueAtTime(0.0001, scheduleTime + dur * 0.72);
            shimmer.connect(shimmerGain);
            shimmerGain.connect(carrierBus);
            nodes.push(shimmer, shimmerGain);
            detuneTargets.push(shimmer.detune);
            shimmer.start(scheduleTime + 0.01);
            shimmer.stop(scheduleTime + dur * 0.76);
            accentCount++;
        }

        if (preCapture?.connect) carrierBus.connect(preCapture);

        const lfo = ctx.createOscillator();
        const lfoGain = ctx.createGain();
        lfo.type = 'sine';
        lfo.frequency.value = clamp(
            0.02 + params.motion * 0.2 + (modulation?.rateHz || 0) * 0.52 + (architecture === 'pulse' ? 0.06 : 0),
            0.015,
            0.72,
        );
        lfoGain.gain.value = clamp((4 + params.motion * 18 + (architecture === 'fm' ? 7 : 0)) * sourceComplexity, 3, 34);
        lfo.connect(lfoGain);
        detuneTargets.forEach((target) => lfoGain.connect(target));
        lfo.start(scheduleTime);
        lfo.stop(scheduleTime + dur + 0.04);
        nodes.push(lfo, lfoGain);

        this.host.nodes.pushTransient(ttlSec, ...nodes);
        const supersawNumerator = blend.supersaw * architectureMix.supersaw * clamp(quality?.supersawMul ?? 1, 0.1, 1);
        const supersawDenominator = Math.max(
            0.001,
            blend.sine * architectureMix.sine
            + blend.sub * architectureMix.sub
            + blend.wavetable * architectureMix.wavetable
            + supersawNumerator
            + architectureMix.fm * 0.45
            + architectureMix.noise * 0.2,
        );
        const supersawShare = clamp(supersawNumerator / supersawDenominator, 0, 1);
        return { ttlSec, nodeCount: nodes.length, supersawShare, accentCount };
    }
}
