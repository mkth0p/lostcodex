import {
    BeatLane, BedLane, DroneLane, LoopLane, OstinatoLane, PhraseLane, PulseLane, ResonantLane, WanderLane,
} from './score/lanes.js';
import { CycleLane, FigureLane, KitLane } from './score/figure.js';
import { ImpactLane, RiserLane, RollLane } from './score/song.js';

// A universe is a whole sound world: its scales, tuning, tempo, harmony
// pace, room, and the scenes it moves between. A code picks a station inside
// one universe; the numbers it draws (brightness, density, harshness) shade
// the scenes without leaving the world.

const LOOP_PERIODS = [17.3, 19.7, 23.1, 26.9, 29.3, 31.7, 37.1, 41.3];

// Deep and round like Basic Channel, but saturated with a short knock so it
// still reads on laptop and phone speakers.
const DUB_KICK = { tone: 1400, punch: 105, sweep: 0.045, decay: 0.6, click: 0.5, drive: 1.0 };
// A long 808 boom for the rain in Neon, and a tight, knocking one for Abyss.
const BOOM_KICK = { tone: 700, punch: 80, sweep: 0.05, decay: 0.85, click: 0.25, drive: 0.6 };
// Darksynth / industrial: hard, driven and short enough for broken patterns.
const HARD_KICK = { tone: 1600, punch: 140, sweep: 0.04, decay: 0.5, click: 0.6, drive: 1.2 };
const ELECTRO_KICK = { tone: 1100, punch: 120, sweep: 0.03, decay: 0.42, click: 0.45, drive: 0.5 };

function loops(scene, rng, instruments, { count = 5, octaves = {} } = {}) {
    const lanes = [];
    for (let i = 0; i < count; i++) {
        const instrument = instruments[i % instruments.length];
        lanes.push(new LoopLane(scene, rng.fork(`loop${i}`), {
            period: LOOP_PERIODS[(i * 3 + rng.int(0, 7)) % LOOP_PERIODS.length] * rng.range(0.92, 1.08),
            voice: i,
            octave: octaves[instrument] ?? (i === 0 ? -1 : 0),
            instrument,
        }));
    }
    return lanes;
}

// Techno: a long kick that rumbles in its own room. Trap: a short, hard
// knock, because the 808 carries the low end.
const RUMBLE_KICK = { tone: 1000, punch: 115, sweep: 0.04, decay: 0.7, click: 0.45, drive: 1.0, reverb: 0.22 };
const TRAP_KICK = { tone: 3200, punch: 170, sweep: 0.02, decay: 0.2, click: 0.8, drive: 0.6 };

// Every build-up: the snare roll, the riser, plus whatever the format adds.
const buildUp = (s, r, lanes) => [new RollLane(s, r.fork('roll')), new RiserLane(s, r.fork('riser')), ...lanes];

// A station's choice for one role of its format's palette (see paletteFor in
// src/score/piece.js). Now and then a section takes the station's second
// choice instead (`swap`), so hours in, the station still changes colour
// without losing its identity. A scene built for another format (the scene
// override in tests) gets that format's first option.
const PALETTES = {};
function role(p, r, format, name, swap = 0) {
    if (p.universe.formatId !== format) return PALETTES[format][name][0];
    return swap && r.chance(swap) ? p.paletteAlt[name] : p.palette[name];
}

