"""The sample pack: which plugin and preset each instrument is rendered from.

kind 'shot' = one-shot (struck, plucked), kept until it fades or `length` runs out.
kind 'loop' = sustained; a seamless loop is cut from the held note after its attack.
roots = MIDI notes rendered for that instrument; the engine pitches the nearest one.
Zones sit about an octave apart over the range the universes play each instrument in
(scripts/pitchmap.mjs measures it), so no note is pitched much more than half an octave.

source 'gyro' = rendered from 10K Audio's Gyro instead (scripts/samples/render_gyro.py):
its chord set is replaced by octaves of one note, so its generative patterns stay on the
root and the engine can tune them like any other zone.
"""

VST3 = r"C:\Program Files\Common Files\VST3"

INSTRUMENTS = {
    # Tide
    "felt":     dict(plugin="Piano V3", preset="Intimate Grand", kind="shot", roots=[48, 60, 72], length=4.0, vel=70),
    "celesta":  dict(plugin="Augmented MALLETS", preset="Celeste On Vinyl", kind="shot", roots=[72, 84, 96], length=3.0, vel=80),
    "strings":  dict(plugin="Solina V2", preset="Ambi Strings 1", kind="loop", roots=[48, 60, 72], length=3.0, vel=90),
    # Cathedral
    "pipes":    dict(plugin="Emulator II V", preset="Pipe Organ", kind="loop", roots=[36, 48, 60, 72, 84], length=3.0, vel=100),
    "choir":    dict(plugin="Augmented VOICES", preset="Ah Choir", kind="loop", roots=[48, 60, 72], length=3.0, vel=90),
    "monks":    dict(plugin="Augmented VOICES", preset="Monk Ark", kind="loop", roots=[43], length=4.0, vel=90),
    # Dub
    "tine":     dict(plugin="Stage-73 V2", preset="Stage Dark", kind="shot", roots=[48, 60], length=2.5, vel=85),
    "dubpad":   dict(plugin="Prophet-5 V", preset="Cool Down The Pad", kind="loop", roots=[48, 60, 72], length=3.0, vel=90),
    # Ice
    "glassbow": dict(plugin="Synclavier V", preset="Glass Bow", kind="loop", roots=[60, 72, 84], length=3.0, vel=90),
    "vibes":    dict(plugin="Augmented MALLETS", preset="Crystal Vibe", kind="shot", roots=[60, 72, 84], length=2.5, vel=80),
    "thunder":  dict(plugin="KORG MS-20 V", preset="Distant Thunder", kind="loop", roots=[36], length=4.0, vel=100),
    "wind":     dict(plugin="Synthi V", preset="Wind", kind="loop", roots=[60], length=4.0, vel=100),
    # Garden
    "marimba":  dict(plugin="Emulator II V", preset="Marimba", kind="shot", roots=[60, 72, 84], length=2.0, vel=90),
    "kalimba":  dict(plugin="Emulator II V", preset="Kalimba", kind="shot", roots=[60, 72, 84], length=2.0, vel=90),
    # end-blown bamboo flute; Emulator II's Shakuhachi was tried first but its notes die within a second
    "xiao":     dict(plugin="Augmented YANGTZE", preset="Xiao", kind="loop", roots=[67, 79], length=3.0, vel=90),
    # Ash
    "grit":     dict(plugin="Augmented STRINGS", preset="Let There Be Grit", kind="loop", roots=[48, 60], length=3.5, vel=100),
    "drone":    dict(plugin="Buchla Easel V", preset="Varied Shades Drone", kind="loop", roots=[36], length=4.0, vel=100),
    # Orbit
    "mflute":   dict(plugin="Mellotron V", preset="Flutes", kind="loop", roots=[60, 72], length=3.0, vel=100),
    "mstrings": dict(plugin="Mellotron V", preset="Chamber Strings", kind="loop", roots=[48, 60, 72], length=3.0, vel=100),
    # Voices
    "ooh":      dict(plugin="Augmented VOICES", preset="Double Ooh", kind="loop", roots=[60, 72], length=3.0, vel=90),
    "mchoir":   dict(plugin="Mellotron V", preset="Choirs", kind="loop", roots=[48, 60, 72], length=3.0, vel=100),
    # Neon (Night City)
    "cs80":       dict(plugin="CS-80 V4", preset="L.A. 2019", kind="loop", roots=[48, 60, 72], length=2.5, vel=90),
    "cs80lead":   dict(plugin="CS-80 V4", preset="Lead The Aftertouch", kind="loop", roots=[60, 72], length=2.5, vel=90),
    "lowhorn":    dict(plugin="Augmented BRASS", preset="Horn Surge", kind="loop", roots=[36, 48], length=2.5, vel=90),
    "cello":      dict(plugin="Augmented STRINGS", preset="Sad Day Cello", kind="loop", roots=[48, 60], length=2.5, vel=90),
    "erhu":       dict(plugin="Augmented YANGTZE", preset="Erhu Master", kind="loop", roots=[60, 72], length=2.5, vel=90),
    # the MS-20 growls (Doom Drive, Dungeon) sound a fifth or octave off their note; Hard Sink sits on it
    "ms20bass":   dict(plugin="KORG MS-20 V", preset="Hard Sink", kind="loop", roots=[36, 48], length=2.0, vel=90),
    "matrixbass": dict(plugin="Matrix-12 V2", preset="Crowling Bass", kind="loop", roots=[36, 48], length=2.0, vel=90),
    "minibass":   dict(plugin="Mini V4", preset="Chameleon Bass", kind="shot", roots=[36, 48], length=0.8, vel=90),
    # MiniFreak's hoovers are detuned by about a quarter tone; Mini V's is centred
    "hoover":     dict(plugin="Mini V4", preset="Razor Hoover", kind="loop", roots=[48, 60], length=2.0, vel=90),
    # the Jup-8 "rave stab" is a fifth chord and OP-Xa's AFX drifts in pitch; this is one steady note
    "ravestab":   dict(plugin="OP-Xa V", preset="Eclectic Keys", kind="shot", roots=[60, 72], length=1.0, vel=90),
    "vocoder":    dict(plugin="Vocoder V", preset="Faults", kind="loop", roots=[48, 60], length=2.5, vel=90),
    "obxlead":    dict(plugin="OP-Xa V", preset="Neon", kind="loop", roots=[60, 72], length=2.0, vel=90),
    "jup8pad":    dict(plugin="Jup-8 V4", preset="PWM Dreams", kind="loop", roots=[48, 60, 72], length=2.5, vel=90),
    "dx7bell":    dict(plugin="DX7 V", preset="80's FM EP", kind="shot", roots=[72, 84], length=2.0, vel=90),
    "darkbell":   dict(plugin="Augmented MALLETS", preset="Broken Life", kind="shot", roots=[72, 84], length=2.0, vel=90),
    "flute":      dict(plugin="Augmented WOODWINDS", preset="Hazy Flute", kind="loop", roots=[72, 84], length=2.0, vel=90),
    "darkchoir":  dict(plugin="Augmented VOICES", preset="Dark Side", kind="loop", roots=[48, 60], length=2.5, vel=90),
    "metal":      dict(plugin="Modular V3", preset="Crack Bell", kind="shot", roots=[72], length=1.5, vel=90),
    # Dub; no plugin has a melodica, so a harmonica stands in
    "melodica":   dict(plugin="Jup-8 V4", preset="Harmonica", kind="loop", roots=[60, 72], length=2.0, vel=90),
    "organ":      dict(plugin="B-3 V2", preset="Percussive Organ", kind="shot", roots=[48, 60, 72], length=0.6, vel=90),
    "clav":       dict(plugin="Clavinet V", preset="Default BC", kind="shot", roots=[60, 72], length=0.6, vel=90),
    "horns":      dict(plugin="Augmented BRASS", preset="Dub Trumpet", kind="shot", roots=[60, 72], length=1.0, vel=90),
    "polystab":   dict(plugin="CS-80 V4", preset="Dub Stab", kind="shot", roots=[48, 60], length=1.2, vel=90),
    "deeppad":    dict(plugin="SEM V3", preset="Monochrome", kind="loop", roots=[48, 60], length=2.5, vel=90),
    "spacevox":   dict(plugin="Augmented VOICES", preset="Choir Waves", kind="loop", roots=[60], length=2.5, vel=90),
    # Gyro's generative patterns, raw material for grain clouds
    "gyroglass": dict(source="gyro", plugin="Gyro", preset=("Magical", "Glassware"), kind="loop", roots=[60, 72], length=4.0),
    "gyrobow":   dict(source="gyro", plugin="Gyro", preset=("Soundscapes", "Bowed Glockenspiel"), kind="loop", roots=[60, 72], length=4.0),
    "gyrovox":   dict(source="gyro", plugin="Gyro", preset=("Voices", "Ooh, Aah"), kind="loop", roots=[60, 72], length=4.0),
    "gyrotape":  dict(source="gyro", plugin="Gyro", preset=("Nostalgic", "Memories (Fading)"), kind="loop", roots=[60, 72], length=4.0),
    "gyrovibe":  dict(source="gyro", plugin="Gyro", preset=("Mellow", "Floaty Vibes"), kind="loop", roots=[60, 72], length=4.0),
}
