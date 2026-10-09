# Copyright (c) 2026 Dor5hacham d5shacham@gmail.com. All rights reserved.
# SPDX-License-Identifier: Proprietary

# photomosaic.py - A zoom out from one playing clip to a mosaic of 1,600 playing
# clips that together form a picture.
#
# The tile library is the 29 clips listed in LIBRARY (engine, tools, edit and
# reel clips). The target picture is a frame of the fur-ball clip. The
# mosaic is a 40x40 grid of 32x18 tiles; each cell is described by its 3x3 grid
# of average colors, and gets the library frame (clip + moment) whose 3x3
# colors are nearest, with a small cost per use of a clip so tiles repeat less.
# Each tile is then nudged 70% of the way toward its cell's color. Tiles keep playing
# from their matched moment, so the mosaic is alive.
#
# The edit: one tile fills the screen at full resolution, the camera pulls back
# 40x (eased in log space) until the whole mosaic is visible, the mosaic holds,
# then the target frame fades in to show what the tiles were drawing.
#
# How it works: ffmpeg decodes every clip twice into NumPy (256x144 and 64x36
# thumbnails) and the hero clip at 1280x720; NumPy does the matching; OpenCV
# resizes and places the visible tiles for each frame; Pillow draws the labels;
# ffmpeg encodes.
#
# Run from this folder (source/edit) in Git Bash:
#   uv run --with numpy --with pillow --with opencv-python-headless photomosaic.py
# Output: ../../media/edit/photomosaic.mp4
# Temp:   none on disk.

import os
import subprocess

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

OUT = "../../media/edit/photomosaic.mp4"
TARGET = ("../../media/engine/particles-fur.mp4", 2.5)
W, H, FPS = 1280, 720, 30
GX, GY, TW, TH = 40, 40, 32, 18
NOUT = 8 * FPS
rng = np.random.default_rng(9)


def decode(path, size, start=None, frames=None):
    cmd = ["ffmpeg", "-nostdin", "-v", "error"]
    if start is not None:
        cmd += ["-ss", str(start)]
    cmd += ["-i", path, "-vf", f"fps=30,scale={size[0]}:{size[1]}:flags=area"]
    if frames:
        cmd += ["-frames:v", str(frames)]
    r = subprocess.run(cmd + ["-f", "rawvideo", "-pix_fmt", "rgb24", "-"], capture_output=True, check=True)
    return np.frombuffer(r.stdout, np.uint8).reshape(-1, size[1], size[0], 3)


LIBRARY = {
    "engine": "3d-logo cloth cycles-photoreal geometry-nodes grease-pencil liquid ocean particles-fur "
              "shatter smoke-fire softbody unreal-niagara",
    "tools": "hyperframes manim motion-canvas remotion threejs webgpu",
    "edit": "boomerang color-grade datamosh speed-ramp split-screen",
    "clips": "instancing kinetic-type particles procedural-shader raymarch-sdf shape-layers",
}
paths = [f"../../media/{d}/{n}.mp4" for d, names in LIBRARY.items() for n in names.split()]
mid = [decode(p, (256, 144)) for p in paths]
low = [np.stack([cv2.resize(f, (64, 36), interpolation=cv2.INTER_AREA) for f in m]) for m in mid]
print("library", len(paths), "clips,", sum(len(m) for m in mid), "frames")

# ---- matching on 3x3 average colors ----
feat, keys = [], []
for ci, lo in enumerate(low):
    for fi in range(0, len(lo) - 60, 2):         # leave 2 s so a tile can keep playing
        feat.append(cv2.resize(lo[fi], (3, 3), interpolation=cv2.INTER_AREA).astype(np.float32).ravel())
        keys.append((ci, fi))
feat = np.array(feat)
target = decode(TARGET[0], (W, H), TARGET[1], 1)[0]
cells = cv2.resize(target, (GX * 3, GY * 3), interpolation=cv2.INTER_AREA).astype(np.float32)
cellf = cells.reshape(GY, 3, GX, 3, 3).transpose(0, 2, 1, 3, 4).reshape(GY * GX, 27)
d = (cellf ** 2).sum(1)[:, None] - 2 * cellf @ feat.T + (feat ** 2).sum(1)[None, :]
# Greedy pick in random cell order; each use of a clip makes it a little more
# expensive, so the whole library shows up instead of a few best matches.
clip_of = np.array([k[0] for k in keys])
use = np.zeros(len(paths))
pen = 0.05 * np.median(d)
pick = np.zeros(len(cellf), int)
for c in rng.permutation(len(cellf)):
    pick[c] = int(np.argmin(d[c] + pen * use[clip_of]))
    use[clip_of[pick[c]]] += 1
