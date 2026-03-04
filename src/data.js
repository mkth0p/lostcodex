// ============================================================
// DATA — biomes, audio configs, scales, tuning systems
// ============================================================

export const GLYPHS = [
    'ᚠ', 'ᚢ', 'ᚦ', 'ᚨ', 'ᚱ', 'ᚲ', 'ᚷ', 'ᚹ', 'ᚺ', 'ᚾ',
    'ᛁ', 'ᛃ', 'ᛇ', 'ᛈ', 'ᛉ', 'ᛋ', 'ᛏ', 'ᛒ', 'ᛖ', 'ᛗ',
    'ᛚ', 'ᛜ', 'ᛞ', 'ᛟ', 'ᛥ', 'ᛦ', 'ᛢ', 'ᛣ', '᛬', '᛭'
];

// Per-biome audio configs — fmRatio/fmIndex = FM synthesis, grain* = granular layer,
// chorus* = stereo widener, sidechainAmt = how much rhythmic pulse ducks the pads
// swing=rhythmic delay on even 16ths, velocityVar=random velocity spread, chordProb=chance of chord,
// arpProb=chance of arp run, pitchBend=max cents bend, percVoices=extra drum voices,
// melFiltFreq/Q=melody bus filter. New waves: glass, brass, organ, pluck, pulse
export const AUDIO_CONFIGS = {
    crystalline: { droneWave: 'sine', padWave: 'sine', reverbMul: 2.2, filterBase: 900, delayFb: 0.55, lfoMul: 0.4, noiseMul: 0.3, melodyOcts: [3, 4, 5], melodyWaves: ['bell', 'glass'], octScale: 3, fmRatio: 3.0, fmIndex: 18, grainDensity: 3.0, grainPitchScatter: 12, grainSize: 55, chorusWet: 0.52, chorusDepth: 5, sidechainAmt: 0.05, swing: 0.0, velocityVar: 0.10, chordProb: 0.30, arpProb: 0.10, pitchBend: 5, percVoices: ['cowbell'], melFiltFreq: 5000, melFiltQ: 0.5, stepCount: 16 },
    volcanic: { droneWave: 'sawtooth', padWave: 'sawtooth', reverbMul: 0.6, filterBase: 500, delayFb: 0.2, lfoMul: 2.0, noiseMul: 2.0, melodyOcts: [1, 2], melodyWaves: ['sawtooth', 'brass'], octScale: 1, fmRatio: 1.41, fmIndex: 110, grainDensity: 7.0, grainPitchScatter: 3, grainSize: 22, chorusWet: 0.08, chorusDepth: 2, sidechainAmt: 0.45, swing: 0.0, velocityVar: 0.30, chordProb: 0.10, arpProb: 0.05, pitchBend: 15, percVoices: ['tom', 'shaker'], melFiltFreq: 800, melFiltQ: 2.0, stepCount: 16 },
    psychedelic: { droneWave: 'square', padWave: 'square', reverbMul: 1.3, filterBase: 1800, delayFb: 0.6, lfoMul: 3.0, noiseMul: 1.2, melodyOcts: [2, 3, 4], melodyWaves: ['wood', 'pulse', 'organ'], octScale: 2, fmRatio: 2.0, fmIndex: 60, grainDensity: 5.5, grainPitchScatter: 35, grainSize: 35, chorusWet: 0.60, chorusDepth: 12, sidechainAmt: 0.35, swing: 0.12, velocityVar: 0.40, chordProb: 0.40, arpProb: 0.30, pitchBend: 30, percVoices: ['clave', 'conga'], melFiltFreq: 3500, melFiltQ: 3.0, stepCount: 16 },
    desert: { droneWave: 'sine', padWave: 'triangle', reverbMul: 1.0, filterBase: 700, delayFb: 0.4, lfoMul: 0.5, noiseMul: 1.8, melodyOcts: [2, 3], melodyWaves: ['wood', 'pluck'], octScale: 2, fmRatio: 5.0, fmIndex: 30, grainDensity: 1.2, grainPitchScatter: 8, grainSize: 80, chorusWet: 0.15, chorusDepth: 3, sidechainAmt: 0.10, swing: 0.08, velocityVar: 0.25, chordProb: 0.10, arpProb: 0.15, pitchBend: 8, percVoices: ['shaker', 'clave'], melFiltFreq: 2000, melFiltQ: 1.0, stepCount: 16 },
    oceanic: { droneWave: 'sine', padWave: 'sine', reverbMul: 1.8, filterBase: 600, delayFb: 0.65, lfoMul: 0.3, noiseMul: 0.8, melodyOcts: [2, 3, 4], melodyWaves: ['bell', 'glass', 'sine'], octScale: 3, fmRatio: 2.0, fmIndex: 22, grainDensity: 2.5, grainPitchScatter: 6, grainSize: 90, chorusWet: 0.40, chorusDepth: 8, sidechainAmt: 0.08, swing: 0.0, velocityVar: 0.15, chordProb: 0.50, arpProb: 0.20, pitchBend: 3, percVoices: ['cowbell'], melFiltFreq: 4000, melFiltQ: 0.8, stepCount: 16 },
    corrupted: { droneWave: 'sawtooth', padWave: 'square', reverbMul: 3.0, filterBase: 2500, delayFb: 0.75, lfoMul: 5.0, noiseMul: 2.5, melodyOcts: [1, 2, 3], melodyWaves: ['sawtooth', 'pulse', 'square'], octScale: 2, fmRatio: 1.0, fmIndex: 180, grainDensity: 8.0, grainPitchScatter: 45, grainSize: 18, chorusWet: 0.30, chorusDepth: 18, sidechainAmt: 0.50, swing: 0.0, velocityVar: 0.50, chordProb: 0.00, arpProb: 0.40, pitchBend: 80, percVoices: ['tom', 'shaker'], melFiltFreq: 8000, melFiltQ: 8.0, stepCount: 16 },
    barren: { droneWave: 'sine', padWave: 'sine', reverbMul: 3.5, filterBase: 300, delayFb: 0.3, lfoMul: 0.1, noiseMul: 0.1, melodyOcts: [3, 4], melodyWaves: ['glass', 'sine'], octScale: 4, fmRatio: 4.0, fmIndex: 8, grainDensity: 0.4, grainPitchScatter: 2, grainSize: 120, chorusWet: 0.04, chorusDepth: 1, sidechainAmt: 0.0, swing: 0.0, velocityVar: 0.05, chordProb: 0.00, arpProb: 0.00, pitchBend: 2, percVoices: [], melFiltFreq: 3000, melFiltQ: 0.5, stepCount: 10 },
    organic: { droneWave: 'triangle', padWave: 'triangle', reverbMul: 0.5, filterBase: 2000, delayFb: 0.35, lfoMul: 1.5, noiseMul: 1.5, melodyOcts: [2, 3, 4], melodyWaves: ['wood', 'organ', 'sine'], octScale: 2, fmRatio: 2.5, fmIndex: 45, grainDensity: 4.0, grainPitchScatter: 18, grainSize: 40, chorusWet: 0.25, chorusDepth: 6, sidechainAmt: 0.15, swing: 0.18, velocityVar: 0.35, chordProb: 0.30, arpProb: 0.25, pitchBend: 12, percVoices: ['conga', 'clave'], melFiltFreq: 2500, melFiltQ: 1.5, stepCount: 12 },
    ethereal: { droneWave: 'sine', padWave: 'sine', reverbMul: 1.6, filterBase: 1200, delayFb: 0.7, lfoMul: 0.2, noiseMul: 0.4, melodyOcts: [3, 4, 5], melodyWaves: ['bell', 'glass', 'triangle'], octScale: 4, fmRatio: 3.5, fmIndex: 12, grainDensity: 1.5, grainPitchScatter: 22, grainSize: 100, chorusWet: 0.70, chorusDepth: 9, sidechainAmt: 0.0, swing: 0.0, velocityVar: 0.08, chordProb: 0.60, arpProb: 0.10, pitchBend: 4, percVoices: ['cowbell'], melFiltFreq: 6000, melFiltQ: 0.7, stepCount: 16 },
    quantum: { droneWave: 'sine', padWave: 'sine', reverbMul: 2.8, filterBase: 3500, delayFb: 0.88, lfoMul: 8.0, noiseMul: 0.6, melodyOcts: [2, 3, 4, 5], melodyWaves: ['glass', 'pulse', 'sine'], octScale: 3, fmRatio: 7.0, fmIndex: 220, grainDensity: 6.0, grainPitchScatter: 80, grainSize: 12, chorusWet: 0.85, chorusDepth: 20, sidechainAmt: 0.0, swing: 0.0, velocityVar: 0.60, chordProb: 0.30, arpProb: 0.50, pitchBend: 120, percVoices: ['shaker', 'cowbell'], melFiltFreq: 9000, melFiltQ: 5.0, stepCount: 7 },
    glacial: { droneWave: 'sine', padWave: 'sine', reverbMul: 5.0, filterBase: 200, delayFb: 0.92, lfoMul: 0.05, noiseMul: 0.05, melodyOcts: [4, 5, 6], melodyWaves: ['glass', 'bell'], octScale: 5, fmRatio: 8.0, fmIndex: 5, grainDensity: 0.2, grainPitchScatter: 5, grainSize: 200, chorusWet: 0.35, chorusDepth: 4, sidechainAmt: 0.0, swing: 0.0, velocityVar: 0.02, chordProb: 0.70, arpProb: 0.00, pitchBend: 1, percVoices: [], melFiltFreq: 4000, melFiltQ: 0.6, stepCount: 6 },
    fungal: { droneWave: 'triangle', padWave: 'triangle', reverbMul: 0.8, filterBase: 1600, delayFb: 0.4, lfoMul: 2.5, noiseMul: 2.2, melodyOcts: [1, 2, 3], melodyWaves: ['wood', 'pluck', 'triangle'], octScale: 1, fmRatio: 1.5, fmIndex: 70, grainDensity: 9.0, grainPitchScatter: 25, grainSize: 30, chorusWet: 0.20, chorusDepth: 7, sidechainAmt: 0.30, swing: 0.20, velocityVar: 0.45, chordProb: 0.20, arpProb: 0.35, pitchBend: 20, percVoices: ['conga', 'tom', 'clave'], melFiltFreq: 1800, melFiltQ: 2.0, stepCount: 12 },
    abyssal: { droneWave: 'sine', padWave: 'sine', reverbMul: 4.0, filterBase: 150, delayFb: 0.8, lfoMul: 0.15, noiseMul: 1.0, melodyOcts: [1, 2], melodyWaves: ['brass', 'sine'], octScale: 1, fmRatio: 0.5, fmIndex: 35, grainDensity: 1.0, grainPitchScatter: 10, grainSize: 150, chorusWet: 0.55, chorusDepth: 10, sidechainAmt: 0.20, swing: 0.0, velocityVar: 0.20, chordProb: 0.35, arpProb: 0.10, pitchBend: 6, percVoices: ['tom'], melFiltFreq: 500, melFiltQ: 1.0, stepCount: 9 },
    // ── New biomes ──
    nebula: { droneWave: 'sine', padWave: 'sine', reverbMul: 3.5, filterBase: 1800, delayFb: 0.75, lfoMul: 0.15, noiseMul: 0.2, melodyOcts: [4, 5, 6], melodyWaves: ['choir', 'strings', 'glass'], octScale: 5, fmRatio: 4.5, fmIndex: 10, grainDensity: 0.8, grainPitchScatter: 30, grainSize: 160, chorusWet: 0.90, chorusDepth: 14, sidechainAmt: 0.0, swing: 0.0, velocityVar: 0.06, chordProb: 0.75, arpProb: 0.05, pitchBend: 2, percVoices: [], melFiltFreq: 7000, melFiltQ: 0.5, stepCount: 6 },
    arctic: { droneWave: 'sine', padWave: 'sine', reverbMul: 4.5, filterBase: 400, delayFb: 0.82, lfoMul: 0.04, noiseMul: 0.08, melodyOcts: [4, 5], melodyWaves: ['theremin', 'metallic', 'bell'], octScale: 4, fmRatio: 6.0, fmIndex: 6, grainDensity: 0.3, grainPitchScatter: 4, grainSize: 180, chorusWet: 0.28, chorusDepth: 3, sidechainAmt: 0.0, swing: 0.0, velocityVar: 0.03, chordProb: 0.55, arpProb: 0.00, pitchBend: 3, percVoices: [], melFiltFreq: 5000, melFiltQ: 0.6, stepCount: 5 },
    storm: { droneWave: 'sawtooth', padWave: 'square', reverbMul: 0.8, filterBase: 3000, delayFb: 0.60, lfoMul: 7.0, noiseMul: 3.0, melodyOcts: [1, 2, 3], melodyWaves: ['subpad', 'sawtooth', 'pulse'], octScale: 1, fmRatio: 1.2, fmIndex: 150, grainDensity: 10.0, grainPitchScatter: 60, grainSize: 15, chorusWet: 0.20, chorusDepth: 20, sidechainAmt: 0.55, swing: 0.0, velocityVar: 0.55, chordProb: 0.05, arpProb: 0.45, pitchBend: 60, percVoices: ['tom', 'conga', 'shaker'], melFiltFreq: 10000, melFiltQ: 6.0, stepCount: 16 },
    crystalloid: { droneWave: 'triangle', padWave: 'sine', reverbMul: 1.8, filterBase: 2200, delayFb: 0.50, lfoMul: 0.8, noiseMul: 0.5, melodyOcts: [3, 4, 5], melodyWaves: ['marimba', 'metallic', 'glass'], octScale: 3, fmRatio: 3.14, fmIndex: 40, grainDensity: 3.5, grainPitchScatter: 8, grainSize: 45, chorusWet: 0.45, chorusDepth: 6, sidechainAmt: 0.12, swing: 0.05, velocityVar: 0.18, chordProb: 0.40, arpProb: 0.30, pitchBend: 7, percVoices: ['cowbell', 'clave'], melFiltFreq: 6000, melFiltQ: 1.5, stepCount: 16 },
};

