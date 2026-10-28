import { midiToHz } from '../core/theory.js';

// The sample pack (samples/pack.bin, built by scripts/samples/build_pack.py):
// "LCS1" | u32 manifest length | manifest JSON | 4-bit IMA ADPCM.
// Decoding is integer arithmetic done here, not by the browser's codecs, so
// every platform gets the same samples bit for bit.

const STEPS = [7, 8, 9, 10, 11, 12, 13, 14, 16, 17, 19, 21, 23, 25, 28, 31, 34, 37, 41, 45, 50, 55, 60, 66, 73, 80, 88,
    97, 107, 118, 130, 143, 157, 173, 190, 209, 230, 253, 279, 307, 337, 371, 408, 449, 494, 544, 598, 658,
    724, 796, 876, 963, 1060, 1166, 1282, 1411, 1552, 1707, 1878, 2066, 2272, 2499, 2749, 3024, 3327, 3660,
    4026, 4428, 4871, 5358, 5894, 6484, 7132, 7845, 8630, 9493, 10442, 11487, 12635, 13899, 15289, 16818,
    18500, 20350, 22385, 24623, 27086, 29794, 32767];
const INDEX = [-1, -1, -1, -1, 2, 4, 6, 8];

function decodeAdpcm(bytes, offset, n) {
    const out = new Int16Array(n);
    let pred = 0;
    let idx = 0;
    for (let i = 0; i < n; i++) {
        const code = (bytes[offset + (i >> 1)] >> ((i & 1) << 2)) & 15;
        const step = STEPS[idx];
        let delta = step >> 3;
        if (code & 4) delta += step;
        if (code & 2) delta += step >> 1;
        if (code & 1) delta += step >> 2;
        pred = code & 8 ? pred - delta : pred + delta;
        if (pred > 32767) pred = 32767;
        else if (pred < -32768) pred = -32768;
        idx += INDEX[code & 7];
        if (idx < 0) idx = 0;
        else if (idx > 88) idx = 88;
        out[i] = pred;
    }
    return out;
}

// The pack as plain data: { sampleRate, instruments: name -> { kind, rms,
// zones: [{ root, hz, rate, data (int16), loopStart, end }] } }, zones sorted
// by root. Plain typed arrays, so it can be structured-cloned to the worklet.
export function decodePack(buffer) {
    const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    const magic = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]);
    if (magic !== 'LCS1') throw new Error('not a Lost Codex sample pack');
    const len = bytes[4] | (bytes[5] << 8) | (bytes[6] << 16) | (bytes[7] << 24);
    // the manifest is ASCII; TextDecoder is missing in some AudioWorklet scopes
    let text = '';
    for (let i = 8; i < 8 + len; i += 4096) text += String.fromCharCode.apply(null, bytes.subarray(i, Math.min(8 + len, i + 4096)));
    const manifest = JSON.parse(text);
    const base = 8 + len;
    const instruments = {};
    for (const [name, ins] of Object.entries(manifest.instruments)) {
        instruments[name] = {
            kind: ins.kind,
            rms: ins.rms,
            zones: ins.zones.map((z) => ({
                root: z.root,
                hz: midiToHz(z.root),
                rate: z.rate ?? manifest.sampleRate,
                data: decodeAdpcm(bytes, base + z.offset, z.length),
                loopStart: z.loopStart ?? -1,
                end: z.end ?? z.length,
            })).sort((a, b) => a.root - b.root),
        };
    }
    return { sampleRate: manifest.sampleRate, instruments };
}

// Built from the raw pack (decoding it) or from decodePack()'s data.
export class SampleBank {
    constructor(source) {
        const data = source && source.instruments ? source : decodePack(source);
        this.sampleRate = data.sampleRate;
        this.instruments = data.instruments;
    }

    data() {
        return { sampleRate: this.sampleRate, instruments: this.instruments };
    }

    has(name) {
        return !!this.instruments[name];
    }

    // The zone whose root is nearest the note; ties go to the lower root
    // (pitching up keeps more of the brightness than pitching down).
    zone(name, midi) {
        const zones = this.instruments[name].zones;
        let best = zones[0];
        for (const z of zones) if (Math.abs(z.root - midi) < Math.abs(best.root - midi)) best = z;
        return best;
    }
}
