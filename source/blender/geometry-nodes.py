# Builds a procedural Geometry Nodes field: a 90x90 grid of beveled columns (8,100) whose
# height and color ripple with a radial wave plus animated 4D noise (scene time),
# rendered with Eevee under a slow camera orbit.
# Usage: blender -b -P geometry-nodes.py -- <out_dir> [test_frame]
import bpy, sys, math

argv = sys.argv[sys.argv.index("--") + 1:]
OUT = argv[0]
TEST = int(argv[1]) if len(argv) > 1 else None
FPS, FRAMES = 30, 150

bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
sc.render.fps = FPS
sc.frame_start, sc.frame_end = 1, FRAMES
sc.render.resolution_x, sc.render.resolution_y = 1280, 720
engines = [e.identifier for e in sc.render.bl_rna.properties["engine"].enum_items]
sc.render.engine = "BLENDER_EEVEE" if "BLENDER_EEVEE" in engines else "BLENDER_EEVEE_NEXT"
ee = sc.eevee
ee.taa_render_samples = 32
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

world = bpy.data.worlds.new("World")
sc.world = world
world.use_nodes = True
bg = world.node_tree.nodes["Background"]
bg.inputs[0].default_value = (0.004, 0.005, 0.009, 1)

# Instance source: a unit column with its origin at the base, beveled edges
bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, 0))
src = bpy.context.object
src.name = "ColumnSource"
for v in src.data.vertices:
    v.co.z += 0.5
bev = src.modifiers.new("Bevel", "BEVEL"); bev.width = 0.06; bev.segments = 3
bpy.ops.object.shade_smooth()
src.hide_render = True
src.hide_viewport = True

# Column material: color comes from the "wave" attribute stored per instance
mat = bpy.data.materials.new("Columns")
mat.use_nodes = True
nt = mat.node_tree
p = nt.nodes["Principled BSDF"]
p.inputs["Roughness"].default_value = 0.25
if "Coat Weight" in p.inputs:
    p.inputs["Coat Weight"].default_value = 0.5
attr = nt.nodes.new("ShaderNodeAttribute")
attr.attribute_type = "INSTANCER"
attr.attribute_name = "wave"
ramp = nt.nodes.new("ShaderNodeValToRGB")
cr = ramp.color_ramp
stops = [(0.0, (0.012, 0.008, 0.035, 1)), (0.22, (0.10, 0.05, 0.75, 1)), (0.48, (0.02, 0.50, 0.78, 1)),
         (0.74, (1.0, 0.10, 0.035, 1)), (1.0, (1.0, 0.45, 0.015, 1))]
cr.elements[0].position, cr.elements[0].color = stops[0]
cr.elements[1].position, cr.elements[1].color = stops[-1]
for pos, col in stops[1:-1]:
    e = cr.elements.new(pos); e.color = col
nt.links.new(attr.outputs["Fac"], ramp.inputs["Fac"])
nt.links.new(ramp.outputs["Color"], p.inputs["Base Color"])
# Peaks glow a little
pw = nt.nodes.new("ShaderNodeMath"); pw.operation = "POWER"; pw.inputs[1].default_value = 4.0
nt.links.new(attr.outputs["Fac"], pw.inputs[0])
em = nt.nodes.new("ShaderNodeMath"); em.operation = "MULTIPLY"; em.inputs[1].default_value = 1.0
nt.links.new(pw.outputs[0], em.inputs[0])
nt.links.new(ramp.outputs["Color"], p.inputs["Emission Color"])
nt.links.new(em.outputs[0], p.inputs["Emission Strength"])

# ---- Geometry Nodes tree ----
ng = bpy.data.node_groups.new("WaveField", "GeometryNodeTree")
ng.interface.new_socket(name="Geometry", in_out="INPUT", socket_type="NodeSocketGeometry")
ng.interface.new_socket(name="Geometry", in_out="OUTPUT", socket_type="NodeSocketGeometry")
N = ng.nodes
L = ng.links.new
gin = N.new("NodeGroupInput")
gout = N.new("NodeGroupOutput")

GRID, SIZE = 90, 22.0
SP = SIZE / (GRID - 1)
grid = N.new("GeometryNodeMeshGrid")
grid.inputs["Size X"].default_value = SIZE
grid.inputs["Size Y"].default_value = SIZE
grid.inputs["Vertices X"].default_value = GRID
grid.inputs["Vertices Y"].default_value = GRID

pos = N.new("GeometryNodeInputPosition")
time = N.new("GeometryNodeInputSceneTime")

def mop(op, a=None, b=None, va=None, vb=None):
    m = N.new("ShaderNodeMath"); m.operation = op
    if a is not None: L(a, m.inputs[0])
    if b is not None: L(b, m.inputs[1])
    if va is not None: m.inputs[0].default_value = va
    if vb is not None: m.inputs[1].default_value = vb
    return m

# Radial wave: sin(dist * k - t * speed)
vlen = N.new("ShaderNodeVectorMath"); vlen.operation = "LENGTH"
L(pos.outputs["Position"], vlen.inputs[0])
dk = mop("MULTIPLY", vlen.outputs["Value"], vb=1.25)
ts = mop("MULTIPLY", time.outputs["Seconds"], vb=3.2)
ph = mop("SUBTRACT", dk.outputs[0], ts.outputs[0])
sn = mop("SINE", ph.outputs[0])
wave01 = mop("MULTIPLY_ADD", sn.outputs[0], vb=0.5)
wave01.inputs[2].default_value = 0.5

