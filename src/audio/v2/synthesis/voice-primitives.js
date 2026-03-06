import { RNG } from '../../../rng.js';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function push(host, ttlSec, ...nodes) {
    if (typeof host.nodes.pushTransient === 'function') {
        host.nodes.pushTransient(ttlSec, ...nodes);
    } else {
        host.nodes.push(...nodes);
    }
}

export function triggerKick(host, dest, scheduleTime, velocity = 0.5, seed = 1) {
    const ctx = host.ctx;
    const rng = new RNG(seed >>> 0);
    const osc = ctx.createOscillator();
    const click = ctx.createBiquadFilter();
    const env = ctx.createGain();
    const body = ctx.createGain();
    const ttl = 0.24;

    osc.type = 'sine';
    osc.frequency.setValueAtTime(120 + rng.range(-8, 6), scheduleTime);
    osc.frequency.exponentialRampToValueAtTime(42 + rng.range(-3, 4), scheduleTime + 0.11);
    click.type = 'highpass';
    click.frequency.value = 1100;
    env.gain.setValueAtTime(0.0001, scheduleTime);
    env.gain.exponentialRampToValueAtTime(clamp(0.12 + velocity * 0.14, 0.05, 0.24), scheduleTime + 0.006);
    env.gain.exponentialRampToValueAtTime(0.0001, scheduleTime + ttl);
    body.gain.value = clamp(0.4 + velocity * 0.22, 0.26, 0.56);

    osc.connect(click);
    click.connect(env);
    env.connect(body);
    body.connect(dest);
    osc.start(scheduleTime);
    osc.stop(scheduleTime + ttl + 0.02);
    push(host, ttl + 0.1, osc, click, env, body);
}

export function triggerSnare(host, dest, scheduleTime, velocity = 0.5, seed = 1) {
    const ctx = host.ctx;
    const rng = new RNG(seed >>> 0);
    const tone = ctx.createOscillator();
    const toneGain = ctx.createGain();
    const noise = ctx.createBufferSource();
    const noiseGain = ctx.createGain();
    const noiseFilter = ctx.createBiquadFilter();
    const ttl = 0.28;

    const len = Math.floor(ctx.sampleRate * 0.2);
    const noiseBuffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (rng.next() * 2 - 1) * Math.pow(1 - i / len, 2);
    noise.buffer = noiseBuffer;

    tone.type = 'triangle';
    tone.frequency.value = 175 + rng.range(-16, 10);
    toneGain.gain.setValueAtTime(clamp(0.06 + velocity * 0.09, 0.03, 0.18), scheduleTime);
    toneGain.gain.exponentialRampToValueAtTime(0.0001, scheduleTime + 0.14);

    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.value = 1900 + rng.range(-450, 700);
    noiseFilter.Q.value = 0.7 + rng.range(0, 1.5);
    noiseGain.gain.setValueAtTime(clamp(0.08 + velocity * 0.12, 0.04, 0.24), scheduleTime);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, scheduleTime + ttl);

    tone.connect(toneGain);
    toneGain.connect(dest);
    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(dest);
    tone.start(scheduleTime);
    tone.stop(scheduleTime + 0.17);
    noise.start(scheduleTime);
    noise.stop(scheduleTime + ttl + 0.02);
    push(host, ttl + 0.12, tone, toneGain, noise, noiseFilter, noiseGain);
}

