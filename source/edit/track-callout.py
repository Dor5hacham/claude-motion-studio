# track-callout.py - Motion tracking with a pinned callout.
#
# Source: the Blender shatter clip, slowed to half speed with optical-flow
# interpolation. OpenCV tracks the chrome ball as it flies in, punches through
# the wall and rolls out of frame, and a callout (corner brackets, leader line,
# label with live speed) stays pinned to it:
#   1. first second: OpenCV feature points (Shi-Tomasi corners followed with
#      Lucas-Kanade optical flow) flash over the whole frame, then fade, so you
#      see what "tracking points" are
#   2. the ball is tracked by template matching (normalized cross-correlation)
#      in a search window around a constant-velocity prediction
#   3. when the match score drops (the ball is hidden by shards) the tracker
#      keeps the prediction and the box turns dashed: OCCLUDED, then REACQUIRED
#   4. at the right edge the ball is cut off, so the box turns dashed again
#      (PREDICTED) until it has left the frame
#   5. the motion path stays on screen as a fading trail
#
# How it works: ffmpeg interpolates the clip to 60 fps (minterpolate, played back
# at 30 fps = 0.5x) and decodes it into NumPy; OpenCV tracks; Pillow draws the
# overlay; ffmpeg encodes.
#
# Run from this folder (source/edit) in Git Bash:
#   uv run --with numpy --with pillow --with opencv-python-headless track-callout.py
# Output: ../../media/edit/track-callout.mp4
# Temp:   ../../_work/track-callout/ (the interpolated source, deleted at the end)

import os
import shutil
import subprocess
import sys

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

SRC = "../../media/engine/shatter.mp4"
OUT = "../../media/edit/track-callout.mp4"
TMP = "../../_work/track-callout"
W, H, FPS = 1280, 720, 30
START = (80, 230)              # ball center in the first tracked frame
F0 = 20                        # first tracked frame (60 fps index)
R = 26                         # template half size

os.makedirs(TMP, exist_ok=True)
slow = f"{TMP}/shatter60.mp4"
if not os.path.exists(slow):
    subprocess.run([
        "ffmpeg", "-nostdin", "-v", "error", "-y", "-i", SRC, "-t", "4.05",
        "-vf", "minterpolate=fps=60:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1",
        "-c:v", "libx264", "-crf", "12", "-preset", "fast", "-threads", "8", slow], check=True)
dec = subprocess.run(["ffmpeg", "-nostdin", "-v", "error", "-i", slow, "-f", "rawvideo",
                      "-pix_fmt", "rgb24", "-"], capture_output=True, check=True)
src = np.frombuffer(dec.stdout, np.uint8).reshape(-1, H, W, 3)[:240]
N = len(src)
gray = [cv2.cvtColor(f, cv2.COLOR_RGB2GRAY) for f in src]
print("decoded", N, "frames")

# ---- pass 1: track the ball ----
KEYS = [(20, (80, 230), 26, +1),          # (frame, ball center, template half size, direction)
        (120, (1065, 305), 40, -1),
        (120, (1065, 305), 40, +1)]


def track_from(f, pos, r, step):
    """Template-match the ball from frame f in one direction until the match fails."""
    out = {}
    pos = np.array(pos, np.float32)
    vel = np.zeros(2, np.float32)
    tmpl = gray[f][int(pos[1]) - r:int(pos[1]) + r, int(pos[0]) - r:int(pos[0]) + r].astype(np.float32)
    out[f] = (pos.copy(), 1.0)
    while True:
        f += step
        if f < 0 or f >= N:
            return out
        pred = pos + vel
        s = 50
        if pred[0] < r or pred[1] < r or pred[0] > W - r or pred[1] > H - r:
            return out
        x0, y0 = max(int(pred[0]) - r - s, 0), max(int(pred[1]) - r - s, 0)
        x1, y1 = min(int(pred[0]) + r + s, W), min(int(pred[1]) + r + s, H)
        res = cv2.matchTemplate(gray[f][y0:y1, x0:x1].astype(np.float32), tmpl, cv2.TM_CCOEFF_NORMED)
        _, score, _, loc = cv2.minMaxLoc(res)
        found = np.array([x0 + loc[0] + r, y0 + loc[1] + r], np.float32)
        if score < 0.8 or np.linalg.norm(found - pred) > 30:
            return out
        vel = (found - pos) if len(out) == 1 else vel * 0.5 + (found - pos) * 0.5
        pos = found
        new = gray[f][int(pos[1]) - r:int(pos[1]) + r, int(pos[0]) - r:int(pos[0]) + r]
        if new.shape == tmpl.shape:
            tmpl = tmpl * 0.8 + new.astype(np.float32) * 0.2
        out[f] = (pos.copy(), score)


seen = {}
for f, p, r, step in KEYS:
    for k, (q, sc) in track_from(f, p, r, step).items():
        seen[k] = (q, sc, r)
