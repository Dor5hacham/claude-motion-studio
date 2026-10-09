# How the site works (developer guide)

`index.html` is one static page with no build step and no server. It opens from `file://` in Chrome or Edge, so everything here follows three rules: classic `<script>` tags only (no ES modules), no `fetch` of local files, and no local images loaded into WebGL (the post-effects frame is embedded as a data URI in `catalog/fx-source.js`).

## Layout

| Path | What it holds |
|---|---|
| `site.css` | All styles for the page |
| `globals.d.ts` | Global declarations for the optional TypeScript check; not loaded by the page |
| `site.js` | Builds the catalog, the technique index, search and catalog filters, folded catalog sections ("Show all"), sidebar counts, chapter tabs and banners, section highlight, mobile menu |
| `learn/guide-core.js` | Shared helpers (`addLoop`, `addDemo`, `redraw`, `EASES`), easing/stagger/squash/anticipation demos, prompt builder |
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
  cat: 'sim',                       // section: reel, type, mg, ui, sim, gpu, audio, libs, engine, tools, edit, scratch
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

Options: `kind: 'dom'` gives a 640x360 `<div>` instead of a canvas. Under 1100 px `core.js` sets `--k` on it and the stage is scaled down to the card width, so pointer input must be turned into stage pixels: map positions with `(e.clientX - r.left) * 640 / r.width`, and scale drag deltas the same way, `(e.clientX - lastX) * 640 / r.width`, with `r` from the stage's `getBoundingClientRect()`. Raw deltas make the content move slower than the pointer on phones. `controls: [{ label, fn: L => ... }]` adds buttons; `stepped: true` marks simulations that advance one step per call. GPU demos share one WebGL2 context through `EX.G` (see `catalog/gpu.js`): browsers allow only a few contexts per page.

Each catalog section shows its first 6 cards and a "Show all" button (`FOLD` in `site.js`); a search or a filter shows every match. Put the strongest cards of a section first. A link to a card (`#ex-...`) opens its folded section, and clears a search or filter that hides it.

## Add a learning demo

Learning demos are canvases in `index.html` driven by the files in `learn/`. Draw them in design units with `addDemo(cv, size, draw)` from `guide-core.js`:

- `size(narrow, cw)` returns the design `[W, H]`. `narrow` is true while the canvas shows under 720 css px, so a phone can get its own layout with readable text. `cw` is the shown width, for demos that need their own switch point.
- `draw(g, t, W, H, narrow)` runs each visible frame with the scale set, so draw in `W x H` units. The bitmap follows the shown size times `devicePixelRatio`.

The two wrappers take the phone layout as a third `narrow` argument:

- `live(id, draw, narrow)` in `live-compare.js`: `narrow` is a `[W, H]` design size for phones, or `'split'` for a with-vs-without demo. A split demo is drawn at its full size and its right half (WITH) is stacked under its left half (WITHOUT) on phones. Use `halves()` to paint the split background and labels, or only `halfLabels()` when the demo paints its own background, never both.
- `mount(id, draw, narrow)` in `live-scenes.js`: `narrow` is the `[W, H]` design size for phones; without it the scene keeps the canvas size and is scaled down.

Captions under split demos say WITHOUT and WITH, not left and right, because the halves stack on phones.

## Add a rendered clip

1. Put the MP4 in `media/engine/`, `media/tools/`, `media/edit/` or `media/clips/` (1280x720, H.264).
2. Add an entry to `catalog/clips-meta.json` (id, cat, file, title, aka, tool, runs, notice, use, prompt). Add `"audio": true` when the clip has a soundtrack: its card then gets a Sound button (every clip starts muted).
3. Run `python scripts/build_catalog.py`. It fails if any clip has no entry, so nothing can be hidden.

## Check before committing

```
python scripts/build_catalog.py
cd scripts && npm i && node check_site.mjs
```

Optional type check (TypeScript as a linter; `globals.d.ts` declares the shared `window` globals and is never loaded by the page):

```
npx -y -p typescript tsc --noEmit --allowJs --checkJs --noImplicitAny false --strict false --noUnusedLocals --target es2022 --lib dom,es2022 site/globals.d.ts site/learn/*.js site/catalog/*.js site/site.js
```

It reports zero errors. DOM lookups carry JSDoc casts such as `/** @type {HTMLCanvasElement} */ (document.getElementById('x'))`, and arrays of mixed tuples carry JSDoc types such as `/** @type {[number, string][]} */`. Keep it at zero: treat any new report as a bug or a missing cast.

`check_site.mjs` fails on any unloaded script, unused vendor file, missing file, duplicate id, broken `#link`, prompt `{placeholder}` with no slider, slider unit written twice in a prompt, video that does not play, card without a section, or console error. It renders every card and learning demo at 1700 px, then checks the narrow layouts at 820 and 390 px (DOM stage scaling, stacked split demos, phone designs, the tweak panel, the mobile menu), search, filters, folding, card links, scroll restore, and the WebGPU CPU fallback with no adapter and with no `navigator.gpu`. Add `--shots <dir>` to save a screenshot of every card and learning demo, at every width.
