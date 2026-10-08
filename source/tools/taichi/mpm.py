# mpm.py - Water, jelly and snow colliding: a 2D MLS-MPM simulation in Taichi,
# simulated and rendered on the GPU through Taichi's Vulkan backend.
#
# Material point method (MPM): particles carry mass, velocity and a deformation
# gradient F; every substep they scatter to a background grid (P2G), the grid
# applies gravity and walls, and the particles gather the new velocity back
# (G2P). One solver handles all three materials:
#   water: no shear stiffness, F reset to a pure volume change
#   jelly: elastic (fixed corotated), keeps its shape and wobbles
#   snow:  elastic with clamped singular values, so it hardens and fractures
# The renderer splats every particle as a small Gaussian into one density
# buffer per material, then shades each buffer as a surface (threshold,
# normal from the density gradient, light and rim). Labels are drawn with
# Pillow and frames are piped to FFmpeg.
#
# Run from this folder (source/tools/taichi) in Git Bash:
#   uv run --python 3.12 --with taichi --with numpy --with pillow python mpm.py
#   ... python mpm.py --test 30,90,150,210,265   (writes only these frames as PNGs)
# Output: ../../../media/tools/taichi-mpm.mp4
import os
import subprocess
import sys

import numpy as np
import taichi as ti
from PIL import Image, ImageDraw, ImageFont

ti.init(arch=ti.vulkan, random_seed=7)

OUT = "../../../media/tools/taichi-mpm.mp4"
TEST_DIR = "../../../_work/clips"
W, H, FPS = 1280, 720, 30
NF = 9 * FPS
S = H                                   # pixels per simulation unit
NX, NY = 320, 230                       # grid cells; the screen shows the lower 180 rows
dx = 1.0 / 180
inv_dx = 180.0
SUB = 64                                # substeps per video frame
dt = 4e-3 / SUB
p_vol = (dx * 0.5) ** 2
p_mass = p_vol
E, nu = 5e3, 0.2
mu_0, la_0 = E / (2 * (1 + nu)), E * nu / ((1 + nu) * (1 - 2 * nu))
GRAVITY = 30.0
WATER, JELLY, SNOW = 0, 1, 2

# ---- scene: bodies are (material, shape, params, spawn frame, velocity, label) ----
BODIES = [
    (WATER, "box", (0.04, 0.03, 0.46, 0.64), 0, (0.0, 0.0), "WATER"),
    (JELLY, "rbox", (0.98, 0.03, 1.26, 0.31), 0, (0.0, 0.0), "JELLY"),
    (SNOW, "disc", (1.52, 0.66, 0.12), 0, (-0.9, 0.0), "SNOW"),
    (JELLY, "disc", (0.40, 0.78, 0.085), 75, (1.2, -0.4), "JELLY"),
    (SNOW, "box", (1.02, 0.70, 1.42, 0.81), 150, (0.0, -0.4), "SNOW"),
    (JELLY, "rbox", (1.40, 0.66, 1.60, 0.81), 200, (-1.3, 0.2), "JELLY"),
]


def sample(shape, prm):
    """Jittered grid of rest positions (2 particles per cell per axis) inside a shape."""
    h = dx * 0.5
    if shape == "disc":
        cx, cy, r = prm
        x0, y0, x1, y1 = cx - r, cy - r, cx + r, cy + r
    else:
        x0, y0, x1, y1 = prm
    gx, gy = np.meshgrid(np.arange(x0 + h / 2, x1, h), np.arange(y0 + h / 2, y1, h))
    pts = np.stack([gx.ravel(), gy.ravel()], 1)
    pts += (np.random.default_rng(len(pts)).random(pts.shape) - 0.5) * h * 0.5
    if shape == "disc":
        pts = pts[np.hypot(pts[:, 0] - cx, pts[:, 1] - cy) < r]
    elif shape == "rbox":
        rr = 0.035
        qx = np.maximum(np.abs(pts[:, 0] - (x0 + x1) / 2) - ((x1 - x0) / 2 - rr), 0)
        qy = np.maximum(np.abs(pts[:, 1] - (y0 + y1) / 2) - ((y1 - y0) / 2 - rr), 0)
        pts = pts[np.hypot(qx, qy) < rr]
    return pts


