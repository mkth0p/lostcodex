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
    // ── Original Biomes ──
    crystalline: { ambianceFeatures: ['wind'], chordAudibility: 0.15, droneWave: 'sine', padWave: 'sine', reverbMul: 2.5, filterBase: 900, delayFb: 0.55, lfoMul: 0.4, noiseMul: 0.2, melodyOcts: [4, 5], melodyWaves: ['crystal_chimes', 'glass', 'granular_cloud'], octScale: 3, fmRatio: 3.0, fmIndex: 12, grainDensity: 2.0, grainPitchScatter: 15, grainSize: 60, chorusWet: 0.5, chorusDepth: 5, sidechainAmt: 0.05, swing: 0.0, velocityVar: 0.20, chordProb: 0.20, arpProb: 0.15, pitchBend: 5, percVoices: ['cowbell', 'shaker'], melFiltFreq: 6000, melFiltQ: 0.5, stepCount: 16, melodyDensity: 0.08 },
    volcanic: { chordAudibility: 0.1, droneWave: 'sawtooth', padWave: 'sawtooth', reverbMul: 0.5, filterBase: 400, delayFb: 0.2, lfoMul: 2.5, noiseMul: 2.8, melodyOcts: [1, 2], melodyWaves: ['saw_sync', 'subpad', 'bowed_metal'], octScale: 1, fmRatio: 1.41, fmIndex: 120, grainDensity: 8.0, grainPitchScatter: 5, grainSize: 20, chorusWet: 0.1, chorusDepth: 2, sidechainAmt: 0.5, swing: 0.0, velocityVar: 0.40, chordProb: 0.05, arpProb: 0.05, pitchBend: 20, percVoices: ['tom', 'shaker'], melFiltFreq: 900, melFiltQ: 2.5, stepCount: 16, melodyDensity: 0.06 },
    psychedelic: { chordAudibility: 0.4, droneWave: 'sawtooth', padWave: 'square', reverbMul: 1.4, filterBase: 1600, delayFb: 0.7, lfoMul: 3.5, noiseMul: 1.0, melodyOcts: [2, 3, 4], melodyWaves: ['vowel_morph', 'reed', 'drone_morph'], octScale: 2, fmRatio: 2.5, fmIndex: 80, grainDensity: 6.0, grainPitchScatter: 40, grainSize: 30, chorusWet: 0.65, chorusDepth: 15, sidechainAmt: 0.35, swing: 0.18, velocityVar: 0.45, chordProb: 0.45, arpProb: 0.35, pitchBend: 45, percVoices: ['cowbell', 'shaker'], melFiltFreq: 3500, melFiltQ: 3.5, stepCount: 16, melodyDensity: 0.12 },
    desert: { chordAudibility: 0.2, droneWave: 'sine', padWave: 'triangle', reverbMul: 0.8, filterBase: 800, delayFb: 0.4, lfoMul: 0.6, noiseMul: 2.2, melodyOcts: [2, 3], melodyWaves: ['hollow_pipe', 'bowed_metal', 'pluck'], octScale: 2, fmRatio: 5.0, fmIndex: 25, grainDensity: 1.5, grainPitchScatter: 10, grainSize: 85, chorusWet: 0.2, chorusDepth: 4, sidechainAmt: 0.10, swing: 0.12, velocityVar: 0.35, chordProb: 0.15, arpProb: 0.10, pitchBend: 12, percVoices: ['shaker', 'clave'], melFiltFreq: 2200, melFiltQ: 1.2, stepCount: 16, melodyDensity: 0.05 },
    oceanic: { ambianceFeatures: ['rain', 'bubbles'], chordAudibility: 0.85, droneWave: 'sine', padWave: 'choir', reverbMul: 2.0, filterBase: 600, delayFb: 0.65, lfoMul: 0.2, noiseMul: 0.6, melodyOcts: [2, 3, 4], melodyWaves: ['electric_piano', 'choir', 'drone_morph'], octScale: 2, fmRatio: 2.0, fmIndex: 20, grainDensity: 2.5, grainPitchScatter: 6, grainSize: 90, chorusWet: 0.45, chorusDepth: 8, sidechainAmt: 0.05, swing: 0.0, velocityVar: 0.15, chordProb: 0.60, arpProb: 0.20, pitchBend: 4, percVoices: ['tom', 'conga'], melFiltFreq: 4500, melFiltQ: 0.8, stepCount: 16, melodyDensity: 0.10 },
    corrupted: { chordAudibility: 0.05, droneWave: 'sawtooth', padWave: 'square', reverbMul: 2.5, filterBase: 2500, delayFb: 0.8, lfoMul: 6.0, noiseMul: 3.5, melodyOcts: [1, 2, 3], melodyWaves: ['saw_sync', 'metallic', 'granular_cloud'], octScale: 2, fmRatio: 1.1, fmIndex: 200, grainDensity: 9.0, grainPitchScatter: 60, grainSize: 15, chorusWet: 0.35, chorusDepth: 20, sidechainAmt: 0.60, swing: 0.0, velocityVar: 0.60, chordProb: 0.00, arpProb: 0.50, pitchBend: 100, percVoices: ['tom', 'shaker'], melFiltFreq: 8500, melFiltQ: 6.0, stepCount: 16, melodyDensity: 0.18 },
    barren: { chordAudibility: 0.1, droneWave: 'sine', padWave: 'sine', reverbMul: 4.0, filterBase: 250, delayFb: 0.3, lfoMul: 0.05, noiseMul: 0.05, melodyOcts: [3, 4], melodyWaves: ['crystal_chimes', 'bowed_metal'], octScale: 4, fmRatio: 4.0, fmIndex: 5, grainDensity: 0.2, grainPitchScatter: 2, grainSize: 150, chorusWet: 0.05, chorusDepth: 1, sidechainAmt: 0.0, swing: 0.0, velocityVar: 0.05, chordProb: 0.00, arpProb: 0.00, pitchBend: 2, percVoices: [], melFiltFreq: 3000, melFiltQ: 0.5, stepCount: 10, melodyDensity: 0.03 },
    organic: { ambianceFeatures: ['birds', 'rain', 'rustle'], chordAudibility: 0.3, droneWave: 'triangle', padWave: 'triangle', reverbMul: 0.6, filterBase: 2000, delayFb: 0.35, lfoMul: 1.5, noiseMul: 1.2, melodyOcts: [2, 3, 4], melodyWaves: ['marimba', 'hollow_pipe', 'bowed_metal'], octScale: 2, fmRatio: 2.2, fmIndex: 40, grainDensity: 4.5, grainPitchScatter: 20, grainSize: 35, chorusWet: 0.25, chorusDepth: 6, sidechainAmt: 0.20, swing: 0.22, velocityVar: 0.40, chordProb: 0.25, arpProb: 0.35, pitchBend: 15, percVoices: ['conga', 'clave', 'shaker'], melFiltFreq: 2800, melFiltQ: 1.4, stepCount: 12, melodyDensity: 0.15 },
    ethereal: { chordAudibility: 0.95, droneWave: 'sine', padWave: 'choir', reverbMul: 1.8, filterBase: 1200, delayFb: 0.75, lfoMul: 0.15, noiseMul: 0.3, melodyOcts: [3, 4, 5], melodyWaves: ['vowel_morph', 'theremin', 'granular_cloud', 'drone_morph'], octScale: 4, fmRatio: 3.5, fmIndex: 10, grainDensity: 1.2, grainPitchScatter: 25, grainSize: 110, chorusWet: 0.75, chorusDepth: 10, sidechainAmt: 0.0, swing: 0.0, velocityVar: 0.10, chordProb: 0.70, arpProb: 0.10, pitchBend: 4, percVoices: ['shaker'], melFiltFreq: 6500, melFiltQ: 0.7, stepCount: 16, melodyDensity: 0.06 },
    quantum: { chordAudibility: 0.5, droneWave: 'sine', padWave: 'sine', reverbMul: 3.0, filterBase: 3500, delayFb: 0.9, lfoMul: 9.0, noiseMul: 0.7, melodyOcts: [2, 3, 4, 5], melodyWaves: ['granular_cloud', 'pulse', 'drone_morph'], octScale: 3, fmRatio: 7.0, fmIndex: 250, grainDensity: 7.0, grainPitchScatter: 100, grainSize: 10, chorusWet: 0.90, chorusDepth: 25, sidechainAmt: 0.0, swing: 0.0, velocityVar: 0.70, chordProb: 0.35, arpProb: 0.60, pitchBend: 140, percVoices: ['shaker', 'cowbell', 'clave'], melFiltFreq: 9500, melFiltQ: 5.0, stepCount: 7, melodyDensity: 0.25 },
    glacial: { chordAudibility: 0.2, droneWave: 'sine', padWave: 'sine', reverbMul: 5.5, filterBase: 200, delayFb: 0.95, lfoMul: 0.03, noiseMul: 0.03, melodyOcts: [4, 5, 6], melodyWaves: ['glass', 'granular_cloud', 'bell'], octScale: 5, fmRatio: 8.0, fmIndex: 4, grainDensity: 0.1, grainPitchScatter: 3, grainSize: 250, chorusWet: 0.40, chorusDepth: 4, sidechainAmt: 0.0, swing: 0.0, velocityVar: 0.02, chordProb: 0.80, arpProb: 0.00, pitchBend: 1, percVoices: [], melFiltFreq: 4000, melFiltQ: 0.6, stepCount: 6, melodyDensity: 0.01 },
    fungal: { ambianceFeatures: ['spores', 'rustle', 'dew'], chordAudibility: 0.35, droneWave: 'triangle', padWave: 'triangle', reverbMul: 0.8, filterBase: 1500, delayFb: 0.4, lfoMul: 2.3, noiseMul: 1.8, melodyOcts: [2, 3, 3, 4], melodyWaves: ['marimba', 'marimba', 'hollow_pipe', 'pluck', 'wood', 'reed'], octScale: 1, fmRatio: 1.8, fmIndex: 42, grainDensity: 5.8, grainPitchScatter: 16, grainSize: 32, chorusWet: 0.32, chorusDepth: 7, sidechainAmt: 0.12, swing: 0.28, velocityVar: 0.36, chordProb: 0.18, arpProb: 0.32, pitchBend: 14, percVoices: ['conga', 'woodblock', 'shaker', 'clave', 'bongo', 'rimshot'], melFiltFreq: 3600, melFiltQ: 1.1, stepCount: 12, melodyDensity: 0.16 },
    abyssal: { chordAudibility: 0.05, droneWave: 'sine', padWave: 'sawtooth', reverbMul: 4.5, filterBase: 100, delayFb: 0.85, lfoMul: 0.1, noiseMul: 1.2, melodyOcts: [1, 2], melodyWaves: ['gong', 'subpad', 'bowed_metal'], octScale: 1, fmRatio: 0.4, fmIndex: 40, grainDensity: 1.2, grainPitchScatter: 15, grainSize: 180, chorusWet: 0.60, chorusDepth: 12, sidechainAmt: 0.15, swing: 0.0, velocityVar: 0.15, chordProb: 0.20, arpProb: 0.05, pitchBend: 8, percVoices: ['tom'], melFiltFreq: 400, melFiltQ: 1.0, stepCount: 9, melodyDensity: 0.04 },
    // ── New biomes ──
    nebula: { chordAudibility: 1.0, droneWave: 'sine', padWave: 'sawtooth', reverbMul: 3.8, filterBase: 1800, delayFb: 0.80, lfoMul: 0.15, noiseMul: 0.1, melodyOcts: [4, 5, 6], melodyWaves: ['choir', 'vowel_morph', 'drone_morph'], octScale: 5, fmRatio: 4.5, fmIndex: 8, grainDensity: 0.6, grainPitchScatter: 35, grainSize: 180, chorusWet: 0.95, chorusDepth: 16, sidechainAmt: 0.0, swing: 0.0, velocityVar: 0.05, chordProb: 0.85, arpProb: 0.05, pitchBend: 2, percVoices: [], melFiltFreq: 7500, melFiltQ: 0.5, stepCount: 6, melodyDensity: 0.02 },
    arctic: { chordAudibility: 0.1, droneWave: 'sine', padWave: 'sine', reverbMul: 4.8, filterBase: 350, delayFb: 0.85, lfoMul: 0.04, noiseMul: 0.06, melodyOcts: [4, 5], melodyWaves: ['theremin', 'crystal_chimes', 'granular_cloud'], octScale: 4, fmRatio: 6.0, fmIndex: 5, grainDensity: 0.2, grainPitchScatter: 4, grainSize: 200, chorusWet: 0.30, chorusDepth: 3, sidechainAmt: 0.0, swing: 0.0, velocityVar: 0.03, chordProb: 0.45, arpProb: 0.00, pitchBend: 3, percVoices: [], melFiltFreq: 4800, melFiltQ: 0.6, stepCount: 5, melodyDensity: 0.02 },
    storm: { ambianceFeatures: ['rain', 'thunder', 'lightning'], chordAudibility: 0.02, droneWave: 'sawtooth', padWave: 'sawtooth', reverbMul: 0.7, filterBase: 3500, delayFb: 0.65, lfoMul: 8.0, noiseMul: 3.8, melodyOcts: [1, 2, 3], melodyWaves: ['saw_sync', 'subpad', 'bowed_metal'], octScale: 1, fmRatio: 1.3, fmIndex: 180, grainDensity: 12.0, grainPitchScatter: 80, grainSize: 12, chorusWet: 0.25, chorusDepth: 22, sidechainAmt: 0.65, swing: 0.0, velocityVar: 0.60, chordProb: 0.00, arpProb: 0.60, pitchBend: 80, percVoices: ['tom', 'conga', 'shaker'], melFiltFreq: 12000, melFiltQ: 6.5, stepCount: 16, melodyDensity: 0.28 },
    crystalloid: { chordAudibility: 0.6, droneWave: 'triangle', padWave: 'sine', reverbMul: 2.0, filterBase: 2400, delayFb: 0.55, lfoMul: 0.8, noiseMul: 0.4, melodyOcts: [3, 4, 5], melodyWaves: ['marimba', 'crystal_chimes', 'granular_cloud'], octScale: 3, fmRatio: 3.14, fmIndex: 50, grainDensity: 4.0, grainPitchScatter: 10, grainSize: 40, chorusWet: 0.50, chorusDepth: 8, sidechainAmt: 0.10, swing: 0.05, velocityVar: 0.20, chordProb: 0.50, arpProb: 0.35, pitchBend: 5, percVoices: ['cowbell', 'clave'], melFiltFreq: 6500, melFiltQ: 1.2, stepCount: 16, melodyDensity: 0.12 },
};

