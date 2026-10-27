import { Rng } from '../core/rng.js';
import { Svf, dbToGain } from '../dsp/primitives.js';
import { Echo, Limiter, Reverb } from '../dsp/effects.js';
import { createPiece } from '../score/piece.js';
import { Score } from '../score/score.js';
import { VOICE_TYPES } from './voices.js';

// Score events are gathered every ~23 ms, up to 100 ms ahead.
const COLLECT_EVERY = 1024;
const LOOKAHEAD = 0.1;

// Renders one piece, block by block. Identical input (code, sample rate,
// block size) gives identical output, in the browser worklet or in Node.
export class Engine {
    constructor(code, sampleRate, { maxVoices = 48, quality = 'full', sceneOverride = null } = {}) {
        this.sr = sampleRate;
        this.piece = createPiece(code);
        this.score = new Score(this.piece, { sceneOverride });
        this.voiceRng = new Rng(this.piece.seed).fork('voices');
        this.maxVoices = maxVoices;
        this.voices = [];
        this.pending = [];
        this.frame = 0;
        this.nextCollect = 0;
        this.reverb = new Reverb(sampleRate, {
            t60: this.piece.reverbT60,
            size: quality === 'lite' ? 1.2 : 1.7,
            damping: 5500 + this.piece.brightness * 4000,
        });
        this.echo = new Echo(sampleRate, { seconds: this.piece.echoSeconds, feedback: 0.55 });
        this.limiter = new Limiter(sampleRate, dbToGain(-1));
        // rumble filter: nothing useful lives below ~28 Hz
        this.hpL = new Svf(sampleRate, 28, 0.7);
        this.hpR = new Svf(sampleRate, 28, 0.7);
        this.master = 1.6;
        this.reverbWet = 0.55;
        this.blockCap = 0;
        this._alloc(128);
        this.lr = [0, 0];
        this.fx = [0, 0];
        this.notes = [];
        // optional per-layer energy meter, used by the analysis scripts
        this.meter = null;
    }

    _alloc(n) {
        this.blockCap = n;
        this.dryL = new Float32Array(n);
        this.dryR = new Float32Array(n);
        this.revBus = new Float32Array(n);
        this.echoBus = new Float32Array(n);
    }

    get time() {
        return this.frame / this.sr;
    }

    _spawn(ev, offset) {
        const Type = VOICE_TYPES[ev.type];
        if (!Type) return;
        const voice = new Type(this.sr, ev, this.voiceRng);
        voice.offset = offset;
        voice.fade = 1;
        this.voices.push(voice);
        if (ev.midi !== undefined || ev.midis) {
            this.notes.push({ time: ev.time, midi: ev.midi ?? ev.midis[0], layer: ev.layer, gain: ev.gain });
            if (this.notes.length > 64) this.notes.shift();
        }
        // steal the oldest sustained voice, with a short fade
        let live = 0;
        for (const v of this.voices) if (!v.stealing) live++;
        if (live > this.maxVoices) {
            const victim = this.voices.find((v) => !v.stealing);
            victim.stealing = true;
        }
    }

    render(outL, outR, n = outL.length) {
        if (n > this.blockCap) this._alloc(n);
        const t0 = this.frame / this.sr;
        const t1 = (this.frame + n) / this.sr;
        if (this.frame >= this.nextCollect) {
            this.nextCollect = this.frame + COLLECT_EVERY;
            const events = this.score.collect(t1 + LOOKAHEAD);
            for (const ev of events) this.pending.push(ev);
        }
        // start events due within this block
        if (this.pending.length) {
            const keep = [];
            for (const ev of this.pending) {
                if (ev.time < t1) this._spawn(ev, Math.max(0, Math.round((ev.time - t0) * this.sr)));
                else keep.push(ev);
            }
            this.pending = keep;
        }

        const { dryL, dryR, revBus, echoBus } = this;
        dryL.fill(0, 0, n);
        dryR.fill(0, 0, n);
        revBus.fill(0, 0, n);
        echoBus.fill(0, 0, n);

        const meter = this.meter;
        for (const v of this.voices) {
            const start = Math.min(n, v.offset);
            v.offset = 0;
            for (let i = start; i < n; i++) {
                let s = v.tick();
                if (v.stealing) {
                    v.fade *= 0.9985;
                    s *= v.fade;
                    if (v.fade < 1e-3) v.done = true;
                }
                if (meter) meter[v.layer] = (meter[v.layer] || 0) + s * s;
                dryL[i] += s * v.pl;
                dryR[i] += s * v.pr;
                revBus[i] += s * v.rev;
                echoBus[i] += s * v.echo;
                if (v.done) break;
            }
        }
        if (this.voices.some((v) => v.done)) this.voices = this.voices.filter((v) => !v.done);

        const lr = this.lr;
        const fx = this.fx;
        const wet = this.reverbWet;
        for (let i = 0; i < n; i++) {
            this.echo.process(echoBus[i], fx);
            const eL = fx[0];
            const eR = fx[1];
            this.reverb.process(revBus[i] + (eL + eR) * 0.25, fx);
            let l = dryL[i] + eL * 0.6 + fx[0] * wet;
            let r = dryR[i] + eR * 0.6 + fx[1] * wet;
            this.hpL.process(l);
            this.hpR.process(r);
            l = this.hpL.high * this.master;
            r = this.hpR.high * this.master;
            lr[0] = l;
            lr[1] = r;
            this.limiter.process(lr);
            outL[i] = lr[0];
            outR[i] = lr[1];
        }
        this.frame += n;
    }

    // Snapshot for the visuals.
    getState() {
        const t = this.time;
        const scene = this.score.sceneAt(t);
        const chord = this.score.harmony.chordAt(t);
        return {
            time: t,
            code: this.piece.code,
            mode: this.piece.key.mode,
            tonic: this.piece.key.tonic,
            scene: scene?.type || null,
            sceneLevel: scene ? scene.level(t) : 0,
            chord: chord.upper.slice(),
            bass: chord.bass,
            voices: this.voices.length,
            notes: this.notes.splice(0, this.notes.length),
        };
    }
}
