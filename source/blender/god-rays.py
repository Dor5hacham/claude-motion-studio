# Builds a dim room where low sun pours through venetian blinds: the slats tilt open over the
# shot, so thin light blades widen into broad shafts that cut through dusty air and paint
# stripes across a plank floor, a chair and a plant. The haze is a Principled Volume box with
# drifting noise density and forward scattering; the dust motes are 3,000 points moved by 4D
# noise in Geometry Nodes, with a translucent material and the sun as the only light. Eevee
# volumetrics with volume shadows from the sun, slow dolly, shallow depth of field.
# Usage: blender -b -P god-rays.py -- <out_dir> [test_frames, comma separated]
import bpy, bmesh, sys, math, random
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:]
OUT = argv[0]
TEST = [int(x) for x in argv[1].split(",")] if len(argv) > 1 else None
FPS, FRAMES = 30, 240
random.seed(11)

bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
sc.render.fps = FPS
sc.frame_start, sc.frame_end = 1, FRAMES
sc.render.resolution_x, sc.render.resolution_y = 1280, 720
engines = [e.identifier for e in sc.render.bl_rna.properties["engine"].enum_items]
sc.render.engine = "BLENDER_EEVEE" if "BLENDER_EEVEE" in engines else "BLENDER_EEVEE_NEXT"
ee = sc.eevee
ee.taa_render_samples = 32
for attr, val in [("use_raytracing", True), ("use_shadows", True), ("use_gtao", True),
                  ("volumetric_tile_size", "2"), ("volumetric_samples", 128), ("volumetric_start", 0.1),
                  ("volumetric_end", 16.0), ("volumetric_shadow_samples", 32), ("use_volumetric_shadows", False)]:
    if hasattr(ee, attr):
        setattr(ee, attr, val)
sc.view_settings.view_transform = "AgX"
looks = [i.identifier for i in sc.view_settings.bl_rna.properties["look"].enum_items]
if "AgX - Medium High Contrast" in looks:
    sc.view_settings.look = "AgX - Medium High Contrast"
sc.render.image_settings.file_format = "PNG"
sc.render.filepath = OUT + "/f_"


def srgb(h):
    h = h.lstrip("#")
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c)


world = bpy.data.worlds.new("World"); sc.world = world
world.use_nodes = True
world.node_tree.nodes["Background"].inputs[0].default_value = (0.011, 0.013, 0.02, 1)


def pbr(name, hexcol, rough, metal=0.0):
    m = bpy.data.materials.new(name); m.use_nodes = True
    p = m.node_tree.nodes["Principled BSDF"]
    p.inputs["Base Color"].default_value = (*srgb(hexcol), 1)
    p.inputs["Roughness"].default_value = rough
    p.inputs["Metallic"].default_value = metal
    return m


def box(name, mat, lo, hi, rot=None, parent=None):
    # Axis-aligned box from corner lo to corner hi (before rotation about its center)
    lo, hi = Vector(lo), Vector(hi)
    bm = bmesh.new(); bmesh.ops.create_cube(bm, size=1.0)
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    me.materials.append(mat)
    ob = bpy.data.objects.new(name, me); sc.collection.objects.link(ob)
    ob.location = (lo + hi) / 2; ob.scale = hi - lo
    if rot:
        ob.rotation_euler = rot
    if parent:
        ob.parent = parent
    return ob


# ---- Materials ----
WALL = pbr("Wall", "#8a8076", 0.85)
TRIM = pbr("Trim", "#d9d2c5", 0.5)
SLAT = pbr("Slat", "#efe9dd", 0.45)
WOOD = pbr("ChairWood", "#5a3a26", 0.45)
POT = pbr("Pot", "#b5653f", 0.7)
LEAFM = pbr("Leaf", "#2f5a2c", 0.5)
BOOKS = [pbr("BookA", "#7a2e2a", 0.6), pbr("BookB", "#24384f", 0.6), pbr("BookC", "#c9a45a", 0.6)]

