# Audio Engine API Contract

## Stable Public Methods

These methods are supported for external callers and UI controllers:

- Import path: `src/audio/engine.js`

- `start(planet)`
- `stop()`
- `crossfadeTo(planet, cb?)`
- `setVolume(value)`
- `setReverb(value)`
- `getAnalyser()`
- `getRecordingStream()`
- `getChord()`
- `getMelodyState()`
- `getDebugState()`

## New Stable Control Surface

- `setMix({ volume, reverb, eqLow, eqMid, eqHigh, percussionVolume })`
- `setPerformance({ drift, density })`
- `setFeatureFlags({ granular, percussion, chords, arp, pitchBend, motif, ghost, fills })`
- `setDeterminismMode('identity' | 'strict')`
- `subscribeState(listener)` returning `unsubscribe`
- `triggerNavigationFx()` for transition SFX without private access

## State Stream Payload

`subscribeState` listeners receive:

```js
{
  transport: { bpm, cycleSteps, stepMs, cycleMs } | null,
  tension: { phase, energy },
  melody: { mode, phraseLength, restProb, motifEnabled, motifIndex, motifCount, step },
  debug: { ...getDebugState() },
  chord: string,
  playing: boolean
}
```

`getDebugState()` includes:

- `determinismMode`
- `engineRefactorV2`
- scheduler telemetry (`schedulerTickMs`, `schedulerHorizonMs`, `schedulerLateCallbacks`, `schedulerMaxLateMs`)

## Internal/Private Surface

- Fields/methods prefixed with `_` are internal implementation details.
- UI code must not mutate underscored fields.
- Internal names can change without deprecation guarantees.
