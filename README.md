# Lost Codex Music Engine Manual

This document is intentionally about the instrument, not the website.

If you do not care about the planet renderer, navigation, UI chrome, or the fiction layer, that is fine. The useful mental model is this:

- an address is hashed into a deterministic music preset
- that preset is called a "planet" in the codebase
- `src/audio.js` turns that preset into a live generative performance
- `src/voices.js` provides the heavier custom voice builders
- `src/data.js` is the musical vocabulary and biome sound-design table
- `src/planet.js` is the preset generator
- `src/rng.js` is the deterministic randomness source

This README is written like an operating manual for the engine itself.

## Architecture + Contracts

- Architecture map: `docs/architecture.md`
- Engine API contract: `docs/engine-api-contract.md`
- Baseline + smoke harness notes: `docs/engine-baseline.md`
- Legacy `app.js` status: `docs/legacy-appjs.md`

Contributor rule: UI/controller code must use public `AudioEngine` methods and must not mutate underscored engine fields.

## Quality Gate

- Install deps: `npm install`
- Lint: `npm run lint`
- Test: `npm run test`
- Baseline metadata report: `npm run baseline:report`
- Browser smoke harness quick profile (prints live progress): `npm run smoke:engine -- http://127.0.0.1:8080/synth.html`
- Browser smoke harness full profile: `npm run smoke:engine:full`
- Smoke regression check: `npm run smoke:compare`

## 1. Instrument Overview

At runtime, the engine is not one synth. It is a small ensemble:

- a harmonic bed made of drone oscillators, an FM layer, and pads
- a melody generator that chooses notes from motif recall, response memory, or weighted scale logic
- a bass sequencer locked to the current chord root
- a full synthesized percussion section
- a granular texture layer
- ambient environmental layers
- phase-transition events and rare biome-specific macro-events
- a tension system that continuously reshapes the arrangement

Everything is routed through a common mix path:

```text
Preset/Planet Data
  -> AudioEngine.start()
    -> source layers
       -> melody
       -> drone/FM/pads
       -> bass
       -> percussion
       -> granular
       -> ambiance and events
    -> biome filter / optional biome FX
    -> reverb send
    -> delay send
    -> dry path
    -> 3-band EQ
    -> master gain
    -> limiter
    -> DC filter
    -> analyser
    -> speakers
    -> recording tap
```

The important design decision is that this is not a loop player and not a piano-roll sequencer. It is a deterministic, rule-driven realtime music engine that synthesizes nearly everything on demand.

## 2. File Map

If you want to understand the music system quickly, start here:

- `src/audio.js`
  The main engine. Signal flow, sequencing, harmony, melody, drums, tension, ambience, performance control, recording tap, debug state.

- `src/voices.js`
  Heavier custom voices. These are not simple oscillator type switches. They are self-contained synthesis structures.

- `src/data.js`
  Biome sound-design presets and musical vocabulary: scales, tunings, chord templates, progressions.

- `src/planet.js`
  Deterministic preset generation. Converts an address into a seed and then into a complete audio configuration.

- `src/rng.js`
  Seeded pseudorandom generator. This is what makes the engine musically repeatable at the decision level.

## 3. Core Mental Model

In this project, a "planet" is really a fully specified generative music preset.

Each planet contains:

- root frequency
- scale
- tuning system
- biome id
- moon count
- per-biome audio config
- seeded variations on reverb, FM, granular settings, noise level, melody density, and more
- a motif bank
- a chord progression

The renderer and UI treat that as a world. The audio engine treats it as:

- a patch
- a score vocabulary
- a timing profile
- a set of behavior probabilities
- a performance personality

That separation is important. The musical identity is not hardcoded only in `audio.js`. It is distributed across:

- preset generation in `src/planet.js`
- static biome defaults in `src/data.js`
- runtime behavior in `src/audio.js`
- voice construction in `src/voices.js`

## 4. Determinism and What It Actually Means Here

The engine is deterministic in its macro decisions, but not perfectly sample-identical.

### Deterministic layers

- address hashing in `src/planet.js`
- seeded preset generation in `generatePlanet()`
- motif-bank generation
- chord progression selection
- runtime note-selection RNG streams
- percussion decisions that use seeded step counters
- transition and macro-event triggers

### Why it is not perfectly bit-identical

Some audio materials are still built from live noise or runtime-only randomness:

- shared noise buffers
- some internal excitation/noise sources in voices
- some texture buffers
- whoosh/noise-based FX content

So the engine is best described like this:

- same address -> same musical identity and same broad behavior
- not guaranteed to be a binary-identical audio render on every run

That is a good distinction to keep in mind if you ever want true offline rendering or golden-master tests.

## 5. How a Planet Becomes Music

`src/planet.js` is the translation layer from address string to music preset.

### Step 1: hash the address

The address is converted into a seed using `hashAddress()` from `src/rng.js`.

### Step 2: read deterministic positions

Specific glyph positions determine the headline musical attributes:

- glyph 1 selects biome
- glyph 2 selects scale
- glyph 3 selects root note
- glyph 4 selects tuning/features

This is why two different addresses can feel completely different even before seeded variation is applied.

### Step 3: clone the biome config

`AUDIO_CONFIGS[biome.id]` in `src/data.js` is copied as the base audio personality.

### Step 4: apply seeded variance

The base config is then mutated with significant seeded variance:

- `noiseMul`
- `lfoMul`
- `fmIndex`
- `fmRatio`
- `reverbMul`
- `grainDensity`
- `grainPitchScatter`
- `chorusDepth`
- `chordAudibility`

That means biome is the family resemblance, while the seed makes the individual specimen.

### Step 5: build higher-level musical material

`generatePlanet()` also creates:

- extra percussion voices
- `motifBank`
- `progression`
- `melodyDensity`
- quarter-tone probability
- octave stretch

This is why two planets in the same biome still feel like different songs rather than palette swaps.

## 6. The Music Vocabulary in `src/data.js`

