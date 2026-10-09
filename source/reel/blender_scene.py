# Copyright (c) 2026 Dor5hacham d5shacham@gmail.com. All rights reserved.
# SPDX-License-Identifier: Proprietary

# Builds a rigid-body wall-smash scene, bakes Bullet physics and renders with Eevee.
# Usage: blender -b -P blender_scene.py -- <out_dir> [test_frame]
import bpy, sys, math, random

argv = sys.argv[sys.argv.index("--") + 1:]
OUT = argv[0]
TEST = int(argv[1]) if len(argv) > 1 else None
FPS, FRAMES = 60, 480
random.seed(7)

bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
sc.render.fps = FPS
sc.frame_start, sc.frame_end = 1, FRAMES
sc.render.resolution_x, sc.render.resolution_y = 1920, 1080
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
sc.view_settings.view_transform = "Khronos PBR Neutral" if "Khronos PBR Neutral" in [i.identifier for i in sc.view_settings.bl_rna.properties["view_transform"].enum_items] else "AgX"
for look in ():
    try:
        sc.view_settings.look = look
        break
    except TypeError:
        pass
sc.render.image_settings.file_format = "PNG"
sc.render.filepath = OUT + "/f_"

# World: near-black with a faint cool gradient
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

# Cube material: color from object color, a few random cubes glow
cube_mat, cp = principled("Cubes", (1, 1, 1, 1), 0.28, coat=0.6)
nt = cube_mat.node_tree
info = nt.nodes.new("ShaderNodeObjectInfo")
nt.links.new(info.outputs["Color"], cp.inputs["Base Color"])
gt = nt.nodes.new("ShaderNodeMath"); gt.operation = "GREATER_THAN"; gt.inputs[1].default_value = 0.9
nt.links.new(info.outputs["Random"], gt.inputs[0])
mul = nt.nodes.new("ShaderNodeMath"); mul.operation = "MULTIPLY"; mul.inputs[1].default_value = 14.0
nt.links.new(gt.outputs[0], mul.inputs[0])
nt.links.new(info.outputs["Color"], cp.inputs["Emission Color"])
nt.links.new(mul.outputs[0], cp.inputs["Emission Strength"])

floor_mat, _ = principled("Floor", (0.012, 0.012, 0.016, 1), 0.12)
chrome_mat, _ = principled("Chrome", (0.95, 0.95, 0.97, 1), 0.04, metal=1.0)

# Floor (passive)
bpy.ops.mesh.primitive_plane_add(size=80, location=(0, 0, 0))
floor = bpy.context.object
floor.data.materials.append(floor_mat)
bpy.ops.rigidbody.world_add()
rbw = sc.rigidbody_world
rbw.substeps_per_frame = 12
rbw.solver_iterations = 24
rbw.time_scale = 0.45
rbw.point_cache.frame_start, rbw.point_cache.frame_end = 1, FRAMES
bpy.ops.rigidbody.object_add(type="PASSIVE")
floor.rigid_body.friction = 0.6

# Wall of cubes, coral -> amber -> violet gradient with a few cyan accents
palette = [(1.0, 0.27, 0.17), (1.0, 0.55, 0.15), (0.95, 0.25, 0.45), (0.45, 0.25, 1.0)]
def lerp(a, b, t):
    return tuple(a[i] + (b[i] - a[i]) * t for i in range(3))

S, GAP = 0.36, 0.004
NX, NZ, NY = 18, 12, 2
bpy.ops.mesh.primitive_cube_add(size=S)
proto = bpy.context.object
proto.data.materials.append(cube_mat)
bev = proto.modifiers.new("Bevel", "BEVEL"); bev.width = 0.025; bev.segments = 3
cubes = []
for ix in range(NX):
    for iz in range(NZ):
        for iy in range(NY):
            o = proto.copy()
            sc.collection.objects.link(o)
            o.location = ((ix - (NX - 1) / 2) * (S + GAP), iy * (S + GAP), S / 2 + iz * (S + GAP) + 0.0005)
            t = ix / (NX - 1)
            seg = t * (len(palette) - 1)
            k = min(int(seg), len(palette) - 2)
            c = lerp(palette[k], palette[k + 1], seg - k)
            if random.random() < 0.06:
                c = (0.2, 0.85, 1.0)
            shade = 0.75 + 0.25 * (iz / NZ)
            o.color = (c[0] * shade, c[1] * shade, c[2] * shade, 1)
            cubes.append(o)
