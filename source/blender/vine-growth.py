# Grows ivy over a glazed navy vase with a Geometry Nodes simulation zone built in Python.
# 30 growing tips start around the foot of the vase. Every frame the zone moves each tip along
# the surface (an upward pull, a per-tip spiral and 4D noise, projected onto the tangent plane, snapped back
# with Sample Nearest Surface) and appends the tip to a trail point cloud with its birth time.
# Outside the zone, Points to Curves turns each tip's trail into a curve, the radius tapers at
# the young end, Curve to Mesh makes the stems, and leaves and coral berries pop in on random
# trail points once the tip has passed. Eevee, cream cyclorama, slow orbit.
# Usage: blender -b -P vine-growth.py -- <out_dir> [test_frames, comma separated]
# The simulation is stepped frame by frame before each render so its cache is complete.
import bpy, bmesh, sys, math

argv = sys.argv[sys.argv.index("--") + 1:]
OUT = argv[0]
TEST = [int(x) for x in argv[1].split(",")] if len(argv) > 1 else None
FPS, FRAMES = 30, 240

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
sc.view_settings.view_transform = "AgX"
sc.render.image_settings.file_format = "PNG"
sc.render.filepath = OUT + "/f_"


def srgb(h):
    h = h.lstrip("#")
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c)


world = bpy.data.worlds.new("World"); sc.world = world
world.use_nodes = True
world.node_tree.nodes["Background"].inputs[0].default_value = (*srgb("#2a2622"), 1)
world.node_tree.nodes["Background"].inputs[1].default_value = 0.6


def pbr(name, hexcol, rough, coat=0.0):
    m = bpy.data.materials.new(name); m.use_nodes = True
    p = m.node_tree.nodes["Principled BSDF"]
    p.inputs["Base Color"].default_value = (*srgb(hexcol), 1)
    p.inputs["Roughness"].default_value = rough
    if "Coat Weight" in p.inputs:
        p.inputs["Coat Weight"].default_value = coat
    return m


def lathe(name, profile, mat, seg=96):
    bm = bmesh.new()
    vs = [bm.verts.new((r, 0, z)) for r, z in profile]
    es = [bm.edges.new((a, b)) for a, b in zip(vs, vs[1:])]
    bmesh.ops.spin(bm, geom=vs + es, cent=(0, 0, 0), axis=(0, 0, 1), steps=seg, angle=2 * math.pi)
    bmesh.ops.remove_doubles(bm, verts=bm.verts[:], dist=1e-5)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    me.materials.append(mat)
    for p in me.polygons:
        p.use_smooth = True
    ob = bpy.data.objects.new(name, me); sc.collection.objects.link(ob)
    return ob


def catmull(pts, n=6):
    # Smooths a polyline profile with Catmull-Rom segments
    out = []
    P = [pts[0]] + pts + [pts[-1]]
    for i in range(1, len(P) - 2):
        p0, p1, p2, p3 = P[i - 1], P[i], P[i + 1], P[i + 2]
        for k in range(n):
            t = k / n
            out.append(tuple(0.5 * (2 * p1[j] + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t * t
                                    + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t ** 3) for j in range(2)))
    out.append(pts[-1])
    return out


# ---- Cyclorama: floor curving up into a back wall ----
cyc = bpy.data.meshes.new("Cyc")
prof = [(y, 0.0) for y in (-14, 2.0)] + [(2.0 + 4 * math.sin(a), 4 - 4 * math.cos(a)) for a in [i / 12 * math.pi / 2 for i in range(1, 13)]] + [(6.0, 14.0)]
verts, faces = [], []
for x in (-20, 20):
    verts += [(x, y, z) for y, z in prof]
n_ = len(prof)
for i in range(n_ - 1):
    faces.append((i, i + 1, n_ + i + 1, n_ + i))
cyc.from_pydata(verts, [], faces)
for p in cyc.polygons:
    p.use_smooth = True
