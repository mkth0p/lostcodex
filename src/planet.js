// ============================================================
// PLANET GENERATOR
// ============================================================
import { GLYPHS, BIOMES, SCALES, ROOT_NOTES, AUDIO_CONFIGS, TUNING_SYSTEMS, PROGRESSIONS } from './data.js';
import { RNG, hashAddress } from './rng.js';

export function generatePlanet(address) {
    const seed = hashAddress(address || 'ᚠᚢᚦ');
    const rng = new RNG(seed);
    const chars = [...(address || 'ᚠᚢᚦ')];

    // Helper to get deterministic value from specific glyph position
    const getPosVal = (idx, max) => {
        if (idx >= chars.length) return rng.int(0, max);
        const gIdx = GLYPHS.indexOf(chars[idx]);
        return (gIdx === -1 ? rng.int(0, max) : gIdx) % max;
    };

    // ── Deterministic Positional Encoding (Library of Babel Style) ──
    // G1: Biome, G2: Scale, G3: Root Note, G4: Tuning & Features
    const biomeIdx = getPosVal(0, BIOMES.length);
    const biome = BIOMES[biomeIdx];

    const scaleKeys = Object.keys(SCALES);
    const scaleIdx = getPosVal(1, scaleKeys.length);
    const scaleName = scaleKeys[scaleIdx];
    const scale = SCALES[scaleName];

    const rootIdx = getPosVal(2, ROOT_NOTES.length);
    const rootFreq = ROOT_NOTES[rootIdx];

    const flags = getPosVal(3, GLYPHS.length);
    const tuningSystem = ['Equal', 'Just', 'Pythagorean'][flags % 3];
    const tuningRatios = TUNING_SYSTEMS[tuningSystem];

    // Alien name (still uses seed for flavor)
    const syls = ['zra', 'tho', 'vel', 'kry', 'mnu', 'phe', 'shio', 'xnu', 'yss', 'drae', 'fryu', 'glon', 'spei', 'nyao', 'vren', 'bluu', 'kreth', 'aevon', 'thrix', 'zumar', 'veq', 'iith', 'nnor'];
    const ends = ['is', 'an', 'on', 'ar', 'ix', 'us', 'ae', 'or', 'ia', 'yx', 'eth', 'un', 'ael', 'orn'];
    let pname = '';
    for (let i = 0; i < rng.int(2, 4); i++) pname += rng.pick(syls);
    pname += rng.pick(ends);
    pname = pname[0].toUpperCase() + pname.slice(1);

    const hex1 = (seed & 0xFFFF).toString(16).toUpperCase().padStart(4, '0');
    const hex2 = ((seed >>> 16) & 0xFF).toString(16).toUpperCase().padStart(2, '0');

    const rareRoll = rng.range(0, 1);
    const rarityClass = rareRoll > 0.98 ? 'LEGENDARY' : rareRoll > 0.9 ? 'RARE' : rareRoll > 0.7 ? 'UNCOMMON' : 'COMMON';
    const baseAc = AUDIO_CONFIGS[biome.id];
    const ac = { ...baseAc };
    const melodyDensity = (baseAc.melodyDensity || 0.05) * rng.range(0.5, 2.0);

    // ── Feature overrides from flags ──
    const quarterToneProb = (flags & 4) ? 0.15 : 0;
    const octaveStretch = (flags & 8) ? 1.012 : 1.0;

    // Visual features tied to biomes
    const hasIceCaps = ['glacial', 'crystalline', 'abyssal'].includes(biome.id);
    const hasAuroras = ['ethereal', 'quantum', 'oceanic', 'barren'].includes(biome.id) && rng.bool(0.7);
    const hasCraters = ['barren', 'volcanic', 'desert'].includes(biome.id);
    const hasLavaGlow = biome.id === 'volcanic';

    // Create a deeply unique AudioConfig for this specific planet seed
    // by using the biome's config as base values and scaling them.

    // Huge multiplicative variance
    ac.noiseMul = baseAc.noiseMul * rng.range(0.2, 5.0);
    ac.lfoMul = baseAc.lfoMul * rng.range(0.5, 3.0);
    ac.fmIndex = baseAc.fmIndex * rng.range(0.3, 4.0);
    ac.fmRatio = baseAc.fmRatio * rng.range(0.8, 1.5);
    ac.reverbMul = baseAc.reverbMul * rng.range(0.5, 2.0);
    ac.grainDensity = baseAc.grainDensity * rng.range(0.2, 3.0);
    ac.grainPitchScatter = baseAc.grainPitchScatter * rng.range(0.5, 2.5);
    ac.chorusDepth = baseAc.chorusDepth * rng.range(0.5, 2.0);
    ac.chordAudibility = Math.max(0, Math.min(1.0, baseAc.chordAudibility + rng.range(-0.3, 0.3)));

    // Add 1-3 extra random percussion voices on top of the base
    const extraPercPool = ['tom', 'shaker', 'cowbell', 'clave', 'conga'];
    const percCount = rng.int(0, 3);
    const uniquePercs = new Set(ac.percVoices);
    for (let i = 0; i < percCount; i++) {
        uniquePercs.add(rng.pick(extraPercPool));
    }
    ac.percVoices = Array.from(uniquePercs);

    // Motif Bank generation for variety
    const motifBank = [];
    for (let m = 0; m < 4; m++) {
        const motifRng = new RNG(seed + 500 + m);
        if (biome.id === 'fungal' && scale.length > 0) {
            const baseIndex = motifRng.int(0, scale.length - 1);
            const offsets = [
                0,
                motifRng.pick([-1, 1]),
                motifRng.pick([0, 1, -1]),
                motifRng.pick([1, 2, -1]),
            ];
            motifBank.push(offsets.map((offset) => {
                const idx = (baseIndex + offset + scale.length) % scale.length;
                return scale[idx];
            }));
        } else {
            motifBank.push([
                motifRng.pick(scale), motifRng.pick(scale),
                motifRng.pick(scale), motifRng.pick(scale)
            ]);
        }
    }

    return {
        seed, address, pname,
        designation: `PL-${hex1}-${hex2}`,
        biome, scaleName, scale, rootFreq,
        tuningSystem, tuningRatios, quarterToneProb, octaveStretch,
        colors: biome.colors,
        numMoons: rng.int(0, 4),
        hasRings: rng.bool(0.25),
        hasClouds: rng.bool(0.6),
        hasIceCaps, hasAuroras, hasCraters, hasLavaGlow,
        ringTilt: rng.range(0.12, 0.4),
        cloudOpac: rng.range(0.1, 0.4),
        atmOpac: rng.range(0.35, 0.75),
        reverbDecay: rng.range(3, 8) * ac.reverbMul,
        droneDetune: rng.range(2, 14),
        padDetune: rng.range(4, 22),
        filterFreq: ac.filterBase + rng.range(-200, 800),
        lfoRate: rng.range(0.03, 0.25) * ac.lfoMul,
        noiseLevel: rng.range(0.02, 0.12) * ac.noiseMul,
        bpm: rng.int(60, 180),
        melodyDensity,
        rarityClass,
        useJI: tuningRatios !== null,
        jiRatios: tuningRatios || TUNING_SYSTEMS['Just'],
        motifBank,
        progression: PROGRESSIONS[rng.int(0, PROGRESSIONS.length)],
        ac,
    };
}
