import { Rng } from '../core/rng.js';
import { Harmony } from '../core/theory.js';
import { Scene } from './scene.js';
import { SongPlan } from './song.js';

// The endless score for one piece: a shared chord timeline and a chain of
// overlapping scenes, both generated lazily and deterministically.
export class Score {
    constructor(piece, { sceneOverride = null } = {}) {
        this.piece = piece;
        this.sceneOverride = sceneOverride;
        const rng = new Rng(piece.seed);
        // universes with song form lay their scenes out as sections on bar lines
        this.plan = piece.universe.song && !sceneOverride ? new SongPlan(piece, rng.fork('song')) : null;
        this.harmony = new Harmony(piece.key, rng.fork('harmony'), { ...piece.harmony, plan: this.plan });
        this.sceneRng = rng.fork('scenes');
        this.scenes = [];
        this.history = [];
        this.sceneIndex = 0;
        this._appendScene(0);
    }

    _appendScene(start) {
        if (this.plan) return this._appendSection();
        const prev = this.scenes[this.scenes.length - 1];
        const rng = this.sceneRng;
        const weights = Object.entries(this.piece.sceneWeights)
            .filter(([type, w]) => w > 0 && type !== prev?.type);
        // open gently, with one of the universe's opening scenes
        const opening = this.piece.universe.opening;
        let type = prev
            ? (weights.length ? rng.weighted(weights) : prev.type)
            : opening[rng.int(0, opening.length - 1)];
        // Gyro's repetition pool at the scale of the piece: now and then an
        // earlier scene comes back, from the first few heard, so the endless
        // stream has audible returns
        const seen = [...new Set(this.history)];
        const back = this.piece.universe.returns ?? 0.4;
        if (prev && seen.length > 1 && rng.chance(back)) {
            const pool = seen.slice(0, Math.max(1, Math.round((1 - back) * seen.length)))
                .filter((t) => t !== prev.type && this.piece.sceneWeights[t] > 0);
            if (pool.length) type = rng.pick(pool);
        }
        if (this.sceneOverride) type = this.sceneOverride[this.sceneIndex % this.sceneOverride.length];
        const fade = rng.range(25, 40);
        const length = rng.range(200, 420);
        const scene = new Scene({
            type,
            start,
            end: start + length,
            fade,
            piece: this.piece,
            harmony: this.harmony,
            rng: rng.fork(`scene${this.sceneIndex++}`),
        });
        this.scenes.push(scene);
        this.history.push(type);
        return scene;
    }

    _appendSection() {
        const s = this.plan.index(this.sceneIndex);
        const scene = new Scene({
            type: s.type,
            start: s.start,
            end: s.end,
            fade: s.fadeIn,
            fadeIn: s.fadeIn,
            fadeOut: s.fadeOut,
            piece: this.piece,
            harmony: this.harmony,
            rng: this.sceneRng.fork(`scene${this.sceneIndex++}`),
        });
        this.scenes.push(scene);
        this.history.push(s.type);
        return scene;
    }

    // Master-bus moves the song plan asks for (high-pass, dry level), or null.
    mix(t) {
        return this.plan ? this.plan.mix(t) : null;
    }

    // Events with time < to, from every scene that is still emitting.
    collect(to) {
        let last = this.scenes[this.scenes.length - 1];
        // sections follow each other on the bar line; scenes overlap by their fade
        while (to > last.end - (this.plan ? 1 : last.fade)) {
            last = this._appendScene(last.end - last.fade);
        }
        const out = [];
        for (const scene of this.scenes) {
            if (scene.start < to) scene.collect(to, out);
        }
        this.scenes = this.scenes.filter((s) => !s.finished || s === last);
        return out;
    }

    sceneAt(t) {
        let current = null;
        for (const s of this.scenes) {
            if (s.start <= t && (!current || s.level(t) >= current.level(t))) current = s;
        }
        // a finished scene is dropped a little before the next one starts
        return current || this.scenes[0] || null;
    }
}
