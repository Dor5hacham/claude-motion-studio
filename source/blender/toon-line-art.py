# Copyright (c) 2026 Dor5hacham d5shacham@gmail.com. All rights reserved.
# SPDX-License-Identifier: Proprietary

# Builds an anime-style floating island above a sea of clouds: a cottage, a windmill with
# turning sails, round trees, a pond that spills into a waterfall and small rocks that bob.
# Every surface uses a toon material (Diffuse BSDF -> Shader to RGB -> constant color ramp),
# so light falls into two or three flat bands. Outlines come from a Grease Pencil Line Art
# modifier (contours, creases and intersections) recomputed for every frame. The sky is a
# flat gradient seen only by the camera. Eevee, Standard view transform, slow orbit.
# Usage: blender -b -P toon-line-art.py -- <out_dir> [test_frames, comma separated]
import bpy, bmesh, sys, math, random
from mathutils import Vector, noise

argv = sys.argv[sys.argv.index("--") + 1:]
OUT = argv[0]
TEST = [int(x) for x in argv[1].split(",")] if len(argv) > 1 else None
FPS, FRAMES = 30, 240
random.seed(7)

bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
sc.render.fps = FPS
sc.frame_start, sc.frame_end = 1, FRAMES
sc.render.resolution_x, sc.render.resolution_y = 1280, 720
engines = [e.identifier for e in sc.render.bl_rna.properties["engine"].enum_items]
sc.render.engine = "BLENDER_EEVEE" if "BLENDER_EEVEE" in engines else "BLENDER_EEVEE_NEXT"
ee = sc.eevee
ee.taa_render_samples = 16
for attr, val in [("use_shadows", True), ("use_raytracing", False), ("use_gtao", False)]:
    if hasattr(ee, attr):
        setattr(ee, attr, val)
sc.view_settings.view_transform = "Standard"
sc.render.image_settings.file_format = "PNG"
sc.render.filepath = OUT + "/f_"


def srgb(h):
    h = h.lstrip("#")
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c)


# ---- Sky: a flat gradient for the camera, dim gray light for the shading ----
world = bpy.data.worlds.new("World"); sc.world = world
world.use_nodes = True
wn, wl = world.node_tree.nodes, world.node_tree.links.new
tc = wn.new("ShaderNodeTexCoord")
sep = wn.new("ShaderNodeSeparateXYZ"); wl(tc.outputs["Generated"], sep.inputs[0])
mr = wn.new("ShaderNodeMapRange"); mr.inputs["From Min"].default_value = -0.45; mr.inputs["From Max"].default_value = 0.45
wl(sep.outputs["Z"], mr.inputs["Value"])
sky = wn.new("ShaderNodeValToRGB"); cr = sky.color_ramp
cr.elements[0].position, cr.elements[0].color = 0.0, (*srgb("#fbe9d2"), 1)
cr.elements[1].position, cr.elements[1].color = 1.0, (*srgb("#2a63c9"), 1)
for p, h in [(0.18, "#f7d9c4"), (0.42, "#8fc3f0"), (0.7, "#4a86dc")]:
    e = cr.elements.new(p); e.color = (*srgb(h), 1)
wl(mr.outputs["Result"], sky.inputs["Fac"])
bg_cam = wn.new("ShaderNodeBackground"); wl(sky.outputs["Color"], bg_cam.inputs["Color"])
bg_light = wn.new("ShaderNodeBackground"); bg_light.inputs["Color"].default_value = (0.06, 0.065, 0.08, 1)
lp = wn.new("ShaderNodeLightPath")
mix = wn.new("ShaderNodeMixShader")
wl(lp.outputs["Is Camera Ray"], mix.inputs["Fac"])
wl(bg_light.outputs[0], mix.inputs[1]); wl(bg_cam.outputs[0], mix.inputs[2])
wl(mix.outputs[0], wn["World Output"].inputs["Surface"])
wn.remove(wn["Background"])


