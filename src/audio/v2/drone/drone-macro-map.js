const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export const DEFAULT_DRONE_MACROS = Object.freeze({
    dream: 0.58,
    texture: 0.56,
    motion: 0.42,
    resonance: 0.48,
    diffusion: 0.6,
    tail: 0.64,
});

export const DEFAULT_DRONE_EXPERT = Object.freeze({
    expertPriority: 'hybrid',
    sourceMode: 'hybrid',
    looperSource: 'pre',
    loopStart: 0,
    loopLength: 0.62,
    varispeed: 1,
    sos: 0.42,
    filterType: 'lowpass',
    filterCutoff: 0.58,
    filterQ: 0.32,
    filterPosition: 1,
    resonatorTune: 0.45,
    resonatorFeedback: 0.22,
    resonatorSpread: 0.36,
    echoTime: 0.42,
    echoFeedback: 0.32,
    echoTone: 0.5,
    ambienceSpacetime: 0.62,
    ambienceDecay: 0.58,
    modMaster: 0.5,
    modRate: 0.42,
    modRouting: 0.5,
});

const SOURCE_MODES = new Set(['sine', 'supersaw', 'wavetable', 'hybrid']);
const LOOPER_SOURCES = new Set(['pre', 'post']);
const FILTER_TYPES = new Set(['lowpass', 'bandpass', 'highpass', 'notch']);
const EXPERT_PRIORITIES = new Set(['expert', 'hybrid', 'macro']);

const normalizeUnit = (value, fallback) => clamp(Number.isFinite(value) ? value : fallback, 0, 1);

export function normalizeDroneMacros(input = {}) {
    return {
        dream: normalizeUnit(input.dream, DEFAULT_DRONE_MACROS.dream),
        texture: normalizeUnit(input.texture, DEFAULT_DRONE_MACROS.texture),
        motion: normalizeUnit(input.motion, DEFAULT_DRONE_MACROS.motion),
        resonance: normalizeUnit(input.resonance, DEFAULT_DRONE_MACROS.resonance),
        diffusion: normalizeUnit(input.diffusion, DEFAULT_DRONE_MACROS.diffusion),
        tail: normalizeUnit(input.tail, DEFAULT_DRONE_MACROS.tail),
    };
}

export function normalizeDroneExpert(input = {}) {
    const expertPriority = EXPERT_PRIORITIES.has(input.expertPriority)
        ? input.expertPriority
        : DEFAULT_DRONE_EXPERT.expertPriority;
    const sourceMode = SOURCE_MODES.has(input.sourceMode) ? input.sourceMode : DEFAULT_DRONE_EXPERT.sourceMode;
    const looperSource = LOOPER_SOURCES.has(input.looperSource) ? input.looperSource : DEFAULT_DRONE_EXPERT.looperSource;
    const filterType = FILTER_TYPES.has(input.filterType) ? input.filterType : DEFAULT_DRONE_EXPERT.filterType;

    return {
        expertPriority,
        sourceMode,
        looperSource,
        loopStart: normalizeUnit(input.loopStart, DEFAULT_DRONE_EXPERT.loopStart),
        loopLength: normalizeUnit(input.loopLength, DEFAULT_DRONE_EXPERT.loopLength),
        varispeed: clamp(Number.isFinite(input.varispeed) ? input.varispeed : DEFAULT_DRONE_EXPERT.varispeed, -2, 2),
        sos: clamp(Number.isFinite(input.sos) ? input.sos : DEFAULT_DRONE_EXPERT.sos, 0, 0.96),
        filterType,
        filterCutoff: normalizeUnit(input.filterCutoff, DEFAULT_DRONE_EXPERT.filterCutoff),
        filterQ: normalizeUnit(input.filterQ, DEFAULT_DRONE_EXPERT.filterQ),
        filterPosition: clamp(Math.round(Number.isFinite(input.filterPosition) ? input.filterPosition : DEFAULT_DRONE_EXPERT.filterPosition), 0, 3),
        resonatorTune: normalizeUnit(input.resonatorTune, DEFAULT_DRONE_EXPERT.resonatorTune),
        resonatorFeedback: normalizeUnit(input.resonatorFeedback, DEFAULT_DRONE_EXPERT.resonatorFeedback),
        resonatorSpread: normalizeUnit(input.resonatorSpread, DEFAULT_DRONE_EXPERT.resonatorSpread),
        echoTime: normalizeUnit(input.echoTime, DEFAULT_DRONE_EXPERT.echoTime),
        echoFeedback: normalizeUnit(input.echoFeedback, DEFAULT_DRONE_EXPERT.echoFeedback),
        echoTone: normalizeUnit(input.echoTone, DEFAULT_DRONE_EXPERT.echoTone),
        ambienceSpacetime: normalizeUnit(input.ambienceSpacetime, DEFAULT_DRONE_EXPERT.ambienceSpacetime),
        ambienceDecay: normalizeUnit(input.ambienceDecay, DEFAULT_DRONE_EXPERT.ambienceDecay),
        modMaster: normalizeUnit(input.modMaster, DEFAULT_DRONE_EXPERT.modMaster),
        modRate: normalizeUnit(input.modRate, DEFAULT_DRONE_EXPERT.modRate),
        modRouting: normalizeUnit(input.modRouting, DEFAULT_DRONE_EXPERT.modRouting),
    };
}