`src/data.js` is the engine's musical dictionary.

### 6.1 `AUDIO_CONFIGS`

Every biome entry is a performance profile. This is the single most important table for musical identity.

Below is what each field means in practice.

| Field | Meaning | Main effect in the engine |
| --- | --- | --- |
| `ambianceFeatures` | Named ambient layers to enable | Drives `_startNatureAmbiance()` |
| `chordAudibility` | How present harmonic support should be | Affects drones, pads, chord weighting, chord layers |
| `droneWave` | Base oscillator type for the drone/FM carrier flavor | Used in harmonic bed |
| `padWave` | Pad oscillator type | Used by the pad bed and climax voices |
| `reverbMul` | Multiplier applied to per-planet reverb decay | Changes convolver tail length target |
| `filterBase` | Starting point for the main filter frequency | Shapes overall darkness/brightness |
| `delayFb` | Delay feedback amount | Controls echo persistence, clamped for safety |
| `lfoMul` | Scales modulation speed | Affects slow motion in filters and pitch |
| `noiseMul` | Scales noise-layer intensity | Changes texture and atmosphere |
| `melodyOcts` | Allowed melody octave multipliers | Controls register choices |
| `melodyWaves` | Allowed melody voice names | Drives voice selection |
| `octScale` | Harmonic/pad octave scaling | Sets pad placement and harmonic spread |
| `fmRatio` | FM modulator-to-carrier ratio | Changes drone sideband structure |
| `fmIndex` | FM modulation depth | Changes harshness and motion |
| `grainDensity` | Nominal granular cloud density | Controls how busy the grain layer is |
| `grainPitchScatter` | Grain detune scatter in cents | Controls smear and shimmer |
| `grainSize` | Base grain duration in milliseconds | Controls texture size |
| `chorusWet` | Chorus send amount | Controls stereo width layer |
| `chorusDepth` | Chorus delay wobble depth | Controls chorus animation |
| `sidechainAmt` | Amount of mix ducking from kick pulses | Adds pump |
| `swing` | Delay for even grid steps | Changes groove feel |
| `velocityVar` | Randomized hit-velocity spread | Humanizes or destabilizes percussion |
| `chordProb` | Probability of extra chord notes above a melody note | Thickens melody voicing |
| `arpProb` | Probability of short arpeggio runs | Adds melodic flourish |
| `pitchBend` | Maximum vibrato/bend depth in cents | Changes pitch instability |
| `percVoices` | Extra percussion voices allowed for that biome | Expands the kit |
| `melFiltFreq` | Melody bus filter frequency | Changes melody timbre directly |
| `melFiltQ` | Melody bus resonance | Changes melody color and focus |
| `stepCount` | Number of steps in the cycle | Controls meter length |
| `melodyDensity` | Base melodic activity | Affects stride and rest behavior |

### 6.2 `SCALES`

`SCALES` is a map from scale name to pitch classes in semitones above the root.

Examples:

- diatonic modes such as Ionian, Dorian, Aeolian
- harmonic and melodic variants
- pentatonic sets
- non-Western and world-derived sets
- symmetric and avant-garde sets such as Whole Tone and Diminished

The important thing is that melody and harmony both now respect this scale material.

### 6.3 `ROOT_NOTES`

This is a bank of root frequencies spanning roughly C1 to B2.

The engine does not think in note names internally. It thinks in frequency and semitone offsets from the chosen root.

### 6.4 `TUNING_SYSTEMS`

The engine supports:

- Equal
- Just
- Pythagorean

If `Equal`, the engine uses `2^(step/12)`.

If `Just` or `Pythagorean`, it uses ratio lookups from `planet.jiRatios`.

This directly affects `_getStepFrequency()`.

### 6.5 `CHORD_TEMPLATES`

These exist as a fallback harmony vocabulary.

The current engine prefers scale-aware chord construction when scale material is available, but falls back to `CHORD_TEMPLATES` if necessary.

### 6.6 `PROGRESSIONS`

These are symbolic chord-function templates such as:

- `I V vi IV`
- `ii V I vi`
- `I IV I V`

The important detail is that the engine does not simply march through them linearly forever. It uses them as a weighted transition pool in `_updateChord()`.

## 7. RNG and Step Counters

`src/rng.js` uses:

- `hashAddress()` for address hashing
- `RNG`, a Mulberry32-style seeded generator

Inside `AudioEngine`, multiple counters produce stable substreams:

- `stepNote`
- `stepGrain`
- `stepPerc`
- `stepFX`
- `stepChord`

That is how the engine avoids a single monolithic randomness stream.

In practice, that gives you:

- stable melody choices
- stable percussion mutation paths
- stable macro-event timing tendencies
- independent motion in different subsystems

## 8. AudioEngine State Model

`AudioEngine` in `src/audio.js` is the conductor.

### Major persistent state

- `ctx`
- `masterGain`
- `reverbGain`
- `dryGain`
- `melodyBus`
- `melodyFilter`
- `transport`
- `recordDest`
- `analyser`
- `nodes`
- `intervals`
- `planet`

### User-facing performance flags

- `_granularEnabled`
- `_percussionEnabled`
- `_percVol`
- `_chordEnabled`
- `_arpEnabled`
- `_pitchBendEnabled`
- `_motifEnabled`
- `_ghostEnabled`
- `_fillsEnabled`

### Musical runtime state

- `_progression`
- `_chordIndex`
- `_currentChordIntervals`
- `_chordName`
- `_phraseLength`
- `_restProb`
- `_melodyHistory`
- `_melodyMode`
- `_lastMelodyStep`
- `_activeMotifIdx`
- `_motifSwapCounter`
- `_voiceCooldowns`
- `tension`
- `_tensionBaseValue`
- `_tensionTick`
- `_tensionSurge`
- `_tensionState`

This is important because the engine is not stateless note generation. It keeps history, phrase state, chord state, load state, and tension state at all times.

## 9. Boot Sequence and Master Signal Path

`_boot()` builds the shared audio infrastructure once.

