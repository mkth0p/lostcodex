'use strict';

// ============================================================
// DATA
// ============================================================
const GLYPHS = [
    'ᚠ', 'ᚢ', 'ᚦ', 'ᚨ', 'ᚱ', 'ᚲ', 'ᚷ', 'ᚹ', 'ᚺ', 'ᚾ',
    'ᛁ', 'ᛃ', 'ᛇ', 'ᛈ', 'ᛉ', 'ᛋ', 'ᛏ', 'ᛒ', 'ᛖ', 'ᛗ',
    'ᛚ', 'ᛜ', 'ᛞ', 'ᛟ', 'ᛥ', 'ᛦ', 'ᛢ', 'ᛣ', '᛬', '᛭'
];

// Per-biome audio configs — fmRatio/fmIndex = FM synthesis, grain* = granular layer,
// chorus* = stereo widener, sidechainAmt = how much rhythmic pulse ducks the pads
const AUDIO_CONFIGS = {
    //              drone    pad      revMul  filtBase  delFb  lfoMul  noiseM  melOcts      melWaves                octSc  fmR    fmI   grainD grainP grainSz  choW  choD  sideAmt
    crystalline: { droneWave: 'sine', padWave: 'sine', reverbMul: 2.2, filterBase: 900, delayFb: 0.55, lfoMul: 0.4, noiseMul: 0.3, melodyOcts: [3, 4, 5], melodyWaves: ['bell', 'sine'], octScale: 3, fmRatio: 3.0, fmIndex: 18, grainDensity: 3.0, grainPitchScatter: 12, grainSize: 55, chorusWet: 0.52, chorusDepth: 5, sidechainAmt: 0.05 },
    volcanic: { droneWave: 'sawtooth', padWave: 'sawtooth', reverbMul: 0.6, filterBase: 500, delayFb: 0.2, lfoMul: 2.0, noiseMul: 2.0, melodyOcts: [1, 2], melodyWaves: ['sawtooth', 'square'], octScale: 1, fmRatio: 1.41, fmIndex: 110, grainDensity: 7.0, grainPitchScatter: 3, grainSize: 22, chorusWet: 0.08, chorusDepth: 2, sidechainAmt: 0.45 },
    psychedelic: { droneWave: 'square', padWave: 'square', reverbMul: 1.3, filterBase: 1800, delayFb: 0.6, lfoMul: 3.0, noiseMul: 1.2, melodyOcts: [2, 3, 4], melodyWaves: ['wood', 'square'], octScale: 2, fmRatio: 2.0, fmIndex: 60, grainDensity: 5.5, grainPitchScatter: 35, grainSize: 35, chorusWet: 0.60, chorusDepth: 12, sidechainAmt: 0.35 },
    desert: { droneWave: 'sine', padWave: 'triangle', reverbMul: 1.0, filterBase: 700, delayFb: 0.4, lfoMul: 0.5, noiseMul: 1.8, melodyOcts: [2, 3], melodyWaves: ['wood', 'triangle'], octScale: 2, fmRatio: 5.0, fmIndex: 30, grainDensity: 1.2, grainPitchScatter: 8, grainSize: 80, chorusWet: 0.15, chorusDepth: 3, sidechainAmt: 0.10 },
    oceanic: { droneWave: 'sine', padWave: 'sine', reverbMul: 1.8, filterBase: 600, delayFb: 0.65, lfoMul: 0.3, noiseMul: 0.8, melodyOcts: [2, 3, 4], melodyWaves: ['bell', 'sine'], octScale: 3, fmRatio: 2.0, fmIndex: 22, grainDensity: 2.5, grainPitchScatter: 6, grainSize: 90, chorusWet: 0.40, chorusDepth: 8, sidechainAmt: 0.08 },
    corrupted: { droneWave: 'sawtooth', padWave: 'square', reverbMul: 3.0, filterBase: 2500, delayFb: 0.75, lfoMul: 5.0, noiseMul: 2.5, melodyOcts: [1, 2, 3], melodyWaves: ['sawtooth', 'square'], octScale: 2, fmRatio: 1.0, fmIndex: 180, grainDensity: 8.0, grainPitchScatter: 45, grainSize: 18, chorusWet: 0.30, chorusDepth: 18, sidechainAmt: 0.50 },
    barren: { droneWave: 'sine', padWave: 'sine', reverbMul: 3.5, filterBase: 300, delayFb: 0.3, lfoMul: 0.1, noiseMul: 0.1, melodyOcts: [3, 4], melodyWaves: ['sine'], octScale: 4, fmRatio: 4.0, fmIndex: 8, grainDensity: 0.4, grainPitchScatter: 2, grainSize: 120, chorusWet: 0.04, chorusDepth: 1, sidechainAmt: 0.0 },
    organic: { droneWave: 'triangle', padWave: 'triangle', reverbMul: 0.5, filterBase: 2000, delayFb: 0.35, lfoMul: 1.5, noiseMul: 1.5, melodyOcts: [2, 3, 4], melodyWaves: ['wood', 'sine'], octScale: 2, fmRatio: 2.5, fmIndex: 45, grainDensity: 4.0, grainPitchScatter: 18, grainSize: 40, chorusWet: 0.25, chorusDepth: 6, sidechainAmt: 0.15 },
    ethereal: { droneWave: 'sine', padWave: 'sine', reverbMul: 1.6, filterBase: 1200, delayFb: 0.7, lfoMul: 0.2, noiseMul: 0.4, melodyOcts: [3, 4, 5], melodyWaves: ['bell', 'triangle'], octScale: 4, fmRatio: 3.5, fmIndex: 12, grainDensity: 1.5, grainPitchScatter: 22, grainSize: 100, chorusWet: 0.70, chorusDepth: 9, sidechainAmt: 0.0 },
};

const BIOMES = [
    { id: 'crystalline', name: 'CRYSTALLINE VOID', desc: 'A world of permanent winter where time moves differently. Mathematical crystal formations stretch kilometres high.', colors: ['#0a1a3a', '#0d2f5c', '#1a4a7a', '#2a6aa5', '#4fc3f7'], glowColor: '#4fc3f7', soundProfile: 'SPARSE · GLACIAL · RESONANT', atmosphere: 'THIN  NITROGEN-METHANE', reverbLabel: 'CATHEDRAL — 12s' },
    { id: 'volcanic', name: 'MOLTEN DEEP', desc: 'Tectonic fury shapes every surface in perpetual transformation. Pillars of cooled obsidian pierce sulphuric clouds.', colors: ['#2a0800', '#4a1200', '#802000', '#c83800', '#ff5722'], glowColor: '#ff5722', soundProfile: 'DENSE · GRINDING · DEEP', atmosphere: 'THICK  SULPHUR-CO₂', reverbLabel: 'CAVE — 4s' },
    { id: 'psychedelic', name: 'TOXIC BLOOM', desc: 'Strange chemistry produces breathtaking, lethal beauty. Bio-luminescent ecosystems pulse to forgotten rhythms.', colors: ['#0a1e00', '#164000', '#1a6b1a', '#50c030', '#76ff03'], glowColor: '#76ff03', soundProfile: 'PULSING · WARPED · PRISMATIC', atmosphere: 'DENSE  AMMONIA-METHANE', reverbLabel: 'HALL — 8s' },
    { id: 'desert', name: 'ANCIENT SANDS', desc: 'Erosion has had aeons to work its patient art. Enormous sand-carved monuments dwarf any known civilisation.', colors: ['#2a1800', '#4a2e00', '#7a5020', '#b07030', '#ffb74d'], glowColor: '#ffb74d', soundProfile: 'SPARSE · WINDSWEPT · DRY', atmosphere: 'THIN  CO₂-DUST', reverbLabel: 'OPEN — 6s' },
    { id: 'oceanic', name: 'ABYSSAL DEEP', desc: 'Oceanic pressure has birthed peculiar luminescent life drifting in slow thermal currents kilometres below the surface.', colors: ['#00091a', '#001a33', '#00335a', '#0060a0', '#0288d1'], glowColor: '#4dd0e1', soundProfile: 'FLOWING · DEEP · RESONANT', atmosphere: 'WATER-VAPOUR — VAST OCEAN', reverbLabel: 'AQUATIC — 10s' },
    { id: 'corrupted', name: 'CORRUPTED STRATUM', desc: 'Reality itself seems unstable here. Gravitational anomalies and electromagnetic storms defy all cataloguing attempts.', colors: ['#0d0020', '#1a0040', '#350070', '#6000c0', '#7c4dff'], glowColor: '#d500f9', soundProfile: 'GLITCHED · DARK · FRACTURED', atmosphere: 'ANOMALOUS — DATA CORRUPT', reverbLabel: 'INFINITE — ∞s' },
    { id: 'barren', name: 'BARREN EXPANSE', desc: 'Nothing grows, nothing moves. Pure geometry and silence, interrupted only by the distant pulse of stellar wind.', colors: ['#0e0e0e', '#1c1c1c', '#2e2e2e', '#444444', '#666666'], glowColor: '#9e9e9e', soundProfile: 'MINIMAL · SPARSE · STILL', atmosphere: 'VACUUM — NO ATMOSPHERE', reverbLabel: 'VOID — 15s' },
    { id: 'organic', name: 'VERDANT LABYRINTH', desc: 'Life runs rampant in endless recursive patterns. The canopy is so dense that the sky has not been seen in millennia.', colors: ['#001a04', '#00330a', '#005510', '#008820', '#00e676'], glowColor: '#00e676', soundProfile: 'LUSH · BREATHING · ALIVE', atmosphere: 'RICH  OXYGEN-NITROGEN', reverbLabel: 'FOREST — 3s' },
    { id: 'ethereal', name: 'PHANTOM DRIFT', desc: 'The atmosphere carries whispers of civilisations long dissolved. Holographic echoes flicker perpetually at vision\'s edge.', colors: ['#0d0d2e', '#1a1a50', '#2a2a7a', '#5050b0', '#9fa8da'], glowColor: '#9fa8da', soundProfile: 'HAUNTED · SOFT · TRANSCENDENT', atmosphere: 'SPARSE  NOBLE-GAS MIX', reverbLabel: 'CHAMBER — 9s' },
];

const SCALES = {
    'Dorian': [0, 2, 3, 5, 7, 9, 10],
    'Phrygian': [0, 1, 3, 5, 7, 8, 10],
    'Lydian': [0, 2, 4, 6, 7, 9, 11],
    'Mixolydian': [0, 2, 4, 5, 7, 9, 10],
    'Aeolian': [0, 2, 3, 5, 7, 8, 10],
    'Whole Tone': [0, 2, 4, 6, 8, 10],
    'Pent. Minor': [0, 3, 5, 7, 10],
    'Persian': [0, 1, 4, 5, 6, 8, 11],
    'Enigmatic': [0, 1, 4, 6, 8, 10, 11],
};

