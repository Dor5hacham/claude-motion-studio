# Blender scripts

Each script builds one scene from nothing, bakes its simulation if it has one, and renders PNG frames with Blender 5.2 (headless). The finished clips are in `media/engine/`; the reel's wall smash is in `source/reel/blender_scene.py`.

| Script | Clip | What it shows | Blender features |
|---|---|---|---|
| `cloth.py` | `cloth.mp4` | Silk sheet drapes over a sphere | Cloth modifier, self-collision, wind |
| `softbody.py` | `softbody.mp4` | Jelly cubes squash on landing | Cloth with pressure |
| `liquid.py` | `liquid.mp4` | Paint pours over a sphere | Mantaflow FLIP liquid, mesh |
| `smoke-fire.py` | `smoke-fire.mp4` | Ring of fire and smoke | Mantaflow gas, Principled Volume, Blackbody |
| `shatter.py` | `shatter.mp4` | Slab breaks into 85 pieces | Voronoi fracture with bmesh, rigid bodies |
| `geometry-nodes.py` | `geometry-nodes.mp4` | 8,100 columns ripple | Geometry Nodes built in Python |
| `cycles-photoreal.py` | `cycles-photoreal.mp4` | Glass and metal turntable | Cycles on AMD HIP, MNEE caustics |
| `3d-logo.py` | `3d-logo.mp4` | Letters rise with overshoot | Text to mesh, Bevel, BACK easing |
| `grease-pencil.py` | `grease-pencil.mp4` | Doodle draws itself | Grease Pencil v3, Build and Noise modifiers |
| `ocean.py` | `ocean.mp4` | Buoy bobs at sunset | Ocean modifier, scripted floating |
| `particles-fur.py` | `particles-fur.mp4` | Fur ball bounces and shakes | Particle hair, hair dynamics |

## Run one

From this folder, with Blender 5.2 (change the path to yours):

```
"/b/Program Files/Blender Foundation/Blender 5.2/blender.exe" -b -P cloth.py -- "C:/temp/cloth"          # all frames
"/b/Program Files/Blender Foundation/Blender 5.2/blender.exe" -b -P cloth.py -- "C:/temp/cloth" 60       # one test frame
ffmpeg -framerate 30 -i "C:/temp/cloth/f_%04d.png" -c:v libx264 -crf 22 -preset slow -pix_fmt yuv420p -movflags +faststart ../../media/engine/cloth.mp4
```

Each script's header comment describes the scene and its arguments (some accept a list of test frames or a preview range). Simulations rebake on every run; the liquid and fire bakes take 4 to 6 minutes on a Radeon RX 9070 XT, the other shots 1 to 7 minutes in total.
