# Synthesizes an 8-second drum-and-bass loop in numpy (180 BPM, kick, snare, hats, a crash and
# a detuned sub bass), writes it to <out_dir>/beat.wav, then drives a speaker scene from it:
# the cone pumps on every kick, 120 glossy beads and dice hop off the cone with each kick and
# snare (ballistic arcs with bounces, simulated in Python), a ring of 48 LED bars shows a
# per-frame FFT of the loop (24 log-spaced bands, mirrored), and a top light flashes on snares.
# Everything is baked to keyframes, so the motion is locked to the sound frame by frame.
# Eevee with ray-traced reflections. Mux the WAV into the MP4 with ffmpeg afterwards.
# Usage: blender -b -P beat-speaker.py -- <out_dir> [test_frames, comma separated]
import bpy, bmesh, sys, math, random, wave
import numpy as np

argv = sys.argv[sys.argv.index("--") + 1:]
OUT = argv[0]
TEST = [int(x) for x in argv[1].split(",")] if len(argv) > 1 else None
FPS, FRAMES = 30, 240
SR = 44100
BPM = 180
STEP = 60 / BPM / 4            # one 16th note: 1/12 s, so a beat is exactly 10 frames
BARS = 6                       # 6 bars of 16 steps = 8.0 s
rng = np.random.default_rng(3)
random.seed(3)

# ---------------- 1. The music ----------------
N = int(SR * BARS * 16 * STEP)
t_all = np.arange(N) / SR
mix_l = np.zeros(N); mix_r = np.zeros(N)
hits = {"kick": [], "snare": [], "hat": [], "crash": []}


def place(sig, at, gain=1.0, pan=0.0):
    i = int(at * SR)
    j = min(N, i + len(sig))
    mix_l[i:j] += sig[: j - i] * gain * (1 - max(0, pan))
    mix_r[i:j] += sig[: j - i] * gain * (1 + min(0, pan))


def kick():
    tt = np.arange(int(0.45 * SR)) / SR
    f = 46 + 110 * np.exp(-tt / 0.035)
    ph = 2 * np.pi * np.cumsum(f) / SR
    return np.sin(ph) * np.exp(-tt / 0.22) + 0.3 * rng.standard_normal(len(tt)) * np.exp(-tt / 0.004)


def snare():
    tt = np.arange(int(0.3 * SR)) / SR
    nz = rng.standard_normal(len(tt))
    nz = nz - np.convolve(nz, np.ones(6) / 6, "same")
    return 0.8 * nz * np.exp(-tt / 0.11) + 0.6 * np.sin(2 * np.pi * 185 * tt) * np.exp(-tt / 0.06)


def hat(open_=False):
    tt = np.arange(int((0.25 if open_ else 0.06) * SR)) / SR
    nz = np.diff(rng.standard_normal(len(tt) + 1))
    return nz * np.exp(-tt / (0.09 if open_ else 0.018)) * 0.5


def crash():
    tt = np.arange(int(1.6 * SR)) / SR
    nz = np.diff(rng.standard_normal(len(tt) + 1))
    return nz * np.exp(-tt / 0.6) * 0.35


for bar in range(BARS):
    for s in range(16):
        at = (bar * 16 + s) * STEP
        if s in (0, 10):
            place(kick(), at, 1.0); hits["kick"].append((at, 1.0))
        if s in (4, 12):
            place(snare(), at, 0.8); hits["snare"].append((at, 1.0))
        if bar == 3 and s in (13, 14, 15):
            v = 0.35 + 0.15 * (s - 13)
            place(snare(), at, 0.8 * v); hits["snare"].append((at, v))
        if s == 7 and bar % 2 == 1:
            place(snare(), at, 0.25); hits["snare"].append((at, 0.3))
        if s % 2 == 0 or s in (3, 11):
            v = 0.9 if s % 4 == 2 else 0.5
            place(hat(s == 14), at, v, pan=0.35); hits["hat"].append((at, v))
    if bar == 4:
        place(crash(), bar * 16 * STEP, 1.0, pan=-0.3); hits["crash"].append((bar * 16 * STEP, 1.0))

