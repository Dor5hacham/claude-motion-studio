# split-screen.py - 2x2 split-screen montage that animates in, then one tile
# expands to full screen.
#
# Four scenes from the master reel play at the same time. The tiles fly in one
# after another (staggered slide + scale with an overshoot), hold as a 2x2 grid,
# then the top-right tile grows to fill the frame while the other three shrink
# and fade away.
#
# How it works: four ffmpeg processes decode the four shots (cropped to remove
# the reel's HUD and caption, scaled to 1280x720, 30 fps) as raw RGB. This script
# lays out each frame with Pillow (easing curves, rounded corners, labels) and
# pipes the frames to a fifth ffmpeg that encodes H.264.
#
# Run from this folder (source/edit) in Git Bash:
#   uv run --with numpy --with pillow split-screen.py
# Output: ../../media/edit/split-screen.mp4
# Temp:   none on disk (frames are piped between processes).

import subprocess
from PIL import Image, ImageDraw, ImageFont

SRC = "../../media/reel/master/claude-motion-reel-master.mp4"
OUT = "../../media/edit/split-screen.mp4"
W, H, FPS = 1280, 720, 30
DUR = 7.2
N = int(round(DUR * FPS))

# (start time in the master, label). Order: top-left, top-right, bottom-left, bottom-right.
SHOTS = [(6.4, "01  PARTICLES"), (14.4, "02  RAY-MARCHED SDF"),
         (30.4, "03  SHAPE LAYERS"), (38.4, "04  INSTANCING")]
HERO = 1                       # tile that expands
T_IN0, T_STAG, T_INDUR = -0.12, 0.2, 0.8
T_EXP0, T_EXP1 = 3.7, 4.6

BG = (11, 11, 16)
CREAM = (244, 239, 230)
ACCENTS = [(255, 90, 54), (43, 196, 230), (255, 176, 32), (122, 92, 255)]
FONT = ImageFont.truetype("C:/Windows/Fonts/bahnschrift.ttf", 40)

TW, TH, GAP = 592, 333, 18
X0 = (W - (2 * TW + GAP)) // 2
Y0 = (H - (2 * TH + GAP)) // 2
GRID = [(X0 + c * (TW + GAP), Y0 + r * (TH + GAP)) for r in range(2) for c in range(2)]
# Direction each tile flies in from (dx, dy in pixels).
FROM = [(-500, 0), (0, -420), (0, 420), (500, 0)]


def clamp01(x):
    return max(0.0, min(1.0, x))


def ease_out_cubic(x):
    return 1 - (1 - clamp01(x)) ** 3


def ease_out_back(x, s=1.7):
    x = clamp01(x) - 1
    return 1 + (s + 1) * x ** 3 + s * x ** 2


def ease_in_out_cubic(x):
    x = clamp01(x)
    return 4 * x ** 3 if x < 0.5 else 1 - (-2 * x + 2) ** 3 / 2


def lerp(a, b, k):
    return a + (b - a) * k


def decoder(start):
    p = subprocess.Popen([
        "ffmpeg", "-nostdin", "-v", "error", "-ss", str(start), "-t", str(DUR + 0.2), "-i", SRC,
        "-vf", "fps=30,crop=1380:776:270:90,scale=1280:720:flags=lanczos",
        "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], stdout=subprocess.PIPE)
    assert p.stdout is not None
    return p, p.stdout


decs = [decoder(s) for s, _ in SHOTS]
enc = subprocess.Popen([
    "ffmpeg", "-nostdin", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24",
    "-s", f"{W}x{H}", "-framerate", str(FPS), "-i", "-",
    "-c:v", "libx264", "-crf", "22", "-preset", "slow", "-pix_fmt", "yuv420p",
    "-movflags", "+faststart", "-an", OUT], stdin=subprocess.PIPE)
assert enc.stdin is not None
enc_in = enc.stdin


def labelled(img, i):
    d = ImageDraw.Draw(img)
    text = SHOTS[i][1]
    tw = d.textlength(text, font=FONT)
    d.rectangle([36, H - 104, 36 + tw + 52, H - 36], fill=(11, 11, 16))
    d.rectangle([36, H - 104, 46, H - 36], fill=ACCENTS[i])
    d.text((66, H - 98), text, font=FONT, fill=CREAM)
    return img


def tile_state(i, t):
    """Return (x, y, w, h, alpha, radius) of tile i at time t."""
    gx, gy = GRID[i]
    k_in = (t - (T_IN0 + i * T_STAG)) / T_INDUR
    m = ease_out_cubic(k_in)
    s = lerp(0.6, 1.0, ease_out_back(k_in))
    w, h = TW * s, TH * s
    x = gx + (TW - w) / 2 + FROM[i][0] * (1 - m)
    y = gy + (TH - h) / 2 + FROM[i][1] * (1 - m)
    a = clamp01(k_in * 2.5)
    r = 16.0
    e = ease_in_out_cubic((t - T_EXP0) / (T_EXP1 - T_EXP0))
    if i == HERO:
        x, y, w, h = lerp(x, 0, e), lerp(y, 0, e), lerp(w, W, e), lerp(h, H, e)
        r = lerp(r, 0, e)
    else:
        s2 = lerp(1.0, 0.82, e)
        cx, cy = x + w / 2, y + h / 2
        w, h = w * s2, h * s2
        x, y = cx - w / 2, cy - h / 2
        a *= 1 - e
    return x, y, w, h, a, r


for n in range(N):
    t = n / FPS
    frames = []
    for i, (_, out) in enumerate(decs):
        raw = out.read(W * H * 3)
        if len(raw) < W * H * 3:
            raise RuntimeError(f"shot {i} ended at frame {n}")
        frames.append(labelled(Image.frombytes("RGB", (W, H), raw), i))
    canvas = Image.new("RGB", (W, H), BG)
    order = [i for i in range(4) if i != HERO] + [HERO]
    for i in order:
        x, y, w, h, a, r = tile_state(i, t)
        if a <= 0.003 or w < 4:
            continue
        iw, ih = int(round(w)), int(round(h))
        tile = frames[i].resize((iw, ih), Image.Resampling.LANCZOS)
        mask = Image.new("L", (iw, ih), 0)
        ImageDraw.Draw(mask).rounded_rectangle([0, 0, iw - 1, ih - 1], int(r), fill=int(255 * a))
        canvas.paste(tile, (int(round(x)), int(round(y))), mask)
    enc_in.write(canvas.tobytes())

for p, out in decs:
    while out.read(W * H * 3 * 8):
        pass
    p.wait()
enc_in.close()
enc.wait()
print("done", OUT, "frames", N)
