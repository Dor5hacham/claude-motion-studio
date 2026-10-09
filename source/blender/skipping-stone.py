# Copyright (c) 2026 Dor5hacham d5shacham@gmail.com. All rights reserved.
# SPDX-License-Identifier: Proprietary

# Builds a skipping-stone shot at dusk in Eevee. A flat stone skims across a still pond, touching
# the water seven times with shorter and shorter hops before it sinks. The ripples come from a
# height-field wave equation solved in NumPy: every touch sends out a short train of rings that
# cross and interfere, and a frame handler writes the heights into the pond mesh. Droplets at every touch are scripted ballistic arcs. The sky, sun glow and tree line
# are one world shader, so the water reflects them and the rings show up as distortions in that
# reflection. A low sun lamp rim-lights the stone and droplets.
# Usage: blender -b -P skipping-stone.py -- <out_dir> [test_frame[,test_frame...]]
import bpy, bmesh, sys, math, random, time
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:]
OUT = argv[0]
TESTS = [int(x) for x in argv[1].split(",")] if len(argv) > 1 else []
FPS, FRAMES = 30, 240
random.seed(3)

bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
sc.render.fps = FPS
sc.frame_start, sc.frame_end = 1, FRAMES
sc.render.resolution_x, sc.render.resolution_y = 1280, 720
engines = [e.identifier for e in sc.render.bl_rna.properties["engine"].enum_items]
sc.render.engine = "BLENDER_EEVEE" if "BLENDER_EEVEE" in engines else "BLENDER_EEVEE_NEXT"
ee = sc.eevee
ee.taa_render_samples = 32
for attr, val in [("use_raytracing", True), ("use_shadows", True), ("use_gtao", True)]:
    if hasattr(ee, attr):
        setattr(ee, attr, val)
if hasattr(sc.render, "use_motion_blur"):
    sc.render.use_motion_blur = True
    sc.render.motion_blur_shutter = 0.5
vts = [i.identifier for i in sc.view_settings.bl_rna.properties["view_transform"].enum_items]
sc.view_settings.view_transform = "AgX" if "AgX" in vts else "Standard"
looks = [i.identifier for i in sc.view_settings.bl_rna.properties["look"].enum_items]
if "AgX - Punchy" in looks:
    sc.view_settings.look = "AgX - Punchy"
sc.view_settings.exposure = -0.8
sc.render.image_settings.file_format = "PNG"
sc.render.filepath = OUT + "/f_"

# ---- World: dusk gradient, sun glow just under the horizon, tree-line silhouette ----
SUN_DIR = Vector((0.28, 1.0, 0.05)).normalized()
world = bpy.data.worlds.new("World")
sc.world = world
world.use_nodes = True
if hasattr(world, "probe_resolution"):
    world.probe_resolution = "2048"
wn = world.node_tree
W = wn.nodes.new
L = wn.links.new
def sock(node, ident, out=False):
    """Mix node sockets share names across data types; pick the RGBA one by identifier."""
    return next(s for s in (node.outputs if out else node.inputs) if s.identifier == ident)
tco = W("ShaderNodeTexCoord")
nrm = W("ShaderNodeVectorMath"); nrm.operation = "NORMALIZE"
L(tco.outputs["Generated"], nrm.inputs[0])
sep = W("ShaderNodeSeparateXYZ"); L(nrm.outputs[0], sep.inputs[0])
sky = W("ShaderNodeValToRGB")
cr = sky.color_ramp
cr.interpolation = "B_SPLINE"
stops = [(0.0, (0.9, 0.3, 0.07)), (0.05, (0.62, 0.12, 0.08)), (0.14, (0.2, 0.055, 0.2)),
         (0.3, (0.04, 0.028, 0.11)), (0.7, (0.006, 0.008, 0.028))]
cr.elements[0].position, cr.elements[0].color = stops[0][0], stops[0][1] + (1,)
cr.elements[1].position, cr.elements[1].color = stops[-1][0], stops[-1][1] + (1,)
for pos, col in stops[1:-1]:
    e = cr.elements.new(pos); e.color = col + (1,)
