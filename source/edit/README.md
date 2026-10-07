# Editing tricks

Scripts that change existing footage with FFmpeg and Python. Each one reads the full-quality reel master and writes a clip to `media/edit/`. Run them from this folder; the exact command is in each file's header.

| Script | Clip | Trick | How |
|---|---|---|---|
| `speed-ramp.py` | `speed-ramp.mp4` | 1x to 0.2x optical-flow slow motion to 2x | `minterpolate` (motion-compensated), smoothstep speed curve, synthetic motion blur |
| `datamosh.py` | `datamosh.mp4` | Motion from one shot smears the pixels of another | MPEG-4 Part 2 stream with the I-frame removed and one P-frame repeated |
| `split-screen.py` | `split-screen.mp4` | 2x2 grid flies in, one tile expands | Python (Pillow) compositing fed by FFmpeg |
| `color-grade.sh` | `color-grade.mp4` | Teal-and-orange grade with a before/after wipe | Generated 3D LUT (.cube) + `lut3d` + `maskedmerge` |
| `boomerang.py` | `boomerang.mp4` | Forward/reverse loop, stutter, freeze frame | Frame ordering in Python, flash and push-in with NumPy |

```
uv run --with numpy --with pillow speed-ramp.py
uv run datamosh.py
uv run --with numpy --with pillow split-screen.py
bash color-grade.sh
uv run --with numpy --with pillow boomerang.py
```

Input: `media/reel/master/claude-motion-reel-master.mp4` (60 fps). It is not in git because it is 494 MB; download it from the repository's Releases into `media/reel/master/` first. Temporary files go to `_work/` at the repository root and are deleted at the end of each run.
