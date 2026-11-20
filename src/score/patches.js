// Pixel's instruments (the hyperpop and electro universe, after
// Ninajirachi). Each format has its own set and no patch is shared between
// formats, so a station of one never borrows the sound of another. They are
// all synthesized (src/engine/voices.js: MorphVoice, VoxVoice, ChipVoice and
// the seven-saw pad), so they need nothing from the sample pack.
//
// A patch is an event template; instrumentEvent (src/score/lanes.js) scales
// its gain by the lane's level and, where `vel` is set, by the velocity.

// the switching bass voice
const morph = (gain, p) => ({ type: 'morph', layer: 'bass', vel: true, reverb: 0.06, echo: 0.04, attack: 0.002, release: 0.04, ...p, gain });
// a sung syllable for the chops
const vox = (gain, p) => ({ type: 'vox', layer: 'vox', vel: true, reverb: 0.4, echo: 0.3, attack: 0.006, release: 0.06, ...p, gain });
// the chip voices
const chip = (gain, p) => ({ type: 'chip', layer: 'lead', vel: true, reverb: 0.3, echo: 0.35, release: 0.04, ...p, gain });
// seven detuned saws (a supersaw), as stab, gate, lead or pad
const saw7 = (gain, p) => ({ type: 'pad', layer: 'stab', preset: 'warm', vel: true, oscs: 7, detune: 26, attack: 0.003, dur: 0.12, release: 0.2, wow: 0, q: 0.9, reverb: 0.35, echo: 0.2, ...p, gain });

