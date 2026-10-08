# Diffraction starbursts: Fourier optics in Rust, from scratch

A far-field diffraction renderer in one Rust file with no crates (std threads only), including its own FFT. An aperture morphs from a circle to a hexagonal iris, a square, a triangle and a slit grating; the main picture is the light pattern it makes. Clip: `media/tools/rust-fourier-diffraction.mp4` (8 s, 1280x720, 30 fps).

## How it works
- The aperture is a 512x512 mask drawn from a signed distance, anti-aliased at the edge. Shapes blend by mixing their distances with an eased weight, and the whole mask turns slowly.
- Fraunhofer diffraction: the far-field light pattern of an aperture is the squared magnitude of its 2D Fourier transform. The renderer runs its own iterative radix-2 FFT (bit reversal, butterflies, precomputed twiddles) on every row, transposes, and runs it on every row again. Rows are split across threads.
- The intensity is shifted so zero frequency is in the center and divided by the aperture area squared, so the central peak is 1.
- Color: the pattern's size grows with wavelength, so each of 12 wavelengths from 420 to 680 nm samples the same intensity image at a scale of lambda / 550 nm and adds its RGB weight. The edges of every spike and ring fringe into color, and the grating splits white light into rainbow orders.
- Tone: log mapping (the pattern spans about five orders of magnitude), then a gamma curve. The inset shows the aperture.

## Render
Set `CARGO_TARGET_DIR` to a folder outside the repo first.
```
RUSTFLAGS="-C target-cpu=native" cargo build --release
THREADS=12 diffraction frames --frames 240
ffmpeg -framerate 30 -i frames/f_%04d.ppm -c:v libx264 -crf 20 -preset slow -pix_fmt yuv420p -movflags +faststart -threads 8 rust-fourier-diffraction.mp4
```
Options: `--frames`, `--every`. The full render takes about 13 s on a Ryzen 9 9950X with 12 threads.
