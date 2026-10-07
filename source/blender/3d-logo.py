# Builds a 3D text logo reveal in Eevee: the word "MOTION" in Segoe UI Bold, extruded, converted
# to mesh and beveled with a Bevel modifier (no spikes on sharp corners), one object per letter.
# Letters rise out of a glossy floor with a staggered overshoot (BACK easing); the first letter
# is already breaking the floor on frame 1. A light strip sweeps across the metallic bevels and
# the camera pushes in. Coral glossy faces, cream-gold metallic bevels. Floor and back wall are one
# curved cyc whose violet glow fades out toward the floor, so there is no hard horizon line. The cyan rim light is linked to
# the letters only, so it leaves no glow on the floor.
# Usage: blender -b -P 3d-logo.py -- <out_dir> [test_frame]
import bpy, bmesh, sys, math

argv = sys.argv[sys.argv.index("--") + 1:]
OUT = argv[0]
TEST = int(argv[1]) if len(argv) > 1 else None
FPS, FRAMES = 30, 150
WORD = "MOTION"

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
sc.view_settings.view_transform = "Khronos PBR Neutral" if "Khronos PBR Neutral" in vts else "AgX"
sc.render.image_settings.file_format = "PNG"
sc.render.filepath = OUT + "/f_"

world = bpy.data.worlds.new("World")
sc.world = world
world.use_nodes = True
world.node_tree.nodes["Background"].inputs[0].default_value = (0.004, 0.004, 0.007, 1)

# ---- Letter material: coral gloss on the front face, cream-gold metal on bevels and sides ----
mat = bpy.data.materials.new("Logo")
mat.use_nodes = True
nt = mat.node_tree
out_node = nt.nodes["Material Output"]
face = nt.nodes["Principled BSDF"]
face.inputs["Base Color"].default_value = (1.0, 0.14, 0.05, 1)
face.inputs["Roughness"].default_value = 0.3
if "Coat Weight" in face.inputs:
    face.inputs["Coat Weight"].default_value = 0.35
    face.inputs["Coat Roughness"].default_value = 0.04
edge = nt.nodes.new("ShaderNodeBsdfPrincipled")
edge.inputs["Base Color"].default_value = (0.95, 0.80, 0.60, 1)
edge.inputs["Metallic"].default_value = 1.0
edge.inputs["Roughness"].default_value = 0.16
# Front-face mask: object-space normal pointing along local +Z (the text front)
geo = nt.nodes.new("ShaderNodeNewGeometry")
vt = nt.nodes.new("ShaderNodeVectorTransform")
vt.vector_type = "NORMAL"; vt.convert_from = "WORLD"; vt.convert_to = "OBJECT"
nt.links.new(geo.outputs["Normal"], vt.inputs["Vector"])
sep = nt.nodes.new("ShaderNodeSeparateXYZ")
nt.links.new(vt.outputs["Vector"], sep.inputs["Vector"])
mr = nt.nodes.new("ShaderNodeMapRange")
mr.inputs["From Min"].default_value = 0.93
mr.inputs["From Max"].default_value = 0.985
nt.links.new(sep.outputs["Z"], mr.inputs["Value"])
mix = nt.nodes.new("ShaderNodeMixShader")
nt.links.new(mr.outputs["Result"], mix.inputs["Fac"])
nt.links.new(edge.outputs["BSDF"], mix.inputs[1])
nt.links.new(face.outputs["BSDF"], mix.inputs[2])
# Glint: a bright diagonal band in world X that sweeps across the bevels.
# GLINT_X is keyframed below; the band is tilted by world Z.
glint_x = nt.nodes.new("ShaderNodeValue"); glint_x.name = "GLINT_X"
glint_x.outputs[0].default_value = -10.0
wpos = nt.nodes.new("ShaderNodeSeparateXYZ")
nt.links.new(geo.outputs["Position"], wpos.inputs["Vector"])
tilt = nt.nodes.new("ShaderNodeMath"); tilt.operation = "MULTIPLY_ADD"
tilt.inputs[1].default_value = 0.45
nt.links.new(wpos.outputs["Z"], tilt.inputs[0]); nt.links.new(wpos.outputs["X"], tilt.inputs[2])
dist = nt.nodes.new("ShaderNodeMath"); dist.operation = "SUBTRACT"
nt.links.new(tilt.outputs[0], dist.inputs[0]); nt.links.new(glint_x.outputs[0], dist.inputs[1])
adist = nt.nodes.new("ShaderNodeMath"); adist.operation = "ABSOLUTE"
nt.links.new(dist.outputs[0], adist.inputs[0])
band = nt.nodes.new("ShaderNodeMapRange")
band.interpolation_type = "SMOOTHSTEP"
band.inputs["From Min"].default_value = 0.22
band.inputs["From Max"].default_value = 0.0
nt.links.new(adist.outputs[0], band.inputs["Value"])
# Strong on bevels, faint on the front face
inv = nt.nodes.new("ShaderNodeMath"); inv.operation = "SUBTRACT"; inv.inputs[0].default_value = 1.0
nt.links.new(mr.outputs["Result"], inv.inputs[1])
bw = nt.nodes.new("ShaderNodeMath"); bw.operation = "MULTIPLY_ADD"
bw.inputs[1].default_value = 0.95; bw.inputs[2].default_value = 0.05
nt.links.new(inv.outputs[0], bw.inputs[0])
gs = nt.nodes.new("ShaderNodeMath"); gs.operation = "MULTIPLY"
nt.links.new(band.outputs["Result"], gs.inputs[0]); nt.links.new(bw.outputs[0], gs.inputs[1])
gstr = nt.nodes.new("ShaderNodeMath"); gstr.operation = "MULTIPLY"; gstr.inputs[1].default_value = 9.0
nt.links.new(gs.outputs[0], gstr.inputs[0])
emit = nt.nodes.new("ShaderNodeEmission")
emit.inputs["Color"].default_value = (1.0, 0.86, 0.66, 1)
nt.links.new(gstr.outputs[0], emit.inputs["Strength"])
addsh = nt.nodes.new("ShaderNodeAddShader")
nt.links.new(mix.outputs["Shader"], addsh.inputs[0]); nt.links.new(emit.outputs["Emission"], addsh.inputs[1])
nt.links.new(addsh.outputs["Shader"], out_node.inputs["Surface"])

