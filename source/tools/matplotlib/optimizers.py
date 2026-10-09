# Copyright (c) 2026 Dor5hacham d5shacham@gmail.com. All rights reserved.
# SPDX-License-Identifier: Proprietary

# optimizers.py - SGD, momentum and Adam race down the Rosenbrock valley.
#
# A Matplotlib animation (FuncAnimation saved with FFMpegWriter):
#   left:         the loss surface in 3D (log scale), the camera orbits slowly,
#                 each optimizer leaves a trail on the surface
#   right, top:   the same paths on a contour map, with the minimum at (1, 1)
#   right, bottom: loss per step on a log axis
# All three start at (-1.7, 2.6). Plain gradient descent crawls along the
# curved valley floor, momentum builds speed and overshoots the walls, Adam
# rescales each direction and gets to the minimum first.
#
# Run from this folder (source/tools/matplotlib) in Git Bash:
#   uv run --with numpy --with matplotlib python optimizers.py
# Output: ../../../media/tools/matplotlib.mp4 (8 s, 1280x720, 30 fps)

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
import numpy as np  # noqa: E402
from matplotlib import font_manager  # noqa: E402
from matplotlib.animation import FFMpegWriter, FuncAnimation  # noqa: E402
from matplotlib.colors import LinearSegmentedColormap  # noqa: E402
from matplotlib.ticker import FuncFormatter  # noqa: E402

OUT = "../../../media/tools/matplotlib.mp4"
FPS, NF, SPF = 30, 240, 3                 # frames, optimizer steps per frame
BG, CREAM, MUTED = "#0b0b10", "#f4efe6", "#8f8da3"
OPT = [("SGD", "#ffb020", "sgd", 0.0012), ("Momentum", "#2bc4e6", "mom", 0.0004),
       ("Adam", "#ff5a36", "adam", 0.06)]

font_manager.fontManager.addfont("C:/Windows/Fonts/bahnschrift.ttf")
plt.rcParams.update({"font.family": "Bahnschrift", "axes.unicode_minus": False, "text.color": CREAM, "axes.labelcolor": MUTED,
                     "xtick.color": MUTED, "ytick.color": MUTED, "axes.edgecolor": "#33323f"})


def f(x, y):
    return (1 - x) ** 2 + 100 * (y - x * x) ** 2


def grad(p):
    x, y = p
    return np.array([-2 * (1 - x) - 400 * x * (y - x * x), 200 * (y - x * x)])


def run(kind, lr, steps):
    """Path of one optimizer from the shared start point."""
    p = np.array([-1.7, 2.6])
    v = np.zeros(2)
    m = np.zeros(2)
    s = np.zeros(2)
    out = [p.copy()]
    for k in range(1, steps + 1):
        g = grad(p)
        if kind == "sgd":
            p = p - lr * g
        elif kind == "mom":
            v = 0.9 * v - lr * g
            p = p + v
        else:
            m = 0.9 * m + 0.1 * g
            s = 0.999 * s + 0.001 * g * g
            p = p - lr * (m / (1 - 0.9 ** k)) / (np.sqrt(s / (1 - 0.999 ** k)) + 1e-8)
        out.append(p.copy())
    return np.array(out)


paths = [run(kind, lr, NF * SPF) for _, _, kind, lr in OPT]
loss = [f(P[:, 0], P[:, 1]) for P in paths]
Z = lambda x, y: np.log10(1 + f(x, y))  # noqa: E731

xs, ys = np.meshgrid(np.linspace(-2, 2, 90), np.linspace(-1, 3, 90))
zs = Z(xs, ys)
cmap = LinearSegmentedColormap.from_list("studio", ["#14123a", "#3a2a8a", "#7a3fb0", "#c8507a", "#ff8a4a"])

fig = plt.figure(figsize=(12.8, 7.2), dpi=100, facecolor=BG)
ax3 = fig.add_axes([-0.04, 0.0, 0.62, 0.92], projection="3d", facecolor=BG)
axc = fig.add_axes([0.60, 0.50, 0.36, 0.38], facecolor=BG)
axl = fig.add_axes([0.60, 0.09, 0.36, 0.30], facecolor=BG)
fig.text(0.035, 0.925, "Three optimizers, one valley", fontsize=26, color=CREAM)
fig.text(0.037, 0.885, "Rosenbrock function, start (-1.7, 2.6), minimum (1, 1)", fontsize=13, color=MUTED)
step_txt = fig.text(0.037, 0.05, "", fontsize=13, color=MUTED, family="Consolas")

