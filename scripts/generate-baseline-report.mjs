import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { generatePlanet } from '../src/planet.js';
import { PLANET_CORPUS, PLANET_CORPUS_CODES } from './planet-corpus.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const reportPath = path.join(repoRoot, 'docs', 'engine-baseline.md');

const corpusPlanets = PLANET_CORPUS.map((address, index) => {
    const planet = generatePlanet(address);
    return {
        index: index + 1,
        code: PLANET_CORPUS_CODES[index],
        address,
        biome: planet.biome.id,
        bpm: planet.bpm,
        stepCount: planet.ac?.stepCount || 16,
        rootFreq: planet.rootFreq,
        progression: planet.progression.join(' - '),
    };
});

const biomeCounts = corpusPlanets.reduce((acc, entry) => {
    acc[entry.biome] = (acc[entry.biome] || 0) + 1;
    return acc;
}, {});

const bpms = corpusPlanets.map((entry) => entry.bpm);
const stepCounts = corpusPlanets.map((entry) => entry.stepCount);
const bpmAvg = bpms.reduce((sum, value) => sum + value, 0) / bpms.length;

const stepCountDistribution = stepCounts.reduce((acc, value) => {
    acc[value] = (acc[value] || 0) + 1;
    return acc;
}, {});

const generatedAt = new Date().toISOString();
const lines = [
    '# Engine Baseline',
    '',
    `Generated: ${generatedAt}`,
    '',
    '## Corpus',
    '',
    `- Size: ${corpusPlanets.length}`,
    '- Source: `scripts/planet-corpus.js`',
    '',
    '## Aggregate Metrics',
    '',
    `- BPM min/max/avg: ${Math.min(...bpms)} / ${Math.max(...bpms)} / ${bpmAvg.toFixed(2)}`,
    `- Step count min/max: ${Math.min(...stepCounts)} / ${Math.max(...stepCounts)}`,
    `- Step count distribution: ${Object.entries(stepCountDistribution).map(([step, count]) => `${step}:${count}`).join(', ')}`,
    `- Biome distribution: ${Object.entries(biomeCounts).map(([biome, count]) => `${biome}:${count}`).join(', ')}`,
    '',
    '## Planet Table',
    '',
    '| # | Code | Biome | BPM | Steps | Root Hz | Progression |',
    '|---|---|---|---:|---:|---:|---|',
];

corpusPlanets.forEach((entry) => {
    lines.push(`| ${entry.index} | \`${entry.code}\` | ${entry.biome} | ${entry.bpm} | ${entry.stepCount} | ${entry.rootFreq.toFixed(1)} | ${entry.progression} |`);
});

lines.push('', '## Notes', '', '- This baseline is generated from deterministic planet metadata (no audio runtime sampling).');
lines.push('- Use `npm run smoke:engine` for runtime `AudioEngine` start/stop and `getDebugState()` sampling in a real browser.');

fs.writeFileSync(reportPath, `${lines.join('\n')}\n`, 'utf8');
console.log(`Wrote ${reportPath}`);