# ---- Letters ----
# A static bold TTF: Bahnschrift is a variable font and Blender only loads its Regular instance
font = bpy.data.fonts.load(r"C:\Windows\Fonts\segoeuib.ttf")
letters = []
for ch in WORD:
    cu = bpy.data.curves.new("L_" + ch, "FONT")
    cu.body = ch
    cu.font = font
    cu.size = 1.6
    cu.align_x = "CENTER"
    cu.extrude = 0.16
    cu.resolution_u = 24
    tmp = bpy.data.objects.new("tmp_" + ch, cu)
    sc.collection.objects.link(tmp)
    bpy.context.view_layer.update()
    # Curve -> mesh, weld the separate front/side pieces so the bevel can follow the edges
    me = bpy.data.meshes.new_from_object(tmp.evaluated_get(bpy.context.evaluated_depsgraph_get()))
    bpy.data.objects.remove(tmp)
    bm = bmesh.new(); bm.from_mesh(me)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-4)
    bm.to_mesh(me); bm.free()
    for poly in me.polygons:
        poly.use_smooth = True
    ob = bpy.data.objects.new("L_" + ch, me)
    sc.collection.objects.link(ob)
    bv = ob.modifiers.new("Bevel", "BEVEL")
    bv.width = 0.035; bv.segments = 5; bv.limit_method = "ANGLE"; bv.angle_limit = math.radians(30)
    bv.use_clamp_overlap = True; bv.harden_normals = True
    ob.data.materials.append(mat)
    letters.append(ob)
bpy.context.view_layer.update()
GAP = 0.16
widths = [o.dimensions.x for o in letters]
total = sum(widths) + GAP * (len(letters) - 1)
x = -total / 2
FINAL_ROT = math.radians(90)
for i, (o, w) in enumerate(zip(letters, widths)):
    cx = x + w / 2
    x += w + GAP
    # Text lies in local XY; rotate 90 deg on X so it stands up facing -Y (camera).
    # Baseline sits slightly above the floor so the extrusion back does not clip it.
    start = -9 + i * 6     # first letters start before frame 1, so frame 1 already shows them rising
    land = start + 22
    o.location = (cx, 0.0, -2.2)
    o.rotation_euler = (FINAL_ROT + math.radians(-75), 0, math.radians(-14 + 5 * i))
    o.scale = (0.7, 0.7, 0.7)
    for path in ("location", "rotation_euler", "scale"):
        o.keyframe_insert(path, frame=start)
    o.location = (cx, 0.0, 0.03)
    o.rotation_euler = (FINAL_ROT, 0, 0)
    o.scale = (1, 1, 1)
    for path in ("location", "rotation_euler", "scale"):
        o.keyframe_insert(path, frame=land)

