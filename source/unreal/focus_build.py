# Builds and renders the rack focus in a running Unreal Editor, only through the Unreal MCP.
# Four strands of glowing bulbs hang at depths from 1.6 to 11 m in a black void (a dark floor sits below the frame).
# A 75 mm cine camera at f/1.4 tracks an invisible target point for focus; Sequencer moves that point,
# so the focus pulls from the nearest strand to the farthest with holds, and the bokeh discs swap.
# Reuses the helpers of build_scene.py and lumen_build.py.
#   python focus_build.py                        # every build stage (level materials actors sequence save)
#   python focus_build.py render <frames_dir> <out.mp4> [start end] [temporal_samples]
import json
import random
import sys

import build_scene as bs
import lumen_build as lb
from build_scene import Graph, call, component, ref, rgba, setp, spawn_asset, spawn_class
from lumen_build import find, key, transform_section
from mcp_client import UnrealMCP

SCENE, ASSET, SEQ = bs.SCENE, bs.ASSET, bs.SEQ
LEVEL = "/Game/Maps/Bokeh"
LEVEL_OBJ = LEVEL + ".Bokeh"
SEQUENCE = "/Game/Cine/LS_Focus.LS_Focus"
FPS, FRAMES = 30, 240
PREFIX = "FO_"
EYE = 150.0             # camera height (cm); the camera looks along +X
GLOW = 60.0             # emissive strength of the bulbs (defocused discs spread it thin)
LENS = 75.0
TAN_H, TAN_V = 23.76 / 2 / LENS, 13.365 / 2 / LENS      # half-frame tangents on Super 35

COLORS = {"Amber": bs.AMBER, "Paper": (1.0, 0.86, 0.68), "Coral": bs.CORAL, "Cyan": bs.CYAN}
# depth (cm), height in the frame (-1 bottom .. 1 top), color cycle
STRANDS = [
    (160, -0.25, ("Amber", "Paper")),
    (300, 0.6, ("Paper", "Coral", "Paper")),
    (550, -0.75, ("Amber", "Amber", "Cyan")),
    (1100, 0.2, ("Paper", "Amber", "Coral", "Amber")),
]
# focus depth keys (frame, depth): hold near, pull to the middle strand, hold, pull to the far strand, hold
FOCUS = [(0, 160), (40, 160), (100, 550), (150, 550), (210, 1100), (240, 1100)]


def bulbs():
    """(name, location, radius, color) of every bulb: each strand sags across the frame like a
    catenary, with spacing and bulb size proportional to depth so all strands look alike on screen.
    A seeded jitter in spacing, height and size keeps the strands from looking like a grid."""
    rnd = random.Random(7)
    out = []
    for k, (d, h, cycle) in enumerate(STRANDS):
        w = 1.3 * d * TAN_H
        n = 24
        zc = EYE + h * d * TAN_V
        sag = 0.22 * d * TAN_V
        for i in range(n):
            y = -w + 2 * w * (i + rnd.uniform(-0.3, 0.3)) / (n - 1)
            z = zc + sag * ((y / w) ** 2 - 0.5) + rnd.uniform(-0.02, 0.02) * d * TAN_V
            out.append((f"B{k}_{i:02d}", (float(d), y, z), rnd.uniform(0.0016, 0.003) * d, cycle[i % len(cycle)]))
    return out


def camera_keys():
    """A slow sideways truck with a slight push, for parallax between the strands."""
    keys = []
    for f in range(0, FRAMES + 1, 24):
        u = f / FRAMES
        e = u * u * (3 - 2 * u)
        keys.append((f, (-20 + 30 * e, -18 + 36 * e, EYE), (0.0, 1.2 - 2.4 * e, 0.0)))
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
    lb.flat("M_BokehFloor", (0.02, 0.02, 0.022), 0.12)
    for name, col in COLORS.items():
        g = Graph("/Game/Materials", "M_Bulb" + name)
        g.out(g.node("Constant3Vector", Constant=rgba((0, 0, 0))), "", "MP_BaseColor")
        g.out(g.node("Constant3Vector", Constant=rgba(col, GLOW)), "", "MP_EmissiveColor")
        g.done()


