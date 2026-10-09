# Copyright (c) 2026 Dor5hacham d5shacham@gmail.com. All rights reserved.
# SPDX-License-Identifier: Proprietary

# Builds a CNC engraving shot in Eevee: a spinning V-bit traces the outlines of the word MOTION
# into a coral anodized aluminium block, and the cut shows bright bare metal. The carving is
# Geometry Nodes on a dense grid: the toolpath is an edge mesh whose points store the frame the
# tool reaches them; each frame the nodes keep the points already passed, measure every grid
# vertex's distance to that path (Geometry Proximity) and push it down into a 90 degree V groove.
# Chips are scripted ballistic arcs. The camera follows the tool, then cranes up to the full word.
# Usage: blender -b -P engrave.py -- <out_dir> [test_frame[,test_frame...]]
import bpy, bmesh, sys, math, random
from mathutils import Vector, Matrix, geometry

argv = sys.argv[sys.argv.index("--") + 1:]
OUT = argv[0]
TESTS = [int(x) for x in argv[1].split(",")] if len(argv) > 1 else []
FPS, FRAMES = 30, 270
WORD = "MOTION"
D = 0.05                  # groove depth = groove half-width (90 degree V-bit)
F0, F1 = 14, 214          # first plunge, last lift
SAFE = 0.22               # travel height between letters
BW, BH = 5.8, 2.0         # block top size
random.seed(11)

bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
sc.render.fps = FPS
sc.frame_start, sc.frame_end = 1, FRAMES
sc.render.resolution_x, sc.render.resolution_y = 1280, 720
engines = [e.identifier for e in sc.render.bl_rna.properties["engine"].enum_items]
sc.render.engine = "BLENDER_EEVEE" if "BLENDER_EEVEE" in engines else "BLENDER_EEVEE_NEXT"
ee = sc.eevee
ee.taa_render_samples = 48
for attr, val in [("use_raytracing", True), ("use_shadows", True), ("use_gtao", True)]:
    if hasattr(ee, attr):
        setattr(ee, attr, val)
if hasattr(sc.render, "use_motion_blur"):
    sc.render.use_motion_blur = True
    sc.render.motion_blur_shutter = 0.5
vts = [i.identifier for i in sc.view_settings.bl_rna.properties["view_transform"].enum_items]
sc.view_settings.view_transform = "AgX" if "AgX" in vts else "Standard"
sc.render.image_settings.file_format = "PNG"
sc.render.filepath = OUT + "/f_"

world = bpy.data.worlds.new("World")
sc.world = world
world.use_nodes = True
world.node_tree.nodes["Background"].inputs[0].default_value = (0.012, 0.012, 0.016, 1)

# ---- Letter outlines, sampled into closed polylines (left to right) ----
font = bpy.data.fonts.load(r"C:\Windows\Fonts\segoeuib.ttf")
cu = bpy.data.curves.new("Word", "FONT")
cu.body = WORD; cu.font = font; cu.size = 1.6
cu.align_x = "CENTER"; cu.align_y = "CENTER"
tob = bpy.data.objects.new("Word", cu); sc.collection.objects.link(tob)
bpy.context.view_layer.objects.active = tob
tob.select_set(True)
bpy.ops.object.convert(target="CURVE")
tob = bpy.context.view_layer.objects.active
STEP = 0.01
loops = []
for spl in tob.data.splines:
    pts = []
    if spl.type == "BEZIER":
        bps = spl.bezier_points
        n = len(bps)
        for i in range(n):
            a, b = bps[i], bps[(i + 1) % n]
            k = max(2, int((b.co - a.co).length / STEP) + 1)
            seg = geometry.interpolate_bezier(a.co, a.handle_right, b.handle_left, b.co, k + 1)
            pts.extend(Vector((p.x, p.y, 0)) for p in seg[:-1])
    else:
        pts = [Vector((p.co.x, p.co.y, 0)) for p in spl.points]
    pts.append(pts[0].copy())
    loops.append(pts)