fr = sorted(seen)
print("tracked", len(fr), "frames:", fr[0], "to", fr[-1])
# Bridge the occlusion: cubic Hermite between the last and first good frames,
# using the velocities on both sides.
gaps = [(a, b) for a, b in zip(fr, fr[1:]) if b - a > 1]
track = {k: (v[0], v[2], "TRACKING") for k, v in seen.items()}
for a, b in gaps:
    pa, pb = seen[a][0], seen[b][0]
    va = pa - seen[a - 1][0]
    vb = seen[b + 1][0] - pb
    n = b - a
    for k in range(a + 1, b):
        t = (k - a) / n
        h00, h10 = 2 * t ** 3 - 3 * t ** 2 + 1, t ** 3 - 2 * t ** 2 + t
        h01, h11 = -2 * t ** 3 + 3 * t ** 2, t ** 3 - t ** 2
        q = h00 * pa + h10 * n * va + h01 * pb + h11 * n * vb
        track[k] = (q, seen[a][2] + (seen[b][2] - seen[a][2]) * t, "OCCLUDED")
    for k in range(b, min(b + 18, fr[-1] + 1)):
        if track[k][2] == "TRACKING":
            track[k] = (track[k][0], track[k][1], "REACQUIRED")
FIRST, LAST = fr[0], fr[-1]
# Past the last match the ball is cut by the frame edge: predict it out of frame.
q, r = track[LAST][0], track[LAST][1]
v = track[LAST][0] - track[LAST - 1][0]
while q[0] - r * 1.3 < W and LAST < N - 1:
    LAST += 1
    q = q + v
    track[LAST] = (q, r, "PREDICTED")
print("gaps", gaps, "bridged", sum(b - a - 1 for a, b in gaps))
if "--track" in sys.argv:
    for f in sorted(track):
        if f % 4 == 0:
            q, r, st = track[f]
            print(f, int(q[0]), int(q[1]), r, st)
    sys.exit()

# ---- pass 2: feature points for the intro (Shi-Tomasi corners + Lucas-Kanade) ----
PTS_END = 42
pts = cv2.goodFeaturesToTrack(gray[0], maxCorners=260, qualityLevel=0.01, minDistance=14)
paths = [[p] for p in pts.reshape(-1, 2)]
alive = np.ones(len(paths), bool)
cur = pts
for f in range(1, PTS_END):
    nxt, st, _ = cv2.calcOpticalFlowPyrLK(gray[f - 1], gray[f], cur, None, winSize=(21, 21), maxLevel=3)
    for i, (p, ok) in enumerate(zip(nxt.reshape(-1, 2), st.ravel())):
        alive[i] &= bool(ok)
        paths[i].append(p if alive[i] else paths[i][-1])
    cur = nxt

# ---- pass 3: draw ----
BOLD = ImageFont.truetype("C:/Windows/Fonts/bahnschrift.ttf", 34)
LAB = ImageFont.truetype("C:/Windows/Fonts/bahnschrift.ttf", 24)
SMALL = ImageFont.truetype("C:/Windows/Fonts/bahnschrift.ttf", 20)
MONO = ImageFont.truetype("C:/Windows/Fonts/consola.ttf", 17)
CREAM = (244, 239, 230)
CYAN = (43, 196, 230)
STATE_COL = {"TRACKING": (80, 220, 140), "OCCLUDED": (255, 176, 32), "REACQUIRED": CYAN,
             "PREDICTED": (255, 176, 32)}


def clamp01(x):
    return min(1.0, max(0.0, x))


def ease_out(x):
    return 1 - (1 - clamp01(x)) ** 3


def brackets(dr, cx, cy, r, col, dashed=False, width=3):
    """Corner brackets around (cx, cy); dashed draws short broken edges instead."""
    L = r * 0.55
    for sx in (-1, 1):
        for sy in (-1, 1):
            x, y = cx + sx * r, cy + sy * r
            dr.line((x, y, x - sx * L, y), fill=col, width=width)
            dr.line((x, y, x, y - sy * L), fill=col, width=width)
    if dashed:
        for k in range(-2, 3):
            o = k * r * 0.3
            for a, b in (((cx + o - 4, cy - r), (cx + o + 4, cy - r)), ((cx + o - 4, cy + r), (cx + o + 4, cy + r)),
                         ((cx - r, cy + o - 4), (cx - r, cy + o + 4)), ((cx + r, cy + o - 4), (cx + r, cy + o + 4))):
                dr.line((a, b), fill=col, width=2)


enc = subprocess.Popen([
    "ffmpeg", "-nostdin", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24",
    "-s", f"{W}x{H}", "-framerate", str(FPS), "-i", "-",
    "-c:v", "libx264", "-crf", "20", "-preset", "slow", "-pix_fmt", "yuv420p",
    "-movflags", "+faststart", "-threads", "8", OUT], stdin=subprocess.PIPE)
assert enc.stdin is not None
enc_in = enc.stdin

