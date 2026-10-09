# Copyright (c) 2026 Dor5hacham d5shacham@gmail.com. All rights reserved.
# SPDX-License-Identifier: Proprietary

# vhs.py - VHS tape look, built from the defects of analog video one by one.
#
# Source: the Blender fur-ball clip, as a 4:3 "home video". The tape plays,
# rewinds, plays again and pauses, with an on-screen display like a VCR:
#   blue screen + PLAY -> tracking settles -> PLAY -> REW (fast backward scan
#   with noise bars) -> PLAY -> PAUSE (the frame wobbles)
# Every frame goes through a small model of a VHS deck, at 480x360:
#   - color split into luma and chroma (YIQ); chroma is smeared sideways and
#     shifted right (VHS stores color at about a tenth of the luma detail)
#   - luma is softened, then sharpened with a halo, like the deck's peaking
#   - every line is shifted a little (time-base wobble); inside the tracking
#     band the shifts get large and the band is full of snow
#   - the bottom lines tear sideways (head-switching noise)
#   - random white dropouts, grain, scanlines, vignette
#
# How it works: ffmpeg decodes the clip into NumPy; NumPy does the deck model;
# Pillow draws the on-screen display; ffmpeg encodes.
#
# Run from this folder (source/edit) in Git Bash:
#   uv run --with numpy --with pillow vhs.py
# Output: ../../media/edit/vhs.mp4
# Temp:   none on disk (frames are piped between processes).

import subprocess

import numpy as np
from PIL import Image, ImageDraw, ImageFont

SRC = "../../media/engine/particles-fur.mp4"
OUT = "../../media/edit/vhs.mp4"
W, H, FPS = 1280, 720, 30
VW, VH = 480, 360              # working resolution of the "tape"
NOUT = 9 * FPS

