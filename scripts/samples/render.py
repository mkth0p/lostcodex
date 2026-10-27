"""Render every instrument in plan.py with the local VST3 plugins (Windows only).

  python scripts/samples/render.py OUT_DIR [name ...]

Uses the offline VST3 host from the MIXING toolkit (arturia_render.py: plugin in a worker thread,
Win32 message pump on the main one). Writes OUT_DIR/<name>_<root>.npy, float32 stereo at 48 kHz."""
import json
import os
import re
import sqlite3
import subprocess
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from plan import INSTRUMENTS, VST3  # noqa: E402

TOOLKIT = os.environ.get("TOOLKIT", r"C:\Users\jboud\Documents\MIXING\_claude_toolkit\messenoire")
DB = r"C:\ProgramData\Arturia\Presets\db.db3"
BPM = 60      # one beat = one second


def preset_path(plugin, name):
    con = sqlite3.connect(f"file:{DB}?mode=ro", uri=True)
    rows = [r[0] for r in con.execute("select file_path from Preset_Id where name=?", (name,))]
    stem = re.sub(r"\s+V\d*$", "", plugin).lower()
    rows = [r for r in rows if stem in r.replace("\\", "/").lower()]
    # the DB also lists presets of older versions; prefer the folder named like the plugin
    rows.sort(key=lambda r: (plugin.lower() not in r.lower(), len(r)))
    if not rows:
        raise SystemExit(f"no preset {name!r} for {plugin}")
    return rows[0]


def jobs_for(names, out):
    jobs = []
    for name in names:
        ins = INSTRUMENTS[name]
        plugin = os.path.join(VST3, ins["plugin"] + ".vst3")
        preset = preset_path(ins["plugin"], ins["preset"])
        # one-shots: a short press, then room to ring; loops: hold well past the loop we cut
        hold = 1.0 if ins["kind"] == "shot" else ins["length"] + 3.0
        for root in ins["roots"]:
            jobs.append(dict(plugin=plugin, preset=preset, notes=[[0.0, hold, root, ins["vel"]]], bpm=BPM,
                             beats=hold + 0.5, tail=ins["length"] + 1.5, settle=4.0,
                             out=os.path.join(out, f"{name}_{root}.npy")))
    # group by plugin so each one is loaded once
    jobs.sort(key=lambda j: j["plugin"])
    return jobs


def main():
    out = os.path.abspath(sys.argv[1])
    names = sys.argv[2:] or list(INSTRUMENTS)
    os.makedirs(out, exist_ok=True)
    path = os.path.join(out, "jobs.json")
    jobs = jobs_for(names, out)
    json.dump(jobs, open(path, "w", encoding="utf-8"), indent=1)
    for j in jobs:
        if os.path.exists(j["out"]):
            os.remove(j["out"])
    # some plugins hang the host on exit, so stop it ourselves once the last file is written
    proc = subprocess.Popen([sys.executable, "-u", os.path.join(TOOLKIT, "arturia_render.py"), path])
    deadline = time.time() + 60 * len(jobs)
    while proc.poll() is None and time.time() < deadline:
        if all(os.path.exists(j["out"]) for j in jobs):
            time.sleep(2)
            break
        time.sleep(1)
    if proc.poll() is None:
        proc.kill()
    missing = [os.path.basename(j["out"]) for j in jobs if not os.path.exists(j["out"])]
    print("missing:", missing or "none")


if __name__ == "__main__":
    main()
