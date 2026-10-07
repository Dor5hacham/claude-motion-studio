# Builds a Mantaflow FLIP liquid shot: a glossy coral stream pours onto a cream sphere,
# coats it and spills across a dark studio floor. Bakes the fluid, then renders with Eevee.
# The fluid cache goes to <out_dir>/cache and is rebaked on every run.
# Usage: blender -b -P liquid.py -- <out_dir> [test_frame[,test_frame...]]
import bpy, sys, os, math, time

argv = sys.argv[sys.argv.index("--") + 1:]
OUT = os.path.abspath(argv[0])
TEST = [int(x) for x in argv[1].split(",")] if len(argv) > 1 else None
CACHE = os.path.join(OUT, "cache")
FPS, FRAMES = 30, 150
RES = 128

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
if hasattr(ee, "ray_tracing_options"):
    ee.ray_tracing_options.resolution_scale = "1"
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
floor_mat, _ = principled("Floor", (0.008, 0.008, 0.011, 1), 0.22)
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

# Inflow nozzle: small cylinder above the sphere, shooting liquid down, drifting slightly
bpy.ops.mesh.primitive_cylinder_add(radius=0.15, depth=0.16, vertices=32, location=(-0.22, 0.05, 2.75))
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
fs.keyframe_insert("use_inflow", frame=1)
fs.keyframe_insert("use_inflow", frame=104)
fs.use_inflow = False
fs.keyframe_insert("use_inflow", frame=105)
nozzle.keyframe_insert("location", frame=1)
nozzle.location = (0.12, -0.05, 2.75)
nozzle.keyframe_insert("location", frame=104)

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
ds.mesh_smoothen_pos = 2
ds.mesh_smoothen_neg = 2
ds.mesh_generator = "IMPROVED"
ds.use_speed_vectors = True
ds.use_adaptive_timesteps = True
ds.timesteps_max = 6
ds.surface_tension = 0.0
for side in ("front", "back", "left", "right", "top"):
    setattr(ds, "use_collision_border_" + side, False)
ds.use_collision_border_bottom = True
ds.cache_directory = CACHE
ds.cache_type = "ALL"
ds.cache_data_format = "OPENVDB"
ds.cache_mesh_format = "BOBJ" if "BOBJ" in [i.identifier for i in ds.bl_rna.properties["cache_mesh_format"].enum_items] else ds.cache_mesh_format
ds.cache_frame_start, ds.cache_frame_end = 1, FRAMES
dom.location.z = 1.5 - 0.05  # bottom wall voxel layer lines up with the floor
bpy.ops.object.shade_smooth()

# Lights: warm key, cyan rim, violet back, soft top fill for long highlights on the liquid
def area(name, loc, rot, color, power, size):
    d = bpy.data.lights.new(name, "AREA"); d.color = color; d.energy = power; d.size = size
    o = bpy.data.objects.new(name, d); sc.collection.objects.link(o)
    o.location = loc; o.rotation_euler = [math.radians(a) for a in rot]
area("Key", (-4, -4.5, 5), (50, 0, -40), (1.0, 0.88, 0.78), 800, 3)
area("Rim", (4.5, 2.5, 2.6), (65, 0, 120), (0.3, 0.85, 1.0), 380, 2.0)
area("Back", (0, 6, 4), (-60, 0, 0), (0.6, 0.35, 1.0), 300, 5)
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
for f, loc in [(1, (-4.3, -6.7, 1.7)), (FRAMES, (-1.8, -7.1, 1.35))]:
    cam.location = loc; cam.keyframe_insert("location", frame=f)
for f, loc in [(1, (0, 0, 1.05)), (FRAMES, (0, 0, 0.8))]:
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
    for f in TEST:
        sc.frame_set(f)
        sc.render.filepath = OUT + f"/test_{f:04d}.png"
        bpy.ops.render.render(write_still=True)
else:
    bpy.ops.render.render(animation=True)
print("Render seconds", round(time.time() - t0, 1))
print("RENDER COMPLETE")
