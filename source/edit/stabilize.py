# stabilize.py - Video stabilization, before and after, with the camera path.
#
# Two shots (the jelly cubes and the 3D logo) get a synthetic handheld shake:
# smooth random sway and jitter of up to about 50 px plus a degree of roll.
# OpenCV then stabilizes them without knowing the shake:
#   1. track about 300 corners from each frame to the next (Shi-Tomasi corners
#      + Lucas-Kanade optical flow)
#   2. fit a similarity transform per frame pair with RANSAC
#      (estimateAffinePartial2D) and keep its x, y and roll
#   3. add these up into the camera path, smooth the path with a moving
#      average, and move each frame by (smooth path - raw path)
#   4. zoom in 15% to hide the moved edges
# The shots' own camera moves (a push-in, a slow orbit) are slow, so they
# survive the smoothing; only the shake goes. The graph shows the raw x path
# (gray), the smooth path (coral) and the playhead.
#
# How it works: ffmpeg decodes the shots into NumPy; OpenCV shakes, tracks and
# warps; Pillow draws the layout and graph; ffmpeg encodes.
#
# Run from this folder (source/edit) in Git Bash:
#   uv run --with numpy --with pillow --with opencv-python-headless stabilize.py
# Output: ../../media/edit/stabilize.mp4
# Temp:   none on disk.

import subprocess

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

OUT = "../../media/edit/stabilize.mp4"
SHOTS = [("../../media/engine/softbody.mp4", 0.0, 5.0), ("../../media/engine/3d-logo.mp4", 1.0, 4.0)]
W, H, FPS = 1280, 720, 30
PW, PH = 624, 351                       # panel size
SMOOTH = 15                             # moving-average radius in frames
ZOOM = 1.15
rng = np.random.default_rng(21)