export function triggerHat(host, dest, scheduleTime, velocity = 0.3, { open = false, seed = 1 } = {}) {
    const ctx = host.ctx;
    const rng = new RNG(seed >>> 0);
    const noise = ctx.createBufferSource();
    const filter = ctx.createBiquadFilter();
    const env = ctx.createGain();
    const ttl = open ? 0.2 : 0.09;

    const len = Math.floor(ctx.sampleRate * 0.12);
    const noiseBuffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = rng.next() * 2 - 1;
    noise.buffer = noiseBuffer;
    filter.type = 'highpass';
    filter.frequency.value = 5200 + rng.range(-700, 900);
    filter.Q.value = 0.3 + rng.range(0, 1.3);
    env.gain.setValueAtTime(clamp(0.03 + velocity * 0.12, 0.015, 0.18), scheduleTime);
    env.gain.exponentialRampToValueAtTime(0.0001, scheduleTime + ttl);

    noise.connect(filter);
    filter.connect(env);
    env.connect(dest);
    noise.start(scheduleTime);
    noise.stop(scheduleTime + ttl + 0.02);
    push(host, ttl + 0.08, noise, filter, env);
}

export function triggerShaker(host, dest, scheduleTime, velocity = 0.2, seed = 1) {
    const ctx = host.ctx;
    const rng = new RNG(seed >>> 0);
    const noise = ctx.createBufferSource();
    const band = ctx.createBiquadFilter();
    const env = ctx.createGain();
    const ttl = 0.12;

    const len = Math.floor(ctx.sampleRate * 0.09);
    const noiseBuffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (rng.next() * 2 - 1) * (0.6 + rng.next() * 0.4);
    noise.buffer = noiseBuffer;
    band.type = 'bandpass';
    band.frequency.value = 3600 + rng.range(-600, 900);
    band.Q.value = 1.2 + rng.range(0, 3.2);
    env.gain.setValueAtTime(clamp(0.02 + velocity * 0.08, 0.01, 0.14), scheduleTime);
    env.gain.exponentialRampToValueAtTime(0.0001, scheduleTime + ttl);
    noise.connect(band);
    band.connect(env);
    env.connect(dest);
    noise.start(scheduleTime);
    noise.stop(scheduleTime + ttl + 0.02);
    push(host, ttl + 0.07, noise, band, env);
}

export function triggerTom(host, dest, scheduleTime, velocity = 0.3, seed = 1) {
    const ctx = host.ctx;
    const rng = new RNG(seed >>> 0);
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    const filt = ctx.createBiquadFilter();
    const ttl = 0.24;

    osc.type = 'sine';
    osc.frequency.setValueAtTime(160 + rng.range(-24, 18), scheduleTime);
    osc.frequency.exponentialRampToValueAtTime(92 + rng.range(-14, 12), scheduleTime + 0.16);
    filt.type = 'lowpass';
    filt.frequency.value = 950 + rng.range(-140, 280);
    env.gain.setValueAtTime(clamp(0.06 + velocity * 0.11, 0.03, 0.18), scheduleTime);
    env.gain.exponentialRampToValueAtTime(0.0001, scheduleTime + ttl);
    osc.connect(filt);
    filt.connect(env);
    env.connect(dest);
    osc.start(scheduleTime);
    osc.stop(scheduleTime + ttl + 0.03);
    push(host, ttl + 0.1, osc, env, filt);
}

export function triggerNoiseWash(host, dest, scheduleTime, durationSec = 2.4, gain = 0.12, seed = 1) {
    const ctx = host.ctx;
    const rng = new RNG(seed >>> 0);
    const len = Math.floor(ctx.sampleRate * Math.max(0.2, durationSec));
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) {
        const t = i / len;
        data[i] = (rng.next() * 2 - 1) * Math.pow(1 - t, 1.7);
    }
    const source = ctx.createBufferSource();
    const filt = ctx.createBiquadFilter();
    const env = ctx.createGain();
    source.buffer = buffer;
    filt.type = 'bandpass';
    filt.frequency.value = 680 + rng.range(-220, 360);
    filt.Q.value = 0.45 + rng.range(0, 1.2);
    env.gain.setValueAtTime(0.0001, scheduleTime);
    env.gain.linearRampToValueAtTime(clamp(gain, 0.01, 0.12), scheduleTime + Math.min(0.5, durationSec * 0.22));
    env.gain.exponentialRampToValueAtTime(0.0001, scheduleTime + durationSec);
    source.connect(filt);
    filt.connect(env);
    env.connect(dest);
    source.start(scheduleTime);
    source.stop(scheduleTime + durationSec + 0.03);
    push(host, durationSec + 0.15, source, filt, env);
}

