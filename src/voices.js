// ============================================================
// ADDITIVE SYNTH VOICES
// Each voice: buildVoice(name, ctx, freq, dest, rng, atk, dur, nodes)
// `nodes` is AudioEngine.nodes — push anything that needs cleanup.
// ============================================================

export const ADDITIVE_VOICE_NAMES = [
    'strings', 'choir', 'marimba', 'metallic', 'theremin', 'subpad',
    'crystal_chimes', 'brass_pad', 'hollow_pipe', 'gong', 'vowel_morph',
    'bowed_metal', 'drone_morph', 'granular_cloud'
];

export function buildVoice(name, ctx, freq, dest, rng, atk, dur, nodes) {
    switch (name) {
        case 'strings': _strings(ctx, freq, dest, rng, atk, dur, nodes); break;
        case 'choir': _choir(ctx, freq, dest, rng, atk, dur, nodes); break;
        case 'marimba': _marimba(ctx, freq, dest, rng, atk, dur, nodes); break;
        case 'metallic': _metallic(ctx, freq, dest, rng, atk, dur, nodes); break;
        case 'theremin': _theremin(ctx, freq, dest, rng, atk, dur, nodes); break;
        case 'subpad': _subpad(ctx, freq, dest, rng, atk, dur, nodes); break;
        case 'crystal_chimes': _crystal_chimes(ctx, freq, dest, rng, atk, dur, nodes); break;
        case 'brass_pad': _brass_pad(ctx, freq, dest, rng, atk, dur, nodes); break;
        case 'hollow_pipe': _hollow_pipe(ctx, freq, dest, rng, atk, dur, nodes); break;
        case 'gong': _gong(ctx, freq, dest, rng, atk, dur, nodes); break;
        case 'vowel_morph': _vowel_morph(ctx, freq, dest, rng, atk, dur, nodes); break;
        case 'bowed_metal': _bowed_metal(ctx, freq, dest, rng, atk, dur, nodes); break;
        case 'drone_morph': _drone_morph(ctx, freq, dest, rng, atk, dur, nodes); break;
        case 'granular_cloud': _granular_cloud(ctx, freq, dest, rng, atk, dur, nodes); break;
    }
}

function pushTransientNodes(nodes, duration, ...items) {
    if (typeof nodes.pushTransient === 'function') {
        nodes.pushTransient(duration, ...items);
    } else {
        nodes.push(...items);
    }
}

function getNodeLoad(nodes) {
    return typeof nodes?.size === 'number' ? nodes.size : 0;
}

let fallbackNoiseSeed = 0x9e3779b9;
function nextVoiceRandom(rng) {
    if (rng?.next) return rng.next();
    fallbackNoiseSeed = (Math.imul(fallbackNoiseSeed, 1664525) + 1013904223) >>> 0;
    return fallbackNoiseSeed / 0x100000000;
}

// ── STRINGS ──────────────────────────────────────────────────
// 8 partials at natural harmonic ratios, pairs detuned ±cents for ensemble width.
// Slow bow-attack, long sustain, gradual fade.
function _strings(ctx, freq, dest, rng, atk, dur, nodes) {
    const now = ctx.currentTime;
    const bus = ctx.createGain();
    bus.gain.setValueAtTime(0, now);
    bus.gain.linearRampToValueAtTime(0.22, now + atk);
    bus.gain.setValueAtTime(0.22, now + atk + dur * 0.7);
    bus.gain.linearRampToValueAtTime(0, now + atk + dur);
    bus.connect(dest);
    pushTransientNodes(nodes, atk + dur + 0.2, bus);

    // 8 partials: fundamental + 7 harmonics
    const partialAmps = [1, 0.6, 0.4, 0.25, 0.15, 0.10, 0.07, 0.04];
    partialAmps.forEach((amp, h) => {
        const ratio = h + 1;
        // Pair: one slightly sharp, one slightly flat — creates ensemble shimmer
        [-1, 1].forEach(sign => {
            const detuneCents = sign * rng.range(3, 12);
            const f = freq * ratio * Math.pow(2, detuneCents / 1200);
            const o = ctx.createOscillator();
            const g = ctx.createGain();
            o.type = 'sawtooth';
            o.frequency.value = f;
            g.gain.value = (amp / 2) * 0.018;
            o.connect(g); g.connect(bus);
            o.start(now); o.stop(now + atk + dur + 0.1);
            nodes.push(o, g);
        });
    });
}