L(sep.outputs["Z"], sky.inputs["Fac"])
# Sun glow: dot(view, sun) raised to a high power, added in warm amber
dot = W("ShaderNodeVectorMath"); dot.operation = "DOT_PRODUCT"
dot.inputs[1].default_value = SUN_DIR
L(nrm.outputs[0], dot.inputs[0])
glow_hi = W("ShaderNodeMath"); glow_hi.operation = "POWER"; glow_hi.inputs[1].default_value = 3000.0
glow_lo = W("ShaderNodeMath"); glow_lo.operation = "POWER"; glow_lo.inputs[1].default_value = 24.0
cl = W("ShaderNodeClamp"); L(dot.outputs["Value"], cl.inputs[0])
L(cl.outputs[0], glow_hi.inputs[0]); L(cl.outputs[0], glow_lo.inputs[0])
gsum = W("ShaderNodeMath"); gsum.operation = "MULTIPLY_ADD"; gsum.inputs[1].default_value = 12.0
L(glow_hi.outputs[0], gsum.inputs[0]); L(glow_lo.outputs[0], gsum.inputs[2])
gcol = W("ShaderNodeMix"); gcol.data_type = "RGBA"; gcol.blend_type = "ADD"
L(gsum.outputs[0], sock(gcol, "Factor_Float"))
L(sky.outputs["Color"], sock(gcol, "A_Color")); sock(gcol, "B_Color").default_value = (1.0, 0.55, 0.22, 1)
# Tree line: height from 1D noise over the azimuth; below it the sky turns to a dark silhouette
az = W("ShaderNodeMath"); az.operation = "ARCTAN2"
L(sep.outputs["X"], az.inputs[0]); L(sep.outputs["Y"], az.inputs[1])
n1 = W("ShaderNodeTexNoise"); n1.noise_dimensions = "1D"
n1.inputs["Scale"].default_value = 3.0; n1.inputs["Detail"].default_value = 8.0
n1.inputs["Roughness"].default_value = 0.62
L(az.outputs[0], n1.inputs["W"])
hgt = W("ShaderNodeMapRange")
hgt.inputs["From Min"].default_value = 0.3; hgt.inputs["From Max"].default_value = 0.75
hgt.inputs["To Min"].default_value = 0.006; hgt.inputs["To Max"].default_value = 0.05
L(n1.outputs["Fac"], hgt.inputs["Value"])
dz = W("ShaderNodeMath"); dz.operation = "SUBTRACT"
L(hgt.outputs["Result"], dz.inputs[0]); L(sep.outputs["Z"], dz.inputs[1])
mask = W("ShaderNodeMapRange"); mask.interpolation_type = "SMOOTHSTEP"
mask.inputs["From Min"].default_value = -0.0015; mask.inputs["From Max"].default_value = 0.0015
L(dz.outputs[0], mask.inputs["Value"])
trees = W("ShaderNodeMix"); trees.data_type = "RGBA"
L(mask.outputs["Result"], sock(trees, "Factor_Float"))
L(sock(gcol, "Result_Color", True), sock(trees, "A_Color"))
sock(trees, "B_Color").default_value = (0.006, 0.005, 0.012, 1)
L(sock(trees, "Result_Color", True), wn.nodes["Background"].inputs["Color"])

# ---- Water: the simulated canvas near the camera plus a static plane out to the horizon ----
water = bpy.data.materials.new("Water")
water.use_nodes = True
wp = water.node_tree.nodes["Principled BSDF"]
wp.inputs["Base Color"].default_value = (0.004, 0.006, 0.01, 1)
wp.inputs["Roughness"].default_value = 0.015
wp.inputs["IOR"].default_value = 1.33

CX, CY, CS, RES = 0.0, 3.0, 22.0, 400          # canvas centre, size and grid resolution
bpy.ops.mesh.primitive_grid_add(x_subdivisions=RES, y_subdivisions=RES, size=CS, location=(CX, CY, 0))
canvas = bpy.context.object
canvas.name = "Pond"
canvas.data.materials.append(water)
bpy.ops.object.shade_smooth()
# Far water: a big plane with a square hole where the canvas sits
fbm = bmesh.new()
R, h = 400.0, CS / 2
outer = [(-R, -R), (R, -R), (R, R), (-R, R)]
inner = [(CX - h, CY - h), (CX + h, CY - h), (CX + h, CY + h), (CX - h, CY + h)]
ov = [fbm.verts.new((x, y, 0)) for x, y in outer]
iv = [fbm.verts.new((x, y, 0)) for x, y in inner]
for k in range(4):
    fbm.faces.new([ov[k], ov[(k + 1) % 4], iv[(k + 1) % 4], iv[k]])