# Animated 4D noise, W driven by time
noise = N.new("ShaderNodeTexNoise")
noise.noise_dimensions = "4D"
noise.inputs["Scale"].default_value = 0.16
noise.inputs["Detail"].default_value = 1.5
L(pos.outputs["Position"], noise.inputs["Vector"])
tw = mop("MULTIPLY", time.outputs["Seconds"], vb=0.35)
L(tw.outputs[0], noise.inputs["W"])
nmap = N.new("ShaderNodeMapRange")
nmap.inputs["From Min"].default_value = 0.3
nmap.inputs["From Max"].default_value = 0.7
L(noise.outputs["Fac"], nmap.inputs["Value"])

# Mix: 55% wave, 45% noise, smoothed and clamped
mixw = mop("MULTIPLY", wave01.outputs[0], vb=0.72)
mixn = mop("MULTIPLY", nmap.outputs["Result"], vb=0.28)
mix = mop("ADD", mixw.outputs[0], mixn.outputs[0])
mix.use_clamp = True
# Edge falloff so the field fades out toward the borders
fall = N.new("ShaderNodeMapRange")
fall.inputs["From Min"].default_value = SIZE * 0.42
fall.inputs["From Max"].default_value = SIZE * 0.12
L(vlen.outputs["Value"], fall.inputs["Value"])
wave = mop("MULTIPLY", mix.outputs[0], fall.outputs["Result"])
# Height curve: 0.15 .. 2.75
hpow = mop("POWER", wave.outputs[0], vb=1.6)
height = mop("MULTIPLY_ADD", hpow.outputs[0], vb=2.6)
height.inputs[2].default_value = 0.15

scale = N.new("ShaderNodeCombineXYZ")
scale.inputs["X"].default_value = SP * 0.82
scale.inputs["Y"].default_value = SP * 0.82
L(height.outputs[0], scale.inputs["Z"])

# Slight twist proportional to the wave
rotz = mop("MULTIPLY", wave.outputs[0], vb=0.6)
rot = N.new("ShaderNodeCombineXYZ")
L(rotz.outputs[0], rot.inputs["Z"])

obj_info = N.new("GeometryNodeObjectInfo")
obj_info.inputs["Object"].default_value = src
obj_info.transform_space = "ORIGINAL"

inst = N.new("GeometryNodeInstanceOnPoints")
L(grid.outputs["Mesh"], inst.inputs["Points"])
L(obj_info.outputs["Geometry"], inst.inputs["Instance"])
L(scale.outputs["Vector"], inst.inputs["Scale"])
rot_in = inst.inputs["Rotation"]
try:
    L(rot.outputs["Vector"], rot_in)
except Exception as e:
    print("rotation link note:", e)

store = N.new("GeometryNodeStoreNamedAttribute")
store.data_type = "FLOAT"
store.domain = "INSTANCE"
store.inputs["Name"].default_value = "wave"
L(inst.outputs["Instances"], store.inputs["Geometry"])
L(wave.outputs[0], store.inputs["Value"])

setmat = N.new("GeometryNodeSetMaterial")
setmat.inputs["Material"].default_value = mat
L(store.outputs["Geometry"], setmat.inputs["Geometry"])
L(setmat.outputs["Geometry"], gout.inputs[0])

# Host object
mesh = bpy.data.meshes.new("FieldHost")
host = bpy.data.objects.new("Field", mesh)
sc.collection.objects.link(host)
mod = host.modifiers.new("WaveField", "NODES")
mod.node_group = ng

# Dark glossy floor
fm = bpy.data.materials.new("Floor"); fm.use_nodes = True
fp = fm.node_tree.nodes["Principled BSDF"]
fp.inputs["Base Color"].default_value = (0.01, 0.01, 0.014, 1)
fp.inputs["Roughness"].default_value = 0.18
bpy.ops.mesh.primitive_plane_add(size=120, location=(0, 0, 0))
bpy.context.object.data.materials.append(fm)

# Lights
def area(name, loc, rot, color, power, size):
    d = bpy.data.lights.new(name, "AREA"); d.color = color; d.energy = power; d.size = size
    o = bpy.data.objects.new(name, d); sc.collection.objects.link(o)
    o.location = loc; o.rotation_euler = [math.radians(a) for a in rot]
area("Key", (-8, -9, 12), (40, 0, -40), (1.0, 0.88, 0.78), 1800, 8)
area("Rim", (12, 6, 5), (70, 0, 120), (0.35, 0.8, 1.0), 1400, 5)
area("Back", (0, 14, 7), (-60, 0, 0), (0.55, 0.38, 1.0), 1600, 10)

# Camera on an orbiting pivot, tracking the center
cam_d = bpy.data.cameras.new("Cam"); cam_d.lens = 40
cam_d.dof.use_dof = True; cam_d.dof.aperture_fstop = 2.8
cam = bpy.data.objects.new("Cam", cam_d); sc.collection.objects.link(cam)
sc.camera = cam
target = bpy.data.objects.new("Target", None); sc.collection.objects.link(target)
target.location = (0, 0, 0.8)
cam_d.dof.focus_object = target
pivot = bpy.data.objects.new("Pivot", None); sc.collection.objects.link(pivot)
cam.parent = pivot
cam.location = (0, -16.5, 9.0)
tc = cam.constraints.new("TRACK_TO"); tc.target = target
tc.track_axis = "TRACK_NEGATIVE_Z"; tc.up_axis = "UP_Y"
pivot.rotation_euler = (0, 0, math.radians(-30))
pivot.keyframe_insert("rotation_euler", frame=1)
pivot.rotation_euler = (0, 0, math.radians(15))
pivot.keyframe_insert("rotation_euler", frame=FRAMES)

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
set_interp(pivot, "LINEAR")

if TEST:
    sc.frame_set(TEST)
    sc.render.filepath = OUT + f"/test_{TEST:04d}.png"
    bpy.ops.render.render(write_still=True)
else:
    bpy.ops.render.render(animation=True)
print("RENDER COMPLETE")