bpy.data.objects.remove(tob)
loops.sort(key=lambda lp: min(p.x for p in lp))

def plen(pts):
    return sum((pts[i + 1] - pts[i]).length for i in range(len(pts) - 1))

# ---- Toolpath with timing: cut at V_CUT, travel at 3x, so the whole job spans F0..F1 ----
cut_len = sum(plen(lp) for lp in loops) + 2 * SAFE * len(loops)
travel_len = sum((loops[i + 1][0] - loops[i][-1]).length for i in range(len(loops) - 1))
V_CUT = (cut_len + travel_len / 3.0) / (F1 - F0)
path, times, cutting = [], [], []
t = float(F0)
def push(p, dt, cut):
    global t
    t += dt
    path.append(p.copy()); times.append(t); cutting.append(cut)
def line(a, b, speed, cut):
    n = max(1, int((b - a).length / STEP))
    for k in range(1, n + 1):
        push(a.lerp(b, k / n), (b - a).length / n / speed, cut)
UP = Vector((0, 0, SAFE))
path.append(loops[0][0] + UP); times.append(t); cutting.append(False)
for i, lp in enumerate(loops):
    line(lp[0] + UP, lp[0], V_CUT, True)                 # plunge
    for k in range(1, len(lp)):
        push(lp[k], (lp[k] - lp[k - 1]).length / V_CUT, True)
    line(lp[-1], lp[-1] + UP, V_CUT * 2, False)          # lift
    if i + 1 < len(loops):
        line(lp[-1] + UP, loops[i + 1][0] + UP, V_CUT * 3, False)
print(f"toolpath: {len(loops)} loops, {len(path)} points, cut speed {V_CUT:.3f}/frame, ends at {t:.1f}")

# Path mesh: edges only (never rendered); a far dummy edge keeps the proximity target non-empty
verts = [Vector((0, 0, 50)), Vector((0.1, 0, 50))] + path
edges = [(0, 1)] + [(k + 2, k + 3) for k in range(len(path) - 1)]
pme = bpy.data.meshes.new("Toolpath")
pme.from_pydata([tuple(v) for v in verts], edges, [])
fa = pme.attributes.new("f", "FLOAT", "POINT")
fa.data.foreach_set("value", [-1.0, -1.0] + times)
path_ob = bpy.data.objects.new("Toolpath", pme); sc.collection.objects.link(path_ob)

# ---- Block: dense grid top carved by Geometry Nodes, open-top box for the sides ----
bpy.ops.mesh.primitive_grid_add(x_subdivisions=1100, y_subdivisions=380, size=1.0)
top = bpy.context.object
top.name = "BlockTop"
top.data.transform(Matrix.Diagonal((BW, BH, 1, 1)))
bpy.ops.object.shade_smooth()

ng = bpy.data.node_groups.new("Engrave", "GeometryNodeTree")
ng.interface.new_socket(name="Geometry", in_out="INPUT", socket_type="NodeSocketGeometry")
ng.interface.new_socket(name="Geometry", in_out="OUTPUT", socket_type="NodeSocketGeometry")
N = ng.nodes; L = ng.links.new
gin = N.new("NodeGroupInput"); gout = N.new("NodeGroupOutput")
def mop(op, a=None, b=None, va=None, vb=None):
    m = N.new("ShaderNodeMath"); m.operation = op
    if a is not None: L(a, m.inputs[0])
    if b is not None: L(b, m.inputs[1])
    if va is not None: m.inputs[0].default_value = va
    if vb is not None: m.inputs[1].default_value = vb
    return m
