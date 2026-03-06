import { RNG } from '../../../rng.js';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const SECTION_ORDER = ['INTRO', 'GROWTH', 'SURGE', 'RELEASE', 'AFTERGLOW'];

function sectionBaseEnergy(section) {
    switch (section) {
        case 'INTRO': return 0.2;
        case 'GROWTH': return 0.48;
        case 'SURGE': return 0.84;
        case 'RELEASE': return 0.38;
        case 'AFTERGLOW': return 0.22;
        default: return 0.3;
    }
}

export class FormEngine {
    constructor(planet, { arrangement = {} } = {}) {
        this.seed = (planet?.seed || 1) + 88001;
        this.arrangement = arrangement;
        this.rng = new RNG(this.seed);
        this.sectionIndex = 0;
        this.section = SECTION_ORDER[0];
        this.sectionBarStart = 0;
        this.sectionBarLength = this._pickSectionBarLength(this.section);
        this.arrangementEnergy = sectionBaseEnergy(this.section);
    }

    setArrangement(arrangement = {}) {
        this.arrangement = {
            ...this.arrangement,
            ...arrangement,
        };
    }

    update(barIndex = 0) {
        let barsInSection = Math.max(0, barIndex - this.sectionBarStart);
        while (barsInSection >= this.sectionBarLength) {
            this.sectionBarStart += this.sectionBarLength;
            this.sectionIndex = (this.sectionIndex + 1) % SECTION_ORDER.length;
            this.section = SECTION_ORDER[this.sectionIndex];
            this.sectionBarLength = this._pickSectionBarLength(this.section);
            barsInSection = Math.max(0, barIndex - this.sectionBarStart);
        }
        const progress = clamp((barsInSection + 1) / Math.max(1, this.sectionBarLength), 0, 1);
        const rise = this.section === 'SURGE'
            ? progress * 0.16
            : this.section === 'GROWTH'
                ? progress * 0.11
                : this.section === 'RELEASE'
                    ? -progress * 0.12
                    : 0;
        this.arrangementEnergy = clamp(sectionBaseEnergy(this.section) + rise, 0.1, 0.96);
        return {
            section: this.section,
            arrangementEnergy: this.arrangementEnergy,
            sectionProgress: progress,
            sectionBarLength: this.sectionBarLength,
        };
    }

    _pickSectionBarLength(section) {
        const formDepth = clamp(Number.isFinite(this.arrangement?.formDepth) ? this.arrangement.formDepth : 0.5, 0, 1);
        const phraseBias = clamp(Number.isFinite(this.arrangement?.phraseLengthBias) ? this.arrangement.phraseLengthBias : 0.5, 0, 1);
        const base = section === 'SURGE'
            ? 2
            : section === 'INTRO' || section === 'AFTERGLOW'
                ? 3
                : 4;
        const variance = this.rng.int(0, 3);
        return clamp(Math.round(base + formDepth * 3 + phraseBias * 2 + variance - 1), 2, 10);
    }
}