// Neon is Night City, tuned like its radio: every station plays one format,
// each with its own tempo, key, sounds and song shape, after the Cyberpunk
// 2077 score (Polivoks, distortion "in all forms", '90s rave, IDM and
// industrial, nearly all in A minor) and the in-game stations (club techno,
// industrial, instrumental synth, hip-hop, laid-back ambient). Inside a
// format, every station draws its own instruments from the format's palette,
// most of them rendered from the V Collection on ju's PC. Scenes are named by
// role: rain (before the beat), build, drop and drive (two drops), break.
const NEON_FORMATS = [
    {
        id: 'rebel',
        label: 'Rebel',
        refs: 'Marcin Przybyłowicz, P.T. Adamczyk, Paul Leonard-Morgan',
        blurb: 'The score: a Polivoks bass, tribal drums and a bowed lead, distorted in every way. Always A minor.',
        modes: [['aeolian', 3], ['phrygian', 1]],
        tonic: [45, 45],
        bpm: [86, 96],
        swing: [0, 0.04],
        song: {},
        harmony: { holdMin: 24, holdMax: 60, pedalProb: 0.5, shapes: ['open', 'quartal', 'sus2'] },
        reverb: { t60: [4, 7], damping: [3500, 6000], size: 1.6 },
        echoBeats: 0.75,
        opening: ['rain'],
        palette: {
            bass: [{ ins: 'polivoks', gen: 'pump' }, { ins: 'ms20bass', gen: 'pump' }, { ins: 'matrixbass', gen: 'bass' }],
            lead: ['vcello', 'erhu', 'polilead'],
            pad: ['darkchoir', 'vocoder', 'jup8pad'],
            kit: [{ style: 'tribal', toms: 0.12 }, { style: 'breaks', toms: 0.06 }, { style: 'halfstep', toms: 0.1 }],
            hit: ['metalhit', 'lowhorn'],
        },
        scenes: {
            // a torn drone, the bowed lead far off, metal in the dark
            rain: { weight: 1, build: (s, r, p) => [
                new ImpactLane(s, r.fork('impact'), { kind: 'down' }),
                new DroneLane(s, r.fork('drone'), { fifth: true, gain: 0.045, cutoff: 600, detune: 18, drive: 0.6, attack: 5, sub: 0.07 }),
                new DroneLane(s, r.fork('pad'), { sample: role(p, r, 'rebel', 'pad', 0.3), octave: 1, upper: true, gain: 0.035, attack: 6, release: 6, cutoff: 1800, reverb: 0.7 }),
                new PhraseLane(s, r.fork('lead'), { bpm: p.bpm, instrument: role(p, r, 'rebel', 'lead', 0.3), lo: 50, hi: 74, rest: [4, 10], repeat: 0.6 }),
                new KitLane(s, r.fork('metal'), { style: 'tribal', kickGain: 0, clap: 0, hat: 0.02, perc: 0, metal: 0.05, toms: 0.05 }),
                new BedLane(s, r.fork('hum'), { gain: 0.02, tone: 3000, low: 400, crackle: 40 }),
            ] },
            build: { weight: 0, build: (s, r, p) => buildUp(s, r, [
                new FigureLane(s, r.fork('bass'), { gen: 'pump', instrument: role(p, r, 'rebel', 'bass').ins, root: true, lo: 33, hi: 52, gain: 0.7 }),
                new KitLane(s, r.fork('toms'), { style: 'tribal', kickGain: 0, clap: 0, hat: 0.04, perc: 0, toms: 0.09 }),
                new DroneLane(s, r.fork('pad'), { sample: role(p, r, 'rebel', 'pad'), upper: true, gain: 0.04, cutoff: 1400, detune: 18, attack: 1, drive: 0.5, release: 2.5 }),
            ]) },
            // drums under the bass, the lead tearing over the top
            drop: { weight: 0, build: (s, r, p) => {
                const bass = role(p, r, 'rebel', 'bass');
                return [
                    new ImpactLane(s, r.fork('impact')),
                    new KitLane(s, r.fork('kit'), { kick: HARD_KICK, clap: 0.15, snare: 0.15, hat: 0.06, metal: 0.06, ...role(p, r, 'rebel', 'kit') }),
                    new FigureLane(s, r.fork('bass'), { gen: bass.gen, instrument: bass.ins, root: true, lo: 33, hi: 52, bias: 1, repeat: 0.7 }),
                    new FigureLane(s, r.fork('lead'), { gen: 'hook', instrument: role(p, r, 'rebel', 'lead', 0.25), lo: 52, hi: 76, repeat: 0.7, legato: 1.1, extra: { drive: 1 } }),
                    new FigureLane(s, r.fork('hit'), { gen: 'splatter', bias: 2, instrument: role(p, r, 'rebel', 'hit'), lo: 45, hi: 72, repeat: 0.8, gain: 0.8 }),
                    new DroneLane(s, r.fork('pad'), { upper: true, gain: 0.04, cutoff: 1200, detune: 18, attack: 0.3, drive: 0.7, pump: 0.7, release: 2.5 }),
                ];
            } },
            // broken industrial drums, a reese, the Polivoks as a lead, a distorted arp
            drive: { weight: 0, build: (s, r) => [
                new ImpactLane(s, r.fork('impact')),
                new KitLane(s, r.fork('kit'), { style: 'breaks', kick: HARD_KICK, clap: 0.17, snare: 0.12, hat: 0.08, metal: 0.05 }),
                new FigureLane(s, r.fork('bass'), { gen: 'bass', instrument: 'reese', root: true, lo: 28, hi: 47, bias: 1, repeat: 0.7, legato: 0.95 }),
                new FigureLane(s, r.fork('hook'), { gen: 'hook', instrument: 'polilead', lo: 57, hi: 81, repeat: 0.6 }),
                new FigureLane(s, r.fork('arp'), { gen: 'arp', instrument: 'grit', lo: 64, hi: 88, repeat: 0.7, gain: 0.8 }),
            ] },
            break: { weight: 0, build: (s, r, p) => [
                new ImpactLane(s, r.fork('impact'), { kind: 'down' }),
                new DroneLane(s, r.fork('pad'), { sample: role(p, r, 'rebel', 'pad', 0.3), fifth: true, gain: 0.045, cutoff: 900, detune: 16, attack: 3, sub: 0.05, release: 4 }),
                new PhraseLane(s, r.fork('lead'), { bpm: p.bpm, instrument: role(p, r, 'rebel', 'lead', 0.3), lo: 52, hi: 76, rest: [2, 6], repeat: 0.65 }),
                new KitLane(s, r.fork('toms'), { style: 'tribal', kickGain: 0, clap: 0.04, hat: 0.04, toms: 0.06 }),
            ] },
        },
    },
    {
        id: 'acid',
        label: 'Acid',
        refs: 'Nina Kraviz, LFO, Sweet Exorcist, The Prodigy',
        blurb: 'Warehouse techno under the overpass: an acid line that will not sit still, a rave stab, a kick you feel.',
        modes: [['phrygian', 2], ['aeolian', 2], ['dorian', 1]],
        tonic: [40, 46],
        bpm: [126, 138],
        swing: [0, 0.05],
        // DJ-length sections
        song: { bars: { intro: [16], rain: [16], build: [8, 16], drop: [32], break: [8, 16], build2: [8], drop2: [32] } },
        harmony: { holdMin: 40, holdMax: 90, pedalProb: 0.7, shapes: ['open', 'sus2', 'quartal'] },
        reverb: { t60: [3, 5], damping: [4000, 7000], size: 1.4 },
        echoBeats: 0.75,
        opening: ['rain'],
        palette: {
            acid: [{ ins: 'tb303', fill: 0.7 }, { ins: 'tb303', fill: 0.85, extra: { q: 14, drive: 1.3 } }, { ins: 'ms20bass', fill: 0.6 }],
            lead: ['bleep', 'hoover', 'dx7bell'],
            stab: ['ravestab', 'polystab', 'stab'],
            kit: [{ style: 'four', kick: RUMBLE_KICK }, { style: 'ebm', kick: HARD_KICK }, { style: 'electro', kick: ELECTRO_KICK }],
            pad: ['vocoder', 'jup8pad', 'deeppad'],
        },
        scenes: {
            // the DJ's intro: kick, hats and the lead, the acid not yet in
            rain: { weight: 1, build: (s, r, p) => [
                new KitLane(s, r.fork('kit'), { kickGain: 0.7, clap: 0, hat: 0.07, open: 0.4, perc: 0.04, ...role(p, r, 'acid', 'kit') }),
                new FigureLane(s, r.fork('lead'), { gen: 'walk', density: 0.5, instrument: role(p, r, 'acid', 'lead', 0.3), lo: 69, hi: 93, repeat: 0.8 }),
                new DroneLane(s, r.fork('drone'), { sample: role(p, r, 'acid', 'pad'), gain: 0.03, cutoff: 500, detune: 10, attack: 6, sub: 0.05 }),
            ] },
            // kick out, the acid in, hats open
            build: { weight: 0, build: (s, r, p) => {
                const acid = role(p, r, 'acid', 'acid');
                return buildUp(s, r, [
                    new FigureLane(s, r.fork('acid'), { gen: 'acid', instrument: acid.ins, fill: acid.fill, extra: acid.extra, root: true, lo: 33, hi: 57, repeat: 0.7, gain: 0.75 }),
                    new KitLane(s, r.fork('hats'), { style: 'four', kickGain: 0, clap: 0, hat: 0.08, open: 0.5 }),
                ]);
            } },
            drop: { weight: 0, build: (s, r, p) => {
                const acid = role(p, r, 'acid', 'acid');
                return [
                    new ImpactLane(s, r.fork('impact')),
                    new KitLane(s, r.fork('kit'), { clap: 0.13, hat: 0.1, open: 0.5, perc: 0.05, ...role(p, r, 'acid', 'kit') }),
                    new FigureLane(s, r.fork('acid'), { gen: 'acid', instrument: acid.ins, fill: acid.fill, extra: acid.extra, root: true, lo: 33, hi: 57, repeat: 0.75 }),
                    new FigureLane(s, r.fork('lead'), { gen: 'hook', instrument: role(p, r, 'acid', 'lead', 0.3), lo: 69, hi: 93, repeat: 0.7 }),
                    new DroneLane(s, r.fork('pad'), { sample: role(p, r, 'acid', 'pad'), upper: true, gain: 0.03, cutoff: 1000, detune: 12, attack: 0.5, pump: 0.9, release: 2.5 }),
                ];
            } },
            // harder: rave stabs thrown into the echo over the acid
            drive: { weight: 0, build: (s, r, p) => {
                const acid = role(p, r, 'acid', 'acid');
                return [
                    new ImpactLane(s, r.fork('impact')),
                    new KitLane(s, r.fork('kit'), { style: 'ebm', kick: HARD_KICK, clap: 0.14, hat: 0.09, perc: 0.05, metal: 0.03 }),
                    new FigureLane(s, r.fork('acid'), { gen: 'acid', instrument: acid.ins, extra: acid.extra, root: true, lo: 33, hi: 57, repeat: 0.6, fill: 0.85 }),
                    new FigureLane(s, r.fork('stab'), { gen: 'chord', hits: [2, 3], instrument: role(p, r, 'acid', 'stab', 0.3), lo: 57, hi: 76, repeat: 0.8 }),
                ];
            } },
            // the kick out: the acid and hats, the lead in the echo
            break: { weight: 0, build: (s, r, p) => {
                const acid = role(p, r, 'acid', 'acid');
                return [
                    new ImpactLane(s, r.fork('impact'), { kind: 'down' }),
                    new FigureLane(s, r.fork('acid'), { gen: 'acid', instrument: acid.ins, extra: acid.extra, root: true, lo: 33, hi: 57, repeat: 0.8, gain: 0.9, fill: 0.5 }),
                    new DroneLane(s, r.fork('drone'), { sample: role(p, r, 'acid', 'pad', 0.4), gain: 0.03, cutoff: 600, detune: 12, attack: 2, sub: 0.04, release: 4 }),
                    new KitLane(s, r.fork('hats'), { style: 'four', kickGain: 0, clap: 0, hat: 0.06, open: 0.4 }),
                    new FigureLane(s, r.fork('lead'), { gen: 'walk', density: 0.4, instrument: role(p, r, 'acid', 'lead', 0.3), lo: 69, hi: 93, repeat: 0.8 }),
                ];
            } },
        },
    },
    {
        id: 'body',
        label: 'Body',
        refs: 'Front 242, Nitzer Ebb, Gazelle Twin, HEALTH',
        blurb: 'Industrial body music: sixteenths on the sequencer, hammer and anvil on the beat, a voice made of machines.',
        modes: [['phrygian', 2], ['aeolian', 2]],
        tonic: [40, 45],
        bpm: [112, 124],
        swing: [0, 0],
        song: {},
        harmony: { holdMin: 30, holdMax: 70, pedalProb: 0.6, shapes: ['open', 'quartal'] },
        reverb: { t60: [2.5, 4.5], damping: [3000, 5000], size: 1.3 },
        echoBeats: 0.75,
        opening: ['rain'],
        palette: {
            bass: ['polivoks', 'ms20bass', 'minibass'],
            lead: ['scream', 'hoover', 'polilead'],
            voice: ['vocoder', 'darkchoir'],
            kit: [{ style: 'ebm' }, { style: 'breaks' }, { style: 'four', open: 0.5 }],
            metal: ['metalhit', 'grit'],
        },
        scenes: {
            // the factory before the shift: anvils, a hum, the sequencer idling
            rain: { weight: 1, build: (s, r, p) => [
                new ImpactLane(s, r.fork('impact'), { kind: 'down' }),
                new KitLane(s, r.fork('metal'), { style: 'ebm', kickGain: 0, clap: 0, hat: 0.03, perc: 0, metal: 0.07 }),
                new FigureLane(s, r.fork('bass'), { gen: 'pump', instrument: role(p, r, 'body', 'bass'), root: true, lo: 31, hi: 50, gain: 0.5 }),
                new DroneLane(s, r.fork('drone'), { sample: role(p, r, 'body', 'voice', 0.3), gain: 0.035, cutoff: 450, detune: 20, drive: 0.8, attack: 4 }),
                new BedLane(s, r.fork('hum'), { gain: 0.025, tone: 2500, low: 200, crackle: 200 }),
            ] },
            build: { weight: 0, build: (s, r, p) => buildUp(s, r, [
                new FigureLane(s, r.fork('bass'), { gen: 'pump', instrument: role(p, r, 'body', 'bass'), root: true, lo: 31, hi: 50, gain: 0.75 }),
                new KitLane(s, r.fork('metal'), { style: 'ebm', kickGain: 0, clap: 0, hat: 0.06, perc: 0, metal: 0.05 }),
            ]) },
            drop: { weight: 0, build: (s, r, p) => [
                new ImpactLane(s, r.fork('impact')),
                new KitLane(s, r.fork('kit'), { kick: HARD_KICK, clap: 0.15, snare: 0.15, hat: 0.07, metal: 0.07, ...role(p, r, 'body', 'kit') }),
                new FigureLane(s, r.fork('bass'), { gen: 'pump', instrument: role(p, r, 'body', 'bass'), root: true, lo: 31, hi: 50 }),
                new FigureLane(s, r.fork('lead'), { gen: 'splatter', bias: 1, instrument: role(p, r, 'body', 'lead', 0.3), lo: 57, hi: 81, repeat: 0.7, gain: 1.4 }),
                new FigureLane(s, r.fork('metal'), { gen: 'chord', hits: [1, 2], instrument: role(p, r, 'body', 'metal'), lo: 55, hi: 79, repeat: 0.9, gain: 1.4 }),
            ] },
            drive: { weight: 0, build: (s, r, p) => [
                new ImpactLane(s, r.fork('impact')),
                new KitLane(s, r.fork('kit'), { style: 'breaks', kick: HARD_KICK, clap: 0.16, snare: 0.13, hat: 0.08, metal: 0.06 }),
                new FigureLane(s, r.fork('bass'), { gen: 'pump', instrument: role(p, r, 'body', 'bass'), root: true, lo: 31, hi: 50 }),
                new FigureLane(s, r.fork('hook'), { gen: 'hook', instrument: role(p, r, 'body', 'lead', 0.4), lo: 57, hi: 81, repeat: 0.6 }),
                new DroneLane(s, r.fork('voice'), { sample: role(p, r, 'body', 'voice'), upper: true, gain: 0.03, cutoff: 1400, detune: 14, attack: 0.5, release: 2.5 }),
            ] },
            break: { weight: 0, build: (s, r, p) => [
                new ImpactLane(s, r.fork('impact'), { kind: 'down' }),
                new DroneLane(s, r.fork('pad'), { sample: role(p, r, 'body', 'voice', 0.3), upper: true, gain: 0.04, cutoff: 900, detune: 20, attack: 3, drive: 0.6, release: 4 }),
                new PhraseLane(s, r.fork('lead'), { bpm: p.bpm, instrument: 'polilead', lo: 57, hi: 81, rest: [3, 8], repeat: 0.7 }),
                new KitLane(s, r.fork('metal'), { style: 'ebm', kickGain: 0, clap: 0.04, hat: 0.04, metal: 0.05 }),
            ] },
        },
    },
    {
        id: 'outrun',
        label: 'Outrun',
        refs: 'Carpenter Brut, Perturbator, Kavinsky',
        blurb: 'Night drive on the coast road: octave bass, a gated snare, arpeggios and a lead over the skyline.',
        modes: [['aeolian', 2], ['dorian', 2]],
        tonic: [40, 47],
        bpm: [100, 116],
        swing: [0, 0],
        song: {},
        harmony: { holdMin: 14, holdMax: 34, pedalProb: 0.2, shapes: ['seventh', 'add9', 'spread'] },
        reverb: { t60: [5, 8], damping: [6000, 9000], size: 1.7 },
        echoBeats: 0.75,
        opening: ['rain'],
        palette: {
            bass: [{ ins: 'ebass', gen: 'octaves' }, { ins: 'minibass', gen: 'octaves' }, { ins: 'matrixbass', gen: 'bass' }],
            lead: ['saw', 'obxlead', 'cs80lead'],
            pad: ['jup8', 'cs80', 'brass'],
            arp: ['grit', 'pluck', 'dx7bell'],
            kit: [{ style: 'four', kick: BOOM_KICK, snare: 0.14 }, { style: 'breaks', kick: HARD_KICK, snare: 0.14 }, { style: 'four', kick: HARD_KICK, snare: 0.12, clap: 0.12 }],
        },
        scenes: {
            rain: { weight: 1, build: (s, r, p) => {
                const pad = role(p, r, 'outrun', 'pad', 0.3);
                return [
                    new ImpactLane(s, r.fork('impact'), { kind: 'down' }),
                    ...loops(s, r, [pad, pad, pad], { count: 3, octaves: { [pad]: 0 } }),
                    new FigureLane(s, r.fork('arp'), { gen: 'arp', rate: 1, instrument: role(p, r, 'outrun', 'arp'), lo: 62, hi: 86, repeat: 0.9, gain: 0.8 }),
                    new BedLane(s, r.fork('rain'), { gain: 0.02, tone: 9000, low: 1400, crackle: 100 }),
                ];
            } },
            build: { weight: 0, build: (s, r, p) => buildUp(s, r, [
                new FigureLane(s, r.fork('bass'), { gen: 'octaves', instrument: role(p, r, 'outrun', 'bass').ins, root: true, lo: 31, hi: 52, gain: 0.5 }),
                new FigureLane(s, r.fork('arp'), { gen: 'arp', rate: 1, instrument: role(p, r, 'outrun', 'arp'), lo: 62, hi: 86, repeat: 0.9, gain: 0.9 }),
                new DroneLane(s, r.fork('pad'), { sample: 'jup8pad', fifth: true, gain: 0.05, cutoff: 2000, detune: 14, attack: 1, pump: 0.5, release: 1.5 }),
            ]) },
            drop: { weight: 0, build: (s, r, p) => {
                const bass = role(p, r, 'outrun', 'bass');
                return [
                    new ImpactLane(s, r.fork('impact')),
                    new KitLane(s, r.fork('kit'), { clap: 0.08, hat: 0.08, open: 0.3, ...role(p, r, 'outrun', 'kit') }),
                    new FigureLane(s, r.fork('bass'), { gen: bass.gen, instrument: bass.ins, root: true, lo: 31, hi: 52, bias: 1, repeat: 0.7, gain: 0.8 }),
                    new FigureLane(s, r.fork('lead'), { gen: 'hook', instrument: role(p, r, 'outrun', 'lead', 0.25), lo: 62, hi: 86, repeat: 0.75, legato: 1, extra: { release: 0.5 } }),
                    new FigureLane(s, r.fork('arp'), { gen: 'arp', rate: 1, instrument: role(p, r, 'outrun', 'arp'), lo: 64, hi: 88, repeat: 0.9, gain: 0.7 }),
                    new DroneLane(s, r.fork('pad'), { sample: 'jup8pad', fifth: true, gain: 0.05, cutoff: 1800, detune: 14, attack: 0.3, pump: 0.8, release: 1.5 }),
                ];
            } },
            drive: { weight: 0, build: (s, r, p) => [
                new ImpactLane(s, r.fork('impact')),
                new KitLane(s, r.fork('kit'), { style: 'breaks', kick: HARD_KICK, clap: 0.1, snare: 0.14, hat: 0.09, metal: 0.03 }),
                new FigureLane(s, r.fork('bass'), { gen: 'bass', instrument: 'reese', root: true, lo: 28, hi: 47, bias: 1, repeat: 0.7, legato: 0.95 }),
                new FigureLane(s, r.fork('brass'), { gen: 'chord', hits: [1, 3], instrument: 'cs80', lo: 55, hi: 76, repeat: 0.85, legato: 1.2 }),
                new FigureLane(s, r.fork('lead'), { gen: 'hook', instrument: role(p, r, 'outrun', 'lead', 0.4), lo: 62, hi: 86, repeat: 0.7, extra: { release: 0.5 } }),
            ] },
            break: { weight: 0, build: (s, r, p) => [
                new ImpactLane(s, r.fork('impact'), { kind: 'down' }),
                new DroneLane(s, r.fork('pad'), { sample: 'jup8pad', upper: true, fifth: true, gain: 0.05, cutoff: 1300, detune: 14, attack: 3, wow: 6, sub: 0.04, release: 4 }),
                new PhraseLane(s, r.fork('lead'), { bpm: p.bpm, instrument: 'cs80lead', lo: 60, hi: 84, rest: [3, 8], repeat: 0.65 }),
                new FigureLane(s, r.fork('arp'), { gen: 'arp', rate: 2, instrument: role(p, r, 'outrun', 'arp'), lo: 62, hi: 86, repeat: 0.9, gain: 0.6 }),
            ] },
        },
    },
    {
        id: 'dirge',
        label: 'Dirge',
        refs: 'Run the Jewels, A$AP Rocky, SOPHIE',
        blurb: 'Half-time from the Badlands to Pacifica: a sliding 808, hats that roll, something eerie on top.',
        modes: [['phrygian', 2], ['aeolian', 2]],
        tonic: [40, 46],
        bpm: [134, 150],
        swing: [0, 0.06],
        song: { bars: { intro: [8], rain: [8], build: [4], drop: [16, 32], break: [8], build2: [4], drop2: [16] } },
        harmony: { holdMin: 24, holdMax: 60, pedalProb: 0.5, shapes: ['open', 'seventh', 'sus2'] },
        reverb: { t60: [4, 7], damping: [4000, 7000], size: 1.5 },
        echoBeats: 0.75,
        opening: ['rain'],
        palette: {
            lead: ['bell', 'darkbell', 'trapflute', 'dx7bell'],
            pad: ['darkchoir', 'vocoder', 'jup8pad'],
            hats: [{ rolls: 0.2 }, { rolls: 0.35 }, { rolls: 0.5 }],
            hook: ['polilead', 'hoover', 'erhu'],
        },
        scenes: {
            rain: { weight: 1, build: (s, r, p) => [
                new ImpactLane(s, r.fork('impact'), { kind: 'down' }),
                new FigureLane(s, r.fork('lead'), { gen: 'walk', density: 0.45, instrument: role(p, r, 'dirge', 'lead', 0.3), lo: 67, hi: 88, repeat: 0.85 }),
                new DroneLane(s, r.fork('pad'), { sample: role(p, r, 'dirge', 'pad'), upper: true, gain: 0.04, cutoff: 900, detune: 16, attack: 4, wow: 8, release: 4 }),
                new BedLane(s, r.fork('hiss'), { gain: 0.02, tone: 7000, low: 900, crackle: 90 }),
            ] },
            build: { weight: 0, build: (s, r, p) => buildUp(s, r, [
                new FigureLane(s, r.fork('lead'), { gen: 'walk', density: 0.6, instrument: role(p, r, 'dirge', 'lead'), lo: 67, hi: 88, repeat: 0.85 }),
                new KitLane(s, r.fork('hats'), { style: 'trap', kickGain: 0, clap: 0, hat: 0.08, ...role(p, r, 'dirge', 'hats') }),
            ]) },
            drop: { weight: 0, build: (s, r, p) => [
                new ImpactLane(s, r.fork('impact')),
                new KitLane(s, r.fork('kit'), { style: 'trap', kick: TRAP_KICK, clap: 0.16, snare: 0.08, hat: 0.09, ...role(p, r, 'dirge', 'hats') }),
                new FigureLane(s, r.fork('808'), { gen: 'trap', instrument: 'boom', root: true, lo: 28, hi: 43, legato: 1 }),
                new FigureLane(s, r.fork('lead'), { gen: 'hook', instrument: role(p, r, 'dirge', 'lead', 0.3), lo: 67, hi: 88, repeat: 0.75 }),
                new DroneLane(s, r.fork('pad'), { sample: role(p, r, 'dirge', 'pad'), upper: true, gain: 0.035, cutoff: 1000, detune: 16, attack: 1, release: 2.5 }),
            ] },
            drive: { weight: 0, build: (s, r, p) => [
                new ImpactLane(s, r.fork('impact')),
                new KitLane(s, r.fork('kit'), { style: 'trap', kick: TRAP_KICK, clap: 0.16, snare: 0.1, hat: 0.1, rolls: 0.4, metal: 0.03 }),
                new FigureLane(s, r.fork('808'), { gen: 'trap', instrument: 'boom', root: true, lo: 28, hi: 43, legato: 1 }),
                new FigureLane(s, r.fork('hook'), { gen: 'hook', instrument: role(p, r, 'dirge', 'hook', 0.3), lo: 57, hi: 79, repeat: 0.7 }),
            ] },
            break: { weight: 0, build: (s, r, p) => [
                new ImpactLane(s, r.fork('impact'), { kind: 'down' }),
                new FigureLane(s, r.fork('lead'), { gen: 'walk', density: 0.5, instrument: role(p, r, 'dirge', 'lead', 0.4), lo: 67, hi: 88, repeat: 0.85 }),
                new DroneLane(s, r.fork('pad'), { sample: role(p, r, 'dirge', 'pad', 0.4), upper: true, gain: 0.045, cutoff: 800, detune: 16, attack: 3, wow: 8, release: 4 }),
                new KitLane(s, r.fork('hats'), { style: 'trap', kickGain: 0, clap: 0.05, hat: 0.06, rolls: 0.15 }),
            ] },
        },
    },
    {
        id: 'rain',
        label: 'Rain',
        refs: 'Vangelis, Benjamin Wallfisch and Hans Zimmer',
        blurb: 'Four in the morning on the megacity: CS-80 brass swelling in the rain, a lead sliding down, no beat at all.',
        modes: [['aeolian', 2], ['dorian', 2], ['lydian', 1]],
        tonic: [40, 47],
        bpm: [70, 84],
        swing: [0, 0],
        harmony: { holdMin: 30, holdMax: 70, pedalProb: 0.4, shapes: ['seventh', 'add9', 'spread', 'quartal'] },
        reverb: { t60: [8, 12], damping: [5000, 8000], size: 1.8 },
        echoBeats: 1.5,
        opening: ['rain'],
        palette: {
            pad: ['cs80', 'brass', 'jup8'],
            lead: ['cs80lead', 'brasslead', 'erhu'],
            horn: ['lowhorn', 'horn'],
            smear: ['strings', 'vocoder', 'darkchoir'],
        },
        scenes: {
            rain: { weight: 1, build: (s, r, p) => {
                const pad = role(p, r, 'rain', 'pad', 0.3);
                return [
                    new DroneLane(s, r.fork('drone'), { fifth: true, gain: 0.04, cutoff: 700, detune: 14, wow: 6, attack: 6, sub: 0.06 }),
                    ...loops(s, r, [pad, pad, pad], { count: 3, octaves: { [pad]: 0 } }),
                    new DroneLane(s, r.fork('smear'), { sample: role(p, r, 'rain', 'smear', 0.3), grain: { density: 5, size: [0.15, 0.6], octaves: [0, 1], reverse: 0.4, jitter: 12 }, octave: 2, gain: 0.035, attack: 8, release: 10, reverb: 0.8, echo: 0.3 }),
                    new BedLane(s, r.fork('rain'), { gain: 0.03, tone: 9000, low: 1400, crackle: 140 }),
                ];
            } },
            // the Blade Runner lead over the pad, the horn now and then
            lead: { weight: 1, build: (s, r, p) => [
                new DroneLane(s, r.fork('pad'), { upper: true, fifth: true, gain: 0.05, cutoff: 1100, detune: 14, attack: 4, wow: 6, sub: 0.04 }),
                new PhraseLane(s, r.fork('lead'), { bpm: p.bpm, instrument: role(p, r, 'rain', 'lead', 0.3), lo: 60, hi: 84, rest: [3, 8], repeat: 0.65 }),
                new CycleLane(s, r.fork('horn'), { bars: 8, instrument: role(p, r, 'rain', 'horn'), octave: 1, gain: 0.6, extra: { dur: 4 } }),
                new BedLane(s, r.fork('rain'), { gain: 0.022, tone: 9000, low: 1400, crackle: 120 }),
            ] },
            // a chant far off, ghost hats under an awning
            haze: { weight: 0.7, build: (s, r) => [
                new DroneLane(s, r.fork('chant'), { sample: 'monks', octave: 1, gain: 0.035, attack: 8, release: 10, reverb: 0.85 }),
                new DroneLane(s, r.fork('pad'), { upper: true, gain: 0.04, cutoff: 900, detune: 16, attack: 6, wow: 8 }),
                new KitLane(s, r.fork('ghost'), { style: 'halfstep', kickGain: 0, clap: 0.05, hat: 0.05, perc: 0.03 }),
                new FigureLane(s, r.fork('pluck'), { gen: 'walk', density: 0.35, instrument: 'pluck', lo: 62, hi: 86, repeat: 0.7, gain: 0.7 }),
                new BedLane(s, r.fork('rain'), { gain: 0.03, tone: 9000, low: 1400, crackle: 140 }),
            ] },
        },
    },
];