oi = N.new("GeometryNodeObjectInfo"); oi.inputs["Object"].default_value = path_ob
oi.transform_space = "ORIGINAL"
na = N.new("GeometryNodeInputNamedAttribute"); na.data_type = "FLOAT"; na.inputs["Name"].default_value = "f"
stime = N.new("GeometryNodeInputSceneTime")
cmp = N.new("FunctionNodeCompare"); cmp.data_type = "FLOAT"; cmp.operation = "GREATER_THAN"
L(na.outputs["Attribute"], cmp.inputs[0]); L(stime.outputs["Frame"], cmp.inputs[1])
dele = N.new("GeometryNodeDeleteGeometry"); dele.domain = "POINT"
L(oi.outputs["Geometry"], dele.inputs["Geometry"]); L(cmp.outputs["Result"], dele.inputs["Selection"])
prox = N.new("GeometryNodeProximity"); prox.target_element = "EDGES"
L(dele.outputs["Geometry"], prox.inputs[0])
# V profile with a rounded lip: x = max(0, D - dist) / D, depth = D * (x - 0.1 + max(0, 0.2 - x)^2 / 0.4) / 0.9
x = mop("DIVIDE", mop("MAXIMUM", mop("SUBTRACT", None, prox.outputs["Distance"], va=D).outputs[0], vb=0.0).outputs[0], vb=D)
lip = mop("MAXIMUM", mop("SUBTRACT", None, x.outputs[0], va=0.2).outputs[0], vb=0.0)
lip2 = mop("DIVIDE", mop("POWER", lip.outputs[0], vb=2.0).outputs[0], vb=0.4)
y = mop("ADD", mop("SUBTRACT", x.outputs[0], vb=0.1).outputs[0], lip2.outputs[0])
depth = mop("MULTIPLY", y.outputs[0], vb=D / 0.9)
store = N.new("GeometryNodeStoreNamedAttribute"); store.data_type = "FLOAT"; store.domain = "POINT"
store.inputs["Name"].default_value = "carve"
L(gin.outputs[0], store.inputs["Geometry"]); L(depth.outputs[0], store.inputs["Value"])
rd = N.new("GeometryNodeInputNamedAttribute"); rd.data_type = "FLOAT"; rd.inputs["Name"].default_value = "carve"
neg = mop("MULTIPLY", rd.outputs["Attribute"], vb=-1.0)
off = N.new("ShaderNodeCombineXYZ"); L(neg.outputs[0], off.inputs["Z"])
setp = N.new("GeometryNodeSetPosition")
L(store.outputs["Geometry"], setp.inputs["Geometry"]); L(off.outputs["Vector"], setp.inputs["Offset"])
L(setp.outputs["Geometry"], gout.inputs[0])
mod = top.modifiers.new("Engrave", "NODES"); mod.node_group = ng

# Anodized coral where untouched, bright bare aluminium in the cut
mat = bpy.data.materials.new("Anodized"); mat.use_nodes = True
mt = mat.node_tree
mp = mt.nodes["Principled BSDF"]
at = mt.nodes.new("ShaderNodeAttribute"); at.attribute_name = "carve"
mr = mt.nodes.new("ShaderNodeMapRange")
mr.inputs["From Min"].default_value = 0.0004; mr.inputs["From Max"].default_value = 0.003
mt.links.new(at.outputs["Fac"], mr.inputs["Value"])
col = mt.nodes.new("ShaderNodeMix"); col.data_type = "RGBA"
def msock(node, ident, out=False):
    return next(s for s in (node.outputs if out else node.inputs) if s.identifier == ident)
mt.links.new(mr.outputs["Result"], msock(col, "Factor_Float"))
msock(col, "A_Color").default_value = (1.0, 0.16, 0.07, 1)
msock(col, "B_Color").default_value = (0.93, 0.93, 0.95, 1)
mt.links.new(msock(col, "Result_Color", True), mp.inputs["Base Color"])
rough = mt.nodes.new("ShaderNodeMapRange")
rough.inputs["To Min"].default_value = 0.42; rough.inputs["To Max"].default_value = 0.14
# Anodized surface is a dyed satin layer (half metallic), the cut is bare metal
metal = mt.nodes.new("ShaderNodeMapRange")
metal.inputs["To Min"].default_value = 0.45; metal.inputs["To Max"].default_value = 1.0
mt.links.new(mr.outputs["Result"], metal.inputs["Value"])
mt.links.new(metal.outputs["Result"], mp.inputs["Metallic"])
mt.links.new(mr.outputs["Result"], rough.inputs["Value"])
mt.links.new(rough.outputs["Result"], mp.inputs["Roughness"])
top.data.materials.append(mat)