cyc.materials.append(pbr("Cyc", "#e9e0d0", 0.85))
sc.collection.objects.link(bpy.data.objects.new("Cyc", cyc))

# ---- Vase: a smooth amphora lathe with a glossy navy glaze ----
VASE_PROF = catmull([(0.0, 0.0), (0.5, 0.0), (0.56, 0.06), (0.62, 0.25), (0.86, 0.75), (1.02, 1.35), (1.0, 1.9), (0.82, 2.45),
                     (0.55, 2.85), (0.4, 3.15), (0.38, 3.4), (0.46, 3.62), (0.52, 3.7), (0.46, 3.74), (0.36, 3.66), (0.3, 3.4)])
vase = lathe("Vase", VASE_PROF, pbr("Glaze", "#1f2b4d", 0.12, coat=1.0))
TOP = 3.62

# ---- Leaf: a curled heart-shaped blade, stem at the origin, lying along +Y ----
bm = bmesh.new()
rows = []
for i in range(9):
    v = i / 8
    w = 0.42 * math.sin(math.pi * v) ** 0.7 * (1 - 0.25 * v)
    row = []
    for j in range(5):
        u = (j / 4 - 0.5) * 2
        x = u * w
        y = v
        z = 0.18 * v * v + 0.12 * abs(u) * w
        row.append(bm.verts.new((x, y, z)))
    rows.append(row)
for i in range(8):
    for j in range(4):
        bm.faces.new((rows[i][j], rows[i][j + 1], rows[i + 1][j + 1], rows[i + 1][j]))
bmesh.ops.remove_doubles(bm, verts=bm.verts[:], dist=1e-4)
leaf_me = bpy.data.meshes.new("Leaf"); bm.to_mesh(leaf_me); bm.free()
for p in leaf_me.polygons:
    p.use_smooth = True
LEAF = bpy.data.materials.new("Leaf"); LEAF.use_nodes = True
ln = LEAF.node_tree.nodes; lp = ln["Principled BSDF"]
oi = ln.new("ShaderNodeObjectInfo")
lr = ln.new("ShaderNodeValToRGB")
lr.color_ramp.elements[0].color = (*srgb("#2f7a3a"), 1); lr.color_ramp.elements[1].color = (*srgb("#8fd14f"), 1)
LEAF.node_tree.links.new(oi.outputs["Random"], lr.inputs["Fac"])
LEAF.node_tree.links.new(lr.outputs["Color"], lp.inputs["Base Color"])
lp.inputs["Roughness"].default_value = 0.4
if "Subsurface Weight" in lp.inputs:
    lp.inputs["Subsurface Weight"].default_value = 0.0
if "Transmission Weight" in lp.inputs:
    lp.inputs["Transmission Weight"].default_value = 0.0
leaf_me.materials.append(LEAF)
leaf_ob = bpy.data.objects.new("LeafSource", leaf_me); sc.collection.objects.link(leaf_ob)
leaf_ob.hide_render = True; leaf_ob.hide_viewport = True

# Stem material: young (light green) to old (olive brown) from the "youth" attribute
STEM = bpy.data.materials.new("Stem"); STEM.use_nodes = True
sn = STEM.node_tree.nodes; spb = sn["Principled BSDF"]
at = sn.new("ShaderNodeAttribute"); at.attribute_name = "youth"
sr = sn.new("ShaderNodeValToRGB")
sr.color_ramp.elements[0].color = (*srgb("#4b5a2a"), 1); sr.color_ramp.elements[1].color = (*srgb("#b6e35a"), 1)
STEM.node_tree.links.new(at.outputs["Fac"], sr.inputs["Fac"])
STEM.node_tree.links.new(sr.outputs["Color"], spb.inputs["Base Color"])
spb.inputs["Roughness"].default_value = 0.45
BERRY = pbr("Berry", "#ff5a36", 0.25, coat=0.6)

