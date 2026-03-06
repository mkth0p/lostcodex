import { RNG } from '../../../rng.js';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export class SpatialEngine {
    constructor(ctx, settings = {}) {
        this.ctx = ctx;
        this.settings = {
            width: 0.5,
            depth: 0.5,
            movement: 0.5,
            ...settings,
        };
    }

    update(settings = {}) {
        this.settings = {
            ...this.settings,
            ...settings,
        };
    }

    createPanner(seed = 1, basePan = 0) {
        const rng = new RNG(seed >>> 0);
        const panner = this.ctx.createStereoPanner();
        const width = clamp(this.settings.width, 0, 1);
        const movement = clamp(this.settings.movement, 0, 1);
        const startPan = clamp(basePan + rng.range(-1, 1) * width * 0.75, -1, 1);
        panner.pan.value = startPan;

        if (movement > 0.06) {
            const lfo = this.ctx.createOscillator();
            const lfoGain = this.ctx.createGain();
            lfo.type = 'sine';
            lfo.frequency.value = 0.03 + movement * 0.22;
            lfoGain.gain.value = width * movement * 0.4;
            lfo.connect(lfoGain);
            lfoGain.connect(panner.pan);
            lfo.start(this.ctx.currentTime);
            return { panner, lfo, lfoGain };
        }

        return { panner, lfo: null, lfoGain: null };
    }
}
