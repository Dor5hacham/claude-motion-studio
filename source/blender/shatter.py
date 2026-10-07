# Builds a slow-motion destruction shot: a chrome ball smashes an obsidian monolith that was
# pre-fractured into Voronoi cells (bmesh bisect planes, no add-on). The cells are rigid bodies
# held kinematic until impact, then a force-field pulse and gravity throw them apart. The inner
# fracture faces glow amber and cool down while the debris settles on a mirror floor. Eevee.
# The world is near-black to the camera but shows reflections a studio sky with two softbox
# strips, so the chrome ball and the glossy obsidian have something to reflect.
# Usage: blender -b -P shatter.py -- <out_dir> [test_frame]
import bpy, bmesh, sys, random, time
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:]
OUT = argv[0]
TEST = int(argv[1]) if len(argv) > 1 else None
FPS, FRAMES = 30, 150
IMPACT = 34          # frame the ball reaches the slab
N_CELLS = 85         # Voronoi cell count; more cells = finer debris, slower bake
SLOWMO = 0.32        # rigid body time scale (1.0 = real time)
random.seed(7)

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
vts = [i.identifier for i in sc.view_settings.bl_rna.properties["view_transform"].enum_items]
sc.view_settings.view_transform = "AgX" if "AgX" in vts else "Standard"
sc.render.image_settings.file_format = "PNG"
sc.render.filepath = OUT + "/f_"

world = bpy.data.worlds.new("World")
sc.world = world
world.use_nodes = True
wnt = world.node_tree
wbg = wnt.nodes["Background"]
wbg.inputs[0].default_value = (0.004, 0.004, 0.008, 1)
# Reflection-only studio: dark below the horizon, a soft cool sky above, and two bright
# softbox strips (one overhead, one camera-right). Camera rays still see the near-black color.
wtc = wnt.nodes.new("ShaderNodeTexCoord")
wsep = wnt.nodes.new("ShaderNodeSeparateXYZ")
wnt.links.new(wtc.outputs["Generated"], wsep.inputs["Vector"])
wsky = wnt.nodes.new("ShaderNodeValToRGB")
wsky.color_ramp.elements[0].position = 0.3; wsky.color_ramp.elements[0].color = (0.004, 0.004, 0.008, 1)
wsky.color_ramp.elements[1].position = 1.0; wsky.color_ramp.elements[1].color = (0.30, 0.32, 0.38, 1)
wnt.links.new(wsep.outputs["Z"], wsky.inputs["Fac"])
def strip(axis_out, lo, hi, gain):
    m = wnt.nodes.new("ShaderNodeMapRange"); m.interpolation_type = "SMOOTHSTEP"
    m.inputs["From Min"].default_value = lo; m.inputs["From Max"].default_value = hi
    m.inputs["To Max"].default_value = gain
    wnt.links.new(wsep.outputs[axis_out], m.inputs["Value"])
    return m.outputs["Result"]
def mult(a, b):
    m = wnt.nodes.new("ShaderNodeMath"); m.operation = "MULTIPLY"
    wnt.links.new(a, m.inputs[0]); wnt.links.new(b, m.inputs[1])
    return m.outputs[0]
top = strip("Z", 0.80, 0.92, 2.5)                       # overhead box
side = mult(strip("X", 0.55, 0.7, 3.0), strip("Z", 0.05, 0.25, 1.0))   # tall strip camera-right
wadd = wnt.nodes.new("ShaderNodeMath"); wadd.operation = "ADD"
wnt.links.new(top, wadd.inputs[0]); wnt.links.new(side, wadd.inputs[1])
wbox = wnt.nodes.new("ShaderNodeMix"); wbox.data_type = "RGBA"; wbox.blend_type = "ADD"
wnt.links.new(wadd.outputs[0], wbox.inputs["Factor"])
wnt.links.new(wsky.outputs["Color"], wbox.inputs["A"]); wbox.inputs["B"].default_value = (1.0, 0.97, 0.92, 1)
wenv = wnt.nodes.new("ShaderNodeBackground")
wnt.links.new(wbox.outputs["Result"], wenv.inputs["Color"])
wlp = wnt.nodes.new("ShaderNodeLightPath")
wmix = wnt.nodes.new("ShaderNodeMixShader")
wnt.links.new(wlp.outputs["Is Camera Ray"], wmix.inputs["Fac"])
wnt.links.new(wenv.outputs[0], wmix.inputs[1]); wnt.links.new(wbg.outputs[0], wmix.inputs[2])
wnt.links.new(wmix.outputs[0], wnt.nodes["World Output"].inputs["Surface"])

