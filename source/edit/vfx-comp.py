# Copyright (c) 2026 Dor5hacham d5shacham@gmail.com. All rights reserved.
# SPDX-License-Identifier: Proprietary

# vfx-comp.py - A fire element composited behind 3D letters, with a breakdown.
#
# Plate: the Blender 3D-logo clip ("MOTION" letters), slowed to about half speed.
# Element: the Blender fire-and-smoke clip, rendered on a dark background.
# The composite, step by step:
#   1. unmultiply: lift the element's black level, take the brightest channel
#      as alpha and divide the color by it, so fire and smoke become a layer
#      with a matte instead of a picture on black
#   2. place it: scale and move the ring of fire up to the base of the letters
#   3. a letter matte pulled from the plate (orange letters vs blue backdrop)
#      puts the fire behind the letters
#   4. interactive light: a wide blur of the fire, tinted warm and flickering,
#      brightens the plate, so the letters and the floor are lit by the fire
#   5. heat haze: the backdrop above the flames ripples (cv2.remap with an
#      animated displacement), the letters in front do not
#   6. grade: warm lift and vignette
# The clip opens on a four-up breakdown (plate, element, matte, comp), then the
# comp tile grows to full screen.
#
# Run from this folder (source/edit) in Git Bash:
#   uv run --with numpy --with pillow --with opencv-python-headless vfx-comp.py
# Output: ../../media/edit/vfx-comp.mp4
# Temp:   none on disk.

import subprocess

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

PLATE = "../../media/engine/3d-logo.mp4"
ELEMENT = "../../media/engine/smoke-fire.mp4"
OUT = "../../media/edit/vfx-comp.mp4"
W, H, FPS = 1280, 720, 30
NOUT = 8 * FPS
BLACK = 0.09                   # black level of the element


def decode(path):
    r = subprocess.run(["ffmpeg", "-nostdin", "-v", "error", "-i", path, "-f", "rawvideo", "-pix_fmt", "rgb24", "-"],
                       capture_output=True, check=True)
    return np.frombuffer(r.stdout, np.uint8).reshape(-1, H, W, 3)


plate_v, elem_v = decode(PLATE), decode(ELEMENT)


def at(video, pos):
    """Frame at a fractional index, blended between neighbors (0..1 floats)."""
    i = int(pos)
    k = pos - i
    a = video[min(i, len(video) - 1)].astype(np.float32)
    b = video[min(i + 1, len(video) - 1)].astype(np.float32)
    return (a * (1 - k) + b * k) / 255


def clamp01(x):
    return min(1.0, max(0.0, x))


def ease(a, b, x):
    k = clamp01((x - a) / (b - a))
    return k * k * (3 - 2 * k)


# Element placement: ring center (640, 590) -> letter base (640, 468), 1.15x.
PLACE = cv2.getRotationMatrix2D((640, 590), 0, 1.15)
PLACE[:, 2] += (0, 468 - 590)
yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
VIG = (1 - 0.35 * (((xx - W / 2) / (W / 2)) ** 2 + ((yy - H / 2) / (H / 2)) ** 2))[..., None]
WARM = np.array([1.0, 0.55, 0.25], np.float32)


def comp(n):
    """Return plate, element (on black), matte and the finished comp for output frame n."""
    t = n / FPS
    plate = at(plate_v, 36 + n * 0.47)
    elem_raw = at(elem_v, 15 + n * 0.55)
    elem = cv2.warpAffine(elem_raw, PLACE, (W, H), flags=cv2.INTER_LINEAR, borderValue=(BLACK,) * 3)
    lifted = np.clip((elem - BLACK) / (1 - BLACK), 0, 1)
    alpha = np.clip(lifted.max(2) / 0.95, 0, 1)
    color = lifted / np.maximum(alpha[..., None], 1e-3)
    # Letter matte from the plate: orange letters, blue backdrop; floor reflections excluded.
    m = np.clip(((plate[..., 0] - plate[..., 2]) - 0.06) / 0.12, 0, 1)
    m[470:] = 0
    m = cv2.GaussianBlur(m, (0, 0), 1.2)[..., None]
    # Heat haze on the backdrop above the fire.
    haze = cv2.GaussianBlur(alpha, (0, 0), 30)
    haze = np.roll(haze, -80, axis=0) * 6
    dx = np.sin(yy * 0.045 - t * 9 + np.sin(xx * 0.013 + t)) * haze
    dy = np.sin(xx * 0.03 + t * 6) * haze * 0.6
    plate_bg = cv2.remap(plate, xx + dx, yy + dy, cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)
    # Interactive light from the fire.
    flick = 1 + 0.12 * np.sin(t * 23) + 0.08 * np.sin(t * 37 + 1)
    light = cv2.GaussianBlur(lifted.max(2), (0, 0), 55)[..., None] * WARM * 1.8 * flick
    lit_bg = plate_bg * (1 + light) + light * 0.05
    lit_letters = plate * (1 + light * 1.4)
    fire = color * alpha[..., None] * 0.85
    behind = 1 - (1 - lit_bg) * (1 - fire)                  # screen the fire over the backdrop
    out = behind * (1 - m) + lit_letters * m
    out = np.clip(out * 1.05 + np.array([0.02, 0.005, -0.01]), 0, 1) * VIG
    return plate, elem_raw, alpha, np.clip(out, 0, 1)