far_me = bpy.data.meshes.new("FarWater"); fbm.to_mesh(far_me); fbm.free()
far = bpy.data.objects.new("FarWater", far_me); sc.collection.objects.link(far)
far_me.materials.append(water)

# ---- Stone: flattened, slightly irregular pebble ----
bpy.ops.mesh.primitive_uv_sphere_add(segments=32, ring_count=16, radius=1.0)
stone = bpy.context.object
stone.name = "Stone"
for v in stone.data.vertices:
    c = v.co
    k = 1.0 + 0.06 * math.sin(3 * math.atan2(c.y, c.x) + 0.7) + 0.04 * math.sin(5 * math.atan2(c.y, c.x))
    v.co = Vector((c.x * 0.17 * k, c.y * 0.13 * k, c.z * 0.045))
bpy.ops.object.shade_smooth()
smat = bpy.data.materials.new("Stone"); smat.use_nodes = True
sp = smat.node_tree.nodes["Principled BSDF"]
sp.inputs["Base Color"].default_value = (0.05, 0.045, 0.042, 1)
sp.inputs["Roughness"].default_value = 0.35
stone.data.materials.append(smat)

# ---- Stone path: hops shrink by a constant ratio, each touch dips just under the surface ----
A = Vector((-4.6, -3.2, 0)); DIR = Vector((0.62, 1.0, 0)).normalized()
TOUCH_F = [34, 52, 67, 79, 89, 97, 103]
HOP0 = 2.5
touch_pts, d = [], 0.0
for k in range(len(TOUCH_F)):
    touch_pts.append(A + DIR * d)
    d += HOP0 * (0.72 ** k)
SINK_F, SINK_PT = 113, A + DIR * (d - HOP0 * 0.72 ** (len(TOUCH_F) - 1) * 0.45)
DIP = -0.035
CONTACT = 2.5            # frames the stone skims in contact at each touch

def stone_at(f):
    """Stone position on frame f: entry glide, parabolic hops between touches, then a slow sink."""
    if f <= TOUCH_F[0]:
        t = (TOUCH_F[0] - f) / 6.0
        return touch_pts[0] - DIR * HOP0 * 0.35 * t + Vector((0, 0, DIP + 0.12 * t))
    for k in range(len(TOUCH_F) - 1):
        f0, f1 = TOUCH_F[k], TOUCH_F[k + 1]
        if f <= f1:
            u = (f - f0) / (f1 - f0)
            p = touch_pts[k].lerp(touch_pts[k + 1], u)
            hop = (touch_pts[k + 1] - touch_pts[k]).length
            # skim for CONTACT frames, then a parabolic hop to the next touch
            c = CONTACT / (f1 - f0)
            v = max(0.0, (u - c) / (1 - c))
            return p + Vector((0, 0, DIP + 4 * v * (1 - v) * hop * 0.2))
    u = min((f - TOUCH_F[-1]) / (SINK_F - TOUCH_F[-1]), 1.0)
    p = touch_pts[-1].lerp(SINK_PT, 1 - (1 - u) ** 2)
    return p + Vector((0, 0, DIP - 0.5 * max(0.0, f - SINK_F) / 10.0))

for f in range(1, min(SINK_F + 12, FRAMES) + 1):
    stone.location = stone_at(f)
    stone.rotation_euler = (math.radians(4), math.radians(-6), math.radians(-41 * f))
    stone.keyframe_insert("location", frame=f)
    stone.keyframe_insert("rotation_euler", frame=f)
stone.hide_render = False
stone.keyframe_insert("hide_render", frame=SINK_F + 12)
stone.hide_render = True
stone.keyframe_insert("hide_render", frame=SINK_F + 13)

