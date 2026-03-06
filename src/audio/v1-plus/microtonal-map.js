import { RNG } from '../../rng.js';
import { resolvePaceClass } from './identity-profile.js';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const LAYER_DEPTH = {
    bass: 0.18,
    chords: 0.52,
    pads: 0.56,
    melody: 0.84,
    moons: 0.8,
    drones: 0.78,
};

const SECTION_DEPTH = {
    INTRO: 0.88,
    GROWTH: 1.02,
    SURGE: 1.08,
    RELEASE: 0.92,
    AFTERGLOW: 0.98,
};

export class MicrotonalMap {
    constructor(seed = 1, identityProfile = null) {
        this.seed = (seed >>> 0) || 1;
        this.identityProfile = identityProfile || null;
        this.degreeOffsets = new Array(12).fill(0);
        const rng = new RNG((this.seed + 90103) >>> 0);
        for (let i = 0; i < 12; i++) {
            const base = rng.range(-34, 34);
            const quantized = Math.round(base / 2) * 2;
            this.degreeOffsets[i] = quantized;
        }
    }

    getLayerDepth(layer = 'melody', section = 'INTRO', paceOverride = 'auto') {
        const paceClass = resolvePaceClass(this.identityProfile, paceOverride);
        const layerDepth = LAYER_DEPTH[layer] ?? 0.6;
        const sectionMul = SECTION_DEPTH[section] ?? 1;
        const profileDepth = clamp(this.identityProfile?.microtonalWarp ?? 0.5, 0, 1);
        const paceMul = paceClass === 'slow' ? 0.92 : paceClass === 'fast' ? 1.06 : 1;
        return clamp(layerDepth * sectionMul * (0.68 + profileDepth * 0.74) * paceMul, 0, 1.35);
    }

    offsetCents({ step = 0, layer = 'melody', section = 'INTRO', paceOverride = 'auto', barIndex = 0, stepIndex = 0 } = {}) {
        const norm = ((Math.round(step) % 12) + 12) % 12;
        const base = this.degreeOffsets[norm] || 0;
        const depth = this.getLayerDepth(layer, section, paceOverride);
        const rng = new RNG((this.seed + norm * 311 + barIndex * 53 + stepIndex * 17) >>> 0);
        const jitter = rng.range(-7, 7) * clamp(depth * 0.22, 0.08, 0.4);
        let cents = base * depth + jitter;

        if (layer === 'bass') cents = clamp(cents, -9, 9);
        else if (layer === 'chords' || layer === 'pads') cents = clamp(cents, -26, 26);
        else cents = clamp(cents, -48, 48);

        return Math.round(cents * 1000) / 1000;
    }

    probability(baseProbability = 0, layer = 'melody', section = 'INTRO', paceOverride = 'auto') {
        const depth = this.getLayerDepth(layer, section, paceOverride);
        return clamp(baseProbability + depth * 0.42, 0, 0.95);
    }
}

