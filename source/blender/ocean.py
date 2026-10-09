# Copyright (c) 2026 Dor5hacham d5shacham@gmail.com. All rights reserved.
# SPDX-License-Identifier: Proprietary

# Builds a stylized sunset ocean, path traced in Cycles on the GPU (HIP when available): an Ocean
# modifier surface (FFT waves, choppiness, foam attribute) animated by keyframing its time, under a
# procedural sunset sky with a low sun. A coral-and-cream navigation buoy with a blinking amber
# lamp rides the swell: for every frame the script reads the evaluated ocean mesh under the buoy
# and keyframes its height and tilt (smoothed for a little inertia). Distance haze in the water
# shader hides the patch edges. Foam is built in the water shader: wave crests (height mask broken
# up by streaky noise) plus an animated ring of churned water and outward ripples around the buoy
# (buoy-space coordinates). Cycles traces the reflections, so the buoy has a real mirror image in
# the water, broken up by the waves, without the bands and streaks of Eevee's screen-space tracing.
# Usage: blender -b -P ocean.py -- <out_dir> [test_frame]
import bpy, sys, math, time
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:]
OUT = argv[0]
TEST = int(argv[1]) if len(argv) > 1 else None
FPS, FRAMES = 30, 150
RES = 12                 # ocean grid resolution; higher = finer ripples, slower
SAMPLES = 128            # Cycles samples per pixel (adaptive), then denoised

bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
sc.render.fps = FPS
sc.frame_start, sc.frame_end = 1, FRAMES
sc.render.resolution_x, sc.render.resolution_y = 1280, 720
sc.render.engine = "CYCLES"
# GPU through HIP; skip the CPU's integrated Radeon when a discrete card is present
prefs = bpy.context.preferences.addons["cycles"].preferences
device_ok = False
try:
    prefs.compute_device_type = "HIP"
    prefs.get_devices()
    gpus = [d for d in prefs.devices if d.type != "CPU"]
    discrete = [d for d in gpus if "(TM) Graphics" not in d.name]
    for d in prefs.devices:
        d.use = d in (discrete or gpus)
        device_ok = device_ok or (d.use and d.type == "HIP")
except Exception as e:
    print("HIP setup failed:", e)
cy = sc.cycles
cy.device = "GPU" if device_ok else "CPU"
print("CYCLES RENDER DEVICE:", cy.device, "(HIP)" if device_ok else "(no HIP device)")
cy.samples = SAMPLES
cy.use_adaptive_sampling = True
cy.adaptive_threshold = 0.02
cy.use_denoising = True
cy.denoiser = "OPENIMAGEDENOISE"
if hasattr(cy, "denoising_use_gpu"):
    cy.denoising_use_gpu = True
cy.max_bounces = 8
cy.diffuse_bounces = 2
cy.glossy_bounces = 4
cy.transmission_bounces = 4
cy.caustics_reflective = False      # no sun glints bounced off the water onto the buoy: fireflies
cy.caustics_refractive = False
cy.blur_glossy = 1.0
cy.sample_clamp_indirect = 8.0
sc.render.use_persistent_data = True
sc.render.use_motion_blur = True
sc.render.motion_blur_shutter = 0.4
vts = [i.identifier for i in sc.view_settings.bl_rna.properties["view_transform"].enum_items]
sc.view_settings.view_transform = "AgX" if "AgX" in vts else "Standard"
sc.render.image_settings.file_format = "PNG"
sc.render.filepath = OUT + "/f_"

SUN_DIR = Vector((0.42, 1.0, 0.075)).normalized()     # low sun, behind and right of the buoy
HORIZON = (1.0, 0.36, 0.12)
FOG = (0.62, 0.22, 0.2)

