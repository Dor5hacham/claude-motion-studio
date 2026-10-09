# Copyright (c) 2026 Dor5hacham d5shacham@gmail.com. All rights reserved.
# SPDX-License-Identifier: Proprietary

# Builds a domino chain reaction in Eevee: a few hundred lacquered dominoes stand on an inward
# spiral, coloured coral to amber to cream to cyan to violet along the chain. The first one is
# tipped by a kinematic nudge and Bullet rigid bodies carry the wave to the centre. The camera
# starts low behind the first domino, rises into a slow high orbit whose aim drifts toward the wave
# front (read from the baked cache on every frame), and cranes up into a top-down reveal.
# Usage: blender -b -P domino.py -- <out_dir> [test_frame[,test_frame...] | bake]
#   bake: simulate only and print the wave front every 10 frames (for tuning TIME_SCALE)
import bpy, bmesh, sys, math, time
from mathutils import Vector, Matrix

argv = sys.argv[sys.argv.index("--") + 1:]
OUT = argv[0]
ARG = argv[1] if len(argv) > 1 else ""
BAKE_ONLY = ARG == "bake"
TESTS = [int(x) for x in ARG.split(",")] if ARG and not BAKE_ONLY else []
FPS, FRAMES = 30, 300
H, W, T = 1.0, 0.5, 0.16       # domino height, width, thickness
STEP = 0.52                    # spacing along the path (centre to centre)
R_OUT, R_IN, PITCH = 8.2, 2.4, 1.55   # spiral outer and inner radius, gap between arms
TIME_SCALE = 3.3               # rigid body speed-up so the wave crosses the spiral in about 8 s
NUDGE = 4                      # frame the first domino starts to tip
REVEAL = (205, 258)            # frames over which the camera cranes up to the top view

bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
sc.render.fps = FPS
sc.frame_start, sc.frame_end = 1, FRAMES
sc.render.resolution_x, sc.render.resolution_y = 1280, 720
engines = [e.identifier for e in sc.render.bl_rna.properties["engine"].enum_items]
sc.render.engine = "BLENDER_EEVEE" if "BLENDER_EEVEE" in engines else "BLENDER_EEVEE_NEXT"
ee = sc.eevee
ee.taa_render_samples = 64
for attr, val in [("use_raytracing", True), ("use_shadows", True), ("use_gtao", True)]:
    if hasattr(ee, attr):
        setattr(ee, attr, val)
if hasattr(sc.render, "use_motion_blur"):
    sc.render.use_motion_blur = True
    sc.render.motion_blur_shutter = 0.3
vts = [i.identifier for i in sc.view_settings.bl_rna.properties["view_transform"].enum_items]
sc.view_settings.view_transform = "AgX" if "AgX" in vts else "Standard"
sc.render.image_settings.file_format = "PNG"
sc.render.filepath = OUT + "/f_"

world = bpy.data.worlds.new("World")
sc.world = world
world.use_nodes = True
world.node_tree.nodes["Background"].inputs[0].default_value = (0.012, 0.014, 0.03, 1)

# ---- Spiral path: points at equal arc length, from the outer end inward ----
b = PITCH / (2 * math.pi)
pts, tans = [], []
th = 0.0
while True:
    r = R_OUT - b * th
    if r < R_IN:
        break
    p = Vector((r * math.cos(th), r * math.sin(th), 0))
    tng = Vector((-b * math.cos(th) - r * math.sin(th), -b * math.sin(th) + r * math.cos(th), 0)).normalized()
    pts.append(p); tans.append(tng)
    th += STEP / math.sqrt(r * r + b * b)
N = len(pts)
print("dominoes:", N)

# ---- Materials: one lacquer shared by all, colour from each object's colour ----
mat = bpy.data.materials.new("Lacquer")
mat.use_nodes = True
nt = mat.node_tree
pb = nt.nodes["Principled BSDF"]
pb.inputs["Roughness"].default_value = 0.28
if "Coat Weight" in pb.inputs:
    pb.inputs["Coat Weight"].default_value = 1.0
    pb.inputs["Coat Roughness"].default_value = 0.05
oi = nt.nodes.new("ShaderNodeObjectInfo")
nt.links.new(oi.outputs["Color"], pb.inputs["Base Color"])

floor_mat = bpy.data.materials.new("Floor")
floor_mat.use_nodes = True
fp = floor_mat.node_tree.nodes["Principled BSDF"]
fp.inputs["Base Color"].default_value = (0.022, 0.022, 0.028, 1)
fp.inputs["Roughness"].default_value = 0.32

PALETTE = [(1.0, 0.10, 0.035), (1.0, 0.42, 0.02), (0.95, 0.82, 0.62), (0.05, 0.62, 0.85), (0.32, 0.16, 0.95)]
def palette(t):
    t = min(max(t, 0.0), 1.0) * (len(PALETTE) - 1)
    i = min(int(t), len(PALETTE) - 2)
    f = t - i
    a, c = PALETTE[i], PALETTE[i + 1]
    return tuple(a[k] + (c[k] - a[k]) * f for k in range(3)) + (1.0,)

