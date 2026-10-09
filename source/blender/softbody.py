# Copyright (c) 2026 Dor5hacham d5shacham@gmail.com. All rights reserved.
# SPDX-License-Identifier: Proprietary

# Builds a soft-body jelly shot: four translucent gummy cubes in the reel palette drop one after
# another onto a dark studio floor and squash and wobble; a fifth, cream cube drops late (its cloth
# cache starts at LATE_START), so something is still bouncing near the end. Bakes the simulation,
# renders with Eevee (subsurface scattering and a back light for the gummy look). Uses closed
# cloth meshes with pressure for the jelly (more stable than the Soft Body solver).
# Usage: blender -b -P softbody.py -- <out_dir> [test_frame | start:end:step preview]
import bpy, bmesh, sys, math, os, time

argv = sys.argv[sys.argv.index("--") + 1:]
OUT = argv[0]
ARG = argv[1] if len(argv) > 1 else ""
PREVIEW = [int(x) for x in ARG.split(":")] if ":" in ARG else None  # start:end:step, half size
TEST = int(ARG) if ARG and not PREVIEW else None
FPS, FRAMES = 30, 150
LATE_START = 66        # frame the cream cube starts to fall

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.context.preferences.filepaths.temporary_directory = os.path.join(OUT, "tmp")
sc = bpy.context.scene
sc.render.fps = FPS
sc.frame_start, sc.frame_end = 1, (TEST or (PREVIEW[1] if PREVIEW else FRAMES))
sc.render.resolution_x, sc.render.resolution_y = 1280, 720
engines = [e.identifier for e in sc.render.bl_rna.properties["engine"].enum_items]
sc.render.engine = "BLENDER_EEVEE" if "BLENDER_EEVEE" in engines else "BLENDER_EEVEE_NEXT"
ee = sc.eevee
ee.taa_render_samples = 128
for attr, val in [("use_raytracing", True), ("use_shadows", True), ("use_gtao", True)]:
    if hasattr(ee, attr):
        setattr(ee, attr, val)
if hasattr(ee, "ray_tracing_options"):
    ee.ray_tracing_options.resolution_scale = "1"   # full-res reflections and refraction: less grain
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

def jelly(name, color):
    # Gummy: strong subsurface scattering whose radius follows the cube's own color, so light
    # travels far in that color and the jelly glows saturated instead of milky. A low back light
    # (Glow, below) shines through the edges. Eevee's raytraced transmission looked dark and
    # speckled on this near-black set, so it is not used.
    m, p = principled(name, color, 0.1, coat=1.0)
    for k, v in [("Subsurface Weight", 1.0), ("Subsurface Scale", 0.35), ("Coat Roughness", 0.03), ("IOR", 1.36)]:
        if k in p.inputs:
            p.inputs[k].default_value = v
    if "Subsurface Radius" in p.inputs:
        p.inputs["Subsurface Radius"].default_value = tuple(max(0.05, c) for c in color[:3])
    return m

floor_mat, fp = principled("Floor", (0.010, 0.010, 0.014, 1), 0.12)
if "Specular IOR Level" in fp.inputs:
    fp.inputs["Specular IOR Level"].default_value = 0.5

# Floor with collision
bpy.ops.mesh.primitive_plane_add(size=400, location=(0, 0, 0))
floor = bpy.context.object
floor.data.materials.append(floor_mat)
floor.modifiers.new("Collision", "COLLISION")
floor.collision.thickness_outer = 0.02
floor.collision.cloth_friction = 8

# Jelly cubes: closed cloth meshes held in shape by volume pressure ("pressure jelly").
S = 0.9
cubes = [
    # name, color, location, rotation (deg)
    ("Coral",  (1.0, 0.13, 0.05, 1), (-2.0, 0.7, 1.8), (6, -12, 18)),
    ("Amber",  (1.0, 0.45, 0.02, 1), (-0.45, -0.9, 3.4), (-12, 8, -10)),
    ("Cyan",   (0.03, 0.55, 0.85, 1), (0.95, 1.0, 5.4), (14, 10, 30)),
    ("Violet", (0.20, 0.10, 1.0, 1), (2.25, -0.6, 8.0), (-8, -16, 40)),
    ("Cream",  (0.95, 0.85, 0.70, 1), (0.75, -2.1, 6.0), (20, -14, 12)),   # late drop, see LATE_START
]
for name, color, loc, rot in cubes:
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=S)
    bmesh.ops.subdivide_edges(bm, edges=bm.edges[:], cuts=5, use_grid_fill=True)
    bm.to_mesh(me); bm.free()
    for poly in me.polygons:
        poly.use_smooth = True
    o = bpy.data.objects.new(name, me); sc.collection.objects.link(o)
    o.location = loc
    o.rotation_euler = [math.radians(a) for a in rot]
    me.materials.append(jelly(name, color))
    cm = o.modifiers.new("Cloth", "CLOTH")
    cs = cm.settings
    cs.quality = 8
    cs.mass = 0.3
    cs.air_damping = 0.1
    cs.tension_stiffness = cs.compression_stiffness = 12
    cs.shear_stiffness = 7
    cs.bending_model = "ANGULAR"
    cs.bending_stiffness = 2.2
    cs.tension_damping = cs.compression_damping = cs.shear_damping = 0.2
    cs.bending_damping = 0.05
    cs.use_pressure = True
    cs.uniform_pressure_force = 0.0
    cs.pressure_factor = 12.0   # high enough that a face pushed in pops back out (no leftover dent)
    cs.time_scale = 0.85
    cc = cm.collision_settings
    cc.collision_quality = 6
    cc.distance_min = 0.02
    cc.impulse_clamp = 1.5
    cc.friction = 8
    cm.point_cache.frame_start = LATE_START if name == "Cream" else 1   # held above the frame until then
    cm.point_cache.frame_end = sc.frame_end
    ss = o.modifiers.new("Subsurf", "SUBSURF"); ss.levels = 1; ss.render_levels = 2

