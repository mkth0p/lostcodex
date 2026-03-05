import { RNG } from '../../rng.js';
import { buildVoice, ADDITIVE_VOICE_NAMES } from '../../voices.js';

const NATIVE_OSC_TYPES = new Set(['sine', 'square', 'sawtooth', 'triangle']);

export function scheduleMelodyNote(engine, planet, dest, ac, scheduledTime = null) {
    const ctx = engine.ctx;
    // Tier 4: Strict Determinism & Scaled Generation
    // A unique RNG seed composed of the planet seed + the total number of notes fired
    const rng = new RNG(planet.seed + 1000 + engine.stepNote++);
    const biomeId = planet?.biome?.id;

    // Motif / Phrase logic
    let step = null;
    const phrasePos = engine.stepNote % 8; // 8-step micro-phrases
    const isResponse = (engine.stepNote % 16) >= 8;
    const isPhraseEnd = phrasePos === 7;
    const motifChance = biomeId === 'fungal' ? (isResponse ? 0.62 : 0.26) : (isResponse ? 0.4 : 0.15);
    const responseChance = biomeId === 'fungal' ? (isResponse ? 0.46 : 0.08) : (isResponse ? 0.35 : 0.05);

    // 1. Motif Recall (Bank-based)
    // High chance of motif during response, or some chance anytime
    if (engine._motifEnabled && planet.motifBank?.length > 0 && rng.range(0, 1) < motifChance) {
        engine._melodyMode = 'MOTIF';
        const bank = planet.motifBank[engine._activeMotifIdx];
        step = bank[phrasePos % bank.length];
    }
    // 2. Call & Response: History recall
    else if (engine._melodyHistory.length >= 4 && rng.range(0, 1) < responseChance) {
        engine._melodyMode = 'RESPONSE';
        const variation = biomeId === 'fungal' ? rng.int(-1, 1) : rng.int(-1, 2);
        const hIdx = engine.stepNote % 4;
        step = engine._melodyHistory[engine._melodyHistory.length - 4 + hIdx] + variation;
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

            const tensionBias = (engine.tension || 0) > 0.6 && (norm === 6 || norm === 1) ? 2.5 : 1;
            const isChordTone = engine._currentChordIntervals.some(ci => ci % 12 === norm);
            let chordBias = isChordTone ? 4 : 1;
            let motionBias = 1;
            let fungalBias = 1;

            const chordAudibility = ac && ac.chordAudibility !== undefined ? ac.chordAudibility : 0.5;
            if (!isChordTone) chordBias *= (1 - chordAudibility * 0.8);
            if (engine.lastStep !== undefined && biomeId === 'fungal') {
                const diff = Math.abs(s - engine.lastStep);
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

        if (engine.lastStep !== undefined) {
            sc.forEach(s => {
                const diff = Math.abs(s - engine.lastStep);
                if (diff > 0 && diff <= 5) pool.push(s, s); // Leading tone / step-wise motion
            });
        }
        step = pool.length > 0 ? rng.pick(pool) : sc[0];
        engine._melodyMode = 'GENERATIVE';
    }

    engine._melodyHistory.push(step);
    if (engine._melodyHistory.length > 16) engine._melodyHistory.shift();

    if (step === null || isNaN(step)) return; // Note rests here

    engine.lastStep = step;
    engine._lastMelodyStep = step;

    const oct = ac ? rng.pick(ac.melodyOcts) : rng.pick([2, 3, 4]);

    // Tier 4: Microtonal / Just Intonation / Pythagorean override
    let freq = engine._getStepFrequency(planet, step, oct);
    // Quarter-tone micro-detuning: probabilistic Â±50 cents offset
    if ((planet.quarterToneProb || 0) > 0 && rng.next() < planet.quarterToneProb) {
        const centsOff = rng.range(-50, 50);
        freq *= Math.pow(2, centsOff / 1200);
    }
    // Clamp to audible range and stay safely below Nyquist (sampleRate / 2)
    const nyquist = ctx.sampleRate / 2;
    freq = Math.max(20, Math.min(freq || 440, nyquist - 200));

    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    const wType = engine._pickMelodyWave(planet, ac, rng);
    const perf = engine._getPerformanceProfile(planet);

    let atk = rng.range(0.8, 4.5);
    let dur = rng.range(3.5, 15);

    // Custom PeriodicWave voices â€” each has hand-crafted harmonic content
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
        ({ atk, dur } = engine._getAdditiveVoiceEnvelope(wType, rng, atk, dur));
        ({ atk, dur } = engine._applyBiomeMelodyGesture(planet, wType, engine._melodyMode, phrasePos, isPhraseEnd, atk, dur));
        ({ atk, dur } = engine._shapeMelodyEnvelope(wType, atk, dur, planet));
        if (typeof engine._limitLongTailEnvelope === 'function') {
            ({ atk, dur } = engine._limitLongTailEnvelope(wType, atk, dur, planet));
        }
        engine._markMelodyVoiceUsage(wType, planet);
        //    Additive synthesis voice (self-contained, returns early)
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
        engine.nodes.pushTransient(engine._getAdditiveVoiceLifetime(wType, atk, dur), panner);
        buildVoice(wType, ctx, freq, panner, rng, atk, dur, engine.nodes);
        engine._scheduleMoonCanons(planet, dest, step, {
            perf,
            mode: engine._melodyMode,
            phrasePos,
            isPhraseEnd,
            isResponse,
        });
        return; // voices.js handles full envelope - no further processing needed
    } else {
        osc.type = engine._resolveOscType(wType);
    }


    ({ atk, dur } = engine._applyBiomeMelodyGesture(planet, wType, engine._melodyMode, phrasePos, isPhraseEnd, atk, dur));
    ({ atk, dur } = engine._shapeMelodyEnvelope(wType, atk, dur, planet));
    if (typeof engine._limitLongTailEnvelope === 'function') {
        ({ atk, dur } = engine._limitLongTailEnvelope(wType, atk, dur, planet));
    }
    engine._markMelodyVoiceUsage(wType, planet);

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
    engine.nodes.push(osc, env, panner);
    // Auto-cleanup when note ends to prevent node accumulation
    osc.onended = () => { try { osc.disconnect(); env.disconnect(); panner.disconnect(); } catch { } };

    //    Pitch bend vibrato (gated by flag)
    const bendScale = biomeId === 'fungal' ? 0.55 : 1;
    const bendCents = (engine._pitchBendEnabled && ac && ac.pitchBend) ? ac.pitchBend * bendScale : 0;
    if (bendCents > 0) {
        const bendHz = freq * (Math.pow(2, bendCents / 1200) - 1);
        engine._lfoOnce(ctx, rng.range(3, 9), bendHz * rng.range(0.3, 1), osc.frequency, now, atk + dur);
    }

    //    Chord layer (gated by flag)
    engine._scheduleMoonCanons(planet, dest, step, {
        perf,
        mode: engine._melodyMode,
        phrasePos,
        isPhraseEnd,
        isResponse,
    });

    const chordLoadScale = perf.activeNodes > 280 ? 0.3 : (0.55 + perf.scalar * 0.45);
    const chordProb = ((engine._chordEnabled && ac && ac.chordProb) ? ac.chordProb : 0) * chordLoadScale;
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
            engine.nodes.push(co, ce, cp);
        }
    }

    //    Arp run (gated by flag)
    const arpLoadScale = perf.activeNodes > 250 ? 0.15 : perf.scalar;
    const arpProb = ((engine._arpEnabled && ac && ac.arpProb) ? ac.arpProb : 0) * arpLoadScale;
    if (arpProb > 0 && rng.next() < arpProb && planet.scale.length >= 4) {
        const sc = planet.scale;
        const arpSpan = perf.pressure > 0.6 ? 2 : (perf.pressure > 0.35 ? 3 : 4);
        const startIdx = rng.int(0, Math.max(1, sc.length - arpSpan));
        const arpNotes = sc.slice(startIdx, startIdx + arpSpan);
        const arpSpeed = rng.range(0.08, 0.22); // seconds between notes
        arpNotes.forEach((s, i) => {
            const arpFreq = engine._getStepFrequency(planet, s, oct || 1);
            const ao = ctx.createOscillator(), ae = ctx.createGain();
            const nw = ac ? ac.melodyWaves.find(w => NATIVE_OSC_TYPES.has(w)) : 'sine';
            ao.type = engine._resolveOscType(nw, 'sine');
            ao.frequency.value = arpFreq;
            const t0 = now + i * arpSpeed;
            ae.gain.setValueAtTime(0, t0);
            ae.gain.linearRampToValueAtTime(0.12, t0 + 0.02);
            ae.gain.exponentialRampToValueAtTime(0.001, t0 + 0.18);
            ao.connect(ae); ae.connect(dest);
            ao.start(t0); ao.stop(t0 + 0.22);
            engine.nodes.push(ao, ae);
        });
    }
}