### Built in `_boot()`

- `AudioContext`
- `AnalyserNode`
- 3-band EQ:
  - low shelf
  - mid peaking band
  - high shelf
- `masterGain`
- a hard-ish compressor used as limiter
- a 20 Hz highpass DC filter
- a `MediaStreamDestination` recording tap if supported
- a shared noise buffer
- an HRTF listener position

### Master chain

```text
eqLow -> eqMid -> eqHigh -> masterGain -> compressor -> dcFilter -> analyser -> destination
```

The recording tap is connected after the DC filter, so exports and recordings capture the final mixed output, not a dry bus.

## 10. Node Lifetime and Cleanup

This engine creates a lot of transient Web Audio nodes. `NodeRegistry` exists because without explicit retirement the browser will eventually fall apart on dense worlds.

### `NodeRegistry` responsibilities

- store active nodes in a `Set`
- organize transients into release groups
- auto-release groups after a TTL
- auto-release on `ended` when possible
- disconnect everything on stop

### Why this matters

Dense planets can generate:

- melody voices with long tails
- drum one-shots
- granular grains
- macro-event clusters
- ambience layers

Without cleanup, active node count rises until the browser cracks, clicks, or cuts out.

## 11. Transport and Meter

The current transport is unified. This is one of the major structural improvements in the engine.

### `_buildTransport()`

The transport derives:

- `bpm`
- `cycleSteps`
- `stepSeconds`
- `stepMs`
- `cycleMs`

The critical formula is:

- `stepSeconds = 15 / bpm`

That means one transport step is effectively a 16th-note grid unit.

### Why `stepCount` matters

`planet.ac.stepCount` sets the cycle length, so the same tempo can still feel radically different because the loop length itself changes:

- 16-step worlds feel familiar
- 12-step worlds feel circular or swung
- 7-step worlds feel unstable or asymmetrical
- 5/6/9/10-step worlds create their own internal phrasing pressure

### Pattern projection

If a source pattern was authored for one length and the transport cycle is another length, `_fitPatternToCycle()` projects the pattern into the target cycle rather than ignoring the meter.

That is how the engine keeps odd-meter biomes musically coherent instead of running unrelated loop lengths on top of each other.

## 12. Harmony System

The harmony system has three layers:

- symbolic progression selection
- scale-aware chord construction
- live retuning of the harmonic bed

### 12.1 Progression source

Each planet gets one progression from `PROGRESSIONS`.

### 12.2 Chord construction

`_buildScaleChord(symbol, planet)` now builds triads by stacking thirds within the active scale:

- choose the scale degree for the chord root
- stack every second scale tone
- normalize upward so chord members stay ascending

That is much better than hardcoded semitone triads when the active scale is Pelog, Hirajoshi, Whole Tone, Harmonic Minor, and so on.

### 12.3 Chord updating

`_updateChord()` does several things:

- normalizes the current chord symbol
- computes the actual chord intervals
- updates `_currentChordIntervals`
- glides drone, FM, and pad frequencies toward the new harmony
- chooses the next chord target using weighted transition rules
- schedules its own next invocation using transport-cycle multiples

### 12.4 Markov-style motion

The next chord is not simply "the next item in the array."

Instead:

- the current chord function selects a transition map
- candidate chords from the preset progression are weighted
- a seeded RNG chooses the next target from that weighted pool

This is why the harmony feels guided rather than purely cyclic.

### 12.5 Variable chord duration

Chord duration depends on:

- current chord function
- transport cycle length
- seeded variation

Tension-heavy functions can turn over faster. Resting functions can hold longer.

### 12.6 Harmonic bed retuning

Both `_updateChord()` and `_syncChordBed()` are responsible for getting the harmonic bed onto the active chord:

- sub drone root changes
- main drones retune
- FM carrier/modulator retune
- pad oscillators glide to new chord tones

Pads are not separate fixed loops. They are long-held oscillators whose frequencies are continuously moved.

## 13. Frequency Calculation and Tuning

`_getStepFrequency()` is the pitch core of the engine.

It combines:

- planet root frequency
- scale step
- octave multiplier
- tuning system
- octave stretch

### Frequency path

1. normalize the pitch class
2. compute octave shift
3. choose tuning ratio
4. apply octave multiplier
5. apply octave stretch
6. multiply by root frequency

### Quarter-tone behavior

If `quarterToneProb` is enabled on the preset, melody notes can receive an additional random detune of roughly plus/minus 50 cents.

### Octave stretch

`octaveStretch` allows octave multiplication to slightly diverge from exact powers of two.

That is subtle, but it changes the personality of the pitch field, especially in drones and wide-register harmonic material.

## 14. Melody Engine

The melody engine is the part most worth studying if you want to understand how the project actually composes.

`_scheduleNote()` is the core note-decision function.

### 14.1 Phrase grid

The melody engine tracks:

- `phrasePos = stepNote % 8`
- response-half logic via `stepNote % 16`
- phrase-end logic when the local phrase reaches its last slot

This gives the melody a repeating rhetorical shape even when actual notes change.

### 14.2 Note source priority

The melody chooses a note in this order:

1. motif recall
2. call and response from history
3. generative weighted choice from the scale

#### Motif recall

If motifs are enabled and the probability hit succeeds:

- use `planet.motifBank[_activeMotifIdx]`
- choose the motif note at the current phrase slot

#### Call and response

If enough history exists and the response probability succeeds:

- look back into the recent note history
- reuse recent material with a small variation

#### Generative mode

If neither motif nor response fires:

- walk the scale
- weight notes by tonal function
- bias for phrase position
- bias for chord membership
- bias for tension
- bias for motion from the previous note
- apply biome-specific behavior

### 14.3 Melody weighting logic

The generative pool is not flat.

It combines:

- static scale-degree weights
- phrase-structure bias
- tension bias
- chord-tone bias
- motion bias
- biome-specific bias

Examples:

