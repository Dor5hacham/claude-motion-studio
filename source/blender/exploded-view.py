# Builds an exploded product view of a mechanical keyboard switch in Eevee. Seven parts made from
# primitives (bmesh, curves, Solidify and Bevel modifiers) fly apart along clean axes with a
# staggered QUINT ease, call-out labels draw on while the camera orbits the exploded stack, then
# the parts snap back in reverse order and the keycap presses once. Light studio cyc, soft key and
# rim lights, clear plastic housing with raytraced refraction.
# Usage: blender -b -P exploded-view.py -- <out_dir> [test_frame[,test_frame...]]
import bpy, bmesh, sys, math
from mathutils import Matrix

argv = sys.argv[sys.argv.index("--") + 1:]
OUT = argv[0]
TESTS = [int(x) for x in argv[1].split(",")] if len(argv) > 1 else []
FPS, FRAMES = 30, 270
FLOOR = -1.3

bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
sc.render.fps = FPS
sc.frame_start, sc.frame_end = 1, FRAMES
sc.render.resolution_x, sc.render.resolution_y = 1280, 720
engines = [e.identifier for e in sc.render.bl_rna.properties["engine"].enum_items]
sc.render.engine = "BLENDER_EEVEE" if "BLENDER_EEVEE" in engines else "BLENDER_EEVEE_NEXT"
ee = sc.eevee
ee.taa_render_samples = 96
for attr, val in [("use_raytracing", True), ("use_shadows", True), ("use_gtao", True)]:
    if hasattr(ee, attr):
        setattr(ee, attr, val)
if hasattr(ee, "ray_tracing_options"):
    ee.ray_tracing_options.resolution_scale = "1"     # full-res refraction
    ee.ray_tracing_options.trace_max_roughness = 0.3        # rough plastics use the smooth probe fallback (no grain)
if hasattr(sc.render, "use_motion_blur"):
    sc.render.use_motion_blur = True
    sc.render.motion_blur_shutter = 0.5
vts = [i.identifier for i in sc.view_settings.bl_rna.properties["view_transform"].enum_items]
sc.view_settings.view_transform = "Khronos PBR Neutral" if "Khronos PBR Neutral" in vts else "AgX"
sc.render.image_settings.file_format = "PNG"
sc.render.filepath = OUT + "/f_"

world = bpy.data.worlds.new("World")
sc.world = world
world.use_nodes = True
world.node_tree.nodes["Background"].inputs[0].default_value = (0.32, 0.31, 0.30, 1)
world.node_tree.nodes["Background"].inputs[1].default_value = 0.4

# ---- Materials ----
def principled(name, color, rough, metal=0.0, coat=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    p = m.node_tree.nodes["Principled BSDF"]
    p.inputs["Base Color"].default_value = color
    p.inputs["Roughness"].default_value = rough
    p.inputs["Metallic"].default_value = metal
    if "Coat Weight" in p.inputs:
        p.inputs["Coat Weight"].default_value = coat
        p.inputs["Coat Roughness"].default_value = 0.08
    return m, p

cap_mat, _ = principled("Keycap", (1.0, 0.075, 0.018, 1), 0.48, coat=0.1)
stem_mat, _ = principled("Stem", (1.0, 0.45, 0.03, 1), 0.3)
base_mat, _ = principled("Base", (0.022, 0.022, 0.026, 1), 0.45)
steel_mat, _ = principled("Steel", (0.86, 0.87, 0.9, 1), 0.18, metal=1.0)
gold_mat, _ = principled("Gold", (1.0, 0.72, 0.36, 1), 0.2, metal=1.0)
clear_mat, cp = principled("Clear", (0.78, 0.87, 0.96, 1), 0.06)
cp.inputs["Transmission Weight"].default_value = 1.0
cp.inputs["IOR"].default_value = 1.49
clear_mat.use_raytrace_refraction = True
clear_mat.thickness_mode = "SLAB"
cyc_mat, cyp = principled("Cyc", (0.42, 0.41, 0.39, 1), 0.5)
if "Specular IOR Level" in cyp.inputs:
    cyp.inputs["Specular IOR Level"].default_value = 0.2
# A constant glow evens out the light falloff, so the backdrop reads as one seamless tone
cyp.inputs["Emission Color"].default_value = (0.62, 0.6, 0.57, 1)
cyp.inputs["Emission Strength"].default_value = 0.55

def flat_mat(name, color):
    """Unlit ink for call-outs. Opacity comes from each object's color alpha, so labels fade one by one."""
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.remove(nt.nodes["Principled BSDF"])
    oi = nt.nodes.new("ShaderNodeObjectInfo")
    tr = nt.nodes.new("ShaderNodeBsdfTransparent")
    em = nt.nodes.new("ShaderNodeEmission"); em.inputs["Color"].default_value = color
    mx = nt.nodes.new("ShaderNodeMixShader")
    nt.links.new(oi.outputs["Alpha"], mx.inputs["Fac"])
    nt.links.new(tr.outputs[0], mx.inputs[1]); nt.links.new(em.outputs[0], mx.inputs[2])
    nt.links.new(mx.outputs[0], nt.nodes["Material Output"].inputs["Surface"])
    return m

ink_mat = flat_mat("Ink", (0.012, 0.013, 0.018, 1))
dot_mat = flat_mat("Dot", (1.0, 0.16, 0.05, 1))

# ---- Part builders (all geometry in assembled world coordinates, object origin at 0) ----
def mesh_obj(name, bm, mat, smooth=True):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me); bm.free()
    if smooth:
        for p in me.polygons:
            p.use_smooth = True
    ob = bpy.data.objects.new(name, me)
    sc.collection.objects.link(ob)
    me.materials.append(mat)
    return ob

