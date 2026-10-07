# Builds a hand-drawn Grease Pencil (v3) animation in a flat orthographic view on cream paper.
# A navy pen line loops in from the left (already entering on frame 1), its tail chasing the
# head, and wraps into a circle; then a coral hatched sun, navy waves, coral rays, an underline
# swoosh and sparkles draw themselves on with Build modifiers. A Noise modifier with a frame step gives the "boiling"
# line wobble of traditional 2D animation. Strokes are generated in Python with pressure taper
# and hand jitter. Rendered with Eevee, Standard view transform so the paper stays cream.
# Usage: blender -b -P grease-pencil.py -- <out_dir> [test_frame]
import bpy, sys, math, random

argv = sys.argv[sys.argv.index("--") + 1:]
OUT = argv[0]
TEST = int(argv[1]) if len(argv) > 1 else None
FPS, FRAMES = 30, 150
random.seed(4)

bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
sc.render.fps = FPS
sc.frame_start, sc.frame_end = 1, FRAMES
sc.render.resolution_x, sc.render.resolution_y = 1280, 720
engines = [e.identifier for e in sc.render.bl_rna.properties["engine"].enum_items]
sc.render.engine = "BLENDER_EEVEE" if "BLENDER_EEVEE" in engines else "BLENDER_EEVEE_NEXT"
sc.eevee.taa_render_samples = 32
sc.view_settings.view_transform = "Standard"
sc.render.image_settings.file_format = "PNG"
sc.render.filepath = OUT + "/f_"

def srgb(h):
    h = h.lstrip("#")
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c)

NAVY, CORAL, CREAM = srgb("#1f2b4d"), srgb("#ff5a36"), srgb("#f4efe6")

world = bpy.data.worlds.new("World"); sc.world = world
world.use_nodes = True
world.node_tree.nodes["Background"].inputs[0].default_value = (*CREAM, 1)

# ---- Camera: orthographic, looking along +Y at the XZ drawing plane ----
cam_d = bpy.data.cameras.new("Cam"); cam_d.type = "ORTHO"; cam_d.ortho_scale = 13.5
cam = bpy.data.objects.new("Cam", cam_d); sc.collection.objects.link(cam)
cam.location = (0, -20, 0.3); cam.rotation_euler = (math.radians(90), 0, 0)
sc.camera = cam

# ---- Paper: cream emission with fine grain and a soft vignette ----
bpy.ops.mesh.primitive_plane_add(size=1, location=(0, 2, 0), rotation=(math.radians(90), 0, 0))
paper = bpy.context.object; paper.scale = (17, 10, 1)
pm = bpy.data.materials.new("Paper"); pm.use_nodes = True
nt = pm.node_tree; nt.nodes.remove(nt.nodes["Principled BSDF"])
tc = nt.nodes.new("ShaderNodeTexCoord")
grain = nt.nodes.new("ShaderNodeTexNoise"); grain.inputs["Scale"].default_value = 180; grain.inputs["Detail"].default_value = 8
nt.links.new(tc.outputs["Object"], grain.inputs["Vector"])
fiber = nt.nodes.new("ShaderNodeTexNoise"); fiber.inputs["Scale"].default_value = 6; fiber.inputs["Detail"].default_value = 3
nt.links.new(tc.outputs["Object"], fiber.inputs["Vector"])
vig = nt.nodes.new("ShaderNodeTexGradient"); vig.gradient_type = "SPHERICAL"
vmap = nt.nodes.new("ShaderNodeMapping"); vmap.inputs["Scale"].default_value = (1.25, 2.1, 1)
nt.links.new(tc.outputs["Object"], vmap.inputs["Vector"]); nt.links.new(vmap.outputs["Vector"], vig.inputs["Vector"])
# brightness = 0.93 + 0.05*grain + 0.03*fiber + 0.06*vignette
def madd(a, b, c_val):
    n = nt.nodes.new("ShaderNodeMath"); n.operation = "MULTIPLY_ADD"
    nt.links.new(a, n.inputs[0]); n.inputs[1].default_value = b
    if isinstance(c_val, float):
        n.inputs[2].default_value = c_val
    else:
        nt.links.new(c_val, n.inputs[2])
    return n.outputs[0]
