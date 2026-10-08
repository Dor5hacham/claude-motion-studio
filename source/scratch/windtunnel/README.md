# Wind tunnel: lattice Boltzmann in Rust, from scratch

A 2D flow solver and renderer in one Rust file with no crates (std threads only). Smoke lines flow past a NACA 2412 wing at 4 degrees, then the wing pitches up to 24 degrees, stalls, and sheds big vortices. Clip: `media/tools/rust-lbm-windtunnel.mp4` (8 s, 1280x720, 30 fps).

## How the solver works
- Lattice Boltzmann, D2Q9: each of the 800x450 cells holds 9 particle populations that stream to their neighbors and relax toward a local equilibrium (BGK). Streaming and collision are fused in one pull pass, split across threads by rows.
- Viscosity: base relaxation time 0.51 plus a Smagorinsky eddy viscosity from the local non-equilibrium stress, which keeps the high Reynolds number flow stable.
- Boundaries: equilibrium inflow at 0.1 lattice speed on the left, top and bottom; zero-gradient outlet on the right with a sponge (rising viscosity) over the last 90 columns so vortices leave without reflecting.
- The wing: NACA 2412 outline from the 4-digit formulas, pitched about the quarter chord, scanline-filled into a solid mask whenever the angle changes by 0.05 degrees. Walls use halfway bounce-back.
- Timing: 9,000 warm-up steps, then 60 steps per frame (23,400 in all). The angle eases from 4 to 24 degrees between 1.0 and 4.5 s.

## How the renderer works
- Smoke: 27 streaklines; a particle leaves each inlet point every 4 steps and is advected with midpoint (RK2) steps through the bilinear velocity field. About 54,000 particles are alive at once.
- Vorticity (the curl of the velocity) tints the background: coral for one direction of spin, cyan for the other.
- The wing is filled from its signed distance for clean edges; the gauge in the corner shows the angle of attack.

## Render
Set `CARGO_TARGET_DIR` to a folder outside the repo first.
```
RUSTFLAGS="-C target-cpu=native" cargo build --release
THREADS=12 windtunnel frames --frames 240
ffmpeg -framerate 30 -i frames/f_%04d.ppm -c:v libx264 -crf 20 -preset slow -pix_fmt yuv420p -movflags +faststart -threads 8 rust-lbm-windtunnel.mp4
```
Options: `--frames`, `--steps` (lattice steps per frame), `--warm`, `--from`, `--every` (write every n-th frame for a quick look). The whole run takes about one minute on a Ryzen 9 9950X with 12 threads.
