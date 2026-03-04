import { RNG } from './rng.js';
import { buildVoice, ADDITIVE_VOICE_NAMES } from './voices.js';
import { CHORD_TEMPLATES, PROGRESSIONS } from './data.js';

export class AudioEngine {
    constructor() {
        this.ctx = null; this.masterGain = null;
        this.reverbGain = null; this.dryGain = null;
        this.analyser = null; this.nodes = []; this.intervals = [];
        this.playing = false; this.planet = null; this.lastStep = undefined;
        this._vol = 0.7; this._reverb = 0.6; this._drift = 0.4; this._density = 0.5;
        this._granularEnabled = true;
        this._percussionEnabled = true;
        this._percVol = 0.8;
        this._noiseBuffer = null; // Cached noise buffer for percussion
        // Melody feature flags (toggled live from UI)
        this._chordEnabled = true;
        this._arpEnabled = false;
        this._pitchBendEnabled = true;
        this._motifEnabled = true;
        // Rhythm feature flags
        this._ghostEnabled = true;
        this._fillsEnabled = true;
        this.tension = 0;

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

        this._resetSteps();
    }

    _resetSteps() {
        this.stepNote = 0; this.stepGrain = 0; this.stepPerc = 0; this.stepFX = 0;
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
            this.compressor.threshold.value = -6;
            this.compressor.knee.value = 10;
            this.compressor.ratio.value = 4;
            this.compressor.attack.value = 0.003;
            this.compressor.release.value = 0.25;

            this.eqLow.connect(this.eqMid);
            this.eqMid.connect(this.eqHigh);
            this.eqHigh.connect(this.masterGain);
            this.masterGain.connect(this.compressor);
            this.compressor.connect(this.analyser);
            this.analyser.connect(this.ctx.destination);

            // Pre-build shared noise buffer for percussion (snare/shaker)
            const nLen = this.ctx.sampleRate;
            const nBuf = this.ctx.createBuffer(1, nLen, this.ctx.sampleRate);
            const nd = nBuf.getChannelData(0);
            for (let i = 0; i < nLen; i++) nd[i] = Math.random() * 2 - 1;
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

    _osc(type, freq, gain, dest) {
        const o = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        o.type = type; o.frequency.value = freq; g.gain.value = gain;
        o.connect(g); g.connect(dest); o.start();
        this.nodes.push(o, g);
        return { osc: o, gain: g };
    }

    _lfo(rate, depth, param, type = 'sine') {
        const l = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        l.type = type; l.frequency.value = rate; g.gain.value = depth;
        l.connect(g); g.connect(param); l.start();
        this.nodes.push(l, g);
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

    _scheduleNote(planet, dest, ac) {
        const ctx = this.ctx;
        // Tier 4: Strict Determinism & Scaled Generation
        // A unique RNG seed composed of the planet seed + the total number of notes fired
        const rng = new RNG(planet.seed + 1000 + this.stepNote++);

        let step;
        // 1. Call & Response: 15% chance to repeat a previous motif
        if (this._melodyHistory.length >= 4 && rng.range(0, 1) < 0.15) {
            this._melodyMode = 'RESPONSE';
            const hIdx = this.stepNote % 4;
            // Play a slightly varied version of the last motif (±1-2 scale steps)
            const variation = rng.int(-1, 2);
            step = this._melodyHistory[this._melodyHistory.length - 4 + hIdx] + variation;
        }
        // 2. Planet's 4-note motif: 25% chance
        else if (this._motifEnabled && rng.range(0, 1) < 0.25) {
            this._melodyMode = 'MOTIF';
            step = planet.motif[this.stepNote % 4];
        }
        // 3. Normal generative logic
        else {
            // Consonance-weighted Markov transition
            const WEIGHTS = { 0: 4, 7: 3, 12: 4, 4: 2, 3: 2, 9: 2, 5: 2, 2: 1, 10: 1, 11: 0.4, 1: 0.3, 6: 0.2 };
            const sc = planet.scale;
            const pool = [];
            sc.forEach(s => {
                const norm = ((s % 12) + 12) % 12;
                const tensionBias = (this.tension || 0) > 0.6 && (norm === 6 || norm === 1) ? 2.5 : 1;

                // Chord Tone Bias: 3x weight for notes in the current chord
                const isChordTone = this._currentChordIntervals.some(ci => ci % 12 === norm);
                const chordBias = isChordTone ? 3 : 1;

                const w = (WEIGHTS[norm] || 0.5) * tensionBias * chordBias;
                for (let i = 0; i < Math.max(1, Math.round(w * 2)); i++) pool.push(s);
            });
            if (this.lastStep !== undefined) {
                sc.forEach(s => {
                    const interval = Math.abs(s - this.lastStep) % 12;
                    if (interval === 7 || interval === 3 || interval === 4) pool.push(s);
                });
            }
            step = rng.pick(pool);
            this._melodyMode = 'GENERATIVE';
        }
        this.lastStep = step;

        // Push to history (max 16 notes)
        this._melodyHistory.push(step);
        if (this._melodyHistory.length > 16) this._melodyHistory.shift();

        const oct = ac ? rng.pick(ac.melodyOcts) : rng.pick([2, 3, 4]);

        // Tier 4: Microtonal / Just Intonation / Pythagorean override
        let freq;
        // Octave multiplier with optional gamelan-style stretch
        const octMul = Math.pow(planet.octaveStretch || 2, Math.log2(oct));
        if (planet.useJI && planet.jiRatios) {
            const norm = ((step % 12) + 12) % 12;
            let ratio = planet.jiRatios[norm];
            if (step >= 12) ratio *= (planet.octaveStretch || 1) * 2;
            if (step <= -12) ratio *= 0.5 / (planet.octaveStretch || 1);
            freq = planet.rootFreq * octMul * ratio;
        } else {
            freq = planet.rootFreq * octMul * Math.pow(2, step / 12);
        }
        // Quarter-tone micro-detuning: probabilistic ±50 cents offset
        if ((planet.quarterToneProb || 0) > 0 && rng.next() < planet.quarterToneProb) {
            const centsOff = rng.range(-50, 50);
            freq *= Math.pow(2, centsOff / 1200);
        }
        // Clamp to audible range (keep generous to preserve variety)
        freq = Math.max(20, Math.min(freq, (ctx.sampleRate / 2) - 100));

        const osc = ctx.createOscillator();
        const env = ctx.createGain();
        const wType = ac ? rng.pick(ac.melodyWaves) : 'sine';

        let atk = rng.range(0.8, 4.5);
        let dur = rng.range(3.5, 15);

        // Custom PeriodicWave voices — each has hand-crafted harmonic content
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
            // Narrow pulse wave (~10% duty cycle) — nasal, buzzy, synth-like
            const real = new Float32Array(16);
            const imag = new Float32Array(16);
            for (let h = 1; h < 16; h++) {
                real[h] = Math.sin(0.1 * Math.PI * h) / (Math.PI * h * 0.1);
            }
            osc.setPeriodicWave(ctx.createPeriodicWave(real, imag));
            atk = rng.range(0.2, 1.5); dur = rng.range(2, 10);
        } else if (ADDITIVE_VOICE_NAMES.includes(wType)) {
            // ── Additive synthesis voice (self-contained, returns early)
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
            this.nodes.push(panner);
            buildVoice(wType, ctx, freq, panner, rng, atk, dur, this.nodes);
            return; // voices.js handles full envelope - no further processing needed
        } else {
            osc.type = wType;
        }


        osc.frequency.value = freq;
        const now = ctx.currentTime;
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
        this.nodes.push(osc, env, panner);
        // Auto-cleanup when note ends to prevent node accumulation
        osc.onended = () => { try { osc.disconnect(); env.disconnect(); panner.disconnect(); } catch (e) { } };

        // ── Pitch bend vibrato (gated by flag)
        const bendCents = (this._pitchBendEnabled && ac && ac.pitchBend) ? ac.pitchBend : 0;
        if (bendCents > 0) {
            const bendHz = freq * (Math.pow(2, bendCents / 1200) - 1);
            this._lfoOnce(ctx, rng.range(3, 9), bendHz * rng.range(0.3, 1), osc.frequency, now, atk + dur);
        }

        // ── Chord layer (gated by flag)
        const chordProb = (this._chordEnabled && ac && ac.chordProb) ? ac.chordProb : 0;
        if (chordProb > 0 && rng.next() < chordProb && planet.scale.length >= 3) {
            const intervals = [3, 4, 5, 7, 8, 9]; // thirds, fourth, fifths, sixths
            const numNotes = rng.bool(0.4) ? 2 : 1;
            for (let i = 0; i < numNotes; i++) {
                const iv = rng.pick(intervals);
                const chordFreq = freq * Math.pow(2, iv / 12);
                const co = ctx.createOscillator(), ce = ctx.createGain();
                const wType2 = ac ? rng.pick(ac.melodyWaves) : 'sine';
                // Re-use same waveform type as the main note (simplified)
                if (['bell', 'glass', 'wood', 'organ', 'pluck', 'brass', 'pulse'].includes(wType2) || ADDITIVE_VOICE_NAMES.includes(wType2)) {
                    // For chord tones, use the plain oscillator type to keep CPU low
                    co.type = ['sawtooth', 'triangle', 'sine', 'square'][rng.int(0, 4)];
                } else { co.type = wType2 || 'sine'; }
                co.frequency.value = chordFreq;
                ce.gain.setValueAtTime(0, now);
                ce.gain.linearRampToValueAtTime(0.08 + rng.range(0, 0.05), now + atk * 1.2);
                ce.gain.linearRampToValueAtTime(0, now + atk + dur * 0.8);
                const cp = ctx.createStereoPanner();
                cp.pan.value = rng.range(-0.5, 0.5);
                co.connect(ce); ce.connect(cp); cp.connect(dest);
                co.start(now); co.stop(now + atk + dur + 0.15);
                this.nodes.push(co, ce, cp);
            }
        }

        // ── Arp run (gated by flag)
        const arpProb = (this._arpEnabled && ac && ac.arpProb) ? ac.arpProb : 0;
        if (arpProb > 0 && rng.next() < arpProb && planet.scale.length >= 4) {
            const sc = planet.scale;
            const startIdx = rng.int(0, Math.max(1, sc.length - 4));
            const arpNotes = sc.slice(startIdx, startIdx + 4);
            const arpSpeed = rng.range(0.08, 0.22); // seconds between notes
            arpNotes.forEach((s, i) => {
                const arpFreq = planet.rootFreq * (oct || 3) * Math.pow(2, s / 12);
                const ao = ctx.createOscillator(), ae = ctx.createGain();
                ao.type = ac ? (ac.melodyWaves.find(w => !['bell', 'glass', 'wood', 'organ', 'pluck', 'brass', 'pulse'].includes(w) && !ADDITIVE_VOICE_NAMES.includes(w)) || 'sine') : 'sine';
                ao.frequency.value = arpFreq;
                const t0 = now + i * arpSpeed;
                ae.gain.setValueAtTime(0, t0);
                ae.gain.linearRampToValueAtTime(0.12, t0 + 0.02);
                ae.gain.exponentialRampToValueAtTime(0.001, t0 + 0.18);
                ao.connect(ae); ae.connect(dest);
                ao.start(t0); ao.stop(t0 + 0.22);
                this.nodes.push(ao, ae);
            });
        }
    }

    start(planet) {
        this._boot();
        this.stop();
        this.planet = planet;
        const ctx = this.ctx, p = planet, ac = p.ac;

        // Effect chain -> routes into EQ -> MasterGain
        const conv = this._buildReverb(p.reverbDecay, p.seed);
        const wet = ctx.createGain(); wet.gain.value = this._reverb;
        const dry = ctx.createGain(); dry.gain.value = 1 - this._reverb * 0.5;
        this.reverbGain = wet; this.dryGain = dry;
        conv.connect(wet); wet.connect(this.eqLow);
        dry.connect(this.eqLow);

        // Delay — feedback & time vary per biome.
        // IMPORTANT: clamp feedback gain to 0.75 to prevent runaway infinite echo.
        const del = ctx.createDelay(5);
        const safeFb = Math.min(ac.delayFb, 0.75); // hard ceiling prevents feedback explosion
        const fb = ctx.createGain(); fb.gain.value = safeFb;
        const dlf = ctx.createBiquadFilter(); dlf.type = 'lowpass'; dlf.frequency.value = ac.filterBase * 0.8;
        del.delayTime.value = 0.25 + (p.seed % 120) / 300;
        del.connect(fb); fb.connect(dlf); dlf.connect(del); // feedback loop (safe)
        // Delay sends to reverb at reduced gain (-10dB) to avoid compounding feedback
        const delSend = ctx.createGain(); delSend.gain.value = 0.32;
        del.connect(delSend); delSend.connect(conv);
        this.nodes.push(del, fb, dlf, delSend);

        // Master filter — controlled by biome base freq
        const filt = ctx.createBiquadFilter();
        filt.type = 'lowpass'; filt.frequency.value = p.filterFreq; filt.Q.value = 1.2;
        this.nodes.push(filt);

        // ── NEW EFFECTS CHAIN (Tier 2) ──────────────────────────
        let effectNode = filt;

        // Bitcrusher for Corrupted/Storm biomes
        if (['corrupted', 'storm'].includes(p.biome.id)) {
            const bc = this._buildBitcrusher(4, 0.5); // bit depth, norm frequency
            effectNode.connect(bc);
            effectNode = bc;
            this.nodes.push(bc);
        }

        // Phaser for Psychedelic/Nebula biomes
        if (['psychedelic', 'nebula'].includes(p.biome.id)) {
            const ph = this._buildPhaser();
            effectNode.connect(ph.input);
            effectNode = ph.output;
            this.nodes.push(...ph.nodes);
        }

        // Final chain to destinations
        effectNode.connect(conv);
        effectNode.connect(del);
        effectNode.connect(dry);

        this._lfo(p.lfoRate * 0.12, p.filterFreq * 0.20, filt.frequency);

        // ── Harmony & Phrasing Initialization ──
        this._progression = p.progression;
        this._chordIndex = 0;
        this._updateChord();
        this._phraseLength = 0;
        this._restProb = 0.05;

        // Drone — Tier 4: Custom Wavetable base + dynamic FM
        const base = p.rootFreq;

        // Custom Seeded PeriodicWave for drone fundamental
        const wRng = new RNG(p.seed);
        const real = new Float32Array(16), imag = new Float32Array(16);
        real[0] = 0; imag[0] = 0;
        for (let i = 1; i < 16; i++) {
            real[i] = wRng.range(0, 1) / i; imag[i] = wRng.range(0, 1) / i;
        }
        const wave = ctx.createPeriodicWave(real, imag);
        const baseOsc = ctx.createOscillator(); baseOsc.setPeriodicWave(wave);
        const baseGain = ctx.createGain(); baseGain.gain.value = 0.4;
        baseOsc.frequency.value = base * 0.5; // sub octave
        baseOsc.connect(baseGain); baseGain.connect(filt);
        baseOsc.start();
        this.nodes.push(baseOsc, baseGain);
        this._lfo(p.lfoRate * 0.2, base * 0.01, baseOsc.frequency);

        const d1 = this._osc(ac.droneWave, base, 0.045, filt);
        const d2 = this._osc(ac.droneWave, base * 2 + p.droneDetune, 0.025, filt);

        // Simple FM synthesis for drone
        const fmMod = ctx.createOscillator(), fmModG = ctx.createGain();
        fmMod.type = 'sine'; fmMod.frequency.value = base * ac.fmRatio;
        this.fmIndexBase = ac.fmIndex * (0.7 + p.lfoRate); // stored for tension morphing
        fmModG.gain.value = this.fmIndexBase;
        this.fmModGainNode = fmModG; // store for tension morphing
        const fmCarrier = ctx.createOscillator(), fmCarrierG = ctx.createGain();
        fmCarrier.type = ac.droneWave; fmCarrier.frequency.value = base;
        fmCarrierG.gain.value = 0.04;
        fmMod.connect(fmModG); fmModG.connect(fmCarrier.frequency);
        fmCarrier.connect(fmCarrierG); fmCarrierG.connect(filt);
        fmMod.start(); fmCarrier.start();
        this.nodes.push(fmMod, fmModG, fmCarrier, fmCarrierG);

        this._lfo(p.lfoRate * 0.3, base * 0.014, d1.osc.frequency);
        this._lfo(p.lfoRate * 0.55, base * 0.025, d2.osc.frequency, 'triangle');

        // Pad — intro phase: pads fade in from silence over ~15s (was 45s)
        const padBus = ctx.createGain();
        padBus.gain.setValueAtTime(0, ctx.currentTime);
        padBus.gain.linearRampToValueAtTime(1, ctx.currentTime + 15);
        padBus.connect(filt);
        this.nodes.push(padBus);
        p.scale.slice(0, 5).forEach((step, i) => {
            const freq = base * ac.octScale * Math.pow(2, step / 12);
            const det = (i % 2 === 0 ? 1 : -1) * p.padDetune * 0.012 * freq;
            const pad = this._osc(ac.padWave, freq + det, 0.018, padBus);
            this._lfo(p.lfoRate * (0.09 + i * 0.07), freq * 0.005, pad.osc.frequency);
        });
        this.padBus = padBus;

        // Noise texture — biome controls how noisy
        if (p.noiseLevel > 0.01) {
            const blen = ctx.sampleRate * 3;
            const buf = ctx.createBuffer(1, blen, ctx.sampleRate);
            const nd = buf.getChannelData(0);
            for (let i = 0; i < blen; i++) nd[i] = Math.random() * 2 - 1;
            const ns = ctx.createBufferSource(); ns.buffer = buf; ns.loop = true;
            const nf = ctx.createBiquadFilter();
            // volcanic: low rumble; crystaline: high shimmer; desert: mid wind
            nf.type = p.biome.id === 'volcanic' ? 'lowpass' : (p.biome.id === 'crystalline' ? 'highpass' : 'bandpass');
            nf.frequency.value = 200 + p.seed % 1200; nf.Q.value = 4;
            const ng = ctx.createGain(); ng.gain.value = p.noiseLevel * 0.18;
            ns.connect(nf); nf.connect(ng); ng.connect(filt);
            ns.start();
            this.nodes.push(ns, nf, ng);
        }

        // Stochastic melody — notes from biome octave range
        // melodyBus fades in over ~20s
        const melodyBus = ctx.createGain();
        melodyBus.gain.setValueAtTime(0, ctx.currentTime);
        melodyBus.gain.linearRampToValueAtTime(1, ctx.currentTime + 20);
        melodyBus.connect(filt);
        this.nodes.push(melodyBus);
        this.melodyBus = melodyBus;
        this.intervals.push(setInterval(() => {
            if (!this.playing) return;
            const rng = new RNG(p.seed + 10000 + this.stepFX++);
            const tensionBoost = 1 + (this.tension || 0) * 3;

            // Phrase/Rest Logic: 
            // If we've been playing a long phrase, increase rest chance.
            // If we are resting, decay rest chance back to baseline.
            const densityBias = 1.0 + (this._density * 2.5);
            const baseProb = (p.melodyDensity * 4.0 * densityBias * tensionBoost);
            const currentProb = Math.max(0, baseProb - (this._restProb || 0));

            if (rng.range(0, 1) < currentProb) {
                this._scheduleNote(p, melodyBus, ac);
                this._phraseLength++;
                this._restProb += 0.08; // Each note adds to "fatigue"
            } else {
                this._phraseLength = 0;
                this._restProb = Math.max(0, this._restProb - 0.15); // Resting reduces fatigue
            }
        }, 500));

        // Biome-specific periodic effects
        if (p.biome.id === 'corrupted') {
            this.intervals.push(setInterval(() => {
                const rng = new RNG(p.seed + 20000 + this.stepFX++);
                if (rng.range(0, 1) < 0.2) {
                    const orig = filt.frequency.value;
                    const nyquist = ctx.sampleRate / 2;
                    filt.frequency.setValueAtTime(Math.min(orig * (0.2 + rng.range(0, 3)), nyquist), ctx.currentTime);
                    filt.frequency.setValueAtTime(Math.min(orig, nyquist), ctx.currentTime + 0.04 + rng.range(0, 0.12));
                }
            }, 700));
        }
        if (p.biome.id === 'organic') {
            // Pulsing life-like tremolo
            this._lfo(p.lfoRate * 2.5, 0.25, wet.gain);
        }
        if (p.biome.id === 'barren') {
            // Very occasional lone ping
            this.intervals.push(setInterval(() => {
                const rng = new RNG(p.seed + 30000 + this.stepFX++);
                if (rng.range(0, 1) < 0.08) this._scheduleNote(p, filt, ac);
            }, 4000));
        }
        if (p.biome.id === 'storm') {
            // Random chaotic filter bursts — electrical chaos
            this.intervals.push(setInterval(() => {
                const rng = new RNG(p.seed + 60000 + this.stepFX++);
                if (rng.range(0, 1) < 0.35) {
                    const orig = filt.frequency.value;
                    const nyquist = ctx.sampleRate / 2;
                    const spike = Math.min(orig * rng.range(0.1, 8), nyquist);
                    filt.frequency.setValueAtTime(spike, ctx.currentTime);
                    filt.frequency.exponentialRampToValueAtTime(Math.min(orig, nyquist), ctx.currentTime + rng.range(0.02, 0.18));
                }
            }, 300));
        }
        if (p.biome.id === 'nebula') {
            // Push extra wet reverb for the immense nebular space
            wet.gain.linearRampToValueAtTime(Math.min(this._reverb * 1.4, 1), ctx.currentTime + 8);
            // Slowly evolve formant movement via LFO on filter
            this._lfo(0.018, p.filterFreq * 0.3, filt.frequency, 'sine');
        }

        // FM layer moved to Tier 4 custom wavetable block above.

        // ── TIER 2: PERCUSSION SEQUENCER ──────────────────────────
        this._startPercussion(p, filt);

        // ── Tier 2: Bass Line Generator ───────────────────────────
        this._startBass(p, filt);

        // ── Tier 1: Granular cloud ─────────────────────────────────
        this._startGranular(p, filt);

        // ── Tier 1: Chorus / stereo widening ──────────────────────
        this._addChorus(filt, this.masterGain, ac);

        // ── Tier 2: Harmonic tension arc ──────────────────────────
        this.tension = 0;
        this.tensionFilt = filt;
        this.tensionBase = { filtFreq: p.filterFreq, lfoRate: p.lfoRate };
        this._startTensionArc(p, filt);
        // ── Tier 2: Harmonic progression sequencer ────────────────
        this.intervals.push(setInterval(() => {
            if (!this.playing) return;
            // Advance chord every 32 beats (approx 10-15s at typical BPMs)
            this._chordIndex = (this._chordIndex + 1) % this._progression.length;
            this._updateChord();
        }, 12000)); // Fixed 12s per chord for now, could be BPM-synced later

        this.playing = true;
    }

    _updateChord() {
        this._chordName = this._progression[this._chordIndex];
        this._currentChordIntervals = CHORD_TEMPLATES[this._chordName] || [0, 4, 7];
        // Log progression for debugging (optional)
        // console.log(`PROG: ${this._progression.join('-')} | CURRENT: ${this._chordName}`);
    }

    // ── GRANULAR SYNTHESIS ─────────────────────────────────────────────
    _startGranular(p, dest) {
        if (!this._granularEnabled) return; // user toggle
        const ctx = this.ctx, ac = p.ac, sr = ctx.sampleRate;
        if (!ac.grainDensity || ac.grainDensity < 0.05) return;

        // A single bus gain for the whole cloud — toggle ramps this
        const granularBus = ctx.createGain();
        granularBus.gain.setValueAtTime(0, ctx.currentTime);
        granularBus.gain.linearRampToValueAtTime(1, ctx.currentTime + 1.5); // fade in to stop clicks
        granularBus.connect(dest);
        this.nodes.push(granularBus);
        this._granularBus = granularBus;

        const bufLen = sr * 2;
        const buf = ctx.createBuffer(2, bufLen, sr);
        const base = p.rootFreq;
        for (let ch = 0; ch < 2; ch++) {
            const d = buf.getChannelData(ch);
            const rng = new RNG(p.seed + ch * 999);
            for (let i = 0; i < bufLen; i++) {
                const t = i / sr;
                let s = Math.sin(2 * Math.PI * base * t) * 0.38
                    + Math.sin(2 * Math.PI * base * 2 * t) * 0.16
                    + Math.sin(2 * Math.PI * base * 3 * t) * 0.07;
                s += (Math.random() * 2 - 1) * ac.noiseMul * 0.12;
                d[i] = s * (ch === 0 ? 1 : (0.88 + rng.range(0, 0.24)));
            }
        }

        const intervalMs = 1000 / ac.grainDensity;
        const peak = 0.015 * Math.sqrt(ac.grainDensity);

        const scheduleGrain = (rng) => {
            const nominalDur = ac.grainSize * 0.001 * (0.8 + rng.range(0, 0.5));

            // CLICK-FREE envelope
            const atkDur = Math.max(0.012, nominalDur * 0.30);
            const relDur = Math.max(0.018, nominalDur * 0.55);
            const holdDur = Math.max(0, nominalDur - atkDur - relDur);
            const totalEnv = atkDur + holdDur + relDur;

            const maxStart = Math.max(0, (bufLen / sr) - totalEnv - 0.05);
            const startPos = rng.range(0, maxStart);
            const centsOff = rng.range(-1, 1) * ac.grainPitchScatter;
            const playRate = Math.pow(2, centsOff / 1200);
            const pan = rng.range(-0.9, 0.9);

            const gs = ctx.createBufferSource();
            const env = ctx.createGain();
            const pn = ctx.createStereoPanner();
            gs.buffer = buf;
            gs.playbackRate.value = playRate;
            pn.pan.value = pan;

            // Hann-like curve
            const now = ctx.currentTime;
            env.gain.setValueAtTime(0, now);
            env.gain.linearRampToValueAtTime(peak * 0.5, now + atkDur * 0.5);
            env.gain.linearRampToValueAtTime(peak, now + atkDur);
            if (holdDur > 0.004) env.gain.setValueAtTime(peak, now + atkDur + holdDur);
            env.gain.linearRampToValueAtTime(peak * 0.5, now + atkDur + holdDur + relDur * 0.5);
            env.gain.linearRampToValueAtTime(0, now + totalEnv);

            gs.connect(env); env.connect(pn); pn.connect(granularBus);
            gs.start(now, startPos, totalEnv + 0.06);
        };
        // Wait a moment before firing grains to let the bus fade in and avoid load clicks
        setTimeout(() => {
            if (!this.playing) return;
            this.intervals.push(setInterval(() => {
                const grng = new RNG(p.seed + 40000 + this.stepGrain++);
                scheduleGrain(grng);
                if (ac.grainDensity > 4 && grng.range(0, 1) < 0.4) {
                    setTimeout(() => scheduleGrain(grng), intervalMs * 0.35);
                }
            }, intervalMs));
        }, 500);
    }

    // ── CHORUS / STEREO WIDENING ───────────────────────────────────────
    // 3 voices, each: short delay + LFO wobble + stereo pan → into wet bus
    _addChorus(source, dest, ac) {
        const ctx = this.ctx;
        if (!ac.chorusWet || ac.chorusWet < 0.02) return;

        const wetG = ctx.createGain();
        wetG.gain.value = ac.chorusWet;
        wetG.connect(dest);
        this.nodes.push(wetG);

        // 3 voices at musical delay primes (7, 13, 19ms)
        [7, 13, 19].forEach((ms, i) => {
            const del = ctx.createDelay(0.08);
            del.delayTime.value = ms * 0.001;
            // LFO slowly wobbles each voice's delay time
            const lfo = ctx.createOscillator();
            const lfoG = ctx.createGain();
            lfo.frequency.value = 0.28 + i * 0.13;
            lfoG.gain.value = ac.chorusDepth * 0.0001; // ms → seconds
            lfo.connect(lfoG); lfoG.connect(del.delayTime);
            lfo.start();
            // Pan: L, R, slightly R (spread)
            const pan = ctx.createStereoPanner();
            pan.pan.value = [-0.7, 0.7, 0.3][i];
            source.connect(del); del.connect(pan); pan.connect(wetG);
            this.nodes.push(del, lfo, lfoG, pan);
        });
    }

    // ── SIDECHAIN DUCK ─────────────────────────────────────────────────
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

    // ── TIER 2: PERCUSSION SEQUENCER ──────────────────────────────────
    // Euclidean rhythm helper: distributes k hits evenly over n steps
    _euclidean(k, n) {
        if (k >= n) return new Array(n).fill(1);
        if (k <= 0) return new Array(n).fill(0);
        let pattern = [], counts = [], remainders = [];
        let divisor = n - k;
        remainders.push(k);
        let level = 0;
        while (true) {
            counts.push(Math.floor(divisor / remainders[level]));
            remainders.push(divisor % remainders[level]);
            divisor = remainders[level];
            level++;
            if (remainders[level] <= 1) break;
        }
        counts.push(divisor);
        const build = (level) => {
            if (level === -1) { pattern.push(0); return; }
            if (level === -2) { pattern.push(1); return; }
            for (let i = 0; i < counts[level]; i++) build(level - 1);
            if (remainders[level] !== 0) build(level - 2);
        };
        build(level);
        return pattern;
    }

    _startPercussion(p, dest) {
        const ctx = this.ctx, base = p.rootFreq, bid = p.biome.id;
        const bpm = p.bpm || 90;
        const stepTime = 15 / bpm; // 16th note in seconds
        const rng = new RNG(p.seed);

        // Live-toggle bus: fade in/out without stopping
        const percBus = ctx.createGain();
        percBus.gain.setValueAtTime(0, ctx.currentTime);
        percBus.gain.linearRampToValueAtTime(
            this._percussionEnabled ? this._percVol : 0,
            ctx.currentTime + 0.5
        );
        percBus.connect(dest);
        this.nodes.push(percBus);
        this._percBus = percBus;

        // Kit variations per planet — tuned via seed
        const kit = {
            kPitch: rng.range(0.85, 1.2), kDecay: rng.range(0.7, 1.3),
            sPitch: rng.range(0.8, 1.3), sDecay: rng.range(0.6, 1.5),
            hPitch: rng.range(0.7, 1.4), hDecay: rng.range(0.5, 1.8)
        };

        // All drum voices route through percBus
        const dest2 = percBus;

        // Synthesize Drum Voices
        const playKick = (vel) => {
            const t = ctx.currentTime;
            const osc = ctx.createOscillator(), env = ctx.createGain();
            // Softer pitch envelope for less click
            osc.frequency.setValueAtTime(120 * kit.kPitch, t);
            osc.frequency.exponentialRampToValueAtTime(45 * kit.kPitch, t + 0.08 * kit.kDecay);
            env.gain.setValueAtTime(0, t);
            env.gain.linearRampToValueAtTime(vel, t + 0.015); // slower attack
            env.gain.exponentialRampToValueAtTime(0.001, t + 0.4 * kit.kDecay);
            osc.connect(env); env.connect(dest2);
            osc.start(t); osc.stop(t + 0.5 * kit.kDecay);
            this.nodes.push(osc, env);
            if (p.ac.sidechainAmt > 0) this._duck(p.ac.sidechainAmt, 0.4);
        };

        const playSnare = (vel) => {
            const t = ctx.currentTime;
            const noise = ctx.createBufferSource();
            noise.buffer = this._noiseBuffer; // Use cached noise buffer
            const nFilt = ctx.createBiquadFilter();
            nFilt.type = 'highpass'; nFilt.frequency.value = 1000 * kit.sPitch;
            const nEnv = ctx.createGain();

            const osc = ctx.createOscillator(), tEnv = ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(250 * kit.sPitch, t);
            osc.frequency.exponentialRampToValueAtTime(120 * kit.sPitch, t + 0.1);

            nEnv.gain.setValueAtTime(0, t);
            nEnv.gain.linearRampToValueAtTime(vel * 0.8, t + 0.01);
            nEnv.gain.exponentialRampToValueAtTime(0.001, t + 0.25 * kit.sDecay);

            tEnv.gain.setValueAtTime(0, t);
            tEnv.gain.linearRampToValueAtTime(vel * 0.6, t + 0.01);
            tEnv.gain.exponentialRampToValueAtTime(0.001, t + 0.15 * kit.sDecay);

            noise.connect(nFilt); nFilt.connect(nEnv); nEnv.connect(dest2);
            osc.connect(tEnv); tEnv.connect(dest2);
            noise.start(t); osc.start(t);
            this.nodes.push(noise, nFilt, nEnv, osc, tEnv);
        };

        const playHat = (vel, open) => {
            const t = ctx.currentTime;
            // Hat is high-passed squarish FM or just noise (using square for metallic sound)
            const osc1 = ctx.createOscillator(), osc2 = ctx.createOscillator();
            const filt = ctx.createBiquadFilter(), env = ctx.createGain();
            osc1.type = 'square'; osc1.frequency.value = 400;
            osc2.type = 'square'; osc2.frequency.value = 600;
            filt.type = 'highpass'; filt.frequency.value = 7000;

            const dur = (open ? 0.35 : 0.08) * kit.hDecay;
            env.gain.setValueAtTime(0, t);
            env.gain.linearRampToValueAtTime(vel * 0.4, t + 0.01);
            env.gain.exponentialRampToValueAtTime(0.001, t + dur);

            osc1.connect(filt); osc2.connect(filt); filt.connect(env); env.connect(dest2);
            osc1.start(t); osc2.start(t);
            osc1.stop(t + dur + 0.05); osc2.stop(t + dur + 0.05);
            this.nodes.push(osc1, osc2, filt, env);
        };

        const playSub = (vel, pitchOff) => {
            const t = ctx.currentTime;
            const osc = ctx.createOscillator(), env = ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.value = base * Math.pow(2, pitchOff / 12);
            env.gain.setValueAtTime(0, t);
            env.gain.linearRampToValueAtTime(vel * 0.8, t + 0.05);
            env.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
            osc.connect(env); env.connect(dest2);
            osc.start(t); osc.stop(t + 0.7);
            this.nodes.push(osc, env);
        };

        // ── Extra Percussion Voices ───────────────────────────────────────
        const playClave = (vel) => {
            const t = ctx.currentTime;
            const osc = ctx.createOscillator(), env = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.value = 2500 * kit.hPitch; // Wood block pitch range
            osc.frequency.exponentialRampToValueAtTime(1800 * kit.hPitch, t + 0.02);
            env.gain.setValueAtTime(vel * 0.5, t);
            env.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
            osc.connect(env); env.connect(dest2);
            osc.start(t); osc.stop(t + 0.08);
            this.nodes.push(osc, env);
        };
        const playCowbell = (vel) => {
            const t = ctx.currentTime;
            const o1 = ctx.createOscillator(), o2 = ctx.createOscillator(), env = ctx.createGain();
            o1.type = 'square'; o1.frequency.value = 800 * kit.hPitch;
            o2.type = 'square'; o2.frequency.value = 540 * kit.hPitch;
            env.gain.setValueAtTime(vel * 0.18, t);
            env.gain.exponentialRampToValueAtTime(0.001, t + 0.9 * kit.hDecay);
            o1.connect(env); o2.connect(env); env.connect(dest2);
            o1.start(t); o2.start(t);
            o1.stop(t + 1.0); o2.stop(t + 1.0);
            this.nodes.push(o1, o2, env);
        };
        const playTom = (vel) => {
            const t = ctx.currentTime;
            const osc = ctx.createOscillator(), env = ctx.createGain();
            const pitch = 120 * kit.kPitch * 0.55; // Lower than kick
            osc.frequency.setValueAtTime(pitch * 1.8, t);
            osc.frequency.exponentialRampToValueAtTime(pitch, t + 0.06);
            env.gain.setValueAtTime(vel * 0.5, t);
            env.gain.exponentialRampToValueAtTime(0.001, t + 0.35 * kit.kDecay);
            osc.connect(env); env.connect(dest2);
            osc.start(t); osc.stop(t + 0.45);
            this.nodes.push(osc, env);
        };
        const playShaker = (vel) => {
            const t = ctx.currentTime;
            const src = ctx.createBufferSource();
            const buf = ctx.createBuffer(1, ctx.sampleRate * 0.12, ctx.sampleRate);
            const d = buf.getChannelData(0);
            for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
            src.buffer = buf;
            const filt = ctx.createBiquadFilter();
            filt.type = 'bandpass'; filt.frequency.value = 6000 + rng.range(0, 3000); filt.Q.value = 3;
            const env = ctx.createGain();
            env.gain.setValueAtTime(vel * 0.3, t);
            env.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
            src.connect(filt); filt.connect(env); env.connect(dest2);
            src.start(t); src.stop(t + 0.15);
            this.nodes.push(src, filt, env);
        };
        const playConga = (vel) => {
            const t = ctx.currentTime;
            const osc = ctx.createOscillator(), env = ctx.createGain();
            osc.type = 'triangle';
            const pitch = 280 * kit.sPitch; // Mid-pitched skin sound
            osc.frequency.setValueAtTime(pitch * 1.5, t);
            osc.frequency.exponentialRampToValueAtTime(pitch * 0.85, t + 0.04);
            env.gain.setValueAtTime(vel * 0.45, t);
            env.gain.exponentialRampToValueAtTime(0.001, t + 0.22 * kit.sDecay);
            osc.connect(env); env.connect(dest2);
            osc.start(t); osc.stop(t + 0.3);
            this.nodes.push(osc, env);
        };
        const playRimshot = (vel) => {
            const t = ctx.currentTime;
            const osc = ctx.createOscillator(), env = ctx.createGain();
            osc.type = 'square';
            osc.frequency.setValueAtTime(800 * kit.sPitch, t);
            osc.frequency.exponentialRampToValueAtTime(400, t + 0.02);
            env.gain.setValueAtTime(vel * 0.35, t);
            env.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
            osc.connect(env); env.connect(dest2);
            osc.start(t); osc.stop(t + 0.1);
            this.nodes.push(osc, env);
        };
        const playBongo = (vel) => {
            const t = ctx.currentTime;
            const osc = ctx.createOscillator(), env = ctx.createGain();
            osc.type = 'sine';
            const pitch = 350 * kit.sPitch;
            osc.frequency.setValueAtTime(pitch * 1.2, t);
            osc.frequency.exponentialRampToValueAtTime(pitch, t + 0.05);
            env.gain.setValueAtTime(vel * 0.4, t);
            env.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
            osc.connect(env); env.connect(dest2);
            osc.start(t); osc.stop(t + 0.2);
            this.nodes.push(osc, env);
        };

        // Map voice name → function for biome-driven percVoices dispatch
        const extraVoices = { clave: playClave, cowbell: playCowbell, tom: playTom, shaker: playShaker, conga: playConga, rimshot: playRimshot, bongo: playBongo };


        // ── Biome Sequence Patterns (16 steps) ──
        // 1=hit, 2=accent/openhat, 0=rest. Multiple arrays = planet seed chooses variation.
        const P = {
            volcanic: {
                k: [[1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0], [1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 1, 0, 0]],
                s: [[0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0], [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1, 0]],
                h: [[1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0], [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]],
                b: [[1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0], [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0]]
            },
            psychedelic: {
                k: [[1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 1, 0], [1, 0, 0, 0, 1, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0]],
                s: [[0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1], [0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0]],
                h: [[1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 1, 0], [1, 0, 2, 0, 1, 0, 2, 0, 1, 0, 2, 0, 1, 0, 2, 0]],
                b: [[1, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0], [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0]]
            },
            corrupted: {
                // High-energy breakbeat / glitch / DnB feel
                k: [[1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 1, 0, 0, 0, 0], [1, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0]],
                s: [[0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1], [0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 0]],
                h: [[1, 0, 1, 1, 1, 0, 1, 0, 1, 1, 1, 0, 1, 0, 1, 1], [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1, 1]], // fast 16ths
                b: [[1, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0], [1, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0]]
            },
            oceanic: {
                k: [[1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0]],
                s: [[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0]], // sparse
                h: [[1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0], [0, 0, 2, 0, 0, 0, 2, 0, 0, 0, 2, 0, 0, 0, 2, 0]],
                b: [[1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0], [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0]]
            },
            organic: {
                // Latin/syncopated feel
                k: [[1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0], [1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0]],
                s: [[0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0], [0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0]], // claves-ish
                h: [[1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0], [1, 1, 2, 0, 1, 1, 2, 0, 1, 1, 2, 0, 1, 1, 2, 0]],
                b: [[1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0], [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]]
            },
            desert: {
                k: [[1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0], [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0]],
                s: [[0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0]],
                h: [[1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0], [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0]],
                b: [[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]]
            },
            crystalline: {
                k: [[1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0]],
                s: [[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]],
                h: [[2, 0, 0, 0, 2, 0, 0, 0, 2, 0, 0, 0, 2, 0, 0, 0], [2, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0]], // just bells/open hats
                b: [[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]]
            }
        };
        // Fallback for barren/ethereal which are ambient
        const ambient = { k: [[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]], s: [[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]], h: [[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]], b: [[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]] };

        // Euclidean patterns auto-generated for new exotic biomes
        const eu = (k, n) => this._euclidean(k, n);
        P.quantum = {
            k: [eu(5, 16), eu(7, 16)],
            s: [eu(3, 16), eu(5, 16)],
            h: [eu(11, 16), eu(13, 16)],
            b: [eu(3, 16), eu(5, 16)]
        };
        P.fungal = {
            k: [eu(4, 16), eu(6, 16)],
            s: [eu(5, 16), eu(7, 16)],
            h: [eu(9, 16), eu(13, 16)],
            b: [eu(4, 16), eu(6, 16)]
        };
        P.abyssal = {
            k: [eu(2, 16), eu(3, 16)],
            s: [eu(1, 16), eu(2, 16)],
            h: [eu(4, 16), eu(6, 16)],
            b: [eu(2, 16), eu(4, 16)]
        };
        P.glacial = ambient; // Pure silence
        // ── New Biome Patterns ──
        P.nebula = ambient; // Choral / ambient — no percussion
        P.arctic = {
            // Just rare single clicks — vast silence between them
            k: [[1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0]],
            s: [[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]],
            h: [[2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0]],
            b: [[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]]
        };
        P.storm = {
            // Violent, irregular — dense and chaotic
            k: [eu(7, 16), eu(9, 16)],
            s: [eu(5, 16), eu(7, 16)],
            h: [[1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1], eu(13, 16)], // near-continuous
            b: [eu(5, 16), eu(7, 16)]
        };
        P.crystalloid = {
            // Precise euclidean — geometric and alien
            k: [eu(5, 16), eu(3, 16)],
            s: [eu(7, 16), eu(5, 16)],
            h: [eu(11, 16), eu(9, 16)],
            b: [eu(4, 16), eu(6, 16)]
        };

        const bPats = P[bid] || ambient;

        // Pick specific array variations for this planet
        const patK = rng.pick(bPats.k), patS = rng.pick(bPats.s);
        const patH = rng.pick(bPats.h), patB = rng.pick(bPats.b);
        const subPitch = rng.pick([0, -5, -7]);

        // Generate extra-voice Euclidean patterns from percVoices list
        const extraPats = {};
        const pVoices = p.ac.percVoices || [];
        pVoices.forEach((v, i) => {
            const k = [3, 4, 5, 6, 7][i % 5];
            extraPats[v] = this._euclidean(k, 16);
        });

        // Swing offset (delays even 16th-steps by swing*stepTime)
        const swingAmt = (p.ac.swing || 0) * stepTime;

        let step = 0;
        let barCount = 0; // counts completed 16-step bars for fill detection
        this.intervals.push(setInterval(() => {
            if (!this.playing) return;
            const seqRng = new RNG(p.seed + 50000 + this.stepPerc++);
            const chaos = this.tension > 0.7 ? seqRng.range(0, 1) < 0.2 : false;
            // Apply swing: delay even steps
            const swDelay = (step % 2 === 1) ? swingAmt : 0;

            // Velocity variance
            const velScale = 1 - (p.ac.velocityVar || 0) * seqRng.range(0, 1);

            // ── Ghost notes: very quiet hat & snare on empty adjacent steps ──
            // Fires only when the pattern has no hit on this step (off-beats)
            const doGhost = this._ghostEnabled && !chaos
                && patK[step] === 0 && patS[step] === 0
                && seqRng.range(0, 1) < 0.22 * (1 + (this.tension || 0) * 0.5);

            // ── Fill detection: last 4 steps of a 16-step bar when fills on ──
            const isFillZone = this._fillsEnabled && (step >= 12) && (barCount % 4 === 3)
                && this.tension > 0.35;

            const playStep = (s) => {
                if (patK[s] === 1 && !chaos) playKick(0.25 * velScale);
                if (patS[s] === 1 && !chaos) playSnare(0.12 * velScale);
                if (patH[s] === 1) playHat(0.04 * velScale, false);
                if (patH[s] === 2) playHat(0.06 * velScale, true);
                if (patB[s] === 1 && !chaos) playSub(0.15 * velScale, subPitch);
                pVoices.forEach(v => { if (extraPats[v]?.[s] === 1 && extraVoices[v]) extraVoices[v](0.1 * velScale); });

                // Ghost note on empty step
                if (doGhost) {
                    if (seqRng.range(0, 1) < 0.55) playHat(0.018 * velScale, false);
                    else playSnare(0.028 * velScale);
                }

                // Fill: rapid extra hits on last 4 steps of every 4th bar
                if (isFillZone) {
                    const fillVel = 0.06 + seqRng.range(0, 0.06);
                    if (seqRng.range(0, 1) < 0.65) playHat(fillVel, false);
                    if (seqRng.range(0, 1) < 0.3 && s === 15) playSnare(0.09 * velScale);
                    // Half-step microtimed extra hit for roll effect
                    setTimeout(() => {
                        if (!this.playing) return;
                        if (seqRng.range(0, 1) < 0.45) playHat(fillVel * 0.7, false);
                    }, (stepTime * 0.5) * 1000);
                }
            };

            if (swDelay > 0) {
                setTimeout(() => playStep(step), swDelay * 1000);
            } else {
                playStep(step);
            }

            // Tension-driven extra hat accent (gated by ghost flag as it's decorative)
            if (this._ghostEnabled && this.tension > 0.6 && seqRng.range(0, 1) < 0.1)
                playHat(0.03, false);

            step = (step + 1) % 16;
            if (step === 0) barCount++;
        }, stepTime * 1000));

        // ── Polyrhythm Layer (Hemiola / 3-against-4) ──
        // Only on "complex" rhythmic biomes (fungal, crystalloid, quantum, psychedelic)
        const complexBiomes = ['fungal', 'crystalloid', 'quantum', 'psychedelic', 'corrupted'];
        if (complexBiomes.includes(p.biome.id) || rng.range(0, 1) < 0.25) {
            const polySound = extraVoices[rng.pick(['clave', 'cowbell', 'conga'])];
            const tripletTime = (stepTime * 4) / 3; // 3 beats over 4 sub-steps
            this.intervals.push(setInterval(() => {
                if (!this.playing || (this.tension || 0) < 0.3) return;
                // Only play occasionally to avoid cluttering
                if (new RNG(Date.now()).range(0, 1) < 0.6) {
                    polySound(0.08 * (0.8 + this.tension * 0.4));
                }
            }, tripletTime * 1000));
        }
    }

    // ── TIER 2: HARMONIC TENSION ARC ──────────────────────────────────
    // Tension rises from 0 →1 over ~60 seconds while listening.
    // It modulates filter, LFO, melody density, and dissonance.
    // At tension ≥0.85 a climax chord fires then tension resets to 0.45.
    _startTensionArc(p, filt) {
        const ctx = this.ctx;
        const base = this.tensionBase;
        this.tension = 0;
        this._climaxFired = false;

        this.intervals.push(setInterval(() => {
            if (!this.playing) return;
            this.tension = Math.min(1, this.tension + 0.035); // faster arc

            // ─ Filter & FM morphing as tension rises ────────────────────────
            const tSq = this.tension * this.tension;
            const newFiltFreq = Math.min(
                base.filtFreq * (1 + this.tension * 2.5),
                (this.ctx.sampleRate / 2) - 1
            );
            if (this.tensionFilt) {
                this.tensionFilt.frequency.linearRampToValueAtTime(
                    newFiltFreq, ctx.currentTime + 2
                );
            }
            if (this.fmModGainNode && this.fmIndexBase) {
                // Morph FM harshness dramatically with tension
                const newIndex = this.fmIndexBase * (1 + tSq * 5);
                this.fmModGainNode.gain.linearRampToValueAtTime(
                    newIndex, ctx.currentTime + 2
                );
            }

            // ─ Update tension bar UI ──────────────────────────────────────
            const bar = document.getElementById('tension-fill');
            const icon = document.getElementById('tension-icon');
            if (bar) bar.style.width = `${this.tension * 100}%`;
            if (icon) {
                const phase = this.tension < 0.4 ? 'low' : this.tension < 0.75 ? 'mid' : 'high';
                icon.className = `tension-icon tension-${phase}`;
            }

            // ─ Climax event at tension ≥ 0.85 ────────────────────────────
            if (this.tension >= 0.85 && !this._climaxFired) {
                this._climaxFired = true;
                this._fireClimax(p, filt);
                // After climax, drop tension back and allow next arc
                setTimeout(() => {
                    this.tension = 0.45;
                    this._climaxFired = false;
                }, 18000);
            }
        }, 2000)); // every 2s instead of 8s
    }

    // Fires a rich swelling chord at climax, then fades
    _fireClimax(p, dest) {
        const ctx = this.ctx, base = p.rootFreq;
        // Schedule 5 harmonic intervals as a chord
        [1, 5 / 4, 3 / 2, 2, 5 / 2].forEach((ratio, i) => {
            const o = ctx.createOscillator(), g = ctx.createGain();
            o.type = p.ac.padWave; o.frequency.value = base * ratio;
            const now = ctx.currentTime + i * 0.08;
            g.gain.setValueAtTime(0, now);
            g.gain.linearRampToValueAtTime(0.055, now + 2.5);
            g.gain.linearRampToValueAtTime(0.055, now + 10);
            g.gain.linearRampToValueAtTime(0, now + 16);
            o.connect(g); g.connect(dest);
            o.start(now); o.stop(now + 17);
            this.nodes.push(o, g);
        });
        // Brief master swell
        const mg = this.masterGain;
        const now = ctx.currentTime;
        mg.gain.linearRampToValueAtTime(this._vol * 1.35, now + 3);
        mg.gain.linearRampToValueAtTime(this._vol, now + 12);
    }

    // ── TIER 3: DOPPLER WHOOSH ────────────────────────────────────────
    // Synthesises a descending-frequency noise burst suggesting spatial travel.
    // Call on navigation — plays through the analyser so the scope reacts to it.
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
                const fInst = 3200 * Math.exp(-t * 3); // sweeps 3200 → ~60 Hz
                const tone = Math.sin(2 * Math.PI * fInst * t + phase) * 0.5;
                const noise = (Math.random() * 2 - 1) * 0.5;
                d[i] = (tone + noise) * env * 0.14;
            }
        }
        const src = ctx.createBufferSource();
        src.buffer = buf;
        const g = ctx.createGain(); g.gain.value = this._vol;
        src.connect(g); g.connect(this.analyser);
        src.start();
        src.onended = () => { try { src.disconnect(); g.disconnect(); } catch (e) { } };
    }

    stop() {
        this.intervals.forEach(clearInterval);
        this.intervals = [];
        this.tension = 0;
        const bar = document.getElementById('tension-fill');
        if (bar) bar.style.width = '0%';
        const t = this.ctx ? this.ctx.currentTime : 0;
        this.nodes.forEach(n => {
            try {
                if (n.stop) n.stop(t + 0.05);
                else n.disconnect(); // Gain/filter nodes can disconnect immediately
            } catch (e) { }
        });
        this.nodes = [];
        this.playing = false;
    }

    setVolume(v) { this._vol = v; if (this.masterGain) this.masterGain.gain.linearRampToValueAtTime(v, this.ctx.currentTime + 0.1); }
    setReverb(v) { this._reverb = v; if (this.reverbGain) { this.reverbGain.gain.linearRampToValueAtTime(v, this.ctx.currentTime + 0.2); this.dryGain.gain.linearRampToValueAtTime(1 - v * 0.5, this.ctx.currentTime + 0.2); } }
    getAnalyser() { return this.analyser; }

    // Smooth crossfade: fade current out, start new, fade in
    crossfadeTo(planet, cb) {
        if (!this.masterGain || !this.ctx) { this.start(planet); if (cb) cb(); return; }
        const ctx = this.ctx;
        const fadeOut = 1.1;
        this.masterGain.gain.linearRampToValueAtTime(0, ctx.currentTime + fadeOut);
        // Stop old nodes after fade, start new quietly, then ramp up
        setTimeout(() => {
            this.stop();
            this.start(planet);
            const now2 = this.ctx.currentTime;
            this.masterGain.gain.cancelScheduledValues(now2);
            this.masterGain.gain.setValueAtTime(0, now2);
            this.masterGain.gain.linearRampToValueAtTime(this._vol, now2 + 1.5);
            if (cb) cb();
        }, fadeOut * 1000);
    }

    // ── BASS LINE GENERATOR ───────────────────────────────────────────
    _startBass(p, dest) {
        const ctx = this.ctx, ac = p.ac;
        const bassBus = ctx.createGain();
        bassBus.gain.value = 0.55;
        bassBus.connect(dest);
        this.nodes.push(bassBus);

        // Bass pattern: 1=note, 0=rest. 8-step patterns (half-bar)
        const patterns = [
            [1, 0, 0, 0, 1, 0, 0, 0], // Steady 1/4s
            [1, 0, 0, 1, 0, 0, 1, 0], // Syncopated
            [0, 0, 1, 0, 0, 0, 1, 0], // Off-beat
            [1, 1, 1, 1, 1, 1, 1, 1], // Driving 1/8ths
            [1, 0, 1, 0, 1, 0, 1, 0], // Simple 1/8ths
        ];
        const rng = new RNG(p.seed + 777);
        const activePattern = rng.pick(patterns);
        const bassOctave = p.biome.id === 'abyssal' ? 0.5 : 1.0;

        this.intervals.push(setInterval(() => {
            if (!this.playing) return;
            const step = this.stepPerc % 8; // Sync with percussion step
            if (activePattern[step]) {
                this._scheduleBassNote(p, bassBus, bassOctave);
            }
        }, 250)); // 1/8th note tick at ~120BPM (approx)
    }

    _scheduleBassNote(p, dest, octScale) {
        const ctx = this.ctx;
        // Bass always stays on the ROOT of the current chord for stability
        const chordBase = this._currentChordIntervals[0];
        const freq = p.rootFreq * octScale * Math.pow(2, chordBase / 12);

        const osc = ctx.createOscillator();
        const sub = ctx.createOscillator();
        const env = ctx.createGain();

        // Sub-bass voice: Sine + Triangle for weight
        osc.type = 'triangle';
        sub.type = 'sine';
        osc.frequency.value = freq;
        sub.frequency.value = freq * 0.5;

        const now = ctx.currentTime;
        env.gain.setValueAtTime(0, now);
        env.gain.linearRampToValueAtTime(0.4, now + 0.02);
        env.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

        osc.connect(env); sub.connect(env);
        env.connect(dest);
        osc.start(now); sub.start(now);
        osc.stop(now + 0.5); sub.stop(now + 0.5);
        this.nodes.push(osc, sub, env);
    }

    // ── EFFECTS CONSTRUCTION ──────────────────────────────────────────
    _buildBitcrusher(bits, normFreq) {
        const ctx = this.ctx;
        const bufferSize = 4096;
        const node = ctx.createScriptProcessor(bufferSize, 1, 1);
        let ph = 0;
        let lastValue = 0;

        node.onaudioprocess = (e) => {
            const input = e.inputBuffer.getChannelData(0);
            const output = e.outputBuffer.getChannelData(0);
            const step = Math.pow(0.5, bits);
            for (let i = 0; i < bufferSize; i++) {
                ph += normFreq;
                if (ph >= 1) {
                    ph -= 1;
                    lastValue = step * Math.floor(input[i] / step + 0.5);
                }
                output[i] = lastValue;
            }
        };
        return node;
    }

    _buildPhaser() {
        const ctx = this.ctx;
        const input = ctx.createGain();
        const output = ctx.createGain();
        const stages = 4;
        const filters = [];

        // All-pass filters for phasing effect
        for (let i = 0; i < stages; i++) {
            const f = ctx.createBiquadFilter();
            f.type = 'allpass';
            f.frequency.value = 1000;
            filters.push(f);
        }

        for (let i = 0; i < stages - 1; i++) filters[i].connect(filters[i + 1]);
        input.connect(filters[0]);
        filters[stages - 1].connect(output);

        // Sweeping LFO
        const lfo = ctx.createOscillator();
        const lfoDepth = ctx.createGain();
        lfo.type = 'sine';
        lfo.frequency.value = 0.5;
        lfoDepth.gain.value = 800;
        lfo.connect(lfoDepth);

        filters.forEach(f => {
            lfoDepth.connect(f.frequency);
        });
        lfo.start();

        return { input, output, nodes: [...filters, lfo, lfoDepth, input, output] };
    }

    getChord() {
        return this._chordName || 'I';
    }
    getMelodyState() {
        return {
            mode: this._melodyMode,
            phraseLength: this._phraseLength,
            restProb: this._restProb
        };
    }
}