v = madd(grain.outputs["Fac"], 0.06, 0.88)
v = madd(fiber.outputs["Fac"], 0.04, v)
v = madd(vig.outputs["Fac"], 0.07, v)
mul = nt.nodes.new("ShaderNodeMixRGB"); mul.blend_type = "MULTIPLY"; mul.inputs["Fac"].default_value = 1.0
mul.inputs["Color1"].default_value = (*CREAM, 1)
comb = nt.nodes.new("ShaderNodeCombineColor")
for i in range(3):
    nt.links.new(v, comb.inputs[i])
nt.links.new(comb.outputs[0], mul.inputs["Color2"])
em = nt.nodes.new("ShaderNodeEmission")
nt.links.new(mul.outputs[0], em.inputs["Color"])
nt.links.new(em.outputs[0], nt.nodes["Material Output"].inputs["Surface"])
paper.data.materials.append(pm)

# ---- Ink materials ----
def ink(name, col):
    m = bpy.data.materials.new(name)
    bpy.data.materials.create_gpencil_data(m)
    m.grease_pencil.color = (*col, 1.0)
    m.grease_pencil.show_fill = False
    return m
NAVY_INK, CORAL_INK = ink("NavyInk", NAVY), ink("CoralInk", CORAL)

# ---- Stroke geometry helpers (points in the XZ plane as (x, z) pairs) ----
def resample(pts, step=0.035):
    out = [pts[0]]
    acc = 0.0
    for (x0, z0), (x1, z1) in zip(pts, pts[1:]):
        seg = math.hypot(x1 - x0, z1 - z0)
        if seg == 0:
            continue
        t = step - acc
        while t <= seg:
            out.append((x0 + (x1 - x0) * t / seg, z0 + (z1 - z0) * t / seg))
            t += step
        acc = seg - (t - step)
    return out

def jitter(pts, amp=0.035):
    # Low-frequency hand wobble: offsets along the normal from a sum of sines
    ph = [random.uniform(0, 6.28) for _ in range(3)]
    n = len(pts)
    out = []
    for i, (x, z) in enumerate(pts):
        a, b = pts[max(i - 1, 0)], pts[min(i + 1, n - 1)]
        tx, tz = b[0] - a[0], b[1] - a[1]
        l = math.hypot(tx, tz) or 1
        nx, nz = -tz / l, tx / l
        u = i / max(n - 1, 1)
        off = amp * (math.sin(u * 11 + ph[0]) * 0.6 + math.sin(u * 27 + ph[1]) * 0.3 + math.sin(u * 53 + ph[2]) * 0.1)
        out.append((x + nx * off, z + nz * off))
    return out

def pressure(n, base, taper_in=0.12, taper_out=0.2):
    rs = []
    for i in range(n):
        u = i / max(n - 1, 1)
        a = min(1.0, u / taper_in) if taper_in else 1
        b = min(1.0, (1 - u) / taper_out) if taper_out else 1
        k = (0.35 + 0.65 * math.sin(a * math.pi / 2)) * (0.25 + 0.75 * math.sin(b * math.pi / 2))
        rs.append(base * k * (0.9 + 0.1 * math.sin(u * 17)))
    return rs

def fill_drawing(drawing, strokes, mat_index=0):
    # strokes: list of (points, radii)
    drawing.add_strokes([len(p) for p, _ in strokes])
    for s, (pts, rs) in zip(drawing.strokes, strokes):
        s.material_index = mat_index
        s.start_cap = 0; s.end_cap = 0   # 0 = round caps
        for p, (x, z), r in zip(s.points, pts, rs):
            p.position = (x, 0.0, z)
            p.radius = r
            p.opacity = 1.0

def gp_object(name, mat, y=0.0):
    gp = bpy.data.grease_pencils.new(name)
    ob = bpy.data.objects.new(name, gp)
    sc.collection.objects.link(ob)
    gp.materials.append(mat)
    layer = gp.layers.new("Ink")
    if hasattr(layer, "use_lights"):
        layer.use_lights = False
    ob.location.y = y
    ob.parent = logo
    return ob, layer

def ease(t):
    t = max(0.0, min(1.0, t))
    return t * t * (3 - 2 * t)

def add_boil(ob, amount=0.5, seed=1):
    nz = ob.modifiers.new("Boil", "GREASE_PENCIL_NOISE")
    nz.factor = amount
    nz.factor_thickness = 0.15
    nz.noise_scale = 0.25
    nz.use_random = True
    nz.step = 3
    nz.seed = seed

