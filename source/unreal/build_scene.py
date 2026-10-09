# Copyright (c) 2026 Dor5hacham d5shacham@gmail.com. All rights reserved.
# SPDX-License-Identifier: Proprietary

# Builds the Motion Studio Niagara scene in a running Unreal Editor, only through the Unreal MCP
# (every step below is an MCP tools/call; nothing runs Python inside the editor directly).
# Stages, in order: level, materials, niagara, actors, sequence, save. Run all of them on a fresh
# project, or name stages to rerun them:
#   python build_scene.py                 # everything
#   python build_scene.py niagara actors  # only these stages
# The render is a separate step (render.py), through the project's own MCP toolset.
import json
import math
import sys
from typing import Any

from mcp_client import MCPTruncated, UnrealMCP

SCENE = "editor_toolset.toolsets.scene.SceneTools"
ASSET = "editor_toolset.toolsets.asset.AssetTools"
OBJ = "editor_toolset.toolsets.object.ObjectTools"
ACTOR = "editor_toolset.toolsets.actor.ActorTools"
MAT = "editor_toolset.toolsets.material.MaterialTools"
NS = "NiagaraToolsets.NiagaraToolset_System"
NCOMP = "NiagaraToolsets.NiagaraToolset_Component"
SEQ = "animation_toolset.toolsets.sequencer.SequencerTools"
KEY = "animation_toolset.toolsets.keyframing.SequencerKeyframingTools"

LEVEL = "/Game/Maps/Studio"
LEVEL_OBJ = LEVEL + ".Studio"
PL = LEVEL_OBJ + ":PersistentLevel."
SYSTEM = "/Game/FX/NS_Vortex.NS_Vortex"
SEQUENCE = "/Game/Cine/LS_Vortex.LS_Vortex"
FPS, FRAMES = 30, 150
CORE_Z = 150.0          # height of the core and of the vortex disk (cm)

# Palette (linear RGB): near-black, coral, amber, cyan, violet, cream
INK = (0.0037, 0.0037, 0.0052)
CORAL = (1.0, 0.102, 0.036)
AMBER = (1.0, 0.434, 0.0144)
CYAN = (0.024, 0.552, 0.791)
VIOLET = (0.195, 0.098, 1.0)

m: UnrealMCP | None = None


def call(toolset, tool, **args) -> Any:
    """Calls one MCP tool and returns its JSON result (shape depends on the tool), or None if the reply was cut."""
    assert m is not None, "connect with UnrealMCP() before calling tools"
    try:
        res = m.call(toolset, tool, args)
    except MCPTruncated as e:      # the tool ran; only its (large) reply was lost
        print(f"  note: {tool}: {e}")
        return None
    return res.get("returnValue", res) if isinstance(res, dict) else res


def ref(path):
    return {"refPath": path}


def setp(path, **values):
    """Sets UPROPERTY values on any object (JSON with Unreal property names)."""
    return call(OBJ, "set_properties", instance=ref(path), values=json.dumps(values))


def xform(loc=(0, 0, 0), rot=(0, 0, 0), scale=(1, 1, 1)):
    return {"location": dict(zip("xyz", loc)),
            "rotation": dict(zip(("pitch", "yaw", "roll"), rot)),
            "scale": dict(zip("xyz", scale))}


def rgba(c, k=1.0, a=1.0):
    return {"r": c[0] * k, "g": c[1] * k, "b": c[2] * k, "a": a}


# ---------------------------------------------------------------- level
def stage_level():
    """Copies the engine's default template level, loads it and strips the outdoor actors.
    On a rerun the level already exists and is only loaded."""
    fresh = not call(ASSET, "exists", path=LEVEL)
    if fresh:
        call(ASSET, "duplicate", path="/Engine/Maps/Templates/Template_Default", new_path=LEVEL)
        call(ASSET, "save_assets", asset_paths=[LEVEL])
    call(SCENE, "load_level", level_path=LEVEL)
    if fresh:
        for name in ("DirectionalLight_0", "SkyAtmosphere_0", "SkyLight_0", "VolumetricCloud_0",
                     "StaticMeshActor_0", "Floor_0"):
            call(SCENE, "remove_from_scene", actor=ref(PL + name))