# ---- Droplets: small bright beads thrown up and forward at every touch ----
dmat = bpy.data.materials.new("Drop"); dmat.use_nodes = True
dp = dmat.node_tree.nodes["Principled BSDF"]
dp.inputs["Base Color"].default_value = (0.9, 0.92, 1.0, 1)
dp.inputs["Metallic"].default_value = 1.0
dp.inputs["Roughness"].default_value = 0.08
dp.inputs["Emission Color"].default_value = (1.0, 0.72, 0.5, 1)
dp.inputs["Emission Strength"].default_value = 1.5
drop_me = bpy.data.meshes.new("Drop")
dbm = bmesh.new(); bmesh.ops.create_icosphere(dbm, subdivisions=2, radius=1.0); dbm.to_mesh(drop_me); dbm.free()
for poly in drop_me.polygons:
    poly.use_smooth = True
drop_me.materials.append(dmat)
G = 9.81 / FPS / FPS
for k, (tf, tp) in enumerate(zip(TOUCH_F + [SINK_F], touch_pts + [SINK_PT])):
    strength = 0.85 ** k
    for j in range(int(26 * strength) + 6):
        ob = bpy.data.objects.new(f"Drop_{k}_{j}", drop_me); sc.collection.objects.link(ob)
        r = random.uniform(0.008, 0.022)
        side = Vector((-DIR.y, DIR.x, 0)) * random.gauss(0, 0.6)
        v = (DIR * random.uniform(0.2, 1.1) + side) * 0.07 * strength + Vector((0, 0, random.uniform(0.04, 0.11) * strength))
        p = tp + DIR * random.uniform(-0.1, 0.15) + Vector((0, 0, 0.01))
        ob.scale = (0, 0, 0)
        ob.keyframe_insert("scale", frame=tf - 1)
        f, pos = tf, p.copy()
        while pos.z > -0.02 and f < FRAMES:
            ob.location = pos
            ob.keyframe_insert("location", frame=f)
            if f == tf:
                ob.scale = (r, r, r * 1.3)
                ob.keyframe_insert("scale", frame=f)
            pos = pos + v
            v = v + Vector((0, 0, -G))
            f += 1
        ob.scale = (0, 0, 0)
        ob.keyframe_insert("scale", frame=f)

# ---- Sun lamp: low and warm, from the glow direction; rim light for the stone and droplets ----
sd = bpy.data.lights.new("Sun", "SUN"); sd.energy = 2.5; sd.color = (1.0, 0.6, 0.32); sd.angle = math.radians(1.5)
sd.specular_factor = 0.0    # on mirror-flat water its highlight is a hard bar; the sky reflection does the glints
sun = bpy.data.objects.new("Sun", sd); sc.collection.objects.link(sun)
sun.rotation_euler = SUN_DIR.to_track_quat("Z", "Y").to_euler()

# ---- Camera: low over the water, slow drift that follows the stone and then the rings ----
cam_d = bpy.data.cameras.new("Cam"); cam_d.lens = 38
cam_d.dof.use_dof = True; cam_d.dof.aperture_fstop = 8.0
cam = bpy.data.objects.new("Cam", cam_d); sc.collection.objects.link(cam)
sc.camera = cam
tgt = bpy.data.objects.new("Target", None); sc.collection.objects.link(tgt)
cam_d.dof.focus_object = tgt
tc = cam.constraints.new("TRACK_TO"); tc.target = tgt
tc.track_axis = "TRACK_NEGATIVE_Z"; tc.up_axis = "UP_Y"
mid = touch_pts[3]
for f, cl_, tl in [(1, (-3.4, -9.6, 1.05), touch_pts[0] + Vector((0.6, 1.2, 0.0))),
                   (110, (-2.6, -8.9, 0.95), mid + Vector((0.4, 0.6, 0.0))),
                   (FRAMES, (-1.9, -8.2, 0.9), mid + Vector((0.8, 1.0, 0.0)))]:
    cam.location = cl_; cam.keyframe_insert("location", frame=f)
    tgt.location = tl; tgt.keyframe_insert("location", frame=f)