# Reese-style sub bass: a sine plus two detuned saws through a swept one-pole low-pass
roots = [41.2, 41.2, 32.7, 36.7, 41.2, 49.0]
freq = np.repeat(roots, len(t_all) // BARS + 1)[:N]
ph = 2 * np.pi * np.cumsum(freq) / SR
saw = lambda k: 2 * ((np.cumsum(freq * k) / SR) % 1.0) - 1
raw = 0.6 * np.sin(ph) + 0.25 * (saw(1.007) + saw(0.993))
cut = 0.02 + 0.03 * (0.5 + 0.5 * np.sin(2 * np.pi * t_all / (16 * STEP)))
bass = np.zeros(N); y = 0.0
for i in range(N):
    y += cut[i] * (raw[i] - y)
    bass[i] = y
duck = np.ones(N)
for at, _ in hits["kick"]:
    i = int(at * SR); k = np.arange(min(N - i, int(0.2 * SR)))
    duck[i:i + len(k)] = np.minimum(duck[i:i + len(k)], 0.25 + 0.75 * (k / len(k)) ** 0.6)
bass *= duck * 0.9
mix_l += bass; mix_r += bass
peak = max(np.abs(mix_l).max(), np.abs(mix_r).max())
st = np.tanh(np.stack([mix_l, mix_r], 1) / peak * 1.4) / np.tanh(1.4) * 0.89
with wave.open(OUT + "/beat.wav", "wb") as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((st * 32767).astype("<i2").tobytes())

# ---------------- 2. Analysis: per-frame FFT bands and hit envelopes ----------------
mono = st.mean(1)
NB, WIN = 24, 2048
# Log-spaced band edges in FFT bins (about 43 Hz to 15 kHz), at least one bin per band
edges = np.round(np.geomspace(2, 700, NB + 1)).astype(int)
for k in range(1, NB + 1):
    edges[k] = max(edges[k], edges[k - 1] + 1)
han = np.hanning(WIN)
bands = np.zeros((FRAMES, NB))
for f in range(FRAMES):
    # Window ends one frame after the frame time: a hit shows on its own frame, never before
    i = int((f + 1.0) / FPS * SR) - WIN
    seg = np.zeros(WIN)
    a, b = max(i, 0), min(i + WIN, N)
    if b > a:
        seg[a - i:b - i] = mono[a:b]
    mag = np.abs(np.fft.rfft(seg * han))
    for k in range(NB):
        bands[f, k] = 20 * np.log10(mag[edges[k]:edges[k + 1]].mean() + 1e-6)
lo = np.percentile(bands, 15, 0); hi = np.percentile(bands, 99.5, 0)
lvl = np.clip((bands - lo) / np.maximum(hi - lo, 1e-3), 0, 1) ** 1.6
for f in range(1, FRAMES):
    lvl[f] = np.maximum(lvl[f], lvl[f - 1] * 0.74)


def envelope(kind, tau):
    e = np.zeros(FRAMES)
    for f in range(FRAMES):
        tf = f / FPS
        for at, v in hits[kind]:
            if at <= tf + 1e-6:
                e[f] = max(e[f], v * math.exp(-(tf - at) / tau))
    return e


snare_env = envelope("snare", 0.07)
hat_env = envelope("hat", 0.03)

# ---------------- 3. Scene ----------------
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
sc.view_settings.view_transform = "AgX"
if "AgX - Medium High Contrast" in [i.identifier for i in sc.view_settings.bl_rna.properties["look"].enum_items]:
    sc.view_settings.look = "AgX - Medium High Contrast"
sc.render.image_settings.file_format = "PNG"
sc.render.filepath = OUT + "/f_"

world = bpy.data.worlds.new("World"); sc.world = world
world.use_nodes = True
world.node_tree.nodes["Background"].inputs[0].default_value = (0.004, 0.004, 0.006, 1)


def srgb(h):
    h = h.lstrip("#")
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c)


def pbr(name, hexcol, rough, metal=0.0, coat=0.0):
    m = bpy.data.materials.new(name); m.use_nodes = True
    p = m.node_tree.nodes["Principled BSDF"]
    p.inputs["Base Color"].default_value = (*srgb(hexcol), 1)
    p.inputs["Roughness"].default_value = rough
    p.inputs["Metallic"].default_value = metal
    if "Coat Weight" in p.inputs:
        p.inputs["Coat Weight"].default_value = coat
    return m