export function triggerWoodblock(host, dest, scheduleTime, velocity = 0.35, seed = 1) {
    const ctx = host.ctx;
    const rng = new RNG(seed >>> 0);
    const osc = ctx.createOscillator();
    const bp = ctx.createBiquadFilter();
    const env = ctx.createGain();
    const ttl = 0.12;

    osc.type = 'sine';
    osc.frequency.setValueAtTime(920 + rng.range(-80, 220), scheduleTime);
    osc.frequency.exponentialRampToValueAtTime(580 + rng.range(-60, 120), scheduleTime + 0.045);
    bp.type = 'bandpass';
    bp.frequency.value = 1100 + rng.range(-200, 260);
    bp.Q.value = 3.6 + rng.range(0, 2.4);
    env.gain.setValueAtTime(clamp(0.03 + velocity * 0.18, 0.02, 0.2), scheduleTime);
    env.gain.exponentialRampToValueAtTime(0.0001, scheduleTime + ttl);

    osc.connect(bp);
    bp.connect(env);
    env.connect(dest);
    osc.start(scheduleTime);
    osc.stop(scheduleTime + ttl + 0.03);
    push(host, ttl + 0.1, osc, bp, env);
}

export function triggerBirdCall(host, dest, scheduleTime, velocity = 0.22, seed = 1) {
    const ctx = host.ctx;
    const rng = new RNG(seed >>> 0);
    const osc = ctx.createOscillator();
    const mod = ctx.createOscillator();
    const modGain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    const env = ctx.createGain();
    const pan = ctx.createStereoPanner();
    const ttl = 0.32;
    const startHz = 1400 + rng.range(0, 1800);
    const endHz = startHz * rng.range(1.15, 1.9);

    osc.type = rng.bool(0.6) ? 'sine' : 'triangle';
    osc.frequency.setValueAtTime(startHz, scheduleTime);
    osc.frequency.exponentialRampToValueAtTime(endHz, scheduleTime + ttl * 0.55);
    mod.type = 'sine';
    mod.frequency.value = 8 + rng.range(-2, 6);
    modGain.gain.value = startHz * 0.015;
    filter.type = 'bandpass';
    filter.frequency.value = startHz * 1.3;
    filter.Q.value = 2 + rng.range(0, 4);
    pan.pan.value = rng.range(-0.85, 0.85);
    env.gain.setValueAtTime(0.0001, scheduleTime);
    env.gain.linearRampToValueAtTime(clamp(0.03 + velocity * 0.12, 0.01, 0.16), scheduleTime + 0.03);
    env.gain.exponentialRampToValueAtTime(0.0001, scheduleTime + ttl);

    mod.connect(modGain);
    modGain.connect(osc.frequency);
    osc.connect(filter);
    filter.connect(env);
    env.connect(pan);
    pan.connect(dest);

    mod.start(scheduleTime);
    osc.start(scheduleTime);
    mod.stop(scheduleTime + ttl + 0.06);
    osc.stop(scheduleTime + ttl + 0.06);
    push(host, ttl + 0.12, osc, mod, modGain, filter, env, pan);
}