// Dub, split the same way: five ways of doing dub, from King Tubby's
// one drop to Basic Channel's chords in the fog, and each station picks its
// own skank, lead and pad. Every scene keeps a kick (ju wants it).
const DUB_FORMATS = [
    {
        id: 'roots',
        label: 'Roots',
        refs: 'King Tubby, Scientist, Augustus Pablo, Lee Perry',
        blurb: 'The one drop: kick and rim on the third beat, a walking bass, the skank on two and four, a melodica, everything thrown into the echo.',
        modes: [['aeolian', 2], ['dorian', 2], ['mixolydian', 1]],
        tonic: [43, 50],
        bpm: [68, 80],
        swing: [0.06, 0.16],
        harmony: { holdMin: 16, holdMax: 40, pedalProb: 0.2, shapes: ['seventh', 'open', 'sus2'] },
        reverb: { t60: [3, 5], damping: [3500, 5500], size: 1.3 },
        echoBeats: 0.75,
        opening: ['version'],
        palette: {
            skank: ['clav', 'bubble', 'tine'],
            lead: ['melodica', 'horns', 'trapflute'],
            bass: [{ gen: 'bass', bias: 1 }, { gen: 'walk', density: 0.7, height: 3 }, { gen: 'bass', bias: 2 }],
            pad: ['dubpad', 'deeppad'],
        },
        scenes: {
            // the full riddim
            riddim: { weight: 2, build: (s, r, p) => [
                new KitLane(s, r.fork('kit'), { style: 'onedrop', kick: DUB_KICK, clap: 0.08, hat: 0.06, perc: 0.05 }),
                new FigureLane(s, r.fork('bass'), { ...role(p, r, 'roots', 'bass'), instrument: 'dubbass', root: true, lo: 31, hi: 50, repeat: 0.8, legato: 0.85 }),
                new FigureLane(s, r.fork('skank'), { gen: 'skank', instrument: role(p, r, 'roots', 'skank', 0.25), lo: 55, hi: 74, gain: 1.2 }),
                new FigureLane(s, r.fork('bubble'), { gen: 'bubble', instrument: 'bubble', lo: 48, hi: 67, gain: 0.8 }),
                new PhraseLane(s, r.fork('lead'), { bpm: p.bpm, instrument: role(p, r, 'roots', 'lead', 0.3), lo: 62, hi: 84, rest: [4, 10], repeat: 0.7 }),
                new BedLane(s, r.fork('bed'), { gain: 0.012, tone: 5000, crackle: 8 }),
            ] },
            // the dub: half the band muted, the rest thrown into the echo
            dub: { weight: 1.5, build: (s, r, p) => [
                new KitLane(s, r.fork('kit'), { style: 'onedrop', kick: DUB_KICK, clap: 0.1, hat: 0.03, perc: 0.08 }),
                new FigureLane(s, r.fork('bass'), { ...role(p, r, 'roots', 'bass'), instrument: 'dubbass', root: true, lo: 31, hi: 50, repeat: 0.8, legato: 0.85 }),
                new FigureLane(s, r.fork('skank'), { gen: 'skank', instrument: role(p, r, 'roots', 'skank'), lo: 55, hi: 74, gain: 0.9, extra: { echo: 0.9 } }),
                new CycleLane(s, r.fork('siren'), { bars: 8, instrument: 'siren', octave: 3, gain: 0.8 }),
                new DroneLane(s, r.fork('pad'), { sample: role(p, r, 'roots', 'pad'), sampleOnly: true, octave: 1, upper: true, gain: 0.03, attack: 6, release: 6, reverb: 0.6 }),
            ] },
            // the version: drum and bass only
            version: { weight: 1, build: (s, r, p) => [
                new KitLane(s, r.fork('kit'), { style: 'onedrop', kick: DUB_KICK, clap: 0.09, hat: 0.07, perc: 0.04 }),
                new FigureLane(s, r.fork('bass'), { ...role(p, r, 'roots', 'bass'), instrument: 'dubbass', root: true, lo: 31, hi: 50, repeat: 0.8, legato: 0.85 }),
                new BedLane(s, r.fork('bed'), { gain: 0.014, tone: 5000, crackle: 10 }),
            ] },
        },
    },
    {
        id: 'steppers',
        label: 'Steppers',
        refs: 'Mad Professor, Iration Steppas, Alpha Steppa, Jah Shaka',
        blurb: 'UK sound system: a kick on every beat, a sub you feel in your chest, horns, a siren, the organ bubbling.',
        modes: [['aeolian', 2], ['phrygian', 1], ['dorian', 2]],
        tonic: [41, 48],
        bpm: [136, 146],
        swing: [0, 0.04],
        harmony: { holdMin: 20, holdMax: 50, pedalProb: 0.4, shapes: ['open', 'sus2', 'quartal'] },
        reverb: { t60: [3, 5], damping: [3500, 5500], size: 1.4 },
        echoBeats: 0.75,
        opening: ['dub'],
        palette: {
            lead: ['horns', 'melodica', 'hoover'],
            skank: ['bubble', 'clav', 'polystab'],
            bass: ['dubbass', 'matrixbass', 'minibass'],
        },
        scenes: {
            steppers: { weight: 2, build: (s, r, p) => [
                new KitLane(s, r.fork('kit'), { style: 'steppers', kick: DUB_KICK, clap: 0.1, snare: 0.06, hat: 0.07, open: 0.4, perc: 0.04 }),
                new FigureLane(s, r.fork('bass'), { gen: 'bass', instrument: role(p, r, 'steppers', 'bass'), root: true, lo: 29, hi: 45, bias: 1, repeat: 0.85, legato: 0.9 }),
                new FigureLane(s, r.fork('skank'), { gen: 'bubble', instrument: role(p, r, 'steppers', 'skank'), lo: 52, hi: 72, gain: 0.9 }),
                new FigureLane(s, r.fork('lead'), { gen: 'hook', instrument: role(p, r, 'steppers', 'lead', 0.3), lo: 60, hi: 81, repeat: 0.75 }),
                new CycleLane(s, r.fork('siren'), { bars: 16, instrument: 'siren', octave: 3, gain: 0.7 }),
            ] },
            dub: { weight: 1.5, build: (s, r, p) => [
                new KitLane(s, r.fork('kit'), { style: 'steppers', kick: DUB_KICK, clap: 0.08, hat: 0.04, perc: 0.06 }),
                new FigureLane(s, r.fork('bass'), { gen: 'bass', instrument: role(p, r, 'steppers', 'bass'), root: true, lo: 29, hi: 45, bias: 2, repeat: 0.9, legato: 0.9 }),
                new FigureLane(s, r.fork('lead'), { gen: 'splatter', bias: 2, instrument: role(p, r, 'steppers', 'lead'), lo: 60, hi: 81, repeat: 0.8, extra: { echo: 0.9 } }),
                new DroneLane(s, r.fork('drone'), { sample: 'deeppad', gain: 0.03, cutoff: 600, attack: 4, sub: 0.04 }),
            ] },
            // the warrior section: the horns lead, everything up
            warrior: { weight: 1, build: (s, r, p) => [
                new KitLane(s, r.fork('kit'), { style: 'steppers', kick: DUB_KICK, clap: 0.12, snare: 0.08, hat: 0.08, open: 0.5, perc: 0.05 }),
                new FigureLane(s, r.fork('bass'), { gen: 'octaves', instrument: role(p, r, 'steppers', 'bass'), root: true, lo: 29, hi: 45, gain: 0.9 }),
                new FigureLane(s, r.fork('horns'), { gen: 'chord', hits: [2, 3], instrument: 'horns', lo: 57, hi: 76, repeat: 0.8 }),
                new FigureLane(s, r.fork('skank'), { gen: 'skank', instrument: role(p, r, 'steppers', 'skank', 0.3), lo: 55, hi: 74 }),
            ] },
        },
    },
    {
        id: 'chords',
        label: 'Chords',
        refs: 'Basic Channel, Rhythm & Sound, Deepchord, Gas',
        blurb: 'Dub techno: one chord thrown into the echo until it turns to fog, a kick under it all night.',
        modes: [['dorian', 3], ['aeolian', 2], ['mixolydian', 1]],
        tonic: [43, 52],
        bpm: [112, 124],
        swing: [0, 0.03],
        harmony: { holdMin: 50, holdMax: 120, pedalProb: 0.7, shapes: ['seventh', 'add9', 'quartal', 'spread'] },
        reverb: { t60: [6, 10], damping: [4500, 6500] },
        echoBeats: 0.75,
        opening: ['fog'],
        palette: {
            stab: ['polystab', 'stab', 'tine'],
            pad: ['dubpad', 'deeppad', 'spacevox'],
            kick: [DUB_KICK, BOOM_KICK, { ...DUB_KICK, decay: 0.9, tone: 900 }],
        },
        scenes: {
            pulse: { weight: 3, build: (s, r, p) => [
                new DroneLane(s, r.fork('drone'), { gain: 0.05, cutoff: 600, sub: 0.03 }),
                new PulseLane(s, r.fork('pulse'), { bpm: p.bpm, kick: 0.16, kickShape: role(p, r, 'chords', 'kick'), stabs: false }),
                new FigureLane(s, r.fork('stabs'), { gen: 'chord', instrument: role(p, r, 'chords', 'stab', 0.25), lo: 50, hi: 72, repeat: 0.7, gain: 1.4 }),
                new FigureLane(s, r.fork('bass'), { gen: 'bass', instrument: 'dubbass', root: true, lo: 31, hi: 50, bias: 2, repeat: 0.75, legato: 0.8 }),
                new BedLane(s, r.fork('bed'), { gain: 0.012, tone: 5000, crackle: 6 }),
            ] },
            fog: { weight: 2, build: (s, r, p) => [
                new DroneLane(s, r.fork('drone'), { fifth: true, gain: 0.06, cutoff: 700, sub: 0.05 }),
                new DroneLane(s, r.fork('pad'), { sample: role(p, r, 'chords', 'pad', 0.3), sampleOnly: true, octave: 1, upper: true, gain: 0.04, attack: 8, release: 10, cutoff: 1400, stagger: 5, reverb: 0.6 }),
                new DroneLane(s, r.fork('smear'), { sample: 'tine', grain: { density: 3, size: [0.05, 0.2], octaves: [0, 1], reverse: 0.15 }, octave: 1, gain: 0.035, attack: 10, release: 10, cutoff: 2200, reverb: 0.4, echo: 0.7 }),
                new PulseLane(s, r.fork('pulse'), { bpm: p.bpm, kick: 0.1, kickShape: role(p, r, 'chords', 'kick'), ticks: 0, stabs: false }),
                new FigureLane(s, r.fork('stabs'), { gen: 'chord', hits: [1, 2], instrument: role(p, r, 'chords', 'stab'), lo: 50, hi: 72, repeat: 0.8, gain: 1.6 }),
                new BedLane(s, r.fork('bed'), { gain: 0.016, tone: 4000, crackle: 10 }),
            ] },
            deep: { weight: 1.5, build: (s, r, p) => [
                new DroneLane(s, r.fork('drone'), { gain: 0.05, cutoff: 450, sub: 0.04 }),
                new PulseLane(s, r.fork('pulse'), { bpm: p.bpm, kick: 0.17, kickShape: role(p, r, 'chords', 'kick'), ticks: 0.1, stabCutoff: 500, stabGain: 0.08 }),
                new FigureLane(s, r.fork('bass'), { gen: 'bass', instrument: 'dubbass', root: true, lo: 31, hi: 48, bias: 3, repeat: 0.85, legato: 0.9 }),
                new BedLane(s, r.fork('bed'), { gain: 0.01, tone: 3000, crackle: 4 }),
            ] },
        },
    },
    {
        id: 'haze',
        label: 'Haze',
        refs: 'The Orb, Bill Laswell, Pole, The Bug',
        blurb: 'Ambient dub: a soft kick far away, sub pressure, voices and a melodica dissolving in the echo, crackle.',
        modes: [['dorian', 2], ['aeolian', 2], ['lydian', 1]],
        tonic: [41, 50],
        bpm: [62, 78],
        swing: [0, 0.08],
        harmony: { holdMin: 40, holdMax: 100, pedalProb: 0.6, shapes: ['add9', 'spread', 'quartal'] },
        reverb: { t60: [8, 12], damping: [3500, 6000], size: 1.8 },
        echoBeats: 1.5,
        opening: ['haze'],
        palette: {
            voice: ['spacevox', 'vocoder', 'ooh'],
            lead: ['melodica', 'trapflute', 'erhu'],
            pad: ['deeppad', 'dubpad', 'jup8pad'],
        },
        scenes: {
            haze: { weight: 2, build: (s, r, p) => [
                new DroneLane(s, r.fork('drone'), { fifth: true, gain: 0.05, cutoff: 600, sub: 0.06, attack: 8 }),
                new DroneLane(s, r.fork('voice'), { sample: role(p, r, 'haze', 'voice', 0.3), grain: { density: 4, size: [0.2, 0.7], octaves: [0, 1], reverse: 0.4, jitter: 10 }, octave: 1, gain: 0.035, attack: 10, release: 10, reverb: 0.8, echo: 0.5 }),
                new PulseLane(s, r.fork('pulse'), { bpm: p.bpm, kick: 0.09, kickShape: { ...DUB_KICK, decay: 0.9 }, ticks: 0.05, stabs: false }),
                new BedLane(s, r.fork('bed'), { gain: 0.02, tone: 4000, crackle: 30 }),
            ] },
            drift: { weight: 1.5, build: (s, r, p) => [
                new DroneLane(s, r.fork('pad'), { sample: role(p, r, 'haze', 'pad'), upper: true, gain: 0.045, cutoff: 1200, attack: 8, release: 10, wow: 8, reverb: 0.8 }),
                new PhraseLane(s, r.fork('lead'), { bpm: p.bpm, instrument: role(p, r, 'haze', 'lead', 0.3), lo: 62, hi: 84, rest: [6, 14], repeat: 0.6, extra: { echo: 0.85 } }),
                new PulseLane(s, r.fork('pulse'), { bpm: p.bpm, kick: 0.08, kickShape: { ...DUB_KICK, decay: 0.9 }, ticks: 0, stabs: false }),
                new CycleLane(s, r.fork('siren'), { bars: 16, instrument: 'siren', octave: 3, gain: 0.4 }),
                new BedLane(s, r.fork('bed'), { gain: 0.016, tone: 3500, crackle: 20 }),
            ] },
            low: { weight: 1, build: (s, r, p) => [
                new DroneLane(s, r.fork('drone'), { gain: 0.05, cutoff: 400, sub: 0.07, attack: 10 }),
                new FigureLane(s, r.fork('bass'), { gen: 'bass', instrument: 'dubbass', root: true, lo: 29, hi: 45, bias: 3, repeat: 0.9, legato: 1 }),
                new PulseLane(s, r.fork('pulse'), { bpm: p.bpm, kick: 0.11, kickShape: DUB_KICK, ticks: 0.06, stabs: false }),
                new DroneLane(s, r.fork('voice'), { sample: role(p, r, 'haze', 'voice'), grain: { density: 2, size: [0.3, 0.9], octaves: [0, 1], reverse: 0.5 }, octave: 1, gain: 0.03, attack: 10, release: 10, reverb: 0.85, echo: 0.6 }),
            ] },
        },
    },
    {
        id: 'sub',
        label: 'Sub',
        refs: 'Mala, Loefah, Kode9, Burial',
        blurb: 'Early dubstep: half-time at 140, a sub that wobbles, ghosts in the hats, a bell in an empty car park, then the drop.',
        modes: [['phrygian', 2], ['aeolian', 2]],
        tonic: [40, 46],
        bpm: [138, 142],
        swing: [0.02, 0.1],
        song: { bars: { intro: [16], rain: [8, 16], build: [4, 8], drop: [16, 32], break: [8, 16], build2: [4, 8], drop2: [16, 32] } },
        harmony: { holdMin: 30, holdMax: 70, pedalProb: 0.5, shapes: ['open', 'quartal', 'sus2'] },
        reverb: { t60: [5, 8], damping: [3500, 6000], size: 1.5 },
        echoBeats: 0.75,
        opening: ['rain'],
        palette: {
            bass: [{ ins: 'reese', extra: { wobble: 2 } }, { ins: 'matrixbass', extra: {} }, { ins: 'dubbass', extra: {} }],
            lead: ['darkbell', 'melodica', 'erhu'],
            pad: ['spacevox', 'darkchoir', 'deeppad'],
        },
        scenes: {
            rain: { weight: 1, build: (s, r, p) => [
                new ImpactLane(s, r.fork('impact'), { kind: 'down' }),
                new KitLane(s, r.fork('kit'), { style: 'halfstep', kick: DUB_KICK, kickGain: 0.5, clap: 0.05, hat: 0.05, perc: 0.03 }),
                new DroneLane(s, r.fork('pad'), { sample: role(p, r, 'sub', 'pad', 0.3), fifth: true, gain: 0.045, cutoff: 900, detune: 16, attack: 6, wow: 8, release: 3 }),
                new FigureLane(s, r.fork('lead'), { gen: 'walk', density: 0.35, instrument: role(p, r, 'sub', 'lead', 0.3), lo: 64, hi: 86, repeat: 0.85 }),
                new BedLane(s, r.fork('bed'), { gain: 0.025, tone: 6000, low: 700, crackle: 60 }),
            ] },
            build: { weight: 0, build: (s, r, p) => buildUp(s, r, [
                new KitLane(s, r.fork('kit'), { style: 'halfstep', kick: DUB_KICK, kickGain: 0.6, clap: 0, hat: 0.07 }),
                new DroneLane(s, r.fork('pad'), { sample: role(p, r, 'sub', 'pad'), fifth: true, gain: 0.045, cutoff: 1400, detune: 16, attack: 1, release: 1.5 }),
            ]) },
            drop: { weight: 0, build: (s, r, p) => {
                const bass = role(p, r, 'sub', 'bass');
                return [
                    new ImpactLane(s, r.fork('impact')),
                    new KitLane(s, r.fork('kit'), { style: 'halfstep', kick: DUB_KICK, clap: 0.15, snare: 0.1, hat: 0.07, perc: 0.04 }),
                    new FigureLane(s, r.fork('bass'), { gen: 'bass', instrument: bass.ins, extra: bass.extra, root: true, lo: 28, hi: 43, bias: 1, repeat: 0.8, legato: 1 }),
                    new FigureLane(s, r.fork('lead'), { gen: 'splatter', bias: 2, instrument: role(p, r, 'sub', 'lead', 0.3), lo: 64, hi: 86, repeat: 0.8 }),
                    new DroneLane(s, r.fork('pad'), { sample: role(p, r, 'sub', 'pad'), fifth: true, gain: 0.035, cutoff: 900, detune: 16, attack: 1, release: 1.5 }),
                ];
            } },
            drive: { weight: 0, build: (s, r, p) => [
                new ImpactLane(s, r.fork('impact')),
                new KitLane(s, r.fork('kit'), { style: 'halfstep', kick: HARD_KICK, clap: 0.16, snare: 0.12, hat: 0.08, perc: 0.05, metal: 0.03 }),
                new FigureLane(s, r.fork('bass'), { gen: 'bass', instrument: 'reese', extra: { wobble: 4 }, root: true, lo: 28, hi: 43, bias: 1, repeat: 0.7, legato: 1 }),
                new FigureLane(s, r.fork('lead'), { gen: 'hook', instrument: role(p, r, 'sub', 'lead'), lo: 64, hi: 86, repeat: 0.7 }),
            ] },
            break: { weight: 0, build: (s, r, p) => [
                new ImpactLane(s, r.fork('impact'), { kind: 'down' }),
                new KitLane(s, r.fork('kit'), { style: 'halfstep', kick: DUB_KICK, kickGain: 0.4, clap: 0.05, hat: 0.05 }),
                new DroneLane(s, r.fork('voice'), { sample: role(p, r, 'sub', 'pad', 0.4), grain: { density: 2, size: [0.2, 0.6], octaves: [0, 1], reverse: 0.4 }, octave: 1, gain: 0.035, attack: 6, release: 8, reverb: 0.8, echo: 0.5 }),
                new PhraseLane(s, r.fork('lead'), { bpm: p.bpm, instrument: role(p, r, 'sub', 'lead', 0.4), lo: 64, hi: 86, rest: [4, 10], repeat: 0.7 }),
            ] },
        },
    },
];

