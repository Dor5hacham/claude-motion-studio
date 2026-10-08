# super8.py - Super 8 film emulation, built from the parts of the look.
#
# Source: the Blender ocean sunset, slowed to 0.63x. What makes it read as film:
#   - cadence: 18 film frames per second, each held for its share of the 30 fps
#     output, so motion steps like a projector
#   - gate weave: every film frame sits a little off (x, y, a hair of rotation)
#   - stock: lifted warm blacks, rolled-off highlights, a touch of cyan in the
#     shadows, less saturation, then halation (bright areas bleed red-orange)
#   - grain that changes every film frame, exposure flicker, dust specks and a
#     scratch that wanders for a while
#   - the gate: a rounded frame with a sprocket hole, and film burns (orange
#     light leaks) at the head and the tail
#
# How it works: ffmpeg decodes the clip into NumPy; NumPy and OpenCV build each
# film frame; Pillow draws the label; ffmpeg encodes.
#
# Run from this folder (source/edit) in Git Bash:
#   uv run --with numpy --with pillow --with opencv-python-headless super8.py
# Output: ../../media/edit/super8.mp4
# Temp:   none on disk.

import subprocess

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

SRC = "../../media/engine/ocean.mp4"
OUT = "../../media/edit/super8.mp4"
W, H, FPS, FILM_FPS = 1280, 720, 30, 18
NOUT = 8 * FPS
GW, GH = 1060, 624                     # visible gate (picture area) on screen
GX, GY = (W - GW) // 2 + 34, (H - GH) // 2 - 8

