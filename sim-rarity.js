
import { computePlanetRarity } from './src/rarity.js';
import { BIOMES, AUDIO_CONFIGS, SCALES, PROGRESSIONS } from './src/data.js';

const iterations = 500;
const results = {};

BIOMES.forEach(biome => {
    results[biome.id] = [];
    for (let i = 0; i < iterations; i++) {
        const seed = Math.floor(Math.random() * 10000000);
        const rarity = computePlanetRarity({
            seed,
            address: 'A' + seed.toString(36).toUpperCase(),
            biomeId: biome.id,
            numMoons: Math.floor(Math.random() * 5),
            scale: SCALES['Ionian'],
            progression: PROGRESSIONS[0],
            ac: AUDIO_CONFIGS[biome.id],
            tuningSystem: 'Equal',
            quarterToneProb: Math.random() > 0.8 ? 0.15 : 0,
            octaveStretch: Math.random() > 0.8 ? 1.012 : 1,
        });
        results[biome.id].push(rarity.score);
    }
});

Object.entries(results).sort((a, b) => (a[0] > b[0] ? 1 : -1)).forEach(([biome, scores]) => {
    const min = Math.min(...scores);
    const max = Math.max(...scores);
    const avg = scores.reduce((a, b) => a + b) / scores.length;
    console.log(`${biome.padEnd(12)}: min=${min.toFixed(3)} avg=${avg.toFixed(3)} max=${max.toFixed(3)}`);
});

const allScores = Object.values(results).flat().sort((a, b) => a - b);
console.log('\nGlobal Percentiles:');
[0.5, 0.75, 0.88, 0.95, 0.985].forEach(p => {
    const idx = Math.floor(allScores.length * p);
    console.log(`${(p * 100).toFixed(0)}th: ${allScores[idx].toFixed(3)}`);
});
