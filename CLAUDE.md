# Motion Studio: project instructions

A motion-design showcase and tutorial: a code-made reel, one offline page (`index.html`) that teaches motion and runs every technique, and a README that is the tutorial and cheat sheet.

## Layout
- `index.html`: the whole site. Learn sections + catalog + make + reference. Opens from `file://`.
- `site/`: page code. Developer guide: `site/README.md` (card API, sliders, adding clips).
- `media/`: clips (`clips/`, `engine/`, `tools/`, `edit/`), README images (`readme/`), reel (`reel/`; the 494 MB master in `reel/master/` is git-ignored and published as Release v1.0).
- `source/`: how every clip was made (`reel/`, `blender/`, `tools/`, `edit/`, `libs/`). Each folder has a README.
- `scripts/`: catalog build, site check, README generation.
- `LICENSE`, `THIRD_PARTY_NOTICES.md`: the proprietary license, and the licenses of the bundled third-party files.

## Rules
- Everything created must appear on the page with its prompt. New live demo: `EX.add` in `site/catalog/`. New clip: file in `media/<dir>/` plus an entry in `site/catalog/clips-meta.json`.
- The page must keep working from `file://`: classic `<script>` tags only, no ES modules, no `fetch` of local files, no local images in WebGL.
- Every catalog card should be unique; check `README.md`'s generated tables before adding a near-duplicate.
- Keep prose plain: sentence-case headings, no em dashes, no emojis in files.
- Every source file the project owns starts with the license header (`Copyright (c) 2026 Dor5hacham d5shacham@gmail.com. All rights reserved.` and `SPDX-License-Identifier: Proprietary`). Files in `site/vendor/` keep their own licenses; list any new one in `THIRD_PARTY_NOTICES.md`.

## Checks (run before every commit)
```
python scripts/build_catalog.py                 # fails if a clip is not on the page
cd scripts && npm i && cd ..
node scripts/check_site.mjs                     # links, coverage, vendor files, videos, console errors
uvx ruff check --select F,E9 --ignore F403,F405 source scripts
npx -y -p typescript tsc --noEmit --allowJs --checkJs --noImplicitAny false --strict false --noUnusedLocals --target es2022 --lib dom,es2022 site/globals.d.ts site/learn/*.js site/catalog/*.js site/site.js
```
After catalog or clip changes, regenerate the README: `node scripts/make_readme_media.mjs`, `node scripts/export_catalog.mjs`, `python scripts/build_readme.py`. Then delete `scripts/node_modules/`, `scripts/catalog.json` and `_work/`.

## Your machine
- Paths and hardware differ per machine. Set `BLENDER` to the Blender 5.2 executable and `UNREAL_EDITOR` to UnrealEditor. Set `CHROME_PATH` if Chrome is not in its default install folder.
- Render times, particle counts and GPU notes in the docs were measured on one reference machine (Ryzen 9 9950X, Radeon RX 9070 XT). Measure on your own machine before you rely on them, and lower counts or resolution if needed.
- Cycles uses the GPU backend of your vendor: OptiX or CUDA on NVIDIA, HIP on AMD, Metal on Apple. The Chrome flag `--use-angle=d3d11` is for Windows only.
- Temporary work goes in `_work/` (git-ignored) and is deleted when done.
