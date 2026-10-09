# Copyright (c) 2026 Dor5hacham d5shacham@gmail.com. All rights reserved.
# SPDX-License-Identifier: Proprietary

# boomerang.py - Boomerang, stutter edit and freeze-frame with a flash.
#
# The "MOTION REEL" title build from the master reel:
#   1. Boomerang: the title builds forward, then plays in reverse back to the
#      start, twice. The turn-around frames are not repeated, so the loop has
#      no hitch.
#   2. Stutter: on the last forward pass, the 4 frames where "REEL" lands repeat
#      4 times on the beat, each repeat with a small zoom punch.
#   3. Freeze-frame: the finished title freezes, a white flash fades out, and the
#      held frame pushes in slowly.
#
# How it works: ffmpeg decodes 1.5 s of the 60 fps master (cropped to remove the
# HUD and caption, scaled to 1280x720) into memory. This script builds the frame
# order as a list of source indices, applies the zoom punches and the flash with
# numpy/Pillow, and pipes the result to ffmpeg, which adds the labels with
# drawtext and encodes H.264.
#
# Run from this folder (source/edit) in Git Bash:
#   uv run --with numpy --with pillow boomerang.py
# Output: ../../media/edit/boomerang.mp4
# Temp:   none on disk (frames are piped between processes).

import subprocess
import numpy as np
from PIL import Image

SRC = "../../media/reel/master/claude-motion-reel-master.mp4"
OUT = "../../media/edit/boomerang.mp4"
FONT = "C\\:/Windows/Fonts/bahnschrift.ttf"
MONO = "C\\:/Windows/Fonts/consola.ttf"
W, H, FPS = 1280, 720, 30
IN, DUR = 1.2, 1.5            # decoded window of the master (60 fps)
STEP = 3                      # 3 source frames per output frame = 1.5x speed

# Source frame indices (60 fps, relative to IN).
A, B = 3, 63                  # boomerang range: lines open -> title built
CHUNK = [39, 42, 45, 48]      # "REEL" landing, used for the stutter
STUTTER_N = 4
FREEZE_AT = 84                # finished title with its subtitle
FREEZE_LEN = 54               # output frames held (1.8 s)

# ---- decode ----
dec = subprocess.run([
    "ffmpeg", "-nostdin", "-v", "error", "-ss", str(IN), "-t", str(DUR), "-i", SRC,
    # The title is wide, so take a full-width band and pad it to 16:9 with the
    # reel's background color instead of cropping into the letters.
    "-vf", "crop=1680:720:120:150,scale=1280:548:flags=lanczos,pad=1280:720:0:86:color=0x0a090e",
    "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], capture_output=True, check=True)
src = np.frombuffer(dec.stdout, np.uint8).reshape(-1, H, W, 3)
print("decoded", len(src), "frames")

# ---- edit decision list: (source index, effect, effect phase) ----
fwd = list(range(A, B + 1, STEP))
rev = fwd[-2:0:-1]            # skip both turn-around frames -> seamless ping-pong
edl = []
segments = []                 # (label, start frame, end frame) for drawtext


def add(frames, fx="", label=None):
    start = len(edl)
    for k, f in enumerate(frames):
        edl.append((f, fx, k))
    if label:
        segments.append((label, start, len(edl)))


for _ in range(2):
    add(fwd, label="BOOMERANG  >> forward")
    add(rev, label="BOOMERANG  << reverse")
lead = [f for f in fwd if f < CHUNK[0]]
add(lead, label="BOOMERANG  >> forward")
s0 = len(edl)
for n in range(STUTTER_N):
    for k, f in enumerate(CHUNK):
        edl.append((f, "punch", k))
segments.append((f"STUTTER  4 frames x{STUTTER_N}", s0, len(edl)))
add(list(range(CHUNK[-1] + STEP, FREEZE_AT, STEP)), label="")
add([FREEZE_AT] * FREEZE_LEN, fx="freeze", label="FREEZE FRAME + FLASH")
print("output frames", len(edl), "=", len(edl) / FPS, "s")


def zoom(img, z):
    if abs(z - 1) < 1e-4:
        return img
    cw, ch = W / z, H / z
    x0, y0 = (W - cw) / 2, (H - ch) / 2
    pil = Image.fromarray(img).resize((W, H), Image.Resampling.LANCZOS,
                                      box=(x0, y0, x0 + cw, y0 + ch))
    return np.asarray(pil)


# ---- labels (drawtext, one per segment) ----
draw = ["drawbox=x=28:y=28:w=360:h=62:color=0x0b0b10@0.75:t=fill",
        "drawbox=x=28:y=28:w=6:h=62:color=0xffb020:t=fill"]
for label, a, b in segments:
    if not label:
        continue
    color = {"B": "0xf4efe6", "S": "0x2bc4e6", "F": "0xff5a36"}[label[0]]
    draw.append(f"drawtext=fontfile='{FONT}':text='{label}':fontsize=30:fontcolor={color}"
                f":x=50:y=42:enable='between(n,{a},{b - 1})'")
vf = ",".join(draw)

enc = subprocess.Popen([
    "ffmpeg", "-nostdin", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24",
    "-s", f"{W}x{H}", "-framerate", str(FPS), "-i", "-", "-vf", vf,
    "-c:v", "libx264", "-crf", "22", "-preset", "slow", "-pix_fmt", "yuv420p",
    "-movflags", "+faststart", "-an", OUT], stdin=subprocess.PIPE)
assert enc.stdin is not None
enc_in = enc.stdin

for f, fx, k in edl:
    img = src[f]
    if fx == "punch":
        # Each repeat starts zoomed in and settles back: a beat you can see.
        img = zoom(img, 1.0 + 0.09 * (1 - k / len(CHUNK)) ** 2)
    elif fx == "freeze":
        img = zoom(img, 1.0 + 0.05 * (k / FREEZE_LEN))
        flash = max(0.0, 1.0 - k / 9) ** 1.6
        if flash > 0:
            img = (img.astype(np.float32) * (1 - flash) + 255 * flash).astype(np.uint8)
    enc_in.write(np.ascontiguousarray(img).tobytes())

enc_in.close()
enc.wait()
print("done", OUT)
