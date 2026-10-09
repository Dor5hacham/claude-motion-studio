# Copyright (c) 2026 Dor5hacham d5shacham@gmail.com. All rights reserved.
# SPDX-License-Identifier: Proprietary

# pixel-sort.py - Pixel sorting with an animated brightness threshold.
#
# Source: the Blender ocean clip (sunset, buoy). Pixels whose brightness falls
# inside a band [lo, hi] form runs along each row; every run is sorted from
# dark to bright, so the sun and its reflection melt into streaks while the
# dark water stays sharp. The edit:
#   1. the source plays, then the mask is shown (pixels outside the band go dim)
#      while the band widens
#   2. rows are sorted while the lower threshold sweeps down and back up
#   3. a wipe switches to sorting columns, so the light drips vertically
#   4. the band closes and the clean frame returns
# A bar at the bottom shows the brightness band live.
#
# How it works: ffmpeg decodes the clip into NumPy (played forward, then partly
# in reverse to reach 7 s). Per frame, each run gets its own segment number
# (cumulative sum of run starts, and every pixel outside the band is its own
# segment); one argsort per row on "segment + brightness" sorts inside the runs
# and leaves everything else in place. Pillow draws the HUD; ffmpeg encodes.
#
# Run from this folder (source/edit) in Git Bash:
#   uv run --with numpy --with pillow pixel-sort.py
# Output: ../../media/edit/pixel-sort.mp4
# Temp:   none on disk (frames are piped between processes).

import subprocess

import numpy as np
from PIL import Image, ImageDraw, ImageFont

SRC = "../../media/engine/ocean.mp4"
OUT = "../../media/edit/pixel-sort.mp4"
W, H, FPS = 1280, 720, 30
NOUT = 7 * FPS

dec = subprocess.run([
    "ffmpeg", "-nostdin", "-v", "error", "-i", SRC,
    "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], capture_output=True, check=True)
src = np.frombuffer(dec.stdout, np.uint8).reshape(-1, H, W, 3)
N = len(src)
order = list(range(N)) + list(range(N - 2, -1, -1))
print("decoded", N, "frames")


def clamp01(x):
    return min(1.0, max(0.0, x))


def ease(a, b, x):
    k = clamp01((x - a) / (b - a))
    return k * k * (3 - 2 * k)


def band(t):
    """Lower and upper brightness threshold at time t (seconds)."""
    lo = 1.0
    lo -= 0.45 * ease(0.8, 1.8, t)          # mask preview widens to 0.55
    lo -= 0.37 * ease(2.3, 3.6, t)          # rows: sweep down to 0.18
    lo += 0.30 * ease(3.6, 4.4, t)          # back up to 0.48
    lo -= 0.24 * ease(4.6, 5.6, t)          # columns: down to 0.24
    lo += 0.76 * ease(5.9, 6.7, t)          # close the band
    return lo, 0.985


def sort_rows(img, lum, lo, hi):
    mask = (lum >= lo) & (lum <= hi)
    prev = np.zeros_like(mask)
    prev[:, 1:] = mask[:, :-1]
    start = ~mask | (mask & ~prev)
    seg = np.cumsum(start, axis=1)
    idx = np.argsort(seg + lum * 0.999, axis=1, kind="stable")
    return np.take_along_axis(img, idx[..., None], axis=1), mask


BOLD = ImageFont.truetype("C:/Windows/Fonts/bahnschrift.ttf", 34)
SMALL = ImageFont.truetype("C:/Windows/Fonts/bahnschrift.ttf", 20)
MONO = ImageFont.truetype("C:/Windows/Fonts/consola.ttf", 16)
CREAM = (244, 239, 230)
BAR_X, BAR_Y, BAR_W, BAR_H = 56, H - 52, 420, 12
ramp = np.repeat(np.linspace(0, 255, BAR_W)[None, :, None], BAR_H, 0).repeat(3, 2).astype(np.uint8)

enc = subprocess.Popen([
    "ffmpeg", "-nostdin", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24",
    "-s", f"{W}x{H}", "-framerate", str(FPS), "-i", "-",
    "-c:v", "libx264", "-crf", "20", "-preset", "slow", "-pix_fmt", "yuv420p",
    "-movflags", "+faststart", "-threads", "8", OUT], stdin=subprocess.PIPE)
assert enc.stdin is not None
enc_in = enc.stdin

for n in range(NOUT):
    t = n / FPS
    img = src[order[n]]
    lum = img.astype(np.float32) @ np.array([0.299, 0.587, 0.114], np.float32) / 255
    lo, hi = band(t)
    preview = 1 - ease(1.9, 2.3, t)
    wipe = ease(4.35, 4.75, t)              # 0 = rows, 1 = columns
    mode = "rows"
    if lo >= hi:
        out = img
        mode = "source"
    elif preview > 0:
        mask = (lum >= lo) & (lum <= hi)
        rows, _ = sort_rows(img, lum, lo, hi)
        # Selected pixels stay, the rest drops to a dim gray.
        dim = np.repeat(lum[..., None] * 255 * 0.22 + 8, 3, axis=2)
        mk = np.where(mask[..., None], img.astype(np.float32), dim)
        out = (mk * preview + rows.astype(np.float32) * (1 - preview)).astype(np.uint8)
        mode = "mask"
    else:
        out = None
        if wipe < 1:
            out, _ = sort_rows(img, lum, lo, hi)
        if wipe > 0:
            cols, _ = sort_rows(img.transpose(1, 0, 2), lum.T, lo, hi)
            cols = cols.transpose(1, 0, 2)
            if out is None:
                out = cols
            else:
                edge = int(wipe * W)
                out = out.copy()
                out[:, :edge] = cols[:, :edge]
            mode = "columns"
    im = Image.fromarray(np.ascontiguousarray(out))
    dr = ImageDraw.Draw(im, "RGBA")
    if 0 < wipe < 1:
        ex = int(wipe * W)
        dr.line((ex, 0, ex, H), fill=(244, 239, 230, 220), width=3)

    dr.rounded_rectangle((24, H - 150, 520, H - 22), 10, fill=(11, 11, 16, 190))
    dr.rectangle((36, H - 136, 41, H - 76), fill=(255, 90, 54))
    dr.text((54, H - 142), "PIXEL SORT", font=BOLD, fill=CREAM)
    sub = {"source": "source frame, nothing sorted",
           "mask": "mask: pixels inside the brightness band",
           "rows": "sorting runs along rows, dark to bright",
           "columns": "sorting runs along columns, dark to bright"}[mode]
    dr.text((56, H - 98), sub, font=SMALL, fill=(200, 198, 210))
    im.paste(Image.fromarray(ramp), (BAR_X, BAR_Y))
    if lo < hi:
        x0, x1 = BAR_X + int(lo * BAR_W), BAR_X + int(hi * BAR_W)
        dr.rectangle((x0, BAR_Y - 4, x1, BAR_Y + BAR_H + 3), outline=(255, 90, 54), width=2)
        dr.text((x0, BAR_Y - 24), f"{lo:.2f}", font=MONO, fill=(255, 150, 120), anchor="ma")
    dr.text((BAR_X + BAR_W + 12, BAR_Y - 3), "brightness", font=MONO, fill=(170, 168, 185))
    enc_in.write(np.asarray(im).tobytes())
    if n % 30 == 0:
        print("frame", n, f"lo={lo:.2f}", mode, flush=True)

enc_in.close()
enc.wait()
print("done", OUT)
