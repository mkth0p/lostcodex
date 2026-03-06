# V2 Sonic Regression Diagnostics

Date: 2026-03-06

## Context

User-reported issues in V2 were consistent across planets:
- Composition felt reduced to a shared 4-chord bed.
- Planet identity drifted versus V1.
- Moon system felt non-functional.
- V2 loudness/space balance felt wrong (pads/drones masked or weak).

Primary reference snapshots:
- `docs/engine-smoke-v1.json`
- `docs/engine-smoke-v2.json`
- `docs/sonic-diagnostics-v1.json`
- `docs/sonic-diagnostics-v2.json`

## Quantitative Signals

From the current diagnostics snapshots:
- Mean active nodes: V1 `152.85` vs V2 `160.46`.
- Mean load: V1 `0.1457` vs V2 `0.1395`.
- Mean distinct chords per planet window: V1 `2.2` vs V2 `4.0`.
- Mean melody-mode count per planet window: V1 `2.6` vs V2 `1.9`.
- Mean event rate: V1 `0.234/s` vs V2 `1.53/s`.

Interpretation:
- V2 is not CPU-starved versus V1; regression is orchestration/mix behavior, not raw scheduler failure.
- V2 had higher harmonic churn but less melodic behavioral variety, creating a flatter perceived identity.

## Root Causes (Code-Level)

1. Moon orchestration gap in V2
- V2 did not route moon behavior through a dedicated moon bus and did not force any early moon trigger path.
- Result: moon perception was often near-zero in short listening windows.

2. Harmony pacing mismatch
- V2 chord orchestration changed too frequently and too uniformly, causing generic progression feel.
- Harmonic changes were not held long enough in ambient sections.

3. Melody composition simplification
- V2 melody planning underused V1-style motif/response memory structure.
- Chord-tone anchoring and phrase-resolution weighting were weaker than V1.

4. V2 gain staging under-drive
- Layer trims + sum/input trims + master output attenuated drones/pads too much.
- Perceived result: reduced body/space and weaker ambient bed.

5. Moon diagnostics ambiguity
- `moonCount` used a fallback (`planet.numMoons`) even when `_moonProfile` could be zero.
- This hid whether moon scheduling assets were actually built.

## Implemented Fixes (This Pass)

1. V2 moon subsystem is now fully wired in startup/scheduler
- File: `src/audio/v2/engine-v2.js`
- Added moon bus setup/teardown for V2 and explicit moon profile initialization.
- Added moon scheduling calls from melody events.
- Added chord-change moon trigger path (`force` path) for earlier audibility in short runs.

2. Moon scheduler supports forced dispatch for V2 anchor events
- File: `src/audio/subsystems/moon.js`
- Added `meta.force` to bypass probabilistic gate when needed.
- Lane gating still applies, so behavior remains structured.

3. Harmony planner was reworked for identity-preserving pacing
- File: `src/audio/v2/generation/harmony-planner.js`
- Added biome color pools and weighted candidate scoring.
- Added cadence/downbeat behavior and hold-bar output.
- Added progression anchoring plus controlled instability coloration.

4. Melody planner was expanded with composition memory and phrase logic
- File: `src/audio/v2/generation/melody-planner.js`
- Reintroduced motif/response/generative modal behavior with deterministic history.
- Added stronger chord-tone bias, phrase-end resolution, and motion constraints.
- Added biome voice-hint pools and improved octave/velocity/duration shaping.

5. Mix gain staging was rebalanced
- Files:
  - `src/audio/v2/graph/bus-topology.js`
  - `src/audio/v2/mix/master-chain.js`
- Raised conservative layer trims and bus trims to restore bed audibility.
- Reduced clipper aggressiveness and increased master output target.

6. Moon debug telemetry was clarified
- File: `src/audio.js`
- Added:
  - `moonProfileCount`
  - `moonPlanetCount`
- Keeps existing `moonCount` for backward compatibility.

## Quick Verification Results

- Lint: pass (`npm run lint`).
- Tests: pass (`npm test`, 16 files / 46 tests).
- Targeted runtime check (V2, code `56789`, 12s window):
  - `moonProfileCount = 2`
  - `moonProcCount = 2`
  - Confirms moon path now processes events in short windows.

## Remaining Risk / Next Tuning Pass

- Per-planet signature timbre contrast still needs deeper expansion in V2 voice palettes.
- Reverb diffusion and long-tail voice voicing should be audited per biome with listening panel A/B against V1.
- Additional planner diversity tests should be added to protect motif/response richness and cadence behavior from regressions.
