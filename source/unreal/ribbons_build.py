# Copyright (c) 2026 Dor5hacham d5shacham@gmail.com. All rights reserved.
# SPDX-License-Identifier: Proprietary

# Builds and renders the 3D light painting in a running Unreal Editor, only through the Unreal MCP.
# Five Niagara ribbon emitters (one system each, colored per palette) fly along 3D Lissajous paths
# keyed in Sequencer; every emitter leaves a glowing additive ribbon in world space, so the trails
# weave a knot in a black void while the camera orbits. Reuses the helpers of build_scene.py and lumen_build.py.
#   python ribbons_build.py                      # every build stage (level materials niagara actors sequence save)
#   python ribbons_build.py render <frames_dir> <out.mp4> [temporal_samples]
import json
import math
import os
import subprocess
import sys

import build_scene as bs
import lumen_build as lb
from build_scene import Graph, call, component, ref, rgba, setp, setin, spawn_class
from lumen_build import find, key, transform_section
from mcp_client import UnrealMCP

SCENE, ASSET, SEQ, NS, NCOMP = bs.SCENE, bs.ASSET, bs.SEQ, bs.NS, bs.NCOMP
LEVEL = "/Game/Maps/Void"
LEVEL_OBJ = LEVEL + ".Void"
SEQUENCE = "/Game/Cine/LS_Ribbons.LS_Ribbons"
FPS, PRE, SHOT = 30, 105, 240    # 3.5 s of pre-roll grow the trails; only the last 240 frames are kept
FRAMES = PRE + SHOT
PREFIX = "RB_"
CENTER = (0.0, 0.0, 170.0)
LIFE = 3.4              # seconds of path each trail keeps
WIDTH = 5.0             # ribbon width (cm)

# name, color, HDR gain, amplitudes (cm), frequencies (Hz), phases (rad)
RIBBONS = [
    ("Coral", bs.CORAL, 6.0, (170, 140, 90), (0.31, 0.23, 0.41), (0.0, 1.2, 0.5)),
    ("Amber", bs.AMBER, 5.0, (140, 170, 80), (0.27, 0.35, 0.19), (2.0, 0.3, 1.7)),
    ("Cyan", bs.CYAN, 7.0, (160, 160, 100), (0.21, 0.29, 0.37), (4.1, 2.2, 0.9)),
    ("Violet", bs.VIOLET, 6.0, (120, 180, 110), (0.37, 0.19, 0.25), (1.1, 3.5, 2.6)),
    ("Paper", (1.0, 0.86, 0.68), 3.5, (180, 120, 70), (0.25, 0.41, 0.31), (5.0, 4.4, 3.3)),
]


def system_path(name):
    return f"/Game/FX/NS_Ribbon{name}.NS_Ribbon{name}"


def head(r, f):
    """Position of a ribbon's emitter at frame f: a 3D Lissajous curve around CENTER."""
    t = f / FPS
    return tuple(c + a * math.sin(2 * math.pi * fr * t + ph) for c, a, fr, ph in zip(CENTER, r[3], r[4], r[5]))


def camera_keys():
    """A slow orbit with a push-in, always aimed at CENTER: (frame, location, rotation)."""
    keys = []
    for f in range(0, FRAMES + 1, 30):
        u = f / FRAMES
        a = math.radians(-150 + 45 * u)
        r = 700 - 100 * u
        loc = (CENTER[0] + r * math.cos(a), CENTER[1] + r * math.sin(a), 250 - 60 * u)
        dx, dy, dz = (c - p for c, p in zip(CENTER, loc))
        keys.append((f, loc, (math.degrees(math.atan2(dz, math.hypot(dx, dy))), math.degrees(math.atan2(dy, dx)), 0.0)))
    return keys


# ---------------------------------------------------------------- level
def stage_level():
    """Copies the template level and removes everything in it: a black void."""
    if not call(ASSET, "exists", path=LEVEL):
        call(ASSET, "duplicate", path="/Engine/Maps/Templates/Template_Default", new_path=LEVEL)
        call(ASSET, "save_assets", asset_paths=[LEVEL])
    if LEVEL not in str(call(SCENE, "get_current_level")):
        call(SCENE, "load_level", level_path=LEVEL)
    for cls in ("DirectionalLight", "SkyLight", "SkyAtmosphere", "VolumetricCloud", "ExponentialHeightFog",
                "StaticMeshActor"):
        for a in find(cls="/Script/Engine." + cls):
            if PREFIX not in a["refPath"]:
                call(SCENE, "remove_from_scene", actor=a)
    call(ASSET, "save_assets", asset_paths=[LEVEL])