def add_build(ob, f0, f1):
    b = ob.modifiers.new("Build", "GREASE_PENCIL_BUILD")
    b.mode = "SEQUENTIAL"; b.transition = "GROW"; b.time_mode = "PERCENTAGE"
    for f, val in ((f0, 0.0), (f1, 1.0)):
        b.percentage_factor = val
        ob.keyframe_insert(f'modifiers["{b.name}"].percentage_factor', frame=f)
    # Build runs before the boil so the noise also wobbles the growing line
    ob.modifiers.move(len(ob.modifiers) - 1, 0)

logo = bpy.data.objects.new("Logo", None); sc.collection.objects.link(logo)
CX, CZ, R = 0.0, 0.45, 2.25

# ---- 1. Lead-in: a looping pen line that wraps into the circle; tail chases the head ----
lead = []
n_loops = 3
for i in range(400):
    t = i / 399 * n_loops * 2 * math.pi
    x = -8.6 + t * 0.30 - 0.62 * math.sin(t)       # prolate cycloid: cursive loops
    z = -1.6 - 0.62 * math.cos(t) + 0.3 * math.sin(t * 0.33)
    lead.append((x, z))
# bridge from the last loop up into the circle's lower-left
ex, ez = lead[-1]
a0 = math.radians(215)
sx, sz = CX + R * math.cos(a0), CZ + R * math.sin(a0)
# cubic Bezier: leaves the last loop along its tangent, lands along the circle's tangent
px, pz = lead[-2]
tx, tz = ex - px, ez - pz; tl = math.hypot(tx, tz); tx, tz = tx / tl, tz / tl
c1 = (ex + tx * 1.2, ez + tz * 1.2)
c2 = (sx + math.sin(a0) * 1.3, sz - math.cos(a0) * 1.3)   # back along the CCW tangent
for i in range(1, 80):
    u = i / 80
    b0, b1, b2, b3 = (1 - u) ** 3, 3 * u * (1 - u) ** 2, 3 * u * u * (1 - u), u ** 3
    lead.append((b0 * ex + b1 * c1[0] + b2 * c2[0] + b3 * sx, b0 * ez + b1 * c1[1] + b2 * c2[1] + b3 * sz))
circle_start = len(lead)
for i in range(520):
    u = i / 519
    a = a0 + u * 2 * math.pi * 1.1           # 1.1 turns: the overshoot of a quick hand
    r = R * (1.0 + 0.03 * math.sin(u * 7 + 1) + 0.035 * u)
    lead.append((CX + r * math.cos(a), CZ + r * math.sin(a)))
# resample, remembering where the circle begins
pre = resample(lead[:circle_start]); post = resample(lead[circle_start - 1:])
pts = jitter(pre + post[1:], 0.03)
cs = len(pre)
radii = pressure(len(pts), 0.065, 0.03, 0.06)
lead_ob, lead_layer = gp_object("PenLine", NAVY_INK, 0.0)
HEAD = (-20, 50)     # head travels over these frames; it starts before frame 1, so frame 1 shows the line entering
TAIL = (16, 62)      # tail catches up to the circle start
for f in range(1, TAIL[1] + 1):
    h = int(ease((f - HEAD[0]) / (HEAD[1] - HEAD[0])) ** 0.85 * (len(pts) - 1))
    tl = int(ease((f - TAIL[0]) / (TAIL[1] - TAIL[0])) * cs)
    fr = lead_layer.frames.new(f)
    if h - tl >= 2:
        seg = pts[tl:h + 1]
        rr = radii[tl:h + 1]
        # fresh taper at the moving tail so it reads as a brush lifting off
        k = len(seg)
        rr = [r * min(1.0, (j + 1) / 18.0) ** 0.6 if tl < cs else r for j, r in enumerate(rr)]
        fill_drawing(fr.drawing, [(seg, rr)])
add_boil(lead_ob, 0.12, 3)

# ---- 2. Coral hatching: zigzag filling the sun above the waterline ----
hatch = []
WATER = CZ - 0.55 * R
ang = math.radians(32)
dx, dz = math.cos(ang), math.sin(ang)
k = -R * 1.5
flip = False
while k < R * 1.5:
    # line: points p = (CX, CZ) + k*(perp) + s*(dx, dz); clip to circle radius 0.86R and above WATER
    px, pz = CX - dz * k, CZ + dx * k
    rr = 0.86 * R
    disc = rr * rr - k * k
    if disc > 0:
        s0, s1 = -math.sqrt(disc), math.sqrt(disc)
        seg = [(px + dx * s, pz + dz * s) for s in (s0, s1)]
        seg = [p for p in seg]
        # clip against the waterline
        (x0, z0), (x1, z1) = seg
        if z0 < WATER and z1 > WATER:
            t = (WATER - z0) / (z1 - z0); seg[0] = (x0 + (x1 - x0) * t, WATER)
        if z1 > WATER or z0 > WATER:
            if flip:
                seg.reverse()
            hatch.extend(seg)
            flip = not flip
    k += 0.3
