"""Render the Gyro instruments in plan.py (Windows only).

  python scripts/samples/render_gyro.py OUT_DIR [name ...]

Gyro plays generative patterns over a chord set. Every chord is replaced by octaves of one
note, so whatever the pattern does stays on that note and the engine can retune it to any
root. Uses gyrohost.py / gyrolib.py from the MIXING toolkit. Writes OUT_DIR/<name>_<root>.npy,
float32 stereo at 48 kHz, like render.py."""
import os
import sys

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from plan import INSTRUMENTS  # noqa: E402

TOOLKIT = os.environ.get("GYRO_TOOLKIT", r"C:\Users\jboud\Documents\MIXING\_claude_toolkit")
sys.path.insert(0, TOOLKIT)
import gyrolib as G  # noqa: E402
from gyrohost import GyroHost  # noqa: E402

BPM = 96.0
PAD = 60    # Gyro's first chord pad (white keys C3..B4 are pads 1..14)


def octave_chords(root):
    # six notes per chord, octaves only: three registers, each doubled
    notes = [root - 12, root, root + 12, root, root + 12, root + 24]
    return [(f"oct{i}", notes) for i in range(14)]


def main():
    out = os.path.abspath(sys.argv[1])
    os.makedirs(out, exist_ok=True)
    names = sys.argv[2:] or [n for n, ins in INSTRUMENTS.items() if ins.get("source") == "gyro"]
    host = GyroHost()
    for name in names:
        ins = INSTRUMENTS[name]
        cat, preset = ins["preset"]
        for root in ins["roots"]:
            j = G.with_chords(G.load_preset(cat, preset), octave_chords(root), name=f"user:{name}")
            blob = G.to_blob(j, name)
            beats = (ins["length"] + 3.0) * BPM / 60
            audio, midi = None, []
            # Gyro sometimes comes up silent right after a state change; one retry is enough
            for _ in range(2):
                host.set_state(blob)
                host.warmup(2.5, BPM)       # real time: Gyro crashes if run fast just after set_state
                audio, midi = host.render([(0.0, beats, PAD, 100)], beats, BPM, tail_beats=2.0)
                if midi and np.abs(audio).max() > 1e-3:
                    break
            np.save(os.path.join(out, f"{name}_{root}.npy"), audio.astype(np.float32))
            pk = 20 * np.log10(np.abs(audio).max() + 1e-12)
            print(f"OK {name}_{root} peak {pk:.1f} notes {sum(1 for m in midi if m[1] == 1)}", flush=True)
    os._exit(0)     # the plugin can keep the interpreter from exiting


if __name__ == "__main__":
    main()
