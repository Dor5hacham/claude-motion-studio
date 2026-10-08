# slit-scan.py - Slit-scan time displacement: every pixel shows a different
# moment of the clip, so motion bends into elastic shapes.
#
# Source: the Three.js clip (glass knot over rippling columns, orbit camera).
# A delay map says how far in the past each pixel looks, in frames:
#   1. rows:   the top of the frame is "now", the bottom is 2 s ago, so the
#              orbiting columns bend into curves
#   2. radial: the center is "now", the edges lag, so the scene swirls
#   3. waves:  a moving sine pattern of delays ripples through the picture
# The maps cross-fade into each other and the delay strength eases in at the
# start and back to zero at the end. Each output pixel blends the two source
# frames around its fractional delay, so there are no stair-step bands.
# A small inset shows the live delay map (white = now, dark = the past).
#
# How it works: ffmpeg decodes the clip (cropped to remove its label) into one
# NumPy array of frames; for each output frame NumPy gathers every pixel from
# its own source frame; Pillow draws the labels and the inset; ffmpeg encodes.
#
# Run from this folder (source/edit) in Git Bash:
#   uv run --with numpy --with pillow slit-scan.py
# Output: ../../media/edit/slit-scan.mp4
# Temp:   none on disk (frames are piped between processes).

import subprocess

import numpy as np
from PIL import Image, ImageDraw, ImageFont

SRC = "../../media/tools/threejs.mp4"
OUT = "../../media/edit/slit-scan.mp4"
W, H, FPS = 1280, 720, 30
DMAX = 60.0                    # deepest delay in frames (2 s)

dec = subprocess.run([
    "ffmpeg", "-nostdin", "-v", "error", "-i", SRC,
    "-vf", "crop=1088:612:96:0,scale=1280:720:flags=lanczos",
    "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], capture_output=True, check=True)
src = np.frombuffer(dec.stdout, np.uint8).reshape(-1, H, W, 3)
N = len(src)
print("decoded", N, "frames")


def clamp01(x):
    return min(1.0, max(0.0, x))


def smooth(a, b, x):
    k = clamp01((x - a) / (b - a))
    return k * k * (3 - 2 * k)


yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
ROWS = yy / (H - 1)
RAD = np.hypot((xx - W / 2) / (W / 2), (yy - H / 2) / (W / 2))
RAD = RAD / RAD.max()


def delay_map(t):
    """Delay in frames for every pixel at output time t (seconds)."""
    waves = 0.5 + 0.5 * np.sin(xx / W * 2 * np.pi * 1.5 + yy / H * 2 * np.pi * 0.6 - t * 3.2)
    k1 = smooth(2.9, 3.5, t)
    k2 = smooth(4.8, 5.3, t)
    m = ROWS * (1 - k1) + RAD * k1
    m = m * (1 - k2) + waves * k2
    # Eased so the delay never reaches back before the first frame.
    strength = DMAX * smooth(0.4, 2.3, t) * (1 - smooth(6.1, 6.95, t))
    return m * strength, (1 - k1, k1 * (1 - k2), k2)


BOLD = ImageFont.truetype("C:/Windows/Fonts/bahnschrift.ttf", 34)
SMALL = ImageFont.truetype("C:/Windows/Fonts/bahnschrift.ttf", 20)
MONO = ImageFont.truetype("C:/Windows/Fonts/consola.ttf", 16)
CREAM = (244, 239, 230)
CORAL = (255, 90, 54)
NAMES = ["ROWS: top is now, bottom is 2 s ago",
         "RADIAL: center is now, edges lag",
         "WAVES: a moving sine of delays"]
IW, IH = 224, 126
IX, IY = W - IW - 36, 36
ys = np.linspace(0, H - 1, IH).astype(int)
xs = np.linspace(0, W - 1, IW).astype(int)

enc = subprocess.Popen([
    "ffmpeg", "-nostdin", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24",
    "-s", f"{W}x{H}", "-framerate", str(FPS), "-i", "-",
    "-c:v", "libx264", "-crf", "20", "-preset", "slow", "-pix_fmt", "yuv420p",
    "-movflags", "+faststart", "-threads", "8", OUT], stdin=subprocess.PIPE)
assert enc.stdin is not None
enc_in = enc.stdin

Yi, Xi = yy.astype(np.intp), xx.astype(np.intp)
for n in range(N):
    t = n / FPS
    d, weights = delay_map(t)
    pos = np.clip(n - d, 0, N - 1)
    i0 = np.floor(pos).astype(np.intp)
    i1 = np.minimum(i0 + 1, N - 1)
    fr = (pos - i0)[..., None]
    out = src[i0, Yi, Xi].astype(np.float32) * (1 - fr) + src[i1, Yi, Xi].astype(np.float32) * fr
    im = Image.fromarray(out.astype(np.uint8))
    dr = ImageDraw.Draw(im, "RGBA")

    # Inset: the live delay map, white = now, dark = DMAX frames ago.
    inset = (255 - np.clip(d[np.ix_(ys, xs)] / DMAX, 0, 1) * 215).astype(np.uint8)
    dr.rectangle((IX - 3, IY - 3, IX + IW + 2, IY + IH + 30), fill=(11, 11, 16, 200))
    im.paste(Image.fromarray(inset).convert("RGB"), (IX, IY))
    dr.text((IX + 4, IY + IH + 6), "DELAY MAP", font=MONO, fill=CREAM)
    dr.text((IX + IW - 4, IY + IH + 6), f"max {d.max() / FPS:.2f} s", font=MONO,
            fill=(180, 178, 195), anchor="ra")

    dr.rounded_rectangle((24, H - 120, 500, H - 28), 10, fill=(11, 11, 16, 185))
    dr.rectangle((36, H - 104, 41, H - 40), fill=CORAL)
    dr.text((54, H - 110), "SLIT-SCAN", font=BOLD, fill=CREAM)
    name = NAMES[int(np.argmax(weights))] if d.max() > 0.5 else "SOURCE: every pixel shows the same moment"
    dr.text((56, H - 66), name, font=SMALL, fill=(200, 198, 210))
    enc_in.write(np.asarray(im).tobytes())
    if n % 30 == 0:
        print("frame", n, flush=True)

enc_in.close()
enc.wait()
print("done", OUT)