for (const f of [...NEON_FORMATS, ...DUB_FORMATS]) PALETTES[f.id] = f.palette;

// A universe with formats keeps every format's scenes, named
// "<format>:<scene>", so tests and the scene override can reach all of them;
// each format gets the universe it plays in: the universe's fields, its own
// on top, and only its own scenes weighted.
function withFormats(u) {
    if (!u.formats) return u;
    u.scenes = {};
    for (const f of u.formats) {
        for (const [name, scene] of Object.entries(f.scenes)) u.scenes[`${f.id}:${name}`] = scene;
    }
    for (const f of u.formats) {
        const { scenes, opening, id, label, ...rest } = f;
        f.universe = {
            ...u,
            ...rest,
            formatId: id,
            format: label,
            opening: opening.map((o) => `${id}:${o}`),
            sceneWeights: Object.fromEntries(Object.entries(scenes).map(([name, s]) => [`${id}:${name}`, s.weight])),
        };
    }
    return u;
}

export const UNIVERSES = [
    {
        id: 'tide',
        name: 'Tide',
        color: '#7fb7c9',
        refs: 'Brian Eno, Harold Budd',
        blurb: 'Felt piano, glass and warm pads in slow, overlapping loops.',
        modes: [['lydian', 2], ['ionian', 2], ['mixolydian', 1], ['dorian', 1.5], ['aeolian', 1]],
        tonic: [43, 54],
        bpm: [60, 76],
        harmony: { holdMin: 40, holdMax: 100, pedalProb: 0.55 },
        reverb: { t60: [9, 16], damping: [6000, 9000] },
        echoBeats: 1.5,
        opening: ['drift', 'sparse'],
        scenes: {
            drift: { weight: 3, build: (s, r, p) => [
                new DroneLane(s, r.fork('drone'), { fifth: true, gain: 0.055, sub: 0.04 }),
                ...loops(s, r, p.brightness > 0.5 ? ['piano', 'celesta', 'swell', 'choir', 'piano', 'glass'] : ['piano', 'swell', 'choir', 'piano', 'swell', 'celesta'],
                    { count: 4 + Math.round(p.density * 2), octaves: { glass: 1, celesta: 1 } }),
            ] },
            sparse: { weight: 2, build: (s, r) => [
                new DroneLane(s, r.fork('drone'), { gain: 0.05, cutoff: 500, sub: 0.03 }),
                new WanderLane(s, r.fork('piano'), { mean: 6.5, lo: 55, hi: 81, instrument: 'piano', dyad: 0.3, useScale: true }),
                new WanderLane(s, r.fork('glass'), { mean: 23, lo: 79, hi: 96, instrument: 'celesta' }),
            ] },
            shimmer: { weight: 1.5, build: (s, r) => [
                new DroneLane(s, r.fork('drone'), { fifth: true, gain: 0.06, sub: 0.03 }),
                new DroneLane(s, r.fork('choir'), { preset: 'choir', octave: 3, gain: 0.05, attack: 9, detune: 10, cutoff: 3600, reverb: 0.8 }),
                new DroneLane(s, r.fork('strings'), { sample: 'strings', sampleOnly: true, octave: 2, upper: true, gain: 0.05, attack: 10, release: 10, stagger: 6, reverb: 0.75 }),
                new DroneLane(s, r.fork('gyroglass'), { sample: 'gyroglass', grain: { density: 6, size: [0.12, 0.5], octaves: [0, 1, 1], reverse: 0.2 }, octave: 2, gain: 0.04, attack: 12, release: 12, reverb: 0.85, echo: 0.15 }),
                new WanderLane(s, r.fork('glass'), { mean: 1.6, lo: 72, hi: 96, instrument: 'glass' }),
                new WanderLane(s, r.fork('bowl'), { mean: 19, lo: 55, hi: 72, instrument: 'bowl' }),
            ] },
        },
    },
    {
        id: 'cathedral',
        name: 'Cathedral',
        color: '#d9b77a',
        refs: 'Stars of the Lid, Kali Malone',
        blurb: 'Pipe-organ drones in just intonation; one chord can last minutes.',
        modes: [['ionian', 2], ['dorian', 2], ['aeolian', 2], ['mixolydian', 1]],
        tonic: [41, 50],
        tuning: 'just',
        bpm: [50, 60],
        // tonic pedal only, on degrees that stay pure over it
        harmony: { holdMin: 70, holdMax: 160, pedalProb: 1, roots: [0, 3, 4, 5], shapes: ['open', 'add9', 'sus2', 'quartal'] },
        reverb: { t60: [16, 22], damping: [4000, 6000], size: 2 },
        echoBeats: 2,
        opening: ['nave'],
        scenes: {
            nave: { weight: 3, build: (s, r) => [
                new DroneLane(s, r.fork('organ'), { voice: 'organ', preset: 'flue', fifth: true, upper: true, gain: 0.2, attack: 12, release: 14, stagger: 9, reverb: 0.8, sub: 0.04 }),
                new DroneLane(s, r.fork('pipes'), { sample: 'pipes', sampleOnly: true, octave: 0, fifth: true, gain: 0.09, attack: 14, release: 14, stagger: 10, reverb: 0.85 }),
            ] },
            chant: { weight: 2, build: (s, r) => [
                new DroneLane(s, r.fork('organ'), { voice: 'organ', preset: 'gedackt', fifth: true, gain: 0.14, attack: 10, release: 12, reverb: 0.8 }),
                new DroneLane(s, r.fork('monks'), { sample: 'monks', sampleOnly: true, octave: 1, gain: 0.07, attack: 9, release: 12, reverb: 0.85 }),
                new DroneLane(s, r.fork('veil'), { sample: 'choir', grain: { density: 5, size: [0.3, 0.9], octaves: [0, 0, 1], reverse: 0.3 }, octave: 3, gain: 0.04, attack: 14, release: 14, reverb: 0.9 }),
                ...loops(s, r, ['choir', 'voice', 'organ', 'choir'], { count: 4, octaves: { voice: 0, choir: 0, organ: 1 } }),
            ] },
            reed: { weight: 1.2, build: (s, r) => [
                new DroneLane(s, r.fork('organ'), { voice: 'organ', preset: 'reed', fifth: true, upper: true, gain: 0.16, attack: 14, release: 14, stagger: 12, reverb: 0.85 }),
                new DroneLane(s, r.fork('pipes'), { sample: 'pipes', sampleOnly: true, octave: 0, gain: 0.08, attack: 16, release: 14, reverb: 0.85 }),
                new WanderLane(s, r.fork('bowl'), { mean: 28, lo: 48, hi: 67, instrument: 'bowl' }),
            ] },
        },
    },
    {
        id: 'dub',
        name: 'Dub',
        color: '#8fae7d',
        refs: 'King Tubby, Mad Professor, Basic Channel, The Orb, Mala',
        blurb: 'Five kinds of dub: roots, steppers, dub techno, ambient dub and early dubstep.',
        // a format per station, like Neon (see DUB_FORMATS)
        formats: DUB_FORMATS,
    },
    {
        id: 'ice',
        name: 'Ice',
        color: '#a9c4e8',
        refs: 'Biosphere, Thomas Köner',
        blurb: 'Sub-bass under frozen noise resonances, with distant metal.',
        modes: [['lydian', 2], ['aeolian', 2], ['dorian', 1]],
        tonic: [40, 48],
        bpm: [60, 70],
        harmony: { holdMin: 60, holdMax: 140, pedalProb: 0.8, shapes: ['open', 'quartal', 'sus2'] },
        reverb: { t60: [14, 20], damping: [5000, 8000], size: 2 },
        echoBeats: 2,
        opening: ['glacier'],
        scenes: {
            glacier: { weight: 3, build: (s, r) => [
                new DroneLane(s, r.fork('drone'), { gain: 0.045, cutoff: 400, sub: 0.08 }),
                new ResonantLane(s, r.fork('res'), { harsh: 0.1, lo: 60, hi: 96, q: [60, 120], gain: 0.17, length: [16, 30] }),
                new ResonantLane(s, r.fork('res2'), { harsh: 0.1, lo: 72, hi: 100, q: [80, 140], gain: 0.11, length: [20, 34] }),
                new DroneLane(s, r.fork('thunder'), { sample: 'thunder', grain: { density: 4, size: [0.4, 1.2], octaves: [-1, 0, 0], reverse: 0.5, jitter: 20 }, octave: 0, gain: 0.05, attack: 12, release: 12, reverb: 0.5 }),
            ] },
            crack: { weight: 1.5, build: (s, r) => [
                new DroneLane(s, r.fork('drone'), { gain: 0.07, cutoff: 350, sub: 0.08 }),
                new WanderLane(s, r.fork('metal'), { mean: 11, lo: 40, hi: 60, instrument: 'metal' }),
                new WanderLane(s, r.fork('glass'), { mean: 7, lo: 84, hi: 100, instrument: 'glass' }),
                new DroneLane(s, r.fork('wind'), { sample: 'wind', grain: { density: 5, size: [0.3, 1.0], octaves: [0, 0, 1], reverse: 0.5, jitter: 30 }, octave: 2, gain: 0.04, attack: 10, release: 12, reverb: 0.6 }),
            ] },
            aurora: { weight: 2, build: (s, r) => [
                new DroneLane(s, r.fork('drone'), { gain: 0.04, cutoff: 400, sub: 0.06 }),
                new DroneLane(s, r.fork('high'), { preset: 'choir', octave: 3, upper: true, upperOctave: 1, gain: 0.07, attack: 14, detune: 14, cutoff: 4200, reverb: 0.9, stagger: 6 }),
                new FigureLane(s, r.fork('vibes'), { gen: 'arp', rate: 4, instrument: 'vibes', lo: 72, hi: 93, ring: true, repeat: 0.8, gain: 0.8 }),
                new WanderLane(s, r.fork('bow'), { mean: 16, lo: 67, hi: 91, instrument: 'glassbow' }),
                new DroneLane(s, r.fork('gyrobow'), { sample: 'gyrobow', grain: { density: 6, size: [0.1, 0.4], octaves: [0, 1], reverse: 0.25 }, octave: 2, fifth: true, gain: 0.035, attack: 14, release: 14, reverb: 0.9 }),
            ] },
        },
    },
    {
        id: 'garden',
        name: 'Garden',
        color: '#c6d07a',
        refs: 'Hiroshi Yoshimura, Midori Takada',
        blurb: 'Marimba and kalimba figures phasing over a breathy flute.',
        modes: [['pentMajor', 3], ['pentMinor', 2], ['hirajoshi', 0.6]],
        tonic: [45, 55],
        bpm: [84, 104],
        harmony: { holdMin: 30, holdMax: 70, pedalProb: 0.6 },
        reverb: { t60: [4, 7], damping: [7000, 10000], size: 1.2 },
        echoBeats: 0.75,
        opening: ['stream', 'grove'],
        scenes: {
            grove: { weight: 3, build: (s, r, p) => [
                new DroneLane(s, r.fork('drone'), { gain: 0.04, cutoff: 700, sub: 0.03 }),
                new OstinatoLane(s, r.fork('o1'), { bpm: p.bpm, length: r.pick([5, 7, 9]), instrument: 'marimba', lo: 55, hi: 74 }),
                new OstinatoLane(s, r.fork('o2'), { bpm: p.bpm, length: r.pick([6, 8, 11]), instrument: 'marimba', lo: 62, hi: 81, accent: 0.8 }),
                new FigureLane(s, r.fork('hook'), { gen: 'hook', instrument: 'kalimba', lo: 67, hi: 88, ring: true, repeat: 0.6, gain: 0.85 }),
                new FigureLane(s, r.fork('bass'), { gen: 'bass', instrument: 'marimba', root: true, lo: 43, hi: 60, bias: 2, ring: true, repeat: 0.7, gain: 0.7 }),
            ] },
            stream: { weight: 2.5, build: (s, r, p) => [
                new DroneLane(s, r.fork('drone'), { fifth: true, gain: 0.045, cutoff: 900, sub: 0.03 }),
                new PhraseLane(s, r.fork('flute'), { bpm: p.bpm, instrument: 'flute', lo: 67, hi: 88, rest: [6, 16] }),
                new WanderLane(s, r.fork('kalimba'), { mean: 2.4, lo: 64, hi: 86, instrument: 'kalimba', useScale: true }),
            ] },
            rain: { weight: 1.5, build: (s, r) => [
                new DroneLane(s, r.fork('drone'), { gain: 0.045, cutoff: 800, sub: 0.03 }),
                new WanderLane(s, r.fork('drops'), { mean: 0.55, lo: 74, hi: 93, instrument: 'marimba', useScale: true }),
                new FigureLane(s, r.fork('vibes'), { gen: 'walk', rate: 2, density: 0.6, instrument: 'vibes', lo: 60, hi: 79, ring: true, repeat: 0.7 }),
                new DroneLane(s, r.fork('gyrovibe'), { sample: 'gyrovibe', grain: { density: 5, size: [0.08, 0.3], octaves: [0, 1], reverse: 0.1 }, octave: 2, gain: 0.035, attack: 10, release: 10, reverb: 0.5, echo: 0.2 }),
            ] },
        },
    },
    {
        id: 'ash',
        name: 'Ash',
        color: '#c97a64',
        refs: 'Tim Hecker, Fennesz',
        blurb: 'Saturated, crushed textures: harsh, but always in key.',
        modes: [['aeolian', 2], ['phrygian', 1.2], ['dorian', 1], ['lydian', 0.8]],
        tonic: [40, 50],
        bpm: [70, 90],
        harmony: { holdMin: 40, holdMax: 90, pedalProb: 0.7, shapes: ['open', 'quartal', 'spread', 'add9'] },
        reverb: { t60: [10, 18], damping: [3500, 5500], size: 1.8 },
        echoBeats: 1.5,
        opening: ['smoke'],
        scenes: {
            burn: { weight: 3, build: (s, r, p) => [
                new DroneLane(s, r.fork('drone'), { fifth: true, gain: 0.07, sub: 0.06, drive: 0.5 + p.harsh * 0.4, cutoff: 1200, detune: 16 }),
                new ResonantLane(s, r.fork('res'), { harsh: 0.6 + p.harsh * 0.4 }),
                new ResonantLane(s, r.fork('res2'), { harsh: 0.6 + p.harsh * 0.4, lo: 40, hi: 70 }),
                new DroneLane(s, r.fork('grit'), { sample: 'grit', grain: { density: 10, size: [0.05, 0.25], octaves: [-1, 0, 0, 1], reverse: 0.3, jitter: 12 }, octave: 1, fifth: true, gain: 0.045, attack: 10, release: 10, stagger: 7, drive: 0.3 + p.harsh * 0.6, reverb: 0.7 }),
            ] },
            cinder: { weight: 2, build: (s, r) => [
                new DroneLane(s, r.fork('drone'), { gain: 0.09, sub: 0.06, drive: 0.4, crush: 4, bits: 7, cutoff: 900 }),
                new DroneLane(s, r.fork('buchla'), { sample: 'drone', sampleOnly: true, octave: 0, gain: 0.05, attack: 8, release: 10, cutoff: 2500, reverb: 0.6 }),
                ...loops(s, r, ['crush', 'piano', 'crush', 'glass'], { count: 4, octaves: { glass: 1 } }),
                new BedLane(s, r.fork('bed'), { gain: 0.02, tone: 7000, low: 500, crackle: 20 }),
            ] },
            smoke: { weight: 2, build: (s, r, p) => [
                new DroneLane(s, r.fork('drone'), { fifth: true, upper: true, gain: 0.08, drive: 0.3 + p.harsh * 0.3, cutoff: 1500, detune: 20, attack: 12, stagger: 8, reverb: 0.8 }),
                new WanderLane(s, r.fork('metal'), { mean: 12, lo: 36, hi: 58, instrument: 'metal' }),
                new DroneLane(s, r.fork('buchla'), { sample: 'drone', grain: { density: 3, size: [0.5, 1.5], octaves: [-1, 0, 0], reverse: 0.4 }, octave: 0, gain: 0.06, attack: 14, release: 12, drive: p.harsh * 0.5, reverb: 0.8 }),
            ] },
        },
    },
    {
        id: 'orbit',
        name: 'Orbit',
        color: '#b79ad9',
        refs: 'Boards of Canada, Aphex Twin',
        blurb: 'Wobbly analog melodies on worn tape, sometimes over a lazy beat.',
        modes: [['ionian', 1.5], ['dorian', 2], ['mixolydian', 1.5], ['aeolian', 1.5], ['lydian', 1]],
        tonic: [43, 53],
        bpm: [78, 94],
        swing: [0.05, 0.14],
        harmony: { holdMin: 24, holdMax: 60, pedalProb: 0.35, shapes: ['seventh', 'add9', 'spread', 'open'] },
        reverb: { t60: [5, 9], damping: [4000, 6000], size: 1.3 },
        echoBeats: 0.75,
        opening: ['tape'],
        scenes: {
            tape: { weight: 3, build: (s, r, p) => [
                new DroneLane(s, r.fork('drone'), { fifth: true, upper: true, gain: 0.045, cutoff: 1300, detune: 12, wow: 12, attack: 5 }),
                new PhraseLane(s, r.fork('lead'), { bpm: p.bpm, instrument: p.brightness > 0.45 ? 'mflute' : 'lead', lo: 60, hi: 82, rest: [4, 10] }),
                new DroneLane(s, r.fork('mstrings'), { sample: 'mstrings', sampleOnly: true, octave: 2, upper: true, gain: 0.035, attack: 8, release: 10, stagger: 5, wow: 14, reverb: 0.55 }),
                new BedLane(s, r.fork('bed'), { gain: 0.016, tone: 6000, crackle: 3 }),
            ] },
            beat: { weight: p0(0.6), build: (s, r, p) => [
                new DroneLane(s, r.fork('drone'), { fifth: true, upper: true, gain: 0.04, cutoff: 1100, detune: 12, wow: 14, sub: 0.05 }),
                new BeatLane(s, r.fork('beat'), { bpm: p.bpm, swing: s.grid.swing }),
                new FigureLane(s, r.fork('bass'), { gen: 'bass', instrument: 'dubbass', root: true, lo: 33, hi: 52, bias: 2, repeat: 0.7, legato: 0.85, gain: 0.55 }),
                new FigureLane(s, r.fork('keys'), { gen: 'hook', instrument: 'tine', lo: 60, hi: 79, repeat: 0.6, gain: 0.6 }),
                new PhraseLane(s, r.fork('lead'), { bpm: p.bpm, instrument: 'lead', lo: 62, hi: 84, rest: [10, 20] }),
                new BedLane(s, r.fork('bed'), { gain: 0.014, tone: 5000, crackle: 4 }),
            ] },
            lull: { weight: 2, build: (s, r) => [
                new DroneLane(s, r.fork('drone'), { fifth: true, upper: true, gain: 0.05, cutoff: 900, detune: 14, wow: 18, attack: 8 }),
                new FigureLane(s, r.fork('arp'), { gen: 'arp', rate: 2, instrument: 'vibes', lo: 64, hi: 86, ring: true, repeat: 0.7, gain: 0.85 }),
                ...loops(s, r, ['mflute', 'mstrings'], { count: 2, octaves: { mflute: 0, mstrings: 0 } }),
                new DroneLane(s, r.fork('gyrotape'), { sample: 'gyrotape', grain: { density: 4, size: [0.15, 0.6], octaves: [0, 1], reverse: 0.25, jitter: 15 }, octave: 2, gain: 0.035, attack: 10, release: 10, cutoff: 3500, reverb: 0.5, echo: 0.25 }),
                new BedLane(s, r.fork('bed'), { gain: 0.018, tone: 5000, crackle: 5 }),
            ] },
        },
    },
    {
        id: 'voices',
        name: 'Voices',
        color: '#e0a3b5',
        refs: 'Julianna Barwick, Grouper',
        blurb: 'Layered vocal swells and looped choirs in a wide room.',
        modes: [['ionian', 2], ['lydian', 2], ['mixolydian', 1], ['aeolian', 1.5]],
        tonic: [45, 55],
        bpm: [56, 70],
        harmony: { holdMin: 40, holdMax: 90, pedalProb: 0.6, shapes: ['add9', 'sus2', 'open', 'spread'] },
        reverb: { t60: [12, 18], damping: [6000, 9000], size: 1.9 },
        echoBeats: 1.5,
        opening: ['hymn'],
        scenes: {
            hymn: { weight: 3, build: (s, r) => [
                new DroneLane(s, r.fork('drone'), { preset: 'voice', fifth: true, upper: true, gain: 0.05, attack: 8, stagger: 6, oscs: 5, detune: 14, cutoff: 3600, reverb: 0.8, sub: 0.03 }),
                ...loops(s, r, ['voice', 'voice', 'voice'], { count: 3, octaves: { voice: 1 } }),
                new DroneLane(s, r.fork('mchoir'), { sample: 'mchoir', sampleOnly: true, octave: 1, upper: true, gain: 0.05, attack: 9, release: 12, stagger: 6, reverb: 0.8 }),
            ] },
            loop: { weight: 2.5, build: (s, r) => [
                new DroneLane(s, r.fork('drone'), { preset: 'voice', fifth: true, gain: 0.045, oscs: 5, detune: 12, cutoff: 3000, reverb: 0.8 }),
                ...loops(s, r, ['voice', 'mchoir', 'voice', 'choir', 'celesta'], { count: 5, octaves: { voice: 0, mchoir: 0, choir: 0, celesta: 1 } }),
                new DroneLane(s, r.fork('gyrovox'), { sample: 'gyrovox', grain: { density: 4, size: [0.2, 0.6], octaves: [0, 1], reverse: 0.2 }, octave: 2, gain: 0.035, attack: 12, release: 12, reverb: 0.85 }),
            ] },
            veil: { weight: 1.5, build: (s, r) => [
                new DroneLane(s, r.fork('drone'), { preset: 'voice', octave: 2, upper: true, gain: 0.09, attack: 10, oscs: 5, detune: 16, cutoff: 3200, reverb: 0.9, stagger: 8 }),
                new WanderLane(s, r.fork('piano'), { mean: 7, lo: 55, hi: 79, instrument: 'piano', useScale: true, dyad: 0.2 }),
                new DroneLane(s, r.fork('smear'), { sample: 'ooh', grain: { density: 6, size: [0.25, 0.8], octaves: [0, 0, 1], reverse: 0.35 }, octave: 2, gain: 0.04, attack: 12, release: 14, reverb: 0.9 }),
            ] },
        },
    },
    {
        id: 'neon',
        name: 'Neon',
        color: '#ff4a2e',
        refs: 'Cyberpunk 2077 and its radio, Vangelis, Carpenter Brut',
        blurb: 'Night City on six frequencies: the score, acid techno, industrial, outrun, trap and rain.',
        // a format per station, like the city's radio: each has its own tempo,
        // key, sounds and song shape (see NEON_FORMATS)
        formats: NEON_FORMATS,
    },
    {
        id: 'abyss',
        name: 'Abyss',
        color: '#2fb3a0',
        refs: 'Drexciya, Biosphere',
        blurb: 'Pressure, sonar and whale song, and an electro pulse from the deep.',
        modes: [['aeolian', 2], ['dorian', 2], ['phrygian', 1]],
        tonic: [38, 46],
        bpm: [118, 130],
        swing: [0, 0.06],
        harmony: { holdMin: 50, holdMax: 120, pedalProb: 0.7, shapes: ['open', 'quartal', 'sus2', 'seventh'] },
        reverb: { t60: [10, 16], damping: [2500, 4500], size: 1.9 },
        echoBeats: 0.75,
        opening: ['trench'],
        scenes: {
            trench: { weight: 3, build: (s, r, p) => [
                new DroneLane(s, r.fork('drone'), { gain: 0.05, cutoff: 350, sub: 0.09 }),
                new ResonantLane(s, r.fork('pressure'), { harsh: 0.2, lo: 36, hi: 62, q: [40, 90], gain: 0.1, length: [16, 28] }),
                new WanderLane(s, r.fork('sonar'), { mean: 9, lo: 74, hi: 93, instrument: 'ping' }),
                new PhraseLane(s, r.fork('whale'), { bpm: p.bpm / 2, instrument: 'whale', lo: 55, hi: 79, rest: [6, 14], repeat: 0.5 }),
                new DroneLane(s, r.fork('thunder'), { sample: 'thunder', grain: { density: 3, size: [0.5, 1.4], octaves: [-1, -1, 0], reverse: 0.5, jitter: 25 }, octave: 0, gain: 0.05, attack: 12, release: 12, cutoff: 900, reverb: 0.6 }),
            ] },
            electro: { weight: 2.5, build: (s, r) => [
                new DroneLane(s, r.fork('drone'), { gain: 0.04, cutoff: 400, sub: 0.03 }),
                new KitLane(s, r.fork('kit'), { style: 'electro', kick: ELECTRO_KICK, clap: 0.2, hat: 0.09, perc: 0.07 }),
                new FigureLane(s, r.fork('bass'), { gen: 'bass', instrument: 'ebass', root: true, lo: 29, hi: 48, bias: 1, repeat: 0.6, legato: 0.7 }),
                new FigureLane(s, r.fork('sonar'), { gen: 'splatter', bias: 1, instrument: 'ping', lo: 67, hi: 91, ring: true, repeat: 0.7, gain: 0.8 }),
                new FigureLane(s, r.fork('stabs'), { gen: 'chord', hits: [1, 3], instrument: 'stab', lo: 50, hi: 70, repeat: 0.8, gain: 1.1 }),
            ] },
            glow: { weight: 1.5, build: (s, r) => [
                new DroneLane(s, r.fork('drone'), { gain: 0.04, cutoff: 400, sub: 0.07 }),
                new DroneLane(s, r.fork('high'), { preset: 'choir', octave: 3, upper: true, gain: 0.04, attack: 12, detune: 12, cutoff: 2600, reverb: 0.9, stagger: 6 }),
                new FigureLane(s, r.fork('lights'), { gen: 'arp', rate: 2, instrument: 'ping', lo: 72, hi: 96, ring: true, repeat: 0.8, gain: 1 }),
                new DroneLane(s, r.fork('gyrobow'), { sample: 'gyrobow', grain: { density: 5, size: [0.1, 0.4], octaves: [0, 1], reverse: 0.3 }, octave: 2, gain: 0.03, attack: 14, release: 14, cutoff: 3000, reverb: 0.9 }),
            ] },
        },
    },
    {
        id: 'bronze',
        name: 'Bronze',
        color: '#d08a2c',
        refs: 'Balinese gamelan, Steve Reich',
        blurb: 'Interlocking bronze: saron and bonang figures turning over slow gongs.',
        modes: [['pelog', 2], ['hirajoshi', 1.5], ['pentMinor', 1], ['pentMajor', 1]],
        tonic: [45, 53],
        bpm: [76, 96],
        harmony: { holdMin: 60, holdMax: 140, pedalProb: 0.8, shapes: ['open', 'sus2', 'quartal', 'add9'] },
        reverb: { t60: [5, 9], damping: [6000, 9000], size: 1.5 },
        echoBeats: 1,
        opening: ['gong'],
        scenes: {
            kotekan: { weight: 3, build: (s, r) => {
                // polos and sangsih: one figure, split into on and off sixteenths
                const pair = r.fork('kotekan');
                return [
                    new DroneLane(s, r.fork('drone'), { gain: 0.035, cutoff: 600, sub: 0.03 }),
                    new CycleLane(s, r.fork('gong'), { bars: 4, instrument: 'gong', octave: 1 }),
                    new CycleLane(s, r.fork('kempul'), { bars: 1, instrument: 'saron', octave: 2, gain: 0.5 }),
                    new FigureLane(s, r.fork('balungan'), { gen: 'walk', rate: 4, density: 0.95, instrument: 'saron', lo: 57, hi: 76, repeat: 0.75, legato: 1 }),
                    new FigureLane(s, pair, { gen: 'line', interlock: 0, instrument: 'bonang', lo: 67, hi: 88, repeat: 0.75, legato: 1.5, pan: -0.45, gain: 0.8 }),
                    new FigureLane(s, pair, { gen: 'line', interlock: 1, instrument: 'bonang', lo: 67, hi: 88, repeat: 0.75, legato: 1.5, pan: 0.45, gain: 0.8 }),
                ];
            } },
            gong: { weight: 2, build: (s, r) => [
                new DroneLane(s, r.fork('drone'), { fifth: true, gain: 0.04, cutoff: 700, sub: 0.03 }),
                new CycleLane(s, r.fork('gong'), { bars: 2, instrument: 'gong', octave: 1 }),
                new FigureLane(s, r.fork('saron'), { gen: 'walk', rate: 4, density: 0.6, instrument: 'saron', lo: 55, hi: 74, ring: true, repeat: 0.8 }),
                new WanderLane(s, r.fork('bow'), { mean: 14, lo: 67, hi: 88, instrument: 'glassbow' }),
                new DroneLane(s, r.fork('gyrovibe'), { sample: 'gyrovibe', grain: { density: 4, size: [0.1, 0.4], octaves: [0, 1], reverse: 0.2 }, octave: 2, gain: 0.03, attack: 12, release: 12, reverb: 0.6 }),
            ] },
            mist: { weight: 1.5, build: (s, r) => [
                new DroneLane(s, r.fork('drone'), { preset: 'choir', octave: 2, upper: true, gain: 0.065, attack: 10, detune: 10, cutoff: 2800, reverb: 0.8, stagger: 6, sub: 0.03 }),
                new FigureLane(s, r.fork('bonang'), { gen: 'arp', rate: 2, instrument: 'bonang', lo: 69, hi: 91, ring: true, repeat: 0.8, gain: 1.1 }),
                new FigureLane(s, r.fork('saron'), { gen: 'walk', rate: 8, density: 0.8, instrument: 'saron', lo: 52, hi: 69, ring: true, repeat: 0.8, gain: 1.2 }),
                new WanderLane(s, r.fork('bowl'), { mean: 20, lo: 48, hi: 67, instrument: 'bowl' }),
            ] },
        },
    },
];

// beat scenes appear only on stations whose pulse number allows it
function p0(weight) {
    return (piece) => weight * (piece.pulse > 0 ? 3 : 0);
}

export const UNIVERSE_IDS = UNIVERSES.map((u) => u.id);

UNIVERSES.forEach(withFormats);

export function getUniverse(id) {
    return UNIVERSES.find((u) => u.id === id) || null;
}
