import { describe, expect, it } from 'vitest';
import { resolveLegacyAudioToggles } from '../src/audio/legacy/toggles.js';

function mockWindow(search = '', override = undefined) {
    return {
        location: { search },
        __LC_LEGACY_AUDIO__: override,
    };
}

describe('legacy audio toggle resolution', () => {
    it('defaults with legacy fallback disabled', () => {
        const toggles = resolveLegacyAudioToggles(null);
        expect(toggles.chordProgressionFallback).toBe(false);
    });

    it('supports engine_refactor_v2 compatibility flag', () => {
        const disabled = resolveLegacyAudioToggles(mockWindow('?engine_refactor_v2=0'));
        const enabled = resolveLegacyAudioToggles(mockWindow('?engine_refactor_v2=1'));
        expect(disabled.chordProgressionFallback).toBe(true);
        expect(enabled.chordProgressionFallback).toBe(false);
    });

    it('prefers explicit legacy chord fallback query over compatibility flag', () => {
        const toggles = resolveLegacyAudioToggles(
            mockWindow('?engine_refactor_v2=1&legacy_chord_fallback=1')
        );
        expect(toggles.chordProgressionFallback).toBe(true);
    });

    it('allows global runtime override', () => {
        const toggles = resolveLegacyAudioToggles(
            mockWindow('?legacy_chord_fallback=0', { chordProgressionFallback: true })
        );
        expect(toggles.chordProgressionFallback).toBe(true);
    });
});

