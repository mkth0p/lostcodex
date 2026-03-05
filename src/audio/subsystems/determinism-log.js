import { RNG } from '../../rng.js';
import { buildTensionProfile, resolveRhythmState } from './tension.js';
import { getChordFunctionKey, selectNextChord } from './harmony.js';
import { DEFAULT_TENSION_PROFILE, BIOME_TENSION_PROFILES } from '../config/tension-profiles.js';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function chordIntervalsFromSymbol(symbol, scale) {
    const degreeOrder = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];
    const roman = `${symbol || 'I'}`.replace(/[^\w#+-]/g, '');
    const match = roman.match(/[ivIV]+/);
    const key = match ? match[0] : 'I';
    const degreeIndex = Math.max(0, degreeOrder.indexOf(key.toUpperCase()));
    const rootIndex = Math.min(Math.max(0, degreeIndex), Math.max(0, (scale?.length || 1) - 1));
    if (!Array.isArray(scale) || scale.length < 3) return [0, 4, 7];

    const chord = [];
    for (let i = 0; i < 3; i++) {
        const absIndex = rootIndex + i * 2;
        const scaleIndex = absIndex % scale.length;
        const octave = Math.floor(absIndex / scale.length);
        chord.push(scale[scaleIndex] + octave * 12);
    }
    for (let i = 1; i < chord.length; i++) {
        while (chord[i] <= chord[i - 1]) chord[i] += 12;
    }
    return chord;
}

function buildChordLog(planet, steps) {
    const progression = Array.isArray(planet.progression) && planet.progression.length
        ? planet.progression
        : ['I', 'IV', 'V', 'I'];
    let chordIndex = 0;
    const events = [];
    for (let i = 0; i < steps; i++) {
        const current = progression[chordIndex];
        events.push({
            step: i,
            chord: current,
            key: getChordFunctionKey(current),
            intervals: chordIntervalsFromSymbol(current, planet.scale),
        });
        const rng = new RNG((planet.seed || 0) + 90000 + i);
        const next = selectNextChord({
            currentChordKey: getChordFunctionKey(current),
            progression,
            getChordFunctionKey,
            rng,
        });
        chordIndex = next.nextChordIndex;
    }
    return events;
}

function buildMelodyLog(planet, steps, chordEvents) {
    const events = [];
    const melodyHistory = [];
    const motifBank = Array.isArray(planet.motifBank) && planet.motifBank.length
        ? planet.motifBank
        : [[0, 2, 4, 2], [0, 3, 5, 3]];
    let activeMotifIdx = 0;

    for (let i = 0; i < steps; i++) {
        const rng = new RNG((planet.seed || 0) + 1000 + i);
        const phrasePos = i % 8;
        const isResponse = (i % 16) >= 8;
        const isPhraseEnd = phrasePos === 7;
        const biomeId = planet?.biome?.id;
        const motifChance = biomeId === 'fungal' ? (isResponse ? 0.62 : 0.26) : (isResponse ? 0.4 : 0.15);
        const responseChance = biomeId === 'fungal' ? (isResponse ? 0.46 : 0.08) : (isResponse ? 0.35 : 0.05);

        if ((i % 16) === 0 && i > 0) {
            activeMotifIdx = (activeMotifIdx + 1) % motifBank.length;
        }

        let mode = 'GENERATIVE';
        let noteStep = 0;
        if (motifBank.length && rng.range(0, 1) < motifChance) {
            mode = 'MOTIF';
            const bank = motifBank[activeMotifIdx];
            noteStep = bank[phrasePos % bank.length];
        } else if (melodyHistory.length >= 4 && rng.range(0, 1) < responseChance) {
            mode = 'RESPONSE';
            const variation = biomeId === 'fungal' ? rng.int(-1, 1) : rng.int(-1, 2);
            const hIdx = i % 4;
            noteStep = melodyHistory[melodyHistory.length - 4 + hIdx] + variation;
        } else {
            const scale = Array.isArray(planet.scale) && planet.scale.length ? planet.scale : [0, 2, 4, 5, 7, 9, 11];
            const currentChord = chordEvents[i % chordEvents.length]?.intervals || [0, 4, 7];
            const weighted = [];
            scale.forEach((s) => {
                const norm = ((s % 12) + 12) % 12;
                const chordBias = currentChord.some((iv) => (iv % 12) === norm) ? 3 : 1;
                const responseBias = isResponse || isPhraseEnd ? (norm === 0 || norm === 7 ? 2 : 1) : 1;
                const copies = Math.max(1, Math.round(chordBias * responseBias));
                for (let j = 0; j < copies; j++) weighted.push(s);
            });
            noteStep = weighted.length ? rng.pick(weighted) : scale[0];
        }

        const restProbability = clamp(0.08 + (isPhraseEnd ? 0.08 : 0) + (isResponse ? 0.04 : 0), 0.08, 0.92);
        const isRest = rng.range(0, 1) < restProbability * 0.45;
        if (!isRest) {
            melodyHistory.push(noteStep);
            if (melodyHistory.length > 16) melodyHistory.shift();
        }

        events.push({
            step: i,
            mode: isRest ? 'REST' : mode,
            noteStep: isRest ? null : noteStep,
            phrasePos,
            isResponse,
            isPhraseEnd,
        });
    }
    return events;
}

function defaultTensionState(step, cycleSteps, profile) {
    const cyclePos = cycleSteps ? (step % cycleSteps) / cycleSteps : 0;
    const energy = clamp(Math.sin((step / Math.max(1, cycleSteps)) * Math.PI) * 0.5 + 0.5, 0, 1);
    return {
        phase: energy > 0.85 ? 'SURGE' : energy > 0.55 ? 'BUILD' : energy > 0.25 ? 'STIR' : 'DORMANT',
        energy,
        cyclePos,
        pocket: 0.5,
        profile,
        fillVoices: ['rimshot', 'bongo'],
        polyVoices: ['conga'],
    };
}

function buildPercussionLog(planet, steps) {
    const cycleSteps = Math.max(1, planet?.ac?.stepCount || 16);
    const tensionProfile = buildTensionProfile({
        biomeId: planet?.biome?.id || 'default',
        melodyDensity: planet?.melodyDensity || 0.05,
        clamp,
        defaultProfile: DEFAULT_TENSION_PROFILE,
        biomeProfiles: BIOME_TENSION_PROFILES,
    });
    const events = [];
    for (let i = 0; i < steps; i++) {
        const rng = new RNG((planet.seed || 0) + 50000 + i);
        const tensionState = defaultTensionState(i, cycleSteps, tensionProfile);
        const rhythmState = resolveRhythmState({
            planet,
            stepIndex: i % cycleSteps,
            barCount: Math.floor(i / cycleSteps),
            fillsEnabled: true,
            tensionState,
            clamp,
        });
        const hits = [];
        const onQuarter = (i % 4) === 0;
        const onBackbeat = (i % 8) === 4;
        const onEighth = (i % 2) === 0;

        if (onQuarter || rng.range(0, 1) < rhythmState.kickChance * 0.2) hits.push('kick');
        if (onBackbeat || rng.range(0, 1) < rhythmState.snareChance * 0.14) hits.push('snare');
        if (onEighth || rng.range(0, 1) < rhythmState.hatChance * 0.28) hits.push('hat');
        if (rhythmState.extraVoices?.length && rng.range(0, 1) < rhythmState.extraVoiceChance * 0.4) {
            hits.push(rng.pick(rhythmState.extraVoices));
        }
        if (rhythmState.shouldFill && rng.range(0, 1) < rhythmState.fillChance) {
            hits.push('fill');
        }
        events.push({
            step: i,
            energy: Number(rhythmState.energy.toFixed(4)),
            phase: rhythmState.phase,
            hits,
        });
    }
    return events;
}

export function buildDeterminismEventLog(planet, options = {}) {
    const steps = Math.max(1, options.steps || 64);
    const chords = buildChordLog(planet, steps);
    const melody = buildMelodyLog(planet, steps, chords);
    const percussion = buildPercussionLog(planet, steps);
    return { steps, chords, melody, percussion };
}
