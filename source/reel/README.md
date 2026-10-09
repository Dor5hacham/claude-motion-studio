# The reel

Source for `media/reel/claude-motion-reel.mp4` (web version) and the full-quality master (`media/reel/master/claude-motion-reel-master.mp4`, published as an asset of [Release v1.0](https://github.com/Dor5hacham/claude-motion-studio/releases/tag/v1.0) because it is 494 MB).

| File | What it does |
|---|---|
| `reel.html` | The renderer: all web scenes, transitions, captions and post effects. `renderFrame(f)` draws frame `f` at 60 fps |
| `render.mjs` | Opens `reel.html` in headless Chrome on the GPU and saves frames as PNG |
| `blender_scene.py` | Builds the rigid-body scene in Blender, bakes the physics and renders it with Eevee |
| `audio.py` | Synthesizes the soundtrack |
| `soundtrack.wav` | The soundtrack used in the reel |

## Rebuild

Run these from this folder (`source/reel`) in Git Bash. Steps 1 to 3 write about 11 GB; delete `frames/`, `blender/` and `node_modules/` afterwards.

1. Install the browser driver:

   ```
   npm install
   ```

2. Render the Blender shot into `blender/` (480 frames, about 4 minutes). Set `BLENDER` to the path of your Blender 5.2 executable first, for example `export BLENDER="/c/Program Files/Blender Foundation/Blender 5.2/blender.exe"` for the default Windows install:

   ```
   mkdir -p blender
   "$BLENDER" -b -P blender_scene.py -- "$(pwd -W)/blender"
   ```

3. Render the 3,600 web frames into `frames/` with 6 Chrome pages (about 18 minutes, needs step 2):

   ```
   node render.mjs frames 6 all
   ```

   A few test frames instead: `node render.mjs test 3 120 900 1500`.

4. Optional, rebuild the soundtrack (4 seconds):

   ```
   uv run --with numpy --with scipy audio.py soundtrack.wav
   ```

5. Encode the master and the web version:

   ```
   ffmpeg -framerate 60 -i frames/f_%05d.png -i soundtrack.wav -c:v libx264 -preset slow -crf 16 -pix_fmt yuv420p -movflags +faststart -c:a aac -b:a 256k -af "volume=-4.8dB" -shortest ../../media/reel/master/claude-motion-reel-master.mp4
   ffmpeg -i ../../media/reel/master/claude-motion-reel-master.mp4 -vf fps=30 -c:v libx264 -preset slow -crf 26 -pix_fmt yuv420p -movflags +faststart -c:a aac -b:a 160k ../../media/reel/claude-motion-reel.mp4
   ```