const ROOT_NOTES = [32.7, 36.7, 41.2, 43.7, 49.0, 55.0, 61.7, 65.4, 73.4, 82.4, 87.3, 98.0];

// ============================================================
// SEEDED RNG — cyrb53 hash + Mulberry32
// ============================================================
function cyrb53(str, seed = 0) {
    let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
    for (let i = 0, ch; i < str.length; i++) {
        ch = str.charCodeAt(i);
        h1 = Math.imul(h1 ^ ch, 2654435761);
        h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

class RNG {
    constructor(seed) { this.s = (seed >>> 0) || 1; }
    next() {
        let t = this.s += 0x6D2B79F5;
        t = Math.imul(t ^ t >>> 15, t | 1);
        t ^= t + Math.imul(t ^ t >>> 7, t | 61);
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    }
    range(lo, hi) { return lo + this.next() * (hi - lo); }
    int(lo, hi) { return lo + (this.next() * (hi - lo) | 0); }
    pick(arr) { return arr[this.int(0, arr.length)]; }
    bool(p = 0.5) { return this.next() < p; }
}

function hashAddress(addr) {
    if (!addr) return 1;
    let h = 5381;
    for (let i = 0; i < addr.length; i++) h = (Math.imul(h, 33) ^ addr.charCodeAt(i)) >>> 0;
    return h || 1;
}

// ============================================================
// PLANET GENERATOR
// ============================================================
function generatePlanet(address) {
    const seed = hashAddress(address || 'ᚠᚢᚦ');
    const rng = new RNG(seed);

    const biome = BIOMES[rng.int(0, BIOMES.length)];
    const scaleKeys = Object.keys(SCALES);
    const scaleName = rng.pick(scaleKeys);
    const scale = SCALES[scaleName];
    const rootFreq = rng.pick(ROOT_NOTES);

    // Alien name
    const syls = ['zra', 'tho', 'vel', 'kry', 'mnu', 'phe', 'shio', 'xnu', 'yss', 'drae', 'fryu', 'glon', 'spei', 'nyao', 'vren', 'bluu', 'kreth', 'aevon', 'thrix', 'zumar', 'veq', 'iith', 'nnor'];
    const ends = ['is', 'an', 'on', 'ar', 'ix', 'us', 'ae', 'or', 'ia', 'yx', 'eth', 'un', 'ael', 'orn'];
    let pname = '';
    for (let i = 0; i < rng.int(2, 4); i++) pname += rng.pick(syls);
    pname += rng.pick(ends);
    pname = pname[0].toUpperCase() + pname.slice(1);

    const hex1 = (seed & 0xFFFF).toString(16).toUpperCase().padStart(4, '0');
    const hex2 = ((seed >>> 16) & 0xFF).toString(16).toUpperCase().padStart(2, '0');

    const ac = AUDIO_CONFIGS[biome.id];
    return {
        seed, address, pname,
        designation: `PL-${hex1}-${hex2}`,
        biome, scaleName, scale, rootFreq,
        colors: biome.colors,
        numMoons: rng.int(0, 4),
        hasRings: rng.bool(0.25),
        hasClouds: rng.bool(0.6),
        ringTilt: rng.range(0.12, 0.4),
        cloudOpac: rng.range(0.1, 0.4),
        atmOpac: rng.range(0.35, 0.75),
        reverbDecay: rng.range(3, 8) * ac.reverbMul,
        droneDetune: rng.range(2, 14),
        padDetune: rng.range(4, 22),
        filterFreq: ac.filterBase + rng.range(-200, 800),
        lfoRate: rng.range(0.03, 0.25) * ac.lfoMul,
        noiseLevel: rng.range(0.02, 0.12) * ac.noiseMul,
        bpm: rng.int(60, 140),
        useJI: rng.bool(0.4), // 40% chance of Just Intonation / Microtonal tuning
        jiRatios: [1, 16 / 15, 9 / 8, 6 / 5, 5 / 4, 4 / 3, 45 / 32, 3 / 2, 8 / 5, 5 / 3, 9 / 5, 15 / 8],
        motif: [rng.pick(scale), rng.pick(scale), rng.pick(scale), rng.pick(scale)],
        ac,
    };
}

// ============================================================
// AUDIO ENGINE
// ============================================================
class AudioEngine {
    constructor() {
        this.ctx = null; this.masterGain = null;
        this.reverbGain = null; this.dryGain = null;
        this.analyser = null; this.nodes = []; this.intervals = [];
        this.playing = false; this.planet = null; this.lastStep = undefined;
        this._vol = 0.7; this._reverb = 0.6; this._drift = 0.4; this._density = 0.5;
        this._granularEnabled = true; // Tier 3 toggle
        this._percussionEnabled = true; // Percussion toggle
        this.tension = 0;
        this._resetSteps();
    }

    _resetSteps() {
        this.stepNote = 0; this.stepGrain = 0; this.stepPerc = 0; this.stepFX = 0;
    }

    _boot() {
        if (!this.ctx) {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
            this.analyser = this.ctx.createAnalyser();
            this.analyser.fftSize = 512;

            // 3-Band EQ (Tier 5 Mixer)
            this.eqLow = this.ctx.createBiquadFilter();
            this.eqLow.type = 'lowshelf'; this.eqLow.frequency.value = 250;
            this.eqMid = this.ctx.createBiquadFilter();
            this.eqMid.type = 'peaking'; this.eqMid.frequency.value = 1000; this.eqMid.Q.value = 1;
            this.eqHigh = this.ctx.createBiquadFilter();
            this.eqHigh.type = 'highshelf'; this.eqHigh.frequency.value = 4000;

            this.masterGain = this.ctx.createGain();
            this.masterGain.gain.value = this._vol;

            this.eqLow.connect(this.eqMid);
            this.eqMid.connect(this.eqHigh);
            this.eqHigh.connect(this.masterGain);
            this.masterGain.connect(this.analyser);
            this.analyser.connect(this.ctx.destination);
            // Set up AudioListener for HRTF spatial audio (Tier 3)
            const L = this.ctx.listener;
            if (L.positionX) {
                L.positionX.value = 0; L.positionY.value = 1.6; L.positionZ.value = 0;
                L.forwardX.value = 0; L.forwardY.value = 0; L.forwardZ.value = -1;
                L.upX.value = 0; L.upY.value = 1; L.upZ.value = 0;
            } else if (L.setPosition) {
                L.setPosition(0, 1.6, 0);
                L.setOrientation(0, 0, -1, 0, 1, 0);
            }
        }
        if (this.ctx.state === 'suspended') this.ctx.resume();
    }

    _buildReverb(decay, seed) {
        const ctx = this.ctx;
        const rng = new RNG(seed || 0);
        const len = ctx.sampleRate * Math.max(2, decay);
        const ir = ctx.createBuffer(2, len, ctx.sampleRate);
        for (let c = 0; c < 2; c++) {
            const d = ir.getChannelData(c);
            // Early reflections
            [0.015, 0.025, 0.04, 0.06, 0.09].forEach((t, i) => {
                const p = Math.round(t * ctx.sampleRate);
                if (p < len) d[p] += (0.7 - i * 0.12) * (rng.range(0, 1) > .5 ? 1 : -1);
            });
            // Diffuse tail
            for (let i = 0; i < len; i++) {
                const t = i / len;
                if (i > 0.04 * ctx.sampleRate)
                    d[i] += rng.range(-1, 1) * Math.pow(1 - t, 1.6) * 0.55;
            }
        }
        const conv = ctx.createConvolver();
        conv.buffer = ir;
        return conv;
    }

    _osc(type, freq, gain, dest) {
        const o = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        o.type = type; o.frequency.value = freq; g.gain.value = gain;
        o.connect(g); g.connect(dest); o.start();
        this.nodes.push(o, g);
        return { osc: o, gain: g };
    }

    _lfo(rate, depth, param, type = 'sine') {
        const l = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        l.type = type; l.frequency.value = rate; g.gain.value = depth;
        l.connect(g); g.connect(param); l.start();
        this.nodes.push(l, g);
    }

    _scheduleNote(planet, dest, ac) {
        const ctx = this.ctx;
        // Tier 4: Strict Determinism & Scaled Generation
        // A unique RNG seed composed of the planet seed + the total number of notes fired
        const rng = new RNG(planet.seed + 1000 + this.stepNote++);

        let step;
        // Tier 4: Generative Intelligence Motif
        // 25% chance to play the planet's signature 4-note motif in sequence instead of wandering
        if (rng.range(0, 1) < 0.25) {
            step = planet.motif[this.stepNote % 4];
        } else {
            // Consonance-weighted Markov transition
            const WEIGHTS = { 0: 4, 7: 3, 12: 4, 4: 2, 3: 2, 9: 2, 5: 2, 2: 1, 10: 1, 11: 0.4, 1: 0.3, 6: 0.2 };
            const sc = planet.scale;
            const pool = [];
            sc.forEach(s => {
                const norm = ((s % 12) + 12) % 12;
                const tensionBias = (this.tension || 0) > 0.6 && (norm === 6 || norm === 1) ? 2.5 : 1;
                const w = (WEIGHTS[norm] || 0.5) * tensionBias;
                for (let i = 0; i < Math.max(1, Math.round(w * 2)); i++) pool.push(s);
            });
            if (this.lastStep !== undefined) {
                sc.forEach(s => {
                    const interval = Math.abs(s - this.lastStep) % 12;
                    if (interval === 7 || interval === 3 || interval === 4) pool.push(s);
                });
            }
            step = rng.pick(pool);
        }
        this.lastStep = step;

        const oct = ac ? rng.pick(ac.melodyOcts) : rng.pick([2, 3, 4]);

        // Tier 4: Microtonal / Just Intonation override
        let freq;
        if (planet.useJI) {
            const norm = ((step % 12) + 12) % 12;
            let ratio = planet.jiRatios[norm];
            if (step >= 12) ratio *= 2;      // crude octave shift
            if (step <= -12) ratio *= 0.5;
            freq = planet.rootFreq * oct * ratio;
        } else {
            freq = planet.rootFreq * oct * Math.pow(2, step / 12);
        }

        const osc = ctx.createOscillator();
        const env = ctx.createGain();
        const wType = ac ? rng.pick(ac.melodyWaves) : 'sine';

        let atk = rng.range(0.8, 4.5);
        let dur = rng.range(3.5, 15);

        // Special custom wavetable voices
        if (wType === 'bell') {
            const real = new Float32Array([0, 1, 0, 0, 0.2, 0, 0, 0.05, 0, 0, 0, 0, 0, 0.01]);
            const imag = new Float32Array([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
            osc.setPeriodicWave(ctx.createPeriodicWave(real, imag));
            atk = 0.05; // sharp strike
            dur = rng.range(6, 15); // very long ring
        } else if (wType === 'wood') {
            const real = new Float32Array([0, 0, 1, 0.5, 0, 0.2, 0, 0.1]);
            const imag = new Float32Array([0, 0.8, 0, 0, 0, 0, 0, 0]);
            osc.setPeriodicWave(ctx.createPeriodicWave(real, imag));
            atk = 0.03;
            dur = rng.range(0.5, 1.5); // short decay woody pluck
        } else {
            osc.type = wType;
        }

        osc.frequency.value = freq;
        const now = ctx.currentTime;
        env.gain.setValueAtTime(0, now);

        if (wType === 'bell' || wType === 'wood') {
            // Exponential decay for struck instruments
            env.gain.linearRampToValueAtTime(0.25 + rng.range(0, 0.1), now + atk);
            env.gain.exponentialRampToValueAtTime(0.001, now + atk + dur);
        } else {
            // Swelling envelope for standard waves
            env.gain.linearRampToValueAtTime(0.18 + rng.range(0, 0.08), now + atk);
            env.gain.linearRampToValueAtTime(0, now + atk + dur);
        }

        // Tier 3: HRTF spatial panner
        const panner = ctx.createPanner();
        panner.panningModel = 'HRTF';
        panner.distanceModel = 'inverse';
        panner.refDistance = 1;
        panner.maxDistance = 40;
        panner.rolloffFactor = 0.8;
        // Seeded 3D position
        const azimuth = rng.range(-0.5, 0.5) * Math.PI * 1.8;
        const elevation = rng.range(-0.5, 0.5) * Math.PI * 0.5;
        const dist = 2.5 + rng.range(0, 3);
        const sx = Math.cos(elevation) * Math.sin(azimuth) * dist;
        const sy = Math.sin(elevation) * dist + 1.6;
        const sz = Math.cos(elevation) * Math.cos(azimuth) * dist;
        if (panner.positionX) {
            panner.positionX.value = sx; panner.positionY.value = sy; panner.positionZ.value = sz;
        } else if (panner.setPosition) {
            panner.setPosition(sx, sy, sz);
        }
        osc.connect(env); env.connect(panner); panner.connect(dest);
        osc.start(now); osc.stop(now + atk + dur + 0.1);
        this.nodes.push(osc, env, panner);
    }

    start(planet) {
        this._boot();
        this.stop();
        this.planet = planet;
        const ctx = this.ctx, p = planet, ac = p.ac;

        // Effect chain -> routes into EQ -> MasterGain
        const conv = this._buildReverb(p.reverbDecay, p.seed);
        const wet = ctx.createGain(); wet.gain.value = this._reverb;
        const dry = ctx.createGain(); dry.gain.value = 1 - this._reverb * 0.5;
        this.reverbGain = wet; this.dryGain = dry;
        conv.connect(wet); wet.connect(this.eqLow);
        dry.connect(this.eqLow);

        // Delay — feedback & time vary sharply between biomes
        const del = ctx.createDelay(5);
        const fb = ctx.createGain(); fb.gain.value = ac.delayFb;
        const dlf = ctx.createBiquadFilter(); dlf.type = 'lowpass'; dlf.frequency.value = ac.filterBase * 0.8;
        del.delayTime.value = 0.25 + (p.seed % 120) / 300;
        del.connect(fb); fb.connect(dlf); dlf.connect(del);
        this.nodes.push(del, fb, dlf);

        // Master filter — controlled by biome base freq
        const filt = ctx.createBiquadFilter();
        filt.type = 'lowpass'; filt.frequency.value = p.filterFreq; filt.Q.value = 1.2;
        filt.connect(conv); filt.connect(del); del.connect(conv);
        filt.connect(dry);
        this.nodes.push(filt);
        this._lfo(p.lfoRate * 0.12, p.filterFreq * 0.35, filt.frequency);

        // Drone — Tier 4: Custom Wavetable base + dynamic FM
        const base = p.rootFreq;

        // Custom Seeded PeriodicWave for drone fundamental
        const wRng = new RNG(p.seed);
        const real = new Float32Array(16), imag = new Float32Array(16);
        real[0] = 0; imag[0] = 0;
        for (let i = 1; i < 16; i++) {
            real[i] = wRng.range(0, 1) / i; imag[i] = wRng.range(0, 1) / i;
        }
        const wave = ctx.createPeriodicWave(real, imag);
        const baseOsc = ctx.createOscillator(); baseOsc.setPeriodicWave(wave);
        const baseGain = ctx.createGain(); baseGain.gain.value = 0.4;
        baseOsc.frequency.value = base * 0.5; // sub octave
        baseOsc.connect(baseGain); baseGain.connect(filt);
        baseOsc.start();
        this.nodes.push(baseOsc, baseGain);
        this._lfo(p.lfoRate * 0.2, base * 0.01, baseOsc.frequency);

        const d1 = this._osc(ac.droneWave, base, 0.045, filt);
        const d2 = this._osc(ac.droneWave, base * 2 + p.droneDetune, 0.025, filt);

        // Simple FM synthesis for drone
        const fmMod = ctx.createOscillator(), fmModG = ctx.createGain();
        fmMod.type = 'sine'; fmMod.frequency.value = base * ac.fmRatio;
        this.fmIndexBase = ac.fmIndex * (0.7 + p.lfoRate); // stored for tension morphing
        fmModG.gain.value = this.fmIndexBase;
        this.fmModGainNode = fmModG; // store for tension morphing
        const fmCarrier = ctx.createOscillator(), fmCarrierG = ctx.createGain();
        fmCarrier.type = ac.droneWave; fmCarrier.frequency.value = base;
        fmCarrierG.gain.value = 0.04;
        fmMod.connect(fmModG); fmModG.connect(fmCarrier.frequency);
        fmCarrier.connect(fmCarrierG); fmCarrierG.connect(filt);
        fmMod.start(); fmCarrier.start();
        this.nodes.push(fmMod, fmModG, fmCarrier, fmCarrierG);

        this._lfo(p.lfoRate * 0.3, base * 0.014, d1.osc.frequency);
        this._lfo(p.lfoRate * 0.55, base * 0.025, d2.osc.frequency, 'triangle');

        // Pad — intro phase: pads fade in from silence over ~15s (was 45s)
        const padBus = ctx.createGain();
        padBus.gain.setValueAtTime(0, ctx.currentTime);
        padBus.gain.linearRampToValueAtTime(1, ctx.currentTime + 15);
        padBus.connect(filt);
        this.nodes.push(padBus);
        p.scale.slice(0, 5).forEach((step, i) => {
            const freq = base * ac.octScale * Math.pow(2, step / 12);
            const det = (i % 2 === 0 ? 1 : -1) * p.padDetune * 0.012 * freq;
            const pad = this._osc(ac.padWave, freq + det, 0.018, padBus);
            this._lfo(p.lfoRate * (0.09 + i * 0.07), freq * 0.005, pad.osc.frequency);
        });
        this.padBus = padBus;

        // Noise texture — biome controls how noisy
        if (p.noiseLevel > 0.01) {
            const blen = ctx.sampleRate * 3;
            const buf = ctx.createBuffer(1, blen, ctx.sampleRate);
            const nd = buf.getChannelData(0);
            for (let i = 0; i < blen; i++) nd[i] = Math.random() * 2 - 1;
            const ns = ctx.createBufferSource(); ns.buffer = buf; ns.loop = true;
            const nf = ctx.createBiquadFilter();
            // volcanic: low rumble; crystaline: high shimmer; desert: mid wind
            nf.type = p.biome.id === 'volcanic' ? 'lowpass' : (p.biome.id === 'crystalline' ? 'highpass' : 'bandpass');
            nf.frequency.value = 200 + p.seed % 1200; nf.Q.value = 4;
            const ng = ctx.createGain(); ng.gain.value = p.noiseLevel * 0.18;
            ns.connect(nf); nf.connect(ng); ng.connect(filt);
            ns.start();
            this.nodes.push(ns, nf, ng);
        }

        // Stochastic melody — notes from biome octave range
        // melodyBus fades in over ~20s
        const melodyBus = ctx.createGain();
        melodyBus.gain.setValueAtTime(0, ctx.currentTime);
        melodyBus.gain.linearRampToValueAtTime(1, ctx.currentTime + 20);
        melodyBus.connect(filt);
        this.nodes.push(melodyBus);
        this.melodyBus = melodyBus;
        this.intervals.push(setInterval(() => {
            const rng = new RNG(p.seed + 10000 + this.stepFX++);
            const tensionBoost = 1 + (this.tension || 0) * 3;
            // Greatly increased base melody density
            const prob = p.ac.melodyWaves.includes('wood') || p.ac.melodyWaves.includes('bell') ?
                0.25 * tensionBoost :
                (p.melodyDensity * 4.0 * (1 + this._density * 2.5) * tensionBoost);
            if (rng.range(0, 1) < prob) this._scheduleNote(p, melodyBus, ac);
        }, 500)); // faster tick rate for melodies

        // Biome-specific periodic effects
        if (p.biome.id === 'corrupted') {
            this.intervals.push(setInterval(() => {
                const rng = new RNG(p.seed + 20000 + this.stepFX++);
                if (rng.range(0, 1) < 0.2) {
                    const orig = filt.frequency.value;
                    filt.frequency.setValueAtTime(orig * (0.2 + rng.range(0, 3)), ctx.currentTime);
                    filt.frequency.setValueAtTime(orig, ctx.currentTime + 0.04 + rng.range(0, 0.12));
                }
            }, 700));
        }
        if (p.biome.id === 'organic') {
            // Pulsing life-like tremolo
            this._lfo(p.lfoRate * 2.5, 0.25, wet.gain);
        }
        if (p.biome.id === 'barren') {
            // Very occasional lone ping
            this.intervals.push(setInterval(() => {
                const rng = new RNG(p.seed + 30000 + this.stepFX++);
                if (rng.range(0, 1) < 0.08) this._scheduleNote(p, filt, ac);
            }, 4000));
        }

        // FM layer moved to Tier 4 custom wavetable block above.

        // ── TIER 2: PERCUSSION SEQUENCER ──────────────────────────
        this._startPercussion(p, filt);

        // ── Tier 1: Granular cloud ─────────────────────────────────
        this._startGranular(p, filt);

        // ── Tier 1: Chorus / stereo widening ──────────────────────
        this._addChorus(filt, this.masterGain, ac);

        // ── Tier 2: Harmonic tension arc ──────────────────────────
        this.tension = 0;
        this.tensionFilt = filt;
        this.tensionBase = { filtFreq: p.filterFreq, lfoRate: p.lfoRate };
        this._startTensionArc(p, filt);

        this.playing = true;
    }

    // ── GRANULAR SYNTHESIS ─────────────────────────────────────────────
    _startGranular(p, dest) {
        if (!this._granularEnabled) return; // user toggle
        const ctx = this.ctx, ac = p.ac, sr = ctx.sampleRate;
        if (!ac.grainDensity || ac.grainDensity < 0.05) return;

        // A single bus gain for the whole cloud — toggle ramps this
        const granularBus = ctx.createGain();
        granularBus.gain.setValueAtTime(0, ctx.currentTime);
        granularBus.gain.linearRampToValueAtTime(1, ctx.currentTime + 1.5); // fade in to stop clicks
        granularBus.connect(dest);
        this.nodes.push(granularBus);
        this._granularBus = granularBus;

        const bufLen = sr * 2;
        const buf = ctx.createBuffer(2, bufLen, sr);
        const base = p.rootFreq;
        for (let ch = 0; ch < 2; ch++) {
            const d = buf.getChannelData(ch);
            const rng = new RNG(p.seed + ch * 999);
            for (let i = 0; i < bufLen; i++) {
                const t = i / sr;
                let s = Math.sin(2 * Math.PI * base * t) * 0.38
                    + Math.sin(2 * Math.PI * base * 2 * t) * 0.16
                    + Math.sin(2 * Math.PI * base * 3 * t) * 0.07;
                s += (Math.random() * 2 - 1) * ac.noiseMul * 0.12;
                d[i] = s * (ch === 0 ? 1 : (0.88 + rng.range(0, 0.24)));
            }
        }

        const intervalMs = 1000 / ac.grainDensity;
        const peak = 0.015 * Math.sqrt(ac.grainDensity);

        const scheduleGrain = (rng) => {
            const nominalDur = ac.grainSize * 0.001 * (0.8 + rng.range(0, 0.5));

            // CLICK-FREE envelope
            const atkDur = Math.max(0.012, nominalDur * 0.30);
            const relDur = Math.max(0.018, nominalDur * 0.55);
            const holdDur = Math.max(0, nominalDur - atkDur - relDur);
            const totalEnv = atkDur + holdDur + relDur;

            const maxStart = Math.max(0, (bufLen / sr) - totalEnv - 0.05);
            const startPos = rng.range(0, maxStart);
            const centsOff = rng.range(-1, 1) * ac.grainPitchScatter;
            const playRate = Math.pow(2, centsOff / 1200);
            const pan = rng.range(-0.9, 0.9);

            const gs = ctx.createBufferSource();
            const env = ctx.createGain();
            const pn = ctx.createStereoPanner();
            gs.buffer = buf;
            gs.playbackRate.value = playRate;
            pn.pan.value = pan;

            // Hann-like curve
            const now = ctx.currentTime;
            env.gain.setValueAtTime(0, now);
            env.gain.linearRampToValueAtTime(peak * 0.5, now + atkDur * 0.5);
            env.gain.linearRampToValueAtTime(peak, now + atkDur);
            if (holdDur > 0.004) env.gain.setValueAtTime(peak, now + atkDur + holdDur);
            env.gain.linearRampToValueAtTime(peak * 0.5, now + atkDur + holdDur + relDur * 0.5);
            env.gain.linearRampToValueAtTime(0, now + totalEnv);

            gs.connect(env); env.connect(pn); pn.connect(granularBus);
            gs.start(now, startPos, totalEnv + 0.06);
        };
        // Wait a moment before firing grains to let the bus fade in and avoid load clicks
        setTimeout(() => {
            if (!this.playing) return;
            this.intervals.push(setInterval(() => {
                const grng = new RNG(p.seed + 40000 + this.stepGrain++);
                scheduleGrain(grng);
                if (ac.grainDensity > 4 && grng.range(0, 1) < 0.4) {
                    setTimeout(() => scheduleGrain(grng), intervalMs * 0.35);
                }
            }, intervalMs));
        }, 500);
    }

    // ── CHORUS / STEREO WIDENING ───────────────────────────────────────
    // 3 voices, each: short delay + LFO wobble + stereo pan → into wet bus
    _addChorus(source, dest, ac) {
        const ctx = this.ctx;
        if (!ac.chorusWet || ac.chorusWet < 0.02) return;

        const wetG = ctx.createGain();
        wetG.gain.value = ac.chorusWet;
        wetG.connect(dest);
        this.nodes.push(wetG);

        // 3 voices at musical delay primes (7, 13, 19ms)
        [7, 13, 19].forEach((ms, i) => {
            const del = ctx.createDelay(0.08);
            del.delayTime.value = ms * 0.001;
            // LFO slowly wobbles each voice's delay time
            const lfo = ctx.createOscillator();
            const lfoG = ctx.createGain();
            lfo.frequency.value = 0.28 + i * 0.13;
            lfoG.gain.value = ac.chorusDepth * 0.0001; // ms → seconds
            lfo.connect(lfoG); lfoG.connect(del.delayTime);
            lfo.start();
            // Pan: L, R, slightly R (spread)
            const pan = ctx.createStereoPanner();
            pan.pan.value = [-0.7, 0.7, 0.3][i];
            source.connect(del); del.connect(pan); pan.connect(wetG);
            this.nodes.push(del, lfo, lfoG, pan);
        });
    }

    // ── SIDECHAIN DUCK ─────────────────────────────────────────────────
    // Called by rhythmic pulses to briefly dip the main filter gain
    _duck(amt, rel) {
        if (!amt || !this.masterGain) return;
        const g = this.masterGain;
        const now = this.ctx.currentTime;
        g.gain.cancelScheduledValues(now);
        g.gain.setValueAtTime(g.gain.value, now);
        g.gain.linearRampToValueAtTime(this._vol * (1 - amt), now + 0.04);
        g.gain.linearRampToValueAtTime(this._vol, now + 0.04 + (rel || 0.35));
    }

    // ── TIER 2: PERCUSSION SEQUENCER ──────────────────────────────────
    // 16-step sequencer driven by planet BPM. Full synthesized drum kit
    // (kick, snare, hat, sub) playing biome-specific seeded patterns.
    _startPercussion(p, dest) {
        if (!this._percussionEnabled) return;
        const ctx = this.ctx, base = p.rootFreq, bid = p.biome.id;
        const bpm = p.bpm || 90;
        const stepTime = 15 / bpm; // 16th note in seconds
        const rng = new RNG(p.seed);

        // Kit variations per planet — tuned via seed
        const kit = {
            kPitch: rng.range(0.85, 1.2), kDecay: rng.range(0.7, 1.3),
            sPitch: rng.range(0.8, 1.3), sDecay: rng.range(0.6, 1.5),
            hPitch: rng.range(0.7, 1.4), hDecay: rng.range(0.5, 1.8)
        };

        // Synthesize Drum Voices
        const playKick = (vel) => {
            const t = ctx.currentTime;
            const osc = ctx.createOscillator(), env = ctx.createGain();
            // Softer pitch envelope for less click
            osc.frequency.setValueAtTime(120 * kit.kPitch, t);
            osc.frequency.exponentialRampToValueAtTime(45 * kit.kPitch, t + 0.08 * kit.kDecay);
            env.gain.setValueAtTime(0, t);
            env.gain.linearRampToValueAtTime(vel, t + 0.015); // slower attack
            env.gain.exponentialRampToValueAtTime(0.001, t + 0.4 * kit.kDecay);
            osc.connect(env); env.connect(dest);
            osc.start(t); osc.stop(t + 0.5 * kit.kDecay);
            this.nodes.push(osc, env);
            if (p.ac.sidechainAmt > 0) this._duck(p.ac.sidechainAmt, 0.4);
        };

        const playSnare = (vel) => {
            const t = ctx.currentTime;
            const noise = ctx.createBufferSource();
            const nBuf = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
            const d = nBuf.getChannelData(0);
            for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
            noise.buffer = nBuf;
            const nFilt = ctx.createBiquadFilter();
            nFilt.type = 'highpass'; nFilt.frequency.value = 1000 * kit.sPitch;
            const nEnv = ctx.createGain();

            const osc = ctx.createOscillator(), tEnv = ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(250 * kit.sPitch, t);
            osc.frequency.exponentialRampToValueAtTime(120 * kit.sPitch, t + 0.1);

            nEnv.gain.setValueAtTime(0, t);
            nEnv.gain.linearRampToValueAtTime(vel * 0.8, t + 0.01);
            nEnv.gain.exponentialRampToValueAtTime(0.001, t + 0.25 * kit.sDecay);

            tEnv.gain.setValueAtTime(0, t);
            tEnv.gain.linearRampToValueAtTime(vel * 0.6, t + 0.01);
            tEnv.gain.exponentialRampToValueAtTime(0.001, t + 0.15 * kit.sDecay);

            noise.connect(nFilt); nFilt.connect(nEnv); nEnv.connect(dest);
            osc.connect(tEnv); tEnv.connect(dest);
            noise.start(t); osc.start(t);
            this.nodes.push(noise, nFilt, nEnv, osc, tEnv);
        };

        const playHat = (vel, open) => {
            const t = ctx.currentTime;
            // Hat is high-passed squarish FM or just noise (using square for metallic sound)
            const osc1 = ctx.createOscillator(), osc2 = ctx.createOscillator();
            const filt = ctx.createBiquadFilter(), env = ctx.createGain();
            osc1.type = 'square'; osc1.frequency.value = 400;
            osc2.type = 'square'; osc2.frequency.value = 600;
            filt.type = 'highpass'; filt.frequency.value = 7000;

            const dur = (open ? 0.35 : 0.08) * kit.hDecay;
            env.gain.setValueAtTime(0, t);
            env.gain.linearRampToValueAtTime(vel * 0.4, t + 0.01);
            env.gain.exponentialRampToValueAtTime(0.001, t + dur);

            osc1.connect(filt); osc2.connect(filt); filt.connect(env); env.connect(dest);
            osc1.start(t); osc2.start(t);
            osc1.stop(t + dur + 0.05); osc2.stop(t + dur + 0.05);
            this.nodes.push(osc1, osc2, filt, env);
        };

        const playSub = (vel, pitchOff) => {
            const t = ctx.currentTime;
            const osc = ctx.createOscillator(), env = ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.value = base * Math.pow(2, pitchOff / 12);
            env.gain.setValueAtTime(0, t);
            env.gain.linearRampToValueAtTime(vel * 0.8, t + 0.05);
            env.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
            osc.connect(env); env.connect(dest);
            osc.start(t); osc.stop(t + 0.7);
            this.nodes.push(osc, env);
        };

        // ── Biome Sequence Patterns (16 steps) ──
        // 1=hit, 2=accent/openhat, 0=rest. Multiple arrays = planet seed chooses variation.
        const P = {
            volcanic: {
                k: [[1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0], [1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 1, 0, 0]],
                s: [[0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0], [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1, 0]],
                h: [[1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0], [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]],
                b: [[1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0], [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0]]
            },
            psychedelic: {
                k: [[1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 1, 0], [1, 0, 0, 0, 1, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0]],
                s: [[0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1], [0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0]],
                h: [[1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 1, 0], [1, 0, 2, 0, 1, 0, 2, 0, 1, 0, 2, 0, 1, 0, 2, 0]],
                b: [[1, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0], [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0]]
            },
            corrupted: {
                // High-energy breakbeat / glitch / DnB feel
                k: [[1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 1, 0, 0, 0, 0], [1, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0]],
                s: [[0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1], [0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 0]],
                h: [[1, 0, 1, 1, 1, 0, 1, 0, 1, 1, 1, 0, 1, 0, 1, 1], [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1, 1]], // fast 16ths
                b: [[1, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0], [1, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0]]
            },
            oceanic: {
                k: [[1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0]],
                s: [[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0]], // sparse
                h: [[1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0], [0, 0, 2, 0, 0, 0, 2, 0, 0, 0, 2, 0, 0, 0, 2, 0]],
                b: [[1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0], [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0]]
            },
            organic: {
                // Latin/syncopated feel
                k: [[1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0], [1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0]],
                s: [[0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0], [0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0]], // claves-ish
                h: [[1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0], [1, 1, 2, 0, 1, 1, 2, 0, 1, 1, 2, 0, 1, 1, 2, 0]],
                b: [[1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0], [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]]
            },
            desert: {
                k: [[1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0], [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0]],
                s: [[0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0]],
                h: [[1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0], [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0]],
                b: [[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]]
            },
            crystalline: {
                k: [[1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0]],
                s: [[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]],
                h: [[2, 0, 0, 0, 2, 0, 0, 0, 2, 0, 0, 0, 2, 0, 0, 0], [2, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0]], // just bells/open hats
                b: [[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]]
            }
        };
        // Fallback for barren/ethereal which are ambient
        const ambient = { k: [[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]], s: [[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]], h: [[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]], b: [[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]] };

        const bPats = P[bid] || ambient;

        // Pick specific array variations for this planet
        const patK = rng.pick(bPats.k), patS = rng.pick(bPats.s);
        const patH = rng.pick(bPats.h), patB = rng.pick(bPats.b);
        const subPitch = rng.pick([0, -5, -7]); // sub plays root, 4th down, or 5th down

        let step = 0;
        this.intervals.push(setInterval(() => {
            if (!this.playing) return;
            const seqRng = new RNG(p.seed + 50000 + this.stepPerc++);

            // At high tension, occasionally skip beats or add random hats (generative chaos)
            const chaos = this.tension > 0.7 ? seqRng.range(0, 1) < 0.2 : false;

            if (patK[step] === 1 && !chaos) playKick(0.25);
            if (patS[step] === 1 && !chaos) playSnare(0.12);
            if (patH[step] === 1) playHat(0.04, false);
            if (patH[step] === 2) playHat(0.06, true);
            if (patB[step] === 1 && !chaos) playSub(0.15, subPitch);

            // Rare random glitch hat at high tension
            if (this.tension > 0.6 && seqRng.range(0, 1) < 0.1) playHat(0.03, false);

            step = (step + 1) % 16;
        }, stepTime * 1000));
    }

    // ── TIER 2: HARMONIC TENSION ARC ──────────────────────────────────
    // Tension rises from 0 →1 over ~60 seconds while listening.
    // It modulates filter, LFO, melody density, and dissonance.
    // At tension ≥0.85 a climax chord fires then tension resets to 0.45.
    _startTensionArc(p, filt) {
        const ctx = this.ctx;
        const base = this.tensionBase;
        this.tension = 0;
        this._climaxFired = false;

        this.intervals.push(setInterval(() => {
            if (!this.playing) return;
            this.tension = Math.min(1, this.tension + 0.035); // faster arc

            // ─ Filter & FM morphing as tension rises ────────────────────────
            const tSq = this.tension * this.tension;
            const newFiltFreq = base.filtFreq * (1 + this.tension * 2.5);
            if (this.tensionFilt) {
                this.tensionFilt.frequency.linearRampToValueAtTime(
                    newFiltFreq, ctx.currentTime + 2
                );
            }
            if (this.fmModGainNode && this.fmIndexBase) {
                // Morph FM harshness dramatically with tension
                const newIndex = this.fmIndexBase * (1 + tSq * 5);
                this.fmModGainNode.gain.linearRampToValueAtTime(
                    newIndex, ctx.currentTime + 2
                );
            }

            // ─ Update tension bar UI ──────────────────────────────────────
            const bar = document.getElementById('tension-fill');
            const icon = document.getElementById('tension-icon');
            if (bar) bar.style.width = `${this.tension * 100}%`;
            if (icon) {
                const phase = this.tension < 0.4 ? 'low' : this.tension < 0.75 ? 'mid' : 'high';
                icon.className = `tension-icon tension-${phase}`;
            }

            // ─ Climax event at tension ≥ 0.85 ────────────────────────────
            if (this.tension >= 0.85 && !this._climaxFired) {
                this._climaxFired = true;
                this._fireClimax(p, filt);
                // After climax, drop tension back and allow next arc
                setTimeout(() => {
                    this.tension = 0.45;
                    this._climaxFired = false;
                }, 18000);
            }
        }, 2000)); // every 2s instead of 8s
    }

    // Fires a rich swelling chord at climax, then fades
    _fireClimax(p, dest) {
        const ctx = this.ctx, base = p.rootFreq;
        // Schedule 5 harmonic intervals as a chord
        [1, 5 / 4, 3 / 2, 2, 5 / 2].forEach((ratio, i) => {
            const o = ctx.createOscillator(), g = ctx.createGain();
            o.type = p.ac.padWave; o.frequency.value = base * ratio;
            const now = ctx.currentTime + i * 0.08;
            g.gain.setValueAtTime(0, now);
            g.gain.linearRampToValueAtTime(0.055, now + 2.5);
            g.gain.linearRampToValueAtTime(0.055, now + 10);
            g.gain.linearRampToValueAtTime(0, now + 16);
            o.connect(g); g.connect(dest);
            o.start(now); o.stop(now + 17);
            this.nodes.push(o, g);
        });
        // Brief master swell
        const mg = this.masterGain;
        const now = ctx.currentTime;
        mg.gain.linearRampToValueAtTime(this._vol * 1.35, now + 3);
        mg.gain.linearRampToValueAtTime(this._vol, now + 12);
    }

    // ── TIER 3: DOPPLER WHOOSH ────────────────────────────────────────
    // Synthesises a descending-frequency noise burst suggesting spatial travel.
    // Call on navigation — plays through the analyser so the scope reacts to it.
    _dopplerWhoosh() {
        if (!this.ctx) return;
        const ctx = this.ctx, sr = ctx.sampleRate;
        const dur = 1.5;
        const buf = ctx.createBuffer(2, sr * dur, sr);
        for (let ch = 0; ch < 2; ch++) {
            const d = buf.getChannelData(ch);
            const phase = ch === 1 ? Math.PI * 0.15 : 0; // slight L/R phase offset
            for (let i = 0; i < d.length; i++) {
                const t = i / sr;
                const env = t < 0.08 ? t / 0.08 : Math.exp(-(t - 0.08) * 4.5);
                const fInst = 3200 * Math.exp(-t * 3); // sweeps 3200 → ~60 Hz
                const tone = Math.sin(2 * Math.PI * fInst * t + phase) * 0.5;
                const noise = (Math.random() * 2 - 1) * 0.5;
                d[i] = (tone + noise) * env * 0.14;
            }
        }
        const src = ctx.createBufferSource();
        src.buffer = buf;
        const g = ctx.createGain(); g.gain.value = this._vol;
        src.connect(g); g.connect(this.analyser);
        src.start();
        src.onended = () => { try { src.disconnect(); g.disconnect(); } catch (e) { } };
    }

    stop() {
        this.intervals.forEach(clearInterval);
        this.intervals = [];
        this.tension = 0;
        const bar = document.getElementById('tension-fill');
        if (bar) bar.style.width = '0%';
        const t = this.ctx ? this.ctx.currentTime : 0;
        this.nodes.forEach(n => {
            try { if (n.stop) n.stop(t + 0.05); } catch (e) { }
            setTimeout(() => { try { n.disconnect(); } catch (e) { } }, 120);
        });
        this.nodes = [];
        this.playing = false;
    }

    setVolume(v) { this._vol = v; if (this.masterGain) this.masterGain.gain.linearRampToValueAtTime(v, this.ctx.currentTime + 0.1); }
    setReverb(v) { this._reverb = v; if (this.reverbGain) { this.reverbGain.gain.linearRampToValueAtTime(v, this.ctx.currentTime + 0.2); this.dryGain.gain.linearRampToValueAtTime(1 - v * 0.5, this.ctx.currentTime + 0.2); } }
    getAnalyser() { return this.analyser; }

    // Smooth crossfade: fade current out, start new, fade in
    crossfadeTo(planet, cb) {
        if (!this.masterGain || !this.ctx) { this.start(planet); if (cb) cb(); return; }
        const ctx = this.ctx;
        const fadeOut = 1.1;
        this.masterGain.gain.linearRampToValueAtTime(0, ctx.currentTime + fadeOut);
        // Stop old nodes after fade, start new quietly, then ramp up
        setTimeout(() => {
            this.stop();
            this.start(planet);
            const now2 = this.ctx.currentTime;
            this.masterGain.gain.cancelScheduledValues(now2);
            this.masterGain.gain.setValueAtTime(0, now2);
            this.masterGain.gain.linearRampToValueAtTime(this._vol, now2 + 1.5);
            if (cb) cb();
        }, fadeOut * 1000);
    }
}

// ============================================================
// PLANET RENDERER
// ============================================================
class PlanetRenderer {
    constructor(canvas) {
        this.cv = canvas; this.ctx = canvas.getContext('2d');
        this.planet = null; this.angle = 0; this.raf = null; this._tex = null;
    }

    _noise(grid, gw, x, y) {
        const xi = Math.floor(x) % gw, yi = Math.floor(y) % gw;
        const xf = x - Math.floor(x), yf = y - Math.floor(y);
        const s = t => t * t * (3 - 2 * t);
        const a = grid[yi * gw + xi], b = grid[yi * gw + (xi + 1) % gw];
        const c = grid[((yi + 1) % gw) * gw + xi], d = grid[((yi + 1) % gw) * gw + (xi + 1) % gw];
        return a + s(xf) * (b - a) + s(yf) * (c - a) + s(xf) * s(yf) * (a - b - c + d);
    }

    _buildTex(planet) {
        const rng = new RNG(planet.seed + 7), sz = 256, gw = 16;
        const g1 = Array.from({ length: gw * gw }, () => rng.next());
        const g2 = Array.from({ length: gw * gw }, () => rng.next());
        const off = document.createElement('canvas'); off.width = off.height = sz;
        const ctx = off.getContext('2d');
        const img = ctx.createImageData(sz, sz), data = img.data;
        const cols = planet.colors;
        for (let py = 0; py < sz; py++) for (let px = 0; px < sz; px++) {
            const nx = px / sz * gw, ny = py / sz * gw;
            let n = this._noise(g1, gw, nx, ny) * 0.54
                + this._noise(g2, gw, nx * 2, ny * 2) * 0.27
                + this._noise(g1, gw, nx * 4, ny * 4) * 0.12
                + this._noise(g2, gw, nx * 8, ny * 8) * 0.07;
            n = Math.max(0, Math.min(1, n));
            const ci = Math.min(cols.length - 2, Math.floor(n * (cols.length - 1)));
            const t = n * (cols.length - 1) - ci;
            const c0 = this._hex(cols[ci]), c1 = this._hex(cols[ci + 1] || cols[ci]);
            const i = (py * sz + px) * 4;
            data[i] = c0.r + t * (c1.r - c0.r) | 0;
            data[i + 1] = c0.g + t * (c1.g - c0.g) | 0;
            data[i + 2] = c0.b + t * (c1.b - c0.b) | 0;
            data[i + 3] = 255;
        }
        ctx.putImageData(img, 0, 0);
        return off;
    }

    _hex(h) {
        const n = parseInt(h.replace('#', ''), 16);
        return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
    }

    load(planet) { this.planet = planet; this._tex = this._buildTex(planet); }

    _frame() {
        const cv = this.cv, ctx = this.ctx;
        cv.width = cv.offsetWidth; cv.height = cv.offsetHeight;
        const W = cv.width, H = cv.height, p = this.planet;
        ctx.clearRect(0, 0, W, H);
        if (!p) return;
        const cx = W / 2, cy = H / 2, r = Math.min(W, H) * 0.36;

        // Outer glow
        const glow = ctx.createRadialGradient(cx, cy, r * 0.85, cx, cy, r * 1.5);
        glow.addColorStop(0, p.biome.glowColor + '44');
        glow.addColorStop(0.5, p.biome.glowColor + '18');
        glow.addColorStop(1, 'transparent');
        ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(cx, cy, r * 1.5, 0, Math.PI * 2); ctx.fill();

        // Planet body clipped
        ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.clip();
        if (this._tex) {
            const tw = this._tex.width, scale = (r * 2) / tw * 1.05;
            const ox = ((this.angle * 0.25) % (tw * scale)) - (tw * scale);
            ctx.drawImage(this._tex, cx - r + ox, cy - r, tw * scale, r * 2);
            ctx.drawImage(this._tex, cx - r + ox + tw * scale, cy - r, tw * scale, r * 2);
        }
        // Sphere shading
        const sh = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, 0, cx, cy, r);
        sh.addColorStop(0, 'rgba(255,255,255,0.08)');
        sh.addColorStop(0.5, 'rgba(0,0,0,0)');
        sh.addColorStop(1, 'rgba(0,0,0,0.7)');
        ctx.fillStyle = sh; ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
        // Clouds
        if (p.hasClouds) {
            ctx.globalAlpha = p.cloudOpac * 0.65;
            for (let i = 0; i < 5; i++) {
                const cr = new RNG(p.seed + i * 1237);
                const ox = ((this.angle * 0.55 + i * r * 0.5) % (r * 3)) - r;
                const cy2 = cy - r * 0.65 + cr.range(0, r * 1.3);
                const rx2 = cr.range(r * 0.22, r * 0.52), ry2 = cr.range(r * 0.06, r * 0.14);
                ctx.fillStyle = 'rgba(220,230,255,0.55)';
                ctx.beginPath(); ctx.ellipse(cx + ox, cy2, rx2, ry2, 0, 0, Math.PI * 2); ctx.fill();
            }
            ctx.globalAlpha = 1;
        }
        ctx.restore();

        // Atmosphere halo
        const atm = ctx.createRadialGradient(cx, cy, r * 0.9, cx, cy, r * 1.08);
        atm.addColorStop(0, 'transparent');
        atm.addColorStop(0.55, p.biome.glowColor + Math.round(p.atmOpac * 120).toString(16).padStart(2, '0'));
        atm.addColorStop(1, 'transparent');
        ctx.globalAlpha = 0.9; ctx.fillStyle = atm;
        ctx.beginPath(); ctx.arc(cx, cy, r * 1.08, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;

        // Rings
        if (p.hasRings) {
            ctx.save(); ctx.translate(cx, cy); ctx.scale(1, p.ringTilt);
            const ri = r * 1.28, ro = r * 1.9;
            const rg = ctx.createRadialGradient(0, 0, ri, 0, 0, ro);
            rg.addColorStop(0, 'transparent');
            rg.addColorStop(0.2, p.biome.colors[2] + '88');
            rg.addColorStop(0.6, p.biome.colors[3] + 'bb');
            rg.addColorStop(1, 'transparent');
            for (let i = 0; i < 5; i++) {
                ctx.globalAlpha = 0.32 - i * 0.04;
                ctx.strokeStyle = rg; ctx.lineWidth = (ro - ri) / 5;
                ctx.beginPath(); ctx.arc(0, 0, ri + (ro - ri) * (i / 5), 0, Math.PI * 2); ctx.stroke();
            }
            ctx.globalAlpha = 1; ctx.restore();
        }

        // Moons — orbit in flattened ellipses for 3D feel
        for (let m = 0; m < (p.numMoons || 0); m++) {
            const mr = new RNG(p.seed + m * 1777);
            const orbitR = r * (1.45 + mr.range(0.25, 1.05));
            const speed = mr.range(0.35, 1.7) * (m % 2 === 0 ? 1 : -1);
            const phase = mr.range(0, Math.PI * 2);
            const mAngle = this.angle * speed * 0.009 + phase;
            const mx = cx + Math.cos(mAngle) * orbitR;
            const my = cy + Math.sin(mAngle) * orbitR * 0.3;
            const mSize = r * mr.range(0.044, 0.092);
            const mColor = p.biome.colors[mr.int(1, p.biome.colors.length)];
            // Dim when behind the planet (z-sort via sin)
            ctx.globalAlpha = Math.sin(mAngle) < -0.12 ? 0.32 : 1;
            // Glow
            const mg = ctx.createRadialGradient(mx, my, 0, mx, my, mSize * 3);
            mg.addColorStop(0, mColor + '55'); mg.addColorStop(1, 'transparent');
            ctx.fillStyle = mg; ctx.beginPath(); ctx.arc(mx, my, mSize * 3, 0, Math.PI * 2); ctx.fill();
            // Body
            ctx.fillStyle = mColor;
            ctx.beginPath(); ctx.arc(mx, my, mSize, 0, Math.PI * 2); ctx.fill();
            // Sphere shading
            const ms = ctx.createRadialGradient(mx - mSize * 0.3, my - mSize * 0.3, 0, mx, my, mSize);
            ms.addColorStop(0, 'rgba(255,255,255,0.2)'); ms.addColorStop(1, 'rgba(0,0,0,0.6)');
            ctx.fillStyle = ms; ctx.beginPath(); ctx.arc(mx, my, mSize, 0, Math.PI * 2); ctx.fill();
        }
        ctx.globalAlpha = 1;
    }

    animate() {
        const loop = () => { this.angle += 0.22; this._frame(); this.raf = requestAnimationFrame(loop); };
        if (this.raf) cancelAnimationFrame(this.raf);
        this.raf = requestAnimationFrame(loop);
    }
}

// ============================================================
// STARFIELD
// ============================================================
class Starfield {
    constructor(canvas) {
        this.cv = canvas; this.ctx = canvas.getContext('2d');
        this.stars = []; this.nebula = []; this.raf = null;
        this._init();
        window.addEventListener('resize', () => this._init());
    }
    _init() {
        const W = window.innerWidth, H = window.innerHeight;
        this.cv.width = W; this.cv.height = H;
        this.stars = Array.from({ length: 300 }, () => ({ x: Math.random() * W, y: Math.random() * H, r: Math.random() * 1.4 + 0.2, a: Math.random(), phase: Math.random() * Math.PI * 2, spd: Math.random() * 0.002 + 0.0004 }));
        this.nebula = Array.from({ length: 7 }, () => ({ x: Math.random() * W, y: Math.random() * H, rx: Math.random() * 320 + 100, ry: Math.random() * 200 + 80, a: Math.random() * 0.04 + 0.007, hue: Math.floor(Math.random() * 70) + 200 }));
    }
    draw(t) {
        const cv = this.cv, ctx = this.ctx, W = cv.width, H = cv.height;
        ctx.clearRect(0, 0, W, H);
        this.nebula.forEach(nb => {
            ctx.save(); ctx.scale(1, nb.ry / nb.rx);
            const g = ctx.createRadialGradient(nb.x, nb.y * (nb.rx / nb.ry), 0, nb.x, nb.y * (nb.rx / nb.ry), nb.rx);
            g.addColorStop(0, `hsla(${nb.hue},65%,35%,${nb.a})`); g.addColorStop(1, 'transparent');
            ctx.fillStyle = g; ctx.beginPath(); ctx.arc(nb.x, nb.y * (nb.rx / nb.ry), nb.rx, 0, Math.PI * 2); ctx.fill();
            ctx.restore();
        });
        this.stars.forEach(s => {
            ctx.globalAlpha = s.a * (0.4 + 0.6 * Math.sin(t * s.spd * 1000 + s.phase));
            ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill();
        });
        ctx.globalAlpha = 1;
    }
    animate() {
        const loop = t => { this.draw(t / 1000); this.raf = requestAnimationFrame(loop); };
        if (this.raf) cancelAnimationFrame(this.raf);
        this.raf = requestAnimationFrame(loop);
    }
}

// ============================================================
// WAVEFORM VISUALIZER — biome-specific oscilloscope modes
// ============================================================
// ============================================================
// AUDIO-REACTIVE ECOSYSTEM (Tier 5)
// Maps Low/Mid/High frequency bands to distinct visual geometries
// ============================================================
class AudioReactiveEcosystem {
    constructor(main, mini) {
        this.main = main; this.mini = mini;
        this.analyser = null; this.color = '#5b9dff';
        this.biomeId = 'barren'; this.raf = null;
        this.particles = [];
        this.phase = 0;
    }

    setAnalyser(a) { this.analyser = a; }
    setColor(c) { this.color = c; }
    setBiome(id) {
        this.biomeId = id;
        this.particles = []; // Reset particles on planet change
        for (let i = 0; i < 40; i++) {
            this.particles.push({
                x: Math.random(), y: Math.random(),
                vx: (Math.random() - 0.5) * 0.01, vy: (Math.random() - 0.5) * 0.01,
                life: Math.random()
            });
        }
    }

    _draw(cv) {
        if (!this.analyser || !cv) return;
        const ctx = cv.getContext('2d'), W = cv.width, H = cv.height;
        ctx.clearRect(0, 0, W, H);

        const freqBuf = new Uint8Array(this.analyser.frequencyBinCount);
        this.analyser.getByteFrequencyData(freqBuf);
        this.phase += 0.02;

        // Split frequencies into Low (kick/sub), Mid (chords/melody), High (hats/grains)
        let low = 0, mid = 0, high = 0;
        const len = freqBuf.length;
        for (let i = 0; i < 4; i++) low += freqBuf[i];
        for (let i = 4; i < 20; i++) mid += freqBuf[i];
        for (let i = 40; i < 100; i++) high += freqBuf[i];

        low = (low / (4 * 255));
        mid = (mid / (16 * 255));
        high = (high / (60 * 255));

        const cx = W / 2, cy = H / 2;
        const c = this.color;

        ctx.shadowColor = c;
        ctx.shadowBlur = 10;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';

        // Biome-specific reactive geometry
        if (this.biomeId === 'volcanic' || this.biomeId === 'corrupted') {
            // Aggressive geometric spikes that shoot out on drum kicks (Low freq)
            ctx.fillStyle = c;
            ctx.globalAlpha = 0.8;
            const spikes = 12;
            ctx.beginPath();
            for (let i = 0; i < spikes; i++) {
                const angle = (i / spikes) * Math.PI * 2 + this.phase * 0.5;
                const rInner = 10 + mid * 20;
                // Kick drum drives the spike length
                const rOuter = 20 + low * 80 + (Math.random() * high * 20);

                const ix = cx + Math.cos(angle) * rInner;
                const iy = cy + Math.sin(angle) * rInner;
                const ox = cx + Math.cos(angle + Math.PI / spikes) * rOuter;
                const oy = cy + Math.sin(angle + Math.PI / spikes) * rOuter;

                if (i === 0) ctx.moveTo(ix, iy); else ctx.lineTo(ix, iy);
                ctx.lineTo(ox, oy);
            }
            ctx.closePath();
            ctx.fill();

            // Glitch horizontal tear lines on high hats/noise
            if (high > 0.1) {
                ctx.strokeStyle = c;
                ctx.lineWidth = 1 + high * 3;
                ctx.beginPath();
                for (let i = 0; i < 5; i++) {
                    const y = cy + (Math.random() - 0.5) * H;
                    ctx.moveTo(0, y);
                    ctx.lineTo(W, y + (Math.random() - 0.5) * 10);
                }
                ctx.stroke();
            }

        } else if (this.biomeId === 'oceanic' || this.biomeId === 'ethereal') {
            // Smooth expanding ripples driven by mids, scattering particles on high
            ctx.strokeStyle = c;
            ctx.globalAlpha = 0.6;

            // Central breathing orb
            const orbR = 15 + mid * 40 + low * 20;
            ctx.beginPath(); ctx.arc(cx, cy, orbR, 0, Math.PI * 2);
            ctx.lineWidth = 2 + low * 4; ctx.stroke();

            // Expanding ripples
            const rippleSteps = 4;
            for (let i = 0; i < rippleSteps; i++) {
                const rScale = ((this.phase + i * (Math.PI * 2 / rippleSteps)) % (Math.PI * 2)) / (Math.PI * 2);
                ctx.globalAlpha = (1 - rScale) * 0.5 * (1 + high);
                ctx.beginPath();
                ctx.arc(cx, cy, orbR + rScale * 100, 0, Math.PI * 2);
                ctx.lineWidth = 1; ctx.stroke();
            }

            // High freq triggers particles
            ctx.fillStyle = c;
            this.particles.forEach(p => {
                p.x += Math.cos(p.life) * high * 0.05;
                p.y += Math.sin(p.life) * high * 0.05;
                p.life += 0.05;
                if (p.x < 0) p.x = 1; if (p.x > 1) p.x = 0;
                if (p.y < 0) p.y = 1; if (p.y > 1) p.y = 0;

                ctx.globalAlpha = p.life % 1;
                ctx.beginPath();
                ctx.arc(p.x * W, p.y * H, 1 + high * 4, 0, Math.PI * 2);
                ctx.fill();
            });

        } else {
            // Desert / Organic / Crystalline: Mandala / Sacred Geometry
            ctx.strokeStyle = c;
            ctx.globalAlpha = 0.7;
            const petals = this.biomeId === 'crystalline' ? 6 : (this.biomeId === 'organic' ? 8 : 5);

            ctx.translate(cx, cy);
            ctx.rotate(this.phase * 0.2);

            for (let j = 0; j < 3; j++) {
                const layerScale = 1 + j * 0.5 + low * 0.5;
                ctx.lineWidth = (3 - j) + mid * 2;
                ctx.beginPath();
                for (let i = 0; i <= 100; i++) {
                    const t = (i / 100) * Math.PI * 2;
                    // Petal math driven by high freqs for complexity
                    const r = 10 * layerScale + Math.sin(t * petals) * (15 + mid * 30 + high * 10);
                    const x = Math.cos(t) * r;
                    const y = Math.sin(t) * r;
                    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
                }
                ctx.closePath();
                ctx.stroke();
                ctx.rotate(mid * 0.1); // Twist layers by mid frequencies
            }
            ctx.resetTransform();
        }

        ctx.globalAlpha = 1; ctx.shadowBlur = 0;
    }

    animate() {
        const loop = () => { this._draw(this.main); this._draw(this.mini); this.raf = requestAnimationFrame(loop); };
        if (this.raf) cancelAnimationFrame(this.raf);
        this.raf = requestAnimationFrame(loop);
    }
}

// ============================================================
// WARP RENDERER — radial speed-lines animation on navigate
// ============================================================
class WarpRenderer {
    constructor(canvas) {
        this.cv = canvas;
        this.ctx = canvas.getContext('2d');
        this.raf = null;
        this.t0 = 0;
        this.dur = 1350; // ms
        this.glowColor = '#5b9dff';
        this._resize();
        window.addEventListener('resize', () => this._resize());
    }
    _resize() { this.cv.width = window.innerWidth; this.cv.height = window.innerHeight; }

    trigger(color) {
        this.glowColor = color || '#5b9dff';
        this.t0 = performance.now();
        this.cv.classList.add('active');
        if (this.raf) cancelAnimationFrame(this.raf);
        this._loop();
    }

    _loop() {
        const elapsed = performance.now() - this.t0;
        const t = Math.min(1, elapsed / this.dur);
        this._draw(t);
        if (t < 1) {
            this.raf = requestAnimationFrame(() => this._loop());
        } else {
            this.cv.classList.remove('active');
            this.ctx.clearRect(0, 0, this.cv.width, this.cv.height);
            this.raf = null;
        }
    }

    _draw(t) {
        const ctx = this.ctx, W = this.cv.width, H = this.cv.height;
        const cx = W / 2, cy = H / 2;
        ctx.clearRect(0, 0, W, H);

        // Phase: 0→0.45 = stretch, 0.45→1 = fade out
        const stretch = t < 0.45 ? t / 0.45 : 1 - (t - 0.45) / 0.55;
        const alpha = stretch * 0.75;
        const maxR = Math.hypot(W, H) * 0.7;

        const NUM = 140;
        for (let i = 0; i < NUM; i++) {
            const angle = (i / NUM) * Math.PI * 2;
            const near = 30 * (1 - stretch * 0.6);
            const far = maxR * Math.pow(stretch, 1.4);
            // Vary brightness — every 3rd line brighter
            const bright = i % 3 === 0 ? 1 : 0.28;
            const hex = this.glowColor;
            ctx.beginPath();
            ctx.moveTo(cx + Math.cos(angle) * near, cy + Math.sin(angle) * near);
            ctx.lineTo(cx + Math.cos(angle) * far, cy + Math.sin(angle) * far);
            ctx.strokeStyle = hex;
            ctx.globalAlpha = alpha * bright;
            ctx.lineWidth = i % 5 === 0 ? 2 : 1;
            ctx.stroke();
        }

        // Central white flash at peak (t ≈ 0.45)
        if (t > 0.35 && t < 0.58) {
            const fl = 1 - Math.abs(t - 0.45) / 0.13;
            ctx.globalAlpha = fl * 0.18;
            ctx.fillStyle = '#cce0ff';
            ctx.fillRect(0, 0, W, H);
        }
        ctx.globalAlpha = 1;
    }
}

// ============================================================
// APP
// ============================================================
class App {
    constructor() {
        this.audio = new AudioEngine(); this.planet = null;
        this.address = ''; this.history = [];
        this.planetR = null; this.waveViz = null; this.starfield = null; this.warpR = null;
    }

    init() {
        // Canvases
        this.starfield = new Starfield(document.getElementById('bg-canvas'));
        this.starfield.animate();
        this.planetR = new PlanetRenderer(document.getElementById('planet-canvas'));
        this.planetR.animate();
        this.waveViz = new AudioReactiveEcosystem(
            document.getElementById('waveform-canvas'),
            document.getElementById('viz-mini')
        );
        this.waveViz.animate();

        // Glyph keyboard
        const kb = document.getElementById('glyph-keyboard');
        GLYPHS.forEach(g => {
            const btn = document.createElement('button');
            btn.className = 'glyph-key'; btn.textContent = g;
            btn.addEventListener('click', () => this._addGlyph(g));
            kb.appendChild(btn);
        });

        // Keyboard input (a-z maps to glyphs)
        document.addEventListener('keydown', e => {
            if (e.key === 'Backspace') { e.preventDefault(); this._removeGlyph(); return; }
            if (e.key === 'Enter') { this._navigate(); return; }
            const gi = GLYPHS.indexOf(e.key);
            if (gi >= 0) { this._addGlyph(e.key); return; }
            if (/^[a-z]$/i.test(e.key)) {
                const ci = e.key.toLowerCase().charCodeAt(0) - 97;
                if (ci < GLYPHS.length) this._addGlyph(GLYPHS[ci]);
            }
        });

        // Buttons
        document.getElementById('btn-clear').addEventListener('click', () => this._clearAddress());
        document.getElementById('btn-random').addEventListener('click', () => this._randomAddress());
        document.getElementById('btn-navigate').addEventListener('click', () => this._navigate());
        document.getElementById('btn-bookmark').addEventListener('click', () => this._toggleBookmark());
        document.getElementById('play-btn').addEventListener('click', () => this._togglePlay());

        // Sliders
        const sl = id => {
            const el = document.getElementById(id);
            this._fillSlider(el);
            return el;
        };
        sl('ctrl-vol').addEventListener('input', e => { this.audio.setVolume(+e.target.value); this._fillSlider(e.target); });
        sl('ctrl-reverb').addEventListener('input', e => { this.audio.setReverb(+e.target.value); this._fillSlider(e.target); });
        sl('ctrl-drift').addEventListener('input', e => { this.audio._drift = +e.target.value; this._fillSlider(e.target); });
        sl('ctrl-eq-low').addEventListener('input', e => {
            if (this.audio.eqLow) this.audio.eqLow.gain.value = +e.target.value;
            this._fillSlider(e.target);
        });
        sl('ctrl-eq-mid').addEventListener('input', e => {
            if (this.audio.eqMid) this.audio.eqMid.gain.value = +e.target.value;
            this._fillSlider(e.target);
        });
        sl('ctrl-eq-high').addEventListener('input', e => {
            if (this.audio.eqHigh) this.audio.eqHigh.gain.value = +e.target.value;
            this._fillSlider(e.target);
        });
        document.getElementById('ctrl-granular').addEventListener('change', e => {
            this.audio._granularEnabled = e.target.checked;
            // Live toggle: ramp the dedicated granular bus smoothly —
            // grains keep running silently when off, unmuting is instant
            if (this.audio._granularBus && this.audio.ctx) {
                const g = this.audio._granularBus.gain;
                const now = this.audio.ctx.currentTime;
                g.cancelScheduledValues(now);
                g.setValueAtTime(g.value, now);
                g.linearRampToValueAtTime(e.target.checked ? 1 : 0, now + 1.5);
            }
        });
        document.getElementById('ctrl-perc').addEventListener('change', e => {
            this.audio._percussionEnabled = e.target.checked;
        });

        this.warpR = new WarpRenderer(document.getElementById('warp-canvas'));

        // Parse URL hash for sharable planet address
        const hash = window.location.hash.slice(1);
        const initAddr = hash ? decodeURIComponent(hash) : 'ᚠᚢᚦᚨᚱᚲ';
        this._setAddress(initAddr);
        this._navigate();
    }

    _fillSlider(el) {
        const pct = ((el.value - el.min) / (el.max - el.min)) * 100;

        // Bipolar sliders (EQ) fill from center
        if (el.min < 0 && el.max > 0) {
            const center = 50;
            if (pct > center) {
                el.style.background = `linear-gradient(to right, rgba(91,157,255,0.2) 50%, var(--accent) 50%, var(--accent) ${pct}%, rgba(91,157,255,0.2) ${pct}%)`;
            } else {
                el.style.background = `linear-gradient(to right, rgba(91,157,255,0.2) ${pct}%, var(--accent) ${pct}%, var(--accent) 50%, rgba(91,157,255,0.2) 50%)`;
            }
        } else {
            // Unipolar sliders fill from left
            el.style.background = `linear-gradient(to right,var(--accent) ${pct}%,rgba(91,157,255,0.2) ${pct}%)`;
        }
    }

    _addGlyph(g) { this.address += g; this._syncAddress(); }
    _removeGlyph() { this.address = [...this.address].slice(0, -1).join(''); this._syncAddress(); }
    _clearAddress() { this.address = ''; this._syncAddress(); }
    _setAddress(a) { this.address = a; this._syncAddress(); }

    _syncAddress() {
        // Only update the typing input display — NOT the header location
        document.getElementById('address-text').textContent = this.address;
    }

    _randomAddress() {
        const rng = new RNG((Date.now() ^ (Math.random() * 0xFFFFFF | 0)) >>> 0);
        let a = ''; for (let i = 0; i < rng.int(5, 18); i++) a += rng.pick(GLYPHS);
        this._setAddress(a);
    }

    _navigate() {
        if (!this.address) this._randomAddress();
        const planet = generatePlanet(this.address);
        this.planet = planet;

        // Warp animation tied to biome color
        if (this.warpR) this.warpR.trigger(planet.biome.glowColor);
        // Doppler whoosh on navigation (Tier 3)
        if (this.audio.playing) this.audio._dopplerWhoosh();

        // Update header location (only on confirmed navigation)
        const s = [...this.address].slice(0, 22).join('') + (this.address.length > 22 ? '…' : '');
        document.getElementById('addr-short').textContent = s || '—';

        // Apply biome CSS class
        document.documentElement.className = `biome-${planet.biome.id}`;

        // Planet render
        this.planetR.load(planet);

        // Info panel
        document.getElementById('planet-name').textContent = planet.pname.toUpperCase();
        document.getElementById('planet-designation').textContent = planet.designation;
        document.getElementById('info-biome').textContent = planet.biome.name;
        document.getElementById('info-sonic').textContent = planet.biome.soundProfile;
        document.getElementById('info-freq').textContent = `${planet.rootFreq.toFixed(1)} Hz`;
        document.getElementById('info-scale').textContent = planet.scaleName;
        document.getElementById('info-atmo').textContent = planet.biome.atmosphere;
        document.getElementById('info-reverb').textContent = planet.biome.reverbLabel;
        document.getElementById('planet-desc').textContent = planet.biome.desc;
        document.getElementById('info-moons').textContent = planet.numMoons === 0 ? 'NONE' : `${planet.numMoons} SATELLITE${planet.numMoons > 1 ? 'S' : ''}`;

        // Sector · System · Planet coordinate split
        const glyphs = [...this.address];
        const third = Math.max(1, Math.floor(glyphs.length / 3));
        document.getElementById('info-coords').textContent =
            `${glyphs.slice(0, third).join('') || '?'} · ${glyphs.slice(third, third * 2).join('') || '?'} · ${glyphs.slice(third * 2).join('') || '?'}`;

        // Rarity class
        const len = glyphs.length;
        const RARITY = len <= 3 ? 'common' : len <= 6 ? 'standard' : len <= 10 ? 'uncommon' : len <= 15 ? 'rare' : 'anomalous';
        const rarityEl = document.getElementById('info-rarity');
        rarityEl.textContent = RARITY.toUpperCase();
        rarityEl.className = `rarity-tag rarity-${RARITY}`;

        const st = document.getElementById('info-sonic');
        st.style.borderColor = planet.biome.glowColor;
        st.style.color = planet.biome.glowColor;

        // Sync bookmark button state
        this._syncBookmarkBtn();

        // Overlay name
        const on = document.getElementById('planet-overlay-name');
        on.textContent = planet.pname.toUpperCase();
        on.classList.remove('visible');
        setTimeout(() => on.classList.add('visible'), 850);

        // Waveform colour + oscilloscope mode
        this.waveViz.setColor(planet.biome.glowColor);
        this.waveViz.setBiome(planet.biome.id);

        // History
        if (!this.history.includes(this.address)) {
            this.history.unshift(this.address);
            if (this.history.length > 9) this.history.pop();
            this._renderHistory();
        }

        // URL hash — makes every planet a shareable link
        window.location.hash = encodeURIComponent(this.address);

        // Crossfade audio if playing, else just record new planet
        if (this.audio.playing) {
            this.audio.crossfadeTo(planet, () => this.waveViz.setAnalyser(this.audio.getAnalyser()));
        }
    }

    _renderHistory() {
        const el = document.getElementById('history-chips');
        el.innerHTML = '';
        this.history.forEach(addr => {
            const chip = document.createElement('span');
            chip.className = 'history-chip'; chip.title = addr;
            chip.textContent = [...addr].slice(0, 7).join('') + (addr.length > 7 ? '…' : '');
            chip.addEventListener('click', () => { this._setAddress(addr); this._navigate(); });
            el.appendChild(chip);
        });
    }

    _loadBookmarks() { try { return JSON.parse(localStorage.getItem('hc-bookmarks') || '[]'); } catch (e) { return []; } }
    _saveBookmarks(bm) { localStorage.setItem('hc-bookmarks', JSON.stringify(bm)); }

    _toggleBookmark() {
        const bm = this._loadBookmarks();
        const idx = bm.findIndex(b => b.address === this.address);
        if (idx >= 0) bm.splice(idx, 1);
        else {
            bm.unshift({ address: this.address, name: this.planet ? this.planet.pname : '?', biomeId: this.planet ? this.planet.biome.id : '' });
            if (bm.length > 20) bm.pop();
        }
        this._saveBookmarks(bm);
        this._renderBookmarks();
        this._syncBookmarkBtn();
    }

    _syncBookmarkBtn() {
        const btn = document.getElementById('btn-bookmark');
        if (!btn) return;
        const saved = this._loadBookmarks().some(b => b.address === this.address);
        btn.textContent = saved ? '★ SAVED' : '☆ SAVE';
        btn.classList.toggle('saved', saved);
    }

    _renderBookmarks() {
        const el = document.getElementById('bookmark-chips');
        if (!el) return;
        const bm = this._loadBookmarks();
        el.innerHTML = '';
        if (!bm.length) { el.innerHTML = '<span class="no-history">No bookmarks yet.</span>'; return; }
        bm.forEach(b => {
            const chip = document.createElement('span');
            chip.className = 'bookmark-chip';
            chip.title = (b.name || '?') + ' — ' + b.address;
            chip.textContent = [...b.address].slice(0, 7).join('') + (b.address.length > 7 ? '…' : '');
            chip.addEventListener('click', () => { this._setAddress(b.address); this._navigate(); });
            el.appendChild(chip);
        });
    }

    _togglePlay() {
        const btn = document.getElementById('play-btn');
        const dot = document.getElementById('status-dot');
        const txt = document.getElementById('status-text');
        if (this.audio.playing) {
            this.audio.stop();
            btn.textContent = '▶'; btn.classList.remove('playing');
            dot.className = 'status-dot'; txt.textContent = 'STANDBY';
        } else {
            if (!this.planet) this._navigate();
            dot.className = 'status-dot loading'; txt.textContent = 'INITIATING…';
            setTimeout(() => {
                this.audio.start(this.planet);
                this.waveViz.setAnalyser(this.audio.getAnalyser());
                btn.textContent = '■'; btn.classList.add('playing');
                dot.className = 'status-dot playing'; txt.textContent = 'TRANSMITTING';
            }, 180);
        }
    }
}

// ─── Boot ───
const app = new App();
document.addEventListener('DOMContentLoaded', () => app.init());
