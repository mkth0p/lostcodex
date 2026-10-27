# Lost Codex

Endless ambient radio in the browser. Turn the dial through eight universes of sound, twelve stations each. Every station (`#dub-07`) is its own piece, and it always plays the same way.

Open `index.html` through any static server and touch the dial to power on. Turning it gives static between stations; letting go settles on the nearest one after a moment and crossfades to it. Scan moves to a new station every few minutes. You can also type any code in the Station field: `ice-K7QX2M` plays in Ice, and a bare code like `K7QX2M` is given a universe by its hash. After a few seconds without input everything but the dial fades away, so it works as an installation screen.

## Universes

| Universe | Sound | Scenes |
| --- | --- | --- |
| Tide | felt piano, celesta, Solina strings and warm pads in slow overlapping loops | drift, sparse, shimmer |
| Cathedral | additive and sampled pipe organ in just intonation, choir and monks | nave, chant, reed |
| Dub | muffled kick, dark Rhodes stabs, a Prophet pad and long echoes | pulse, fog, deep |
| Ice | sub-bass under frozen noise resonances, metal, bowed glass, distant thunder and wind | glacier, crack, aurora |
| Garden | marimba and kalimba figures over a shakuhachi | grove, stream, rain |
| Ash | distorted strings, a Buchla drone and crushed piano, all in key | burn, cinder, smoke |
| Orbit | Mellotron flute and string melodies on wobbly tape, sometimes over a lazy beat | tape, beat, lull |
| Voices | ooh voices, Mellotron choir and looped choirs | hymn, loop, veil |

Each universe in `src/universes.js` sets its modes, tempo range, tuning, harmony rules, reverb and the lanes each scene is built from. Adding a universe means adding one entry there.

## How a piece is made

```
station ──hash──▶ piece (universe, key, tempo, mood numbers)
                    │
                    ├─▶ Harmony: one chord timeline, long holds, voice-led
                    └─▶ Score: overlapping scenes from the universe, minutes each
                           │  each scene is a few lanes: drones, loops,
                           │  ostinatos, phrases, pulses, beats, noise beds
                           ▼
                    Engine (AudioWorklet): voices → reverb / echo sends → limiter
```

* Every note goes through `src/core/theory.js` as a MIDI number; a test checks that nothing ever leaves the key.
* All randomness comes from named, seeded streams (`src/core/rng.js`). Rendering is sample-identical for the same station, sample rate and block size, in the browser and in Node.
* Synthesis is plain JavaScript DSP (`src/dsp`, `src/engine/voices.js`). On top of it, a 1.6 MB sample pack adds real instruments (see below). Without the pack every sampled instrument falls back to a synth voice, so the radio still plays offline or on a failed download.

## Sample pack

`samples/pack.bin` holds 21 instruments (37 multisample zones, 150 s of audio) rendered offline from VST3 plugins: Arturia Piano V3, Emulator II V, Mellotron V, Augmented Voices / Strings / Mallets, Solina V2, Stage-73 V2, Prophet-5 V, Synclavier V, MS-20 V, Synthi V and Buchla Easel V. `scripts/samples/plan.py` lists which preset each one comes from.

Each zone is trimmed, retuned to its exact root, cut as a one-shot or a seamless crossfaded loop, resampled to 22.05 kHz and stored as 4-bit IMA ADPCM. The engine decodes it itself (`src/engine/samples.js`) instead of using the browser's codecs, so the decoded samples are bit-identical everywhere and stations stay deterministic. The page fetches the pack once and the worklet keeps the decoded copy for every station after that.

Rebuilding it needs Windows, the plugins and the offline VST3 host from the MIXING toolkit:

```
python scripts/samples/render.py RAW_DIR            # renders every zone to RAW_DIR/*.npy
python scripts/samples/build_pack.py RAW_DIR [WAVS] # writes samples/pack.bin (+ WAV previews)
node scripts/layers.mjs 60                          # per-layer levels, synth-only vs sampled
```

## Files

| Path | What it does |
| --- | --- |
| `src/core/` | seeded random streams, scales, chords, harmony timeline |
| `src/universes.js` | the eight universes and their scenes |
| `src/score/` | stations and pieces, lanes, scenes, the scene chain |
| `src/dsp/` | filters, oscillators, reverb (8-line FDN), echo, limiter |
| `src/engine/` | voices, the sample pack decoder and the block renderer |
| `src/web/` | AudioWorklet wrapper, the dial, page logic, visuals for each universe |
| `fonts/` | Basteleur and Compagnon by Velvetyne (SIL Open Font License) |
| `samples/pack.bin` | the sample pack |
| `scripts/render.mjs` | offline render to WAV (`NOSAMPLES=1` for synth-only) |
| `scripts/samples/` | sample pack plan, renderer and builder |

## Working on it

```
npm install
npm test
node scripts/render.mjs dub-07 120 out.wav                # first two minutes of a station
SCENE=crack node scripts/render.mjs ice-03 90 s.wav      # one scene of that universe only
```
