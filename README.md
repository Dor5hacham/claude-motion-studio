# Motion Studio: what Claude can animate, what it is called, and how to ask for it

![The reel, one second per scene](media/readme/hero-reel.gif)

This repository is a complete, hands-on resource for motion design with Claude. It has three parts:

1. **A 60-second motion reel** made entirely with code: WebGL shaders, a Blender physics shot, a synthesized soundtrack, assembled with FFmpeg.
2. **Motion Studio (`index.html`)**: one offline page that teaches the vocabulary of motion with live side-by-side demos, and runs every technique in a searchable catalog. Most cards have sliders, and their prompt text updates as you move them.
3. **This README**: the tutorial and the cheat sheet in one place.

No stock footage, no templates and no AI video model were used. Every frame comes from code that Claude wrote, and all of that code is in this repository.

## Quick start

| I want to | Do this |
|---|---|
| See everything live | Open `index.html` in Chrome or Edge (works offline, no install) |
| Watch the reel | `media/reel/claude-motion-reel.mp4` (full-quality master: see Releases) |
| Learn the words | Read the [tutorial](#tutorial) below, then the Learn part of `index.html` |
| Copy a prompt | Find the technique in the [catalog](#catalog) and copy its prompt |
| Write my own prompt | Use the [template](#cheat-sheet) or the Prompt builder in `index.html` |
| Rebuild anything | See [Reproduce](#reproduce) |

## Tutorial

### 1. How a video gets made

Claude does not paint pixels and does not generate video with an AI model. It writes a program or a scene file, a renderer runs that program once per frame, and FFmpeg joins the frames and the sound into a video file.

```
You describe it  ->  Claude writes code  ->  a renderer draws every frame  ->  FFmpeg makes the MP4
(length, look,       (shaders, Canvas,      (Chrome on the GPU,             (H.264, WebM,
 timing)              React, Python,         Blender, Remotion)               GIF, ProRes)
                      Blender scripts)
```

| Word | Meaning |
|---|---|
| Frame | One still picture. 60 seconds at 60 fps is 3,600 frames. |
| fps | Frames per second: 24 film, 30 web, 60 smooth UI and games. |
| Render | The computer drawing the frames. |
| Real-time vs offline | Real-time draws fast enough to watch live; offline takes as long as each frame needs and saves a file. |
| GPU vs CPU | The GPU draws millions of pixels or particles at once; the CPU does step-by-step work like physics and sound. |

### 2. Motion vocabulary

These are the words motion designers use. In `index.html` each one runs live, and most are shown twice: without the idea, and with it.

**Easing** is how speed changes during a move. All nine easings below start and end together:

![Easing race](media/readme/learn-easing-race.gif)

| Word | What it does | Say in a prompt |
|---|---|---|
| Linear | Constant speed, robotic | "linear scroll for the ticker" |
| Ease-in | Slow start, fast end (exits) | "ease-in exit" |
| Ease-out | Fast start, slow end (entrances) | "ease-out entrance, 400 ms" |
| Ease-in-out | Slow at both ends, calm | "smooth ease-in-out move" |
| Expo-out | Very fast start, long glide, snappy tech feel | "ease-out-expo" |
| Back / overshoot | Goes past the target and settles | "ease-out-back pop" |
| Elastic, bounce | Wobbles or bounces at the end | "small elastic settle" |
| Spring | Physics easing: stiffness and damping instead of duration | "spring, stiffness 300, damping 25" |

**The other principles**, each with a with-vs-without demo on the page:

| Word | Meaning | Say in a prompt |
|---|---|---|
| Timing | How long a move takes | "snappy timing, 250 ms moves" |
| Stagger | The same move on many items, offset in time | "stagger 40 ms from the center out" |
| Hold | A pause so people can read | "hold the title 1.5 s" |
| Squash and stretch | Flatten on impact, stretch at speed | "squash 40% on contact" |
| Anticipation and overshoot | Pull back before the move, pass the target after | "pull back, then shoot right and overshoot" |
| Follow-through and overlap | Loose parts keep moving after the body stops | "ribbons follow through when it stops" |
| Secondary motion | Small supporting moves: dust, wobble | "dust puff and a wobble on landing" |
| Arcs | Natural paths are curved | "move along an arc, not a straight line" |
| Beat sync | Changes land on the music beat (120 BPM = 0.5 s per beat) | "every cut lands on the beat at 120 BPM" |
| Seamless loop | The last frame flows into the first | "seamless 8 s loop" |
| Parallax | Near layers move faster than far ones | "three-layer parallax as the camera slides" |

| Follow-through | Secondary motion | Arcs |
|---|---|---|
| ![Follow-through](media/readme/learn-follow-through.gif) | ![Secondary motion](media/readme/learn-secondary-motion.gif) | ![Arcs](media/readme/learn-arcs.gif) |

**Camera moves** (all 11 run in the page on the same scene): static, push-in, pull-out, orbit, pan, tilt, crane, whip pan, rack focus, camera shake, dolly zoom.
**Transitions** (11 in the page): hard cut, crossfade, dip to black, wipe, iris, push, zoom through, whip pan, glitch, blinds, match cut.
**Post effects** (toggle them on a reel frame in the page): bloom, film grain, vignette, chromatic aberration, color grade, depth of field, letterbox, scanlines.

| Camera orbit | Iris transition |
|---|---|
| ![Camera](media/readme/learn-camera-orbit.gif) | ![Transition](media/readme/learn-transition-iris.gif) |

### 3. How to prompt for motion

A good motion prompt reads like a director's brief. These ten parts cover almost everything; the first five do most of the work.

1. **Deliverable**: length, resolution, fps, format, where to save.
2. **Purpose**: who watches and why.
3. **Look**: mood, palette (hex codes), fonts, references.
4. **Technique**: names from the catalog.
5. **Timeline**: what happens at which second.
6. **Motion feel**: easing, stagger, timing.
7. **Camera**: static, orbit, push-in, depth of field.
8. **Text on screen**: exact words and when.
9. **Sound**: none, synthesized, or your track with beat-synced cuts.
10. **Checks**: "show me test frames before the full render".

The "Your words, live" part of `index.html` lets you click prompt words and see the same title change:

![Your words, live](media/readme/learn-your-words.gif)

**Mood to motion:**

| Mood | Ask for |
|---|---|
| Premium, calm | Long ease-in-out (1 to 1.5 s), blur-in, slow push-in, few colors, long holds |
| Energetic | Ease-out-expo, 200 to 300 ms moves, hard cuts on the beat, camera shake, glitch hits |
| Playful | Overshoot, elastic, squash and stretch, flat bright shapes |
| Technical | Mask reveals, monospace type, grids, typewriter text, cyan accents |
| Dreamy | Slow fades, domain-warped noise, glow, grain, pastel palette |
| Cinematic | Push-in or crane, depth of field, motion blur, letterbox, 24 fps |

**A full example**, played live in the page exactly as written:

![Logo reveal](media/readme/learn-logo-reveal.gif)

```
Make an 8-second 1080p60 logo reveal and save it to my desktop.
Look: dark background #0b0b10, coral #ff5a36 accent, Bahnschrift bold type.
Technique: shape layers and kinetic typography in Canvas 2D.
Timeline:
0.0-1.0 s  a coral dot pops in with ease-out-back
1.0-2.0 s  the dot stretches into a line, the line splits in two
2.0-4.0 s  "NOVA" rises through a mask, 45 ms stagger, ease-out-expo
4.0-6.5 s  hold, slow letter tracking, subtitle types on: "Launching March 3"
6.5-8.0 s  letters exit upward with stagger, fade to black
Post: light film grain, soft vignette.
Show me 6 test frames before the full render.
```

## Catalog

Every technique Claude made for this project. Click a name to open it live in `index.html` (open the file locally; links jump to the card). Highlights:

| Fluid simulation | Reaction-diffusion | Slime mold |
|---|---|---|
| ![](media/readme/live-fluid.gif) | ![](media/readme/live-reaction-diffusion.gif) | ![](media/readme/live-slime-mold.gif) |
| **Black hole** | **Ocean** | **Isometric city** |
| ![](media/readme/live-black-hole.gif) | ![](media/readme/live-ocean.gif) | ![](media/readme/live-isometric-city.gif) |
| **Particle text** | **Liquid type** | **Split-flap board** |
| ![](media/readme/live-particle-text.gif) | ![](media/readme/live-liquid-type.gif) | ![](media/readme/live-split-flap.gif) |
| **Soft-body blobs** | **Oscilloscope music** | **Like-button burst** |
| ![](media/readme/live-soft-blobs.gif) | ![](media/readme/live-oscilloscope.gif) | ![](media/readme/live-like-burst.gif) |
| **Blender liquid** | **Blender cloth** | **Unreal Niagara** |
| ![](media/readme/clip-liquid.gif) | ![](media/readme/clip-cloth.gif) | ![](media/readme/clip-unreal-niagara.gif) |
| **Blender shatter** | **Cycles photoreal** | **WebGPU, 1M particles** |
| ![](media/readme/clip-shatter.gif) | ![](media/readme/clip-cycles.gif) | ![](media/readme/clip-webgpu.gif) |
| **Three.js** | **Remotion** | **HyperFrames** |
| ![](media/readme/clip-threejs.gif) | ![](media/readme/clip-remotion.gif) | ![](media/readme/clip-hyperframes.gif) |
| **Manim** | **Speed ramp** | **Datamosh** |
| ![](media/readme/clip-manim.gif) | ![](media/readme/clip-speed-ramp.gif) | ![](media/readme/clip-datamosh.gif) |

The full list below is generated from the same registry the page uses (`scripts/build_readme.py`), so it always matches the site.

<!-- CATALOG:START -->
**112 techniques**: 80 run live in the page (45 with sliders), 32 are rendered clips.


### The reel, scene by scene (9)

![The reel, scene by scene](media/readme/poster-reel.jpg)

| Technique | Made with | Runs on | Prompt to copy |
|---|---|---|---|
| [Kinetic typography (reel scene 1)](index.html#ex-clip-reel-kinetic) (clip) | Canvas 2D, rendered frame by frame in headless Chrome | CPU | Kinetic type intro: a coral dot pops in with overshoot, stretches into a line, splits into two lines, "MOTION REEL" rises through the gap with a 45 ms stagger, typewriter subtitle, slow letter tracking, 6 s. |
| [Shape-layer choreography (reel scene 5)](index.html#ex-clip-reel-shapes) (clip) | Canvas 2D | CPU | Bauhaus-style shape-layer animation on cream paper: grid of shapes pops in from the center, morphs square to circle in a wave, gathers into a rotating ring, sunburst trim paths, bouncing ball with squash and stretch, 8 s. |
| [Iris wipe with edge glow](index.html#ex-clip-reel-transitions) (clip) | GLSL compositor shader | GPU | Iris wipe from the center with a 2 px coral edge glow, 0.8 s, between scene 1 and scene 2. |
| [Glitch cut](index.html#ex-clip-reel-glitch) (clip) | GLSL compositor shader | GPU | Glitch cut between the two shots: 0.35 s of horizontal slice offsets, RGB split and block shifts, peaking exactly on the cut. |
| [400,000 GPU particles (reel scene 2)](index.html#ex-clip-reel-particles) (clip) | WebGL2 vertex shader | GPU | GPU particle morph: 400k particles swirl in a galaxy, fly into my logo, hold, morph to a sphere and a torus knot, then explode. Additive blending, coral to amber, bloom. |
| [Ray-marched blobs (reel scene 3)](index.html#ex-clip-reel-raymarch) (clip) | GLSL fragment shader | GPU | Ray-marched metaballs that split from one sphere into seven and merge back, iridescent thin-film material, soft shadows, reflections, slow orbit camera. |
| [14,400 instanced cubes (reel scene 6)](index.html#ex-clip-reel-instancing) (clip) | WebGL2 instancing | GPU | Field of 14,400 instanced cubes, heights driven by interfering ripples, colors by height, camera swoops from top-down to a low angle, 8 s. |
| [Domain-warped noise with word slams (reel scene 7)](index.html#ex-clip-reel-noise) (clip) | GLSL fragment shader + Canvas 2D text | GPU | Domain-warped fBm marble background, cosine palette violet and orange, words "ANYTHING / THAT / MOVES." slam in on the beat at 120 BPM with an RGB glitch hit each. |
| [Rigid-body wall smash (reel scene 4)](index.html#ex-clip-reel-physics) (clip) | Blender 5.2: Bullet physics, Eevee | ENGINE | Blender rigid-body sim: 500 glossy cubes in a wall, a chrome wrecking ball hits it at 1 s, half-speed slow motion, Eevee with motion blur and depth of field. |

### Text in motion (10)

![Text in motion](media/readme/poster-type.jpg)

| Technique | Made with | Runs on | Prompt to copy |
|---|---|---|---|
| [Scramble decode](index.html#ex-scramble) | Canvas 2D or CSS + JS | CPU | Scramble-decode the headline "SHIP IT": random glyphs for 0.5 s, letters lock in left to right 0.06 s apart, cyan monospace on near-black. |
| [Split-flap board](index.html#ex-splitflap) | Canvas 2D | CPU | Split-flap departure board, 3 rows x 14 tiles, each flip takes 0.055 s, flips through the alphabet to "NOW BOARDING", columns staggered 40 ms, with a soft click sound per flip. |
| [Variable font wave](index.html#ex-varfont) | Canvas 2D or CSS font-variation-settings | CPU | Animate a variable font: the weight of each letter in "FLUID" waves from 300 to 700, the wave travels left to right every 1.2 s, slight vertical bob. |
| [Word-by-word captions](index.html#ex-captions) | Canvas 2D, Remotion | CPU | Add word-by-word captions to my video using the transcript timings: 3 to 4 words per page, active word pops (ease-out-back) with a coral highlight box, bold 64 px sans. |
| [Text on a path](index.html#ex-textpath) | Canvas 2D or SVG textPath | CPU | Rotating circular text badge: "MOTION · DESIGN · WITH · CODE ·" around a ring, slow clockwise spin, inner ring of small mono text spinning the other way, center logo pulses every 0.5 s. |
| [Particle text](index.html#ex-particletext) | Canvas 2D (pixel sampling) | CPU | My wordmark disintegrates into 4,000 particles that drift 40 px on noise for 1.5 s, then reassemble left to right with ease-out-expo, particles coral to amber across the word. |
| [Liquid-filled type](index.html#ex-liquidtype) | Canvas 2D (compositing: destination-in mask) | CPU | The word "FRESH" fills with sloshing cyan liquid from bottom to top over 2 s (waves up to 9 px), bubbles rise inside the letters, then it drains with a wobble. |
| [Typographic tunnel](index.html#ex-typetunnel) | Canvas 2D (scaled layers) | CPU | Endless typographic tunnel: the phrase "ALWAYS IN MOTION" repeated around rings that zoom toward the camera forever, alternate rings counter-rotate, coral and cream, 120 BPM pulse. |
| [Jelly letters](index.html#ex-jellytype) | Canvas 2D (spring physics per letter) | CPU | Interactive jelly headline: each letter sits on a spring (stiffness 0.08, damping 0.85), the cursor pushes letters away within 120 px, letters squash along their velocity, bright playful colors. |
| [Masked letter reveal](index.html#ex-maskreveal) | CSS overflow mask + Web Animations API | WEB | Headline "MOTION GUIDE" rises letter by letter through a mask, 45 ms stagger, 700 ms per letter with ease-out-expo, then slow letter tracking. |

### 2D motion graphics (5)

![2D motion graphics](media/readme/poster-mg.jpg)

| Technique | Made with | Runs on | Prompt to copy |
|---|---|---|---|
| [Parallax layers](index.html#ex-parallax) | Canvas 2D (or CSS transforms on image layers) | CPU | Parallax landscape with 5 layers (sky, far mountains, mid hills, trees, foreground grass), camera slides right, depth strength 1 (0 = flat, everything moves together), haze increases with distance, sunset palette. |
| [Motion path](index.html#ex-motionpath) | Canvas 2D or SVG (offset-path in CSS) | CPU | A paper plane flies along a curvy SVG path from left to right in 3 s, auto-oriented to the path, ease-in-out speed, dashed trail draws behind it, lands on a pin that pops with overshoot. |
| [Isometric city build](index.html#ex-isocity) | Canvas 2D (isometric projection) | CPU | Isometric city builds itself: 8x8 lots, buildings grow from the back to the front with ease-out-back, 40 ms stagger, windows light up randomly at dusk, a car drives along the main road, then everything sinks. |
| [Trim paths](index.html#ex-trimpaths) | SVG stroke-dasharray / stroke-dashoffset | WEB | Draw the logo outline on with trim paths over 1.1 s, ease-in-out, then erase it from the start so the line travels off, coral and cyan strokes. |
| [Shape morph](index.html#ex-shapemorph) | Canvas 2D (rounded rectangle radius + rotation) | CPU | Morph the square button into a circle while it rotates 90 degrees and shifts from coral to violet, 1.2 s, ease-in-out, then morph back. |

### App and web UI motion (11)

![App and web UI motion](media/readme/poster-ui.jpg)

| Technique | Made with | Runs on | Prompt to copy |
|---|---|---|---|
| [Like-button burst](index.html#ex-like) | SVG + JavaScript (also Lottie) | WEB | Like-button micro-interaction: heart scales 1 > 0.7 > 1.25 > 1 with ease-out-back, a coral ring expands and fades, 12 dots burst out, counter digit rolls up. Total 600 ms. |
| [Loaders](index.html#ex-loaders) | Pure CSS @keyframes | WEB | Make a pure-CSS loader: three dots that bounce in a wave (120 ms stagger), ease-in-out, coral, 1 s loop, and respect prefers-reduced-motion. |
| [Gooey merge](index.html#ex-gooey) | SVG filter (blur + alpha threshold) | WEB | Gooey menu button: the main circle splits into 4 smaller circles that slide out with ease-out-back, connected by a liquid SVG goo filter while they separate. |
| [Menu morph and staggered reveal](index.html#ex-menu) | CSS transforms driven by JavaScript (or Framer Motion) | WEB | Mobile menu: hamburger morphs to X in 300 ms, drawer slides in from the right with ease-out-expo, menu items stagger in 40 ms apart with a 16 px slide; reverse on close. |
| [Skeleton loading to content](index.html#ex-skeleton) | CSS gradients + JavaScript | WEB | Skeleton loading state for the feed: grey blocks with a left-to-right shimmer every 1.2 s, then real cards fade and slide up 12 px, 60 ms stagger. |
| [Dashboard count-up](index.html#ex-dashboard) | Canvas 2D (or SVG + CSS) | CPU | Animate the stats card: numbers count up over 1.2 s with ease-out-expo, the progress ring fills to 72%, five bars grow with a 70 ms stagger, sparkline draws on. |
| [3D card flip](index.html#ex-cardflip) | CSS 3D transforms (perspective, rotateY, backface-visibility) | WEB | Three feature cards flip in 3D (rotateY 180, 700 ms, ease-in-out, 120 ms stagger) to reveal details on the back, with 1,000 px perspective and a soft shadow that shifts during the turn. |
| [Magnetic button and cursor follower](index.html#ex-magnetic) | CSS + JavaScript (mix-blend-mode, transforms) | WEB | Add a magnetic hover to the main CTA: within 100 px the button moves 0.3 of the cursor distance toward it with a spring; a custom cursor circle follows with lag and grows to 80 px with mix-blend-mode: difference over buttons. |
| [Toast stack](index.html#ex-toasts) | CSS transforms + spring easing (Framer Motion style) | WEB | Toast notifications: new toast springs up from the bottom (stiffness 400, damping 30), older toasts scale to 0.94 and shift up 10 px each like a stack, max 3 visible, oldest swipes out right after 4 s. |
| [Shared-element expand](index.html#ex-sharedexpand) | JavaScript FLIP technique (or Framer Motion layoutId, View Transitions API) | WEB | When a project card is clicked, expand it into the detail page with a shared-element transition (FLIP / View Transitions API), 450 ms ease-out-expo, image stays continuous, details fade in after 150 ms. |
| [Day/night toggle](index.html#ex-daynight) | SVG + JavaScript | WEB | Dark-mode toggle: knob slides with ease-in-out (400 ms), the sun morphs into a crescent moon by sliding a mask circle, clouds exit left, stars fade in with stagger, page background crossfades. |

### Simulation and generative art (19)

![Simulation and generative art](media/readme/poster-sim.jpg)

| Technique | Made with | Runs on | Prompt to copy |
|---|---|---|---|
| [Flow field](index.html#ex-flowfield) | Canvas 2D (GPU version: WebGL) | CPU | Flow-field animation: 5,000 particles follow slowly changing Perlin noise (noise scale 0.0035), each moves 1.6 px per frame, trails fade by 0.06 per frame, warm-to-cool palette by direction, loopable. |
| [Flocking](index.html#ex-boids) | Canvas 2D (JavaScript) | CPU | Boids flocking simulation, 300 agents: separation 0.05, alignment 0.05, cohesion 0.0009, small triangles colored by heading, the flock avoids the mouse cursor. |
| [Cloth (Verlet)](index.html#ex-cloth2d) | Canvas 2D (JavaScript physics) | CPU | Cloth banner pinned along the top, Verlet physics, gusty wind at 1x strength, gravity 0.35, shading from the fold angle, my logo printed on it. In Blender for a realistic version. |
| [Spring chain](index.html#ex-springtail) | Canvas 2D (spring physics) | CPU | A glowing ribbon follows the cursor with spring physics: 30 segments, each springs toward the previous one (stiffness 0.25, damping 0.82), gravity 0.35, tapering width, coral to violet. |
| [Growing tree](index.html#ex-tree) | Canvas 2D (recursion) | CPU | Procedural tree grows from a seed in 3 s (recursive branching, 9 levels, branch angle 0.42 rad, each branch 0.76 as long as its parent), sways in wind, coral blossoms pop at the tips with ease-out-back. |
| [Circle packing](index.html#ex-packing) | Canvas 2D (JavaScript) | CPU | Circle packing animation that fills the word "GROW": circles spawn inside the letters and grow until they touch, palette coral/amber/cyan, 6 s, then dissolve. |
| [Ridgelines](index.html#ex-ridges) | Canvas 2D (noise) | CPU | Joy-plot ridgeline animation: 45 stacked lines of flowing noise, peaks up to 120 px tall in the center, flowing at speed 0.6, black fill hides lines behind, cream strokes, loopable. |
| [Harmonograph](index.html#ex-harmono) | Canvas 2D (math curves) | CPU | Harmonograph line drawing: four damped sine pendulums (frequencies 2, 3, 3.01, 2), line draws on over 5 s with a gradient stroke, then fades and redraws with new ratios. |
| [Warp-speed starfield](index.html#ex-warp) | Canvas 2D (3D projection) | CPU | Starfield that ramps from cruise to warp speed 80 over 2 s: star streak length scales with speed, white flash at the jump, then cuts to my title. |
| [Bar chart race](index.html#ex-barrace) | Canvas 2D (D3 or Remotion also work) | CPU | Bar chart race from my CSV (years 2015 to 2025, top 8 items): bars re-sort with smooth sliding, values count up, big year counter bottom right, 20 s total. |
| [Balls in a spinning hexagon](index.html#ex-hexballs) | Canvas 2D (JavaScript physics) | CPU | 2D physics: 14 balls bounce inside a hexagon spinning at 0.8 rad/s, gravity 0.18, restitution 0.85, ball-to-ball collisions, motion trails, colors from my palette. |
| [Slime mold network](index.html#ex-physarum) | JavaScript agents + trail map (GPU version: compute shader) | CPU | Physarum slime-mold simulation with 200k agents on the GPU: sensor angle 0.52 rad, sensor distance 9 px, turn 0.4 rad, trail fades 0.012 per step, glowing amber-to-violet veins that slowly connect points of my logo. |
| [Soft-body blobs (2D)](index.html#ex-softblob) | JavaScript (springs + pressure) | CPU | Three soft-body blobs (spring ring + internal pressure 2.4) hop in turn with jump strength 9, squash on landing and wobble, cute eyes that follow the motion, pastel colors on a dark floor. |
| [Falling sand](index.html#ex-sand) | JavaScript grid (cellular automaton) | CPU | Falling-sand cellular automaton: three moving spouts pour coral, amber and cyan sand that piles into striped dunes, then the floor opens and it all drains, pixel-art look, 12 s loop. |
| [Lightning](index.html#ex-lightning) | Canvas 2D (midpoint displacement + glow) | CPU | Storm scene: procedural lightning bolts (midpoint displacement with branches) strike every 0.4 s or a bit more, sky flashes, bolt glows cyan-white then fades over 300 ms, light rain streaks. |
| [Fireworks](index.html#ex-fireworks) | Canvas 2D particles (gravity, drag, fade) | CPU | Fireworks show over a city skyline: rockets launch with sparkling trails, burst into 90-particle peonies with gravity 0.045 and air drag, some crackle, colors from my palette, long exposure trails. |
| [Pendulum wave](index.html#ex-pendulumwave) | Canvas 2D (math only) | CPU | Pendulum wave of 20 balls: each swings slightly faster than the one before so they form traveling waves, splits and chaos, then realign after 24 s; seen from above, soft shadows. |
| [Field lines](index.html#ex-fieldlines) | Canvas 2D (numerical integration) | CPU | Animated field-line visualization: two positive and two negative charges orbit slowly, 20 field lines per positive charge traced with RK2, flowing dashes show direction, cyan to coral by strength. |
| [Orrery](index.html#ex-orrery) | Canvas 2D (3D orbits projected to 2D) | CPU | Elegant orrery: six planets on tilted orbits seen at a 25-degree angle, inner planets faster (Kepler), faint orbit rings, one planet with a moon and a ring, sun glow, labels that fade in. |

### GPU shaders (22)

![GPU shaders](media/readme/poster-gpu.jpg)

| Technique | Made with | Runs on | Prompt to copy |
|---|---|---|---|
| [Reaction-diffusion](index.html#ex-reaction) | WebGL2 fragment shaders, ping-pong float textures | GPU | Reaction-diffusion (Gray-Scott, feed 0.0545, kill 0.062) that grows patterns out of my logo shape, 15 s, lit by its own gradient, palette violet to coral. |
| [Fluid simulation](index.html#ex-fluid) | WebGL2 fragment shaders (advection, pressure solve, vorticity) | GPU | Interactive 2D fluid simulation (stable fluids, vorticity 28) as a website hero: cursor pushes colored ink with force 320, brand colors coral/amber/violet, dye persistence 0.991 per frame. |
| [Fractal zoom](index.html#ex-mandelbrot) | GLSL fragment shader | GPU | Mandelbrot deep zoom into the seahorse valley, smooth iteration coloring with a cosine palette, 20 s zoom in and back out, seamless loop. |
| [Kaleidoscope](index.html#ex-kaleido) | GLSL fragment shader | GPU | Kaleidoscope with 8 mirrored segments over flowing fractal noise, slow rotation, rings pulse at 120 BPM, palette violet/coral/cyan. |
| [Infinite tunnel](index.html#ex-tunnel) | GLSL fragment shader | GPU | Endless neon tunnel: polar-coordinate tunnel with glowing grid lines, camera sways gently, speed ramps on each beat, fade to my logo at the end. |
| [Voronoi cells](index.html#ex-voronoi) | GLSL fragment shader | GPU | Animated Voronoi cells like stained glass: points drift slowly, dark borders, each cell a color from my palette, gentle glow at cell centers. |
| [Synthwave landscape](index.html#ex-synthwave) | GLSL fragment shader | GPU | Synthwave scene: neon magenta grid scrolling toward the camera, striped gradient sun, noise mountains on the horizon, scanlines, 10 s seamless loop. |
| [Water caustics](index.html#ex-caustics) | GLSL fragment shader (layered cellular noise) | GPU | Underwater pool floor with animated caustic light webs, tiles warped by refraction, aqua palette, soft god rays, seamless 8 s loop. |
| [Metaballs](index.html#ex-metaballs) | GLSL fragment shader | GPU | Lava-lamp metaballs: 8 blobs at 1x size drift and merge with smooth edges, color blends between blobs, soft rim light, dark background, 12 s loop. |
| [Mesh gradient](index.html#ex-meshgrad) | GLSL fragment shader | GPU | Soft animated mesh gradient for a website hero in my brand colors, very slow movement (20 s cycle), noise warp 0.14, film grain 0.045, low contrast so text stays readable. |
| [SDF shape morph](index.html#ex-sdfmorph) | GLSL fragment shader | GPU | SDF morph between circle, rounded square, star and cross, 1.6 s per shape with ease-in-out, coral fill with soft glow, then show the distance-field rings for one second. |
| [Infinite repetition](index.html#ex-repeat) | GLSL fragment shader (ray marching) | GPU | Ray-marched fly-through of an endless lattice of rounded cubes (domain repetition), cubes pulse in size with a wave, colored per cell, fog in the distance, camera rolls slowly. |
| [Domain-warped noise](index.html#ex-domainwarp) | GLSL fragment shader | GPU | Seamless 10 s loop: domain-warped fBm noise (warp strength 3.5, scale 3.2), slow drift, cosine palette in deep violet and orange, lit by its own gradient. |
| [Post-processing lab](index.html#ex-fxlab) | GLSL fragment shader on an image or video | GPU | Apply a post-processing stack to my video: ordered (Bayer) dithering in two brand colors, plus a CRT pass with scanlines, slight barrel distortion and RGB mask. Keep the original timing. |
| [Ocean waves](index.html#ex-ocean) | GLSL fragment shader (height-field ray marching) | GPU | Ray-marched open ocean at golden hour: layered directional waves (height 0.55), Fresnel sky reflection, sun glitter path, foam on crests, slow forward camera drift, 10 s. |
| [Black hole](index.html#ex-blackhole) | GLSL fragment shader (artistic lensing approximation) | GPU | Black hole with gravitational lensing of a starfield, a glowing accretion disk brighter on the approaching side, the far side of the disk arched over the top, slow camera drift, film grain. |
| [Aurora](index.html#ex-aurora) | GLSL fragment shader (layered noise curtains) | GPU | Aurora borealis over a mountain lake at night: layered green-to-violet light curtains drift and ripple, twinkling stars, mirror reflection with gentle ripples, 15 s seamless loop. |
| [Fire](index.html#ex-fire) | GLSL fragment shader (scrolling noise + color ramp) | GPU | Procedural campfire shader: scrolling fBm flames inside a teardrop mask (flame size 1.6), black to red to orange to white color ramp, rising embers, 8 s seamless loop. |
| [Liquid chrome blob](index.html#ex-chrome) | GLSL fragment shader (ray marching + environment reflection) | GPU | Liquid chrome blob rotating slowly, surface ripple 0.09 like mercury, reflects a studio with two softbox strips and coral/violet floor glow, soft shadow. |
| [LED matrix board](index.html#ex-ledboard) | Canvas 2D content + GLSL LED shader | GPU | Dot-matrix LED sign: my message scrolls right to left in amber LEDs at 96x54 resolution, unlit LEDs faintly visible, bloom around lit ones, an equalizer row below reacts to the music. |
| [Hologram](index.html#ex-hologram) | GLSL fragment shader (ray marching + Fresnel rim) | GPU | Holographic projection of a rotating torus knot: cyan Fresnel rim light only, horizontal scanlines scrolling up, random flicker and glitch offsets, projector cone and grid base below. |
| [Live GPU particles](index.html#ex-liveparticles) | WebGL2 vertex shader (own context) | GPU | GPU particle background for my website: 120k particles in a WebGL2 vertex shader morph between a galaxy, a sphere and a ring every 3 s, point size 1.6 px, additive blending, coral to violet. |

### Sound and motion (2)

![Sound and motion](media/readme/poster-audio.jpg)

| Technique | Made with | Runs on | Prompt to copy |
|---|---|---|---|
| [Audio-reactive visuals](index.html#ex-reactive) | Web Audio API (analyser) + Canvas 2D | CPU | Audio-reactive visual for my track (path): circular spectrum bars, the center pulses on the kick, particle bursts on every snare, colors shift each bar. Render 1080p60 synced to the audio. |
| [Oscilloscope music](index.html#ex-oscilloscope) | Web Audio (stereo buffer) + Canvas 2D | CPU | Oscilloscope-music clip: generate a stereo audio track where left = x and right = y of a beam that draws a rotating wireframe logo, then render the matching green phosphor-glow XY scope video in sync. |

### Animation libraries (11)

![Animation libraries](media/readme/poster-libs.jpg)

| Technique | Made with | Runs on | Prompt to copy |
|---|---|---|---|
| [Product configurator](index.html#ex-three-configurator) | Three.js (MeshPhysicalMaterial transmission, clearcoat and sheen, RoomEnvironment, LatheGeometry) | GPU | Using Three.js, build a product configurator: a perfume bottle made with LatheGeometry and MeshPhysicalMaterial (transmission, ior 1.5, thickness 1.2, clearcoat, sheen), RoomEnvironment reflections at intensity 1, a soft contact shadow, drag to rotate with inertia, auto-spin 0.5 rad/s, and finish and color swatch buttons (glass, frosted, ceramic, velvet) that tween the material over 0.6 s. |
| [Koi pond](index.html#ex-pixi-koi) | PixiJS (MeshRope, DisplacementFilter, BlurFilter, TilingSprite) | GPU | Using PixiJS v8, make a top-down koi pond: 9 koi made from generated textures on MeshRope with a swimming sine wave, blurred drop shadows, a DisplacementFilter (scale 16) over the water, scrolling caustic light, lily pads, and fish that swim to where I click. |
| [Truchet tile flip](index.html#ex-p5-truchet) | p5.js (instance mode, arc, rotate, noise, lerpColor) | CPU | Using p5.js in instance mode, draw a grid of Truchet tiles (40 px px cells) made of two quarter-circle arcs. Every 1.8 s flip 35% of the tiles by 90 degrees with an eased rotation that spreads out from a random tile. Color the strokes with noise() and lerpColor between coral, amber, cyan and violet on near-black. |
| [Scroll-scrubbed story](index.html#ex-gsap-scrub) | GSAP (timeline, SplitText, MorphSVGPlugin, progress scrubbing) | WEB | Using GSAP with ScrollTrigger, SplitText and MorphSVGPlugin, build a pinned scroll story: the headline splits into characters that fly in with a 0.04 s stagger, a circle morphs into a star while a counter runs 0 to 100%, three panels scroll sideways, then the end title drops in with bounce. Use scrub: 0.6 s so it follows the scrollbar smoothly in both directions. |
| [Spring layout shuffle](index.html#ex-motion-springs) | Motion (motion.dev animate with type: spring, stagger) | WEB | Using Motion (motion.dev) animate(), move 20 tiles between a word grid, a scatter, a ring and a stack every 2.2 s. Animate x, y, rotate and scale with type: spring, stiffness 260, damping 14, and delay: stagger(0.03, { from: "center" }). |
| [Grid stagger ripple](index.html#ex-anime-grid) | anime.js v4 (createTimeline, stagger with grid, from and axis) | WEB | Using anime.js v4, make a 25 x 12 grid of dots. Every 2.2 s pick a start cell and run createTimeline with delay: stagger(45 ms, { grid: [25, 12], from: index }), scale up and back with outElastic, translateX and translateY with stagger(4, { grid, from, axis }) so dots push away, and change color each wave. Clicking a dot starts a wave there. |
| [Animated icon set](index.html#ex-lottie-icons) | Lottie (lottie-web SVG player, animation JSON written by hand) | WEB | Write a Lottie JSON file (no After Effects) with three icons in a 640 x 360, 30 fps, 3 s loop: a sun rotating behind a drifting cloud with rain, a bell that swings 20 degrees and pops a coral badge with ease-out-back, and a circle that draws itself with a trim path, then a 7 px check mark. Play it with lottie-web as SVG. |
| [Force layout that reorganizes](index.html#ex-d3-force) | D3 (d3-force simulation, data join, scales, axis) | WEB | Using D3 v7, draw 90 nodes in 5 colored groups with links. Run a d3.forceSimulation with forceLink (distance 24), forceManyBody (strength -30) and forceCollide. Every 5 s s switch the forces: network, clusters pulled to group centers with forceX and forceY, then a beeswarm placed by value on an axis. Fade the links out in the beeswarm. |
| [Galton board](index.html#ex-matter-galton) | Matter.js (Engine, Bodies, Composite, fixed time step) | CPU | Using Matter.js, build a Galton board on a canvas: 13 rows of static peg circles, 14 bins with walls, and 160 balls dropped from the top at 14 per second with restitution 0.2. Step Engine.update at a fixed 60 Hz, damp the sideways speed of each ball a little every step, draw it yourself in a dark palette, color balls in bands, and overlay the expected binomial curve as a dashed line. Restart when full. |
| [Hand-drawn diagram](index.html#ex-rough-sketch) | Rough.js (rough.canvas, generator, fillStyle, seed) | CPU | Using Rough.js on a paper-colored canvas, draw a whiteboard diagram "Idea > Prompt > Motion" with boxes, arrows, an ellipse and an ease curve. Reveal each shape with a left-to-right wipe, use roughness 1.4, hachureGap 7, cycle fillStyle through hachure, zigzag, cross-hatch and dots, and change the seed 5 times per second for a boiling line effect. |
| [Step sequencer](index.html#ex-tone-sequencer) | Tone.js (Transport, Sequence, MembraneSynth, NoiseSynth, PolySynth, FeedbackDelay, Waveform) | CPU | Using Tone.js, build a 16-step sequencer on a canvas: rows for kick (MembraneSynth), snare and hats (NoiseSynth through filters), bass (MonoSynth), chords (PolySynth) and a lead with a FeedbackDelay (feedback 0.32). Tone.Sequence at 112 BPM with swing 0.15. Light each cell when it plays, let me click cells to toggle them, and draw the live Waveform under the grid. |

### 3D engines (Blender, Unreal) (12)

![3D engines (Blender, Unreal)](media/readme/poster-engine.jpg)

| Technique | Made with | Runs on | Prompt to copy |
|---|---|---|---|
| [Cloth simulation](index.html#ex-clip-cloth) (clip) | Blender 5.2: cloth modifier, wind force field, Eevee | ENGINE | 5-second Blender clip: a silky coral cloth napkin, a little smaller than the sphere, falls onto a glossy violet sphere on a dark reflective studio floor and drapes over its top half so the sphere still shows below, cloth simulation with self-collision and light wind, warm key, cyan rim and violet back light (light-linked so they skip the cloth), slow orbit, shallow depth of field, Eevee 1280x720. |
| [Soft-body jelly](index.html#ex-clip-softbody) (clip) | Blender 5.2: cloth with pressure, Eevee | ENGINE | 5-second Blender clip: four rounded jelly cubes (coral, amber, cyan, violet) drop one after another onto a dark studio floor, squash and wobble on impact, then a cream cube drops late, cloth with pressure so they keep their volume, translucent gummy material (subsurface scattering in each cube's own color, low back light linked to the cubes), camera drifting until the last frame, Eevee 1280x720. |
| [Geometry nodes field](index.html#ex-clip-geometry-nodes) (clip) | Blender 5.2: Geometry Nodes built in Python, Eevee | ENGINE | Blender Geometry Nodes (built in Python): 90x90 grid of beveled columns on a glossy floor, heights from a ripple spreading from the center plus slow 4D noise, violet-cyan-coral-amber gradient, 5 s Eevee, slow 45-degree orbit, shallow depth of field. |
| [Photoreal product turntable](index.html#ex-clip-cycles-photoreal) (clip) | Blender 5.2 Cycles on the GPU (AMD HIP) | ENGINE | Photoreal Blender Cycles product turntable on my AMD GPU (HIP): clear glass sphere, brushed anisotropic metal ring with visible circumferential streaks and glossy coral sphere on a cream stone pedestal, dark seamless studio, softbox and strip lights linked so they skip the pedestal, two low side softboxes linked to the pedestal only so its sides stay lit, a small caustic light so the glass throws a bright MNEE caustic into its shadow, 160 samples with denoising, 70 mm lens at f/3.5, slow 75-degree turn, 5 s. |
| [3D logo reveal](index.html#ex-clip-3d-logo) (clip) | Blender 5.2: text objects, bevel modifier, keyframes with BACK easing, Eevee | ENGINE | Blender Eevee 3D logo reveal of my wordmark in a bold font: each letter extruded and beveled, coral faces with chrome-gold bevels, letters rise out of a dark reflective floor 6 frames apart with BACK overshoot and the first one already rising on frame 1, glint sweep across the bevels, seamless curved backdrop with a soft violet glow behind, slow push-in, 5 s. |
| [Shatter in slow motion](index.html#ex-clip-shatter) (clip) | Blender 5.2: custom Voronoi fracture (bmesh), rigid bodies, force field, Eevee | ENGINE | Blender 5.2, 5-second slow-motion clip: a chrome ball smashes a black obsidian slab pre-fractured into about 85 Voronoi pieces (denser near the impact), rigid bodies released just before the hit, time scale 0.3, short force-field blast, inner faces glow amber and coral and cool down, debris settles on a dark mirror floor, world shader that is near-black to the camera but shows reflections a soft sky with two softbox strips, low three-quarter camera pushing in, Eevee. |
| [Grease Pencil doodle to logo](index.html#ex-clip-grease-pencil) (clip) | Blender 5.2: Grease Pencil v3 from Python, Build and Noise modifiers | ENGINE | Blender 5.2 Grease Pencil v3 from Python, 5-second flat 2D doodle on cream paper in navy and coral ink: a loopy pen line enters from the left with its tail chasing the head and wraps into a circle, then a hatched sun, waves, rays, an underline swoosh and sparkles draw themselves with Build modifiers, Noise modifier step 3 for boiling lines, orthographic camera. |
| [Ocean with a floating buoy](index.html#ex-clip-ocean) (clip) | Blender 5.2: Ocean modifier, world-shader sky, scripted buoy tracking, Cycles on the GPU (AMD HIP) | ENGINE | Blender 5.2 Cycles on my AMD GPU (HIP), 5-second stylized sunset ocean: Ocean modifier with keyframed time and moderate choppiness, gradient sunset sky with a low sun disk, sun glitter path, foam on the crests from wave height and streaky noise, an animated foam ring with outward ripples around a coral and cream buoy with a blinking lamp that bobs and tilts with the waves (read the ocean surface each frame), path-traced reflections so the buoy mirrors in the water without screen-space artifacts, 128 samples with denoising, low drifting camera. |
| [Fur-ball character](index.html#ex-clip-particles-fur) (clip) | Blender 5.2: particle hair with children, hair dynamics, turbulence field, Eevee | ENGINE | Blender 5.2 Eevee, 5 seconds: a fluffy coral fur-ball character with two glossy eyes on a dark glossy floor, particle hair with interpolated children, clumping and roughness, violet-to-coral-to-amber root-to-tip gradient, hair dynamics that collide with the floor and soft turbulence, drops in, bounces twice with squash and stretch, then shakes like a wet dog with wide swings while the hair stiffness is keyframed down so the fur flings out, motion blur, cyan and violet rim lights. |
| [Liquid pour](index.html#ex-clip-liquid) (clip) | Blender 5.2: Mantaflow FLIP liquid with inflow, collision sphere, fluid mesh with speed vectors, Cycles on the GPU (AMD HIP) | ENGINE | 5-second Blender liquid simulation: a thick glossy coral paint stream pours onto a cream sphere on a dark reflective floor, coats it and splashes outward, Mantaflow FLIP with an inflow and the sphere as a collision object, pre-rolled so the stream lands on frame 1 and pouring until near the end, 3 particles per cell and a larger mesh radius with extra smoothing so the thin sheets stay whole, domain resolution 160 with open sides, mesh speed vectors (UNI cache) for motion blur, Cycles on my AMD GPU (HIP) with motion blur, warm key with cyan and violet rims light-linked to the liquid only, slow orbiting push-in, shallow depth of field. |
| [Ring of fire and smoke](index.html#ex-clip-smoke-fire) (clip) | Blender 5.2: Mantaflow gas (fire + smoke), Principled Volume with Blackbody, Eevee volumetrics | ENGINE | 5-second Blender ring of fire: a dark metal torus emits Fire+Smoke into a Mantaflow gas domain with a noise texture on the emission and light turbulence, resolution about 128, pre-rolled so it is already burning, Principled Volume with light grey smoke and Blackbody-colored flame emission, volume-only back lights so the smoke glows without colored floor pools, faint backdrop glow, Eevee volumetrics with the Standard view transform, flickering point light for floor glow, slow push-in. |
| [Niagara particle vortex](index.html#ex-clip-unreal-niagara) (clip) | Unreal Engine 5.8: Niagara GPU particles, Lumen, Sequencer, Movie Render Queue, built through the Unreal MCP | ENGINE | Open Unreal Engine 5.8 on a blank project with the Unreal MCP plugin enabled and wait until its MCP server is connected. Then, through the MCP tools: build a dark studio level with a glossy near-black floor, a glowing coral emissive core and Lumen lighting; create a Niagara system with two GPU emitters (about 45,000 particles), coral-to-amber sparks spawned on a ring that orbit and spiral into the core plus a wider cyan-to-violet ring, curl noise, vortex and point attraction forces, velocity-aligned sprites stretched by speed into light streaks; add a cine camera in a Level Sequence that orbits down from a top view to a grazing view with look-at tracking on the core; render 5 s at 1280x720, 30 fps with Movie Render Queue (8 temporal samples, warm-up frames) and encode an MP4. |

### Code-to-video tools (6)

![Code-to-video tools](media/readme/poster-tools.jpg)

| Technique | Made with | Runs on | Prompt to copy |
|---|---|---|---|
| [Remotion: React to video](index.html#ex-clip-remotion) (clip) | Remotion (React components rendered frame by frame) | CPU | Use Remotion to make a 7-second 1280x720 social video: kinetic title words spring up from behind a mask, three glass stat cards spring in one after another with count-up numbers and mini charts (line draw, spring bars, progress ring), gradient progress bar, coral/amber/cyan/violet, Bahnschrift. |
| [Manim: math animation](index.html#ex-clip-manim) (clip) | Manim Community (Python) | CPU | Manim Community scene, 720p30, 8 s: a sine wave on clean axes morphs with ReplacementTransform into square-wave Fourier approximations (1, 2, 3, 5, 9, 24 terms), term counter in the corner, dashed target square wave, growing bar chart of amplitudes, dark background, cyan/violet/amber. |
| [Three.js rendered to video](index.html#ex-clip-threejs-render) (clip) | Three.js (MeshPhysicalMaterial, InstancedMesh, UnrealBloomPass), rendered in headless Chrome | GPU | Three.js scene rendered frame by frame to a 7 s 1280x720 MP4: glass torus knot (transmission, clearcoat, iridescence) with a glowing core over an InstancedMesh field of rippling rounded columns, RoomEnvironment lighting, orbiting chrome spheres, UnrealBloom, slow orbit camera. |
| [WebGPU: one million particles](index.html#ex-clip-webgpu) (clip) | WebGPU (WGSL compute shader) | GPU | WebGPU page with 1,000,000 particles updated by a WGSL compute shader: burst from a ball, flow through 3D curl noise, then settle onto the Thomas strange attractor, additive points with fading trails and glow, violet/cyan/amber/coral ramp, render 8 s 1280x720. |
| [HyperFrames: HTML to video](index.html#ex-clip-hyperframes) (clip) | HyperFrames (HeyGen, open source): timed HTML clips + one GSAP timeline, rendered by its CLI | CPU | Use HyperFrames to make an 8-second 1280x720 launch video for my app in one index.html: kinetic headline with masked word reveals, a dashboard mockup that builds itself (rolling counter, chart drawing on, cursor clicking a button, toast), a logo end card, and a karaoke caption track. One paused GSAP timeline, seek-safe tweens only. Run npx hyperframes check until it passes, then render at 30 fps. |
| [Motion Canvas: code explainer](index.html#ex-clip-motion-canvas) (clip) | Motion Canvas (TypeScript generators, Code node, FFmpeg exporter) | CPU | Use Motion Canvas to make a 7-second 1280x720 code explainer: highlight a sequential await loop next to a network timeline where three request bars run one after another to 360 ms, morph the code into Promise.all, re-run the bars in parallel to 120 ms, end with a '3x faster' badge popping in with easeOutBack. Export with the FFmpeg exporter. |

### Editing and post-production (5)

![Editing and post-production](media/readme/poster-edit.jpg)

| Technique | Made with | Runs on | Prompt to copy |
|---|---|---|---|
| [Speed ramp](index.html#ex-clip-speed-ramp) (clip) | FFmpeg minterpolate (motion-compensated) + Python speed curve | CPU | Speed ramp on my clip: normal speed, ease down to 0.2x at the impact (0:03.4) with optical-flow frame interpolation (ffmpeg minterpolate, mci), hold 3 s, ramp up to 2x, motion blur on the fast part, live speed label in the corner. |
| [Datamosh](index.html#ex-clip-datamosh) (clip) | FFmpeg (MPEG-4 Part 2) + Python byte editing | CPU | Datamosh the cut between clip A and clip B: re-encode as MPEG-4 Part 2 with no B-frames and one keyframe each, delete clip B's I-frame so its motion smears A, repeat one P-frame about 40 times for a bloom, export H.264. |
| [Split-screen montage](index.html#ex-clip-split-screen) (clip) | Python (Pillow) compositing fed by FFmpeg | CPU | 2x2 split-screen montage from these four clips: tiles slide in one by one with slight overshoot, 0.2 s apart, rounded corners and labels, hold 2 s, then the top-right clip expands to full screen while the others fade out. |
| [Color grade before and after](index.html#ex-clip-color-grade) (clip) | Python-generated .cube LUT + FFmpeg lut3d | CPU | Grade my clip with a teal-and-orange film look as a 3D LUT (.cube): S-curve, teal shadows, warm highlights, slightly lifted blacks, apply with ffmpeg lut3d; make a before/after version with a moving wipe line labeled BEFORE and AFTER. |
| [Boomerang and stutter edit](index.html#ex-clip-boomerang) (clip) | FFmpeg + Python frame ordering | CPU | Punchy boomerang from 0:01.2 to 0:02.3 of my clip at 1.5x: forward, reverse, forward, reverse with no doubled frame at the turns; stutter a 4-frame chunk 4 times on the beat with a zoom punch; end on a freeze frame with a white flash and slow push-in. |
<!-- CATALOG:END -->

## Cheat sheet

**Prompt template**

```
Make [what it is for].
Deliverable: [N] seconds, [1920x1080 / 1080x1920], [60] fps, MP4 on my desktop.
Look: [mood], palette [hex codes], font [name], references [anything].
Techniques: [names from the catalog], built with [tool if it matters].
Timeline:
  0-2 s   [what happens]
  2-5 s   [what happens]
Motion: [easing], [stagger], [timing].
Camera: [static / orbit / push-in / fly-over], [depth of field?]
Transitions: [iris wipe / glitch cut / crossfade / match cut].
Post: [bloom, grain, vignette, motion blur].
Text on screen: "[exact words]" at [time].
Sound: [none / synthesized at N BPM / my track at path, cut to the beat].
Show me test frames as a contact sheet before the full render.
```

**Which tool for which job**

| You want | Ask for |
|---|---|
| Titles, logo reveals, lower thirds | Kinetic type and shape layers in Canvas 2D, Remotion or HyperFrames |
| A logo made of particles | GPU particles in WebGL2, or WebGPU for millions |
| Abstract looping backgrounds | A procedural fragment shader, seamless loop |
| Liquid, melting 3D blobs | Ray-marched SDFs |
| Falling, crashing, cloth, water, smoke | A Blender simulation |
| A realistic product shot | Blender Cycles, studio lighting, turntable |
| A math or data explainer | Manim, Motion Canvas, or D3 |
| Social videos from data or templates | Remotion |
| Motion inside your app or site | CSS, Motion (Framer Motion), GSAP |
| Changes to footage you already have | FFmpeg: speed ramp, grade, split screen, datamosh |

**Habits that save time**

1. Give times in seconds: "at 3 s the logo lands".
2. Ask for test frames before the full render.
3. Name the technique, and the tool when it matters.
4. Point at a card: "like the fluid simulation card, in my brand colors".
5. Change one thing at a time once the base looks right.
6. Say what to avoid: "no lens flares, no text under 28 px".

## Tools used here

Every tool below made something in the catalog on one Windows 11 PC (Ryzen 9 9950X, Radeon RX 9070 XT, no NVIDIA GPU).

| Tool | What it is | Used for |
|---|---|---|
| Canvas 2D, SVG, CSS | Browser drawing and animation | Type, UI motion, 2D simulations |
| WebGL2 + GLSL | GPU shaders in the browser | Particles, fluids, fractals, ray marching, post effects |
| WebGPU + WGSL | Compute shaders in the browser | One million particles |
| Three.js, p5.js, GSAP, Motion, PixiJS, Matter.js, D3, Lottie, anime.js | Animation and graphics libraries | The Animation libraries section |
| Remotion | React components rendered to video | Stat-card social video |
| HyperFrames | HTML compositions rendered to video | Product-launch sequence |
| Motion Canvas | TypeScript animation with generators | Code explainer |
| Manim | Python math animation | Fourier series |
| Blender 5.2 (Eevee, Cycles on AMD HIP) | 3D suite, scripted with Python | Physics, cloth, liquid, fire, fur, ocean, geometry nodes, photoreal |
| Unreal Engine 5.8 (Niagara, Lumen, Sequencer, Movie Render Queue) | Game engine, driven through its built-in MCP server | Niagara particle vortex |
| FFmpeg + Python | Video processing | Encoding, speed ramp, datamosh, color grade, split screen |
| Python + NumPy + SciPy | Audio synthesis | The reel's soundtrack |
| Headless Chrome + Playwright | Browser driven by code | Rendering web scenes to frames, site checks |

Unreal Engine 5.8 was driven through its built-in MCP server (the experimental Unreal MCP plugin): Claude opened the editor, waited until the MCP was connected, built the whole scene with MCP tool calls and rendered it with Movie Render Queue. See `source/unreal/README.md`.

## Reproduce

| What | How |
|---|---|
| The reel | `source/reel/README.md`: render the Blender shot, render 3,600 web frames, synthesize audio, encode |
| Blender clips | `blender -b -P source/blender/<name>.py -- <out_dir>` (each script has a usage line) |
| Unreal clip | `source/unreal/README.md`: open the project in the editor, wait for the MCP, then `python build_scene.py` and `python render.py` |
| Tool clips | `source/tools/<tool>/README.md` |
| Editing tricks | `source/edit/<trick>` scripts, rerunnable from that folder |
| Site catalog | `python scripts/build_catalog.py` (fails if any clip is missing from the site) |
| Site check | `cd scripts && npm i && node check_site.mjs` (links, coverage, console errors, every card renders) |
| README tables and GIFs | `node scripts/export_catalog.mjs`, `node scripts/make_readme_media.mjs`, `python scripts/build_readme.py` |
| Add a technique | `site/README.md` explains the card API, sliders, and how to add a clip |

## Repository map

```
index.html            Motion Studio: the whole resource in one offline page
README.md             this tutorial and cheat sheet
media/
  reel/               the reel (web version; the full-quality master is a Release asset)
  clips/              scenes cut from the reel
  engine/             Blender and Unreal clips
  tools/              Remotion, HyperFrames, Motion Canvas, Manim, Three.js, WebGPU clips
  edit/               FFmpeg editing tricks
  readme/             GIFs and posters used in this README
site/
  site.css, site.js   page styles and wiring
  learn/              the Learn section demos
  catalog/            every live demo, the clip catalog, the card runtime (core.js)
  vendor/             third-party libraries (with their licenses)
source/
  reel/               how the reel was made
  blender/            Blender scripts for the Blender clips
  unreal/             Unreal project, MCP client, build and render scripts
  tools/              projects for the code-to-video tools
  edit/               editing trick scripts
  libs/               source of the bundled Three.js demo
scripts/              catalog build, site check, README generation
```

## Credits and licenses

Everything in this repository was written and rendered by Claude (Opus 5.5) in Claude Code. The third-party libraries in `site/vendor/` (Three.js, PixiJS, p5.js, GSAP, Motion, anime.js, lottie-web, D3, Matter.js, Rough.js, Tone.js) keep their own licenses; each license file sits next to its library.