def all_fcurves(obj):
    act = obj.animation_data.action
    fcs = list(getattr(act, "fcurves", []) or [])
    for layer in getattr(act, "layers", []):
        for strip in layer.strips:
            for bag in strip.channelbags:
                fcs.extend(bag.fcurves)
    return fcs

for o in letters:
    for fc in all_fcurves(o):
        kp = fc.keyframe_points[0]
        kp.interpolation = "BACK"
        kp.easing = "EASE_OUT"
        kp.back = 2.2

# ---- Floor and backdrop: one seamless cyc (floor curving up into a back wall) ----
# Dark glossy everywhere, so there is no seam; the wall carries a soft violet glow that fades
# out toward the floor. The floor part hides the letters before they rise.
cbm = bmesh.new()
CW, CD, CH = 80.0, 13.0, 26.0
cv = [cbm.verts.new(v) for v in [(-CW / 2, -40, 0), (CW / 2, -40, 0), (CW / 2, CD, 0), (-CW / 2, CD, 0),
                                  (CW / 2, CD, CH), (-CW / 2, CD, CH)]]
cbm.faces.new([cv[0], cv[1], cv[2], cv[3]])
cbm.faces.new([cv[3], cv[2], cv[4], cv[5]])
cyc_me = bpy.data.meshes.new("Cyc")
cbm.to_mesh(cyc_me); cbm.free()
for poly in cyc_me.polygons:
    poly.use_smooth = True
cyc = bpy.data.objects.new("Cyc", cyc_me); sc.collection.objects.link(cyc)
cbv = cyc.modifiers.new("Bevel", "BEVEL"); cbv.width = 6.0; cbv.segments = 32; cbv.limit_method = "ANGLE"
fm = bpy.data.materials.new("Cyc"); fm.use_nodes = True
fnt = fm.node_tree
fp = fnt.nodes["Principled BSDF"]
fp.inputs["Base Color"].default_value = (0.008, 0.008, 0.011, 1)
fp.inputs["Roughness"].default_value = 0.2
if "Specular IOR Level" in fp.inputs:
    fp.inputs["Specular IOR Level"].default_value = 0.5
# Glow: an ellipse on the wall behind the word (world X and Z), faded out along the floor toward the camera
fgeo = fnt.nodes.new("ShaderNodeNewGeometry")
fsep = fnt.nodes.new("ShaderNodeSeparateXYZ")
fnt.links.new(fgeo.outputs["Position"], fsep.inputs["Vector"])
fxz = fnt.nodes.new("ShaderNodeCombineXYZ")
fnt.links.new(fsep.outputs["X"], fxz.inputs["X"]); fnt.links.new(fsep.outputs["Z"], fxz.inputs["Y"])
fmap = fnt.nodes.new("ShaderNodeMapping"); fmap.inputs["Location"].default_value = (0, -0.5, 0)
fmap.inputs["Scale"].default_value = (1 / 20.0, 1 / 6.5, 1)
fnt.links.new(fxz.outputs["Vector"], fmap.inputs["Vector"])
fgr = fnt.nodes.new("ShaderNodeTexGradient"); fgr.gradient_type = "SPHERICAL"
fnt.links.new(fmap.outputs["Vector"], fgr.inputs["Vector"])
fpw = fnt.nodes.new("ShaderNodeMath"); fpw.operation = "POWER"; fpw.inputs[1].default_value = 1.5
fnt.links.new(fgr.outputs["Fac"], fpw.inputs[0])
ffade = fnt.nodes.new("ShaderNodeMapRange"); ffade.interpolation_type = "SMOOTHSTEP"
ffade.inputs["From Min"].default_value = 0.0; ffade.inputs["From Max"].default_value = CD
fnt.links.new(fsep.outputs["Y"], ffade.inputs["Value"])
fmul = fnt.nodes.new("ShaderNodeMath"); fmul.operation = "MULTIPLY"
fnt.links.new(fpw.outputs[0], fmul.inputs[0]); fnt.links.new(ffade.outputs["Result"], fmul.inputs[1])
fstr = fnt.nodes.new("ShaderNodeMath"); fstr.operation = "MULTIPLY"; fstr.inputs[1].default_value = 0.2
fnt.links.new(fmul.outputs[0], fstr.inputs[0])
fem = fnt.nodes.new("ShaderNodeEmission"); fem.inputs["Color"].default_value = (0.28, 0.16, 0.85, 1)
fnt.links.new(fstr.outputs[0], fem.inputs["Strength"])
fadd = fnt.nodes.new("ShaderNodeAddShader")
fnt.links.new(fp.outputs["BSDF"], fadd.inputs[0]); fnt.links.new(fem.outputs["Emission"], fadd.inputs[1])
fnt.links.new(fadd.outputs["Shader"], fnt.nodes["Material Output"].inputs["Surface"])
cyc.data.materials.append(fm)
# Sphere reflection probe: floor reflection rays that leave the screen fall back to this capture of
# the glowing wall instead of the black world, so the reflection has no visible edge
probe_d = bpy.data.lightprobes.new("Room", "SPHERE")
probe_d.influence_distance = 40.0
probe = bpy.data.objects.new("Room", probe_d); sc.collection.objects.link(probe)
probe.location = (0, -2.0, 1.5)

