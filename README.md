# Lost Codex

Endless ambient music in the browser. Every code (`#K7QX2M`) is its own piece, and it always plays the same way.

Open `index.html` through any static server, press Listen, and leave it running. "Drift" crossfades to a new code. The controls fade away after a few seconds, so it works as an installation screen.

## How a piece is made

```
code ──hash──▶ piece (key, mode, tempo, mood numbers)
                 │
                 ├─▶ Harmony: one chord timeline, chords held 30–120 s, voice-led
                 └─▶ Score: overlapping scenes, 3–7 min each
                        drift   · Eno-style loops of piano, glass, choir, pads
                        sparse  · a few piano notes over a quiet drone
                        shimmer · glass and bowls over a high choir
                        pulse   · muffled kick, ticks and dub chord stabs
                        storm   · chord-tuned resonant noise and dark metal
                                │
                                ▼
                 Engine (AudioWorklet): voices → reverb / echo sends → limiter
```

* Every note is a scale degree turned into a MIDI number in `src/core/theory.js`; a test checks that nothing ever leaves the key.
* All randomness comes from named, seeded streams (`src/core/rng.js`). Rendering is sample-identical for the same code, sample rate and block size, in the browser and in Node.
* All synthesis is plain JavaScript DSP (`src/dsp`, `src/engine/voices.js`), so there are no samples to download.

## Files

| Path | What it does |
| --- | --- |
| `src/core/` | seeded random streams, scales, chords, harmony timeline |
| `src/score/` | piece parameters, scenes and their lanes, the scene chain |
| `src/dsp/` | filters, oscillators, reverb (8-line FDN), echo, limiter |
| `src/engine/` | voices and the block renderer |
| `src/web/` | AudioWorklet wrapper, page logic, light-field visuals |
| `scripts/render.mjs` | offline render to WAV |

## Working on it

```
npm install
npm test
node scripts/render.mjs K7QX2M 120 out.wav          # first two minutes of a piece
SCENE=storm node scripts/render.mjs K7QX2M 90 s.wav # one scene type only
```