def add_box(bm, x0, x1, y0, y1, z0, z1):
    r = bmesh.ops.create_cube(bm, size=1.0)
    for v in r["verts"]:
        v.co.x = x0 if v.co.x < 0 else x1
        v.co.y = y0 if v.co.y < 0 else y1
        v.co.z = z0 if v.co.z < 0 else z1
    return r["verts"]

def add_cyl(bm, x, y, z0, z1, r, seg=24):
    res = bmesh.ops.create_cone(bm, cap_ends=True, segments=seg, radius1=r, radius2=r, depth=z1 - z0,
                                matrix=Matrix.Translation((x, y, (z0 + z1) / 2)))
    return res["verts"]

def bevel(ob, width, seg=3, angle=40):
    b = ob.modifiers.new("Bevel", "BEVEL")
    b.width = width; b.segments = seg; b.limit_method = "ANGLE"; b.angle_limit = math.radians(angle)
    b.use_clamp_overlap = True; b.harden_normals = True
    return b

# Keycap: tapered cap with a soft rounded profile
bm = bmesh.new()
for v in add_box(bm, -0.49, 0.49, -0.49, 0.49, 0.92, 1.34):
    if v.co.z > 1.0:
        v.co.x *= 0.76; v.co.y = v.co.y * 0.78 + 0.03
keycap = mesh_obj("Keycap", bm, cap_mat)
bevel(keycap, 0.07, 5, 30)

# Top housing: open shell with a square hole for the stem, given wall thickness by Solidify
bm = bmesh.new()
add_box(bm, -0.5, 0.5, -0.5, 0.5, 0.34, 0.64)
for v in bm.verts:
    if v.co.z > 0.5:
        v.co.x *= 0.9; v.co.y *= 0.9
bot = [f for f in bm.faces if f.normal.z < -0.9]
top = [f for f in bm.faces if f.normal.z > 0.9]
bmesh.ops.inset_individual(bm, faces=top, thickness=0.26)
bmesh.ops.delete(bm, geom=bot + top, context="FACES_ONLY")
housing = mesh_obj("TopHousing", bm, clear_mat, smooth=False)
housing.visible_shadow = False      # its dithered shadow speckled the base top seen through it
so = housing.modifiers.new("Solidify", "SOLIDIFY"); so.thickness = 0.04; so.offset = -1.0
bevel(housing, 0.012, 2, 40)