- phrase ends favor resolution
- non-rest notes can be favored earlier in the phrase
- high tension can favor more unstable scale degrees
- chord tones get stronger weight when harmonic audibility is high
- fungal strongly favors smaller interval moves

### 14.4 Melody history

The engine stores the last notes in `_melodyHistory`, capped to a rolling window.

That history is used for:

- response mode
- continuity of contour
- phrase memory

### 14.5 Rest logic

Rest behavior no longer comes from a runaway fatigue counter. It is calculated continuously by `_getTargetRestProbability()`.

Inputs include:

- melody density
- cycle length
- response status
- phrase end
- current tension
- current phrase length
- biome-specific rules
- user density control

Then the engine smooths the live `_restProb` toward the target instead of snapping.

This is why melodic activity can breathe without feeling random or binary.

### 14.6 Melody stride

The melody does not necessarily attempt a note every transport step.

`_getMelodyStride()` derives an initial stride from `melodyDensity`, then runtime logic can tighten or loosen it based on:

- current tension
- drift setting
- cycle length

This creates the illusion of a performer becoming more active or restrained rather than a rigid clock firing every slot.

### 14.7 Motif rotation

Motif banks are not static forever.

At the cycle boundary:

- `_motifSwapCounter` advances
- every couple of cycles the engine rotates to the next motif bank

That gives motif recall long-form variation without abandoning identity.

## 15. Melody Voice Selection

The melody voice is not picked blindly from `melodyWaves`.

`_pickMelodyWave()` applies runtime pressure and cooldown logic.

### Inputs to wave choice

- allowed voice list for the biome
- active node count
- density pressure
- speed pressure
- total performance pressure
- per-voice cost
- per-voice cooldown

### Why that matters

Without this, dense worlds would collapse by repeatedly selecting the most expensive voices.

### Performance-aware behavior

Heavy voices such as:

- `granular_cloud`
- `drone_morph`
- `gong`
- `vowel_morph`
- `subpad`

are progressively downweighted under load.

This keeps intense planets wild, but still survivable.

## 16. Melody Voice Architecture

There are three melody-voice families:

- native oscillator types
- custom periodic-wave voices built directly in `audio.js`
- additive and special composite voices built in `src/voices.js`

### 16.1 Native oscillator voices

Supported directly by Web Audio:

- `sine`
- `square`
- `sawtooth`
- `triangle`

These are used for:

- raw simple melody tones
- fallback behavior
- some drone and pad sources

### 16.2 Resolved pseudo-types

Some names are not native oscillator types but map to a safe fallback:

- `bell`
- `brass`
- `choir`
- `electric_piano`
- `glass`
- `organ`
- `pluck`
- `pulse`
- `reed`
- `saw_sync`
- `wood`

`_resolveOscType()` makes sure invalid oscillator type names do not crash the engine.

### 16.3 Custom periodic-wave melody voices in `audio.js`

These are implemented by defining explicit harmonic spectra.

#### `bell`

- sparse, bright, long-ringing harmonic content
- fast attack
- long decay

#### `wood`

- woody struck tone
- short, percussive
- strong early partials

#### `glass`

- shimmer and inharmonic high content
- bright strike with long decay

#### `brass`

- strong odd harmonics
- more assertive attack
- useful for bold lead lines

#### `organ`

- drawbar-like harmonic recipe
- more stable sustained tone

#### `pluck`

- bright, very fast attack
- short decay
- efficient and good for rhythmic articulation

#### `pulse`

- narrow-pulse-style harmonic series
- buzzy and synthetic

#### `reed`

- odd-harmonic-biased wind/reed tone
- warm but still pointed

#### `electric_piano`

- tine-like spectrum
- faster attack than organ or choir

#### `saw_sync`

- bright, aggressive spectrum
- sync-like peak emphasis
- useful in corrupted, storm, and other intense biomes

### 16.4 Envelope behavior

The engine distinguishes:

- decay voices
- swell voices

Decay voices use an exponential-style falloff after attack.

Swell voices use a more sustained rise-and-fall contour.

On top of that:

- `_getAdditiveVoiceEnvelope()` gives voice-specific nominal times
- `_shapeMelodyEnvelope()` shortens envelopes when runtime pressure is high
- `_applyBiomeMelodyGesture()` can further localize articulation, for example fungal making tones shorter and more plant-like

### 16.5 Spatialization

Most melody notes get:

- HRTF panning
- seeded 3D position
- distance attenuation

This is why melodies feel scattered around the listener rather than hard-left/hard-right or mono.

### 16.6 Pitch bend

If enabled, melody notes can get an envelope-tied vibrato or bend:

- depth derived from `pitchBend`
- rate randomized
- fades in and out during the note

### 16.7 Melody chord layer

The melody can generate extra chord-support notes above itself:

- interval choices from a small set of musically useful offsets
- probability scaled by `chordProb`
- load-aware reduction under pressure

This makes single-note melody generation sound more harmonized without turning it into a full polyphonic sequencer.

### 16.8 Melody arpeggio layer

If enabled and selected:

- choose a short slice of the scale
- schedule a fast run
- keep it short and lightweight

This is a garnish, not the main note source.

### 16.9 Moon canons

`planet.numMoons` now has an audio meaning.

Moons are implemented as a delayed satellite-canon layer attached to the melody engine:

- each moon gets its own seeded profile
- the profile includes delay, pan position, scale-degree shift, octave tendency, detune, and filter color
- moon notes are derived from the lead note, not generated independently
- moon notes stay scale-aware and tuning-aware because they pass back through `_getStepFrequency()`

Musically, this behaves like a tiny orbital answer-voice system:

- `0` moons means no satellite response layer
- `1` moon adds a subtle delayed companion
- `2` to `4` moons widen the stereo image and create a more obvious orbiting canon

The layer is also load-aware:

- moon events are skipped when performance pressure is high
- the engine uses a separate moon bus into the melody filter so the satellites read as related to the lead voice rather than as a separate instrument