rng = np.random.default_rng(3)
P, M, V, A, B, C = [], [], [], [], [], []
for bi, (mat, shape, prm, f0, vel, _) in enumerate(BODIES):
    pts = sample(shape, prm)
    n = len(pts)
    P.append(pts)
    M.append(np.full(n, mat))
    V.append(np.tile(vel, (n, 1)))
    A.append(np.full(n, f0))
    B.append(np.full(n, bi))
    if mat == WATER:
        k = rng.random(n)[:, None]
        col = np.array([0.10, 0.50, 0.95]) * (1 - k * 0.12) + np.array([0.17, 0.77, 0.90]) * k * 0.12
    elif mat == JELLY:
        # Checker in rest space: the squares show how the jelly deforms.
        chk = ((np.floor(pts[:, 0] / 0.035) + np.floor(pts[:, 1] / 0.035)) % 2)[:, None]
        col = np.array([1.0, 0.353, 0.212]) * (1 - chk) + np.array([1.0, 0.62, 0.45]) * chk
    else:
        k = rng.random(n)[:, None]
        col = np.array([0.96, 0.94, 0.90]) * (0.78 + 0.22 * k)
    C.append(col)
pos0 = np.concatenate(P).astype(np.float32)
mat0 = np.concatenate(M).astype(np.int32)
vel0 = np.concatenate(V).astype(np.float32)
act0 = np.concatenate(A).astype(np.int32)
body0 = np.concatenate(B).astype(np.int32)
col0 = np.concatenate(C).astype(np.float32)
NP = len(pos0)
print("particles", NP)

x = ti.Vector.field(2, ti.f32, NP)
v = ti.Vector.field(2, ti.f32, NP)
Cm = ti.Matrix.field(2, 2, ti.f32, NP)
F = ti.Matrix.field(2, 2, ti.f32, NP)
Jp = ti.field(ti.f32, NP)
mat = ti.field(ti.i32, NP)
act = ti.field(ti.i32, NP)
pcol = ti.Vector.field(3, ti.f32, NP)
grid_v = ti.Vector.field(2, ti.f32, (NX, NY))
grid_m = ti.field(ti.f32, (NX, NY))
dens = ti.field(ti.f32, (3, W, H))
tmp = ti.field(ti.f32, (3, W, H))
dsm = ti.field(ti.f32, (3, W, H))
dcol = ti.Vector.field(3, ti.f32, (3, W, H))
img = ti.Vector.field(3, ti.u8, (H, W))


@ti.kernel
def reset():
    for p in x:
        F[p] = ti.Matrix([[1.0, 0.0], [0.0, 1.0]])
        Cm[p] = ti.Matrix.zero(ti.f32, 2, 2)
        Jp[p] = 1.0