# ---------------------------------------------------------------- materials
class Graph:
    """Small helper over MaterialTools: add nodes, set their properties, wire them."""

    def __init__(self, folder, name):
        self.path = f"{folder}/{name}.{name}"
        if call(ASSET, "exists", path=f"{folder}/{name}"):
            call(ASSET, "delete", path=f"{folder}/{name}")
        call(MAT, "create_material", folder_path=folder, asset_name=name)
        self.y = 0

    def node(self, cls, **props):
        self.y += 120
        r = call(MAT, "add_expression", material_or_function=ref(self.path),
                 expression_class=ref("/Script/Engine.MaterialExpression" + cls), x=-400, y=self.y)
        if props:
            setp(r["refPath"], **props)
        return r

    def link(self, a, out, b, inp):
        call(MAT, "connect_expressions", from_expression=a, from_output_name=out, to_expression=b, to_input_name=inp)

    def out(self, a, out, prop):
        call(MAT, "connect_to_output", expression=a, output_name=out, material_property=prop)

    def done(self, **material_props):
        if material_props:
            setp(self.path, **material_props)
        call(MAT, "layout_expressions", material_or_function=ref(self.path))
        call(MAT, "recompile", material_or_function=ref(self.path))
        call(ASSET, "save_assets", asset_paths=[self.path.split(".")[0]])


def stage_materials():
    # Glossy near-black studio floor: Lumen reflects the core and the masked sparks in it
    g = Graph("/Game/Materials", "M_Floor")
    g.out(g.node("Constant3Vector", Constant=rgba(INK)), "", "MP_BaseColor")
    g.out(g.node("Constant", R=0.15), "", "MP_Roughness")
    g.out(g.node("Constant", R=0.6), "", "MP_Specular")
    g.done()
    # Glowing coral core: an emissive mesh, so Lumen uses it as a light source
    g = Graph("/Game/Materials", "M_Core")
    g.out(g.node("Constant3Vector", Constant=rgba((0, 0, 0))), "", "MP_BaseColor")
    g.out(g.node("Constant3Vector", Constant=rgba(CORAL, 60.0)), "", "MP_EmissiveColor")
    g.done()
    # Spark: unlit, masked (opaque) round sprite whose HDR color comes from the particle. Masked
    # instead of additive so the sparks are in the depth buffer: Lumen screen traces then pick
    # them up for reflections on the floor and for bounce light.
    g = Graph("/Game/Materials", "M_Spark")
    pc = g.node("ParticleColor")
    g.out(pc, "", "MP_EmissiveColor")
    uv = g.node("TextureCoordinate")
    mid = g.node("Constant2Vector", R=0.5, G=0.5)
    dist = g.node("Distance")
    g.link(uv, "", dist, "A")
    g.link(mid, "", dist, "B")
    two = g.node("Multiply", ConstB=2.0)
    g.link(dist, "", two, "A")
    inv = g.node("OneMinus")
    g.link(two, "", inv, "None")      # single-input nodes name their pin "None"
    fade = g.node("Multiply")
    g.link(inv, "", fade, "A")
    g.link(pc, "A", fade, "B")
    g.out(fade, "", "MP_OpacityMask")
    g.done(BlendMode="BLEND_Masked", ShadingModel="MSM_Unlit", TwoSided=True,
           OpacityMaskClipValue=0.3, bUsedWithNiagaraSprites=True)


# ---------------------------------------------------------------- niagara
F32 = "/Script/Niagara.NiagaraFloat"
V3 = "/Script/CoreUObject.Vector3f"
LCOL = "/Script/CoreUObject.LinearColor"
ENUM = "/Script/NiagaraEditor.NiagaraExt_StackInputData_Enum"
HLSL = "/Script/NiagaraEditor.NiagaraExt_StackInputData_HlslExpression"
ENUMS = "/Niagara/Enums/"


def sref(em, script="", module="", inputs=(), renderer=-1):
    return {"system": ref(SYSTEM), "emitterName": em, "scriptName": script, "moduleName": module,
            "rendererIndex": renderer, "inputNameStack": list(inputs)}


def setin(em, script, module, name, value):
    """Sets one module input. value: float, (x, y, z), ("color", rgba), ("enum", path, n),
    ("hlsl", expression) or ("pos", (x, y, z)) for a world position."""
    if isinstance(value, (int, float)):
        data = {"struct": ref(F32), "value": {"value": float(value)}}
    elif value[0] == "color":
        data = {"struct": ref(LCOL), "value": value[1]}
    elif value[0] == "enum":
        enum_name = value[1].split(".")[-1]
        data = {"struct": ref(ENUM), "value": {"enum": ref(ENUMS + value[1]),
                                                "enumName": f"{enum_name}::NewEnumerator{value[2]}", "displayName": ""}}
    elif value[0] == "hlsl":
        data = {"struct": ref(HLSL), "value": {"hlslExpression": value[1]}}
    elif value[0] == "pos":
        data = {"struct": ref("/Script/Niagara.NiagaraPosition"), "value": dict(zip("xyz", value[1]))}
    else:
        data = {"struct": ref(V3), "value": dict(zip("xyz", value))}
    call(NS, "SetStackInputData", stackInputRef=sref(em, script, module, [name]), inputData=data)


