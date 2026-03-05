import { RNG } from '../../rng.js';

export function startNatureAmbience(engine, p, dest) {
    const ctx = engine.ctx;
    const ac = p.ac;
    const bid = p.biome.id;
    const features = ac.ambianceFeatures || [];
    if (features.length === 0) return;

    const ambBus = ctx.createGain();
    const ambTarget = bid === 'fungal' ? 0.58 : 0.5;
    ambBus.gain.setValueAtTime(0, ctx.currentTime);
    ambBus.gain.linearRampToValueAtTime(ambTarget, ctx.currentTime + 2);
    ambBus.connect(dest);
    engine.nodes.push(ambBus);

    const startAmbienceLoop = (name, intervalMs, callback) => {
        const scheduled = engine._scheduleRecurringChannel(
            `ambience-${name}`,
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

    features.forEach((feat) => {
        if (feat === 'birds') {
            startAmbienceLoop('birds', 1500, () => {
                if (!engine.playing) return;
                const rng = new RNG(p.seed + (engine.stepFX++ || 0) + 70000);
                if (rng.range(0, 1) < 0.2) {
                    const t = ctx.currentTime;
                    const o = ctx.createOscillator();
                    const g = ctx.createGain();
                    const f0 = 2000 + rng.range(0, 3000);
                    o.frequency.setValueAtTime(f0, t);
                    o.frequency.exponentialRampToValueAtTime(f0 * rng.range(0.5, 1.5), t + 0.1);
                    g.gain.setValueAtTime(0, t);
                    g.gain.linearRampToValueAtTime(0.04, t + 0.01);
                    g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
                    o.connect(g);
                    g.connect(ambBus);
                    o.start(t);
                    o.stop(t + 0.2);
                    engine.nodes.push(o, g);
                }
            });
        }
        if (feat === 'rain') {
            startAmbienceLoop('rain', 100, () => {
                if (!engine.playing) return;
                const rng = new RNG(p.seed + (engine.stepFX++ || 0) + 80000);
                if (rng.range(0, 1) < 0.6) {
                    const t = ctx.currentTime;
                    const n = ctx.createBufferSource();
                    n.buffer = engine._noiseBuffer;
                    const f = ctx.createBiquadFilter();
                    f.type = 'highpass';
                    f.frequency.value = 4000 + rng.range(0, 4000);
                    const g = ctx.createGain();
                    g.gain.setValueAtTime(0, t);
                    g.gain.linearRampToValueAtTime(0.08, t + 0.005);
                    g.gain.exponentialRampToValueAtTime(0.001, t + 0.03);
                    n.connect(f);
                    f.connect(g);
                    g.connect(ambBus);
                    n.start(t);
                    n.stop(t + 0.05);
                    engine.nodes.push(n, f, g);
                }
            });
        }
        if (feat === 'bubbles') {
            startAmbienceLoop('bubbles', 240, () => {
                if (!engine.playing) return;
                const rng = new RNG(p.seed + (engine.stepFX++ || 0) + 81000);
                if (rng.range(0, 1) < 0.42) {
                    const t = ctx.currentTime;
                    const dur = rng.range(0.18, 0.55);
                    const f0 = 180 + rng.range(0, 260);
                    const o = ctx.createOscillator();
                    const f = ctx.createBiquadFilter();
                    const g = ctx.createGain();
                    const pan = ctx.createStereoPanner();
                    o.type = 'sine';
                    o.frequency.setValueAtTime(f0, t);
                    o.frequency.exponentialRampToValueAtTime(f0 * rng.range(1.4, 2.6), t + dur);
                    f.type = 'bandpass';
                    f.frequency.value = f0 * 4;
                    f.Q.value = 1.2;
                    pan.pan.value = rng.range(-0.7, 0.7);
                    g.gain.setValueAtTime(0, t);
                    g.gain.linearRampToValueAtTime(0.018 + rng.range(0, 0.018), t + 0.03);
                    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
                    o.connect(f);
                    f.connect(g);
                    g.connect(pan);
                    pan.connect(ambBus);
                    o.start(t);
                    o.stop(t + dur + 0.05);
                    engine.nodes.push(o, f, g, pan);
                }
            });
        }
        if (feat === 'dew') {
            startAmbienceLoop('dew', 650, () => {
                if (!engine.playing) return;
                const rng = new RNG(p.seed + (engine.stepFX++ || 0) + 81250);
                if (rng.range(0, 1) < 0.22) {
                    const t = ctx.currentTime;
                    const dur = rng.range(0.16, 0.42);
                    const baseFreq = 620 + rng.range(0, 980);
                    const o = ctx.createOscillator();
                    const bp = ctx.createBiquadFilter();
                    const g = ctx.createGain();
                    const pan = ctx.createStereoPanner();
                    o.type = rng.range(0, 1) < 0.6 ? 'sine' : 'triangle';
                    o.frequency.setValueAtTime(baseFreq * rng.range(1.08, 1.35), t);
                    o.frequency.exponentialRampToValueAtTime(baseFreq, t + dur * 0.85);
                    bp.type = 'bandpass';
                    bp.frequency.value = baseFreq * 1.8;
                    bp.Q.value = 1.5;
                    pan.pan.value = rng.range(-0.75, 0.75);
                    g.gain.setValueAtTime(0, t);
                    g.gain.linearRampToValueAtTime(0.012 + rng.range(0, 0.01), t + 0.02);
                    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
                    o.connect(bp);
                    bp.connect(g);
                    g.connect(pan);
                    pan.connect(ambBus);
                    o.start(t);
                    o.stop(t + dur + 0.03);
                    engine.nodes.push(o, bp, g, pan);
                }
            });
        }
        if (feat === 'thunder' && bid === 'storm') {
            startAmbienceLoop('thunder', 5000, () => {
                if (!engine.playing) return;
                const rng = new RNG(p.seed + (engine.stepFX++ || 0) + 90000);
                if (rng.range(0, 1) < 0.05) {
                    const t = ctx.currentTime;
                    const n = ctx.createBufferSource();
                    n.buffer = engine._noiseBuffer;
                    const f = ctx.createBiquadFilter();
                    f.type = 'lowpass';
                    f.frequency.value = 100 + rng.range(0, 200);
                    const g = ctx.createGain();
                    g.gain.setValueAtTime(0, t);
                    g.gain.linearRampToValueAtTime(0.4, t + 0.1);
                    g.gain.exponentialRampToValueAtTime(0.001, t + 3.0);
                    n.connect(f);
                    f.connect(g);
                    g.connect(ambBus);
                    n.start(t);
                    n.stop(t + 3.1);
                    engine.nodes.push(n, f, g);
                }
            });
        }
        if (feat === 'lightning' && bid === 'storm' && engine._noiseBuffer) {
            startAmbienceLoop('lightning', 1800, () => {
                if (!engine.playing) return;
                const rng = new RNG(p.seed + (engine.stepFX++ || 0) + 90500);
                if (rng.range(0, 1) < 0.08) {
                    const t = ctx.currentTime;
                    const n = ctx.createBufferSource();
                    const hp = ctx.createBiquadFilter();
                    const bp = ctx.createBiquadFilter();
                    const g = ctx.createGain();
                    const baseFreq = 3800 + rng.range(0, 4200);
                    n.buffer = engine._noiseBuffer;
                    hp.type = 'highpass';
                    hp.frequency.value = baseFreq;
                    bp.type = 'bandpass';
                    bp.frequency.value = baseFreq * 0.85;
                    bp.Q.value = 2.2;
                    g.gain.setValueAtTime(0, t);
                    g.gain.linearRampToValueAtTime(0.16 + rng.range(0, 0.05), t + 0.004);
                    g.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
                    n.connect(hp);
                    hp.connect(bp);
                    bp.connect(g);
                    g.connect(ambBus);
                    n.start(t);
                    n.stop(t + 0.16);
                    if (dest?.frequency) {
                        const flashFreq = Math.min(ctx.sampleRate / 2 - 200, Math.max(dest.frequency.value * 1.7, 5000));
                        dest.frequency.setValueAtTime(dest.frequency.value, t);
                        dest.frequency.linearRampToValueAtTime(flashFreq, t + 0.01);
                        dest.frequency.exponentialRampToValueAtTime(Math.max(80, p.filterFreq), t + 0.18);
                    }
                    engine.nodes.push(n, hp, bp, g);
                }
            });
        }
        if (feat === 'wind') {
            const n = ctx.createBufferSource();
            if (engine._noiseBuffer) {
                n.buffer = engine._noiseBuffer;
                n.loop = true;
                const f = ctx.createBiquadFilter();
                f.type = 'bandpass';
                f.frequency.value = 800;
                f.Q.value = 0.5;
                const g = ctx.createGain();
                g.gain.value = 0.05;
                n.connect(f);
                f.connect(g);
                g.connect(ambBus);
                n.start();
                engine._lfo(0.05, 400, f.frequency);
                engine.nodes.push(n, f, g);
            }
        }
        if (feat === 'rustle' && engine._noiseBuffer) {
            const n = ctx.createBufferSource();
            const hp = ctx.createBiquadFilter();
            const bp = ctx.createBiquadFilter();
            const g = ctx.createGain();
            const pan = ctx.createStereoPanner();
            n.buffer = engine._noiseBuffer;
            n.loop = true;
            hp.type = 'highpass';
            hp.frequency.value = bid === 'fungal' ? 240 : 650;
            bp.type = 'bandpass';
            bp.frequency.value = bid === 'fungal' ? 920 : 1800;
            bp.Q.value = bid === 'fungal' ? 0.72 : 0.9;
            g.gain.value = bid === 'fungal' ? 0.024 : 0.018;
            pan.pan.value = 0;
            n.connect(hp);
            hp.connect(bp);
            bp.connect(g);
            g.connect(pan);
            pan.connect(ambBus);
            n.start();
            engine._lfo(0.07, bid === 'fungal' ? 250 : 520, bp.frequency, 'triangle');
            engine._lfo(0.11, g.gain.value * 0.55, g.gain, 'sine');
            if (bid === 'fungal') engine._lfo(0.035, 0.45, pan.pan, 'sine');
            engine.nodes.push(n, hp, bp, g, pan);
        }
        if (feat === 'spores' && engine._noiseBuffer) {
            startAmbienceLoop('spores', 1200, () => {
                if (!engine.playing) return;
                const rng = new RNG(p.seed + (engine.stepFX++ || 0) + 91500);
                if (rng.range(0, 1) < 0.28) {
                    const t = ctx.currentTime;
                    const dur = rng.range(0.45, 1.1);
                    const n = ctx.createBufferSource();
                    const f = ctx.createBiquadFilter();
                    const g = ctx.createGain();
                    const pan = ctx.createStereoPanner();
                    n.buffer = engine._noiseBuffer;
                    n.playbackRate.value = bid === 'fungal' ? rng.range(0.55, 1.1) : rng.range(0.4, 0.9);
                    f.type = 'bandpass';
                    f.frequency.value = (bid === 'fungal' ? 800 : 1200) + rng.range(0, bid === 'fungal' ? 1800 : 2800);
                    f.Q.value = 0.7 + rng.range(0, 1.2);
                    pan.pan.value = rng.range(-0.6, 0.6);
                    g.gain.setValueAtTime(0, t);
                    g.gain.linearRampToValueAtTime((bid === 'fungal' ? 0.016 : 0.022) + rng.range(0, 0.02), t + dur * 0.35);
                    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
                    n.connect(f);
                    f.connect(g);
                    g.connect(pan);
                    pan.connect(ambBus);
                    n.start(t);
                    n.stop(t + dur + 0.05);
                    engine.nodes.push(n, f, g, pan);
                    if (bid === 'fungal') {
                        const o = ctx.createOscillator();
                        const og = ctx.createGain();
                        const of = ctx.createBiquadFilter();
                        o.type = rng.range(0, 1) < 0.5 ? 'sine' : 'triangle';
                        o.frequency.setValueAtTime(420 + rng.range(0, 520), t);
                        o.frequency.exponentialRampToValueAtTime((680 + rng.range(0, 680)) * rng.range(0.95, 1.08), t + dur * 0.7);
                        of.type = 'bandpass';
                        of.frequency.value = 1200 + rng.range(0, 900);
                        of.Q.value = 1.1;
                        og.gain.setValueAtTime(0, t);
                        og.gain.linearRampToValueAtTime(0.006 + rng.range(0, 0.008), t + dur * 0.18);
                        og.gain.exponentialRampToValueAtTime(0.001, t + dur * 0.82);
                        o.connect(of);
                        of.connect(og);
                        og.connect(pan);
                        o.start(t);
                        o.stop(t + dur + 0.04);
                        engine.nodes.push(o, og, of);
                    }
                }
            });
        }
    });
}

export const AmbienceSubsystem = {
    id: 'ambience',
    startNatureAmbience,
};