# ---- Sky: navy zenith -> violet -> coral/amber horizon, plus sun disk and glow ----
world = bpy.data.worlds.new("World"); sc.world = world
world.use_nodes = True
wn = world.node_tree; wn.nodes.clear()
tco = wn.nodes.new("ShaderNodeTexCoord")
sep = wn.nodes.new("ShaderNodeSeparateXYZ")
wn.links.new(tco.outputs["Generated"], sep.inputs["Vector"])
elev = wn.nodes.new("ShaderNodeMapRange"); elev.inputs["From Min"].default_value = -0.02; elev.inputs["From Max"].default_value = 0.6
wn.links.new(sep.outputs["Z"], elev.inputs["Value"])
pw = wn.nodes.new("ShaderNodeMath"); pw.operation = "POWER"; pw.inputs[1].default_value = 0.55
wn.links.new(elev.outputs["Result"], pw.inputs[0])
sky = wn.nodes.new("ShaderNodeValToRGB")
cr = sky.color_ramp
cr.elements[0].position = 0.0; cr.elements[0].color = (*HORIZON, 1)
cr.elements[1].position = 1.0; cr.elements[1].color = (0.012, 0.014, 0.05, 1)
e = cr.elements.new(0.22); e.color = (0.85, 0.16, 0.16, 1)
e = cr.elements.new(0.5); e.color = (0.20, 0.08, 0.32, 1)
wn.links.new(pw.outputs[0], sky.inputs["Fac"])
dot = wn.nodes.new("ShaderNodeVectorMath"); dot.operation = "DOT_PRODUCT"
dot.inputs[1].default_value = SUN_DIR
wn.links.new(tco.outputs["Generated"], dot.inputs[0])
disk = wn.nodes.new("ShaderNodeMapRange"); disk.interpolation_type = "SMOOTHSTEP"
disk.inputs["From Min"].default_value = 0.99975; disk.inputs["From Max"].default_value = 0.99985
disk.inputs["To Max"].default_value = 25.0
wn.links.new(dot.outputs["Value"], disk.inputs["Value"])
halo = wn.nodes.new("ShaderNodeMapRange"); halo.inputs["From Min"].default_value = 0.9; halo.inputs["From Max"].default_value = 1.0
wn.links.new(dot.outputs["Value"], halo.inputs["Value"])
hp = wn.nodes.new("ShaderNodeMath"); hp.operation = "POWER"; hp.inputs[1].default_value = 10.0
wn.links.new(halo.outputs["Result"], hp.inputs[0])
hsum = wn.nodes.new("ShaderNodeMath"); hsum.operation = "MULTIPLY_ADD"; hsum.inputs[1].default_value = 1.1
wn.links.new(hp.outputs[0], hsum.inputs[0]); wn.links.new(disk.outputs["Result"], hsum.inputs[2])
sun_col = wn.nodes.new("ShaderNodeMix"); sun_col.data_type = "RGBA"; sun_col.blend_type = "ADD"
sun_col.inputs["Factor"].default_value = 1.0
wn.links.new(sky.outputs["Color"], sun_col.inputs["A"])
tint = wn.nodes.new("ShaderNodeMix"); tint.data_type = "RGBA"; tint.blend_type = "MULTIPLY"
tint.inputs["Factor"].default_value = 1.0; tint.inputs["B"].default_value = (1.0, 0.62, 0.3, 1)
wn.links.new(hsum.outputs[0], tint.inputs["A"])
wn.links.new(tint.outputs["Result"], sun_col.inputs["B"])
bgn = wn.nodes.new("ShaderNodeBackground"); bgn.inputs["Strength"].default_value = 1.0
wn.links.new(sun_col.outputs["Result"], bgn.inputs["Color"])
wout = wn.nodes.new("ShaderNodeOutputWorld")
wn.links.new(bgn.outputs[0], wout.inputs["Surface"])
# importance map fine enough to find the small sun disk
world.cycles.sampling_method = "MANUAL"
world.cycles.sample_map_resolution = 2048

# ---- Ocean ----
bpy.ops.mesh.primitive_plane_add(size=2, location=(0, 0, 0))
sea = bpy.context.object; sea.name = "Ocean"
oc = sea.modifiers.new("Ocean", "OCEAN")
oc.geometry_mode = "GENERATE"
oc.spatial_size = 36
oc.size = 1.0
oc.repeat_x = oc.repeat_y = 7
oc.resolution = RES
oc.viewport_resolution = RES          # buoy tracking reads the viewport evaluation
oc.spectrum = "PIERSON_MOSKOWITZ"
oc.wind_velocity = 7.5
oc.wave_scale = 0.75
oc.choppiness = 1.1
oc.wave_alignment = 0.45
oc.wave_direction = math.radians(70)
oc.damping = 0.5
oc.random_seed = 3
oc.use_normals = True
oc.use_foam = True
oc.foam_coverage = 0.6
oc.foam_layer_name = "foam"
for f, tm in [(1, 0.0), (FRAMES, FRAMES / FPS)]:
    oc.time = tm
    sea.keyframe_insert('modifiers["Ocean"].time', frame=f)
bpy.ops.object.shade_smooth()