# Lights: warm key, cyan rim, violet back. Rim and back sit high so their floor
# reflections fall below the bottom of the frame.
aim = bpy.data.objects.new("LightAim", None); sc.collection.objects.link(aim)
aim.location = (0.2, 0, 0.4)
def area(name, loc, color, power, size):
    d = bpy.data.lights.new(name, "AREA"); d.shape = "DISK"; d.color = color; d.energy = power; d.size = size
    o = bpy.data.objects.new(name, d); sc.collection.objects.link(o)
    o.location = loc
    c = o.constraints.new("TRACK_TO"); c.target = aim
    c.track_axis = "TRACK_NEGATIVE_Z"; c.up_axis = "UP_Y"
area("Key", (-6.5, -2.5, 3.8), (1.0, 0.86, 0.76), 1000, 2.5)
area("Rim", (6, 4, 10), (0.3, 0.85, 1.0), 1600, 3)
area("Back", (-1, 7, 11), (0.6, 0.35, 1.0), 2200, 5)
area("Fill", (1, -7, 2), (1.0, 0.9, 0.85), 150, 6)
# Low back light that shines through the jelly; light-linked to the cubes so the floor stays dark
area("Glow", (0.4, 5.5, 1.3), (1.0, 0.92, 0.85), 900, 3)
glow_rx = bpy.data.collections.new("GlowReceivers")
for name, *_ in cubes:
    glow_rx.objects.link(bpy.data.objects[name])
bpy.data.objects["Glow"].light_linking.receiver_collection = glow_rx
# Soft overhead spot: a gentle pool of light on the floor under the cubes
sd = bpy.data.lights.new("Pool", "SPOT"); sd.energy = 2500; sd.spot_size = math.radians(55)
sd.spot_blend = 1.0; sd.color = (1.0, 0.9, 0.85); sd.shadow_soft_size = 1.5
so = bpy.data.objects.new("Pool", sd); sc.collection.objects.link(so); so.location = (0.2, 0.2, 9)

# Camera: three-quarter view looking down past the horizon, slow push-in and drift
cam_d = bpy.data.cameras.new("Cam"); cam_d.lens = 42
cam_d.dof.use_dof = True; cam_d.dof.aperture_fstop = 2.8
cam = bpy.data.objects.new("Cam", cam_d); sc.collection.objects.link(cam)
sc.camera = cam
target = bpy.data.objects.new("Target", None); sc.collection.objects.link(target)
cam_d.dof.focus_object = target
tc = cam.constraints.new("TRACK_TO"); tc.target = target
tc.track_axis = "TRACK_NEGATIVE_Z"; tc.up_axis = "UP_Y"
for f, loc in [(1, (-3.8, -8.6, 4.0)), (FRAMES, (-1.4, -8.4, 3.2))]:
    cam.location = loc; cam.keyframe_insert("location", frame=f)
for f, loc in [(1, (0.15, 0, 0.9)), (FRAMES, (0.15, 0, 0.45))]:
    target.location = loc; target.keyframe_insert("location", frame=f)
# Linear camera move: it keeps drifting right up to the last frame instead of easing to a stop
for ob in (cam, target):
    act = ob.animation_data.action
    fcs = list(getattr(act, "fcurves", []) or [])
    for layer in getattr(act, "layers", []):
        for strip in layer.strips:
            for bag in strip.channelbags:
                fcs.extend(bag.fcurves)
    for fc in fcs:
        for kp in fc.keyframe_points:
            kp.interpolation = "LINEAR"

t0 = time.time()
print("Baking jelly cubes...")
bpy.ops.ptcache.bake_all(bake=True)
print(f"Bake done in {time.time() - t0:.1f}s")

t1 = time.time()
if PREVIEW:
    sc.render.resolution_percentage = 50
    ee.taa_render_samples = 16
    for f in range(PREVIEW[0], PREVIEW[1] + 1, PREVIEW[2]):
        sc.frame_set(f)
        sc.render.filepath = OUT + f"/prev_{f:04d}.png"
        bpy.ops.render.render(write_still=True)
elif TEST:
    sc.frame_set(TEST)
    sc.render.filepath = OUT + f"/test_{TEST:04d}.png"
    bpy.ops.render.render(write_still=True)
else:
    bpy.ops.render.render(animation=True)
print(f"Render done in {time.time() - t1:.1f}s")
print("RENDER COMPLETE")