function applyGenomeBias(base, genome = {}) {
    const profile = Number.isFinite(genome?.profile) ? genome.profile : 0.5;
    const drift = Number.isFinite(genome?.mod) ? genome.mod : 0.5;
    const resonator = Number.isFinite(genome?.resonator) ? genome.resonator : 0.5;
    const ambience = Number.isFinite(genome?.ambience) ? genome.ambience : 0.5;
    const echo = Number.isFinite(genome?.echo) ? genome.echo : 0.5;

    // Increased from 0.45 to 0.85 to allow genes to actually dominate the sound
    const biasScale = 0.85;

    return {
        ...base,
        dream: clamp(base.dream + (profile - 0.5) * biasScale, 0, 1),
        texture: clamp(base.texture + (profile - 0.5) * biasScale, 0, 1),
        motion: clamp(base.motion + (drift - 0.5) * biasScale, 0, 1),
        resonance: clamp(base.resonance + (resonator - 0.5) * biasScale, 0, 1),
        diffusion: clamp(base.diffusion + (ambience - 0.5) * biasScale, 0, 1),
        tail: clamp(base.tail + (echo - 0.5) * biasScale, 0, 1),
    };
}

export function mapDroneMacrosToExpert(macros = DEFAULT_DRONE_MACROS, expert = DEFAULT_DRONE_EXPERT, genome = null) {
    const m = genome ? applyGenomeBias(macros, genome) : macros;
    const priority = EXPERT_PRIORITIES.has(expert.expertPriority) ? expert.expertPriority : DEFAULT_DRONE_EXPERT.expertPriority;

    // Keep expert lock exact, but make hybrid and macro modes strongly shape timbre.
    const macroMix = priority === 'expert'
        ? 0
        : priority === 'macro'
            ? 0.92
            : 0.68;
    const expertMix = 1 - macroMix;

    const mapped = {
        ...expert,
        loopLength: clamp(expert.loopLength * expertMix + m.dream * macroMix, 0, 1),
        sos: clamp(expert.sos * expertMix + m.tail * macroMix, 0, 0.96),
        filterCutoff: clamp(expert.filterCutoff * expertMix + (1 - m.texture) * macroMix, 0, 1),
        filterQ: clamp(expert.filterQ * expertMix + m.resonance * macroMix, 0, 1),
        resonatorTune: clamp(expert.resonatorTune * expertMix + m.resonance * macroMix, 0, 1),
        resonatorFeedback: clamp(expert.resonatorFeedback * expertMix + m.resonance * macroMix, 0, 1),
        resonatorSpread: clamp(expert.resonatorSpread * expertMix + m.texture * macroMix, 0, 1),
        echoTime: clamp(expert.echoTime * expertMix + m.tail * macroMix, 0, 1),
        echoFeedback: clamp(expert.echoFeedback * expertMix + m.tail * macroMix, 0, 1),
        ambienceSpacetime: clamp(expert.ambienceSpacetime * expertMix + m.diffusion * macroMix, 0, 1),
        ambienceDecay: clamp(expert.ambienceDecay * expertMix + m.tail * macroMix, 0, 1),
        modMaster: clamp(expert.modMaster * expertMix + m.motion * macroMix, 0, 1),
        modRate: clamp(expert.modRate * expertMix + m.motion * macroMix, 0, 1),
    };
    return normalizeDroneExpert(mapped);
}

export function toDroneGenome(planet = null) {
    const genes = planet?.v2?.droneGenome || {};
    return {
        profile: normalizeUnit(genes.profile, 0.5),
        source: normalizeUnit(genes.source, 0.5),
        loop: normalizeUnit(genes.loop, 0.5),
        filter: normalizeUnit(genes.filter, 0.5),
        resonator: normalizeUnit(genes.resonator, 0.5),
        echo: normalizeUnit(genes.echo, 0.5),
        ambience: normalizeUnit(genes.ambience, 0.5),
        mod: normalizeUnit(genes.mod, 0.5),
        randomizer: normalizeUnit(genes.randomizer, 0.5),
    };
}
