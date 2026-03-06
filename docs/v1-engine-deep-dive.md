# Lost Codex V1 Audio Engine Deep Dive

This document explains how the V1 engine actually generates a planet sound world end-to-end, from address code to audible sequencing behavior.

## 1) Direct answer: are chord progressions fixed per biome?

No.

What is fixed:
- There is a finite global progression template list in `src/data.js` (`PROGRESSIONS`).

What is not fixed:
- A planet chooses one template deterministically from that list in `generatePlanet()` (`src/planet.js`) using seeded RNG (`rng.int(0, PROGRESSIONS.length)`).
- During playback, V1 does not just iterate linearly; it uses weighted transition logic (`CHORD_TRANSITIONS` in `src/audio/subsystems/harmony.js`) to pick the next chord target from that planet's progression set.
- Chord dwell time is also variable (1-4 transport cycles), so harmonic cadence is not a rigid loop at a fixed bar length.

So the progression system is "template-constrained but stochastic-within-template" per planet, not "one fixed progression per biome."

## 2) Top-level V1 architecture

Main V1 runtime class:
- `AudioEngine` in `src/audio.js`

V1 start path:
1. `AudioEngine.start(planet)` routes to `startEnginePlayback()` when `engineMode === 'v1'`.
2. `startEnginePlayback()` (in `src/audio/subsystems/startup.js`) bootstraps graph + scheduler + subsystems.
3. Subsystems are launched concurrently:
- harmonic bed and chord updater
- melody sequencer
- percussion sequencer
- bass sequencer
- tension arc
- granular cloud
- ambience loops
- biome-specific macro FX
- moon canon layer

V1 timing model:
- Primary scheduler: `LookaheadScheduler` (`src/audio/core/scheduler.js`) with:
  - tick: 25ms
  - schedule horizon: 120ms
- Fallback timers: `setInterval` and `_setManagedTimeout` when a recurring channel is not available.

Transport model:
- Built via `buildTransport(stepCount, bpm)` (`src/audio/core/transport.js`)
- Key derived timing values:
  - `stepSeconds = 15 / bpm`
  - `cycleSteps` from biome config step count, clamped 4-32
  - `cycleMs = stepMs * cycleSteps`

## 3) Planet generation and deterministic identity seed

Planet generation entry:
- `generatePlanet(address)` in `src/planet.js`

Seed and deterministic base:
1. `hashAddress(address)` in `src/rng.js` -> 32-bit seed.
2. `RNG(seed)` drives all deterministic generation.
3. Positional glyph encoding picks core identity dimensions:
- biome index
- scale index
- root note index
- tuning system flag

Music identity fields set at generation:
- `biome` (from `BIOMES`)
- `scale` (from `SCALES`)
- `rootFreq` (from `ROOT_NOTES`)
- `tuningSystem` + `tuningRatios` (Equal/Just/Pythagorean)
- `progression` (picked from `PROGRESSIONS`)
- `motifBank` (4 deterministic motif arrays)
- `numMoons` + `moonSystem` parameters (density/resonance/phaseWarp/orbitSpread/temporalDrift)
- `ac` (biome audio config + randomized per-planet variance multipliers)

Critical point:
- Biome is only one part of identity. V1 combines biome defaults with seed-derived variance, so two planets in the same biome can still differ substantially.

## 4) RNG and determinism model in V1

RNG implementation:
- `RNG` in `src/rng.js` (Mulberry32-style generator with `range/int/pick/bool`)

Deterministic decision pattern:
- Most musical events use seeded `new RNG(planet.seed + offset + stepCounter)` patterns.
- Different subsystems use different salt/offset domains to avoid correlated randomness.

Examples:
- Melody note decisions: `new RNG(planet.seed + 1000 + engine.stepNote++)`
- Melody transport-step decisions (rest/attempt): `new RNG(planet.seed + 10000 + melodyTransportStep)`
- Percussion per-step decisions: `new RNG(planet.seed + 50000 + engine.stepPerc++)`
- Tension arc updates: `new RNG(planet.seed + 88000 + engine._tensionTick)`
- Chord transition decisions: `new RNG(planet.seed + 90000 + engine.stepChord++)`
- Moon scheduling: `new RNG(planet.seed + 111000 + engine.stepNote*37 + phraseOffset)`

Identity vs strict determinism:
- In identity mode, `_random()` can call `Math.random()` for some noise construction paths.
- In strict mode, `_random()` is replaced by seeded per-label RNG streams.
- Event decisions (note/chord/percussion choices) are largely seeded regardless; strict mostly tightens remaining unseeded noise paths.

## 5) Startup graph and signal routing (V1)

`startEnginePlayback()` builds:

Master and recording chain:
- EQ (low/mid/high) -> master gain -> compressor/limiter -> DC high-pass -> analyser -> destination
- Optional `MediaStreamDestination` taps post-master for recording/export.

