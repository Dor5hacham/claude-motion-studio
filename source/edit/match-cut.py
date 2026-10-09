# Copyright (c) 2026 Dor5hacham d5shacham@gmail.com. All rights reserved.
# SPDX-License-Identifier: Proprietary

# match-cut.py - Auto match cuts: one circle carried through seven different shots.
#
# Each shot has a round subject: the sun, the O of a 3D logo, a chrome sphere,
# a cloth-covered ball, a hand-drawn circle, a ring of dots and the fur ball.
# OpenCV's Hough circle transform finds that circle in every frame (search
# radius guided per shot, nearest to the last hit, then smoothed). Each frame
# is scaled and moved so its circle sits at the center of the screen with the
# radius of a "virtual circle" that grows smoothly from shot to shot (it passes
# through each shot's own radius halfway through the shot). At every cut both
# shots show the same circle in the same place, so the cut reads as one shape
# that changes what it is. A thin guide ring and the detected radius are drawn.
#
# How it works: ffmpeg decodes each shot into NumPy; OpenCV detects and warps;
# Pillow draws the labels; ffmpeg encodes.
#
# Run from this folder (source/edit) in Git Bash:
#   uv run --with numpy --with pillow --with opencv-python-headless match-cut.py
# Output: ../../media/edit/match-cut.mp4
# Temp:   none on disk.

import subprocess

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

OUT = "../../media/edit/match-cut.mp4"
W, H, FPS = 1280, 720, 30
# (clip, start s, frames, radius search range px, guess (x, y), label)
SHOTS = [("engine/ocean", 0.6, 26, (22, 45), (704, 59), "sun"),
         ("engine/3d-logo", 2.3, 26, (36, 64), (508, 409), "letter O"),
         ("engine/cycles-photoreal", 0.4, 26, (90, 140), (534, 376), "chrome sphere"),
         ("engine/cloth", 0.2, 26, (120, 175), (628, 383), "ball under cloth"),
         ("engine/grease-pencil", 3.3, 26, (180, 250), (628, 352), "drawn circle"),
         ("clips/shape-layers", 4.9, 26, (190, 250), (640, 368), "ring of dots"),
         ("engine/particles-fur", 2.0, 60, (170, 320), (660, 400), "fur ball")]


def decode(name, start, frames):
    r = subprocess.run(["ffmpeg", "-nostdin", "-v", "error", "-ss", str(start), "-i", f"../../media/{name}.mp4",
                        "-frames:v", str(frames), "-f", "rawvideo", "-pix_fmt", "rgb24", "-"],
                       capture_output=True, check=True)
    return np.frombuffer(r.stdout, np.uint8).reshape(-1, H, W, 3)