label = None                   # smoothed label anchor (lags the ball a little)
side = 1.0                     # +1 label right of the ball, -1 left
n_tracked = sum(1 for v in track.values() if v[2] in ("TRACKING", "REACQUIRED"))
n_bridged = sum(1 for v in track.values() if v[2] == "OCCLUDED")
for f in range(N):
    im = Image.fromarray(src[f])
    dr = ImageDraw.Draw(im, "RGBA")

    # Feature points with short tails, fading out.
    fa = 1 - clamp01((f - 26) / (PTS_END - 26)) if f < PTS_END else 0
    if fa > 0:
        for i, path in enumerate(paths):
            if not alive[i]:
                continue
            tail = path[max(0, f - 6):f + 1]
            if len(tail) > 1:
                dr.line([tuple(p) for p in tail], fill=CYAN + (int(150 * fa),), width=2)
            x, y = path[f]
            dr.ellipse((x - 3, y - 3, x + 3, y + 3), fill=CYAN + (int(230 * fa),))

    # Fading motion path of the tracked ball.
    hist = [k for k in range(max(FIRST, f - 70), min(f, LAST) + 1) if k in track]
    end_fade = 1 - clamp01((f - LAST - 20) / 30)
    for a, b in zip(hist, hist[1:]):
        al = (1 - (f - b) / 70) * end_fade
        col = STATE_COL[track[b][2]]
        dr.line((tuple(track[a][0]), tuple(track[b][0])), fill=col + (int(200 * al),), width=3)

    if FIRST <= f <= LAST:
        (cx, cy), r, st = track[f]
        col = STATE_COL[st]
        lock = ease_out((f - FIRST) / 12)
        rb = r * (1.25 + 1.6 * (1 - lock))
        brackets(dr, cx, cy, rb, col + (int(255 * lock),), dashed=(st in ("OCCLUDED", "PREDICTED")))
        dr.ellipse((cx - 3, cy - 3, cx + 3, cy + 3), fill=col)
        # Label: offset to one side, flips sides near the right edge, eased follow.
        want = -1.0 if cx > 820 else 1.0
        side += (want - side) * 0.12
        target = np.array([cx + side * (rb + 150), cy - rb - 110])
        target = np.clip(target, (145, 132), (W - 145, H - 160))
        label = target if label is None else label + (target - label) * 0.35
        lx, ly = label
        bw, bh = 250, 112
        bx = lx - bw / 2
        la = ease_out((f - FIRST - 6) / 10)
        if la > 0:
            corner = (cx + np.sign(side) * rb, cy - rb)
            attach = (bx + (bw if side < 0 else 0), ly + bh)
            dr.line((corner, attach), fill=CREAM + (int(220 * la),), width=2)
            dr.rounded_rectangle((bx, ly, bx + bw, ly + bh), 8, fill=(11, 11, 16, int(215 * la)),
                                 outline=col + (int(255 * la),), width=2)
            if f > 0 and f - 1 in track:
                v = np.linalg.norm(track[f][0] - track[f - 1][0]) * FPS
            else:
                v = 0.0
            dr.text((bx + 16, ly + 10), "CHROME BALL", font=LAB, fill=CREAM + (int(255 * la),))
            dr.text((bx + 16, ly + 44), f"x {cx:6.0f}   y {cy:4.0f}", font=MONO, fill=(190, 188, 205, int(255 * la)))
            dr.text((bx + 16, ly + 66), f"v {v:6.0f} px/s", font=MONO, fill=(190, 188, 205, int(255 * la)))
            dr.text((bx + 16, ly + 88), st, font=MONO, fill=col + (int(255 * la),))
    elif f > LAST:
        a = 1 - clamp01((f - LAST - 30) / 15)
        if a > 0 and label is not None:
            lx, ly = label
            dr.rounded_rectangle((lx - 125, ly, lx + 125, ly + 44), 8, fill=(11, 11, 16, int(215 * a)),
                                 outline=CREAM + (int(200 * a),), width=2)
            dr.text((lx, ly + 10), "EXITED FRAME", font=LAB, fill=CREAM + (int(255 * a),), anchor="ma")

    dr.rounded_rectangle((24, 22, 560, 112), 10, fill=(11, 11, 16, 170))
    dr.rectangle((36, 36, 41, 96), fill=(255, 90, 54))
    dr.text((54, 30), "MOTION TRACKING", font=BOLD, fill=CREAM)
    if f < PTS_END:
        sub = "feature points: Shi-Tomasi + Lucas-Kanade flow"
    elif f <= LAST + 20:
        sub = "template match, callout pinned to the track"
    else:
        sub = f"{n_tracked} frames tracked, {n_bridged} bridged"
    dr.text((56, 74), sub, font=SMALL, fill=(200, 198, 210))
    dr.text((W - 36, H - 40), f"frame {f:03d}   0.5x", font=MONO, fill=(170, 168, 185), anchor="ra")
    enc_in.write(np.asarray(im).tobytes())

enc_in.close()
enc.wait()
if "--keep" not in sys.argv:
    shutil.rmtree(TMP, ignore_errors=True)
print("done", OUT)