print("tiles per clip:", sorted(use.astype(int).tolist()))
assign = [keys[k] for k in pick]                 # per cell: (clip, start frame)
cellmean = cellf.reshape(-1, 9, 3).mean(1)
tilemean = feat[pick].reshape(-1, 9, 3).mean(1)
offset = ((cellmean - tilemean) * 0.7).reshape(GY, GX, 3)
FOCUS = (GX // 2, GY // 2)
fci, ffi = assign[FOCUS[1] * GX + FOCUS[0]]
hero = decode(paths[fci], (W, H), ffi / 30, 4 * FPS)
print("hero tile:", os.path.basename(paths[fci]), "from frame", ffi)


def tile(cx, cy, f, size):
    ci, fi = assign[cy * GX + cx]
    k = fi + f
    if (cx, cy) == FOCUS and size[0] > 256:
        img = hero[min(f, len(hero) - 1)]
    elif size[0] > 64:
        img = mid[ci][k % len(mid[ci])]
    else:
        img = low[ci][k % len(low[ci])]
    img = cv2.resize(img, size, interpolation=cv2.INTER_AREA if size[0] < img.shape[1] else cv2.INTER_LINEAR)
    return np.clip(img.astype(np.float32) + offset[cy, cx], 0, 255)


def clamp01(x):
    return min(1.0, max(0.0, x))


def ease(a, b, x):
    k = clamp01((x - a) / (b - a))
    return k * k * (3 - 2 * k)


BOLD = ImageFont.truetype("C:/Windows/Fonts/bahnschrift.ttf", 34)
SMALL = ImageFont.truetype("C:/Windows/Fonts/bahnschrift.ttf", 20)
CREAM = (244, 239, 230)
FULL_C = np.array([GX * TW / 2, GY * TH / 2])                  # mosaic center in mosaic px
FOC_C = np.array([(FOCUS[0] + 0.5) * TW, (FOCUS[1] + 0.5) * TH])

enc = subprocess.Popen([
    "ffmpeg", "-nostdin", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24",
    "-s", f"{W}x{H}", "-framerate", str(FPS), "-i", "-",
    "-c:v", "libx264", "-crf", "25", "-preset", "slow", "-pix_fmt", "yuv420p",
    "-movflags", "+faststart", "-threads", "8", OUT], stdin=subprocess.PIPE)
assert enc.stdin is not None
enc_in = enc.stdin

for f in range(NOUT):
    t = f / FPS
    p = ease(1.0, 5.6, t)
    z = 40 ** (1 - p)                                          # scale: mosaic px -> screen px
    center = FOC_C + (FULL_C - FOC_C) * p                      # mosaic point at the screen center
    frame = np.zeros((H, W, 3), np.float32)
    x0m, y0m = center[0] - W / 2 / z, center[1] - H / 2 / z    # visible mosaic rectangle
    x1m, y1m = center[0] + W / 2 / z, center[1] + H / 2 / z
    for cy in range(max(0, int(y0m // TH)), min(GY, int(y1m // TH) + 1)):
        for cx in range(max(0, int(x0m // TW)), min(GX, int(x1m // TW) + 1)):
            sx0 = int(round((cx * TW - x0m) * z))
            sy0 = int(round((cy * TH - y0m) * z))
            sx1 = int(round(((cx + 1) * TW - x0m) * z))
            sy1 = int(round(((cy + 1) * TH - y0m) * z))
            if sx1 <= sx0 or sy1 <= sy0:
                continue
            img = tile(cx, cy, f, (sx1 - sx0, sy1 - sy0))
            ax0, ay0 = max(sx0, 0), max(sy0, 0)
            ax1, ay1 = min(sx1, W), min(sy1, H)
            if ax1 > ax0 and ay1 > ay0:
                frame[ay0:ay1, ax0:ax1] = img[ay0 - sy0:ay1 - sy0, ax0 - sx0:ax1 - sx0]
            if z > 3:                                          # thin seams while tiles are big
                g = max(1, int(z / 12))
                frame[max(sy0, 0):min(sy1, H), max(sx0, 0):max(sx0, 0) + g] *= 0.25
                frame[max(sy0, 0):max(sy0, 0) + g, max(sx0, 0):min(sx1, W)] *= 0.25
    reveal = ease(6.4, 7.2, t)
    if reveal > 0:
        frame = frame * (1 - reveal * 0.7) + target.astype(np.float32) * reveal * 0.7
    im = Image.fromarray(np.clip(frame, 0, 255).astype(np.uint8))
    dr = ImageDraw.Draw(im, "RGBA")
    sub = ("one tile: " + os.path.basename(paths[fci]).replace(".mp4", "") if t < 1.6 else
           f"{GX * GY:,} playing tiles from {len(paths)} clips" if t < 6.6 else "the target frame they draw")
    dr.rounded_rectangle((24, H - 120, 560, H - 28), 10, fill=(11, 11, 16, 190))
    dr.rectangle((36, H - 104, 41, H - 40), fill=(255, 90, 54))
    dr.text((54, H - 110), "PHOTOMOSAIC", font=BOLD, fill=CREAM)
    dr.text((56, H - 66), sub, font=SMALL, fill=(200, 198, 210))
    enc_in.write(np.asarray(im).tobytes())
    if f % 30 == 0:
        print("frame", f, f"zoom {z:.1f}", flush=True)

enc_in.close()
enc.wait()
print("done", OUT)
