# Copyright (c) 2026 Dor5hacham d5shacham@gmail.com. All rights reserved.
# SPDX-License-Identifier: Proprietary

# Synthesizes the 60 s soundtrack for the motion reel, synced to the visual timeline.
# Usage: uv run --with numpy --with scipy audio.py <out.wav>
import sys
import numpy as np
from scipy.signal import butter, sosfilt, fftconvolve
from scipy.io import wavfile

SR = 48000
DUR = 60.0
N = int(SR * DUR)
rng = np.random.default_rng(3)
L = np.zeros(N)
R = np.zeros(N)
send = np.zeros(N)  # mono reverb send
duck_src = np.zeros(N)  # kick trigger envelope for sidechain


def mtof(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def add(sig, t, gain=1.0, pan=0.0, rev=0.0):
    i = int(t * SR)
    if i >= N:
        return
    sig = sig[: N - i] * gain
    lg, rg = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
    L[i : i + len(sig)] += sig * lg * 1.414
    R[i : i + len(sig)] += sig * rg * 1.414
    send[i : i + len(sig)] += sig * rev


def env(n, a, d):
    t = np.arange(n) / SR
    e = np.exp(-t / d)
    na = max(1, int(a * SR))
    e[:na] *= np.linspace(0, 1, na)
    return e


def filt(x, kind, f, order=2):
    sos = butter(order, f, btype=kind, fs=SR, output="sos")
    return np.asarray(sosfilt(sos, x))


# ---------- instruments ----------
def kick(t, g=1.0):
    n = int(0.55 * SR)
    tt = np.arange(n) / SR
    f = 45 + 110 * np.exp(-tt * 28)
    ph = 2 * np.pi * np.cumsum(f) / SR
    s = np.sin(ph) * np.exp(-tt * 7) + 0.25 * np.exp(-tt * 300) * rng.standard_normal(n) * 0.3
    add(np.tanh(s * 1.6), t, 0.9 * g)
    i = int(t * SR)
    d = np.exp(-np.arange(int(0.3 * SR)) / SR / 0.09)
    duck_src[i : i + len(d)] = np.maximum(duck_src[i : i + len(d)], d[: N - i] if i < N else d[:0])


def hat(t, g=1.0, open_=False):
    n = int((0.25 if open_ else 0.06) * SR)
    s = filt(rng.standard_normal(n), "highpass", 7500) * env(n, 0.001, 0.07 if open_ else 0.018)
    add(s, t, 0.22 * g, pan=0.25, rev=0.1)


def clap(t, g=1.0):
    n = int(0.3 * SR)
    s = filt(rng.standard_normal(n), "bandpass", [900, 2500])
    e = np.zeros(n)
    for k, off in enumerate([0, 0.011, 0.022]):
        j = int(off * SR)
        e[j:] += np.exp(-np.arange(n - j) / SR / (0.012 if k < 2 else 0.09))
    add(s * e, t, 0.45 * g, pan=-0.1, rev=0.35)


def bass(t, m, dur, g=1.0):
    n = int(dur * SR)
    tt = np.arange(n) / SR
    f = mtof(m)
    s = np.sin(2 * np.pi * f * tt) + 0.35 * np.sin(4 * np.pi * f * tt) + 0.15 * np.sign(np.sin(2 * np.pi * f * tt))
    s = filt(s, "lowpass", 900) * env(n, 0.004, dur * 0.6)
    add(np.tanh(s * 1.3), t, 0.42 * g)


def pluck(t, m, g=1.0, pan=0.0, bright=4000):
    n = int(0.6 * SR)
    tt = np.arange(n) / SR
    f = mtof(m)
    s = sum(np.sin(2 * np.pi * f * h * tt + h) * (0.6 ** (h - 1)) for h in range(1, 6))
    s = filt(s, "lowpass", bright) * env(n, 0.002, 0.16)
    add(s, t, 0.11 * g, pan=pan, rev=0.45)


def bell(t, m, g=1.0, pan=0.0):
    n = int(3.0 * SR)
    tt = np.arange(n) / SR
    f = mtof(m)
    s = np.sin(2 * np.pi * f * tt + 1.8 * np.sin(2 * np.pi * f * 3.5 * tt) * np.exp(-tt * 3)) * env(n, 0.002, 0.9)
    add(s, t, 0.16 * g, pan=pan, rev=0.6)


def blip(t, m, g=1.0, pan=0.0):
    n = int(0.12 * SR)
    tt = np.arange(n) / SR
    f = mtof(m) * (1 + 0.6 * np.exp(-tt * 60))
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * env(n, 0.001, 0.035)
    add(s, t, 0.18 * g, pan=pan, rev=0.25)


def tick(t, g=1.0, pan=0.0):
    n = int(0.03 * SR)
    s = filt(rng.standard_normal(n), "bandpass", [2500, 6000]) * env(n, 0.0005, 0.006)
    add(s, t, 0.25 * g, pan=pan, rev=0.05)


def whoosh(t0, t1, g=1.0, up=True):
    n = int((t1 - t0) * SR)
    x = np.linspace(0, 1, n)
    noise = rng.standard_normal(n)
    out = np.zeros(n)
    chunks = 24
    for c in range(chunks):
        a, b = c * n // chunks, (c + 1) * n // chunks
        k = (c + 0.5) / chunks
        fc = 300 * (40 ** (k if up else 1 - k))
        out[a:b] = filt(noise[max(0, a - 2000) : b], "bandpass", [fc * 0.7, min(fc * 1.4, 20000)])[-(b - a) :]
    shape = x**2 if up else (1 - x) ** 2
    add(out * shape, t0, 0.35 * g, rev=0.4)


def impact(t, g=1.0):
    n = int(2.5 * SR)
    tt = np.arange(n) / SR
    f = 32 + 60 * np.exp(-tt * 10)
    boom = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt * 2.2)
    crack = filt(rng.standard_normal(n), "lowpass", 5000) * np.exp(-tt * 9)
    add(np.tanh((boom * 1.2 + crack * 0.4) * 1.5), t, 0.85 * g, rev=0.5)