# ---- Materials ----
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

stone_mat, _ = principled("Obsidian", (0.006, 0.005, 0.01, 1), 0.22, coat=1.0)
chrome_mat, _ = principled("Chrome", (0.9, 0.9, 0.92, 1), 0.05, metal=1.0)
floor_mat, fp = principled("Floor", (0.008, 0.008, 0.011, 1), 0.07)
if "Specular IOR Level" in fp.inputs:
    fp.inputs["Specular IOR Level"].default_value = 0.6

# Inner fracture faces: dark rock with glowing magma veins (amber cores, coral edges).
# A noise texture is thresholded into thin veins; a faint base glow keeps every cut face warm.
# CORE strength is keyframed so the glow flares at impact and cools while the debris settles.
core_mat = bpy.data.materials.new("Core")
core_mat.use_nodes = True
nt = core_mat.node_tree
cp = nt.nodes["Principled BSDF"]
cp.inputs["Base Color"].default_value = (0.03, 0.018, 0.016, 1)
cp.inputs["Roughness"].default_value = 0.55
tco = nt.nodes.new("ShaderNodeTexCoord")
noise = nt.nodes.new("ShaderNodeTexNoise")
noise.inputs["Scale"].default_value = 2.2
noise.inputs["Detail"].default_value = 6.0
noise.inputs["Distortion"].default_value = 0.6
nt.links.new(tco.outputs["Object"], noise.inputs["Vector"])
# Veins: |noise - 0.5| near zero
sub = nt.nodes.new("ShaderNodeMath"); sub.operation = "SUBTRACT"; sub.inputs[1].default_value = 0.5
nt.links.new(noise.outputs["Fac"], sub.inputs[0])
ab = nt.nodes.new("ShaderNodeMath"); ab.operation = "ABSOLUTE"
nt.links.new(sub.outputs[0], ab.inputs[0])
vein = nt.nodes.new("ShaderNodeMapRange"); vein.interpolation_type = "SMOOTHSTEP"
vein.inputs["From Min"].default_value = 0.06
vein.inputs["From Max"].default_value = 0.0
nt.links.new(ab.outputs[0], vein.inputs["Value"])
ramp = nt.nodes.new("ShaderNodeValToRGB")
ramp.color_ramp.elements[0].position = 0.0
ramp.color_ramp.elements[0].color = (1.0, 0.09, 0.025, 1)  # coral
ramp.color_ramp.elements[1].position = 1.0
ramp.color_ramp.elements[1].color = (1.0, 0.42, 0.03, 1)   # amber
nt.links.new(vein.outputs["Result"], ramp.inputs["Fac"])
nt.links.new(ramp.outputs["Color"], cp.inputs["Emission Color"])
glow = nt.nodes.new("ShaderNodeMath"); glow.operation = "MULTIPLY_ADD"
glow.inputs[2].default_value = 0.12                      # faint base glow
nt.links.new(vein.outputs["Result"], glow.inputs[0])
core_val = nt.nodes.new("ShaderNodeValue"); core_val.name = "CORE"
nt.links.new(core_val.outputs[0], glow.inputs[1])
nt.links.new(glow.outputs[0], cp.inputs["Emission Strength"])
for f, v in [(1, 0.0), (IMPACT - 1, 0.0), (IMPACT + 1, 9.0), (IMPACT + 35, 4.5), (FRAMES, 1.8)]:
    core_val.outputs[0].default_value = v
    core_val.outputs[0].keyframe_insert("default_value", frame=f)

# ---- Voronoi fracture of a box with bmesh bisect planes ----
W, T, H = 2.4, 0.42, 3.3          # slab width (x), thickness (y), height (z)
IMPACT_PT = Vector((0.35, -T / 2, 2.05))

def box_bm():
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co = Vector((v.co.x * W, v.co.y * T, v.co.z * H + H / 2))
    return bm

seeds = []
for _ in range(int(N_CELLS * 0.55)):      # dense cluster around the impact: small shards
    p = IMPACT_PT + Vector((random.gauss(0, 0.45), 0, random.gauss(0, 0.5)))
    p.y = random.uniform(-T / 2, T / 2) * 0.6
    if abs(p.x) < W / 2 and 0 < p.z < H:
        seeds.append(p)
while len(seeds) < N_CELLS:                # sparse elsewhere: big chunks
    seeds.append(Vector((random.uniform(-W / 2, W / 2), random.uniform(-T / 4, T / 4), random.uniform(0, H))))

