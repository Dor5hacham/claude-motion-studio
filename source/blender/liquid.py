# Builds a Mantaflow FLIP liquid shot: a glossy coral stream pours onto a cream sphere,
# coats it and spills across a dark studio floor. Bakes the fluid, then path traces it in Cycles
# on the GPU (HIP when available) with motion blur: the domain caches mesh speed vectors, which
# Cycles reads to blur the changing fluid surface itself, not only the camera move. The sim
# pre-rolls PREROLL frames so the stream already hits the sphere on the first rendered frame;
# frames are written as f_0013.png onward (use ffmpeg -start_number).
# The fluid cache goes to <out_dir>/cache and is rebaked on every run (a test run bakes only up
# to its last test frame). Set LIQUID_MOTION_BLUR=0 to render without motion blur, or
# LIQUID_COMPARE_BLUR=1 to write every test frame twice (test_N.png with blur, test_N_noblur.png).
# Usage: blender -b -P liquid.py -- <out_dir> [test_frame[,test_frame...]]
import bpy, sys, os, math, time

argv = sys.argv[sys.argv.index("--") + 1:]
OUT = os.path.abspath(argv[0])
TEST = [int(x) for x in argv[1].split(",")] if len(argv) > 1 else None
CACHE = os.path.join(OUT, "cache")
FPS, FRAMES = 30, 150
PREROLL = 12                  # sim frames before the first rendered frame (stream lands on frame 1)
F0, F1 = 1 + PREROLL, FRAMES + PREROLL
RES = 160                     # domain resolution (longest side, in cells)
SAMPLES = 128                 # Cycles samples per pixel (adaptive), then denoised
MOTION_BLUR = os.environ.get("LIQUID_MOTION_BLUR", "1") != "0"

bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
sc.render.fps = FPS
sc.frame_start, sc.frame_end = F0, F1
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
cy.caustics_reflective = False
cy.caustics_refractive = False
cy.blur_glossy = 1.0
sc.render.use_persistent_data = True
# Motion blur reads the fluid mesh's cached velocity attribute (use_speed_vectors below)
sc.render.use_motion_blur = MOTION_BLUR
sc.render.motion_blur_shutter = 0.5
try:
    sc.view_settings.view_transform = "Khronos PBR Neutral"
except TypeError:
    pass
sc.render.image_settings.file_format = "PNG"
sc.render.filepath = OUT + "/f_"

# World: near-black with a faint cool tint
world = bpy.data.worlds.new("World")
sc.world = world
world.use_nodes = True
bg = world.node_tree.nodes["Background"]
bg.inputs[0].default_value = (0.006, 0.007, 0.012, 1)
bg.inputs[1].default_value = 1.0

