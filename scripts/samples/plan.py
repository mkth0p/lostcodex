"""The sample pack: which plugin and preset each instrument is rendered from.

kind 'shot' = one-shot (struck, plucked), kept until it fades or `length` runs out.
kind 'loop' = sustained; a seamless loop is cut from the held note after its attack.
roots = MIDI notes rendered for that instrument; the engine pitches the nearest one.
"""

VST3 = r"C:\Program Files\Common Files\VST3"

INSTRUMENTS = {
    # Tide
    "felt":     dict(plugin="Piano V3", preset="Intimate Grand", kind="shot", roots=[48, 60, 72], length=4.5, vel=70),
    "celesta":  dict(plugin="Augmented MALLETS", preset="Celeste On Vinyl", kind="shot", roots=[72, 84], length=3.0, vel=80),
    "strings":  dict(plugin="Solina V2", preset="Ambi Strings 1", kind="loop", roots=[48, 60], length=3.5, vel=90),
    # Cathedral
    "pipes":    dict(plugin="Emulator II V", preset="Pipe Organ", kind="loop", roots=[36, 48, 60], length=3.0, vel=100),
    "choir":    dict(plugin="Augmented VOICES", preset="Ah Choir", kind="loop", roots=[48, 60, 72], length=3.5, vel=90),
    "monks":    dict(plugin="Augmented VOICES", preset="Monk Ark", kind="loop", roots=[43], length=4.0, vel=90),
    # Dub
    "tine":     dict(plugin="Stage-73 V2", preset="Stage Dark", kind="shot", roots=[48, 60], length=2.5, vel=85),
    "dubpad":   dict(plugin="Prophet-5 V", preset="Cool Down The Pad", kind="loop", roots=[48], length=3.5, vel=90),
    # Ice
    "glassbow": dict(plugin="Synclavier V", preset="Glass Bow", kind="loop", roots=[60, 84], length=3.5, vel=90),
    "vibes":    dict(plugin="Augmented MALLETS", preset="Crystal Vibe", kind="shot", roots=[72], length=3.5, vel=80),
    "thunder":  dict(plugin="KORG MS-20 V", preset="Distant Thunder", kind="loop", roots=[36], length=6.0, vel=100),
    "wind":     dict(plugin="Synthi V", preset="Wind", kind="loop", roots=[60], length=6.0, vel=100),
    # Garden
    "marimba":  dict(plugin="Emulator II V", preset="Marimba", kind="shot", roots=[60, 72], length=2.0, vel=90),
    "kalimba":  dict(plugin="Emulator II V", preset="Kalimba", kind="shot", roots=[72], length=2.0, vel=90),
    "shaku":    dict(plugin="Emulator II V", preset="Shakuhachi", kind="loop", roots=[67, 79], length=3.0, vel=90),
    # Ash
    "grit":     dict(plugin="Augmented STRINGS", preset="Let There Be Grit", kind="loop", roots=[48], length=5.0, vel=100),
    "drone":    dict(plugin="Buchla Easel V", preset="Varied Shades Drone", kind="loop", roots=[36], length=6.0, vel=100),
    # Orbit
    "mflute":   dict(plugin="Mellotron V", preset="Flutes", kind="loop", roots=[60, 72], length=3.0, vel=100),
    "mstrings": dict(plugin="Mellotron V", preset="Chamber Strings", kind="loop", roots=[48, 60], length=3.5, vel=100),
    # Voices
    "ooh":      dict(plugin="Augmented VOICES", preset="Double Ooh", kind="loop", roots=[60, 72], length=3.5, vel=90),
    "mchoir":   dict(plugin="Mellotron V", preset="Choirs", kind="loop", roots=[48, 60], length=3.5, vel=100),
}