export const BIOMES = [
    { id: 'crystalline', name: 'CRYSTALLINE VOID', desc: 'A world of permanent winter where time moves differently. Mathematical crystal formations stretch kilometres high.', colors: ['#0a1a3a', '#0d2f5c', '#1a4a7a', '#2a6aa5', '#4fc3f7'], glowColor: '#4fc3f7', soundProfile: 'SPARSE · GLACIAL · RESONANT', atmosphere: 'THIN  NITROGEN-METHANE', reverbLabel: 'CATHEDRAL — 12s' },
    { id: 'volcanic', name: 'MOLTEN DEEP', desc: 'Tectonic fury shapes every surface in perpetual transformation. Pillars of cooled obsidian pierce sulphuric clouds.', colors: ['#2a0800', '#4a1200', '#802000', '#c83800', '#ff5722'], glowColor: '#ff5722', soundProfile: 'DENSE · GRINDING · DEEP', atmosphere: 'THICK  SULPHUR-CO₂', reverbLabel: 'CAVE — 4s' },
    { id: 'psychedelic', name: 'TOXIC BLOOM', desc: 'Strange chemistry produces breathtaking, lethal beauty. Bio-luminescent ecosystems pulse to forgotten rhythms.', colors: ['#0a1e00', '#164000', '#1a6b1a', '#50c030', '#76ff03'], glowColor: '#76ff03', soundProfile: 'PULSING · WARPED · PRISMATIC', atmosphere: 'DENSE  AMMONIA-METHANE', reverbLabel: 'HALL — 8s' },
    { id: 'desert', name: 'ANCIENT SANDS', desc: 'Erosion has had aeons to work its patient art. Enormous sand-carved monuments dwarf any known civilisation.', colors: ['#2a1800', '#4a2e00', '#7a5020', '#b07030', '#ffb74d'], glowColor: '#ffb74d', soundProfile: 'SPARSE · WINDSWEPT · DRY', atmosphere: 'THIN  CO₂-DUST', reverbLabel: 'OPEN — 6s' },
    { id: 'oceanic', name: 'ABYSSAL DEEP', desc: 'Oceanic pressure has birthed peculiar luminescent life drifting in slow thermal currents kilometres below the surface.', colors: ['#00091a', '#001a33', '#00335a', '#0060a0', '#0288d1'], glowColor: '#4dd0e1', soundProfile: 'FLOWING · DEEP · RESONANT', atmosphere: 'WATER-VAPOUR — VAST OCEAN', reverbLabel: 'AQUATIC — 10s' },
    { id: 'corrupted', name: 'CORRUPTED STRATUM', desc: 'Reality itself seems unstable here. Gravitational anomalies and electromagnetic storms defy all cataloguing attempts.', colors: ['#0d0020', '#1a0040', '#350070', '#6000c0', '#7c4dff'], glowColor: '#d500f9', soundProfile: 'GLITCHED · DARK · FRACTURED', atmosphere: 'ANOMALOUS — DATA CORRUPT', reverbLabel: 'INFINITE — ∞s' },
    { id: 'barren', name: 'BARREN EXPANSE', desc: 'Nothing grows, nothing moves. Pure geometry and silence, interrupted only by the distant pulse of stellar wind.', colors: ['#0e0e0e', '#1c1c1c', '#2e2e2e', '#444444', '#666666'], glowColor: '#9e9e9e', soundProfile: 'MINIMAL · SPARSE · STILL', atmosphere: 'VACUUM — NO ATMOSPHERE', reverbLabel: 'VOID — 15s' },
    { id: 'organic', name: 'VERDANT LABYRINTH', desc: 'Life runs rampant in endless recursive patterns. The canopy is so dense that the sky has not been seen in millennia.', colors: ['#001a04', '#00330a', '#005510', '#008820', '#00e676'], glowColor: '#00e676', soundProfile: 'LUSH · BREATHING · ALIVE', atmosphere: 'RICH  OXYGEN-NITROGEN', reverbLabel: 'FOREST — 3s' },
    { id: 'ethereal', name: 'PHANTOM DRIFT', desc: "The atmosphere carries whispers of civilisations long dissolved. Holographic echoes flicker perpetually at vision's edge.", colors: ['#0d0d2e', '#1a1a50', '#2a2a7a', '#5050b0', '#9fa8da'], glowColor: '#9fa8da', soundProfile: 'HAUNTED · SOFT · TRANSCENDENT', atmosphere: 'SPARSE  NOBLE-GAS MIX', reverbLabel: 'CHAMBER — 9s' },
    { id: 'quantum', name: 'QUANTUM SHATTER', desc: 'Matter exists in superposition at all scales. Observation alters the planet itself — every visit is a different world.', colors: ['#020020', '#0e0040', '#200080', '#6000ff', '#a855f7'], glowColor: '#a855f7', soundProfile: 'PHASED · GLITCHED · HYPERDENSE', atmosphere: 'QUANTUM FOAM — UNDEFINED', reverbLabel: 'RECURSIVE — ∞s' },
    { id: 'glacial', name: 'ETERNAL FROST', desc: 'Silence so absolute it becomes a sound. Each breath crystallises mid-air. Time itself has slowed to match the ice.', colors: ['#00111e', '#002244', '#003a66', '#006699', '#b3e0ff'], glowColor: '#b3e0ff', soundProfile: 'MINIMAL · FROZEN · VAST', atmosphere: 'METHANE ICE — TRACE NITROGEN', reverbLabel: 'ARCTIC CAVE — 20s' },
    { id: 'fungal', name: 'MYCELIUM VAST', desc: 'An interconnected organism spanning the entire surface. Spore clouds drift between towering fruiting bodies kilometres tall.', colors: ['#0f0a00', '#2a1800', '#5a2d00', '#9b4d00', '#d97706'], glowColor: '#d97706', soundProfile: 'POLYRHYTHMIC · DAMP · ALIVE', atmosphere: 'THICK  SPORE CLOUD', reverbLabel: 'CAVERN — 5s' },
    { id: 'abyssal', name: 'ABYSSAL TITAN', desc: 'A gas giant of immeasurable depth. Pressures at the core create exotic states of matter: metallic hydrogen oceans.', colors: ['#030014', '#060028', '#100050', '#1c0880', '#3b0aaa'], glowColor: '#3b0aaa', soundProfile: 'SUB-BASS · SLOW · CRUSHING', atmosphere: 'SUPERCRITICAL HYDROGEN', reverbLabel: 'DEEP CAVE — 18s' },
    // ── New biomes ──
    { id: 'nebula', name: 'CHROMATIC NEBULA', desc: 'A planet wreathed in glowing gas clouds of impossible colour. Ionised particles sing in resonant frequencies audible only in vacuum.', colors: ['#0a0020', '#1a0050', '#3000a0', '#7030e0', '#e040fb'], glowColor: '#e040fb', soundProfile: 'CHORAL · VAST · SHIFTING', atmosphere: 'IONISED GAS — PLASMA WISPS', reverbLabel: 'NEBULA — 22s' },
    { id: 'arctic', name: 'POLAR SILENCE', desc: 'A world of absolute cold where sound travels as cracks through continent-scale ice sheets. Eerie tones drift between frozen spires.', colors: ['#001428', '#002a50', '#004488', '#0077cc', '#a8d8ff'], glowColor: '#a8d8ff', soundProfile: 'SPARSE · CRYSTALLINE · EERIE', atmosphere: 'THIN NITROGEN-ICE', reverbLabel: 'ICE CAVE — 25s' },
    { id: 'storm', name: 'TEMPEST WORLD', desc: 'An unceasing electrical apocalypse. Lightning strikes every second across a globe-spanning hypercane. Surviving signals are chaos.', colors: ['#0d0d00', '#252500', '#504000', '#908000', '#f5c000'], glowColor: '#f5c000', soundProfile: 'VIOLENT · ELECTRIC · CHAOTIC', atmosphere: 'DENSE AMMONIA STORM', reverbLabel: 'OPEN STORM — 2s' },
    { id: 'crystalloid', name: 'CRYSTALLOID HIVE', desc: 'A living crystal organism covers every surface, growing in perfect Euclidean geometries. Each formation resonates at a precise frequency.', colors: ['#001a10', '#003020', '#005840', '#00a878', '#4dffc0'], glowColor: '#4dffc0', soundProfile: 'RHYTHMIC · PRECISE · ALIEN', atmosphere: 'SILICATE MIST — TRACE O₂', reverbLabel: 'RESONANT CHAMBER — 7s' },
];

