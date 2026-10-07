# Builds a cloth-simulation shot: a coral silk sheet falls in light wind and drapes
# over a glossy violet sphere on a dark studio floor. Bakes the cloth, renders with Eevee.
# Usage: blender -b -P cloth.py -- <out_dir> [test_frame]
import bpy, sys, math, os

argv = sys.argv[sys.argv.index("--") + 1:]
OUT = argv[0]
TEST = int(argv[1]) if len(argv) > 1 else None
FPS, FRAMES = 30, 150
GRID = 80  # cloth grid cuts per side; lower it to bake faster

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.context.preferences.filepaths.temporary_directory = os.path.join(OUT, "tmp")
sc = bpy.context.scene
sc.render.fps = FPS
sc.frame_start, sc.frame_end = 1, (TEST if TEST else FRAMES)
sc.render.resolution_x, sc.render.resolution_y = 1280, 720
engines = [e.identifier for e in sc.render.bl_rna.properties["engine"].enum_items]
sc.render.engine = "BLENDER_EEVEE" if "BLENDER_EEVEE" in engines else "BLENDER_EEVEE_NEXT"
ee = sc.eevee
ee.taa_render_samples = 64
for attr, val in [("use_raytracing", True), ("use_shadows", True), ("use_gtao", True)]:
    if hasattr(ee, attr):
        setattr(ee, attr, val)
if hasattr(sc.render, "use_motion_blur"):
    sc.render.use_motion_blur = True
    sc.render.motion_blur_shutter = 0.5
vts = [i.identifier for i in sc.view_settings.bl_rna.properties["view_transform"].enum_items]
sc.view_settings.view_transform = "Khronos PBR Neutral" if "Khronos PBR Neutral" in vts else "AgX"
sc.render.image_settings.file_format = "PNG"
sc.render.filepath = OUT + "/f_"

# World: near-black
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

floor_mat, fp = principled("Floor", (0.010, 0.010, 0.014, 1), 0.12)
if "Specular IOR Level" in fp.inputs:
    fp.inputs["Specular IOR Level"].default_value = 0.5
ball_mat, _ = principled("Ball", (0.20, 0.12, 1.0, 1), 0.18, coat=1.0)
silk_mat, sp = principled("Silk", (0.95, 0.10, 0.035, 1), 0.36)
for k, v in [("Sheen Weight", 0.45), ("Sheen Roughness", 0.3), ("Specular IOR Level", 0.5)]:
    if k in sp.inputs:
        sp.inputs[k].default_value = v
if "Sheen Tint" in sp.inputs:
    sp.inputs["Sheen Tint"].default_value = (1.0, 0.55, 0.4, 1)

# Floor with collision
bpy.ops.mesh.primitive_plane_add(size=400, location=(0, 0, 0))
floor = bpy.context.object
floor.data.materials.append(floor_mat)
floor.modifiers.new("Collision", "COLLISION")
floor.collision.thickness_outer = 0.01
floor.collision.cloth_friction = 8

# Glossy sphere with collision
R = 1.0
bpy.ops.mesh.primitive_uv_sphere_add(radius=R, segments=64, ring_count=32, location=(0, 0, R))
ball = bpy.context.object
bpy.ops.object.shade_smooth()
ball.data.materials.append(ball_mat)
ball.modifiers.new("Collision", "COLLISION")
ball.collision.thickness_outer = 0.012
ball.collision.cloth_friction = 6