export const V2_RICHNESS_BASELINE = {
    crystalline: { harmonicity: 0.84, brightness: 0.72, density: 0.56 },
    crystalloid: { harmonicity: 0.82, brightness: 0.7, density: 0.62 },
    glacial: { harmonicity: 0.74, brightness: 0.66, density: 0.32 },
    arctic: { harmonicity: 0.7, brightness: 0.64, density: 0.34 },
    oceanic: { harmonicity: 0.78, brightness: 0.52, density: 0.58 },
    ethereal: { harmonicity: 0.82, brightness: 0.68, density: 0.52 },
    nebula: { harmonicity: 0.8, brightness: 0.66, density: 0.5 },
    organic: { harmonicity: 0.68, brightness: 0.48, density: 0.62 },
    fungal: { harmonicity: 0.6, brightness: 0.42, density: 0.64 },
    desert: { harmonicity: 0.46, brightness: 0.4, density: 0.34 },
    barren: { harmonicity: 0.34, brightness: 0.28, density: 0.24 },
    volcanic: { harmonicity: 0.38, brightness: 0.3, density: 0.56 },
    storm: { harmonicity: 0.32, brightness: 0.26, density: 0.7 },
    corrupted: { harmonicity: 0.28, brightness: 0.22, density: 0.72 },
    abyssal: { harmonicity: 0.36, brightness: 0.18, density: 0.52 },
    psychedelic: { harmonicity: 0.62, brightness: 0.52, density: 0.64 },
    quantum: { harmonicity: 0.56, brightness: 0.44, density: 0.68 },
    default: { harmonicity: 0.58, brightness: 0.5, density: 0.5 },
};

