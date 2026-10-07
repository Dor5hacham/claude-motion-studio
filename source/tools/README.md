# Code-to-video tool projects

Each folder is a small project that renders one clip in `media/tools/`. Each has its own README with the exact install and render commands; `node_modules` and downloaded browsers are not committed.

| Folder | Tool | What it is | Clip |
|---|---|---|---|
| `remotion/` | Remotion | React components rendered to video frame by frame | `remotion.mp4`, stat cards for social |
| `hyperframes/` | HyperFrames (HeyGen) | One HTML page with timed elements and a GSAP timeline, rendered by its CLI | `hyperframes.mp4`, product launch spot |
| `motion-canvas/` | Motion Canvas | TypeScript generator animations, code morphs; rendered by scripting the editor's Render button | `motion-canvas.mp4`, async code explainer |
| `manim/` | Manim Community | Python math animation | `manim.mp4`, Fourier series |
| `threejs/` | Three.js | WebGL 3D scene rendered frame by frame in headless Chrome | `threejs.mp4`, glass knot over rippling columns |
| `webgpu/` | WebGPU | WGSL compute shader moving one million particles | `webgpu.mp4`, particles onto a strange attractor |

Common needs: Node 22+ (24 used here), FFmpeg on PATH, Chrome, and for Manim `uv` with Python 3.12. Notes worth knowing before you run them:

- HyperFrames downloads its own headless Chrome (about 270 MB) into `~/.cache/hyperframes` on first render.
- Remotion downloads Chrome Headless Shell into the project on first render.
- WebGPU needs a secure context: serve the page from `http://localhost`, not `file://`.
- The Three.js and WebGPU renders expose `window.renderFrame(f)` so every frame is exact; WebGPU frames must render in order because the simulation keeps state.