# ---------------------------------------------------------------- actors
def stage_actors():
    for a in find(PREFIX):
        call(SCENE, "remove_from_scene", actor=a)
    lb.box("Floor", -500, 3000, -2000, 2000, -20, 0, "M_BokehFloor", PREFIX)
    for name, loc, r, col in bulbs():
        s = 2 * r / 100
        a = spawn_asset("/Engine/BasicShapes/Sphere", PREFIX + name, loc, scale=(s, s, s))
        setp(component(a, "/Script/Engine.StaticMeshComponent"), CastShadow=False,
             OverrideMaterials=[ref(f"/Game/Materials/M_Bulb{col}.M_Bulb{col}")])
    spawn_class("/Script/Engine.TargetPoint", PREFIX + "Focus", (FOCUS[0][1], 0, EYE))
    ppv = spawn_class("/Script/Engine.PostProcessVolume", PREFIX + "Grade", (0, 0, 0))
    setp(ppv, bUnbound=True, Settings={
        "bOverride_AutoExposureMethod": True, "AutoExposureMethod": "AEM_Manual",
        "bOverride_AutoExposureApplyPhysicalCameraExposure": True, "AutoExposureApplyPhysicalCameraExposure": False,
        "bOverride_AutoExposureBias": True, "AutoExposureBias": -2.6,
        "bOverride_BloomIntensity": True, "BloomIntensity": 0.6,
        "bOverride_VignetteIntensity": True, "VignetteIntensity": 0.4,
        "bOverride_FilmGrainIntensity": True, "FilmGrainIntensity": 0.03})


# ---------------------------------------------------------------- sequence
def stage_sequence():
    seq_pkg = SEQUENCE.split(".")[0]
    if call(ASSET, "exists", path=seq_pkg):
        call(ASSET, "delete", path=seq_pkg)
    f0, loc0, rot0 = camera_keys()[0]
    cam = spawn_class("/Script/CinematicCamera.CineCameraActor", PREFIX + "ShotCam", loc0, rot0)
    target = find(PREFIX + "Focus")[0]
    # 75 mm at f/1.4 with a 7-blade diaphragm; focus tracks the target point
    setp(component(cam, "/Script/CinematicCamera.CineCameraComponent"), CurrentFocalLength=LENS,
         CurrentAperture=1.4, LensSettings={"MinFocalLength": LENS, "MaxFocalLength": LENS, "MinFStop": 1.2,
                                            "MaxFStop": 22.0, "DiaphragmBladeCount": 7},
         FocusSettings={"FocusMethod": "Tracking", "TrackingFocusSettings": {"ActorToTrack": target["refPath"]}})
    seq = call(SEQ, "create_level_sequence", package_path="/Game/Cine", asset_name="LS_Focus")["refPath"]
    call(SEQ, "open_sequence", sequence=ref(seq))
    call(SEQ, "set_display_rate", sequence=ref(seq), numerator=FPS, denominator=1)
    call(SEQ, "set_playback_range", sequence=ref(seq), start_frame=0, end_frame=FRAMES)
    by_name = {call(SEQ, "get_binding_name", binding=b): b for b in call(SEQ, "add_actors", actors=[ref(cam), target])}
    print("  bindings:", sorted(by_name))
    cam_b = by_name[PREFIX + "ShotCam"]
    sec = transform_section(cam_b, FRAMES)
    for f, loc, rot in camera_keys():
        for ch, v in zip(("Location.X", "Location.Y", "Location.Z", "Rotation.X", "Rotation.Y", "Rotation.Z"),
                         (*loc, rot[2], rot[0], rot[1])):
            key(sec, ch, f, v)
    # the focus target: smart-auto keys give eased pulls with flat holds and no overshoot
    sec = transform_section(by_name[PREFIX + "Focus"], FRAMES)
    for f, d in FOCUS:
        for ch, v in zip(("Location.X", "Location.Y", "Location.Z"), (d, 0.0, EYE)):
            call(bs.KEY, "add_key_float", section=sec, channel_name=ch, frame=f, value=v, interpolation="")
    cut_track = call(SEQ, "add_track_to_sequence", sequence=ref(seq),
                     track_type=ref("/Script/MovieSceneTracks.MovieSceneCameraCutTrack"))
    cut = call(SEQ, "add_section", track=cut_track)
    call(SEQ, "set_section_range", section=cut, start_frame=0, end_frame=FRAMES)
    setp(cut["refPath"], CameraBindingID=call(SEQ, "get_binding_id", sequence=ref(seq), binding=cam_b))
    call(ASSET, "save_assets", asset_paths=[seq_pkg])


def stage_save():
    call(ASSET, "save_assets", asset_paths=[])
    print("  level:", call(SCENE, "get_current_level"))


STAGES = {"level": stage_level, "materials": stage_materials, "actors": stage_actors,
          "sequence": stage_sequence, "save": stage_save}


def main(a):
    bs.m = UnrealMCP()
    print("MCP server:", json.dumps(bs.m.server_info))
    if a and a[0] == "render":
        nums = [int(x) for x in a[3:6]]
        lb.render(a[1], a[2], *nums, sequence=SEQUENCE, level=LEVEL_OBJ)
        return
    for name in a or list(STAGES):
        print("== stage", name)
        STAGES[name]()
    print("BUILD DONE")


if __name__ == "__main__":
    main(sys.argv[1:])