export const V2_FX_LANE_BASELINE = {
    crystalline: { organic: 0.28, harmonic: 0.72, synthetic: 0.36, contrast: 0.42 },
    crystalloid: { organic: 0.24, harmonic: 0.76, synthetic: 0.44, contrast: 0.44 },
    glacial: { organic: 0.2, harmonic: 0.64, synthetic: 0.28, contrast: 0.32 },
    arctic: { organic: 0.22, harmonic: 0.62, synthetic: 0.3, contrast: 0.34 },
    oceanic: { organic: 0.72, harmonic: 0.42, synthetic: 0.26, contrast: 0.3 },
    organic: { organic: 0.78, harmonic: 0.34, synthetic: 0.2, contrast: 0.28 },
    fungal: { organic: 0.76, harmonic: 0.36, synthetic: 0.22, contrast: 0.26 },
    desert: { organic: 0.62, harmonic: 0.32, synthetic: 0.22, contrast: 0.32 },
    volcanic: { organic: 0.38, harmonic: 0.24, synthetic: 0.68, contrast: 0.52 },
    storm: { organic: 0.52, harmonic: 0.24, synthetic: 0.78, contrast: 0.58 },
    corrupted: { organic: 0.34, harmonic: 0.18, synthetic: 0.84, contrast: 0.66 },
    abyssal: { organic: 0.26, harmonic: 0.42, synthetic: 0.58, contrast: 0.5 },
    ethereal: { organic: 0.3, harmonic: 0.66, synthetic: 0.38, contrast: 0.36 },
    nebula: { organic: 0.26, harmonic: 0.62, synthetic: 0.54, contrast: 0.48 },
    psychedelic: { organic: 0.36, harmonic: 0.48, synthetic: 0.72, contrast: 0.52 },
    quantum: { organic: 0.22, harmonic: 0.52, synthetic: 0.86, contrast: 0.62 },
    barren: { organic: 0.12, harmonic: 0.28, synthetic: 0.18, contrast: 0.2 },
    default: { organic: 0.4, harmonic: 0.44, synthetic: 0.44, contrast: 0.4 },
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
    'vii°': [11, 14, 17], // Leading tone (diminished)
    'i': [0, 3, 7],     // Tonic minor
    'III': [4, 8, 11],  // Major mediant
    'iv': [5, 8, 12],   // Subdominant minor
    'v': [7, 10, 14],   // Dominant minor
    'VI': [9, 13, 16],  // Submediant major
    'bVI': [8, 12, 15], // Flat Submediant
    'bVII': [10, 14, 17] // Flat Subtonic
};

