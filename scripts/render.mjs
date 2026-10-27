// Offline render of a piece to WAV: node scripts/render.mjs CODE [seconds] [out.wav] [startSeconds]
import { writeFileSync } from 'node:fs';
import { Engine } from '../src/engine/engine.js';

const [code = 'LOSTCODEX', secArg = '60', out = `${code}.wav`, startArg = '0'] = process.argv.slice(2);
const sr = 44100;
const seconds = Number(secArg);
const start = Number(startArg);
const block = 128;
const only = process.env.SCENE ? process.env.SCENE.split(',') : null;
const engine = new Engine(code, sr, { sceneOverride: only });
const total = Math.round(seconds * sr);
const skip = Math.round(start * sr);
const left = new Float32Array(total);
const right = new Float32Array(total);
const bl = new Float32Array(block);
const br = new Float32Array(block);
const t0 = performance.now();
let written = 0;
const scenes = [];
for (let f = 0; f < skip + total; f += block) {
    engine.render(bl, br, block);
    if (f % (sr * 5) < block) {
        const s = engine.getState();
        if (!scenes.length || scenes[scenes.length - 1].scene !== s.scene) scenes.push({ t: Math.round(s.time), scene: s.scene });
    }
    if (f < skip) continue;
    for (let i = 0; i < block && written < total; i++, written++) {
        left[written] = bl[i];
        right[written] = br[i];
    }
}
const ms = performance.now() - t0;

const data = Buffer.alloc(44 + total * 4);
data.write('RIFF', 0); data.writeUInt32LE(36 + total * 4, 4); data.write('WAVE', 8);
data.write('fmt ', 12); data.writeUInt32LE(16, 16); data.writeUInt16LE(1, 20); data.writeUInt16LE(2, 22);
data.writeUInt32LE(sr, 24); data.writeUInt32LE(sr * 4, 28); data.writeUInt16LE(4, 32); data.writeUInt16LE(16, 34);
data.write('data', 36); data.writeUInt32LE(total * 4, 40);
let peak = 0; let sum = 0;
for (let i = 0; i < total; i++) {
    const l = left[i]; const r = right[i];
    peak = Math.max(peak, Math.abs(l), Math.abs(r));
    sum += l * l + r * r;
    data.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(l * 32767))), 44 + i * 4);
    data.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(r * 32767))), 46 + i * 4);
}
writeFileSync(out, data);
const rmsDb = 10 * Math.log10(sum / (2 * total) + 1e-12);
console.log(JSON.stringify({
    code: engine.piece.code, mode: engine.piece.key.mode, tonic: engine.piece.key.tonic, bpm: engine.piece.bpm,
    harsh: +engine.piece.harsh.toFixed(2), pulse: +engine.piece.pulse.toFixed(2),
    seconds, realtimeFactor: +((seconds * 1000 + start * 1000) / ms).toFixed(1), peakDb: +(20 * Math.log10(peak)).toFixed(1), rmsDb: +rmsDb.toFixed(1), scenes,
}));
