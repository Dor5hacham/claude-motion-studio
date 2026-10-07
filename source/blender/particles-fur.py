# Builds a fluffy fur-ball character with a particle hair system: guide hairs plus interpolated
# children, clumping and roughness, a root-to-tip color gradient (Hair Info node) and hair
# dynamics so the fur lags, swings and settles. The ball drops in, bounces with squash and
# stretch (computed per frame from simple physics), then shakes itself like a wet dog; a soft
# turbulence field keeps the fur alive. Eevee with motion blur, dark studio floor.
# Usage: blender -b -P particles-fur.py -- <out_dir> [test_frame[,test_frame...]]
import bpy, sys, math, time
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:]
OUT = argv[0]
TEST = [int(x) for x in argv[1].split(",")] if len(argv) > 1 else None
FPS, FRAMES = 30, 150
GUIDES = 3000            # simulated guide hairs
CHILDREN = 45            # rendered children per guide
R, HAIR = 1.0, 0.46      # emitter radius, hair length

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
sc.render.use_motion_blur = True
sc.render.motion_blur_shutter = 0.5
if hasattr(sc.render, "hair_type"):
    sc.render.hair_type = "STRIP"
    sc.render.hair_subdiv = 1
vts = [i.identifier for i in sc.view_settings.bl_rna.properties["view_transform"].enum_items]
sc.view_settings.view_transform = "AgX" if "AgX" in vts else "Standard"
sc.render.image_settings.file_format = "PNG"
sc.render.filepath = OUT + "/f_"

world = bpy.data.worlds.new("World"); sc.world = world
world.use_nodes = True
world.node_tree.nodes["Background"].inputs[0].default_value = (0.004, 0.004, 0.008, 1)

def principled(name, color, rough, metal=0.0, coat=0.0):
    m = bpy.data.materials.new(name); m.use_nodes = True
    p = m.node_tree.nodes["Principled BSDF"]
    p.inputs["Base Color"].default_value = color
    p.inputs["Roughness"].default_value = rough
    p.inputs["Metallic"].default_value = metal
    if "Coat Weight" in p.inputs:
        p.inputs["Coat Weight"].default_value = coat
    return m, p

skin_m, _ = principled("Skin", (0.45, 0.05, 0.03, 1), 0.8)
floor_m, fp = principled("Floor", (0.01, 0.01, 0.014, 1), 0.18)
if "Specular IOR Level" in fp.inputs:
    fp.inputs["Specular IOR Level"].default_value = 0.5
eye_m, _ = principled("EyeWhite", (0.92, 0.88, 0.8, 1), 0.15, coat=1.0)
pupil_m, _ = principled("Pupil", (0.005, 0.005, 0.008, 1), 0.05, coat=1.0)

# Fur: violet roots -> coral body -> amber/cream tips, along the strand (Hair Info > Intercept)
fur_m = bpy.data.materials.new("Fur"); fur_m.use_nodes = True
nt = fur_m.node_tree
fb = nt.nodes["Principled BSDF"]
fb.inputs["Roughness"].default_value = 0.42
if "Sheen Weight" in fb.inputs:
    fb.inputs["Sheen Weight"].default_value = 0.2
hi = nt.nodes.new("ShaderNodeHairInfo")
ramp = nt.nodes.new("ShaderNodeValToRGB")
cr = ramp.color_ramp
cr.elements[0].position = 0.0; cr.elements[0].color = (0.12, 0.04, 0.38, 1)
cr.elements[1].position = 1.0; cr.elements[1].color = (1.0, 0.55, 0.16, 1)
e = cr.elements.new(0.35); e.color = (1.0, 0.08, 0.03, 1)
e = cr.elements.new(0.82); e.color = (1.0, 0.2, 0.05, 1)
nt.links.new(hi.outputs["Intercept"], ramp.inputs["Fac"])
# per-strand brightness variation
rnd = nt.nodes.new("ShaderNodeMapRange"); rnd.inputs["To Min"].default_value = 0.75; rnd.inputs["To Max"].default_value = 1.15
nt.links.new(hi.outputs["Random"], rnd.inputs["Value"])
mulc = nt.nodes.new("ShaderNodeMix"); mulc.data_type = "RGBA"; mulc.blend_type = "MULTIPLY"; mulc.inputs["Factor"].default_value = 1.0
nt.links.new(ramp.outputs["Color"], mulc.inputs["A"])
comb = nt.nodes.new("ShaderNodeCombineColor")
for i in range(3):
    nt.links.new(rnd.outputs["Result"], comb.inputs[i])