# Stem: amber body plate, cross-shaped mount on top, guide post below
bm = bmesh.new()
add_box(bm, -0.21, 0.21, -0.15, 0.15, 0.46, 0.60)
add_box(bm, -0.13, 0.13, -0.035, 0.035, 0.60, 1.10)
add_box(bm, -0.035, 0.035, -0.13, 0.13, 0.60, 1.10)
add_cyl(bm, 0, 0, 0.22, 0.46, 0.055)
stem = mesh_obj("Stem", bm, stem_mat, smooth=False)
bevel(stem, 0.012, 2)

# Spring: helix curve with a round bevel, origin at its base so scaling Z compresses it
SPRING_Z0, SPRING_H, COILS = 0.06, 0.40, 7
cu = bpy.data.curves.new("Spring", "CURVE"); cu.dimensions = "3D"
cu.bevel_depth = 0.016; cu.bevel_resolution = 3
spl = cu.splines.new("POLY")
N = COILS * 36
spl.points.add(N)
for i in range(N + 1):
    t = i / N
    a = t * COILS * 2 * math.pi
    spl.points[i].co = (0.125 * math.cos(a), 0.125 * math.sin(a), SPRING_H * t, 1)
spring = bpy.data.objects.new("Spring", cu); sc.collection.objects.link(spring)
cu.materials.append(steel_mat)
spring.location.z = SPRING_Z0

# Bottom housing: dark base with a centre post underneath
bm = bmesh.new()
add_box(bm, -0.5, 0.5, -0.5, 0.5, 0.0, 0.34)
add_cyl(bm, 0, 0, -0.18, 0.0, 0.09)
add_cyl(bm, -0.3, 0.3, -0.12, 0.0, 0.05, 16)
add_cyl(bm, 0.3, 0.3, -0.12, 0.0, 0.05, 16)
base = mesh_obj("BottomHousing", bm, base_mat, smooth=False)
bevel(base, 0.02, 3)

# Contact leaves: two thin gold plates standing on the base, inside the clear housing
bm = bmesh.new()
add_box(bm, -0.36, -0.33, -0.2, 0.02, 0.34, 0.56)
add_box(bm, -0.30, -0.27, 0.06, 0.26, 0.34, 0.50)
contacts = mesh_obj("Contacts", bm, gold_mat, smooth=False)
bevel(contacts, 0.006, 1)

# Pins: two gold legs under the base
bm = bmesh.new()
add_cyl(bm, -0.22, 0.24, -0.34, 0.02, 0.024, 16)
add_cyl(bm, 0.18, -0.08, -0.34, 0.02, 0.024, 16)
pins = mesh_obj("Pins", bm, gold_mat)

# ---- Keyframe helpers ----
def all_fcurves(idb):
    ad = idb.animation_data
    if not ad or not ad.action:
        return []
    act = ad.action
    fcs = list(getattr(act, "fcurves", []) or [])
    for layer in getattr(act, "layers", []):
        for strip in layer.strips:
            for bag in strip.channelbags:
                fcs.extend(bag.fcurves)
    return fcs

def ease(idb, path, frame, interp, easing="EASE_IN_OUT", back=None):
    """Sets the interpolation of the segment that starts at `frame` on every channel of `path`."""
    for fc in all_fcurves(idb):
        if fc.data_path == path:
            for kp in fc.keyframe_points:
                if abs(kp.co.x - frame) < 0.5:
                    kp.interpolation = interp
                    kp.easing = easing
                    if back is not None:
                        kp.back = back

def key(ob, path, frame, value):
    setattr(ob, path, value)
    ob.keyframe_insert(path, frame=frame)

# ---- Choreography ----
D = 32                    # frames per part move
# (object, explode start, reassemble start, offset (dx, dz))
PARTS = [
    (keycap,   22, 188, (0.0, 2.05)),
    (housing,  27, 183, (0.0, 1.95)),
    (stem,     32, 178, (0.0, 0.95)),
    (spring,   37, 173, (0.0, 0.45)),
    (contacts, 42, 168, (-1.0, 0.0)),
    (pins,     42, 168, (0.0, -0.55)),
]
for ob, t_out, t_in, (dx, dz) in PARTS:
    x0, z0 = ob.location.x, ob.location.z
    key(ob, "location", 1, (x0, 0, z0))
    key(ob, "location", t_out, (x0, 0, z0))
    key(ob, "location", t_out + D, (x0 + dx, 0, z0 + dz))
    key(ob, "location", t_in, (x0 + dx, 0, z0 + dz))
    key(ob, "location", t_in + D, (x0, 0, z0))
    ease(ob, "location", t_out, "QUINT")
    ease(ob, "location", t_in, "QUINT")

