import { RNG } from '../../rng.js';

export function startEnginePlayback(engine, planet) {
    engine._boot();
    engine.stop();
    engine.planet = planet;
    engine._strictRngs = Object.create(null);
    engine._voiceCooldowns = Object.create(null);
    engine._resetSteps();
    const ctx = engine.ctx, p = planet, ac = p.ac;
    const transport = engine._buildTransport(p);
    const timbreLimits = engine._getTimbreDeltaLimits(p);
    engine.transport = transport;
    engine._startTransportScheduler();

    // Effect chain -> routes into EQ -> MasterGain
    const conv = engine._buildReverb(p.reverbDecay, p.seed);
    const wet = ctx.createGain(); wet.gain.value = engine._reverb;
    const dry = ctx.createGain(); dry.gain.value = 1 - engine._reverb * 0.5;
    engine.reverbGain = wet; engine.dryGain = dry;
    conv.connect(wet); wet.connect(engine.eqLow);
    dry.connect(engine.eqLow);
    engine.nodes.push(conv, wet, dry);

    // Delay - feedback & time vary per biome.
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
    engine.nodes.push(del, fb, dlf, delSend);

    // Master filter - controlled by biome base freq
    const filt = ctx.createBiquadFilter();
    filt.type = 'lowpass'; filt.frequency.value = p.filterFreq; filt.Q.value = 1.2;
    engine.nodes.push(filt);

    // New effects chain (Tier 2)
    let effectNode = filt;

    // Bitcrusher for Corrupted/Storm biomes
    if (['corrupted', 'storm'].includes(p.biome.id)) {
        const bc = engine._buildBitcrusher(4, 0.5); // bit depth, norm frequency
        effectNode.connect(bc);
        effectNode = bc;
        engine.nodes.push(bc);
    }

    // Phaser for Psychedelic/Nebula biomes
    if (['psychedelic', 'nebula'].includes(p.biome.id)) {
        const ph = engine._buildPhaser();
        effectNode.connect(ph.input);
        effectNode = ph.output;
        engine.nodes.push(...ph.nodes);
    }

    // Final chain to destinations
    effectNode.connect(conv);
    effectNode.connect(del);
    effectNode.connect(dry);

    engine.tensionLfos = [];
    const fLfo = engine._lfo(p.lfoRate * 0.12, p.filterFreq * 0.20, filt.frequency);
    if (fLfo) engine.tensionLfos.push(fLfo);

    // Harmony and phrasing initialization
    engine._progression = p.progression;
    engine._chordIndex = 0;
    // _updateChord() will be called once at the end of start() to kick off the recursive loop
    engine._phraseLength = 0;
    engine._restProb = 0.05;
    engine.lastStep = undefined;
    engine._lastMelodyStep = null;
    engine._melodyHistory = [];
    engine._activeMotifIdx = 0;
    engine._motifSwapCounter = 0;

    // Drone - Tier 4: Custom Wavetable base + dynamic FM
    const base = p.rootFreq;
    engine.harmonicNodes = { pads: [] };

    // Custom seeded PeriodicWave for drone fundamental
    const wRng = new RNG(p.seed);
    const real = new Float32Array(16), imag = new Float32Array(16);
    real[0] = 0; imag[0] = 0;
    for (let i = 1; i < 16; i++) {
        real[i] = wRng.range(0, 1) / i; imag[i] = wRng.range(0, 1) / i;
    }
    const wave = ctx.createPeriodicWave(real, imag);
    const baseOsc = ctx.createOscillator(); baseOsc.setPeriodicWave(wave);
    const baseGain = ctx.createGain();
    baseGain.gain.value = 0.4 * (p.ac.chordAudibility !== undefined ? p.ac.chordAudibility : 0.5);
    baseOsc.frequency.value = base * 0.5; // sub octave
    baseOsc.connect(baseGain); baseGain.connect(filt);
    baseOsc.start();
    engine.nodes.push(baseOsc, baseGain);
    engine.harmonicNodes.baseOsc = baseOsc;
    engine._lfo(p.lfoRate * 0.2, base * 0.01, baseOsc.frequency);

    const d1 = engine._osc(ac.droneWave, base, 0.045, filt);
    const d2 = engine._osc(ac.droneWave, base * 2 + p.droneDetune, 0.025, filt);
    engine.harmonicNodes.d1 = d1.osc;
    engine.harmonicNodes.d2 = d2.osc;

    // Simple FM synthesis for drone
    const fmMod = ctx.createOscillator(), fmModG = ctx.createGain();
    fmMod.type = 'sine'; fmMod.frequency.value = base * ac.fmRatio;
    engine.fmIndexBase = ac.fmIndex * (0.7 + p.lfoRate); // stored for tension morphing
    fmModG.gain.value = engine.fmIndexBase;
    engine.fmModGainNode = fmModG; // store for tension morphing
    const fmCarrier = ctx.createOscillator(), fmCarrierG = ctx.createGain();
    fmCarrier.type = engine._resolveOscType(ac.droneWave); fmCarrier.frequency.value = base;
    fmCarrierG.gain.value = 0.04 * (p.ac.chordAudibility !== undefined ? p.ac.chordAudibility : 0.5);
    fmMod.connect(fmModG); fmModG.connect(fmCarrier.frequency);
    fmCarrier.connect(fmCarrierG); fmCarrierG.connect(filt);
    fmMod.start(); fmCarrier.start();
    engine.nodes.push(fmMod, fmModG, fmCarrier, fmCarrierG);
    engine.harmonicNodes.fmMod = fmMod;
    engine.harmonicNodes.fmCarrier = fmCarrier;

    engine._lfo(p.lfoRate * 0.3, base * 0.014, d1.osc.frequency);
    engine._lfo(p.lfoRate * 0.55, base * 0.025, d2.osc.frequency, 'triangle');

    // Pad - intro phase: pads fade in from silence over ~15s
    const padBus = ctx.createGain();
    padBus.gain.setValueAtTime(0, ctx.currentTime);
    const padTargetRaw = 1.0 * (p.ac.chordAudibility !== undefined ? p.ac.chordAudibility : 0.5);
    const padTarget = engine._clamp(padTargetRaw, 0.05, timbreLimits.padGainMax ?? 0.86);
    padBus.gain.linearRampToValueAtTime(padTarget, ctx.currentTime + 15);
    padBus.connect(filt);
    engine.nodes.push(padBus);
    p.scale.slice(0, 5).forEach((step, i) => {
        const freq = engine._getStepFrequency(p, step, ac.octScale);
        const det = (i % 2 === 0 ? 1 : -1) * p.padDetune * 0.012 * freq;
        const pad = engine._osc(ac.padWave, freq + det, 0.018, padBus);
        engine._lfo(p.lfoRate * (0.09 + i * 0.07), freq * 0.005, pad.osc.frequency);
        engine.harmonicNodes.pads.push({ osc: pad.osc, stepIndex: i, detuneRatio: det / freq });
    });
    engine.padBus = padBus;

    // Noise texture - biome controls how noisy
    if (p.noiseLevel > 0.01) {
        const blen = ctx.sampleRate * 3;
        const buf = ctx.createBuffer(1, blen, ctx.sampleRate);
        const nd = buf.getChannelData(0);
        for (let i = 0; i < blen; i++) nd[i] = engine._random('bed-noise') * 2 - 1;
        const ns = ctx.createBufferSource(); ns.buffer = buf; ns.loop = true;
        const nf = ctx.createBiquadFilter();
        nf.type = p.biome.id === 'volcanic' ? 'lowpass' : (p.biome.id === 'crystalline' ? 'highpass' : 'bandpass');
        nf.frequency.value = 200 + p.seed % 1200; nf.Q.value = 4;
        const ng = ctx.createGain(); ng.gain.value = p.noiseLevel * 0.18;
        ns.connect(nf); nf.connect(ng); ng.connect(filt);
        ns.start();
        engine.nodes.push(ns, nf, ng);
    }

    // Unified melody sequencer
    const melodyBus = ctx.createGain();
    const melodyFilter = ctx.createBiquadFilter();
    const melodyFilterFreq = Math.max(180, Math.min(ac.melFiltFreq || p.filterFreq || 2400, ctx.sampleRate / 2 - 200));
    melodyBus.gain.setValueAtTime(0, ctx.currentTime);
    melodyBus.gain.linearRampToValueAtTime(1, ctx.currentTime + 20);
    melodyFilter.type = 'lowpass';
    melodyFilter.frequency.setValueAtTime(melodyFilterFreq, ctx.currentTime);
    melodyFilter.Q.value = Math.max(0.0001, ac.melFiltQ || 0.7);
    melodyBus.connect(melodyFilter);
    melodyFilter.connect(filt);
    engine.nodes.push(melodyBus, melodyFilter);
    engine.melodyBus = melodyBus;
    engine.melodyFilter = melodyFilter;
    engine._moonProfile = engine._buildMoonProfile(p);
    if (engine._moonProfile.length) {
        const moonBus = ctx.createGain();
        moonBus.gain.setValueAtTime(0, ctx.currentTime);
        moonBus.gain.linearRampToValueAtTime(engine._clamp(0.16 + engine._moonProfile.length * 0.06, 0.18, 0.36), ctx.currentTime + 12);
        moonBus.connect(melodyFilter);
        engine.nodes.push(moonBus);
        engine._moonBus = moonBus;
    } else {
        engine._moonBus = null;
    }
    engine.playing = true;
    engine._startStateStream();
    engine._emitState();

    const baseMelodyStride = engine._getMelodyStride(p, transport.cycleSteps);
    let melodyTransportStep = 0;
    const runMelodyStep = (scheduleTime = null) => {
        const seqRng = new RNG(p.seed + 10000 + melodyTransportStep);
        const tension = engine.tension || 0;
        const cycleStep = melodyTransportStep % transport.cycleSteps;
        const isResponse = cycleStep >= Math.ceil(transport.cycleSteps / 2);
        const isPhraseEnd = cycleStep === transport.cycleSteps - 1;

        if (cycleStep === 0) {
            engine._motifSwapCounter++;
            if (engine._motifSwapCounter >= 2) {
                engine._motifSwapCounter = 0;
                engine._activeMotifIdx = (engine._activeMotifIdx + 1) % (p.motifBank?.length || 1);
            }
        }

        let melodyStride = baseMelodyStride;
        if (tension > 0.72 && melodyStride > 1) melodyStride -= 1;
        if (engine._drift > 0.15 && seqRng.range(0, 1) < engine._drift * 0.22) {
            melodyStride += seqRng.bool(0.6) ? 1 : -1;
        }
        melodyStride = engine._clamp(melodyStride, 1, transport.cycleSteps);
        const shouldAttempt = cycleStep === 0 || (cycleStep % melodyStride) === 0;

        if (shouldAttempt) {
            const targetRest = engine._getTargetRestProbability(p, {
                cycleStep,
                cycleSteps: transport.cycleSteps,
                isResponse,
                isPhraseEnd,
                tension,
            });
            engine._restProb += (targetRest - engine._restProb) * 0.28;
            engine._restProb = engine._clamp(engine._restProb, 0.08, 0.92);

            if (seqRng.range(0, 1) >= engine._restProb) {
                engine._scheduleNote(p, melodyBus, ac, scheduleTime);
                engine._phraseLength++;
            } else {
                engine._phraseLength = 0;
                engine.stepNote++;
            }
        }

        if (!shouldAttempt && isPhraseEnd) {
            engine._restProb = engine._clamp(engine._restProb + 0.04, 0.08, 0.92);
        }

        melodyTransportStep++;
    };

    const melodyScheduled = engine._scheduleRecurringChannel(
        'melody',
        transport.stepSeconds,
        ({ scheduleTime }) => {
            if (!engine.playing) return;
            runMelodyStep(scheduleTime);
        }
    );

    if (!melodyScheduled) {
        const scheduleLoop = () => {
            if (!engine.playing) return;
            runMelodyStep();
            engine._setManagedTimeout(scheduleLoop, transport.stepMs);
        };
        scheduleLoop();
    }

    const startMacroFxLoop = (name, intervalMs, callback) => {
        const scheduled = engine._scheduleRecurringChannel(
            name,
            intervalMs / 1000,
            () => {
                if (!engine.playing) return;
                callback();
            }
        );
        if (!scheduled) {
            engine.intervals.push(setInterval(() => {
                if (!engine.playing) return;
                callback();
            }, intervalMs));
        }
    };

    // Biome-specific periodic effects
    if (p.biome.id === 'corrupted') {
        startMacroFxLoop('macroFx', 700, () => {
            const rng = new RNG(p.seed + 20000 + engine.stepFX++);
            if (rng.range(0, 1) < 0.2) {
                const orig = filt.frequency.value;
                const nyquist = ctx.sampleRate / 2;
                filt.frequency.setValueAtTime(Math.min(orig * (0.2 + rng.range(0, 3)), nyquist), ctx.currentTime);
                filt.frequency.setValueAtTime(Math.min(orig, nyquist), ctx.currentTime + 0.04 + rng.range(0, 0.12));
            }
        });
    }
    if (p.biome.id === 'organic') {
        // Pulsing life-like tremolo
        engine._lfo(p.lfoRate * 2.5, 0.25, wet.gain);
    }
    if (p.biome.id === 'barren') {
        // Very occasional lone ping
        startMacroFxLoop('macroFx-barren', 4000, () => {
            const rng = new RNG(p.seed + 30000 + engine.stepFX++);
            if (rng.range(0, 1) < 0.08) engine._scheduleNote(p, filt, ac);
        });
    }
    if (p.biome.id === 'storm') {
        // Random chaotic filter bursts - electrical chaos
        startMacroFxLoop('macroFx-storm', 300, () => {
            const rng = new RNG(p.seed + 60000 + engine.stepFX++);
            if (rng.range(0, 1) < 0.35) {
                const orig = filt.frequency.value;
                const nyquist = ctx.sampleRate / 2;
                const burstMulMax = engine._clamp(timbreLimits.filterBurstMulMax ?? 5.0, 1.6, 8.0);
                const spike = Math.min(orig * rng.range(0.1, burstMulMax), nyquist);
                filt.frequency.setValueAtTime(spike, ctx.currentTime);
                filt.frequency.exponentialRampToValueAtTime(Math.min(orig, nyquist), ctx.currentTime + rng.range(0.02, 0.18));
            }
        });
    }
    if (p.biome.id === 'nebula') {
        // Push extra wet reverb for the immense nebular space
        const wetBoost = engine._clamp(timbreLimits.reverbWetBoostMax ?? 1.4, 1.0, 1.6);
        wet.gain.linearRampToValueAtTime(Math.min(engine._reverb * wetBoost, 1), ctx.currentTime + 8);
        // Slowly evolve formant movement via LFO on filter
        engine._lfo(0.018, p.filterFreq * 0.3, filt.frequency, 'sine');
    }

    engine._startPercussion(p, filt);
    engine._startBass(p, filt);
    engine._startGranular(p, filt);
    engine._addChorus(filt, engine.masterGain, ac);
    engine._startNatureAmbiance(p, filt);

    engine.tension = 0;
    engine.tensionFilt = filt;
    engine.tensionBase = { filtFreq: p.filterFreq, lfoRate: p.lfoRate };
    engine._startTensionArc(p, filt);

    // Immediately apply initial chord frequencies to the bed
    engine._updateChord();
}