BOLD = ImageFont.truetype("C:/Windows/Fonts/bahnschrift.ttf", 32)
LAB = ImageFont.truetype("C:/Windows/Fonts/bahnschrift.ttf", 20)
SMALL = ImageFont.truetype("C:/Windows/Fonts/bahnschrift.ttf", 20)
CREAM = (244, 239, 230)
TW, TH, GAP = 624, 351, 10
TILES = [(10, 8), (10 + TW + GAP + 2, 8), (10, 8 + TH + GAP), (10 + TW + GAP + 2, 8 + TH + GAP)]
NAMES = ["1  PLATE", "2  ELEMENT ON BLACK", "3  UNMULT MATTE", "4  COMP"]

enc = subprocess.Popen([
    "ffmpeg", "-nostdin", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24",
    "-s", f"{W}x{H}", "-framerate", str(FPS), "-i", "-",
    "-c:v", "libx264", "-crf", "20", "-preset", "slow", "-pix_fmt", "yuv420p",
    "-movflags", "+faststart", "-threads", "8", OUT], stdin=subprocess.PIPE)
assert enc.stdin is not None
enc_in = enc.stdin

for n in range(NOUT):
    t = n / FPS
    plate, elem, alpha, out = comp(n)
    grow = ease(2.3, 3.0, t)
    canvas = np.full((H, W, 3), 11 / 255, np.float32)
    if grow < 1:
        views = [plate, elem, np.repeat(alpha[..., None], 3, 2), out]
        for (x, y), v in zip(TILES[:3], views[:3]):
            canvas[y:y + TH, x:x + TW] = cv2.resize(v, (TW, TH), interpolation=cv2.INTER_AREA)
        canvas *= 1 - grow
    x0, y0 = TILES[3]
    gx, gy = int(x0 * (1 - grow)), int(y0 * (1 - grow))
    gw, gh = int(TW + (W - TW) * grow), int(TH + (H - TH) * grow)
    canvas[gy:gy + gh, gx:gx + gw] = cv2.resize(out, (gw, gh), interpolation=cv2.INTER_AREA)
    im = Image.fromarray((canvas * 255).astype(np.uint8))
    dr = ImageDraw.Draw(im, "RGBA")
    if grow < 1:
        a = int(255 * (1 - grow))
        for (x, y), name in zip(TILES, NAMES):
            if name.startswith("4"):
                x, y = gx, gy
            dr.rounded_rectangle((x + 10, y + 10, x + 22 + dr.textlength(name, font=LAB) + 10, y + 42), 6,
                                 fill=(11, 11, 16, int(200 * (1 - grow))))
            dr.text((x + 22, y + 14), name, font=LAB, fill=(255, 176, 32, a) if name[0] == "4" else CREAM + (a,))
    if grow > 0:
        a = int(255 * grow)
        dr.rounded_rectangle((24, H - 120, 760, H - 28), 10, fill=(11, 11, 16, int(180 * grow)))
        dr.rectangle((36, H - 104, 41, H - 40), fill=(255, 90, 54, a))
        dr.text((54, H - 110), "VFX COMPOSITE", font=BOLD, fill=CREAM + (a,))
        dr.text((56, H - 66), "unmult + screen, letter matte, interactive light, heat haze", font=SMALL,
                fill=(200, 198, 210, a))
    enc_in.write(np.asarray(im).tobytes())
    if n % 30 == 0:
        print("frame", n, flush=True)

enc_in.close()
enc.wait()
print("done", OUT)