# ---- Lights ----
def area(name, loc, rot, color, power, size, size_y=None):
    d = bpy.data.lights.new(name, "AREA"); d.color = color; d.energy = power
    if size_y:
        d.shape = "RECTANGLE"; d.size = size; d.size_y = size_y
    else:
        d.size = size
    o = bpy.data.objects.new(name, d); sc.collection.objects.link(o)
    o.location = loc; o.rotation_euler = [math.radians(a) for a in rot]
    return o
area("Key", (-5, -7, 6), (55, 0, -35), (1.0, 0.9, 0.82), 600, 5)
rim = area("Rim", (6, 5, 8), (0, 0, 0), (0.3, 0.8, 1.0), 900, 2)
back = area("Back", (0, 7, 6), (-55, 0, 0), (0.55, 0.38, 1.0), 700, 8)
# Back light only adds violet edge light; keep its big rectangle out of the glossy floor
back.data.specular_factor = 0.0
# Rim light reaches the letters only (light linking); its floor reflection was a cyan corner glow
rim_rx = bpy.data.collections.new("RimReceivers")
for o in letters:
    rim_rx.objects.link(o)
rim.light_linking.receiver_collection = rim_rx

# Light sweep: a tall narrow strip that slides left to right in front of the letters
sweep = area("Sweep", (-7, -3.0, 1.6), (90, 0, 0), (1.0, 0.95, 0.88), 0, 0.35, 2.0)
sd = sweep.data
# Specular only: it should travel as a reflection over the gloss and bevels, not flood the faces
sd.diffuse_factor = 0.0
for f, xpos, power in ((50, -7.0, 0), (58, -6.0, 700), (110, 6.0, 700), (118, 7.0, 0)):
    sweep.location.x = xpos
    sweep.keyframe_insert("location", frame=f)
    sd.energy = power
    sd.keyframe_insert("energy", frame=f)

for f, gx in ((62, -8.0), (112, 8.0)):
    glint_x.outputs[0].default_value = gx
    glint_x.outputs[0].keyframe_insert("default_value", frame=f)

# ---- Camera: push-in with shallow DOF on the word ----
cam_d = bpy.data.cameras.new("Cam"); cam_d.lens = 50
cam_d.dof.use_dof = True; cam_d.dof.aperture_fstop = 2.8
cam = bpy.data.objects.new("Cam", cam_d); sc.collection.objects.link(cam)
sc.camera = cam
target = bpy.data.objects.new("Target", None); sc.collection.objects.link(target)
target.location = (0, 0, 0.65)
cam_d.dof.focus_object = target
c = rim.constraints.new("TRACK_TO"); c.target = target
c.track_axis = "TRACK_NEGATIVE_Z"; c.up_axis = "UP_Y"
tc = cam.constraints.new("TRACK_TO"); tc.target = target
tc.track_axis = "TRACK_NEGATIVE_Z"; tc.up_axis = "UP_Y"
cam.location = (-1.2, -13.0, 2.6); cam.keyframe_insert("location", frame=1)
cam.location = (0.4, -9.2, 1.6); cam.keyframe_insert("location", frame=FRAMES)

if TEST:
    sc.frame_set(TEST)
    sc.render.filepath = OUT + f"/test_{TEST:04d}.png"
    bpy.ops.render.render(write_still=True)
else:
    bpy.ops.render.render(animation=True)
print("RENDER COMPLETE")