# ---- Toon materials: lighting -> Shader to RGB -> constant ramp of hand-picked colors ----
def toon(name, bands):
    # bands: list of (threshold, hex) from darkest to brightest
    m = bpy.data.materials.new(name); m.use_nodes = True
    nt = m.node_tree; n = nt.nodes
    n.remove(n["Principled BSDF"])
    d = n.new("ShaderNodeBsdfDiffuse"); d.inputs["Color"].default_value = (1, 1, 1, 1)
    s2r = n.new("ShaderNodeShaderToRGB"); nt.links.new(d.outputs[0], s2r.inputs[0])
    r = n.new("ShaderNodeValToRGB"); r.color_ramp.interpolation = "CONSTANT"
    el = r.color_ramp.elements
    el[0].position, el[0].color = 0.0, (*srgb(bands[0][1]), 1)
    el[1].position, el[1].color = bands[1][0], (*srgb(bands[1][1]), 1)
    for t, h in bands[2:]:
        e = el.new(t); e.color = (*srgb(h), 1)
    nt.links.new(s2r.outputs["Color"], r.inputs["Fac"])
    em = n.new("ShaderNodeEmission"); nt.links.new(r.outputs["Color"], em.inputs["Color"])
    nt.links.new(em.outputs[0], n["Material Output"].inputs["Surface"])
    return m


GRASS = toon("Grass", [(0, "#3d8a52"), (0.16, "#6cbf55"), (0.62, "#a6dc6a")])
ROCK = toon("Rock", [(0, "#5b3a3a"), (0.16, "#a5684a"), (0.6, "#d39a6a")])
WALL = toon("Wall", [(0, "#b7a99a"), (0.16, "#f4efe6"), (0.65, "#fffaf1")])
ROOF = toon("Roof", [(0, "#a8322a"), (0.16, "#ff5a36"), (0.62, "#ff8a5c")])
WOOD = toon("Wood", [(0, "#4a2f2a"), (0.16, "#7a4b34"), (0.6, "#9c6644")])
LEAF = toon("Leaf", [(0, "#24614a"), (0.16, "#3f9a58"), (0.6, "#7cc760")])
LEAF2 = toon("Leaf2", [(0, "#2b5a5c"), (0.16, "#4f9e7a"), (0.6, "#8fd08a")])
CLOUD = toon("Cloud", [(0, "#a9bde8"), (0.14, "#dfe8fb"), (0.5, "#ffffff")])
WATER = toon("Pond", [(0, "#2a6bb8"), (0.16, "#4fa3e0"), (0.6, "#8fd3f5")])
NAVYM = toon("Navy", [(0, "#141c33"), (0.16, "#1f2b4d"), (0.6, "#33467a")])
GLOW = bpy.data.materials.new("Window"); GLOW.use_nodes = True
gp_ = GLOW.node_tree.nodes["Principled BSDF"]
gp_.inputs["Base Color"].default_value = (*srgb("#ffc24a"), 1)
gp_.inputs["Emission Color"].default_value = (*srgb("#ffc24a"), 1)
gp_.inputs["Emission Strength"].default_value = 1.0


def link(ob, parent=None):
    sc.collection.objects.link(ob)
    if parent:
        ob.parent = parent
    return ob


def mesh_obj(name, bm, mats, parent=None, smooth=False):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me); bm.free()
    for m in mats:
        me.materials.append(m)
    for p in me.polygons:
        p.use_smooth = smooth
    return link(bpy.data.objects.new(name, me), parent)


def prim(kind, name, mat, loc, parent, smooth=False, **kw):
    bm = bmesh.new()
    if kind == "cube":
        bmesh.ops.create_cube(bm, size=1.0)
    elif kind == "ico":
        bmesh.ops.create_icosphere(bm, subdivisions=kw.get("sub", 3), radius=1.0)
    elif kind == "cone":
        bmesh.ops.create_cone(bm, cap_ends=True, segments=kw.get("seg", 8), radius1=kw["r1"], radius2=kw["r2"], depth=kw["depth"])
    ob = mesh_obj(name, bm, [mat], parent, smooth)
    ob.location = loc
    ob.scale = kw.get("scale", (1, 1, 1))
    ob.rotation_euler = kw.get("rot", (0, 0, 0))
    return ob