# The keycap press: cap and stem travel 0.22 down fast, spring compresses, release with overshoot
PRESS, DOWN, UP = 230, 236, 254
for ob in (keycap, stem):
    key(ob, "location", PRESS, (0, 0, 0))
    key(ob, "location", DOWN, (0, 0, -0.22))
    key(ob, "location", UP, (0, 0, 0))
    ease(ob, "location", PRESS, "QUAD", "EASE_IN")
    ease(ob, "location", DOWN, "BACK", "EASE_OUT", back=2.4)
key(spring, "scale", PRESS, (1, 1, 1))
key(spring, "scale", DOWN, (1, 1, (SPRING_H - 0.22) / SPRING_H))
key(spring, "scale", UP, (1, 1, 1))
ease(spring, "scale", PRESS, "QUAD", "EASE_IN")
ease(spring, "scale", DOWN, "BACK", "EASE_OUT", back=2.4)

# ---- Cyc: floor curving up into a back wall, no horizon line ----
cbm = bmesh.new()
CW, CD, CH = 90.0, 12.0, 40.0
cv = [cbm.verts.new(v) for v in [(-CW / 2, -40, FLOOR), (CW / 2, -40, FLOOR), (CW / 2, CD, FLOOR),
                                  (-CW / 2, CD, FLOOR), (CW / 2, CD, CH), (-CW / 2, CD, CH)]]
cbm.faces.new([cv[0], cv[1], cv[2], cv[3]])
cbm.faces.new([cv[3], cv[2], cv[4], cv[5]])
cyc = mesh_obj("Cyc", cbm, cyc_mat)
cbv = cyc.modifiers.new("Bevel", "BEVEL"); cbv.width = 9.0; cbv.segments = 48; cbv.limit_method = "ANGLE"

# ---- Camera rig: a pivot that orbits at constant speed; the camera dollies on its arm ----
pivot = bpy.data.objects.new("Pivot", None); sc.collection.objects.link(pivot)
cam_d = bpy.data.cameras.new("Cam"); cam_d.lens = 50
cam_d.dof.use_dof = True; cam_d.dof.aperture_fstop = 4.0; cam_d.dof.focus_object = pivot
cam = bpy.data.objects.new("Cam", cam_d); sc.collection.objects.link(cam)
cam.parent = pivot
sc.camera = cam
tc = cam.constraints.new("TRACK_TO"); tc.target = pivot
tc.track_axis = "TRACK_NEGATIVE_Z"; tc.up_axis = "UP_Y"
key(pivot, "rotation_euler", 1, (0, 0, math.radians(-38)))
key(pivot, "rotation_euler", FRAMES, (0, 0, math.radians(26)))
ease(pivot, "rotation_euler", 1, "LINEAR")
# (frame, pivot z, arm distance, arm height)
for f, pz, dist, h in [(1, 0.52, 5.6, 1.45), (6, 0.52, 5.5, 1.45), (66, 1.25, 13.4, 3.0),
                       (172, 1.25, 13.9, 3.1), (226, 0.52, 5.9, 1.5), (FRAMES, 0.52, 5.5, 1.35)]:
    key(pivot, "location", f, (0, 0, pz))
    key(cam, "location", f, (0, -dist, h))
for f in (6, 172):
    ease(pivot, "location", f, "CUBIC")
    ease(cam, "location", f, "CUBIC")

