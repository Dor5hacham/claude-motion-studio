# Editing tricks

Scripts that change existing footage with FFmpeg and Python. Each one reads the full-quality reel master and writes a clip to `media/edit/`. Run them from this folder; the exact command is in each file's header.

| Script | Clip | Trick | How |
|---|---|---|---|
| `speed-ramp.py` | `speed-ramp.mp4` | 1x to 0.2x optical-flow slow motion to 2x | `minterpolate` (motion-compensated), smoothstep speed curve, synthetic motion blur |
| `datamosh.py` | `datamosh.mp4` | Motion from one shot smears the pixels of another | MPEG-4 Part 2 stream with the I-frame removed and one P-frame repeated |
| `split-screen.py` | `split-screen.mp4` | 2x2 grid flies in, one tile expands | Python (Pillow) compositing fed by FFmpeg |
| `color-grade.sh` | `color-grade.mp4` | Teal-and-orange grade with a before/after wipe | Generated 3D LUT (.cube) + `lut3d` + `maskedmerge` |
| `boomerang.py` | `boomerang.mp4` | Forward/reverse loop, stutter, freeze frame | Frame ordering in Python, flash and push-in with NumPy |
| `slit-scan.py` | `slit-scan.mp4` | Every pixel shows a different moment (rows, radial, waves) | Per-pixel delay map, NumPy gather from a frame buffer, two-frame blend |
| `pixel-sort.py` | `pixel-sort.mp4` | Brightness-band runs sorted along rows, then columns | Run segments by cumulative sum, one `argsort` per row, animated threshold |
| `track-callout.py` | `track-callout.mp4` | A callout pinned to a tracked object, through an occlusion | OpenCV feature points (Lucas-Kanade), template matching forward and backward, Hermite bridge, Pillow overlay |
| `beat-cut.py` | `beat-cut.mp4` | Cuts, flashes and zoom punches on beats found in the audio | NumPy synth, STFT spectral flux in three bands, crash ring test for downbeats, AAC mux |
| `vhs.py` | `vhs.mp4` | Home video on tape: play, rewind, pause | NumPy VHS deck model in YIQ (chroma smear, halo, line jitter, tracking band, head-switching), Pillow OSD |
| `optical-flow.py` | `optical-flow.mp4` | Motion of every pixel as color, arrows, then particle trails | OpenCV Farneback dense flow, HSV coding, particle advection |
| `photomosaic.py` | `photomosaic.mp4` | Zoom out from one clip to 1,600 playing tiles that draw a picture | 3x3 color features, greedy nearest match with a reuse cost, tile tint, log-space zoom |
| `stabilize.py` | `stabilize.mp4` | Handheld shake added, then removed, side by side | OpenCV LK features, RANSAC similarity per frame, moving-average camera path, warp and zoom |
| `vfx-comp.py` | `vfx-comp.mp4` | Fire element composited behind 3D letters, with a 4-up breakdown | Unmultiply, letter matte from the plate, screen, interactive light, heat haze with `cv2.remap` |
| `video-wall.py` | `video-wall.mp4` | 27 playing clips on a curved 3D wall, camera flies into one | Pinhole projection in NumPy, `cv2.warpPerspective` per card, depth sort and fog |
| `super8.py` | `super8.mp4` | Home movie on Super 8 film | 18 fps cadence, gate weave, stock curve, halation, grain, dust, scratch, film burns |
| `match-cut.py` | `match-cut.mp4` | One circle carried through 7 shots, cut shape on shape | `cv2.HoughCircles` per frame, per-shot scale to a growing virtual radius |

```
uv run --with numpy --with pillow speed-ramp.py
uv run datamosh.py
uv run --with numpy --with pillow split-screen.py
bash color-grade.sh
uv run --with numpy --with pillow boomerang.py
uv run --with numpy --with pillow slit-scan.py
uv run --with numpy --with pillow pixel-sort.py
uv run --with numpy --with pillow --with opencv-python-headless track-callout.py
uv run --with numpy --with pillow beat-cut.py
uv run --with numpy --with pillow vhs.py
uv run --with numpy --with pillow --with opencv-python-headless optical-flow.py
uv run --with numpy --with pillow --with opencv-python-headless photomosaic.py
uv run --with numpy --with pillow --with opencv-python-headless stabilize.py
uv run --with numpy --with pillow --with opencv-python-headless vfx-comp.py
uv run --with numpy --with pillow --with opencv-python-headless video-wall.py
uv run --with numpy --with pillow --with opencv-python-headless super8.py
uv run --with numpy --with pillow --with opencv-python-headless match-cut.py
```

Input: `media/reel/master/claude-motion-reel-master.mp4` (60 fps). It is not in git because it is 494 MB; download it from the repository's Releases into `media/reel/master/` first. Temporary files go to `_work/` at the repository root and are deleted at the end of each run.

The newer scripts (from `slit-scan.py` on) read the clips that are already in `media/` instead, so they run without the master download.