This is a good example of how the project tends to use metadata. Even a worldbuilding stat becomes meaningful once it is translated into compositional behavior.

## 17. Additive and Composite Voice Atlas (`src/voices.js`)

These are the more elaborate self-contained voices built by `buildVoice()`.

Each one creates its own internal mini-patch and generally returns early from `_scheduleNote()`.

### `strings`

- multiple harmonic partials
- detuned pairs for ensemble width
- bowed-style slow attack
- long, layered sustain

This is the closest thing to a synthetic string section in the engine.

### `choir`

- saw source through vowel-like formant filters
- several detuned voices
- subtle vibrato

This is not a sample choir. It is a formant-synthesis approximation.

### `marimba`

- inharmonic partial recipe based on struck bar behavior
- very fast attack
- rapid decay

Useful for organic, fungal, and crystalloid material.

### `metallic`

- bell or plate-like inharmonic partials
- long stereo ring
- bright and resonant

### `theremin`

- pure sine core
- glide from nearby pitch
- expressive vibrato

### `subpad`

- several sine oscillators clustered in the sub range
- very slow attack
- sits under everything else

### `crystal_chimes`

- extended high inharmonic partial set
- bright attack
- long glassy ring

### `brass_pad`

- saw ensemble into a moving lowpass contour
- swelling brass-like mass

### `hollow_pipe`

- odd-harmonic pipe tone
- breath noise component
- slightly pitch-sliding fundamental

### `gong`

- long inharmonic resonances
- very long tail
- dramatic and spacious

### `vowel_morph`

- multi-oscillator core
- moving formant filtering
- pad/lead hybrid with vocal motion

### `bowed_metal`

- physical-model-inspired waveguide or Karplus-Strong style resonator
- noisy exciter into feedback loop
- safety-limited to avoid runaway energy

### `drone_morph`

- dual oscillator core
- slow crossfade morphing
- sustained, evolving body

### `granular_cloud`

- many tiny pitched grains
- local voice-level microcloud
- load-aware grain count reduction

This is distinct from the global granular layer in `audio.js`.

## 18. Drone, FM, Pads, and Harmonic Bed

When `start()` runs, it builds the long-lived harmonic infrastructure before the note sequencers do much of anything.

### 18.1 Seeded base oscillator

The engine creates a custom `PeriodicWave` from seeded partial values.

That gives each planet a slightly different drone fingerprint even when the biome is the same.

### 18.2 Main drones

Two drone oscillators are created using the biome's `droneWave`:

- one around the root
- one above it with detune

These receive slow LFO motion.

### 18.3 FM layer

An FM modulator/carrier pair is added:

- modulator frequency derived from root times `fmRatio`
- modulation index derived from `fmIndex`
- later reshaped by tension

This is where much of the harsher or more animated harmonic life comes from.

### 18.4 Pads

The pad bed:

- fades in slowly
- starts from early scale degrees
- uses `padWave`
- includes detune spread
- later glides to active chord tones

This means pad identity is partly static tone design and partly live harmonic adaptation.

### 18.5 Noise bed

If `noiseLevel` is high enough, a filtered noise texture is added:

- volcanic tends toward rumble
- crystalline toward shimmer
- other biomes land elsewhere depending on filter mode and seed

This is a very important part of "planet identity." A lot of the world-feel is not in the notes, but in the air around them.

## 19. Granular Layer

`_startGranular()` is the global grain cloud, separate from the `granular_cloud` melody voice.

### How it works

- synthesize a two-second stereo buffer from root harmonics plus noise
- create a grain bus with fade-in
- schedule many short buffer-source grains
- randomize start position, pitch rate, pan, and envelope

### Performance control

The granular system is heavily load-aware:

- density is capped by performance profile
- active node count can cause grains to be skipped
- extra subgrains only fire when load allows

This is why dense planets can still use granular textures without immediately dying.

## 20. Chorus, Delay, Reverb, and Optional FX

### Reverb

`_buildReverb()` synthesizes a convolution impulse response:

- early reflections
- diffuse tail
- damping

It is not a static IR file. It is generated per planet.

### Delay

Each planet gets a delay with:

- feedback
- lowpass in the feedback loop
- safe feedback clamp
- reverb send from the delay

### Chorus

`_addChorus()` adds:

- three short delays
- prime-spaced times: 7 ms, 13 ms, 19 ms
- slow LFO wobble
- stereo spread

### Bitcrusher

Enabled for:

- corrupted
- storm

This is a simple sample-rate/bit-depth style degradation block.

### Phaser

Enabled for:

- psychedelic
- nebula

This uses multiple all-pass stages and an LFO sweep.

## 21. Bass Engine

The bass engine is intentionally simpler than the melody engine.

That is a feature, not a weakness.

### Bass design

- lock to transport timing
- follow a repeating pattern projected onto the active cycle length
- use the root of the current chord
- stay in a stable low register

### Why it works

The rest of the engine is already highly active:

- pads move
- melody is generative
- drums mutate
- tension and events keep changing

The bass acts as ballast.

### Bass sound

The bass is a layered low-end voice:

- triangle for body
- sine sub underneath
- simple envelope

It is deliberately direct and reliable.

## 22. Percussion Engine

The percussion system is one of the biggest subsystems in the whole project.

It is not sample playback. The drums are synthesized.

### 22.1 Drum signal path

Percussion runs through its own tone-shaping path:

- low shelf body EQ
- presence peak
- high shelf air EQ
- percussion bus gain

This gives each biome a different kit finish even before rhythm changes.

### 22.2 Drum tone profiles

`_getDrumToneProfile()` merges:

- `DEFAULT_DRUM_TONE`
- biome overrides from `BIOME_DRUM_TONES`

This changes things like:

- kick pitch
- kick decay
- kick click
- snare pitch
- snare noise/body balance
- hat brightness
- sub weight
- extra percussion tone

### 22.3 Seeded kit variation

On top of biome tone, each planet gets a seeded kit variation:

- randomized kick pitch and decay
- randomized snare pitch and decay
- randomized hat pitch and decay

