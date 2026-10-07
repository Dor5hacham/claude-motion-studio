#!/usr/bin/env bash
# color-grade.sh - Color grading before/after with a moving wipe.
#
# The ray-marched blob shot from the master reel gets a teal-and-orange film
# look. A small Python block writes the look as a 33x33x33 3D LUT (.cube):
# S-curve contrast, cool teal shadows, warm orange highlights, warm hues pushed
# toward orange and cool hues toward teal, lifted film blacks. ffmpeg applies
# it with lut3d, then maskedmerge shows the original on the left and the graded
# image on the right of a vertical line that sweeps across the frame.
#
# Run from this folder (source/edit) in Git Bash:
#   bash color-grade.sh
# Output: ../../media/edit/color-grade.mp4
# Temp:   ../../_work/edit-color-grade/ (deleted at the end)
set -euo pipefail

SRC="../../media/reel/master/claude-motion-reel-master.mp4"
OUT="../../media/edit/color-grade.mp4"
WORK="../../_work/edit-color-grade"
mkdir -p "$WORK"

# 1. Generate the teal-and-orange 3D LUT.
uv run --with numpy python - "$WORK/teal-orange.cube" <<'EOF'
import sys
import numpy as np

N = 33
g = np.linspace(0, 1, N)
# .cube order: red changes fastest, then green, then blue.
b, gg, r = np.meshgrid(g, g, g, indexing="ij")
c = np.stack([r, gg, b], -1).reshape(-1, 3)

def smooth(x):
    x = np.clip(x, 0, 1)
    return x * x * (3 - 2 * x)

# S-curve contrast.
c = c + 0.55 * (smooth(c) - c)
L = (c @ np.array([0.2126, 0.7152, 0.0722]))[:, None]

# Hue push: warm colors toward orange, cool colors toward teal, keep luma.
chroma = c - L
mag = np.linalg.norm(chroma, axis=1, keepdims=True)
warm = smooth((0.6 * c[:, :1] + 0.4 * c[:, 1:2] - c[:, 2:3]) * 3.0 + 0.45)  # warm vs cool hue
orange = np.array([1.0, 0.45, 0.05]); orange -= orange @ np.array([0.2126, 0.7152, 0.0722])
teal = np.array([0.0, 0.55, 0.62]);   teal -= teal @ np.array([0.2126, 0.7152, 0.0722])
orange /= np.linalg.norm(orange); teal /= np.linalg.norm(teal)
target = warm * orange + (1 - warm) * teal
chroma = 0.45 * chroma + 0.55 * target * mag * 1.25
c = L + chroma

# Split toning: teal shadows, orange highlights.
ws = (1 - L) ** 2
wh = L ** 2
c = c + ws * np.array([-0.07, 0.03, 0.07]) + wh * np.array([0.15, 0.04, -0.13])

# Film blacks and a soft top.
c = 0.035 + 0.945 * np.clip(c, 0, 1)
c = np.clip(c, 0, 1)

with open(sys.argv[1], "w", newline="\n") as f:
    f.write('TITLE "teal-orange"\nLUT_3D_SIZE 33\n')
    for row in c:
        f.write(f"{row[0]:.6f} {row[1]:.6f} {row[2]:.6f}\n")
print("wrote", sys.argv[1])
EOF

# 2. Grade, wipe, label, encode.
# Wipe position (0..1 of the width): one full sweep, then it settles in the middle.
POS="if(lt(t,4.8),0.5+0.36*cos(PI*t/2.4),0.5+0.36*(1-clip(t-4.8,0,1)*clip(t-4.8,0,1)*(3-2*clip(t-4.8,0,1))))"
FONT="C\:/Windows/Fonts/bahnschrift.ttf"
MONO="C\:/Windows/Fonts/consola.ttf"

ffmpeg -nostdin -v error -y -ss 14.5 -t 7 -i "$SRC" -filter_complex "
[0:v]fps=30,crop=1380:776:270:90,scale=1280:720:flags=lanczos,format=gbrp,split=2[orig][g0];
[g0]lut3d=file='$WORK/teal-orange.cube':interp=tetrahedral[graded];
color=c=black:s=1280x720:r=30:d=7,format=gbrp[mb];
color=c=white:s=1280x720:r=30:d=7,format=gbrp[mw];
[mb][mw]overlay=x='W*($POS)':y=0:eval=frame[mask];
[orig][graded][mask]maskedmerge,format=yuv420p[mix];
color=c=0xf4efe6:s=4x720:r=30:d=7[line];
color=c=0xf4efe6:s=22x64:r=30:d=7[knob];
[mix][line]overlay=x='main_w*($POS)-2':y=0:eval=frame[l1];
[l1][knob]overlay=x='main_w*($POS)-11':y=328:eval=frame,
drawbox=x=28:y=28:w=170:h=58:color=0x0b0b10@0.72:t=fill,
drawbox=x=28:y=28:w=6:h=58:color=0x2bc4e6:t=fill,
drawtext=fontfile='$FONT':text='BEFORE':fontsize=34:fontcolor=0xf4efe6:x=48:y=38,
drawbox=x=1082:y=28:w=170:h=58:color=0x0b0b10@0.72:t=fill,
drawbox=x=1246:y=28:w=6:h=58:color=0xff5a36:t=fill,
drawtext=fontfile='$FONT':text='AFTER':fontsize=34:fontcolor=0xf4efe6:x=1236-tw:y=38,
drawbox=x=(iw-420)/2:y=664:w=420:h=36:color=0x0b0b10@0.72:t=fill,
drawtext=fontfile='$MONO':text='GRADE  teal + orange 3D LUT':fontsize=19:fontcolor=0xffb020:x=(w-tw)/2:y=673
" -r 30 -c:v libx264 -crf 22 -preset slow -pix_fmt yuv420p -movflags +faststart -an "$OUT"

[ -n "${KEEP_WORK:-}" ] || rm -rf "$WORK"
echo "done $OUT"