export function triggerRainDrop(host, dest, scheduleTime, velocity = 0.16, seed = 1) {
    const ctx = host.ctx;
    const rng = new RNG(seed >>> 0);
    const len = Math.floor(ctx.sampleRate * 0.08);
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (rng.next() * 2 - 1) * Math.pow(1 - i / len, 3.2);

    const source = ctx.createBufferSource();
    const hp = ctx.createBiquadFilter();
    const bp = ctx.createBiquadFilter();
    const env = ctx.createGain();
    const pan = ctx.createStereoPanner();
    const ttl = 0.14;

    source.buffer = buffer;
    hp.type = 'highpass';
    hp.frequency.value = 3200 + rng.range(0, 2800);
    bp.type = 'bandpass';
    bp.frequency.value = 4200 + rng.range(-1200, 2400);
    bp.Q.value = 1.4 + rng.range(0, 2.2);
    pan.pan.value = rng.range(-0.95, 0.95);
    env.gain.setValueAtTime(0.0001, scheduleTime);
    env.gain.linearRampToValueAtTime(clamp(0.018 + velocity * 0.11, 0.008, 0.14), scheduleTime + 0.008);
    env.gain.exponentialRampToValueAtTime(0.0001, scheduleTime + ttl);

    source.connect(hp);
    hp.connect(bp);
    bp.connect(env);
    env.connect(pan);
    pan.connect(dest);

    source.start(scheduleTime);
    source.stop(scheduleTime + ttl + 0.03);
    push(host, ttl + 0.1, source, hp, bp, env, pan);
}

export function triggerCrystalShard(host, dest, scheduleTime, velocity = 0.2, seed = 1) {
    const ctx = host.ctx;
    const rng = new RNG(seed >>> 0);
    const partials = [1, 2.76, 5.4];
    const ttl = 0.95;
    partials.forEach((ratio, idx) => {
        const osc = ctx.createOscillator();
        const bp = ctx.createBiquadFilter();
        const env = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime((460 + rng.range(-50, 140)) * ratio, scheduleTime);
        bp.type = 'bandpass';
        bp.frequency.value = 2600 + ratio * 260;
        bp.Q.value = 1.6 + idx * 0.8;
        env.gain.setValueAtTime(0.0001, scheduleTime);
        env.gain.linearRampToValueAtTime(clamp((0.02 + velocity * 0.08) / (idx + 1), 0.006, 0.08), scheduleTime + 0.01);
        env.gain.exponentialRampToValueAtTime(0.0001, scheduleTime + (0.3 + idx * 0.2));
        osc.connect(bp);
        bp.connect(env);
        env.connect(dest);
        osc.start(scheduleTime);
        osc.stop(scheduleTime + 0.55 + idx * 0.24);
        push(host, ttl, osc, bp, env);
    });
}

export function triggerThunderRumble(host, dest, scheduleTime, velocity = 0.2, seed = 1) {
    const ctx = host.ctx;
    const rng = new RNG(seed >>> 0);
    const len = Math.floor(ctx.sampleRate * 2.6);
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) {
        const t = i / len;
        data[i] = (rng.next() * 2 - 1) * Math.pow(1 - t, 1.25);
    }

    const source = ctx.createBufferSource();
    const low = ctx.createBiquadFilter();
    const sub = ctx.createOscillator();
    const subGain = ctx.createGain();
    const env = ctx.createGain();
    const ttl = 2.8;

    source.buffer = buffer;
    low.type = 'lowpass';
    low.frequency.value = 260 + rng.range(-80, 120);
    low.Q.value = 0.4 + rng.range(0, 0.6);
    sub.type = 'sine';
    sub.frequency.setValueAtTime(62 + rng.range(-8, 10), scheduleTime);
    sub.frequency.exponentialRampToValueAtTime(34 + rng.range(-6, 8), scheduleTime + 1.9);
    subGain.gain.setValueAtTime(clamp(0.02 + velocity * 0.08, 0.015, 0.13), scheduleTime);
    subGain.gain.exponentialRampToValueAtTime(0.0001, scheduleTime + 2.1);
    env.gain.setValueAtTime(0.0001, scheduleTime);
    env.gain.linearRampToValueAtTime(clamp(0.03 + velocity * 0.16, 0.02, 0.22), scheduleTime + 0.2);
    env.gain.exponentialRampToValueAtTime(0.0001, scheduleTime + 2.4);

    source.connect(low);
    low.connect(env);
    env.connect(dest);
    sub.connect(subGain);
    subGain.connect(dest);

    source.start(scheduleTime);
    source.stop(scheduleTime + 2.45);
    sub.start(scheduleTime);
    sub.stop(scheduleTime + 2.2);
    push(host, ttl, source, low, sub, subGain, env);
}

