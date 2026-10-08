# Matplotlib example: three optimizers, one valley

Matplotlib is the standard Python plotting library, and its animation module
turns any figure into video: `FuncAnimation` calls an `update(frame)` function
that changes the artists (line data, markers, text, the 3D camera), and
`FFMpegWriter` pipes each drawn frame to FFmpeg.

`optimizers.py` races three optimizers down the Rosenbrock function
`(1 - x)^2 + 100 (y - x^2)^2` from the same start point. Gradient descent (SGD)
zigzags across the steep walls and then crawls along the curved valley,
momentum builds speed along it, and Adam scales each direction by its own
gradient history and reaches the minimum first. Three views of the same run:

- a 3D surface of `log10(1 + loss)` with the trails, the camera orbiting (`view_init`)
- the paths on a filled contour map
- loss per step on a log axis

720 optimizer steps (3 per frame), 8 s at 30 fps.

## Render

    uv run --with numpy --with matplotlib python optimizers.py

About a minute (the 3D surface is redrawn every frame). Output:
`../../../media/tools/matplotlib.mp4`. Bahnschrift has no Unicode minus sign,
so the script sets `axes.unicode_minus` to False and writes the log-axis ticks
as `1e-4` instead of mathtext powers.
