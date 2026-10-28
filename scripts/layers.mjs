// Per-layer loudness of every scene, with and without the sample pack:
//   node scripts/layers.mjs [seconds] [universe ...]
// Prints dB per layer (dry signal, before the sends) so sampled layers can be
// balanced against the synth voices they join or replace.
import { readFileSync } from 'node:fs';
import { Engine } from '../src/engine/engine.js';
import { SampleBank } from '../src/engine/samples.js';
import { UNIVERSES } from '../src/universes.js';

const [secArg = '60', ...only] = process.argv.slice(2);
const seconds = Number(secArg);
const sr = 22050;
const bank = new SampleBank(readFileSync(new URL('../samples/pack.bin', import.meta.url)));

function layers(code, scene, samples) {
    const engine = new Engine(code, sr, { sceneOverride: [scene], samples });
    engine.meter = {};
    const l = new Float32Array(128);
    const r = new Float32Array(128);
    const n = Math.round(seconds * sr);
    for (let f = 0; f < n; f += 128) engine.render(l, r, 128);
    const out = {};
    for (const [k, v] of Object.entries(engine.meter)) out[k] = 10 * Math.log10(v / n + 1e-12);
    return out;
}

for (const u of UNIVERSES) {
    if (only.length && !only.includes(u.id)) continue;
    for (const scene of Object.keys(u.scenes)) {
        const code = `${u.id}-LAYERS`;
        const a = layers(code, scene, null);
        const b = layers(code, scene, bank);
        const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])].sort();
        const cells = keys.map((k) => `${k} ${a[k] === undefined ? '  -  ' : a[k].toFixed(0).padStart(4)}→${b[k] === undefined ? '  - ' : b[k].toFixed(0).padStart(4)}`);
        console.log(`${(u.id + '/' + scene).padEnd(18)} ${cells.join('  ')}`);
    }
}