@ti.kernel
def substep(frame: ti.i32):
    for i, j in grid_m:
        grid_v[i, j] = [0.0, 0.0]
        grid_m[i, j] = 0.0
    for p in x:
        if act[p] <= frame:
            base = (x[p] * inv_dx - 0.5).cast(int)
            fx = x[p] * inv_dx - base.cast(float)
            w = [0.5 * (1.5 - fx) ** 2, 0.75 - (fx - 1) ** 2, 0.5 * (fx - 0.5) ** 2]
            F[p] = (ti.Matrix.identity(ti.f32, 2) + dt * Cm[p]) @ F[p]
            h = ti.exp(10 * (1.0 - Jp[p]))
            if mat[p] == JELLY:
                h = 0.3
            h = ti.min(h, 8.0)
            mu, la = mu_0 * h, la_0 * h
            if mat[p] == WATER:
                mu = 0.0
            U, sig, Vm = ti.svd(F[p])
            J = 1.0
            for d in ti.static(range(2)):
                new_sig = sig[d, d]
                if mat[p] == SNOW:
                    new_sig = ti.min(ti.max(sig[d, d], 1 - 2.5e-2), 1 + 4.5e-3)
                Jp[p] *= sig[d, d] / new_sig
                sig[d, d] = new_sig
                J *= new_sig
            if mat[p] == WATER:
                F[p] = ti.Matrix.identity(ti.f32, 2) * ti.sqrt(J)
            elif mat[p] == SNOW:
                F[p] = U @ sig @ Vm.transpose()
            stress = 2 * mu * (F[p] - U @ Vm.transpose()) @ F[p].transpose() + \
                ti.Matrix.identity(ti.f32, 2) * la * J * (J - 1)
            stress = (-dt * p_vol * 4 * inv_dx * inv_dx) * stress
            affine = stress + p_mass * Cm[p]
            for i, j in ti.static(ti.ndrange(3, 3)):
                offs = ti.Vector([i, j])
                dpos = (offs.cast(float) - fx) * dx
                weight = w[i][0] * w[j][1]
                grid_v[base + offs] += weight * (p_mass * v[p] + affine @ dpos)
                grid_m[base + offs] += weight * p_mass
    for i, j in grid_m:
        if grid_m[i, j] > 0:
            grid_v[i, j] = grid_v[i, j] / grid_m[i, j]
            grid_v[i, j][1] -= dt * GRAVITY
            if i < 3 and grid_v[i, j][0] < 0:
                grid_v[i, j][0] = 0
            if i > NX - 3 and grid_v[i, j][0] > 0:
                grid_v[i, j][0] = 0
            if j < 3 and grid_v[i, j][1] < 0:
                grid_v[i, j] = [grid_v[i, j][0] * 0.9, 0.0]
            if j > NY - 3 and grid_v[i, j][1] > 0:
                grid_v[i, j][1] = 0
    for p in x:
        if act[p] <= frame:
            base = (x[p] * inv_dx - 0.5).cast(int)
            fx = x[p] * inv_dx - base.cast(float)
            w = [0.5 * (1.5 - fx) ** 2, 0.75 - (fx - 1.0) ** 2, 0.5 * (fx - 0.5) ** 2]
            new_v = ti.Vector.zero(ti.f32, 2)
            new_C = ti.Matrix.zero(ti.f32, 2, 2)
            for i, j in ti.static(ti.ndrange(3, 3)):
                dpos = ti.Vector([i, j]).cast(float) - fx
                g_v = grid_v[base + ti.Vector([i, j])]
                weight = w[i][0] * w[j][1]
                new_v += weight * g_v
                new_C += 4 * inv_dx * weight * g_v.outer_product(dpos)
            v[p], Cm[p] = new_v, new_C
            x[p] = ti.math.clamp(x[p] + dt * v[p], 2.2 * dx, ti.Vector([NX - 2.2, NY - 2.2]) * dx)


@ti.func
def smooth(a, b, t):
    k = ti.min(ti.max((t - a) / (b - a), 0.0), 1.0)
    return k * k * (3 - 2 * k)