# Plank floor: wave bands for boards, noise for grain, darker gaps
FLOOR = bpy.data.materials.new("Floor"); FLOOR.use_nodes = True
nt = FLOOR.node_tree; n = nt.nodes; p = n["Principled BSDF"]
tc = n.new("ShaderNodeTexCoord")
mp = n.new("ShaderNodeMapping"); mp.inputs["Scale"].default_value = (1.0, 0.12, 1.0)
nt.links.new(tc.outputs["Object"], mp.inputs["Vector"])
grain = n.new("ShaderNodeTexNoise"); grain.inputs["Scale"].default_value = 30; grain.inputs["Detail"].default_value = 6
nt.links.new(mp.outputs[0], grain.inputs["Vector"])
planks = n.new("ShaderNodeTexWave"); planks.bands_direction = "X"; planks.inputs["Scale"].default_value = 3.2
planks.wave_profile = "SAW"; planks.inputs["Distortion"].default_value = 0.0
nt.links.new(tc.outputs["Object"], planks.inputs["Vector"])
gap = n.new("ShaderNodeMapRange"); gap.inputs["From Min"].default_value = 0.96; gap.inputs["From Max"].default_value = 0.985
gap.inputs["To Min"].default_value = 1.0; gap.inputs["To Max"].default_value = 0.25
nt.links.new(planks.outputs["Fac"], gap.inputs["Value"])
cr = n.new("ShaderNodeValToRGB")
cr.color_ramp.elements[0].color = (*srgb("#4a2f1f"), 1); cr.color_ramp.elements[1].color = (*srgb("#8a5a36"), 1)
nt.links.new(grain.outputs["Fac"], cr.inputs["Fac"])
mul = n.new("ShaderNodeMixRGB"); mul.blend_type = "MULTIPLY"; mul.inputs["Fac"].default_value = 1.0
nt.links.new(cr.outputs["Color"], mul.inputs["Color1"]); nt.links.new(gap.outputs["Result"], mul.inputs["Color2"])
nt.links.new(mul.outputs[0], p.inputs["Base Color"])
p.inputs["Roughness"].default_value = 0.32

# ---- Room: floor, back wall with a window opening, side walls and ceiling ----
X0, X1, Y0, Y1, H = -4.5, 4.5, -4.0, 4.0, 3.4
WX0, WX1, WZ0, WZ1 = 0.4, 2.6, 0.95, 2.65
box("Floor", FLOOR, (X0, Y0, -0.1), (X1, Y1, 0))
box("Ceiling", WALL, (X0, Y0, H), (X1, Y1, H + 0.1))
box("WallL", WALL, (X0 - 0.1, Y0, 0), (X0, Y1, H))
box("WallR", WALL, (X1, Y0, 0), (X1 + 0.1, Y1, H))
T = 0.25
box("BackA", WALL, (X0, Y1, 0), (WX0, Y1 + T, H))
box("BackB", WALL, (WX1, Y1, 0), (X1, Y1 + T, H))
box("BackC", WALL, (WX0, Y1, 0), (WX1, Y1 + T, WZ0))
box("BackD", WALL, (WX0, Y1, WZ1), (WX1, Y1 + T, H))
# Window trim and a sill
box("TrimL", TRIM, (WX0 - 0.08, Y1 - 0.03, WZ0 - 0.08), (WX0, Y1 + 0.02, WZ1 + 0.08))
box("TrimR", TRIM, (WX1, Y1 - 0.03, WZ0 - 0.08), (WX1 + 0.08, Y1 + 0.02, WZ1 + 0.08))
box("TrimT", TRIM, (WX0 - 0.08, Y1 - 0.03, WZ1), (WX1 + 0.08, Y1 + 0.02, WZ1 + 0.08))
box("Sill", TRIM, (WX0 - 0.15, Y1 - 0.14, WZ0 - 0.06), (WX1 + 0.15, Y1 + 0.05, WZ0))
box("Mullion", TRIM, ((WX0 + WX1) / 2 - 0.025, Y1 + 0.12, WZ0), ((WX0 + WX1) / 2 + 0.025, Y1 + 0.16, WZ1))
box("Baseboard", TRIM, (X0, Y1 - 0.03, 0), (X1, Y1, 0.14))