// ── CHOIR ─────────────────────────────────────────────────────
// Vowel 'ah' formant filter bank (F1–F5) over a sawtooth source.
// Slight per-voice detuning gives a small-choir feel.
function _choir(ctx, freq, dest, rng, atk, dur, nodes) {
    const now = ctx.currentTime;
    // 'Ah' vowel formant frequencies & bandwidths (Hz)
    const formants = [
        { f: 800, bw: 80, gain: 1.0 },
        { f: 1200, bw: 90, gain: 0.7 },
        { f: 2500, bw: 120, gain: 0.5 },
        { f: 3500, bw: 180, gain: 0.25 },
        { f: 4500, bw: 200, gain: 0.12 },
    ];

    // 3 voice spread: -10¢, 0¢, +10¢
    [-10, 0, 10].forEach((detuneCents, vi) => {
        const f = freq * Math.pow(2, detuneCents / 1200);
        const src = ctx.createOscillator();
        src.type = 'sawtooth';
        src.frequency.value = f;
        // Slow pitch shimmer
        const vibLfo = ctx.createOscillator();
        const vibG = ctx.createGain();
        vibLfo.frequency.value = 4.5 + vi * 0.3;
        vibG.gain.value = freq * 0.003;
        vibLfo.connect(vibG); vibG.connect(src.frequency);
        vibLfo.start(now); vibLfo.stop(now + atk + dur + 0.2);

        const voiceBus = ctx.createGain();
        voiceBus.gain.setValueAtTime(0, now);
        voiceBus.gain.linearRampToValueAtTime(0.09, now + atk * 1.2);
        voiceBus.gain.linearRampToValueAtTime(0, now + atk + dur);
        nodes.push(src, vibLfo, vibG, voiceBus);

        formants.forEach(fm => {
            const filt = ctx.createBiquadFilter();
            const nyquist = ctx.sampleRate / 2;
            filt.type = 'bandpass';
            filt.frequency.value = Math.min(fm.f, nyquist - 200);
            filt.Q.value = fm.f / fm.bw;
            const fg = ctx.createGain();
            fg.gain.value = fm.gain;
            src.connect(filt); filt.connect(fg); fg.connect(voiceBus);
            pushTransientNodes(nodes, atk + dur + 0.3, filt, fg);
        });

        voiceBus.connect(dest);
        src.start(now); src.stop(now + atk + dur + 0.2);
    });
}

// ── MARIMBA ───────────────────────────────────────────────────
// Inharmonic partials of real marimba bars (×1, ×3.734, ×9.098).
// Very fast attack, exponential decay.
function _marimba(ctx, freq, dest, rng, atk, dur, nodes) {
    const now = ctx.currentTime;
    const partials = [
        { ratio: 1, amp: 1.0, decay: 0.65 },
        { ratio: 3.734, amp: 0.35, decay: 0.28 },
        { ratio: 9.098, amp: 0.15, decay: 0.14 },
    ];
    const totalDur = Math.min(dur, rng.range(0.5, 2.5));

    partials.forEach(p => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'sine';
        o.frequency.value = freq * p.ratio;
        g.gain.setValueAtTime(p.amp * 0.22, now);
        g.gain.exponentialRampToValueAtTime(0.0001, now + totalDur * p.decay);
        o.connect(g); g.connect(dest);
        o.start(now); o.stop(now + totalDur + 0.05);
        nodes.push(o, g);
    });
}

// ── METALLIC ──────────────────────────────────────────────────
// Prime-number partial ratios → naturally inharmonic bell-like ring.
// Long decay, stereo spread.
function _metallic(ctx, freq, dest, rng, atk, dur, nodes) {
    const now = ctx.currentTime;
    // Partials based on vibrating metal plate modes (Chladni patterns)
    const partials = [
        { ratio: 1, amp: 1.0 },
        { ratio: 2.756, amp: 0.6 },
        { ratio: 5.404, amp: 0.35 },
        { ratio: 8.933, amp: 0.2 },
        { ratio: 13.34, amp: 0.1 },
    ];
    const ringDur = rng.range(3, 10);

    partials.forEach((p, i) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        const pan = ctx.createStereoPanner();
        o.type = 'sine';
        o.frequency.value = freq * p.ratio;
        pan.pan.value = rng.range(-0.6, 0.6);
        g.gain.setValueAtTime(0, now);
        g.gain.linearRampToValueAtTime(p.amp * 0.16, now + 0.008);
        g.gain.exponentialRampToValueAtTime(0.0001, now + ringDur * (1 - i * 0.12));
        o.connect(g); g.connect(pan); pan.connect(dest);
        o.start(now); o.stop(now + ringDur + 0.1);
        nodes.push(o, g, pan);
    });
}

