"""Turn the renders into samples/pack.bin.

  python scripts/samples/build_pack.py RAW_DIR [PREVIEW_DIR]

Per zone: mono, trimmed to the onset, retuned to the exact root, cut to length (one-shots fade out,
loops get a crossfaded loop), resampled to 22.05 kHz and coded as 4-bit IMA ADPCM.

pack.bin = "LCS1" | u32 manifest length | manifest JSON | ADPCM bytes.
The engine decodes the ADPCM itself (src/engine/samples.js), so every browser and Node get the
same samples, bit for bit."""
import json
import os
import struct
import sys
import wave

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from plan import INSTRUMENTS  # noqa: E402

SRC_SR = 48000
SR = 22050
OUT = os.path.join(HERE, "..", "..", "samples", "pack.bin")

STEPS = [7, 8, 9, 10, 11, 12, 13, 14, 16, 17, 19, 21, 23, 25, 28, 31, 34, 37, 41, 45, 50, 55, 60, 66, 73, 80, 88,
         97, 107, 118, 130, 143, 157, 173, 190, 209, 230, 253, 279, 307, 337, 371, 408, 449, 494, 544, 598, 658,
         724, 796, 876, 963, 1060, 1166, 1282, 1411, 1552, 1707, 1878, 2066, 2272, 2499, 2749, 3024, 3327, 3660,
         4026, 4428, 4871, 5358, 5894, 6484, 7132, 7845, 8630, 9493, 10442, 11487, 12635, 13899, 15289, 16818,
         18500, 20350, 22385, 24623, 27086, 29794, 32767]
INDEX = [-1, -1, -1, -1, 2, 4, 6, 8]


def adpcm_encode(x):
    """int16 array -> bytes, two samples per byte (low nibble first). Starts at predictor 0, index 0."""
    pred, idx = 0, 0
    nib = np.zeros(len(x) + (len(x) & 1), np.uint8)
    for i, s in enumerate(x.tolist()):
        step = STEPS[idx]
        diff = s - pred
        code = 0
        if diff < 0:
            code = 8
            diff = -diff
        delta = step >> 3
        if diff >= step:
            code |= 4
            diff -= step
            delta += step
        if diff >= step >> 1:
            code |= 2
            diff -= step >> 1
            delta += step >> 1
        if diff >= step >> 2:
            code |= 1
            delta += step >> 2
        pred = pred - delta if code & 8 else pred + delta
        pred = max(-32768, min(32767, pred))
        idx = max(0, min(88, idx + INDEX[code & 7]))
        nib[i] = code
    return (nib[0::2] | (nib[1::2] << 4)).astype(np.uint8).tobytes()


def adpcm_decode(data, n):
    """Reference decoder, the same arithmetic as src/engine/samples.js."""
    out = np.zeros(n, np.int16)
    pred, idx = 0, 0
    for i in range(n):
        code = (data[i >> 1] >> (4 * (i & 1))) & 15
        step = STEPS[idx]
        delta = step >> 3
        if code & 4:
            delta += step
        if code & 2:
            delta += step >> 1
        if code & 1:
            delta += step >> 2
        pred = pred - delta if code & 8 else pred + delta
        pred = max(-32768, min(32767, pred))
        idx = max(0, min(88, idx + INDEX[code & 7]))
        out[i] = pred
    return out