def add_module(em, script, after, asset):
    r = call(NS, "AddModule", moduleLocationRef=sref(em, script, after), moduleAsset=ref(asset))
    # a new module is named after its script; use that when the reply was lost
    return r["moduleName"] if r else asset.split(".")[-1]


def build_emitter(em, rate, life, col_a, col_b, size, shape, swirl, lift, curl, vortex, attract, stretch):
    PS, PU = "ParticleSpawnScript", "ParticleUpdateScript"
    call(NS, "AddEmitter", system=ref(SYSTEM),
         templateEmitter=ref("/Niagara/DefaultAssets/Templates/Emitters/Fountain.Fountain"), emitterName=em)
    # GPU simulation with fixed bounds (GPU emitters cannot compute dynamic bounds)
    call(NS, "SetEmitterData", emitter=sref(em), emitterData={"propertyValues": json.dumps({
        "SimTarget": "GPUComputeSim", "CalculateBoundsMode": "Fixed",
        "FixedBounds": {"min": {"x": -1200, "y": -1200, "z": -300}, "max": {"x": 1200, "y": 1200, "z": 1400}, "isValid": True}})})
    setin(em, "EmitterUpdateScript", "SpawnRate", "SpawnRate", rate)
    ip = "InitializeParticle"
    setin(em, PS, ip, "Lifetime Mode", ("enum", "ENiagara_LifetimeMode.ENiagara_LifetimeMode", 1))
    setin(em, PS, ip, "Lifetime Min", life[0])
    setin(em, PS, ip, "Lifetime Max", life[1])
    setin(em, PS, ip, "Color Mode", ("enum", "ENiagara_ColorInitializationMode.ENiagara_ColorInitializationMode", 2))
    setin(em, PS, ip, "Color Minimum", ("color", col_a))
    setin(em, PS, ip, "Color Maximum", ("color", col_b))
    setin(em, PS, ip, "Sprite Size Mode", ("enum", "ENiagara_SizeScaleMode.ENiagara_SizeScaleMode", 1))
    setin(em, PS, ip, "Uniform Sprite Size Min", size[0])
    setin(em, PS, ip, "Uniform Sprite Size Max", size[1])
    # spawn shape
    for k, v in shape.items():
        setin(em, PS, "ShapeLocation", k, v)
    # start velocity: tangential swirl around the Z axis plus a lift (the system sits on the Z axis)
    setin(em, PS, "AddVelocity", "Velocity Mode", ("enum", "Utility/ENiagara_VelocityMode.ENiagara_VelocityMode", 0))
    setin(em, PS, "AddVelocity", "Velocity", ("hlsl",
          f"float3(-Particles.Position.y, Particles.Position.x, 0.0) * {swirl} + float3(0.0, 0.0, {lift})"))
    # forces, inserted after Drag so SolveForcesAndVelocity integrates them
    setin(em, PU, "GravityForce", "Gravity", (0.0, 0.0, 0.0))
    setin(em, PU, "Drag", "Drag", 0.5)
    c = add_module(em, PU, "Drag", "/Niagara/Modules/Update/Forces/V2/CurlNoiseForce.CurlNoiseForce")
    setin(em, PU, c, "Noise Strength", curl[0])
    setin(em, PU, c, "Noise Frequency", curl[1])
    v = add_module(em, PU, c, "/Niagara/Modules/Update/Forces/VortexForce.VortexForce")
    setin(em, PU, v, "Vortex Force Amount", vortex[0])
    setin(em, PU, v, "Origin Pull Amount", vortex[1])
    a = add_module(em, PU, v, "/Niagara/Modules/Update/Forces/V2/PointAttractionForce.PointAttractionForce")
    setin(em, PU, a, "Attractor Position", ("pos", (0.0, 0.0, attract[0])))
    setin(em, PU, a, "Attraction Strength", attract[1])
    setin(em, PU, a, "Attraction Radius", attract[2])
    # light streaks: stretch each spark along its velocity
    s = add_module(em, PU, "SolveForcesAndVelocity", "/Niagara/Modules/Update/Size/ScaleSpriteSizeBySpeed.ScaleSpriteSizeBySpeed")
    setin(em, PU, s, "Velocity Threshold", stretch[0])
    call(NS, "SetStackInputData", stackInputRef=sref(em, PU, s, ["Max Scale Factor"]),
         inputData={"struct": ref("/Script/CoreUObject.Vector2f"), "value": {"x": 1.0, "y": stretch[1]}})
    call(NS, "SetRendererData", renderer=sref(em, renderer=0), rendererData={"propertyValues": json.dumps({
        "Material": ref("/Game/Materials/M_Spark.M_Spark"), "Alignment": "VelocityAligned",
        "FacingMode": "FaceCamera", "SortMode": "None", "bCastShadows": False})})