# ---- Geometry Nodes ----
ng = bpy.data.node_groups.new("Ivy", "GeometryNodeTree")
ng.interface.new_socket(name="Geometry", in_out="INPUT", socket_type="NodeSocketGeometry")
ng.interface.new_socket(name="Geometry", in_out="OUTPUT", socket_type="NodeSocketGeometry")
N = ng.nodes
L = ng.links.new


def sock(coll, name):
    # First available socket with this name (some nodes keep hidden sockets of other types)
    for s_ in coll:
        if s_.name == name and not getattr(s_, "is_unavailable", False):
            return s_
    return coll[name]


def node(kind, **props):
    nd = N.new(kind)
    for k, v in props.items():
        setattr(nd, k, v)
    return nd


def math_(op, a=None, b=None, va=None, vb=None):
    m = node("ShaderNodeMath", operation=op)
    for i, (s, v) in enumerate(((a, va), (b, vb))):
        if s is not None:
            L(s, m.inputs[i])
        if v is not None:
            m.inputs[i].default_value = v
    return m.outputs[0]


def vmath(op, a=None, b=None, vb=None, scale=None):
    m = node("ShaderNodeVectorMath", operation=op)
    if a is not None:
        L(a, m.inputs[0])
    if b is not None:
        L(b, m.inputs[1])
    if vb is not None:
        m.inputs[1].default_value = vb
    if scale is not None:
        if isinstance(scale, float):
            m.inputs["Scale"].default_value = scale
        else:
            L(scale, m.inputs["Scale"])
    return m.outputs["Value"] if op in ("DOT_PRODUCT", "LENGTH") else m.outputs["Vector"]


def named(name, dtype="FLOAT"):
    nd = node("GeometryNodeInputNamedAttribute", data_type=dtype)
    nd.inputs["Name"].default_value = name
    return sock(nd.outputs, "Attribute")


def store(geo, name, value, dtype="FLOAT", domain="POINT", sel=None):
    nd = node("GeometryNodeStoreNamedAttribute", data_type=dtype, domain=domain)
    L(geo, nd.inputs["Geometry"])
    nd.inputs["Name"].default_value = name
    L(value, sock(nd.inputs, "Value"))
    if sel is not None:
        L(sel, nd.inputs["Selection"])
    return nd.outputs["Geometry"]


def rand(lo, hi, seed, id_=None, dtype="FLOAT"):
    nd = node("FunctionNodeRandomValue", data_type=dtype)
    if dtype == "BOOLEAN":
        sock(nd.inputs, "Probability").default_value = lo
    else:
        sock(nd.inputs, "Min").default_value = lo
        sock(nd.inputs, "Max").default_value = hi
    nd.inputs["Seed"].default_value = seed
    if id_ is not None:
        L(id_, nd.inputs["ID"])
    return sock(nd.outputs, "Value")


gin = node("NodeGroupInput"); gout = node("NodeGroupOutput")
time = node("GeometryNodeInputSceneTime").outputs["Seconds"]
vinfo = node("GeometryNodeObjectInfo", transform_space="RELATIVE")
vinfo.inputs["Object"].default_value = vase
vmesh = vinfo.outputs["Geometry"]
idx = node("GeometryNodeInputIndex").outputs["Index"]
posn = node("GeometryNodeInputPosition").outputs["Position"]
normal_in = node("GeometryNodeInputNormal").outputs["Normal"]

# Seeds: 30 points around the foot of the vase
NT = 30
ang = math_("ADD", math_("MULTIPLY", idx, vb=2 * math.pi / NT), rand(-0.04, 0.04, 1, idx))
seed_pos = node("ShaderNodeCombineXYZ")
L(math_("MULTIPLY", math_("COSINE", ang), vb=0.66), seed_pos.inputs["X"])
L(math_("MULTIPLY", math_("SINE", ang), vb=0.66), seed_pos.inputs["Y"])
L(rand(0.12, 0.3, 2, idx), seed_pos.inputs["Z"])
pts = node("GeometryNodePoints"); pts.inputs["Count"].default_value = NT
L(seed_pos.outputs[0], pts.inputs["Position"])
g = store(pts.outputs[0], "vid", idx, "INT")
g = store(g, "speed", rand(0.75, 1.25, 3, idx))
g = store(g, "delay", rand(0.0, 1.6, 4, idx))
g = store(g, "seed", rand(0.0, 100.0, 5, idx))
g = store(g, "spin", rand(-1.1, 1.1, 6, idx))

