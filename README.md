# Lost Codex

Endless ambient radio in the browser. Turn the dial through twelve universes of sound, twelve stations each. Every station (`#dub-07`) is its own piece, and it always plays the same way.

Open `index.html` through any static server and touch the dial to power on. Turning it gives static between stations; letting go settles on the nearest one after a moment and crossfades to it. Scan moves to a new station every few minutes. You can also type any code in the Station field: `ice-K7QX2M` plays in Ice, and a bare code like `K7QX2M` is given a universe by its hash. After a few seconds without input everything but the dial fades away, so it works as an installation screen.

Each universe has its own look, like a label giving each release its own sleeve: Tide is Raster (black and white signal), Cathedral is Musica Viva (Swiss concert-poster arcs), Dub is Slice (the name cut into strips that echo), Ice is Frost (hairline fractures), Garden is Kankyō (pastel blocks after 80s environmental music sleeves), Ash is Photocopy (halftone on fluorescent paper), Orbit is Soft Signal (grained colour field under a grid), Voices is Riso (vowels overprinted in two inks), Neon is Dot Matrix (a sign on Akira red that steps on every kick, speeds up with the snare roll of a build-up and turns over in a drop, in the rain), Abyss is Bathymetry (a seabed chart whose contours ring with every sonar note), Bronze is Weave (the shared 2-bar grid as a loom: keys lay weft, bells lay warp, gongs stamp discs) and Pixel is Frozen Window (a dialog box with the format's name dragged across the screen by the kicks, leaving a copy of itself wherever it has been, like a computer that has stopped redrawing; the edits on the master slice, melt, mirror and pixelate the trail, and every drop wipes it). Every poster reacts only to the notes being played, and any choice it makes is seeded by the station.

## Universes

| Universe | Sound | Scenes |
| --- | --- | --- |
| Tide | felt piano, celesta, Solina strings and warm pads in slow overlapping loops, a cloud of Gyro glass | drift, sparse, shimmer |
| Cathedral | additive and sampled pipe organ in just intonation, choir, monks and a veil of choir grains | nave, chant, reed |
| Dub | five kinds of dub, one per station: Roots (one drop, walking bass, skank, bubble organ, melodica, siren), Steppers (a kick on every beat, sub, horns), Chords (dub techno stabs into the echo), Haze (ambient dub: voices and melodica in the echo, a soft kick), Sub (early dubstep: half-time, wobbling sub, drops) | per format |
| Ice | sub-bass under frozen noise resonances, metal, bowed glass, Gyro glockenspiel, thunder and wind | glacier, crack, aurora |
| Garden | marimba and kalimba figures over a xiao, Gyro vibes as drizzle | grove, stream, rain |
| Ash | distorted strings shredded into grains, a Buchla drone, crushed piano, all in key | burn, cinder, smoke |
| Orbit | Mellotron flute and string melodies on wobbly tape, Gyro tape memories, sometimes a lazy beat | tape, beat, lull |
| Voices | ooh voices, Mellotron choir, looped choirs and Gyro ooh/aah clouds | hymn, loop, veil |
| Neon | Night City on six radio formats, one per station: Rebel (the score: Polivoks bass, tribal toms, electric cello, always A minor), Acid (303 techno, rumbling kick, bleeps), Body (EBM: sixteenth sequencer bass, anvils), Outrun (octave bass, gated snare, saw lead), Dirge (trap: sliding 808, hat rolls, bells), Rain (Vangelis brass, no beat) | rain, build, drop, drive, break (per format) |
| Abyss | sub pressure, sonar pings, whale glides, an 808 electro kit and bass, thunder grains | trench, electro, glow |
| Bronze | saron and bonang with beating (ombak) pairs, interlocking kotekan, gongs closing each cycle, in pelog and slendro-like scales | kotekan, gong, mist |
| Pixel | hyperpop and electro after Ninajirachi on six formats: Complextro (a bass that switches patch every few notes), Bubblegum (rubber bass, latex drips, chipmunk chops), Bloghouse (fuzz bass, Atari leads, a robot voice), Trance (rolling bass, gated supersaws), Roar (half-time drops, growl, yoi and wobble basses), Hazard (drum & bass, a reese, a music box); every one a song cut up by edits on the master | rain, build, drop, drive, break (per format) |

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
* Chords move by Gyro's progression scorer: two shared notes score best and none or all are penalised, steps and fourths or fifths in the bass beat a tritone, and the top voice should hold or move by 2, 3, 5 or 7 semitones. One of the best three candidates is drawn.
* Scenes come back: now and then the next scene is one of the first few already heard (Gyro's repetition pool at the scale of the piece).

## Formats

A universe can have formats, like the stations of a city's radio. Neon has six; the numbered stations on the dial step through them in order (neon-01 is Rebel, neon-02 Acid ... neon-07 Rebel again) and any other code is given one by its hash (`formatOf` in `src/score/piece.js`). Dub has five the same way, and Pixel six (see below). A format sets its own modes, tonic, tempo, swing, harmony, room, song shape and scenes, named `<format>:<scene>`, and a palette: a few options for each role (bass, lead, pad, kit...). Two stations of the same format never share an option for a role (neon-07 takes the next option after neon-01 for every role, `paletteFor`), and each section swaps in the station's second option now and then, so a station keeps its identity and still changes over hours; the page shows the format's name and blurb and the poster's sign spells it. They follow the Cyberpunk 2077 score (the Polivoks, distortion everywhere, '90s rave, IDM and industrial, nearly everything in A minor; [Den of Geek](https://www.denofgeek.com/games/cyberpunk-2077-soundtrack-music-listen-free/), [Inverse](https://inverse.com/gaming/cyberpunk-2077-music-composers-interview), [GOG](https://gog.com/news/dirty_heavy_yet_beautiful_the_music_of_cyberpunk_2077)) and the kinds of music on its in-game stations ([PC Gamer](https://pcgamer.com/cyberpunk-2077-radio-stations-soundtrack-music)). The Polivoks voice copies what makes the real one ugly: lopsided clipping into a 12 dB filter and an overdriven VCA ([Cherry Audio](https://cherryaudio.com/news/secrets-of-atomika)).

## Song form

Most universes crossfade between scenes over minutes. Neon's beat formats (`song: {}`) play a song instead (`src/score/song.js`): a seeded plan of sections on bar lines, rain → build → drop or drive → break → build → drop, round again with different lengths. Every drop has a build before it:

* the harmony holds a tension chord (degree 6, 4 or 5) through the build and lands on the tonic at the drop;
* a snare roll speeds up from quarters to thirty-seconds while a riser climbs and a high-pass on the whole mix sweeps from 28 to 500 Hz;
* the last half bar is a gap: the dry signal is pulled out and only the reverb is left;
* the drop opens with an impact (crash, a boom kick, a sub drop and the low horn), and the end of a drop has a crash and a downlifter.

Layers within a section start on figure A of their form, so a drop always starts on its hook. The sound draws on Vangelis's Blade Runner (CS-80 brass with slow filter swells and pitch falls), Wallfisch and Zimmer's 2049 (the horn), Cyberpunk 2077's distorted synths, Akira's gamelan metals, and the usual build-up craft ([reverbmachine](https://reverbmachine.com/blog/vangelis-blade-runner-synth-sounds), [EDMProd](https://www.edmprod.com/ultimate-guide-build-ups/), [Attack Magazine](https://www.attackmagazine.com/technique/tutorials/10-snare-rolls-for-the-drop/)).

## Pixel

Pixel is hyperpop and electro after Ninajirachi: complextro, bubblegum bass, blog house, Y2K trance and dubstep-sized drops, made on a laptop, her own voice chopped and pitched up and treated as an instrument, "a build-up and a drop in every song" ([Mixmag](https://mixmag.net/feature/ninajirachi-club-kid-edm-i-love-my-computer-hyperpop-album), [Bandcamp Daily](https://daily.bandcamp.com/features/ninajirachi-i-love-my-computer-interview), [The Needle Drop](https://theneedledrop.com/album-reviews/ninajirachi-i-love-my-computer-album-review/)). Its six formats follow her influences: Porter Robinson, Wolfgang Gartner and Zedd for Complextro, SOPHIE and PC Music for Bubblegum, Justice and Crystal Castles for Bloghouse, Y2K trance, Skrillex for Roar, and the darker side of the album (Infohazard, Battery Death) for Hazard.

Everything is synthesized, so Pixel needs nothing from the sample pack. `src/score/patches.js` holds its 83 instruments, and no two formats share one:

* `MorphVoice` is one voice for every patch a complextro bass switches between: detuned saws, a pulse, a sine and an FM pair into a low-pass, a band-pass or four vowel formants (the talking "yoi"), with a beat-synced LFO (the wobble), a pitch envelope (lasers, latex drips), a wavefolder, drive and a crusher, and a side-chain pump. A Complextro or Roar station has a set of four patches and its bass figure carries the order it switches through them (`gen: 'complex'` and `gen: 'wub'` in `src/score/figure.js`, `patches` on the lane), so the switch-ups are written into the figure and come back.
* `VoxVoice` sings the vocal chops: a buzz through four soprano formants moving through a syllable's vowels, a consonant on the front, `shift` for the pitched-up chipmunk voice, tuned hard. Every station strings its own word from a dozen syllables (`wordFor`) and the `chop` generator cuts it to a syncopated rhythm, some notes stuttered (`ratchet`), some an octave up.
* `ChipVoice` is the Atari and console square: 12.5, 25 or 50% pulse or a 4-bit triangle, volume in sixteen steps, the chord as a fast arpeggio (`chordArp`).
* The pad voice runs seven detuned saws as a supersaw for stabs, gates and leads.

Harmony is a pop loop: each station picks a four-chord progression on the tonic (`loops` in the format's harmony) and cycles it through every section but the builds, a chord every one, two or four bars.

The edits are what make it sound cut up in a DAW. `Glitch` (`src/dsp/effects.js`) sits on the master before the limiter and keeps the last three seconds; the song plan gives every section its edits (`_edits` in `src/score/song.js`, drawn from the section's own stream): at the end of each four-bar phrase of a drop a beat is rolled (eighths, sixteenths, thirty-seconds), repeated, stopped like a record, reversed or cut out, and inside the phrase a beat now and then stutters or is bit-crushed; a build rolls into its gap. Edits are keyed to absolute frames, so they sound the same however the blocks fall, and the engine tells the poster when each one starts.

Codes without a universe prefix are still assigned among the first eleven universes, so a code saved before Pixel existed plays as it always did.

## Figures and the clock

Rhythmic layers are committed figures after 10K Audio's Gyro (`src/score/figure.js`). A figure is a 2-bar grid of sixteenths whose notes name a chord voice, not a pitch, so it follows the harmony without restarting when a chord changes. Generators (bass, hook, splatter, walk, arp, chord, line) are a few lines each. Hooks favour the middle of the chord; a per-layer bias makes some layers sparse, early and low, so stacked layers stratify by themselves. Each scene draws one onset grid that every figure and drum kit in it shares. A form of four figure slots (AABA, ABAB...) comes from the repetition rule, which also lets a figure answer itself inside its two bars. Velocity is an accent curve (2-bar downbeat, bar, half bar, beat, eighth) with a little seeded life.

Everything with a beat runs on one clock per piece: sixteenths counted from t = 0 at the piece's tempo, with one swing for the whole piece. Phrased melodies start on the eighth-note grid of that clock, and the echo repeats on the beat on both sides.
* All randomness comes from named, seeded streams (`src/core/rng.js`). Rendering is sample-identical for the same station, sample rate and block size, in the browser and in Node.
* Synthesis is plain JavaScript DSP (`src/dsp`, `src/engine/voices.js`). On top of it, a 2.9 MB sample pack adds real instruments (see below). Without the pack every sampled instrument falls back to a synth voice and the layers that only exist as samples are left out, so the radio still plays offline or on a failed download.

## Sample pack

Abyss, Bronze and Pixel are synthesized for now (Pixel on purpose: its sounds are all synth patches; Vital or Surge renders could add vocal chops of a real voice). The ones that would gain most from renders: Bronze's saron, bonang and gongs (Augmented Mallets), and Abyss's whale glides and sonar (Synthi V or Buchla Easel V).

`samples/pack.bin` holds 51 instruments (113 multisample zones, 344 s of audio) rendered offline from VST3 plugins: Arturia Piano V3, Emulator II V, Mellotron V, Augmented Voices / Strings / Mallets / Yangtze / Brass / Woodwinds, Solina V2, Stage-73 V2, Prophet-5 V, Synclavier V, MS-20 V, Synthi V, Buchla Easel V, CS-80 V, Matrix-12 V, Mini V, Jup-8 V, OP-Xa V, DX7 V, Vocoder V, SEM V, Modular V, B-3 V and Clavinet V, plus five generative patterns from 10K Audio's Gyro whose chord sets are replaced by octaves of one note, so they stay on the root. Neon and Dub take most of the newer ones: CS-80 brass and leads, MS-20, Matrix-12 and Mini basses, a Mini hoover, OP-Xa stabs, a vocoder, Jup-8 pads, DX7 bells, cello and erhu for Neon; a melodica stand-in, B-3 bubble organ, clavinet skank, dub trumpet, CS-80 dub stab, SEM pad and choir for Dub. `scripts/samples/plan.py` lists which preset each one comes from. Zones sit about an octave apart over the range each instrument is played in, so no note is pitched much more than half an octave.

Each zone is trimmed, retuned to its exact root, cut as a one-shot or a seamless crossfaded loop, resampled (16 kHz for dark zones, 22.05 kHz otherwise) and stored as 4-bit IMA ADPCM. The engine decodes it itself (`src/engine/samples.js`) instead of using the browser's codecs, so the decoded samples are bit-identical everywhere and stations stay deterministic. The page fetches and decodes the pack once, and the worklet keeps the decoded copy for every station after that.

Samples are raw material, never playback: the score still picks every note, and `GrainVoice` rebuilds textures (thunder, wind, drones, choirs, the Gyro patterns) as clouds of seeded grains, so nothing repeats however long a station plays.

Rebuilding it needs Windows, the plugins, Gyro, and the offline VST3 host and Gyro host (`gyrohost.py`, `gyrolib.py`) from the MIXING toolkit:

```
python scripts/samples/render.py RAW_DIR            # renders the plugin zones to RAW_DIR/*.npy
python scripts/samples/render_gyro.py RAW_DIR       # renders the Gyro zones
python scripts/samples/build_pack.py RAW_DIR [WAVS] # writes samples/pack.bin (+ WAV previews); refuses if a zone is missing
node scripts/pitchmap.mjs                           # how far each sample is pitched from its zone
node scripts/layers.mjs 60                          # per-layer levels, synth-only vs sampled
node scripts/limits.mjs 120 lite                    # limiter use and voice steals, synth-only vs sampled
```

## Files

| Path | What it does |
| --- | --- |
| `src/core/` | seeded random streams, scales, chords, harmony timeline |
| `src/universes.js` | the twelve universes and their scenes |
| `src/score/` | stations and pieces, lanes, Gyro figures and drum kits, scenes, the scene chain, the song form |
| `src/dsp/` | filters, oscillators, reverb (8-line FDN), echo, limiter |
| `src/engine/` | voices, the sample pack decoder and the block renderer |
| `src/web/` | AudioWorklet wrapper, the dial, page logic, and the poster canvas |
| `src/web/looks.js` | one look per universe: page colours and a poster drawn from the notes |
| `fonts/` | Basteleur and Compagnon by Velvetyne (SIL Open Font License) |
| `samples/pack.bin` | the sample pack |
| `scripts/render.mjs` | offline render to WAV (`NOSAMPLES=1` for synth-only) |
| `scripts/samples/` | sample pack plan, renderers and builder |
| `scripts/pitchmap.mjs`, `layers.mjs`, `limits.mjs` | checks for the sampled layers: pitch shifts, levels, limiter and voice use |

## Working on it

```
npm install
npm test
node scripts/render.mjs dub-07 120 out.wav                # first two minutes of a station
SCENE=crack node scripts/render.mjs ice-03 90 s.wav      # one scene of that universe only
```
