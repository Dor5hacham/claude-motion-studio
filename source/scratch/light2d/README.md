# Newton's prism: a 2D spectral light tracer in Rust, from scratch

A light renderer for a flat world, in one Rust file with no crates (std threads only). A white beam travels in, a prism splits it into a rainbow on a screen, then a lens rises into the fan and focuses the colors back into white. Clip: `media/tools/rust-light2d-prism.mp4` (8 s, 1280x720, 30 fps).

## How it works
- Each frame traces 600,000 rays. Every ray gets one wavelength (400 to 700 nm), a start point across the 14 px wide beam and a tiny angle spread.
- Glass bodies are convex: the prism is an intersection of half-planes, the lens an intersection of two disks. A ray finds its entry and exit distance with each body in one pass.
- At each surface the ray reflects or refracts with the exact dielectric Fresnel probability. The index follows Cauchy's law, n = A + B / lambda^2, strong in the prism (B = 0.055) and weak in the lens, which is why the prism splits the light and the lens folds it back.
- Every segment a ray travels is added to the image as an anti-aliased line with constant brightness per unit length. The picture is the light itself, including the faint beams that reflect off the glass.
- The light is switched on at t = 0 and each ray only travels 600 px per second, which makes the beam front. Light that reaches the screen is also summed per row and drawn on the screen bar.
- Each thread draws into its own buffer; the buffers are summed, given a glow from two Gaussian blurs and tone mapped with 1 - exp(-x). Every frame uses the same random numbers, so the noise does not flicker.

## Render
Set `CARGO_TARGET_DIR` to a folder outside the repo first.
```
RUSTFLAGS="-C target-cpu=native" cargo build --release
THREADS=12 light2d frames --frames 240
ffmpeg -framerate 30 -i frames/f_%04d.ppm -c:v libx264 -crf 20 -preset slow -pix_fmt yuv420p -movflags +faststart -threads 8 rust-light2d-prism.mp4
```
Options: `--frames`, `--rays`, `--from`, `--every`. The full render takes about 1.6 minutes on a Ryzen 9 9950X with 12 threads.
