# Third-party notices

This repository is public, but it is not open source. The owner's code and content are covered by the `LICENSE` file at the root (all rights reserved). The third-party components below are shipped in this repository under their own licenses. Those licenses apply only to the listed files, not to the rest of the repository.

Every file in `site/vendor/` was checked against the published npm package of the stated version. All of them are unmodified copies, except `three-demo.js`, which is an esbuild bundle (see below). Versions come from the file headers or, where a file has no header, from a byte-for-byte match with the npm package.

## Libraries in `site/vendor/`

### three.js

- Version: r186 (npm package `three` 0.186.1), including `examples/jsm/environments/RoomEnvironment.js`
- License: MIT
- Copyright: Copyright 2010-2026 Three.js Authors
- Files: `site/vendor/three-demo.js` (bundle), `site/vendor/three.LICENSE.txt` (license text)
- Source: https://github.com/mrdoob/three.js/tree/r186
- Note: `three-demo.js` is an esbuild bundle of three.js and the owner's `source/libs/three-demo/three-entry.js`. The three.js parts are MIT. The `three-entry.js` parts are covered by this repository's `LICENSE`, not by MIT. The build script is in `source/libs/three-demo/`.

### PixiJS

- Version: 8.22.0
- License: MIT
- Copyright: Copyright (c) 2013-2023 Mathew Groves, Chad Engler
- Files: `site/vendor/pixi.min.js`, `site/vendor/pixi.LICENSE.txt`
- Source: https://github.com/pixijs/pixijs/tree/v8.22.0
- Bundled inside `pixi.min.js`, each under its own license:
  - earcut (ISC), Copyright (c) Volodymyr Agafonkin / Mapbox, https://github.com/mapbox/earcut
  - eventemitter3 (MIT), Copyright (c) Arnout Kazemier, https://github.com/primus/eventemitter3
  - ismobilejs (MIT), Copyright (c) Kai Mallea, https://github.com/kaimallea/isMobile
  - parse-svg-path (MIT), Copyright (c) Jake Rosoman, https://github.com/jkroso/parse-svg-path
  - @pixi/colord (MIT), Copyright (c) Vlad Shilov, https://github.com/pixijs/colord
  - tiny-lru 11.4.7 (BSD-3-Clause), https://github.com/avoidwork/tiny-lru. Its notice follows.

```
Copyright (c) 2026, Jason Mulligan
All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:

* Redistributions of source code must retain the above copyright notice, this
  list of conditions and the following disclaimer.

* Redistributions in binary form must reproduce the above copyright notice,
  this list of conditions and the following disclaimer in the documentation
  and/or other materials provided with the distribution.

* Neither the name of tiny-lru nor the names of its
  contributors may be used to endorse or promote products derived from
  this software without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
```

### p5.js

- Version: 2.3.4
- License: GNU Lesser General Public License, version 2.1 (LGPL-2.1)
- Copyright: the p5.js contributors and the Processing Foundation
- Files: `site/vendor/p5.min.js`, `site/vendor/p5.LICENSE.txt` (full LGPL-2.1 text), `site/vendor/p5.SOURCE.txt`
- Source: https://github.com/processing/p5.js/tree/v2.3.4
- `p5.min.js` is shipped unmodified and minified, as published in the `p5` npm package (`lib/p5.min.js`). The complete corresponding source code for this version is available at https://github.com/processing/p5.js/tree/v2.3.4. The page loads `p5.min.js` as a separate file with its own `<script>` tag, so it can be replaced with another build of p5.js.
- Bundled inside `p5.min.js`, each under its own license (from the dependencies of p5 2.3.4 and the bundle itself):
  - pako (MIT and Zlib), https://github.com/nodeca/pako
  - libtess (SGI Free Software License B 2.0), https://github.com/brendankenny/libtess.js
  - acorn and acorn-walk (MIT), https://github.com/acornjs/acorn
  - escodegen, estraverse and esutils (BSD-2-Clause), https://github.com/estools
  - source-map (BSD-3-Clause), https://github.com/mozilla/source-map
  - i18next and i18next-browser-languagedetector (MIT), https://github.com/i18next
  - colorjs.io (MIT), https://github.com/color-js/color.js
  - gifenc (MIT), https://github.com/mattdesl/gifenc
  - omggif (MIT), https://github.com/deanm/omggif
  - Typr.js (MIT), https://github.com/photopea/Typr.js
  - @davepagurek/bezier-path (MIT) and @japont/unicode-range (MIT)
  - webgl-noise GLSL code by Stefan Gustavson (MIT), https://github.com/stegu/webgl-noise
- p5.js 2.x no longer bundles opentype.js; it reads fonts with Typr.js instead.

### GSAP, SplitText and MorphSVGPlugin

- Version: 3.15.0
- License: GSAP Standard "No Charge" License, https://gsap.com/standard-license. This is a proprietary license from GreenSock (Webflow), not an open source license.
- Copyright: Copyright 2026, GreenSock. All rights reserved.
- Files: `site/vendor/gsap.min.js`, `site/vendor/SplitText.min.js`, `site/vendor/MorphSVGPlugin.min.js`, `site/vendor/gsap.LICENSE.txt`
- Source: https://gsap.com and the `gsap` npm package, https://www.npmjs.com/package/gsap/v/3.15.0
- These files are unmodified copies from the `gsap` npm package. They are not covered by this repository's `LICENSE`. Anyone who copies or forks these files must accept the GSAP Standard License terms on their own.

