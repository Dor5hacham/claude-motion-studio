# Renders the Motion Studio sequence through the Unreal MCP: calls the project's own toolset
# (MotionStudio/Content/Python/motion_studio/tools.py, Movie Render Queue with 8 temporal samples
# per frame and 60 warm-up frames), waits until the frames are written, then encodes the MP4.
#   python render.py <frames_dir> <out.mp4>                 all 150 frames
#   python render.py <frames_dir> <out.mp4> <start> <end>   test range (end is exclusive), no MP4
import os
import subprocess
import sys
import time

from mcp_client import UnrealMCP

TOOLS = "motion_studio.tools.MotionStudioTools"


def main(frames_dir, out_mp4, start=-1, end=-1):
    m = UnrealMCP()
    frames_dir = os.path.abspath(frames_dir)
    args = {"sequence_path": "/Game/Cine/LS_Vortex.LS_Vortex", "map_path": "/Game/Maps/Studio.Studio",
            "output_dir": frames_dir.replace("\\", "/"), "start_frame": start, "end_frame": end}
    t0 = time.time()
    print(m.call(TOOLS, "render_sequence", args))
    while True:
        status = m.call(TOOLS, "render_status")["returnValue"]
        if status.startswith("done") or status.startswith("cancelled"):
            break
        time.sleep(5)
    print(f"{status} in {time.time() - t0:.0f} s")
    if not status.startswith("done ok"):
        sys.exit(1)
    if start < 0 and end < 0:
        subprocess.run(["ffmpeg", "-nostdin", "-v", "error", "-y", "-framerate", "30", "-start_number", "0",
                        "-i", os.path.join(frames_dir, "f_%04d.png"), "-c:v", "libx264", "-crf", "22",
                        "-preset", "slow", "-pix_fmt", "yuv420p", "-movflags", "+faststart", out_mp4], check=True)
        print("wrote", out_mp4)


if __name__ == "__main__":
    a = sys.argv[1:]
    if len(a) < 2:
        print("usage: python render.py <frames_dir> <out.mp4> [start end]")
        sys.exit(1)
    main(a[0], a[1], *(int(x) for x in a[2:4]))