# ---- Dominoes: one shared mesh, beveled for rendering; physics uses the plain box ----
bm = bmesh.new()
bmesh.ops.create_cube(bm, size=1.0)
for v in bm.verts:
    v.co = Vector((v.co.x * T, v.co.y * W, v.co.z * H))
dmesh = bpy.data.meshes.new("Domino")
bm.to_mesh(dmesh); bm.free()
dmesh.materials.append(mat)
dominoes = []
for i, (p, tng) in enumerate(zip(pts, tans)):
    ob = bpy.data.objects.new(f"D_{i:03d}", dmesh)
    sc.collection.objects.link(ob)
    ob.location = p + Vector((0, 0, H / 2))
    ob.rotation_euler = (0, 0, math.atan2(tng.y, tng.x))
    ob.color = palette(i / (N - 1))
    bv = ob.modifiers.new("Bevel", "BEVEL"); bv.width = 0.025; bv.segments = 2
    bv.harden_normals = True
    dominoes.append(ob)
for poly in dmesh.polygons:
    poly.use_smooth = True

# ---- Floor ----
bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, -0.25))
floor = bpy.context.object
floor.scale = (80, 80, 0.5)
floor.data.materials.append(floor_mat)

# ---- Rigid bodies ----
bpy.ops.rigidbody.world_add()
rbw = sc.rigidbody_world
rbw.time_scale = TIME_SCALE
rbw.substeps_per_frame = 30
rbw.solver_iterations = 20
rbw.point_cache.frame_start = 1
rbw.point_cache.frame_end = FRAMES

def add_rb(ob, kind="ACTIVE"):
    bpy.ops.object.select_all(action="DESELECT")
    ob.select_set(True)
    bpy.context.view_layer.objects.active = ob
    bpy.ops.rigidbody.object_add(type=kind)
    return ob.rigid_body

fr = add_rb(floor, "PASSIVE")
fr.collision_shape = "BOX"; fr.friction = 0.7; fr.restitution = 0.05
for i, ob in enumerate(dominoes):
    rb = add_rb(ob)
    rb.collision_shape = "BOX"
    rb.use_margin = True; rb.collision_margin = 0.004
    rb.mass = 1.0; rb.friction = 0.35; rb.restitution = 0.05
    rb.linear_damping = 0.04; rb.angular_damping = 0.1
    rb.use_deactivation = True
    rb.use_start_deactivated = i > 0

# The nudge: domino 0 is kinematic and tips forward about its bottom front edge, then is released
d0 = dominoes[0]
rot0 = d0.rotation_euler.copy()
pivot = pts[0] + tans[0] * (T / 2)
TIP = 14
for k in range(TIP + 1):
    a = math.radians(14.0) * (k / TIP) ** 2
    m = Matrix.Translation(pivot) @ Matrix.Rotation(a, 4, Vector((-tans[0].y, tans[0].x, 0))) \
        @ Matrix.Translation(-pivot)
    d0.matrix_world = m @ (Matrix.Translation(pts[0] + Vector((0, 0, H / 2))) @ rot0.to_matrix().to_4x4())
    d0.keyframe_insert("location", frame=NUDGE + k)
    d0.keyframe_insert("rotation_euler", frame=NUDGE + k)
d0.rigid_body.kinematic = True
d0.keyframe_insert("rigid_body.kinematic", frame=1)
d0.keyframe_insert("rigid_body.kinematic", frame=NUDGE + TIP)
d0.rigid_body.kinematic = False
d0.keyframe_insert("rigid_body.kinematic", frame=NUDGE + TIP + 1)

# ---- Bake ----
t0 = time.time()
bpy.ops.ptcache.bake_all(bake=True)
print(f"Bake done in {time.time() - t0:.1f}s")

# ---- Read the wave front from the bake: highest index tilted past 25 degrees ----
front = []
cos_t = math.cos(math.radians(25))
last = 0
for f in range(1, FRAMES + 1):
    sc.frame_set(f)
    j = last
    while j < N and (dominoes[j].matrix_world.to_3x3() @ Vector((0, 0, 1))).z < cos_t:
        j += 1
    # scan a little further in case one domino stalls without blocking the wave
    k = j
    for m in range(j, min(N, j + 4)):
        if (dominoes[m].matrix_world.to_3x3() @ Vector((0, 0, 1))).z < cos_t:
            k = m + 1
    last = max(last, k - 1 if k > 0 else 0)
    front.append(float(k))
    if BAKE_ONLY and f % 10 == 0:
        print(f"frame {f}: front {k}/{N}")
if BAKE_ONLY:
    standing = sum(1 for d in dominoes if (d.matrix_world.to_3x3() @ Vector((0, 0, 1))).z > cos_t)
    print("standing at end:", standing)
    sys.exit(0)

