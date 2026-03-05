# Architecture Overview

## Entry Points

- `index.html` -> `main.js` -> `src/app-ui.js`
- `synth.html` -> `main.js` (`window.__SYNTH_MODE = true`) -> `src/synth-ui.js`

## Audio Engine Boundary

- Public import facade: `src/audio/engine.js`
- Current implementation class: `src/audio.js` (`AudioEngine`)
- Extracted core utilities:
  - `src/audio/core/node-registry.js`
  - `src/audio/core/transport.js`
  - `src/audio/core/scheduler.js`
- Extracted config banks:
  - `src/audio/config/tension-profiles.js`
  - `src/audio/config/drum-profiles.js`
  - `src/audio/config/pattern-banks.js`
  - `src/audio/config/timbre-delta-limits.js`
- Worklets:
  - `src/audio/worklets/bitcrusher-processor.js`

## Shared UI Layer

- `src/ui/shared/address-codec.js`
- `src/ui/shared/address-utils.js`
- `src/ui/shared/bookmarks.js`
- `src/ui/shared/slider-fill.js`
- `src/ui/shared/audio-controls.js`
- `src/ui/shared/audio-state-ui.js`

Both app modes consume this shared layer for address handling, bookmarks, control behavior, and state-panel rendering.

## Data Flow

1. UI creates/navigates planet address via `generatePlanet`.
2. UI controls call stable engine methods (`setMix`, `setPerformance`, `setFeatureFlags`).
3. Engine emits read-only snapshots through `subscribeState`.
4. UI renders chord/melody/debug/tension from state stream.

## Transport Scheduler

- Lookahead scheduler defaults:
  - tick: `25ms`
  - horizon: `120ms`
- Active recurring channels:
  - `melody`
  - `percussion`
  - `percussion-poly`
  - `bass`
  - `tension`
  - `macroFx*`
  - `ambience-*`

## Runtime Flags

- The engine refactor path is now the default runtime path; no legacy chord fallback flag remains.

## Legacy Notes

- Deprecated root `app.js` has been removed after parity migration.
- New work must target `main.js` + modular controllers (`src/app-ui.js`, `src/synth-ui.js`).