# Simulation zone: state "Geometry" holds the tips, "Trail" accumulates trail points
sim_in = node("GeometryNodeSimulationInput"); sim_out = node("GeometryNodeSimulationOutput")
sim_in.pair_with_output(sim_out)
sim_out.state_items.new("GEOMETRY", "Trail")
L(g, sim_in.inputs["Geometry"])
tips = sim_in.outputs["Geometry"]
trail = sim_in.outputs["Trail"]
dt = sim_in.outputs["Delta Time"]


def nearest_normal(sample_pos):
    nd = node("GeometryNodeSampleNearestSurface", data_type="FLOAT_VECTOR")
    L(vmesh, nd.inputs["Mesh"])
    L(normal_in, sock(nd.inputs, "Value"))
    L(sample_pos, nd.inputs["Sample Position"])
    return sock(nd.outputs, "Value")


nrm = nearest_normal(posn)
nz = node("ShaderNodeTexNoise", noise_dimensions="4D")
nz.inputs["Scale"].default_value = 0.8; nz.inputs["Detail"].default_value = 1.0
L(posn, nz.inputs["Vector"])
L(math_("ADD", math_("MULTIPLY", time, vb=0.12), math_("MULTIPLY", named("seed"), vb=0.37)), nz.inputs["W"])
wander = vmath("SCALE", vmath("SUBTRACT", nz.outputs["Color"], vb=(0.5, 0.5, 0.5)), scale=6.0)
sep = node("ShaderNodeSeparateXYZ"); L(posn, sep.inputs[0])
around = node("ShaderNodeCombineXYZ")
L(math_("MULTIPLY", sep.outputs["Y"], vb=-1.0), around.inputs["X"]); L(sep.outputs["X"], around.inputs["Y"])
swirl = vmath("SCALE", vmath("NORMALIZE", around.outputs[0]), scale=named("spin"))
desire = vmath("ADD", vmath("ADD", wander, swirl), vb=(0.0, 0.0, 0.6))
tang = vmath("SUBTRACT", desire, vmath("SCALE", nrm, scale=vmath("DOT_PRODUCT", desire, nrm)))
dirn = vmath("NORMALIZE", tang)
# A tip moves once its start delay has passed and until it reaches the rim
active = math_("MULTIPLY", math_("GREATER_THAN", time, named("delay")), math_("LESS_THAN", sep.outputs["Z"], vb=TOP))
step = vmath("SCALE", dirn, scale=math_("MULTIPLY", math_("MULTIPLY", named("speed"), dt), vb=0.62))
moved = vmath("ADD", posn, step)
prox = node("GeometryNodeProximity", target_element="FACES")
L(vmesh, prox.inputs[0])
L(moved, prox.inputs["Sample Position"])
snapped = vmath("ADD", prox.outputs["Position"], vmath("SCALE", nearest_normal(moved), scale=0.025))
setp = node("GeometryNodeSetPosition")
L(tips, setp.inputs["Geometry"]); L(active, setp.inputs["Selection"]); L(snapped, setp.inputs["Position"])
new_tips = store(setp.outputs[0], "nrm", nrm, "FLOAT_VECTOR")
new_tips = store(new_tips, "birth", time)
# Only tips that moved this step add a point to the trail
sepg = node("GeometryNodeSeparateGeometry", domain="POINT")
L(new_tips, sepg.inputs["Geometry"]); L(active, sepg.inputs["Selection"])
join = node("GeometryNodeJoinGeometry")
L(sepg.outputs["Selection"], join.inputs[0]); L(trail, join.inputs[0])
L(new_tips, sim_out.inputs["Geometry"]); L(join.outputs[0], sim_out.inputs["Trail"])
trail_out = sim_out.outputs["Trail"]