bpy.data.objects.remove(proto)
bpy.ops.object.select_all(action="DESELECT")
for o in cubes:
    o.select_set(True)
bpy.context.view_layer.objects.active = cubes[0]
bpy.ops.rigidbody.objects_add(type="ACTIVE")
for o in cubes:
    rb = o.rigid_body
    rb.mass = 0.4
    rb.friction = 0.5
    rb.restitution = 0.15
    rb.use_deactivation = True
    rb.use_start_deactivated = True
    rb.collision_margin = 0.002

# Chrome wrecking ball: kinematic until impact, then handed to Bullet with its velocity
bpy.ops.mesh.primitive_uv_sphere_add(radius=0.85, segments=64, ring_count=32, location=(-1.2, -14, 1.5))
ball = bpy.context.object
bpy.ops.object.shade_smooth()
ball.data.materials.append(chrome_mat)
bpy.ops.rigidbody.object_add(type="ACTIVE")
ball.rigid_body.mass = 60
ball.rigid_body.collision_shape = "SPHERE"
ball.rigid_body.kinematic = True
ball.keyframe_insert("location", frame=1)
ball.rigid_body.keyframe_insert("kinematic", frame=1)
ball.location = (-0.6, -2.2, 1.4)
ball.keyframe_insert("location", frame=34)
ball.rigid_body.keyframe_insert("kinematic", frame=34)
ball.rigid_body.kinematic = False
ball.rigid_body.keyframe_insert("kinematic", frame=35)
for fc in ball.animation_data.action.fcurves if hasattr(ball.animation_data.action, "fcurves") else []:
    for kp in fc.keyframe_points:
        kp.interpolation = "LINEAR"
try:
    for kp_owner in [ball.animation_data.action]:
        for layer in getattr(kp_owner, "layers", []):
            for strip in layer.strips:
                for bag in strip.channelbags:
                    for fc in bag.fcurves:
                        for kp in fc.keyframe_points:
                            kp.interpolation = "LINEAR"
except Exception as e:
    print("interp note:", e)

# Lights: warm key, cyan rim, violet back
def area(name, loc, rot, color, power, size):
    d = bpy.data.lights.new(name, "AREA"); d.color = color; d.energy = power; d.size = size
    o = bpy.data.objects.new(name, d); sc.collection.objects.link(o)
    o.location = loc; o.rotation_euler = [math.radians(a) for a in rot]
area("Key", (-5, -6, 7), (50, 0, -40), (1.0, 0.85, 0.75), 2200, 4)
area("Rim", (6, 3, 3), (70, 0, 120), (0.3, 0.85, 1.0), 1600, 3)
area("Back", (0, 8, 5), (-60, 0, 0), (0.6, 0.35, 1.0), 1400, 6)

# Camera: low side angle, slow orbit + push-in, shallow depth of field
cam_d = bpy.data.cameras.new("Cam"); cam_d.lens = 32
cam_d.dof.use_dof = True; cam_d.dof.aperture_fstop = 2.2
cam = bpy.data.objects.new("Cam", cam_d); sc.collection.objects.link(cam)
sc.camera = cam
target = bpy.data.objects.new("Target", None); sc.collection.objects.link(target)
target.location = (0, 0, 1.6)
cam_d.dof.focus_object = target
tc = cam.constraints.new("TRACK_TO"); tc.target = target
tc.track_axis = "TRACK_NEGATIVE_Z"; tc.up_axis = "UP_Y"
keys = [(1, (-10.5, -10.0, 1.1)), (160, (-8.0, -9.5, 1.9)), (480, (5.5, -10.5, 3.6))]
for f, loc in keys:
    cam.location = loc; cam.keyframe_insert("location", frame=f)
target.location = (0, 0, 1.6); target.keyframe_insert("location", frame=1)
target.location = (0, 1.5, 1.0); target.keyframe_insert("location", frame=480)

print("Baking physics...")
bpy.ops.ptcache.bake_all(bake=True)
print("Bake done")

if TEST:
    sc.frame_set(TEST)
    sc.render.filepath = OUT + f"/test_{TEST:04d}.png"
    bpy.ops.render.render(write_still=True)
else:
    bpy.ops.render.render(animation=True)
print("RENDER COMPLETE")
