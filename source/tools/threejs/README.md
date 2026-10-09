# Three.js example: glass knot over an instanced wave field

Three.js is a JavaScript library for real-time 3D in the browser (WebGL).
This scene uses:

- `MeshPhysicalMaterial` glass (transmission, thickness, IOR, clearcoat,
  iridescence) on a torus knot with a glowing core inside
- `RoomEnvironment` through `PMREMGenerator` for image-based lighting
- an `InstancedMesh` of 1,444 rounded columns, animated per frame as radial
  waves; per-instance colour is also fed into emission through
  `onBeforeCompile`, so the wave crests glow
- `EffectComposer` with `RenderPass`, `UnrealBloomPass` and `OutputPass`
  (ACES tone mapping), on a 4x MSAA half-float render target

Time is not real time: the page exposes `window.renderFrame(f)`, which sets
the scene to frame `f` (30 fps) and renders once. `render.mjs` serves this
folder over HTTP (ES modules and import maps do not load from file://),
drives headless Chrome on the GPU with playwright-core, and saves one PNG per
frame.

## Install

    npm install

render.mjs needs Google Chrome. It uses `CHROME_PATH` if that is set, else the
standard install path for the OS (on Windows,
`C:/Program Files/Google/Chrome/Application/chrome.exe`). For another path, set
`CHROME_PATH` to your Chrome executable before you render.

## Render

    node render.mjs index.html frames 210 4
    ffmpeg -framerate 30 -i frames/f_%05d.png -an -c:v libx264 -crf 22 -preset slow -pix_fmt yuv420p -movflags +faststart threejs.mp4

Arguments: page, output folder, frame count, parallel browser tabs. Add frame
numbers at the end to render only those (for example `... 210 2 0 105 209`).

To view it live, serve the folder (for example `npx serve .`) and call
`renderFrame(n)` from the console, or add a requestAnimationFrame loop.
