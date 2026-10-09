# Copyright (c) 2026 Dor5hacham d5shacham@gmail.com. All rights reserved.
# SPDX-License-Identifier: Proprietary

# video-wall.py - A curved 3D wall of playing clips; the camera glides along it
# and flies into one card until it fills the frame.
#
# 27 cards (3 rows x 9 columns, 16:9) sit on the inside of a cylinder around
# the camera, each playing a different clip from the catalog. A pinhole camera
# projects each card's four corners; OpenCV's warpPerspective (a homography)
# maps the clip frame onto that quad, and cards are drawn far to near so near
# ones cover far ones. Depth fog darkens the far cards, every card gets a thin
# frame and a soft floor reflection.
# The move: the wall fades up, the camera trucks sideways with a slow yaw, then
# eases into the center card; at the end that card fills the screen exactly and
# its clip plays at full resolution.
#
# How it works: ffmpeg decodes each clip at 320x180 (the hero at 1280x720) into
# NumPy; NumPy does the camera math; OpenCV warps; Pillow draws the label;
# ffmpeg encodes.
#
# Run from this folder (source/edit) in Git Bash:
#   uv run --with numpy --with pillow --with opencv-python-headless video-wall.py
# Output: ../../media/edit/video-wall.mp4
# Temp:   none on disk.

import subprocess

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

OUT = "../../media/edit/video-wall.mp4"
W, H, FPS = 1280, 720, 30
NOUT = 8 * FPS
CLIPS = ("engine/3d-logo engine/cloth engine/cycles-photoreal engine/geometry-nodes engine/grease-pencil "
         "engine/liquid engine/ocean engine/particles-fur engine/shatter engine/smoke-fire engine/softbody "
         "engine/unreal-niagara tools/hyperframes tools/manim tools/motion-canvas tools/remotion tools/threejs "
         "tools/webgpu edit/boomerang edit/color-grade edit/datamosh edit/speed-ramp edit/split-screen "
         "clips/instancing clips/raymarch-sdf clips/shape-layers clips/kinetic-type").split()
ROWS, COLS = 3, 9
HERO = (1, 4)                                   # row, column of the card we fly into
HERO_CLIP = "engine/liquid"
CW, CH = 1.6, 0.9                               # card size (world units)
RADIUS = 6.0
DANG = np.radians(17.0)                         # angle between columns
FOCAL = 1.15 * W                                # pinhole focal length in pixels


