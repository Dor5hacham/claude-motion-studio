# Builds and renders the Lumen time-lapse in a running Unreal Editor, only through the Unreal MCP.
# A concrete room with a perforated screen wall: the sun sweeps from dawn to dusk in 8 s, the grid
# of light squares crawls over the floor and walls, and Lumen bounces it around the room (warm and
# coral at the end, when the low sun hits the coral panel on the far wall).
# Reuses the helpers of build_scene.py (MCP calls, material graphs, spawning).
#   python lumen_build.py                         # every build stage
#   python lumen_build.py materials actors        # only these stages (level materials actors sequence save)
#   python lumen_build.py render <frames_dir> <out.mp4> [start end] [temporal_samples]
import json
import math
import os
import subprocess
import sys
import time

import build_scene as bs
from build_scene import Graph, call, component, ref, rgba, setp, spawn_asset, spawn_class
from mcp_client import UnrealMCP

SCENE, ASSET, ACTOR = bs.SCENE, bs.ASSET, bs.ACTOR
SEQ, KEY = bs.SEQ, bs.KEY
TOOLS = "motion_studio.tools.MotionStudioTools"

LEVEL = "/Game/Maps/Atrium"
LEVEL_OBJ = LEVEL + ".Atrium"
SEQUENCE = "/Game/Cine/LS_Lumen.LS_Lumen"
FPS, FRAMES = 30, 240
SMC = "/Script/Engine.StaticMeshComponent"
PREFIX = "LT_"          # label prefix of every actor this script spawns (cleanup on reruns)

# Room interior: x -600..600, y -400..400, z 0..500 (cm). The screen wall stands at y -420..-400.
SCREEN_Y = (-420.0, -400.0)
OPEN, BAR = 60.0, 20.0                  # square openings and the concrete bars between them
COLS, ROWS = 11, 5
SCREEN_X0 = -(COLS * OPEN + (COLS + 1) * BAR) / 2       # -450
SILL = 80.0                                              # top of the solid sill


# ---------------------------------------------------------------- sun and camera paths
def sun_rotation(f):
    """Directional light (pitch, yaw) at frame f: dawn in the east, high at midday, dusk in the
    west. Yaw 90 shines straight through the screen into the room (+Y)."""
    u = f / FRAMES
    yaw = 128.0 - 76.0 * u
    pitch = -(9.0 + 34.0 * math.sin(math.pi * u) - 5.0 * u)
    return pitch, yaw


def camera_keys():
    """A slow motion-control slide, as in a real time-lapse: (frame, location, rotation)."""
    keys = []
    for f in range(0, FRAMES + 1, 24):
        u = f / FRAMES
        e = u * u * (3 - 2 * u)
        loc = (-540 + 120 * e, 230 - 110 * e, 145 + 10 * e)
        rot = (-4.0 + 1.0 * e, -15.0 + 7.0 * e, 0.0)
        keys.append((f, loc, rot))
    return keys


# ---------------------------------------------------------------- level
def find(name="", cls=None):
    """Actors whose label contains name, optionally only of one class (refs as dicts)."""
    args = {"name": name, "tag": "", "collision_channels": []}
    if cls:
        args["actor_type"] = ref(cls)
    return call(SCENE, "find_actors", **args) or []


def stage_level():
    """Copies the engine's default template level and keeps its sun, sky atmosphere, sky light
    and height fog; removes the clouds and the template's floor mesh."""
    if not call(ASSET, "exists", path=LEVEL):
        call(ASSET, "duplicate", path="/Engine/Maps/Templates/Template_Default", new_path=LEVEL)
        call(ASSET, "save_assets", asset_paths=[LEVEL])
    if LEVEL not in str(call(SCENE, "get_current_level")):
        call(SCENE, "load_level", level_path=LEVEL)
    print("  template actors:", [a["refPath"].split(".")[-1] for a in find()])
    for a in find(cls="/Script/Engine.VolumetricCloud") + find(cls="/Script/Engine.StaticMeshActor"):
        if PREFIX not in a["refPath"]:
            call(SCENE, "remove_from_scene", actor=a)
    call(ASSET, "save_assets", asset_paths=[LEVEL])