dec = subprocess.run([
    "ffmpeg", "-nostdin", "-v", "error", "-i", SRC,
    "-vf", "crop=960:720:180:0,scale=480:360:flags=area",
    "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], capture_output=True, check=True)
src = np.frombuffer(dec.stdout, np.uint8).reshape(-1, VH, VW, 3).astype(np.float32) / 255
N = len(src)
print("decoded", N, "frames")
rng = np.random.default_rng(11)

TO_YIQ = np.array([[0.299, 0.587, 0.114], [0.596, -0.274, -0.322], [0.211, -0.523, 0.312]], np.float32)
TO_RGB = np.linalg.inv(TO_YIQ).astype(np.float32)


def hblur(a, r):
    """Horizontal box blur of radius r along axis 1 (edges clamped)."""
    p = np.pad(a, ((0, 0), (r + 1, r)) + ((0, 0),) * (a.ndim - 2), mode="edge")
    c = np.cumsum(p, axis=1)
    return (c[:, 2 * r + 1:] - c[:, :-2 * r - 1]) / (2 * r + 1)


def shift_rows(a, sh):
    """Shift every row of a by its own integer offset (positive = right)."""
    xs = np.clip(np.arange(VW)[None, :] - sh[:, None], 0, VW - 1)
    return np.take_along_axis(a, xs[..., None] if a.ndim == 3 else xs, axis=1)


def smooth_noise(n, k):
    return hblur(rng.standard_normal((1, n + 2 * k))[..., None], k)[0, k:k + n, 0] * np.sqrt(2 * k + 1)


def deck(img, t, band_y, band_h, band_amt, wobble):
    """Run one RGB frame (0..1, VH x VW) through the VHS model."""
    yiq = img @ TO_YIQ.T
    y, iq = yiq[..., 0], yiq[..., 1:]
    iq = hblur(hblur(iq, 6), 6)
    iq = np.roll(iq, 4, axis=1) * 0.92
    soft = hblur(y, 1)
    y = soft + 0.55 * (soft - hblur(soft, 4))
    rows = np.arange(VH)
    sh = np.round(smooth_noise(VH, 6) * 0.9 * wobble).astype(int)
    inb = np.exp(-((rows - band_y) / band_h) ** 2) * band_amt
    sh += np.round(inb * (14 + 10 * rng.standard_normal(VH))).astype(int)
    hs = rows >= VH - 7
    sh[hs] += (np.linspace(4, 26, 7) + rng.integers(0, 6, 7)).astype(int)
    out = np.concatenate([y[..., None], iq], axis=2)
    out = shift_rows(out, sh)
    # Snow in the tracking band and the head-switching lines.
    snow = (rng.random((VH, VW)) > 0.88).astype(np.float32)
    snow = hblur(snow, 3) * 2.2
    amt = np.clip(inb * 1.1, 0, 1) + hs * 0.6
    out[..., 0] = out[..., 0] * (1 - amt[:, None] * 0.5) + snow * amt[:, None] * 0.9
    out[..., 1:] *= (1 - amt[:, None] * 0.7)[..., None]
    # Dropouts: short white streaks.
    for _ in range(rng.integers(0, 4)):
        yy, xx, ll = rng.integers(0, VH), rng.integers(0, VW), rng.integers(8, 60)
        out[yy, xx:xx + ll, 0] += 0.7
    out[..., 0] += rng.standard_normal((VH, VW)) * 0.03
    out[..., 1:] += smooth_noise(VH, 3)[:, None, None] * 0.012
    rgb = np.clip(out @ TO_RGB.T, 0, 1)
    return rgb


# Up-scale to 960x720 inside a 1280x720 pillarbox, with scanlines and vignette.
SCAN = np.where(np.arange(720) % 2 == 0, 1.0, 0.86).astype(np.float32)[:, None, None]
yy, xx = np.mgrid[0:720, 0:960].astype(np.float32)
VIG = (1 - 0.32 * (((xx - 480) / 480) ** 2 + ((yy - 360) / 360) ** 2) ** 1.5)[..., None].clip(0, 1)


def present(rgb):
    big = np.asarray(Image.fromarray((rgb * 255).astype(np.uint8)).resize((960, 720), Image.Resampling.BILINEAR))
    big = big.astype(np.float32) * SCAN * VIG
    frame = np.zeros((H, W, 3), np.uint8)
    frame[:, 160:1120] = np.clip(big, 0, 255).astype(np.uint8)
    return frame


# ---- the tape's script: (start time, mode) ----
def mode_at(t):
    if t < 0.7:
        return "blue"
    if t < 4.6:
        return "play1"
    if t < 6.0:
        return "rew"
    if t < 8.4:
        return "play2"
    return "pause"


OSD = ImageFont.truetype("C:/Windows/Fonts/consolab.ttf", 44)
OSD_S = ImageFont.truetype("C:/Windows/Fonts/consolab.ttf", 34)


def osd_text(dr, xy, text, font):
    x, y = xy
    dr.text((x + 3, y + 3), text, font=font, fill=(0, 0, 0))
    dr.text((x, y), text, font=font, fill=(236, 236, 236))


def osd_play(dr, x, y):
    dr.polygon([(x + 3, y + 3), (x + 3, y + 41), (x + 33, y + 22)], fill=(0, 0, 0))
    dr.polygon([(x, y), (x, y + 38), (x + 30, y + 19)], fill=(236, 236, 236))


def osd_rew(dr, x, y):
    for k in (0, 26):
        dr.polygon([(x + k + 33, y + 3), (x + k + 33, y + 41), (x + k + 3, y + 22)], fill=(0, 0, 0))
        dr.polygon([(x + k + 30, y), (x + k + 30, y + 38), (x + k, y + 19)], fill=(236, 236, 236))


def osd_pause(dr, x, y):
    for k in (0, 20):
        dr.rectangle((x + k + 3, y + 3, x + k + 13, y + 41), fill=(0, 0, 0))
        dr.rectangle((x + k, y, x + k + 10, y + 38), fill=(236, 236, 236))


enc = subprocess.Popen([
    "ffmpeg", "-nostdin", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24",
    "-s", f"{W}x{H}", "-framerate", str(FPS), "-i", "-",
    "-c:v", "libx264", "-crf", "24", "-preset", "slow", "-pix_fmt", "yuv420p",
    "-movflags", "+faststart", "-threads", "8", OUT], stdin=subprocess.PIPE)
assert enc.stdin is not None
enc_in = enc.stdin

BLUE = np.zeros((VH, VW, 3), np.float32)
BLUE[:] = (0.05, 0.12, 0.72)
pause_frame = None
counter = 0.0                  # tape counter in seconds
for f in range(NOUT):
    t = f / FPS
    m = mode_at(t)
    band_y, band_h, band_amt, wobble = 0.0, 10.0, 0.0, 1.0
    if m == "blue":
        img = BLUE
    elif m == "play1":
        s = (t - 0.7) * FPS
        img = src[min(int(s), N - 1)]
        settle = max(0.0, 1 - (t - 0.7) / 0.9)
        band_y, band_h, band_amt = VH * (0.95 - 0.7 * (1 - settle)), 26 + 40 * settle, 1.6 * settle
        wobble = 1 + 5 * settle
        if 2.6 < t < 3.3:      # a tracking roll passes through
            k = (t - 2.6) / 0.7
            band_y, band_h, band_amt = VH * (1.1 - 1.3 * k), 14, 0.9
        counter += 1 / FPS
    elif m == "rew":
        k = (t - 4.6) / 1.4
        s = 117 - k * 77
        img = src[int(s)] * 0.9
        band_y, band_h, band_amt = (VH * (0.25 + 1.4 * k)) % VH, 9, 1.4
        wobble = 2.5
        counter -= 3 / FPS
    elif m == "play2":
        s = 40 + (t - 6.0) * FPS
        img = src[min(int(s), N - 1)]
        settle = max(0.0, 1 - (t - 6.0) / 0.5)
        band_y, band_h, band_amt = VH * 0.85, 20, 1.2 * settle
        wobble = 1 + 3 * settle
        counter += 1 / FPS
        pause_frame = img
    else:
        img = pause_frame
        band_y, band_h, band_amt = VH * 0.78, 6, 0.8
        wobble = 0.6
    rgb = deck(img, t, band_y, band_h, band_amt, wobble)
    if m == "rew":             # a second noise bar during the fast scan
        rgb = deck(rgb, t, (band_y + VH / 2) % VH, 7, 1.2, 1.0)
    if m == "pause":           # paused frames jump up and down by a line
        rgb = np.roll(rgb, int(rng.integers(-2, 3)), axis=0)
    frame = present(rgb)
    im = Image.fromarray(frame)
    dr = ImageDraw.Draw(im)
    blink = int((t - 8.4) * 3) % 2 == 0
    if m in ("blue", "play1", "play2") and (t < 3.2 or 6.0 <= t < 7.6 or m == "blue"):
        osd_play(dr, 210, 52)
        osd_text(dr, (256, 48), "PLAY", OSD)
    elif m == "rew":
        osd_rew(dr, 210, 52)
        osd_text(dr, (276, 48), "REW", OSD)
    elif m == "pause" and blink:
        osd_pause(dr, 210, 52)
        osd_text(dr, (250, 48), "PAUSE", OSD)
    osd_text(dr, (978, 52), "SP", OSD_S)
    c = max(counter, 0)
    osd_text(dr, (210, 600), f"0:{int(c // 60):02d}:{int(c % 60):02d}", OSD_S)
    if m != "blue":
        osd_text(dr, (720, 560), "OCT. 08 2026", OSD_S)
        osd_text(dr, (720, 604), f" 6:41:{12 + int(t):02d} PM", OSD_S)
    enc_in.write(np.asarray(im).tobytes())
    if f % 30 == 0:
        print("frame", f, m, flush=True)

enc_in.close()
enc.wait()
print("done", OUT)
