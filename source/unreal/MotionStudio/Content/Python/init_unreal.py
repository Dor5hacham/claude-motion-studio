# Copyright (c) 2026 Dor5hacham d5shacham@gmail.com. All rights reserved.
# SPDX-License-Identifier: Proprietary

# Runs when the editor starts (PythonScriptPlugin executes every Content/Python/init_unreal.py).
# Registers the project's own MCP toolset, so the render step can go through the Unreal MCP too.
from motion_studio import tools

tools.registration.register()
