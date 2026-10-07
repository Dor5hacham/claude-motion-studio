# Builds a product-style turntable for Cycles path tracing: a clear glass sphere, a
# brushed (anisotropic) metal ring and a coral ceramic pill on a stone pedestal, lit by
# studio softboxes in a seamless cyc, with MNEE shadow caustics and shallow depth of field.
# Renders on the GPU through HIP when available, otherwise on the CPU.
# Usage: blender -b -P cycles-photoreal.py -- <out_dir> [test_frame]
import bpy, bmesh, sys, math

argv = sys.argv[sys.argv.index("--") + 1:]
OUT = argv[0]
TEST = int(argv[1]) if len(argv) > 1 else None
FPS, FRAMES = 30, 150

bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
sc.render.fps = FPS
sc.frame_start, sc.frame_end = 1, FRAMES
sc.render.resolution_x, sc.render.resolution_y = 1280, 720
sc.render.engine = "CYCLES"

# ---- GPU (HIP) setup ----
prefs = bpy.context.preferences.addons["cycles"].preferences
device_ok = False
try:
    prefs.compute_device_type = "HIP"
    prefs.get_devices()
    # Use every GPU, but skip the CPU's integrated Radeon when a discrete card is present:
    # mixing them made frames about 2x slower on the RX 9070 XT machine.
    gpus = [d for d in prefs.devices if d.type != "CPU"]
    discrete = [d for d in gpus if "(TM) Graphics" not in d.name]
    for d in prefs.devices:
        d.use = d in (discrete or gpus)
        print("CYCLES DEVICE:", d.name, d.type, "use=", d.use)
        device_ok = device_ok or (d.use and d.type == "HIP")
except Exception as e:
    print("HIP setup failed:", e)
cy = sc.cycles
cy.device = "GPU" if device_ok else "CPU"
print("CYCLES RENDER DEVICE:", cy.device, "(HIP)" if device_ok else "(no HIP device)")

cy.samples = 160 if device_ok else 48
cy.use_adaptive_sampling = True
cy.adaptive_threshold = 0.02
cy.use_denoising = True
cy.denoiser = "OPENIMAGEDENOISE"
if hasattr(cy, "denoising_use_gpu"):
    cy.denoising_use_gpu = True
cy.max_bounces = 16
cy.transmission_bounces = 12
cy.glossy_bounces = 8
cy.diffuse_bounces = 1          # less bounce fill: the shadow (and the caustic in it) keeps its contrast
cy.caustics_reflective = True
cy.caustics_refractive = True
cy.blur_glossy = 0.5
sc.render.use_persistent_data = True
sc.render.use_motion_blur = False

vts = [i.identifier for i in sc.view_settings.bl_rna.properties["view_transform"].enum_items]
sc.view_settings.view_transform = "Khronos PBR Neutral" if "Khronos PBR Neutral" in vts else "AgX"
sc.render.image_settings.file_format = "PNG"
sc.render.filepath = OUT + "/f_"

world = bpy.data.worlds.new("World")
sc.world = world
world.use_nodes = True
world.node_tree.nodes["Background"].inputs[0].default_value = (0.003, 0.003, 0.004, 1)