def decode(name, size, frames):
    r = subprocess.run(["ffmpeg", "-nostdin", "-v", "error", "-i", f"../../media/{name}.mp4",
                        "-vf", f"fps=30,scale={size[0]}:{size[1]}:flags=area", "-frames:v", str(frames),
                        "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], capture_output=True, check=True)
    return np.frombuffer(r.stdout, np.uint8).reshape(-1, size[1], size[0], 3)


order = [c for c in CLIPS if c != HERO_CLIP]
cards = {}
k = 0
for r in range(ROWS):
    for c in range(COLS):
        if (r, c) == HERO:
            cards[(r, c)] = HERO_CLIP
        else:
            cards[(r, c)] = order[k % len(order)]
            k += 1
thumbs = {name: decode(name, (320, 180), NOUT) for name in set(cards.values())}
hero_full = decode(HERO_CLIP, (W, H), NOUT)
print("decoded", len(thumbs), "clips")


def corners(r, c):
    """World corners (TL, TR, BR, BL) of a card on the cylinder, facing its center."""
    a = (c - (COLS - 1) / 2) * DANG
    y = ((ROWS - 1) / 2 - r) * (CH + 0.14)
    cx, cz = RADIUS * np.sin(a), RADIUS * np.cos(a)
    tx, tz = np.cos(a), -np.sin(a)                       # tangent along the wall
    h = CW / 2
    return np.array([[cx - tx * h, y + CH / 2, cz - tz * h], [cx + tx * h, y + CH / 2, cz + tz * h],
                     [cx + tx * h, y - CH / 2, cz + tz * h], [cx - tx * h, y - CH / 2, cz - tz * h]])


def project(P, cam, yaw):
    """Pinhole projection with the camera at cam, turned by yaw around the vertical axis."""
    d = P - cam
    cy, sy = np.cos(yaw), np.sin(yaw)
    x = d[:, 0] * cy - d[:, 2] * sy
    z = d[:, 0] * sy + d[:, 2] * cy
    return np.column_stack([W / 2 + FOCAL * x / z, H / 2 - FOCAL * d[:, 1] / z]), z


def clamp01(x):
    return min(1.0, max(0.0, x))


def ease(a, b, x):
    k = clamp01((x - a) / (b - a))
    return k * k * (3 - 2 * k)


# Camera keys: a sideways truck with a slow yaw, then a fly-in to the hero card.
hc = corners(*HERO).mean(0)
ha = (HERO[1] - (COLS - 1) / 2) * DANG
fill_dist = FOCAL * CW / W                               # distance where the card fills the width
hero_cam = hc - np.array([np.sin(ha), 0, np.cos(ha)]) * fill_dist

BOLD = ImageFont.truetype("C:/Windows/Fonts/bahnschrift.ttf", 34)
SMALL = ImageFont.truetype("C:/Windows/Fonts/bahnschrift.ttf", 20)
CREAM = (244, 239, 230)
BG = np.zeros((H, W, 3), np.float32)
BG[:] = np.linspace(0.07, 0.03, H)[:, None, None] * np.array([1.0, 0.95, 1.4])

enc = subprocess.Popen([
    "ffmpeg", "-nostdin", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24",
    "-s", f"{W}x{H}", "-framerate", str(FPS), "-i", "-",
    "-c:v", "libx264", "-crf", "21", "-preset", "slow", "-pix_fmt", "yuv420p",
    "-movflags", "+faststart", "-threads", "8", OUT], stdin=subprocess.PIPE)
assert enc.stdin is not None
enc_in = enc.stdin

for f in range(NOUT):
    t = f / FPS
    truck = ease(0.0, 4.6, t)
    fly = ease(4.2, 7.0, t)
    glide_cam = np.array([1.6 - 3.2 * truck, 0.25 - 0.25 * truck, -1.2])
    glide_yaw = np.radians(14 - 26 * truck)
    cam = glide_cam * (1 - fly) + hero_cam * fly
    yaw = glide_yaw * (1 - fly) + ha * fly
    frame = BG.copy()
    quads = []
    for (r, c), name in cards.items():
        P = corners(r, c)
        q, z = project(P, cam, yaw)
        if (z <= 0.05).any():
            continue
        quads.append((z.mean(), r, c, name, q))
    quads.sort(key=lambda e: -e[0])
    for depth, r, c, name, q in quads:
        if q[:, 0].max() < 0 or q[:, 0].min() > W or q[:, 1].max() < 0 or q[:, 1].min() > H:
            continue
        hero_big = (r, c) == HERO and (q[1, 0] - q[0, 0]) > 500
        # The hero clip starts 3 s late so its last frame lands on the last frame of the edit.
        idx = max(0, f - (NOUT - len(hero_full))) if (r, c) == HERO else f % len(thumbs[name])
        src = hero_full[idx] if hero_big else thumbs[name][min(idx, len(thumbs[name]) - 1)]
        sh, sw = src.shape[:2]
        S = np.float32([[0, 0], [sw, 0], [sw, sh], [0, sh]])
        M = cv2.getPerspectiveTransform(S, q.astype(np.float32))
        fog = np.exp(-max(0.0, depth - 2.0) * 0.09) * ease(0.0, 0.8, t + 0.25 * ((c * 7 + r * 3) % 5) / 5)
        warped = cv2.warpPerspective(src, M, (W, H), flags=cv2.INTER_LINEAR).astype(np.float32) / 255
        mask = cv2.warpPerspective(np.ones((sh, sw), np.float32), M, (W, H), flags=cv2.INTER_LINEAR)[..., None]
        frame = frame * (1 - mask * fog) + warped * mask * fog
        # Floor reflection: the bottom row mirrored under itself, faint.
        if r == ROWS - 1 and not hero_big:
            Pm = P.copy()
            Pm[:, 1] = 2 * (P[3, 1] - 0.07) - P[:, 1]
            qm, zm = project(Pm[[3, 2, 1, 0]], cam, yaw)
            if (zm > 0.05).all():
                Mm = cv2.getPerspectiveTransform(S, qm.astype(np.float32))
                wm = cv2.warpPerspective(src, Mm, (W, H)).astype(np.float32) / 255
                mm = cv2.warpPerspective(np.ones((sh, sw), np.float32), Mm, (W, H))[..., None]
                frame = frame + wm * mm * 0.16 * fog
        if not hero_big:
            cv2.polylines(frame, [q.astype(np.int32)], True, (0.95 * fog, 0.93 * fog, 0.9 * fog), 1, cv2.LINE_AA)
    im = Image.fromarray((np.clip(frame, 0, 1) * 255).astype(np.uint8))
    dr = ImageDraw.Draw(im, "RGBA")
    a = 1 - ease(5.6, 6.4, t)
    if a > 0:
        dr.rounded_rectangle((24, H - 120, 600, H - 28), 10, fill=(11, 11, 16, int(185 * a)))
        dr.rectangle((36, H - 104, 41, H - 40), fill=(255, 90, 54, int(255 * a)))
        dr.text((54, H - 110), "3D VIDEO WALL", font=BOLD, fill=CREAM + (int(255 * a),))
        dr.text((56, H - 66), "27 playing clips, homography per card, one camera", font=SMALL,
                fill=(200, 198, 210, int(255 * a)))
    enc_in.write(np.asarray(im).tobytes())
    if f % 30 == 0:
        print("frame", f, flush=True)

enc_in.close()
enc.wait()
print("done", OUT)