# Water shader: deep violet-navy body, teal-lit crests, cream foam, mirror-like sunset reflection,
# blended into the horizon haze with camera distance.
# Buoy root empty, created here because the water shader reads buoy-space coordinates
root = bpy.data.objects.new("BuoyRoot", None); sc.collection.objects.link(root)
wm = bpy.data.materials.new("Water"); wm.use_nodes = True
nt = wm.node_tree
bsdf = nt.nodes["Principled BSDF"]
bsdf.inputs["Roughness"].default_value = 0.06
if "Specular IOR Level" in bsdf.inputs:
    bsdf.inputs["Specular IOR Level"].default_value = 1.0   # strong Fresnel: the buoy reads in the water
geo = nt.nodes.new("ShaderNodeNewGeometry")
gsep = nt.nodes.new("ShaderNodeSeparateXYZ")
nt.links.new(geo.outputs["Position"], gsep.inputs["Vector"])
hmap = nt.nodes.new("ShaderNodeMapRange"); hmap.inputs["From Min"].default_value = -0.4; hmap.inputs["From Max"].default_value = 1.1
nt.links.new(gsep.outputs["Z"], hmap.inputs["Value"])
body = nt.nodes.new("ShaderNodeValToRGB")
body.color_ramp.elements[0].color = (0.006, 0.008, 0.03, 1)
body.color_ramp.elements[1].color = (0.03, 0.22, 0.28, 1)
nt.links.new(hmap.outputs["Result"], body.inputs["Fac"])
def mrange(src, lo, hi, smooth=True, out_lo=0.0, out_hi=1.0):
    m = nt.nodes.new("ShaderNodeMapRange")
    if smooth:
        m.interpolation_type = "SMOOTHSTEP"
    m.inputs["From Min"].default_value = lo; m.inputs["From Max"].default_value = hi
    m.inputs["To Min"].default_value = out_lo; m.inputs["To Max"].default_value = out_hi
    nt.links.new(src, m.inputs["Value"])
    return m.outputs["Result"]
def math_op(op, a, b=None, clamp=False):
    m = nt.nodes.new("ShaderNodeMath"); m.operation = op; m.use_clamp = clamp
    for i, v in enumerate((a, b)):
        if v is None:
            continue
        if isinstance(v, (int, float)):
            m.inputs[i].default_value = v
        else:
            nt.links.new(v, m.inputs[i])
    return m.outputs[0]
def anim_value(name, keys):
    v = nt.nodes.new("ShaderNodeValue"); v.name = name
    for f, w in keys:
        v.outputs[0].default_value = w
        v.outputs[0].keyframe_insert("default_value", frame=f)
    return v.outputs[0]
