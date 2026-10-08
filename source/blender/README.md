# Blender scripts

Each script builds one scene from nothing, bakes its simulation if it has one, and renders PNG frames with Blender 5.2 (headless). The finished clips are in `media/engine/`; the reel's wall smash is in `source/reel/blender_scene.py`.

| Script | Clip | What it shows | Blender features |
|---|---|---|---|
| `cloth.py` | `cloth.mp4` | Silk napkin drapes over a sphere, its lower half still showing | Cloth modifier, self-collision, wind, light linking |
| `softbody.py` | `softbody.mp4` | Gummy cubes squash on landing, a fifth drops late | Cloth with pressure, late cache start, subsurface scattering |
| `liquid.py` | `liquid.mp4` | Paint pours over a sphere | Mantaflow FLIP liquid, mesh with speed vectors, pre-roll, Cycles on AMD HIP with motion blur on the liquid, light linking |
| `smoke-fire.py` | `smoke-fire.mp4` | Ring of fire and smoke | Mantaflow gas, Principled Volume, Blackbody, volume-only lights |
| `shatter.py` | `shatter.mp4` | Slab breaks into 85 pieces | Voronoi fracture with bmesh, rigid bodies, reflection-only world |
| `geometry-nodes.py` | `geometry-nodes.mp4` | 8,100 columns ripple | Geometry Nodes built in Python |
| `cycles-photoreal.py` | `cycles-photoreal.mp4` | Glass and metal turntable | Cycles on AMD HIP, MNEE caustics, anisotropic metal, light linking (pedestal-only side lights) |
| `3d-logo.py` | `3d-logo.mp4` | Letters rise with overshoot | Text to mesh, Bevel, BACK easing, curved cyc |
| `grease-pencil.py` | `grease-pencil.mp4` | Doodle draws itself | Grease Pencil v3, Build and Noise modifiers |
| `ocean.py` | `ocean.mp4` | Buoy bobs at sunset in its own foam ring, mirrored in the water | Ocean modifier, scripted floating, shader foam, Cycles on AMD HIP (path-traced reflections) |
| `particles-fur.py` | `particles-fur.mp4` | Fur ball bounces and shakes | Particle hair, hair dynamics with floor collision |
| `toon-line-art.py` | `toon-line-art.mp4` | Anime floating island with a windmill and a waterfall | Shader to RGB with constant color ramps (toon bands), Grease Pencil Line Art modifier, camera-only sky gradient |
| `beat-speaker.py` | `beat-speaker.mp4` (with sound) | Woofer pumps and beads hop to a drum-and-bass loop, LED ring shows the spectrum | Music synthesized in NumPy and written as `beat.wav`, per-frame FFT, keyframes baked with `foreach_set`, motion blur; mux the WAV with `-i beat.wav -c:a aac -shortest` |
| `god-rays.py` | `god-rays.mp4` | Sun shafts widen through tilting blinds into a dusty room | Eevee volumetrics with sun shadows (tile 1:2, 128 steps), Principled Volume with drifting 4D noise density, Geometry Nodes dust motes, the sun as the only light |
| `vine-growth.py` | `vine-growth.mp4` | Ivy spirals up a glossy vase, leaves and berries pop in | Geometry Nodes simulation zone built in Python, Sample Nearest Surface and Geometry Proximity, Points to Curves, Curve to Mesh; the script steps every frame before rendering it so the simulation cache is complete |
| `exploded-view.py` | `exploded-view.mp4` | Keyboard switch comes apart into seven labeled parts, then clicks back together | Parts from primitives (bmesh, Solidify, Bevel), staggered QUINT keyframes, billboard call-outs faded per object, raytraced refraction |
| `engrave.py` | `engrave.mp4` | V-bit engraves MOTION into an anodized block | Geometry Nodes carving (Geometry Proximity to a timed toolpath, Scene Time), text outlines sampled with `interpolate_bezier` |
| `domino.py` | `domino.mp4` | 241 dominoes fall along a spiral to the center | Bullet rigid bodies that start deactivated, kinematic nudge, wave front read from the bake to aim the camera |
| `skipping-stone.py` | `skipping-stone.mp4` | Stone skips seven times across a dusk pond, rings interfere | Wave equation solved in NumPy, frame-change handler writes the mesh, procedural sky and tree line in the world shader |

## Run one

From this folder, with Blender 5.2 (change the path to yours):

```
"/b/Program Files/Blender Foundation/Blender 5.2/blender.exe" -b -P cloth.py -- "C:/temp/cloth"          # all frames
"/b/Program Files/Blender Foundation/Blender 5.2/blender.exe" -b -P cloth.py -- "C:/temp/cloth" 60       # one test frame
ffmpeg -framerate 30 -i "C:/temp/cloth/f_%04d.png" -c:v libx264 -crf 22 -preset slow -pix_fmt yuv420p -movflags +faststart ../../media/engine/cloth.mp4
```

Each script's header comment describes the scene and its arguments (some accept a list of test frames or a preview range). `liquid.py` and `smoke-fire.py` pre-roll their simulation, so their frames start at `f_0013.png` and `f_0021.png`: add `-start_number 13` or `-start_number 21` (and `-frames:v 150`) to the ffmpeg command. Simulations rebake on every run. On a Radeon RX 9070 XT the liquid bake takes about 17 minutes and its Cycles render with motion blur about 12; the fire bake takes about 5 minutes plus 2 to 3 of rendering; the Cycles ocean takes about 11 to 14 minutes and the Cycles turntable about 7.5; the other shots take 1 to 7 minutes in total. `liquid.py` caches its data as UNI, not OpenVDB: with OpenVDB, Mantaflow silently skips the mesh speed vectors and Cycles draws no motion blur on the liquid.