export const PATCHES = {
    // ---------------------------------------------------------- Complextro
    // three sets of four patches that the bass switches between
    cx_growl: morph(0.11, { saw: 1, detune: 12, fm: 2, ratio: 1, fmDecay: 0.3, filter: 'vowel', vowels: ['o', 'a'], morph: 0.15, envAmt: 0.3, decay: 0.1, drive: 1, sub: 0.3 }),
    cx_square: morph(0.1, { saw: 0, pulse: 1, filter: 'lp', cutoff: 300, envAmt: 8, decay: 0.08, q: 3, drive: 0.8, sub: 0.4 }),
    cx_fm: morph(0.1, { saw: 0, fm: 4, ratio: 2, fmDecay: 0.12, filter: 'none', drive: 0.6, sub: 0.25 }),
    cx_laser: morph(0.08, { saw: 1, pitch: 24, pitchDecay: 0.04, filter: 'lp', cutoff: 2000, q: 2, drive: 0.7, sub: 0.2 }),
    cx_yoi: morph(0.11, { saw: 1, detune: 8, filter: 'vowel', vowels: ['u', 'a', 'i'], morph: 0.12, drive: 1.2, sub: 0.35 }),
    cx_saw: morph(0.1, { saw: 1, detune: 20, filter: 'lp', cutoff: 900, envAmt: 4, decay: 0.1, q: 1.5, drive: 1, sub: 0.3 }),
    cx_wob: morph(0.11, { saw: 0.6, pulse: 0.5, filter: 'lp', cutoff: 260, lfo: 9, lfoAmt: 2.5, q: 4, drive: 0.9, sub: 0.3 }),
    cx_fold: morph(0.08, { saw: 0, sine: 1, fold: 1.2, filter: 'lp', cutoff: 4000, drive: 0.5, sub: 0.25 }),
    cx_reese: morph(0.1, { saw: 1, detune: 25, filter: 'lp', cutoff: 600, q: 1.2, drive: 1.1, sub: 0.4 }),
    cx_bark: morph(0.1, { saw: 0.5, fm: 6, ratio: 1.5, fmDecay: 0.06, filter: 'bp', cutoff: 900, envAmt: 3, decay: 0.08, q: 3, drive: 1.2, sub: 0.3 }),
    cx_pulse: morph(0.09, { saw: 0, pulse: 1, pw: 0.2, filter: 'lp', cutoff: 1800, q: 1, crush: 3, bits: 6, drive: 0.5, sub: 0.4 }),
    cx_zap: morph(0.08, { saw: 0, sine: 1, pitch: 36, pitchDecay: 0.025, fm: 1, ratio: 3, filter: 'none', drive: 1, sub: 0.2 }),
    // electro-house stabs
    cx_stab: saw7(0.06, { detune: 30, cutoff: 4200, filterEnv: 1.2 }),
    cx_brass: morph(0.07, { layer: 'stab', saw: 1, detune: 15, pulse: 0.5, filter: 'lp', cutoff: 1500, envAmt: 3, decay: 0.12, q: 1.2, drive: 0.5, release: 0.12, reverb: 0.3, echo: 0.25 }),
    cx_organ: morph(0.06, { layer: 'stab', saw: 0, sine: 0.7, fm: 1.4, ratio: 2, fmDecay: 0.2, filter: 'lp', cutoff: 3500, release: 0.1, reverb: 0.35, echo: 0.3 }),
    // the hook over the top
    cx_lead: morph(0.102, { layer: 'lead', saw: 0.6, detune: 10, pulse: 0.6, filter: 'lp', cutoff: 3200, q: 1.2, glide: 0.04, release: 0.1, drive: 0.4, reverb: 0.35, echo: 0.35 }),
    cx_chip: chip(0.085, { duty: 0.25, vibrato: 20, vibDelay: 0.12 }),
    cx_pluck: morph(0.119, { layer: 'lead', saw: 1, detune: 9, filter: 'lp', cutoff: 700, envAmt: 8, decay: 0.12, q: 1.6, release: 0.15, reverb: 0.45, echo: 0.45 }),
    cx_vox: vox(0.135, { shift: 1.15 }),
    cx_voxlo: vox(0.135, { shift: 0.95, drive: 0.6 }),
    cx_voxair: vox(0.24, { shift: 1.05, breath: 0.25, tilt: 3200 }),

    // ----------------------------------------------------------- Bubblegum
    // rubbery, bouncy basses (bubblegum bass, PC Music)
    bg_rubber: morph(0.12, { saw: 0, sine: 1, pitch: 12, pitchDecay: 0.03, filter: 'none', drive: 1.4, release: 0.08 }),
    bg_squish: morph(0.11, { saw: 0.5, sine: 0.5, filter: 'vowel', vowels: ['u', 'i'], morph: 0.08, drive: 0.8, sub: 0.4 }),
    bg_gum: morph(0.1, { saw: 0, pulse: 1, pw: 0.3, filter: 'lp', cutoff: 500, envAmt: 6, decay: 0.06, q: 5, sub: 0.5, drive: 0.4 }),
    // latex: drips, bloops and snaps (SOPHIE)
    bg_latex: morph(0.09, { layer: 'keys', saw: 0, sine: 1, pitch: 19, pitchDecay: 0.02, filter: 'none', dur: 0.06, release: 0.05, reverb: 0.3, echo: 0.3 }),
    bg_drip: morph(0.08, { layer: 'keys', saw: 0, sine: 1, fm: 1.5, ratio: 1, fmDecay: 0.04, pitch: -12, pitchDecay: 0.03, filter: 'none', dur: 0.05, release: 0.06, reverb: 0.3, echo: 0.35 }),
    bg_snap: morph(0.06, { layer: 'keys', saw: 0, fm: 8, ratio: 3.5, fmDecay: 0.012, filter: 'none', dur: 0.03, release: 0.05, reverb: 0.35, echo: 0.3 }),
    // pitched-up chops
    bg_chip: vox(0.135, { shift: 1.35 }),
    bg_baby: vox(0.255, { shift: 1.5, breath: 0.1, tilt: 4000 }),
    bg_kawaii: vox(0.0975, { shift: 1.25, vibrato: 30, vibDelay: 0.08 }),
    // sugar on top
    bg_saw: saw7(0.085, { layer: 'lead', detune: 18, cutoff: 6000, attack: 0.005, dur: 0.2, release: 0.15, reverb: 0.4, echo: 0.3 }),
    bg_bell: morph(0.1, { layer: 'bells', saw: 0, sine: 0.6, fm: 2.5, ratio: 3.5, fmDecay: 0.4, filter: 'none', dur: 0.05, release: 0.6, reverb: 0.5, echo: 0.35 }),
    bg_flute: chip(0.102, { tri: true, vibrato: 25, vibDelay: 0.1, glide: 0.03 }),
    bg_clang: morph(0.05, { layer: 'ticks', saw: 0, fm: 9, ratio: 1.414, fmDecay: 0.08, filter: 'bp', cutoff: 3000, q: 1.2, dur: 0.04, release: 0.12, reverb: 0.4, echo: 0.3 }),
    bg_ting: morph(0.12, { layer: 'ticks', saw: 0, sine: 0.5, fm: 5, ratio: 2.76, fmDecay: 0.15, filter: 'none', dur: 0.02, release: 0.3, reverb: 0.45, echo: 0.3 }),
    bg_chords: saw7(0.045, { layer: 'pad', detune: 22, cutoff: 3200, attack: 0.01, dur: 0.3, release: 0.25 }),
    bg_keys: morph(0.05, { layer: 'pad', saw: 0, sine: 0.7, fm: 1.2, ratio: 1, fmDecay: 0.3, filter: 'none', release: 0.3, reverb: 0.4, echo: 0.25 }),

    // ----------------------------------------------------------- Bloghouse
    // fuzzed electro basses (Justice, MSTRKRFT, Crystal Castles)
    bh_fuzz: morph(0.1, { saw: 1, detune: 10, pulse: 0.5, filter: 'lp', cutoff: 700, envAmt: 3, decay: 0.15, q: 1.3, drive: 2, sub: 0.3 }),
    bh_buzz: morph(0.09, { saw: 0, pulse: 1, pw: 0.125, filter: 'lp', cutoff: 1400, q: 1, crush: 2, bits: 5, drive: 1.2, sub: 0.35 }),
    bh_hum: morph(0.1, { saw: 1, filter: 'vowel', vowels: ['o', 'a'], morph: 0.2, drive: 1.5, sub: 0.35 }),
    // Atari leads
    bh_atari: chip(0.085, { duty: 0.5, vibrato: 15, cutoff: 6000 }),
    bh_nes: chip(0.085, { duty: 0.125, vibrato: 10, cutoff: 7000 }),
    bh_tri: chip(0.119, { tri: true, vibrato: 18 }),
    bh_arp: chip(0.068, { duty: 0.25, arpRate: 24, cutoff: 5000 }),
    bh_arp2: chip(0.068, { duty: 0.5, arpRate: 16, cutoff: 4000 }),
    // deadpan, robotic vocals
    bh_robot: vox(0.12, { shift: 0.9, crush: 2, bits: 6, drive: 0.6, breath: 0.02 }),
    bh_deadpan: vox(0.3, { shift: 1, tilt: 1800, breath: 0.04 }),
    // a filtered disco stab and an organ
    bh_disco: saw7(0.06, { oscs: 3, detune: 8, cutoff: 2000, filterEnv: 2, q: 1.3, release: 0.25 }),
    bh_organ: morph(0.12, { layer: 'stab', saw: 0, sine: 0.6, pulse: 0.4, filter: 'lp', cutoff: 2500, release: 0.08, reverb: 0.3, echo: 0.3 }),

    // ------------------------------------------------------------- Trance
    // rolling basses
    tr_roll: morph(0.11, { saw: 1, filter: 'lp', cutoff: 500, envAmt: 5, decay: 0.07, q: 1.4, sub: 0.4, drive: 0.4 }),
    tr_rollsq: morph(0.1, { saw: 0, pulse: 1, filter: 'lp', cutoff: 400, envAmt: 6, decay: 0.06, q: 1.2, sub: 0.5, drive: 0.3 }),
    tr_rollfm: morph(0.1, { saw: 0, sine: 0.6, fm: 2, ratio: 1, fmDecay: 0.05, filter: 'none', sub: 0.3, drive: 0.4 }),
    // gated supersaws
    tr_gate: saw7(0.05, { oscs: 5, detune: 32, cutoff: 5000, attack: 0.002, dur: 0.07, release: 0.05, reverb: 0.5, echo: 0.25 }),
    tr_gatesoft: saw7(0.055, { oscs: 5, detune: 22, cutoff: 2600, attack: 0.002, dur: 0.07, release: 0.06, reverb: 0.55, echo: 0.25 }),
    // the anthem lead and the plucks
    tr_lead: saw7(0.068, { layer: 'lead', detune: 16, cutoff: 7000, attack: 0.01, dur: 0.3, release: 0.3, reverb: 0.6, echo: 0.4 }),
    tr_pluck: morph(0.111, { layer: 'lead', saw: 1, detune: 12, filter: 'lp', cutoff: 900, envAmt: 7, decay: 0.15, q: 1.3, release: 0.2, reverb: 0.55, echo: 0.5 }),
    tr_arp: morph(0.05, { layer: 'keys', saw: 0, pulse: 1, pw: 0.35, filter: 'lp', cutoff: 1200, envAmt: 5, decay: 0.08, release: 0.08, reverb: 0.5, echo: 0.5 }),
    tr_bellarp: morph(0.055, { layer: 'keys', saw: 0, sine: 0.5, fm: 2, ratio: 4, fmDecay: 0.15, filter: 'none', release: 0.15, reverb: 0.5, echo: 0.5 }),
    tr_ah: vox(0.27, { vowels: ['a'], vibrato: 25, shift: 1.05, reverb: 0.8, echo: 0.4, attack: 0.08, release: 0.5 }),
    tr_oh: vox(0.18, { vowels: ['o', 'a'], vibrato: 20, shift: 1.1, reverb: 0.8, echo: 0.4, attack: 0.06, release: 0.5 }),

    // ---------------------------------------------------------------- Roar
    // two sets of four, each wobbled at its own speed per note (Skrillex)
    rr_growl: morph(0.11, { saw: 1, detune: 10, fm: 3, ratio: 0.5, filter: 'vowel', vowels: ['o', 'a', 'u'], lfo: 2, drive: 1.5, sub: 0.3 }),
    rr_wob: morph(0.11, { saw: 0.7, pulse: 0.5, filter: 'lp', cutoff: 200, lfo: 2, lfoAmt: 3.5, q: 5, drive: 1.2, sub: 0.4 }),
    rr_yoi: morph(0.11, { saw: 1, filter: 'vowel', vowels: ['u', 'o', 'a', 'i'], lfo: 2, drive: 1.3, sub: 0.3 }),
    rr_screech: morph(0.07, { saw: 0.6, fm: 7, ratio: 2.01, filter: 'bp', cutoff: 1500, lfo: 2, lfoAmt: 1.5, q: 4, drive: 1.5, sub: 0.25 }),
    rr_tear: morph(0.1, { saw: 1, detune: 30, filter: 'lp', cutoff: 400, lfo: 2, lfoAmt: 3, lfoShape: 'saw', q: 3, drive: 2, sub: 0.35 }),
    rr_robot: morph(0.1, { saw: 0, pulse: 1, pw: 0.25, fm: 2, ratio: 1, filter: 'vowel', vowels: ['a', 'i'], lfo: 2, lfoShape: 'square', crush: 2, bits: 6, drive: 1, sub: 0.35 }),
    rr_metal: morph(0.08, { saw: 0.3, fm: 10, ratio: 1.414, filter: 'bp', cutoff: 1100, lfo: 2, lfoAmt: 2, q: 3, drive: 1.4, sub: 0.3 }),
    rr_gargle: morph(0.11, { saw: 1, detune: 6, filter: 'vowel', vowels: ['u', 'a'], lfo: 2, lfoShape: 'square', drive: 2, sub: 0.3 }),
    rr_scream: morph(0.085, { layer: 'lead', saw: 1, detune: 20, filter: 'lp', cutoff: 3000, q: 2, drive: 1.5, glide: 0.05, release: 0.12, reverb: 0.35, echo: 0.3 }),
    rr_siren: chip(0.0765, { duty: 0.5, vibrato: 80, vibDelay: 0.05, cutoff: 5000 }),
    rr_yeah: vox(0.105, { shift: 0.85, drive: 0.5 }),
    rr_shout: vox(0.112, { shift: 0.8, drive: 1.2, breath: 0.12 }),
    rr_pluck: morph(0.06, { layer: 'keys', saw: 1, detune: 7, filter: 'lp', cutoff: 1500, envAmt: 5, decay: 0.2, q: 1.2, release: 0.3, reverb: 0.6, echo: 0.45 }),
    rr_keys: morph(0.06, { layer: 'keys', saw: 0, sine: 0.6, fm: 1.5, ratio: 1, fmDecay: 0.25, filter: 'none', release: 0.4, reverb: 0.6, echo: 0.4 }),

    // -------------------------------------------------------------- Hazard
    // dark drum & bass basses
    hz_reese: morph(0.1, { saw: 1, detune: 28, filter: 'lp', cutoff: 500, q: 1.2, lfo: 0.3, lfoAmt: 0.6, drive: 1.3, sub: 0.45, release: 0.08 }),
    hz_neuro: morph(0.1, { saw: 0.6, fm: 4, ratio: 0.5, filter: 'vowel', vowels: ['u', 'o'], lfo: 1, drive: 1.6, sub: 0.35, release: 0.06 }),
    hz_sub: morph(0.12, { saw: 0.2, sine: 1, filter: 'lp', cutoff: 200, drive: 0.6, release: 0.08 }),
    // glitched voices
    hz_crushvox: vox(0.12, { shift: 1.2, crush: 4, bits: 4 }),
    hz_whisper: vox(0.225, { breath: 0.6, tilt: 1200, cons: 's', shift: 1.1 }),
    // the creepypasta music box
    hz_musicbox: morph(0.09, { layer: 'bells', saw: 0, sine: 0.4, fm: 3, ratio: 4, fmDecay: 0.3, filter: 'none', dur: 0.05, release: 0.8, reverb: 0.7, echo: 0.4 }),
    hz_glass: morph(0.08, { layer: 'bells', saw: 0, sine: 0.5, fm: 2, ratio: 7.1, fmDecay: 0.25, filter: 'none', dur: 0.05, release: 0.9, reverb: 0.75, echo: 0.4 }),
    // alarms
    hz_alarm: chip(0.06, { duty: 0.125, vibrato: 120, vibDelay: 0, cutoff: 5000, reverb: 0.4 }),
    hz_static: morph(0.05, { layer: 'texture', saw: 0, sine: 1, fold: 2, drive: 1, crush: 6, bits: 4, filter: 'lp', cutoff: 3000, reverb: 0.4, echo: 0.3 }),
};

// Syllables the vocal chops are cut from; a station strings a few of them
// into its own word.
export const SYLLABLES = [
    { vowels: ['a', 'i'] }, { vowels: ['o'], cons: 'n' }, { vowels: ['e', 'i'], cons: 'h' }, { vowels: ['a'], cons: 't' },
    { vowels: ['u', 'a'] }, { vowels: ['o', 'u'], cons: 's' }, { vowels: ['i'], cons: 'k' }, { vowels: ['e', 'a'], cons: 'n' },
    { vowels: ['a', 'o'] }, { vowels: ['y', 'e'], cons: 'h' }, { vowels: ['o', 'i'], cons: 't' }, { vowels: ['u'], cons: 'n' },
];

export function wordFor(rng, length = 4) {
    return Array.from({ length }, () => rng.pick(SYLLABLES));
}
