# Built from scratch: native renderers

Native programs that render a clip with no engine, no graphics API and no crates or modules beyond the language's standard library. Build folders stay outside the repo (`CARGO_TARGET_DIR` for Rust, Go's own build cache through `go run` for Go).

| Folder | Language | What it is | Clip |
|---|---|---|---|
| `pathtracer/` | Rust (std only) | Spectral path tracer: SAH BVH, GGX metals, dispersive glass, depth of field, motion blur, a-trous denoiser | `media/tools/rust-pathtracer.mp4` |
| `flip/` | Go (std only) | 2D FLIP liquid solver in a turning hourglass (rotating frame, two-tone liquid), rendered as shaded liquid | `media/tools/go-flip-hourglass.mp4` |
| `windtunnel/` | Rust (std only) | D2Q9 lattice Boltzmann wind tunnel: a NACA 2412 wing pitches up and stalls, smoke streaklines over vorticity | `media/tools/rust-lbm-windtunnel.mp4` |
| `light2d/` | Rust (std only) | 2D spectral light tracer: Newton's prism and lens, every ray drawn as a line | `media/tools/rust-light2d-prism.mp4` |
| `diffraction/` | Rust (std only) | Fraunhofer diffraction of a morphing aperture with a hand-written FFT, 12 wavelengths | `media/tools/rust-fourier-diffraction.mp4` |
| `fontraster/` | Rust (std only) | TrueType parser and coverage rasterizer: a glyph's points, curves, scanline fill and pixels | `media/tools/rust-font-rasterizer.mp4` |
| `spectrogram/` | Rust (std only) | A word hidden in sound: additive synthesis, WAV writer and FFT spectrogram, clip with audio | `media/tools/rust-spectrogram-word.mp4` |

Each folder has a README with the exact build and render commands. Each program writes PPM frames; FFmpeg encodes them.