# Cloth sheet: tilted and turned so it lands off-center and folds unevenly
bpy.ops.mesh.primitive_grid_add(x_subdivisions=GRID, y_subdivisions=GRID, size=4.4, location=(0.3, -0.2, 2.7))
sheet = bpy.context.object
sheet.rotation_euler = (math.radians(9), math.radians(-6), math.radians(24))
bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
bpy.ops.object.shade_smooth()
sheet.data.materials.append(silk_mat)
cm = sheet.modifiers.new("Cloth", "CLOTH")
cs = cm.settings
cs.quality = 7
cs.mass = 0.15
cs.air_damping = 1.5
cs.tension_stiffness = 12
cs.compression_stiffness = 12
cs.shear_stiffness = 5
cs.bending_stiffness = 0.08
cs.time_scale = 0.75
cc = cm.collision_settings
cc.collision_quality = 3
cc.distance_min = 0.012
cc.use_self_collision = True
cc.self_distance_min = 0.008
cc.self_friction = 4
cm.point_cache.frame_start = 1
cm.point_cache.frame_end = sc.frame_end
ss = sheet.modifiers.new("Subsurf", "SUBSURF"); ss.levels = 1; ss.render_levels = 2
so = sheet.modifiers.new("Solidify", "SOLIDIFY"); so.thickness = 0.008; so.offset = 0

# Light wind from camera-left so the hanging edges ripple
bpy.ops.object.effector_add(type="WIND", location=(-5, -2, 1.5))
wind = bpy.context.object
wind.rotation_euler = (0, math.radians(90), math.radians(20))
wind.field.strength = 3.0
wind.field.noise = 1.2
wind.field.seed = 11

# Lights: warm key, cyan rim, violet back. Rim and back sit high so their floor
# reflections fall below the bottom of the frame.
aim = bpy.data.objects.new("LightAim", None); sc.collection.objects.link(aim)
aim.location = (0, 0, 1.0)
def area(name, loc, color, power, size):
    d = bpy.data.lights.new(name, "AREA"); d.shape = "DISK"; d.color = color; d.energy = power; d.size = size
    o = bpy.data.objects.new(name, d); sc.collection.objects.link(o)
    o.location = loc
    c = o.constraints.new("TRACK_TO"); c.target = aim
    c.track_axis = "TRACK_NEGATIVE_Z"; c.up_axis = "UP_Y"
area("Key", (-4, -5, 6), (1.0, 0.86, 0.76), 1150, 3.5)
area("Rim", (6, 4, 10), (0.3, 0.85, 1.0), 1800, 3)
area("Back", (-1, 7, 11), (0.6, 0.35, 1.0), 2400, 5)
# Soft overhead spot: a gentle pool of light on the floor around the sphere
sd = bpy.data.lights.new("Pool", "SPOT"); sd.energy = 1700; sd.spot_size = math.radians(55)
sd.spot_blend = 1.0; sd.color = (1.0, 0.9, 0.85); sd.shadow_soft_size = 1.5
spot = bpy.data.objects.new("Pool", sd); sc.collection.objects.link(spot); spot.location = (0, 0, 9)

# Camera: low three-quarter angle, slow orbit and push-in, shallow depth of field
cam_d = bpy.data.cameras.new("Cam"); cam_d.lens = 45
cam_d.dof.use_dof = True; cam_d.dof.aperture_fstop = 2.8
cam = bpy.data.objects.new("Cam", cam_d); sc.collection.objects.link(cam)
sc.camera = cam
target = bpy.data.objects.new("Target", None); sc.collection.objects.link(target)
cam_d.dof.focus_object = target
tc = cam.constraints.new("TRACK_TO"); tc.target = target
tc.track_axis = "TRACK_NEGATIVE_Z"; tc.up_axis = "UP_Y"
for f, loc in [(1, (-5.6, -7.6, 4.6)), (FRAMES, (-2.0, -7.9, 3.7))]:
    cam.location = loc; cam.keyframe_insert("location", frame=f)
for f, loc in [(1, (0, 0, 1.2)), (FRAMES, (0.1, 0, 0.8))]:
    target.location = loc; target.keyframe_insert("location", frame=f)

import time
t0 = time.time()
print("Baking cloth...")
bpy.ops.ptcache.bake_all(bake=True)
print(f"Bake done in {time.time() - t0:.1f}s")

t1 = time.time()
if TEST:
    sc.frame_set(TEST)
    sc.render.filepath = OUT + f"/test_{TEST:04d}.png"
    bpy.ops.render.render(write_still=True)
else:
    bpy.ops.render.render(animation=True)
print(f"Render done in {time.time() - t1:.1f}s")
print("RENDER COMPLETE")