def lathe(name, profile, mat, seg=96, smooth=True):
    # profile: list of (r, z); spun 360 degrees around Z
    bm = bmesh.new()
    vs = [bm.verts.new((r, 0, z)) for r, z in profile]
    es = [bm.edges.new((a, b)) for a, b in zip(vs, vs[1:])]
    bmesh.ops.spin(bm, geom=vs + es, cent=(0, 0, 0), axis=(0, 0, 1), steps=seg, angle=2 * math.pi)
    bmesh.ops.remove_doubles(bm, verts=bm.verts[:], dist=1e-5)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    me.materials.append(mat)
    for p in me.polygons:
        p.use_smooth = smooth
    ob = bpy.data.objects.new(name, me); sc.collection.objects.link(ob)
    return ob


CAB = pbr("Cabinet", "#0c0d11", 0.32, coat=0.5)
CAB.node_tree.nodes["Principled BSDF"].inputs["Coat Roughness"].default_value = 0.28
METAL = pbr("Basket", "#3a3d45", 0.28, metal=1.0)
RUBBER = pbr("Surround", "#101014", 0.55)
PAPER = pbr("Cone", "#1b1c22", 0.5)
CAP = pbr("DustCap", "#ff5a36", 0.18, coat=1.0)
# Fine concentric ridges on the cone paper
pn = PAPER.node_tree.nodes
wv = pn.new("ShaderNodeTexWave"); wv.wave_type = "RINGS"; wv.inputs["Scale"].default_value = 18
bump = pn.new("ShaderNodeBump"); bump.inputs["Strength"].default_value = 0.15
PAPER.node_tree.links.new(wv.outputs["Fac"], bump.inputs["Height"])
PAPER.node_tree.links.new(bump.outputs["Normal"], pn["Principled BSDF"].inputs["Normal"])

# Cabinet top: a wide annulus around a 2.05 hole, plus a dark wall inside the hole
bm = bmesh.new()
inner = [bm.verts.new((2.05 * math.cos(a), 2.05 * math.sin(a), 0)) for a in np.linspace(0, 2 * math.pi, 129)[:-1]]
outer = [bm.verts.new((60 * math.cos(a), 60 * math.sin(a), 0)) for a in np.linspace(0, 2 * math.pi, 129)[:-1]]
for i in range(128):
    bm.faces.new((inner[i], outer[i], outer[(i + 1) % 128], inner[(i + 1) % 128]))
me = bpy.data.meshes.new("Top"); bm.to_mesh(me); bm.free(); me.materials.append(CAB)
sc.collection.objects.link(bpy.data.objects.new("Top", me))
lathe("Well", [(2.05, 0.0), (2.0, -0.1), (1.95, -1.2)], RUBBER)
lathe("Basket", [(2.02, -0.04), (2.02, 0.03), (2.08, 0.06), (2.32, 0.06), (2.38, 0.02), (2.4, -0.01)], METAL)
# Bolts on the basket ring
for k in range(8):
    a = k / 8 * 2 * math.pi + 0.2
    bpy.ops.mesh.primitive_cylinder_add(vertices=16, radius=0.045, depth=0.03, location=(2.2 * math.cos(a), 2.2 * math.sin(a), 0.075))
    bpy.context.object.data.materials.append(METAL)
    bpy.ops.object.shade_smooth()

surround = lathe("Surround", [(1.98, -0.02)] + [(1.84 + 0.14 * math.cos(u), 0.0 + 0.12 * math.sin(u)) for u in np.linspace(0, math.pi, 14)] + [(1.68, -0.04)], RUBBER)
R0, R1, Z0, Z1 = 0.58, 1.68, -0.62, -0.04
cone_prof = [(R1, Z1), (R1 - 0.02, Z1 - 0.01)] + [(R1 - (R1 - R0) * u, Z1 + (Z0 - Z1) * u ** 0.9) for u in np.linspace(0.03, 1, 18)]
cone = lathe("Cone", cone_prof, PAPER)
cap = lathe("Cap", [(R0 + 0.02, Z0 - 0.01)] + [(R0 * math.cos(u), Z0 + 0.34 * math.sin(u)) for u in np.linspace(0, math.pi / 2, 14)], CAP)


