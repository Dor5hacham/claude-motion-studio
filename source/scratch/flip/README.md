# Liquid hourglass: a FLIP solver in Go, from scratch

A 2D liquid solver and a liquid renderer in one Go file, standard library only. A glass hourglass of cyan and coral liquid turns over twice; the liquid pours through the neck, splashes, traps air, and the lighter coral rises back through the cyan. Clip: `media/tools/go-flip-hourglass.mp4` (8 s, 1280x720, 30 fps).

## How the solver works
- FLIP (fluid implicit particle): 27,157 particles carry the velocity; a 124x209 MAC grid (8 mm cells) makes the flow incompressible each step.
- Per step (5 per frame, dt = 1/150 s): forces on the particles, push overlapping particles apart through a spatial hash, collide with the glass, splat velocities to the grid, 80 Gauss-Seidel pressure iterations with over-relaxation 1.9, then blend the grid change back into the particles (88 percent FLIP, 12 percent PIC).
- The simulation runs in the frame of the glass. Gravity turns with it, and the solver adds the Coriolis, centrifugal and Euler forces of the rotating frame.
- The glass is a signed distance function. Grid cells outside it are solid; particles that cross it are pushed back along the distance gradient and lose their outward velocity.
- Drift correction: cells that hold more particles than the rest density (measured on interior cells at the start) get extra outflow, so the volume stays put.
- Two liquids: each particle carries a dye value, and the coral one feels slightly less gravity (Boussinesq buoyancy), so it rises in plumes after each turn.

## How the renderer works
- Particles are splatted with a smooth kernel into a half-resolution field in the glass frame; the surface is a threshold of that field (metaballs), anti-aliased with the field gradient. Each screen pixel is mapped back into the turning glass frame.
- The dye ratio is blurred a little and pushed through a contrast curve, so mixing reads as marbled bands.
- Depth color comes from a chamfer distance transform (distance to the nearest air), so drops, sheets and bubbles shade correctly.
- A pseudo 3D normal near the surface gives the rim light and specular highlight; particles outside the surface are drawn as droplets.
- The glass, the end caps and the pillars are shaded analytically, with a highlight that stays with the light as the glass turns.

## Render
Needs Go 1.25 or later and FFmpeg. Run these from this folder (`source/scratch/flip`). The same two commands work on Windows, macOS and Linux. `go run` builds the program in Go's own cache, so no binary is written into the repo, and the frames and the clip go to the git-ignored `_work/` folder at the repository root.
```
go run . ../../../_work/flip/frames 240 8
ffmpeg -framerate 30 -i ../../../_work/flip/frames/f_%04d.ppm -c:v libx264 -crf 20 -preset slow -pix_fmt yuv420p -movflags +faststart -threads 8 ../../../_work/flip/go-flip-hourglass.mp4
```
Arguments: output folder, frame count, render threads. The simulation is sequential, so frames come out in order. The full run takes about 30 s on a Ryzen 9 9950X. To update the page, copy `_work/flip/go-flip-hourglass.mp4` over `media/tools/go-flip-hourglass.mp4`, then delete `_work/flip/`.