So "storm drums" are a family, not a single identical kit.

### 22.4 Core drum voices

The engine synthesizes:

- kick
- snare
- hat
- sub pulse

#### Kick

- oscillator pitch sweep
- noise attack component
- optional sidechain duck

#### Snare

- noise component
- tonal body component
- fungal gets a softer specialized variant

#### Hat

Two branches exist:

- general metallic square-based highpassed hat
- fungal-specific jazzy ride-like hat made from pitched oscillators and filtering

#### Sub

- triangle sub pulse at root-related pitch

### 22.5 Extra percussion voices

Depending on biome and seed, the kit can also include:

- clave
- cowbell
- tom
- shaker
- conga
- rimshot
- bongo
- taiko
- woodblock

These are all synthesized too.

### 22.6 Base patterns

Biome-specific pattern banks define the core kick/snare/hat/sub skeletons.

Some are hand-authored arrays.
Some use Euclidean logic.
Some biomes have strongly customized overrides, especially fungal.

### 22.7 Phase-specific pattern banks

This is one of the more interesting musical systems in the engine.

`_buildPhasePatternBanks()` takes a base pattern and creates derived banks for:

- `DORMANT`
- `STIR`
- `BUILD`
- `SURGE`
- `CLIMAX`
- `FALLOUT`

This is done by `_transformPhasePattern()`, which:

- protects important anchors such as downbeats and backbeats
- drops some hits
- adds some hits
- can convert hats to open hats
- can rotate hats in some phases

The result is that the section changes are not just "same loop, louder."

### 22.8 Rhythm state

`_getRhythmState()` takes:

- current tension state
- current step
- current bar count
- biome tension profile
- seeded RNG

and produces live probabilities for:

- chaos
- ghost notes
- fill activity
- fill chance
- accents
- kick pushes
- snare pushes
- hat pushes
- open-hat chance
- extra percussion chance
- velocity lift

This is the heart of why drums evolve over time.

### 22.9 Ghosts, fills, and pushes

The sequencer can:

- add ghost hats or ghost snares on empty spaces
- push extra kick/snare/hat activity in phase-aware ways
- trigger fill behavior late in selected bars
- schedule extra micro-fills with managed timeouts

### 22.10 Swing

Swing is implemented by delaying even-numbered steps by:

- `swing * stepTime`

This means swing is still transport-locked, not free-running.

### 22.11 Polyrhythm layer

On more rhythmically complex biomes, the engine adds a separate polyrhythm line:

- uses extra percussion voices
- runs on a triplet-like timing relationship
- only appears when rhythmic energy is high enough

This is one reason fungal, crystalloid, quantum, psychedelic, and corrupted feel more structurally alive.

### 22.12 Sidechain

Kicks can call `_duck()` to momentarily dip the master gain, adding pump without running a full sidechain compressor network.

## 23. Tension System

The tension engine is what makes the arrangement evolve like a performance instead of a static generator.

### 23.1 Tension profile

Each biome has a tension profile built from:

- `DEFAULT_TENSION_PROFILE`
- biome-specific overrides in `BIOME_TENSION_PROFILES`

Parameters include:

- rise rate
- rise variance
- drain rate
- floor and reset points
- climax threshold
- pulse depth and rate
- surge chance and amount
- filter multiplier
- FM multiplier
- ghost/fill/chaos/accent biases
- kick/snare/hat/open-hat/extra biases
- fill schedule
- phase boundaries
- climax voicing and timing

### 23.2 Phase model

The engine recognizes:

- `DORMANT`
- `STIR`
- `BUILD`
- `SURGE`
- `CLIMAX`
- `FALLOUT`

`_getTensionState()` derives the current phase from:

- tension energy
- cycle position
- pulsing pocket calculation
- climax state flags

### 23.3 What tension modulates

Tension directly affects:

- main filter opening
- FM index
- melody rest probability
- melody stride tightening
- chord turnover indirectly
- rhythm-state probabilities
- transition events
- macro-event likelihood
- climax firing

### 23.4 Tension update loop

`_startTensionArc()` runs periodically and:

- applies gradual rise
- adds random drift
- adds surges
- applies pulse wave motion
- drains after climax
- updates phase state
- triggers transition events on phase changes
- fires macro-events when allowed

### 23.5 Climax

At or above the biome's climax threshold:

- `_fireClimax()` triggers
- a swelling multi-ratio chord blooms
- master gain swells
- tension later drains into fallout

The actual climax chord ratios are biome-profile dependent.

## 24. Transition Events and Macro Events

These are two different layers.

### Transition events

`_firePhaseTransitionEvent()` is called when the tension phase changes.

These are short section-change cues:

- sweeps
- noise bursts
- little chord clusters
- biome-colored punctuation

### Macro events

`_fireSignatureMacroEvent()` is rarer and more dramatic.

This is where biome families get their larger signature behaviors:

- storm barrages
- quantum stutters
- corrupted glitches
- fungal blips and spore-like clusters
- oceanic swells
- abyssal drops
- crystalline flashes

These are part of why the engine feels like an ecosystem rather than just a sequencer.

### Event building blocks

The event system uses three helper generators:

- `_spawnFxNoise()`
- `_spawnFxTone()`
- `_spawnFxCluster()`

Everything from lightning-like bursts to shimmering crystal cascades is built from those primitives.

## 25. Ambient Environment System

`_startNatureAmbiance()` creates long-lived environmental layers driven by `ambianceFeatures`.

Available features include:

- `birds`
- `rain`
- `bubbles`
- `dew`
- `thunder`
- `lightning`
- `wind`
- `rustle`
- `spores`

These are not just foley. They are part of the musical mix architecture.

### Ambient design role

Ambience is used to supply:

- long-range motion
- ecological feel
- band-limited noise beds
- transient atmospheric punctuation
- world-specific timbral glue

### Fungal as a good example

Fungal currently uses ambience especially well:

- spores with tonal puffs
- damp rustle
- dew-like droplets

That shows the intended design philosophy for these layers: they should feel like the biome is sounding, not like a background sample pack was added after the fact.

## 26. Performance Management

This engine now contains a significant amount of active self-protection.

### 26.1 Performance profile

`_getPerformanceProfile()` computes runtime pressure from:

- current node count
- tempo speed
- melody density

It exposes:

- `pressure`
- `scalar`
- `activeNodes`

This profile is then consulted by several other systems.

### 26.2 What gets scaled under pressure

- heavy melody voice selection
- heavy melody voice cooldown duration
- envelope lengths
- chord-layer probability
- arp probability
- granular density and extra grains

### 26.3 Managed timeouts

`_setManagedTimeout()` exists so one-shot timers are tracked and cleaned up instead of accumulating forever.

### 26.4 Node-lifetime budgeting

Long voices get lifetime caps.

Examples:

- `gong` is allowed a long tail, but still finite
- `crystal_chimes` can ring for a while, but not forever
- short struck voices are retired much faster

### 26.5 Safety processors

The engine also relies on:

- compressor/limiter at the master
- DC filter
- delay feedback clamp
- release-group cleanup

These are not optional niceties. Dense worlds will break without them.

## 27. Recording and Debug Hooks

The engine exposes three important runtime utilities:

- `getAnalyser()`
- `getRecordingStream()`
- `getDebugState()`

### `getRecordingStream()`

Returns the post-mix stream from the `MediaStreamDestination`.

That means any export feature built on top of it captures:

- the final mix
- after limiter
- after master filtering and sends

### `getMelodyState()`

Returns live melody state such as:

- mode
- phrase length
- rest probability
- motif status
- motif bank position
- last step

### `getDebugState()`

Returns:

- active node count
- load pressure
- tension phase
- tension energy
- cycle steps
- step duration
- BPM
- moon count
- moon proc count
- last moon burst size
- milliseconds since the last moon burst

This is extremely useful when tuning dense worlds.

## 28. Public Engine Lifecycle

### `start(planet)`

This is the main assembly method.

It:

- boots audio infra
- stops any prior run
- stores the preset
- builds the transport
- builds reverb, delay, and main filter
- attaches optional bitcrusher/phaser
- creates the drone/FM/pad/noise bed
- creates the melody bus and melody filter
- starts melody sequencing
- starts percussion
- starts bass
- starts granular texture
- adds chorus
- starts ambience
- starts the tension arc
- kicks off chord progression

### `stop()`

This:

- clears timers
- resets tension state
- disconnects all live nodes
- clears the registry
- drops buses and transport refs
- resets voice cooldowns
- marks playback as stopped

### `crossfadeTo(planet, cb)`

This is a performance-oriented transition:

- fade current master down
- stop the old run
- start the new preset
- fade the new run up

### `setVolume()` and `setReverb()`

These are smooth ramps, not hard value jumps.

## 29. Practical Tuning Guide

If you want to change the musical personality of the engine without breaking it, make the smallest edit in the right layer.

### 29.1 Change biome identity in `src/data.js`

This is the safest first stop.

Change these if you want a biome to feel different without rewriting behavior:

- `melodyWaves`
- `melodyOcts`
- `melFiltFreq`
- `melFiltQ`
- `swing`
- `velocityVar`
- `grainDensity`
- `grainPitchScatter`
- `noiseMul`
- `sidechainAmt`
- `percVoices`
- `stepCount`
- `melodyDensity`

### 29.2 Change preset individuality in `src/planet.js`

Edit here if you want more or less variation within a biome:

- motif-bank generation
- seeded variance ranges
- extra percussion assignment
- progression selection
- feature-flag derivation

### 29.3 Change synthesis behavior in `src/audio.js`

Edit here if you want to alter the instrument architecture:

- note decision rules
- rest logic
- chord logic
- bass logic
- percussion synthesis
- tension behavior
- FX or ambience generation

### 29.4 Change voice timbre in `src/voices.js`

Edit here if you like the musical rules but want the raw sound itself to change.

This is where to work on:

- partial structures
- envelope shapes
- filter banks
- feedback models
- detuning schemes
- microtexture inside a specific voice

## 30. Safe Ways to Change the Sound Without Flattening Identity

If you want more character while keeping the system varied, these are usually the safest edits:

### Good low-risk edits

- change `melFiltFreq` and `melFiltQ`
- swap voice lists per biome
- adjust `grainDensity` and `grainSize`
- tune `percVoices`
- adjust per-biome drum tone tables
- tune tension profile biases
- change motif-bank generation for one biome

### Medium-risk edits

- alter rest-probability formulas
- alter melody weighting
- change phase-pattern mutation strength
- change macro-event rates

### High-risk edits

- replacing the transport model
- flattening all tension profiles toward one default
- giving every biome the same melody voice pool
- removing performance limits on heavy voices

Those are the changes most likely to make planets feel less individual or make the engine unstable.

## 31. Known Design Tradeoffs

This engine makes some deliberate tradeoffs.

### 31.1 Bass is simpler than melody

That is intentional. It keeps the low end stable while everything else evolves.

### 31.2 The engine is layered, not unified into one abstract sequencer

Melody, drums, ambience, and events each have their own logic, but they all lock to the same transport now.

### 31.3 Not every sound is meant to be realistic

Many voices are stylized approximations:

- a synthetic choir, not a sampled choir
- a formant pad, not a vocalist
- a bowed-metal model, not a physical simulation package

That is appropriate for this project. It is a sound world, not an orchestral emulator.

### 31.4 Performance protection slightly shapes composition

Load-aware scaling means very dense worlds will compose slightly more economically under pressure than they would in a theoretical unlimited runtime. That is a reasonable compromise for browser audio.

## 32. Method Atlas

If you want a map of what each major method is for, use this section as your index.

### Engine infrastructure

- `_boot()`
  Build the shared audio context, mixer, limiter, analyser, recording tap, listener, and noise buffer.