// ── THEREMIN ──────────────────────────────────────────────────
// Pure sine + slow vibrato LFO. Glide frequency from prev-ish using
// exponential ramp for the signature eerie portamento.
function _theremin(ctx, freq, dest, rng, atk, dur, nodes) {
    const now = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';

    // Glide from ±semitone to target
    const startFreq = freq * Math.pow(2, rng.range(-2, 2) / 12);
    o.frequency.setValueAtTime(startFreq, now);
    o.frequency.exponentialRampToValueAtTime(freq, now + atk * 0.6);

    // Vibrato: slow, wide (~25¢)
    const vib = ctx.createOscillator();
    const vibG = ctx.createGain();
    vib.frequency.value = 4.8 + rng.range(-0.5, 0.5);
    vibG.gain.setValueAtTime(0, now);
    vibG.gain.linearRampToValueAtTime(freq * 0.014, now + atk * 0.5);
    vib.connect(vibG); vibG.connect(o.frequency);
    vib.start(now); vib.stop(now + atk + dur + 0.1);

    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(0.28, now + atk);
    g.gain.linearRampToValueAtTime(0, now + atk + dur);

    o.connect(g); g.connect(dest);
    o.start(now); o.stop(now + atk + dur + 0.15);
    nodes.push(o, g, vib, vibG);
}

// ── SUBPAD ────────────────────────────────────────────────────
// 3 sine oscillators within ±4 cents of each other → thick beating sub cluster.
// Very slow attack, ultra-low register — sits under everything else.
function _subpad(ctx, freq, dest, rng, atk, dur, nodes) {
    const now = ctx.currentTime;
    const subFreq = freq * 0.5; // Drop an octave into sub territory
    const bus = ctx.createGain();
    bus.gain.setValueAtTime(0, now);
    bus.gain.linearRampToValueAtTime(0.35, now + Math.max(atk, 6));
    bus.gain.setValueAtTime(0.35, now + atk + dur * 0.6);
    bus.gain.linearRampToValueAtTime(0, now + atk + dur);
    bus.connect(dest);
    pushTransientNodes(nodes, atk + dur + 0.3, bus);

    [-4, 0, 4].forEach(cents => {
        const o = ctx.createOscillator();
        o.type = 'sine';
        o.frequency.value = subFreq * Math.pow(2, cents / 1200);
        const g = ctx.createGain();
        g.gain.value = 0.33;
        o.connect(g); g.connect(bus);
        o.start(now); o.stop(now + atk + dur + 0.2);
        nodes.push(o, g);
    });
}

// ── CRYSTAL CHIMES ────────────────────────────────────────────
function _crystal_chimes(ctx, freq, dest, rng, atk, dur, nodes) {
    const now = ctx.currentTime;
    const partials = [
        { ratio: 1, amp: 1.0, decay: 1.0 },
        { ratio: 2.76, amp: 0.7, decay: 0.8 },
        { ratio: 5.4, amp: 0.45, decay: 0.6 },
        { ratio: 8.93, amp: 0.25, decay: 0.4 },
        { ratio: 13.34, amp: 0.1, decay: 0.2 },
        { ratio: 18.64, amp: 0.05, decay: 0.1 }
    ];
    const baseFreq = freq < 1000 ? freq * 4 : freq;
    const ringDur = rng.range(6, 15);

    partials.forEach((p) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        const pan = ctx.createStereoPanner();
        o.type = 'sine';
        const detune = rng.range(-5, 5);
        o.frequency.value = baseFreq * p.ratio * Math.pow(2, detune / 1200);

        pan.pan.value = rng.range(-0.8, 0.8);

        g.gain.setValueAtTime(0, now);
        g.gain.linearRampToValueAtTime(p.amp * 0.1, now + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, now + (ringDur * p.decay));

        o.connect(g); g.connect(pan); pan.connect(dest);
        o.start(now); o.stop(now + ringDur + 0.5);
        nodes.push(o, g, pan);
    });
}