Shared effect routing:
- Core filter (`filt`) per planet
- Convolution reverb (`_buildReverb`)
- Delay with capped feedback (`<= 0.75`) and lowpass in feedback loop
- Optional biome inserts:
  - bitcrusher for `corrupted`/`storm`
  - phaser for `psychedelic`/`nebula`

Harmonic bed:
- seeded periodic-wave base oscillator
- drone pair (`d1`, `d2`)
- FM pair (`fmMod` -> `fmCarrier.frequency`)
- pad stack built from scale steps with detune and LFO

Other layers:
- noise bed (biome-shaped filter)
- melody bus + dedicated lowpass
- moon bus/effects chain (if moons exist)

## 6) Harmony engine internals

Files:
- `src/audio/subsystems/harmony.js`

Core pieces:
- `buildScaleChord(symbol, planet)`: converts Roman function symbol into scale-degree triad (planet scale-aware).
- `CHORD_TRANSITIONS`: weighted function-to-function transition map.
- `selectNextChord()`: builds weighted candidate pool from current chord function and progression candidates.
- `updateChordProgression()`: applies new chord to harmonic bed and schedules next update.

How chord timing works:
1. Current symbol resolved from progression index.
2. Intervals computed via `buildScaleChord()`.
3. Bed oscillators/pads glide toward new target frequencies.
4. Next chord chosen using weighted transitions.
5. Next update scheduled after a random chord hold:
- dominant-like functions: shorter (1-2 cycles)
- tonic/submediant-like functions: longer (2-4 cycles)
- short-cycle transports can lengthen hold for stability

Impact:
- Chord changes are intentionally slower and function-sensitive in V1, not a constant "every N beats" change.

## 7) Melody sequencing internals

Files:
- transport loop setup: `src/audio/subsystems/startup.js`
- note synthesis logic: `src/audio/subsystems/melody-sequencer.js`
- helper heuristics: `src/audio/subsystems/melody.js`

Two-level process:
1. Step-level gate (`runMelodyStep` in startup):
- computes cycle position and response region
- adapts melody stride from density/tension/drift
- adapts rest probability dynamically (`_getTargetRestProbability`)
- only attempts a note on stride-aligned steps
2. Note-level composition (`scheduleMelodyNote`):
- picks one of:
  - `MOTIF` recall from planet motif bank
  - `RESPONSE` from recent melody history with variation
  - `GENERATIVE` weighted scale-degree selection

Generative weighting factors:
- base tonal weights per semitone class
- phrase structure bias (resolution vs tension zones)
- chord-tone bias using current chord intervals
- tension dissonance bias (more tritone/leading color when tension high)
- motion bias (especially for fungal biome)
- biome-specific weighting tweaks

Per-note realization:
- octave pick from biome `melodyOcts`
- optional quarter-tone detune
- waveform/voice pick via performance-aware weighting
- voice-specific envelope shaping
- HRTF spatial placement
- optional pitch bend
- optional chord-stab layer
- optional arp burst
- moon canon answers on top

Why V1 melody feels "alive":
- It mixes motif memory, response memory, and constrained stochastic generation instead of only deterministic pattern playback.

## 8) Voice and synthesis diversity

File:
- `src/voices.js`

V1 uses two broad voice paths:
1. Native oscillator path (sine/square/saw/triangle + custom periodic waves)
2. Additive/physical-model style voice builders (`buildVoice`)

Advanced/additive voices include:
- `crystal_chimes`, `gong`, `modal_resonator`, `phase_cluster`, `wavetable_morph`, `vowel_morph`, `granular_cloud`, `drone_morph`, etc.

Each voice has:
- distinct partial structures/spectra
- different attack/decay envelopes
- distinct modulation/filtering schemes
- load-aware lifetime cleanup via NodeRegistry

This voice heterogeneity is a major contributor to per-biome character.

## 9) Percussion and rhythm generation

Files:
- `src/audio/subsystems/percussion-sequencer.js`
- `src/audio/subsystems/percussion.js`
- `src/audio/config/pattern-banks.js`

Pipeline:
1. Choose base biome pattern bank (kick/snare/hat/sub arrays, sometimes Euclidean-generated).
2. Fit patterns to planet cycle length.
3. Build phase-aware transformed pattern banks (DORMANT/STIR/BUILD/SURGE/CLIMAX/FALLOUT).
4. At each percussion step:
- derive rhythm state from tension
- apply chaos, ghost notes, fills, accents, push probabilities
- apply swing delay on off-steps
- trigger extra biome percussion voices with probabilistic rules
5. Optional polyrhythm lane (triplet-time) for complex biomes.

Key result:
- Rhythm is not static pattern playback; it is pattern+phase transformation+probabilistic ornamentation.

## 10) Tension arc as global macro-composer

