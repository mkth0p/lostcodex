const DEFAULT_LEGACY_AUDIO_TOGGLES = Object.freeze({
    chordProgressionFallback: false,
});

function parseBoolFlag(value) {
    if (typeof value === 'boolean') return value;
    if (typeof value !== 'string') return undefined;
    const normalized = value.trim().toLowerCase();
    if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
    if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
    return undefined;
}

function readQueryFlag(params, keys) {
    for (let i = 0; i < keys.length; i++) {
        const parsed = parseBoolFlag(params.get(keys[i]));
        if (typeof parsed === 'boolean') return parsed;
    }
    return undefined;
}

export function resolveLegacyAudioToggles(win = typeof window !== 'undefined' ? window : null) {
    const toggles = {
        ...DEFAULT_LEGACY_AUDIO_TOGGLES,
    };
    if (!win) return toggles;

    const params = new URLSearchParams(win.location?.search || '');
    const explicitChordFallback = readQueryFlag(params, ['legacy_chord_fallback', 'legacy_chords']);
    const refactorFlag = readQueryFlag(params, ['engine_refactor_v2']);

    if (typeof explicitChordFallback === 'boolean') {
        toggles.chordProgressionFallback = explicitChordFallback;
    } else if (typeof refactorFlag === 'boolean') {
        toggles.chordProgressionFallback = !refactorFlag;
    }

    const override = win.__LC_LEGACY_AUDIO__;
    const overrideValue = parseBoolFlag(override?.chordProgressionFallback);
    if (typeof overrideValue === 'boolean') {
        toggles.chordProgressionFallback = overrideValue;
    }

    return toggles;
}