def stage_niagara():
    if call(ASSET, "exists", path=SYSTEM.split(".")[0]):
        call(ASSET, "delete", path=SYSTEM.split(".")[0])
    call(NS, "CreateNiagaraSystem", assetName="NS_Vortex", assetPath="/Game/FX",
         templateSystem=ref("/Niagara/DefaultAssets/DefaultSystem.DefaultSystem"))
    call(NS, "RemoveEmitter", emitterToRemove=sref("Fountain"))   # the template's own emitter
    # Pre-simulate 4 s so the vortex is already full on the first frame
    call(NS, "SetSystemData", system=ref(SYSTEM), systemData={"propertyValues": json.dumps({
        "WarmupTime": 4.0, "WarmupTickDelta": 1.0 / 30.0})})
    torus = {"Shape Primitive": ("enum", "Location/ENiagara_LocationShapes.ENiagara_LocationShapes", 3),
             "Large Radius": 240.0, "Handle Radius": 30.0}
    wide = {"Shape Primitive": ("enum", "Location/ENiagara_LocationShapes.ENiagara_LocationShapes", 3),
            "Large Radius": 420.0, "Handle Radius": 90.0}
    # Swirl: coral-to-amber sparks spawned on a ring, orbiting fast and spiralling into the core
    # (vortex pull and point attraction against drag), torn into wisps by curl noise
    build_emitter("Swirl", 7000, (3.0, 5.0), rgba(CORAL, 2.4), rgba(AMBER, 1.6), (0.7, 1.4), torus,
                  swirl=2.2, lift=0.0, curl=(120.0, 0.5), vortex=(200.0, 150.0), attract=(CORE_Z, 300.0, 800.0),
                  stretch=(400.0, 14.0))
    # Glints: finer cyan-to-violet sparks on a wider, slower and noisier orbit
    build_emitter("Glints", 3500, (4.0, 6.0), rgba(CYAN, 2.5), rgba(VIOLET, 3.5), (0.5, 0.9), wide,
                  swirl=1.3, lift=0.0, curl=(300.0, 0.7), vortex=(120.0, 60.0), attract=(CORE_Z, 120.0, 1000.0),
                  stretch=(400.0, 10.0))
    issues = call(NS, "GetStackIssues", system=ref(SYSTEM))
    print("  stack issues:", json.dumps(issues)[:1500])
    call(ASSET, "save_assets", asset_paths=[SYSTEM.split(".")[0]])


# ---------------------------------------------------------------- actors
def spawn_asset(asset, name, loc, rot=(0, 0, 0), scale=(1, 1, 1)):
    return call(SCENE, "add_to_scene_from_asset", asset_path=asset, name=name, xform=xform(loc, rot, scale))["refPath"]


def spawn_class(cls, name, loc, rot=(0, 0, 0), scale=(1, 1, 1)):
    return call(SCENE, "add_to_scene_from_class", actor_type=ref(cls), name=name, xform=xform(loc, rot, scale))["refPath"]


def component(actor, cls=None):
    args = {"actor": ref(actor)}
    if cls:
        args["component_type"] = ref(cls)
    return call(ACTOR, "get_components", **args)[0]["refPath"]