@ti.kernel
def render(frame: ti.i32):
    for m, i, j in dens:
        dens[m, i, j] = 0.0
        dcol[m, i, j] = [0.0, 0.0, 0.0]
    for p in x:
        if act[p] <= frame:
            m = mat[p]
            q = x[p] * S
            sg = 1.25
            c = pcol[p]
            if m == WATER:
                sg = 1.7
                c = c + ti.min(v[p].norm() * 0.2, 0.55) * (ti.Vector([0.85, 0.95, 1.0]) - c)
            elif m == SNOW:
                sg = 1.1
            bx, by = int(q[0]), int(q[1])
            for a, b in ti.static(ti.ndrange((-4, 5), (-4, 5))):
                ix, iy = bx + a, by + b
                if 0 <= ix < W and 0 <= iy < H:
                    d2 = (ix + 0.5 - q[0]) ** 2 + (iy + 0.5 - q[1]) ** 2
                    wt = ti.exp(-d2 / (2 * sg * sg)) * (4.0 / (6.2832 * sg * sg))
                    dens[m, ix, iy] += wt
                    dcol[m, ix, iy] += wt * c
    # Separable Gaussian blur of the density: smooth outlines and normals.
    for m, i, j in tmp:
        acc = 0.0
        for o in ti.static(range(-6, 7)):
            acc += dens[m, ti.min(ti.max(i + o, 0), W - 1), j] * ti.exp(-o * o / 18.0)
        tmp[m, i, j] = acc / 7.30
    for m, i, j in dsm:
        acc = 0.0
        for o in ti.static(range(-6, 7)):
            acc += tmp[m, i, ti.min(ti.max(j + o, 0), H - 1)] * ti.exp(-o * o / 18.0)
        dsm[m, i, j] = acc / 7.30
    for px, py in ti.ndrange(W, H):
        u, t = px / W, py / H
        c = ti.Vector([0.043, 0.043, 0.063]) * (1 - t) + ti.Vector([0.075, 0.08, 0.13]) * t
        c *= 1.0 - 0.35 * ((u - 0.5) ** 2 + (t - 0.55) ** 2)
        # Faint MPM grid lines every 8 cells.
        if (px % 32 == 0 or py % 32 == 0):
            c += 0.012
        L = ti.Vector([-0.45, 0.65, 0.62]).normalized()
        Hh = (L + ti.Vector([0.0, 0.0, 1.0])).normalized()
        for k in ti.static([SNOW, JELLY, WATER]):
            d = dsm[k, px, py]
            df = dens[k, px, py]
            op, gloss, sl = 1.0, 0.18, 2.0
            if ti.static(k == WATER):
                op, gloss, sl = 0.88, 1.0, 3.2
            elif ti.static(k == JELLY):
                op, gloss, sl = 0.98, 0.75, 2.6
            a = ti.max(smooth(0.22, 0.5, d), smooth(0.12, 0.45, df) * 0.9)
            if a > 0.001:
                base = ti.Vector([0.95, 0.93, 0.9])
                if ti.static(k == WATER):
                    base = ti.Vector([0.08, 0.42, 0.9])
                elif ti.static(k == JELLY):
                    base = ti.Vector([1.0, 0.4, 0.25])
                if df > 0.08:
                    base = dcol[k, px, py] / df
                x0, x1 = ti.max(px - 2, 0), ti.min(px + 2, W - 1)
                y0, y1 = ti.max(py - 2, 0), ti.min(py + 2, H - 1)
                edge = 1.0 - smooth(0.35, 0.95, d)
                # Interior normals are flattened so particle noise does not sparkle.
                flat = 0.3 + 0.7 * edge
                gx = (dsm[k, x1, py] - dsm[k, x0, py]) * sl * flat
                gy = (dsm[k, px, y1] - dsm[k, px, y0]) * sl * flat
                n = ti.Vector([-gx, -gy, 1.0]).normalized()
                diff = ti.max(n.dot(L), 0.0)
                spec = ti.max(n.dot(Hh), 0.0) ** 40 * gloss
                sh = base * (0.52 + 0.55 * diff) + spec * ti.Vector([1.0, 0.98, 0.95])
                if ti.static(k == WATER):
                    sh = sh * (1 - 0.5 * edge) + edge * 0.5 * ti.Vector([0.3, 0.85, 1.0])
                    sh *= 0.8 + 0.2 * smooth(0.0, 1.0, d)
                elif ti.static(k == JELLY):
                    sh += edge * 0.18 * ti.Vector([1.0, 0.85, 0.7])
                c = c * (1 - a * op) + sh * a * op
        # Container walls drawn over the material (particles stop 2 cells from them).
        if px < 12 or px > W - 13 or py < 12:
            c = ti.Vector([0.06, 0.06, 0.085])
        elif px < 14 or px > W - 15 or py < 14:
            c = ti.Vector([0.22, 0.22, 0.28])
        for ch in ti.static(range(3)):
            img[H - 1 - py, px][ch] = ti.cast(ti.min(ti.max(c[ch], 0.0), 1.0) ** (1 / 1.05) * 255, ti.u8)