def principled(name, color, rough, metal=0.0, coat=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    p = m.node_tree.nodes["Principled BSDF"]
    p.inputs["Base Color"].default_value = color
    p.inputs["Roughness"].default_value = rough
    p.inputs["Metallic"].default_value = metal
    if "Coat Weight" in p.inputs:
        p.inputs["Coat Weight"].default_value = coat
    return m, p

# Coral liquid: glossy paint-like surface with a little subsurface glow
liquid_mat, lp = principled("Liquid", (0.85, 0.09, 0.03, 1), 0.06, coat=1.0)
if "Subsurface Weight" in lp.inputs:
    lp.inputs["Subsurface Weight"].default_value = 0.12
    lp.inputs["Subsurface Radius"].default_value = (1.0, 0.3, 0.15)
    lp.inputs["Subsurface Scale"].default_value = 0.08
if "Coat Roughness" in lp.inputs:
    lp.inputs["Coat Roughness"].default_value = 0.02
floor_mat, flp = principled("Floor", (0.008, 0.008, 0.011, 1), 0.3)
if "Specular IOR Level" in flp.inputs:
    flp.inputs["Specular IOR Level"].default_value = 0.35
cream_mat, _ = principled("Cream", (0.93, 0.88, 0.80, 1), 0.22, coat=0.5)

# Floor plane (render only); sits just under the domain's bottom wall layer
bpy.ops.mesh.primitive_plane_add(size=80, location=(0, 0, 0))
floor = bpy.context.object
floor.data.materials.append(floor_mat)

# Cream sphere on the floor: the collision obstacle the stream lands on
SPH_R = 0.62
bpy.ops.mesh.primitive_uv_sphere_add(radius=SPH_R, segments=96, ring_count=48, location=(0, 0, SPH_R))
sphere = bpy.context.object
bpy.ops.object.shade_smooth()
sphere.data.materials.append(cream_mat)
em = sphere.modifiers.new("Fluid", "FLUID")
em.fluid_type = "EFFECTOR"
em.effector_settings.effector_type = "COLLISION"
em.effector_settings.use_plane_init = False

# Inflow nozzle: small cylinder above the sphere, shooting liquid down, drifting slightly.
# A thicker pour (radius 0.18) feeds a spill sheet several cells thick, so it does not tear.
bpy.ops.mesh.primitive_cylinder_add(radius=0.18, depth=0.16, vertices=32, location=(-0.22, 0.05, 2.75))
nozzle = bpy.context.object
nozzle.hide_render = True
fm = nozzle.modifiers.new("Fluid", "FLUID")
fm.fluid_type = "FLOW"
fs = fm.flow_settings
fs.flow_type = "LIQUID"
fs.flow_behavior = "INFLOW"
fs.use_initial_velocity = True
fs.velocity_coord = (0.0, 0.0, -3.0)
fs.subframes = 1
fs.use_inflow = True
# The pour runs until frame 140: a coat left to drain for longer thins out and tears open
STOP = 140 + PREROLL
fs.keyframe_insert("use_inflow", frame=1)
fs.keyframe_insert("use_inflow", frame=STOP)
fs.use_inflow = False
fs.keyframe_insert("use_inflow", frame=STOP + 1)
nozzle.keyframe_insert("location", frame=1)
nozzle.location = (0.12, -0.05, 2.75)
nozzle.keyframe_insert("location", frame=STOP)

# Domain: 5 x 5 x 3.1 m box. Sides and top are open so spilled liquid leaves the frame.
bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, 1.5))
dom = bpy.context.object
dom.name = "LiquidDomain"
dom.scale = (5.0, 5.0, 3.1)
bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
dom.data.materials.append(liquid_mat)
dm = dom.modifiers.new("Fluid", "FLUID")
dm.fluid_type = "DOMAIN"
ds = dm.domain_settings
ds.domain_type = "LIQUID"
ds.resolution_max = RES
ds.simulation_method = "FLIP"
ds.use_mesh = True
ds.mesh_scale = 2
# More particles per cell and larger particle and mesh radii keep the thin spill sheet in one
# piece (no holes); extra smoothing rounds off ragged sheet edges
ds.particle_number = 3
ds.particle_radius = 1.25
ds.mesh_particle_radius = 2.8
ds.mesh_smoothen_pos = 4
ds.mesh_smoothen_neg = 2
ds.mesh_concave_upper = 4.0
ds.mesh_generator = "IMPROVED"
ds.use_speed_vectors = True      # per-vertex velocities: Cycles motion blur on the fluid mesh
ds.use_adaptive_timesteps = True
ds.timesteps_max = 6
ds.surface_tension = 0.0
for side in ("front", "back", "left", "right", "top"):
    setattr(ds, "use_collision_border_" + side, False)
ds.use_collision_border_bottom = True
ds.cache_directory = CACHE
ds.cache_type = "ALL"
# UNI, not OpenVDB: with OpenVDB data the mesh speed vectors are silently not saved, the mesh's
# velocity attribute stays zero and Cycles draws no motion blur on the liquid
ds.cache_data_format = "UNI"
ds.cache_mesh_format = "BOBJECT"
ds.cache_frame_start, ds.cache_frame_end = 1, (max(TEST) if TEST else F1)
dom.location.z = 1.5 - 0.05  # bottom wall voxel layer lines up with the floor
bpy.ops.object.shade_smooth()