wtc = nt.nodes.new("ShaderNodeTexCoord")
FOAM_T = anim_value("FOAM_T", [(1, 0.0), (FRAMES, 1.5)])
# Crest foam: the unbaked foam attribute barely varies, so foam comes from wave height, broken
# into streaks by noise stretched along the wind and drifting over time.
attr = nt.nodes.new("ShaderNodeAttribute"); attr.attribute_name = "foam"
foam_attr = mrange(attr.outputs["Fac"], 0.317, 0.327)
crest = mrange(gsep.outputs["Z"], 0.12, 0.5)
smap = nt.nodes.new("ShaderNodeMapping"); smap.inputs["Scale"].default_value = (0.6, 2.2, 1.0)
smap.inputs["Rotation"].default_value = (0, 0, math.radians(-20))
nt.links.new(wtc.outputs["Object"], smap.inputs["Vector"])
fnoise = nt.nodes.new("ShaderNodeTexNoise"); fnoise.noise_dimensions = "4D"
fnoise.inputs["Scale"].default_value = 2.2; fnoise.inputs["Detail"].default_value = 8; fnoise.inputs["Roughness"].default_value = 0.65
nt.links.new(smap.outputs["Vector"], fnoise.inputs["Vector"]); nt.links.new(FOAM_T, fnoise.inputs["W"])
streak = mrange(fnoise.outputs["Fac"], 0.47, 0.6)
crest_foam = math_op("MULTIPLY", math_op("MAXIMUM", crest, foam_attr), streak, clamp=True)
# Buoy foam: churned water at the hull plus rings that ripple outward, in buoy space
btc = nt.nodes.new("ShaderNodeTexCoord"); btc.object = root
bsep = nt.nodes.new("ShaderNodeSeparateXYZ"); nt.links.new(btc.outputs["Object"], bsep.inputs["Vector"])
bxy = nt.nodes.new("ShaderNodeCombineXYZ")
nt.links.new(bsep.outputs["X"], bxy.inputs["X"]); nt.links.new(bsep.outputs["Y"], bxy.inputs["Y"])
blen = nt.nodes.new("ShaderNodeVectorMath"); blen.operation = "LENGTH"
nt.links.new(bxy.outputs["Vector"], blen.inputs[0])
d = blen.outputs["Value"]
RING_T = anim_value("RING_T", [(1, 0.0), (FRAMES, 45.0)])
hull = mrange(d, 0.72, 1.15, out_lo=1.0, out_hi=0.0)
spread = mrange(d, 0.8, 3.2, out_lo=1.0, out_hi=0.0)
wave_ph = math_op("SUBTRACT", math_op("MULTIPLY", d, 6.5), RING_T)
rings = mrange(math_op("SINE", wave_ph), -0.2, 1.0)
rnoise = nt.nodes.new("ShaderNodeTexNoise"); rnoise.noise_dimensions = "4D"
rnoise.inputs["Scale"].default_value = 5.0; rnoise.inputs["Detail"].default_value = 6
nt.links.new(btc.outputs["Object"], rnoise.inputs["Vector"]); nt.links.new(FOAM_T, rnoise.inputs["W"])
rbreak = mrange(rnoise.outputs["Fac"], 0.38, 0.6)
ring_foam = math_op("MULTIPLY", math_op("MAXIMUM", hull, math_op("MULTIPLY", spread, rings)), rbreak, clamp=True)
foam_total = math_op("MAXIMUM", crest_foam, ring_foam)
fcol = nt.nodes.new("ShaderNodeMix"); fcol.data_type = "RGBA"
nt.links.new(foam_total, fcol.inputs["Factor"])
nt.links.new(body.outputs["Color"], fcol.inputs["A"])
fcol.inputs["B"].default_value = (1.0, 0.93, 0.86, 1)
nt.links.new(fcol.outputs["Result"], bsdf.inputs["Base Color"])
# small wind ripples on top of the FFT waves: breaks the reflection into a sun glitter path
rip = nt.nodes.new("ShaderNodeTexNoise"); rip.inputs["Scale"].default_value = 2.5; rip.inputs["Detail"].default_value = 8
rip.noise_dimensions = "4D"
rtc = nt.nodes.new("ShaderNodeTexCoord")
nt.links.new(rtc.outputs["Object"], rip.inputs["Vector"])
rip_w = nt.nodes.new("ShaderNodeValue"); rip_w.name = "RIPPLE_T"
for f, w in [(1, 0.0), (FRAMES, 2.0)]:
    rip_w.outputs[0].default_value = w
    rip_w.outputs[0].keyframe_insert("default_value", frame=f)
nt.links.new(rip_w.outputs[0], rip.inputs["W"])
bump = nt.nodes.new("ShaderNodeBump"); bump.inputs["Strength"].default_value = 0.28; bump.inputs["Distance"].default_value = 0.05
nt.links.new(rip.outputs["Fac"], bump.inputs["Height"])
nt.links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])
frough = nt.nodes.new("ShaderNodeMapRange"); frough.inputs["To Min"].default_value = 0.06; frough.inputs["To Max"].default_value = 0.7
nt.links.new(foam_total, frough.inputs["Value"]); nt.links.new(frough.outputs["Result"], bsdf.inputs["Roughness"])
# haze by distance
cam_data = nt.nodes.new("ShaderNodeCameraData")
haze = nt.nodes.new("ShaderNodeMapRange"); haze.interpolation_type = "SMOOTHSTEP"
haze.inputs["From Min"].default_value = 45; haze.inputs["From Max"].default_value = 190
nt.links.new(cam_data.outputs["View Distance"], haze.inputs["Value"])
fog_em = nt.nodes.new("ShaderNodeEmission"); fog_em.inputs["Color"].default_value = (*FOG, 1); fog_em.inputs["Strength"].default_value = 1.0
mixs = nt.nodes.new("ShaderNodeMixShader")
nt.links.new(haze.outputs["Result"], mixs.inputs["Fac"])
# Foam is its own shader (rough cream with a faint warm glow), mixed over the water: as a base
# color it disappeared under the glossy sunset reflection
foam_b = nt.nodes.new("ShaderNodeBsdfPrincipled")
foam_b.inputs["Base Color"].default_value = (1.0, 0.93, 0.86, 1)
foam_b.inputs["Roughness"].default_value = 0.9
if "Specular IOR Level" in foam_b.inputs:
    foam_b.inputs["Specular IOR Level"].default_value = 0.2