# Bright sky card outside so the window glows between the slats
sky = bpy.data.materials.new("Sky"); sky.use_nodes = True
sn = sky.node_tree.nodes; sn.remove(sn["Principled BSDF"])
em = sn.new("ShaderNodeEmission"); em.inputs["Color"].default_value = (*srgb("#ffe2b8"), 1); em.inputs["Strength"].default_value = 6.0
sky.node_tree.links.new(em.outputs[0], sn["Material Output"].inputs["Surface"])
skycard = box("SkyCard", sky, (WX0 - 3, Y1 + 3.0, WZ0 - 3), (WX1 + 3, Y1 + 3.1, WZ1 + 3))
skycard.visible_shadow = False

# ---- Venetian blinds: 22 slats on a head rail; they tilt open over the shot ----
NSL = 22
pitch = (WZ1 - WZ0 - 0.06) / NSL
slats = []
box("HeadRail", TRIM, (WX0 + 0.02, Y1 - 0.11, WZ1 - 0.06), (WX1 - 0.02, Y1 - 0.01, WZ1))
for i in range(NSL):
    z = WZ1 - 0.06 - (i + 0.5) * pitch
    piv = bpy.data.objects.new(f"SlatPivot{i}", None); sc.collection.objects.link(piv)
    piv.location = ((WX0 + WX1) / 2, Y1 - 0.06, z)
    box(f"Slat{i}", SLAT, (WX0 - 0.07 - piv.location.x, -0.045, -0.003), (WX1 + 0.07 - piv.location.x, 0.045, 0.003), parent=piv)
    slats.append(piv)
for x in (WX0 + 0.35, WX1 - 0.35):
    box("Cord", TRIM, (x - 0.004, Y1 - 0.065, WZ0 + 0.05), (x + 0.004, Y1 - 0.055, WZ1 - 0.06))
box("BottomRail", TRIM, (WX0 + 0.02, Y1 - 0.1, WZ0 + 0.02), (WX1 - 0.02, Y1 - 0.02, WZ0 + 0.05))


def ease(u):
    u = max(0.0, min(1.0, u))
    return u * u * u * (u * (u * 6 - 15) + 10)


# Tilt: from 72 degrees (about 8% of the sun gets through, thin blades) to 40 (about 78%),
# opening between frames 30 and 190, then held
for f in range(1, FRAMES + 1, 3):
    k = ease((f - 30) / 160)
    ang = math.radians(72 - 32 * k)
    for i, piv in enumerate(slats):
        piv.rotation_euler = (ang + math.radians(1.5) * math.sin(i * 0.9 + f * 0.05), 0, 0)
        piv.keyframe_insert("rotation_euler", frame=f)

# ---- Props in the light: chair, side table with books and a potted plant ----
chair = bpy.data.objects.new("Chair", None); sc.collection.objects.link(chair)
chair.location = (-0.2, 1.3, 0); chair.rotation_euler = (0, 0, math.radians(25))
for (x, y) in [(-0.22, -0.22), (0.22, -0.22), (-0.22, 0.22), (0.22, 0.22)]:
    box("Leg", WOOD, (x - 0.025, y - 0.025, 0), (x + 0.025, y + 0.025, 0.46), parent=chair)
box("Seat", WOOD, (-0.27, -0.27, 0.46), (0.27, 0.27, 0.5), parent=chair)
for x in (-0.22, 0.22):
    box("Post", WOOD, (x - 0.022, 0.2, 0.5), (x + 0.022, 0.244, 1.05), parent=chair)