# ---------------------------------------------------------------- materials
def concrete(name, dark, light, rough):
    """World-space mottled concrete: fractal noise blends two greys, so scaled cubes need no UVs."""
    g = Graph("/Game/Materials", name)
    a = g.node("Constant3Vector", Constant=rgba(dark))
    b = g.node("Constant3Vector", Constant=rgba(light))
    n = g.node("Noise", Scale=0.025, Levels=6, OutputMin=0.0, OutputMax=1.0)
    mix = g.node("LinearInterpolate")
    g.link(a, "", mix, "A")
    g.link(b, "", mix, "B")
    g.link(n, "", mix, "Alpha")
    g.out(mix, "", "MP_BaseColor")
    g.out(g.node("Constant", R=rough), "", "MP_Roughness")
    g.done()


def flat(name, color, rough):
    g = Graph("/Game/Materials", name)
    g.out(g.node("Constant3Vector", Constant=rgba(color)), "", "MP_BaseColor")
    g.out(g.node("Constant", R=rough), "", "MP_Roughness")
    g.done()


def stage_materials():
    concrete("M_Concrete", (0.36, 0.35, 0.33), (0.43, 0.42, 0.39), 0.85)
    concrete("M_ConcreteFloor", (0.27, 0.26, 0.25), (0.36, 0.35, 0.33), 0.5)
    flat("M_Plaster", (0.7, 0.68, 0.64), 0.55)
    flat("M_CoralPaint", (0.78, 0.22, 0.09), 0.7)


