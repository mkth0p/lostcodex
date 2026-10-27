# Lost Codex

Endless ambient radio in the browser. Turn the dial through eight universes of sound, twelve stations each. Every station (`#dub-07`) is its own piece, and it always plays the same way.

Open `index.html` through any static server and touch the dial to power on. Turning it gives static between stations; letting go settles on the nearest one after a moment and crossfades to it. Scan moves to a new station every few minutes. You can also type any code in the Station field: `ice-K7QX2M` plays in Ice, and a bare code like `K7QX2M` is given a universe by its hash. After a few seconds without input everything but the dial fades away, so it works as an installation screen.

## Universes

| Universe | Sound | Scenes |
| --- | --- | --- |
| Tide | felt piano, glass and warm pads in slow overlapping loops | drift, sparse, shimmer |
| Cathedral | pipe-organ drones in just intonation | nave, chant, reed |
| Dub | muffled kick, chord stabs and long echoes | pulse, fog, deep |
| Ice | sub-bass under frozen noise resonances and metal | glacier, crack, aurora |
| Garden | marimba and kalimba figures over a breathy flute | grove, stream, rain |
| Ash | saturated, crushed textures that stay in key | burn, cinder, smoke |
| Orbit | wobbly tape melodies, sometimes over a lazy beat | tape, beat, lull |
| Voices | vocal swells and looped choirs | hymn, loop, veil |

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
* All synthesis is plain JavaScript DSP (`src/dsp`, `src/engine/voices.js`), so there are no samples to download.

## Files

| Path | What it does |
| --- | --- |
| `src/core/` | seeded random streams, scales, chords, harmony timeline |
| `src/universes.js` | the eight universes and their scenes |
| `src/score/` | stations and pieces, lanes, scenes, the scene chain |
| `src/dsp/` | filters, oscillators, reverb (8-line FDN), echo, limiter |
| `src/engine/` | voices and the block renderer |
| `src/web/` | AudioWorklet wrapper, the dial, page logic, visuals for each universe |
| `fonts/` | Basteleur and Compagnon by Velvetyne (SIL Open Font License) |
| `scripts/render.mjs` | offline render to WAV |

## Working on it

```
npm install
npm test
node scripts/render.mjs dub-07 120 out.wav                # first two minutes of a station
SCENE=crack node scripts/render.mjs ice-03 90 s.wav      # one scene of that universe only
```