# ---------------------------------------------------------------- materials
def stage_materials():
    """Additive unlit ribbon: particle color, soft across the width, fading toward the tail."""
    g = Graph("/Game/Materials", "M_Ribbon")
    pc = g.node("ParticleColor")
    uv = g.node("TextureCoordinate")
    u = g.node("ComponentMask", R=True, G=False, B=False, A=False)
    v = g.node("ComponentMask", R=False, G=True, B=False, A=False)
    g.link(uv, "", u, "None")
    g.link(uv, "", v, "None")
    # soft edge: 1 - |2v - 1|
    v2 = g.node("Multiply", ConstB=2.0)
    g.link(v, "", v2, "A")
    v3 = g.node("Subtract", ConstB=1.0)
    g.link(v2, "", v3, "A")
    av = g.node("Abs")
    g.link(v3, "", av, "None")
    edge = g.node("OneMinus")
    g.link(av, "", edge, "None")
    # tail fade: u is 0 at the newest particle and 1 at the oldest
    fade = g.node("OneMinus")
    g.link(u, "", fade, "None")
    fade2 = g.node("Multiply")
    g.link(fade, "", fade2, "A")
    g.link(fade, "", fade2, "B")
    a = g.node("Multiply")
    g.link(edge, "", a, "A")
    g.link(fade2, "", a, "B")
    out = g.node("Multiply")
    g.link(pc, "", out, "A")
    g.link(a, "", out, "B")
    g.out(out, "", "MP_EmissiveColor")
    g.done(BlendMode="BLEND_Additive", ShadingModel="MSM_Unlit", TwoSided=True, bUsedWithNiagaraRibbons=True)


# ---------------------------------------------------------------- niagara
def ribbon_system(r):
    """Creates NS_Ribbon<name> with one world-space LocationBasedRibbon emitter named Trail. The
    build_scene helpers (sref, setin) then target it through bs.SYSTEM."""
    path = system_path(r[0])
    bs.SYSTEM = path
    pkg = path.split(".")[0]
    if call(ASSET, "exists", path=pkg):
        call(ASSET, "delete", path=pkg)
    call(NS, "CreateNiagaraSystem", assetName=f"NS_Ribbon{r[0]}", assetPath="/Game/FX",
         templateSystem=ref("/Niagara/DefaultAssets/DefaultSystem.DefaultSystem"))
    call(NS, "RemoveEmitter", emitterToRemove=bs.sref("Fountain"))
    call(NS, "AddEmitter", system=ref(path),
         templateEmitter=ref("/Niagara/DefaultAssets/Templates/Emitters/LocationBasedRibbon.LocationBasedRibbon"),
         emitterName="Trail")
    call(NS, "SetEmitterData", emitter=bs.sref("Trail"),
         emitterData={"propertyValues": json.dumps({"bLocalSpace": False})})
    return path


def stage_niagara():
    for r in RIBBONS:
        path = ribbon_system(r)
        # the 5.8 template has no spawn module and plays once: loop forever and spawn at a steady rate
        setin("Trail", "EmitterUpdateScript", "EmitterState", "Loop Behavior",
              ("enum", "ENiagara_EmitterStateOptions.ENiagara_EmitterStateOptions", 0))
        rate = bs.add_module("Trail", "EmitterUpdateScript", "EmitterState", "/Niagara/Modules/Emitter/SpawnRate.SpawnRate")
        setin("Trail", "EmitterUpdateScript", rate, "SpawnRate", 240.0)
        ip, ps = "InitializeParticle", "ParticleSpawnScript"
        setin("Trail", ps, ip, "Lifetime", LIFE)
        setin("Trail", ps, ip, "Color", ("color", rgba(r[1], r[2])))
        setin("Trail", ps, ip, "Ribbon Width Mode", ("enum", "Ribbons/ENiagara_UnsetDirectSet.ENiagara_UnsetDirectSet", 1))
        setin("Trail", ps, ip, "Ribbon Width", WIDTH)
        call(NS, "SetRendererData", renderer=bs.sref("Trail", renderer=0), rendererData={"propertyValues": json.dumps({
            "Material": ref("/Game/Materials/M_Ribbon.M_Ribbon")})})
        print("  ", r[0], "issues:", json.dumps(call(NS, "GetStackIssues", system=ref(path)))[:400])
        call(ASSET, "save_assets", asset_paths=[path.split(".")[0]])