export const PROGRESSIONS = [
    ['I', 'V', 'vi', 'IV'],   // Pop anthem
    ['I', 'IV', 'I', 'V'],    // Folk/Blues
    ['ii', 'V', 'I', 'vi'],   // Jazz turnaround
    ['I', 'vi', 'IV', 'V'],   // 50s progression
    ['vi', 'IV', 'I', 'V'],   // Emotional/Melancholic
    ['I', 'V', 'ii', 'IV'],   // Modern ethereal
    ['I', 'iii', 'vi', 'IV'], // Uplifting

    // Extended & 8-chord sequences
    ['I', 'vi', 'IV', 'iv', 'I', 'III', 'vi', 'V'],
    ['vi', 'v', 'IV', 'I', 'ii', 'vi', 'bVII', 'V'],
    ['I', 'IV', 'vi', 'V', 'bVI', 'bVII', 'I', 'I'],
    ['i', 'bVI', 'III', 'bVII', 'iv', 'i', 'VI', 'V'],
    ['I', 'iii', 'IV', 'iv', 'I', 'V', 'vi', 'IV'],

    // Long generative arks
    ['I', 'V', 'vi', 'iii', 'IV', 'I', 'ii', 'V', 'I', 'vi', 'IV', 'V', 'iii', 'vi', 'ii', 'V'],
];