ax3.plot_surface(xs, ys, zs, cmap=cmap, rcount=90, ccount=90, linewidth=0, antialiased=False, alpha=0.95)
ax3.set_axis_off()
ax3.set_zlim(0, 3.6)
ax3.plot([1], [1], [0.02], marker="*", color=CREAM, markersize=14, zorder=10)

axc.contourf(xs, ys, zs, levels=24, cmap=cmap)
axc.contour(xs, ys, zs, levels=24, colors="#0b0b10", linewidths=0.4, alpha=0.5)
axc.plot([1], [1], marker="*", color=CREAM, markersize=13)
axc.set_xlim(-2, 2)
axc.set_ylim(-1, 3)
axc.set_title("paths on the contour map", fontsize=12, color=MUTED, loc="left")
axc.tick_params(labelsize=9)

axl.set_yscale("log")
axl.yaxis.set_major_formatter(FuncFormatter(lambda v, _: f"1e{round(np.log10(v))}"))
axl.set_xlim(0, NF * SPF)
axl.set_ylim(1e-4, 3e2)
axl.set_title("loss per step", fontsize=12, color=MUTED, loc="left")
axl.tick_params(labelsize=9)
axl.grid(color="#24232f", linewidth=0.6)
for sp in ("top", "right"):
    axl.spines[sp].set_visible(False)

trails3, heads3, trailsc, headsc, curves, heads_l = [], [], [], [], [], []
for name, col, _, _ in OPT:
    trails3.append(ax3.plot([], [], [], color=col, linewidth=2.2, zorder=5)[0])
    heads3.append(ax3.plot([], [], [], marker="o", color=col, markersize=8, markeredgecolor=CREAM, zorder=6)[0])
    trailsc.append(axc.plot([], [], color=col, linewidth=1.8)[0])
    headsc.append(axc.plot([], [], marker="o", color=col, markersize=7, markeredgecolor=CREAM)[0])
    curves.append(axl.plot([], [], color=col, linewidth=1.8, label=name)[0])
    heads_l.append(axl.plot([], [], marker="o", color=col, markersize=5)[0])
leg = axl.legend(loc="lower left", frameon=False, fontsize=11)
for txt, (_, col, _, _) in zip(leg.get_texts(), OPT):
    txt.set_color(col)


def update(fr):
    n = min(fr * SPF, NF * SPF)
    for i, P in enumerate(paths):
        seg = P[:n + 1]
        trails3[i].set_data_3d(seg[:, 0], seg[:, 1], Z(seg[:, 0], seg[:, 1]) + 0.04)
        heads3[i].set_data_3d([seg[-1, 0]], [seg[-1, 1]], [Z(seg[-1, 0], seg[-1, 1]) + 0.06])
        trailsc[i].set_data(seg[:, 0], seg[:, 1])
        headsc[i].set_data([seg[-1, 0]], [seg[-1, 1]])
        curves[i].set_data(np.arange(n + 1), loss[i][:n + 1])
        heads_l[i].set_data([n], [loss[i][n]])
    u = fr / (NF - 1)
    ax3.view_init(elev=42 - 10 * u, azim=-125 + 70 * (3 * u * u - 2 * u ** 3))
    step_txt.set_text(f"step {n:3d}   " + "   ".join(f"{name} {loss[i][n]:8.4f}" for i, (name, *_) in enumerate(OPT)))
    return []


ani = FuncAnimation(fig, update, frames=NF, interval=1000 / FPS)
writer = FFMpegWriter(fps=FPS, codec="libx264",
                      extra_args=["-crf", "20", "-preset", "slow", "-pix_fmt", "yuv420p", "-movflags", "+faststart"])
ani.save(OUT, writer=writer, dpi=100, savefig_kwargs={"facecolor": BG})
print("done", OUT)
