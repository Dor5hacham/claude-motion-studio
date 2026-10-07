# How the site works (developer guide)

`index.html` is one static page with no build step and no server. It opens from `file://` in Chrome or Edge, so everything here follows three rules: classic `<script>` tags only (no ES modules), no `fetch` of local files, and no local images loaded into WebGL (the post-effects frame is embedded as a data URI in `catalog/fx-source.js`).

## Layout

| Path | What it holds |
|---|---|
| `site.css` | All styles for the page |
| `site.js` | Builds the catalog, the technique index, search, sidebar counts, section highlight |
| `learn/guide-core.js` | Shared helpers (`addLoop`, `EASES`), easing/stagger/squash/anticipation demos, prompt builder |
| `learn/live-compare.js` | The with-vs-without comparisons, easing race, frames and fps |
| `learn/live-scenes.js` | Camera rig, transition player, post-effects stack, moods, "your words, live", logo reveal |
| `catalog/core.js` | The card runtime: `EX.add`, `EX.tweak`, playback bar, tweak sliders, shared WebGL context `EX.G` |
| `catalog/*.js` | The live demos, grouped by file |
| `catalog/clips-meta.json` | Descriptions of every rendered clip in `media/` |
| `catalog/clips.js` | Generated from `clips-meta.json` by `scripts/build_catalog.py` |
| `catalog/engine.js` | Turns every entry of `clips.js` into a video card |
| `catalog/libs.js` + `vendor/` | Demos built on third-party libraries (each library keeps its license file in `vendor/`) |

## Add a live demo

Add an `EX.add({...})` call to a file in `catalog/` (or a new file, plus a `<script>` tag in `index.html`):

```js
EX.add({
  cat: 'sim',                       // section: reel, type, mg, ui, sim, gpu, audio, libs, engine, tools, edit
  id: 'mydemo',                     // card id becomes ex-mydemo (linkable as index.html#ex-mydemo)
  title: 'My demo', aka: 'other names', tool: 'Canvas 2D', runs: 'CPU',   // runs: CPU, GPU, WEB, ENGINE
  notice: 'What you see and how it works, in 2 or 3 plain sentences.',
  use: 'what it is good for',
  params: [{ key: 'speed', label: 'Speed', min: 0, max: 5, step: 0.1, value: 1 }],   // optional sliders
  prompt: 'A copyable prompt; {speed} is replaced by the current slider value.',
  setup(stage, L) {                 // runs once, when the card first scrolls into view (and on Replay)
    const g = stage.getContext('2d');
    return (t, dt) => { /* draw frame at time t; read sliders from L.p.speed */ };
  },
});
```

Options: `kind: 'dom'` gives a 640x360 `<div>` instead of a canvas; `controls: [{ label, fn: L => ... }]` adds buttons; `stepped: true` marks simulations that advance one step per call. GPU demos share one WebGL2 context through `EX.G` (see `catalog/gpu.js`): browsers allow only a few contexts per page.

## Add a rendered clip

1. Put the MP4 in `media/engine/`, `media/tools/`, `media/edit/` or `media/clips/` (1280x720, H.264).
2. Add an entry to `catalog/clips-meta.json` (id, cat, file, title, aka, tool, runs, notice, use, prompt).
3. Run `python scripts/build_catalog.py`. It fails if any clip has no entry, so nothing can be hidden.

## Check before committing

```
python scripts/build_catalog.py
cd scripts && npm i && node check_site.mjs
```

`check_site.mjs` fails on any unloaded script, unused vendor file, missing file, duplicate id, broken `#link`, video that does not play, card without a section, or console error. Add `--shots <dir>` to save a screenshot of every card.
