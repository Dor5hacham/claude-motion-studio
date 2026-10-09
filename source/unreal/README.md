# Unreal Engine project (built through the Unreal MCP)

`media/engine/unreal-niagara.mp4`: about 45,000 GPU particles (two emitters) spiral into a glowing coral core over a glossy black studio floor, while the camera orbits down from a top view to a grazing view. Built in Unreal Engine 5.8 by talking to the editor's built-in MCP server, rendered with Movie Render Queue.

| File | What it is |
|---|---|
| `MotionStudio/MotionStudio.uproject` | Blank project with no C++. Enables the Unreal MCP (`ModelContextProtocol`), the toolsets it serves (`EditorToolset`, `NiagaraToolsets`, `AnimationAssistantToolset`), Niagara, Python, Sequencer scripting and Movie Render Queue |
| `MotionStudio/Config/DefaultEditorPerProjectUserSettings.ini` | Starts the MCP server with the editor on `http://127.0.0.1:8000/mcp` (no authentication, see [The MCP server is open while the editor runs](#the-mcp-server-is-open-while-the-editor-runs)), with tool search on, and keeps the editor at full speed in the background |
| `MotionStudio/Config/DefaultEngine.ini` | Lumen global illumination and reflections, virtual shadow maps, DX12 SM6 |
| `MotionStudio/Content/Python/motion_studio/tools.py` | A project MCP toolset: `render_sequence`, `render_status`, `cancel_render` (Movie Render Queue). The built-in toolsets have no render tool |
| `mcp_client.py` | Small Python client for the MCP (Streamable HTTP, JSON-RPC): `initialize`, `tools/list`, `list_toolsets`, `describe_toolset`, `call_tool` |
| `build_scene.py` | Builds the whole scene through MCP calls only: level, materials, Niagara system, actors, Level Sequence |
| `render.py` | Renders through the project toolset over the MCP, then encodes the MP4 with FFmpeg |
| `lumen_build.py` | Builds and renders the Lumen time-lapse (see below), with the same helpers |
| `neon_build.py` | Builds and renders the neon light installation (see below), with the helpers of both scripts |
| `ribbons_build.py` | Builds and renders the 3D light painting with Niagara ribbons (see below) |
| `focus_build.py` | Builds and renders the rack focus with bokeh (see below) |

## Run it

The project folder holds only sources. Copy it to a work folder, because Unreal writes `Saved/`, `Intermediate/` and `DerivedDataCache/` next to the `.uproject`. Set `UNREAL_EDITOR` to the editor executable of your Unreal Engine 5.8 install (`Engine/Binaries/Win64/UnrealEditor.exe` inside the engine folder). Run these from this folder (`source/unreal`) in Git Bash:

```
mkdir -p ../../_work/unreal
cp -r MotionStudio ../../_work/unreal/
"$UNREAL_EDITOR" "$(cd ../../_work/unreal/MotionStudio && pwd -W)/MotionStudio.uproject" -log -nosplash &
python mcp_client.py wait 540          # prints MCP READY once the server answers
python build_scene.py                  # all stages; or name some: level materials niagara actors sequence save
python render.py ../../_work/unreal/frames ../../media/engine/unreal-niagara.mp4
```

Then close the editor. The first launch on a new machine compiles shaders and can take much longer than the minute it took here with a warm shader cache. The build takes about a minute, and the render about 8 minutes on a Radeon RX 9070 XT: 150 frames at 1280x720, 8 temporal samples per frame (that is also the motion blur), and 60 warm-up frames so the vortex is already full on frame 0. `python render.py <dir> x.mp4 75 76` renders one test frame.

## The MCP server is open while the editor runs

Opening this project starts the Unreal MCP server on `127.0.0.1:8000` (`bAutoStartServer=True` in `MotionStudio/Config/DefaultEditorPerProjectUserSettings.ini`). The server has no authentication. While the editor is open, any program on the computer that can reach that port can call its tools and change the open project. Closing the editor stops the server.

To turn it off, set `bAutoStartServer=False` in `Config/DefaultEditorPerProjectUserSettings.ini` of your work copy before you open it. The build and render scripts need the server, so keep it on only for the copy you build with, and close the editor as soon as the build and render are done.

## What went through the MCP

Everything, using the server's tool-search tools (`list_toolsets`, `describe_toolset`, `call_tool`):

- Level: `AssetTools.duplicate` of `/Engine/Maps/Templates/Template_Default`, `save_assets`, `SceneTools.load_level`, `remove_from_scene` for the sun, sky and clouds.
- Materials: `MaterialTools.create_material`, `add_expression`, `connect_expressions`, `connect_to_output`, `recompile`, and `ObjectTools.set_properties` for node values and blend mode. The sparks use a masked, unlit material, so they are in the depth buffer and Lumen's screen traces can reflect them in the floor.
- Niagara: `NiagaraToolset_System.CreateNiagaraSystem`, `RemoveEmitter`, `AddEmitter` (Fountain template), `SetEmitterData` (GPU simulation, fixed bounds), `SetSystemData` (4 s warm-up), `SetStackInputData` (spawn rate, lifetime, colors, sizes, torus shape, an HLSL expression for the swirl velocity), `AddModule` (curl noise, vortex, point attraction, scale sprite size by speed), `SetRendererData` (velocity-aligned sprites), `GetStackIssues`.
- Actors: `SceneTools.add_to_scene_from_asset` and `add_to_scene_from_class`, `ActorTools.get_components`, `ObjectTools.set_properties` (lights, height fog, post-process volume, camera lens and focus, look-at tracking), `NiagaraToolset_Component.SetSystem`.
- Sequence: `SequencerTools.create_level_sequence`, `open_sequence`, `set_display_rate`, `set_playback_range`, `add_actors`, `get_tracks_on_binding`, `get_sections`, `add_track_to_sequence`, `add_section`, `set_section_range`, `get_binding_id`, and `SequencerKeyframingTools.add_key_float`.
- Render: the project toolset's `render_sequence` and `render_status`, which run Movie Render Queue in the editor (PIE executor).
- Checks while building: `EditorAppToolset.CaptureViewport` for viewport previews.

## Lumen time-lapse (`lumen_build.py`)

`media/engine/unreal-lumen.mp4`: a day passes in 8 s inside a 12 x 8 x 5 m concrete room. The sun sweeps from a hazy dawn to an orange dusk, and the grid of light from a perforated screen wall (11 x 5 square openings) crawls over the floor, climbs a coral panel and ends on the far wall. Lumen recomputes the bounce light every frame, and volumetric fog shows the beams in the morning.

- Same project, same MCP tools as the vortex. `lumen_build.py` imports the helpers of `build_scene.py`.
- Level: a copy of the template level. Its sun, sky atmosphere, sky light and height fog stay; the clouds and floor go.
- Geometry: 27 scaled engine cubes plus the engine's smoothest sphere (`/Engine/EditorMeshes/EditorSphere`, 3968 triangles; the basic sphere has 960 and shows facets).
- Materials: concrete is two greys blended by a world-space `Noise` node, so the scaled cubes need no UVs.
- Sequence: the sun's transform track keys pitch and yaw every 10 frames along a dawn-to-dusk arc. The camera slides slowly, like a motion-control time-lapse.
- Post process: histogram auto exposure, local exposure to lift the shadows, and Lumen scene and final gather update speeds of 4 so the bounce light keeps up with the moving sun.

```
python lumen_build.py                                          # level materials actors sequence save
python lumen_build.py render ../../_work/unreal/frames ../../media/engine/unreal-lumen.mp4
python lumen_build.py render ../../_work/unreal/test x.mp4 120 121 8   # one test frame
```

The build takes about 15 s. The render takes 35 s on a Radeon RX 9070 XT: 240 frames at 1280x720, 8 temporal samples, 60 warm-up frames.

## Neon light installation (`neon_build.py`)

`media/engine/unreal-neon.mp4`: six glowing tubes draw themselves, one after another, along the edges of a white gallery corner, and each one washes the walls in its color. The level has no light actor at all: Lumen uses the emissive tubes as the only light sources, and Lumen reflections show them in the polished floor.

- Level: a copy of the template level with every light, the sky, the fog and the clouds removed.
- Tubes: 14 cm engine cubes with emissive materials (strength 26). Each tube grows from one end: its transform track keys the length (`Scale.X`) and the center every 2 frames with an ease-out. The thickness stays near zero until the tube starts, so no glowing stub shows early.
- Post process: manual exposure, so the room really gets brighter as tubes switch on. Lumen scene detail 4 keeps the thin tubes in the Lumen scene, and final gather quality 4 keeps the colored bounce light clean.
- Same commands as above, with `neon_build.py`. The full render uses 16 temporal samples: `python neon_build.py render ../../_work/unreal/frames ../../media/engine/unreal-neon.mp4 -1 -1 16` (55 s).

## 3D light painting (`ribbons_build.py`)

`media/engine/unreal-ribbons.mp4`: five glowing ribbons weave a slowly turning knot in a black void, like a long-exposure photo of lights waved in the dark.

- Niagara: one system per color, each from the `LocationBasedRibbon` emitter template. In 5.8 that template has no spawn module and plays once, so the script sets `Loop Behavior` to Infinite, adds `SpawnRate` (240 per second), sets the emitter to world space, and sets lifetime, color and `Ribbon Width` (`Ribbon Width Mode` must be Direct Set first) on `InitializeParticle`.
- Material: unlit and additive. The ribbon UV gives a soft edge across the width (V) and a fade toward the tail (U).
- Sequence: each Niagara actor's location is keyed every 3 frames along its own 3D Lissajous curve; the particles stay where they were born, so the ribbon draws the path.
- Pre-roll: the sequence is 345 frames. The script renders all of them and encodes only the last 240, so the trails are already 3.4 s long on the first frame of the clip.
- `python ribbons_build.py render ../../_work/unreal/frames ../../media/engine/unreal-ribbons.mp4 8` (40 s).

## Rack focus (`focus_build.py`)

`media/engine/unreal-focus.mp4`: four strands of glowing bulbs hang at 1.6, 3, 5.5 and 11 m in a black void. The focus holds on the nearest strand, pulls to the 5.5 m strand, holds, then pulls to the farthest, so sharp points and bokeh discs swap places.

- Camera: a cine camera with a 75 mm lens at f/1.4 and a 7-blade diaphragm (`LensSettings.DiaphragmBladeCount`). Its focus method is Tracking on an invisible `TargetPoint`, so the focus pull is that point's location keys in Sequencer (smart-auto keys: eased pulls, flat holds, no overshoot). This avoids a property track on the camera component.
- Bulbs: 96 small emissive spheres. Spacing and size scale with depth, so every strand looks alike on screen, and a seeded jitter breaks the grid.
- Bokeh needs small, bright sources: with 32 px bulbs at 50 mm and f/2 the blur barely showed, so the lens went to 75 mm at f/1.4 and the bulbs shrank to about 20 px.
- `python focus_build.py render ../../_work/unreal/frames ../../media/engine/unreal-focus.mp4` (31 s).

## Known issues with the 5.8 experimental plugin

- The server sometimes resets the connection about 1 KB before the end of a large reply. `mcp_client.py` keeps what arrived: it repairs a cut PNG from `CaptureViewport`, and otherwise raises `MCPTruncated` (the tool still ran in the editor).
- `SequencerTools.set_camera_cut_binding` fails (`unreal.Guid()` does not take a string), so `build_scene.py` writes the binding id into the camera cut section's `CameraBindingID` property instead.
- `SequencerTools.add_actors` already gives a camera a transform track. Adding a second absolute transform track blends the two 50/50, so the script keys the existing one.
- The Niagara tools refuse to set inputs that are hidden or grayed out (for example `Attractor Position Offset` or `Kill Radius` behind a toggle). Set the input the toggle exposes by default (here `Attractor Position`).
- `CaptureViewport` needs `captureTransform` and `annotations` even though the schema marks them optional.
- `SceneTools.find_actors` needs `name` and `tag` (pass empty strings) even when you filter only by `actor_type`.
- `SceneTools.load_level` refuses to load a level that has unsaved changes, even when it is already the open level. `lumen_build.py` skips the load when the level is current.
- A transform section shorter than the sequence ends the animation early: the actor snaps back to its level position. `lumen_build.transform_section` takes the end frame for that reason.
