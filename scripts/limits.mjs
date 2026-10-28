// How hard each scene leans on the limiter, and how often voices get stolen,
// with and without the sample pack:
//   node scripts/limits.mjs [seconds] [lite] [universe ...]
// Prints the least limiter gain (dB), samples that reached the ceiling, and
// voice steals (pack-only layers / core voices).
import { readFileSync } from 'node:fs';
import { Engine } from '../src/engine/engine.js';
import { SampleBank } from '../src/engine/samples.js';
import { UNIVERSES } from '../src/universes.js';

const args = process.argv.slice(2);
const seconds = Number(args[0] || 120);
const lite = args[1] === 'lite';
const only = args.slice(lite ? 2 : 1);
const sr = 48000;
const bank = new SampleBank(readFileSync(new URL('../samples/pack.bin', import.meta.url)));

function run(code, scene, samples) {
    const engine = new Engine(code, sr, {
        sceneOverride: scene ? [scene] : null, samples, quality: lite ? 'lite' : 'full', maxVoices: lite ? 28 : 48,
    });
    const l = new Float32Array(128);
    const r = new Float32Array(128);
    let least = 1;
    let clamped = 0;
    const seen = new Set();
    const steals = { optional: 0, core: 0 };
    const ceiling = engine.limiter.ceiling - 1e-6;
    for (let f = 0; f < sr * seconds; f += 128) {
        engine.render(l, r, 128);
        least = Math.min(least, engine.limiter.gain);
        for (let i = 0; i < 128; i++) if (Math.abs(l[i]) >= ceiling || Math.abs(r[i]) >= ceiling) clamped++;
        for (const v of engine.voices) {
            if (v.stealing && !seen.has(v)) {
                seen.add(v);
                steals[v.optional ? 'optional' : 'core']++;
            }
        }
    }
    return `${(20 * Math.log10(least)).toFixed(1).padStart(5)} dB ${String(clamped).padStart(4)} clamp  steals ${steals.optional}/${steals.core}`;
}

for (const u of UNIVERSES) {
    if (only.length && !only.includes(u.id)) continue;
    for (const scene of [...Object.keys(u.scenes), null]) {
        const code = `${u.id}-A1`;
        console.log(`${(u.id + '/' + (scene || 'piece')).padEnd(18)} synth ${run(code, scene, null)}   pack ${run(code, scene, bank)}`);
    }
}