def stage_actors():
    for name in ("Floor", "Core", "Vortex", "CoreLight", "Softbox", "RimLight", "Grade"):
        found = call(SCENE, "find_actors", name=name, tag="", collision_channels=[])
        for a in found or []:
            call(SCENE, "remove_from_scene", actor=a)
    # glossy black floor, 300 m wide so its edge is never in frame
    floor = spawn_asset("/Engine/BasicShapes/Plane", "Floor", (0, 0, 0), scale=(300, 300, 1))
    setp(component(floor, "/Script/Engine.StaticMeshComponent"),
         OverrideMaterials=[ref("/Game/Materials/M_Floor.M_Floor")])
    # glowing coral core hovering inside the vortex (Lumen treats the emissive mesh as a light)
    core = spawn_asset("/Engine/BasicShapes/Sphere", "Core", (0, 0, CORE_Z), scale=(0.4, 0.4, 0.4))
    setp(component(core, "/Script/Engine.StaticMeshComponent"),
         OverrideMaterials=[ref("/Game/Materials/M_Core.M_Core")], CastShadow=False)
    # the Niagara system on the world Z axis (its velocity expression and forces assume that axis)
    vortex = spawn_class("/Script/Niagara.NiagaraActor", "Vortex", (0, 0, CORE_Z))
    call(NCOMP, "SetSystem", niagaraComponent=ref(component(vortex, "/Script/Niagara.NiagaraComponent")),
         system=ref(SYSTEM), bResetExistingOverrideParameters=True)
    # a point light in the core for crisp light on the floor, a dim overhead softbox, a violet rim
    cl = spawn_class("/Script/Engine.PointLight", "CoreLight", (0, 0, CORE_Z))
    setp(component(cl, "/Script/Engine.PointLightComponent"), Intensity=60.0, IntensityUnits="Candelas",
         LightColor={"r": 255, "g": 96, "b": 54, "a": 255}, AttenuationRadius=2500.0, SourceRadius=18.0,
         CastShadows=False, SpecularScale=0.0)   # the core mesh itself reflects in the floor
    sb = spawn_class("/Script/Engine.RectLight", "Softbox", (0, 0, 700), rot=(-90, 0, 0))
    setp(component(sb, "/Script/Engine.RectLightComponent"), Intensity=6.0, IntensityUnits="Candelas",
         LightColor={"r": 244, "g": 239, "b": 230, "a": 255}, SourceWidth=500.0, SourceHeight=500.0,
         AttenuationRadius=2000.0, BarnDoorAngle=30.0, SpecularScale=0.0)   # no hotspot in the floor
    rim = spawn_class("/Script/Engine.RectLight", "RimLight", (-900, 700, 260), rot=(-10, -38, 0))
    setp(component(rim, "/Script/Engine.RectLightComponent"), Intensity=25.0, IntensityUnits="Candelas",
         LightColor={"r": 122, "g": 92, "b": 255, "a": 255}, SourceWidth=200.0, SourceHeight=400.0,
         AttenuationRadius=3000.0)
    # dark violet height fog with volumetric scattering, so the core light glows in the air
    fog = PL + "ExponentialHeightFog_0"
    setp(component(fog, "/Script/Engine.ExponentialHeightFogComponent"), FogDensity=0.02, FogHeightFalloff=0.2,
         FogInscatteringLuminance={"r": 0.010, "g": 0.006, "b": 0.022, "a": 1.0},
         bEnableVolumetricFog=True, VolumetricFogScatteringDistribution=0.5, VolumetricFogExtinctionScale=0.6)
    # post process: fixed exposure, bloom, slight vignette and grain, higher Lumen quality
    ppv = spawn_class("/Script/Engine.PostProcessVolume", "Grade", (0, 0, 0))
    setp(ppv, bUnbound=True, Settings={
        "bOverride_AutoExposureMethod": True, "AutoExposureMethod": "AEM_Manual",
        "bOverride_AutoExposureApplyPhysicalCameraExposure": True, "AutoExposureApplyPhysicalCameraExposure": False,
        "bOverride_AutoExposureBias": True, "AutoExposureBias": 0.0,
        "bOverride_BloomIntensity": True, "BloomIntensity": 0.9,
        "bOverride_VignetteIntensity": True, "VignetteIntensity": 0.45,
        "bOverride_FilmGrainIntensity": True, "FilmGrainIntensity": 0.08,
        "bOverride_LumenFinalGatherQuality": True, "LumenFinalGatherQuality": 2.0,
        "bOverride_LumenReflectionQuality": True, "LumenReflectionQuality": 2.0,
        "bOverride_LumenSceneLightingQuality": True, "LumenSceneLightingQuality": 2.0})