def track(frames, rng_r, guess):
    """Per-frame circle (x, y, r) near the previous hit, smoothed."""
    prev = np.array([guess[0], guess[1], (rng_r[0] + rng_r[1]) / 2], np.float32)
    out = []
    for f in frames:
        g = cv2.medianBlur(cv2.resize(cv2.cvtColor(f, cv2.COLOR_RGB2GRAY), (640, 360)), 5)
        c = cv2.HoughCircles(g, cv2.HOUGH_GRADIENT, dp=1.2, minDist=40, param1=90, param2=28,
                             minRadius=rng_r[0] // 2, maxRadius=rng_r[1] // 2)
        if c is not None:
            cand = c[0] * 2
            best = cand[np.argmin(np.linalg.norm(cand[:, :2] - prev[:2], axis=1) + np.abs(cand[:, 2] - prev[2]))]
            if np.linalg.norm(best[:2] - prev[:2]) < 120 or not out:
                prev = prev * 0.5 + best * 0.5 if out else best
        out.append(prev.copy())
    out = np.array(out)
    k = np.ones(5) / 5
    pad = np.pad(out, ((2, 2), (0, 0)), mode="edge")
    return np.stack([np.convolve(pad[:, i], k, "valid") for i in range(3)], 1)


shots = []
for name, start, n, rr, guess, label in SHOTS:
    fr = decode(name, start, n)
    tr = track(fr, rr, guess)
    shots.append((fr, tr, label))
    print(f"{name:28s} median circle x {np.median(tr[:, 0]):.0f} y {np.median(tr[:, 1]):.0f} r {np.median(tr[:, 2]):.0f}")

# Virtual radius: log-linear between the shots' median radii, hitting each at its middle.
starts = np.cumsum([0] + [len(s[0]) for s in shots])
mids = np.array([(starts[i] + starts[i + 1]) / 2 for i in range(len(shots))])
radii = np.array([np.median(s[1][:, 2]) for s in shots])
N = starts[-1]


def virtual_r(f):
    return float(np.exp(np.interp(f, mids, np.log(radii))))


BOLD = ImageFont.truetype("C:/Windows/Fonts/bahnschrift.ttf", 34)
SMALL = ImageFont.truetype("C:/Windows/Fonts/bahnschrift.ttf", 20)
MONO = ImageFont.truetype("C:/Windows/Fonts/consola.ttf", 17)
CREAM = (244, 239, 230)
enc = subprocess.Popen([
    "ffmpeg", "-nostdin", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24",
    "-s", f"{W}x{H}", "-framerate", str(FPS), "-i", "-",
    "-c:v", "libx264", "-crf", "20", "-preset", "slow", "-pix_fmt", "yuv420p",
    "-movflags", "+faststart", "-threads", "8", OUT], stdin=subprocess.PIPE)
assert enc.stdin is not None
enc_in = enc.stdin

for f in range(N):
    i = int(np.searchsorted(starts, f, side="right") - 1)
    fr, tr, label = shots[i]
    j = f - starts[i]
    x, y, r = tr[j]
    R = virtual_r(f)
    s = R / r
    M = np.float32([[s, 0, W / 2 - s * x], [0, s, H / 2 - s * y]])
    # Replicate the edge (the sun sits near the top, so its sky has to be extended).
    img = cv2.warpAffine(fr[j], M, (W, H), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)
    im = Image.fromarray(img)
    dr = ImageDraw.Draw(im, "RGBA")
    pulse = max(0.0, 1 - j / 8)                                    # the guide flashes at each cut
    dr.ellipse((W / 2 - R - 6, H / 2 - R - 6, W / 2 + R + 6, H / 2 + R + 6),
               outline=(255, 90, 54, int(90 + 165 * pulse)), width=2)
    for a in range(4):
        ang = a * np.pi / 2
        x0, y0 = W / 2 + np.cos(ang) * (R + 12), H / 2 + np.sin(ang) * (R + 12)
        x1, y1 = W / 2 + np.cos(ang) * (R + 28), H / 2 + np.sin(ang) * (R + 28)
        dr.line((x0, y0, x1, y1), fill=(255, 90, 54, 200), width=2)
    dr.rounded_rectangle((16, H - 124, 840, H - 16), 10, fill=(11, 11, 16, 245))
    dr.rectangle((36, H - 104, 41, H - 40), fill=(255, 90, 54))
    dr.text((54, H - 110), "MATCH CUT", font=BOLD, fill=CREAM)
    dr.text((56, H - 66), "one circle through 7 shots, found by the Hough transform", font=SMALL,
            fill=(200, 198, 210))
    dr.text((820, H - 106), f"shot {i + 1}/7  {label}", font=MONO, fill=CREAM, anchor="ra")
    dr.text((820, H - 82), f"detected r {r:5.1f} px", font=MONO, fill=(170, 168, 185), anchor="ra")
    dr.text((820, H - 58), f"scale {s:4.2f}", font=MONO, fill=(170, 168, 185), anchor="ra")
    enc_in.write(np.asarray(im).tobytes())

enc_in.close()
enc.wait()
print("done", OUT, N, "frames")
