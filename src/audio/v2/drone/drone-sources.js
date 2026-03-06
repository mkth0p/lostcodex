import { RNG } from '../../../rng.js';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

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

function resolveSourceBlend(mode = 'hybrid', texture = 0.5) {
    const safeTexture = clamp(texture, 0, 1);
    switch (mode) {
        case 'sine':
            return { sine: 1, sub: 0.78, supersaw: 0.04 + safeTexture * 0.06, wavetable: 0.06 };
        case 'supersaw':
            return { sine: 0.22, sub: 0.26, supersaw: 1, wavetable: 0.16 + safeTexture * 0.08 };
        case 'wavetable':
            return { sine: 0.2, sub: 0.24, supersaw: 0.08, wavetable: 1 };
        default:
            return { sine: 0.58, sub: 0.4, supersaw: 0.72, wavetable: 0.62 };
    }
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

        const rng = new RNG((planet.seed + host.stepChord * 911 + host.stepNote * 131) >>> 0);
        const root = Array.isArray(host._currentChordIntervals) && host._currentChordIntervals.length
            ? host._currentChordIntervals[0]
            : (planet.scale?.[0] || 0);
        const color = Array.isArray(host._currentChordIntervals) && host._currentChordIntervals.length > 1
            ? host._currentChordIntervals[1]
            : root;

        const rootFreq = host._getStepFrequency(planet, root, 0.82);
        const colorFreq = host._getStepFrequency(planet, color, 1.1);
        const dur = clamp(durationSec, 1.8, 14);
        const ttlSec = dur + 0.9;

        const carrierBus = ctx.createGain();
        const tone = ctx.createBiquadFilter();
        const pan = ctx.createStereoPanner();
        const env = ctx.createGain();

        const attack = clamp(0.48 + params.tail * 1.8, 0.28, 3.2);
        const peak = clamp(0.24 + params.dream * 0.28 + params.texture * 0.12, 0.18, 0.64);
        const sustain = clamp(peak * (0.74 + params.diffusion * 0.22), 0.14, 0.48);

        env.gain.setValueAtTime(0.0001, scheduleTime);
        env.gain.linearRampToValueAtTime(peak, scheduleTime + attack);
        env.gain.setValueAtTime(sustain, scheduleTime + dur * 0.66);
        env.gain.exponentialRampToValueAtTime(0.0001, scheduleTime + dur);

        tone.type = 'lowpass';
        tone.frequency.value = clamp(320 + params.texture * 2900 + (modulation?.filterCutoffShift || 0) * 900, 180, 5600);
        tone.Q.value = clamp(0.45 + params.resonance * 3.4, 0.4, 6.2);
        pan.pan.value = clamp((modulation?.panShift || 0) * 0.8, -0.9, 0.9);

        carrierBus.connect(tone);
        tone.connect(env);
        env.connect(pan);
        pan.connect(output);
        if (postCapture?.connect) pan.connect(postCapture);

        const nodes = [carrierBus, tone, env, pan];
        const sourceMode = params.sourceMode || 'hybrid';
        const blend = resolveSourceBlend(sourceMode, params.texture);

        const sine = ctx.createOscillator();
        sine.type = 'sine';
        sine.frequency.value = rootFreq;
        sine.detune.value = modulation?.detuneShiftCents || 0;
        const sineGain = ctx.createGain();
        sineGain.gain.value = clamp((0.44 + params.dream * 0.42) * blend.sine, 0.08, 1.28);
        sine.connect(sineGain);
        sineGain.connect(carrierBus);
        nodes.push(sine, sineGain);

        const sub = ctx.createOscillator();
        sub.type = 'sine';
        sub.frequency.value = Math.max(24, rootFreq * 0.5);
        sub.detune.value = (modulation?.detuneShiftCents || 0) * 0.32;
        const subGain = ctx.createGain();
        subGain.gain.value = clamp((0.14 + params.dream * 0.26) * blend.sub, 0.04, 0.62);
        sub.connect(subGain);
        subGain.connect(carrierBus);
        nodes.push(sub, subGain);

        if (blend.supersaw > 0.01) {
            const count = quality?.maxSupersawVoices || 4;
            const saws = buildSupersawVoices(ctx, colorFreq, count, rng);
            const sawBus = ctx.createGain();
            sawBus.gain.value = clamp((0.12 + params.texture * 0.32) * blend.supersaw, 0.06, 0.76);
            const sawFilter = ctx.createBiquadFilter();
            sawFilter.type = 'lowpass';
            sawFilter.frequency.value = clamp(520 + params.texture * 3400, 320, 6200);
            sawFilter.Q.value = 0.7;
            sawBus.connect(sawFilter);
            sawFilter.connect(carrierBus);
            nodes.push(sawBus, sawFilter, ...saws);
            saws.forEach((osc) => osc.connect(sawBus));
            saws.forEach((osc) => {
                osc.start(scheduleTime);
                osc.stop(scheduleTime + dur + 0.04);
            });
        }

        if (blend.wavetable > 0.01) {
            if (!this._wavetable) this._wavetable = createWavetable(ctx);
            const wt = ctx.createOscillator();
            wt.setPeriodicWave(this._wavetable);
            wt.frequency.value = rootFreq * 0.5;
            wt.detune.value = 4 + (modulation?.detuneShiftCents || 0) * 0.5;
            const wtGain = ctx.createGain();
            wtGain.gain.value = clamp((0.12 + params.texture * 0.28) * blend.wavetable, 0.06, 0.62);
            wt.connect(wtGain);
            wtGain.connect(carrierBus);
            nodes.push(wt, wtGain);
            wt.start(scheduleTime);
            wt.stop(scheduleTime + dur + 0.04);
        }

        if (quality?.shimmerEnabled && section !== 'RELEASE' && rng.range(0, 1) < (modulation?.shimmerChance || 0.2)) {
            const shimmer = ctx.createOscillator();
            shimmer.type = rng.pick(['triangle', 'sine']);
            shimmer.frequency.value = rootFreq * rng.pick([2.01, 2.5, 3]);
            const shimmerGain = ctx.createGain();
            shimmerGain.gain.setValueAtTime(0.0001, scheduleTime + attack * 0.3);
            shimmerGain.gain.linearRampToValueAtTime(0.024, scheduleTime + attack * 0.8);
            shimmerGain.gain.exponentialRampToValueAtTime(0.0001, scheduleTime + dur * 0.72);
            shimmer.connect(shimmerGain);
            shimmerGain.connect(carrierBus);
            nodes.push(shimmer, shimmerGain);
            shimmer.start(scheduleTime + 0.01);
            shimmer.stop(scheduleTime + dur * 0.76);
        }

        if (preCapture?.connect) carrierBus.connect(preCapture);

        sine.start(scheduleTime);
        sine.stop(scheduleTime + dur + 0.04);
        sub.start(scheduleTime);
        sub.stop(scheduleTime + dur + 0.04);

        const lfo = ctx.createOscillator();
        const lfoGain = ctx.createGain();
        lfo.type = 'sine';
        lfo.frequency.value = clamp(0.02 + params.motion * 0.22 + (modulation?.rateHz || 0) * 0.6, 0.015, 0.5);
        lfoGain.gain.value = clamp(7 + params.motion * 28, 6, 34);
        lfo.connect(lfoGain);
        lfoGain.connect(sine.detune);
        lfo.start(scheduleTime);
        lfo.stop(scheduleTime + dur + 0.04);
        nodes.push(lfo, lfoGain);

        this.host.nodes.pushTransient(ttlSec, ...nodes);
        return { ttlSec, nodeCount: nodes.length };
    }
}