# ---- Island: polar rings from the grassy dome down to a jagged rock point ----
isle = link(bpy.data.objects.new("Island", None))
SEG = 30
RINGS = [(0.0, 0.42), (0.3, 0.40), (0.6, 0.30), (0.84, 0.15), (1.0, 0.0), (1.03, -0.2), (0.95, -0.34),
         (0.84, -0.95), (0.66, -1.75), (0.45, -2.6), (0.24, -3.4), (0.08, -4.1)]
GRASS_RINGS = 6


def rim(a):
    return 3.1 * (1 + 0.1 * math.sin(3 * a + 1.0) + 0.06 * math.sin(5 * a + 2.0) + 0.03 * math.sin(9 * a))


bm = bmesh.new()
rings = []
center = bm.verts.new((0, 0, RINGS[0][1]))
for ri, (rf, z) in enumerate(RINGS):
    if ri == 0:
        continue
    ring = []
    for s in range(SEG):
        a = s / SEG * 2 * math.pi
        r = rf * rim(a)
        zz = z
        if ri >= GRASS_RINGS:
            k = noise.noise(Vector((math.cos(a) * 2.1, math.sin(a) * 2.1, z * 0.9)))
            r *= 1 + 0.16 * k
            zz += 0.25 * noise.noise(Vector((a * 1.7, z, 3.3)))
        ring.append(bm.verts.new((r * math.cos(a), r * math.sin(a), zz)))
    rings.append(ring)
apex = bm.verts.new((0.15, -0.1, -4.9))
for s in range(SEG):
    bm.faces.new((center, rings[0][(s + 1) % SEG], rings[0][s])).material_index = 0
for ri in range(len(rings) - 1):
    for s in range(SEG):
        a, b = rings[ri][s], rings[ri][(s + 1) % SEG]
        c, d = rings[ri + 1][(s + 1) % SEG], rings[ri + 1][s]
        f = bm.faces.new((a, d, c, b))
        f.material_index = 0 if ri < GRASS_RINGS - 2 else 1
for s in range(SEG):
    f = bm.faces.new((rings[-1][s], apex, rings[-1][(s + 1) % SEG]))
    f.material_index = 1
bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
island = mesh_obj("IslandMesh", bm, [GRASS, ROCK], isle)
for p in island.data.polygons:
    p.use_smooth = p.material_index == 0


def top_z(x, y):
    # Height of the grass dome at (x, y): interpolates the ring heights by radius fraction
    a = math.atan2(y, x) % (2 * math.pi)
    rf = math.hypot(x, y) / rim(a)
    for (r0, z0), (r1, z1) in zip(RINGS, RINGS[1:]):
        if r0 <= rf <= r1:
            return z0 + (z1 - z0) * (rf - r0) / (r1 - r0)
    return 0.0


# ---- Cottage ----
HX, HY = -0.95, 0.55
hz = top_z(HX, HY)
house = link(bpy.data.objects.new("House", None), isle)
house.location = (HX, HY, hz - 0.05); house.rotation_euler = (0, 0, math.radians(-18))
prim("cube", "Walls", WALL, (0, 0, 0.42), house, scale=(1.2, 0.9, 0.84))
bm = bmesh.new()
w, d, h = 0.72, 0.56, 0.62
vs = [bm.verts.new(v) for v in [(-w, -d, 0), (w, -d, 0), (w, d, 0), (-w, d, 0), (-w, 0, h), (w, 0, h)]]
for f in [(0, 1, 5, 4), (2, 3, 4, 5), (0, 4, 3), (1, 2, 5), (0, 3, 2, 1)]:
    bm.faces.new([vs[i] for i in f])
bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
roof = mesh_obj("Roof", bm, [ROOF], house); roof.location = (0, 0, 0.84)
prim("cube", "Chimney", WALL, (0.35, 0.22, 1.25), house, scale=(0.16, 0.16, 0.5))
prim("cube", "Door", WOOD, (0.25, -0.452, 0.24), house, scale=(0.24, 0.02, 0.44))
for x in (-0.3,):
    prim("cube", "Window", GLOW, (x, -0.452, 0.5), house, scale=(0.22, 0.02, 0.2))