# Excursion: kick pushes the cone up with a damped wobble, bass adds a small tremor
exc = np.zeros(FRAMES)
for f in range(FRAMES):
    tf = f / FPS
    v = 0.0
    for at, s in hits["kick"]:
        tau = tf - at
        if 0 <= tau < 0.6:
            v += 0.11 * s * math.exp(-tau / 0.07) * math.cos(2 * math.pi * tau * 4.0)
    exc[f] = v + 0.012 * lvl[f, 1] + 0.004 * hat_env[f]

# ---------------- 4. Beads: ballistic hops simulated at 240 Hz ----------------
BEAD_MATS = [pbr("Cream", "#f4efe6", 0.2, coat=0.5), pbr("Coral", "#ff5a36", 0.2, coat=0.5),
             pbr("Cyan", "#2ec8de", 0.2, coat=0.5), pbr("Amber", "#ffb020", 0.2, coat=0.5)]
sph = bpy.data.meshes.new("BeadMesh")
bm = bmesh.new(); bmesh.ops.create_uvsphere(bm, u_segments=24, v_segments=12, radius=1.0); bm.to_mesh(sph); bm.free()
for p in sph.polygons:
    p.use_smooth = True
die = bpy.data.meshes.new("DieMesh")
bm = bmesh.new(); bmesh.ops.create_cube(bm, size=2.0)
bmesh.ops.bevel(bm, geom=bm.edges[:], offset=0.35, segments=4, affect="EDGES")
bm.to_mesh(die); bm.free()
for p in die.polygons:
    p.use_smooth = True
# One material slot per mesh; each bead overrides it with its own color at object level
sph.materials.append(BEAD_MATS[0]); die.materials.append(BEAD_MATS[0])

# Random non-overlapping rest spots on the cone (about a third of the ring is covered)
pts = []
while len(pts) < 120:
    r = math.sqrt(random.uniform(0.76 ** 2, 1.58 ** 2)); a = random.uniform(0, 2 * math.pi)
    x, y = r * math.cos(a), r * math.sin(a)
    if all((x - px) ** 2 + (y - py) ** 2 > 0.155 ** 2 for px, py in pts):
        pts.append((x, y))
NBEAD = len(pts)
P = np.array(pts)
is_die = np.arange(NBEAD) % 5 == 0
rad = np.where(is_die, 0.065, rng.uniform(0.05, 0.07, NBEAD))
G, SUB = 15.0, 8
dt = 1 / (FPS * SUB)
# Kicks launch the resting beads hard, snares softer; beads still in the air ignore a hit
events = sorted([(at, v, 3.9) for at, v in hits["kick"]] + [(at, v, 2.1) for at, v in hits["snare"]])
h = np.zeros(NBEAD); vz = np.zeros(NBEAD); vxy = np.zeros((NBEAD, 2))
spin = np.zeros((NBEAD, 3)); rot = rng.uniform(0, 6.28, (NBEAD, 3))
loc = np.zeros((FRAMES, NBEAD, 3)); rots = np.zeros((FRAMES, NBEAD, 3))
eye = np.eye(NBEAD)
ev = 0
for f in range(FRAMES):
    r = np.hypot(P[:, 0], P[:, 1])
    base = Z1 + (Z0 - Z1) * np.clip((R1 - r) / (R1 - R0), 0, 1) ** 0.9 + rad
    loc[f, :, :2] = P
    loc[f, :, 2] = base + np.where(h > 0, np.maximum(h, exc[f]), exc[f])
    rots[f] = rot
    for s in range(SUB):
        tnow = (f + s / SUB) / FPS
        while ev < len(events) and events[ev][0] <= tnow + 1e-9:
            at, v, vel = events[ev]; ev += 1
            m = h < 0.03; k = int(m.sum())
            vz[m] = vel * v * rng.uniform(0.6, 1.15, k)
            vxy[m] = rng.uniform(-0.07, 0.07, (k, 2))
            spin[m] = rng.uniform(-14, 14, (k, 3)) * v
        air = (h > 0) | (vz > 0)
        vz[air] -= G * dt; h[air] += vz[air] * dt
        P[air] += vxy[air] * dt; rot[air] += spin[air] * dt
        landed = air & (h <= 0)
        h[landed] = 0
        bounce = landed & (vz < -0.6)
        vz[landed & ~bounce] = 0; vz[bounce] *= -0.32
        vxy[landed] *= 0.5; spin[landed] *= 0.4
    # Keep beads apart and on the cone between the dust cap and the surround
    d = P[:, None, :] - P[None, :, :]
    dist = np.hypot(d[..., 0], d[..., 1]) + eye
    over = np.clip((rad[:, None] + rad[None, :]) * 1.08 - dist, 0, None) * (1 - eye)
    P += 0.5 * (d / dist[..., None] * over[..., None]).sum(1)
    r = np.hypot(P[:, 0], P[:, 1])
    P *= (np.clip(r, 0.76, 1.6) / r)[:, None]

