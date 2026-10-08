# Spectral path tracer in Rust, from scratch

A physically based renderer in one Rust file with no crates: only the standard library, with `std::thread::scope` for the threads. It renders a 7 s shot: a spinning flint-glass prism splits neon bars into rainbows, a faceted gem throws fire, a gold sphere and a copper torus reflect the room, and three glowing moons orbit fast enough to streak. Clip: `media/tools/rust-pathtracer.mp4` (1280x720, 30 fps, 210 frames).

## What is in it
- Geometry: spheres (with linear motion during the shutter) and triangles; the torus mesh has 4,032 smooth-shaded triangles.
- BVH built every frame with binned SAH (16 bins), traversed near child first with a fixed stack.
- Materials: Lambert, GGX rough metal (Smith shadowing, Schlick Fresnel), a diffuse floor under a rough clear coat, smooth glass with exact dielectric Fresnel, and area lights.
- Light transport: unidirectional path tracing with next event estimation and multiple importance sampling (power heuristic) on quad and sphere lights, Russian roulette after 3 bounces, and a clamp on indirect samples to stop fireflies.
- Dispersion: the first time a path enters dispersive glass it picks one wavelength (380 to 720 nm), weights the path by that wavelength's RGB color and bends with a Cauchy index n(lambda). That is how the prism and the gem split white light.
- Camera: thin lens with a focus pull from the prism to the gold sphere; a 360 degree shutter gives each sample its own time, so the moons blur along their orbits.
- Denoiser: 5 passes of an edge-avoiding a-trous wavelet filter (SVGF style) guided by normals, albedo and per-pixel variance. Glass passes its features through to the first non-glass hit.
- Output: bloom from two Gaussian blurs, ACES filmic tone curve, sRGB, dithering, binary PPM.

## Render
Set `CARGO_TARGET_DIR` to a folder outside the repo first.
```
RUSTFLAGS="-C target-cpu=native" cargo build --release
THREADS=12 pathtracer frames --spp 64
ffmpeg -framerate 30 -i frames/f_%04d.ppm -c:v libx264 -crf 20 -preset slow -pix_fmt yuv420p -movflags +faststart -threads 8 rust-pathtracer.mp4
```
Options: `--w`, `--h`, `--spp`, `--from`, `--to`, `--step`, `--total`, `--fps`. Existing frames are skipped, so a stopped render resumes. `NODENOISE=1` writes the raw path-traced frames. A quick look: `--w 640 --h 360 --spp 16 --step 50`.

Timing on a Ryzen 9 9950X with 12 threads at 64 samples per pixel: 3.5 s per frame on average (2.9 to 4.6 s), 12.3 minutes for all 210 frames, denoiser included.