- `_buildReverb(decay, seed)`
  Create a convolver impulse response procedurally.

- `_resolveOscType(type, fallback)`
  Convert non-native symbolic wave names into safe oscillator types.

- `_getStepFrequency(planet, step, octaveMultiplier)`
  Convert musical pitch data into frequency using root, tuning system, and octave behavior.

- `_setManagedTimeout(fn, delayMs)`
  Track one-shot timers so they do not leak.

### Data shaping

- `_getTensionProfile(planet)`
  Merge default and biome-specific tension settings.

- `_getDrumToneProfile(planet)`
  Merge default and biome-specific drum tone settings.

- `_getPhasePatternProfile(biomeId)`
  Define how each section phase mutates drum patterns.

- `_buildPhasePatternBanks(patterns, cycleSteps, seed, biomeId)`
  Generate per-phase drum banks from a base pattern.

### Transport and density

- `_buildTransport(planet)`
  Create the shared timing grid.

- `_fitPatternToCycle(pattern, targetLength)`
  Project an authored pattern into the active meter length.

- `_getMelodyStride(planet, cycleSteps)`
  Convert density into note-attempt spacing.

- `_getTargetRestProbability(planet, opts)`
  Compute the live rest target for melody.

- `_getPerformanceProfile(planet)`
  Compute node/load/speed pressure.

### Melody

- `_pickMelodyWave(planet, ac, rng)`
  Pick a melody voice with load-aware weighting.

- `_getAdditiveVoiceEnvelope(wType, rng, atk, dur)`
  Voice-specific envelope defaults for complex voices.

- `_shapeMelodyEnvelope(wType, atk, dur, planet)`
  Shorten or reshape envelopes under pressure.

- `_applyBiomeMelodyGesture(...)`
  Per-biome articulation rules. Currently especially important for fungal.

- `_markMelodyVoiceUsage(wType, planet)`
  Apply runtime cooldowns to heavy voices.

- `_scheduleNote(planet, dest, ac)`
  The main melody composition and note-synthesis function.

### Harmony

- `_normalizeChordSymbol(symbol)`
  Clean chord labels.

- `_getChordFunctionKey(symbol)`
  Reduce chord symbol to its Roman-numeral function identity.

- `_getChordDegreeIndex(symbol, scaleLength)`
  Map chord function to scale-degree index.

- `_buildScaleChord(symbol, planet)`
  Build scale-aware triads.

- `_updateChord()`
  Advance harmony, retune the bed, and schedule the next update.

- `_syncChordBed()`
  Glide long-lived harmonic oscillators to the current chord.

### Texture and FX

- `_startGranular(p, dest)`
  Start the global grain cloud.

- `_addChorus(source, dest, ac)`
  Add stereo-widening delay modulation.

- `_buildBitcrusher(bits, normFreq)`
  Create a simple degradation processor.

- `_buildPhaser()`
  Create the phaser network used on selected biomes.

- `_duck(amt, rel)`
  Simple gain-based sidechain duck.

### Rhythm

- `_euclidean(k, n)`
  Evenly distribute hits across steps.

- `_getTensionState(planet, stepIndex)`
  Convert current tension into phase/energy/pocket state.

- `_getRhythmState(planet, stepIndex, barCount, rng)`
  Convert tension and phase into drum behavior probabilities.

- `_startPercussion(p, dest)`
  Build the drum section, pattern banks, and rhythmic event logic.

### Tension and events

- `_getMacroEventChance(biomeId, state)`
  Probability of rare macro-events.

- `_getMacroEventCooldown(biomeId, phase, rng)`
  Cooldown between macro-events.

- `_spawnFxNoise(dest, opts)`
  General event-noise generator.

- `_spawnFxTone(dest, opts)`
  General event-tone generator.

- `_spawnFxCluster(dest, opts)`
  Multi-tone cluster generator.

- `_firePhaseTransitionEvent(p, dest, fromPhase, toPhase)`
  Short section-change cue.

- `_fireSignatureMacroEvent(p, dest, state)`
  Larger biome-specific event.

- `_startTensionArc(p, filt)`
  Run the tension model and its modulation.

- `_fireClimax(p, dest)`
  Trigger climax swell.

### Ambience and utility

- `_startNatureAmbiance(p, dest)`
  Start long-lived environmental layers.

- `_dopplerWhoosh()`
  Navigation whoosh or travel-like sweep.

### Lifecycle and inspection

- `start(planet)`
  Build and start the performance.

- `stop()`
  Tear it all down safely.

- `crossfadeTo(planet, cb)`
  Transition to a new preset without a hard cut.

- `getChord()`
  Return the current chord symbol.

- `getMelodyState()`
  Return melody behavior state for UI or debugging.

- `getDebugState()`
  Return runtime load and transport state.

- `getRecordingStream()`
  Return the final-mix recording stream.

## 33. Fast Reading Order for Future Work

If you come back later and want the shortest path to competence:

1. Read `src/data.js` first.
2. Read `generatePlanet()` in `src/planet.js`.
3. Read `AudioEngine.start()` in `src/audio.js`.
4. Read `_scheduleNote()`.
5. Read `_startPercussion()`.
6. Read `_startTensionArc()`.
7. Read `src/voices.js`.

That order shows:

- the static vocabulary
- how a preset is born
- how the instrument is assembled
- how melody works
- how rhythm works
- how long-form evolution works
- how the complex timbres are built

## 34. Final Summary

The Lost Codex music engine is best understood as a deterministic browser-native generative ensemble with five interacting layers:

- preset generation
- synthesis architecture
- shared transport
- evolving probabilistic composition
- runtime performance management

What makes it work is not any single oscillator or gimmick. It is the interaction between:

- scale-aware harmony
- motif and response memory
- phase-based rhythmic mutation
- biome-specific timbral design
- tension-driven long-form motion
- strict enough cleanup and load control to survive dense runs

If you preserve those relationships, you can change a lot of the sound design without losing the identity of the system.
