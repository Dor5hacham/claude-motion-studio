# pyright: reportAttributeAccessIssue=false
# (the `unreal` module exists only inside the Unreal Editor, so its members are unknown to the checker)
# Project toolset for the Unreal MCP: renders a Level Sequence with Movie Render Queue.
# The built-in toolsets build the scene but have no render tool. With tool search on, call it as
#   call_tool(toolset_name="motion_studio.tools.MotionStudioTools", tool_name="render_sequence", ...)
# then poll render_status until it reports done.
import os

import toolset_registry
import unreal
from toolset_registry.registration import Registration

_state = {"executor": None, "status": "idle", "output_dir": ""}


def _on_finished(executor, success):
    _state["status"] = "done ok" if success else "done failed"


@unreal.uclass()
class MotionStudioTools(unreal.ToolsetDefinition):
    """Renders Level Sequences to PNG frames with Movie Render Queue (in-editor PIE executor)."""

    @toolset_registry.tool_call
    @staticmethod
    def render_sequence(sequence_path: str, map_path: str, output_dir: str,
                        width: int = 1280, height: int = 720,
                        spatial_samples: int = 1, temporal_samples: int = 8,
                        warm_up_frames: int = 60, start_frame: int = -1, end_frame: int = -1) -> str:
        """Starts a Movie Render Queue render of a Level Sequence to PNG frames.

        Args:
            sequence_path: Object path of the Level Sequence, e.g. /Game/Cine/LS_Main.LS_Main.
            map_path: Object path of the level to render in, e.g. /Game/Maps/Studio.Studio.
            output_dir: Absolute folder for the frames (written as f_0000.png onward).
            width: Output width in pixels.
            height: Output height in pixels.
            spatial_samples: Anti-aliasing spatial samples per frame.
            temporal_samples: Temporal samples per frame (also gives motion blur).
            warm_up_frames: Engine and render warm-up frames before the first output frame,
                so particles, Lumen and exposure have settled.
            start_frame: First frame to render, or -1 for the sequence start (test renders).
            end_frame: Frame after the last one to render, or -1 for the sequence end.

        Returns:
            A short status line.
        """
        subsystem = unreal.get_editor_subsystem(unreal.MoviePipelineQueueSubsystem)
        if subsystem.is_rendering():
            return "already rendering"
        queue = subsystem.get_queue()
        queue.delete_all_jobs()
        job = queue.allocate_new_job(unreal.MoviePipelineExecutorJob)
        job.job_name = "motion_studio"
        job.sequence = unreal.SoftObjectPath(sequence_path)
        job.map = unreal.SoftObjectPath(map_path)
        cfg = job.get_configuration()
        out = cfg.find_or_add_setting_by_class(unreal.MoviePipelineOutputSetting)
        os.makedirs(output_dir, exist_ok=True)
        out.output_directory = unreal.DirectoryPath(output_dir)
        out.file_name_format = "f_{frame_number}"
        out.output_resolution = unreal.IntPoint(width, height)
        out.zero_pad_frame_numbers = 4
        out.override_existing_output = True
        if start_frame >= 0 or end_frame >= 0:
            out.use_custom_playback_range = True
            if start_frame >= 0:
                out.custom_start_frame = start_frame
            if end_frame >= 0:
                out.custom_end_frame = end_frame
        cfg.find_or_add_setting_by_class(unreal.MoviePipelineDeferredPassBase)
        cfg.find_or_add_setting_by_class(unreal.MoviePipelineImageSequenceOutput_PNG)
        cfg.find_or_add_setting_by_class(unreal.MoviePipelineGameOverrideSetting)
        aa = cfg.find_or_add_setting_by_class(unreal.MoviePipelineAntiAliasingSetting)
        aa.spatial_sample_count = spatial_samples
        aa.temporal_sample_count = temporal_samples
        aa.override_anti_aliasing = True
        aa.anti_aliasing_method = unreal.AntiAliasingMethod.AAM_NONE
        aa.engine_warm_up_count = warm_up_frames
        aa.render_warm_up_count = warm_up_frames
        aa.render_warm_up_frames = True
        _state["output_dir"] = output_dir
        _state["status"] = "rendering"
        executor = subsystem.render_queue_with_executor(unreal.MoviePipelinePIEExecutor)
        executor.on_executor_finished_delegate.add_callable_unique(_on_finished)
        _state["executor"] = executor
        return "render started"

    @toolset_registry.tool_call
    @staticmethod
    def render_status() -> str:
        """Reports the Movie Render Queue state and how many PNG frames exist so far.

        Returns:
            A line such as "rendering, 42 frames".
        """
        d = _state["output_dir"]
        n = len([f for f in os.listdir(d) if f.endswith(".png")]) if d and os.path.isdir(d) else 0
        return f'{_state["status"]}, {n} frames'


    @toolset_registry.tool_call
    @staticmethod
    def cancel_render() -> str:
        """Cancels a Movie Render Queue render that is in progress.

        Returns:
            A short status line.
        """
        executor = _state["executor"]
        if executor and executor.is_rendering():
            executor.cancel_all_jobs()
            _state["status"] = "cancelled"
            return "cancelled"
        return "nothing to cancel"


registration = Registration([MotionStudioTools])
