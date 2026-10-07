# speed-ramp.py - Speed ramp with optical-flow slow motion.
#
# Takes the Blender wall-smash shot from the 60 fps master reel and remaps time:
#   1.0x (ball rolls in) -> smooth ramp down -> 0.2x super slow motion through the
#   impact -> smooth ramp up -> 2.0x while the cubes settle.
#
# How it works:
#   1. ffmpeg crops away the reel's HUD and caption, scales to 1280x720 and runs
#      minterpolate (mi_mode=mci, motion-compensated interpolation) to make a
#      150 fps stream. 150 fps means 0.2x at 30 fps uses one new frame per output
#      frame, so the slow part is real in-between frames, not repeated ones.
#   2. This script reads that stream as raw RGB, integrates the speed curve to
#      find the source time of each output frame, and averages the frames that a
#      180-degree shutter would see. Fast parts get real motion blur, slow parts
#      stay sharp.
#   3. A second ffmpeg encodes to H.264. drawtext prints the live speed value
#      (computed from the same curve as an ffmpeg expression). A small speed graph
#      with a playhead is drawn by this script.
#
# Run from this folder (source/edit) in Git Bash:
#   uv run --with numpy --with pillow speed-ramp.py
# Output: ../../media/edit/speed-ramp.mp4
# Temp:   none on disk (frames are piped between processes).

import subprocess
import numpy as np
from PIL import Image, ImageDraw, ImageFont

SRC = "../../media/reel/master/claude-motion-reel-master.mp4"
OUT = "../../media/edit/speed-ramp.mp4"
FONT = "C:/Windows/Fonts/consola.ttf"
FONT_FF = "C\\:/Windows/Fonts/consola.ttf"   # colon escaped for ffmpeg

W, H, FPS = 1280, 720, 30
IFPS = 150                 # interpolated frame rate
SRC_IN = 22.25             # where the decoded segment starts in the master (s)
SRC_START = 22.30          # source time of the first output frame (s)
SRC_DUR = 6.0              # decoded length (s)

# Speed curve keys in output time (s): hold, ramp, hold, ramp, hold.
T1, T2 = 0.24, 0.54        # 1.0x -> 0.2x
T3, T4 = 3.54, 4.14        # 0.2x -> 2.0x
T_END = 6.2
V0, V1, V2 = 1.0, 0.2, 2.0


def smooth(x):
    x = np.clip(x, 0.0, 1.0)
    return x * x * (3 - 2 * x)


def speed(t):
    t = np.asarray(t, dtype=np.float64)
    v = np.full_like(t, V0)
    v = np.where(t >= T1, V0 + (V1 - V0) * smooth((t - T1) / (T2 - T1)), v)
    v = np.where(t >= T3, V1 + (V2 - V1) * smooth((t - T3) / (T4 - T3)), v)
    return v


def ff_speed_expr():
    # Same curve as speed(), written as an ffmpeg expression of t.
    def ss(a, b):
        x = f"clip((t-{a})/{b - a},0,1)"
        return f"({x}*{x}*(3-2*{x}))"
    return (f"if(lt(t,{T1}),{V0},if(lt(t,{T3}),"
            f"{V0}+({V1 - V0})*{ss(T1, T2)},"
            f"{V1}+({V2 - V1})*{ss(T3, T4)}))")


# Source time as a function of output time (numeric integral of the speed).
DT = 1.0 / 3000
tt = np.arange(0, T_END + 0.2, DT)
src_t = SRC_START + np.concatenate([[0], np.cumsum(speed(tt[:-1]) * DT)])


def S(t):
    return np.interp(t, tt, src_t)


N_OUT = int(round(T_END * FPS))
print("source range", S(0), S(T_END), "needs <=", SRC_IN + SRC_DUR)

# ---- speed graph overlay (drawn once, playhead added per frame) ----
GX, GY, GW, GH = 1280 - 300, 720 - 128, 270, 96
font_s = ImageFont.truetype(FONT, 14)
graph = Image.new("RGBA", (W, H), (0, 0, 0, 0))
g = ImageDraw.Draw(graph)
g.rounded_rectangle([GX - 14, GY - 30, GX + GW + 14, GY + GH + 12], 10, fill=(11, 11, 16, 190))
g.text((GX, GY - 24), "SPEED CURVE", font=font_s, fill=(244, 239, 230, 230))
VMAX = 2.2


def gpt(t, v):
    return (GX + 34 + (GW - 34) * t / T_END, GY + GH - GH * v / VMAX)