prim("cube", "WindowSide", GLOW, (-0.602, 0.0, 0.5), house, scale=(0.02, 0.22, 0.2))

# ---- Windmill: tapered tower, cone cap and four sails on a turning hub ----
MX, MY = 1.25, -0.2
mz = top_z(MX, MY)
mill = link(bpy.data.objects.new("Mill", None), isle)
mill.location = (MX, MY, mz - 0.05)
prim("cone", "Tower", WALL, (0, 0, 0.95), mill, seg=8, r1=0.48, r2=0.3, depth=1.9)
prim("cone", "Cap", NAVYM, (0, 0, 2.12), mill, seg=8, r1=0.42, r2=0.0, depth=0.55)
hub = link(bpy.data.objects.new("Hub", None), mill)
hub.location = (0, -0.42, 1.75)
prim("cube", "Axle", WOOD, (0, 0.1, 0), hub, scale=(0.12, 0.3, 0.12))
for i in range(4):
    arm = link(bpy.data.objects.new(f"Arm{i}", None), hub)
    arm.rotation_euler = (0, math.radians(i * 90 + 15), 0)
    prim("cube", f"Spar{i}", WOOD, (0, 0, 0.62), arm, scale=(0.05, 0.04, 1.2))
    prim("cube", f"Sail{i}", WALL, (0.13, -0.01, 0.75), arm, scale=(0.22, 0.02, 0.9))
hub.rotation_euler = (0, 0, 0)
hub.keyframe_insert("rotation_euler", frame=1)
hub.rotation_euler = (0, math.radians(-200), 0)
hub.keyframe_insert("rotation_euler", frame=FRAMES)

# ---- Trees: trunk plus two or three smooth foliage blobs ----
for (tx, ty, s, mat) in [(-2.1, -0.6, 1.0, LEAF), (0.1, 1.6, 1.15, LEAF2), (-1.1, -1.55, 0.8, LEAF), (2.0, 1.0, 0.9, LEAF2), (-1.9, 1.5, 0.7, LEAF)]:
    tz = top_z(tx, ty)
    tree = link(bpy.data.objects.new("Tree", None), isle)
    tree.location = (tx, ty, tz - 0.05); tree.scale = (s, s, s)
    prim("cone", "Trunk", WOOD, (0, 0, 0.35), tree, seg=6, r1=0.11, r2=0.07, depth=0.7)
    for (bx, by, bz, br) in [(0, 0, 0.95, 0.5), (0.25, 0.1, 0.75, 0.34), (-0.22, -0.08, 0.78, 0.32)]:
        prim("ico", "Foliage", mat, (bx, by, bz), tree, smooth=True, sub=3, scale=(br, br, br * 0.92))

# ---- Pond and waterfall that spills off the rim toward the camera side ----
RA = math.radians(-80)
px, py = 2.0 * math.cos(RA), 2.0 * math.sin(RA)
prim("cone", "Pond", WATER, (px, py, top_z(px, py) + 0.03), isle, seg=20, r1=0.6, r2=0.6, depth=0.04, scale=(0.8, 1.0, 1), rot=(0, 0, RA))
rr = rim(RA)
ex, ey = rr * math.cos(RA), rr * math.sin(RA)
fall = bpy.data.meshes.new("Falls")
verts, faces, uvs = [], [], []
NS = 28
for i in range(NS + 1):
    u = i / NS
    out = -0.55 + 1.4 * math.sqrt(u)
    cx, cy = ex + math.cos(RA) * out, ey + math.sin(RA) * out
    z = 0.02 - 5.2 * u ** 1.4 if out > 0.05 else top_z(cx, cy) + 0.04
    tx_, ty_ = -math.sin(RA), math.cos(RA)
    wdt = 0.24 + 0.16 * u
    verts += [(cx - tx_ * wdt, cy - ty_ * wdt, z), (cx + tx_ * wdt, cy + ty_ * wdt, z)]
    if i:
        k = 2 * i
        faces.append((k - 2, k - 1, k + 1, k))
