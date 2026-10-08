# streamlines.py - Flow past a sphere, as growing streamline tubes (PyVista / VTK).
#
# The velocity field is ideal (potential) flow past a sphere of radius A, plus a
# swirl around the flow axis that fades away from it. Both parts slide along
# the sphere and never pass through it, so the streamlines wrap around it.
#   v = U (1 + A^3 / (2 r^3)) ex - U (3 A^3 x / (2 r^5)) r  +  swirl
# PyVista samples the field on a 3D grid, integrates 120 streamlines from a disc
# of seeds upstream (VTK's Runge-Kutta stream tracer), and turns them into tubes
# colored by speed. Each frame keeps only the part of every line whose
# integration time is below a moving limit, so the tubes grow downstream while
# the camera orbits. Pillow adds the labels; frames are piped to FFmpeg.
#
# Run from this folder (source/tools/pyvista) in Git Bash:
#   uv run --python 3.12 --with pyvista --with pillow python streamlines.py
#   ... python streamlines.py --test 60,150,239   (writes only these frames as PNGs to _work/clips)
# Output: ../../../media/tools/pyvista.mp4 (8 s, 1280x720, 30 fps)

import os
import subprocess
import sys

import numpy as np
import pyvista as pv
from PIL import Image, ImageDraw, ImageFont

OUT = "../../../media/tools/pyvista.mp4"
W, H, FPS, NF = 1280, 720, 30, 240
U, A, SWIRL = 1.0, 0.72, 1.3

# ---- velocity field on a grid ----
grid = pv.ImageData(dimensions=(150, 76, 76), spacing=(6 / 149, 3 / 75, 3 / 75), origin=(-3, -1.5, -1.5))
P = grid.points
x, y, z = P[:, 0], P[:, 1], P[:, 2]
r = np.maximum(np.linalg.norm(P, axis=1), 1e-6)
vel = np.zeros_like(P)
vel[:, 0] = U * (1 + A ** 3 / (2 * r ** 3))
vel -= (U * 3 * A ** 3 * x / (2 * r ** 5))[:, None] * P
fade = SWIRL * np.exp(-(y ** 2 + z ** 2) / 0.9)
vel[:, 1] += -z * fade
vel[:, 2] += y * fade
vel[r < A] = 0
grid["vel"] = vel

NS = 120
ang = np.arange(NS) * 2.39996                               # golden-angle spiral of seeds
rad = np.sqrt(np.linspace(0.03, 1, NS)) * 0.95 + 0.06
seeds = pv.PolyData(np.column_stack([np.full(NS, -2.9), rad * np.cos(ang), rad * np.sin(ang)]))
lines = grid.streamlines_from_source(seeds, vectors="vel", max_length=14.0, integration_direction="forward",
                                     initial_step_length=0.2, max_steps=4000)
lines["speed"] = np.linalg.norm(lines["vel"], axis=1)
TMAX = float(lines["IntegrationTime"].max())
print("streamlines", lines.n_lines, "points", lines.n_points, "max time", round(TMAX, 2))

pv.OFF_SCREEN = True
pl = pv.Plotter(off_screen=True, window_size=(W, H))
pl.set_background("#0b0b10", top="#16142e")
pl.enable_anti_aliasing("ssaa")
sphere = pv.Sphere(radius=A * 0.985, theta_resolution=96, phi_resolution=96)
pl.add_mesh(sphere, color="#f4efe6", pbr=True, metallic=0.0, roughness=0.35, smooth_shading=True)
cmap = ["#1d2a6b", "#2bc4e6", "#f4efe6", "#ffb020", "#ff5a36"]
clim = [float(v) for v in np.percentile(lines["speed"], [2, 98])]   # use the whole ramp
actor = None
pl.add_light(pv.Light(position=(-4, 6, 5), focal_point=(0, 0, 0), intensity=0.9))

BOLD = ImageFont.truetype("C:/Windows/Fonts/bahnschrift.ttf", 34)
SMALL = ImageFont.truetype("C:/Windows/Fonts/bahnschrift.ttf", 20)
MONO = ImageFont.truetype("C:/Windows/Fonts/consola.ttf", 16)
CREAM = (244, 239, 230)

TEST = [int(v) for v in sys.argv[sys.argv.index("--test") + 1].split(",")] if "--test" in sys.argv else None
enc = None if TEST else subprocess.Popen([
    "ffmpeg", "-nostdin", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24",
    "-s", f"{W}x{H}", "-framerate", str(FPS), "-i", "-",
    "-c:v", "libx264", "-crf", "20", "-preset", "slow", "-pix_fmt", "yuv420p",
    "-movflags", "+faststart", "-threads", "8", OUT], stdin=subprocess.PIPE)
for f in TEST or range(NF):
    u = f / (NF - 1)
    grow = min(1.0, u / 0.8)
    grow = grow * grow * (3 - 2 * grow)
    part = lines.clip_scalar(scalars="IntegrationTime", value=max(0.05, grow * TMAX), invert=True)
    if actor is not None:
        pl.remove_actor(actor)
    tubes = part.tube(radius=0.012, n_sides=10)
    actor = pl.add_mesh(tubes, scalars="speed", cmap=cmap, clim=clim, smooth_shading=True,
                        show_scalar_bar=False, pbr=True, metallic=0.1, roughness=0.4)
    a = np.radians(-60 + 95 * (3 * u * u - 2 * u ** 3))
    pl.camera.position = (7.6 * np.sin(a), 2.4 - 1.2 * u, 7.6 * np.cos(a))
    pl.camera.focal_point = (0.15, 0, 0)
    pl.camera.up = (0, 1, 0)
    pl.camera.view_angle = 34
    img = pl.screenshot(return_img=True)
    im = Image.fromarray(img[:, :, :3])
    dr = ImageDraw.Draw(im, "RGBA")
    dr.rectangle((36, 34, 41, 92), fill=(255, 90, 54))
    dr.text((54, 30), "FLOW PAST A SPHERE", font=BOLD, fill=CREAM)
    dr.text((56, 72), "PyVista + VTK: stream tracer, tubes colored by speed", font=SMALL, fill=(200, 198, 210))
    for i, c in enumerate(cmap):
        dr.rectangle((W - 236 + i * 40, H - 58, W - 197 + i * 40, H - 48), fill=c)
    dr.text((W - 236, H - 42), "slow", font=MONO, fill=(170, 168, 185))
    dr.text((W - 36, H - 42), "fast", font=MONO, fill=(170, 168, 185), anchor="ra")
    if enc is None:
        os.makedirs("../../../_work/clips", exist_ok=True)
        im.save(f"../../../_work/clips/pv_{f:03d}.png")
        continue
    assert enc.stdin is not None
    enc.stdin.write(np.asarray(im).tobytes())
    if f % 30 == 0:
        print("frame", f, flush=True)

pl.close()
if enc is not None:
    assert enc.stdin is not None
    enc.stdin.close()
    enc.wait()
    print("done", OUT)
