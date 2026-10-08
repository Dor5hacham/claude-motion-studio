# Builds "Reel 2": a 120 BPM beat-synced showreel of the second set of clips.
# Usage (from the repo root): uv run --with numpy --with scipy source/reel2/make_reel2.py [work_dir]
# Writes media/reel/claude-motion-reel-2.mp4. Needs ffmpeg on PATH. Temp files go in work_dir
# (default _work/reel2/build), which is deleted at the end.
import shutil
import subprocess
import sys
from pathlib import Path

import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, fftconvolve, sosfilt

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "media" / "reel" / "claude-motion-reel-2.mp4"
FONT = "C\\:/Windows/Fonts/bahnschrift.ttf"
BG, CORAL, CREAM = "0x0b0b10", "0xff5a36", "0xf4efe6"
FPS, BEAT = 30, 0.5  # 120 BPM: one beat is 0.5 s, one bar is 2 s

TITLE_LEN, END_LEN = 3.0, 3.5
# (clip file under media/, in-point s, length in beats, lower-left label, punch on a downbeat)
# Clips that already show their own title get no label.
SHOTS = [
    # build: one cut per bar
    ("tools/rust-spectrogram-word.mp4", 5.0, 4, "A word hidden in sound", False),
    ("engine/toon-line-art.mp4", 3.0, 4, "Anime floating island", False),
    ("engine/unreal-neon.mp4", 4.5, 4, "Neon light installation", False),
    ("engine/engrave.mp4", 5.0, 4, "CNC engraving", False),
    ("tools/rust-light2d-prism.mp4", 4.0, 4, "Newton's prism, traced in 2D", False),
    ("engine/unreal-lumen.mp4", 5.5, 4, "Lumen daylight time-lapse", False),
    ("tools/go-flip-hourglass.mp4", 1.0, 4, "Liquid hourglass (FLIP solver in Go)", False),
    ("edit/vfx-comp.mp4", 4.0, 4, None, False),
    # drop: one cut per beat, flash and zoom punch on each downbeat
    ("engine/unreal-ribbons.mp4", 6.0, 1, None, True),
    ("tools/rust-pathtracer.mp4", 3.0, 1, None, False),
    ("engine/beat-speaker.mp4", 4.0, 1, None, False),
    ("tools/rust-fourier-diffraction.mp4", 4.5, 1, None, False),
    ("edit/slit-scan.mp4", 5.0, 1, None, True),
    ("tools/taichi-mpm.mp4", 4.5, 1, None, False),
    ("engine/domino.mp4", 3.0, 1, None, False),
    ("edit/video-wall.mp4", 6.0, 1, None, False),
    ("edit/optical-flow.mp4", 6.0, 1, None, True),
    ("engine/unreal-focus.mp4", 2.0, 1, None, False),
    ("edit/pixel-sort.mp4", 5.0, 1, None, False),
    ("edit/track-callout.mp4", 5.0, 1, None, False),
    ("edit/vhs.mp4", 5.0, 1, None, True),
    ("edit/photomosaic.mp4", 5.5, 1, None, False),
    ("tools/matplotlib.mp4", 3.0, 1, None, False),
    ("tools/ffmpeg-graph.mp4", 1.5, 1, None, False),
    # after the drop: one cut per bar again
    ("tools/pyvista.mp4", 4.0, 4, None, False),
    ("engine/exploded-view.mp4", 5.0, 4, "Exploded product view", False),
    ("tools/rust-font-rasterizer.mp4", 4.5, 4, "How a font becomes pixels", False),
    ("edit/super8.mp4", 3.0, 4, None, False),
    # slowdown: one shot for two bars
    ("engine/skipping-stone.mp4", 1.0, 8, "Skipping stone at dusk", False),
]
GROOVE = TITLE_LEN  # first kick lands where the first shot starts
END_AT = GROOVE + sum(s[2] for s in SHOTS) * BEAT
DUR = END_AT + END_LEN