dec = subprocess.run(["ffmpeg", "-nostdin", "-v", "error", "-i", SRC, "-vf", f"scale={GW + 40}:{GH + 24}",
                      "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], capture_output=True, check=True)
src = np.frombuffer(dec.stdout, np.uint8).reshape(-1, GH + 24, GW + 40, 3)
N = len(src)
rng = np.random.default_rng(8)
print("decoded", N, "frames")


def clamp01(x):
    return min(1.0, max(0.0, x))


# Rounded gate mask with soft edges, and the sprocket hole.
gate = np.zeros((H, W), np.uint8)
cv2.rectangle(gate, (GX + 18, GY), (GX + GW - 18, GY + GH), 255, -1)
cv2.rectangle(gate, (GX, GY + 18), (GX + GW, GY + GH - 18), 255, -1)
for cx, cy in ((GX + 18, GY + 18), (GX + GW - 18, GY + 18), (GX + 18, GY + GH - 18), (GX + GW - 18, GY + GH - 18)):
    cv2.circle(gate, (cx, cy), 18, 255, -1)
GATE = cv2.GaussianBlur(gate.astype(np.float32) / 255, (0, 0), 1.5)[..., None]
yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
VIG = (1 - 0.45 * (((xx - GX - GW / 2) / (GW / 2)) ** 2 + ((yy - GY - GH / 2) / (GH / 2)) ** 2) ** 1.4).clip(0, 1)[..., None]


def stock(img):
    """Film-stock tone and color: lifted warm blacks, soft shoulder, cyan shadows, less saturation."""
    x = img / 255
    x = 1 - np.exp(-x * 1.6)                                   # soft highlight shoulder
    x = x / (1 - np.exp(-1.6))
    luma = x @ np.array([0.299, 0.587, 0.114], np.float32)
    x = luma[..., None] + (x - luma[..., None]) * 0.86
    shadow = (1 - luma)[..., None] ** 3
    x = x + shadow * np.array([-0.015, 0.01, 0.03]) + np.array([0.045, 0.03, 0.01])
    x = x * np.array([1.03, 1.0, 0.92])
    return np.clip(x, 0, 1)


def film_frame(k):
    """One film frame (film frame index k), gate weave included."""
    pos = min(k * (FPS / FILM_FPS) * 0.63, N - 1)
    img = src[int(pos)].astype(np.float32)
    dx, dy = rng.normal(0, 1.6), rng.normal(0, 1.2)
    ang = rng.normal(0, 0.08)
    M = cv2.getRotationMatrix2D(((GW + 40) / 2, (GH + 24) / 2), ang, 1.0)
    M[:, 2] += (dx - 20, dy - 12)
    pic = cv2.warpAffine(img, M, (GW, GH), borderMode=cv2.BORDER_REFLECT)
    pic = cv2.GaussianBlur(pic, (0, 0), 0.8)
    x = stock(pic)
    hi = np.clip((x.max(2) - 0.72) / 0.28, 0, 1)
    halo = cv2.GaussianBlur(hi, (0, 0), 14)[..., None] * np.array([0.55, 0.16, 0.04])
    x = x + halo
    grain = cv2.GaussianBlur(rng.standard_normal((GH, GW)).astype(np.float32), (0, 0), 0.9) * 0.075
    x = x + grain[..., None] * (0.4 + 0.6 * (1 - np.abs(x - 0.5) * 2))
    x = x * (1 + rng.normal(0, 0.025))
    return np.clip(x, 0, 1)


scratch = None                                          # (x, frames left)
frames = []
for k in range(int(NOUT / FPS * FILM_FPS) + 1):
    frames.append(film_frame(k))
print("film frames", len(frames))

BOLD = ImageFont.truetype("C:/Windows/Fonts/bahnschrift.ttf", 26)
SMALL = ImageFont.truetype("C:/Windows/Fonts/bahnschrift.ttf", 17)
enc = subprocess.Popen([
    "ffmpeg", "-nostdin", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24",
    "-s", f"{W}x{H}", "-framerate", str(FPS), "-i", "-",
    "-c:v", "libx264", "-crf", "22", "-preset", "slow", "-pix_fmt", "yuv420p",
    "-movflags", "+faststart", "-threads", "8", OUT], stdin=subprocess.PIPE)
assert enc.stdin is not None
enc_in = enc.stdin

last_k = -1
dirt = []
for n in range(NOUT):
    t = n / FPS
    k = int(t * FILM_FPS)
    if k != last_k:                                       # new film frame: new dust, maybe a scratch
        last_k = k
        dirt = [(rng.integers(0, GW), rng.integers(0, GH), rng.integers(1, 4), rng.random() < 0.3)
                for _ in range(rng.integers(2, 9))]
        if scratch is None and rng.random() < 0.08:
            scratch = [float(rng.integers(80, GW - 80)), int(rng.integers(12, 30))]
        elif scratch is not None:
            scratch[0] += rng.normal(0, 2.5)
            scratch[1] -= 1
            if scratch[1] <= 0:
                scratch = None
    pic = frames[k].copy()
    for x, y, r, hair in dirt:
        if hair:
            cv2.ellipse(pic, (int(x), int(y)), (r * 6, r), float(rng.integers(0, 180)), 0, 300, (0.05, 0.04, 0.03), 1)
        else:
            cv2.circle(pic, (int(x), int(y)), int(r), (0.9, 0.88, 0.82), -1)
    if scratch is not None:
        cv2.line(pic, (int(scratch[0]), 0), (int(scratch[0] + 3), GH), (0.85, 0.83, 0.78), 1)
    frame = np.zeros((H, W, 3), np.float32)
    frame[GY:GY + GH, GX:GX + GW] = pic
    frame = frame * GATE * VIG
    # Film burns at the head and the tail.
    burn = max(0.0, 1 - t / 0.9) ** 1.5 + max(0.0, (t - 7.0) / 1.0) ** 2
    if burn > 0:
        leak = np.exp(-((xx - (GX + GW * (0.15 + 0.1 * np.sin(t * 5)))) ** 2) / (2 * 260 ** 2))
        leak = leak[..., None] * np.array([1.0, 0.42, 0.12]) * burn * 1.6
        frame = 1 - (1 - frame) * (1 - np.clip(leak, 0, 1) * GATE)
    # Sprocket hole on the left edge.
    sy = GY + GH // 2 - 46
    cv2.rectangle(frame, (GX - 70, sy), (GX - 22, sy + 92), (0.9, 0.86, 0.78), -1)
    im = Image.fromarray((np.clip(frame, 0, 1) * 255).astype(np.uint8))
    dr = ImageDraw.Draw(im)
    dr.text((GX + GW - 4, GY + GH + 14), "SUPER 8 FILM LOOK", font=BOLD, fill=(244, 239, 230), anchor="ra")
    dr.text((GX + 4, GY + GH + 20), "18 fps cadence, gate weave, stock curve, halation, grain, dust, burns",
            font=SMALL, fill=(170, 168, 185))
    enc_in.write(np.asarray(im).tobytes())

enc_in.close()
enc.wait()
print("done", OUT)