export function triggerWindGust(host, dest, scheduleTime, durationSec = 1.8, velocity = 0.12, seed = 1) {
    const ctx = host.ctx;
    const rng = new RNG(seed >>> 0);
    const len = Math.floor(ctx.sampleRate * Math.max(0.3, durationSec));
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let smooth = 0;
    for (let i = 0; i < len; i++) {
        smooth = smooth * 0.986 + (rng.next() * 2 - 1) * 0.07;
        data[i] = smooth;
    }

    const source = ctx.createBufferSource();
    const bp = ctx.createBiquadFilter();
    const lp = ctx.createBiquadFilter();
    const env = ctx.createGain();
    const pan = ctx.createStereoPanner();
    const ttl = durationSec + 0.2;

    source.buffer = buffer;
    bp.type = 'bandpass';
    bp.frequency.value = 300 + rng.range(0, 900);
    bp.Q.value = 0.35 + rng.range(0, 0.8);
    lp.type = 'lowpass';
    lp.frequency.value = 1800 + rng.range(-500, 1200);
    pan.pan.value = rng.range(-0.8, 0.8);
    env.gain.setValueAtTime(0.0001, scheduleTime);
    env.gain.linearRampToValueAtTime(clamp(0.02 + velocity * 0.16, 0.01, 0.2), scheduleTime + Math.min(0.22, durationSec * 0.2));
    env.gain.exponentialRampToValueAtTime(0.0001, scheduleTime + durationSec);

    source.connect(bp);
    bp.connect(lp);
    lp.connect(env);
    env.connect(pan);
    pan.connect(dest);

    source.start(scheduleTime);
    source.stop(scheduleTime + durationSec + 0.03);
    push(host, ttl, source, bp, lp, env, pan);
}

export function triggerRustle(host, dest, scheduleTime, velocity = 0.12, seed = 1) {
    const ctx = host.ctx;
    const rng = new RNG(seed >>> 0);
    const burstCount = 3 + rng.int(0, 3);
    const ttl = 0.42;

    for (let i = 0; i < burstCount; i++) {
        const when = scheduleTime + i * rng.range(0.02, 0.06);
        const len = Math.floor(ctx.sampleRate * 0.05);
        const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let k = 0; k < len; k++) data[k] = (rng.next() * 2 - 1) * Math.pow(1 - k / len, 2.2);
        const source = ctx.createBufferSource();
        const hp = ctx.createBiquadFilter();
        const env = ctx.createGain();
        source.buffer = buffer;
        hp.type = 'highpass';
        hp.frequency.value = 1800 + rng.range(0, 3200);
        env.gain.setValueAtTime(clamp(0.01 + velocity * 0.08, 0.008, 0.12), when);
        env.gain.exponentialRampToValueAtTime(0.0001, when + 0.09);
        source.connect(hp);
        hp.connect(env);
        env.connect(dest);
        source.start(when);
        source.stop(when + 0.1);
        push(host, ttl, source, hp, env);
    }
}