# ---------------------------------------------------------------- actors
def stage_actors():
    for a in find(PREFIX):
        call(SCENE, "remove_from_scene", actor=a)
    for r in RIBBONS:
        a = spawn_class("/Script/Niagara.NiagaraActor", PREFIX + r[0], head(r, 0))
        call(NCOMP, "SetSystem", niagaraComponent=ref(component(a, "/Script/Niagara.NiagaraComponent")),
             system=ref(system_path(r[0])), bResetExistingOverrideParameters=True)
    ppv = spawn_class("/Script/Engine.PostProcessVolume", PREFIX + "Grade", (0, 0, 0))
    setp(ppv, bUnbound=True, Settings={
        "bOverride_AutoExposureMethod": True, "AutoExposureMethod": "AEM_Manual",
        "bOverride_AutoExposureApplyPhysicalCameraExposure": True, "AutoExposureApplyPhysicalCameraExposure": False,
        "bOverride_AutoExposureBias": True, "AutoExposureBias": 0.0,
        "bOverride_BloomIntensity": True, "BloomIntensity": 1.8,
        "bOverride_VignetteIntensity": True, "VignetteIntensity": 0.3,
        "bOverride_FilmGrainIntensity": True, "FilmGrainIntensity": 0.02})


# ---------------------------------------------------------------- sequence
def stage_sequence():
    seq_pkg = SEQUENCE.split(".")[0]
    if call(ASSET, "exists", path=seq_pkg):
        call(ASSET, "delete", path=seq_pkg)
    f0, loc0, rot0 = camera_keys()[0]
    cam = spawn_class("/Script/CinematicCamera.CineCameraActor", PREFIX + "ShotCam", loc0, rot0)
    setp(component(cam, "/Script/CinematicCamera.CineCameraComponent"), CurrentFocalLength=28.0,
         CurrentAperture=8.0, FocusSettings={"FocusMethod": "Disable"})
    seq = call(SEQ, "create_level_sequence", package_path="/Game/Cine", asset_name="LS_Ribbons")["refPath"]
    call(SEQ, "open_sequence", sequence=ref(seq))
    call(SEQ, "set_display_rate", sequence=ref(seq), numerator=FPS, denominator=1)
    call(SEQ, "set_playback_range", sequence=ref(seq), start_frame=0, end_frame=FRAMES)
    actors = [ref(cam)] + [find(PREFIX + r[0])[0] for r in RIBBONS]
    by_name = {call(SEQ, "get_binding_name", binding=b): b for b in call(SEQ, "add_actors", actors=actors)}
    print("  bindings:", sorted(by_name))
    cam_b = by_name[PREFIX + "ShotCam"]
    sec = transform_section(cam_b, FRAMES)
    for f, loc, rot in camera_keys():
        for ch, v in zip(("Location.X", "Location.Y", "Location.Z", "Rotation.X", "Rotation.Y", "Rotation.Z"),
                         (*loc, rot[2], rot[0], rot[1])):
            key(sec, ch, f, v)
    for r in RIBBONS:
        sec = transform_section(by_name[PREFIX + r[0]], FRAMES)
        for f in range(0, FRAMES + 1, 3):
            for ch, v in zip(("Location.X", "Location.Y", "Location.Z"), head(r, f)):
                key(sec, ch, f, v)
    cut_track = call(SEQ, "add_track_to_sequence", sequence=ref(seq),
                     track_type=ref("/Script/MovieSceneTracks.MovieSceneCameraCutTrack"))
    cut = call(SEQ, "add_section", track=cut_track)
    call(SEQ, "set_section_range", section=cut, start_frame=0, end_frame=FRAMES)
    setp(cut["refPath"], CameraBindingID=call(SEQ, "get_binding_id", sequence=ref(seq), binding=cam_b))
    call(ASSET, "save_assets", asset_paths=[seq_pkg])


def stage_save():
    call(ASSET, "save_assets", asset_paths=[])
    print("  level:", call(SCENE, "get_current_level"))


STAGES = {"level": stage_level, "materials": stage_materials, "niagara": stage_niagara, "actors": stage_actors,
          "sequence": stage_sequence, "save": stage_save}


def render(frames_dir, out_mp4, temporal=8, start=0, end=FRAMES):
    """Renders the frames, then encodes only the shot (frames PRE onward) when the whole range was rendered."""
    lb.render(frames_dir, out_mp4, start, end, temporal, sequence=SEQUENCE, level=LEVEL_OBJ)
    if start == 0 and end == FRAMES:
        subprocess.run(["ffmpeg", "-nostdin", "-v", "error", "-y", "-framerate", str(FPS), "-start_number", str(PRE),
                        "-i", os.path.join(os.path.abspath(frames_dir), "f_%04d.png"), "-frames:v", str(SHOT),
                        "-c:v", "libx264", "-crf", "20", "-preset", "slow", "-pix_fmt", "yuv420p",
                        "-movflags", "+faststart", "-threads", "8", out_mp4], check=True)
        print("wrote", out_mp4)


def main(a):
    bs.m = UnrealMCP()
    print("MCP server:", json.dumps(bs.m.server_info))
    if a and a[0] == "render":
        render(a[1], a[2], *[int(x) for x in a[3:6]])
        return
    for name in a or list(STAGES):
        print("== stage", name)
        STAGES[name]()
    print("BUILD DONE")


if __name__ == "__main__":
    main(sys.argv[1:])
