# Builds a Mantaflow gas shot: a ring of fire burns on a dark torus and rolls up into smoke,
# rendered as volumetrics in Eevee. Light grey smoke is lit from behind by a volume-only back
# light and stands out against a faint backdrop glow. Bakes the gas sim, then renders.
# The fluid cache goes to <out_dir>/cache and is rebaked on every run. After the bake the scene is
# saved as <out_dir>/scene.blend, so the baked sim can be opened in the Blender UI.
# Usage: blender -b -P smoke-fire.py -- <out_dir> [test_frame[,test_frame...]]
import bpy, sys, os, math, time

argv = sys.argv[sys.argv.index("--") + 1:]
OUT = os.path.abspath(argv[0])
TEST = [int(x) for x in argv[1].split(",")] if len(argv) > 1 else None
CACHE = os.path.join(OUT, "cache")
FPS = 30
PREROLL = 20                  # sim frames before the first rendered frame, so the fire is already lit
F0, F1 = 1 + PREROLL, 150 + PREROLL
RES = 128

bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
sc.render.fps = FPS
sc.frame_start, sc.frame_end = F0, F1
sc.render.resolution_x, sc.render.resolution_y = 1280, 720
engines = [e.identifier for e in sc.render.bl_rna.properties["engine"].enum_items]
sc.render.engine = "BLENDER_EEVEE" if "BLENDER_EEVEE" in engines else "BLENDER_EEVEE_NEXT"
ee = sc.eevee
ee.taa_render_samples = 48
for attr, val in [("use_raytracing", True), ("use_shadows", True), ("use_gtao", True),
                  ("volumetric_tile_size", "2"), ("volumetric_samples", 96),
                  ("use_volumetric_shadows", True), ("volumetric_shadow_samples", 16),
                  ("volumetric_ray_depth", 8)]:
    if hasattr(ee, attr):
        try:
            setattr(ee, attr, val)
        except (TypeError, ValueError) as e:
            print("eevee setting skipped:", attr, e)
# Standard keeps fire saturated (AgX pushes bright red-orange emission toward pink)
sc.view_settings.view_transform = "Standard"
sc.render.image_settings.file_format = "PNG"
sc.render.filepath = OUT + "/f_"

world = bpy.data.worlds.new("World")
sc.world = world
world.use_nodes = True
bg = world.node_tree.nodes["Background"]
bg.inputs[0].default_value = (0.0012, 0.0012, 0.0022, 1)
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

floor_mat, _ = principled("Floor", (0.010, 0.010, 0.013, 1), 0.3)
ring_mat, _ = principled("Ring", (0.05, 0.045, 0.045, 1), 0.3, metal=1.0)

bpy.ops.mesh.primitive_plane_add(size=80, location=(0, 0, 0))
bpy.context.object.data.materials.append(floor_mat)

# Burning torus: the fire emitter, also visible as a dark metal ring
bpy.ops.mesh.primitive_torus_add(major_radius=0.62, minor_radius=0.11, major_segments=96,
                                 minor_segments=24, location=(0, 0, 0.32))
ring = bpy.context.object
bpy.ops.object.shade_smooth()
ring.data.materials.append(ring_mat)
fm = ring.modifiers.new("Fluid", "FLUID")
fm.fluid_type = "FLOW"
fs = fm.flow_settings
fs.flow_type = "BOTH"
fs.flow_behavior = "INFLOW"
fs.flow_source = "MESH" if "MESH" in [i.identifier for i in fs.bl_rna.properties["flow_source"].enum_items] else fs.flow_source
fs.surface_distance = 0.06
fs.fuel_amount = 2.2
fs.temperature = 2.0
fs.density = 1.0
fs.smoke_color = (0.12, 0.11, 0.11)
fs.subframes = 1
fs.use_initial_velocity = True
fs.velocity_coord = (0, 0, 1.0)
# Break the even emission into licks of flame with a cloud texture
tex = bpy.data.textures.new("FlameNoise", "CLOUDS")
tex.noise_scale = 0.22
fs.use_texture = True
fs.noise_texture = tex
fs.texture_map_type = "AUTO"
fs.texture_size = 1.0
ring.keyframe_insert("rotation_euler", frame=1)
ring.rotation_euler.z = math.radians(50)
ring.keyframe_insert("rotation_euler", frame=F1)

# Gentle turbulence so the plume rolls instead of rising as a column
bpy.ops.object.effector_add(type="TURBULENCE", location=(0, 0, 1.5))
turb = bpy.context.object
turb.field.strength = 1.6
turb.field.size = 0.6
turb.field.flow = 0.0

