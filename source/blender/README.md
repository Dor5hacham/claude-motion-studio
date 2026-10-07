# Blender scripts

Each script builds one scene from nothing, bakes its simulation if it has one, and renders PNG frames with Blender 5.2 (headless). The finished clips are in `media/engine/`; the reel's wall smash is in `source/reel/blender_scene.py`.

| Script | Clip | What it shows | Blender features |
|---|---|---|---|
| `cloth.py` | `cloth.mp4` | Silk napkin drapes over a sphere, its lower half still showing | Cloth modifier, self-collision, wind, light linking |
| `softbody.py` | `softbody.mp4` | Gummy cubes squash on landing, a fifth drops late | Cloth with pressure, late cache start, subsurface scattering |
| `liquid.py` | `liquid.mp4` | Paint pours over a sphere | Mantaflow FLIP liquid, mesh, pre-roll, light linking |
| `smoke-fire.py` | `smoke-fire.mp4` | Ring of fire and smoke | Mantaflow gas, Principled Volume, Blackbody, volume-only lights |
| `shatter.py` | `shatter.mp4` | Slab breaks into 85 pieces | Voronoi fracture with bmesh, rigid bodies, reflection-only world |
| `geometry-nodes.py` | `geometry-nodes.mp4` | 8,100 columns ripple | Geometry Nodes built in Python |
| `cycles-photoreal.py` | `cycles-photoreal.mp4` | Glass and metal turntable | Cycles on AMD HIP, MNEE caustics, anisotropic metal, light linking |
| `3d-logo.py` | `3d-logo.mp4` | Letters rise with overshoot | Text to mesh, Bevel, BACK easing, curved cyc |
| `grease-pencil.py` | `grease-pencil.mp4` | Doodle draws itself | Grease Pencil v3, Build and Noise modifiers |
| `ocean.py` | `ocean.mp4` | Buoy bobs at sunset in its own foam ring | Ocean modifier, scripted floating, shader foam |
| `particles-fur.py` | `particles-fur.mp4` | Fur ball bounces and shakes | Particle hair, hair dynamics with floor collision |

## Run one

From this folder, with Blender 5.2 (change the path to yours):

```
"/b/Program Files/Blender Foundation/Blender 5.2/blender.exe" -b -P cloth.py -- "C:/temp/cloth"          # all frames
"/b/Program Files/Blender Foundation/Blender 5.2/blender.exe" -b -P cloth.py -- "C:/temp/cloth" 60       # one test frame
ffmpeg -framerate 30 -i "C:/temp/cloth/f_%04d.png" -c:v libx264 -crf 22 -preset slow -pix_fmt yuv420p -movflags +faststart ../../media/engine/cloth.mp4
```

Each script's header comment describes the scene and its arguments (some accept a list of test frames or a preview range). `liquid.py` and `smoke-fire.py` pre-roll their simulation, so their frames start at `f_0013.png` and `f_0021.png`: add `-start_number 13` or `-start_number 21` (and `-frames:v 150`) to the ffmpeg command. Simulations rebake on every run. On a Radeon RX 9070 XT the liquid bake takes about 10 to 11 minutes and the fire bake about 5, plus 2 to 3 minutes of rendering each; the other shots take 1 to 7 minutes in total.
