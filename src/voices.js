// ============================================================
// ADDITIVE SYNTH VOICES
// Each voice: buildVoice(name, ctx, freq, dest, rng, atk, dur, nodes)
// `nodes` is AudioEngine.nodes — push anything that needs cleanup.
// ============================================================

export const ADDITIVE_VOICE_NAMES = ['strings', 'choir', 'marimba', 'metallic', 'theremin', 'subpad'];

export function buildVoice(name, ctx, freq, dest, rng, atk, dur, nodes) {
    switch (name) {
        case 'strings': _strings(ctx, freq, dest, rng, atk, dur, nodes); break;
        case 'choir': _choir(ctx, freq, dest, rng, atk, dur, nodes); break;
        case 'marimba': _marimba(ctx, freq, dest, rng, atk, dur, nodes); break;
        case 'metallic': _metallic(ctx, freq, dest, rng, atk, dur, nodes); break;
        case 'theremin': _theremin(ctx, freq, dest, rng, atk, dur, nodes); break;
        case 'subpad': _subpad(ctx, freq, dest, rng, atk, dur, nodes); break;
    }
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
    nodes.push(bus);

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
            filt.type = 'bandpass';
            filt.frequency.value = fm.f;
            filt.Q.value = fm.f / fm.bw;
            const fg = ctx.createGain();
            fg.gain.value = fm.gain;
            src.connect(filt); filt.connect(fg); fg.connect(voiceBus);
            nodes.push(filt, fg);
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
    nodes.push(bus);

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