nt.links.new(comb.outputs[0], mulc.inputs["B"])
nt.links.new(mulc.outputs["Result"], fb.inputs["Base Color"])

# ---- Floor ----
bpy.ops.mesh.primitive_plane_add(size=80, location=(0, 0, 0))
bpy.context.object.data.materials.append(floor_m)

# ---- Fur ball ----
bpy.ops.mesh.primitive_uv_sphere_add(radius=R, segments=96, ring_count=48, location=(0, 0, 0))
ball = bpy.context.object; ball.name = "FurBall"
bpy.ops.object.shade_smooth()
ball.data.materials.append(skin_m)
ball.data.materials.append(fur_m)

EYE_DIRS = [Vector((-0.36, -0.9, 0.3)).normalized(), Vector((0.36, -0.9, 0.3)).normalized()]
# Density map: bald patches under the eyes so strands do not poke through them
vg = ball.vertex_groups.new(name="density")
for v in ball.data.vertices:
    d = min((v.co.normalized() - ed).length for ed in EYE_DIRS)
    w = max(0.0, min(1.0, (d - 0.14) / 0.1))
    vg.add([v.index], w, "REPLACE")

for ed in EYE_DIRS:
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.2, segments=32, ring_count=16, location=ed * (R + 0.08))
    eye = bpy.context.object; bpy.ops.object.shade_smooth(); eye.data.materials.append(eye_m)
    eye.parent = ball
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.1, segments=32, ring_count=16,
                                         location=ed * (R + 0.08) + (ed + Vector((0, 0, -0.1))).normalized() * 0.14)
    pupil = bpy.context.object; bpy.ops.object.shade_smooth(); pupil.data.materials.append(pupil_m)
    pupil.parent = ball

ball.modifiers.new("Fur", "PARTICLE_SYSTEM")
ps = ball.particle_systems[0]
st = ps.settings
st.type = "HAIR"
st.count = GUIDES
st.hair_length = HAIR
st.hair_step = 6
st.emit_from = "FACE"
st.use_emit_random = True
st.material_slot = "Fur"
st.child_type = "INTERPOLATED"
st.child_percent = 8
st.rendered_child_count = CHILDREN
st.child_length = 0.72
st.child_length_threshold = 0.5   # half the children stay full length: uneven, fluffy edge
st.clump_factor = 0.45
st.clump_shape = -0.2
st.roughness_1 = 0.025
st.roughness_1_size = 1.5
st.roughness_endpoint = 0.06
st.roughness_2 = 0.16
st.roughness_2_size = 1.0
st.roughness_2_threshold = 0.75   # a few stray frizzy strands
st.roughness_end_shape = 1.0
st.root_radius = 1.0
st.tip_radius = 0.0
st.radius_scale = 0.006
st.render_step = 5
st.display_step = 4
ps.vertex_group_density = "density"
ps.use_hair_dynamics = True
cs = ps.cloth.settings
cs.quality = 6
cs.mass = 0.15
cs.bending_stiffness = 3.5
cs.bending_damping = 0.6
cs.air_damping = 1.0
cs.pin_stiffness = 1.6
cs.effector_weights.gravity = 0.35
ps.point_cache.frame_start = 1
ps.point_cache.frame_end = FRAMES

# Gentle turbulence so the fur never looks frozen
bpy.ops.object.effector_add(type="TURBULENCE", location=(0, 0, 1.5))
turb = bpy.context.object
turb.field.strength = 4.0
turb.field.size = 0.8
turb.field.noise = 0.0