src = box_bm()
cells = []
t0 = time.time()
for i, s in enumerate(seeds):
    bm = src.copy()
    for j, t in enumerate(seeds):
        if i == j:
            continue
        n = t - s
        mid = (s + t) / 2
        n.normalize()
        geom = bm.verts[:] + bm.edges[:] + bm.faces[:]
        res = bmesh.ops.bisect_plane(bm, geom=geom, dist=1e-6, plane_co=mid, plane_no=n, clear_outer=True)
        cut = [e for e in res["geom_cut"] if isinstance(e, bmesh.types.BMEdge)]
        if cut:
            new = bmesh.ops.holes_fill(bm, edges=cut, sides=0)
            for f in new["faces"]:
                f.material_index = 1
        if len(bm.verts) < 4:
            break
    if len(bm.faces) < 4:
        bm.free()
        continue
    center = sum((v.co for v in bm.verts), Vector()) / len(bm.verts)
    for v in bm.verts:
        v.co = (v.co - center) * 0.996       # hairline gap so hulls never start interpenetrating
    me = bpy.data.meshes.new(f"Shard_{i:03d}")
    bm.to_mesh(me)
    bm.free()
    me.materials.append(stone_mat)
    me.materials.append(core_mat)
    ob = bpy.data.objects.new(me.name, me)
    sc.collection.objects.link(ob)
    ob.location = center
    cells.append(ob)
src.free()
print(f"Fractured into {len(cells)} cells in {time.time() - t0:.1f}s")

# ---- Floor (thick box so the passive collider has volume) ----
bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, -0.25))
floor = bpy.context.object
floor.scale = (60, 60, 0.5)
floor.data.materials.append(floor_mat)

# ---- Ball ----
bpy.ops.mesh.primitive_uv_sphere_add(radius=0.3, segments=48, ring_count=24, location=(0, 0, 0))
ball = bpy.context.object
bpy.ops.object.shade_smooth()
ball.data.materials.append(chrome_mat)

# ---- Rigid body world ----
bpy.ops.rigidbody.world_add()
rbw = sc.rigidbody_world
rbw.time_scale = SLOWMO
if hasattr(rbw, "substeps_per_frame"):
    rbw.substeps_per_frame = 20
rbw.solver_iterations = 30
rbw.point_cache.frame_start = 1
rbw.point_cache.frame_end = FRAMES
rbw.effector_weights.all = 1.0

def add_rb(ob, kind="ACTIVE"):
    bpy.ops.object.select_all(action="DESELECT")
    ob.select_set(True)
    bpy.context.view_layer.objects.active = ob
    bpy.ops.rigidbody.object_add(type=kind)
    return ob.rigid_body

fl = add_rb(floor, "PASSIVE")
fl.collision_shape = "BOX"
fl.friction = 0.8
fl.restitution = 0.1

for ob in cells:
    rb = add_rb(ob)
    rb.collision_shape = "CONVEX_HULL"
    rb.use_margin = True
    rb.collision_margin = 0.0005
    rb.friction = 0.7
    rb.restitution = 0.15
    rb.linear_damping = 0.08
    rb.angular_damping = 0.12
    rb.mass = max(0.08, ob.dimensions.x * ob.dimensions.y * ob.dimensions.z * 25.0)
    # Held in place, then handed to the solver a few frames before the ball touches.
    # Releasing them after contact would start the ball inside the shards and eject them.
    rb.kinematic = True
    ob.keyframe_insert("rigid_body.kinematic", frame=1)
    ob.keyframe_insert("rigid_body.kinematic", frame=IMPACT - 5)
    rb.kinematic = False
    ob.keyframe_insert("rigid_body.kinematic", frame=IMPACT - 4)

# Ball is animated (kinematic) on a straight line through the slab, so it always punches
# through, then it is released to the solver and falls with the debris.
rb = add_rb(ball)
rb.collision_shape = "SPHERE"
rb.mass = 6.0
rb.friction = 0.4
rb.restitution = 0.3
start = IMPACT_PT + Vector((-2.4, -4.6, 0.35))
d = (IMPACT_PT - start)
per_frame = d / (IMPACT - 1)
RELEASE = IMPACT + 5
for f in (1, RELEASE):
    ball.location = start + per_frame * (f - 1)
    ball.keyframe_insert("location", frame=f)
rb.kinematic = True
ball.keyframe_insert("rigid_body.kinematic", frame=1)
ball.keyframe_insert("rigid_body.kinematic", frame=RELEASE)
rb.kinematic = False
ball.keyframe_insert("rigid_body.kinematic", frame=RELEASE + 1)

