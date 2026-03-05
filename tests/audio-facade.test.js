import { describe, expect, it } from 'vitest';
import { AudioEngine as FacadeAudioEngine } from '../src/audio/engine.js';
import { AudioEngine as RootAudioEngine } from '../src/audio.js';

describe('audio facade import', () => {
    it('re-exports AudioEngine from src/audio/engine.js', () => {
        expect(FacadeAudioEngine).toBe(RootAudioEngine);
    });
});
