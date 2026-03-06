// ============================================================
// PLANET GENERATOR
// ============================================================
import { GLYPHS, BIOMES, SCALES, ROOT_NOTES, AUDIO_CONFIGS, TUNING_SYSTEMS, PROGRESSIONS } from './data.js';
import { RNG, hashAddress } from './rng.js';
import { computePlanetRarity } from './rarity.js';
import { buildIdentityProfile } from './audio/v1-plus/identity-profile.js';

const BIOME_MOON_BIAS = {
    abyssal: 0.26,
    storm: 0.18,
    quantum: 0.16,
    corrupted: 0.12,
    volcanic: 0.08,
    barren: -0.16,
    glacial: -0.08,
    arctic: -0.08,
};

const ADVANCED_MELODY_VOICE_POOLS = {
    crystalline: ['modal_resonator', 'wavetable_morph', 'crystal_chimes'],
    crystalloid: ['modal_resonator', 'phase_cluster', 'wavetable_morph'],
    glacial: ['wavetable_morph', 'modal_resonator'],
    arctic: ['wavetable_morph', 'modal_resonator'],
    oceanic: ['wavetable_morph', 'drone_morph'],
    ethereal: ['wavetable_morph', 'phase_cluster', 'vowel_morph'],
    nebula: ['wavetable_morph', 'phase_cluster', 'vowel_morph'],
    organic: ['modal_resonator', 'hollow_pipe'],
    fungal: ['modal_resonator', 'phase_cluster', 'marimba'],
    volcanic: ['phase_cluster', 'modal_resonator'],
    abyssal: ['modal_resonator', 'phase_cluster', 'gong'],
    storm: ['phase_cluster', 'wavetable_morph', 'granular_cloud'],
    corrupted: ['phase_cluster', 'wavetable_morph', 'granular_cloud'],
    quantum: ['phase_cluster', 'wavetable_morph', 'granular_cloud'],
    psychedelic: ['phase_cluster', 'wavetable_morph', 'vowel_morph'],
    barren: ['modal_resonator', 'crystal_chimes'],
    desert: ['modal_resonator', 'hollow_pipe'],
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function deriveMoonCount(rng, biomeId) {
    const roll = clamp(rng.range(0, 1) + (BIOME_MOON_BIAS[biomeId] || 0), 0, 1);
    if (roll < 0.2) return 0;
    if (roll < 0.52) return 1;
    if (roll < 0.79) return 2;
    if (roll < 0.95) return 3;
    return 4;
}

function buildMoonSystem(seed, biomeId, numMoons, rarityScore) {
    const rng = new RNG((seed + 71003) >>> 0);
    const densityBase = clamp(0.28 + numMoons * 0.11 + rarityScore * 0.22, 0.18, 0.95);
    const resonanceBase = clamp(0.24 + rarityScore * 0.5 + (biomeId === 'crystalline' || biomeId === 'crystalloid' ? 0.16 : 0), 0.15, 1);
    const phaseWarpBase = clamp(0.15 + rng.range(0, 0.6) + (biomeId === 'quantum' || biomeId === 'corrupted' ? 0.14 : 0), 0.12, 1);
    const orbitSpreadBase = clamp(0.35 + numMoons * 0.14 + rng.range(-0.05, 0.16), 0.2, 1.2);
    const temporalDriftBase = clamp(0.08 + rarityScore * 0.25 + rng.range(0, 0.18), 0.05, 0.62);

    return {
        density: Math.round(densityBase * 1000) / 1000,
        resonance: Math.round(resonanceBase * 1000) / 1000,
        phaseWarp: Math.round(phaseWarpBase * 1000) / 1000,
        orbitSpread: Math.round(orbitSpreadBase * 1000) / 1000,
        temporalDrift: Math.round(temporalDriftBase * 1000) / 1000,
    };
}

function injectAdvancedVoices(ac, biomeId, rarityScore, rng) {
    if (!ac || !Array.isArray(ac.melodyWaves) || !ac.melodyWaves.length) return;
    const pool = ADVANCED_MELODY_VOICE_POOLS[biomeId] || ['modal_resonator', 'wavetable_morph', 'phase_cluster'];
    const uniqueWaves = new Set(ac.melodyWaves);
    const insertionChance = clamp(0.2 + rarityScore * 0.42, 0.2, 0.8);
    if (!rng.bool(insertionChance)) return;

    const addCount = rarityScore > 0.9 ? 2 : 1;
    for (let i = 0; i < addCount; i++) {
        uniqueWaves.add(rng.pick(pool));
    }
    ac.melodyWaves = Array.from(uniqueWaves).slice(0, 7);
}

function buildV2Genes(seed, biomeId, rarityScore, moonSystem, rng) {
    const bias = (biomeId === 'quantum' || biomeId === 'corrupted' || biomeId === 'storm') ? 0.14 : 0;
    const clampGene = (value) => Math.round(clamp(value, 0, 1) * 1000) / 1000;
    return {
        formGenome: clampGene(0.24 + rarityScore * 0.52 + rng.range(-0.08, 0.12)),
        timbreGenome: clampGene(0.3 + rarityScore * 0.48 + rng.range(-0.1, 0.14)),
        rhythmGenome: clampGene(0.28 + (moonSystem?.density || 0.5) * 0.35 + rng.range(-0.08, 0.16) + bias),
        modGenome: clampGene(0.2 + (moonSystem?.phaseWarp || 0.4) * 0.5 + rng.range(-0.1, 0.14) + bias),
        spaceGenome: clampGene(0.22 + (moonSystem?.orbitSpread || 0.45) * 0.46 + rng.range(-0.06, 0.14)),
        backgroundProfile: clampGene(0.18 + (moonSystem?.temporalDrift || 0.25) * 0.55 + rng.range(-0.08, 0.14) + rarityScore * 0.08),
        droneGenome: {
            profile: clampGene(0.26 + rarityScore * 0.42 + rng.range(-0.1, 0.14)),
            source: clampGene(0.22 + rarityScore * 0.34 + rng.range(-0.12, 0.16)),
            loop: clampGene(0.24 + (moonSystem?.density || 0.5) * 0.36 + rng.range(-0.08, 0.14)),
            filter: clampGene(0.2 + (moonSystem?.phaseWarp || 0.4) * 0.34 + rng.range(-0.08, 0.16)),
            resonator: clampGene(0.2 + (moonSystem?.resonance || 0.4) * 0.44 + rng.range(-0.1, 0.14) + bias * 0.3),
            echo: clampGene(0.24 + (moonSystem?.orbitSpread || 0.45) * 0.38 + rng.range(-0.1, 0.16)),
            ambience: clampGene(0.28 + (moonSystem?.temporalDrift || 0.25) * 0.42 + rng.range(-0.08, 0.12)),
            mod: clampGene(0.2 + (moonSystem?.phaseWarp || 0.4) * 0.5 + rng.range(-0.1, 0.12) + bias * 0.2),
            randomizer: clampGene(0.12 + rarityScore * 0.4 + rng.range(-0.08, 0.14)),
        },
    };
}

export function generatePlanet(address) {
    const fallbackAddress = GLYPHS.slice(0, 3).join('');
    const safeAddress = address || fallbackAddress;
    const seed = hashAddress(safeAddress);
    const rng = new RNG(seed);
    const chars = [...safeAddress];

    // Helper to get deterministic value from specific glyph position
    const getPosVal = (idx, max) => {
        if (idx >= chars.length) return rng.int(0, max);
        const gIdx = GLYPHS.indexOf(chars[idx]);
        return (gIdx === -1 ? rng.int(0, max) : gIdx) % max;
    };

    // Deterministic positional encoding
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

    // Alien name
    const syllables = ['zra', 'tho', 'vel', 'kry', 'mnu', 'phe', 'shio', 'xnu', 'yss', 'drae', 'fryu', 'glon', 'spei', 'nyao', 'vren', 'bluu', 'kreth', 'aevon', 'thrix', 'zumar', 'veq', 'iith', 'nnor'];
    const endings = ['is', 'an', 'on', 'ar', 'ix', 'us', 'ae', 'or', 'ia', 'yx', 'eth', 'un', 'ael', 'orn'];
    let pname = '';
    for (let i = 0; i < rng.int(2, 4); i++) pname += rng.pick(syllables);
    pname += rng.pick(endings);
    pname = pname[0].toUpperCase() + pname.slice(1);

    const hex1 = (seed & 0xffff).toString(16).toUpperCase().padStart(4, '0');
    const hex2 = ((seed >>> 16) & 0xff).toString(16).toUpperCase().padStart(2, '0');

    const baseAc = AUDIO_CONFIGS[biome.id];
    const ac = { ...baseAc };
    const numMoons = deriveMoonCount(rng, biome.id);
    const progression = PROGRESSIONS[rng.int(0, PROGRESSIONS.length)];

    // Feature overrides from flags
    const quarterToneProb = (flags & 4) ? 0.15 : 0;
    const octaveStretch = (flags & 8) ? 1.012 : 1.0;

    // Visual features tied to biomes
    const hasIceCaps = ['glacial', 'crystalline', 'abyssal'].includes(biome.id);
    const hasAuroras = ['ethereal', 'quantum', 'oceanic', 'barren'].includes(biome.id) && rng.bool(0.7);
    const hasCraters = ['barren', 'volcanic', 'desert'].includes(biome.id);
    const hasLavaGlow = biome.id === 'volcanic';

    // Audio config variance
    ac.noiseMul = baseAc.noiseMul * rng.range(0.2, 5.0);
    ac.lfoMul = baseAc.lfoMul * rng.range(0.5, 3.0);
    ac.fmIndex = baseAc.fmIndex * rng.range(0.3, 4.0);
    ac.fmRatio = baseAc.fmRatio * rng.range(0.8, 1.5);
    ac.reverbMul = baseAc.reverbMul * rng.range(0.5, 2.0);
    ac.grainDensity = baseAc.grainDensity * rng.range(0.2, 3.0);
    ac.grainPitchScatter = baseAc.grainPitchScatter * rng.range(0.5, 2.5);
    ac.chorusDepth = baseAc.chorusDepth * rng.range(0.5, 2.0);
    ac.chordAudibility = clamp(baseAc.chordAudibility + rng.range(-0.3, 0.3), 0, 1);

    // Extra percussion voices
    const extraPercPool = ['tom', 'shaker', 'cowbell', 'clave', 'conga'];
    const percCount = rng.int(0, 3);
    const uniquePercs = new Set(ac.percVoices);
    for (let i = 0; i < percCount; i++) uniquePercs.add(rng.pick(extraPercPool));
    ac.percVoices = Array.from(uniquePercs);

    const rarity = computePlanetRarity({
        seed,
        address: safeAddress,
        biomeId: biome.id,
        numMoons,
        scale,
        progression,
        ac,
        tuningSystem,
        quarterToneProb,
        octaveStretch,
    });

    const melodyDensity = clamp((baseAc.melodyDensity || 0.05) * rng.range(0.5, 2.0) * (0.96 + rarity.score * 0.14), 0.01, 0.35);
    injectAdvancedVoices(ac, biome.id, rarity.score, rng);
    const moonSystem = buildMoonSystem(seed, biome.id, numMoons, rarity.score);
    const v2 = buildV2Genes(seed, biome.id, rarity.score, moonSystem, new RNG(seed + 220003));
    const identityProfile = buildIdentityProfile({
        seed,
        biome,
        moonSystem,
        rarityScore: rarity.score,
        melodyDensity,
        quarterToneProb,
        ac,
    });

    // Motif bank generation
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
                motifRng.pick(scale), motifRng.pick(scale),
            ]);
        }
    }

    return {
        seed,
        address: safeAddress,
        pname,
        designation: `PL-${hex1}-${hex2}`,
        biome,
        scaleName,
        scale,
        rootFreq,
        tuningSystem,
        tuningRatios,
        quarterToneProb,
        octaveStretch,
        colors: biome.colors,
        numMoons,
        moonSystem,
        hasRings: rng.bool(0.25),
        hasClouds: rng.bool(0.6),
        hasIceCaps,
        hasAuroras,
        hasCraters,
        hasLavaGlow,
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
        rarityClass: rarity.label,
        rarityKey: rarity.key,
        rarityScore: rarity.score,
        v2,
        useJI: tuningRatios !== null,
        jiRatios: tuningRatios || TUNING_SYSTEMS.Just,
        motifBank,
        progression,
        ac,
        identityProfile,
    };
}