# ---- Ripples: a height-field wave equation solved with NumPy, applied to the pond every frame ----
# Each touch is an oscillating source (about one and a half cycles at 3 Hz) that follows the stone
# while it skims, so it sends out a short train of rings. A sponge band at the border absorbs the
# rings instead of reflecting them. The system is linear, so the result is rescaled at the end to
# a fixed ring height. A frame-change handler writes the heights into the mesh, interpolating
# between frames for the motion-blur sub-steps.
import numpy as np
SUB, C_SPEED, F_SRC, SIGMA, RING_H = 3, 0.95, 3.0, 0.08, 0.018
me = canvas.data
nv = len(me.vertices)
co0 = np.empty(nv * 3, dtype=np.float32); me.vertices.foreach_get("co", co0)
co0 = co0.reshape(-1, 3)
xs, ys = np.unique(np.round(co0[:, 0], 5)), np.unique(np.round(co0[:, 1], 5))
dx = float(xs[1] - xs[0])
ix = np.rint((co0[:, 0] - xs[0]) / dx).astype(np.int64)
iy = np.rint((co0[:, 1] - ys[0]) / dx).astype(np.int64)
NX, NY = len(xs), len(ys)
gx = xs[None, :] + CX
gy = ys[:, None] + CY
edge = np.minimum(np.minimum(gx - gx.min(), gx.max() - gx), np.minimum(gy - gy.min(), gy.max() - gy))
keep = 1.0 - 0.12 * np.clip(1.0 - edge / 1.6, 0.0, 1.0) ** 2            # sponge near the border
dt = 1.0 / (FPS * SUB)
c2 = (C_SPEED * dt / dx) ** 2
sources = [(TOUCH_F[k], 0.82 ** k, F_SRC) for k in range(len(TOUCH_F))] + [(SINK_F, 1.3, 2.0)]
h = np.zeros((NY, NX), dtype=np.float32); h_old = h.copy()
heights = np.zeros((FRAMES + 2, NY, NX), dtype=np.float32)
W8 = int(4 * SIGMA / dx) + 1
t_sim = time.time()
for step in range(1, (FRAMES + 1) * SUB + 1):
    t = step / SUB                                        # time in frames
    lap = (np.roll(h, 1, 0) + np.roll(h, -1, 0) + np.roll(h, 1, 1) + np.roll(h, -1, 1) - 4 * h)
    h_new = (2 * h - h_old + c2 * lap) * keep
    for t0, amp, freq in sources:
        u = (t - t0) / FPS
        cycles = 1.5
        if 0 <= u <= cycles / freq:
            p = stone_at(min(t, t0 + CONTACT)) if t0 != SINK_F else SINK_PT
            cx, cy = int(round((p.x - CX - xs[0]) / dx)), int(round((p.y - CY - ys[0]) / dx))
            y0, y1, x0, x1 = max(cy - W8, 0), min(cy + W8 + 1, NY), max(cx - W8, 0), min(cx + W8 + 1, NX)
            g = np.exp(-(((gx[0, x0:x1][None, :] - p.x) ** 2 + (gy[y0:y1, 0][:, None] - p.y) ** 2) / SIGMA ** 2))
            env = np.sin(np.pi * u * freq / cycles)
            h_new[y0:y1, x0:x1] -= amp * env * np.sin(2 * np.pi * freq * u) * g * dt
    h_old, h = h, h_new
    if step % SUB == 0:
        heights[step // SUB] = h
# Rescale so the first ring is RING_H high half a second after the first touch
fr = TOUCH_F[0] + 15
r = np.hypot(gx - touch_pts[0].x, gy - touch_pts[0].y)
ring = float(np.abs(heights[fr][(r > 0.25) & (r < 2.0)]).max())
heights *= RING_H / max(ring, 1e-12)
print(f"Ripple solve {time.time() - t_sim:.1f}s, grid {NX}x{NY}, dx {dx:.4f}, scale {RING_H / max(ring, 1e-12):.3g}")

def apply_ripples(scene, depsgraph=None):
    """Writes the solved heights for the current (sub)frame into the pond mesh."""
    t = min(max(scene.frame_current + scene.frame_subframe, 0.0), FRAMES)
    f0 = int(t); a = t - f0
    hh = heights[f0] * (1 - a) + heights[min(f0 + 1, FRAMES + 1)] * a
    co = co0.copy()
    co[:, 2] = hh[iy, ix]
    me.vertices.foreach_set("co", co.ravel())
    me.update()
bpy.app.handlers.frame_change_pre.append(apply_ripples)
if TESTS:
    for f in TESTS:
        sc.frame_set(f)
        sc.render.filepath = OUT + f"/test_{f:04d}.png"
        bpy.ops.render.render(write_still=True)
else:
    bpy.ops.render.render(animation=True)
print("RENDER COMPLETE")