bm = bmesh.new()
bmesh.ops.create_cube(bm, size=1.0)
for v in bm.verts:
    v.co = Vector((v.co.x * BW, v.co.y * BH, (v.co.z - 0.5) * 0.7))
bmesh.ops.delete(bm, geom=[f for f in bm.faces if f.normal.z > 0.9], context="FACES_ONLY")
side_me = bpy.data.meshes.new("BlockSides"); bm.to_mesh(side_me); bm.free()
sides = bpy.data.objects.new("BlockSides", side_me); sc.collection.objects.link(sides)
side_me.materials.append(mat)

floor_mat = bpy.data.materials.new("Floor"); floor_mat.use_nodes = True
fp = floor_mat.node_tree.nodes["Principled BSDF"]
fp.inputs["Base Color"].default_value = (0.02, 0.02, 0.024, 1); fp.inputs["Roughness"].default_value = 0.5
bpy.ops.mesh.primitive_plane_add(size=80, location=(0, 0, -0.7))
bpy.context.object.data.materials.append(floor_mat)

# ---- Tool: carbide V-bit, collet nut, spindle; the bit spins, the rig follows the path ----
def pmat(name, color, rough, metal):
    m = bpy.data.materials.new(name); m.use_nodes = True
    p = m.node_tree.nodes["Principled BSDF"]
    p.inputs["Base Color"].default_value = color; p.inputs["Roughness"].default_value = rough
    p.inputs["Metallic"].default_value = metal
    return m
carbide = pmat("Carbide", (0.75, 0.75, 0.78, 1), 0.22, 1.0)
steel = pmat("Steel", (0.85, 0.86, 0.9, 1), 0.12, 1.0)
body = pmat("Body", (0.03, 0.03, 0.035, 1), 0.4, 0.0)
cream = pmat("Ring", (0.95, 0.85, 0.66, 1), 0.3, 0.0)

def cyl(bm, z0, z1, r0, r1, seg=32, mi=0):
    res = bmesh.ops.create_cone(bm, cap_ends=True, segments=seg, radius1=r0, radius2=r1, depth=z1 - z0,
                                matrix=Matrix.Translation((0, 0, (z0 + z1) / 2)))
    for f in {f for v in res["verts"] for f in v.link_faces}:
        f.material_index = mi
rig = bpy.data.objects.new("ToolRig", None); sc.collection.objects.link(rig)
bm = bmesh.new()
cyl(bm, 0.0, 0.065, 0.0005, 0.065, 32, 0)                 # V tip (tip at origin)
cyl(bm, 0.065, 0.62, 0.065, 0.065, 6, 0)                 # hex-faceted shank so the spin reads
bit_me = bpy.data.meshes.new("Bit"); bm.to_mesh(bit_me); bm.free()
bit_me.materials.append(carbide)
bit = bpy.data.objects.new("Bit", bit_me); sc.collection.objects.link(bit); bit.parent = rig
bm = bmesh.new()
cyl(bm, 0.56, 0.74, 0.12, 0.17, 6, 0)                    # collet nut
cyl(bm, 0.74, 0.9, 0.3, 0.3, 48, 1)                      # spindle nose
cyl(bm, 0.9, 0.96, 0.31, 0.31, 48, 2)                    # cream ring
cyl(bm, 0.96, 3.2, 0.3, 0.3, 48, 1)                      # spindle body
sp_me = bpy.data.meshes.new("Spindle"); bm.to_mesh(sp_me); bm.free()
for m in (steel, body, cream):
    sp_me.materials.append(m)
