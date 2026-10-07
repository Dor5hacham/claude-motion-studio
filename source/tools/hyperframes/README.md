# HyperFrames example: "Pulse 2.0" product launch (8 s)

HyperFrames (by HeyGen, Apache-2.0, https://github.com/heygen-com/hyperframes) turns an
HTML page into a video. You write a normal HTML/CSS/JS "video page". Timed elements carry
`data-start` and `data-duration` attributes, and one paused GSAP timeline is registered on
`window.__timelines`. The CLI opens the page in headless Chrome, seeks the timeline frame by
frame, takes a screenshot of each frame and encodes the frames with FFmpeg. It is built for
AI agents: there is a linter, a runtime/layout/contrast checker and inline docs in the CLI.

Clip: `media/tools/hyperframes.mp4` (1280x720, 30 fps, 8 s).

## What the composition shows

- Three scenes as timed clips (`<section class="clip" data-start data-duration>`):
  kinetic headline, animated product UI mockup, logo lockup.
- A caption track: four subtitle lines, each its own timed clip, with karaoke-style word
  highlights driven by the same GSAP timeline.
- GSAP techniques: masked word reveals with stagger, stepped clip-path "typing", 3D tilt-in
  (`rotationX` with CSS perspective), an odometer counter made of digit strips (pure
  transforms, so it is seek-safe), SVG line drawing with `strokeDashoffset`, an SVG clip-rect
  area reveal, a cursor click with ripple, status pills that cross-fade, SVG ring bursts
  driven by `attr: { r }`.
- Fonts are the Windows system fonts Bahnschrift, Segoe UI and Cascadia Mono, declared with
  `@font-face { src: local(...) }` so the linter accepts them. Every `font-family` has a
  fallback stack (Bahnschrift, then Segoe UI, then `system-ui`, `sans-serif`; Cascadia Mono,
  then Consolas, then `monospace`), so on a machine without these fonts the text still renders
  in a similar face.

## Requirements

- Node.js 22 or newer and FFmpeg on PATH.
- On the first check or render, the CLI downloads its own `chrome-headless-shell`
  (about 270 MB) to `~/.cache/hyperframes/chrome`. It also writes `~/.hyperframes/`
  (config and install state). `npx hyperframes browser` manages that browser.

## Install and render

```bash
# New project from scratch (what this example started from)
npx hyperframes init launch --example blank --non-interactive
cd launch
# replace index.html with the one in this folder, then:

npx hyperframes lint            # static checks
npx hyperframes check           # lint + runtime + layout + contrast in headless Chrome
npx hyperframes preview         # live preview studio in the browser
npx hyperframes render . -o renders/launch.mp4 -f 30 -q high -w 8
```

In this folder, `package.json` pins the CLI version used (`hyperframes@0.8.140`), so
`npm run check` and `npm run render` also work.

Optional: set `HYPERFRAMES_NO_TELEMETRY=1` (or `DO_NOT_TRACK=1`) to switch off the CLI's
anonymous usage telemetry.

The gallery clip was re-encoded after the render:

```bash
ffmpeg -i renders/launch.mp4 -c:v libx264 -crf 22 -preset slow -pix_fmt yuv420p -movflags +faststart -an hyperframes.mp4
```

## Rules that matter (from the CLI docs and linter)

- Create the timeline with `gsap.timeline({ paused: true })` and register it under the
  composition id: `window.__timelines["main"] = tl`.
- Only deterministic code: no `Date.now()`, no `Math.random()`, no CSS transitions, no
  `repeat`/`yoyo`. The renderer seeks to each frame, so everything must be a function of time.
- Do not put a CSS `transform` on an element whose transform GSAP animates; use `fromTo`.
- Animate transforms and opacity, not layout properties such as `letter-spacing`.
- `npx hyperframes docs <topic>` prints the reference (data-attributes, gsap, compositions,
  rendering, troubleshooting).