### Motion

- Version: 14.0.0 (npm package `motion`, `dist/motion.js`; the file has no version header, the version comes from a byte match with the npm package)
- License: MIT
- Copyright: Copyright (c) 2024 Motion B.V.
- Files: `site/vendor/motion.js`, `site/vendor/motion.LICENSE.md`
- Source: https://github.com/motiondivision/motion
- The bundle also contains code from `framer-motion`, `motion-dom` and `motion-utils` (MIT, same authors) and tslib (0BSD, Microsoft).

### anime.js

- Version: 4.5.0
- License: MIT
- Copyright: Copyright (c) 2025 Julian Garnier (the file header says 2026)
- Files: `site/vendor/anime.umd.min.js`, `site/vendor/anime.LICENSE.md`
- Source: https://github.com/juliangarnier/anime

### lottie-web

- Version: 5.13.0 (`lottie_svg.min.js`, the SVG-only player)
- License: MIT
- Copyright: Copyright (c) 2015 Bodymovin
- Files: `site/vendor/lottie_svg.min.js`, `site/vendor/lottie.LICENSE.md`
- Source: https://github.com/airbnb/lottie-web

### D3

- Version: 7.9.0
- License: ISC
- Copyright: Copyright 2010-2023 Mike Bostock
- Files: `site/vendor/d3.min.js`, `site/vendor/d3.LICENSE.txt`
- Source: https://github.com/d3/d3
- The bundle also contains delaunator (ISC, Mapbox), https://github.com/mapbox/delaunator, and robust-predicates (Unlicense, Vladimir Agafonkin), https://github.com/mourner/robust-predicates, through d3-delaunay.

### Matter.js

- Version: 0.20.0
- License: MIT
- Copyright: Copyright (c) Liam Brummitt and contributors
- Files: `site/vendor/matter.min.js`, `site/vendor/matter.LICENSE.txt`
- Source: https://github.com/liabru/matter-js

### Rough.js

- Version: 4.6.6 (npm package `roughjs`, `bundled/rough.js`; the file has no version header, the version comes from a byte match with the npm package)
- License: MIT
- Copyright: Copyright (c) 2019 Preet Shihn
- Files: `site/vendor/rough.js`, `site/vendor/rough.LICENSE.txt`
- Source: https://github.com/rough-stuff/rough

### Tone.js

- Version: 15.1.22 (npm package `tone`, `build/Tone.js`)
- License: MIT
- Copyright: Copyright (c) 2014-2024 Yotam Mann
- Files: `site/vendor/Tone.js`, `site/vendor/Tone.js.LICENSE.txt`, `site/vendor/tone.LICENSE.md`
- Source: https://github.com/Tonejs/Tone.js
- The bundle also contains the runtime dependencies of Tone.js: standardized-audio-context (MIT, Christoph Guttandin), https://github.com/chrisguttandin/standardized-audio-context, and tslib (0BSD, Microsoft).

## Data

### world-atlas land-110m and Natural Earth

- Used in: `site/catalog/set2-libs.js` (the dotted globe card). The land outline was sampled once into a short bitmask that is stored in that file.
- world-atlas: ISC License, Copyright Mike Bostock, https://github.com/topojson/world-atlas. The world-atlas version used was not recorded.
- Natural Earth: public domain, https://www.naturalearthdata.com. world-atlas is built from Natural Earth data.

## Fonts

Some clips and the reel render Microsoft system fonts, such as Segoe UI, Bahnschrift, Georgia, Consolas and Cascadia Mono. The font files are not included in this repository. The scripts and pages that use them take them from the machine that runs them (on Windows, `C:/Windows/Fonts`).

## Tools used to make the content

These tools are not shipped in this repository. Their licenses matter only to someone who runs the scripts in `source/`.

- Remotion 4 (`source/tools/remotion/`): not open source. Individuals and companies of up to 3 people can use it for free; companies of 4 or more people need a Remotion company license. See https://remotion.dev/license.
- Blender 5.2 (`source/blender/`, `source/reel/`): GNU GPL. The scripts only drive Blender through its Python API. The frames and clips that Blender renders are not covered by the GPL.
- Unreal Engine 5.8 (`source/unreal/`): Unreal Engine EULA, https://www.unrealengine.com/eula/unreal. The clips in `media/engine/unreal-*.mp4` are rendered output. This repository ships only the project config and Python scripts, not engine code or Epic content.
- FFmpeg: LGPL-2.1-or-later, or GPL for builds with GPL parts enabled. It is run as a separate command-line program, and no FFmpeg code is shipped. See https://ffmpeg.org/legal.html.
- HyperFrames 0.8.140 (`source/tools/hyperframes/`): Apache-2.0. Its page loads GSAP 3.14.2 from the jsDelivr CDN at render time, under the GSAP Standard License; that copy is not shipped here.
- Other tools (Motion Canvas, Manim Community, Taichi, PyVista, Matplotlib, Playwright, esbuild) are installed by their package managers under their own open source licenses.

## Trademarks

Claude and Claude Code are trademarks of Anthropic, PBC. Unreal Engine is a trademark of Epic Games, Inc. GSAP is a trademark of GreenSock / Webflow. Other names are trademarks of their owners. This project is not affiliated with or endorsed by them.