# ---- Motion: drop, bounces with squash and stretch, settle, wet-dog shake ----
REST = R + HAIR * 0.55   # the ball rests on its compressed fur
g = 2 * (3.4) / (16 ** 2)           # drop from 3.4 above rest in 16 frames
z, v = REST + 3.4, 0.0
squash, squash_v = 0.0, 0.0         # damped spring for squash (positive = flattened)
K, DAMP = 0.32, 0.72
bounces = 0
keys = []
for f in range(1, FRAMES + 1):
    v -= g
    z += v
    if z <= REST and v < 0:
        impact = -v
        z = REST
        v = impact * 0.55 if bounces < 3 else 0.0
        if v < 0.06:
            v = 0.0
        bounces += 1
        squash_v += impact * 0.9
    if v == 0.0 and z <= REST:
        z = REST
    # spring toward zero squash
    squash_v += -K * squash
    squash_v *= DAMP
    squash += squash_v
    stretch = min(0.18, abs(v) * 0.35) if z > REST + 0.01 else 0.0
    d = squash - stretch
    sz = max(0.62, 1.0 - d)
    sxy = 1.0 / math.sqrt(sz)
    keys.append((f, z - REST * (1 - sz), sz, sxy))

for f, zz, sz, sxy in keys:
    ball.location = (0, 0, zz)
    ball.scale = (sxy, sxy, sz)
    # shake: damped yaw wobble between frames 92 and 135, plus a little roll
    t = f - 92
    yaw = 0.8 * math.exp(-t / 11.0) * math.sin(t * 0.95) if t >= 0 else 0.0
    roll = 0.2 * math.exp(-t / 11.0) * math.sin(t * 0.95 + 1.2) if t >= 0 else 0.0
    ball.rotation_euler = (0, roll, yaw)
    ball.keyframe_insert("location", frame=f)
    ball.keyframe_insert("scale", frame=f)
    ball.keyframe_insert("rotation_euler", frame=f)

# ---- Lights ----
aim = bpy.data.objects.new("Aim", None); sc.collection.objects.link(aim); aim.location = (0, 0, 1.2)
def area(name, loc, color, power, size, spec=1.0):
    d = bpy.data.lights.new(name, "AREA"); d.shape = "DISK"; d.color = color; d.energy = power; d.size = size
    d.specular_factor = spec
    o = bpy.data.objects.new(name, d); sc.collection.objects.link(o); o.location = loc
    c = o.constraints.new("TRACK_TO"); c.target = aim; c.track_axis = "TRACK_NEGATIVE_Z"; c.up_axis = "UP_Y"
area("Key", (-4.5, -5.5, 5.5), (1.0, 0.88, 0.78), 900, 3.5)
area("Rim", (5, 4, 4.5), (0.25, 0.8, 1.0), 2800, 2.0)
area("Back", (-4, 6, 6), (0.55, 0.36, 1.0), 2800, 4.0)
area("Fill", (5, -5, 1.5), (1.0, 0.55, 0.35), 220, 4.0, spec=0.3)

# ---- Camera ----
cam_d = bpy.data.cameras.new("Cam"); cam_d.lens = 55
cam_d.dof.use_dof = True; cam_d.dof.aperture_fstop = 2.8
cam = bpy.data.objects.new("Cam", cam_d); sc.collection.objects.link(cam)
sc.camera = cam
target = bpy.data.objects.new("Target", None); sc.collection.objects.link(target)
cam_d.dof.focus_object = target
tc = cam.constraints.new("TRACK_TO"); tc.target = target; tc.track_axis = "TRACK_NEGATIVE_Z"; tc.up_axis = "UP_Y"
for f, loc in [(1, (2.8, -10.0, 2.7)), (FRAMES, (2.0, -8.8, 2.1))]:
    cam.location = loc; cam.keyframe_insert("location", frame=f)
for f, loc in [(1, (0, 0, 1.7)), (FRAMES, (0, 0, 1.25))]:
    target.location = loc; target.keyframe_insert("location", frame=f)

# Bake the hair dynamics. In background mode ptcache.bake_all skips the hair cache, so the
# particle cache is baked directly through a context override after one evaluation.
t0 = time.time()
ps.point_cache.frame_end = max(TEST) if TEST else FRAMES
sc.frame_set(1)
bpy.context.view_layer.update()
with bpy.context.temp_override(point_cache=ps.point_cache, active_object=ball, object=ball):
    bpy.ops.ptcache.bake(bake=True)
print(f"Hair bake done in {time.time() - t0:.1f}s ({ps.point_cache.info})")

t1 = time.time()
if TEST:
    for tf in TEST:
        sc.frame_set(tf)
        sc.render.filepath = OUT + f"/test_{tf:04d}.png"
        bpy.ops.render.render(write_still=True)
else:
    bpy.ops.render.render(animation=True)
print(f"Render done in {time.time() - t1:.1f}s")
print("RENDER COMPLETE")