# ---------------------------------------------------------------- sequence
def camera_path():
    """Keys of the camera move: a slow orbit around the core with a push-in and a drop in height.
    Returns (frame, location, rotation) every 15 frames; Sequencer interpolates them as cubic."""
    keys = []
    for f in range(0, FRAMES + 1, 15):
        u = f / FRAMES
        e = u * u * (3 - 2 * u)                       # ease in and out
        ang = math.radians(-150 + 60 * e)             # orbit angle around the Z axis
        rad = 1000 - 360 * e                          # push in
        z = 600 - 415 * e                             # come down to a grazing view just above the disk
        x, y = rad * math.cos(ang), rad * math.sin(ang)
        dx, dy, dz = -x, -y, CORE_Z + 10 - z
        yaw = math.degrees(math.atan2(dy, dx))
        pitch = math.degrees(math.atan2(dz, math.hypot(dx, dy)))
        keys.append((f, (x, y, z), (pitch, yaw, 0.0)))
    return keys


def stage_sequence():
    seq_pkg = SEQUENCE.split(".")[0]
    if call(ASSET, "exists", path=seq_pkg):
        call(ASSET, "delete", path=seq_pkg)
    for a in call(SCENE, "find_actors", name="ShotCam", tag="", collision_channels=[]) or []:
        call(SCENE, "remove_from_scene", actor=a)
    # cine camera in the level: 35 mm, f/2.8, focus tracks the core
    f0, loc0, rot0 = camera_path()[0]
    cam = spawn_class("/Script/CinematicCamera.CineCameraActor", "ShotCam", loc0, rot0)
    core = call(SCENE, "find_actors", name="Core", tag="", collision_channels=[])[0]["refPath"]
    # look-at tracking keeps the core framed while only the location is keyed
    setp(cam, LookatTrackingSettings={"bEnableLookAtTracking": True, "ActorToTrack": core,
                                      "RelativeOffset": {"x": 0.0, "y": 0.0, "z": 10.0}})
    setp(component(cam, "/Script/CinematicCamera.CineCameraComponent"), CurrentFocalLength=35.0,
         CurrentAperture=2.8, FocusSettings={"FocusMethod": "Tracking",
                                             "TrackingFocusSettings": {"ActorToTrack": core}})
    seq = call(SEQ, "create_level_sequence", package_path="/Game/Cine", asset_name="LS_Vortex")["refPath"]
    call(SEQ, "open_sequence", sequence=ref(seq))
    call(SEQ, "set_display_rate", sequence=ref(seq), numerator=FPS, denominator=1)
    call(SEQ, "set_playback_range", sequence=ref(seq), start_frame=0, end_frame=FRAMES)
    binding = call(SEQ, "add_actors", actors=[ref(cam)])[0]
    # add_actors already gives a camera a transform track; key that one (a second absolute
    # transform track would blend 50/50 with it)
    track = [t for t in call(SEQ, "get_tracks_on_binding", binding=binding) if "3DTransformTrack" in t["refPath"]][0]
    sections = call(SEQ, "get_sections", track=track)
    section = sections[0] if sections else call(SEQ, "add_section", track=track)
    call(SEQ, "set_section_range", section=section, start_frame=0, end_frame=FRAMES)
    channels = call(KEY, "get_channel_names", section=section)
    print("  transform channels:", channels)
    for f, loc, rot in camera_path():
        for ch, v in zip(("Location.X", "Location.Y", "Location.Z"), loc):
            call(KEY, "add_key_float", section=section, channel_name=ch, frame=f, value=v, interpolation="cubic")
    # camera cut to the shot camera for the whole range
    cut_track = call(SEQ, "add_track_to_sequence", sequence=ref(seq),
                     track_type=ref("/Script/MovieSceneTracks.MovieSceneCameraCutTrack"))
    cut = call(SEQ, "add_section", track=cut_track)
    call(SEQ, "set_section_range", section=cut, start_frame=0, end_frame=FRAMES)
    bid = call(SEQ, "get_binding_id", sequence=ref(seq), binding=binding)
    # SequencerTools.set_camera_cut_binding fails in 5.8 (unreal.Guid() does not take a string),
    # so the binding id struct is written straight into the section's property
    setp(cut["refPath"], CameraBindingID=bid)
    call(ASSET, "save_assets", asset_paths=[seq_pkg])


def stage_save():
    call(ASSET, "save_assets", asset_paths=[])          # every dirty asset, the level included
    print("  level:", call(SCENE, "get_current_level"))


STAGES = {"level": stage_level, "materials": stage_materials, "niagara": stage_niagara, "actors": stage_actors,
          "sequence": stage_sequence, "save": stage_save}


def main(names):
    global m
    m = UnrealMCP()
    print("MCP server:", m.server_info)
    for name in names or list(STAGES):
        print("== stage", name)
        STAGES[name]()
    print("BUILD DONE")


if __name__ == "__main__":
    main(sys.argv[1:])