def all_fcurves(obj):
    act = obj.animation_data.action
    fcs = list(getattr(act, "fcurves", []) or [])
    for layer in getattr(act, "layers", []):
        for strip in layer.strips:
            for bag in strip.channelbags:
                fcs.extend(bag.fcurves)
    return fcs
for fc in all_fcurves(ball):
    for kp in fc.keyframe_points:
        kp.interpolation = "LINEAR"

# Blast: a short radial force pulse at the impact point pushes the shards outward
bpy.ops.object.effector_add(type="FORCE", location=IMPACT_PT + Vector((0, -0.35, 0)))
blast = bpy.context.object
blast.field.shape = "POINT"
blast.field.falloff_type = "SPHERE"
blast.field.use_max_distance = True
blast.field.distance_max = 2.5
blast.field.falloff_power = 2.0   # force scales with (1 + r)^-2
for f, s in [(IMPACT, 0), (IMPACT + 1, 900), (IMPACT + 4, 0)]:
    blast.field.strength = s
    blast.field.keyframe_insert("strength", frame=f)

# ---- Lights ----
aim = bpy.data.objects.new("Aim", None); sc.collection.objects.link(aim)
aim.location = (0, 0, 1.4)
def area(name, loc, color, power, size, spec=1.0):
    dl = bpy.data.lights.new(name, "AREA"); dl.shape = "DISK"; dl.color = color; dl.energy = power; dl.size = size
    dl.specular_factor = spec
    o = bpy.data.objects.new(name, dl); sc.collection.objects.link(o)
    o.location = loc
    c = o.constraints.new("TRACK_TO"); c.target = aim
    c.track_axis = "TRACK_NEGATIVE_Z"; c.up_axis = "UP_Y"
    return o
area("Key", (-5, -6, 6), (1.0, 0.88, 0.8), 450, 4)
area("Rim", (6, 5, 7), (0.25, 0.8, 1.0), 2200, 2.5)
area("Back", (-5, 7, 8), (0.55, 0.36, 1.0), 2600, 5)
# Impact flash: an amber point light that flares at the hit and fades
fl_d = bpy.data.lights.new("Flash", "POINT"); fl_d.color = (1.0, 0.55, 0.15); fl_d.shadow_soft_size = 0.3
flash = bpy.data.objects.new("Flash", fl_d); sc.collection.objects.link(flash)
flash.location = IMPACT_PT + Vector((0, -0.6, 0))
for f, e in [(IMPACT - 1, 0), (IMPACT + 1, 1400), (IMPACT + 25, 200), (FRAMES, 80)]:
    fl_d.energy = e
    fl_d.keyframe_insert("energy", frame=f)

# ---- Camera: low three-quarter view, slow push-in ----
cam_d = bpy.data.cameras.new("Cam"); cam_d.lens = 45
cam_d.dof.use_dof = True; cam_d.dof.aperture_fstop = 4.0
cam = bpy.data.objects.new("Cam", cam_d); sc.collection.objects.link(cam)
sc.camera = cam
target = bpy.data.objects.new("Target", None); sc.collection.objects.link(target)
cam_d.dof.focus_object = target
tc = cam.constraints.new("TRACK_TO"); tc.target = target
tc.track_axis = "TRACK_NEGATIVE_Z"; tc.up_axis = "UP_Y"
for f, loc in [(1, (5.4, -9.0, 2.4)), (FRAMES, (5.0, -8.6, 2.0))]:
    cam.location = loc; cam.keyframe_insert("location", frame=f)
for f, loc in [(1, (0, 0, 1.6)), (FRAMES, (0.9, 0.9, 0.6))]:
    target.location = loc; target.keyframe_insert("location", frame=f)

# ---- Simulate ----
t0 = time.time()
sc.frame_end = TEST if TEST else FRAMES
bpy.ops.ptcache.bake_all(bake=True)
print(f"Bake done in {time.time() - t0:.1f}s")
sc.frame_end = FRAMES

t1 = time.time()
if TEST:
    sc.frame_set(TEST)
    print("BALL at", tuple(round(c, 2) for c in ball.matrix_world.translation))
    sc.render.filepath = OUT + f"/test_{TEST:04d}.png"
    bpy.ops.render.render(write_still=True)
else:
    bpy.ops.render.render(animation=True)
print(f"Render done in {time.time() - t1:.1f}s")
print("RENDER COMPLETE")
