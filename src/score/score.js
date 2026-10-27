import { Rng } from '../core/rng.js';
import { Harmony } from '../core/theory.js';
import { Scene } from './scene.js';

// The endless score for one piece: a shared chord timeline and a chain of
// overlapping scenes, both generated lazily and deterministically.
export class Score {
    constructor(piece, { sceneOverride = null } = {}) {
        this.piece = piece;
        this.sceneOverride = sceneOverride;
        const rng = new Rng(piece.seed);
        this.harmony = new Harmony(piece.key, rng.fork('harmony'), piece.harmony);
        this.sceneRng = rng.fork('scenes');
        this.scenes = [];
        this.sceneIndex = 0;
        this._appendScene(0);
    }

    _appendScene(start) {
        const prev = this.scenes[this.scenes.length - 1];
        const rng = this.sceneRng;
        const weights = Object.entries(this.piece.sceneWeights)
            .filter(([type, w]) => w > 0 && type !== prev?.type);
        // open gently, with one of the universe's opening scenes
        const opening = this.piece.universe.opening;
        let type = prev
            ? (weights.length ? rng.weighted(weights) : prev.type)
            : opening[rng.int(0, opening.length - 1)];
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
        return scene;
    }

    // Events with time < to, from every scene that is still emitting.
    collect(to) {
        let last = this.scenes[this.scenes.length - 1];
        while (to > last.end - last.fade) {
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
        return current;
    }
}
