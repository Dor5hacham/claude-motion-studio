# Reel 2

Source for `media/reel/claude-motion-reel-2.mp4`: a 42.5 s beat-synced showreel of the second set of clips (29 of the 35 new clips in `media/edit/`, `media/engine/` and `media/tools/`). It is 1920x1080, 30 fps, H.264 with an AAC soundtrack, about 19 MB.

| File | What it does |
|---|---|
| `make_reel2.py` | Synthesizes the 120 BPM soundtrack with NumPy, renders the title card, every shot and the end card with FFmpeg, then joins them and muxes the audio |

## Rebuild

Run from the repo root (needs `ffmpeg` on PATH and the clips in `media/`):

```
uv run --with numpy --with scipy source/reel2/make_reel2.py
```

It takes about 30 s on the CPU and runs one FFmpeg at a time with `-threads 8`. Temp files go in `_work/reel2/build/` and are deleted at the end; pass `--keep` to keep them (the soundtrack is `soundtrack.wav` there).

To change the edit, edit the `SHOTS` list: each row is the clip, the in-point in seconds, the length in beats, an optional lower-left label and whether the shot gets a flash and zoom punch. The soundtrack follows the same list, so cuts stay on the beat.

## How it works

- Soundtrack: kick, clap, snare roll, hats, crash, sine-and-square bass, a detuned saw pad, a plucked arpeggio, noise risers and an ending hit (sub boom, kick, crash, bells), over Am, F, C, G. The pad, bass and arpeggio duck under the kick. A noise reverb send glues it together.
- Picture: each shot is cut from its clip with `-ss`, scaled to 1080p with lanczos, padded so it always has enough frames, and cut to an exact frame count (2 s is 60 frames, one beat is 15). Downbeats in the fast section get a 14% zoom punch (`zoompan`) and a 0.2 s white flash. Cards are drawn with `drawtext` in Bahnschrift on `#0b0b10` with a coral `#ff5a36` bar.
- Every cut lands on the 0.5 s beat grid, and a kick sits under every cut.

## Timeline

| Time (s) | Cut rate | Shots | Music |
|---|---|---|---|
| 0.0 to 3.0 | | Title card, fades in from black | Pad swell, soft riser |
| 3.0 to 19.0 | One per bar (2 s) | Spectrogram word, floating island, neon installation, CNC engraving, prism, Lumen time-lapse, liquid hourglass, VFX composite | Kick and bass, then hats, claps and arpeggio; riser and snare roll in the last bar |
| 19.0 to 27.0 | One per beat (0.5 s) | Light ribbons, path tracer, speaker, diffraction, slit-scan, MPM, dominoes, video wall, optical flow, rack focus, pixel sort, motion tracking, VHS, photomosaic, optimizers, FFmpeg graph | The drop: crash on every bar, 16th hats, 16th bass, fast arpeggio; flash and punch on each downbeat |
| 27.0 to 35.0 | One per bar | PyVista flow, exploded view, font rasterizer, Super 8 | Groove with open hats |
| 35.0 to 39.0 | One shot for two bars | Skipping stone at dusk | Half-time drums, reverse riser |
| 39.0 to 42.5 | | End card, fades out to black | Ending hit and bells |