beads = []
for bi in range(NBEAD):
    ob = bpy.data.objects.new(f"Bead{bi}", die if is_die[bi] else sph)
    sc.collection.objects.link(ob)
    k = rad[bi] * (0.8 if is_die[bi] else 1.0)
    ob.scale = (k, k, k)
    ob.material_slots[0].link = "OBJECT"
    ob.material_slots[0].material = BEAD_MATS[bi % 4]
    beads.append((ob, loc[:, bi], rots[:, bi]))


# ---------------- 5. LED ring: 48 flat radial bars, one per mirrored FFT band ----------------
def led_material():
    m = bpy.data.materials.new("LED"); m.use_nodes = True
    nt = m.node_tree; n = nt.nodes
    p = n["Principled BSDF"]
    p.inputs["Base Color"].default_value = (0.01, 0.01, 0.012, 1)
    p.inputs["Roughness"].default_value = 0.3
    oi = n.new("ShaderNodeObjectInfo")
    geo = n.new("ShaderNodeNewGeometry")
    ln = n.new("ShaderNodeVectorMath"); ln.operation = "LENGTH"
    nt.links.new(geo.outputs["Position"], ln.inputs[0])
    seg = n.new("ShaderNodeMath"); seg.operation = "MULTIPLY"; seg.inputs[1].default_value = 9.0
    nt.links.new(ln.outputs["Value"], seg.inputs[0])
    frc = n.new("ShaderNodeMath"); frc.operation = "FRACT"; nt.links.new(seg.outputs[0], frc.inputs[0])
    gap = n.new("ShaderNodeMath"); gap.operation = "GREATER_THAN"; gap.inputs[1].default_value = 0.22
    nt.links.new(frc.outputs[0], gap.inputs[0])
    st_ = n.new("ShaderNodeMath"); st_.operation = "MULTIPLY"; st_.inputs[1].default_value = 7.0
    nt.links.new(gap.outputs[0], st_.inputs[0])
    nt.links.new(oi.outputs["Color"], p.inputs["Emission Color"])
    nt.links.new(st_.outputs[0], p.inputs["Emission Strength"])
    return m


LED = led_material()
bar_mesh = bpy.data.meshes.new("Bar")
bm = bmesh.new()
bmesh.ops.create_cube(bm, size=1.0)
bmesh.ops.translate(bm, verts=bm.verts[:], vec=(0.5, 0, 0.5))
bmesh.ops.scale(bm, verts=bm.verts[:], vec=(1.0, 0.14, 0.03))
bm.to_mesh(bar_mesh); bm.free()
bar_mesh.materials.append(LED)
ramp = [(0.0, "#ff5a36"), (0.35, "#ffb020"), (0.7, "#2ec8de"), (1.0, "#8b6cff")]


def band_color(u):
    for (u0, c0), (u1, c1) in zip(ramp, ramp[1:]):
        if u <= u1:
            k = (u - u0) / (u1 - u0)
            a, b = srgb(c0), srgb(c1)
            return [a[i] + (b[i] - a[i]) * k for i in range(3)]
    return list(srgb(ramp[-1][1]))


NBAR = 48
bars = []
for i in range(NBAR):
    a = -math.pi / 2 + (i + 0.5) / NBAR * 2 * math.pi
    k = i if i < NBAR // 2 else NBAR - 1 - i
    ob = bpy.data.objects.new(f"Bar{i}", bar_mesh); sc.collection.objects.link(ob)
    ob.location = (2.55 * math.cos(a), 2.55 * math.sin(a), 0.0)
    ob.rotation_euler = (0, 0, a)
    col = band_color(k / (NB - 1))
    length = 0.08 + 1.7 * lvl[:, k]
    bright = 0.08 + 0.92 * lvl[:, k]
    bars.append((ob, length, np.array([[c * b for c in col] + [1.0] for b in bright])))