def timeline():
    """Start time of every shot, all on the 0.5 s beat grid."""
    t, out = GROOVE, []
    for s in SHOTS:
        out.append(t)
        t += s[2] * BEAT
    return out


# ---------------- soundtrack ----------------
SR = 48000
N = int(SR * DUR)
rng = np.random.default_rng(7)
drums = np.zeros((2, N))
music = np.zeros((2, N))
send = np.zeros(N)
duck = np.zeros(N)


def mtof(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def filt(x, kind, f, order=2):
    return np.asarray(sosfilt(butter(order, f, btype=kind, fs=SR, output="sos"), x))


def env(n, a, d):
    e = np.exp(-np.arange(n) / SR / d)
    na = max(1, int(a * SR))
    e[:na] *= np.linspace(0, 1, na)
    return e


def add(sig, t, gain=1.0, pan=0.0, rev=0.0, bus=None):
    i = int(round(t * SR))
    if i >= N:
        return
    sig = sig[: N - i] * gain
    b = drums if bus is None else bus
    b[0, i : i + len(sig)] += sig * np.cos((pan + 1) * np.pi / 4) * 1.414
    b[1, i : i + len(sig)] += sig * np.sin((pan + 1) * np.pi / 4) * 1.414
    send[i : i + len(sig)] += sig * rev


def kick(t, g=1.0):
    n = int(0.5 * SR)
    tt = np.arange(n) / SR
    ph = 2 * np.pi * np.cumsum(46 + 120 * np.exp(-tt * 30)) / SR
    add(np.tanh(np.sin(ph) * np.exp(-tt * 7.5) * 1.8), t, 0.85 * g)
    i = int(t * SR)
    d = np.exp(-np.arange(int(0.35 * SR)) / SR / 0.1)[: max(0, N - i)]
    duck[i : i + len(d)] = np.maximum(duck[i : i + len(d)], d)


def clap(t, g=1.0):
    n = int(0.35 * SR)
    s = filt(rng.standard_normal(n), "bandpass", [900, 3000])
    e = np.zeros(n)
    for k, off in enumerate([0, 0.01, 0.021]):
        j = int(off * SR)
        e[j:] += np.exp(-np.arange(n - j) / SR / (0.01 if k < 2 else 0.1))
    add(s * e, t, 0.4 * g, pan=-0.1, rev=0.3)


def snare(t, g=1.0):
    n = int(0.2 * SR)
    tt = np.arange(n) / SR
    s = filt(rng.standard_normal(n), "highpass", 1200) * env(n, 0.001, 0.06) + 0.5 * np.sin(2 * np.pi * 190 * tt) * env(n, 0.001, 0.04)
    add(s, t, 0.3 * g, pan=0.05, rev=0.25)


def hat(t, g=1.0, open_=False):
    n = int((0.3 if open_ else 0.06) * SR)
    s = filt(rng.standard_normal(n), "highpass", 8000) * env(n, 0.001, 0.08 if open_ else 0.016)
    add(s, t, 0.2 * g, pan=0.3 if open_ else -0.25, rev=0.08)


def crash(t, g=1.0):
    n = int(2.4 * SR)
    tt = np.arange(n) / SR
    metal = sum(np.sin(2 * np.pi * f * tt) for f in (3150, 4710, 5930, 7380)) * 0.12
    s = filt(rng.standard_normal(n) + metal, "highpass", 4500) * env(n, 0.002, 0.7)
    add(s, t, 0.3 * g, pan=0.15, rev=0.4)


def bass(t, m, dur, g=1.0):
    n = int(dur * SR)
    tt = np.arange(n) / SR
    f = mtof(m)
    s = np.sin(2 * np.pi * f * tt) + 0.4 * np.sin(4 * np.pi * f * tt) + 0.2 * np.sign(np.sin(2 * np.pi * f * tt))
    s = filt(s, "lowpass", 700) * env(n, 0.004, dur * 0.7)
    add(np.tanh(s * 1.4), t, 0.4 * g, bus=music)


def pad(t, notes, dur, g=1.0, cutoff=1800):
    n = int((dur + 0.6) * SR)
    tt = np.arange(n) / SR
    s = np.zeros(n)
    for m in notes:
        for det in (-0.12, 0.0, 0.12):
            f = mtof(m + det)
            s += 2 * ((tt * f + rng.random()) % 1.0) - 1
    s = filt(s / (3 * len(notes)), "lowpass", cutoff)
    e = np.minimum(1, tt / 0.35) * np.clip((dur + 0.6 - tt) / 0.6, 0, 1)
    sl = filt(s * e, "lowpass", cutoff * 0.8)
    add(s * e, t, 0.33 * g, pan=-0.35, rev=0.5, bus=music)
    add(sl * e, t, 0.33 * g, pan=0.35, rev=0.5, bus=music)


def pluck(t, m, g=1.0, pan=0.0):
    n = int(0.4 * SR)
    tt = np.arange(n) / SR
    f = mtof(m)
    s = sum(np.sin(2 * np.pi * f * h * tt) * 0.55 ** (h - 1) for h in range(1, 6))
    add(filt(s, "lowpass", 3500) * env(n, 0.002, 0.12), t, 0.1 * g, pan=pan, rev=0.35, bus=music)


def bell(t, m, g=1.0, pan=0.0):
    n = int(3.5 * SR)
    tt = np.arange(n) / SR
    f = mtof(m)
    s = np.sin(2 * np.pi * f * tt + 1.6 * np.sin(2 * np.pi * f * 3.5 * tt) * np.exp(-tt * 3)) * env(n, 0.002, 1.1)
    add(s, t, 0.14 * g, pan=pan, rev=0.6, bus=music)


def riser(t0, t1, g=1.0, down=False):
    n = int((t1 - t0) * SR)
    x = np.linspace(0, 1, n)
    noise = rng.standard_normal(n)
    out = np.zeros(n)
    chunks = 32
    for c in range(chunks):
        a, b = c * n // chunks, (c + 1) * n // chunks
        k = (c + 0.5) / chunks
        fc = 400 * (18 ** (1 - k if down else k))
        out[a:b] = filt(noise[max(0, a - 2000) : b], "bandpass", [fc * 0.6, min(fc * 1.6, 20000)])[-(b - a) :]
    sweep = np.sin(2 * np.pi * np.cumsum(220 * 4 ** (1 - x if down else x)) / SR) * 0.25
    shape = (1 - x) ** 2 if down else x**2
    add((out + sweep) * shape, t0, 0.35 * g, rev=0.5)


def impact(t):
    n = int(3.0 * SR)
    tt = np.arange(n) / SR
    boom = np.sin(2 * np.pi * np.cumsum(32 + 60 * np.exp(-tt * 8)) / SR) * np.exp(-tt * 1.4)
    add(np.tanh(boom * 1.5), t, 0.8)
    kick(t, 1.1)
    crash(t, 1.3)


CHORDS = [[57, 60, 64], [53, 57, 60], [55, 60, 64], [55, 59, 62]]  # Am F C G
ROOTS = [45, 41, 36, 43]


def soundtrack(path):
    """Writes the synthesized stereo WAV; every hit sits on the shot timeline's beat grid."""
    pad(0.0, [57, 60, 64, 69], GROOVE, 0.7, cutoff=900)
    riser(0.8, GROOVE, 0.5)
    for k in range(int(GROOVE / BEAT) - 2, int(GROOVE / BEAT)):
        pluck(k * BEAT, 76 - 3 * (k % 2), 0.8)
    drop_at = GROOVE + 32 * BEAT
    after_at = drop_at + 16 * BEAT
    slow_at = after_at + 16 * BEAT
    bar = 0
    t = GROOVE
    while t < END_AT - 1e-6:
        ch, root = CHORDS[bar % 4], ROOTS[bar % 4]
        build, dropz, after, slow = t < drop_at, drop_at <= t < after_at, after_at <= t < slow_at, t >= slow_at
        pad(t, ch, 2.0, 0.55 if build else 0.8 if not slow else 0.9, cutoff=1400 if build else 2600)
        if t in (drop_at, after_at, slow_at) or dropz:
            crash(t, 1.0 if t == drop_at else 0.7)
        for b in range(4):
            bt = t + b * BEAT
            if slow:
                if b == 0:
                    kick(bt)
                if b == 2:
                    clap(bt, 0.9)
                hat(bt + 0.25, 0.5)
                continue
            if not (build and bt >= drop_at - 2 * BEAT):
                kick(bt)
            if (bt >= GROOVE + 16 * BEAT or not build) and b in (1, 3) and not (build and bt >= drop_at - 4 * BEAT):
                clap(bt)
            if bt >= GROOVE + 8 * BEAT or not build:
                hat(bt + 0.25, 0.9)
            if dropz:
                hat(bt + 0.125, 0.45)
                hat(bt + 0.375, 0.45)
                hat(bt + 0.25, 0.6, open_=True)
            if after:
                hat(bt + 0.25, 0.5, open_=True)
        if build and t < GROOVE + 8 * BEAT:
            bass(t, root, 1.9, 0.9)
        elif slow:
            bass(t, root, 1.9, 1.0)
        else:
            step = 0.25 if dropz else 0.5
            for k in range(int(2.0 / step)):
                if k * step % BEAT == 0 and not dropz:
                    continue
                bass(t + k * step, root + (12 if dropz and k % 4 == 3 else 0), step * 0.9, 0.85)
        if (build and t >= GROOVE + 16 * BEAT) or not build:
            step = 0.125 if dropz else 0.25
            for k in range(int(2.0 / step)):
                m = ch[[0, 1, 2, 1][k % 4]] + 12 + (12 if k % 8 >= 6 else 0)
                pluck(t + k * step, m, 0.7 if dropz else 0.5, pan=0.4 * np.sin(k))
        t += 2.0
        bar += 1
    riser(drop_at - 4 * BEAT, drop_at, 1.0)
    for k in range(8):
        snare(drop_at - 2 * BEAT + k * 0.125, 0.4 + 0.08 * k)
    for k in range(4):
        snare(drop_at - 4 * BEAT + k * 0.25, 0.3 + 0.05 * k)
    riser(END_AT - 2 * BEAT, END_AT, 0.7)
    impact(END_AT)
    pad(END_AT, [45, 57, 64, 69, 72], END_LEN - 0.4, 1.0, cutoff=1600)
    bell(END_AT, 81, 1.0, pan=-0.2)
    bell(END_AT, 76, 0.8, pan=0.2)

    ir_n = int(2.2 * SR)
    ir = filt(rng.standard_normal(ir_n), "lowpass", 5000) * np.exp(-np.arange(ir_n) / SR / 0.5)
    wet = fftconvolve(send, ir)[:N] * 0.02
    gain = 1 - 0.6 * duck
    mix = drums + music * gain
    mix[0] += wet
    mix[1] += np.roll(wet, 300)
    mix = np.tanh(mix * 0.9)
    mix /= np.max(np.abs(mix)) / 0.84
    fade = int(0.8 * SR)
    mix[:, -fade:] *= np.linspace(1, 0, fade) ** 2
    wavfile.write(str(path), SR, (mix.T * 32767).astype(np.int16))


# ---------------- picture ----------------
def ff(args, cwd):
    subprocess.run(["ffmpeg", "-v", "error", "-y", *args], cwd=cwd, check=True)


def text(name, s, work):
    (work / name).write_text(s, encoding="utf8")
    return f"drawtext=fontfile='{FONT}':textfile='{name}':expansion=none"


ENC = ["-an", "-c:v", "libx264", "-crf", "12", "-preset", "veryfast", "-pix_fmt", "yuv420p", "-r", str(FPS), "-threads", "8"]


def card(out, work, lines, length, fade_in, fade_out):
    """Draws a title or end card: coral bar plus one or two lines of Bahnschrift."""
    vf = []
    y0 = "(h/2-{off})+26*pow(max(0,1-(t-{d})/0.7),3)"
    for i, (s, size, color, off, delay) in enumerate(lines):
        a = f"min(1,max(0,(t-{delay})/0.5))"
        vf.append(f"{text(f'{out}_{i}.txt', s, work)}:fontsize={size}:fontcolor={color}:x=(w-tw)/2:y='{y0.format(off=off, d=delay)}':alpha='{a}'")
    vf.append(f"drawbox=x=(iw-180)/2:y=ih/2-6:w=180:h=6:color={CORAL}:t=fill")
    if fade_in:
        vf.append("fade=t=in:st=0:d=0.6")
    if fade_out:
        vf.append(f"fade=t=out:st={length - 0.9}:d=0.9")
    ff(["-f", "lavfi", "-i", f"color=c={BG}:s=1920x1080:r={FPS}:d={length}", "-vf", ",".join(vf), "-frames:v", str(round(length * FPS)), *ENC, out], work)


def shot(i, s, work):
    clip, t_in, beats, label, punch = s
    n = round(beats * BEAT * FPS)
    vf = ["setpts=PTS-STARTPTS", "scale=1920:1080:flags=lanczos", "setsar=1", f"fps={FPS}", "tpad=stop_mode=clone:stop_duration=1"]
    if punch:
        vf.append("zoompan=z='1+0.14*pow(max(0,1-on/9),2)':x='iw/2-iw/zoom/2':y='ih/2-ih/zoom/2':d=1:s=1920x1080:fps=30")
        vf.append("fade=t=in:st=0:d=0.2:color=white")
    if label:
        vf.append(f"drawbox=x=48:y=ih-92:w=5:h=34:color={CORAL}@0.9:t=fill:enable='gte(t,0.15)'")
        vf.append(f"{text(f'lab{i:02d}.txt', label, work)}:fontsize=30:fontcolor={CREAM}@0.9:box=1:boxcolor=black@0.35:boxborderw=8:x=66:y=h-90:alpha='min(1,max(0,(t-0.15)/0.3))'")
    out = f"s{i:02d}.mp4"
    ff(["-ss", str(t_in), "-i", str(ROOT / "media" / clip), "-vf", ",".join(vf), "-frames:v", str(n), *ENC, out], work)
    return out


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    work = Path(args[0]) if args else ROOT / "_work" / "reel2" / "build"
    work.mkdir(parents=True, exist_ok=True)
    soundtrack(work / "soundtrack.wav")
    card("title.mp4", work, [("MOTION STUDIO", 150, CREAM, 190, 0.2), ("Second set: every frame made with code", 50, CREAM + "@0.85", -40, 0.6)], TITLE_LEN, True, False)
    parts = ["title.mp4"] + [shot(i, s, work) for i, s in enumerate(SHOTS)]
    card("end.mp4", work, [("Open index.html to see them all live", 64, CREAM, -36, 0.15)], END_LEN, False, True)
    parts.append("end.mp4")
    (work / "list.txt").write_text("".join(f"file '{p}'\n" for p in parts), encoding="utf8")
    OUT.parent.mkdir(parents=True, exist_ok=True)
    ff(["-f", "concat", "-safe", "0", "-i", "list.txt", "-i", "soundtrack.wav", "-map", "0:v", "-map", "1:a",
        "-c:v", "libx264", "-crf", "20", "-preset", "slow", "-pix_fmt", "yuv420p", "-r", str(FPS), "-threads", "8",
        "-maxrate", "5200k", "-bufsize", "10400k",
        "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", "-t", str(DUR), str(OUT)], work)
    if "--keep" not in sys.argv:
        shutil.rmtree(work)
    for t, s in zip(timeline(), SHOTS):
        print(f"{t:5.1f}  {s[2] * BEAT:3.1f}s  {s[0]} @ {s[1]}")
    print(f"total {DUR:.1f} s -> {OUT}")


if __name__ == "__main__":
    main()
