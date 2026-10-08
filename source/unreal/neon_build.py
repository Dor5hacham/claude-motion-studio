# Builds and renders the neon light installation in a running Unreal Editor, only through the Unreal MCP.
# A white gallery corner with no light actors at all: six emissive tubes draw themselves along the
# edges one after another, and Lumen lights the room only from those glowing meshes (manual exposure,
# so the room really goes from dark to full color). Reuses the helpers of build_scene.py and lumen_build.py.
#   python neon_build.py                         # every build stage
#   python neon_build.py materials actors        # only these stages (level materials actors sequence save)
#   python neon_build.py render <frames_dir> <out.mp4> [start end] [temporal_samples]
import json
import math
import sys

import build_scene as bs
import lumen_build as lb
from build_scene import Graph, call, component, ref, rgba, setp, spawn_asset, spawn_class
from lumen_build import find, key, transform_section
from mcp_client import UnrealMCP

SCENE, ASSET, SEQ = bs.SCENE, bs.ASSET, bs.SEQ
LEVEL = "/Game/Maps/Gallery"
LEVEL_OBJ = LEVEL + ".Gallery"
SEQUENCE = "/Game/Cine/LS_Neon.LS_Neon"
FPS, FRAMES = 30, 240
SMC = "/Script/Engine.StaticMeshComponent"
PREFIX = "NE_"
ROOM = 400.0            # interior half-width (x and y) and height (cm)
TUBE = 14.0             # tube thickness (cm)
C = ROOM - 12 - TUBE / 2          # tubes are mounted 12 cm off the walls
GLOW = 26.0             # emissive strength of the tubes

COLORS = {"Coral": bs.CORAL, "Cyan": bs.CYAN, "Amber": bs.AMBER, "Violet": bs.VIOLET, "Paper": (1.0, 0.86, 0.68)}
# (name, color, start point, end point, first frame, last frame): each tube grows from its start point
TUBES = [
    ("Corner", "Coral", (C, C, 0), (C, C, ROOM), -12, 24),
    ("FloorE", "Cyan", (C, C, TUBE / 2), (C, -ROOM, TUBE / 2), 18, 58),
    ("FloorN", "Amber", (C, C, TUBE / 2), (-ROOM, C, TUBE / 2), 38, 78),
    ("CeilE", "Violet", (C, C, ROOM - TUBE / 2), (C, -ROOM, ROOM - TUBE / 2), 66, 106),
    ("CeilN", "Paper", (C, C, ROOM - TUBE / 2), (-ROOM, C, ROOM - TUBE / 2), 88, 128),
    ("Diagonal", "Cyan", (300, C, 40), (-60, C, 360), 135, 185),
]


def ease_out(x):
    x = min(max(x, 0.0), 1.0)
    return 1 - (1 - x) ** 3


def tube_state(t, f):
    """Center, rotation (pitch, yaw, roll) and length of a tube at frame f."""
    _, _, p0, p1, f0, f1 = t
    d = [b - a for a, b in zip(p0, p1)]
    full = math.sqrt(sum(v * v for v in d))
    u = [v / full for v in d]
    length = full * max(ease_out((f - f0) / (f1 - f0)), 0.002)
    center = tuple(a + v * length / 2 for a, v in zip(p0, u))
    rot = (math.degrees(math.atan2(u[2], math.hypot(u[0], u[1]))), math.degrees(math.atan2(u[1], u[0])), 0.0)
    return center, rot, length


def camera_keys():
    """A slow arc around the corner with a push-in: (frame, location, rotation)."""
    target = (C, C, 195.0)
    keys = []
    for f in range(0, FRAMES + 1, 24):
        u = f / FRAMES
        e = u * u * (3 - 2 * u)
        a = math.radians(235 - 20 * e)
        r = 860 - 100 * e
        loc = (target[0] + r * math.cos(a), target[1] + r * math.sin(a), 175 - 20 * e)
        dx, dy, dz = (t - c for t, c in zip(target, loc))
        keys.append((f, loc, (math.degrees(math.atan2(dz, math.hypot(dx, dy))), math.degrees(math.atan2(dy, dx)), 0.0)))
    return keys


# ---------------------------------------------------------------- level
def stage_level():
    """Copies the template level and removes every light, the sky, fog, clouds and floor."""
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
    lb.flat("M_GalleryWall", (0.78, 0.77, 0.75), 0.9)
    lb.flat("M_GalleryFloor", (0.16, 0.16, 0.165), 0.18)
    for name, col in COLORS.items():
        g = Graph("/Game/Materials", "M_Neon" + name)
        g.out(g.node("Constant3Vector", Constant=rgba((0, 0, 0))), "", "MP_BaseColor")
        g.out(g.node("Constant3Vector", Constant=rgba(col, GLOW)), "", "MP_EmissiveColor")
        g.done()