def resample(x, ratio):
    """Band-limited resample by FFT (fine for clips a few seconds long)."""
    n = len(x)
    m = int(round(n * ratio))
    X = np.fft.rfft(x)
    keep = min(len(X), m // 2 + 1)
    Y = np.zeros(m // 2 + 1, complex)
    Y[:keep] = X[:keep]
    # gentle roll-off over the top 8% so the cut does not ring
    taper = max(1, keep // 12)
    Y[keep - taper:keep] *= np.linspace(1, 0, taper)
    return np.fft.irfft(Y, m) * (m / n)


def measure_cents(x, root):
    """Deviation (cents, within +-50) of the strongest partial that sits on the root's pitch class."""
    seg = x[: min(len(x), SRC_SR * 2)]
    win = seg * np.hanning(len(seg))
    nfft = 1 << 19
    X = np.abs(np.fft.rfft(win, nfft))
    freqs = np.fft.rfftfreq(nfft, 1 / SRC_SR)
    best = None
    for k in range(-2, 4):
        f = 440 * 2 ** ((root - 69) / 12) * 2 ** k
        if f < 40 or f > 9000:
            continue
        band = (freqs > f * 2 ** (-0.6 / 12)) & (freqs < f * 2 ** (0.6 / 12))
        i = np.argmax(np.where(band, X, 0))
        if best is None or X[i] > best[0]:
            best = (X[i], 1200 * np.log2(freqs[i] / f))
    # how much of the spectrum is on the root's pitch class at all (a wrongly pitched preset scores low)
    return float(best[1])


def onset(x):
    env = np.abs(x)
    thr = env.max() * 0.02
    i = int(np.argmax(env > thr))
    return max(0, i - int(0.002 * SRC_SR))


def to_mono(a):
    m = a.mean(axis=1)
    side_heavy = np.sqrt((m ** 2).mean()) < 0.5 * np.sqrt((a[:, 0] ** 2).mean())
    return a[:, 0] if side_heavy else m


def build_zone(a, ins, root):
    x = to_mono(a.astype(np.float64))
    x = x[onset(x):]
    cents = measure_cents(x, root)
    # retune and downsample in one go
    x = resample(x, SR / SRC_SR * 2 ** (cents / 1200))
    n = int(ins["length"] * SR)
    zone = {"root": root, "cents": round(cents, 1)}
    if ins["kind"] == "shot":
        x = x[:n]
        fade = int(min(0.4, ins["length"] * 0.25) * SR)
        x[-fade:] *= np.cos(np.linspace(0, np.pi / 2, fade)) ** 2
    else:
        # loop from after the attack to the end, with an equal-power crossfade into the loop start
        env = np.convolve(np.abs(x), np.ones(1024) / 1024, "same")
        start = int(np.argmax(env > env[: n + SR].max() * 0.7)) + int(0.15 * SR)
        start = min(start, int(1.2 * SR))
        xf = int(0.35 * SR)
        start = max(start, xf)
        end = start + n
        x = x[: end + 1].copy()
        # level out slow swells and decays inside the loop, so it does not pulse on every pass
        a = start - xf
        w = int(0.25 * SR)
        rms = np.sqrt(np.convolve(x[a:end] ** 2, np.ones(w) / w, "same") + 1e-12)
        gain = (rms.mean() / rms) ** 0.85
        gain = np.convolve(np.pad(gain, w, mode="edge"), np.ones(w) / w, "same")[w:-w]
        ramp = min(len(gain), int(0.3 * SR))
        gain[:ramp] = 1 + (gain[:ramp] - 1) * np.linspace(0, 1, ramp)
        x[a:end] *= gain
        x[end:] *= gain[-1]
        t = np.linspace(0, np.pi / 2, xf)
        x[end - xf:end] = x[end - xf:end] * np.cos(t) + x[start - xf:start] * np.sin(t)
        x = x[:end]
        zone["loopStart"] = start
    return x, zone


def main():
    raw = sys.argv[1]
    preview = sys.argv[2] if len(sys.argv) > 2 else None
    manifest = {"sampleRate": SR, "instruments": {}}
    blobs = []
    offset = 0
    report = []
    for name, ins in INSTRUMENTS.items():
        zones = []
        clips = []
        for root in ins["roots"]:
            path = os.path.join(raw, f"{name}_{root}.npy")
            if not os.path.exists(path):
                print("missing", path)
                continue
            x, zone = build_zone(np.load(path), ins, root)
            clips.append(x)
            zones.append(zone)
        if not zones:
            continue
        # one gain per instrument so its zones stay matched; loudness kept so lanes can balance
        peak = max(np.abs(c).max() for c in clips)
        g = 0.89 / peak
        rms = float(np.sqrt(np.mean(np.concatenate(clips) ** 2)) * g)
        for x, zone in zip(clips, zones):
            q = np.clip(np.round(x * g * 32767), -32768, 32767).astype(np.int16)
            data = adpcm_encode(q)
            zone.update(offset=offset, length=len(q))
            offset += len(data)
            blobs.append(data)
            if preview:
                os.makedirs(preview, exist_ok=True)
                d = adpcm_decode(np.frombuffer(data, np.uint8), len(q))
                body = d if "loopStart" not in zone else np.concatenate([d, d[zone["loopStart"]:], d[zone["loopStart"]:]])
                with wave.open(os.path.join(preview, f"{name}_{zone['root']}.wav"), "wb") as w:
                    w.setnchannels(1)
                    w.setsampwidth(2)
                    w.setframerate(SR)
                    w.writeframes(body.tobytes())
        manifest["instruments"][name] = {"kind": ins["kind"], "rms": round(rms, 4), "zones": zones}
        report.append(f"{name:9s} {ins['kind']:4s} rms {20 * np.log10(rms):6.1f} dB  cents "
                      + " ".join(f"{z['root']}:{z['cents']:+.0f}" for z in zones))
    head = json.dumps(manifest, separators=(",", ":")).encode()
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "wb") as f:
        f.write(b"LCS1" + struct.pack("<I", len(head)) + head)
        for b in blobs:
            f.write(b)
    print("\n".join(report))
    print(f"pack {os.path.getsize(OUT) / 1024:.0f} KiB, {offset * 2 / SR:.0f} s of audio")


if __name__ == "__main__":
    main()