for k in range(5):
    x = -0.16 + k * 0.08
    box("Spindle", WOOD, (x - 0.012, 0.212, 0.5), (x + 0.012, 0.236, 0.98), parent=chair)
box("Crest", WOOD, (-0.25, 0.2, 0.98), (0.25, 0.25, 1.07), parent=chair)

table = bpy.data.objects.new("Table", None); sc.collection.objects.link(table)
table.location = (2.4, 2.4, 0)
bpy.ops.mesh.primitive_cylinder_add(vertices=48, radius=0.36, depth=0.04, location=(0, 0, 0.62))
top = bpy.context.object; top.data.materials.append(WOOD); top.parent = table
bpy.ops.mesh.primitive_cylinder_add(vertices=16, radius=0.035, depth=0.6, location=(0, 0, 0.3))
stem = bpy.context.object; stem.data.materials.append(WOOD); stem.parent = table
bpy.ops.mesh.primitive_cylinder_add(vertices=32, radius=0.22, depth=0.03, location=(0, 0, 0.015))
foot = bpy.context.object; foot.data.materials.append(WOOD); foot.parent = table
zb = 0.64
for k, (w, d, h) in enumerate([(0.3, 0.22, 0.05), (0.26, 0.19, 0.04), (0.28, 0.2, 0.045)]):
    b = box("Book", BOOKS[k], (-w / 2, -d / 2, zb), (w / 2, d / 2, zb + h), parent=table)
    b.rotation_euler.z = math.radians(-12 + 14 * k)
    zb += h

pot = bpy.data.objects.new("Plant", None); sc.collection.objects.link(pot)
pot.location = (-1.6, 2.9, 0)
bpy.ops.mesh.primitive_cone_add(vertices=32, radius1=0.2, radius2=0.27, depth=0.45, location=(0, 0, 0.225))
po = bpy.context.object; po.data.materials.append(POT); po.parent = pot
for k in range(14):
    a = k / 14 * 2 * math.pi + random.uniform(-0.2, 0.2)
    tilt = random.uniform(0.35, 0.9)
    length = random.uniform(0.5, 0.85)
    bpy.ops.mesh.primitive_uv_sphere_add(segments=16, ring_count=8, radius=1.0, location=(0, 0, 0))
    leaf = bpy.context.object
    leaf.scale = (0.07, 0.18, 0.012)
    leaf.data.materials.append(LEAFM)
    bpy.ops.object.shade_smooth()
    stalk = bpy.data.objects.new("Stalk", None); sc.collection.objects.link(stalk)
    stalk.parent = pot; stalk.location = (0, 0, 0.42)
    stalk.rotation_euler = (tilt, 0, a)
    leaf.parent = stalk; leaf.location = (0, length * 0.75, length * 0.55)
    leaf.rotation_euler = (-0.3, 0, 0)

# ---- Haze: a volume box filling the room, density varied by slowly drifting noise ----
haze = box("Haze", bpy.data.materials.new("HazeMat"), (X0 + 0.05, Y0 + 0.05, 0.02), (X1 - 0.05, Y1 - 0.05, H - 0.02))
hm = haze.data.materials[0]; hm.use_nodes = True
hn = hm.node_tree.nodes; hn.remove(hn["Principled BSDF"])
vol = hn.new("ShaderNodeVolumePrincipled")
vol.inputs["Color"].default_value = (*srgb("#fff1dc"), 1)
vol.inputs["Anisotropy"].default_value = 0.55
htc = hn.new("ShaderNodeTexCoord")
hnz = hn.new("ShaderNodeTexNoise"); hnz.noise_dimensions = "4D"
hnz.inputs["Scale"].default_value = 0.9; hnz.inputs["Detail"].default_value = 3
hm.node_tree.links.new(htc.outputs["Object"], hnz.inputs["Vector"])
dmr = hn.new("ShaderNodeMapRange")
dmr.inputs["From Min"].default_value = 0.3; dmr.inputs["From Max"].default_value = 0.7
dmr.inputs["To Min"].default_value = 0.05; dmr.inputs["To Max"].default_value = 0.14
hm.node_tree.links.new(hnz.outputs["Fac"], dmr.inputs["Value"])
hm.node_tree.links.new(dmr.outputs["Result"], vol.inputs["Density"])
hm.node_tree.links.new(vol.outputs[0], hn["Material Output"].inputs["Volume"])
for f, w in [(1, 0.0), (FRAMES, 0.6)]:
    hnz.inputs["W"].default_value = w
    hnz.inputs["W"].keyframe_insert("default_value", frame=f)