# Stems: one curve per tip ordered by birth time, radius tapers at the young end
p2c = node("GeometryNodePointsToCurves")
L(trail_out, p2c.inputs["Points"])
L(named("vid", "INT"), p2c.inputs["Curve Group ID"])
L(named("birth"), p2c.inputs["Weight"])
age = math_("SUBTRACT", time, named("birth"))
grow = math_("POWER", math_("MINIMUM", math_("DIVIDE", age, vb=0.25), vb=1.0), vb=0.6)
thick = math_("ADD", math_("MULTIPLY", math_("MINIMUM", math_("DIVIDE", age, vb=4.0), vb=1.0), vb=0.012), vb=0.014)
radius = math_("MULTIPLY", grow, thick)
scr = node("GeometryNodeSetCurveRadius")
L(p2c.outputs[0], scr.inputs["Curve"]); L(radius, scr.inputs["Radius"])
curves = store(scr.outputs[0], "youth", math_("MAXIMUM", math_("SUBTRACT", None, math_("DIVIDE", age, vb=3.0), va=1.0), vb=0.0))
circle = node("GeometryNodeCurvePrimitiveCircle", mode="RADIUS")
circle.inputs["Resolution"].default_value = 8; circle.inputs["Radius"].default_value = 1.0
c2m = node("GeometryNodeCurveToMesh")
L(curves, c2m.inputs["Curve"]); L(circle.outputs["Curve"], c2m.inputs["Profile Curve"])
if "Scale" in c2m.inputs:
    L(node("GeometryNodeInputRadius").outputs[0], c2m.inputs["Scale"])
if "Fill Caps" in c2m.inputs:
    c2m.inputs["Fill Caps"].default_value = True
smooth = node("GeometryNodeSetShadeSmooth"); L(c2m.outputs["Mesh"], smooth.inputs["Geometry"])
stems = node("GeometryNodeSetMaterial"); stems.inputs["Material"].default_value = STEM
L(smooth.outputs[0], stems.inputs["Geometry"])


# Leaves and berries: instanced on random trail points, scaled in after the tip passes.
# The random ID comes from tip id and birth frame, so a point keeps its leaf as the trail grows.
def pid():
    return math_("ADD", named("vid", "INT"), math_("MULTIPLY", math_("ROUND", math_("MULTIPLY", named("birth"), vb=FPS)), vb=NT))


def sprout(prob, seed, instance, size_lo, size_hi, delay, ramp, upright):
    inst = node("GeometryNodeInstanceOnPoints")
    L(trail_out, inst.inputs["Points"])
    L(rand(prob, None, seed, pid(), "BOOLEAN"), inst.inputs["Selection"])
    L(instance, inst.inputs["Instance"])
    al = node("FunctionNodeAlignRotationToVector", axis="Z")
    L(named("nrm", "FLOAT_VECTOR"), al.inputs["Vector"])
    eul = node("ShaderNodeCombineXYZ")
    L(rand(0.0, 6.283, seed + 1, pid()), eul.inputs["Z"])
    L(math_("MULTIPLY", rand(-1.0, 1.0, seed + 4, pid()), vb=upright), eul.inputs["X"])
    e2r = node("FunctionNodeEulerToRotation"); L(eul.outputs[0], e2r.inputs["Euler"])
    rr = node("FunctionNodeRotateRotation", rotation_space="LOCAL")
    L(al.outputs["Rotation"], rr.inputs["Rotation"]); L(e2r.outputs["Rotation"], rr.inputs["Rotate By"])
    L(rr.outputs["Rotation"], inst.inputs["Rotation"])
    mr = node("ShaderNodeMapRange", interpolation_type="SMOOTHSTEP")
    L(age, mr.inputs["Value"])
    mr.inputs["From Min"].default_value = delay; mr.inputs["From Max"].default_value = delay + ramp
    sz = math_("MULTIPLY", mr.outputs["Result"], rand(size_lo, size_hi, seed + 2, pid()))
    L(sz, inst.inputs["Scale"])
    return inst.outputs["Instances"]