// ── BRASS PAD ──────────────────────────────────────────────────
function _brass_pad(ctx, freq, dest, rng, atk, dur, nodes) {
    const now = ctx.currentTime;
    const bus = ctx.createGain();

    const swellAtk = Math.max(atk, 1.5);
    bus.gain.setValueAtTime(0, now);
    bus.gain.linearRampToValueAtTime(0.2, now + swellAtk);
    bus.gain.linearRampToValueAtTime(0, now + swellAtk + dur);
    bus.connect(dest);
    pushTransientNodes(nodes, swellAtk + dur + 0.6, bus);

    const filt = ctx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.setValueAtTime(freq * 1.5, now);
    filt.frequency.exponentialRampToValueAtTime(freq * 8, now + swellAtk);
    filt.frequency.exponentialRampToValueAtTime(freq * 1.5, now + swellAtk + dur);
    filt.Q.value = 1.2;
    filt.connect(bus);
    pushTransientNodes(nodes, swellAtk + dur + 0.6, filt);

    [-8, -2, 2, 8].forEach((cents) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'sawtooth';
        o.frequency.value = freq * Math.pow(2, cents / 1200);

        g.gain.setValueAtTime(0, now);
        const stagger = (Math.abs(cents) / 8) * 0.3;
        g.gain.linearRampToValueAtTime(0.25, now + swellAtk + stagger);

        o.connect(g); g.connect(filt);
        o.start(now); o.stop(now + swellAtk + dur + 0.5);
        nodes.push(o, g);
    });
}

// ── HOLLOW PIPE ────────────────────────────────────────────────
function _hollow_pipe(ctx, freq, dest, rng, atk, dur, nodes) {
    const now = ctx.currentTime;
    const bus = ctx.createGain();
    bus.gain.setValueAtTime(0, now);
    bus.gain.linearRampToValueAtTime(0.18, now + atk * 0.5);
    bus.gain.linearRampToValueAtTime(0, now + atk + dur);
    bus.connect(dest);
    pushTransientNodes(nodes, atk + dur + 0.2, bus);

    [1, 3, 5].forEach((ratio, i) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'sine';
        o.frequency.value = freq * ratio;
        g.gain.value = [1.0, 0.15, 0.05][i];

        if (i === 0) {
            o.frequency.setValueAtTime(freq * 1.05, now);
            o.frequency.exponentialRampToValueAtTime(freq, now + 0.08);
        }

        o.connect(g); g.connect(bus);
        o.start(now); o.stop(now + atk + dur + 0.1);
        nodes.push(o, g);
    });

    if (ctx.sampleRate) {
        const bufSize = ctx.sampleRate * 0.5;
        const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < bufSize; i++) d[i] = (nextVoiceRandom(rng) * 2) - 1;

        const noiseSrc = ctx.createBufferSource();
        noiseSrc.buffer = buf;
        noiseSrc.loop = true;

        const noiseFilt = ctx.createBiquadFilter();
        noiseFilt.type = 'bandpass';
        noiseFilt.frequency.value = freq * 2;
        noiseFilt.Q.value = 2;

        const noiseG = ctx.createGain();
        noiseG.gain.setValueAtTime(0, now);
        noiseG.gain.linearRampToValueAtTime(0.08, now + 0.05);
        noiseG.gain.linearRampToValueAtTime(0.01, now + 0.2);
        noiseG.gain.linearRampToValueAtTime(0, now + atk + dur);

        noiseSrc.connect(noiseFilt); noiseFilt.connect(noiseG); noiseG.connect(bus);
        noiseSrc.start(now); noiseSrc.stop(now + atk + dur + 0.1);
        nodes.push(noiseSrc, noiseFilt, noiseG);
    }
}

// ── GONG ───────────────────────────────────────────────────────
function _gong(ctx, freq, dest, rng, atk, dur, nodes) {
    const now = ctx.currentTime;
    const partials = [0.5, 1, 1.16, 1.34, 1.72, 2.0, 2.45, 3.2, 4.1];
    const tailDur = rng.range(8, 20);

    const filt = ctx.createBiquadFilter();
    const nyquist = ctx.sampleRate / 2;
    filt.type = 'lowpass';
    filt.frequency.setValueAtTime(Math.min(200, nyquist - 200), now);
    filt.frequency.exponentialRampToValueAtTime(Math.min(freq * 10, nyquist - 200), now + 0.1);
    filt.frequency.exponentialRampToValueAtTime(Math.min(300, nyquist - 200), now + tailDur);
    filt.connect(dest);
    pushTransientNodes(nodes, tailDur + 0.6, filt);

    partials.forEach((ratio) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'sine';
        o.frequency.value = freq * ratio;

        const pan = ctx.createStereoPanner();
        pan.pan.value = rng.range(-0.5, 0.5);

        g.gain.setValueAtTime(0, now);
        g.gain.linearRampToValueAtTime(0.05 / partials.length, now + 0.05 + rng.range(0, 0.2));
        g.gain.exponentialRampToValueAtTime(0.0001, now + tailDur * rng.range(0.4, 1.0));

        o.connect(g); g.connect(pan); pan.connect(filt);
        o.start(now); o.stop(now + tailDur + 0.5);
        nodes.push(o, g, pan);
    });
}