# ---- Dust motes: random points moved by 4D noise in Geometry Nodes ----
def sock(coll, name):
    # First available socket with this name (some nodes keep hidden sockets of other types)
    for s_ in coll:
        if s_.name == name and not getattr(s_, "is_unavailable", False):
            return s_
    return coll[name]


NM = 3000
me = bpy.data.meshes.new("MotePoints")
me.from_pydata([(random.uniform(-1.8, 3.2), random.uniform(-0.8, 3.85), random.uniform(0.1, 3.1)) for _ in range(NM)], [], [])
motes = bpy.data.objects.new("Motes", me); sc.collection.objects.link(motes)
# Motes are mostly translucent: lit from behind by the sun, they glint toward the camera
MOTE = bpy.data.materials.new("Mote"); MOTE.use_nodes = True
mn = MOTE.node_tree.nodes; mn.remove(mn["Principled BSDF"])
tl = mn.new("ShaderNodeBsdfTranslucent"); tl.inputs["Color"].default_value = (1.0, 0.95, 0.85, 1)
df = mn.new("ShaderNodeBsdfDiffuse"); df.inputs["Color"].default_value = (0.6, 0.57, 0.52, 1)
mmix = mn.new("ShaderNodeMixShader"); mmix.inputs["Fac"].default_value = 0.25
MOTE.node_tree.links.new(tl.outputs[0], mmix.inputs[1]); MOTE.node_tree.links.new(df.outputs[0], mmix.inputs[2])
MOTE.node_tree.links.new(mmix.outputs[0], mn["Material Output"].inputs["Surface"])
ng = bpy.data.node_groups.new("Motes", "GeometryNodeTree")
ng.interface.new_socket(name="Geometry", in_out="INPUT", socket_type="NodeSocketGeometry")
ng.interface.new_socket(name="Geometry", in_out="OUTPUT", socket_type="NodeSocketGeometry")
N, Lk = ng.nodes, ng.links.new
gin = N.new("NodeGroupInput"); gout = N.new("NodeGroupOutput")
pos = N.new("GeometryNodeInputPosition"); tm = N.new("GeometryNodeInputSceneTime")
nz = N.new("ShaderNodeTexNoise"); nz.noise_dimensions = "4D"
nz.inputs["Scale"].default_value = 0.35; nz.inputs["Detail"].default_value = 1.0
Lk(pos.outputs["Position"], nz.inputs["Vector"])
tw = N.new("ShaderNodeMath"); tw.operation = "MULTIPLY"; tw.inputs[1].default_value = 0.05
Lk(tm.outputs["Seconds"], tw.inputs[0]); Lk(tw.outputs[0], nz.inputs["W"])
sub = N.new("ShaderNodeVectorMath"); sub.operation = "SUBTRACT"; sub.inputs[1].default_value = (0.5, 0.5, 0.5)
Lk(nz.outputs["Color"], sub.inputs[0])
amp = N.new("ShaderNodeVectorMath"); amp.operation = "SCALE"; amp.inputs["Scale"].default_value = 1.6
Lk(sub.outputs[0], amp.inputs[0])
fall_ = N.new("ShaderNodeCombineXYZ")
fz = N.new("ShaderNodeMath"); fz.operation = "MULTIPLY"; fz.inputs[1].default_value = -0.03
Lk(tm.outputs["Seconds"], fz.inputs[0]); Lk(fz.outputs[0], fall_.inputs["Z"])
add = N.new("ShaderNodeVectorMath"); add.operation = "ADD"
Lk(amp.outputs[0], add.inputs[0]); Lk(fall_.outputs[0], add.inputs[1])
sp = N.new("GeometryNodeSetPosition")
Lk(gin.outputs[0], sp.inputs["Geometry"]); Lk(add.outputs[0], sp.inputs["Offset"])
ico = N.new("GeometryNodeMeshIcoSphere"); ico.inputs["Radius"].default_value = 1.0; ico.inputs["Subdivisions"].default_value = 1
rv = N.new("FunctionNodeRandomValue"); rv.data_type = "FLOAT"
sock(rv.inputs, "Min").default_value = 0.0025; sock(rv.inputs, "Max").default_value = 0.006
inst = N.new("GeometryNodeInstanceOnPoints")
Lk(sp.outputs[0], inst.inputs["Points"]); Lk(ico.outputs["Mesh"], inst.inputs["Instance"])
Lk(sock(rv.outputs, "Value"), inst.inputs["Scale"])
sm = N.new("GeometryNodeSetMaterial"); sm.inputs["Material"].default_value = MOTE
Lk(inst.outputs[0], sm.inputs["Geometry"]); Lk(sm.outputs[0], gout.inputs[0])
motes.modifiers.new("Motes", "NODES").node_group = ng

