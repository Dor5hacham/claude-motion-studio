# Taichi example: water, jelly and snow (MPM)

Taichi is a Python package that compiles decorated functions (`@ti.kernel`) to
GPU code. On the reference machine (Ryzen 9 9950X, Radeon RX 9070 XT) it
runs on the Radeon through the Vulkan backend
(`ti.init(arch=ti.vulkan)`); the same script also runs on CUDA, Metal or the CPU.

`mpm.py` is a 2D MLS-MPM (moving least squares material point method) solver.
Particles carry mass, velocity, an affine velocity matrix and a deformation
gradient. Every substep they scatter to a 320x230 grid, the grid applies
gravity and the walls, and the particles gather the new velocity back. Water,
jelly and snow share the solver and differ only in their stress:

- water: no shear stiffness, the deformation is reset to a pure volume change
- jelly: elastic, so it keeps its shape and wobbles (its checker is painted in rest space, so the squares show the strain)
- snow: elastic with clamped stretch, so it hardens when packed and cracks when pulled

Rendering is also a Taichi kernel: each particle is splatted as a small
Gaussian into one density buffer per material, the buffers are blurred, and
each one is shaded as a surface (threshold, normal from the density gradient,
diffuse, specular and rim). Pillow adds the labels; frames are piped to FFmpeg.

## Install and render (uv, Python 3.12 has Taichi wheels)

    uv run --python 3.12 --with taichi --with numpy --with pillow python mpm.py

About 30 s on the RX 9070 XT for 270 frames (61,591 particles, 64 substeps per
frame). Output: `../../../media/tools/taichi-mpm.mp4`. To check single frames
first: `python mpm.py --test 30,150,265` writes PNGs to `_work/clips/`.