# Lights: warm key, cyan rim, violet back, soft top fill for long highlights on the liquid.
# Rim and back sit high, aim at the sphere and are light-linked to the liquid and the sphere,
# so they only edge-light the liquid instead of painting colored pools on the floor.
aim = bpy.data.objects.new("LightAim", None); sc.collection.objects.link(aim)
aim.location = (0, 0, 0.7)
def area(name, loc, rot, color, power, size, track=False):
    d = bpy.data.lights.new(name, "AREA"); d.color = color; d.energy = power; d.size = size
    o = bpy.data.objects.new(name, d); sc.collection.objects.link(o)
    o.location = loc; o.rotation_euler = [math.radians(a) for a in rot]
    if track:
        c = o.constraints.new("TRACK_TO"); c.target = aim
        c.track_axis = "TRACK_NEGATIVE_Z"; c.up_axis = "UP_Y"
    return d
area("Key", (-4, -4.5, 5), (50, 0, -40), (1.0, 0.88, 0.78), 800, 3)
area("Rim", (4.0, 3.5, 6.5), (0, 0, 0), (0.45, 0.85, 1.0), 650, 1.5, track=True)
area("Back", (-1.0, 6.5, 7.5), (0, 0, 0), (0.65, 0.45, 1.0), 600, 3, track=True)
edge_rx = bpy.data.collections.new("EdgeLightReceivers")
for o in (dom, sphere):
    edge_rx.objects.link(o)
for nm in ("Rim", "Back"):
    bpy.data.objects[nm].light_linking.receiver_collection = edge_rx
area("Top", (0, 0, 5.5), (0, 0, 0), (1.0, 0.97, 0.93), 200, 6)

# Camera: low three-quarter view, slow orbit and push-in, shallow depth of field
cam_d = bpy.data.cameras.new("Cam"); cam_d.lens = 50
cam_d.dof.use_dof = True; cam_d.dof.aperture_fstop = 2.8
cam = bpy.data.objects.new("Cam", cam_d); sc.collection.objects.link(cam)
sc.camera = cam
target = bpy.data.objects.new("Target", None); sc.collection.objects.link(target)
cam_d.dof.focus_object = target
tc = cam.constraints.new("TRACK_TO"); tc.target = target
tc.track_axis = "TRACK_NEGATIVE_Z"; tc.up_axis = "UP_Y"
for f, loc in [(F0, (-4.3, -6.7, 1.7)), (F1, (-1.8, -7.1, 1.35))]:
    cam.location = loc; cam.keyframe_insert("location", frame=f)
for f, loc in [(F0, (0, 0, 1.05)), (F1, (0, 0, 0.8))]:
    target.location = loc; target.keyframe_insert("location", frame=f)

# Bake the fluid cache. A fresh process treats an old cache as unbaked and resets it,
# so every run bakes before rendering.
print("Baking fluid...")
t0 = time.time()
bpy.ops.object.select_all(action="DESELECT")
dom.select_set(True)
bpy.context.view_layer.objects.active = dom
with bpy.context.temp_override(object=dom, active_object=dom, selected_objects=[dom]):
    r = bpy.ops.fluid.bake_all()
print("Bake result", r, "seconds", round(time.time() - t0, 1))

t0 = time.time()
if TEST:
    compare = os.environ.get("LIQUID_COMPARE_BLUR") == "1"
    for f in TEST:
        sc.frame_set(f)
        for blur, suffix in ((MOTION_BLUR, ""), (False, "_noblur")) if compare else ((MOTION_BLUR, ""),):
            sc.render.use_motion_blur = blur
            sc.render.filepath = OUT + f"/test_{f:04d}{suffix}.png"
            bpy.ops.render.render(write_still=True)
else:
    bpy.ops.render.render(animation=True)
print("Render seconds", round(time.time() - t0, 1))
print("RENDER COMPLETE")
