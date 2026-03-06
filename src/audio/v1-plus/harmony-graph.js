import { RNG } from '../../rng.js';
import { CHORD_TRANSITIONS, getChordFunctionKey, normalizeChordSymbol } from '../subsystems/harmony.js';
import { resolvePaceClass } from './identity-profile.js';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const SECONDARY_DOMINANTS = {
    ii: 'V',
    iii: 'V',
    IV: 'I',
    V: 'ii',
    vi: 'V',
    vii: 'V',
};

const HOLD_POLICY = {
    slow: [6, 24],
    medium: [3, 10],
    fast: [1, 6],
};

function addWeight(weightMap, symbol, weight = 0) {
    const normalized = normalizeChordSymbol(symbol);
    if (!normalized || !Number.isFinite(weight) || weight <= 0) return;
    weightMap.set(normalized, (weightMap.get(normalized) || 0) + weight);
}

function sampleWeighted(rng, weightMap, fallback = 'I') {
    let total = 0;
    weightMap.forEach((weight) => {
        total += weight;
    });
    if (total <= 0) return fallback;
    let marker = rng.range(0, total);
    for (const [symbol, weight] of weightMap.entries()) {
        marker -= weight;
        if (marker <= 0) return symbol;
    }
    return fallback;
}

function resolveHoldRange(identityProfile, paceClass) {
    const profileHold = identityProfile?.holdPolicy?.[paceClass];
    if (Array.isArray(profileHold) && profileHold.length >= 2) {
        const min = clamp(Math.round(profileHold[0]), 1, 96);
        const max = clamp(Math.max(min + 1, Math.round(profileHold[1])), min + 1, 112);
        return [min, max];
    }
    const fallback = HOLD_POLICY[paceClass] || HOLD_POLICY.medium;
    return [fallback[0], fallback[1]];
}

export class HarmonyGraph {
    constructor(planet = {}, identityProfile = null) {
        this.seed = ((planet?.seed || 1) + 185317) >>> 0;
        this.progression = Array.isArray(planet?.progression) && planet.progression.length
            ? planet.progression.map((symbol) => normalizeChordSymbol(symbol))
            : ['I', 'IV', 'V', 'I'];
        this.identityProfile = identityProfile || null;
        this.lastSymbol = this.progression[0] || 'I';
        this.lastHoldBars = 0;
    }

    next({
        barIndex = 0,
        section = 'INTRO',
        dissonance = 0.35,
        stability = 0.55,
        cadenceStrength = 0.5,
        paceOverride = 'auto',
    } = {}) {
        const paceClass = resolvePaceClass(this.identityProfile, paceOverride);
        const rng = new RNG((this.seed + barIndex * 149) >>> 0);
        const progressionIdx = barIndex % this.progression.length;
        const baseSymbol = this.progression[progressionIdx] || 'I';
        const baseKey = getChordFunctionKey(baseSymbol);
        const weightMap = new Map();
        const cadenceBias = clamp(this.identityProfile?.cadenceBias || 0, -1, 1);
        const harmonicComplexity = clamp(this.identityProfile?.harmonicComplexity || 0.5, 0, 1);

        addWeight(weightMap, baseSymbol, 2.3);
        addWeight(weightMap, this.lastSymbol, 0.8);
        addWeight(weightMap, this.progression[(progressionIdx + 1) % this.progression.length], 0.55);
        addWeight(weightMap, this.progression[(progressionIdx + this.progression.length - 1) % this.progression.length], 0.45);

        const transitions = CHORD_TRANSITIONS[baseKey] || {};
        Object.entries(transitions).forEach(([targetKey, transitionWeight]) => {
            this.progression.forEach((candidate) => {
                if (getChordFunctionKey(candidate) !== targetKey) return;
                addWeight(weightMap, candidate, transitionWeight * 0.58);
            });
        });

        const instability = clamp((1 - stability) * 0.55 + dissonance * 0.45 + harmonicComplexity * 0.16, 0, 1);
        if (instability > 0.4 && rng.bool(instability * 0.33)) {
            addWeight(weightMap, SECONDARY_DOMINANTS[baseKey] || 'V', 0.6 + instability * 0.55);
        }
        if (harmonicComplexity > 0.65 && rng.bool((harmonicComplexity - 0.6) * 0.42)) {
            addWeight(weightMap, 'ii', 0.4 + harmonicComplexity * 0.22);
            addWeight(weightMap, 'iii', 0.24 + harmonicComplexity * 0.18);
            addWeight(weightMap, 'vii', 0.16 + harmonicComplexity * 0.14);
        }

        if (section === 'SURGE') {
            addWeight(weightMap, 'V', 0.9);
            addWeight(weightMap, 'ii', 0.6);
        } else if (section === 'AFTERGLOW') {
            addWeight(weightMap, 'I', 0.95);
            addWeight(weightMap, 'vi', 0.75);
            addWeight(weightMap, 'IV', 0.65);
        } else if (section === 'RELEASE') {
            addWeight(weightMap, 'I', 0.78);
            addWeight(weightMap, 'IV', 0.7);
        }

        if (cadenceStrength > 0.6 && this.lastSymbol === 'V') addWeight(weightMap, 'I', 1.1);
        if (cadenceStrength > 0.55 && progressionIdx === this.progression.length - 1) addWeight(weightMap, 'V', 0.8);
        if (cadenceBias > 0) {
            addWeight(weightMap, 'V', cadenceBias * 0.72);
            addWeight(weightMap, 'I', cadenceBias * 0.84);
        } else if (cadenceBias < 0) {
            const anti = Math.abs(cadenceBias);
            addWeight(weightMap, 'vi', anti * 0.6);
            addWeight(weightMap, 'IV', anti * 0.54);
            addWeight(weightMap, 'ii', anti * 0.38);
        }

        const symbol = sampleWeighted(rng, weightMap, baseSymbol);
        const changed = symbol !== this.lastSymbol || barIndex === 0;
        const [baseMin, baseMax] = resolveHoldRange(this.identityProfile, paceClass);
        let holdMin = baseMin;
        let holdMax = baseMax;

        if (section === 'SURGE') {
            holdMin = Math.max(1, Math.round(holdMin * 0.58));
            holdMax = Math.max(2, Math.round(holdMax * 0.62));
        } else if (section === 'AFTERGLOW') {
            holdMin = Math.round(holdMin * 1.2);
            holdMax = Math.round(holdMax * 1.25);
        } else if (section === 'INTRO') {
            holdMin = Math.round(holdMin * 1.1);
            holdMax = Math.round(holdMax * 1.15);
        }

        holdMin = clamp(holdMin, 1, 96);
        holdMax = clamp(Math.max(holdMin + 1, holdMax), holdMin + 1, 112);

        const holdBars = rng.int(holdMin, holdMax + 1);
        const changedWithCadence = changed || this.lastHoldBars !== holdBars;
        this.lastSymbol = symbol;
        this.lastHoldBars = holdBars;

        return {
            symbol,
            changed: changedWithCadence,
            holdBars,
            paceClass,
        };
    }
}