for poly in sp_me.polygons:
    poly.use_smooth = len(poly.vertices) == 4 and abs(poly.normal.z) < 0.5
spindle = bpy.data.objects.new("Spindle", sp_me); sc.collection.objects.link(spindle); spindle.parent = rig
bit.rotation_mode = "XYZ"
bit.keyframe_insert("rotation_euler", frame=1)
bit.rotation_euler.z = math.radians(-50 * FRAMES)
bit.keyframe_insert("rotation_euler", frame=FRAMES)
def all_fcurves(idb):
    act = idb.animation_data.action
    fcs = list(getattr(act, "fcurves", []) or [])
    for layer in getattr(act, "layers", []):
        for strip in layer.strips:
            for bag in strip.channelbags:
                fcs.extend(bag.fcurves)
    return fcs
for fc in all_fcurves(bit):
    for kp in fc.keyframe_points:
        kp.interpolation = "LINEAR"

def path_at(f):
    """Tool tip position on frame f, interpolated from the timed toolpath."""
    if f <= times[0]:
        u = min(max((f - 1) / (times[0] - 1), 0.0), 1.0)
        u = 1 - (1 - u) ** 3
        start = path[0] + Vector((-0.9, -0.5, 0.9))
        return start.lerp(path[0], u)
    if f >= times[-1]:
        u = min((f - times[-1]) / 30.0, 1.0)
        u = u * u * (3 - 2 * u)
        return path[-1].lerp(path[-1] + Vector((1.6, 1.2, 1.6)), u)
    lo, hi = 0, len(times) - 1
    while hi - lo > 1:
        mid = (lo + hi) // 2
        if times[mid] <= f:
            lo = mid
        else:
            hi = mid
    u = (f - times[lo]) / max(times[hi] - times[lo], 1e-6)
    return path[lo].lerp(path[hi], u)

tip = []
for f in range(1, FRAMES + 1):
    p = path_at(f) - Vector((0, 0, D))
    tip.append(p)
    rig.location = p
    rig.keyframe_insert("location", frame=f)

# ---- Chips: bright slivers flung from the tip while it cuts ----
chip_me = bpy.data.meshes.new("Chip")
cbm = bmesh.new(); bmesh.ops.create_icosphere(cbm, subdivisions=1, radius=1.0)
for v in cbm.verts:
    v.co = Vector((v.co.x * 0.022, v.co.y * 0.006, v.co.z * 0.004 + 0.01 * v.co.x * v.co.x))
cbm.to_mesh(chip_me); cbm.free()
chip_me.materials.append(steel)
GRAV = 0.0045
cut_frames = [f for f in range(F0 + 1, int(times[-1])) if any(
    cutting[k] for k in range(len(times)) if f - 1 < times[k] <= f)]
for f in cut_frames:
    for j in range(2):
        ob = bpy.data.objects.new(f"Chip_{f}_{j}", chip_me); sc.collection.objects.link(ob)
        a = random.uniform(0, 2 * math.pi)
        v = Vector((math.cos(a), math.sin(a), 0)) * random.uniform(0.012, 0.035) + Vector((0, 0, random.uniform(0.02, 0.05)))
        spin = Vector((random.uniform(-0.6, 0.6), random.uniform(-0.6, 0.6), random.uniform(-0.6, 0.6)))
        pos = tip[f - 1] + Vector((0, 0, D + 0.01))
        rot = Vector((random.uniform(0, 6.3), random.uniform(0, 6.3), random.uniform(0, 6.3)))
        ob.scale = (0, 0, 0); ob.keyframe_insert("scale", frame=f - 1)
        ob.scale = (1, 1, 1)
        g = f
        landed = None
        while g < FRAMES and (landed is None or g < landed + 14):
            if landed is None:
                pos = pos + v; v.z -= GRAV; rot = rot + spin
                if pos.z < 0.004:
                    pos.z = 0.004; landed = g
            ob.location = pos; ob.rotation_euler = rot
            ob.keyframe_insert("location", frame=g); ob.keyframe_insert("rotation_euler", frame=g)
            if g == f:
                ob.keyframe_insert("scale", frame=g)
            g += 1
        ob.keyframe_insert("scale", frame=g - 6)
        ob.scale = (0, 0, 0); ob.keyframe_insert("scale", frame=g)

