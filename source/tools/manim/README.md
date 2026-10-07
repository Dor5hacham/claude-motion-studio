# Manim example: Fourier series to a square wave

Manim Community is a Python library for math animation (the 3Blue1Brown
style). You build a `Scene`, add mobjects (axes, graphs, text, shapes) and call
`self.play(...)` with animations such as `Create`, `ReplacementTransform`,
`GrowFromEdge` and `LaggedStart`. Manim renders with Cairo and writes an MP4.

Scene `FourierSquare`: axes, a sine wave, then partial sums of the square-wave
Fourier series (1, 2, 3, 5, 9, 24 odd harmonics) morph into each other while a
bar chart of harmonic amplitudes (1/k) grows below. About 7.8 s at 720p30.

Text uses `Text` (Pango), not `MathTex`, so no LaTeX install is needed. The
axes have no number labels for the same reason (they use LaTeX).

## Install and render (uv, Python 3.12 has manim wheels)

    uv run --python 3.12 --with manim manim -qm fourier.py FourierSquare

`-qm` gives 1280x720 at 30 fps. Output:
`media/videos/fourier/720p30/FourierSquare.mp4`. Then:

    ffmpeg -i media/videos/fourier/720p30/FourierSquare.mp4 -an -c:v libx264 -crf 22 -preset slow -pix_fmt yuv420p -movflags +faststart manim.mp4

Add `-p` to open the result, or `-s` to save only the last frame as a PNG.
