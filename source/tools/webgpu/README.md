# WebGPU example: one million particles, curl noise to a strange attractor

WebGPU is the browser's modern GPU API: it has compute shaders (written in
WGSL) as well as rendering. Here a compute shader updates 1,000,000
particles every step; there is no CPU work per particle.

- Storage buffer of 1,000,000 particles (position, velocity, dye), 32 MB
- Init compute pass: a tight ball with radial burst velocities
- Step compute pass (2 per frame): velocity eases toward a target field.
  First a curl-noise flow (curl of a 3D simplex-noise vector potential), then
  it blends into the Thomas cyclically symmetric attractor
  (dx = sin y - b x, cyclic), which is bounded, so every particle lands on it
- Render pass: `point-list` with additive blending into a 2x-size
  `rgba16float` buffer; the previous frame is faded in first (trails)
- Composite pass: 2x downsample, two-ring glow, tone map on peak channel,
  vignette

`window.renderFrame(f)` advances the simulation to frame `f`. The state is
carried from frame to frame, so frames must be rendered in order with one
worker. `render.mjs` serves this folder over HTTP and drives headless Chrome.

## WebGPU in headless Chrome on Windows

Tested with Chrome 154 on an AMD RX 9070 XT. `navigator.gpu` only exists in a
secure context: it is missing on `about:blank`, present on `http://localhost`.
With the page on localhost, headless Chrome returned an adapter with every
flag set tried (vendor `amd`, architecture `rdna-4`). render.mjs launches
with `--enable-unsafe-webgpu --use-angle=d3d11 --enable-gpu --ignore-gpu-blocklist`.
`probe.mjs` repeats the adapter test: `node probe.mjs A` (sets A to D).

## Install

    npm install

## Render

    node render.mjs index.html frames 240 1
    ffmpeg -framerate 30 -i frames/f_%05d.png -an -c:v libx264 -crf 22 -preset slow -pix_fmt yuv420p -movflags +faststart webgpu.mp4

Single test frames (still in order; skipped frames are simulated, not saved):

    node render.mjs index.html test 240 1 0 60 120 239