# ---- Camera: follows a smoothed tool position, then cranes up to the whole word ----
def smooth(vals, a):
    out = vals[:]
    for i in range(1, len(out)):
        out[i] = out[i - 1] + a * (out[i] - out[i - 1])
    for i in range(len(out) - 2, -1, -1):
        out[i] = out[i + 1] + a * (out[i] - out[i + 1])
    return out
sx = smooth([p.x for p in tip], 0.03)
sy = smooth([p.y for p in tip], 0.03)
cam_d = bpy.data.cameras.new("Cam"); cam_d.lens = 55
cam_d.dof.use_dof = True
cam = bpy.data.objects.new("Cam", cam_d); sc.collection.objects.link(cam)
sc.camera = cam
tgt = bpy.data.objects.new("Target", None); sc.collection.objects.link(tgt)
cam_d.dof.focus_object = tgt
tc = cam.constraints.new("TRACK_TO"); tc.target = tgt
tc.track_axis = "TRACK_NEGATIVE_Z"; tc.up_axis = "UP_Y"
REV0, REV1 = F1 - 14, F1 + 40
for f in range(1, FRAMES + 1):
    u = min(max((f - REV0) / (REV1 - REV0), 0.0), 1.0)
    u = u * u * (3 - 2 * u)
    x, y = sx[f - 1], sy[f - 1] * 0.5
    near_c, near_t = Vector((x - 1.0, y - 3.3, 1.95)), Vector((x + 0.1, y + 0.05, 0.0))
    cam.location = near_c.lerp(Vector((0, -5.6, 4.9)), u)
    tgt.location = near_t.lerp(Vector((0, -0.1, 0)), u)
    cam_d.lens = 50 - 12 * u
    cam_d.dof.aperture_fstop = 4.0 + 7 * u
    cam.keyframe_insert("location", frame=f); tgt.keyframe_insert("location", frame=f)
    cam_d.keyframe_insert("lens", frame=f); cam_d.dof.keyframe_insert("aperture_fstop", frame=f)

# ---- Lights: a big softbox behind for the reflections on the flat metal, key and rim ----
aim = bpy.data.objects.new("Aim", None); sc.collection.objects.link(aim)
def area(name, loc, color, power, size, size_y=None):
    d = bpy.data.lights.new(name, "AREA"); d.color = color; d.energy = power
    if size_y:
        d.shape = "RECTANGLE"; d.size = size; d.size_y = size_y
    else:
        d.shape = "DISK"; d.size = size
    o = bpy.data.objects.new(name, d); sc.collection.objects.link(o)
    o.location = loc
    c = o.constraints.new("TRACK_TO"); c.target = aim
    c.track_axis = "TRACK_NEGATIVE_Z"; c.up_axis = "UP_Y"
    return o
area("Soft", (0, 4.5, 4.0), (1.0, 0.97, 0.93), 380, 9, 3)
area("Key", (-4, -3.5, 4.5), (1.0, 0.9, 0.8), 420, 3)
area("Rim", (5, 1.5, 1.5), (0.4, 0.7, 1.0), 400, 0.5, 5)

if TESTS:
    for f in TESTS:
        sc.frame_set(f)
        sc.render.filepath = OUT + f"/test_{f:04d}.png"
        bpy.ops.render.render(write_still=True)
else:
    bpy.ops.render.render(animation=True)
print("RENDER COMPLETE")
