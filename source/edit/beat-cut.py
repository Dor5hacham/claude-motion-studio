# Copyright (c) 2026 Dor5hacham d5shacham@gmail.com. All rights reserved.
# SPDX-License-Identifier: Proprietary

# beat-cut.py - Beat-synced auto edit: the cuts come from beats detected in the audio.
#
# 1. A 9 s drum-and-bass loop at 120 BPM is synthesized with NumPy (kick on
#    every beat, claps, hats, crash on each bar, bass and pad, a snare fill at
#    the end) and written as a WAV.
# 2. The script then forgets the pattern and listens: a short-time Fourier
#    transform gives three band-limited onset curves (spectral flux): low
#    (kick), mid (snare) and high (crash). Peaks in the low band are the beats;
#    beats with a crash on them are downbeats; snare hits between beats are the
#    fill. The tempo is the median beat interval.
# 3. The edit cuts to the next clip on every detected hit. Downbeats get a white
#    flash and a big zoom punch, other beats a small punch, and the fill cuts
#    fast. A strip at the bottom shows the onset curve, the detected hits and
#    the playhead.
#
# How it works: one ffmpeg decode per shot (0.6 s each), NumPy and Pillow for
# the punches, flash and strip, then ffmpeg encodes H.264 and muxes the WAV as AAC.
#
# Run from this folder (source/edit) in Git Bash:
#   uv run --with numpy --with pillow beat-cut.py
# Output: ../../media/edit/beat-cut.mp4
# Temp:   ../../_work/beat-cut/ (the WAV, deleted at the end)

import os
import shutil
import subprocess
import wave

import numpy as np
from PIL import Image, ImageDraw, ImageFont

OUT = "../../media/edit/beat-cut.mp4"
TMP = "../../_work/beat-cut"
SR, BPM, DUR = 44100, 120, 9.0
W, H, FPS = 1280, 720, 30
os.makedirs(TMP, exist_ok=True)
WAV = f"{TMP}/track.wav"

# ---------------------------------------------------------------- 1. synthesize
rng = np.random.default_rng(4)
n = int(SR * DUR)
mix = np.zeros((n, 2), np.float32)
beat = 60 / BPM


def add(sig, t, gain=1.0, pan=0.0):
    i = int(t * SR)
    j = min(n, i + len(sig))
    if i < n:
        mix[i:j, 0] += sig[:j - i] * gain * (1 - max(pan, 0))
        mix[i:j, 1] += sig[:j - i] * gain * (1 + min(pan, 0))


def env(dur, k):
    tt = np.arange(int(dur * SR)) / SR
    return tt, np.exp(-tt * k)


def kick():
    tt, e = env(0.45, 9)
    f = 45 + 110 * np.exp(-tt * 30)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * e + 0.3 * np.exp(-tt * 300) * rng.standard_normal(len(tt))


def onepole(x, a):
    y = np.zeros_like(x)
    acc = 0.0
    for i, v in enumerate(x):
        acc += a * (v - acc)
        y[i] = acc
    return y


def snare():
    tt, e = env(0.25, 22)
    nz = rng.standard_normal(len(tt))
    body = onepole(nz - onepole(nz, 0.08), 0.43)       # band-pass, about 0.5 to 4 kHz
    return (1.0 * body + 0.5 * np.sin(2 * np.pi * 190 * tt)) * e


def hat():
    tt, e = env(0.06, 70)
    nz = rng.standard_normal(len(tt))
    nz = nz - onepole(nz, 0.5)
    return (nz - onepole(nz, 0.5)) * e                 # two high-pass stages, above 5 kHz


def crash():
    tt, e = env(1.6, 2.6)
    nz = rng.standard_normal(len(tt))
    return (nz - onepole(nz, 0.35)) * e


def tone(freq, dur, kind="saw", k=3.0):
    tt, e = env(dur, k)
    ph = (freq * tt) % 1.0
    w = 2 * ph - 1 if kind == "saw" else np.sin(2 * np.pi * freq * tt)
    return w * e * np.minimum(1, tt * 200)


K, S, HT, C = kick(), snare(), hat(), crash()
ROOTS = [55.0, 43.65, 65.41, 49.0]                    # A, F, C, G (bass)
CHORDS = [[220, 261.6, 329.6], [174.6, 220, 261.6], [261.6, 329.6, 392], [196, 246.9, 293.7]]
for bar in range(4):
    t0 = bar * 4 * beat
    add(C, t0, 0.22, 0.3)
    pad = sum(onepole(tone(f, 4 * beat, "saw", 0.6), 0.04) for f in CHORDS[bar])
    add(pad, t0, 0.10, -0.2)
    for b in range(4):
        tb = t0 + b * beat
        add(K, tb, 0.9)
        if b in (1, 3) and not (bar == 3 and b == 3):
            add(S, tb, 0.5, 0.1)
        add(tone(ROOTS[bar] * (2 if b % 2 else 1), beat, "saw", 5), tb, 0.16)
        for e8 in range(2):
            add(HT, tb + e8 * beat / 2 + beat / 4, 0.18, -0.4)