x.from_numpy(pos0)
v.from_numpy(vel0)
mat.from_numpy(mat0)
act.from_numpy(act0)
pcol.from_numpy(col0)
reset()

BOLD = ImageFont.truetype("C:/Windows/Fonts/bahnschrift.ttf", 34)
LAB = ImageFont.truetype("C:/Windows/Fonts/bahnschrift.ttf", 22)
MONO = ImageFont.truetype("C:/Windows/Fonts/consola.ttf", 17)
CREAM = (244, 239, 230)
LCOL = {WATER: (43, 196, 230), JELLY: (255, 120, 84), SNOW: (244, 239, 230)}


def overlay(frame_rgb, f, xs):
    im = Image.fromarray(frame_rgb)
    dr = ImageDraw.Draw(im, "RGBA")
    dr.rectangle((36, 34, 41, 92), fill=(255, 90, 54))
    dr.text((54, 30), "MATERIAL POINT METHOD", font=BOLD, fill=CREAM)
    dr.text((56, 72), f"Taichi on Vulkan  |  {NP:,} particles  |  {NX}x{NY} grid  |  {SUB} substeps/frame",
            font=MONO, fill=(170, 168, 185))
    # Body labels follow each body's centroid for 2 s after it appears.
    for bi, (m, _, _, f0, _, name) in enumerate(BODIES):
        age = (f - f0) / FPS
        if age < 0 or age > 2.2:
            continue
        al = min(1.0, age / 0.3) * min(1.0, (2.2 - age) / 0.4)
        sel = xs[body0 == bi]
        cx, cy = sel[:, 0].mean() * S, H - sel[:, 1].max() * S
        tx, ty = cx, cy - 46
        a8 = int(255 * al)
        r, g, b = LCOL[m]
        dr.line((cx, cy - 6, tx, ty + 26), fill=(r, g, b, a8), width=2)
        tw = dr.textlength(name, font=LAB)
        dr.text((tx - tw / 2, ty), name, font=LAB, fill=(r, g, b, a8))
    return np.asarray(im)


test = None
if "--test" in sys.argv:
    test = {int(s) for s in sys.argv[sys.argv.index("--test") + 1].split(",")}
    os.makedirs(TEST_DIR, exist_ok=True)
enc = None
if test is None:
    enc = subprocess.Popen([
        "ffmpeg", "-nostdin", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24",
        "-s", f"{W}x{H}", "-framerate", str(FPS), "-i", "-",
        "-c:v", "libx264", "-crf", "20", "-preset", "slow", "-pix_fmt", "yuv420p",
        "-movflags", "+faststart", "-threads", "8", OUT], stdin=subprocess.PIPE)

for f in range(NF):
    if f > 0:
        for _ in range(SUB):
            substep(f)
    if test is not None and f not in test:
        continue
    render(f)
    fr = overlay(img.to_numpy(), f, x.to_numpy())
    if test is not None:
        Image.fromarray(fr).save(f"{TEST_DIR}/mpm_{f:04d}.png")
        print("frame", f)
    else:
        assert enc is not None and enc.stdin is not None
        enc.stdin.write(np.ascontiguousarray(fr).tobytes())
        if f % 30 == 0:
            print("frame", f, flush=True)
if enc is not None:
    assert enc.stdin is not None
    enc.stdin.close()
    enc.wait()
    print("done", OUT)