hatch = jitter(resample(hatch, 0.03), 0.04)
hatch_ob, _ = gp_object("Hatch", CORAL_INK, 0.05)
fill_drawing(hatch_ob.data.layers[0].frames.new(1).drawing, [(hatch, pressure(len(hatch), 0.05, 0.02, 0.04))])
add_build(hatch_ob, 46, 72)
add_boil(hatch_ob, 0.1, 5)

# ---- 3. Navy waves across the lower circle ----
waves = []
for j, (zoff, half, amp) in enumerate([(0.0, 2.9, 0.13), (-0.5, 2.2, 0.11)]):
    z0 = WATER + zoff - 0.05
    w = []
    for i in range(160):
        u = i / 159
        x = CX - half + 2 * half * u
        w.append((x, z0 + amp * math.sin(u * 2 * math.pi * (2.5 - j * 0.5) + j)))
    w = jitter(resample(w), 0.02)
    waves.append((w, pressure(len(w), 0.058, 0.1, 0.15)))
waves_ob, _ = gp_object("Waves", NAVY_INK, -0.02)
fill_drawing(waves_ob.data.layers[0].frames.new(1).drawing, waves)
add_build(waves_ob, 64, 88)
add_boil(waves_ob, 0.1, 7)

# ---- 4. Coral rays around the upper half ----
rays = []
for i in range(9):
    a = math.radians(15 + i * 150 / 8)
    r0, r1 = R + 0.42, R + (0.95 if i % 2 == 0 else 0.7)
    ray = [(CX + r * math.cos(a), CZ + r * math.sin(a)) for r in (r0, r1)]
    ray = jitter(resample(ray, 0.03), 0.015)
    rays.append((ray, pressure(len(ray), 0.06, 0.15, 0.35)))
rays.reverse()   # draw left to right
rays_ob, _ = gp_object("Rays", CORAL_INK, 0.0)
fill_drawing(rays_ob.data.layers[0].frames.new(1).drawing, rays)
add_build(rays_ob, 84, 104)
add_boil(rays_ob, 0.1, 9)

# ---- 5. Underline swoosh and two sparkles ----
sw = []
for i in range(200):
    u = i / 199
    x = -3.3 + 6.8 * u
    sw.append((x, CZ - R - 0.75 - 0.32 * math.sin(u * math.pi) + 0.25 * u))
sw = jitter(resample(sw), 0.02)
swr = [r * (0.5 + 0.9 * math.sin(i / (len(sw) - 1) * math.pi)) for i, r in enumerate(pressure(len(sw), 0.07, 0.05, 0.3))]
spark = []
for (sx0, sz0, s) in [(3.55, 2.65, 0.42), (-3.6, 1.75, 0.3)]:
    for (ax, az) in [(0, 1), (1, 0)]:
        st = jitter(resample([(sx0 - ax * s, sz0 - az * s), (sx0 + ax * s, sz0 + az * s)], 0.02), 0.01)
        spark.append((st, pressure(len(st), 0.05, 0.3, 0.3)))
final_ob, _ = gp_object("Swoosh", NAVY_INK, 0.0)
fill_drawing(final_ob.data.layers[0].frames.new(1).drawing, [(sw, swr)] + spark)
add_build(final_ob, 100, 122)
add_boil(final_ob, 0.1, 11)

# ---- Settle: a small pop when the drawing completes, then a gentle breathing hold ----
for f, s in [(1, 1.0), (120, 1.0), (127, 1.045), (136, 1.0), (FRAMES, 1.012)]:
    logo.scale = (s, s, s)
    logo.keyframe_insert("scale", frame=f)

if TEST:
    sc.frame_set(TEST)
    sc.render.filepath = OUT + f"/test_{TEST:04d}.png"
    bpy.ops.render.render(write_still=True)
else:
    bpy.ops.render.render(animation=True)
print("RENDER COMPLETE")