def principled(name, color, rough, metal=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    p = m.node_tree.nodes["Principled BSDF"]
    p.inputs["Base Color"].default_value = color
    p.inputs["Roughness"].default_value = rough
    p.inputs["Metallic"].default_value = metal
    return m, p

def smooth(obj):
    for poly in obj.data.polygons:
        poly.use_smooth = True

# ---- Seamless cyc backdrop (floor curving up into a back wall) ----
bm = bmesh.new()
W, D, H = 40.0, 14.0, 14.0
verts = [bm.verts.new(v) for v in [(-W / 2, -20, 0), (W / 2, -20, 0), (W / 2, D, 0), (-W / 2, D, 0),
                                   (W / 2, D, H), (-W / 2, D, H)]]
bm.faces.new([verts[0], verts[1], verts[2], verts[3]])
bm.faces.new([verts[3], verts[2], verts[4], verts[5]])
cyc_mesh = bpy.data.meshes.new("Cyc")
bm.to_mesh(cyc_mesh); bm.free()
cyc = bpy.data.objects.new("Cyc", cyc_mesh); sc.collection.objects.link(cyc)
cb = cyc.modifiers.new("Bevel", "BEVEL"); cb.width = 6.0; cb.segments = 24; cb.limit_method = "ANGLE"
smooth(cyc)
cyc_mat, cp = principled("Cyc", (0.02, 0.02, 0.022, 1), 0.6)
cyc.data.materials.append(cyc_mat)

# ---- Pedestal: honed cream stone cylinder with a soft bevel ----
bpy.ops.mesh.primitive_cylinder_add(vertices=128, radius=2.2, depth=0.7, location=(0, 0, 0.35))
ped = bpy.context.object
pb = ped.modifiers.new("Bevel", "BEVEL"); pb.width = 0.05; pb.segments = 6; pb.limit_method = "ANGLE"
smooth(ped)
ped_mat, pp = principled("Stone", (0.46, 0.43, 0.39, 1), 0.38)
ped.data.materials.append(ped_mat)
TOP = 0.7

turn = bpy.data.objects.new("Turntable", None); sc.collection.objects.link(turn)

# ---- Glass sphere ----
bpy.ops.mesh.primitive_uv_sphere_add(segments=96, ring_count=48, radius=0.62, location=(-0.55, -0.55, TOP + 0.62))
glass = bpy.context.object
smooth(glass)
glass_mat, gp = principled("Glass", (1, 1, 1, 1), 0.0)
gp.inputs["Transmission Weight"].default_value = 1.0
gp.inputs["IOR"].default_value = 1.5
glass.data.materials.append(glass_mat)

# ---- Brushed metal ring standing on edge ----
bpy.ops.mesh.primitive_torus_add(major_radius=0.72, minor_radius=0.13, major_segments=128, minor_segments=40,
                                 location=(0.75, 0.55, TOP + 0.85), rotation=(math.radians(90), 0, math.radians(25)))
ring = bpy.context.object
smooth(ring)
metal_mat, mp = principled("BrushedMetal", (0.92, 0.90, 0.88, 1), 0.28, metal=1.0)
for nm, v in (("Anisotropic", 0.95),):
    if nm in mp.inputs:
        mp.inputs[nm].default_value = v
mnt = metal_mat.node_tree
tang = mnt.nodes.new("ShaderNodeTangent"); tang.direction_type = "RADIAL"; tang.axis = "Z"
if "Tangent" in mp.inputs:
    mnt.links.new(tang.outputs["Tangent"], mp.inputs["Tangent"])
# Brushing streaks around the ring: noise stretched along the circumference (object Z is the
# ring axis) drives a wide roughness range, a slight brightness change and fine groove bumps
tc = mnt.nodes.new("ShaderNodeTexCoord")
# about 20 streaks across the tube (object Z), each running a long way around the ring (X, Y)
mapn = mnt.nodes.new("ShaderNodeMapping"); mapn.inputs["Scale"].default_value = (0.15, 0.15, 12.0)
mnt.links.new(tc.outputs["Object"], mapn.inputs["Vector"])
nz = mnt.nodes.new("ShaderNodeTexNoise"); nz.inputs["Scale"].default_value = 6.0; nz.inputs["Detail"].default_value = 10.0
mnt.links.new(mapn.outputs["Vector"], nz.inputs["Vector"])
mr = mnt.nodes.new("ShaderNodeMapRange"); mr.interpolation_type = "SMOOTHSTEP"
mr.inputs["From Min"].default_value = 0.35; mr.inputs["From Max"].default_value = 0.65
mr.inputs["To Min"].default_value = 0.1; mr.inputs["To Max"].default_value = 0.42
mnt.links.new(nz.outputs["Fac"], mr.inputs["Value"])
mnt.links.new(mr.outputs["Result"], mp.inputs["Roughness"])
bcol = mnt.nodes.new("ShaderNodeMapRange")
bcol.inputs["To Min"].default_value = 0.98; bcol.inputs["To Max"].default_value = 0.72
mnt.links.new(nz.outputs["Fac"], bcol.inputs["Value"])
mnt.links.new(bcol.outputs["Result"], mp.inputs["Base Color"])
gbump = mnt.nodes.new("ShaderNodeBump"); gbump.inputs["Strength"].default_value = 0.4
gbump.inputs["Distance"].default_value = 0.002
mnt.links.new(nz.outputs["Fac"], gbump.inputs["Height"])
mnt.links.new(gbump.outputs["Normal"], mp.inputs["Normal"])
ring.data.materials.append(metal_mat)

# ---- Coral ceramic pill (glossy coated) ----
bpy.ops.mesh.primitive_uv_sphere_add(segments=64, ring_count=32, radius=0.3, location=(0.55, -0.85, TOP + 0.3))
pill = bpy.context.object
pill.scale = (1.0, 1.0, 1.0)
smooth(pill)
cer_mat, cerp = principled("CoralCeramic", (1.0, 0.10, 0.035, 1), 0.35)
if "Coat Weight" in cerp.inputs:
    cerp.inputs["Coat Weight"].default_value = 1.0
    cerp.inputs["Coat Roughness"].default_value = 0.03
pill.data.materials.append(cer_mat)

for o in (glass, ring, pill):
    mw = o.matrix_world.copy()
    o.parent = turn
    o.matrix_world = mw

# Caustics: glass casts, pedestal receives
for o, cast, recv in ((glass, True, False), (ped, False, True), (cyc, False, True)):
    if hasattr(o.cycles, "is_caustics_caster"):
        o.cycles.is_caustics_caster = cast
        o.cycles.is_caustics_receiver = recv
        print("MNEE flags set on", o.name)

# ---- Studio lights: big key softbox, two strip rims, a top fill ----
def area(name, loc, rot, color, power, size, size_y=None, caustic=False):
    d = bpy.data.lights.new(name, "AREA"); d.color = color; d.energy = power
    if size_y:
        d.shape = "RECTANGLE"; d.size = size; d.size_y = size_y
    else:
        d.size = size
    if caustic and hasattr(d.cycles, "is_caustics_light"):
        d.cycles.is_caustics_light = True
        print("MNEE caustic light:", name)
    o = bpy.data.objects.new(name, d); sc.collection.objects.link(o)
    o.location = loc; o.rotation_euler = [math.radians(a) for a in rot]
    return o
# The key and the two rims skip the pedestal (light linking, set below), so the glass sphere's
# shadow on the pedestal stays dark and the caustic focused into it reads clearly; the objects and
# the cyc still get these lights
key = area("Key", (-4.5, -3.0, 6.0), (38, 0, -55), (1.0, 0.94, 0.88), 220, 3.0)
key_rx = bpy.data.collections.new("KeyReceivers")
key_rx.objects.link(ped)
key_rx.collection_objects[0].light_linking.link_state = "EXCLUDE"
key.light_linking.receiver_collection = key_rx
# Small hard back light: the only caustic light, so the glass focuses it onto the pedestal in front
caus_d = bpy.data.lights.new("Caustic", "POINT"); caus_d.energy = 4500; caus_d.color = (1.0, 0.92, 0.8)
caus_d.shadow_soft_size = 0.05
if hasattr(caus_d.cycles, "is_caustics_light"):
    caus_d.cycles.is_caustics_light = True
    print("MNEE caustic light: Caustic")
caus = bpy.data.objects.new("Caustic", caus_d); sc.collection.objects.link(caus)
caus.location = (-2.0, 2.1, 4.2)
for rim in (area("RimL", (-5.5, 3.5, 2.5), (80, 0, -125), (0.55, 0.85, 1.0), 700, 0.5, 3.0),
            area("RimR", (5.5, 3.0, 2.5), (80, 0, 120), (1.0, 0.55, 0.35), 700, 0.5, 3.0)):
    rim.light_linking.receiver_collection = key_rx
area("Top", (0, 0.5, 7.5), (0, 0, 0), (1.0, 0.98, 0.95), 10, 4.0)
# Violet glow on the back wall, hidden behind the pedestal and aimed away from it
area("Wall", (0, 4.0, 0.25), (90, 0, 0), (0.55, 0.38, 1.0), 500, 4.2, 0.6)

# ---- Camera: 70mm, f/3.5 focused between the glass sphere and the ring, slow push-in ----
cam_d = bpy.data.cameras.new("Cam"); cam_d.lens = 70
cam_d.dof.use_dof = True; cam_d.dof.aperture_fstop = 3.5
cam = bpy.data.objects.new("Cam", cam_d); sc.collection.objects.link(cam)
sc.camera = cam
target = bpy.data.objects.new("Target", None); sc.collection.objects.link(target)
target.location = (0.05, 0.0, TOP + 0.62)
focus = bpy.data.objects.new("Focus", None); sc.collection.objects.link(focus)
focus.location = (0.05, 0.0, TOP + 0.62)   # between sphere and ring, so the brushing stays sharp
cam_d.dof.focus_object = focus
tcn = cam.constraints.new("TRACK_TO"); tcn.target = target
tcn.track_axis = "TRACK_NEGATIVE_Z"; tcn.up_axis = "UP_Y"
cam.location = (0.5, -13.5, 3.6); cam.keyframe_insert("location", frame=1)
cam.location = (0.0, -12.0, 3.1); cam.keyframe_insert("location", frame=FRAMES)

turn.rotation_euler = (0, 0, 0); turn.keyframe_insert("rotation_euler", frame=1)
turn.rotation_euler = (0, 0, math.radians(75)); turn.keyframe_insert("rotation_euler", frame=FRAMES)

def set_interp(obj, mode):
    act = obj.animation_data.action
    fcs = list(getattr(act, "fcurves", []) or [])
    for layer in getattr(act, "layers", []):
        for strip in layer.strips:
            for bag in strip.channelbags:
                fcs.extend(bag.fcurves)
    for fc in fcs:
        for kp in fc.keyframe_points:
            kp.interpolation = mode
set_interp(turn, "LINEAR")

if TEST:
    sc.frame_set(TEST)
    sc.render.filepath = OUT + f"/test_{TEST:04d}.png"
    bpy.ops.render.render(write_still=True)
else:
    bpy.ops.render.render(animation=True)
print("RENDER COMPLETE")