# Snare fill in sixteenths over the last beat and a half of bar 4.
for k in range(6):
    add(S, 3 * 4 * beat + 2.5 * beat + k * beat / 4, 0.55 + 0.05 * k, 0.1)
add(K, 16 * beat, 1.0)
add(C, 16 * beat, 0.32, 0.3)
add(tone(ROOTS[0], 1.0, "saw", 3), 16 * beat, 0.2)
mix = np.tanh(mix * 1.4) * 0.85
with wave.open(WAV, "wb") as wf:
    wf.setnchannels(2)
    wf.setsampwidth(2)
    wf.setframerate(SR)
    wf.writeframes((mix * 32767).astype("<i2").tobytes())

# ---------------------------------------------------------------- 2. listen
mono = mix.mean(1)
HOP, NFFT = 512, 2048
win = np.hanning(NFFT).astype(np.float32)
# Silence in front, so a hit at t = 0 still rises from nothing.
pad = np.concatenate([np.zeros(NFFT // 2 + NFFT, np.float32), mono, np.zeros(NFFT, np.float32)])
idx = np.arange(0, len(mono) + NFFT, HOP)
spec = np.abs(np.fft.rfft(np.stack([pad[i:i + NFFT] * win for i in idx]), axis=1))
freqs = np.fft.rfftfreq(NFFT, 1 / SR)
ftime = idx / SR - NFFT / SR


def flux(lo, hi):
    b = np.log1p(100 * spec[:, (freqs >= lo) & (freqs < hi)])
    d = np.maximum(np.diff(b, axis=0, prepend=b[:1]), 0).sum(1)
    return d / np.percentile(d, 99)


def peaks(curve, thr, gap):
    out = []
    for i in range(len(curve) - 3):
        if curve[i] > thr and curve[i] == curve[max(0, i - 3):i + 4].max():
            if not out or ftime[i] - ftime[out[-1]] > gap:
                out.append(i)
    return out


low, mid, high = flux(20, 150), flux(150, 2500), flux(5000, 16000)
kicks = peaks(low, 0.3, 0.2)
snares = [i for i in peaks(mid, 0.42, 0.08) if min(abs(ftime[i] - ftime[k]) for k in kicks) > 0.06]
# A crash rings on, while a snare or hat dies in under 0.1 s: take the 10th
# percentile of the high-band energy 0.15 to 0.35 s after each beat, so even a
# fast snare roll (which dips between hits) does not count as a crash.
hi_e = spec[:, freqs >= 5000].sum(1)
ring = np.array([np.percentile(hi_e[k + 13:k + 30], 10) for k in kicks])
down = [k for k, r in zip(kicks, ring) if r > 2.5 * np.median(ring)]
tempo = 60 / np.median(np.diff(ftime[kicks]))
print("beats", np.round(ftime[kicks], 2), "ring", np.round(ring / np.median(ring), 1))
print("downbeats", np.round(ftime[down], 2), "fill", np.round(ftime[snares], 2))
print(f"detected {len(kicks)} beats, {len(down)} downbeats, {len(snares)} fill hits, {tempo:.1f} BPM")
cuts = sorted([(ftime[i], "down" if i in down else "beat") for i in kicks] +
              [(ftime[i], "fill") for i in snares])
onset = np.maximum(low, mid * 0.8)

# ---------------------------------------------------------------- 3. edit
SHOTS = [("engine/shatter.mp4", 1.2), ("engine/liquid.mp4", 0.4), ("engine/smoke-fire.mp4", 1.8),
         ("engine/unreal-niagara.mp4", 1.0), ("engine/softbody.mp4", 0.3), ("tools/webgpu.mp4", 3.0),
         ("engine/particles-fur.mp4", 0.25), ("tools/threejs.mp4", 2.0), ("engine/cloth.mp4", 0.8),
         ("engine/geometry-nodes.mp4", 2.0), ("tools/taichi-mpm.mp4", 1.3), ("engine/ocean.mp4", 1.0),
         ("engine/grease-pencil.mp4", 2.4), ("engine/cycles-photoreal.mp4", 1.5),
         ("engine/smoke-fire.mp4", 3.2), ("engine/shatter.mp4", 1.9), ("tools/webgpu.mp4", 5.0),
         ("engine/liquid.mp4", 2.5), ("engine/unreal-niagara.mp4", 3.0), ("engine/softbody.mp4", 1.0),
         ("engine/grease-pencil.mp4", 3.6), ("tools/threejs.mp4", 4.5)]
FINAL = ("engine/3d-logo.mp4", 0.9)


def decode(path, start, dur):
    r = subprocess.run(["ffmpeg", "-nostdin", "-v", "error", "-ss", str(start), "-t", str(dur),
                        "-i", "../../media/" + path, "-vf", "fps=30,scale=1280:720",
                        "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], capture_output=True, check=True)
    return np.frombuffer(r.stdout, np.uint8).reshape(-1, H, W, 3)


segs = []                      # (cut time, kind, frames)
for k, (t, kind) in enumerate(cuts):
    nxt = cuts[k + 1][0] if k + 1 < len(cuts) else DUR
    path, st = SHOTS[k % len(SHOTS)] if k < len(cuts) - 1 else FINAL
    segs.append((t, kind, decode(path, st, nxt - t + 0.1), path))
print("shots", len(segs))


def zoom(img, z):
    if z < 1.002:
        return img
    cw, ch = W / z, H / z
    x0, y0 = (W - cw) / 2, (H - ch) / 2
    return np.asarray(Image.fromarray(img).resize((W, H), Image.Resampling.BILINEAR,
                                                  box=(x0, y0, x0 + cw, y0 + ch)))


BOLD = ImageFont.truetype("C:/Windows/Fonts/bahnschrift.ttf", 34)
SMALL = ImageFont.truetype("C:/Windows/Fonts/bahnschrift.ttf", 20)
MONO = ImageFont.truetype("C:/Windows/Fonts/consola.ttf", 16)
CREAM = (244, 239, 230)
KCOL = {"down": (255, 90, 54), "beat": CREAM, "fill": (43, 196, 230)}
SX, SY, SW, SH = 40, H - 92, W - 80, 56
cols = np.linspace(0, len(onset) - 1, SW).astype(int)
curve = np.minimum(np.array([onset[max(0, c - 2):c + 3].max() for c in cols]), 1.0)

enc = subprocess.Popen([
    "ffmpeg", "-nostdin", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24",
    "-s", f"{W}x{H}", "-framerate", str(FPS), "-i", "-", "-i", WAV,
    "-c:v", "libx264", "-crf", "20", "-preset", "slow", "-pix_fmt", "yuv420p",
    "-c:a", "aac", "-b:a", "160k", "-shortest", "-movflags", "+faststart", "-threads", "8", OUT],
    stdin=subprocess.PIPE)
assert enc.stdin is not None
enc_in = enc.stdin

NF = int(DUR * FPS)
for f in range(NF):
    t = f / FPS
    k = max([i for i, s in enumerate(segs) if s[0] <= t + 1e-6] or [0])
    t0, kind, frames, path = segs[k]
    dt = max(0.0, t - t0)
    img = frames[min(int(dt * FPS), len(frames) - 1)]
    amp = {"down": 0.13, "beat": 0.05, "fill": 0.07}[kind]
    img = zoom(img, 1 + amp * np.exp(-dt * 10))
    if kind == "down":
        fl = 0.85 * np.exp(-dt * 13)
        img = (img.astype(np.float32) * (1 - fl) + 255 * fl).astype(np.uint8)
    im = Image.fromarray(np.ascontiguousarray(img))
    dr = ImageDraw.Draw(im, "RGBA")
    last = k == len(segs) - 1
    if last:
        a = min(1.0, dt / 0.15)
        dr.rectangle((0, 0, W, H), fill=(11, 11, 16, int(90 * a)))
        s = 1 + 0.25 * np.exp(-dt * 12)
        font = ImageFont.truetype("C:/Windows/Fonts/bahnschrift.ttf", int(110 * s))
        dr.text((W / 2, 190), "ON THE BEAT", font=font, fill=CREAM + (int(255 * a),), anchor="mm")
        dr.text((W / 2, 270), f"{len(kicks)} beats, {len(down)} downbeats, {len(snares)} fill hits, "
                f"{tempo:.0f} BPM, all found in the audio", font=SMALL, fill=(200, 198, 210, int(255 * a)), anchor="mm")
    else:
        dr.rounded_rectangle((24, 22, 470, 112), 10, fill=(11, 11, 16, 170))
        dr.rectangle((36, 36, 41, 96), fill=(255, 90, 54))
        dr.text((54, 30), "BEAT-SYNCED EDIT", font=BOLD, fill=CREAM)
        name = path.split("/")[-1].replace(".mp4", "")
        dr.text((56, 74), f"cut {k + 1:02d}  {kind:<5} {name}", font=MONO, fill=KCOL[kind])
    # Onset strip: curve, detected hits, playhead.
    dr.rounded_rectangle((SX - 14, SY - 26, SX + SW + 14, SY + SH + 12), 10, fill=(11, 11, 16, 185))
    dr.text((SX, SY - 22), "onset strength (spectral flux)", font=MONO, fill=(170, 168, 185))
    dr.text((SX + SW, SY - 22), f"{tempo:.0f} BPM detected", font=MONO, fill=(170, 168, 185), anchor="ra")
    pts = [(SX + i, SY + SH - v * SH) for i, v in enumerate(curve)]
    dr.line(pts, fill=(120, 118, 140), width=1)
    for ct, ck in cuts:
        x = SX + ct / DUR * SW
        hit = abs(t - ct) < 0.12
        hgt = SH if ck == "down" else SH * 0.6
        dr.line((x, SY + SH - hgt, x, SY + SH), fill=KCOL[ck] + (255 if hit else 150,), width=4 if hit else 2)
    px = SX + t / DUR * SW
    dr.line((px, SY - 4, px, SY + SH + 4), fill=(255, 176, 32), width=2)
    enc_in.write(np.asarray(im).tobytes())

enc_in.close()
enc.wait()
shutil.rmtree(TMP, ignore_errors=True)
print("done", OUT)
