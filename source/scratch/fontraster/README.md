# How a font becomes pixels: a TrueType rasterizer in Rust, from scratch

A font parser and rasterizer in one Rust file with no crates. It reads the Georgia ampersand from `georgia.ttf` and animates the steps of drawing it: points, curves, a scanline fill, then anti-aliased pixels at text size. The labels are drawn by the same code from `bahnschrift.ttf`. Clip: `media/tools/rust-font-rasterizer.mp4` (8 s, 1280x720, 30 fps).

## How it works
- Parsing: the table directory, `head` (units per em, loca format), `hhea` and `hmtx` (advance widths), `cmap` format 4 (character to glyph index), `loca` and `glyf`. Simple glyphs decode their contour end points, run-length flags and delta-coded x and y coordinates; composite glyphs are followed with their offsets.
- Outlines: TrueType contours are quadratic Bezier curves. Two off-curve points in a row imply an on-curve point halfway between them; the code rebuilds those before drawing.
- Steps on screen: points pop in along each contour with an overshoot ease (cream dots on the curve, coral squares for control points), the control polygon appears, the curves trim on, a scanline sweeps down and marks every crossing with the outline, and the spans between crossings with a nonzero winding count light up as the fill appears above it.
- Coverage: the fill uses a signed-area accumulation rasterizer. Each edge adds the exact area it sweeps through each pixel of a row, and a running sum along the row turns that into coverage between 0 and 1. That gives the soft gray edge pixels in the magnified 34x34 grid, which is the same glyph at about 30 px.

## Render
Set `CARGO_TARGET_DIR` to a folder outside the repo first. The fonts come from `C:/Windows/Fonts`; pass `--font` and `--labels` to use other TrueType files.
```
RUSTFLAGS="-C target-cpu=native" cargo build --release
fontraster frames --frames 240
ffmpeg -framerate 30 -i frames/f_%04d.ppm -c:v libx264 -crf 20 -preset slow -pix_fmt yuv420p -movflags +faststart -threads 8 rust-font-rasterizer.mp4
```
The full render takes about 4 s.
