# Unreal Engine project (built through the Unreal MCP)

`media/engine/unreal-niagara.mp4`: about 45,000 GPU particles (two emitters) spiral into a glowing coral core over a glossy black studio floor, while the camera orbits down from a top view to a grazing view. Built in Unreal Engine 5.8 by talking to the editor's built-in MCP server, rendered with Movie Render Queue.

| File | What it is |
|---|---|
| `MotionStudio/MotionStudio.uproject` | Blank project with no C++. Enables the Unreal MCP (`ModelContextProtocol`), the toolsets it serves (`EditorToolset`, `NiagaraToolsets`, `AnimationAssistantToolset`), Niagara, Python, Sequencer scripting and Movie Render Queue |
| `MotionStudio/Config/DefaultEditorPerProjectUserSettings.ini` | Starts the MCP server with the editor on `http://127.0.0.1:8000/mcp`, with tool search on, and keeps the editor at full speed in the background |
| `MotionStudio/Config/DefaultEngine.ini` | Lumen global illumination and reflections, virtual shadow maps, DX12 SM6 |
| `MotionStudio/Content/Python/motion_studio/tools.py` | A project MCP toolset: `render_sequence`, `render_status`, `cancel_render` (Movie Render Queue). The built-in toolsets have no render tool |
| `mcp_client.py` | Small Python client for the MCP (Streamable HTTP, JSON-RPC): `initialize`, `tools/list`, `list_toolsets`, `describe_toolset`, `call_tool` |
| `build_scene.py` | Builds the whole scene through MCP calls only: level, materials, Niagara system, actors, Level Sequence |
| `render.py` | Renders through the project toolset over the MCP, then encodes the MP4 with FFmpeg |

## Run it

The project folder holds only sources. Copy it to a work folder, because Unreal writes `Saved/`, `Intermediate/` and `DerivedDataCache/` next to the `.uproject`:

```
cp -r MotionStudio ../../_work/unreal/
"B:/Program Files/Epic Games/UE_5.8/Engine/Binaries/Win64/UnrealEditor.exe" "<repo>/_work/unreal/MotionStudio/MotionStudio.uproject" -log -nosplash &
python mcp_client.py wait 540          # prints MCP READY once the server answers
python build_scene.py                  # all stages; or name some: level materials niagara actors sequence save
python render.py ../../_work/unreal/frames ../../media/engine/unreal-niagara.mp4
```

Then close the editor. The first launch on a new machine compiles shaders and can take much longer than the minute it took here with a warm shader cache. The build takes about a minute, and the render about 8 minutes on a Radeon RX 9070 XT: 150 frames at 1280x720, 8 temporal samples per frame (that is also the motion blur), and 60 warm-up frames so the vortex is already full on frame 0. `python render.py <dir> x.mp4 75 76` renders one test frame.

## What went through the MCP

Everything, using the server's tool-search tools (`list_toolsets`, `describe_toolset`, `call_tool`):

- Level: `AssetTools.duplicate` of `/Engine/Maps/Templates/Template_Default`, `save_assets`, `SceneTools.load_level`, `remove_from_scene` for the sun, sky and clouds.
- Materials: `MaterialTools.create_material`, `add_expression`, `connect_expressions`, `connect_to_output`, `recompile`, and `ObjectTools.set_properties` for node values and blend mode. The sparks use a masked, unlit material, so they are in the depth buffer and Lumen's screen traces can reflect them in the floor.
- Niagara: `NiagaraToolset_System.CreateNiagaraSystem`, `RemoveEmitter`, `AddEmitter` (Fountain template), `SetEmitterData` (GPU simulation, fixed bounds), `SetSystemData` (4 s warm-up), `SetStackInputData` (spawn rate, lifetime, colors, sizes, torus shape, an HLSL expression for the swirl velocity), `AddModule` (curl noise, vortex, point attraction, scale sprite size by speed), `SetRendererData` (velocity-aligned sprites), `GetStackIssues`.
- Actors: `SceneTools.add_to_scene_from_asset` and `add_to_scene_from_class`, `ActorTools.get_components`, `ObjectTools.set_properties` (lights, height fog, post-process volume, camera lens and focus, look-at tracking), `NiagaraToolset_Component.SetSystem`.
- Sequence: `SequencerTools.create_level_sequence`, `open_sequence`, `set_display_rate`, `set_playback_range`, `add_actors`, `get_tracks_on_binding`, `get_sections`, `add_track_to_sequence`, `add_section`, `set_section_range`, `get_binding_id`, and `SequencerKeyframingTools.add_key_float`.
- Render: the project toolset's `render_sequence` and `render_status`, which run Movie Render Queue in the editor (PIE executor).
- Checks while building: `EditorAppToolset.CaptureViewport` for viewport previews.

## Known issues with the 5.8 experimental plugin

- The server sometimes resets the connection about 1 KB before the end of a large reply. `mcp_client.py` keeps what arrived: it repairs a cut PNG from `CaptureViewport`, and otherwise raises `MCPTruncated` (the tool still ran in the editor).
- `SequencerTools.set_camera_cut_binding` fails (`unreal.Guid()` does not take a string), so `build_scene.py` writes the binding id into the camera cut section's `CameraBindingID` property instead.
- `SequencerTools.add_actors` already gives a camera a transform track. Adding a second absolute transform track blends the two 50/50, so the script keys the existing one.
- The Niagara tools refuse to set inputs that are hidden or grayed out (for example `Attractor Position Offset` or `Kill Radius` behind a toggle). Set the input the toggle exposes by default (here `Attractor Position`).
- `CaptureViewport` needs `captureTransform` and `annotations` even though the schema marks them optional.