# ---- Light: a strong low sun through the window is the only light, so motes show only in the beams ----
sun_d = bpy.data.lights.new("Sun", "SUN"); sun_d.energy = 9.0; sun_d.angle = math.radians(0.6)
sun_d.color = srgb("#ffd7a6")
if hasattr(sun_d, "volume_factor"):
    sun_d.volume_factor = 1.0
sun = bpy.data.objects.new("Sun", sun_d); sc.collection.objects.link(sun)
d = Vector((-0.42, -0.78, -0.47)).normalized()
sun.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()

# ---- Camera: slow dolly toward the window, focus on the shafts ----
cam_d = bpy.data.cameras.new("Cam"); cam_d.lens = 26
cam_d.dof.use_dof = True; cam_d.dof.aperture_fstop = 2.2
cam = bpy.data.objects.new("Cam", cam_d); sc.collection.objects.link(cam); sc.camera = cam
target = bpy.data.objects.new("Target", None); sc.collection.objects.link(target)
cam_d.dof.focus_object = target
tc_ = cam.constraints.new("TRACK_TO"); tc_.target = target; tc_.track_axis = "TRACK_NEGATIVE_Z"; tc_.up_axis = "UP_Y"
for f, cl, tl in [(1, (-3.3, -3.2, 1.35), (0.9, 2.2, 1.25)), (FRAMES, (-2.4, -2.1, 1.5), (1.1, 2.4, 1.3))]:
    cam.location = cl; cam.keyframe_insert("location", frame=f)
    target.location = tl; target.keyframe_insert("location", frame=f)


def fcurves(id_):
    act = id_.animation_data.action
    fcs = list(getattr(act, "fcurves", []) or [])
    for layer in getattr(act, "layers", []):
        for strip in layer.strips:
            for bag in strip.channelbags:
                fcs.extend(bag.fcurves)
    return fcs


for fc in fcurves(hm.node_tree):
    for kp in fc.keyframe_points:
        kp.interpolation = "LINEAR"

if TEST:
    for t in TEST:
        sc.frame_set(t)
        sc.render.filepath = OUT + f"/test_{t:04d}.png"
        bpy.ops.render.render(write_still=True)
else:
    bpy.ops.render.render(animation=True)
print("RENDER COMPLETE")