def decode(path, start, dur):
    r = subprocess.run(["ffmpeg", "-nostdin", "-v", "error", "-ss", str(start), "-t", str(dur), "-i", path,
                        "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], capture_output=True, check=True)
    return np.frombuffer(r.stdout, np.uint8).reshape(-1, H, W, 3)


def smooth_noise(n, sigma):
    x = rng.standard_normal(n + 6 * sigma)
    k = np.exp(-0.5 * (np.arange(-3 * sigma, 3 * sigma + 1) / sigma) ** 2)
    return np.convolve(x, k / np.sqrt((k ** 2).sum()), "valid")[:n]


def warp(img, dx, dy, da, zoom=1.0):
    m = cv2.getRotationMatrix2D((W / 2, H / 2), np.degrees(da), zoom)
    m[:, 2] += (dx, dy)
    return cv2.warpAffine(img, m, (W, H), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)


shaky, stable, raw_x, smooth_x, lengths = [], [], [], [], []
for path, start, dur in SHOTS:
    frames = decode(path, start, dur)
    n = len(frames)
    sx = smooth_noise(n, 2) * 12 + smooth_noise(n, 10) * 18
    sy = smooth_noise(n, 2) * 10 + smooth_noise(n, 10) * 14
    sa = np.radians(smooth_noise(n, 4) * 1.0)
    shot = [warp(f, sx[i], sy[i], sa[i]) for i, f in enumerate(frames)]
    # Frame-to-frame motion from tracked corners.
    motion = [(0.0, 0.0, 0.0)]
    gray = [cv2.cvtColor(f, cv2.COLOR_RGB2GRAY) for f in shot]
    for i in range(1, n):
        p0 = cv2.goodFeaturesToTrack(gray[i - 1], maxCorners=300, qualityLevel=0.01, minDistance=20)
        p1, st, _ = cv2.calcOpticalFlowPyrLK(gray[i - 1], gray[i], p0, None)
        ok = st.ravel() == 1
        m, _ = cv2.estimateAffinePartial2D(p0[ok], p1[ok], method=cv2.RANSAC)
        if m is None:
            motion.append((0.0, 0.0, 0.0))
        else:
            motion.append((m[0, 2], m[1, 2], np.arctan2(m[1, 0], m[0, 0])))
    traj = np.cumsum(np.array(motion), axis=0)
    pad = np.pad(traj, ((SMOOTH, SMOOTH), (0, 0)), mode="edge")
    kern = np.ones(2 * SMOOTH + 1) / (2 * SMOOTH + 1)
    sm = np.stack([np.convolve(pad[:, k], kern, "valid") for k in range(3)], 1)
    corr = sm - traj
    for i in range(n):
        shaky.append(warp(shot[i], 0, 0, 0, ZOOM))
        stable.append(warp(shot[i], corr[i, 0] * ZOOM, corr[i, 1] * ZOOM, -corr[i, 2], ZOOM))
    raw_x += list(traj[:, 0] - traj[0, 0])
    smooth_x += list(sm[:, 0] - traj[0, 0])
    lengths.append(n)
    print(path.split("/")[-1], n, "frames; frame-to-frame x motion (std):",
          f"{np.std(np.diff(traj[:, 0])):.2f} px shaky -> {np.std(np.diff(sm[:, 0])):.2f} px stabilized")
N = len(shaky)
raw_x, smooth_x = np.array(raw_x), np.array(smooth_x)

BOLD = ImageFont.truetype("C:/Windows/Fonts/bahnschrift.ttf", 32)
LAB = ImageFont.truetype("C:/Windows/Fonts/bahnschrift.ttf", 22)
MONO = ImageFont.truetype("C:/Windows/Fonts/consola.ttf", 15)
CREAM, CORAL, GRAY = (244, 239, 230), (255, 90, 54), (150, 148, 165)
X1, X2, PY = 12, W - 12 - PW, 84
GX0, GY0, GW, GH = 60, 500, W - 120, 170
lo, hi = min(raw_x.min(), smooth_x.min()) - 5, max(raw_x.max(), smooth_x.max()) + 5


def gpt(i, v):
    return GX0 + i / (N - 1) * GW, GY0 + GH - (v - lo) / (hi - lo) * GH


base = Image.new("RGB", (W, H), (11, 11, 16))
bd = ImageDraw.Draw(base)
bd.rectangle((36, 26, 41, 66), fill=CORAL)
bd.text((54, 22), "VIDEO STABILIZATION", font=BOLD, fill=CREAM)
bd.text((W - 36, 34), "OpenCV: LK features, RANSAC similarity, smoothed path", font=MONO, fill=GRAY, anchor="ra")
bd.rounded_rectangle((GX0 - 24, GY0 - 34, GX0 + GW + 24, GY0 + GH + 22), 10, fill=(18, 18, 26))
bd.text((GX0, GY0 - 28), "camera x path (px)", font=MONO, fill=GRAY)
bd.line([gpt(i, v) for i, v in enumerate(raw_x)], fill=GRAY, width=2)
bd.line([gpt(i, v) for i, v in enumerate(smooth_x)], fill=CORAL, width=3)
cut = lengths[0] - 1
bd.line((gpt(cut, lo)[0], GY0, gpt(cut, lo)[0], GY0 + GH), fill=(60, 60, 75), width=1)
bd.text((GX0 + GW, GY0 - 28), "raw (shaky)", font=MONO, fill=GRAY, anchor="ra")
bd.text((GX0 + GW - 110, GY0 - 28), "smoothed", font=MONO, fill=CORAL, anchor="ra")

enc = subprocess.Popen([
    "ffmpeg", "-nostdin", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24",
    "-s", f"{W}x{H}", "-framerate", str(FPS), "-i", "-",
    "-c:v", "libx264", "-crf", "21", "-preset", "slow", "-pix_fmt", "yuv420p",
    "-movflags", "+faststart", "-threads", "8", OUT], stdin=subprocess.PIPE)
assert enc.stdin is not None
enc_in = enc.stdin

for f in range(N):
    im = base.copy()
    im.paste(Image.fromarray(cv2.resize(shaky[f], (PW, PH), interpolation=cv2.INTER_AREA)), (X1, PY))
    im.paste(Image.fromarray(cv2.resize(stable[f], (PW, PH), interpolation=cv2.INTER_AREA)), (X2, PY))
    dr = ImageDraw.Draw(im, "RGBA")
    for x, name, col in ((X1, "SHAKY INPUT", GRAY), (X2, "STABILIZED", CORAL)):
        dr.rounded_rectangle((x + 12, PY + 12, x + 24 + dr.textlength(name, font=LAB) + 12, PY + 48), 6,
                             fill=(11, 11, 16, 190))
        dr.text((x + 24, PY + 16), name, font=LAB, fill=col)
    px, py = gpt(f, raw_x[f])
    _, qy = gpt(f, smooth_x[f])
    dr.line((px, GY0, px, GY0 + GH), fill=(255, 176, 32), width=2)
    dr.ellipse((px - 5, py - 5, px + 5, py + 5), fill=GRAY)
    dr.ellipse((px - 6, qy - 6, px + 6, qy + 6), fill=CORAL)
    enc_in.write(np.asarray(im).tobytes())

enc_in.close()
enc.wait()
print("done", OUT)