export function triggerHarmonicShimmer(host, dest, scheduleTime, velocity = 0.12, seed = 1) {
    const ctx = host.ctx;
    const rng = new RNG(seed >>> 0);
    const partials = [1, 2.12, 2.98, 4.05];
    const ttl = 1.2;
    const base = 260 + rng.range(-30, 120);
    partials.forEach((ratio, idx) => {
        const osc = ctx.createOscillator();
        const env = ctx.createGain();
        const bp = ctx.createBiquadFilter();
        osc.type = idx % 2 === 0 ? 'triangle' : 'sine';
        osc.frequency.value = base * ratio;
        bp.type = 'bandpass';
        bp.frequency.value = 1400 + ratio * 520;
        bp.Q.value = 1.4 + idx * 0.7;
        env.gain.setValueAtTime(0.0001, scheduleTime + idx * 0.01);
        env.gain.linearRampToValueAtTime(clamp((0.02 + velocity * 0.1) / (1 + idx * 0.35), 0.006, 0.1), scheduleTime + 0.03 + idx * 0.01);
        env.gain.exponentialRampToValueAtTime(0.0001, scheduleTime + 0.45 + idx * 0.14);
        osc.connect(bp);
        bp.connect(env);
        env.connect(dest);
        osc.start(scheduleTime + idx * 0.01);
        osc.stop(scheduleTime + 0.5 + idx * 0.16);
        push(host, ttl, osc, env, bp);
    });
}

export function triggerDelaySwell(host, dest, scheduleTime, durationSec = 1.2, velocity = 0.12, seed = 1) {
    const ctx = host.ctx;
    const rng = new RNG(seed >>> 0);
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    const delay = ctx.createDelay(1.2);
    const fb = ctx.createGain();
    const tone = ctx.createBiquadFilter();
    const ttl = durationSec + 0.4;

    osc.type = rng.bool(0.5) ? 'triangle' : 'sine';
    osc.frequency.setValueAtTime(240 + rng.range(-50, 120), scheduleTime);
    osc.frequency.exponentialRampToValueAtTime(120 + rng.range(-20, 70), scheduleTime + durationSec * 0.8);
    env.gain.setValueAtTime(0.0001, scheduleTime);
    env.gain.linearRampToValueAtTime(clamp(0.02 + velocity * 0.08, 0.01, 0.14), scheduleTime + Math.min(0.2, durationSec * 0.3));
    env.gain.exponentialRampToValueAtTime(0.0001, scheduleTime + durationSec);
    delay.delayTime.value = clamp(0.12 + rng.range(0, 0.34), 0.08, 0.6);
    fb.gain.value = clamp(0.2 + velocity * 0.5, 0.14, 0.58);
    tone.type = 'lowpass';
    tone.frequency.value = 1800 + rng.range(-600, 2200);

    osc.connect(env);
    env.connect(delay);
    delay.connect(fb);
    fb.connect(delay);
    delay.connect(tone);
    tone.connect(dest);

    osc.start(scheduleTime);
    osc.stop(scheduleTime + durationSec + 0.05);
    push(host, ttl, osc, env, delay, fb, tone);
}

export function triggerGlitchPulse(host, dest, scheduleTime, velocity = 0.1, seed = 1) {
    const ctx = host.ctx;
    const rng = new RNG(seed >>> 0);
    const ttl = 0.3;
    const count = 2 + rng.int(0, 3);
    for (let i = 0; i < count; i++) {
        const when = scheduleTime + i * rng.range(0.015, 0.04);
        const osc = ctx.createOscillator();
        const env = ctx.createGain();
        const hp = ctx.createBiquadFilter();
        osc.type = rng.pick(['square', 'sawtooth', 'triangle']);
        osc.frequency.setValueAtTime(800 + rng.range(-260, 1400), when);
        osc.frequency.exponentialRampToValueAtTime(180 + rng.range(-60, 120), when + 0.06);
        hp.type = 'highpass';
        hp.frequency.value = 500 + rng.range(0, 2200);
        env.gain.setValueAtTime(clamp(0.006 + velocity * 0.08, 0.004, 0.11), when);
        env.gain.exponentialRampToValueAtTime(0.0001, when + 0.08);
        osc.connect(hp);
        hp.connect(env);
        env.connect(dest);
        osc.start(when);
        osc.stop(when + 0.09);
        push(host, ttl, osc, env, hp);
    }
}