# ---- Call-out labels: dot on the part, leader line, billboard text ----
font = bpy.data.fonts.load(r"C:\Windows\Fonts\bahnschrift.ttf")
LABELS = [  # (text, anchor x, anchor z, side, appear frame)
    ("01  Keycap", 0.56, 3.18, 1, 66),
    ("02  Top housing", 0.6, 2.44, 1, 71),
    ("03  Stem", 0.3, 1.53, 1, 76),
    ("04  Spring", 0.24, 0.71, 1, 81),
    ("05  Contacts", -1.45, 0.46, -1, 86),
    ("06  Bottom housing", 0.62, 0.17, 1, 91),
    ("07  Pins", 0.28, -0.69, 1, 96),
]
LINE_END = 1.35
HIDE = 148
for i, (txt, ax, az, side, t0) in enumerate(LABELS):
    end_x = LINE_END * side if side > 0 else -1.95
    length = abs(end_x - ax)
    # Dot
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=16, v_segments=8, radius=0.03)
    dot = mesh_obj(f"Dot_{i}", bm, dot_mat)
    dot.location = (ax, -0.0, az)
    # Line: a thin rod from x=0 to x=1, scaled to its length (scale X animates the draw-on)
    bm = bmesh.new()
    add_cyl(bm, 0, 0, 0, 1, 0.0065, 8)
    for v in bm.verts:
        v.co = (v.co.z * side, v.co.y, v.co.x)
    line = mesh_obj(f"Line_{i}", bm, ink_mat)
    line.location = (ax, 0, az)
    # Text: billboard that copies the camera rotation
    tcu = bpy.data.curves.new(f"Label_{i}", "FONT")
    tcu.body = txt; tcu.font = font; tcu.size = 0.2
    tcu.align_x = "LEFT" if side > 0 else "RIGHT"; tcu.align_y = "CENTER"
    tcu.materials.append(ink_mat)
    text = bpy.data.objects.new(f"Label_{i}", tcu); sc.collection.objects.link(text)
    tx = end_x + 0.1 * side
    cr = text.constraints.new("COPY_ROTATION"); cr.target = cam
    hide = HIDE + i * 2
    for ob in (dot, line, text):
        ob.color = (1, 1, 1, 0)
        ob.keyframe_insert("color", index=3, frame=t0)
    for ob, at in ((dot, t0 + 3), (line, t0 + 4), (text, t0 + 12)):
        ob.color[3] = 1.0
        ob.keyframe_insert("color", index=3, frame=at)
        ob.keyframe_insert("color", index=3, frame=hide)
        ob.color[3] = 0.0
        ob.keyframe_insert("color", index=3, frame=hide + 8)
    key(line, "scale", t0, (0.001, 1, 1))
    key(line, "scale", t0 + 10, (length, 1, 1))
    ease(line, "scale", t0, "CUBIC", "EASE_OUT")
    key(text, "location", t0 + 4, (tx - 0.12 * side, 0, az))
    key(text, "location", t0 + 16, (tx, 0, az))
    ease(text, "location", t0 + 4, "CUBIC", "EASE_OUT")

# ---- Lights ----
aim = bpy.data.objects.new("Aim", None); sc.collection.objects.link(aim)
aim.location = (0, 0, 1.0)
def area(name, loc, color, power, size, size_y=None, spec=1.0):
    d = bpy.data.lights.new(name, "AREA"); d.color = color; d.energy = power
    if size_y:
        d.shape = "RECTANGLE"; d.size = size; d.size_y = size_y
    else:
        d.shape = "DISK"; d.size = size
    d.specular_factor = spec
    o = bpy.data.objects.new(name, d); sc.collection.objects.link(o)
    o.location = loc
    c = o.constraints.new("TRACK_TO"); c.target = aim
    c.track_axis = "TRACK_NEGATIVE_Z"; c.up_axis = "UP_Y"
    return o
area("Key", (-5, -6, 7), (1.0, 0.95, 0.9), 800, 5)
area("Fill", (6, -5, 2.5), (0.85, 0.9, 1.0), 380, 4)
area("RimL", (-4.5, 4, 3.5), (1.0, 0.97, 0.94), 900, 0.6, 5)
area("RimR", (4.5, 4, 3.5), (1.0, 0.97, 0.94), 900, 0.6, 5)
area("Top", (0, 0.5, 8), (1.0, 1.0, 1.0), 300, 3)

# ---- Render ----
if TESTS:
    for f in TESTS:
        sc.frame_set(f)
        sc.render.filepath = OUT + f"/test_{f:04d}.png"
        bpy.ops.render.render(write_still=True)
else:
    bpy.ops.render.render(animation=True)
print("RENDER COMPLETE")
