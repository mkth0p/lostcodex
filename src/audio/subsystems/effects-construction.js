export function buildBitcrusherNode(engine, bits, normFreq) {
    const ctx = engine.ctx;
    if (ctx.audioWorklet && engine._worklets.bitcrusherReady) {
        return new AudioWorkletNode(ctx, 'bitcrusher-processor', {
            numberOfInputs: 1,
            numberOfOutputs: 1,
            outputChannelCount: [2],
            parameterData: { bits, normFreq },
        });
    }

    // Fallback quantizer when worklets are unavailable.
    const shaper = ctx.createWaveShaper();
    const samples = 2048;
    const curve = new Float32Array(samples);
    const levels = Math.max(2, Math.pow(2, Math.max(1, bits)));
    for (let i = 0; i < samples; i++) {
        const x = (i * 2) / (samples - 1) - 1;
        curve[i] = Math.round(x * levels) / levels;
    }
    shaper.curve = curve;
    shaper.oversample = 'none';
    return shaper;
}

export function buildPhaserGraph(engine) {
    const ctx = engine.ctx;
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

    filters.forEach((f) => {
        lfoDepth.connect(f.frequency);
    });
    lfo.start();

    return { input, output, nodes: [...filters, lfo, lfoDepth, input, output] };
}