leaf_info = node("GeometryNodeObjectInfo", transform_space="ORIGINAL")
leaf_info.inputs["Object"].default_value = leaf_ob
leaves = sprout(0.07, 20, leaf_info.outputs["Geometry"], 0.13, 0.24, 0.15, 0.7, 0.5)
ico = node("GeometryNodeMeshIcoSphere"); ico.inputs["Radius"].default_value = 1.0; ico.inputs["Subdivisions"].default_value = 2
berry_geo = node("GeometryNodeSetMaterial"); berry_geo.inputs["Material"].default_value = BERRY
L(ico.outputs["Mesh"], berry_geo.inputs["Geometry"])
bsm = node("GeometryNodeSetShadeSmooth"); L(berry_geo.outputs[0], bsm.inputs["Geometry"])
berries = sprout(0.012, 40, bsm.outputs[0], 0.035, 0.055, 1.6, 0.5, 0.0)

out_join = node("GeometryNodeJoinGeometry")
for s in (berries, leaves, stems.outputs[0]):
    L(s, out_join.inputs[0])
L(out_join.outputs[0], gout.inputs[0])

host = bpy.data.objects.new("Ivy", bpy.data.meshes.new("IvyHost")); sc.collection.objects.link(host)
host.modifiers.new("Ivy", "NODES").node_group = ng

# ---- Lights ----
def area(name, loc, rot, color, power, size):
    d = bpy.data.lights.new(name, "AREA"); d.color = color; d.energy = power; d.size = size
    o = bpy.data.objects.new(name, d); sc.collection.objects.link(o)
    o.location = loc; o.rotation_euler = [math.radians(v) for v in rot]


area("Key", (-4.5, -4.0, 6.0), (45, 0, -48), (1.0, 0.92, 0.82), 1400, 4)
area("Rim", (4.0, 3.5, 4.5), (-55, 0, 140), (0.85, 0.92, 1.0), 900, 3)
area("Fill", (5.0, -5.0, 2.0), (75, 0, 45), (1.0, 0.95, 0.9), 200, 5)

# ---- Camera: slow orbit that rises with the growth ----
cam_d = bpy.data.cameras.new("Cam"); cam_d.lens = 50
cam_d.dof.use_dof = True; cam_d.dof.aperture_fstop = 4.0
cam = bpy.data.objects.new("Cam", cam_d); sc.collection.objects.link(cam); sc.camera = cam
target = bpy.data.objects.new("Target", None); sc.collection.objects.link(target)
cam_d.dof.focus_object = target
pivot = bpy.data.objects.new("Pivot", None); sc.collection.objects.link(pivot)
cam.parent = pivot
tc = cam.constraints.new("TRACK_TO"); tc.target = target; tc.track_axis = "TRACK_NEGATIVE_Z"; tc.up_axis = "UP_Y"
for f, a, cz, tz in [(1, -25, 2.4, 1.8), (FRAMES, 20, 3.0, 2.0)]:
    pivot.rotation_euler = (0, 0, math.radians(a)); pivot.keyframe_insert("rotation_euler", frame=f)
    cam.location = (0, -11.5, cz); cam.keyframe_insert("location", frame=f)
    target.location = (0, 0, tz); target.keyframe_insert("location", frame=f)

if TEST:
    for f in range(1, max(TEST) + 1):
        sc.frame_set(f)
        if f in TEST:
            sc.render.filepath = OUT + f"/test_{f:04d}.png"
            bpy.ops.render.render(write_still=True)
else:
    for f in range(1, FRAMES + 1):
        sc.frame_set(f)
        sc.render.filepath = OUT + f"/f_{f:04d}.png"
        bpy.ops.render.render(write_still=True)
print("RENDER COMPLETE")
