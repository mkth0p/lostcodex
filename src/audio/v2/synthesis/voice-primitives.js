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