def glitch(t, dur, g=1.0):
    n = int(dur * SR)
    tt = np.arange(n) / SR
    s = np.sign(np.sin(2 * np.pi * (220 + 1800 * rng.random()) * tt)) * (rng.random(n) > 0.3)
    s *= np.repeat(rng.random(n // 600 + 1) > 0.4, 600)[:n]
    add(filt(s, "bandpass", [400, 6000]) * env(n, 0.001, dur), t, 0.16 * g, pan=rng.uniform(-0.6, 0.6))


def debris(t0, count, spread, g=1.0):
    for _ in range(count):
        t = t0 + abs(rng.normal(0, spread))
        n = int(0.08 * SR)
        fc = rng.uniform(600, 3000)
        s = filt(rng.standard_normal(n), "bandpass", [fc * 0.7, fc * 1.3]) * env(n, 0.0005, rng.uniform(0.01, 0.03))
        add(s, t, rng.uniform(0.05, 0.18) * g, pan=rng.uniform(-0.8, 0.8), rev=0.3)


# ---------- harmony ----------
CHORDS = [  # (bass midi, chord tones) Am9, Fmaj7, Cmaj7, G6
    (45, [57, 60, 64, 67, 71]),
    (41, [53, 57, 60, 64]),
    (48, [55, 60, 64, 71]),
    (43, [55, 59, 62, 64]),
]


def chord_at(t):
    return CHORDS[int(t // 2) % 4]


def pad_section(t0, t1, gain_fn):
    # Detuned additive pad, one chord per bar with crossfades.
    bar = t0
    while bar < t1:
        b0 = max(bar - 0.25, 0)
        b1 = min(bar + 2.25, t1 + 0.6)
        n = int((b1 - b0) * SR)
        tt = np.arange(n) / SR
        _, tones = chord_at(bar + 0.01)
        s = np.zeros(n)
        for m in tones:
            for det in (-0.09, 0.0, 0.08):
                f = mtof(m + det)
                s += np.sin(2 * np.pi * f * tt + rng.uniform(0, 6.28)) + 0.3 * np.sin(4 * np.pi * f * tt) + 0.12 * np.sin(6 * np.pi * f * tt)
        e = np.minimum(1, np.minimum(tt / 0.3, (b1 - b0 - tt) / 0.3)).clip(0, 1)
        g = gain_fn(b0 + tt)
        s = s * e * g / (len(tones) * 3)
        add(s * (1 + 0.15 * np.sin(2 * np.pi * 0.3 * tt)), b0, 0.5, pan=-0.3, rev=0.6)
        add(s * (1 + 0.15 * np.cos(2 * np.pi * 0.27 * tt)), b0, 0.5, pan=0.3, rev=0.6)
        bar += 2


# ---------- arrangement ----------
B = 0.5  # beat length at 120 BPM

# Intro 0-6: pad swell, dot pop, stretch whoosh, line split, letter ticks, typewriter, riser
pad_section(0, 6, lambda t: np.clip(t / 1.5, 0, 1) * 0.9)
blip(0.15, 84, 1.3)
whoosh(0.7, 1.35, 0.8)
impact(1.32, 0.45)
for i in range(11):
    tick(1.45 + i * 0.045, 0.9, pan=-0.6 + i * 0.12)
for i in range(0, 61, 2):
    tick(2.6 + i / 61 * 1.3, 0.45, pan=0.1)
bell(2.2, 76, 0.8)
bell(2.7, 81, 0.5, pan=0.3)
whoosh(4.6, 6.0, 1.2)

# Main groove builder
def groove(t0, t1, half=False, claps=True, arp=True, arp_gain=1.0, bass_gain=1.0):
    t = t0
    while t < t1 - 1e-6:
        beat = round((t - t0) / B)
        bb, tones = chord_at(t + 0.01)
        if not half or beat % 2 == 0:
            kick(t)
        hat(t + B / 2, 1.0, open_=(beat % 4 == 3))
        hat(t + B / 4, 0.4)
        hat(t + 3 * B / 4, 0.4)
        if claps and beat % 2 == 1 and not half:
            clap(t)
        if half and beat % 4 == 2:
            clap(t, 1.1)
        for k in range(2):
            m = bb + (12 if (beat * 2 + k) % 4 == 3 else 0)
            bass(t + k * B / 2, m, B / 2 * 0.95, bass_gain)
        if arp:
            seq = tones + [x + 12 for x in tones]
            for k in range(4):
                idx = (beat * 4 + k) * 3 % len(seq)
                pluck(t + k * B / 4, seq[idx] + 12, 0.9 * arp_gain * (1.0 if k == 0 else 0.7), pan=0.5 * np.sin(beat + k))
        t += B

impact(6.0, 1.0)
groove(6.0, 14.0, arp_gain=1.0)
pad_section(6, 22, lambda t: 0.35 + 0 * t)
# SDF section: lighter, fewer claps
whoosh(13.4, 14.0, 0.7)
impact(14.0, 0.6)
groove(14.0, 22.0, claps=True, arp_gain=0.8)
whoosh(20.8, 22.0, 1.3)
# 22: glitch cut into the physics shot, ball hit, slow-motion half-time
for k in range(6):
    glitch(21.82 + k * 0.06, 0.05)
impact(22.0, 0.6)
impact(22.53, 1.35)
debris(22.55, 70, 0.5, 1.2)
groove(23.0, 30.0, half=True, arp=False, bass_gain=1.1)
pad_section(22, 30, lambda t: 0.45 + 0 * t)
# Shapes 30-38: playful plucks and pops, bouncing-ball boings
whoosh(29.3, 30.0, 0.8)
impact(30.0, 0.5)
for i in range(14):
    blip(30.05 + i * 0.045, 72 + (i * 5) % 17, 0.7, pan=-0.7 + i * 0.1)
groove(30.5, 38.0, arp_gain=1.1)
for i in range(5):
    tb = 34.6 + i * 0.52
    if tb < 36.9:
        blip(tb, 60 + i * 2, 1.4)
whoosh(36.9, 37.75, 0.6, up=False)
pad_section(30, 38, lambda t: 0.3 + 0 * t)
# Cubes 38-46: full energy, riser into the glitch cut
impact(38.0, 0.8)
groove(38.0, 46.0, arp_gain=1.0, bass_gain=1.15)
pad_section(38, 46, lambda t: 0.4 + 0 * t)
whoosh(44.0, 46.0, 1.6)
for k in range(6):
    glitch(45.82 + k * 0.06, 0.05)
# Noise 46-52: word slams on the beat, glitch stutter at the end
impact(46.0, 0.7)
for at in (46.5, 47.0, 47.5):
    impact(at, 0.9)
    kick(at, 1.2)
groove(48.0, 50.5, arp_gain=1.0)
for k in range(12):
    glitch(50.6 + k * 0.058, 0.05, 1.2)
whoosh(51.0, 52.0, 1.0)
pad_section(46, 52, lambda t: 0.4 + 0 * t)
# End 52-60: pad + soft arpeggio, sign-off bell, fade out
impact(52.0, 0.55)
pad_section(52, 60, lambda t: 0.75 * np.clip((59.9 - t) / 1.6, 0, 1))
for i in range(int(5.5 / 0.25)):
    t = 52.0 + i * 0.25
    _, tones = chord_at(t + 0.01)
    pluck(t, tones[i % len(tones)] + 12, 0.55, pan=0.4 * np.sin(i), bright=2500)
for i, m in enumerate([69, 76, 81]):
    bell(58.05 + i * 0.12, m, 0.9, pan=-0.3 + i * 0.3)

# ---------- mix ----------
duck = 1 - 0.55 * duck_src
# Apply sidechain to everything except the kick itself (kick is short, small leak is fine)
L *= duck * 0.6 + 0.4
R *= duck * 0.6 + 0.4
ir_n = int(2.8 * SR)
it = np.arange(ir_n) / SR
irL = rng.standard_normal(ir_n) * np.exp(-it / 0.55)
irR = rng.standard_normal(ir_n) * np.exp(-it / 0.55)
irL, irR = filt(irL, "lowpass", 6000), filt(irR, "lowpass", 6000)
sendf = filt(send, "highpass", 200)
L += fftconvolve(sendf, irL)[:N] * 0.018
R += fftconvolve(sendf, irR)[:N] * 0.018
st = np.stack([L, R], 1)
st = filt(st.T, "highpass", 25).T
st = np.tanh(st * 1.1)
fade = np.ones(N)
fade[-int(0.6 * SR):] = np.linspace(1, 0, int(0.6 * SR))
st *= fade[:, None]
st /= np.max(np.abs(st)) / 0.89
wavfile.write(sys.argv[1], SR, (st * 32767).astype(np.int16))
print("AUDIO DONE", sys.argv[1], f"peak={np.max(np.abs(st)):.3f}")