// ── Scales ──
export const SCALES = {
    // Western Diatonic Modes
    'Ionian': [0, 2, 4, 5, 7, 9, 11],
    'Dorian': [0, 2, 3, 5, 7, 9, 10],
    'Phrygian': [0, 1, 3, 5, 7, 8, 10],
    'Lydian': [0, 2, 4, 6, 7, 9, 11],
    'Mixolydian': [0, 2, 4, 5, 7, 9, 10],
    'Aeolian': [0, 2, 3, 5, 7, 8, 10],
    'Locrian': [0, 1, 3, 5, 6, 8, 10],
    // Harmonic & Melodic Variants
    'Harm. Minor': [0, 2, 3, 5, 7, 8, 11],
    'Mel. Minor': [0, 2, 3, 5, 7, 9, 11],
    'Hung. Minor': [0, 2, 3, 6, 7, 8, 11],
    'Dbl. Harmonic': [0, 1, 4, 5, 7, 8, 11],
    // Pentatonic
    'Pent. Major': [0, 2, 4, 7, 9],
    'Pent. Minor': [0, 3, 5, 7, 10],
    'Blues': [0, 3, 5, 6, 7, 10],
    // World / Ethnic
    'Hirajoshi': [0, 2, 3, 7, 8],
    'In Sen': [0, 1, 5, 7, 10],
    'Pelog': [0, 1, 3, 7, 8],
    'Slendro': [0, 2, 5, 7, 9],
    'Raga Bhairav': [0, 1, 4, 5, 7, 8, 11],
    'Raga Todi': [0, 1, 3, 6, 7, 8, 11],
    'Persian': [0, 1, 4, 5, 6, 8, 11],
    // Symmetric / Avant-garde
    'Whole Tone': [0, 2, 4, 6, 8, 10],
    'Diminished': [0, 2, 3, 5, 6, 8, 9, 11],
    'Augmented': [0, 3, 4, 7, 8, 11],
    'Tritone': [0, 1, 4, 6, 7, 10],
    'Enigmatic': [0, 1, 4, 6, 8, 10, 11],
    'Chromatic': [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
};

// Root frequencies: full chromatic range across octaves 1–2 (C1–B2)
export const ROOT_NOTES = [
    32.70, 34.65, 36.71, 38.89, 41.20, 43.65, 46.25, 49.00, 51.91, 55.00, 58.27, 61.74, // C1–B1
    65.41, 69.30, 73.42, 77.78, 82.41, 87.31, 92.50, 98.00, 103.83, 110.0, 116.54, 123.47, // C2–B2
];

// ── Tuning Systems ──
// Each maps semitone index (0–11) → frequency ratio relative to root
export const TUNING_SYSTEMS = {
    'Equal': null, // 12-TET — computed as Math.pow(2, step/12)
    'Just': [1, 16 / 15, 9 / 8, 6 / 5, 5 / 4, 4 / 3, 45 / 32, 3 / 2, 8 / 5, 5 / 3, 9 / 5, 15 / 8],
    'Pythagorean': [1, 256 / 243, 9 / 8, 32 / 27, 81 / 64, 4 / 3, 729 / 512, 3 / 2, 128 / 81, 27 / 16, 16 / 9, 243 / 128],
};
export const TUNING_NAMES = Object.keys(TUNING_SYSTEMS);

// ── Chord Progression Engine ──
// Maps chord symbols to semitone offsets relative to scale root
export const CHORD_TEMPLATES = {
    'I': [0, 4, 7],     // Tonic
    'ii': [2, 5, 9],    // Supertonic
    'iii': [4, 7, 11],  // Mediant
    'IV': [5, 9, 12],   // Subdominant
    'V': [7, 11, 14],   // Dominant
    'vi': [9, 12, 16],   // Submediant
    'vii°': [11, 14, 17] // Leading tone (diminished)
};

export const PROGRESSIONS = [
    ['I', 'V', 'vi', 'IV'],   // Pop anthem
    ['I', 'IV', 'I', 'V'],    // Folk/Blues
    ['ii', 'V', 'I', 'vi'],   // Jazz turnaround
    ['I', 'vi', 'IV', 'V'],   // 50s progression
    ['vi', 'IV', 'I', 'V'],   // Emotional/Melancholic
    ['I', 'V', 'ii', 'IV'],   // Modern ethereal
    ['I', 'iii', 'vi', 'IV'], // Uplifting
];