for vref, lab in ((1.0, "1x"), (0.2, ".2x"), (2.0, "2x")):
    y = gpt(0, vref)[1]
    g.line([GX + 34, y, GX + GW, y], fill=(244, 239, 230, 50), width=1)
    g.text((GX - 2, y - 8), lab, font=font_s, fill=(244, 239, 230, 140))
ts = np.linspace(0, T_END, 400)
pts = [gpt(a, b) for a, b in zip(ts, speed(ts))]
g.line(pts, fill=(255, 176, 32, 255), width=3, joint="curve")
graph_np = np.asarray(graph).astype(np.float32)
g_alpha = graph_np[..., 3:4] / 255.0
g_rgb = graph_np[..., :3]

# ---- decoder: crop, scale, optical-flow interpolation to 150 fps ----
dec = subprocess.Popen([
    "ffmpeg", "-nostdin", "-v", "error", "-ss", str(SRC_IN), "-t", str(SRC_DUR), "-i", SRC,
    "-vf", "crop=1380:776:280:90,scale=1280:720:flags=lanczos,"
           f"minterpolate=fps={IFPS}:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1",
    "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], stdout=subprocess.PIPE)

speed_txt = ff_speed_expr()
R = f"trunc(({speed_txt})*10+0.5)"
label = f"%{{eif\\:trunc({R}/10)\\:d}}.%{{eif\\:mod({R},10)\\:d}}x"
vf = (
    f"drawbox=x=28:y=28:w=232:h=104:color=0x0b0b10@0.72:t=fill,"
    f"drawbox=x=28:y=28:w=6:h=104:color=0xff5a36:t=fill,"
    f"drawtext=fontfile='{FONT_FF}':text='SPEED RAMP':fontsize=18:fontcolor=0xf4efe6:x=50:y=42,"
    f"drawtext=fontfile='{FONT_FF}':text='{label}':fontsize=56:fontcolor=0xffb020:x=50:y=66"
)
enc = subprocess.Popen([
    "ffmpeg", "-nostdin", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24",
    "-s", f"{W}x{H}", "-framerate", str(FPS), "-i", "-", "-vf", vf,
    "-c:v", "libx264", "-crf", "22", "-preset", "slow", "-pix_fmt", "yuv420p",
    "-movflags", "+faststart", "-an", OUT], stdin=subprocess.PIPE)
assert dec.stdout is not None and enc.stdin is not None
dec_out, enc_in = dec.stdout, enc.stdin

FRAME = W * H * 3
buf = {}          # interpolated index -> frame
next_read = 0


def get(i):
    global next_read
    while next_read <= i:
        raw = dec_out.read(FRAME)
        if len(raw) < FRAME:
            raise RuntimeError(f"decoder ended at frame {next_read}")
        buf[next_read] = np.frombuffer(raw, np.uint8).reshape(H, W, 3)
        next_read += 1
    return buf[i]


for k in range(N_OUT):
    t = k / FPS
    a = (S(t) - SRC_IN) * IFPS
    b = (S(t + 0.5 / FPS) - SRC_IN) * IFPS        # 180-degree shutter
    i0 = int(round(a))
    i1 = max(i0 + 1, int(round(b)))
    acc = np.zeros((H, W, 3), np.float32)
    for i in range(i0, i1):
        acc += get(i)
    frame = acc / (i1 - i0)
    for old in [j for j in buf if j < i0]:
        del buf[old]
    # graph + playhead
    frame = frame * (1 - g_alpha) + g_rgb * g_alpha
    px, py = gpt(t, float(speed(t)))
    x0, x1 = int(px) - 1, int(px) + 1
    frame[GY:GY + GH, x0:x1 + 1] = frame[GY:GY + GH, x0:x1 + 1] * 0.5 + 0.5 * np.array([244, 239, 230])
    yy, xx = np.ogrid[-7:8, -7:8]
    disk = (xx * xx + yy * yy) <= 36
    cy, cx = int(py), int(px)
    patch = frame[cy - 7:cy + 8, cx - 7:cx + 8]
    patch[disk] = (255, 90, 54)
    enc_in.write(np.clip(frame, 0, 255).astype(np.uint8).tobytes())

# Drain the few spare frames so the decoder exits cleanly.
while dec_out.read(FRAME * 8):
    pass
dec.wait()
enc_in.close()
enc.wait()
print("done", OUT, "frames", N_OUT)