# ---------------------------------------------------------------- actors
def stage_actors():
    for a in find(PREFIX):
        call(SCENE, "remove_from_scene", actor=a)
    r, w = ROOM, 30.0
    lb.box("Floor", -r - w, r + w, -r - w, r + w, -w, 0, "M_GalleryFloor", PREFIX)
    lb.box("Ceiling", -r - w, r + w, -r - w, r + w, r, r + w, "M_GalleryWall", PREFIX)
    lb.box("WallN", -r - w, r + w, r, r + w, 0, r, "M_GalleryWall", PREFIX)
    lb.box("WallS", -r - w, r + w, -r - w, -r, 0, r, "M_GalleryWall", PREFIX)
    lb.box("WallE", r, r + w, -r, r, 0, r, "M_GalleryWall", PREFIX)
    lb.box("WallW", -r - w, -r, -r, r, 0, r, "M_GalleryWall", PREFIX)
    for t in TUBES:
        center, rot, length = tube_state(t, 0)
        a = spawn_asset("/Engine/BasicShapes/Cube", PREFIX + "Tube" + t[0], center, rot,
                        (length / 100, TUBE / 100, TUBE / 100))
        setp(component(a, SMC), Mobility="Movable", CastShadow=False,
             OverrideMaterials=[ref(f"/Game/Materials/M_Neon{t[1]}.M_Neon{t[1]}")])
    # post process: manual exposure (the room must get brighter as tubes switch on), neon bloom,
    # high Lumen quality and scene detail so the thin tubes stay in the Lumen scene
    ppv = spawn_class("/Script/Engine.PostProcessVolume", PREFIX + "Grade", (0, 0, 0))
    setp(ppv, bUnbound=True, Settings={
        "bOverride_AutoExposureMethod": True, "AutoExposureMethod": "AEM_Manual",
        "bOverride_AutoExposureApplyPhysicalCameraExposure": True, "AutoExposureApplyPhysicalCameraExposure": False,
        "bOverride_AutoExposureBias": True, "AutoExposureBias": -2.0,
        "bOverride_BloomIntensity": True, "BloomIntensity": 1.0,
        "bOverride_VignetteIntensity": True, "VignetteIntensity": 0.35,
        "bOverride_FilmGrainIntensity": True, "FilmGrainIntensity": 0.03,
        "bOverride_LumenSceneDetail": True, "LumenSceneDetail": 4.0,
        "bOverride_LumenFinalGatherQuality": True, "LumenFinalGatherQuality": 4.0,
        "bOverride_LumenSceneLightingQuality": True, "LumenSceneLightingQuality": 2.0,
        "bOverride_LumenReflectionQuality": True, "LumenReflectionQuality": 2.0,
        "bOverride_LumenSceneLightingUpdateSpeed": True, "LumenSceneLightingUpdateSpeed": 4.0,
        "bOverride_LumenFinalGatherLightingUpdateSpeed": True, "LumenFinalGatherLightingUpdateSpeed": 4.0})


# ---------------------------------------------------------------- sequence
def stage_sequence():
    seq_pkg = SEQUENCE.split(".")[0]
    if call(ASSET, "exists", path=seq_pkg):
        call(ASSET, "delete", path=seq_pkg)
    f0, loc0, rot0 = camera_keys()[0]
    cam = spawn_class("/Script/CinematicCamera.CineCameraActor", PREFIX + "ShotCam", loc0, rot0)
    setp(component(cam, "/Script/CinematicCamera.CineCameraComponent"), CurrentFocalLength=19.0,
         CurrentAperture=8.0, FocusSettings={"FocusMethod": "Disable"})
    tubes = [find(PREFIX + "Tube" + t[0])[0] for t in TUBES]
    seq = call(SEQ, "create_level_sequence", package_path="/Game/Cine", asset_name="LS_Neon")["refPath"]
    call(SEQ, "open_sequence", sequence=ref(seq))
    call(SEQ, "set_display_rate", sequence=ref(seq), numerator=FPS, denominator=1)
    call(SEQ, "set_playback_range", sequence=ref(seq), start_frame=0, end_frame=FRAMES)
    found = call(SEQ, "add_actors", actors=[ref(cam)] + tubes)
    by_name = {call(SEQ, "get_binding_name", binding=b): b for b in found}
    print("  bindings:", sorted(by_name))
    cam_b = by_name[PREFIX + "ShotCam"]
    sec = transform_section(cam_b)
    for f, loc, rot in camera_keys():
        for ch, v in zip(("Location.X", "Location.Y", "Location.Z", "Rotation.X", "Rotation.Y", "Rotation.Z"),
                         (*loc, rot[2], rot[0], rot[1])):
            key(sec, ch, f, v)
    # each tube: rotation keyed once; thickness near zero (hidden) until its first frame; center and
    # length keyed every 2 frames while it grows
    for t in TUBES:
        sec = transform_section(by_name[PREFIX + "Tube" + t[0]])
        _, rot, _ = tube_state(t, 0)
        for ch, v in zip(("Rotation.X", "Rotation.Y", "Rotation.Z"), (rot[2], rot[0], rot[1])):
            key(sec, ch, 0, v)
        for ch in ("Scale.Y", "Scale.Z"):
            if t[4] > 0:
                call(bs.KEY, "add_key_float", section=sec, channel_name=ch, frame=0, value=0.0001,
                     interpolation="constant")
            call(bs.KEY, "add_key_float", section=sec, channel_name=ch, frame=max(t[4], 0), value=TUBE / 100,
                 interpolation="constant")
        for f in range(max(t[4], 0), t[5] + 1, 2):
            center, _, length = tube_state(t, f)
            for ch, v in zip(("Location.X", "Location.Y", "Location.Z", "Scale.X"), (*center, length / 100)):
                call(bs.KEY, "add_key_float", section=sec, channel_name=ch, frame=f, value=v, interpolation="linear")
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