# Domain: 3.2 x 3.2 x 4.4 m, adaptive so empty space is skipped
bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, 2.2 - 0.04))
dom = bpy.context.object
dom.name = "GasDomain"
dom.scale = (3.2, 3.2, 4.4)
bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
dm = dom.modifiers.new("Fluid", "FLUID")
dm.fluid_type = "DOMAIN"
ds = dm.domain_settings
ds.domain_type = "GAS"
ds.resolution_max = RES
ds.use_adaptive_domain = True
ds.use_adaptive_timesteps = True
ds.vorticity = 0.08
ds.flame_vorticity = 0.9
ds.burning_rate = 0.45
ds.flame_smoke = 1.6
ds.flame_max_temp = 2.2
ds.alpha = 1.0
ds.beta = 1.6
ds.use_dissolve_smoke = True
ds.dissolve_speed = 80
ds.use_noise = False
ds.cache_directory = CACHE
ds.cache_type = "ALL"
ds.cache_data_format = "OPENVDB"
ds.cache_frame_start, ds.cache_frame_end = 1, F1

# Volume shader: smoke from the density grid, blackbody-colored emission from the flame grid
mat = bpy.data.materials.new("FireSmoke")
mat.use_nodes = True
nt = mat.node_tree
for n in list(nt.nodes):
    nt.nodes.remove(n)
outn = nt.nodes.new("ShaderNodeOutputMaterial")
vol = nt.nodes.new("ShaderNodeVolumePrincipled")
nt.links.new(vol.outputs[0], outn.inputs["Volume"])
vol.inputs["Color"].default_value = (0.55, 0.53, 0.52, 1)   # light grey: reads on near-black
if "Anisotropy" in vol.inputs:
    vol.inputs["Anisotropy"].default_value = 0.35            # forward scattering: back light glows through
a_den = nt.nodes.new("ShaderNodeAttribute"); a_den.attribute_name = "density"
a_fl = nt.nodes.new("ShaderNodeAttribute"); a_fl.attribute_name = "flame"
dmul = nt.nodes.new("ShaderNodeMath"); dmul.operation = "MULTIPLY"; dmul.inputs[1].default_value = 8.0
nt.links.new(a_den.outputs["Fac"], dmul.inputs[0])
nt.links.new(dmul.outputs[0], vol.inputs["Density"])
# Flame value -> blackbody temperature (1200 K deep red to 3000 K yellow-orange)
tmap = nt.nodes.new("ShaderNodeMapRange")
tmap.inputs["From Min"].default_value = 0.0; tmap.inputs["From Max"].default_value = 1.0
tmap.inputs["To Min"].default_value = 1200.0; tmap.inputs["To Max"].default_value = 3000.0
nt.links.new(a_fl.outputs["Fac"], tmap.inputs["Value"])
bb = nt.nodes.new("ShaderNodeBlackbody")
nt.links.new(tmap.outputs["Result"], bb.inputs["Temperature"])
nt.links.new(bb.outputs["Color"], vol.inputs["Emission Color"])
fpow = nt.nodes.new("ShaderNodeMath"); fpow.operation = "POWER"; fpow.inputs[1].default_value = 1.3
nt.links.new(a_fl.outputs["Fac"], fpow.inputs[0])
fmul = nt.nodes.new("ShaderNodeMath"); fmul.operation = "MULTIPLY"; fmul.inputs[1].default_value = 6.0
nt.links.new(fpow.outputs[0], fmul.inputs[0])
nt.links.new(fmul.outputs[0], vol.inputs["Emission Strength"])
dom.data.materials.append(mat)

# Lights: a flickering amber point light in the ring stands in for the fire's bounce light
def area(name, loc, rot, color, power, size):
    d = bpy.data.lights.new(name, "AREA"); d.color = color; d.energy = power; d.size = size
    o = bpy.data.objects.new(name, d); sc.collection.objects.link(o)
    o.location = loc; o.rotation_euler = [math.radians(a) for a in rot]
    return d
# Rim: a dim cyan edge on the ring. Smoke lights: behind and above the plume, volume only
# (no diffuse or specular), so they light the smoke without colored pools on the floor.
rim_d = area("Rim", (3.0, 2.5, 3.2), (60, 0, 130), (0.45, 0.85, 1.0), 260, 2.0)
rim_d.specular_factor = 0.3
rim_rx = bpy.data.collections.new("RimReceivers")   # light linking: the rim lights the ring only
rim_rx.objects.link(ring)
bpy.data.objects["Rim"].light_linking.receiver_collection = rim_rx
for nm, loc, rot, col, pw in [("SmokeBack", (0.6, 4.2, 4.6), (-50, 0, 8), (0.85, 0.9, 1.0), 2600),
                              ("SmokeSide", (-3.2, 1.0, 3.6), (60, 0, -110), (0.75, 0.7, 1.0), 900)]:
    d = area(nm, loc, rot, col, pw, 3.0)
    d.diffuse_factor = 0.0
    d.specular_factor = 0.0
    d.volume_factor = 1.0
