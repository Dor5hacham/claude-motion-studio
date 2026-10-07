# Runs when the editor starts (PythonScriptPlugin executes every Content/Python/init_unreal.py).
# Registers the project's own MCP toolset, so the render step can go through the Unreal MCP too.
from motion_studio import tools

tools.registration.register()