foam_b.inputs["Emission Color"].default_value = (1.0, 0.78, 0.68, 1)
foam_b.inputs["Emission Strength"].default_value = 0.35
foam_mix = nt.nodes.new("ShaderNodeMixShader")
nt.links.new(foam_total, foam_mix.inputs["Fac"])
nt.links.new(bsdf.outputs["BSDF"], foam_mix.inputs[1]); nt.links.new(foam_b.outputs["BSDF"], foam_mix.inputs[2])
nt.links.new(foam_mix.outputs[0], mixs.inputs[1]); nt.links.new(fog_em.outputs[0], mixs.inputs[2])
nt.links.new(mixs.outputs[0], nt.nodes["Material Output"].inputs["Surface"])
sea.data.materials.append(wm)
# Linear keys: ripples and foam drift at a constant speed for the whole clip
wact = nt.animation_data.action
wfcs = list(getattr(wact, "fcurves", []) or [])
for layer in getattr(wact, "layers", []):
    for strip in layer.strips:
        for bag in strip.channelbags:
            wfcs.extend(bag.fcurves)
for fc in wfcs:
    for kp in fc.keyframe_points:
        kp.interpolation = "LINEAR"

# Far sea: a flat plane slightly below, so the horizon never shows the ocean patch edge
bpy.ops.mesh.primitive_plane_add(size=4000, location=(0, 0, -1.6))   # below the deepest trough
bpy.context.object.data.materials.append(wm)

# ---- Buoy ----
def principled(name, color, rough, metal=0.0, emit=None, strength=0.0):
    m = bpy.data.materials.new(name); m.use_nodes = True
    p = m.node_tree.nodes["Principled BSDF"]
    p.inputs["Base Color"].default_value = color
    p.inputs["Roughness"].default_value = rough
    p.inputs["Metallic"].default_value = metal
    if emit:
        p.inputs["Emission Color"].default_value = emit
        p.inputs["Emission Strength"].default_value = strength
    return m, p
coral_m, _ = principled("BuoyCoral", (1.0, 0.11, 0.04, 1), 0.35)
cream_m, _ = principled("BuoyCream", (0.9, 0.84, 0.74, 1), 0.4)
dark_m, _ = principled("BuoyMetal", (0.05, 0.05, 0.06, 1), 0.35, metal=1.0)
lamp_m, lamp_p = principled("Lamp", (1.0, 0.6, 0.1, 1), 0.2, emit=(1.0, 0.55, 0.08, 1), strength=0.0)

parts = []
def part(op, mat, loc, scale=(1, 1, 1), **kw):
    op(location=loc, **kw)
    o = bpy.context.object
    o.scale = scale
    o.data.materials.append(mat)
    bpy.ops.object.shade_smooth()
    o.parent = root
    parts.append(o)
    return o
part(bpy.ops.mesh.primitive_uv_sphere_add, coral_m, (0, 0, -0.05), (1.0, 1.0, 0.55), radius=0.75, segments=48, ring_count=24)
part(bpy.ops.mesh.primitive_cylinder_add, cream_m, (0, 0, 0.32), radius=0.62, depth=0.16, vertices=48)
part(bpy.ops.mesh.primitive_cone_add, coral_m, (0, 0, 0.95), radius1=0.5, radius2=0.12, depth=1.1, vertices=48)
part(bpy.ops.mesh.primitive_cylinder_add, cream_m, (0, 0, 0.98), radius=0.36, depth=0.14, vertices=48)
for i in range(4):  # lamp cage posts
    a = i * math.pi / 2 + math.pi / 4
    part(bpy.ops.mesh.primitive_cylinder_add, dark_m, (0.13 * math.cos(a), 0.13 * math.sin(a), 1.68), radius=0.018, depth=0.42, vertices=12)
part(bpy.ops.mesh.primitive_cylinder_add, dark_m, (0, 0, 1.9), radius=0.17, depth=0.04, vertices=32)
lamp = part(bpy.ops.mesh.primitive_uv_sphere_add, lamp_m, (0, 0, 1.66), radius=0.1)
# bevel the hard primitives a little
for o in parts:
    bv = o.modifiers.new("Bevel", "BEVEL"); bv.width = 0.015; bv.segments = 2