# ---------------- 6. Lights and camera ----------------
def area(name, loc, rot, color, power, size):
    d = bpy.data.lights.new(name, "AREA"); d.color = color; d.energy = power; d.size = size
    o = bpy.data.objects.new(name, d); sc.collection.objects.link(o)
    o.location = loc; o.rotation_euler = [math.radians(v) for v in rot]
    return d


area("Key", (-4, -3, 7), (30, 0, -50), (1.0, 0.93, 0.85), 900, 4)
area("RimCyan", (5, 5, 2.5), (70, 0, 135), srgb("#2ec8de"), 700, 3)
area("RimCoral", (-6, 4, 2), (70, 0, -125), srgb("#ff5a36"), 600, 3)
flash = area("Flash", (0, 0, 6), (0, 0, 0), (1.0, 1.0, 1.0), 0, 2.5)

cam_d = bpy.data.cameras.new("Cam"); cam_d.lens = 45
cam_d.dof.use_dof = True; cam_d.dof.aperture_fstop = 3.2
cam = bpy.data.objects.new("Cam", cam_d); sc.collection.objects.link(cam); sc.camera = cam
target = bpy.data.objects.new("Target", None); sc.collection.objects.link(target); target.location = (0, 0.2, -0.3)
cam_d.dof.focus_object = target
pivot = bpy.data.objects.new("Pivot", None); sc.collection.objects.link(pivot)
cam.parent = pivot
tc = cam.constraints.new("TRACK_TO"); tc.target = target; tc.track_axis = "TRACK_NEGATIVE_Z"; tc.up_axis = "UP_Y"


# ---------------- 7. Bake everything to keyframes ----------------
def fcurves(id_):
    act = id_.animation_data.action
    fcs = list(getattr(act, "fcurves", []) or [])
    for layer in getattr(act, "layers", []):
        for strip in layer.strips:
            for bag in strip.channelbags:
                fcs.extend(bag.fcurves)
    return fcs


def bake(id_, path, values, interp=1):
    # values: array (FRAMES, n) or (FRAMES,), written to frames 1..FRAMES with linear interpolation
    values = np.asarray(values, dtype=float)
    if values.ndim == 1:
        values = values[:, None]
    id_.keyframe_insert(path, frame=1)
    fcs = sorted([fc for fc in fcurves(id_) if fc.data_path == path], key=lambda fc: fc.array_index)
    for fc in fcs:
        col = values[:, fc.array_index if values.shape[1] > 1 else 0]
        kp = fc.keyframe_points
        while len(kp):
            kp.remove(kp[0], fast=True)
        kp.add(FRAMES)
        co = np.empty(FRAMES * 2); co[0::2] = np.arange(1, FRAMES + 1); co[1::2] = col
        kp.foreach_set("co", co)
        kp.foreach_set("interpolation", [interp] * FRAMES)
        fc.update()


ex = np.zeros((FRAMES, 3)); ex[:, 2] = exc
for ob in (cone, cap):
    bake(ob, "location", ex)
ex2 = ex.copy(); ex2[:, 2] *= 0.5
bake(surround, "location", ex2)
for ob, loc, rots in beads:
    bake(ob, "location", loc)
    bake(ob, "rotation_euler", rots)
for ob, length, colr in bars:
    sc_ = np.ones((FRAMES, 3)); sc_[:, 0] = length
    bake(ob, "scale", sc_)
    bake(ob, "color", colr)
bake(flash, "energy", 2200 * snare_env ** 1.3)
fr_ = np.arange(FRAMES) / (FRAMES - 1)
ease = fr_ * fr_ * (3 - 2 * fr_)
bake(pivot, "rotation_euler", np.stack([np.zeros(FRAMES), np.zeros(FRAMES), np.radians(-30 + 55 * ease)], 1))
bake(cam, "location", np.stack([np.zeros(FRAMES), -(8.6 - 1.0 * ease), 5.6 - 0.5 * ease], 1))

if TEST:
    for t in TEST:
        sc.frame_set(t)
        sc.render.filepath = OUT + f"/test_{t:04d}.png"
        bpy.ops.render.render(write_still=True)
else:
    bpy.ops.render.render(animation=True)
print("RENDER COMPLETE")
