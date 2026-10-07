# Motion Canvas example: animated code explainer (7.7 s)

Motion Canvas (https://motioncanvas.io, MIT) is a TypeScript library for programmatic
animation. A scene is a generator function. You build a tree of nodes with JSX, then
`yield*` animations in order; `all(...)`, `sequence(...)` and `delay(...)` run them in
parallel or staggered. Values are reactive signals, so a text node can show
`() => total() + " ms"` and update every frame. The `Code` node can highlight code, dim
everything outside a selection, and morph one version of the code into another with an
automatic diff. The editor runs in the browser on a Vite dev server, and the
`@motion-canvas/ffmpeg` exporter writes an MP4.

Clip: `media/tools/motion-canvas.mp4` (1280x720, 30 fps, 7.7 s).

## What the scene shows

- A `Code` node with a custom Lezer highlighter (`@lezer/javascript` plus a
  `HighlightStyle` in the reel palette).
- `code().selection(lines(2, 4), 0.5)`: focus on the `for ... await` loop.
- `code().code(AFTER, 1.0)`: the loop morphs into `Promise.all(ids.map(fetchUser))`.
- `code().selection(word(2, 9, 31), 0.5)`: focus on the `Promise.all` call.
- A "network timeline" panel next to the code: three request bars grow one after another
  (`sequence`), then all at once (`all`), with a playhead and a `ms` counter bound to
  signals. A "3x faster" badge pops in with `easeOutBack`.

## Install

```bash
npm install
```

(`npm init @motion-canvas@latest` creates the same kind of project interactively. This
folder sets it up by hand: `@motion-canvas/core`, `2d`, `ui`, `vite-plugin`, `ffmpeg` 3.17.2,
Vite 5, plus the Lezer/CodeMirror packages for syntax colors.)

## Render

Official path: run `npm start`, open http://localhost:9000, choose
"Video (FFmpeg)" as the exporter in the Video Settings tab and click RENDER. The MP4 lands
in `output/project.mp4`.

Motion Canvas has no official headless CLI. This folder includes `render.mjs`, which
automates the official path: it starts Vite, opens the editor in headless Chrome with
`puppeteer-core`, clicks RENDER and waits until the FFmpeg exporter has finished. The
exporter, frame rate (30) and size (1280x720) come from `src/project.meta`, so no UI
settings have to be changed.

```bash
npm run render
# or, with a different Chrome path:
node render.mjs "C:/Program Files/Google/Chrome/Application/chrome.exe"
```

The gallery clip was re-encoded after the render:

```bash
ffmpeg -i output/project.mp4 -c:v libx264 -crf 22 -preset slow -pix_fmt yuv420p -movflags +faststart -an motion-canvas.mp4
```

## Notes

- Do not set `"type": "module"` in package.json. The Vite plugin is CommonJS, and the
  default import in `vite.config.ts` then fails with "motionCanvas is not a function".
- JSX fragments (`<>...</>`) inside `.map()` did not render in this version; wrap each
  item in a `<Node>` instead.
- `findFirstRange()` turns a string into a regular expression, so a string with `(` `)` or
  `.` does not match literally. Escape it, or use `word(line, column, length)` as here.