fd = bpy.data.lights.new("FireGlow", "POINT"); fd.color = (1.0, 0.45, 0.15); fd.energy = 900
fd.shadow_soft_size = 0.5
fl = bpy.data.objects.new("FireGlow", fd); sc.collection.objects.link(fl)
fl.location = (0, 0, 0.75)
fd.keyframe_insert("energy", frame=1)
fcs = fd.animation_data.action.fcurves if hasattr(fd.animation_data.action, "fcurves") else None
if fcs is None:
    fcs = [fc for layer in fd.animation_data.action.layers for strip in layer.strips
           for bag in strip.channelbags for fc in bag.fcurves]
for fc in fcs:
    nm = fc.modifiers.new("NOISE"); nm.scale = 3.0; nm.strength = 500

# Backdrop: a faint cool-grey glow far behind the fire, so the smoke has something to read against
bpy.ops.mesh.primitive_plane_add(size=1, location=(0, 9, 3), rotation=(math.radians(90), 0, 0))
bd = bpy.context.object
bd.scale = (30, 14, 1)
bdm = bpy.data.materials.new("Backdrop"); bdm.use_nodes = True
bnt = bdm.node_tree
bnt.nodes.remove(bnt.nodes["Principled BSDF"])
btc = bnt.nodes.new("ShaderNodeTexCoord")
bmap = bnt.nodes.new("ShaderNodeMapping"); bmap.inputs["Location"].default_value = (0, 0.02, 0)
bmap.inputs["Scale"].default_value = (2.2, 3.0, 1)
bnt.links.new(btc.outputs["Object"], bmap.inputs["Vector"])
bgr = bnt.nodes.new("ShaderNodeTexGradient"); bgr.gradient_type = "SPHERICAL"
bnt.links.new(bmap.outputs["Vector"], bgr.inputs["Vector"])
bpw = bnt.nodes.new("ShaderNodeMath"); bpw.operation = "POWER"; bpw.inputs[1].default_value = 1.6
bnt.links.new(bgr.outputs["Fac"], bpw.inputs[0])
bst = bnt.nodes.new("ShaderNodeMath"); bst.operation = "MULTIPLY"; bst.inputs[1].default_value = 0.03
bnt.links.new(bpw.outputs[0], bst.inputs[0])
# fade to black toward the floor, so the floor line behind the fire does not show
bgeo = bnt.nodes.new("ShaderNodeNewGeometry")
bsz = bnt.nodes.new("ShaderNodeSeparateXYZ")
bnt.links.new(bgeo.outputs["Position"], bsz.inputs["Vector"])
bfade = bnt.nodes.new("ShaderNodeMapRange"); bfade.interpolation_type = "SMOOTHSTEP"
bfade.inputs["From Min"].default_value = 0.0; bfade.inputs["From Max"].default_value = 3.0
bnt.links.new(bsz.outputs["Z"], bfade.inputs["Value"])
bfm = bnt.nodes.new("ShaderNodeMath"); bfm.operation = "MULTIPLY"
bnt.links.new(bst.outputs[0], bfm.inputs[0]); bnt.links.new(bfade.outputs["Result"], bfm.inputs[1])
bem = bnt.nodes.new("ShaderNodeEmission"); bem.inputs["Color"].default_value = (0.55, 0.6, 0.85, 1)
bnt.links.new(bfm.outputs[0], bem.inputs["Strength"])
bnt.links.new(bem.outputs["Emission"], bnt.nodes["Material Output"].inputs["Surface"])
bd.data.materials.append(bdm)

# Camera: slightly low front view, slow push-in with a small drift
cam_d = bpy.data.cameras.new("Cam"); cam_d.lens = 45
cam_d.dof.use_dof = False
cam = bpy.data.objects.new("Cam", cam_d); sc.collection.objects.link(cam)
sc.camera = cam
target = bpy.data.objects.new("Target", None); sc.collection.objects.link(target)
tc = cam.constraints.new("TRACK_TO"); tc.target = target
tc.track_axis = "TRACK_NEGATIVE_Z"; tc.up_axis = "UP_Y"
for f, loc in [(F0, (-1.3, -5.8, 0.75)), (F1, (-0.3, -5.1, 0.7))]:
    cam.location = loc; cam.keyframe_insert("location", frame=f)
for f, loc in [(F0, (0, 0, 1.08)), (F1, (0, 0, 1.05))]:
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
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, "scene.blend"))

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
