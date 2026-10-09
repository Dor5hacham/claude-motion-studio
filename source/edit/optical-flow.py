# Copyright (c) 2026 Dor5hacham d5shacham@gmail.com. All rights reserved.
# SPDX-License-Identifier: Proprietary

# optical-flow.py - Dense optical flow, shown three ways.
#
# Source: the Three.js clip (orbit camera, spinning glass knot, orbiting
# spheres). OpenCV's Farneback method estimates, for every pixel, where it moved
# between two frames. The edit shows that motion field:
#   1. the source, then a wipe to the flow as color: hue = direction,
#      brightness = speed (the wheel in the corner is the key). Near columns
#      glow brighter than far ones: parallax, so flow also shows depth
#   2. a grid of arrows over the dimmed footage
#   3. 2,400 particles carried along by the flow, leaving glowing trails
#
# How it works: ffmpeg decodes the clip into NumPy; OpenCV computes flow at half
# resolution between each pair of frames; NumPy and OpenCV draw the views;
# Pillow draws the labels; ffmpeg encodes.
#
# Run from this folder (source/edit) in Git Bash:
#   uv run --with numpy --with pillow --with opencv-python-headless optical-flow.py
# Output: ../../media/edit/optical-flow.mp4
# Temp:   none on disk (frames are piped between processes).

import subprocess

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

SRC = "../../media/tools/threejs.mp4"
OUT = "../../media/edit/optical-flow.mp4"
W, H, FPS = 1280, 720, 30
MAXMAG = 14.0                  # px per frame that maps to full brightness