fall.from_pydata(verts, [], faces)
uvl = fall.uv_layers.new(name="UV")
for poly in fall.polygons:
    for li in poly.loop_indices:
        vi = fall.loops[li].vertex_index
        uvl.data[li].uv = (vi % 2, (vi // 2) / NS)
fm = bpy.data.materials.new("Falls"); fm.use_nodes = True
if hasattr(fm, "surface_render_method"):
    fm.surface_render_method = "BLENDED"
nt = fm.node_tree; n = nt.nodes; n.remove(n["Principled BSDF"])
uvn = n.new("ShaderNodeUVMap"); mp = n.new("ShaderNodeMapping")
mp.inputs["Scale"].default_value = (9.0, 0.8, 1.0)
nt.links.new(uvn.outputs[0], mp.inputs["Vector"])
wv = n.new("ShaderNodeTexNoise")
wv.inputs["Scale"].default_value = 2.5; wv.inputs["Detail"].default_value = 2.0
nt.links.new(mp.outputs[0], wv.inputs["Vector"])
fr = n.new("ShaderNodeValToRGB"); fr.color_ramp.interpolation = "CONSTANT"
fr.color_ramp.elements[0].color = (*srgb("#3f8fd8"), 1)
fr.color_ramp.elements[1].position = 0.6; fr.color_ramp.elements[1].color = (1, 1, 1, 1)
fr.color_ramp.elements.new(0.47).color = (*srgb("#86c9f2"), 1)
nt.links.new(wv.outputs["Fac"], fr.inputs["Fac"])
fem = n.new("ShaderNodeEmission"); nt.links.new(fr.outputs["Color"], fem.inputs["Color"])
fade = n.new("ShaderNodeSeparateXYZ"); nt.links.new(uvn.outputs[0], fade.inputs[0])
fmr = n.new("ShaderNodeMapRange"); fmr.inputs["From Min"].default_value = 0.55; fmr.inputs["From Max"].default_value = 1.0
fmr.inputs["To Min"].default_value = 0.0; fmr.inputs["To Max"].default_value = 1.0
nt.links.new(fade.outputs["Y"], fmr.inputs["Value"])
tr = n.new("ShaderNodeBsdfTransparent")
fmix = n.new("ShaderNodeMixShader")
nt.links.new(fmr.outputs["Result"], fmix.inputs["Fac"])
nt.links.new(fem.outputs[0], fmix.inputs[1]); nt.links.new(tr.outputs[0], fmix.inputs[2])
nt.links.new(fmix.outputs[0], n["Material Output"].inputs["Surface"])
fall.materials.append(fm)
falls = link(bpy.data.objects.new("Falls", fall), isle)
falls.lineart.usage = "OCCLUSION_ONLY"
mp.inputs["Location"].default_value = (0, 0, 0)
mp.inputs["Location"].keyframe_insert("default_value", frame=1)
mp.inputs["Location"].default_value = (0, -5.0, 0)
mp.inputs["Location"].keyframe_insert("default_value", frame=FRAMES)

# ---- Small rocks that bob around the island ----
rocks = []
for i, (rx, ry, rz, rs) in enumerate([(-4.3, -0.8, -0.6, 0.45), (3.9, 1.6, 0.4, 0.35), (4.1, -1.7, -1.6, 0.55), (-3.4, 2.6, -2.2, 0.3)]):
    holder = link(bpy.data.objects.new(f"RockHolder{i}", None))
    holder.location = (rx, ry, rz)
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=1, radius=rs)
    for v in bm.verts:
        v.co.z *= 0.75 if v.co.z > 0 else 1.5
        v.co *= 1 + 0.2 * random.uniform(-1, 1)
    for v in bm.verts:
        if v.co.z > rs * 0.3:
            v.co.z = rs * 0.3
    r_ob = mesh_obj(f"Rock{i}", bm, [ROCK], holder)
    prim("ico", f"RockGrass{i}", GRASS, (0, 0, rs * 0.3), holder, smooth=True, sub=2, scale=(rs * 0.95, rs * 0.95, rs * 0.12))
    rocks.append((holder, i))

# ---- Cloud puffs: a sea of clouds below and a few drifting in front ----
def cloud(name, loc, size, puffs, drift):
    c = link(bpy.data.objects.new(name, None))
    c.location = loc
    for k in range(puffs):
        a = k / puffs * math.pi * 2 + random.uniform(-0.3, 0.3)
        rr_ = size * random.uniform(0.25, 0.7)
        r = size * random.uniform(0.38, 0.6) * (1.25 if k == 0 else 1)
        p = (math.cos(a) * rr_ * 1.6, math.sin(a) * rr_ * 0.7, random.uniform(-0.05, 0.25) * size + (0.25 * size if k == 0 else 0))
        if k == 0:
            p = (0, 0, 0.2 * size)
        prim("ico", "Puff", CLOUD, p, c, smooth=True, sub=3, scale=(r, r, r * 0.85))
    c.keyframe_insert("location", frame=1)
    c.location = (loc[0] + drift, loc[1], loc[2])
    c.keyframe_insert("location", frame=FRAMES)
    return c


for i in range(26):
    a = random.uniform(0, 2 * math.pi)
    d = random.uniform(5.5, 20)
    cloud("Sea", (math.cos(a) * d, math.sin(a) * d, -6.8 + random.uniform(-0.6, 0.6)), random.uniform(2.2, 3.6), 6, random.uniform(0.4, 1.2))
cloud("FrontA", (-6.5, -6.5, -3.2), 1.6, 5, 1.6)
cloud("FrontB", (7.5, -3.0, 1.8), 1.3, 5, -1.2)
cloud("BackA", (-7.0, 8.0, 3.2), 2.0, 6, 1.0)
cloud("BackB", (6.0, 10.0, -1.0), 2.4, 6, -0.8)

# ---- Three white birds that cross the sky, flapping ----
# Wing: a tapered, swept blade from the shoulder outward (+X), mirrored for the left side
def wing_mesh(side):
    bm = bmesh.new()
    vs = [bm.verts.new((side * x, y, 0)) for x, y in [(0.0, 0.09), (0.3, 0.05), (0.52, -0.06), (0.46, -0.1), (0.2, -0.06), (0.0, -0.06)]]
    bm.faces.new(vs if side > 0 else vs[::-1])
    return bm


for i, (p0, p1, ph) in enumerate([((-4.5, 12.0, 4.0), (7.5, 4.5, 3.4), 0.0), ((-5.6, 11.2, 3.3), (6.6, 3.7, 2.8), 1.3), ((-3.6, 13.2, 3.1), (8.4, 5.4, 2.4), 2.4)]):
    bird = link(bpy.data.objects.new(f"Bird{i}", None))
    d = Vector(p1) - Vector(p0)
    bird.rotation_euler = (0, 0, math.atan2(d.y, d.x) - math.pi / 2)
    bird.scale = (1.7, 1.7, 1.7)
    prim("ico", "Body", WALL, (0, 0, 0), bird, smooth=True, sub=2, scale=(0.07, 0.2, 0.07))
    wings = []
    for side in (-1, 1):
        w = link(bpy.data.objects.new("WingPivot", None), bird)
        w.location = (side * 0.04, 0, 0.02)
        mesh_obj("Wing", wing_mesh(side), [WALL], w)
        wings.append((w, side))
    for f in range(1, FRAMES + 1, 2):
        t = (f - 1) / (FRAMES - 1)
        bird.location = Vector(p0) + d * t
        bird.keyframe_insert("location", frame=f)
        for w, side in wings:
            w.rotation_euler = (0, side * (-0.3 + 0.65 * math.sin(2 * math.pi * (f / 11.0) + ph)), 0)
            w.keyframe_insert("rotation_euler", frame=f)

# ---- Gentle bob for the island and the rocks ----
for f in range(1, FRAMES + 1, 6):
    t = (f - 1) / FPS
    isle.location.z = 0.12 * math.sin(2 * math.pi * t / 4.0)
    isle.rotation_euler = (0.025 * math.sin(2 * math.pi * t / 5.0), 0.02 * math.sin(2 * math.pi * t / 6.5 + 1), 0)
    isle.keyframe_insert("location", frame=f); isle.keyframe_insert("rotation_euler", frame=f)
for holder, i in rocks:
    z0 = holder.location.z
    for f in range(1, FRAMES + 1, 6):
        t = (f - 1) / FPS
        holder.location.z = z0 + 0.22 * math.sin(2 * math.pi * t / (2.6 + 0.4 * i) + i * 1.7)
        holder.rotation_euler.z = 0.15 * math.sin(2 * math.pi * t / 7 + i)
        holder.keyframe_insert("location", frame=f); holder.keyframe_insert("rotation_euler", frame=f)

# ---- Light: one crisp sun, so the toon ramp gets a clean terminator and cast shadows ----
sun_d = bpy.data.lights.new("Sun", "SUN"); sun_d.energy = 3.2; sun_d.angle = math.radians(1.5)
sun_d.color = (1.0, 0.97, 0.92)
sun = link(bpy.data.objects.new("Sun", sun_d))
sun.rotation_euler = (math.radians(48), math.radians(-8), math.radians(-38))

# ---- Camera: orbit around the island with a slight push in ----
cam_d = bpy.data.cameras.new("Cam"); cam_d.lens = 38; cam_d.clip_end = 300
cam = link(bpy.data.objects.new("Cam", cam_d))
sc.camera = cam
target = link(bpy.data.objects.new("Target", None)); target.location = (0, 0, -0.6)
pivot = link(bpy.data.objects.new("Pivot", None))
cam.parent = pivot
tc_ = cam.constraints.new("TRACK_TO"); tc_.target = target
tc_.track_axis = "TRACK_NEGATIVE_Z"; tc_.up_axis = "UP_Y"
for f, ang, dist, h, tz in [(1, -38, 15.5, 3.2, -0.6), (FRAMES, 22, 13.6, 2.4, 0.1)]:
    pivot.rotation_euler = (0, 0, math.radians(ang)); pivot.keyframe_insert("rotation_euler", frame=f)
    cam.location = (0, -dist, h); cam.keyframe_insert("location", frame=f)
    target.location.z = tz; target.keyframe_insert("location", frame=f)


def fcurves(id_):
    act = id_.animation_data.action
    fcs = list(getattr(act, "fcurves", []) or [])
    for layer in getattr(act, "layers", []):
        for strip in layer.strips:
            for bag in strip.channelbags:
                fcs.extend(bag.fcurves)
    return fcs


for fc in fcurves(hub) + fcurves(fm.node_tree):
    for kp in fc.keyframe_points:
        kp.interpolation = "LINEAR"

# ---- Line Art: one Grease Pencil object draws navy outlines for the whole scene ----
gpd = bpy.data.grease_pencils.new("Lines")
lines = link(bpy.data.objects.new("Lines", gpd))
ink = bpy.data.materials.new("Ink")
bpy.data.materials.create_gpencil_data(ink)
ink.grease_pencil.color = (*srgb("#1c2340"), 1.0)
ink.grease_pencil.show_fill = False
gpd.materials.append(ink)
layer = gpd.layers.new("Lines")
if hasattr(layer, "use_lights"):
    layer.use_lights = False
layer.frames.new(1)
lines.show_in_front = True
la = lines.modifiers.new("LineArt", "LINEART")
la.source_type = "SCENE"
la.target_layer = "Lines"
la.target_material = ink
la.use_contour = True
la.use_crease = True
la.crease_threshold = math.radians(128)
la.use_intersection = True
la.use_material = False
la.use_loose = False
la.radius = 0.03
la.smooth_tolerance = 0.2
if hasattr(la, "stroke_depth_offset"):
    la.stroke_depth_offset = 0.05

if TEST:
    for t in TEST:
        sc.frame_set(t)
        sc.render.filepath = OUT + f"/test_{t:04d}.png"
        bpy.ops.render.render(write_still=True)
else:
    bpy.ops.render.render(animation=True)
print("RENDER COMPLETE")
