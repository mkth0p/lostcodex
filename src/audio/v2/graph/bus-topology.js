import { buildMasterChain } from '../mix/master-chain.js';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const LAYER_KEYS = ['drones', 'pads', 'melody', 'bass', 'percussion', 'ambience', 'fx'];

function measureLayerDb(analyser, buffer) {
    analyser.getFloatTimeDomainData(buffer);
    let sum = 0;
    let peak = 0;
    for (let i = 0; i < buffer.length; i++) {
        const sample = buffer[i];
        const abs = Math.abs(sample);
        if (abs > peak) peak = abs;
        sum += sample * sample;
    }
    const rms = Math.sqrt(sum / buffer.length);
    const rmsDb = 20 * Math.log10(Math.max(1e-8, rms));
    const peakDb = 20 * Math.log10(Math.max(1e-8, peak));
    return {
        rmsDb: clamp(rmsDb, -96, 6),
        peakDb: clamp(peakDb, -96, 6),
    };
}

export function createBusTopology(host, planet, { layerMix = {}, macroSpace = 0.5 } = {}) {
    const ctx = host.ctx;
    const master = buildMasterChain(ctx, { tilt: (macroSpace - 0.5) * 0.35 });
    const reverb = host._buildReverb(planet?.reverbDecay || 5, (planet?.seed || 1) + 39007);
    const wet = ctx.createGain();
    const dry = ctx.createGain();
    wet.gain.value = clamp(host._reverb * 0.26, 0.04, 0.42);
    dry.gain.value = clamp(0.58 + (1 - host._reverb) * 0.18, 0.48, 0.84);

    const layerTrim = {
        drones: 0.92,
        pads: 0.82,
        melody: 0.82,
        bass: 0.68,
        percussion: 0.3,
        ambience: 0.76,
        fx: 0.3,
    };

    const makeLayer = (name, base = 0.6) => {
        const g = ctx.createGain();
        g.gain.value = clamp(base, 0, 1.3) * (layerTrim[name] || 0.4);
        return g;
    };

    const layerGains = {
        drones: makeLayer('drones', layerMix.drones ?? 0.7),
        pads: makeLayer('pads', layerMix.pads ?? 0.7),
        melody: makeLayer('melody', layerMix.melody ?? 0.84),
        bass: makeLayer('bass', layerMix.bass ?? 0.72),
        percussion: makeLayer('percussion', layerMix.percussion ?? 0.8),
        ambience: makeLayer('ambience', layerMix.ambience ?? 0.66),
        fx: makeLayer('fx', layerMix.fx ?? 0.65),
    };
    const layerMeters = {};
    const layerMeterBuffers = {};
    LAYER_KEYS.forEach((key) => {
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 1024;
        analyser.smoothingTimeConstant = 0.78;
        layerMeters[key] = analyser;
        layerMeterBuffers[key] = new Float32Array(analyser.fftSize);
    });

    const sumBus = ctx.createGain();
    const inputTrim = ctx.createGain();
    sumBus.gain.value = 0.72;
    inputTrim.gain.value = 0.88;
    LAYER_KEYS.forEach((key) => {
        const bus = layerGains[key];
        const meter = layerMeters[key];
        bus.connect(meter);
        meter.connect(sumBus);
    });
    sumBus.connect(inputTrim);
    inputTrim.connect(master.input);
    master.output.connect(reverb);
    master.output.connect(dry);
    reverb.connect(wet);
    wet.connect(host.eqLow);
    dry.connect(host.eqLow);

    const nodes = [
        reverb,
        wet,
        dry,
        sumBus,
        inputTrim,
        ...master.nodes,
        ...Object.values(layerGains),
        ...Object.values(layerMeters),
    ];
    nodes.forEach((node) => host.nodes.push(node));
    host.reverbGain = wet;
    host.dryGain = dry;

    return {
        layerGains,
        sumBus,
        master,
        setLayerMix(next = {}) {
            Object.entries(next).forEach(([key, value]) => {
                if (!Number.isFinite(value) || !layerGains[key]) return;
                const trim = layerTrim[key] || 0.4;
                layerGains[key].gain.linearRampToValueAtTime(clamp(value, 0, 1.3) * trim, ctx.currentTime + 0.1);
            });
        },
        setMacroSpace(space = 0.5) {
            const safe = clamp(space, 0, 1);
            master.setTilt((safe - 0.5) * 0.7);
            wet.gain.linearRampToValueAtTime(clamp(host._reverb * (0.2 + safe * 0.18), 0.04, 0.42), ctx.currentTime + 0.2);
        },
        getTelemetry() {
            const masterTelemetry = master.getTelemetry();
            const layerDb = {};
            LAYER_KEYS.forEach((key) => {
                layerDb[key] = measureLayerDb(layerMeters[key], layerMeterBuffers[key]);
            });
            return {
                ...masterTelemetry,
                layerDb,
            };
        },
    };
}