def smooth(vals, a):
    """Zero-lag exponential smoothing: forward pass, then backward pass."""
    out = vals[:]
    for i in range(1, len(out)):
        out[i] = out[i - 1] + a * (out[i] - out[i - 1])
    for i in range(len(out) - 2, -1, -1):
        out[i] = out[i + 1] + a * (out[i] - out[i + 1])
    return out

def along(s):
    """Point and tangent on the domino path at fractional index s (extended straight past the ends)."""
    if s < 0:
        return pts[0] + tans[0] * (s * STEP), tans[0]
    s = min(s, N - 1.001)
    i = int(s); f = s - i
    return pts[i].lerp(pts[i + 1], f), tans[i].lerp(tans[i + 1], f).normalized()

fs = smooth(front, 0.06)
print("wave front every 30 frames:", [round(fs[i]) for i in range(0, FRAMES, 30)])
# Opening: low behind the first domino, easing back and up while the first ones fall.
# Middle: a slow high three-quarter orbit around the spiral, aimed between the centre and the wave front.
p0, t0v = pts[0], tans[0]
out0 = Vector((p0.x, p0.y, 0)).normalized()
LOW_C = p0 - t0v * 3.4 + out0 * 0.9 + Vector((0, 0, 1.75))
LOW_T = p0 + t0v * 1.6 + Vector((0, 0, 0.3))
A0 = math.atan2(LOW_C.y, LOW_C.x)
cam_pos, cam_tgt = [], []
for f in range(FRAMES):
    k = min(max((f - 18) / 70.0, 0.0), 1.0)
    k = k * k * (3 - 2 * k)
    drift = min(f / 40.0, 1.0)
    low_c = LOW_C - t0v * 1.2 * drift + Vector((0, 0, 0.5 * drift))
    a = A0 + math.radians(70) * f / FRAMES
    high_c = Vector((13.5 * math.cos(a), 13.5 * math.sin(a), 9.5))
    fp, _ = along(fs[f])
    high_t = fp * 0.3
    cam_pos.append(low_c.lerp(high_c, k))
    cam_tgt.append(LOW_T.lerp(high_t, k))
cam_tgt = list(zip(*[smooth([v[i] for v in cam_tgt], 0.05) for i in range(3)]))
TOP_POS, TOP_TGT = Vector((0.0, -7.0, 29.0)), Vector((0.0, 0.3, 0.0))
cam_d = bpy.data.cameras.new("Cam"); cam_d.lens = 32
cam_d.dof.use_dof = True; cam_d.dof.aperture_fstop = 2.8
cam = bpy.data.objects.new("Cam", cam_d); sc.collection.objects.link(cam)
sc.camera = cam
tgt = bpy.data.objects.new("Target", None); sc.collection.objects.link(tgt)
cam_d.dof.focus_object = tgt
tc = cam.constraints.new("TRACK_TO"); tc.target = tgt
tc.track_axis = "TRACK_NEGATIVE_Z"; tc.up_axis = "UP_Y"
for f in range(FRAMES):
    u = min(max((f + 1 - REVEAL[0]) / (REVEAL[1] - REVEAL[0]), 0.0), 1.0)
    u = u * u * (3 - 2 * u)
    cam.location = Vector(cam_pos[f]).lerp(TOP_POS, u)
    tgt.location = Vector(cam_tgt[f]).lerp(TOP_TGT, u)
    cam.keyframe_insert("location", frame=f + 1)
    tgt.keyframe_insert("location", frame=f + 1)
    cam_d.lens = 32 - 2 * u
    cam_d.keyframe_insert("lens", frame=f + 1)
    cam_d.dof.aperture_fstop = 5.6 + 10 * u
    cam_d.dof.keyframe_insert("aperture_fstop", frame=f + 1)

# ---- Lights: low warm key for long shadows, cool rim, soft top fill ----
def sun(name, rot, color, strength, angle):
    d = bpy.data.lights.new(name, "SUN"); d.color = color; d.energy = strength; d.angle = math.radians(angle)
    o = bpy.data.objects.new(name, d); sc.collection.objects.link(o)
    o.rotation_euler = [math.radians(a) for a in rot]
    return o
sun("Key", (62, 0, -128), (1.0, 0.8, 0.62), 4.0, 4)
sun("Rim", (70, 0, 60), (0.45, 0.65, 1.0), 1.6, 8)
fill = bpy.data.lights.new("Fill", "AREA"); fill.size = 20; fill.energy = 900; fill.color = (0.7, 0.75, 1.0)
fo = bpy.data.objects.new("Fill", fill); sc.collection.objects.link(fo); fo.location = (0, 0, 14)

# ---- Render ----
if TESTS:
    for f in TESTS:
        sc.frame_set(f)
        sc.render.filepath = OUT + f"/test_{f:04d}.png"
        bpy.ops.render.render(write_still=True)
else:
    bpy.ops.render.render(animation=True)
print("RENDER COMPLETE")