// ── VOWEL MORPH ────────────────────────────────────────────────
function _vowel_morph(ctx, freq, dest, rng, atk, dur, nodes) {
    const now = ctx.currentTime;

    const coreBus = ctx.createGain();
    coreBus.gain.value = 0.5;

    [-12, -4, 4, 12].forEach(cents => {
        const o = ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = freq * Math.pow(2, cents / 1200);
        o.connect(coreBus);
        o.start(now); o.stop(now + atk + dur + 0.5);
        nodes.push(o);
    });

    const formants = [
        { f1: 730, f2: 300, f3: 270, bw: 80, amp: 1.0 },
        { f1: 1090, f2: 870, f3: 2290, bw: 100, amp: 0.6 },
        { f1: 2440, f2: 2240, f3: 3010, bw: 120, amp: 0.3 }
    ];

    const outBus = ctx.createGain();
    outBus.gain.setValueAtTime(0, now);
    outBus.gain.linearRampToValueAtTime(0.12, now + Math.max(atk, 2.0));
    outBus.gain.linearRampToValueAtTime(0, now + atk + dur);
    outBus.connect(dest);
    pushTransientNodes(nodes, atk + dur + 0.6, coreBus, outBus);

    formants.forEach(fm => {
        const filt = ctx.createBiquadFilter();
        const nyquist = ctx.sampleRate / 2;
        filt.type = 'bandpass';

        filt.frequency.setValueAtTime(Math.min(fm.f1, nyquist - 200), now);
        filt.frequency.exponentialRampToValueAtTime(Math.min(fm.f2, nyquist - 200), now + (atk + dur) * 0.4);
        filt.frequency.exponentialRampToValueAtTime(Math.min(fm.f3, nyquist - 200), now + (atk + dur) * 0.8);

        filt.Q.value = 10;

        const g = ctx.createGain();
        g.gain.value = fm.amp;

        coreBus.connect(filt);
        filt.connect(g);
        g.connect(outBus);
        pushTransientNodes(nodes, atk + dur + 0.6, filt, g);
    });
}

// ── BOWED METAL ────────────────────────────────────────────────
// Physical modeling via Karplus-Strong / waveguide
function _bowed_metal(ctx, freq, dest, rng, atk, dur, nodes) {
    const now = ctx.currentTime;

    // Noise burst exciter
    const noise = ctx.createBufferSource();
    const bufSize = ctx.sampleRate * 0.1; // Short burst buffer
    const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) d[i] = (nextVoiceRandom(rng) * 2) - 1;
    noise.buffer = buf;
    noise.loop = true;

    const exciterEnv = ctx.createGain();
    exciterEnv.gain.setValueAtTime(0, now);
    exciterEnv.gain.linearRampToValueAtTime(0.5, now + 0.01);
    exciterEnv.gain.exponentialRampToValueAtTime(0.001, now + 0.07);

    // Delay line (resonator)
    const delay = ctx.createDelay();
    delay.delayTime.value = 1 / freq;

    // Feedback loop with lowpass filter and safety limiter
    const feedback = ctx.createGain();
    feedback.gain.value = 0.8; // User requested 0.8 for safety

    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -1.0;
    limiter.knee.value = 0;
    limiter.ratio.value = 20;
    limiter.attack.value = 0.001;
    limiter.release.value = 0.05;

    const damping = ctx.createBiquadFilter();
    damping.type = 'lowpass';
    const nyquist = ctx.sampleRate / 2;
    // Strict clamp for Karplus-Strong feedback filter
    damping.frequency.value = Math.min(freq * rng.range(3, 6), nyquist - 500);

    // Enveloped out to prevent eternal ringing and pop
    const outEnv = ctx.createGain();
    outEnv.gain.setValueAtTime(0, now);
    outEnv.gain.linearRampToValueAtTime(0.4, now + atk);
    outEnv.gain.exponentialRampToValueAtTime(0.001, now + atk + dur);

    noise.connect(exciterEnv); exciterEnv.connect(delay);

    // Loop: Delay -> Damping -> Limiter -> Feedback -> Delay
    delay.connect(damping); damping.connect(limiter); limiter.connect(feedback); feedback.connect(delay);
    delay.connect(outEnv); outEnv.connect(dest);

    noise.start(now); noise.stop(now + 1.0);

    nodes.push(noise, exciterEnv, delay, damping, limiter, feedback, outEnv);
}

