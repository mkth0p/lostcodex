import {
    BeatLane, BedLane, DroneLane, LoopLane, OstinatoLane, PhraseLane, PulseLane, ResonantLane, WanderLane,
} from './score/lanes.js';

// A universe is a whole sound world: its scales, tuning, tempo, harmony
// pace, room, and the scenes it moves between. A code picks a station inside
// one universe; the numbers it draws (brightness, density, harshness) shade
// the scenes without leaving the world.

const LOOP_PERIODS = [17.3, 19.7, 23.1, 26.9, 29.3, 31.7, 37.1, 41.3];

// Deep and round like Basic Channel, but saturated with a short knock so it
// still reads on laptop and phone speakers.
const DUB_KICK = { tone: 1400, punch: 105, sweep: 0.045, decay: 0.6, click: 0.5, drive: 1.0 };

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
        refs: 'Gas, Basic Channel',
        blurb: 'A deep kick in the fog, chord stabs dissolving into long echoes.',
        modes: [['dorian', 3], ['aeolian', 2], ['mixolydian', 1]],
        tonic: [43, 52],
        bpm: [108, 124],
        harmony: { holdMin: 50, holdMax: 120, pedalProb: 0.7, shapes: ['seventh', 'add9', 'quartal', 'spread'] },
        reverb: { t60: [6, 10], damping: [4500, 6500] },
        echoBeats: 0.75,
        opening: ['fog'],
        scenes: {
            pulse: { weight: 3, build: (s, r, p) => [
                new DroneLane(s, r.fork('drone'), { gain: 0.06, cutoff: 600, sub: 0.07 }),
                new PulseLane(s, r.fork('pulse'), { bpm: p.bpm, kick: 0.16, kickShape: DUB_KICK, stabSample: p.brightness > 0.4 ? 'tine' : null }),
                new BedLane(s, r.fork('bed'), { gain: 0.012, tone: 5000, crackle: 6 }),
            ] },
            fog: { weight: 2, build: (s, r, p) => [
                new DroneLane(s, r.fork('drone'), { fifth: true, gain: 0.06, cutoff: 700, sub: 0.05 }),
                new DroneLane(s, r.fork('dubpad'), { sample: 'dubpad', sampleOnly: true, octave: 1, upper: true, gain: 0.04, attack: 8, release: 10, cutoff: 1400, stagger: 5, reverb: 0.6 }),
                new DroneLane(s, r.fork('smear'), { sample: 'tine', grain: { density: 3, size: [0.05, 0.2], octaves: [0, 1], reverse: 0.15 }, octave: 1, gain: 0.035, attack: 10, release: 10, cutoff: 2200, reverb: 0.4, echo: 0.7 }),
                new PulseLane(s, r.fork('pulse'), { bpm: p.bpm, kick: 0.1, kickShape: DUB_KICK, ticks: 0, stabGain: 0.12, stabSample: 'tine' }),
                new BedLane(s, r.fork('bed'), { gain: 0.016, tone: 4000, crackle: 10 }),
                new WanderLane(s, r.fork('choir'), { mean: 14, lo: 60, hi: 79, instrument: 'mchoir' }),
            ] },
            deep: { weight: 1.5, build: (s, r, p) => [
                new DroneLane(s, r.fork('drone'), { gain: 0.05, cutoff: 450, sub: 0.09 }),
                new PulseLane(s, r.fork('pulse'), { bpm: p.bpm, kick: 0.17, kickShape: DUB_KICK, ticks: 0.1, stabCutoff: 500, stabGain: 0.08 }),
                new BedLane(s, r.fork('bed'), { gain: 0.01, tone: 3000, crackle: 4 }),
            ] },
        },
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
                new WanderLane(s, r.fork('vibes'), { mean: 9, lo: 72, hi: 91, instrument: 'vibes' }),
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
                new OstinatoLane(s, r.fork('o3'), { bpm: p.bpm, perBeat: 1, length: r.pick([4, 5]), instrument: 'kalimba', lo: 67, hi: 86, rest: 0.5, accent: 0.8 }),
            ] },
            stream: { weight: 2.5, build: (s, r, p) => [
                new DroneLane(s, r.fork('drone'), { fifth: true, gain: 0.045, cutoff: 900, sub: 0.03 }),
                new PhraseLane(s, r.fork('flute'), { bpm: p.bpm, instrument: 'flute', lo: 67, hi: 88, rest: [6, 16] }),
                new WanderLane(s, r.fork('kalimba'), { mean: 2.4, lo: 64, hi: 86, instrument: 'kalimba', useScale: true }),
            ] },
            rain: { weight: 1.5, build: (s, r, p) => [
                new DroneLane(s, r.fork('drone'), { gain: 0.045, cutoff: 800, sub: 0.03 }),
                new WanderLane(s, r.fork('drops'), { mean: 0.55, lo: 74, hi: 93, instrument: 'marimba', useScale: true }),
                new OstinatoLane(s, r.fork('o1'), { bpm: p.bpm * 0.5, length: 7, instrument: 'vibes', lo: 60, hi: 76, rest: 0.4 }),
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
                new BeatLane(s, r.fork('beat'), { bpm: p.bpm }),
                new PhraseLane(s, r.fork('lead'), { bpm: p.bpm, instrument: 'lead', lo: 62, hi: 84, rest: [6, 14] }),
                new BedLane(s, r.fork('bed'), { gain: 0.014, tone: 5000, crackle: 4 }),
            ] },
            lull: { weight: 2, build: (s, r, p) => [
                new DroneLane(s, r.fork('drone'), { fifth: true, upper: true, gain: 0.05, cutoff: 900, detune: 14, wow: 18, attack: 8 }),
                new OstinatoLane(s, r.fork('arp'), { bpm: p.bpm, perBeat: 2, length: r.pick([6, 8]), instrument: 'vibes', lo: 64, hi: 84, rest: 0.25, useScale: false }),
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
];

// beat scenes appear only on stations whose pulse number allows it
function p0(weight) {
    return (piece) => weight * (piece.pulse > 0 ? 3 : 0);
}

export const UNIVERSE_IDS = UNIVERSES.map((u) => u.id);

export function getUniverse(id) {
    return UNIVERSES.find((u) => u.id === id) || null;
}
