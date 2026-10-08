# PyVista example: flow past a sphere

PyVista is a Python layer over VTK, the toolkit behind ParaView and most
scientific 3D viewers. It meshes, filters and renders data such as grids,
point clouds and vector fields, and can render offscreen frame by frame.

`streamlines.py` builds a velocity field on a 150x76x76 grid: ideal (potential)
flow past a sphere, plus a swirl around the flow axis that fades with distance.
Both parts are tangent to the sphere, so no flow passes through it.
`streamlines_from_source` integrates 120 streamlines from a golden-angle spiral
of seeds upstream (VTK stream tracer, Runge-Kutta). Each frame clips every line
at a growing integration time (`clip_scalar`), turns it into tubes (`tube`) and
colors them by speed (2nd to 98th percentile across the ramp): cyan for the free
stream, amber and coral where the flow speeds up around the sphere's equator,
navy near the stagnation point in front. The camera orbits; Pillow adds the
labels; frames are piped to FFmpeg.

## Install and render (uv, Python 3.12 has VTK wheels)

    uv run --python 3.12 --with pyvista --with pillow python streamlines.py

Output: `../../../media/tools/pyvista.mp4` (8 s, 1280x720). It renders with
OpenGL in a hidden window (`off_screen=True`). Check single frames first with
`python streamlines.py --test 60,150,239` (PNGs in `_work/clips/`).
Note: in PyVista 0.49 `streamlines_from_source` takes `max_length`; `max_time` was removed.