ld = bpy.data.lights.new("LampLight", "POINT"); ld.color = (1.0, 0.55, 0.12); ld.shadow_soft_size = 0.1
ll = bpy.data.objects.new("LampLight", ld); sc.collection.objects.link(ll)
ll.parent = root; ll.location = (0, 0, 1.66)
# blink: 1.2 s period, short flash with a quick fade (one key per frame)
for f in range(1, FRAMES + 1):
    ph = ((f - 8) % 36) / 36
    on = 1.0 if ph < 0.12 else max(0.0, 1.0 - (ph - 0.12) / 0.12)
    lamp_p.inputs["Emission Strength"].default_value = 3 + 60 * on
    lamp_p.inputs["Emission Strength"].keyframe_insert("default_value", frame=f)
    ld.energy = 120 * on
    ld.keyframe_insert("energy", frame=f)

# ---- Track the water under the buoy ----
BUOY_XY = Vector((0.0, 0.0))
t0 = time.time()
dg = bpy.context.evaluated_depsgraph_get()
sc.frame_set(1)
me = sea.evaluated_get(dg).data
idx = [v.index for v in me.vertices if (v.co.xy - BUOY_XY).length < 1.0]
print(f"Ocean verts: {len(me.vertices)}, tracked under buoy: {len(idx)}")
samples = []
for f in range(1, (TEST or FRAMES) + 1):
    sc.frame_set(f)
    me = sea.evaluated_get(dg).data
    c = sum((me.vertices[i].co for i in idx), Vector()) / len(idx)
    n = sum((me.vertices[i].normal for i in idx), Vector()).normalized()
    samples.append((c, n))
sm_c, sm_n = samples[0][0].copy(), samples[0][1].copy()
for f, (c, n) in enumerate(samples, start=1):
    sm_c = sm_c.lerp(c, 0.45)            # inertia: the float lags the water a little
    sm_n = sm_n.lerp(n, 0.3).normalized()
    root.location = (sm_c.x * 0.6, sm_c.y * 0.6, sm_c.z + 0.12)
    q = Vector((0, 0, 1)).rotation_difference(sm_n)
    root.rotation_mode = "QUATERNION"
    root.rotation_quaternion = q
    root.keyframe_insert("location", frame=f)
    root.keyframe_insert("rotation_quaternion", frame=f)
print(f"Buoy tracking done in {time.time() - t0:.1f}s")

# ---- Sun light matching the sky sun, plus a soft cool fill from the sky side ----
sun_d = bpy.data.lights.new("Sun", "SUN"); sun_d.color = (1.0, 0.55, 0.28); sun_d.energy = 4.0
sun_d.angle = math.radians(1.5)
sun = bpy.data.objects.new("Sun", sun_d); sc.collection.objects.link(sun)
sun.rotation_euler = (-SUN_DIR).to_track_quat("-Z", "Y").to_euler()
fill_d = bpy.data.lights.new("Fill", "SUN"); fill_d.color = (0.45, 0.35, 1.0); fill_d.energy = 0.6
fill = bpy.data.objects.new("Fill", fill_d); sc.collection.objects.link(fill)
fill.rotation_euler = (math.radians(50), 0, math.radians(200))
fill.visible_glossy = False   # fill only lights the buoy; no second sun in the water

# ---- Camera: low over the water, slow drift and a slight bob ----
cam_d = bpy.data.cameras.new("Cam"); cam_d.lens = 42
cam_d.dof.use_dof = True; cam_d.dof.aperture_fstop = 5.6
cam = bpy.data.objects.new("Cam", cam_d); sc.collection.objects.link(cam)
sc.camera = cam
target = bpy.data.objects.new("Target", None); sc.collection.objects.link(target)
cam_d.dof.focus_object = root
tc = cam.constraints.new("TRACK_TO"); tc.target = target
tc.track_axis = "TRACK_NEGATIVE_Z"; tc.up_axis = "UP_Y"
for f in range(1, FRAMES + 1, 10):
    u = (f - 1) / (FRAMES - 1)
    cam.location = (-5.5 + 1.5 * u, -15.0 + 1.5 * u, 3.4 + 0.15 * math.sin(f * 0.11))
    cam.keyframe_insert("location", frame=f)
target.location = (3.2, 8.0, 0.2)

if TEST:
    sc.frame_set(TEST)
    sc.render.filepath = OUT + f"/test_{TEST:04d}.png"
    t1 = time.time()
    bpy.ops.render.render(write_still=True)
    print(f"Render done in {time.time() - t1:.1f}s")
else:
    t1 = time.time()
    bpy.ops.render.render(animation=True)
    print(f"Render done in {time.time() - t1:.1f}s")
print("RENDER COMPLETE")
