# datamosh.py - Real datamosh (I-frame removal + P-frame bloom).
#
# Shot A (shapes on cream paper) cuts to shot B (instanced cube ocean with a
# moving camera). The I-frame at the start of shot B is deleted from the
# bitstream, so the decoder applies shot B's motion vectors and residuals to
# the last picture of shot A. The cream paper and shapes get dragged along by
# the ocean's motion. Near the end one P-frame is repeated many times
# ("bloom"), so the same motion keeps pushing the pixels further.
#
# Steps:
#   1. ffmpeg cuts both shots from the 60 fps master, crops away the reel's HUD
#      and caption, and encodes each one to a raw MPEG-4 Part 2 stream (.m4v,
#      the codec Xvid uses) with no B-frames and one keyframe only.
#   2. This script splits the streams at VOP start codes (00 00 01 B6), reads
#      the coding type of each frame (I or P), drops shot B's I-frame and its
#      header, and duplicates one P-frame for the bloom.
#   3. ffmpeg decodes the broken stream (the decoder does the smearing), adds
#      labels with drawtext and re-encodes to H.264.
#
# Run from this folder (source/edit) in Git Bash:
#   uv run datamosh.py
# Output: ../../media/edit/datamosh.mp4
# Temp:   ../../_work/edit-datamosh/ (deleted at the end)

import os
import shutil
import subprocess

SRC = "../../media/reel/master/claude-motion-reel-master.mp4"
OUT = "../../media/edit/datamosh.mp4"
WORK = "../../_work/edit-datamosh"
FONT = "C\\:/Windows/Fonts/bahnschrift.ttf"
MONO = "C\\:/Windows/Fonts/consola.ttf"

A_IN, A_DUR = 30.9, 1.6      # shapes on cream paper
B_IN, B_DUR = 38.5, 4.2      # instanced cube ocean, camera moving
BLOOM_AT = 70                # index (in shot B P-frames) of the frame to repeat
BLOOM_N = 45                 # how many extra copies of it

PREP = "fps=30,crop=1380:776:270:90,scale=1280:720:flags=lanczos"
MPEG4 = ["-c:v", "mpeg4", "-q:v", "3", "-g", "100000", "-bf", "0",
         "-sc_threshold", "1000000000", "-pix_fmt", "yuv420p", "-an", "-f", "m4v"]


def run(cmd):
    print(" ".join(cmd))
    subprocess.run(cmd, check=True)


def split_vops(data):
    """Return (header, [(type, bytes)]) for a raw MPEG-4 Part 2 stream."""
    sc = b"\x00\x00\x01\xb6"
    starts = []
    i = data.find(sc)
    while i != -1:
        starts.append(i)
        i = data.find(sc, i + 4)
    header = data[:starts[0]]
    vops = []
    for n, s in enumerate(starts):
        e = starts[n + 1] if n + 1 < len(starts) else len(data)
        kind = "IPBS"[data[s + 4] >> 6]
        vops.append((kind, data[s:e]))
    return header, vops


os.makedirs(WORK, exist_ok=True)
a_m4v, b_m4v = f"{WORK}/a.m4v", f"{WORK}/b.m4v"
mosh = f"{WORK}/mosh.m4v"

run(["ffmpeg", "-nostdin", "-v", "error", "-y", "-ss", str(A_IN), "-t", str(A_DUR),
     "-i", SRC, "-vf", PREP] + MPEG4 + [a_m4v])
run(["ffmpeg", "-nostdin", "-v", "error", "-y", "-ss", str(B_IN), "-t", str(B_DUR),
     "-i", SRC, "-vf", PREP] + MPEG4 + [b_m4v])

with open(a_m4v, "rb") as f:
    ha, va = split_vops(f.read())
with open(b_m4v, "rb") as f:
    hb, vb = split_vops(f.read())
print("A:", "".join(k for k, _ in va))
print("B:", "".join(k for k, _ in vb))

# Shot A as is, then shot B with every I-frame removed.
b_p = [v for k, v in vb if k == "P"]
frames = [v for _, v in va] + b_p[:BLOOM_AT] + [b_p[BLOOM_AT]] * BLOOM_N + b_p[BLOOM_AT:]
with open(mosh, "wb") as f:
    f.write(ha)
    for v in frames:
        f.write(v)

n_a = len(va)
t_cut = n_a / 30
t_bloom = (n_a + BLOOM_AT) / 30
t_bloom_end = t_bloom + BLOOM_N / 30
total = len(frames) / 30
print(f"frames {len(frames)}  cut {t_cut:.2f}s  bloom {t_bloom:.2f}-{t_bloom_end:.2f}s  total {total:.2f}s")

box = "drawbox=x=28:y=28:w=440:h=96:color=0x0b0b10@0.75:t=fill,drawbox=x=28:y=28:w=6:h=96:color=0x7a5cff:t=fill"
vf = ",".join([
    box,
    f"drawtext=fontfile='{FONT}':text='DATAMOSH':fontsize=40:fontcolor=0xf4efe6:x=50:y=38",
    f"drawtext=fontfile='{MONO}':text='CLEAN SHOT A':fontsize=20:fontcolor=0x2bc4e6:x=52:y=90"
    f":enable='lt(t,{t_cut:.3f})'",
    f"drawtext=fontfile='{MONO}':text='I-FRAME REMOVED':fontsize=20:fontcolor=0xff5a36:x=52:y=90"
    f":enable='between(t,{t_cut:.3f},{t_bloom:.3f})'",
    f"drawtext=fontfile='{MONO}':text='P-FRAME BLOOM x{BLOOM_N}':fontsize=20:fontcolor=0xffb020:x=52:y=90"
    f":enable='between(t,{t_bloom:.3f},{t_bloom_end:.3f})'",
    f"drawtext=fontfile='{MONO}':text='MOTION OF SHOT B, PIXELS OF SHOT A':fontsize=20:fontcolor=0xffb020:x=52:y=90"
    f":enable='gt(t,{t_bloom_end:.3f})'",
])
run(["ffmpeg", "-nostdin", "-v", "error", "-y", "-framerate", "30", "-f", "m4v", "-i", mosh,
     "-vf", vf, "-r", "30",
     "-c:v", "libx264", "-crf", "22", "-preset", "slow", "-pix_fmt", "yuv420p",
     "-movflags", "+faststart", "-an", OUT])

if not os.environ.get("KEEP_WORK"):     # set KEEP_WORK=1 to inspect the .m4v files
    shutil.rmtree(WORK)
print("done", OUT)