# ---------------------------------------------------------------- actors
def box(name, x0, x1, y0, y1, z0, z1, mat="M_Concrete", prefix=PREFIX):
    """A 100 cm engine cube scaled to fill the box x0..x1, y0..y1, z0..z1 (cm), labeled prefix + name."""
    loc = ((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2)
    scale = ((x1 - x0) / 100, (y1 - y0) / 100, (z1 - z0) / 100)
    a = spawn_asset("/Engine/BasicShapes/Cube", prefix + name, loc, scale=scale)
    setp(component(a, SMC), OverrideMaterials=[ref(f"/Game/Materials/{mat}.{mat}")])
    return a


def stage_actors():
    for a in find(PREFIX):
        call(SCENE, "remove_from_scene", actor=a)
    # shell: floor (also the ground outside), ceiling, three solid walls
    box("Floor", -2500, 2500, -2500, 2500, -20, 0, "M_ConcreteFloor")
    box("Ceiling", -640, 640, -440, 440, 500, 540)
    box("WallN", -640, 640, 400, 440, 0, 500)
    box("WallW", -640, -600, -420, 420, 0, 500)
    box("WallE", 600, 640, -420, 420, 0, 500)
    # perforated screen wall: solid ends, sill, head, then a grid of bars
    y0, y1 = SCREEN_Y
    x0 = SCREEN_X0
    x1 = -x0
    top = SILL + ROWS * OPEN + (ROWS - 1) * BAR + BAR      # 460: bottom of the solid head
    box("ScreenL", -640, x0, y0, y1, 0, 500)
    box("ScreenR", x1, 640, y0, y1, 0, 500)
    box("Sill", x0, x1, y0, y1, 0, SILL)
    box("Head", x0, x1, y0, y1, top - BAR, 500)
    for r in range(1, ROWS):
        z = SILL + r * OPEN + (r - 1) * BAR
        box(f"Rail{r}", x0, x1, y0, y1, z, z + BAR)
    for c in range(COLS + 1):
        x = x0 + c * (OPEN + BAR)
        box(f"Bar{c:02d}", x, x + BAR, y0, y1, SILL, top - BAR)
    # coral panel on the far wall (the evening sun lands on it), a low bench, a plaster sphere
    box("Coral", 594, 600, -40, 260, 0, 380, "M_CoralPaint")
    box("Bench", -380, 140, 320, 400, 0, 45)
    # the engine's smoothest sphere mesh (3968 triangles), scaled from its bounds to 160 cm across
    sphere = spawn_asset("/Engine/EditorMeshes/EditorSphere", PREFIX + "Sphere", (40, -120, 80))
    b = call(ACTOR, "get_actor_bounds", actor=ref(sphere))
    k = 160.0 / (b["max"]["x"] - b["min"]["x"])
    call(ACTOR, "set_actor_transform", actor=ref(sphere), xform=bs.xform((40, -120, 80), scale=(k, k, k)))
    setp(component(sphere, SMC), OverrideMaterials=[ref("/Game/Materials/M_Plaster.M_Plaster")])
    # sun: movable so the sequence can turn it; sharper shadows, brighter beams in the fog
    sun = find(cls="/Script/Engine.DirectionalLight")[0]
    p, y = sun_rotation(0)
    call(ACTOR, "set_actor_transform", actor=sun, xform=bs.xform((0, 0, 600), (p, y, 0)))
    setp(component(sun["refPath"], "/Script/Engine.DirectionalLightComponent"), Mobility="Movable",
         LightSourceAngle=0.35, VolumetricScatteringIntensity=4.0, bAtmosphereSunLight=True)
    # brighter sky light: the 55 openings then fill the room with soft daylight
    sky = find(cls="/Script/Engine.SkyLight")[0]
    setp(component(sky["refPath"], "/Script/Engine.SkyLightComponent"), Intensity=2.0)
    # height fog at floor level with volumetric fog, so the sun draws beams through the openings
    fog = find(cls="/Script/Engine.ExponentialHeightFog")[0]
    call(ACTOR, "set_actor_transform", actor=fog, xform=bs.xform((0, 0, 0)))
    setp(component(fog["refPath"], "/Script/Engine.ExponentialHeightFogComponent"), FogDensity=0.06,
         FogHeightFalloff=0.2, FogInscatteringLuminance={"r": 0.02, "g": 0.025, "b": 0.035, "a": 1.0},
         bEnableVolumetricFog=True, VolumetricFogScatteringDistribution=0.6, VolumetricFogExtinctionScale=1.0)
    # post process: histogram exposure like a time-lapse camera, fast Lumen updates for the moving sun
    ppv = spawn_class("/Script/Engine.PostProcessVolume", PREFIX + "Grade", (0, 0, 0))
    setp(ppv, bUnbound=True, Settings={
        "bOverride_AutoExposureMethod": True, "AutoExposureMethod": "AEM_Histogram",
        "bOverride_AutoExposureBias": True, "AutoExposureBias": 1.2,
        "bOverride_AutoExposureSpeedUp": True, "AutoExposureSpeedUp": 2.0,
        "bOverride_AutoExposureSpeedDown": True, "AutoExposureSpeedDown": 2.0,
        "bOverride_LocalExposureShadowContrastScale": True, "LocalExposureShadowContrastScale": 0.65,
        "bOverride_BloomIntensity": True, "BloomIntensity": 0.5,
        "bOverride_VignetteIntensity": True, "VignetteIntensity": 0.35,
        "bOverride_FilmGrainIntensity": True, "FilmGrainIntensity": 0.04,
        "bOverride_LumenFinalGatherQuality": True, "LumenFinalGatherQuality": 2.0,
        "bOverride_LumenSceneLightingQuality": True, "LumenSceneLightingQuality": 2.0,
        "bOverride_LumenReflectionQuality": True, "LumenReflectionQuality": 2.0,
        "bOverride_LumenSceneLightingUpdateSpeed": True, "LumenSceneLightingUpdateSpeed": 4.0,
        "bOverride_LumenFinalGatherLightingUpdateSpeed": True, "LumenFinalGatherLightingUpdateSpeed": 4.0})


# ---------------------------------------------------------------- sequence
def transform_section(binding, end=FRAMES):
    """The binding's transform section over frames 0..end (adds the track when missing)."""
    tracks = [t for t in call(SEQ, "get_tracks_on_binding", binding=binding) if "3DTransformTrack" in t["refPath"]]
    track = tracks[0] if tracks else call(SEQ, "add_track_to_binding", binding=binding,
                                          track_type=ref("/Script/MovieSceneTracks.MovieScene3DTransformTrack"))
    sections = call(SEQ, "get_sections", track=track)
    section = sections[0] if sections else call(SEQ, "add_section", track=track)
    call(SEQ, "set_section_range", section=section, start_frame=0, end_frame=end)
    return section


def key(section, channel, frame, value):
    call(KEY, "add_key_float", section=section, channel_name=channel, frame=frame, value=value, interpolation="auto")


def stage_sequence():
    seq_pkg = SEQUENCE.split(".")[0]
    if call(ASSET, "exists", path=seq_pkg):
        call(ASSET, "delete", path=seq_pkg)
    f0, loc0, rot0 = camera_keys()[0]
    cam = spawn_class("/Script/CinematicCamera.CineCameraActor", PREFIX + "ShotCam", loc0, rot0)
    setp(component(cam, "/Script/CinematicCamera.CineCameraComponent"), CurrentFocalLength=17.0,
         CurrentAperture=8.0, FocusSettings={"FocusMethod": "Disable"})
    sun = find(cls="/Script/Engine.DirectionalLight")[0]
    seq = call(SEQ, "create_level_sequence", package_path="/Game/Cine", asset_name="LS_Lumen")["refPath"]
    call(SEQ, "open_sequence", sequence=ref(seq))
    call(SEQ, "set_display_rate", sequence=ref(seq), numerator=FPS, denominator=1)
    call(SEQ, "set_playback_range", sequence=ref(seq), start_frame=0, end_frame=FRAMES)
    cam_b, sun_b = call(SEQ, "add_actors", actors=[ref(cam), sun])
    sec = transform_section(cam_b)
    print("  camera channels:", call(KEY, "get_channel_names", section=sec))
    for f, loc, rot in camera_keys():
        for ch, v in zip(("Location.X", "Location.Y", "Location.Z", "Rotation.X", "Rotation.Y", "Rotation.Z"),
                         (*loc, rot[2], rot[0], rot[1])):
            key(sec, ch, f, v)
    # the sun: pitch and yaw keyed every 10 frames along the day arc
    sec = transform_section(sun_b)
    for f in range(0, FRAMES + 1, 10):
        p, y = sun_rotation(f)
        key(sec, "Rotation.Y", f, p)
        key(sec, "Rotation.Z", f, y)
        key(sec, "Location.Z", f, 600.0)
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


# ---------------------------------------------------------------- render
def render(frames_dir, out_mp4, start=-1, end=-1, temporal=8, sequence=SEQUENCE, level=LEVEL_OBJ):
    """Movie Render Queue through the project toolset; encodes the MP4 after a full render."""
    frames_dir = os.path.abspath(frames_dir)
    args = {"sequence_path": sequence, "map_path": level, "output_dir": frames_dir.replace("\\", "/"),
            "start_frame": start, "end_frame": end, "temporal_samples": temporal,
            "warm_up_frames": 30 if start >= 0 else 60}
    t0 = time.time()
    print(bs.m.call(TOOLS, "render_sequence", args))
    while True:
        status = bs.m.call(TOOLS, "render_status")["returnValue"]
        if status.startswith("done") or status.startswith("cancelled"):
            break
        time.sleep(5)
    print(f"{status} in {time.time() - t0:.0f} s")
    if not status.startswith("done ok"):
        sys.exit(1)
    if start < 0 and end < 0:
        subprocess.run(["ffmpeg", "-nostdin", "-v", "error", "-y", "-framerate", str(FPS), "-start_number", "0",
                        "-i", os.path.join(frames_dir, "f_%04d.png"), "-c:v", "libx264", "-crf", "20",
                        "-preset", "slow", "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-threads", "8",
                        out_mp4], check=True)
        print("wrote", out_mp4)


def main(a):
    bs.m = UnrealMCP()
    print("MCP server:", json.dumps(bs.m.server_info))
    if a and a[0] == "render":
        nums = [int(x) for x in a[3:6]]
        render(a[1], a[2], *nums)
        return
    for name in a or list(STAGES):
        print("== stage", name)
        STAGES[name]()
    print("BUILD DONE")


if __name__ == "__main__":
    main(sys.argv[1:])
