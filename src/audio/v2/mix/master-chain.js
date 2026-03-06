const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function createSoftClipper(ctx, drive = 0.72) {
    const node = ctx.createWaveShaper();
    const curve = new Float32Array(2048);
    const k = clamp(drive, 0.1, 1.5) * 2.2;
    for (let i = 0; i < curve.length; i++) {
        const x = (i / (curve.length - 1)) * 2 - 1;
        const shaped = ((1 + k) * x) / (1 + k * Math.abs(x));
        curve[i] = clamp(shaped * 0.95, -0.99, 0.99);
    }
    node.curve = curve;
    node.oversample = '4x';
    return node;
}

export function buildMasterChain(ctx, { tilt = 0, limiterCeil = -1.2 } = {}) {
    const input = ctx.createGain();
    const low = ctx.createBiquadFilter();
    const high = ctx.createBiquadFilter();
    const clipper = createSoftClipper(ctx, 0.55);
    const meter = ctx.createAnalyser();
    const limiter = ctx.createDynamicsCompressor();
    const output = ctx.createGain();
    const meterBuffer = new Float32Array(1024);
    let integratedLufs = -24;

    low.type = 'lowshelf';
    low.frequency.value = 320;
    high.type = 'highshelf';
    high.frequency.value = 2800;
    low.gain.value = clamp(-tilt * 4, -4, 4);
    high.gain.value = clamp(tilt * 4, -4, 4);

    limiter.threshold.value = limiterCeil;
    limiter.knee.value = 7;
    limiter.ratio.value = 5;
    limiter.attack.value = 0.006;
    limiter.release.value = 0.14;
    output.gain.value = 1.02;
    meter.fftSize = 2048;
    meter.smoothingTimeConstant = 0.8;

    input.connect(low);
    low.connect(high);
    high.connect(clipper);
    clipper.connect(meter);
    meter.connect(limiter);
    limiter.connect(output);

    return {
        input,
        output,
        nodes: [input, low, high, clipper, meter, limiter, output],
        setTilt(nextTilt = 0) {
            const safe = clamp(nextTilt, -1, 1);
            low.gain.linearRampToValueAtTime(clamp(-safe * 4, -4, 4), ctx.currentTime + 0.08);
            high.gain.linearRampToValueAtTime(clamp(safe * 4, -4, 4), ctx.currentTime + 0.08);
        },
        getTelemetry() {
            meter.getFloatTimeDomainData(meterBuffer);
            let sum = 0;
            let peak = 0;
            for (let i = 0; i < meterBuffer.length; i++) {
                const sample = meterBuffer[i];
                const abs = Math.abs(sample);
                if (abs > peak) peak = abs;
                sum += sample * sample;
            }
            const rms = Math.sqrt(sum / meterBuffer.length);
            const rmsDb = 20 * Math.log10(Math.max(1e-7, rms));
            const peakDb = 20 * Math.log10(Math.max(1e-7, peak));
            const lufsInstant = rmsDb - 1.2;
            integratedLufs = (integratedLufs * 0.97) + (lufsInstant * 0.03);
            return {
                preLimiterPeakDb: clamp(peakDb, -96, 6),
                integratedLufs: clamp(integratedLufs, -60, 0),
            };
        },
    };
}