Files:
- `src/audio/subsystems/tension-engine.js`
- `src/audio/subsystems/tension.js`

Update cadence:
- every 2 seconds

State model:
- scalar energy with surge and drain dynamics
- derived phase labels:
  - `DORMANT`, `STIR`, `BUILD`, `SURGE`, `CLIMAX`, `FALLOUT`

Global effects:
- modulates filter motion and FM index
- drives rhythm state probabilities (fill/ghost/chaos/accent/push)
- triggers phase transition FX and biome signature macro events
- fires climax swell and then enters drain/reset behavior

This is one of the strongest cross-subsystem couplers in V1.

## 11) Moon system (satellite canon engine)

File:
- `src/audio/subsystems/moon.js`

What moon system contributes:
- delayed melodic satellites answering lead notes
- per-moon lane gating (stride + phase offsets + offbeat chance)
- per-moon degree shifts, octave offsets, detune/drift
- per-biome wave pools and behavior biases
- independent envelope/filter/pan/wobble per moon

Scheduling:
- invoked from melody note path (`_scheduleMoonCanons`)
- can be skipped by performance pressure guard
- updates debug counters (`moonProcCount`, `moonLastBurst`, etc.)

If moons are absent or gated out, the layer can go quiet, which strongly affects perceived texture.

## 12) Granular and ambience layers

Granular file:
- `src/audio/subsystems/granular.js`

Granular behavior:
- starts only when density and performance conditions allow
- uses synthetic source buffer from root harmonics + noise
- zero-crossing-biased grain start selection
- short overlap envelopes to reduce clicks
- load-aware grain throttling

Ambience file:
- `src/audio/subsystems/ambience.js`

Ambience behavior:
- feature-driven by biome (`rain`, `birds`, `spores`, `wind`, etc.)
- each feature has its own interval channel and seeded event RNG
- events are subtle but identity-critical over long listening windows

## 13) Why V1 planets feel distinct in practice

V1 uniqueness is emergent from layered deterministic variation:
1. Different biome defaults (`AUDIO_CONFIGS`) set broad timbral/rhythmic personality.
2. Planet-level randomization perturbs many config dimensions (FM index/ratio, grain params, reverb, melody density, etc.).
3. Scale/root/tuning/progression differ per address.
4. Motif banks are generated per planet.
5. Moon system and rarity-driven extensions alter responses and texture depth.
6. Tension arc continuously reshapes rhythmic and spectral behavior over time.
7. Advanced voice library adds non-uniform synthesis color.

If any of these are flattened in a newer engine (especially progression cadence, motif/response logic, per-biome voice routing, moon activity, or phase-driven percussion), planets will collapse toward sameness.

## 14) Practical parity checklist for V2 against V1 behavior

To preserve V1 identity while upgrading V2, parity should be measured on:
1. Harmony pacing:
- chord hold length distribution
- function-aware transitions
2. Melody composition:
- motif/response/generative ratio
- rest probability dynamics
- phrase resolution behavior
3. Voice diversity:
- per-biome wave pool spread
- additive voice hit-rate
4. Moon activity:
- average `moonProcCount` and audible contribution
5. Percussion adaptivity:
- tension-phase pattern mutation, fills, ghost density
6. Macro evolution:
- phase transition cadence and climax/fallout cycles
7. Ambient texture:
- ambience event rates and granular continuity/noise profile

Without this parity layer, V2 can be technically larger but musically flatter.

## 15) File map (V1-relevant)

- `src/rng.js`: seed hashing and core RNG
- `src/planet.js`: deterministic planet generation, motif bank, progression pick
- `src/data.js`: biomes, scales, tunings, progression templates, audio configs
- `src/audio.js`: V1 engine facade/state/scheduler wiring
- `src/audio/subsystems/startup.js`: V1 boot path and subsystem launch
- `src/audio/subsystems/harmony.js`: chord engine + bass
- `src/audio/subsystems/melody.js`: stride/performance heuristics
- `src/audio/subsystems/melody-sequencer.js`: note-level composition/synthesis dispatch
- `src/audio/subsystems/percussion-sequencer.js`: percussion generation and playback
- `src/audio/subsystems/percussion.js`: phase pattern transforms
- `src/audio/subsystems/tension-engine.js`: global macro arc runtime
- `src/audio/subsystems/tension.js`: tension and rhythm-state models
- `src/audio/subsystems/moon.js`: moon profile and canon scheduler
- `src/audio/subsystems/granular.js`: granular cloud engine
- `src/audio/subsystems/ambience.js`: biome ambience loops
- `src/voices.js`: additive/advanced voice implementations
- `src/audio/core/scheduler.js`: lookahead scheduler
- `src/audio/core/transport.js`: transport timing math
- `src/audio/core/node-registry.js`: node lifecycle cleanup
