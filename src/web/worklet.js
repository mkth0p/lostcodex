import { Engine } from '../engine/engine.js';

// Runs the whole engine on the audio thread: the score, the voices and the
// mix all advance in lockstep with the samples, so timing never jitters.
class LostCodexProcessor extends AudioWorkletProcessor {
    constructor(options) {
        super();
        const { code, quality } = options.processorOptions || {};
        this.engine = new Engine(code, sampleRate, {
            quality,
            maxVoices: quality === 'lite' ? 28 : 48,
        });
        this.blocks = 0;
        this.port.postMessage({ type: 'ready', piece: summarize(this.engine.piece) });
    }

    process(_inputs, outputs) {
        const out = outputs[0];
        const left = out[0];
        const right = out[1] || out[0];
        this.engine.render(left, right, left.length);
        // about 12 snapshots a second for the visuals
        if (++this.blocks % 30 === 0) {
            this.port.postMessage({ type: 'state', state: this.engine.getState() });
        }
        return true;
    }
}

function summarize(piece) {
    return {
        code: piece.code,
        universe: piece.universe.id,
        mode: piece.key.mode,
        tonic: piece.key.tonic,
        bpm: piece.bpm,
        harsh: piece.harsh,
        brightness: piece.brightness,
        pulse: piece.pulse,
    };
}

registerProcessor('lost-codex', LostCodexProcessor);