// ── DRONE MORPH ────────────────────────────────────────────────
// Dual wavetable-esque oscillators crossfading slowly
function _drone_morph(ctx, freq, dest, rng, atk, dur, nodes) {
    const now = ctx.currentTime;
    const outBus = ctx.createGain();
    outBus.gain.setValueAtTime(0, now);
    outBus.gain.linearRampToValueAtTime(0.35, now + atk);
    outBus.gain.linearRampToValueAtTime(0, now + atk + dur);
    outBus.connect(dest);
    pushTransientNodes(nodes, atk + dur + 0.6, outBus);

    const o1 = ctx.createOscillator(), o2 = ctx.createOscillator();
    o1.type = rng.pick(['sawtooth', 'triangle']);
    o2.type = rng.pick(['square', 'sine']);
    o1.frequency.value = freq;
    o2.frequency.value = freq * Math.pow(2, rng.pick([-12, 0, 7, 12]) / 12);

    const g1 = ctx.createGain(), g2 = ctx.createGain();
    g1.gain.value = 0.5; g2.gain.value = 0.5;

    // LFO for slow crossfade morph
    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = rng.range(0.05, 0.2);

    const lfoG1 = ctx.createGain(); lfoG1.gain.value = 0.5;
    const lfoG2 = ctx.createGain(); lfoG2.gain.value = -0.5;

    lfo.connect(lfoG1); lfoG1.connect(g1.gain);
    lfo.connect(lfoG2); lfoG2.connect(g2.gain);

    o1.connect(g1); g1.connect(outBus);
    o2.connect(g2); g2.connect(outBus);

    o1.start(now); o2.start(now); lfo.start(now);
    o1.stop(now + atk + dur + 0.5); o2.stop(now + atk + dur + 0.5); lfo.stop(now + atk + dur + 0.5);

    nodes.push(o1, o2, g1, g2, lfo, lfoG1, lfoG2);
}

// ── GRANULAR CLOUD ─────────────────────────────────────────────
// Synthesized pitched grains distributed randomly across the duration
function _granular_cloud(ctx, freq, dest, rng, atk, dur, nodes) {
    const now = ctx.currentTime;
    const outBus = ctx.createGain();
    outBus.gain.setValueAtTime(0, now);
    outBus.gain.linearRampToValueAtTime(0.25, now + atk);
    outBus.gain.linearRampToValueAtTime(0, now + atk + dur);
    outBus.connect(dest);
    pushTransientNodes(nodes, atk + dur + 0.2, outBus);

    const totalDur = atk + dur;
    const nodeLoad = getNodeLoad(nodes);
    const loadPressure = Math.max(0, Math.min(1, (nodeLoad - 220) / 220));
    const density = rng.range(6, 12) * (1 - loadPressure * 0.55);
    const grainCap = loadPressure > 0.55 ? 18 : 36;
    const totalGrains = Math.max(8, Math.min(grainCap, Math.floor(totalDur * density)));

    for (let i = 0; i < totalGrains; i++) {
        const grainTime = now + rng.range(0, totalDur);
        const gFreq = freq * Math.pow(2, rng.pick([0, 0, 7, 12, 19, 24]) / 12);
        const detuneCents = rng.range(-20, 20);

        const o = ctx.createOscillator();
        const g = ctx.createGain();
        const pan = ctx.createStereoPanner();

        o.type = 'sine';
        o.frequency.value = gFreq * Math.pow(2, detuneCents / 1200);
        pan.pan.value = rng.range(-1, 1);

        // Very short grain envelope: 30-80ms
        const gDur = rng.range(0.03, 0.08);
        g.gain.setValueAtTime(0, grainTime);
        g.gain.linearRampToValueAtTime(0.4, grainTime + gDur / 2);
        g.gain.linearRampToValueAtTime(0, grainTime + gDur);

        o.connect(g); g.connect(pan); pan.connect(outBus);
        o.start(grainTime); o.stop(grainTime + gDur + 0.01);
        nodes.push(o, g, pan);
    }
}

