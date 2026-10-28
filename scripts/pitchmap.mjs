// How far each sampled instrument gets repitched across every universe and scene:
//   node scripts/pitchmap.mjs [stations per universe] [minutes]
// For every event that names a sample, the semitone distance from the zone the
// engine would pick. Large shifts (past about +-7) are where a sample starts to
// sound unnatural and needs another zone or a different octave.
import { readFileSync } from 'node:fs';
import { SampleBank } from '../src/engine/samples.js';
import { createPiece } from '../src/score/piece.js';
import { Score } from '../src/score/score.js';
import { UNIVERSES } from '../src/universes.js';

const [stationsArg = '12', minutesArg = '20'] = process.argv.slice(2);
const bank = new SampleBank(readFileSync(new URL('../samples/pack.bin', import.meta.url)));
const shifts = {};

for (const u of UNIVERSES) {
    for (let n = 0; n < Number(stationsArg); n++) {
        for (const scene of Object.keys(u.scenes)) {
            const score = new Score(createPiece(`${u.id}-P${n}`), { sceneOverride: [scene] });
            for (let t = 30; t <= Number(minutesArg) * 60; t += 30) {
                for (const ev of score.collect(t)) {
                    const midis = ev.midis || (ev.midi !== undefined ? [ev.midi] : []);
                    if (!ev.sample || !bank.has(ev.sample)) continue;
                    const key = `${ev.sample} (${u.id}/${scene})`;
                    for (const m of midis) {
                        const s = m - bank.zone(ev.sample, m).root;
                        (shifts[key] ||= []).push(s);
                    }
                }
            }
        }
    }
}

for (const [key, list] of Object.entries(shifts).sort()) {
    list.sort((a, b) => a - b);
    const pct = (p) => list[Math.min(list.length - 1, Math.floor(p * list.length))];
    const bad = list.filter((s) => Math.abs(s) > 7).length / list.length;
    console.log(`${key.padEnd(34)} n ${String(list.length).padStart(6)}  min ${String(list[0]).padStart(3)}  p10 ${String(pct(0.1)).padStart(3)}  p50 ${String(pct(0.5)).padStart(3)}  p90 ${String(pct(0.9)).padStart(3)}  max ${String(list[list.length - 1]).padStart(3)}  >7: ${(bad * 100).toFixed(0)}%`);
}