dec = subprocess.run([
    "ffmpeg", "-nostdin", "-v", "error", "-i", SRC,
    "-vf", "crop=1088:612:96:0,scale=1280:720:flags=lanczos",
    "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], capture_output=True, check=True)
src = np.frombuffer(dec.stdout, np.uint8).reshape(-1, H, W, 3)
N = len(src)
small = [cv2.cvtColor(cv2.resize(f, (W // 2, H // 2), interpolation=cv2.INTER_AREA), cv2.COLOR_RGB2GRAY)
         for f in src]
print("decoded", N, "frames")


def flow_at(i):
    """Full-resolution flow (H, W, 2) from frame i to i + 1, in pixels."""
    a, b = small[max(0, min(i, N - 2))], small[max(0, min(i, N - 2)) + 1]
    fl = cv2.calcOpticalFlowFarneback(a, b, None, 0.5, 4, 21, 3, 7, 1.5, 0)
    return cv2.resize(fl, (W, H), interpolation=cv2.INTER_LINEAR) * 2


def flow_color(fl):
    mag, ang = cv2.cartToPolar(fl[..., 0], fl[..., 1])
    hsv = np.zeros((H, W, 3), np.uint8)
    hsv[..., 0] = (ang * 90 / np.pi).astype(np.uint8)
    hsv[..., 1] = 230
    hsv[..., 2] = (np.clip(mag / MAXMAG, 0, 1) ** 0.7 * 255).astype(np.uint8)
    return cv2.cvtColor(hsv, cv2.COLOR_HSV2RGB)


def hue_rgb(fx, fy):
    ang = (np.arctan2(fy, fx) % (2 * np.pi)) * 90 / np.pi
    px = np.uint8([[[int(ang), 230, 255]]])
    return tuple(int(c) for c in cv2.cvtColor(px, cv2.COLOR_HSV2RGB)[0, 0])


# Color wheel legend.
R = 58
wy, wx = np.mgrid[-R:R + 1, -R:R + 1].astype(np.float32)
wmag = np.hypot(wx, wy) / R
wheel_hsv = np.zeros((2 * R + 1, 2 * R + 1, 3), np.uint8)
wheel_hsv[..., 0] = ((np.arctan2(wy, wx) % (2 * np.pi)) * 90 / np.pi).astype(np.uint8)
wheel_hsv[..., 1] = 230
wheel_hsv[..., 2] = (np.clip(wmag, 0, 1) ** 0.7 * 255).astype(np.uint8)
WHEEL = cv2.cvtColor(wheel_hsv, cv2.COLOR_HSV2RGB)
WMASK = (wmag <= 1)[..., None]


def clamp01(x):
    return min(1.0, max(0.0, x))


def ease(a, b, x):
    k = clamp01((x - a) / (b - a))
    return k * k * (3 - 2 * k)


# Particles for the streak view.
rng = np.random.default_rng(5)
NP, TRAIL = 2400, 12
pts = np.column_stack([rng.random(NP) * W, rng.random(NP) * H]).astype(np.float32)
hist = np.repeat(pts[None], TRAIL, 0)
age = rng.integers(0, 40, NP)

BOLD = ImageFont.truetype("C:/Windows/Fonts/bahnschrift.ttf", 34)
SMALL = ImageFont.truetype("C:/Windows/Fonts/bahnschrift.ttf", 20)
MONO = ImageFont.truetype("C:/Windows/Fonts/consola.ttf", 16)
CREAM = (244, 239, 230)

enc = subprocess.Popen([
    "ffmpeg", "-nostdin", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24",
    "-s", f"{W}x{H}", "-framerate", str(FPS), "-i", "-",
    "-c:v", "libx264", "-crf", "21", "-preset", "slow", "-pix_fmt", "yuv420p",
    "-movflags", "+faststart", "-threads", "8", OUT], stdin=subprocess.PIPE)
assert enc.stdin is not None
enc_in = enc.stdin

gx, gy = np.meshgrid(np.arange(20, W, 40), np.arange(20, H, 40))
for f in range(N):
    t = f / FPS
    img = src[f].astype(np.float32)
    fl = flow_at(f)
    k_color = ease(1.0, 1.5, t) * (1 - ease(3.2, 3.6, t))
    k_vec = ease(3.2, 3.6, t) * (1 - ease(5.0, 5.4, t))
    k_strk = ease(5.0, 5.4, t)
    out = img.copy()
    if k_color > 0:
        col = flow_color(fl).astype(np.float32)
        if t < 1.6:            # diagonal wipe from source to flow color
            edge = (np.arange(W)[None, :] + np.arange(H)[:, None] * 0.6) / (W + H * 0.6)
            m = (edge < ease(1.0, 1.5, t) * 1.1 - 0.05).astype(np.float32)[..., None]
            out = out * (1 - m) + col * m
        else:
            out = out * (1 - k_color) + col * k_color
    dimmed = img * 0.42
    if k_vec > 0:
        layer = dimmed.copy()
        for y, x in zip(gy.ravel(), gx.ravel()):
            dx, dy = fl[y, x]
            if dx * dx + dy * dy < 0.5:
                continue
            c = hue_rgb(dx, dy)
            cv2.arrowedLine(layer, (int(x), int(y)), (int(x + dx * 3), int(y + dy * 3)), c, 2,
                            cv2.LINE_AA, tipLength=0.35)
        out = out * (1 - k_vec) + layer * k_vec
    if k_strk > 0 or t > 4.6:
        # Advect particles through the flow; respawn old or escaped ones.
        xi = np.clip(pts[:, 0].astype(int), 0, W - 1)
        yi = np.clip(pts[:, 1].astype(int), 0, H - 1)
        pts += fl[yi, xi]
        age += 1
        dead = (pts[:, 0] < 0) | (pts[:, 0] >= W) | (pts[:, 1] < 0) | (pts[:, 1] >= H) | (age > 45)
        nd = int(dead.sum())
        if nd:
            pts[dead] = np.column_stack([rng.random(nd) * W, rng.random(nd) * H])
            hist[:, dead] = pts[dead]
            age[dead] = 0
        hist = np.roll(hist, -1, 0)
        hist[-1] = pts
        if k_strk > 0:
            glow = np.zeros((H, W, 3), np.float32)
            v = hist[-1] - hist[-2]
            for i in np.flatnonzero((np.abs(v).sum(1) > 0.4) & ~dead):
                c = hue_rgb(v[i, 0], v[i, 1])
                line = hist[:, i].astype(np.int32)
                cv2.polylines(glow, [line], False, c, 1, cv2.LINE_AA)
            glow = glow + cv2.GaussianBlur(glow, (0, 0), 3) * 1.6
            layer = np.minimum(dimmed + glow, 255)
            out = out * (1 - k_strk) + layer * k_strk
    im = Image.fromarray(np.clip(out, 0, 255).astype(np.uint8))
    dr = ImageDraw.Draw(im, "RGBA")
    if k_color > 0.05:
        a = int(255 * k_color)
        wx0, wy0 = W - 2 * R - 44, 36
        dr.rounded_rectangle((wx0 - 14, wy0 - 14, wx0 + 2 * R + 14, wy0 + 2 * R + 44), 10,
                             fill=(11, 11, 16, int(190 * k_color)))
        wheel = Image.fromarray(np.where(WMASK, WHEEL, 11).astype(np.uint8))
        im.paste(wheel, (wx0, wy0), Image.fromarray((WMASK[..., 0] * a).astype(np.uint8)))
        dr.text((wx0 + R, wy0 + 2 * R + 10), "hue = direction", font=MONO, fill=CREAM + (a,), anchor="ma")
    mode = ("source footage" if t < 1.0 else "flow as color: hue = direction, brightness = speed" if t < 3.4
            else "flow as vectors, one arrow every 40 px" if t < 5.2 else "particles carried by the flow")
    dr.rounded_rectangle((24, H - 120, 610, H - 28), 10, fill=(11, 11, 16, 185))
    dr.rectangle((36, H - 104, 41, H - 40), fill=(255, 90, 54))
    dr.text((54, H - 110), "OPTICAL FLOW", font=BOLD, fill=CREAM)
    dr.text((56, H - 66), mode, font=SMALL, fill=(200, 198, 210))
    dr.text((W - 36, H - 40), "OpenCV Farneback, dense", font=MONO, fill=(170, 168, 185), anchor="ra")
    enc_in.write(np.asarray(im).tobytes())
    if f % 30 == 0:
        print("frame", f, flush=True)

enc_in.close()
enc.wait()
print("done", OUT)
